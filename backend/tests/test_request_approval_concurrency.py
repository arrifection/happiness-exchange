"""Tests for atomic request approval and conversation creation."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest import IsolatedAsyncioTestCase

from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pymongo import ReturnDocument

from app.api.deps import auth as auth_deps
from app.api.routes import requests as requests_routes
from app.services.conversations import CHAT_ADMIN_LISTER, CHAT_ADMIN_RECEIVER


def match_query(document, query):
    for key, expected in query.items():
        actual = document.get(key)
        if isinstance(expected, dict):
            if "$ne" in expected and actual == expected["$ne"]:
                return False
            continue
        if actual != expected:
            return False
    return True


class TransactionalFakeCollection:
    def __init__(self, documents=None):
        self.documents = list(documents or [])
        self.lock = asyncio.Lock()

    async def find_one(self, query, session=None):
        async with self.lock:
            for document in self.documents:
                if match_query(document, query):
                    return dict(document)
            return None

    async def find_one_and_update(self, query, update, return_document=None, session=None):
        async with self.lock:
            for index, document in enumerate(self.documents):
                if match_query(document, query):
                    before = dict(document)
                    document.update(update.get("$set", {}))
                    if return_document == ReturnDocument.AFTER:
                        return dict(document)
                    return before
            return None

    async def update_many(self, query, update, session=None):
        async with self.lock:
            modified = 0
            for document in self.documents:
                if match_query(document, query):
                    document.update(update.get("$set", {}))
                    modified += 1
            return SimpleNamespace(modified_count=modified)

    async def update_one(self, query, update, session=None):
        async with self.lock:
            for document in self.documents:
                if match_query(document, query):
                    document.update(update.get("$set", {}))
                    return SimpleNamespace(modified_count=1)
            return SimpleNamespace(modified_count=0)

    async def insert_one(self, document, session=None):
        async with self.lock:
            stored = {**document, "_id": ObjectId()}
            self.documents.append(stored)
            return SimpleNamespace(inserted_id=stored["_id"])


class FakeUsersCollection:
    def __init__(self):
        self.admin_id = str(ObjectId())
        self.admin_doc = {
            "_id": ObjectId(self.admin_id),
            "name": "Platform Admin",
            "role": "super_admin",
            "is_banned": False,
            "created_at": datetime.now(timezone.utc),
        }

    async def find_one(self, query, projection=None, sort=None, session=None):
        if query.get("role"):
            return self.admin_doc
        return None


class RequestApprovalConcurrencyTests(IsolatedAsyncioTestCase):
    def setUp(self):
        self.owner_id = str(ObjectId())
        self.requester_id = str(ObjectId())
        self.request_id = ObjectId()
        self.item_id = ObjectId()
        self.now = datetime.now(timezone.utc)

        self.owner_user = {
            "id": self.owner_id,
            "name": "Owner User",
            "email": "owner@example.com",
            "is_verified": True,
        }

        self.requests_collection = TransactionalFakeCollection(
            [
                {
                    "_id": self.request_id,
                    "item_id": str(self.item_id),
                    "item_title": "Desk lamp",
                    "requester_id": self.requester_id,
                    "requester_name": "Requester User",
                    "owner_id": self.owner_id,
                    "owner_name": "Owner User",
                    "status": "pending",
                    "created_at": self.now,
                }
            ]
        )
        self.items_collection = TransactionalFakeCollection(
            [
                {
                    "_id": self.item_id,
                    "title": "Desk lamp",
                    "status": "available",
                    "owner_id": self.owner_id,
                    "owner_name": "Owner User",
                }
            ]
        )
        self.conversations_collection = TransactionalFakeCollection([])
        self.users_collection = FakeUsersCollection()

        async def get_requests_collection_async():
            return self.requests_collection

        async def get_items_collection_async():
            return self.items_collection

        async def get_conversations_collection_async():
            return self.conversations_collection

        async def get_users_collection_async():
            return self.users_collection

        async def fake_get_mongo_client_async():
            return None

        requests_routes.get_requests_collection_async = get_requests_collection_async
        requests_routes.get_items_collection_async = get_items_collection_async
        requests_routes.get_conversations_collection_async = get_conversations_collection_async
        requests_routes.get_users_collection_async = get_users_collection_async

        import app.services.request_approval as approval_module

        approval_module.get_mongo_client_async = fake_get_mongo_client_async

        self.app = FastAPI()
        self.app.include_router(requests_routes.router, prefix="/api")
        self.app.dependency_overrides[auth_deps.get_verified_user] = lambda: self.owner_user

    def tearDown(self):
        self.app.dependency_overrides.clear()

    def test_concurrent_approval_is_idempotent(self):
        results = []

        def approve_once():
            with TestClient(self.app) as client:
                results.append(client.patch(f"/api/requests/{self.request_id}/approve"))

        import threading

        threads = [threading.Thread(target=approve_once) for _ in range(2)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        statuses = sorted(response.status_code for response in results)
        bodies = [response.json().get("detail") for response in results]
        self.assertEqual(statuses, [200, 409], msg=f"details={bodies}")
        approved = [doc for doc in self.requests_collection.documents if doc["status"] == "approved"]
        self.assertEqual(len(approved), 1)
        chat_types = sorted(doc["chat_type"] for doc in self.conversations_collection.documents)
        self.assertEqual(chat_types, sorted([CHAT_ADMIN_RECEIVER, CHAT_ADMIN_LISTER]))
        self.assertEqual(len(self.conversations_collection.documents), 2)

    def test_already_approved_request_returns_conflict_without_extra_conversations(self):
        self.requests_collection.documents[0]["status"] = "approved"
        self.conversations_collection.documents.extend(
            [
                {
                    "_id": ObjectId(),
                    "request_id": str(self.request_id),
                    "chat_type": CHAT_ADMIN_RECEIVER,
                },
                {
                    "_id": ObjectId(),
                    "request_id": str(self.request_id),
                    "chat_type": CHAT_ADMIN_LISTER,
                },
            ]
        )

        with TestClient(self.app) as client:
            response = client.patch(f"/api/requests/{self.request_id}/approve")

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["detail"], "Request already processed")
        self.assertEqual(len(self.conversations_collection.documents), 2)
