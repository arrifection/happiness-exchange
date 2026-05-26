from datetime import datetime, timezone
from types import SimpleNamespace
from unittest import IsolatedAsyncioTestCase

from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import auth as auth_deps
from app.api.routes import need_requests as need_requests_routes
from app.services.items import serialize_item


def match_query(document, query):
    for key, expected in query.items():
        actual = document.get(key)
        if isinstance(expected, dict):
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

    async def update_one(self, query, update):
        for document in self.documents:
            if match_query(document, query):
                document.update(update.get("$set", {}))
                return SimpleNamespace(modified_count=1)
        return SimpleNamespace(modified_count=0)

    async def delete_one(self, query):
        for index, document in enumerate(self.documents):
            if match_query(document, query):
                del self.documents[index]
                return SimpleNamespace(deleted_count=1)
        return SimpleNamespace(deleted_count=0)


class FoodItemSerializationTests(IsolatedAsyncioTestCase):
    def test_food_fields_are_optional_in_serialization(self):
        serialized = serialize_item(
            {
                "_id": ObjectId(),
                "title": "Rice pack",
                "description": "Sealed rice pack for donation.",
                "category": "Food",
                "condition": "New",
                "location": "Lahore",
                "status": "available",
                "owner_id": str(ObjectId()),
                "owner_name": "Giver",
                "created_at": datetime.now(timezone.utc),
                "expiry_date": "2026-12-01",
                "sealed_packaging": True,
                "storage_condition": "room_temp",
            }
        )
        self.assertEqual(serialized["category"], "Food")
        self.assertEqual(serialized["expiry_date"], "2026-12-01")
        self.assertTrue(serialized["sealed_packaging"])
        self.assertEqual(serialized["storage_condition"], "room_temp")


class NeedRequestApiTests(IsolatedAsyncioTestCase):
    def setUp(self):
        self.user_id = str(ObjectId())
        self.other_user_id = str(ObjectId())
        self.verified_user = {
            "id": self.user_id,
            "name": "Verified User",
            "email": "verified@example.com",
            "account_type": "receiver",
            "is_verified": True,
            "role": "user",
        }
        self.unverified_user = {
            "id": self.other_user_id,
            "name": "Unverified User",
            "email": "other@example.com",
            "account_type": "receiver",
            "is_verified": False,
            "role": "user",
        }
        self.need_id = ObjectId()
        self.need_requests_collection = FakeCollection(
            [
                {
                    "_id": self.need_id,
                    "title": "Baby stroller",
                    "description": "Looking for a gently used stroller.",
                    "category": "Kids",
                    "country": "Pakistan",
                    "city": "Lahore",
                    "urgency": "normal",
                    "status": "open",
                    "created_by": self.user_id,
                    "created_by_name": self.verified_user["name"],
                    "created_at": datetime.now(timezone.utc),
                }
            ]
        )

        async def get_need_requests_collection_async():
            return self.need_requests_collection

        need_requests_routes.get_need_requests_collection_async = get_need_requests_collection_async

        app = FastAPI()
        app.include_router(need_requests_routes.router, prefix="/api")

        async def override_verified_user():
            return self.verified_user

        async def override_unverified_user():
            return self.unverified_user

        self.client = TestClient(app)
        self.override_verified = override_verified_user
        self.override_unverified = override_unverified_user

    def test_list_open_need_requests(self):
        response = self.client.get("/api/need-requests", params={"status": "open"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)

    def test_create_need_request_requires_verified_user(self):
        app = self.client.app
        app.dependency_overrides[auth_deps.get_current_user] = self.override_unverified
        response = self.client.post(
            "/api/need-requests",
            json={
                "title": "Study desk",
                "description": "Need a small study desk for home.",
                "category": "Furniture",
                "country": "Pakistan",
                "city": "Islamabad",
                "urgency": "normal",
            },
        )
        app.dependency_overrides.clear()
        self.assertEqual(response.status_code, 403)

    def test_create_need_request_as_verified_user(self):
        app = self.client.app
        app.dependency_overrides[auth_deps.get_verified_user] = self.override_verified
        response = self.client.post(
            "/api/need-requests",
            json={
                "title": "Study desk",
                "description": "Need a small study desk for home.",
                "category": "Furniture",
                "country": "Pakistan",
                "city": "Islamabad",
                "urgency": "low",
            },
        )
        app.dependency_overrides.clear()
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["status"], "open")

    def test_close_own_need_request(self):
        app = self.client.app
        app.dependency_overrides[auth_deps.get_current_user] = self.override_verified
        response = self.client.patch(f"/api/need-requests/{self.need_id}/close")
        app.dependency_overrides.clear()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "closed")
