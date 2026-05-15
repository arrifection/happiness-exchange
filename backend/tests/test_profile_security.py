from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest import IsolatedAsyncioTestCase

from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import auth as auth_deps
from app.api.routes import requests as requests_routes
from app.api.routes import users as users_routes


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


class FakeCursor:
    def __init__(self, documents):
        self.documents = list(documents)

    def sort(self, key, direction):
        reverse = direction == -1
        self.documents.sort(key=lambda document: document.get(key), reverse=reverse)
        return self

    async def to_list(self, length=100):
        return self.documents[:length]


class FakeCollection:
    def __init__(self, documents=None):
        self.documents = list(documents or [])

    async def find_one(self, query):
        for document in self.documents:
            if match_query(document, query):
                return document
        return None

    def find(self, query):
        return FakeCursor([document for document in self.documents if match_query(document, query)])

    async def update_one(self, query, update):
        for document in self.documents:
            if match_query(document, query):
                document.update(update.get("$set", {}))
                return SimpleNamespace(modified_count=1)
        return SimpleNamespace(modified_count=0)

    async def update_many(self, query, update):
        modified_count = 0
        for document in self.documents:
            if match_query(document, query):
                document.update(update.get("$set", {}))
                modified_count += 1
        return SimpleNamespace(modified_count=modified_count)


class ProfileSecurityTests(IsolatedAsyncioTestCase):
    def setUp(self):
        self.owner_id = ObjectId()
        self.other_id = ObjectId()
        self.now = datetime.now(timezone.utc)
        self.old_date = self.now - timedelta(days=8)

        self.users_collection = FakeCollection(
            [
                {
                    "_id": self.owner_id,
                    "name": "Owner User",
                    "name_normalized": "owner user",
                    "email": "owner@example.com",
                    "account_type": "giver",
                    "created_at": self.now,
                    "updated_at": self.now,
                },
                {
                    "_id": self.other_id,
                    "name": "Taken Name",
                    "name_normalized": "taken name",
                    "email": "other@example.com",
                    "account_type": "receiver",
                    "created_at": self.old_date,
                    "updated_at": self.old_date,
                },
            ]
        )

        self.requests_collection = FakeCollection(
            [
                {
                    "_id": ObjectId(),
                    "item_id": "item-1",
                    "item_title": "Owner Item",
                    "requester_id": str(self.owner_id),
                    "requester_name": "Owner User",
                    "owner_id": "someone-else",
                    "status": "pending",
                    "created_at": self.now,
                },
                {
                    "_id": ObjectId(),
                    "item_id": "item-2",
                    "item_title": "Other Item",
                    "requester_id": str(self.other_id),
                    "requester_name": "Taken Name",
                    "owner_id": str(self.owner_id),
                    "status": "pending",
                    "created_at": self.now,
                },
            ]
        )
        self.items_collection = FakeCollection(
            [
                {
                    "_id": ObjectId(),
                    "owner_id": str(self.owner_id),
                    "owner_name": "Owner User",
                }
            ]
        )

        users_routes.get_users_collection = lambda: self.users_collection
        users_routes.get_items_collection = lambda: self.items_collection
        users_routes.get_requests_collection = lambda: self.requests_collection
        requests_routes.get_requests_collection = lambda: self.requests_collection

        self.app = FastAPI()
        self.app.include_router(users_routes.router, prefix="/api")
        self.app.include_router(requests_routes.router, prefix="/api")

    def make_client(self, user):
        self.app.dependency_overrides[auth_deps.get_current_user] = lambda: user
        return TestClient(self.app)

    def test_user_only_sees_their_own_requests(self):
        current_user = {
            "id": str(self.owner_id),
            "name": "Owner User",
            "email": "owner@example.com",
            "account_type": "giver",
        }

        with self.make_client(current_user) as client:
            response = client.get("/api/requests/my")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["requester_id"], str(self.owner_id))

    def test_username_update_works_within_first_seven_days(self):
        current_user = {
            "id": str(self.owner_id),
            "name": "Owner User",
            "email": "owner@example.com",
            "account_type": "giver",
        }

        with self.make_client(current_user) as client:
            response = client.patch("/api/me", json={"name": "  Better Name  "})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["name"], "Better Name")
        self.assertTrue(response.json()["can_change_username"])
        self.assertEqual(self.items_collection.documents[0]["owner_name"], "Better Name")
        self.assertEqual(self.requests_collection.documents[0]["requester_name"], "Better Name")
        self.assertEqual(self.requests_collection.documents[1]["owner_name"], "Better Name")

    def test_username_update_fails_after_seven_days(self):
        current_user = {
            "id": str(self.other_id),
            "name": "Taken Name",
            "email": "other@example.com",
            "account_type": "receiver",
        }

        with self.make_client(current_user) as client:
            response = client.patch("/api/me", json={"name": "New Late Name"})

        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.json()["detail"],
            "Username can only be changed during the first 7 days after signup.",
        )

    def test_duplicate_username_is_rejected(self):
        current_user = {
            "id": str(self.owner_id),
            "name": "Owner User",
            "email": "owner@example.com",
            "account_type": "giver",
        }

        with self.make_client(current_user) as client:
            response = client.patch("/api/me", json={"name": "Taken Name"})

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["detail"], "That username is already taken.")
