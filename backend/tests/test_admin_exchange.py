"""Admin Exchange / shipping management API tests."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from bson import ObjectId
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api.deps import auth as auth_deps
from app.api.routes.admin import exchange as admin_exchange_routes
from app.services.encryption import encrypt_text

from test_exchange_acceptance import AtomicFakeCollection


def _staff(role: str, name: str = "Staff"):
    return {
        "id": str(ObjectId()),
        "name": name,
        "email": f"{role}@example.com",
        "role": role,
        "is_verified": True,
        "created_at": datetime.now(timezone.utc),
    }


def _app(user):
    app = FastAPI()
    app.include_router(admin_exchange_routes.router, prefix="/api/admin")
    app.dependency_overrides[auth_deps.get_current_user] = lambda: user
    return app


@pytest.fixture
def exchange_admin_world():
    listing_id = ObjectId()
    offer_id = ObjectId()
    tx_id = ObjectId()
    ship_a_id = ObjectId()
    ship_b_id = ObjectId()
    owner_id = str(ObjectId())
    offerer_id = str(ObjectId())
    now = datetime.now(timezone.utc)
    listing = {
        "_id": listing_id,
        "title": "Nike Shoes",
        "image_url": "https://example.com/shoes.jpg",
        "status": "exchange_reserved",
        "listing_mode": "BOTH",
    }
    offer = {
        "_id": offer_id,
        "listing_id": str(listing_id),
        "custom_item_title": "Leather Jacket",
        "custom_item_image": "https://example.com/jacket.jpg",
        "status": "ACCEPTED",
        "transaction_id": str(tx_id),
    }
    transaction = {
        "_id": tx_id,
        "exchange_offer_id": str(offer_id),
        "listing_id": str(listing_id),
        "listing_title": "Nike Shoes",
        "user_a_id": owner_id,
        "user_a_name": "Owner",
        "user_b_id": offerer_id,
        "user_b_name": "Offerer",
        "status": "COLLECTING_SHIPPING",
        "created_at": now,
        "updated_at": now,
        "completed_at": None,
    }
    shipping_a = {
        "_id": ship_a_id,
        "exchange_transaction_id": str(tx_id),
        "sender_user_id": owner_id,
        "sender_user_name": "Owner",
        "receiver_user_id": offerer_id,
        "shipping_status": "awaiting_details",
        "shipping_cost": None,
        "payment_status": "pending",
        "tracking_number": None,
        "carrier": None,
        "admin_instructions": None,
        "admin_notes": None,
        "encrypted_full_name": encrypt_text("Ada Owner"),
        "encrypted_phone_number": encrypt_text("+15555550100"),
        "encrypted_address_line1": encrypt_text("10 Hidden Lane"),
        "encrypted_city": encrypt_text("Karachi"),
        "encrypted_country": encrypt_text("PK"),
        "updated_at": now,
    }
    shipping_b = {
        "_id": ship_b_id,
        "exchange_transaction_id": str(tx_id),
        "sender_user_id": offerer_id,
        "sender_user_name": "Offerer",
        "receiver_user_id": owner_id,
        "shipping_status": "awaiting_details",
        "shipping_cost": None,
        "payment_status": "pending",
        "tracking_number": None,
        "carrier": None,
        "admin_instructions": None,
        "admin_notes": None,
        "updated_at": now,
    }
    return {
        "tx_id": tx_id,
        "ship_a_id": ship_a_id,
        "items": AtomicFakeCollection([listing]),
        "offers": AtomicFakeCollection([offer]),
        "transactions": AtomicFakeCollection([transaction]),
        "shipping": AtomicFakeCollection([shipping_a, shipping_b]),
    }


def _patches(world):
    return (
        patch("app.api.routes.admin.exchange.get_exchange_transactions_collection_async", AsyncMock(return_value=world["transactions"])),
        patch("app.api.routes.admin.exchange.get_exchange_shipping_collection_async", AsyncMock(return_value=world["shipping"])),
        patch("app.api.routes.admin.exchange.get_items_collection_async", AsyncMock(return_value=world["items"])),
        patch("app.api.routes.admin.exchange.get_exchange_offers_collection_async", AsyncMock(return_value=world["offers"])),
    )


@pytest.mark.asyncio
async def test_regular_user_cannot_list_admin_exchanges(exchange_admin_world):
    app = _app(_staff("user", "Regular"))
    patches = _patches(exchange_admin_world)
    for patched in patches:
        patched.start()
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/admin/exchange-transactions")
    finally:
        for patched in patches:
            patched.stop()
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_moderator_cannot_access_admin_exchanges(exchange_admin_world):
    app = _app(_staff("moderator"))
    patches = _patches(exchange_admin_world)
    for patched in patches:
        patched.start()
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/admin/exchange-transactions")
    finally:
        for patched in patches:
            patched.stop()
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_admin_can_list_exchange_transactions_without_pii(exchange_admin_world):
    app = _app(_staff("admin"))
    patches = _patches(exchange_admin_world)
    for patched in patches:
        patched.start()
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/admin/exchange-transactions")
    finally:
        for patched in patches:
            patched.stop()
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    tx = body["transactions"][0]
    assert tx["listing_title"] == "Nike Shoes"
    assert tx["listing_image_url"] == "https://example.com/shoes.jpg"
    assert tx["offered_item_title"] == "Leather Jacket"
    assert tx["user_a_name"] == "Owner"
    assert tx["user_b_name"] == "Offerer"
    blob = str(body)
    assert "10 Hidden Lane" not in blob
    assert "+15555550100" not in blob
    assert "Ada Owner" not in blob
    assert "address_line1" not in blob
    assert "phone_number" not in blob


@pytest.mark.asyncio
async def test_admin_can_open_exchange_detail(exchange_admin_world):
    app = _app(_staff("super_admin"))
    patches = _patches(exchange_admin_world)
    for patched in patches:
        patched.start()
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get(f"/api/admin/exchange-transactions/{exchange_admin_world['tx_id']}")
    finally:
        for patched in patches:
            patched.stop()
    assert response.status_code == 200
    assert response.json()["id"] == str(exchange_admin_world["tx_id"])
    assert len(response.json()["shipping_records"]) == 2
    assert "address_line1" not in str(response.json())


@pytest.mark.asyncio
async def test_admin_can_view_protected_shipping_information(exchange_admin_world):
    app = _app(_staff("admin"))
    patches = _patches(exchange_admin_world)
    for patched in patches:
        patched.start()
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get(f"/api/admin/exchange-shipping/{exchange_admin_world['ship_a_id']}")
    finally:
        for patched in patches:
            patched.stop()
    assert response.status_code == 200
    body = response.json()
    assert body["full_name"] == "Ada Owner"
    assert body["phone_number"] == "+15555550100"
    assert body["address_line1"] == "10 Hidden Lane"


@pytest.mark.asyncio
async def test_regular_user_cannot_view_protected_shipping(exchange_admin_world):
    app = _app(_staff("user"))
    patches = _patches(exchange_admin_world)
    for patched in patches:
        patched.start()
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get(f"/api/admin/exchange-shipping/{exchange_admin_world['ship_a_id']}")
    finally:
        for patched in patches:
            patched.stop()
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_admin_can_update_shipping_fields(exchange_admin_world):
    app = _app(_staff("admin"))
    patches = _patches(exchange_admin_world)
    for patched in patches:
        patched.start()
    try:
        with patch("app.api.routes.admin.exchange.sync_transaction_progress", AsyncMock(return_value={"id": str(exchange_admin_world["tx_id"]), "status": "AWAITING_PAYMENT"})), \
             patch("app.api.routes.admin.exchange.create_notification", AsyncMock()):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                cost = await client.patch(
                    f"/api/admin/exchange-shipping/{exchange_admin_world['ship_a_id']}",
                    json={"shipping_cost": 12.5},
                )
                tracking = await client.patch(
                    f"/api/admin/exchange-shipping/{exchange_admin_world['ship_a_id']}",
                    json={"tracking_number": "TRACK123", "carrier": "TCS"},
                )
                status_res = await client.patch(
                    f"/api/admin/exchange-shipping/{exchange_admin_world['ship_a_id']}",
                    json={"shipping_status": "ready_to_ship"},
                )
                payment = await client.patch(
                    f"/api/admin/exchange-shipping/{exchange_admin_world['ship_a_id']}",
                    json={"payment_status": "paid"},
                )
                notes = await client.patch(
                    f"/api/admin/exchange-shipping/{exchange_admin_world['ship_a_id']}",
                    json={"admin_instructions": "Use prepaid label", "admin_notes": "Called sender"},
                )
    finally:
        for patched in patches:
            patched.stop()

    assert cost.status_code == 200
    assert tracking.status_code == 200
    assert status_res.status_code == 200
    assert payment.status_code == 200
    assert notes.status_code == 200
    shipping = await exchange_admin_world["shipping"].find_one({"_id": exchange_admin_world["ship_a_id"]})
    assert shipping["shipping_cost"] == 12.5
    assert shipping["tracking_number"] == "TRACK123"
    assert shipping["carrier"] == "TCS"
    assert shipping["shipping_status"] == "ready_to_ship"
    assert shipping["payment_status"] == "paid"
    assert shipping["admin_instructions"] == "Use prepaid label"
    assert shipping["admin_notes"] == "Called sender"
