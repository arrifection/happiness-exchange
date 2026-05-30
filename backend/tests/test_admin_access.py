"""Ensure admin-only routes reject unauthenticated and non-admin users."""

from datetime import datetime, timezone
from unittest import IsolatedAsyncioTestCase

from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import auth as auth_deps
from app.api.routes.admin import analytics as admin_analytics_routes
from app.api.routes.admin import deliveries as admin_deliveries_routes
from app.api.routes.admin import items as admin_items_routes
from app.api.routes.admin import reports as admin_reports_routes
from app.api.routes.admin import reviews as admin_reviews_routes
from app.api.routes.admin import team as admin_team_routes
from app.api.routes.admin import users as admin_users_routes


class FakeCollection:
    async def find_one(self, query):
        return None

    async def count_documents(self, query):
        return 0

    def find(self, query):
        class Cursor:
            def sort(self, *args, **kwargs):
                return self

            async def to_list(self, length=100):
                return []

        return Cursor()

    def aggregate(self, pipeline):
        class Cursor:
            async def to_list(self, length=100):
                return []

        return Cursor()

    async def delete_one(self, query):
        return type("Result", (), {"deleted_count": 0})()


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

        async def fake_collection():
            return FakeCollection()

        for module in (
            admin_analytics_routes,
            admin_deliveries_routes,
            admin_items_routes,
            admin_reports_routes,
            admin_reviews_routes,
            admin_team_routes,
            admin_users_routes,
        ):
            module.get_users_collection_async = fake_collection
            module.get_items_collection_async = fake_collection
            module.get_requests_collection_async = fake_collection
            module.get_deliveries_collection_async = fake_collection
            module.get_reviews_collection_async = fake_collection
            module.get_reports_collection_async = fake_collection

        self.app = FastAPI()
        self.app.include_router(admin_analytics_routes.router, prefix="/api/admin/analytics")
        self.app.include_router(admin_deliveries_routes.router, prefix="/api/admin")
        self.app.include_router(admin_items_routes.router, prefix="/api/admin/items")
        self.app.include_router(admin_reports_routes.router, prefix="/api/admin/reports")
        self.app.include_router(admin_reviews_routes.router, prefix="/api/admin/reviews")
        self.app.include_router(admin_team_routes.router, prefix="/api/admin/team")
        self.app.include_router(admin_users_routes.router, prefix="/api/admin/users")

    def tearDown(self):
        self.app.dependency_overrides.clear()

    def _client_as_regular_user(self):
        self.app.dependency_overrides[auth_deps.get_current_user] = lambda: self.regular_user
        return TestClient(self.app)

    def _client_unauthenticated(self):
        self.app.dependency_overrides.clear()

        async def missing_user():
            from fastapi import HTTPException, status

            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

        self.app.dependency_overrides[auth_deps.get_current_user] = missing_user
        return TestClient(self.app)

    def test_unauthenticated_user_gets_401_on_admin_route(self):
        with self._client_unauthenticated() as client:
            response = client.get("/api/admin/analytics/summary")
        self.assertEqual(response.status_code, 401)

    def test_non_admin_cannot_access_analytics_summary(self):
        with self._client_as_regular_user() as client:
            response = client.get("/api/admin/analytics/summary")
        self.assertEqual(response.status_code, 403)
        self.assertIn("Admin", response.json()["detail"])

    def test_non_admin_cannot_list_admin_deliveries(self):
        with self._client_as_regular_user() as client:
            response = client.get("/api/admin/deliveries")
        self.assertEqual(response.status_code, 403)

    def test_non_admin_cannot_list_admin_users(self):
        with self._client_as_regular_user() as client:
            response = client.get("/api/admin/users")
        self.assertEqual(response.status_code, 403)

    def test_non_admin_cannot_list_admin_items(self):
        with self._client_as_regular_user() as client:
            response = client.get("/api/admin/items")
        self.assertEqual(response.status_code, 403)

    def test_non_admin_cannot_list_admin_reviews(self):
        with self._client_as_regular_user() as client:
            response = client.get("/api/admin/reviews")
        self.assertEqual(response.status_code, 403)

    def test_non_admin_cannot_list_admin_reports(self):
        with self._client_as_regular_user() as client:
            response = client.get("/api/admin/reports")
        self.assertEqual(response.status_code, 403)

    def test_non_admin_cannot_list_admin_team(self):
        with self._client_as_regular_user() as client:
            response = client.get("/api/admin/team")
        self.assertEqual(response.status_code, 403)
