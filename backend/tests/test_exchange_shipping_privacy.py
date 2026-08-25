"""User-side Exchange shipping privacy, actions, and notification tests."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest
from bson import ObjectId
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api.deps import auth as auth_deps
from app.api.routes.admin import exchange as admin_exchange_routes
from app.api.routes.exchange_offers import router as exchange_offers_router
from app.api.routes.exchange_transactions import router as exchange_transactions_router
from app.api.routes.notifications import router as notifications_router
from app.services.encryption import decrypt_text, encrypt_text
from app.services.exchange_notifications import (
    cancelled_copy,
    completed_copy,
    counter_accepted_copy,
    counter_received_copy,
    expired_copy,
    item_delivered_copy,
    item_shipped_copy,
    new_swap_offer_copy,
    offer_accepted_copy,
    offer_declined_copy,
    shipping_payment_confirmed_copy,
    shipping_payment_required_copy,
    tracking_updated_copy,
)
from app.services.exchange_shipping import serialize_shipping_for_participant
from app.services.notifications import create_notification

from test_exchange_acceptance import AtomicFakeCollection, match_query


OWNER_ADDRESS = "10 Hidden Lane"
OWNER_PHONE = "+15555550100"
OFFERER_ADDRESS = "88 Partner Avenue"
OFFERER_PHONE = "+15555550999"
PII_FRAGMENTS = (OWNER_ADDRESS, OWNER_PHONE, OFFERER_ADDRESS, OFFERER_PHONE)

SHIPPING_DETAILS = {
    "full_name": "Owner Person",
    "phone_number": "+15555550111",
    "address_line1": "99 Secret Street",
    "city": "Karachi",
    "postal_code": "74000",
    "country": "PK",
    "notes": "Leave at gate",
}


def _user(user_id: str, name: str = "User") -> dict:
    return {
        "id": user_id,
        "name": name,
        "email": f"{name.lower()}@example.com",
        "is_verified": True,
    }


def _staff(role: str, name: str = "Staff") -> dict:
    return {
        "id": str(ObjectId()),
        "name": name,
        "email": f"{role}@example.com",
        "role": role,
        "is_verified": True,
        "created_at": datetime.now(timezone.utc),
    }


class NotificationCursor:
    def __init__(self, documents):
        self.documents = list(documents)

    def sort(self, *args, **kwargs):
        return self

    def limit(self, count):
        self.documents = self.documents[:count]
        return self

    async def to_list(self, length=100):
        return [dict(document) for document in self.documents[:length]]


class NotificationsCollection(AtomicFakeCollection):
    def find(self, query):
        matched = [dict(document) for document in self.documents if match_query(document, query)]
        return NotificationCursor(matched)


def _blob(value) -> str:
    return json.dumps(value, default=str)


def assert_no_shipping_pii(payload) -> None:
    blob = _blob(payload)
    for fragment in PII_FRAGMENTS:
        assert fragment not in blob
    assert "encrypted_" not in blob
    assert "99 Secret Street" not in blob
    assert "+15555550111" not in blob


@pytest.fixture
def shipping_world():
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
        "description": "Gently used running shoes",
        "condition": "Good",
    }
    offer = {
        "_id": offer_id,
        "listing_id": str(listing_id),
        "listing_title": "Nike Shoes",
        "custom_item_title": "Leather Jacket",
        "custom_item_image": "https://example.com/jacket.jpg",
        "custom_item_description": "Soft brown jacket",
        "custom_item_condition": "Very Good",
        "cash_adjustment": 15.0,
        "status": "ACCEPTED",
        "transaction_id": str(tx_id),
        "owner_user_id": owner_id,
        "offering_user_id": offerer_id,
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
        "admin_instructions": "Use prepaid label for owner",
        "admin_notes": "Owner lives at 10 Hidden Lane",
        "encrypted_full_name": None,
        "encrypted_phone_number": None,
        "encrypted_address_line1": None,
        "encrypted_city": None,
        "encrypted_country": None,
        "updated_at": now,
    }
    shipping_b = {
        "_id": ship_b_id,
        "exchange_transaction_id": str(tx_id),
        "sender_user_id": offerer_id,
        "sender_user_name": "Offerer",
        "receiver_user_id": owner_id,
        "shipping_status": "awaiting_payment",
        "shipping_cost": 20.0,
        "payment_status": "pending",
        "payment_due_at": now,
        "tracking_number": "TRACK-B",
        "carrier": "TCS",
        "admin_instructions": f"Deliver to {OFFERER_ADDRESS}",
        "admin_notes": OFFERER_PHONE,
        "encrypted_full_name": encrypt_text("Bea Offerer"),
        "encrypted_phone_number": encrypt_text(OFFERER_PHONE),
        "encrypted_address_line1": encrypt_text(OFFERER_ADDRESS),
        "encrypted_city": encrypt_text("Lahore"),
        "encrypted_country": encrypt_text("PK"),
        "updated_at": now,
    }
    return {
        "tx_id": tx_id,
        "offer_id": offer_id,
        "listing_id": listing_id,
        "ship_a_id": ship_a_id,
        "ship_b_id": ship_b_id,
        "owner_id": owner_id,
        "offerer_id": offerer_id,
        "items": AtomicFakeCollection([listing]),
        "offers": AtomicFakeCollection([offer]),
        "transactions": AtomicFakeCollection([transaction]),
        "shipping": AtomicFakeCollection([shipping_a, shipping_b]),
        "notifications": NotificationsCollection([]),
    }


def _user_app(user, world):
    app = FastAPI()
    app.include_router(exchange_transactions_router, prefix="/api")
    app.include_router(exchange_offers_router, prefix="/api")
    app.include_router(admin_exchange_routes.router, prefix="/api/admin")
    app.include_router(notifications_router, prefix="/api/notifications")
    app.dependency_overrides[auth_deps.get_current_user] = lambda: user
    return app


def _user_patches(world):
    return (
        patch("app.api.routes.exchange_transactions.get_exchange_transactions_collection_async", AsyncMock(return_value=world["transactions"])),
        patch("app.api.routes.exchange_transactions.get_exchange_shipping_collection_async", AsyncMock(return_value=world["shipping"])),
        patch("app.api.routes.exchange_transactions.get_exchange_offers_collection_async", AsyncMock(return_value=world["offers"])),
        patch("app.api.routes.exchange_transactions.get_items_collection_async", AsyncMock(return_value=world["items"])),
        patch("app.api.routes.admin.exchange.get_exchange_transactions_collection_async", AsyncMock(return_value=world["transactions"])),
        patch("app.api.routes.admin.exchange.get_exchange_shipping_collection_async", AsyncMock(return_value=world["shipping"])),
        patch("app.api.routes.admin.exchange.get_exchange_offers_collection_async", AsyncMock(return_value=world["offers"])),
        patch("app.api.routes.admin.exchange.get_items_collection_async", AsyncMock(return_value=world["items"])),
        patch("app.api.routes.notifications.get_notifications_collection_async", AsyncMock(return_value=world["notifications"])),
        patch("app.services.notifications.get_notifications_collection_async", AsyncMock(return_value=world["notifications"])),
        patch("app.api.routes.exchange_offers.create_notification", AsyncMock()),
        patch("app.api.routes.exchange_transactions.create_notification", AsyncMock()),
        patch("app.services.exchange_workflow.create_notification", AsyncMock()),
    )


async def _as_user(world, user):
    app = _user_app(user, world)
    patches = _user_patches(world)
    for patched in patches:
        patched.start()
    transport = ASGITransport(app=app)
    client = AsyncClient(transport=transport, base_url="http://test")
    return client, patches


async def _stop(client, patches):
    await client.aclose()
    for patched in patches:
        patched.stop()


def test_serialize_shipping_hides_partner_private_fields():
    shipping = {
        "_id": ObjectId(),
        "sender_user_id": "user-b",
        "sender_user_name": "Offerer",
        "receiver_user_id": "user-a",
        "shipping_status": "shipped",
        "shipping_cost": 44.0,
        "payment_status": "paid",
        "payment_due_at": datetime.now(timezone.utc),
        "tracking_number": "TRACK-B",
        "carrier": "TCS",
        "admin_instructions": f"Send to {OFFERER_ADDRESS}",
        "encrypted_address_line1": encrypt_text(OFFERER_ADDRESS),
        "encrypted_phone_number": encrypt_text(OFFERER_PHONE),
        "updated_at": datetime.now(timezone.utc),
    }
    partner_view = serialize_shipping_for_participant(shipping, "user-a")
    own_view = serialize_shipping_for_participant(shipping, "user-b")
    assert partner_view["admin_instructions"] is None
    assert partner_view["shipping_cost"] is None
    assert partner_view["payment_due_at"] is None
    assert partner_view["tracking_number"] == "TRACK-B"
    assert partner_view["carrier"] == "TCS"
    assert "encrypted_address_line1" not in partner_view
    assert own_view["admin_instructions"] == f"Send to {OFFERER_ADDRESS}"
    assert own_view["shipping_cost"] == 44.0


def test_notification_copy_has_no_shipping_pii():
    copies = [
        new_swap_offer_copy("Alice", "Nike Shoes"),
        offer_accepted_copy("Nike Shoes"),
        offer_declined_copy("Nike Shoes"),
        counter_received_copy("Nike Shoes"),
        counter_accepted_copy("Nike Shoes"),
        shipping_payment_required_copy(),
        shipping_payment_confirmed_copy(),
        item_shipped_copy(),
        tracking_updated_copy(),
        item_delivered_copy(),
        completed_copy("Nike Shoes"),
        expired_copy(),
        cancelled_copy(),
    ]
    for title, message in copies:
        assert_no_shipping_pii({"title": title, "message": message})
        assert OWNER_ADDRESS not in message
        assert OWNER_PHONE not in message


@pytest.mark.asyncio
async def test_user_a_cannot_read_user_b_shipping_address(shipping_world):
    owner = _user(shipping_world["owner_id"], "Owner")
    client, patches = await _as_user(shipping_world, owner)
    try:
        response = await client.get(f"/api/exchange-transactions/{shipping_world['tx_id']}")
    finally:
        await _stop(client, patches)

    assert response.status_code == 200
    body = response.json()
    assert_no_shipping_pii(body)
    partner = next(record for record in body["shipping_records"] if record["sender_user_id"] == shipping_world["offerer_id"])
    assert partner["admin_instructions"] is None
    assert partner["tracking_number"] == "TRACK-B"
    assert partner["carrier"] == "TCS"
    assert body["listing_title"] == "Nike Shoes"
    assert body["listing_image_url"] == "https://example.com/shoes.jpg"
    assert body["offered_item_title"] == "Leather Jacket"
    assert body["offered_item_description"] == "Soft brown jacket"
    assert body["offered_item_condition"] == "Very Good"
    assert body["cash_adjustment"] == 15.0


@pytest.mark.asyncio
async def test_user_b_cannot_read_user_a_shipping_address(shipping_world):
    owner_shipping = await shipping_world["shipping"].find_one({"_id": shipping_world["ship_a_id"]})
    owner_shipping["encrypted_full_name"] = encrypt_text("Ada Owner")
    owner_shipping["encrypted_phone_number"] = encrypt_text(OWNER_PHONE)
    owner_shipping["encrypted_address_line1"] = encrypt_text(OWNER_ADDRESS)
    owner_shipping["encrypted_city"] = encrypt_text("Karachi")
    owner_shipping["encrypted_country"] = encrypt_text("PK")
    owner_shipping["admin_instructions"] = f"Pickup at {OWNER_ADDRESS}"

    offerer = _user(shipping_world["offerer_id"], "Offerer")
    client, patches = await _as_user(shipping_world, offerer)
    try:
        response = await client.get(f"/api/exchange-transactions/{shipping_world['tx_id']}")
    finally:
        await _stop(client, patches)

    assert response.status_code == 200
    body = response.json()
    partner = next(record for record in body["shipping_records"] if record["sender_user_id"] == shipping_world["owner_id"])
    assert partner["admin_instructions"] is None
    assert OWNER_ADDRESS not in _blob(partner)
    assert OWNER_PHONE not in _blob(partner)
    assert "encrypted_" not in _blob(body)
    own = next(record for record in body["shipping_records"] if record["sender_user_id"] == shipping_world["offerer_id"])
    assert own["tracking_number"] == "TRACK-B"


@pytest.mark.asyncio
async def test_normal_user_cannot_access_admin_shipping_endpoint(shipping_world):
    owner = _user(shipping_world["owner_id"], "Owner")
    owner["role"] = "user"
    client, patches = await _as_user(shipping_world, owner)
    try:
        response = await client.get(f"/api/admin/exchange-shipping/{shipping_world['ship_b_id']}")
    finally:
        await _stop(client, patches)
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_user_can_only_submit_own_shipping_details(shipping_world):
    offerer = _user(shipping_world["offerer_id"], "Offerer")
    # Offerer already has details; owner still awaiting_details.
    owner = _user(shipping_world["owner_id"], "Owner")
    client, patches = await _as_user(shipping_world, owner)
    try:
        response = await client.post(
            f"/api/exchange-transactions/{shipping_world['tx_id']}/shipping-details",
            json={
                **SHIPPING_DETAILS,
                "sender_user_id": shipping_world["offerer_id"],
                "partner_user_id": shipping_world["offerer_id"],
                "shipping_id": str(shipping_world["ship_b_id"]),
            },
        )
    finally:
        await _stop(client, patches)

    assert response.status_code == 200
    owner_shipping = await shipping_world["shipping"].find_one({"_id": shipping_world["ship_a_id"]})
    offerer_shipping = await shipping_world["shipping"].find_one({"_id": shipping_world["ship_b_id"]})
    assert decrypt_text(owner_shipping["encrypted_address_line1"]) == "99 Secret Street"
    assert decrypt_text(offerer_shipping["encrypted_address_line1"]) == OFFERER_ADDRESS
    assert_no_shipping_pii(response.json())


@pytest.mark.asyncio
async def test_user_cannot_modify_another_users_shipping_record(shipping_world):
    owner = _user(shipping_world["owner_id"], "Owner")
    client, patches = await _as_user(shipping_world, owner)
    try:
        already = await client.post(
            f"/api/exchange-transactions/{shipping_world['tx_id']}/shipping-details",
            json=SHIPPING_DETAILS,
        )
        again = await client.post(
            f"/api/exchange-transactions/{shipping_world['tx_id']}/shipping-details",
            json={**SHIPPING_DETAILS, "address_line1": "12 Other Street"},
        )
    finally:
        await _stop(client, patches)

    assert already.status_code == 200
    assert again.status_code == 400
    offerer_shipping = await shipping_world["shipping"].find_one({"_id": shipping_world["ship_b_id"]})
    assert decrypt_text(offerer_shipping["encrypted_address_line1"]) == OFFERER_ADDRESS


@pytest.mark.asyncio
async def test_user_cannot_modify_tracking_carrier_or_mark_shipped_delivered(shipping_world):
    owner = _user(shipping_world["owner_id"], "Owner")
    owner["role"] = "user"
    tx_id = shipping_world["tx_id"]
    ship_b = shipping_world["ship_b_id"]
    client, patches = await _as_user(shipping_world, owner)
    try:
        patch_details = await client.patch(
            f"/api/exchange-transactions/{tx_id}/shipping-details",
            json={"tracking_number": "HACK", "carrier": "HACK", "shipping_status": "shipped"},
        )
        mark_shipped = await client.post(f"/api/exchange-transactions/{tx_id}/mark-shipped")
        mark_delivered = await client.post(f"/api/exchange-transactions/{tx_id}/mark-delivered")
        user_shipping = await client.patch(
            f"/api/exchange-shipping/{ship_b}",
            json={"tracking_number": "HACK", "carrier": "HACK", "shipping_status": "delivered"},
        )
        admin_tracking = await client.patch(
            f"/api/admin/exchange-shipping/{ship_b}",
            json={"tracking_number": "HACK", "carrier": "HACK"},
        )
        admin_shipped = await client.patch(
            f"/api/admin/exchange-shipping/{ship_b}",
            json={"shipping_status": "shipped"},
        )
        admin_delivered = await client.patch(
            f"/api/admin/exchange-shipping/{ship_b}",
            json={"shipping_status": "delivered"},
        )
    finally:
        await _stop(client, patches)

    assert patch_details.status_code in {404, 405}
    assert mark_shipped.status_code in {404, 405}
    assert mark_delivered.status_code in {404, 405}
    assert user_shipping.status_code in {404, 405}
    assert admin_tracking.status_code == 403
    assert admin_shipped.status_code == 403
    assert admin_delivered.status_code == 403
    offerer_shipping = await shipping_world["shipping"].find_one({"_id": ship_b})
    assert offerer_shipping["tracking_number"] == "TRACK-B"
    assert offerer_shipping["carrier"] == "TCS"
    assert offerer_shipping["shipping_status"] == "awaiting_payment"


@pytest.mark.asyncio
async def test_stranger_cannot_submit_shipping_details(shipping_world):
    stranger = _user(str(ObjectId()), "Stranger")
    client, patches = await _as_user(shipping_world, stranger)
    try:
        response = await client.post(
            f"/api/exchange-transactions/{shipping_world['tx_id']}/shipping-details",
            json=SHIPPING_DETAILS,
        )
        get_res = await client.get(f"/api/exchange-transactions/{shipping_world['tx_id']}")
    finally:
        await _stop(client, patches)
    assert response.status_code == 403
    assert get_res.status_code == 403


@pytest.mark.asyncio
async def test_exchange_notifications_appear_in_user_notification_list(shipping_world):
    owner = _user(shipping_world["owner_id"], "Owner")
    await shipping_world["notifications"].insert_one({
        "user_id": owner["id"],
        "title": "New Swap Offer",
        "message": "Someone sent you a swap offer for Nike Shoes.",
        "type": "exchange_offer_received",
        "action_url": f"/items/{shipping_world['listing_id']}",
        "read": False,
        "created_at": datetime.now(timezone.utc),
        "dedupe_key": f"exchange_offer_received:{shipping_world['offer_id']}",
    })
    client, patches = await _as_user(shipping_world, owner)
    try:
        response = await client.get("/api/notifications")
    finally:
        await _stop(client, patches)

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["type"] == "exchange_offer_received"
    assert body[0]["title"] == "New Swap Offer"
    assert_no_shipping_pii(body)


@pytest.mark.asyncio
async def test_duplicate_unread_notification_is_skipped():
    notifications = NotificationsCollection([])
    with patch("app.services.notifications.get_notifications_collection_async", AsyncMock(return_value=notifications)):
        await create_notification(
            "user-1",
            "Tracking Updated",
            "New tracking information is available for your exchange.",
            "exchange_tracking_updated",
            "/exchange/abc",
            dedupe_key="exchange_tracking_updated:ship-1:TRACK123:TCS",
        )
        await create_notification(
            "user-1",
            "Tracking Updated",
            "New tracking information is available for your exchange.",
            "exchange_tracking_updated",
            "/exchange/abc",
            dedupe_key="exchange_tracking_updated:ship-1:TRACK123:TCS",
        )
    assert len(notifications.documents) == 1


@pytest.mark.asyncio
async def test_admin_shipping_notifications_go_to_correct_recipients(shipping_world):
    admin = _staff("admin")
    app = FastAPI()
    app.include_router(admin_exchange_routes.router, prefix="/api/admin")
    app.dependency_overrides[auth_deps.get_current_user] = lambda: admin
    notify = AsyncMock()
    patches = (
        patch("app.api.routes.admin.exchange.get_exchange_transactions_collection_async", AsyncMock(return_value=shipping_world["transactions"])),
        patch("app.api.routes.admin.exchange.get_exchange_shipping_collection_async", AsyncMock(return_value=shipping_world["shipping"])),
        patch("app.api.routes.admin.exchange.get_exchange_offers_collection_async", AsyncMock(return_value=shipping_world["offers"])),
        patch("app.api.routes.admin.exchange.get_items_collection_async", AsyncMock(return_value=shipping_world["items"])),
        patch("app.api.routes.admin.exchange.create_notification", notify),
        patch("app.api.routes.admin.exchange.sync_transaction_progress", AsyncMock(return_value={"id": str(shipping_world["tx_id"])})),
    )
    for patched in patches:
        patched.start()
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            cost = await client.patch(
                f"/api/admin/exchange-shipping/{shipping_world['ship_a_id']}",
                json={"shipping_cost": 18.5},
            )
            shipped = await client.patch(
                f"/api/admin/exchange-shipping/{shipping_world['ship_a_id']}",
                json={"shipping_status": "shipped"},
            )
            delivered = await client.patch(
                f"/api/admin/exchange-shipping/{shipping_world['ship_a_id']}",
                json={"shipping_status": "delivered"},
            )
    finally:
        for patched in patches:
            patched.stop()

    assert cost.status_code == 200
    assert shipped.status_code == 200
    assert delivered.status_code == 200
    by_type = {call.kwargs["type_"]: call.kwargs for call in notify.call_args_list}
    assert by_type["exchange_shipping_payment_required"]["user_id"] == shipping_world["owner_id"]
    assert by_type["exchange_item_shipped"]["user_id"] == shipping_world["offerer_id"]
    assert by_type["exchange_item_delivered"]["user_id"] == shipping_world["offerer_id"]
    for payload in by_type.values():
        assert_no_shipping_pii(payload)
        assert "/exchange/" in (payload.get("action_url") or "")


@pytest.mark.asyncio
async def test_repeat_admin_tracking_update_does_not_renotify(shipping_world):
    admin = _staff("admin")
    app = FastAPI()
    app.include_router(admin_exchange_routes.router, prefix="/api/admin")
    app.dependency_overrides[auth_deps.get_current_user] = lambda: admin
    notify = AsyncMock()
    patches = (
        patch("app.api.routes.admin.exchange.get_exchange_transactions_collection_async", AsyncMock(return_value=shipping_world["transactions"])),
        patch("app.api.routes.admin.exchange.get_exchange_shipping_collection_async", AsyncMock(return_value=shipping_world["shipping"])),
        patch("app.api.routes.admin.exchange.get_exchange_offers_collection_async", AsyncMock(return_value=shipping_world["offers"])),
        patch("app.api.routes.admin.exchange.get_items_collection_async", AsyncMock(return_value=shipping_world["items"])),
        patch("app.api.routes.admin.exchange.create_notification", notify),
        patch("app.api.routes.admin.exchange.sync_transaction_progress", AsyncMock(return_value={"id": str(shipping_world["tx_id"])})),
    )
    for patched in patches:
        patched.start()
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            first = await client.patch(
                f"/api/admin/exchange-shipping/{shipping_world['ship_a_id']}",
                json={"tracking_number": "TRACK123", "carrier": "TCS"},
            )
            second = await client.patch(
                f"/api/admin/exchange-shipping/{shipping_world['ship_a_id']}",
                json={"tracking_number": "TRACK123", "carrier": "TCS"},
            )
    finally:
        for patched in patches:
            patched.stop()

    assert first.status_code == 200
    assert second.status_code == 200
    tracking_calls = [
        call for call in notify.call_args_list
        if call.kwargs.get("type_") == "exchange_tracking_updated"
    ]
    assert notify.call_count == 1
    assert tracking_calls


@pytest.mark.asyncio
async def test_offer_notification_goes_to_listing_owner():
    listing_id = ObjectId()
    owner_id = str(ObjectId())
    offerer_id = str(ObjectId())
    listing = {
        "_id": listing_id,
        "title": "Nike Shoes",
        "owner_id": owner_id,
        "owner_name": "Owner",
        "status": "available",
        "listing_mode": "EXCHANGE",
        "listing_expires_at": datetime.now(timezone.utc) + timedelta(days=7),
    }
    items = AtomicFakeCollection([listing])
    offers = AtomicFakeCollection([])
    offerer = _user(offerer_id, "Offerer")
    offerer["whatsapp_number"] = "+15550001111"
    notify = AsyncMock()
    app = FastAPI()
    app.include_router(exchange_offers_router, prefix="/api")
    app.dependency_overrides[auth_deps.get_whatsapp_user] = lambda: offerer
    app.dependency_overrides[auth_deps.get_current_user] = lambda: offerer
    patches = (
        patch("app.api.routes.exchange_offers.get_items_collection_async", AsyncMock(return_value=items)),
        patch("app.api.routes.exchange_offers.get_exchange_offers_collection_async", AsyncMock(return_value=offers)),
        patch("app.api.routes.exchange_offers.check_user_rate_limit"),
        patch("app.api.routes.exchange_offers.create_notification", notify),
    )
    for patched in patches:
        patched.start()
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post("/api/exchange-offers", json={
                "listing_id": str(listing_id),
                "custom_item_title": "Jacket",
                "custom_item_condition": "Good",
                "custom_item_image": "https://example.com/jacket.jpg",
                "offering_user_city": "Lahore",
                "message": "I would like to swap my jacket for your shoes.",
            })
    finally:
        for patched in patches:
            patched.stop()

    assert response.status_code == 201, response.text
    assert notify.call_count == 1
    kwargs = notify.call_args.kwargs
    assert kwargs["user_id"] == owner_id
    assert kwargs["type_"] == "exchange_offer_received"
    assert_no_shipping_pii(kwargs)


@pytest.mark.asyncio
async def test_decline_and_counter_notifications_go_to_offerer():
    listing_id = ObjectId()
    offer_id = ObjectId()
    owner_id = str(ObjectId())
    offerer_id = str(ObjectId())
    now = datetime.now(timezone.utc)
    listing = {
        "_id": listing_id,
        "title": "Nike Shoes",
        "owner_id": owner_id,
        "owner_name": "Owner",
        "status": "available",
        "listing_mode": "EXCHANGE",
        "listing_expires_at": now + timedelta(days=7),
    }
    offer = {
        "_id": offer_id,
        "listing_id": str(listing_id),
        "listing_title": "Nike Shoes",
        "offering_user_id": offerer_id,
        "offering_user_name": "Offerer",
        "owner_user_id": owner_id,
        "owner_user_name": "Owner",
        "message": "I would like to swap my jacket for your shoes.",
        "status": "PENDING",
        "created_at": now,
        "updated_at": now,
        "expires_at": now + timedelta(days=7),
    }
    items = AtomicFakeCollection([listing])
    offers = AtomicFakeCollection([offer])
    owner = _user(owner_id, "Owner")
    notify = AsyncMock()
    app = FastAPI()
    app.include_router(exchange_offers_router, prefix="/api")
    app.dependency_overrides[auth_deps.get_current_user] = lambda: owner
    patches = (
        patch("app.api.routes.exchange_offers.get_items_collection_async", AsyncMock(return_value=items)),
        patch("app.api.routes.exchange_offers.get_exchange_offers_collection_async", AsyncMock(return_value=offers)),
        patch("app.api.routes.exchange_offers.create_notification", notify),
    )
    for patched in patches:
        patched.start()
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            counter = await client.post(
                f"/api/exchange-offers/{offer_id}/counter",
                json={"message": "Could you add a little cash to the swap?"},
            )
            decline = await client.patch(f"/api/exchange-offers/{offer_id}/decline")
    finally:
        for patched in patches:
            patched.stop()

    assert counter.status_code == 200, counter.text
    assert decline.status_code == 200, decline.text
    types = [call.kwargs["type_"] for call in notify.call_args_list]
    assert "exchange_counter_received" in types
    assert "exchange_offer_declined" in types
    for call in notify.call_args_list:
        assert call.kwargs["user_id"] == offerer_id
        assert_no_shipping_pii(call.kwargs)
