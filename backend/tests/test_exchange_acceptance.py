"""Focused tests for atomic exchange acceptance and counter mutual agreement."""

from __future__ import annotations

import asyncio
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from bson import ObjectId
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from pymongo import ReturnDocument

from app.api.deps import auth as auth_deps
from app.api.routes.exchange_offers import (
    EXCHANGE_ACCEPT_UNAVAILABLE_MESSAGE,
    router as exchange_offers_router,
)
from app.services.exchange_workflow import ExchangeAcceptConflict, accept_exchange_offer


def match_query(document, query):
    for key, expected in query.items():
        actual = document.get(key)
        if isinstance(expected, dict):
            if "$ne" in expected and actual == expected["$ne"]:
                return False
            if "$in" in expected and actual not in expected["$in"]:
                return False
            if "$nin" in expected and actual in expected["$nin"]:
                return False
            if "$lte" in expected:
                if actual is None or actual > expected["$lte"]:
                    return False
            if "$gte" in expected:
                if actual is None or actual < expected["$gte"]:
                    return False
            if "$exists" in expected:
                exists = key in document and document.get(key) is not None
                if bool(expected["$exists"]) != exists:
                    return False
            continue
        if actual != expected:
            return False
    return True


class AtomicFakeCollection:
    def __init__(self, documents=None):
        self.documents = list(documents or [])
        self.lock = asyncio.Lock()

    async def find_one(self, query, session=None):
        async with self.lock:
            for document in self.documents:
                if match_query(document, query):
                    return dict(document)
            return None

    async def find_one_and_update(self, query, update, return_document=None, session=None):
        async with self.lock:
            for document in self.documents:
                if match_query(document, query):
                    document.update(update.get("$set", {}))
                    if return_document == ReturnDocument.AFTER:
                        return dict(document)
                    return dict(document)
            return None

    async def update_one(self, query, update, session=None):
        async with self.lock:
            for document in self.documents:
                if match_query(document, query):
                    document.update(update.get("$set", {}))
                    return SimpleNamespace(modified_count=1)
            return SimpleNamespace(modified_count=0)

    async def update_many(self, query, update, session=None):
        async with self.lock:
            modified = 0
            for document in self.documents:
                if match_query(document, query):
                    document.update(update.get("$set", {}))
                    modified += 1
            return SimpleNamespace(modified_count=modified)

    async def insert_one(self, document, session=None):
        async with self.lock:
            stored = {**document, "_id": document.get("_id") or ObjectId()}
            self.documents.append(stored)
            return SimpleNamespace(inserted_id=stored["_id"])

    async def insert_many(self, documents, session=None):
        async with self.lock:
            for document in documents:
                stored = {**document, "_id": document.get("_id") or ObjectId()}
                self.documents.append(stored)
            return SimpleNamespace(inserted_ids=[d["_id"] for d in self.documents[-len(documents):]])

    def find(self, query):
        matched = [dict(document) for document in self.documents if match_query(document, query)]
        return _AsyncCursor(matched)


class StrictFakeCollection(AtomicFakeCollection):
    """Fake collection that refuses truth testing, exactly as Motor does.

    Motor and PyMongo raise NotImplementedError from ``__bool__`` so callers are
    forced to compare with ``is None``. The lenient base class above is shared
    with other test modules, so only the exchange-offer routes exercised here
    opt into the stricter behaviour.
    """

    def __bool__(self):
        raise NotImplementedError(
            "Collection objects do not implement truth value testing or bool(). "
            "Please compare with None instead: collection is not None"
        )


class _AsyncCursor:
    def __init__(self, documents):
        self._documents = documents
        self._index = 0

    def sort(self, *args, **kwargs):
        return self

    def __aiter__(self):
        return self

    async def __anext__(self):
        if self._index >= len(self._documents):
            raise StopAsyncIteration
        document = self._documents[self._index]
        self._index += 1
        return document


def _now():
    return datetime.now(timezone.utc)


def _setup_listing_and_users():
    owner_oid = ObjectId()
    offerer_a_oid = ObjectId()
    offerer_b_oid = ObjectId()
    listing_oid = ObjectId()
    listing = {
        "_id": listing_oid,
        "title": "Nike Shoes",
        "owner_id": str(owner_oid),
        "owner_name": "Owner",
        "status": "available",
        "listing_mode": "BOTH",
        "giveaway_paused": False,
        "active_exchange_offer_id": None,
    }
    return owner_oid, offerer_a_oid, offerer_b_oid, listing


