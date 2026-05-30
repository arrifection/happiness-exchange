from datetime import datetime, timezone
from types import SimpleNamespace
from unittest import IsolatedAsyncioTestCase

from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pymongo.errors import DuplicateKeyError

from app.api.deps import auth as auth_deps
from app.api.routes import requests as requests_routes


def match_query(document, query):
    for key, expected in query.items():
        actual = document.get(key)
        if isinstance(expected, dict):
            if "$ne" in expected and actual == expected["$ne"]:
                return False
            continue
        if actual != expected:
            return False
    return True


class FakeCollection:
    def __init__(self, documents=None):
        self.documents = list(documents or [])

    async def find_one(self, query):
        for document in self.documents:
            if match_query(document, query):
                return document
        return None

    async def insert_one(self, document):
        for existing in self.documents:
            if (
                existing.get("item_id") == document.get("item_id")
                and existing.get("requester_id") == document.get("requester_id")
            ):
                raise DuplicateKeyError("duplicate request")
        stored = {**document, "_id": ObjectId()}
        self.documents.append(stored)
        return SimpleNamespace(inserted_id=stored["_id"])


class RequestCreationGuardTests(IsolatedAsyncioTestCase):
    def setUp(self):
        self.owner_id = str(ObjectId())
        self.requester_id = str(ObjectId())
        self.other_id = str(ObjectId())
        self.item_id = ObjectId()
        self.now = datetime.now(timezone.utc)

        self.owner_user = {
            "id": self.owner_id,
            "name": "Owner User",
            "email": "owner@example.com",
            "is_verified": True,
        }
        self.requester_user = {
            "id": self.requester_id,
            "name": "Requester User",
            "email": "requester@example.com",
            "is_verified": True,
        }

        self.items_collection = FakeCollection(
            [
                {
                    "_id": self.item_id,
                    "title": "Desk lamp",
                    "description": "A bright desk lamp for study.",
                    "category": "Home",
                    "condition": "Good",
                    "location": "Karachi",
                    "status": "available",
                    "owner_id": self.owner_id,
                    "owner_name": self.owner_user["name"],
                    "created_at": self.now,
                }
            ]
        )
        self.requests_collection = FakeCollection([])

        async def get_items_collection_async():
            return self.items_collection

        async def get_requests_collection_async():
            return self.requests_collection

        requests_routes.get_items_collection_async = get_items_collection_async
        requests_routes.get_requests_collection_async = get_requests_collection_async
        requests_routes.check_user_rate_limit = lambda *args, **kwargs: None

        self.app = FastAPI()
        self.app.include_router(requests_routes.router, prefix="/api")

    def make_client(self, user):
        self.app.dependency_overrides[auth_deps.get_verified_user] = lambda: user
        return TestClient(self.app)

    def tearDown(self):
        self.app.dependency_overrides.clear()

    def test_user_cannot_request_own_item(self):
        payload = {
            "reason": "I wanted to test whether I can request my own listing by mistake today.",
        }
        with self.make_client(self.owner_user) as client:
            response = client.post(f"/api/requests/{self.item_id}", json=payload)

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["detail"], "You cannot request your own item.")
        self.assertEqual(len(self.requests_collection.documents), 0)

    def test_duplicate_request_returns_conflict(self):
        self.requests_collection.documents.append(
            {
                "_id": ObjectId(),
                "item_id": str(self.item_id),
                "requester_id": self.requester_id,
                "status": "pending",
            }
        )
        payload = {
            "reason": "I still need this item and wanted to submit another request by accident.",
        }
        with self.make_client(self.requester_user) as client:
            response = client.post(f"/api/requests/{self.item_id}", json=payload)

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["detail"], "You have already requested this item.")
