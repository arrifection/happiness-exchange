"""Dashboard and listing-page offer visibility — Issues #2 and #3.

Issue #2: incoming swap offers must reach the listing owner's dashboard
alongside give-away requests, which previously only read the requests endpoint.

Issue #3: a listing owner sees the requests and swap offers received for that
specific listing below the product, and nobody else can see them.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from bson import ObjectId
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api.deps import auth as auth_deps
from app.api.routes import requests as requests_routes
from app.api.routes.exchange_offers import router as exchange_offers_router
from app.schemas.items import ItemResponse

from test_exchange_acceptance import AtomicFakeCollection, match_query

REPO_ROOT = Path(__file__).resolve().parents[2]


def _now():
    return datetime.now(timezone.utc)


class ListCursor:
    """Cursor supporting the ``sort().to_list()`` shape the request routes use."""

    def __init__(self, documents):
        self.documents = list(documents)

    def sort(self, key, direction=1):
        self.documents.sort(key=lambda document: document.get(key), reverse=direction == -1)
        return self

    async def to_list(self, length=100):
        return self.documents[:length]


class ListFakeCollection:
    def __init__(self, documents=None):
        self.documents = list(documents or [])

    async def find_one(self, query, projection=None, sort=None, session=None):
        for document in self.documents:
            if match_query(document, query):
                return dict(document)
        return None

    def find(self, query):
        return ListCursor([document for document in self.documents if match_query(document, query)])

    async def update_one(self, query, update, session=None):
        for document in self.documents:
            if match_query(document, query):
                document.update(update.get("$set", {}))
                return SimpleNamespace(modified_count=1)
        return SimpleNamespace(modified_count=0)


@pytest.fixture
def offer_world():
    owner_id = str(ObjectId())
    offerer_id = str(ObjectId())
    stranger_id = str(ObjectId())
    listing_oid = ObjectId()
    other_listing_oid = ObjectId()
    offered_listing_oid = ObjectId()

    listing = {
        "_id": listing_oid,
        "title": "Nike Shoes",
        "owner_id": owner_id,
        "owner_name": "Owner",
        "status": "available",
        "listing_mode": "BOTH",
        "image_url": "https://cdn.example.com/shoes.jpg",
        "giveaway_paused": False,
        "active_exchange_offer_id": None,
    }
    other_listing = {
        "_id": other_listing_oid,
        "title": "Someone Else Lamp",
        "owner_id": stranger_id,
        "owner_name": "Stranger",
        "status": "available",
        "listing_mode": "BOTH",
    }
    offered_listing = {
        "_id": offered_listing_oid,
        "title": "Leather Jacket",
        "owner_id": offerer_id,
        "owner_name": "Offerer",
        "status": "available",
        "listing_mode": "EXCHANGE",
        "image_url": "https://cdn.example.com/jacket.jpg",
    }

    swap_offer_id = ObjectId()
    other_swap_offer_id = ObjectId()
    swap_offer = {
        "_id": swap_offer_id,
        "listing_id": str(listing_oid),
        "listing_title": "Nike Shoes",
        "offering_user_id": offerer_id,
        "offering_user_name": "Offerer Person",
        "offering_user_city": "Lahore",
        "owner_user_id": owner_id,
        "owner_user_name": "Owner",
        "offered_listing_id": str(offered_listing_oid),
        "message": "Happy to swap my jacket for your shoes.",
        "cash_adjustment": 5,
        "status": "PENDING",
        "created_at": _now(),
        "updated_at": _now(),
        "expires_at": _now() + timedelta(days=3),
    }
    other_swap_offer = {
        "_id": other_swap_offer_id,
        "listing_id": str(other_listing_oid),
        "listing_title": "Someone Else Lamp",
        "offering_user_id": offerer_id,
        "offering_user_name": "Offerer Person",
        "owner_user_id": stranger_id,
        "owner_user_name": "Stranger",
        "message": "Swap for the lamp?",
        "status": "PENDING",
        "created_at": _now(),
        "updated_at": _now(),
        "expires_at": _now() + timedelta(days=3),
    }

    giveaway_request_id = ObjectId()
    second_request_id = ObjectId()
    other_listing_request_id = ObjectId()
    giveaway_request = {
        "_id": giveaway_request_id,
        "item_id": str(listing_oid),
        "item_title": "Nike Shoes",
        "requester_id": str(ObjectId()),
        "requester_name": "Give Away Requester",
        "requester_city": "Karachi",
        "owner_id": owner_id,
        "owner_name": "Owner",
        "reason": "I need these shoes for my new job commute every day.",
        "status": "pending",
        "created_at": _now(),
    }
    second_request = {
        **giveaway_request,
        "_id": second_request_id,
        "requester_id": str(ObjectId()),
        "requester_name": "Second Requester",
        "reason": "My current shoes are worn out and I walk to work daily.",
    }
    other_listing_request = {
        **giveaway_request,
        "_id": other_listing_request_id,
        "item_id": str(other_listing_oid),
        "item_title": "Someone Else Lamp",
        "owner_id": stranger_id,
        "requester_name": "Unrelated Requester",
    }

    return SimpleNamespace(
        owner_id=owner_id,
        offerer_id=offerer_id,
        stranger_id=stranger_id,
        listing_id=str(listing_oid),
        other_listing_id=str(other_listing_oid),
        swap_offer_id=str(swap_offer_id),
        other_swap_offer_id=str(other_swap_offer_id),
        giveaway_request_id=str(giveaway_request_id),
        second_request_id=str(second_request_id),
        items=AtomicFakeCollection([listing, other_listing, offered_listing]),
        offers=AtomicFakeCollection([swap_offer, other_swap_offer]),
        request_items=ListFakeCollection([listing, other_listing, offered_listing]),
        requests=ListFakeCollection([giveaway_request, second_request, other_listing_request]),
    )


def _user(user_id, name):
    return {
        "id": user_id,
        "name": name,
        "email": f"{name.replace(' ', '.').lower()}@example.com",
        "is_verified": True,
    }


def _app(router, current_user):
    app = FastAPI()
    app.include_router(router, prefix="/api")
    app.dependency_overrides[auth_deps.get_current_user] = lambda: current_user
    app.dependency_overrides[auth_deps.get_verified_user] = lambda: current_user
    return app


async def _get_exchange(world, current_user, path):
    patches = (
        patch("app.api.routes.exchange_offers.get_exchange_offers_collection_async", AsyncMock(return_value=world.offers)),
        patch("app.api.routes.exchange_offers.get_items_collection_async", AsyncMock(return_value=world.items)),
    )
    for patched in patches:
        patched.start()
    try:
        transport = ASGITransport(app=_app(exchange_offers_router, current_user))
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.get(path)
    finally:
        for patched in patches:
            patched.stop()


async def _get_requests(world, current_user, path):
    patches = (
        patch("app.api.routes.requests.get_requests_collection_async", AsyncMock(return_value=world.requests)),
        patch("app.api.routes.requests.get_items_collection_async", AsyncMock(return_value=world.request_items)),
        patch("app.api.routes.requests.get_users_collection_async", AsyncMock(return_value=None)),
        patch("app.api.routes.requests.get_reviews_collection_async", AsyncMock(return_value=None)),
    )
    for patched in patches:
        patched.start()
    try:
        transport = ASGITransport(app=_app(requests_routes.router, current_user))
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.get(path)
    finally:
        for patched in patches:
            patched.stop()


# ── Issue #2 — dashboard feeds ───────────────────────────────────────────────


@pytest.mark.asyncio
async def test_owner_incoming_feed_includes_received_swap_offer(offer_world):
    response = await _get_exchange(
        offer_world, _user(offer_world.owner_id, "Owner"), "/api/exchange-offers/incoming",
    )

    assert response.status_code == 200, response.text
    offers = response.json()["offers"]
    assert [offer["id"] for offer in offers] == [offer_world.swap_offer_id]

    offer = offers[0]
    assert offer["listing_id"] == offer_world.listing_id
    assert offer["listing_title"] == "Nike Shoes"
    assert offer["offering_user_name"] == "Offerer Person"
    assert offer["offered_listing_title"] == "Leather Jacket"
    assert offer["status"] == "PENDING"
    assert offer["cash_adjustment"] == 5.0


@pytest.mark.asyncio
async def test_owner_incoming_requests_still_include_giveaway_requests(offer_world):
    response = await _get_requests(
        offer_world, _user(offer_world.owner_id, "Owner"), "/api/requests/incoming",
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    ids = {entry["id"] for entry in payload}
    assert ids == {offer_world.giveaway_request_id, offer_world.second_request_id}
    assert all(entry["item_id"] == offer_world.listing_id for entry in payload)
    assert payload[0]["item_image_url"] == "https://cdn.example.com/shoes.jpg"


@pytest.mark.asyncio
async def test_unrelated_user_cannot_see_another_owners_incoming_swap_offers(offer_world):
    unrelated = _user(str(ObjectId()), "Nosey Person")
    response = await _get_exchange(offer_world, unrelated, "/api/exchange-offers/incoming")

    assert response.status_code == 200, response.text
    assert response.json()["offers"] == []


@pytest.mark.asyncio
async def test_offering_user_does_not_see_own_offer_as_incoming(offer_world):
    response = await _get_exchange(
        offer_world, _user(offer_world.offerer_id, "Offerer Person"), "/api/exchange-offers/incoming",
    )

    assert response.status_code == 200, response.text
    assert response.json()["offers"] == []


def test_dashboard_reads_incoming_swap_offers_and_reuses_existing_actions():
    app_source = (REPO_ROOT / "src" / "App.jsx").read_text(encoding="utf-8")
    dashboard_source = (REPO_ROOT / "src" / "pages" / "DashboardPage.jsx").read_text(encoding="utf-8")

    assert "/api/exchange-offers/incoming" in app_source
    assert "ownerExchangeOffers={ownerExchangeOffers}" in app_source
    assert "onExchangeOfferAction={handleExchangeOfferAction}" in app_source
    # Accept/decline must go to the existing exchange-offer endpoints.
    assert "/api/exchange-offers/${offerId}/${action}" in app_source

    assert "ownerExchangeOffers" in dashboard_source
    assert "SwapOfferCard" in dashboard_source
    assert "Swap offer" in dashboard_source
    assert "onAction?.(offer.id, 'accept')" in dashboard_source
    assert "onAction?.(offer.id, 'decline')" in dashboard_source
    # Give-away request cards must stay wired to the existing request handler.
    assert "onRequestAction?.(request.id, 'approve')" in dashboard_source
    assert "onRequestAction?.(request.id, 'reject')" in dashboard_source


# ── Issue #3 — owner-only offers below the listing ───────────────────────────


@pytest.mark.asyncio
async def test_owner_can_list_requests_for_own_listing_only(offer_world):
    response = await _get_requests(
        offer_world,
        _user(offer_world.owner_id, "Owner"),
        f"/api/items/{offer_world.listing_id}/requests",
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert len(payload) == 2
    assert {entry["id"] for entry in payload} == {
        offer_world.giveaway_request_id,
        offer_world.second_request_id,
    }
    assert all(entry["item_id"] == offer_world.listing_id for entry in payload)
    assert {entry["requester_name"] for entry in payload} == {
        "Give Away Requester",
        "Second Requester",
    }
    assert "Unrelated Requester" not in {entry["requester_name"] for entry in payload}


@pytest.mark.asyncio
async def test_owner_can_list_exchange_offers_for_own_listing_only(offer_world):
    response = await _get_exchange(
        offer_world,
        _user(offer_world.owner_id, "Owner"),
        f"/api/items/{offer_world.listing_id}/exchange-offers",
    )

    assert response.status_code == 200, response.text
    offers = response.json()["offers"]
    assert [offer["id"] for offer in offers] == [offer_world.swap_offer_id]
    assert offers[0]["listing_id"] == offer_world.listing_id
    assert offers[0]["offered_listing_title"] == "Leather Jacket"


@pytest.mark.asyncio
async def test_stranger_cannot_list_requests_for_another_users_listing(offer_world):
    response = await _get_requests(
        offer_world,
        _user(str(ObjectId()), "Nosey Person"),
        f"/api/items/{offer_world.listing_id}/requests",
    )

    assert response.status_code == 403
    assert "owner" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_stranger_cannot_list_exchange_offers_for_another_users_listing(offer_world):
    response = await _get_exchange(
        offer_world,
        _user(str(ObjectId()), "Nosey Person"),
        f"/api/items/{offer_world.listing_id}/exchange-offers",
    )

    assert response.status_code == 403
    assert "owner" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_requester_cannot_read_other_requests_on_a_listing_they_requested(offer_world):
    """A requester is not the owner, so the private list stays closed to them."""
    response = await _get_requests(
        offer_world,
        _user(offer_world.offerer_id, "Offerer Person"),
        f"/api/items/{offer_world.listing_id}/requests",
    )

    assert response.status_code == 403


def test_public_listing_payload_never_carries_private_offer_details():
    fields = set(ItemResponse.model_fields)

    # Aggregate counts are public by design; identities and content are not.
    assert "request_count" in fields
    assert "exchange_offer_count" in fields

    leaky = {
        field
        for field in fields
        if any(
            token in field
            for token in ("requester", "offering_user", "reason", "message", "offers", "requests")
        )
        and field not in {"request_count", "exchange_offer_count"}
    }
    assert leaky == set(), f"public listing schema exposes private offer data: {leaky}"


def test_listing_page_shows_received_offers_to_owner_only_and_reuses_actions():
    details_source = (REPO_ROOT / "src" / "pages" / "ItemDetailsPage.jsx").read_text(encoding="utf-8")
    panel_source = (REPO_ROOT / "src" / "components" / "ReceivedRequestsPanel.jsx").read_text(encoding="utf-8")

    # Both private panels are rendered only for the owner.
    assert "{isOwner ? (\n        <ReceivedRequestsPanel" in details_source
    assert "{isOwner && supportsExchangeListing ? (\n        <ExchangeOffersPanel" in details_source

    # The panel reads the owner-only endpoint for this listing.
    assert "/api/items/${item.id}/requests" in panel_source
    # Approve/decline delegate to the shared handler instead of a second
    # implementation of the request action.
    assert "onRequestAction?.(requestId, action)" in panel_source
    assert "/approve" not in panel_source
    assert "/reject" not in panel_source
