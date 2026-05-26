from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest import IsolatedAsyncioTestCase

from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import auth as auth_deps
from app.api.routes import reviews as reviews_routes


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

    def find(self, query):
        return FakeCursor([document for document in self.documents if match_query(document, query)])

    async def insert_one(self, document):
        stored = {**document}
        stored.setdefault("_id", ObjectId())
        self.documents.append(stored)
        return SimpleNamespace(inserted_id=stored["_id"])


class ReviewsReputationApiTests(IsolatedAsyncioTestCase):
    def setUp(self):
        self.now = datetime.now(timezone.utc)
        self.owner_id = str(ObjectId())
        self.requester_id = str(ObjectId())
        self.outsider_id = str(ObjectId())
        self.item_id = ObjectId()
        self.request_id = ObjectId()

        self.owner_user = {
            "id": self.owner_id,
            "name": "Owner User",
            "email": "owner@example.com",
            "account_type": "giver",
        }
        self.requester_user = {
            "id": self.requester_id,
            "name": "Requester User",
            "email": "requester@example.com",
            "account_type": "receiver",
        }
        self.outsider_user = {
            "id": self.outsider_id,
            "name": "Outsider User",
            "email": "outsider@example.com",
            "account_type": "receiver",
        }

        self.items_collection = FakeCollection(
            [
                {
                    "_id": self.item_id,
                    "title": "Desk lamp",
                    "description": "A bright desk lamp that still works well.",
                    "category": "Home",
                    "condition": "Good",
                    "location": "Karachi",
                    "image_url": None,
                    "status": "completed",
                    "owner_id": self.owner_id,
                    "owner_name": self.owner_user["name"],
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
                    "requester_name": self.requester_user["name"],
                    "owner_id": self.owner_id,
                    "status": "approved",
                    "created_at": self.now,
                }
            ]
        )
        self.reviews_collection = FakeCollection()

        async def get_items_collection_async():
            return self.items_collection

        async def get_requests_collection_async():
            return self.requests_collection

        async def get_reviews_collection_async():
            return self.reviews_collection

        reviews_routes.get_items_collection_async = get_items_collection_async
        reviews_routes.get_requests_collection_async = get_requests_collection_async
        reviews_routes.get_reviews_collection_async = get_reviews_collection_async

        self.app = FastAPI()
        self.app.include_router(reviews_routes.router, prefix="/api")

    def make_client(self, user):
        self.app.dependency_overrides[auth_deps.get_current_user] = lambda: user
        return TestClient(self.app)

    def test_completed_exchange_allows_receiver_review(self):
        payload = {
            "item_id": str(self.item_id),
            "reviewed_user_id": self.owner_id,
            "rating": 5,
            "comment": "Very smooth exchange.",
        }

        with self.make_client(self.requester_user) as client:
            response = client.post("/api/reviews", json=payload)

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["reviewer_id"], self.requester_id)
        self.assertEqual(response.json()["reviewed_user_id"], self.owner_id)
        self.assertEqual(self.reviews_collection.documents[0]["item_id"], str(self.item_id))

    def test_completed_exchange_allows_owner_review(self):
        payload = {
            "item_id": str(self.item_id),
            "reviewed_user_id": self.requester_id,
            "rating": 4,
            "comment": "Friendly pickup and clear communication.",
        }

        with self.make_client(self.owner_user) as client:
            response = client.post("/api/reviews", json=payload)

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["reviewed_user_id"], self.requester_id)

    def test_pending_or_reserved_item_cannot_be_reviewed(self):
        self.items_collection.documents[0]["status"] = "reserved"
        payload = {
            "item_id": str(self.item_id),
            "reviewed_user_id": self.owner_id,
            "rating": 5,
            "comment": "Trying too early.",
        }

        with self.make_client(self.requester_user) as client:
            response = client.post("/api/reviews", json=payload)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json()["detail"],
            "Reviews are only allowed after a completed exchange.",
        )

    def test_random_user_cannot_review_exchange(self):
        payload = {
            "item_id": str(self.item_id),
            "reviewed_user_id": self.owner_id,
            "rating": 5,
            "comment": "I was not part of this.",
        }

        with self.make_client(self.outsider_user) as client:
            response = client.post("/api/reviews", json=payload)

        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.json()["detail"],
            "Only exchange participants can leave a review.",
        )

    def test_duplicate_review_is_blocked(self):
        self.reviews_collection.documents.append(
            {
                "_id": ObjectId(),
                "item_id": str(self.item_id),
                "request_id": str(self.request_id),
                "item_title": "Desk lamp",
                "reviewer_id": self.requester_id,
                "reviewer_name": self.requester_user["name"],
                "reviewed_user_id": self.owner_id,
                "rating": 5,
                "comment": "Already left one.",
                "created_at": self.now,
            }
        )
        payload = {
            "item_id": str(self.item_id),
            "reviewed_user_id": self.owner_id,
            "rating": 4,
            "comment": "Trying to submit again.",
        }

        with self.make_client(self.requester_user) as client:
            response = client.post("/api/reviews", json=payload)

        self.assertEqual(response.status_code, 409)
        self.assertEqual(
            response.json()["detail"],
            "You have already reviewed this exchange.",
        )

    def test_rating_validation_is_enforced(self):
        payload = {
            "item_id": str(self.item_id),
            "reviewed_user_id": self.owner_id,
            "rating": 6,
            "comment": "Too many stars.",
        }

        with self.make_client(self.requester_user) as client:
            response = client.post("/api/reviews", json=payload)

        self.assertEqual(response.status_code, 422)

    def test_reputation_summary_returns_badge_average_and_review_count(self):
        for index in range(4):
            extra_item_id = ObjectId()
            self.items_collection.documents.append(
                {
                    "_id": extra_item_id,
                    "title": f"Completed item {index}",
                    "description": "Completed exchange item.",
                    "category": "Home",
                    "condition": "Good",
                    "location": "Karachi",
                    "image_url": None,
                    "status": "completed",
                    "owner_id": self.owner_id,
                    "owner_name": self.owner_user["name"],
                    "created_at": self.now - timedelta(days=index + 1),
                }
            )

        self.reviews_collection.documents.extend(
            [
                {
                    "_id": ObjectId(),
                    "item_id": str(self.item_id),
                    "request_id": str(self.request_id),
                    "item_title": "Desk lamp",
                    "reviewer_id": self.requester_id,
                    "reviewer_name": self.requester_user["name"],
                    "reviewed_user_id": self.owner_id,
                    "rating": 5,
                    "comment": "Excellent experience.",
                    "created_at": self.now,
                },
                {
                    "_id": ObjectId(),
                    "item_id": str(ObjectId()),
                    "request_id": str(ObjectId()),
                    "item_title": "Chair",
                    "reviewer_id": self.outsider_id,
                    "reviewer_name": self.outsider_user["name"],
                    "reviewed_user_id": self.owner_id,
                    "rating": 4,
                    "comment": "Very reliable.",
                    "created_at": self.now - timedelta(hours=1),
                },
            ]
        )

        with self.make_client(self.owner_user) as client:
            response = client.get("/api/me/reputation")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["level"], "New Member")
        self.assertEqual(data["trust_score"], 0)
        self.assertEqual(data["completed_shared_count"], 5)
        self.assertEqual(data["completed_exchange_count"], 5)
        self.assertEqual(data["review_count"], 2)
        self.assertEqual(data["average_rating"], 4.5)

    def test_user_reviews_endpoint_returns_latest_reviews(self):
        older_review = {
            "_id": ObjectId(),
            "item_id": str(ObjectId()),
            "request_id": str(ObjectId()),
            "item_title": "Bookshelf",
            "reviewer_id": self.requester_id,
            "reviewer_name": self.requester_user["name"],
            "reviewed_user_id": self.owner_id,
            "rating": 4,
            "comment": "Helpful and punctual.",
            "created_at": self.now - timedelta(days=2),
        }
        newer_review = {
            "_id": ObjectId(),
            "item_id": str(ObjectId()),
            "request_id": str(ObjectId()),
            "item_title": "Study table",
            "reviewer_id": self.outsider_id,
            "reviewer_name": self.outsider_user["name"],
            "reviewed_user_id": self.owner_id,
            "rating": 5,
            "comment": "Very kind donor.",
            "created_at": self.now,
        }
        self.reviews_collection.documents.extend([older_review, newer_review])

        with self.make_client(self.owner_user) as client:
            response = client.get(f"/api/users/{self.owner_id}/reviews")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()[0]["item_title"], "Study table")
