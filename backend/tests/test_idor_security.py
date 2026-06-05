"""IDOR regression tests — users must not access other users' private resources by ID."""

from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest import TestCase

from bson import ObjectId
from fastapi import FastAPI, HTTPException, status
from fastapi.testclient import TestClient

from app.api.deps import auth as auth_deps
from app.api.routes import conversations as conversations_routes
from app.api.routes import items as items_routes
from app.api.routes import requests as requests_routes
from app.api.routes import reviews as reviews_routes


def match_query(document, query):
    for key, expected in query.items():
        actual = document.get(key)
        if isinstance(expected, dict):
            if "$ne" in expected and actual == expected["$ne"]:
                return False
            if "$in" in expected and actual not in expected["$in"]:
                return False
            continue
        if actual != expected:
            return False
    return True


class FakeCursor:
    def __init__(self, documents):
        self.documents = list(documents)

    def sort(self, key, direction):
        reverse = direction == -1
        self.documents.sort(key=lambda document: document.get(key), reverse=reverse)
        return self

    async def to_list(self, length=100):
        return self.documents[:length]


class FakeCollection:
    def __init__(self, documents=None):
        self.documents = list(documents or [])

    async def find_one(self, query, projection=None, sort=None, session=None):
        for document in self.documents:
            if match_query(document, query):
                return dict(document)
        return None

    def find(self, query):
        return FakeCursor([document for document in self.documents if match_query(document, query)])

    async def insert_one(self, document, session=None):
        stored = {**document, "_id": ObjectId()}
        self.documents.append(stored)
        return SimpleNamespace(inserted_id=stored["_id"])

    async def delete_one(self, query):
        for index, document in enumerate(self.documents):
            if match_query(document, query):
                del self.documents[index]
                return SimpleNamespace(deleted_count=1)
        return SimpleNamespace(deleted_count=0)

    async def update_one(self, query, update):
        for document in self.documents:
            if match_query(document, query):
                if "$set" in update:
                    document.update(update["$set"])
                return SimpleNamespace(modified_count=1)
        return SimpleNamespace(modified_count=0)

    async def update_many(self, query, update):
        modified = 0
        for document in self.documents:
            if match_query(document, query):
                if "$set" in update:
                    document.update(update["$set"])
                modified += 1
        return SimpleNamespace(modified_count=modified)

    async def count_documents(self, query):
        return sum(1 for document in self.documents if match_query(document, query))


