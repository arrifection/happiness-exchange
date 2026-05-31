"""Admin mediated conversation listing and RBAC tests."""

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest import IsolatedAsyncioTestCase

from bson import ObjectId
from fastapi import FastAPI, HTTPException, status
from fastapi.testclient import TestClient

from app.api.deps import auth as auth_deps
from app.api.deps import admin as admin_deps
from app.api.routes.admin import conversations as admin_conversations_routes
from app.services.conversations import CHAT_ADMIN_LISTER, CHAT_ADMIN_RECEIVER


class FakeCursor:
    def __init__(self, docs):
        self.docs = list(docs)

    def sort(self, *args, **kwargs):
        return self

    def skip(self, n):
        return self

    def limit(self, n):
        return self

    async def to_list(self, length=100):
        return list(self.docs)

    def __aiter__(self):
        self._index = 0
        return self

    async def __anext__(self):
        if self._index >= len(self.docs):
            raise StopAsyncIteration
        doc = self.docs[self._index]
        self._index += 1
        return doc


class FakeRequestsCollection:
    def __init__(self, requests):
        self.requests = list(requests)

    async def count_documents(self, query):
        return len(self._filter(query))

    def find(self, query):
        return FakeCursor(self._filter(query))

    async def find_one(self, query):
        oid = query.get("_id")
        for req in self.requests:
            if req["_id"] == oid:
                return req
        return None

    def _filter(self, query):
        rows = self.requests
        status_q = query.get("status")
        if isinstance(status_q, dict) and "$in" in status_q:
            rows = [r for r in rows if r.get("status") in status_q["$in"]]
        elif isinstance(status_q, str):
            rows = [r for r in rows if r.get("status") == status_q]
        item_id = query.get("item_id")
        if item_id:
            rows = [r for r in rows if str(r.get("item_id")) == item_id]
        return rows


class FakeConversationsCollection:
    def __init__(self, documents=None):
        self.documents = list(documents or [])

    def find(self, query):
        request_id = query.get("request_id")
        chat_types = query.get("chat_type", {}).get("$in")
        docs = self.documents
        if isinstance(request_id, str):
            docs = [d for d in docs if d.get("request_id") == request_id]
        elif isinstance(request_id, dict) and "$in" in request_id:
            allowed = set(request_id["$in"])
            docs = [d for d in docs if d.get("request_id") in allowed]
        if chat_types:
            docs = [d for d in docs if d.get("chat_type") in chat_types]
        return FakeCursor(docs)

    async def find_one(self, query, session=None):
        for doc in self.documents:
            if all(doc.get(k) == v for k, v in query.items()):
                return doc
        return None

    async def insert_one(self, document, session=None):
        stored = {**document, "_id": ObjectId()}
        self.documents.append(stored)
        return SimpleNamespace(inserted_id=stored["_id"])


class FakeUsersCollection:
    def __init__(self, users, admin):
        self.users = {str(u["_id"]): u for u in users}
        self.admin = admin

    async def find_one(self, query, projection=None, sort=None, session=None):
        if query.get("role"):
            return self.admin
        oid = query.get("_id")
        if isinstance(oid, dict) and "$in" in oid:
            return None
        if oid is not None:
            return self.users.get(str(oid))
        return None

    def find(self, query, projection=None):
        ids = query.get("_id", {}).get("$in", [])
        docs = [self.users[str(oid)] for oid in ids if str(oid) in self.users]
        return FakeCursor(docs)


class FakeItemsCollection:
    def __init__(self, items):
        self.items = {str(i["_id"]): i for i in items}

    async def find_one(self, query):
        return self.items.get(str(query.get("_id")))

    def find(self, query, projection=None):
        ids = query.get("_id", {}).get("$in", [])
        docs = [self.items[str(oid)] for oid in ids if str(oid) in self.items]
        return FakeCursor(docs)


