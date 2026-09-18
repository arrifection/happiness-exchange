"""Forgot / reset password flow tests."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest import IsolatedAsyncioTestCase
from unittest.mock import patch

from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.routes import auth as auth_routes
from app.core.slowapi_limiter import limiter
from app.services.auth import hash_password, hash_verification_token, verify_password


class FakeUsersCollection:
    def __init__(self, documents=None):
        self.documents = list(documents or [])

    async def find_one(self, query):
        for document in self.documents:
            if all(document.get(key) == value for key, value in query.items()):
                return dict(document)
        return None

    async def update_one(self, query, update):
        for document in self.documents:
            if all(document.get(key) == value for key, value in query.items()):
                document.update(update.get("$set", {}))
                for key in update.get("$unset", {}):
                    document.pop(key, None)
                return type("Result", (), {"modified_count": 1})()
        return type("Result", (), {"modified_count": 0})()


class ForgotPasswordTests(IsolatedAsyncioTestCase):
    def setUp(self):
        self.now = datetime.now(timezone.utc)
        self.user = {
            "_id": ObjectId(),
            "name": "Reset User",
            "name_normalized": "reset user",
            "email": "reset.user@example.com",
            "hashed_password": hash_password("OldPassword1!"),
            "is_verified": True,
            "is_banned": False,
            "role": "user",
            "account_type": "member",
            "country": "Pakistan",
            "created_at": self.now,
            "updated_at": self.now,
        }
        self.users = FakeUsersCollection([self.user])

        async def get_users_collection_async():
            return self.users

        self._original = auth_routes.get_users_collection_async
        auth_routes.get_users_collection_async = get_users_collection_async

        self.app = FastAPI()
        self.app.state.limiter = limiter
        self.app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
        self.app.add_middleware(SlowAPIMiddleware)
        self.app.include_router(auth_routes.router, prefix="/api/auth")
        self._reset_rate_limiter()

    def _reset_rate_limiter(self):
        storage = getattr(limiter, "_storage", None)
        if storage is not None and hasattr(storage, "storage"):
            storage.storage.clear()

    def tearDown(self):
        auth_routes.get_users_collection_async = self._original
        self._reset_rate_limiter()

    def test_forgot_password_existing_user_stores_hashed_token_and_sends_email(self):
        with patch("app.api.routes.auth.send_password_reset_email") as send_email:
            with TestClient(self.app) as client:
                response = client.post(
                    "/api/auth/forgot-password",
                    json={"email": "reset.user@example.com"},
                )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["status"], "sent")
        self.assertIn("If an account exists", body["message"])
        self.assertIn("password_reset_token_hash", self.user)
        self.assertIn("password_reset_expires_at", self.user)
        send_email.assert_called_once()
        sent_email, raw_token = send_email.call_args.args
        self.assertEqual(sent_email, "reset.user@example.com")
        self.assertEqual(self.user["password_reset_token_hash"], hash_verification_token(raw_token))
        self.assertNotEqual(raw_token, self.user["password_reset_token_hash"])

    def test_forgot_password_unknown_email_same_generic_response(self):
        with patch("app.api.routes.auth.send_password_reset_email") as send_email:
            with TestClient(self.app) as client:
                response = client.post(
                    "/api/auth/forgot-password",
                    json={"email": "nobody@example.com"},
                )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "sent")
        send_email.assert_not_called()

    def test_reset_password_valid_token_updates_password_and_invalidates_token(self):
        raw_token = "a" * 64
        self.user["password_reset_token_hash"] = hash_verification_token(raw_token)
        self.user["password_reset_expires_at"] = self.now + timedelta(minutes=30)

        with TestClient(self.app) as client:
            response = client.post(
                "/api/auth/reset-password",
                json={"token": raw_token, "password": "NewPassword1!"},
            )
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["status"], "reset")

            login = client.post(
                "/api/auth/login",
                json={"email": "reset.user@example.com", "password": "NewPassword1!"},
            )

        self.assertEqual(login.status_code, 200)
        self.assertTrue(verify_password("NewPassword1!", self.user["hashed_password"]))
        self.assertNotIn("password_reset_token_hash", self.user)
        self.assertNotIn("password_reset_expires_at", self.user)

    def test_reset_password_rejects_expired_token(self):
        raw_token = "b" * 64
        self.user["password_reset_token_hash"] = hash_verification_token(raw_token)
        self.user["password_reset_expires_at"] = self.now - timedelta(minutes=1)

        with TestClient(self.app) as client:
            response = client.post(
                "/api/auth/reset-password",
                json={"token": raw_token, "password": "NewPassword1!"},
            )

        self.assertEqual(response.status_code, 400)
        self.assertIn("invalid or expired", response.json()["detail"].lower())

    def test_reset_password_rejects_used_token(self):
        raw_token = "c" * 64
        self.user["password_reset_token_hash"] = hash_verification_token(raw_token)
        self.user["password_reset_expires_at"] = self.now + timedelta(minutes=30)

        with TestClient(self.app) as client:
            first = client.post(
                "/api/auth/reset-password",
                json={"token": raw_token, "password": "NewPassword1!"},
            )
            second = client.post(
                "/api/auth/reset-password",
                json={"token": raw_token, "password": "AnotherPass1!"},
            )

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 400)

    def test_forgot_password_is_rate_limited(self):
        self._reset_rate_limiter()
        with patch("app.api.routes.auth.send_password_reset_email"):
            with TestClient(self.app) as client:
                codes = []
                for _ in range(6):
                    response = client.post(
                        "/api/auth/forgot-password",
                        json={"email": "reset.user@example.com"},
                    )
                    codes.append(response.status_code)

        self.assertTrue(any(code == 429 for code in codes))
