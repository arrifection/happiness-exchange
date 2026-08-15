"""One-off E2E verification for 14-day listing expiration (controlled timestamps)."""

from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import patch

from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import auth as auth_deps
from app.api.routes import items as items_routes
from app.api.routes import requests as requests_routes
from app.services.items import build_item_document, serialize_item
from app.services.listing_expiration import (
    LISTING_ACTIVE_DAYS,
    active_listings_mongo_clause,
    compute_listing_expires_at,
    is_listing_expired,
    is_listing_publicly_active,
    resolve_listing_expires_at,
)
from app.services.location import build_items_list_query
from app.schemas.items import ItemCreateRequest


class FakeCursor:
    def __init__(self, documents, query=None):
        self.documents = list(documents)
        self.query = query or {}

    def sort(self, key, direction):
        reverse = direction == -1
        self.documents.sort(key=lambda document: document.get(key), reverse=reverse)
        return self

    async def to_list(self, length=100):
        return self.documents[:length]

    async def count_documents(self, query):
        return len(self.documents)


class FakeCollection:
    def __init__(self, documents=None):
        self.documents = list(documents or [])

    async def find_one(self, query):
        if "_id" in query:
            for document in self.documents:
                if document.get("_id") == query["_id"]:
                    return document
            return None
        return None

    def find(self, query):
        return FakeCursor(self.documents, query)

    async def insert_one(self, document):
        stored = {**document}
        stored.setdefault("_id", ObjectId())
        self.documents.append(stored)
        return SimpleNamespace(inserted_id=stored["_id"])

    async def update_one(self, query, update):
        for document in self.documents:
            if document.get("_id") == query.get("_id"):
                document.update(update.get("$set", {}))
                return SimpleNamespace(modified_count=1)
        return SimpleNamespace(modified_count=0)

    async def count_documents(self, query):
        return len(self.documents)


def match_active_clause(document, clause):
    now = datetime.now(timezone.utc)
    stored = document.get("listing_expires_at")
    if stored is not None:
        return ensure_utc(stored) > now
    created = document.get("created_at")
    if created is not None:
        return ensure_utc(created) > now - timedelta(days=LISTING_ACTIVE_DAYS)
    return False


def ensure_utc(value):
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def assert_check(name, condition, detail=""):
    if not condition:
        print(f"FAIL: {name}" + (f" — {detail}" if detail else ""))
        return False
    print(f"PASS: {name}")
    return True


