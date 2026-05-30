"""Ensure admin-only routes reject authenticated non-admin users."""

from datetime import datetime, timezone
from unittest import IsolatedAsyncioTestCase

from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import auth as auth_deps
from app.api.routes.admin import analytics as admin_analytics_routes
from app.api.routes.admin import deliveries as admin_deliveries_routes


class FakeCollection:
    async def count_documents(self, query):
        return 0

    def aggregate(self, pipeline):
        class Cursor:
            async def to_list(self, length=100):
                return []

        return Cursor()


class AdminAccessTests(IsolatedAsyncioTestCase):
    def setUp(self):
        self.regular_user = {
            "id": str(ObjectId()),
            "name": "Regular User",
            "email": "user@example.com",
            "role": "user",
            "is_verified": True,
            "created_at": datetime.now(timezone.utc),
        }

        async def get_users_collection_async():
            return FakeCollection()

        async def get_items_collection_async():
            return FakeCollection()

        async def get_requests_collection_async():
            return FakeCollection()

        async def get_deliveries_collection_async():
            return FakeCollection()

        admin_analytics_routes.get_users_collection_async = get_users_collection_async
        admin_analytics_routes.get_items_collection_async = get_items_collection_async
        admin_analytics_routes.get_requests_collection_async = get_requests_collection_async
        admin_deliveries_routes.get_deliveries_collection_async = get_deliveries_collection_async

        self.app = FastAPI()
        self.app.include_router(admin_analytics_routes.router, prefix="/api/admin/analytics")
        self.app.include_router(admin_deliveries_routes.router, prefix="/api/admin")
        self.app.dependency_overrides[auth_deps.get_current_user] = lambda: self.regular_user

    def tearDown(self):
        self.app.dependency_overrides.clear()

    def test_non_admin_cannot_access_analytics_summary(self):
        with TestClient(self.app) as client:
            response = client.get("/api/admin/analytics/summary")

        self.assertEqual(response.status_code, 403)
        self.assertIn("Admin", response.json()["detail"])

    def test_non_admin_cannot_list_admin_deliveries(self):
        with TestClient(self.app) as client:
            response = client.get("/api/admin/deliveries")

        self.assertEqual(response.status_code, 403)
        self.assertIn("Admin", response.json()["detail"])
