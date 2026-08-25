"""
Tests for the Exchange / Swap system (separate from Give Away requests).
"""
import asyncio
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from bson import ObjectId
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api.deps import auth as auth_deps
from app.api.routes.exchange_offers import router as exchange_offers_router
from app.services.exchange_offers import (
    build_exchange_offer_document,
    item_supports_exchange,
    item_supports_giveaway,
)


def _user(user_id: str, name: str = "User") -> dict:
    return {"id": user_id, "name": name, "email": f"{name.lower()}@example.com", "is_verified": True}


def _listing(owner_id: str, listing_mode: str = "EXCHANGE") -> dict:
    return {
        "_id": ObjectId(),
        "title": "Nike Shoes",
        "owner_id": owner_id,
        "owner_name": "Owner",
        "status": "available",
        "listing_mode": listing_mode,
        "listing_expires_at": datetime.now(timezone.utc),
    }


class TestExchangeHelpers:
    def test_item_supports_exchange_modes(self):
        assert item_supports_exchange({"listing_mode": "EXCHANGE"}) is True
        assert item_supports_exchange({"listing_mode": "BOTH"}) is True
        assert item_supports_exchange({"listing_mode": "GIVEAWAY"}) is False
        assert item_supports_exchange({}) is False

    def test_item_supports_giveaway_modes(self):
        assert item_supports_giveaway({"listing_mode": "GIVEAWAY"}) is True
        assert item_supports_giveaway({"listing_mode": "BOTH"}) is True
        assert item_supports_giveaway({"listing_mode": "EXCHANGE"}) is False
        assert item_supports_giveaway({}) is True

    def test_build_exchange_offer_document_custom_item(self):
        listing = _listing("owner-1")
        payload = type("Payload", (), {
            "offered_listing_id": None,
            "custom_item_image": "https://example.com/shoe.jpg",
            "custom_item_title": "Watch",
            "custom_item_description": "Nice watch",
            "custom_item_condition": "Good",
            "custom_item_estimated_value": 50,
            "message": "Would love to swap my watch for your shoes.",
            "cash_adjustment": 10,
        })()
        doc = build_exchange_offer_document(listing, _user("offerer-1", "Alice"), payload)
        assert doc["listing_id"] == str(listing["_id"])
        assert doc["offering_user_id"] == "offerer-1"
        assert doc["owner_user_id"] == "owner-1"
        assert doc["custom_item_title"] == "Watch"
        assert doc["status"] == "PENDING"
        assert doc["cash_adjustment"] == 10.0


