"""Focused tests for Exchange Offer expiration and recovery."""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from bson import ObjectId
from httpx import ASGITransport, AsyncClient

from app.api.routes.exchange_offers import EXCHANGE_OFFER_EXPIRED_MESSAGE
from app.services.exchange_offer_expiration import (
    expire_offer_if_stale,
    expire_stale_exchange_offers,
)
from app.services.exchange_workflow import expire_unpaid_exchange

from test_exchange_acceptance import (
    AtomicFakeCollection,
    _accept,
    _auth_app,
    _offer_doc,
    _setup_listing_and_users,
)


def _past():
    return datetime.now(timezone.utc) - timedelta(days=1)


def _future():
    return datetime.now(timezone.utc) + timedelta(days=14)


@pytest.fixture
def expiration_world():
    owner_oid, offerer_a_oid, offerer_b_oid, listing = _setup_listing_and_users()
    listing["listing_mode"] = "BOTH"
    offer_a_id = ObjectId()
    offer_b_id = ObjectId()
    offer_a = _offer_doc(offer_a_id, listing, offerer_a_oid)
    offer_a["expires_at"] = _past()
    offer_a["custom_item_title"] = "Jacket"
    offer_a["custom_item_image"] = "https://example.com/jacket.jpg"
    offer_a["custom_item_condition"] = "Good"
    offer_b = _offer_doc(offer_b_id, listing, offerer_b_oid)
    offer_b["expires_at"] = _future()
    items = AtomicFakeCollection([listing])
    offers = AtomicFakeCollection([offer_a, offer_b])
    transactions = AtomicFakeCollection([])
    shipping = AtomicFakeCollection([])
    users = AtomicFakeCollection([
        {"_id": owner_oid, "name": "Owner"},
        {"_id": offerer_a_oid, "name": "Offerer A"},
        {"_id": offerer_b_oid, "name": "Offerer B"},
    ])
    requests = AtomicFakeCollection([
        {
            "_id": ObjectId(),
            "item_id": str(listing["_id"]),
            "requester_id": str(ObjectId()),
            "owner_id": listing["owner_id"],
            "status": "pending",
            "reason": "I need this lamp for studying at night after work.",
        }
    ])
    return SimpleNamespace(
        owner_oid=owner_oid,
        offerer_a_oid=offerer_a_oid,
        offerer_b_oid=offerer_b_oid,
        listing=listing,
        offer_a_id=offer_a_id,
        offer_b_id=offer_b_id,
        items=items,
        offers=offers,
        transactions=transactions,
        shipping=shipping,
        users=users,
        requests=requests,
    )


@pytest.mark.asyncio
async def test_pending_offer_past_expires_at_becomes_expired(expiration_world):
    expired_count = await expire_stale_exchange_offers(expiration_world.offers)
    assert expired_count == 1
    offer_a = await expiration_world.offers.find_one({"_id": expiration_world.offer_a_id})
    assert offer_a["status"] == "EXPIRED"
    assert offer_a["custom_item_title"] == "Jacket"
    assert offer_a["custom_item_image"] == "https://example.com/jacket.jpg"
    listing = await expiration_world.items.find_one({"_id": expiration_world.listing["_id"]})
    assert listing["status"] == "available"
    assert len(expiration_world.offers.documents) == 2
    assert len(expiration_world.requests.documents) == 1


@pytest.mark.asyncio
async def test_countered_offer_past_expires_at_becomes_expired(expiration_world):
    await expiration_world.offers.update_one(
        {"_id": expiration_world.offer_a_id},
        {"$set": {"status": "COUNTERED", "counter_message": "Plus 10"}},
    )
    await expire_stale_exchange_offers(expiration_world.offers)
    offer_a = await expiration_world.offers.find_one({"_id": expiration_world.offer_a_id})
    assert offer_a["status"] == "EXPIRED"
    assert offer_a["counter_message"] == "Plus 10"
    assert len(expiration_world.transactions.documents) == 0


@pytest.mark.asyncio
async def test_non_expired_offers_remain_unchanged(expiration_world):
    await expire_stale_exchange_offers(expiration_world.offers)
    offer_b = await expiration_world.offers.find_one({"_id": expiration_world.offer_b_id})
    assert offer_b["status"] == "PENDING"
    assert offer_b["expires_at"] > datetime.now(timezone.utc)