class IdorSecurityTests(TestCase):
    def setUp(self):
        self.now = datetime.now(timezone.utc)
        self.user_a_id = str(ObjectId())
        self.user_b_id = str(ObjectId())
        self.owner_id = str(ObjectId())
        self.requester_id = str(ObjectId())
        self.item_id = ObjectId()
        self.request_id = ObjectId()
        self.conversation_id = ObjectId()

        self.user_a = {
            "id": self.user_a_id,
            "name": "User A",
            "email": "usera@example.com",
            "role": "user",
            "is_verified": True,
            "whatsapp_number": "+923001234567",
        }
        self.user_b = {
            "id": self.user_b_id,
            "name": "User B",
            "email": "userb@example.com",
            "role": "user",
            "is_verified": True,
            "whatsapp_number": "+923001234567",
        }
        self.owner_user = {
            "id": self.owner_id,
            "name": "Owner",
            "email": "owner@example.com",
            "role": "user",
            "is_verified": True,
            "whatsapp_number": "+923001234567",
        }
        self.requester_user = {
            "id": self.requester_id,
            "name": "Requester",
            "email": "requester@example.com",
            "role": "user",
            "is_verified": True,
            "whatsapp_number": "+923001234567",
        }

        self.items_collection = FakeCollection(
            [
                {
                    "_id": self.item_id,
                    "title": "Desk lamp",
                    "description": "Private owner listing.",
                    "category": "Home",
                    "condition": "Good",
                    "location": "Karachi",
                    "status": "available",
                    "owner_id": self.owner_id,
                    "owner_name": "Owner",
                    "created_at": self.now,
                }
            ]
        )
        self.requests_collection = FakeCollection(
            [
                {
                    "_id": self.request_id,
                    "item_id": str(self.item_id),
                    "item_title": "Desk lamp",
                    "requester_id": self.requester_id,
                    "requester_name": "Requester",
                    "owner_id": self.owner_id,
                    "owner_name": "Owner",
                    "reason": "I need this lamp for my study desk and daily reading.",
                    "status": "pending",
                    "created_at": self.now,
                }
            ]
        )
        self.conversations_collection = FakeCollection(
            [
                {
                    "_id": self.conversation_id,
                    "chat_type": "admin_receiver",
                    "admin_id": str(ObjectId()),
                    "member_id": self.requester_id,
                    "request_id": str(self.request_id),
                    "item_id": str(self.item_id),
                    "item_title": "Desk lamp",
                    "unread_counts": {},
                }
            ]
        )
        self.messages_collection = FakeCollection(
            [
                {
                    "_id": ObjectId(),
                    "conversation_id": str(self.conversation_id),
                    "sender_id": self.requester_id,
                    "sender_name": "Requester",
                    "text": "Private message content for requester only.",
                    "message_type": "text",
                    "created_at": self.now,
                    "read": False,
                }
            ]
        )
        self.reviews_collection = FakeCollection([])
        self.users_collection = FakeCollection([])

        def bind(module, name, collection):
            async def getter():
                return collection

            setattr(module, name, getter)

        bind(items_routes, "get_items_collection_async", self.items_collection)
        bind(items_routes, "get_requests_collection_async", self.requests_collection)
        bind(items_routes, "get_reviews_collection_async", self.reviews_collection)
        bind(requests_routes, "get_items_collection_async", self.items_collection)
        bind(requests_routes, "get_requests_collection_async", self.requests_collection)
        bind(conversations_routes, "get_conversations_collection_async", self.conversations_collection)
        bind(conversations_routes, "get_messages_collection_async", self.messages_collection)
        bind(conversations_routes, "get_users_collection_async", self.users_collection)
        bind(reviews_routes, "get_items_collection_async", self.items_collection)
        bind(reviews_routes, "get_requests_collection_async", self.requests_collection)
        bind(reviews_routes, "get_reviews_collection_async", self.reviews_collection)

        items_routes.award_completed_donation = lambda *args, **kwargs: None
        requests_routes.check_user_rate_limit = lambda *args, **kwargs: None
        conversations_routes.create_notification = lambda *args, **kwargs: None
        reviews_routes.award_positive_review = lambda *args, **kwargs: None

        self.app = FastAPI()
        self.app.include_router(conversations_routes.router, prefix="/api")
        self.app.include_router(items_routes.router, prefix="/api")
        self.app.include_router(requests_routes.router, prefix="/api")
        self.app.include_router(reviews_routes.router, prefix="/api")

    def tearDown(self):
        self.app.dependency_overrides.clear()

    def client_as(self, user):
        self.app.dependency_overrides[auth_deps.get_current_user] = lambda: user
        self.app.dependency_overrides[auth_deps.get_verified_user] = lambda: user
        return TestClient(self.app)

    def test_unauthenticated_user_cannot_read_conversation_messages(self):
        async def unauthenticated():
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

        self.app.dependency_overrides[auth_deps.get_current_user] = unauthenticated
        with TestClient(self.app) as client:
            response = client.get(f"/api/conversations/{self.conversation_id}/messages")
        self.assertEqual(response.status_code, 401)

    def test_user_cannot_read_other_users_conversation_messages(self):
        with self.client_as(self.user_a) as client:
            response = client.get(f"/api/conversations/{self.conversation_id}/messages")
        self.assertEqual(response.status_code, 403)
        self.assertIn("participant", response.json()["detail"].lower())

    def test_user_cannot_send_message_into_other_users_conversation(self):
        with self.client_as(self.user_a) as client:
            response = client.post(
                f"/api/conversations/{self.conversation_id}/message",
                json={"text": "Trying to inject into another chat.", "message_type": "text"},
            )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(len(self.messages_collection.documents), 1)

    def test_user_cannot_list_requests_for_someone_elses_item(self):
        with self.client_as(self.user_a) as client:
            response = client.get(f"/api/items/{self.item_id}/requests")
        self.assertEqual(response.status_code, 403)
        self.assertIn("owner", response.json()["detail"].lower())

    def test_user_cannot_approve_someone_elses_request(self):
        with self.client_as(self.user_a) as client:
            response = client.patch(f"/api/requests/{self.request_id}/approve")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.requests_collection.documents[0]["status"], "pending")

    def test_user_cannot_reject_someone_elses_request(self):
        with self.client_as(self.user_a) as client:
            response = client.patch(f"/api/requests/{self.request_id}/reject")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.requests_collection.documents[0]["status"], "pending")

    def test_user_cannot_cancel_someone_elses_request(self):
        with self.client_as(self.user_a) as client:
            response = client.delete(f"/api/requests/{self.request_id}")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(len(self.requests_collection.documents), 1)

    def test_user_cannot_delete_someone_elses_item(self):
        with self.client_as(self.user_a) as client:
            response = client.delete(f"/api/items/{self.item_id}")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(len(self.items_collection.documents), 1)

    def test_user_cannot_complete_someone_elses_item(self):
        with self.client_as(self.user_a) as client:
            response = client.patch(f"/api/items/{self.item_id}/complete")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.items_collection.documents[0]["status"], "available")

    def test_outsider_cannot_create_review_for_exchange_they_were_not_part_of(self):
        self.items_collection.documents[0]["status"] = "completed"
        self.requests_collection.documents[0]["status"] = "approved"
        payload = {
            "item_id": str(self.item_id),
            "reviewed_user_id": self.owner_id,
            "rating": 5,
            "comment": "Trying to review someone else's exchange.",
        }
        with self.client_as(self.user_a) as client:
            response = client.post("/api/reviews", json=payload)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(len(self.reviews_collection.documents), 0)
