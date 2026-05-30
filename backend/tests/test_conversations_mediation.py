from datetime import datetime, timezone
from types import SimpleNamespace
from unittest import IsolatedAsyncioTestCase

from bson import ObjectId

from app.services.conversations import (
    CHAT_ADMIN_LISTER,
    CHAT_ADMIN_RECEIVER,
    ensure_admin_mediated_conversations,
)


class FakeUsersCollection:
    def __init__(self, admin_doc, users_by_id):
        self.admin_doc = admin_doc
        self.users_by_id = users_by_id

    async def find_one(self, query, projection=None, sort=None):
        if query.get("role"):
            return self.admin_doc
        oid = query.get("_id")
        if oid is not None:
            return self.users_by_id.get(str(oid))
        return None


class FakeConversationsCollection:
    def __init__(self):
        self.documents = []

    async def find_one(self, query):
        for document in self.documents:
            if all(document.get(key) == value for key, value in query.items()):
                return document
        return None

    async def insert_one(self, document):
        stored = {**document, "_id": ObjectId()}
        self.documents.append(stored)
        return SimpleNamespace(inserted_id=stored["_id"])


class AdminMediatedConversationTests(IsolatedAsyncioTestCase):
    async def test_ensure_creates_receiver_and_lister_chats_only(self):
        conversations = FakeConversationsCollection()
        admin_id = str(ObjectId())
        requester_id = str(ObjectId())
        owner_id = str(ObjectId())
        request_id = str(ObjectId())

        users = FakeUsersCollection(
            admin_doc={
                "_id": ObjectId(admin_id),
                "name": "Platform Admin",
                "role": "super_admin",
                "is_banned": False,
                "created_at": datetime.now(timezone.utc),
            },
            users_by_id={
                requester_id: {"_id": ObjectId(requester_id), "name": "Requester Person", "email": "req@example.com"},
                owner_id: {"_id": ObjectId(owner_id), "name": "Owner Person", "email": "owner@example.com"},
            },
        )

        request = {
            "item_id": str(ObjectId()),
            "item_title": "Desk",
            "requester_id": requester_id,
            "requester_name": "Unknown",
            "owner_id": owner_id,
            "owner_name": "Unknown",
        }

        created = await ensure_admin_mediated_conversations(
            conversations,
            users,
            request_id_str=request_id,
            request=request,
            item={"title": "Desk", "owner_name": "Unknown"},
        )

        self.assertEqual(len(created), 2)
        chat_types = sorted(doc["chat_type"] for doc in conversations.documents)
        self.assertEqual(chat_types, sorted([CHAT_ADMIN_RECEIVER, CHAT_ADMIN_LISTER]))
        self.assertTrue(all(doc["member_name"] != "Unknown" for doc in conversations.documents))

        created_again = await ensure_admin_mediated_conversations(
            conversations,
            users,
            request_id_str=request_id,
            request=request,
            item={"title": "Desk"},
        )
        self.assertEqual(len(created_again), 2)
        self.assertEqual(len(conversations.documents), 2)
