"""Tests for admin-mediated message sender/receiver identity."""

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest import IsolatedAsyncioTestCase

from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import auth as auth_deps
from app.api.routes import conversations as conversations_routes
from app.api.routes.admin import conversations as admin_conversations_routes
from app.services import conversation_messages as conversation_messages_service
from app.services.message_identity import (
    SENDER_ROLE_ADMIN,
    SENDER_ROLE_USER,
    build_message_identity,
    infer_sender_role,
    serialize_message_fields,
)


class FakeMessagesCollection:
    def __init__(self, documents=None):
        self.documents = list(documents or [])
        self.inserted = []

    async def count_documents(self, query):
        return len(self._match(query))

    async def find_one(self, query, sort=None):
        matches = self._match(query)
        if sort:
            field, direction = sort[0]
            matches.sort(key=lambda doc: doc.get(field) or datetime.min.replace(tzinfo=timezone.utc))
            if direction == -1:
                matches.reverse()
        return matches[0] if matches else None

    async def insert_one(self, document):
        stored = {**document, "_id": ObjectId()}
        self.documents.append(stored)
        self.inserted.append(stored)
        return SimpleNamespace(inserted_id=stored["_id"])

    def _match(self, query):
        rows = self.documents
        for key, value in query.items():
            if key == "$or":
                continue
            if isinstance(value, dict):
                if "$ne" in value:
                    rows = [row for row in rows if row.get(key) != value["$ne"]]
                if "$gte" in value:
                    rows = [row for row in rows if row.get(key) >= value["$gte"]]
                if "$exists" in value and value["$exists"] is False:
                    rows = [row for row in rows if key not in row]
            else:
                rows = [row for row in rows if row.get(key) == value]
        return rows


class FakeConversationsCollection:
    def __init__(self, conv):
        self.conv = conv

    async def find_one(self, query):
        if query.get("_id") == self.conv["_id"]:
            return self.conv
        return None

    async def update_one(self, query, update):
        return SimpleNamespace(modified_count=1)


class FakeUsersCollection:
    async def find_one(self, query):
        return {"_id": ObjectId(query["_id"]), "blocked_users": []}


