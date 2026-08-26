"""Swap-only listings must not be approved through the give-away flow.

Also covers the decline path, which shares the ``/requests/{id}/{action}`` route.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest import TestCase

from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import auth as auth_deps
from app.api.routes import requests as requests_routes


def match_query(document, query):
    for key, expected in query.items():
        actual = document.get(key)
        if isinstance(expected, dict):
            if "$in" in expected and actual not in expected["$in"]:
                return False
            continue
        if actual != expected:
            return False
    return True


class FakeCursor:
    def __init__(self, documents):
        self.documents = list(documents)

    def sort(self, key, direction):
        return self

    async def to_list(self, length=100):
        return self.documents[:length]


class FakeCollection:
    def __init__(self, documents=None):
        self.documents = list(documents or [])

    async def find_one(self, query, projection=None, sort=None, session=None):
        for document in self.documents:
            if match_query(document, query):
                return dict(document)
        return None

    def find(self, query):
        return FakeCursor([document for document in self.documents if match_query(document, query)])

    async def update_one(self, query, update, session=None):
        for document in self.documents:
            if match_query(document, query):
                document.update(update.get("$set", {}))
                return SimpleNamespace(modified_count=1)
        return SimpleNamespace(modified_count=0)


class SwapOnlyRequestFlowTests(TestCase):
    def setUp(self):
        now = datetime.now(timezone.utc)
        self.owner = {
            "id": str(ObjectId()),
            "name": "Owner",
            "email": "owner@example.com",
            "role": "user",
            "is_verified": True,
        }
        self.requester_id = str(ObjectId())
        self.swap_item_id = ObjectId()
        self.giveaway_item_id = ObjectId()
        self.swap_request_id = ObjectId()
        self.giveaway_request_id = ObjectId()

        self.items_collection = FakeCollection(
            [
                {
                    "_id": self.swap_item_id,
                    "title": "notebook",
                    "owner_id": self.owner["id"],
                    "status": "available",
                    "listing_mode": "EXCHANGE",
                    "image_url": "https://cdn.example.com/notebook.jpg",
                },
                {
                    "_id": self.giveaway_item_id,
                    "title": "phone case",
                    "owner_id": self.owner["id"],
                    "status": "available",
                    "listing_mode": "GIVEAWAY",
                },
            ]
        )

        def build_request(request_id, item_id, title):
            return {
                "_id": request_id,
                "item_id": str(item_id),
                "item_title": title,
                "requester_id": self.requester_id,
                "requester_name": "Requester",
                "owner_id": self.owner["id"],
                "owner_name": "Owner",
                "reason": "I would really like this item please.",
                "status": "pending",
                "created_at": now,
            }

        self.requests_collection = FakeCollection(
            [
                build_request(self.swap_request_id, self.swap_item_id, "notebook"),
                build_request(self.giveaway_request_id, self.giveaway_item_id, "phone case"),
            ]
        )

        self.approve_calls = []

        async def fake_approve(**kwargs):
            self.approve_calls.append(kwargs)
            await self.requests_collection.update_one(
                {"_id": kwargs["request_object_id"]},
                {"$set": {"status": "approved"}},
            )
            await self.items_collection.update_one(
                {"_id": kwargs["item_object_id"]},
                {"$set": {"status": "reserved"}},
            )

        self.notifications = []

        def fake_notification(**kwargs):
            self.notifications.append(kwargs)
            return asyncio.sleep(0)

        def bind(name, value):
            async def getter():
                return value

            setattr(requests_routes, name, getter)

        bind("get_items_collection_async", self.items_collection)
        bind("get_requests_collection_async", self.requests_collection)
        bind("get_conversations_collection_async", FakeCollection([]))
        bind("get_users_collection_async", FakeCollection([]))
        # No shipping collection keeps the give-away shipment block inert.
        bind("get_exchange_shipping_collection_async", None)

        self._original_approve = requests_routes.approve_request_and_create_conversations
        self._original_notification = requests_routes.create_notification
        requests_routes.approve_request_and_create_conversations = fake_approve
        requests_routes.create_notification = fake_notification

        self.app = FastAPI()
        self.app.include_router(requests_routes.router, prefix="/api")
        self.app.dependency_overrides[auth_deps.get_current_user] = lambda: self.owner
        self.app.dependency_overrides[auth_deps.get_verified_user] = lambda: self.owner

    def tearDown(self):
        requests_routes.approve_request_and_create_conversations = self._original_approve
        requests_routes.create_notification = self._original_notification
        self.app.dependency_overrides.clear()

    def find_request(self, request_id):
        return next(
            document for document in self.requests_collection.documents
            if document["_id"] == request_id
        )

    def find_item(self, item_id):
        return next(
            document for document in self.items_collection.documents
            if document["_id"] == item_id
        )

    def test_approving_giveaway_request_still_uses_giveaway_flow(self):
        with TestClient(self.app) as client:
            response = client.patch(f"/api/requests/{self.giveaway_request_id}/approve")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(self.approve_calls), 1)
        self.assertEqual(self.find_request(self.giveaway_request_id)["status"], "approved")
        self.assertEqual(self.find_item(self.giveaway_item_id)["status"], "reserved")

    def test_approving_swap_only_request_skips_giveaway_flow(self):
        with TestClient(self.app) as client:
            response = client.patch(f"/api/requests/{self.swap_request_id}/approve")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.approve_calls, [])
        self.assertEqual(response.json()["status"], "approved")
        self.assertEqual(response.json()["item_listing_mode"], "EXCHANGE")
        self.assertEqual(self.find_request(self.swap_request_id)["status"], "approved")

    def test_approving_swap_only_request_leaves_listing_available_for_offers(self):
        with TestClient(self.app) as client:
            client.patch(f"/api/requests/{self.swap_request_id}/approve")

        item = self.find_item(self.swap_item_id)
        self.assertEqual(item["status"], "available")
        self.assertEqual(item["listing_mode"], "EXCHANGE")

    def test_declining_a_request_rejects_it_instead_of_approving(self):
        with TestClient(self.app) as client:
            response = client.patch(f"/api/requests/{self.giveaway_request_id}/reject")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "rejected")
        self.assertEqual(self.approve_calls, [])
        self.assertEqual(self.find_request(self.giveaway_request_id)["status"], "rejected")
        self.assertEqual(self.find_item(self.giveaway_item_id)["status"], "available")

    def test_unknown_action_is_rejected(self):
        with TestClient(self.app) as client:
            response = client.patch(f"/api/requests/{self.giveaway_request_id}/sneaky")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.approve_calls, [])
        self.assertEqual(self.find_request(self.giveaway_request_id)["status"], "pending")

    def test_my_requests_expose_listing_mode(self):
        requester = {**self.owner, "id": self.requester_id}
        self.app.dependency_overrides[auth_deps.get_current_user] = lambda: requester

        with TestClient(self.app) as client:
            response = client.get("/api/requests/my")

        self.assertEqual(response.status_code, 200)
        modes = {entry["item_title"]: entry["item_listing_mode"] for entry in response.json()}
        self.assertEqual(modes["notebook"], "EXCHANGE")
        self.assertEqual(modes["phone case"], "GIVEAWAY")
