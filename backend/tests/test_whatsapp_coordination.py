"""Tests for private WhatsApp coordination and listing/request gating."""

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest import IsolatedAsyncioTestCase

from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import auth as auth_deps
from app.api.routes import items as items_routes
from app.api.routes import requests as requests_routes
from app.api.routes.admin import users as admin_users_routes
from app.api.routes import users as users_routes
from app.schemas.auth import SignupRequest
from app.core.whatsapp import validate_whatsapp_number
from app.services.auth import serialize_user


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

    async def find_one(self, query, projection=None):
        del projection
        for document in self.documents:
            if match_query(document, query):
                return document
        return None

    async def insert_one(self, document):
        stored = {**document, "_id": ObjectId()}
        self.documents.append(stored)
        return SimpleNamespace(inserted_id=stored["_id"])

    async def update_one(self, query, update):
        for document in self.documents:
            if match_query(document, query):
                document.update(update.get("$set", {}))
                return SimpleNamespace(modified_count=1)
        return SimpleNamespace(modified_count=0)

    def find(self, query, projection=None):
        del projection

        class Cursor:
            def __init__(self, docs):
                self.docs = docs

            def sort(self, *args, **kwargs):
                del args, kwargs
                return self

            def skip(self, n):
                del n
                return self

            def limit(self, n):
                self.docs = self.docs[:n]
                return self

            async def to_list(self, length=100):
                return self.docs[:length]

        matched = [doc for doc in self.documents if match_query(doc, query)]
        return Cursor(matched)

    async def count_documents(self, query):
        return len([doc for doc in self.documents if match_query(doc, query)])


class WhatsAppValidationTests(IsolatedAsyncioTestCase):
    def test_signup_request_requires_valid_whatsapp(self):
        payload = SignupRequest(
            name="Sara Khan",
            email="sara@example.com",
            password="password123",
            whatsapp_number="+92 300 1234567",
        )
        self.assertEqual(payload.whatsapp_number, "+923001234567")

    def test_normalize_and_validate_pakistan_style(self):
        self.assertEqual(validate_whatsapp_number("+92 300-123 4567"), "+923001234567")

    def test_rejects_too_short(self):
        with self.assertRaises(ValueError):
            validate_whatsapp_number("12345")

    def test_public_serialize_hides_whatsapp(self):
        user = {
            "_id": ObjectId(),
            "name": "Sara",
            "email": "sara@example.com",
            "whatsapp_number": "+923001234567",
            "created_at": datetime.now(timezone.utc),
        }
        public = serialize_user(user)
        self.assertNotIn("whatsapp_number", public)

    def test_admin_serialize_includes_whatsapp(self):
        user = {
            "_id": ObjectId(),
            "name": "Sara",
            "email": "sara@example.com",
            "whatsapp_number": "+923001234567",
            "created_at": datetime.now(timezone.utc),
        }
        admin = serialize_user(user, include_whatsapp=True)
        self.assertEqual(admin["whatsapp_number"], "+923001234567")


