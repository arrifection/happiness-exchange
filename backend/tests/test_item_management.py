from datetime import datetime, timezone
from types import SimpleNamespace
from unittest import IsolatedAsyncioTestCase

from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import auth as auth_deps
from app.api.routes import items as items_routes
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

    async def insert_one(self, document):
        stored = {**document}
        stored.setdefault("_id", ObjectId())
        self.documents.append(stored)
        return SimpleNamespace(inserted_id=stored["_id"])

    async def delete_one(self, query):
        for index, document in enumerate(self.documents):
            if match_query(document, query):
                del self.documents[index]
                return SimpleNamespace(deleted_count=1)
        return SimpleNamespace(deleted_count=0)

    async def delete_many(self, query):
        remaining = [document for document in self.documents if not match_query(document, query)]
        deleted_count = len(self.documents) - len(remaining)
        self.documents = remaining
        return SimpleNamespace(deleted_count=deleted_count)

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

    async def count_documents(self, query):
        return sum(1 for document in self.documents if match_query(document, query))


class ItemManagementApiTests(IsolatedAsyncioTestCase):
    def setUp(self):
        self.owner_id = str(ObjectId())
        self.other_user_id = str(ObjectId())
        self.requester_id = str(ObjectId())
        self.item_id = ObjectId()
        self.now = datetime.now(timezone.utc)

        self.owner_user = {
            "id": self.owner_id,
            "name": "Owner User",
            "email": "owner@example.com",
            "account_type": "giver",
        }
        self.other_user = {
            "id": self.other_user_id,
            "name": "Other User",
            "email": "other@example.com",
            "account_type": "receiver",
        }
        self.requester_user = {
            "id": self.requester_id,
            "name": "Requester User",
            "email": "requester@example.com",
            "account_type": "receiver",
        }

        self.items_collection = FakeCollection(
            [
                {
                    "_id": self.item_id,
                    "title": "Desk lamp",
                    "description": "A bright desk lamp that still works well.",
                    "category": "Home",
                    "condition": "Good",
                    "location": "Karachi",
                    "image_url": None,
                    "status": "available",
                    "owner_id": self.owner_id,
                    "owner_name": self.owner_user["name"],
                    "created_at": self.now,
                }
            ]
        )
        self.requests_collection = FakeCollection(
            [
                {
                    "_id": ObjectId(),
                    "item_id": str(self.item_id),
                    "item_title": "Desk lamp",
                    "requester_id": self.requester_id,
                    "requester_name": self.requester_user["name"],
                    "owner_id": self.owner_id,
                    "status": "pending",
                    "created_at": self.now,
                }
            ]
        )

        items_routes.get_items_collection = lambda: self.items_collection
        items_routes.get_requests_collection = lambda: self.requests_collection
        requests_routes.get_items_collection = lambda: self.items_collection
        requests_routes.get_requests_collection = lambda: self.requests_collection

        self.app = FastAPI()
        self.app.include_router(items_routes.router, prefix="/api")
        self.app.include_router(requests_routes.router, prefix="/api")

    def make_client(self, user):
        self.app.dependency_overrides[auth_deps.get_current_user] = lambda: user
        return TestClient(self.app)

    def test_owner_can_delete_own_item(self):
        with self.make_client(self.owner_user) as client:
            response = client.delete(f"/api/items/{self.item_id}")

        self.assertEqual(response.status_code, 204)
        self.assertEqual(len(self.items_collection.documents), 0)
        self.assertEqual(len(self.requests_collection.documents), 0)

    def test_non_owner_cannot_delete_item(self):
        with self.make_client(self.other_user) as client:
            response = client.delete(f"/api/items/{self.item_id}")

        self.assertEqual(response.status_code, 403)
        self.assertEqual(len(self.items_collection.documents), 1)

    def test_owner_can_mark_item_as_completed(self):
        with self.make_client(self.owner_user) as client:
            response = client.patch(f"/api/items/{self.item_id}/complete")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "completed")
        self.assertEqual(self.items_collection.documents[0]["status"], "completed")

    def test_non_owner_cannot_complete_item(self):
        with self.make_client(self.other_user) as client:
            response = client.patch(f"/api/items/{self.item_id}/complete")

        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.items_collection.documents[0]["status"], "available")

    def test_completed_item_cannot_receive_new_requests(self):
        self.items_collection.documents[0]["status"] = "completed"

        with self.make_client(self.other_user) as client:
            response = client.post(f"/api/requests/{self.item_id}")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json()["detail"],
            "This item is not currently available for requests.",
        )