class MessageIdentityUnitTests(IsolatedAsyncioTestCase):
    def test_build_message_identity_admin_sender(self):
        conv = {
            "member_id": "member-1",
            "admin_id": "platform-admin",
            "admin_display_name": "Happiness Exchange Admin",
        }
        admin_user = {"id": "staff-admin-9", "name": "Staff Admin", "role": "super_admin"}

        identity = build_message_identity(
            conv=conv,
            current_user=admin_user,
            receiver_id="member-1",
            receiver_role="user",
        )

        self.assertEqual(identity["sender_id"], "staff-admin-9")
        self.assertEqual(identity["sender_role"], SENDER_ROLE_ADMIN)
        self.assertEqual(identity["sender_name"], "Happiness Exchange Admin")
        self.assertEqual(identity["receiver_id"], "member-1")
        self.assertEqual(identity["receiver_role"], "user")

    def test_build_message_identity_user_sender(self):
        conv = {
            "member_id": "member-1",
            "admin_id": "platform-admin",
            "admin_display_name": "Happiness Exchange Admin",
        }
        member_user = {"id": "member-1", "name": "Lister Person", "role": "user"}

        identity = build_message_identity(
            conv=conv,
            current_user=member_user,
            receiver_id="platform-admin",
            receiver_role="admin",
        )

        self.assertEqual(identity["sender_id"], "member-1")
        self.assertEqual(identity["sender_role"], SENDER_ROLE_USER)
        self.assertEqual(identity["sender_name"], "Lister Person")
        self.assertEqual(identity["receiver_id"], "platform-admin")
        self.assertEqual(identity["receiver_role"], "admin")

    def test_force_admin_sender_when_admin_is_also_member(self):
        conv = {
            "member_id": "member-1",
            "admin_id": "platform-admin",
            "admin_display_name": "Happiness Exchange Admin",
        }
        admin_user = {"id": "member-1", "name": "Sarah", "role": "super_admin"}

        identity = build_message_identity(
            conv=conv,
            current_user=admin_user,
            receiver_id="member-1",
            receiver_role="user",
            force_admin_sender=True,
        )

        self.assertEqual(identity["sender_id"], "member-1")
        self.assertEqual(identity["sender_role"], SENDER_ROLE_ADMIN)
        self.assertEqual(identity["sender_name"], "Happiness Exchange Admin")

    def test_infer_sender_role_fixes_wrong_user_role_with_admin_name(self):
        conv = {
            "chat_type": "admin_receiver",
            "member_id": "member-1",
            "admin_id": "platform-admin",
        }
        doc = {
            "_id": ObjectId(),
            "sender_id": "member-1",
            "sender_role": SENDER_ROLE_USER,
            "sender_name": "Happiness Exchange Admin",
            "conversation_id": "conv-1",
            "text": "hi",
            "created_at": datetime.now(timezone.utc),
        }

        role = infer_sender_role(doc, conv=conv)
        self.assertEqual(role, SENDER_ROLE_ADMIN)

    def test_infer_sender_role_legacy_admin_message(self):
        conv = {
            "chat_type": "admin_lister",
            "member_id": "member-1",
            "admin_id": "platform-admin",
        }
        doc = {
            "_id": ObjectId(),
            "sender_id": "staff-admin-9",
            "sender_name": "Happiness Exchange Admin",
            "conversation_id": "conv-1",
            "text": "Hello",
            "created_at": datetime.now(timezone.utc),
        }

        role = infer_sender_role(doc, conv=conv)
        self.assertEqual(role, SENDER_ROLE_ADMIN)

        serialized = serialize_message_fields(doc, conv=conv)
        self.assertEqual(serialized["sender_role"], SENDER_ROLE_ADMIN)
        self.assertEqual(serialized["receiver_role"], "user")

    def test_member_reply_stays_user_when_viewed_by_admin(self):
        conv = {
            "chat_type": "admin_lister",
            "member_id": "member-1",
            "admin_id": "platform-admin",
        }
        doc = {
            "_id": ObjectId(),
            "sender_id": "member-1",
            "sender_role": SENDER_ROLE_USER,
            "sender_name": "Lister Person",
            "conversation_id": "conv-1",
            "text": "Works for me",
            "created_at": datetime.now(timezone.utc),
        }
        admin_viewer = {"id": "staff-admin-9", "role": "super_admin"}

        serialized = serialize_message_fields(doc, conv=conv, current_user=admin_viewer)
        self.assertEqual(serialized["sender_role"], SENDER_ROLE_USER)
        self.assertEqual(serialized["sender_name"], "Lister Person")

    def test_legacy_wrong_admin_role_corrected_when_sender_is_member(self):
        conv = {
            "chat_type": "admin_receiver",
            "member_id": "member-1",
            "admin_id": "platform-admin",
        }
        doc = {
            "_id": ObjectId(),
            "sender_id": "member-1",
            "sender_role": SENDER_ROLE_ADMIN,
            "sender_name": "sarah",
            "conversation_id": "conv-1",
            "text": "ok",
            "created_at": datetime.now(timezone.utc),
        }

        serialized = serialize_message_fields(doc, conv=conv)
        self.assertEqual(serialized["sender_role"], SENDER_ROLE_USER)
        self.assertEqual(serialized["sender_name"], "sarah")