@pytest.mark.asyncio
async def test_expired_offer_cannot_be_accepted(expiration_world):
    owner = {
        "id": str(expiration_world.owner_oid),
        "name": "Owner",
        "email": "owner@example.com",
        "is_verified": True,
    }
    app = _auth_app(owner)
    with patch("app.api.routes.exchange_offers.get_exchange_offers_collection_async", AsyncMock(return_value=expiration_world.offers)), \
         patch("app.api.routes.exchange_offers.get_items_collection_async", AsyncMock(return_value=expiration_world.items)), \
         patch("app.api.routes.exchange_offers.get_exchange_transactions_collection_async", AsyncMock(return_value=expiration_world.transactions)), \
         patch("app.api.routes.exchange_offers.get_exchange_shipping_collection_async", AsyncMock(return_value=expiration_world.shipping)), \
         patch("app.api.routes.exchange_offers.get_users_collection_async", AsyncMock(return_value=expiration_world.users)):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.patch(f"/api/exchange-offers/{expiration_world.offer_a_id}/accept")
    assert response.status_code == 400
    assert response.json()["detail"] == EXCHANGE_OFFER_EXPIRED_MESSAGE
    assert "409" not in str(response.json()["detail"])
    offer_a = await expiration_world.offers.find_one({"_id": expiration_world.offer_a_id})
    assert offer_a["status"] == "EXPIRED"
    assert len(expiration_world.transactions.documents) == 0


@pytest.mark.asyncio
async def test_expired_offer_cannot_be_countered(expiration_world):
    owner = {
        "id": str(expiration_world.owner_oid),
        "name": "Owner",
        "email": "owner@example.com",
        "is_verified": True,
    }
    app = _auth_app(owner)
    with patch("app.api.routes.exchange_offers.get_exchange_offers_collection_async", AsyncMock(return_value=expiration_world.offers)), \
         patch("app.api.routes.exchange_offers.get_items_collection_async", AsyncMock(return_value=expiration_world.items)), \
         patch("app.api.routes.exchange_offers.create_notification", AsyncMock()):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                f"/api/exchange-offers/{expiration_world.offer_a_id}/counter",
                json={"message": "I can do the jacket plus 10."},
            )
    assert response.status_code == 400
    assert response.json()["detail"] == EXCHANGE_OFFER_EXPIRED_MESSAGE
    offer_a = await expiration_world.offers.find_one({"_id": expiration_world.offer_a_id})
    assert offer_a["status"] == "EXPIRED"
    assert offer_a.get("counter_message") in (None, "")


@pytest.mark.asyncio
async def test_expired_offers_are_not_deleted(expiration_world):
    await expire_stale_exchange_offers(expiration_world.offers)
    await expire_stale_exchange_offers(expiration_world.offers)
    assert len(expiration_world.offers.documents) == 2
    offer_a = await expiration_world.offers.find_one({"_id": expiration_world.offer_a_id})
    assert offer_a["custom_item_image"] == "https://example.com/jacket.jpg"


@pytest.mark.asyncio
async def test_accepted_offer_does_not_expire_from_original_expires_at(expiration_world):
    await expiration_world.offers.update_one(
        {"_id": expiration_world.offer_a_id},
        {"$set": {"expires_at": _future()}},
    )
    with patch("app.services.exchange_workflow.create_notification", AsyncMock()), \
         patch("app.services.exchange_workflow.notify_admins", AsyncMock()):
        await _accept(expiration_world, expiration_world.offer_a_id)

    await expiration_world.offers.update_one(
        {"_id": expiration_world.offer_a_id},
        {"$set": {"expires_at": _past()}},
    )
    await expire_stale_exchange_offers(expiration_world.offers)

    offer_a = await expiration_world.offers.find_one({"_id": expiration_world.offer_a_id})
    assert offer_a["status"] == "ACCEPTED"
    listing = await expiration_world.items.find_one({"_id": expiration_world.listing["_id"]})
    assert listing["status"] == "exchange_reserved"
    assert len(expiration_world.transactions.documents) == 1
    transaction = expiration_world.transactions.documents[0]
    assert transaction["status"] not in {"EXPIRED", "CANCELLED", "COMPLETED"}