def _offer_doc(offer_id, listing, offering_user_id, status="PENDING"):
    return {
        "_id": offer_id,
        "listing_id": str(listing["_id"]),
        "listing_title": listing["title"],
        "offering_user_id": str(offering_user_id),
        "offering_user_name": "Offerer",
        "owner_user_id": listing["owner_id"],
        "owner_user_name": listing["owner_name"],
        "message": "I would like to swap for your shoes.",
        "status": status,
        "created_at": _now(),
        "updated_at": _now(),
    }


@pytest.fixture
def exchange_world():
    owner_oid, offerer_a_oid, offerer_b_oid, listing = _setup_listing_and_users()
    offer_a_id = ObjectId()
    offer_b_id = ObjectId()
    items = StrictFakeCollection([listing])
    offers = StrictFakeCollection([
        _offer_doc(offer_a_id, listing, offerer_a_oid),
        _offer_doc(offer_b_id, listing, offerer_b_oid),
    ])
    transactions = StrictFakeCollection([])
    shipping = StrictFakeCollection([])
    users = StrictFakeCollection([
        {"_id": owner_oid, "name": "Owner"},
        {"_id": offerer_a_oid, "name": "Offerer A"},
        {"_id": offerer_b_oid, "name": "Offerer B"},
    ])
    requests = StrictFakeCollection([
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


async def _accept(world, offer_id, expected=("PENDING",)):
    offer = await world.offers.find_one({"_id": offer_id})
    listing = await world.items.find_one({"_id": world.listing["_id"]})
    return await accept_exchange_offer(
        offers_collection=world.offers,
        items_collection=world.items,
        transactions_collection=world.transactions,
        shipping_collection=world.shipping,
        users_collection=world.users,
        offer=offer,
        listing=listing,
        expected_offer_statuses=set(expected),
    )


@pytest.mark.asyncio
async def test_first_offer_can_be_accepted_successfully(exchange_world):
    with patch("app.services.exchange_workflow.create_notification", AsyncMock()), \
         patch("app.services.exchange_workflow.notify_admins", AsyncMock()):
        serialized, _tx = await _accept(exchange_world, exchange_world.offer_a_id)

    assert serialized["status"] == "ACCEPTED"
    listing = await exchange_world.items.find_one({"_id": exchange_world.listing["_id"]})
    assert listing["status"] == "exchange_reserved"
    assert listing["active_exchange_offer_id"] == str(exchange_world.offer_a_id)
    assert len(exchange_world.transactions.documents) == 1


@pytest.mark.asyncio
async def test_second_offer_cannot_be_accepted_after_reservation(exchange_world):
    with patch("app.services.exchange_workflow.create_notification", AsyncMock()), \
         patch("app.services.exchange_workflow.notify_admins", AsyncMock()):
        await _accept(exchange_world, exchange_world.offer_a_id)
        with pytest.raises(ExchangeAcceptConflict):
            await _accept(exchange_world, exchange_world.offer_b_id)

    offer_b = await exchange_world.offers.find_one({"_id": exchange_world.offer_b_id})
    assert offer_b["status"] != "ACCEPTED"
    assert len(exchange_world.transactions.documents) == 1
    listing = await exchange_world.items.find_one({"_id": exchange_world.listing["_id"]})
    assert listing["status"] == "exchange_reserved"
    assert listing["active_exchange_offer_id"] == str(exchange_world.offer_a_id)


@pytest.mark.asyncio
async def test_concurrent_accepts_only_one_succeeds(exchange_world):
    with patch("app.services.exchange_workflow.create_notification", AsyncMock()), \
         patch("app.services.exchange_workflow.notify_admins", AsyncMock()):
        results = await asyncio.gather(
            _accept(exchange_world, exchange_world.offer_a_id),
            _accept(exchange_world, exchange_world.offer_b_id),
            return_exceptions=True,
        )

    successes = [result for result in results if not isinstance(result, Exception)]
    conflicts = [result for result in results if isinstance(result, ExchangeAcceptConflict)]
    assert len(successes) == 1
    assert len(conflicts) == 1
    assert len(exchange_world.transactions.documents) == 1
    listing = await exchange_world.items.find_one({"_id": exchange_world.listing["_id"]})
    assert listing["status"] == "exchange_reserved"
    accepted = [doc for doc in exchange_world.offers.documents if doc["status"] == "ACCEPTED"]
    assert len(accepted) == 1
    leftover = [doc for doc in exchange_world.offers.documents if doc["_id"] != accepted[0]["_id"]]
    assert leftover[0]["status"] != "ACCEPTED"
    assert len(exchange_world.offers.documents) == 2
    assert len(exchange_world.requests.documents) == 1
    assert exchange_world.requests.documents[0]["status"] == "pending"


@pytest.mark.asyncio
async def test_successful_accept_pauses_other_offers_without_deleting(exchange_world):
    with patch("app.services.exchange_workflow.create_notification", AsyncMock()), \
         patch("app.services.exchange_workflow.notify_admins", AsyncMock()):
        await _accept(exchange_world, exchange_world.offer_a_id)

    offer_b = await exchange_world.offers.find_one({"_id": exchange_world.offer_b_id})
    assert offer_b["status"] == "UNDER_REVIEW"
    assert len(exchange_world.offers.documents) == 2
    assert len(exchange_world.requests.documents) == 1


def _auth_app(current_user):
    app = FastAPI()
    app.include_router(exchange_offers_router, prefix="/api")
    app.dependency_overrides[auth_deps.get_verified_user] = lambda: current_user
    app.dependency_overrides[auth_deps.get_current_user] = lambda: current_user
    return app


def _collection_patches(world):
    return (
        patch("app.api.routes.exchange_offers.get_exchange_offers_collection_async", AsyncMock(return_value=world.offers)),
        patch("app.api.routes.exchange_offers.get_items_collection_async", AsyncMock(return_value=world.items)),
        patch("app.api.routes.exchange_offers.get_exchange_transactions_collection_async", AsyncMock(return_value=world.transactions)),
        patch("app.api.routes.exchange_offers.get_exchange_shipping_collection_async", AsyncMock(return_value=world.shipping)),
        patch("app.api.routes.exchange_offers.get_users_collection_async", AsyncMock(return_value=world.users)),
        patch("app.api.routes.exchange_offers.create_notification", AsyncMock()),
        patch("app.services.exchange_workflow.create_notification", AsyncMock()),
        patch("app.services.exchange_workflow.notify_admins", AsyncMock()),
    )


async def _owner_action(world, offer_id, action):
    owner = {
        "id": str(world.owner_oid),
        "name": "Owner",
        "email": "owner@example.com",
        "is_verified": True,
    }
    patches = _collection_patches(world)
    for patched in patches:
        patched.start()
    try:
        transport = ASGITransport(app=_auth_app(owner))
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.patch(f"/api/exchange-offers/{offer_id}/{action}")
    finally:
        for patched in patches:
            patched.stop()


@pytest.mark.asyncio
async def test_owner_accept_of_received_offer_succeeds(exchange_world):
    """Accepting a received swap offer must set ACCEPTED, not fail the action.

    The route previously passed Motor collections to ``all()`` for its database
    availability guard. Motor raises NotImplementedError from ``__bool__``, so
    every accept returned a 500 whose body carried no JSON ``detail`` and the UI
    fell back to its generic "Action failed." message.
    """
    response = await _owner_action(exchange_world, exchange_world.offer_a_id, "accept")

    assert response.status_code == 200, response.text
    assert response.status_code != 500
    body = response.json()
    assert body["status"] == "ACCEPTED"
    assert body["transaction_id"]

    offer = await exchange_world.offers.find_one({"_id": exchange_world.offer_a_id})
    assert offer["status"] == "ACCEPTED"
    listing = await exchange_world.items.find_one({"_id": exchange_world.listing["_id"]})
    assert listing["status"] == "exchange_reserved"
    assert len(exchange_world.transactions.documents) == 1


@pytest.mark.asyncio
async def test_owner_decline_of_received_offer_still_succeeds(exchange_world):
    """The decline path was never broken and must stay working after the fix."""
    response = await _owner_action(exchange_world, exchange_world.offer_a_id, "decline")

    assert response.status_code == 200, response.text
    assert response.json()["status"] == "DECLINED"

    offer = await exchange_world.offers.find_one({"_id": exchange_world.offer_a_id})
    assert offer["status"] == "DECLINED"
    listing = await exchange_world.items.find_one({"_id": exchange_world.listing["_id"]})
    assert listing["status"] == "available"
    assert len(exchange_world.transactions.documents) == 0


@pytest.mark.asyncio
async def test_owner_counter_and_cannot_directly_accept_countered_offer(exchange_world):
    owner = {
        "id": str(exchange_world.owner_oid),
        "name": "Owner",
        "email": "owner@example.com",
        "is_verified": True,
    }
    app = _auth_app(owner)

    with patch("app.api.routes.exchange_offers.get_exchange_offers_collection_async", AsyncMock(return_value=exchange_world.offers)), \
         patch("app.api.routes.exchange_offers.get_items_collection_async", AsyncMock(return_value=exchange_world.items)), \
         patch("app.api.routes.exchange_offers.get_exchange_transactions_collection_async", AsyncMock(return_value=exchange_world.transactions)), \
         patch("app.api.routes.exchange_offers.get_exchange_shipping_collection_async", AsyncMock(return_value=exchange_world.shipping)), \
         patch("app.api.routes.exchange_offers.get_users_collection_async", AsyncMock(return_value=exchange_world.users)), \
         patch("app.api.routes.exchange_offers.create_notification", AsyncMock()):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            counter = await client.post(
                f"/api/exchange-offers/{exchange_world.offer_a_id}/counter",
                json={"message": "I can do the jacket plus 10.", "cash_adjustment": 10},
            )
            assert counter.status_code == 200
            assert counter.json()["status"] == "COUNTERED"
            assert counter.json()["counter_message"] == "I can do the jacket plus 10."
            assert counter.json()["counter_cash_adjustment"] == 10.0

            owner_accept = await client.patch(f"/api/exchange-offers/{exchange_world.offer_a_id}/accept")
            assert owner_accept.status_code == 400
            assert "original offering user" in owner_accept.json()["detail"]

    offer = await exchange_world.offers.find_one({"_id": exchange_world.offer_a_id})
    assert offer["status"] == "COUNTERED"
    assert len(exchange_world.transactions.documents) == 0
    listing = await exchange_world.items.find_one({"_id": exchange_world.listing["_id"]})
    assert listing["status"] == "available"


@pytest.mark.asyncio
async def test_offerer_can_accept_counter_and_unauthorized_cannot(exchange_world):
    await exchange_world.offers.update_one(
        {"_id": exchange_world.offer_a_id},
        {"$set": {
            "status": "COUNTERED",
            "counter_message": "Jacket plus 10",
            "counter_cash_adjustment": 10,
        }},
    )

    stranger = {
        "id": str(ObjectId()),
        "name": "Stranger",
        "email": "stranger@example.com",
        "is_verified": True,
    }
    offerer = {
        "id": str(exchange_world.offerer_a_oid),
        "name": "Offerer A",
        "email": "offerer@example.com",
        "is_verified": True,
    }

    stranger_app = _auth_app(stranger)
    offerer_app = _auth_app(offerer)
    patches = (
        patch("app.api.routes.exchange_offers.get_exchange_offers_collection_async", AsyncMock(return_value=exchange_world.offers)),
        patch("app.api.routes.exchange_offers.get_items_collection_async", AsyncMock(return_value=exchange_world.items)),
        patch("app.api.routes.exchange_offers.get_exchange_transactions_collection_async", AsyncMock(return_value=exchange_world.transactions)),
        patch("app.api.routes.exchange_offers.get_exchange_shipping_collection_async", AsyncMock(return_value=exchange_world.shipping)),
        patch("app.api.routes.exchange_offers.get_users_collection_async", AsyncMock(return_value=exchange_world.users)),
        patch("app.api.routes.exchange_offers.create_notification", AsyncMock()),
        patch("app.services.exchange_workflow.create_notification", AsyncMock()),
        patch("app.services.exchange_workflow.notify_admins", AsyncMock()),
    )
    for patched in patches:
        patched.start()
    try:
        transport = ASGITransport(app=stranger_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            forbidden = await client.patch(f"/api/exchange-offers/{exchange_world.offer_a_id}/accept-counter")
            assert forbidden.status_code == 403

        transport = ASGITransport(app=offerer_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            accepted = await client.patch(f"/api/exchange-offers/{exchange_world.offer_a_id}/accept-counter")
            assert accepted.status_code == 200
            assert accepted.json()["status"] == "ACCEPTED"
            assert accepted.json()["transaction_id"]
    finally:
        for patched in patches:
            patched.stop()

    listing = await exchange_world.items.find_one({"_id": exchange_world.listing["_id"]})
    assert listing["status"] == "exchange_reserved"
    assert len(exchange_world.transactions.documents) == 1
    offer_b = await exchange_world.offers.find_one({"_id": exchange_world.offer_b_id})
    assert offer_b["status"] == "UNDER_REVIEW"
    assert len(exchange_world.requests.documents) == 1


@pytest.mark.asyncio
async def test_competing_accept_returns_friendly_409(exchange_world):
    await exchange_world.items.update_one(
        {"_id": exchange_world.listing["_id"]},
        {"$set": {
            "status": "exchange_reserved",
            "giveaway_paused": True,
            "active_exchange_offer_id": str(exchange_world.offer_a_id),
        }},
    )
    await exchange_world.offers.update_one(
        {"_id": exchange_world.offer_a_id},
        {"$set": {"status": "ACCEPTED"}},
    )

    owner = {
        "id": str(exchange_world.owner_oid),
        "name": "Owner",
        "email": "owner@example.com",
        "is_verified": True,
    }
    app = _auth_app(owner)
    with patch("app.api.routes.exchange_offers.get_exchange_offers_collection_async", AsyncMock(return_value=exchange_world.offers)), \
         patch("app.api.routes.exchange_offers.get_items_collection_async", AsyncMock(return_value=exchange_world.items)), \
         patch("app.api.routes.exchange_offers.get_exchange_transactions_collection_async", AsyncMock(return_value=exchange_world.transactions)), \
         patch("app.api.routes.exchange_offers.get_exchange_shipping_collection_async", AsyncMock(return_value=exchange_world.shipping)), \
         patch("app.api.routes.exchange_offers.get_users_collection_async", AsyncMock(return_value=exchange_world.users)), \
         patch("app.api.routes.exchange_offers.create_notification", AsyncMock()):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.patch(f"/api/exchange-offers/{exchange_world.offer_b_id}/accept")

    assert response.status_code == 409
    detail = response.json()["detail"]
    assert detail == EXCHANGE_ACCEPT_UNAVAILABLE_MESSAGE
    assert detail == "This exchange is no longer available. Please try again later."
    assert "409" not in str(detail)
    assert "conflict" not in str(detail).lower()
    offer_b = await exchange_world.offers.find_one({"_id": exchange_world.offer_b_id})
    assert offer_b["status"] == "PENDING"
    assert len(exchange_world.transactions.documents) == 0


def test_frontend_maps_409_to_friendly_message():
    repo_root = Path(__file__).resolve().parents[2]
    helper_path = repo_root / "src" / "lib" / "exchangeErrors.js"
    source = helper_path.read_text(encoding="utf-8")
    friendly = "This exchange is no longer available. Please try again later."
    assert friendly in source
    assert "409" in source

    script = (
        "import { exchangeActionErrorMessage } from './src/lib/exchangeErrors.js';"
        "const conflict = exchangeActionErrorMessage(409, '409 Conflict');"
        "const raw = exchangeActionErrorMessage(409, 'This listing is no longer available for exchange acceptance.');"
        "if (conflict !== raw) process.exit(2);"
        "if (conflict.includes('409') || /conflict/i.test(conflict)) process.exit(3);"
        "const other = exchangeActionErrorMessage(400, 'This offer cannot be accepted in its current state.');"
        "if (other !== 'This offer cannot be accepted in its current state.') process.exit(4);"
        "process.stdout.write(conflict);"
    )
    result = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        cwd=repo_root,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert result.stdout == friendly
    assert "409" not in result.stdout
    assert "Conflict" not in result.stdout