def main():
    ok = True
    fixed_now = datetime(2026, 6, 1, 12, 0, 0, tzinfo=timezone.utc)
    expires_at = fixed_now + timedelta(days=LISTING_ACTIVE_DAYS)

    ok &= assert_check(
        "1. New listing expiry is exactly 14 days from creation",
        compute_listing_expires_at(fixed_now) == expires_at,
        f"expected {expires_at}",
    )

    naive = datetime(2026, 6, 1, 12, 0, 0)
    ok &= assert_check(
        "2. Naive datetimes are normalized to UTC",
        compute_listing_expires_at(naive) == expires_at,
    )

    active_item = {
        "status": "available",
        "listing_expires_at": expires_at,
        "created_at": fixed_now,
    }
    ok &= assert_check(
        "3. Listing active before expiration",
        not is_listing_expired(active_item, now=expires_at - timedelta(seconds=1)),
    )
    ok &= assert_check(
        "4. Listing expired at expiration time",
        is_listing_expired(active_item, now=expires_at),
    )
    ok &= assert_check(
        "4b. Listing expired after expiration time",
        is_listing_expired(active_item, now=expires_at + timedelta(seconds=1)),
    )

    owner_id = str(ObjectId())
    other_id = str(ObjectId())
    requester_id = str(ObjectId())
    active_id = ObjectId()
    expired_id = ObjectId()
    expired_at = fixed_now - timedelta(hours=1)

    items_collection = FakeCollection(
        [
            {
                "_id": active_id,
                "title": "Active lamp",
                "description": "Bright lamp available for pickup this week.",
                "category": "Home",
                "condition": "Good",
                "location": "Karachi",
                "status": "available",
                "owner_id": owner_id,
                "owner_name": "Owner",
                "created_at": fixed_now,
                "listing_expires_at": fixed_now + timedelta(days=LISTING_ACTIVE_DAYS),
            },
            {
                "_id": expired_id,
                "title": "Expired chair",
                "description": "Comfortable chair that expired yesterday.",
                "category": "Furniture",
                "condition": "Good",
                "location": "Lahore",
                "status": "available",
                "owner_id": owner_id,
                "owner_name": "Owner",
                "created_at": expired_at - timedelta(days=LISTING_ACTIVE_DAYS),
                "listing_expires_at": expired_at,
            },
        ]
    )
    requests_collection = FakeCollection([])

    async def get_items_collection_async():
        return items_collection

    async def get_requests_collection_async():
        return requests_collection

    async def get_reviews_collection_async():
        return FakeCollection([])

    async def fake_award(*args, **kwargs):
        return True

    async def fake_reputation(*args, **kwargs):
        return {"level": "New Member", "trust_score": 0, "review_count": 0}

    items_routes.get_items_collection_async = get_items_collection_async
    items_routes.get_requests_collection_async = get_requests_collection_async
    items_routes.get_reviews_collection_async = get_reviews_collection_async
    items_routes.calculate_reputation_summary = fake_reputation
    requests_routes.get_items_collection_async = get_items_collection_async
    requests_routes.get_requests_collection_async = get_requests_collection_async

    owner = {
        "id": owner_id,
        "name": "Owner",
        "email": "owner@example.com",
        "is_verified": True,
        "whatsapp_number": "+923001234567",
    }
    other = {**owner, "id": other_id, "email": "other@example.com"}
    requester = {
        "id": requester_id,
        "name": "Requester",
        "email": "requester@example.com",
        "is_verified": True,
        "whatsapp_number": "+923001234567",
    }

    app = FastAPI()
    app.include_router(items_routes.router, prefix="/api")
    app.include_router(requests_routes.router, prefix="/api")

    with (
        patch("app.services.listing_expiration.utc_now", return_value=fixed_now),
        patch("app.api.routes.items.utc_now", return_value=fixed_now),
    ):
        serialized_active = serialize_item(items_collection.documents[0])
        serialized_expired = serialize_item(items_collection.documents[1])
        ok &= assert_check(
            "12. Backend active/expired flags match boundary timestamps",
            serialized_active["listing_active"] is True
            and serialized_active["is_expired"] is False
            and serialized_expired["listing_active"] is False
            and serialized_expired["is_expired"] is True,
        )

        ok &= assert_check(
            "5. Expired listings excluded from active browse query",
            is_listing_publicly_active(items_collection.documents[0], now=fixed_now)
            and not is_listing_publicly_active(items_collection.documents[1], now=fixed_now),
        )

    with TestClient(app) as client:
        app.dependency_overrides[auth_deps.get_whatsapp_user] = lambda: requester
        expired_request = client.post(
            f"/api/requests/{expired_id}",
            json={"reason": "I need this expired listing to verify request blocking behavior."},
        )
        ok &= assert_check(
            "6. Requests blocked for expired listings",
            expired_request.status_code == 400
            and "expired" in expired_request.json()["detail"].lower(),
            expired_request.text,
        )

        app.dependency_overrides[auth_deps.get_verified_user] = lambda: other
        renew_other = client.post(f"/api/items/{expired_id}/renew")
        ok &= assert_check(
            "7. Non-owner cannot renew",
            renew_other.status_code == 403,
            renew_other.text,
        )

        app.dependency_overrides[auth_deps.get_verified_user] = lambda: owner
        with (
            patch("app.services.listing_expiration.utc_now", return_value=fixed_now),
            patch("app.api.routes.items.utc_now", return_value=fixed_now),
        ):
            renew_active = client.post(f"/api/items/{active_id}/renew")
        ok &= assert_check(
            "8. Active listing cannot be renewed",
            renew_active.status_code == 400
            and "still active" in renew_active.json()["detail"].lower(),
            renew_active.text,
        )

        with (
            patch("app.services.listing_expiration.utc_now", return_value=fixed_now),
            patch("app.api.routes.items.utc_now", return_value=fixed_now),
        ):
            renew_expired = client.post(f"/api/items/{expired_id}/renew")
        ok &= assert_check("9. Expired listing renew succeeds", renew_expired.status_code == 200, renew_expired.text)
        if renew_expired.status_code == 200:
            body = renew_expired.json()
            stored = items_collection.documents[1]
            expected_expiry = compute_listing_expires_at(fixed_now)
            ok &= assert_check(
                "9b. Renewal expiry is exactly 14 days from renewal time",
                resolve_listing_expires_at(stored) == expected_expiry,
                f"stored={stored.get('listing_expires_at')} expected={expected_expiry}",
            )
            ok &= assert_check(
                "10. Renewed listing is active again",
                body["listing_active"] is True and body["is_expired"] is False,
            )

    stored_expiry_before = items_collection.documents[1]["listing_expires_at"]
    with patch("app.services.listing_expiration.utc_now", return_value=fixed_now + timedelta(days=30)):
        reloaded = serialize_item(items_collection.documents[1])
    ok &= assert_check(
        "11. Stored expiration persists across later reads (no reset on re-serialize)",
        items_collection.documents[1]["listing_expires_at"] == stored_expiry_before
        and reloaded["listing_expires_at"] == stored_expiry_before,
    )

    payload = ItemCreateRequest(
        title="Verification desk",
        description="Used only to verify listing expiration document fields.",
        category="Home",
        condition="Good",
        location="Islamabad",
    )
    with patch("app.services.listing_expiration.utc_now", return_value=fixed_now):
        document = build_item_document(payload, owner)
        document["created_at"] = fixed_now
    ok &= assert_check(
        "1b. Create document stores listing_expires_at in DB shape",
        document.get("listing_expires_at") == compute_listing_expires_at(fixed_now),
    )

    print("\nOVERALL:", "PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
