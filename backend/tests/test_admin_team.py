"""Admin team management RBAC and safety guard tests."""

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest import IsolatedAsyncioTestCase

from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import auth as auth_deps
from app.api.deps import admin as admin_deps
from app.api.routes.admin import team as admin_team_routes
from app.core.roles import UserRole


class FakeCursor:
    def __init__(self, docs):
        self.docs = list(docs)

    def sort(self, *args, **kwargs):
        return self

    async def to_list(self, length=200):
        return list(self.docs)


class FakeUsersCollection:
    def __init__(self, users):
        self.users = {str(u["_id"]): u for u in users}

    async def count_documents(self, query):
        count = 0
        for user in self.users.values():
            if query.get("role") and user.get("role") != query["role"]:
                continue
            if query.get("is_banned") == {"$ne": True} and user.get("is_banned"):
                continue
            count += 1
        return count

    def find(self, query):
        docs = []
        roles = query.get("role", {}).get("$in")
        for user in self.users.values():
            if roles and user.get("role") not in roles:
                continue
            docs.append(user)
        return FakeCursor(docs)

    async def find_one(self, query):
        oid = query.get("_id")
        if oid is not None:
            return self.users.get(str(oid))
        email = query.get("email")
        if email is not None:
            for user in self.users.values():
                if user.get("email") == email:
                    return user
        name_normalized = query.get("name_normalized")
        if name_normalized is not None:
            for user in self.users.values():
                if user.get("name_normalized") == name_normalized:
                    return user
        token_hash = query.get("admin_invite_token_hash")
        if token_hash is not None:
            for user in self.users.values():
                if user.get("admin_invite_token_hash") == token_hash:
                    return user
        return None

    async def insert_one(self, doc):
        oid = ObjectId()
        stored = {**doc, "_id": oid}
        self.users[str(oid)] = stored
        return SimpleNamespace(inserted_id=oid)

    async def update_one(self, query, update):
        user = await self.find_one(query)
        if user is None:
            return SimpleNamespace(modified_count=0)
        user.update(update.get("$set", {}))
        for key in update.get("$unset", {}):
            user.pop(key, None)
        return SimpleNamespace(modified_count=1)


