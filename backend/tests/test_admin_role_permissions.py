"""Role-specific admin panel permission tests."""

from datetime import datetime, timezone
from unittest import IsolatedAsyncioTestCase

from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import auth as auth_deps
from app.api.routes.admin import analytics as admin_analytics_routes
from app.api.routes.admin import items as admin_items_routes
from app.api.routes.admin import users as admin_users_routes


class FakeCursor:
    def sort(self, *args, **kwargs):
        return self

    def skip(self, *args, **kwargs):
        return self

    def limit(self, *args, **kwargs):
        return self

    async def to_list(self, length=100):
        return []


class FakeCollection:
    async def find_one(self, query):
        return None

    async def count_documents(self, query):
        return 0

    def find(self, query):
        return FakeCursor()

    def aggregate(self, pipeline):
        class Cursor:
            async def to_list(self, length=100):
                return []

        return Cursor()

    async def delete_one(self, query):
        return type("Result", (), {"deleted_count": 0})()


class AdminRolePermissionTests(IsolatedAsyncioTestCase):
    def setUp(self):
        self.hired_admin = {
            "id": str(ObjectId()),
            "name": "Hired Admin",
            "email": "admin@example.com",
            "role": "admin",
            "is_verified": True,
            "created_at": datetime.now(timezone.utc),
        }
        self.moderator = {
            "id": str(ObjectId()),
            "name": "Moderator",
            "email": "mod@example.com",
            "role": "moderator",
            "is_verified": True,
            "created_at": datetime.now(timezone.utc),
        }

        async def fake_collection():
            return FakeCollection()

        for module in (admin_analytics_routes, admin_items_routes, admin_users_routes):
            module.get_users_collection_async = fake_collection
            module.get_items_collection_async = fake_collection
            module.get_requests_collection_async = fake_collection
            module.get_reviews_collection_async = fake_collection

        self.app = FastAPI()
        self.app.include_router(admin_analytics_routes.router, prefix="/api/admin/analytics")
        self.app.include_router(admin_items_routes.router, prefix="/api/admin/items")
        self.app.include_router(admin_users_routes.router, prefix="/api/admin/users")

    def tearDown(self):
        self.app.dependency_overrides.clear()

    def _client_as(self, user):
        self.app.dependency_overrides[auth_deps.get_current_user] = lambda: user
        return TestClient(self.app)

    def test_hired_admin_can_access_listings(self):
        client = self._client_as(self.hired_admin)
        res = client.get("/api/admin/items")
        self.assertEqual(res.status_code, 200)

    def test_hired_admin_cannot_access_users(self):
        client = self._client_as(self.hired_admin)
        res = client.get("/api/admin/users")
        self.assertEqual(res.status_code, 403)

    def test_hired_admin_cannot_access_analytics(self):
        client = self._client_as(self.hired_admin)
        res = client.get("/api/admin/analytics/summary")
        self.assertEqual(res.status_code, 403)

    def test_moderator_can_access_users(self):
        client = self._client_as(self.moderator)
        res = client.get("/api/admin/users")
        self.assertEqual(res.status_code, 200)

    def test_moderator_cannot_access_analytics(self):
        client = self._client_as(self.moderator)
        res = client.get("/api/admin/analytics/summary")
        self.assertEqual(res.status_code, 403)