class MessageSendRouteTests(IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.member_id = str(ObjectId())
        self.platform_admin_id = str(ObjectId())
        self.staff_admin_id = str(ObjectId())
        self.conversation_id = str(ObjectId())
        self.conv_oid = ObjectId(self.conversation_id)

        self.conv = {
            "_id": self.conv_oid,
            "chat_type": "admin_lister",
            "admin_id": self.platform_admin_id,
            "admin_display_name": "Happiness Exchange Admin",
            "member_id": self.member_id,
            "member_name": "Lister Person",
            "unread_counts": {self.platform_admin_id: 0, self.member_id: 0},
        }

        self.messages = FakeMessagesCollection()
        self.conversations = FakeConversationsCollection(self.conv)

        self.staff_admin = {
            "id": self.staff_admin_id,
            "name": "Staff Admin",
            "role": "super_admin",
            "is_verified": True,
        }
        self.member_user = {
            "id": self.member_id,
            "name": "Lister Person",
            "role": "user",
            "is_verified": True,
        }

        member_app = FastAPI()
        member_app.include_router(conversations_routes.router, prefix="/api")
        self.member_app = member_app
        self.member_client = TestClient(member_app)

        admin_app = FastAPI()
        admin_app.include_router(
            admin_conversations_routes.router,
            prefix="/api/admin/conversations",
        )
        self.admin_app = admin_app
        self.admin_client = TestClient(admin_app)

    def _override_send_deps(self, user, *, app):
        app.dependency_overrides[auth_deps.get_verified_user] = lambda: user
        conversation_messages_service.get_messages_collection_async = lambda: self._messages_col()
        conversation_messages_service.get_conversations_collection_async = lambda: self._conversations_col()
        conversation_messages_service.get_users_collection_async = lambda: self._users_col()

    def _override_admin_send_deps(self, user):
        self.admin_app.dependency_overrides[auth_deps.get_current_user] = lambda: user
        conversation_messages_service.get_messages_collection_async = lambda: self._messages_col()
        conversation_messages_service.get_conversations_collection_async = lambda: self._conversations_col()
        conversation_messages_service.get_users_collection_async = lambda: self._users_col()

    async def _messages_col(self):
        return self.messages

    async def _conversations_col(self):
        return self.conversations

    async def _users_col(self):
        return FakeUsersCollection()

    def tearDown(self):
        self.member_app.dependency_overrides.clear()
        self.admin_app.dependency_overrides.clear()

    async def test_admin_send_uses_admin_endpoint_and_role(self):
        self._override_admin_send_deps(self.staff_admin)

        res = self.admin_client.post(
            f"/api/admin/conversations/{self.conversation_id}/message",
            json={"text": "Pickup tomorrow?", "message_type": "text"},
        )

        self.assertEqual(res.status_code, 200, res.text)
        payload = res.json()
        self.assertEqual(payload["sender_id"], self.staff_admin_id)
        self.assertEqual(payload["sender_role"], SENDER_ROLE_ADMIN)
        self.assertEqual(payload["message_source"], "admin_panel")
        self.assertEqual(payload["sender_name"], "Happiness Exchange Admin")
        self.assertEqual(payload["receiver_id"], self.member_id)
        self.assertEqual(payload["receiver_role"], "user")

    async def test_admin_send_force_admin_when_admin_is_member(self):
        self.conv["member_id"] = self.staff_admin_id
        self.conv["unread_counts"] = {self.platform_admin_id: 0, self.staff_admin_id: 0}
        self._override_admin_send_deps(self.staff_admin)

        res = self.admin_client.post(
            f"/api/admin/conversations/{self.conversation_id}/message",
            json={"text": "hi give your adress and number", "message_type": "text"},
        )

        self.assertEqual(res.status_code, 200, res.text)
        payload = res.json()
        self.assertEqual(payload["sender_id"], self.staff_admin_id)
        self.assertEqual(payload["sender_role"], SENDER_ROLE_ADMIN)
        self.assertEqual(payload["message_source"], "admin_panel")
        self.assertEqual(payload["sender_name"], "Happiness Exchange Admin")

    async def test_public_endpoint_rejects_non_member_admin_send(self):
        self._override_send_deps(self.staff_admin, app=self.member_app)

        res = self.member_client.post(
            f"/api/conversations/{self.conversation_id}/message",
            json={"text": "Pickup tomorrow?", "message_type": "text"},
        )

        self.assertEqual(res.status_code, 403, res.text)

    async def test_member_reply_sets_user_sender_role(self):
        self.messages.documents.append(
            {
                "_id": ObjectId(),
                "conversation_id": self.conversation_id,
                "sender_id": self.staff_admin_id,
                "sender_role": SENDER_ROLE_ADMIN,
                "sender_name": "Happiness Exchange Admin",
                "receiver_id": self.member_id,
                "receiver_role": "user",
                "text": "Pickup tomorrow?",
                "created_at": datetime.now(timezone.utc),
            }
        )

        self._override_send_deps(self.member_user, app=self.member_app)

        res = self.member_client.post(
            f"/api/conversations/{self.conversation_id}/message",
            json={"text": "Works for me", "message_type": "text"},
        )

        self.assertEqual(res.status_code, 200, res.text)
        payload = res.json()
        self.assertEqual(payload["sender_id"], self.member_id)
        self.assertEqual(payload["sender_role"], SENDER_ROLE_USER)
        self.assertEqual(payload["message_source"], "member_reply")
        self.assertEqual(payload["receiver_id"], self.staff_admin_id)
        self.assertEqual(payload["receiver_role"], "admin")