class AdminTeamTests(IsolatedAsyncioTestCase):
    def setUp(self):
        self.super_admin_id = ObjectId()
        self.other_super_id = ObjectId()
        self.moderator_id = ObjectId()
        self.target_id = ObjectId()

        self.super_admin = {
            "id": str(self.super_admin_id),
            "name": "Super Admin",
            "email": "super@example.com",
            "role": UserRole.SUPER_ADMIN.value,
            "is_verified": True,
            "created_at": datetime.now(timezone.utc),
        }
        self.regular_user = {
            "id": str(ObjectId()),
            "name": "User",
            "email": "user@example.com",
            "role": UserRole.USER.value,
            "is_verified": True,
            "created_at": datetime.now(timezone.utc),
        }

        self.users_col = FakeUsersCollection([
            {
                "_id": self.super_admin_id,
                "name": "Super Admin",
                "email": "super@example.com",
                "role": UserRole.SUPER_ADMIN.value,
                "is_verified": True,
                "created_at": datetime.now(timezone.utc),
            },
            {
                "_id": self.other_super_id,
                "name": "Backup Super",
                "email": "super2@example.com",
                "role": UserRole.SUPER_ADMIN.value,
                "is_verified": True,
                "created_at": datetime.now(timezone.utc),
            },
            {
                "_id": self.moderator_id,
                "name": "Moderator",
                "email": "mod@example.com",
                "role": UserRole.MODERATOR.value,
                "is_verified": True,
                "created_at": datetime.now(timezone.utc),
            },
            {
                "_id": self.target_id,
                "name": "Target User",
                "email": "target@example.com",
                "role": UserRole.USER.value,
                "is_verified": True,
                "created_at": datetime.now(timezone.utc),
            },
        ])

        async def get_users():
            return self.users_col

        async def noop_audit(**kwargs):
            return None

        admin_team_routes.get_users_collection_async = get_users
        admin_team_routes.write_audit_log = noop_audit
        admin_team_routes.send_team_invite_email = lambda **kwargs: False

        self.app = FastAPI()
        self.app.include_router(admin_team_routes.router, prefix="/api/admin/team")

    def tearDown(self):
        self.app.dependency_overrides.clear()

    def _client_as_super_admin(self):
        self.app.dependency_overrides[auth_deps.get_current_user] = lambda: self.super_admin
        self.app.dependency_overrides[admin_deps.get_super_admin] = lambda: self.super_admin
        self.app.dependency_overrides[admin_deps.get_admin_user] = lambda: self.super_admin
        return TestClient(self.app)

    def test_regular_user_cannot_list_team(self):
        self.app.dependency_overrides[auth_deps.get_current_user] = lambda: self.regular_user
        client = TestClient(self.app)
        res = client.get("/api/admin/team")
        self.assertEqual(res.status_code, 403)

    def test_super_admin_can_list_team(self):
        client = self._client_as_super_admin()
        res = client.get("/api/admin/team")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertGreaterEqual(body["total"], 2)
        self.assertTrue(any(m["role"] == UserRole.SUPER_ADMIN.value for m in body["members"]))

    def test_invite_promotes_existing_user(self):
        client = self._client_as_super_admin()
        res = client.post("/api/admin/team/invite", json={
            "email": "target@example.com",
            "role": UserRole.MODERATOR.value,
            "name": "Target User",
        })
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertIn("email sending is not configured", body["message"].lower())
        self.assertFalse(body["email_sent"])
        promoted = self.users_col.users[str(self.target_id)]
        self.assertEqual(promoted["role"], UserRole.MODERATOR.value)

    def test_invite_sends_email_when_configured(self):
        admin_team_routes.send_team_invite_email = lambda **kwargs: True
        client = self._client_as_super_admin()
        res = client.post("/api/admin/team/invite", json={
            "email": "target@example.com",
            "role": UserRole.ADMIN.value,
            "name": "Target User",
        })
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertTrue(body["email_sent"])
        self.assertIn("invitation email was sent", body["message"].lower())

    def test_invite_creates_new_staff_account(self):
        client = self._client_as_super_admin()
        res = client.post("/api/admin/team/invite", json={
            "email": "newstaff@example.com",
            "role": UserRole.MODERATOR.value,
            "name": "New Staff",
        })
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertTrue(body["created_new"])
        created = next(
            user for user in self.users_col.users.values()
            if user.get("email") == "newstaff@example.com"
        )
        self.assertEqual(created["role"], UserRole.MODERATOR.value)
        self.assertTrue(created.get("admin_invite_token_hash"))

    def test_cannot_invite_super_admin(self):
        client = self._client_as_super_admin()
        res = client.post("/api/admin/team/invite", json={
            "email": "target@example.com",
            "role": UserRole.SUPER_ADMIN.value,
            "name": "Target User",
        })
        self.assertEqual(res.status_code, 400)

    def test_cannot_remove_self(self):
        client = self._client_as_super_admin()
        res = client.delete(f"/api/admin/team/{self.super_admin_id}")
        self.assertEqual(res.status_code, 400)
        self.assertIn("yourself", res.json()["detail"].lower())

    def test_cannot_remove_last_super_admin(self):
        self.users_col.users[str(self.super_admin_id)]["role"] = UserRole.ADMIN.value
        self.users_col.users[str(self.other_super_id)]["role"] = UserRole.ADMIN.value
        self.users_col.users[str(self.moderator_id)]["role"] = UserRole.SUPER_ADMIN.value

        client = self._client_as_super_admin()
        res = client.delete(f"/api/admin/team/{self.moderator_id}")
        self.assertEqual(res.status_code, 400)
        self.assertIn("last super admin", res.json()["detail"].lower())

    def test_cannot_downgrade_last_super_admin(self):
        self.users_col.users[str(self.super_admin_id)]["role"] = UserRole.ADMIN.value
        self.users_col.users[str(self.other_super_id)]["role"] = UserRole.ADMIN.value
        self.users_col.users[str(self.moderator_id)]["role"] = UserRole.SUPER_ADMIN.value

        client = self._client_as_super_admin()
        res = client.patch(
            f"/api/admin/team/{self.moderator_id}/role",
            json={"role": UserRole.ADMIN.value},
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("last super admin", res.json()["detail"].lower())

    def test_can_change_role_for_non_super_admin_member(self):
        client = self._client_as_super_admin()
        res = client.patch(
            f"/api/admin/team/{self.moderator_id}/role",
            json={"role": UserRole.ADMIN.value},
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(
            self.users_col.users[str(self.moderator_id)]["role"],
            UserRole.ADMIN.value,
        )

    def test_remove_access_demotes_to_user(self):
        client = self._client_as_super_admin()
        res = client.delete(f"/api/admin/team/{self.moderator_id}")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(
            self.users_col.users[str(self.moderator_id)]["role"],
            UserRole.USER.value,
        )