@pytest.fixture
def exchange_app():
    app = FastAPI()
    app.include_router(exchange_offers_router, prefix="/api")
    app.dependency_overrides[auth_deps.get_whatsapp_user] = lambda: _user("default-user", "Default")
    yield app
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_create_exchange_offer_rejects_own_listing(exchange_app):
    listing = _listing("user-1")
    items_collection = AsyncMock()
    items_collection.find_one = AsyncMock(return_value=listing)
    offers_collection = AsyncMock()

    with patch("app.api.routes.exchange_offers.get_items_collection_async", AsyncMock(return_value=items_collection)), \
         patch("app.api.routes.exchange_offers.get_exchange_offers_collection_async", AsyncMock(return_value=offers_collection)), \
         patch("app.api.routes.exchange_offers.check_user_rate_limit"), \
         patch("app.api.routes.exchange_offers.create_notification", AsyncMock()):
        exchange_app.dependency_overrides[auth_deps.get_whatsapp_user] = lambda: _user("user-1")
        transport = ASGITransport(app=exchange_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post("/api/exchange-offers", json={
                "listing_id": str(listing["_id"]),
                "custom_item_title": "Jacket",
                "custom_item_condition": "Good",
                "custom_item_image": "https://example.com/jacket.jpg",
                "offering_user_city": "Lahore",
                "message": "I would like to swap my jacket for your shoes.",
            })

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_create_exchange_offer_with_existing_listing(exchange_app):
    owner_id = "owner-1"
    offerer_id = "offerer-1"
    listing = _listing(owner_id)
    offered = {
        "_id": ObjectId(),
        "title": "Watch",
        "owner_id": offerer_id,
        "status": "available",
    }
    items_collection = AsyncMock()

    async def find_item(query):
        oid = query.get("_id")
        if oid == listing["_id"]:
            return listing
        if oid == offered["_id"]:
            return offered
        return None

    items_collection.find_one = AsyncMock(side_effect=find_item)
    offers_collection = AsyncMock()
    offers_collection.insert_one = AsyncMock(return_value=type("Result", (), {"inserted_id": ObjectId()})())
    created = build_exchange_offer_document(
        listing,
        _user(offerer_id, "Bob"),
        type("Payload", (), {
            "offered_listing_id": str(offered["_id"]),
            "custom_item_image": None,
            "custom_item_title": None,
            "custom_item_description": None,
            "custom_item_condition": None,
            "custom_item_estimated_value": None,
            "message": "Swap my watch for your Nike shoes please.",
            "cash_adjustment": None,
        })(),
    )
    created["_id"] = ObjectId()
    offers_collection.find_one = AsyncMock(return_value=created)

    with patch("app.api.routes.exchange_offers.get_items_collection_async", AsyncMock(return_value=items_collection)), \
         patch("app.api.routes.exchange_offers.get_exchange_offers_collection_async", AsyncMock(return_value=offers_collection)), \
         patch("app.api.routes.exchange_offers.check_user_rate_limit"), \
         patch("app.api.routes.exchange_offers.create_notification", AsyncMock()), \
         patch("app.api.routes.exchange_offers._listing_blocks_new_offers", AsyncMock(return_value=False)), \
         patch("app.api.routes.exchange_offers.is_listing_publicly_active", return_value=True):
        exchange_app.dependency_overrides[auth_deps.get_whatsapp_user] = lambda: _user(offerer_id, "Bob")
        transport = ASGITransport(app=exchange_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post("/api/exchange-offers", json={
                "listing_id": str(listing["_id"]),
                "offered_listing_id": str(offered["_id"]),
                "offering_user_city": "Karachi",
                "message": "Swap my watch for your Nike shoes please.",
            })

    assert response.status_code == 201
    assert response.json()["status"] == "PENDING"


@pytest.mark.asyncio
async def test_multiple_users_can_create_offers_on_available_listing(exchange_app):
    listing = _listing("owner-1", listing_mode="BOTH")
    items_collection = AsyncMock()
    items_collection.find_one = AsyncMock(return_value=listing)
    stored = {}

    async def insert_one(document):
        oid = ObjectId()
        stored[oid] = {**document, "_id": oid}
        return type("Result", (), {"inserted_id": oid})()

    async def find_one(query):
        oid = query.get("_id")
        if oid in stored:
            return stored[oid]
        return None

    offers_collection = AsyncMock()
    offers_collection.insert_one = AsyncMock(side_effect=insert_one)
    offers_collection.find_one = AsyncMock(side_effect=find_one)

    payload = {
        "listing_id": str(listing["_id"]),
        "custom_item_title": "Jacket",
        "custom_item_condition": "Good",
        "custom_item_image": "https://example.com/jacket.jpg",
        "offering_user_city": "Lahore",
        "message": "I would like to swap my jacket for your shoes.",
    }

    with patch("app.api.routes.exchange_offers.get_items_collection_async", AsyncMock(return_value=items_collection)), \
         patch("app.api.routes.exchange_offers.get_exchange_offers_collection_async", AsyncMock(return_value=offers_collection)), \
         patch("app.api.routes.exchange_offers.check_user_rate_limit"), \
         patch("app.api.routes.exchange_offers.create_notification", AsyncMock()), \
         patch("app.api.routes.exchange_offers.is_listing_publicly_active", return_value=True):
        transport = ASGITransport(app=exchange_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            exchange_app.dependency_overrides[auth_deps.get_whatsapp_user] = lambda: _user("offerer-a", "Ann")
            first = await client.post("/api/exchange-offers", json=payload)
            exchange_app.dependency_overrides[auth_deps.get_whatsapp_user] = lambda: _user("offerer-b", "Ben")
            second = await client.post("/api/exchange-offers", json={
                **payload,
                "custom_item_title": "Watch",
                "custom_item_image": "https://example.com/watch.jpg",
                "message": "I would like to swap my watch for your shoes.",
            })

    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["status"] == "PENDING"
    assert second.json()["status"] == "PENDING"
    assert first.json()["offering_user_id"] == "offerer-a"
    assert second.json()["offering_user_id"] == "offerer-b"
    assert first.json()["id"] != second.json()["id"]
    assert listing["status"] == "available"
    assert len(stored) == 2


@pytest.mark.asyncio
async def test_giveaway_request_blocked_on_exchange_only_listing():
    from app.api.routes import requests as requests_module

    listing = _listing("owner-1", listing_mode="EXCHANGE")
    assert item_supports_giveaway(listing) is False

    with patch.object(requests_module, "item_supports_giveaway", return_value=False):
        assert requests_module.item_supports_giveaway(listing) is False
