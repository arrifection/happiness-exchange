"""Activity page regressions — listing photos, declined-request cleanup, and swap-only approvals."""

from __future__ import annotations

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
        self.documents.sort(key=lambda document: document.get(key), reverse=direction == -1)
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

    async def delete_one(self, query):
        for index, document in enumerate(self.documents):
            if match_query(document, query):
                del self.documents[index]
                return SimpleNamespace(deleted_count=1)
        return SimpleNamespace(deleted_count=0)


class RequestActivityCardTests(TestCase):
    def setUp(self):
        now = datetime.now(timezone.utc)
        self.owner_id = str(ObjectId())
        self.requester_id = str(ObjectId())
        self.listed_item_id = ObjectId()
        self.deleted_item_id = ObjectId()
        self.rejected_request_id = ObjectId()
        self.approved_request_id = ObjectId()

        self.requester = {
            "id": self.requester_id,
            "name": "Requester",
            "email": "requester@example.com",
            "role": "user",
            "is_verified": True,
        }
        self.other_user = {
            "id": str(ObjectId()),
            "name": "Someone Else",
            "email": "other@example.com",
            "role": "user",
            "is_verified": True,
        }

        self.items_collection = FakeCollection(
            [
                {
                    "_id": self.listed_item_id,
                    "title": "phone case",
                    "owner_id": self.owner_id,
                    "image_url": "https://cdn.example.com/phone-case.jpg",
                    "status": "reserved",
                }
            ]
        )
        self.requests_collection = FakeCollection(
            [
                {
                    "_id": self.rejected_request_id,
                    "item_id": str(self.listed_item_id),
                    "item_title": "phone case",
                    "requester_id": self.requester_id,
                    "requester_name": "Requester",
                    "owner_id": self.owner_id,
                    "owner_name": "Owner",
                    "reason": "Would love this for my phone.",
                    "status": "rejected",
                    "created_at": now,
                },
                {
                    "_id": self.approved_request_id,
                    "item_id": str(self.deleted_item_id),
                    "item_title": "miswak",
                    "requester_id": self.requester_id,
                    "requester_name": "Requester",
                    "owner_id": self.owner_id,
                    "owner_name": "Owner",
                    "reason": "Keen to try it.",
                    "status": "approved",
                    "created_at": now,
                },
            ]
        )

        def bind(name, collection):
            async def getter():
                return collection

            setattr(requests_routes, name, getter)

        bind("get_items_collection_async", self.items_collection)
        bind("get_requests_collection_async", self.requests_collection)

        self.app = FastAPI()
        self.app.include_router(requests_routes.router, prefix="/api")

    def tearDown(self):
        self.app.dependency_overrides.clear()

    def client_as(self, user):
        self.app.dependency_overrides[auth_deps.get_current_user] = lambda: user
        self.app.dependency_overrides[auth_deps.get_verified_user] = lambda: user
        return TestClient(self.app)

    def requests_by_id(self, payload):
        return {entry["id"]: entry for entry in payload}

    def test_my_requests_include_listing_image_when_listing_still_exists(self):
        with self.client_as(self.requester) as client:
            response = client.get("/api/requests/my")

        self.assertEqual(response.status_code, 200)
        payload = self.requests_by_id(response.json())
        self.assertEqual(
            payload[str(self.rejected_request_id)]["item_image_url"],
            "https://cdn.example.com/phone-case.jpg",
        )

    def test_my_requests_have_no_image_when_listing_was_deleted(self):
        with self.client_as(self.requester) as client:
            response = client.get("/api/requests/my")

        self.assertEqual(response.status_code, 200)
        payload = self.requests_by_id(response.json())
        self.assertIsNone(payload[str(self.approved_request_id)]["item_image_url"])

    def test_requester_can_delete_own_rejected_request(self):
        with self.client_as(self.requester) as client:
            response = client.delete(f"/api/requests/{self.rejected_request_id}")

        self.assertEqual(response.status_code, 204)
        remaining = {str(document["_id"]) for document in self.requests_collection.documents}
        self.assertNotIn(str(self.rejected_request_id), remaining)
        self.assertEqual(len(self.items_collection.documents), 1)

    def test_requester_cannot_delete_own_approved_request(self):
        with self.client_as(self.requester) as client:
            response = client.delete(f"/api/requests/{self.approved_request_id}")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(len(self.requests_collection.documents), 2)

    def test_other_user_cannot_delete_someone_elses_rejected_request(self):
        with self.client_as(self.other_user) as client:
            response = client.delete(f"/api/requests/{self.rejected_request_id}")

        self.assertEqual(response.status_code, 403)
        self.assertEqual(len(self.requests_collection.documents), 2)