class AdminConversationsTests(IsolatedAsyncioTestCase):
    def setUp(self):
        self.moderator = {
            "id": str(ObjectId()),
            "name": "Moderator",
            "email": "mod@example.com",
            "role": "moderator",
            "is_verified": True,
            "created_at": datetime.now(timezone.utc),
        }
        self.regular_user = {
            "id": str(ObjectId()),
            "name": "User",
            "email": "user@example.com",
            "role": "user",
            "is_verified": True,
            "created_at": datetime.now(timezone.utc),
        }

        self.request_id = ObjectId()
        self.item_id = ObjectId()
        self.requester_id = ObjectId()
        self.owner_id = ObjectId()
        self.admin_id = ObjectId()

        self.request_doc = {
            "_id": self.request_id,
            "item_id": str(self.item_id),
            "item_title": "Desk Lamp",
            "requester_id": str(self.requester_id),
            "requester_name": "Receiver Person",
            "owner_id": str(self.owner_id),
            "owner_name": "Donor Person",
            "reason": "Need for study",
            "status": "approved",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }

        self.admin_user_doc = {
            "_id": self.admin_id,
            "name": "Platform Admin",
            "email": "admin@example.com",
            "role": "super_admin",
            "is_banned": False,
            "created_at": datetime.now(timezone.utc),
        }

        self.users = [
            self.admin_user_doc,
            {"_id": self.requester_id, "name": "Receiver Person", "email": "receiver@example.com"},
            {"_id": self.owner_id, "name": "Donor Person", "email": "donor@example.com"},
        ]
        self.items = [{"_id": self.item_id, "title": "Desk Lamp", "image_url": "https://img.test/lamp.png", "status": "reserved"}]

        self.requests_col = FakeRequestsCollection([self.request_doc])
        self.conversations_col = FakeConversationsCollection([])
        self.users_col = FakeUsersCollection(self.users, self.admin_user_doc)
        self.items_col = FakeItemsCollection(self.items)

        async def get_requests():
            return self.requests_col

        async def get_conversations():
            return self.conversations_col

        async def get_users():
            return self.users_col

        async def get_items():
            return self.items_col

        admin_conversations_routes.get_requests_collection_async = get_requests
        admin_conversations_routes.get_conversations_collection_async = get_conversations
        admin_conversations_routes.get_users_collection_async = get_users
        admin_conversations_routes.get_items_collection_async = get_items

        self.app = FastAPI()
        self.app.include_router(
            admin_conversations_routes.router,
            prefix="/api/admin/conversations",
        )

    def tearDown(self):
        self.app.dependency_overrides.clear()

    def _client_as(self, user):
        self.app.dependency_overrides[auth_deps.get_current_user] = lambda: user
        self.app.dependency_overrides[admin_deps.get_moderator_or_admin] = lambda: user
        return TestClient(self.app)

    def _client_unauthenticated(self):
        self.app.dependency_overrides.clear()

        async def missing_user():
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

        self.app.dependency_overrides[admin_deps.get_moderator_or_admin] = missing_user
        return TestClient(self.app)

    def test_unauthenticated_gets_401(self):
        client = self._client_unauthenticated()
        res = client.get("/api/admin/conversations")
        self.assertEqual(res.status_code, 401)

    def test_regular_user_gets_403(self):
        self.app.dependency_overrides[auth_deps.get_current_user] = lambda: self.regular_user
        client = TestClient(self.app)
        res = client.get("/api/admin/conversations")
        self.assertEqual(res.status_code, 403)

    def test_admin_lists_grouped_exchanges_and_repairs_missing_chats(self):
        client = self._client_as(self.moderator)
        res = client.get("/api/admin/conversations")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body["total"], 1)
        self.assertEqual(len(body["exchanges"]), 1)

        exchange = body["exchanges"][0]
        self.assertEqual(exchange["request_id"], str(self.request_id))
        self.assertIsNotNone(exchange["receiver_chat"])
        self.assertIsNotNone(exchange["lister_chat"])
        self.assertEqual(exchange["receiver_chat"]["chat_type"], CHAT_ADMIN_RECEIVER)
        self.assertEqual(exchange["lister_chat"]["chat_type"], CHAT_ADMIN_LISTER)
        self.assertFalse(exchange["needs_repair"])

        chat_types = sorted(doc["chat_type"] for doc in self.conversations_col.documents)
        self.assertEqual(chat_types, sorted([CHAT_ADMIN_RECEIVER, CHAT_ADMIN_LISTER]))

    def test_repair_endpoint_creates_missing_chat(self):
        self.conversations_col.documents.append(
            {
                "_id": ObjectId(),
                "request_id": str(self.request_id),
                "chat_type": CHAT_ADMIN_RECEIVER,
                "admin_id": str(self.admin_id),
                "member_id": str(self.requester_id),
                "member_name": "Receiver Person",
                "member_role": "receiver",
                "unread_counts": {str(self.admin_id): 0, str(self.requester_id): 0},
            }
        )

        client = self._client_as(self.moderator)
        res = client.post(f"/api/admin/conversations/{self.request_id}/repair")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertIsNotNone(body["receiver_chat"])
        self.assertIsNotNone(body["lister_chat"])
        self.assertEqual(len(self.conversations_col.documents), 2)