@pytest.mark.asyncio
async def test_failed_exchange_releases_listing_and_restores_paused_offers(expiration_world):
    await expiration_world.offers.update_one(
        {"_id": expiration_world.offer_a_id},
        {"$set": {"expires_at": _future()}},
    )
    with patch("app.services.exchange_workflow.create_notification", AsyncMock()), \
         patch("app.services.exchange_workflow.notify_admins", AsyncMock()):
        await _accept(expiration_world, expiration_world.offer_a_id)

    offer_b = await expiration_world.offers.find_one({"_id": expiration_world.offer_b_id})
    assert offer_b["status"] == "UNDER_REVIEW"
    transaction = expiration_world.transactions.documents[0]
    giveaway_count = len(expiration_world.requests.documents)

    await expire_unpaid_exchange(
        transactions_collection=expiration_world.transactions,
        shipping_collection=expiration_world.shipping,
        offers_collection=expiration_world.offers,
        items_collection=expiration_world.items,
        transaction=transaction,
    )

    listing = await expiration_world.items.find_one({"_id": expiration_world.listing["_id"]})
    assert listing["status"] == "available"
    assert listing["giveaway_paused"] is False
    assert listing["active_exchange_offer_id"] is None
    assert listing["listing_mode"] == "BOTH"

    offer_a = await expiration_world.offers.find_one({"_id": expiration_world.offer_a_id})
    offer_b = await expiration_world.offers.find_one({"_id": expiration_world.offer_b_id})
    assert offer_a["status"] == "EXPIRED"
    assert offer_b["status"] == "PENDING"
    assert len(expiration_world.offers.documents) == 2
    assert len(expiration_world.requests.documents) == giveaway_count
    assert expiration_world.requests.documents[0]["status"] == "pending"
    tx = await expiration_world.transactions.find_one({"_id": transaction["_id"]})
    assert tx["status"] == "EXPIRED"


@pytest.mark.asyncio
async def test_expiration_is_idempotent_and_skips_already_expired(expiration_world):
    first = await expire_stale_exchange_offers(expiration_world.offers)
    second = await expire_stale_exchange_offers(expiration_world.offers)
    assert first == 1
    assert second == 0
    offer_a = await expiration_world.offers.find_one({"_id": expiration_world.offer_a_id})
    offer_b = await expiration_world.offers.find_one({"_id": expiration_world.offer_b_id})
    assert offer_a["status"] == "EXPIRED"
    assert offer_b["status"] == "PENDING"
    assert len(expiration_world.offers.documents) == 2


@pytest.mark.asyncio
async def test_concurrent_expiration_sweeps_are_safe(expiration_world):
    results = await asyncio.gather(
        expire_stale_exchange_offers(expiration_world.offers),
        expire_stale_exchange_offers(expiration_world.offers),
    )
    assert sum(results) >= 1
    expired = [doc for doc in expiration_world.offers.documents if doc["status"] == "EXPIRED"]
    pending = [doc for doc in expiration_world.offers.documents if doc["status"] == "PENDING"]
    assert len(expired) == 1
    assert expired[0]["_id"] == expiration_world.offer_a_id
    assert len(pending) == 1
    assert pending[0]["_id"] == expiration_world.offer_b_id
    assert len(expiration_world.offers.documents) == 2


@pytest.mark.asyncio
async def test_completed_exchanges_are_untouched_by_offer_expiration(expiration_world):
    completed_offer_id = expiration_world.offer_a_id
    await expiration_world.offers.update_one(
        {"_id": completed_offer_id},
        {"$set": {
            "status": "COMPLETED",
            "expires_at": _past(),
            "transaction_id": "tx-1",
        }},
    )
    await expiration_world.items.update_one(
        {"_id": expiration_world.listing["_id"]},
        {"$set": {"status": "completed", "giveaway_paused": False}},
    )
    expiration_world.transactions.documents.append({
        "_id": ObjectId(),
        "listing_id": str(expiration_world.listing["_id"]),
        "user_a_id": str(expiration_world.owner_oid),
        "user_b_id": str(expiration_world.offerer_a_oid),
        "status": "COMPLETED",
        "listing_title": "Nike Shoes",
    })
    transaction = expiration_world.transactions.documents[0]

    await expire_stale_exchange_offers(expiration_world.offers)
    await expire_unpaid_exchange(
        transactions_collection=expiration_world.transactions,
        shipping_collection=expiration_world.shipping,
        offers_collection=expiration_world.offers,
        items_collection=expiration_world.items,
        transaction=transaction,
    )

    offer_a = await expiration_world.offers.find_one({"_id": completed_offer_id})
    assert offer_a["status"] == "COMPLETED"
    listing = await expiration_world.items.find_one({"_id": expiration_world.listing["_id"]})
    assert listing["status"] == "completed"
    tx = await expiration_world.transactions.find_one({"_id": transaction["_id"]})
    assert tx["status"] == "COMPLETED"
    assert len(expiration_world.requests.documents) == 1


@pytest.mark.asyncio
async def test_expire_offer_if_stale_does_not_treat_expired_as_pending(expiration_world):
    offer = await expiration_world.offers.find_one({"_id": expiration_world.offer_a_id})
    updated = await expire_offer_if_stale(expiration_world.offers, offer)
    assert updated["status"] == "EXPIRED"
    again = await expire_offer_if_stale(expiration_world.offers, updated)
    assert again["status"] == "EXPIRED"
