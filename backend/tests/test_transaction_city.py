"""Required city on new Give Away requests and Exchange offers."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest
from bson import ObjectId
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api.deps import auth as auth_deps
from app.api.routes.exchange_offers import router as exchange_offers_router
from app.api.routes.requests import router as requests_router
from app.services.exchange_offers import serialize_exchange_offer
from app.services.location import canonicalize_allowed_city, require_allowed_city
from app.services.requests import serialize_request

from test_exchange_acceptance import AtomicFakeCollection, match_query


class ToListCursor:
    def __init__(self, documents):
        self.documents = list(documents)

    def sort(self, *args, **kwargs):
        return self

    async def to_list(self, length=100):
        return [dict(document) for document in self.documents[:length]]


class ListableCollection(AtomicFakeCollection):
    def find(self, query, projection=None):
        matched = [dict(document) for document in self.documents if match_query(document, query)]
        return ToListCursor(matched)


VALID_REASON = "I am a university student and need this desk for my semester studies."
VALID_MESSAGE = "I would like to swap my jacket for your shoes."


def _user(user_id: str, name: str = "User") -> dict:
    return {
        "id": user_id,
        "name": name,
        "email": f"{name.lower()}@example.com",
        "is_verified": True,
        "whatsapp_number": "+923001234567",
    }


def _listing(owner_id: str, listing_mode: str = "BOTH") -> dict:
    return {
        "_id": ObjectId(),
        "title": "Nike Shoes",
        "owner_id": owner_id,
        "owner_name": "Owner",
        "status": "available",
        "listing_mode": listing_mode,
        "listing_expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "giveaway_paused": False,
    }


def test_city_normalization_accepts_allowed_cities_only():
    assert canonicalize_allowed_city("lahore") == "Lahore"
    assert canonicalize_allowed_city("Karachi") == "Karachi"
    assert canonicalize_allowed_city("Narnia") is None
    assert canonicalize_allowed_city("") is None
    assert require_allowed_city(" Islamabad ") == "Islamabad"
    assert require_allowed_city("hafizabad") == "Hafizabad"
    with pytest.raises(ValueError):
        require_allowed_city("@@@")
    with pytest.raises(ValueError):
        require_allowed_city("other")


def test_old_request_without_city_still_serializes():
    payload = serialize_request({
        "_id": ObjectId(),
        "item_id": "item-1",
        "item_title": "Nike Shoes",
        "requester_id": "user-1",
        "requester_name": "Sarah",
        "owner_id": "owner-1",
        "reason": VALID_REASON,
        "status": "pending",
        "created_at": datetime.now(timezone.utc),
    })
    assert payload["requester_city"] is None
    assert "phone" not in payload
    assert "address" not in payload
    assert "latitude" not in payload
    assert "longitude" not in payload


def test_old_exchange_offer_without_city_still_serializes():
    payload = serialize_exchange_offer({
        "_id": ObjectId(),
        "listing_id": "listing-1",
        "listing_title": "Nike Shoes",
        "offering_user_id": "offerer-1",
        "offering_user_name": "User A",
        "owner_user_id": "owner-1",
        "message": VALID_MESSAGE,
        "status": "PENDING",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    })
    assert payload["offering_user_city"] is None
    blob = str(payload)
    assert "phone" not in blob
    assert "address" not in blob
    assert "encrypted_" not in blob


@pytest.mark.asyncio
async def test_new_giveaway_request_without_city_is_rejected():
    listing = _listing("owner-1", "GIVEAWAY")
    app = FastAPI()
    app.include_router(requests_router, prefix="/api")
    requester = _user("requester-1", "Sarah")
    app.dependency_overrides[auth_deps.get_whatsapp_user] = lambda: requester
    app.dependency_overrides[auth_deps.get_current_user] = lambda: requester
    with patch("app.api.routes.requests.get_items_collection_async", AsyncMock(return_value=AtomicFakeCollection([listing]))), \
         patch("app.api.routes.requests.get_requests_collection_async", AsyncMock(return_value=AtomicFakeCollection([]))), \
         patch("app.api.routes.requests.check_user_rate_limit"):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            missing = await client.post(f"/api/requests/{listing['_id']}", json={"reason": VALID_REASON})
            invalid = await client.post(
                f"/api/requests/{listing['_id']}",
                json={"reason": VALID_REASON, "requester_city": "@@@"},
            )
    assert missing.status_code == 422
    assert invalid.status_code == 422


@pytest.mark.asyncio
async def test_new_giveaway_request_with_valid_city_succeeds():
    listing = _listing("owner-1", "GIVEAWAY")
    requests = AtomicFakeCollection([])
    app = FastAPI()
    app.include_router(requests_router, prefix="/api")
    requester = _user("requester-1", "Sarah")
    app.dependency_overrides[auth_deps.get_whatsapp_user] = lambda: requester
    with patch("app.api.routes.requests.get_items_collection_async", AsyncMock(return_value=AtomicFakeCollection([listing]))), \
         patch("app.api.routes.requests.get_requests_collection_async", AsyncMock(return_value=requests)), \
         patch("app.api.routes.requests.check_user_rate_limit"), \
         patch("app.api.routes.requests.create_notification", AsyncMock()):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                f"/api/requests/{listing['_id']}",
                json={
                    "reason": VALID_REASON,
                    "requester_city": "lahore",
                    "requester_id": "spoofed-user",
                    "owner_id": "spoofed-owner",
                    "phone_number": "+15555550100",
                    "address_line1": "10 Hidden Lane",
                },
            )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["requester_city"] == "Lahore"
    assert body["requester_id"] == "requester-1"
    assert body["requester_name"] == "Sarah"
    assert "phone" not in body
    assert "address" not in str(body)
    assert "10 Hidden Lane" not in str(body)
    stored = requests.documents[0]
    assert stored["requester_id"] == "requester-1"
    assert stored["requester_city"] == "Lahore"


@pytest.mark.asyncio
async def test_new_giveaway_request_with_typed_city_succeeds():
    listing = _listing("owner-1", "GIVEAWAY")
    requests = AtomicFakeCollection([])
    app = FastAPI()
    app.include_router(requests_router, prefix="/api")
    requester = _user("requester-1", "Sarah")
    app.dependency_overrides[auth_deps.get_whatsapp_user] = lambda: requester
    with patch("app.api.routes.requests.get_items_collection_async", AsyncMock(return_value=AtomicFakeCollection([listing]))), \
         patch("app.api.routes.requests.get_requests_collection_async", AsyncMock(return_value=requests)), \
         patch("app.api.routes.requests.check_user_rate_limit"), \
         patch("app.api.routes.requests.create_notification", AsyncMock()):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                f"/api/requests/{listing['_id']}",
                json={"reason": VALID_REASON, "requester_city": "hafizabad"},
            )
    assert response.status_code == 201, response.text
    assert response.json()["requester_city"] == "Hafizabad"
    assert requests.documents[0]["requester_city"] == "Hafizabad"


@pytest.mark.asyncio
async def test_giveaway_owner_can_see_requester_city():
    listing = _listing("owner-1")
    now = datetime.now(timezone.utc)
    requests = ListableCollection([
        {
            "_id": ObjectId(),
            "item_id": str(listing["_id"]),
            "item_title": listing["title"],
            "requester_id": "requester-1",
            "requester_name": "Sarah",
            "requester_city": "Lahore",
            "owner_id": "owner-1",
            "reason": VALID_REASON,
            "status": "pending",
            "created_at": now,
        },
        {
            "_id": ObjectId(),
            "item_id": str(listing["_id"]),
            "item_title": listing["title"],
            "requester_id": "requester-2",
            "requester_name": "Old User",
            "owner_id": "owner-1",
            "reason": VALID_REASON,
            "status": "pending",
            "created_at": now,
        },
    ])
    owner = _user("owner-1", "Owner")
    app = FastAPI()
    app.include_router(requests_router, prefix="/api")
    app.dependency_overrides[auth_deps.get_current_user] = lambda: owner
    with patch("app.api.routes.requests.get_requests_collection_async", AsyncMock(return_value=requests)), \
         patch("app.api.routes.requests.get_users_collection_async", AsyncMock(return_value=ListableCollection([]))), \
         patch("app.api.routes.requests.get_reviews_collection_async", AsyncMock(return_value=ListableCollection([]))), \
         patch("app.api.routes.requests.build_public_reputation_lookup", AsyncMock(return_value={})):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/requests/incoming")
    assert response.status_code == 200
    body = response.json()
    by_name = {row["requester_name"]: row for row in body}
    assert by_name["Sarah"]["requester_city"] == "Lahore"
    assert by_name["Old User"]["requester_city"] is None
    assert "phone_number" not in str(body)
    assert "address_line1" not in str(body)


@pytest.mark.asyncio
async def test_new_exchange_offer_without_city_is_rejected():
    listing = _listing("owner-1", "EXCHANGE")
    app = FastAPI()
    app.include_router(exchange_offers_router, prefix="/api")
    offerer = _user("offerer-1", "User A")
    app.dependency_overrides[auth_deps.get_whatsapp_user] = lambda: offerer
    with patch("app.api.routes.exchange_offers.get_items_collection_async", AsyncMock(return_value=AtomicFakeCollection([listing]))), \
         patch("app.api.routes.exchange_offers.get_exchange_offers_collection_async", AsyncMock(return_value=AtomicFakeCollection([]))), \
         patch("app.api.routes.exchange_offers.check_user_rate_limit"):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            missing = await client.post("/api/exchange-offers", json={
                "listing_id": str(listing["_id"]),
                "custom_item_title": "Jacket",
                "custom_item_condition": "Good",
                "custom_item_image": "https://example.com/jacket.jpg",
                "message": VALID_MESSAGE,
            })
            invalid = await client.post("/api/exchange-offers", json={
                "listing_id": str(listing["_id"]),
                "custom_item_title": "Jacket",
                "custom_item_condition": "Good",
                "custom_item_image": "https://example.com/jacket.jpg",
                "offering_user_city": "@@@",
                "message": VALID_MESSAGE,
            })
    assert missing.status_code == 422
    assert invalid.status_code == 422


@pytest.mark.asyncio
async def test_new_exchange_offer_with_valid_city_succeeds_and_owner_can_see_it():
    owner_id = "owner-1"
    listing = _listing(owner_id, "EXCHANGE")
    offers = AtomicFakeCollection([])
    items = AtomicFakeCollection([listing])
    offerer = _user("offerer-1", "User A")
    owner = _user(owner_id, "Owner")
    app = FastAPI()
    app.include_router(exchange_offers_router, prefix="/api")

    with patch("app.api.routes.exchange_offers.get_items_collection_async", AsyncMock(return_value=items)), \
         patch("app.api.routes.exchange_offers.get_exchange_offers_collection_async", AsyncMock(return_value=offers)), \
         patch("app.api.routes.exchange_offers.check_user_rate_limit"), \
         patch("app.api.routes.exchange_offers.create_notification", AsyncMock()), \
         patch("app.api.routes.exchange_offers._listing_blocks_new_offers", AsyncMock(return_value=False)), \
         patch("app.api.routes.exchange_offers.is_listing_publicly_active", return_value=True):
        app.dependency_overrides[auth_deps.get_whatsapp_user] = lambda: offerer
        app.dependency_overrides[auth_deps.get_current_user] = lambda: offerer
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            created = await client.post("/api/exchange-offers", json={
                "listing_id": str(listing["_id"]),
                "custom_item_title": "Jacket",
                "custom_item_description": "Soft brown jacket",
                "custom_item_condition": "Good",
                "custom_item_image": "https://example.com/jacket.jpg",
                "offering_user_city": "Lahore",
                "offering_user_id": "spoofed-offerer",
                "phone_number": "+15555550100",
                "address_line1": "88 Partner Avenue",
                "message": VALID_MESSAGE,
            })
            assert created.status_code == 201, created.text
            assert created.json()["offering_user_city"] == "Lahore"
            assert created.json()["offering_user_id"] == "offerer-1"

            app.dependency_overrides[auth_deps.get_current_user] = lambda: owner
            listed = await client.get(f"/api/items/{listing['_id']}/exchange-offers")

    assert listed.status_code == 200, listed.text
    offers_payload = listed.json()["offers"]
    assert len(offers_payload) == 1
    assert offers_payload[0]["offering_user_city"] == "Lahore"
    assert offers_payload[0]["offering_user_name"] == "User A"
    blob = str(offers_payload)
    assert "88 Partner Avenue" not in blob
    assert "+15555550100" not in blob


@pytest.mark.asyncio
async def test_old_exchange_offer_without_city_lists_for_owner():
    listing = _listing("owner-1")
    offer = {
        "_id": ObjectId(),
        "listing_id": str(listing["_id"]),
        "listing_title": listing["title"],
        "offering_user_id": "offerer-1",
        "offering_user_name": "User A",
        "owner_user_id": "owner-1",
        "message": VALID_MESSAGE,
        "status": "PENDING",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "custom_item_title": "Jacket",
    }
    owner = _user("owner-1", "Owner")
    app = FastAPI()
    app.include_router(exchange_offers_router, prefix="/api")
    app.dependency_overrides[auth_deps.get_current_user] = lambda: owner
    with patch("app.api.routes.exchange_offers.get_items_collection_async", AsyncMock(return_value=AtomicFakeCollection([listing]))), \
         patch("app.api.routes.exchange_offers.get_exchange_offers_collection_async", AsyncMock(return_value=AtomicFakeCollection([offer]))), \
         patch("app.api.routes.exchange_offers.expire_stale_exchange_offers", AsyncMock(return_value=0)):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get(f"/api/items/{listing['_id']}/exchange-offers")
    assert response.status_code == 200
    row = response.json()["offers"][0]
    assert row["offering_user_city"] is None
    assert row["offering_user_name"] == "User A"
