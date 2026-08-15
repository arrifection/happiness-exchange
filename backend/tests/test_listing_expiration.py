from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest import IsolatedAsyncioTestCase

from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import auth as auth_deps
from app.api.routes import items as items_routes
from app.services.listing_expiration import (
    LISTING_ACTIVE_DAYS,
    compute_listing_expires_at,
    is_listing_expired,
    is_listing_publicly_active,
    resolve_listing_expires_at,
)


class FakeCursor:
    def __init__(self, documents):
        self.documents = list(documents)

    def sort(self, key, direction):
        reverse = direction == -1
        self.documents.sort(key=lambda document: document.get(key), reverse=reverse)
        return self

    async def to_list(self, length=100):
        return self.documents[:length]


class FakeCollection:
    def __init__(self, documents=None):
        self.documents = list(documents or [])

    async def find_one(self, query):
        for document in self.documents:
            if document.get("_id") == query.get("_id"):
                return document
        return None

    def find(self, query):
        return FakeCursor(self.documents)

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


class ListingExpirationTests(IsolatedAsyncioTestCase):
    def test_compute_listing_expires_at_is_14_days(self):
        created = datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc)
        expires = compute_listing_expires_at(created)
        self.assertEqual(expires, created + timedelta(days=LISTING_ACTIVE_DAYS))

    def test_legacy_item_without_expiry_field_uses_created_at(self):
        created = datetime.now(timezone.utc) - timedelta(days=15)
        item = {"created_at": created, "status": "available"}
        self.assertTrue(is_listing_expired(item))
        self.assertFalse(is_listing_publicly_active(item))

    def test_renew_endpoint_extends_expiry(self):
        owner_id = str(ObjectId())
        item_id = ObjectId()
        expired_at = datetime.now(timezone.utc) - timedelta(hours=1)
        items_collection = FakeCollection(
            [
                {
                    "_id": item_id,
                    "title": "Chair",
                    "description": "A comfortable chair ready for a new home.",
                    "category": "Furniture",
                    "condition": "Good",
                    "location": "Lahore",
                    "status": "available",
                    "owner_id": owner_id,
                    "owner_name": "Owner",
                    "created_at": expired_at - timedelta(days=LISTING_ACTIVE_DAYS),
                    "listing_expires_at": expired_at,
                }
            ]
        )

        async def get_items_collection_async():
            return items_collection

        async def get_requests_collection_async():
            return FakeCollection([])

        async def get_reviews_collection_async():
            return FakeCollection([])

        async def fake_calculate_reputation_summary(*args, **kwargs):
            return {"level": "New Member", "trust_score": 0, "review_count": 0}

        items_routes.get_items_collection_async = get_items_collection_async
        items_routes.get_requests_collection_async = get_requests_collection_async
        items_routes.get_reviews_collection_async = get_reviews_collection_async
        items_routes.calculate_reputation_summary = fake_calculate_reputation_summary

        app = FastAPI()
        app.include_router(items_routes.router, prefix="/api")
        owner = {
            "id": owner_id,
            "name": "Owner",
            "email": "owner@example.com",
            "is_verified": True,
            "whatsapp_number": "+923001234567",
        }
        app.dependency_overrides[auth_deps.get_verified_user] = lambda: owner

        with TestClient(app) as client:
            response = client.post(f"/api/items/{item_id}/renew")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertFalse(body["is_expired"])
        self.assertTrue(body["listing_active"])
        renewed_expiry = resolve_listing_expires_at(items_collection.documents[0])
        self.assertGreater(renewed_expiry, datetime.now(timezone.utc) + timedelta(days=13))