class WhatsAppGatingTests(IsolatedAsyncioTestCase):
    def setUp(self):
        self.now = datetime.now(timezone.utc)
        self.user_id = ObjectId()
        self.owner_id = ObjectId()
        self.item_id = ObjectId()

        self.user_doc = {
            "_id": self.user_id,
            "name": "Requester",
            "email": "req@example.com",
            "is_verified": True,
            "whatsapp_number": None,
            "created_at": self.now,
        }
        self.user_with_whatsapp = {
            **self.user_doc,
            "whatsapp_number": "+923001234567",
        }

        self.item_doc = {
            "_id": self.item_id,
            "title": "Desk",
            "status": "available",
            "owner_id": str(self.owner_id),
            "owner_name": "Owner",
        }

        self.users_collection = FakeCollection([self.user_doc, self.user_with_whatsapp])
        self.items_collection = FakeCollection([self.item_doc])
        self.requests_collection = FakeCollection([])

    def _build_items_app(self, user_doc=None):
        app = FastAPI()
        app.include_router(items_routes.router, prefix="/api")
        user = serialize_user(user_doc or self.user_doc, include_whatsapp=True)
        app.dependency_overrides[auth_deps.get_current_user] = lambda: user
        return TestClient(app)

    def _build_requests_app(self, user_doc=None):
        app = FastAPI()
        app.include_router(requests_routes.router, prefix="/api")
        user = serialize_user(user_doc or self.user_doc, include_whatsapp=True)
        app.dependency_overrides[auth_deps.get_current_user] = lambda: user
        return TestClient(app)

    async def test_create_item_blocked_without_whatsapp(self):
        async def fake_items():
            return self.items_collection

        items_routes.get_items_collection_async = fake_items
        client = self._build_items_app()
        response = client.post(
            "/api/items",
            json={
                "title": "Chair",
                "description": "A comfortable chair for study.",
                "category": "Home",
                "condition": "Good",
                "location": "Karachi",
            },
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("WhatsApp", response.json()["detail"])

    async def test_create_request_blocked_without_whatsapp(self):
        async def fake_items():
            return self.items_collection

        async def fake_requests():
            return self.requests_collection

        requests_routes.get_items_collection_async = fake_items
        requests_routes.get_requests_collection_async = fake_requests
        client = self._build_requests_app()
        response = client.post(
            f"/api/requests/{self.item_id}",
            json={"reason": "I need this item for my university studies this semester.", "requester_city": "Karachi"},
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("WhatsApp", response.json()["detail"])

    async def test_create_item_works_after_whatsapp_added(self):
        async def fake_items():
            return self.items_collection

        items_routes.get_items_collection_async = fake_items
        client = self._build_items_app(self.user_with_whatsapp)
        response = client.post(
            "/api/items",
            json={
                "title": "Chair",
                "description": "A comfortable chair for study.",
                "category": "Home",
                "condition": "Good",
                "location": "Karachi",
            },
        )
        self.assertEqual(response.status_code, 201)

    async def test_create_request_works_after_whatsapp_added(self):
        async def fake_items():
            return self.items_collection

        async def fake_requests():
            return self.requests_collection

        requests_routes.get_items_collection_async = fake_items
        requests_routes.get_requests_collection_async = fake_requests
        client = self._build_requests_app(self.user_with_whatsapp)
        response = client.post(
            f"/api/requests/{self.item_id}",
            json={"reason": "I need this item for my university studies this semester.", "requester_city": "Karachi"},
        )
        self.assertEqual(response.status_code, 201)


class WhatsAppProfileTests(IsolatedAsyncioTestCase):
    def setUp(self):
        self.now = datetime.now(timezone.utc)
        self.user_id = ObjectId()
        self.user_doc = {
            "_id": self.user_id,
            "name": "Sara",
            "name_normalized": "sara",
            "email": "sara@example.com",
            "account_type": "member",
            "is_verified": False,
            "created_at": self.now,
            "updated_at": self.now,
        }
        self.users_collection = FakeCollection([self.user_doc])

    async def test_update_whatsapp(self):
        async def fake_users():
            return self.users_collection

        app = FastAPI()
        app.include_router(users_routes.router, prefix="/api")
        users_routes.get_users_collection_async = fake_users

        async def no_collection():
            return None

        users_routes.get_items_collection_async = no_collection
        users_routes.get_requests_collection_async = no_collection
        users_routes.get_reviews_collection_async = no_collection
        app.dependency_overrides[auth_deps.get_current_user] = lambda: serialize_user(
            self.user_doc, include_whatsapp=True
        )
        client = TestClient(app)
        response = client.patch(
            "/api/me/whatsapp",
            json={"whatsapp_number": "+966 50 123 4567"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["whatsapp_number"], "+966501234567")

    async def test_update_country(self):
        async def fake_users():
            return self.users_collection

        app = FastAPI()
        app.include_router(users_routes.router, prefix="/api")
        users_routes.get_users_collection_async = fake_users

        async def no_collection():
            return None

        users_routes.get_items_collection_async = no_collection
        users_routes.get_requests_collection_async = no_collection
        users_routes.get_reviews_collection_async = no_collection
        app.dependency_overrides[auth_deps.get_current_user] = lambda: serialize_user(
            self.user_doc, include_whatsapp=True
        )
        client = TestClient(app)
        response = client.patch(
            "/api/me/country",
            json={"country": "Saudi Arabia"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["country"], "Saudi Arabia")

    async def test_admin_user_list_includes_whatsapp(self):
        self.user_doc["whatsapp_number"] = "+923001234567"

        async def fake_users():
            return self.users_collection

        app = FastAPI()
        app.include_router(admin_users_routes.router, prefix="/api/admin/users")
        admin_users_routes.get_users_collection_async = fake_users
        app.dependency_overrides[auth_deps.get_current_user] = lambda: {
            "id": str(ObjectId()),
            "name": "Moderator",
            "email": "mod@example.com",
            "role": "moderator",
            "is_verified": True,
        }
        client = TestClient(app)
        response = client.get("/api/admin/users")
        self.assertEqual(response.status_code, 200)
        users = response.json()["users"]
        self.assertEqual(users[0]["whatsapp_number"], "+923001234567")
