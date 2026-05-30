"""Auth endpoint rate limiting."""

from datetime import datetime, timezone
from unittest import IsolatedAsyncioTestCase

from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.routes import auth as auth_routes
from app.api.routes.admin import auth as admin_auth_routes
from app.core.slowapi_limiter import limiter
from app.services.auth import hash_password


class FakeUsersCollection:
    def __init__(self, user=None):
        self.user = user
        self.documents = [user] if user else []

    async def find_one(self, query):
        if self.user is None:
            return None
        if query.get("email") == self.user.get("email"):
            return self.user
        if query.get("_id") == self.user.get("_id"):
            return self.user
        return None

    async def insert_one(self, document):
        stored = {**document, "_id": ObjectId()}
        self.documents.append(stored)
        return type("Result", (), {"inserted_id": stored["_id"]})()

    async def update_one(self, query, update):
        return type("Result", (), {"modified_count": 1})()


class AuthRateLimitTests(IsolatedAsyncioTestCase):
    def setUp(self):
        self.now = datetime.now(timezone.utc)
        self.user = {
            "_id": ObjectId(),
            "name": "Test User",
            "name_normalized": "test user",
            "email": "test@example.com",
            "hashed_password": hash_password("Password123!"),
            "role": "user",
            "account_type": "member",
            "is_verified": True,
            "is_banned": False,
            "created_at": self.now,
            "updated_at": self.now,
        }
        self.users_collection = FakeUsersCollection(self.user)

        async def get_users_collection_async():
            return self.users_collection

        auth_routes.get_users_collection_async = get_users_collection_async
        admin_auth_routes.get_users_collection_async = get_users_collection_async
        auth_routes.send_verification_email = lambda *args, **kwargs: None
        auth_routes.notify_admins = lambda *args, **kwargs: None
        admin_auth_routes.write_audit_log = lambda *args, **kwargs: None

        self.app = FastAPI()
        self.app.state.limiter = limiter
        self.app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
        self.app.add_middleware(SlowAPIMiddleware)
        self.app.include_router(auth_routes.router, prefix="/api/auth")
        self.app.include_router(admin_auth_routes.router, prefix="/api/admin/auth")
        self._reset_rate_limiter()

    def _reset_rate_limiter(self):
        storage = getattr(limiter, "_storage", None)
        if storage is not None and hasattr(storage, "storage"):
            storage.storage.clear()

    def test_login_allows_requests_under_limit(self):
        self._reset_rate_limiter()
        payload = {"email": "test@example.com", "password": "Password123!"}
        with TestClient(self.app) as client:
            for _ in range(3):
                response = client.post("/api/auth/login", json=payload)
                self.assertEqual(response.status_code, 200, response.text)

    def test_login_blocks_after_limit(self):
        self._reset_rate_limiter()
        payload = {"email": "test@example.com", "password": "wrong-password"}
        with TestClient(self.app) as client:
            statuses = [
                client.post("/api/auth/login", json=payload).status_code
                for _ in range(6)
            ]
        self.assertEqual(statuses[:5], [401] * 5)
        self.assertEqual(statuses[5], 429)

    def test_admin_login_blocks_after_limit(self):
        self._reset_rate_limiter()
        admin_user = {
            **self.user,
            "role": "super_admin",
        }
        self.users_collection.user = admin_user
        payload = {"email": "test@example.com", "password": "wrong-password"}
        with TestClient(self.app) as client:
            statuses = [
                client.post("/api/admin/auth/login", json=payload).status_code
                for _ in range(6)
            ]
        self.assertEqual(statuses[:5], [401] * 5)
        self.assertEqual(statuses[5], 429)
