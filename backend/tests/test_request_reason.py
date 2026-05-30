from datetime import datetime, timezone
from types import SimpleNamespace
from unittest import IsolatedAsyncioTestCase

from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import auth as auth_deps
from app.api.routes import requests as requests_routes


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

    async def find_one(self, query):
        for document in self.documents:
            if match_query(document, query):
                return document
        return None

    def find(self, query, projection=None):
        return FakeCursor([document for document in self.documents if match_query(document, query)])

    async def insert_one(self, document):
        stored = {**document}
        stored.setdefault("_id", ObjectId())
        self.documents.append(stored)
        return SimpleNamespace(inserted_id=stored["_id"])

    def aggregate(self, pipeline):
        documents = list(self.documents)
        for stage in pipeline:
            if "$match" in stage:
                documents = [
                    document for document in documents if match_query(document, stage["$match"])
                ]
            elif "$group" in stage:
                grouped = {}
                for document in documents:
                    group_id = document.get(stage["$group"]["_id"].lstrip("$"))
                    bucket = grouped.setdefault(group_id, {"_id": group_id, "review_count": 0, "ratings": []})
                    bucket["review_count"] += 1
                    bucket["ratings"].append(document["rating"])
                documents = []
                for bucket in grouped.values():
                    count = bucket["review_count"]
                    average = sum(bucket["ratings"]) / count if count else 0.0
                    documents.append(
                        {
                            "_id": bucket["_id"],
                            "review_count": count,
                            "average_rating": average,
                        }
                    )
        return FakeCursor(documents)


class RequestReasonApiTests(IsolatedAsyncioTestCase):
    def setUp(self):
        self.now = datetime.now(timezone.utc)
        self.owner_id = str(ObjectId())
        self.requester_id = str(ObjectId())
        self.item_id = ObjectId()

        self.owner_user = {
            "id": self.owner_id,
            "name": "Owner User",
            "email": "owner@example.com",
            "account_type": "giver",
            "is_verified": True,
        }
        self.requester_user = {
            "id": self.requester_id,
            "name": "Requester User",
            "email": "requester@example.com",
            "account_type": "receiver",
            "is_verified": True,
        }

        self.items_collection = FakeCollection(
            [
                {
                    "_id": self.item_id,
                    "title": "Study Desk",
                    "status": "available",
                    "owner_id": self.owner_id,
                    "owner_name": "Owner User",
                }
            ]
        )
        self.requests_collection = FakeCollection([])

        async def get_items_collection_async():
            return self.items_collection

        async def get_requests_collection_async():
            return self.requests_collection

        async def get_users_collection_async():
            return FakeCollection([{"_id": ObjectId(self.requester_id), "trust_score": 25}])

        async def get_reviews_collection_async():
            return FakeCollection([])

        requests_routes.get_items_collection_async = get_items_collection_async
        requests_routes.get_requests_collection_async = get_requests_collection_async
        requests_routes.get_users_collection_async = get_users_collection_async
        requests_routes.get_reviews_collection_async = get_reviews_collection_async
        async def noop_notification(*args, **kwargs):
            return None

        requests_routes.create_notification = noop_notification
        requests_routes.check_user_rate_limit = lambda *args, **kwargs: None

        app = FastAPI()
        app.include_router(requests_routes.router, prefix="/api")
        self.client = TestClient(app)

    def make_client(self, user):
        self.client.app.dependency_overrides[auth_deps.get_verified_user] = lambda: user
        self.client.app.dependency_overrides[auth_deps.get_current_user] = lambda: user
        return self.client

    def tearDown(self):
        self.client.app.dependency_overrides.clear()

    def test_create_request_requires_reason(self):
        client = self.make_client(self.requester_user)
        response = client.post(f"/api/requests/{self.item_id}", json={})

        self.assertEqual(response.status_code, 422)

    def test_create_request_rejects_short_reason(self):
        client = self.make_client(self.requester_user)
        response = client.post(
            f"/api/requests/{self.item_id}",
            json={"reason": "Too short reason here."},
        )

        self.assertEqual(response.status_code, 422)

    def test_create_request_stores_reason(self):
        reason = "I am a university student and need this desk for my semester studies."
        client = self.make_client(self.requester_user)
        response = client.post(
            f"/api/requests/{self.item_id}",
            json={"reason": reason},
        )

        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertEqual(payload["reason"], reason)
        self.assertEqual(self.requests_collection.documents[0]["reason"], reason)

    def test_incoming_requests_include_requester_reputation(self):
        reason = "I recently moved and currently do not have basic kitchen items at home."
        self.requests_collection.documents.append(
            {
                "_id": ObjectId(),
                "item_id": str(self.item_id),
                "item_title": "Study Desk",
                "requester_id": self.requester_id,
                "requester_name": "Requester User",
                "owner_id": self.owner_id,
                "owner_name": "Owner User",
                "reason": reason,
                "status": "pending",
                "created_at": self.now,
            }
        )

        client = self.make_client(self.owner_user)
        response = client.get("/api/requests/incoming")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload), 1)
        self.assertEqual(payload[0]["reason"], reason)
        self.assertEqual(payload[0]["requester_reputation"]["level"], "Trusted Giver")
