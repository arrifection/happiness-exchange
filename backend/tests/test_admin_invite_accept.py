"""Admin invite accept flow tests."""

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest import IsolatedAsyncioTestCase

from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes.admin import auth as admin_auth_routes
from app.core.roles import UserRole
from app.services.auth import generate_verification_token, hash_verification_token


class FakeUsersCollection:
    def __init__(self, users):
        self.users = {str(u["_id"]): u for u in users}

    async def find_one(self, query):
        oid = query.get("_id")
        if oid is not None:
            return self.users.get(str(oid))
        email = query.get("email")
        if email is not None:
            for user in self.users.values():
                if user.get("email") == email:
                    return user
        token_hash = query.get("admin_invite_token_hash")
        if token_hash is not None:
            for user in self.users.values():
                if user.get("admin_invite_token_hash") == token_hash:
                    return user
        return None

    async def update_one(self, query, update):
        user = await self.find_one(query)
        if user is None:
            return SimpleNamespace(modified_count=0)
        user.update(update.get("$set", {}))
        for key in update.get("$unset", {}):
            user.pop(key, None)
        return SimpleNamespace(modified_count=1)


class AdminInviteAcceptTests(IsolatedAsyncioTestCase):
    def setUp(self):
        self.user_id = ObjectId()
        self.raw_token = generate_verification_token()
        self.token_hash = hash_verification_token(self.raw_token)
        self.expires_at = datetime.now(timezone.utc) + timedelta(days=7)

        self.users_col = FakeUsersCollection([
            {
                "_id": self.user_id,
                "name": "Pending Moderator",
                "email": "pending@example.com",
                "role": UserRole.MODERATOR.value,
                "account_type": "staff",
                "is_verified": True,
                "is_banned": False,
                "admin_invite_token_hash": self.token_hash,
                "admin_invite_expires_at": self.expires_at,
                "created_at": datetime.now(timezone.utc),
            },
        ])

        async def get_users():
            return self.users_col

        async def noop_audit(**kwargs):
            return None

        admin_auth_routes.get_users_collection_async = get_users
        admin_auth_routes.write_audit_log = noop_audit

        self.app = FastAPI()
        self.app.include_router(admin_auth_routes.router, prefix="/api/admin/auth")
        self.client = TestClient(self.app)

    def test_invite_preview_returns_staff_details(self):
        res = self.client.get("/api/admin/auth/invite-preview", params={"token": self.raw_token})
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body["email"], "pending@example.com")
        self.assertEqual(body["role"], UserRole.MODERATOR.value)

    def test_accept_invite_sets_password_and_clears_token(self):
        res = self.client.post("/api/admin/auth/accept-invite", json={
            "token": self.raw_token,
            "password": "SecurePass123!",
        })
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertTrue(body["access_token"])
        self.assertEqual(body["user"]["email"], "pending@example.com")

        updated = self.users_col.users[str(self.user_id)]
        self.assertNotIn("admin_invite_token_hash", updated)
        self.assertTrue(updated.get("hashed_password"))

    def test_login_blocked_until_invite_accepted(self):
        res = self.client.post("/api/admin/auth/login", json={
            "email": "pending@example.com",
            "password": "SecurePass123!",
        })
        self.assertEqual(res.status_code, 403)
        self.assertIn("invite link", res.json()["detail"].lower())
