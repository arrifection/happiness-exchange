from datetime import datetime, timezone
from types import SimpleNamespace
from unittest import IsolatedAsyncioTestCase

from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import auth as auth_deps
from app.api.routes import items as items_routes
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

    def find(self, query):
        return FakeCursor([document for document in self.documents if match_query(document, query)])

    async def insert_one(self, document):
        stored = {**document}
        stored.setdefault("_id", ObjectId())
        self.documents.append(stored)
        return SimpleNamespace(inserted_id=stored["_id"])

    async def delete_one(self, query):
        for index, document in enumerate(self.documents):
            if match_query(document, query):
                del self.documents[index]
                return SimpleNamespace(deleted_count=1)
        return SimpleNamespace(deleted_count=0)

    async def delete_many(self, query):
        remaining = [document for document in self.documents if not match_query(document, query)]
        deleted_count = len(self.documents) - len(remaining)
        self.documents = remaining
        return SimpleNamespace(deleted_count=deleted_count)

    async def update_one(self, query, update):
        for document in self.documents:
            if match_query(document, query):
                document.update(update.get("$set", {}))
                return SimpleNamespace(modified_count=1)
        return SimpleNamespace(modified_count=0)

    async def update_many(self, query, update):
        modified_count = 0
        for document in self.documents:
            if match_query(document, query):
                document.update(update.get("$set", {}))
                modified_count += 1
        return SimpleNamespace(modified_count=modified_count)

    async def count_documents(self, query):
        return sum(1 for document in self.documents if match_query(document, query))


class ItemManagementApiTests(IsolatedAsyncioTestCase):
    def setUp(self):
        self.owner_id = str(ObjectId())
        self.other_user_id = str(ObjectId())
        self.requester_id = str(ObjectId())
        self.item_id = ObjectId()
        self.now = datetime.now(timezone.utc)

        self.owner_user = {
            "id": self.owner_id,
            "name": "Owner User",
            "email": "owner@example.com",
            "account_type": "giver",
            "is_verified": True,
            "whatsapp_number": "+923001234567",
        }
        self.other_user = {
            "id": self.other_user_id,
            "name": "Other User",
            "email": "other@example.com",
            "account_type": "receiver",
            "is_verified": True,
            "whatsapp_number": "+923001234567",
        }
        self.requester_user = {
            "id": self.requester_id,
            "name": "Requester User",
            "email": "requester@example.com",
            "account_type": "receiver",
            "is_verified": True,
            "whatsapp_number": "+923001234567",
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
                    "status": "available",
                    "owner_id": self.owner_id,
                    "owner_name": self.owner_user["name"],
                    "created_at": self.now,
                }
            ]
        )
        self.requests_collection = FakeCollection(
            [
                {
                    "_id": ObjectId(),
                    "item_id": str(self.item_id),
                    "item_title": "Desk lamp",
                    "requester_id": self.requester_id,
                    "requester_name": self.requester_user["name"],
                    "owner_id": self.owner_id,
                    "status": "pending",
                    "created_at": self.now,
                }
            ]
        )
        self.reviews_collection = FakeCollection([])

        async def get_items_collection_async():
            return self.items_collection

        async def get_requests_collection_async():
            return self.requests_collection

        async def get_reviews_collection_async():
            return self.reviews_collection

        async def fake_award_completed_donation(user_id, item_id):
            return True

        items_routes.get_items_collection_async = get_items_collection_async
        items_routes.get_requests_collection_async = get_requests_collection_async
        items_routes.get_reviews_collection_async = get_reviews_collection_async
        items_routes.award_completed_donation = fake_award_completed_donation
        requests_routes.get_items_collection_async = get_items_collection_async
        requests_routes.get_requests_collection_async = get_requests_collection_async

        self.app = FastAPI()
        self.app.include_router(items_routes.router, prefix="/api")
        self.app.include_router(requests_routes.router, prefix="/api")

    def make_client(self, user):
        self.app.dependency_overrides[auth_deps.get_current_user] = lambda: user
        self.app.dependency_overrides[auth_deps.get_verified_user] = lambda: user
        return TestClient(self.app)

    def test_owner_can_delete_own_item(self):
        with self.make_client(self.owner_user) as client:
            response = client.delete(f"/api/items/{self.item_id}")

        self.assertEqual(response.status_code, 204)
        self.assertEqual(len(self.items_collection.documents), 0)
        self.assertEqual(len(self.requests_collection.documents), 0)

    def test_create_item_keeps_only_image_url_in_storage(self):
        payload = {
            "title": "Dining chair",
            "description": "A sturdy wooden chair with a clean seat and minor paint wear.",
            "category": "Furniture",
            "condition": "Good",
            "location": "Lahore",
            "country": "Pakistan",
            "city": "Lahore",
            "image_url": "https://res.cloudinary.com/demo/image/upload/chair.png",
        }

        with self.make_client(self.owner_user) as client:
            response = client.post("/api/items", json=payload)

        self.assertEqual(response.status_code, 201)
        created_document = self.items_collection.documents[-1]
        self.assertEqual(created_document["image_url"], payload["image_url"])
        self.assertAlmostEqual(created_document["latitude"], 31.5497, places=3)
        self.assertAlmostEqual(created_document["longitude"], 74.3436, places=3)
        self.assertNotIn("image", created_document)
        self.assertNotIn("image_base64", created_document)
        self.assertNotIn("image_binary", created_document)

    def test_create_item_stores_map_pin_coordinates(self):
        payload = {
            "title": "Pinned lamp",
            "description": "A lamp pinned to a custom map location near the community center.",
            "category": "Home",
            "condition": "Good",
            "location": "Lahore",
            "country": "Pakistan",
            "city": "Lahore",
            "latitude": 31.56,
            "longitude": 74.35,
            "location_source": "manual",
            "image_url": "https://res.cloudinary.com/demo/image/upload/lamp.png",
        }

        with self.make_client(self.owner_user) as client:
            response = client.post("/api/items", json=payload)

        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertEqual(body["latitude"], 31.56)
        self.assertEqual(body["longitude"], 74.35)
        created_document = self.items_collection.documents[-1]
        self.assertEqual(created_document["latitude"], 31.56)
        self.assertEqual(created_document["longitude"], 74.35)

    def test_non_owner_cannot_delete_item(self):
        with self.make_client(self.other_user) as client:
            response = client.delete(f"/api/items/{self.item_id}")

        self.assertEqual(response.status_code, 403)
        self.assertEqual(len(self.items_collection.documents), 1)

    def test_owner_can_change_listing_mode_to_exchange(self):
        with self.make_client(self.owner_user) as client:
            response = client.patch(
                f"/api/items/{self.item_id}/listing-mode",
                json={"listing_mode": "EXCHANGE"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["listing_mode"], "EXCHANGE")
        self.assertEqual(self.items_collection.documents[0]["listing_mode"], "EXCHANGE")

    def test_non_owner_cannot_change_listing_mode(self):
        with self.make_client(self.other_user) as client:
            response = client.patch(
                f"/api/items/{self.item_id}/listing-mode",
                json={"listing_mode": "EXCHANGE"},
            )

        self.assertEqual(response.status_code, 403)
        self.assertNotEqual(self.items_collection.documents[0].get("listing_mode"), "EXCHANGE")

    def test_owner_can_mark_item_as_completed(self):
        with self.make_client(self.owner_user) as client:
            response = client.patch(f"/api/items/{self.item_id}/complete")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "completed")
        self.assertEqual(self.items_collection.documents[0]["status"], "completed")

    def test_non_owner_cannot_complete_item(self):
        with self.make_client(self.other_user) as client:
            response = client.patch(f"/api/items/{self.item_id}/complete")

        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.items_collection.documents[0]["status"], "available")

    def test_completed_item_cannot_receive_new_requests(self):
        self.items_collection.documents[0]["status"] = "completed"

        with self.make_client(self.other_user) as client:
            response = client.post(
                f"/api/requests/{self.item_id}",
                json={"reason": "I am a student and need this completed-item test case for validation.", "requester_city": "Lahore"},
            )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json()["detail"],
            "This item is not currently available for requests.",
        )

    def test_upload_image_rejects_non_image_files(self):
        with self.make_client(self.owner_user) as client:
            response = client.post(
                "/api/items/upload-image",
                files={"file": ("notes.txt", b"not-an-image", "text/plain")},
            )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json()["detail"],
            "File type not allowed. Use JPG, PNG, or WEBP.",
        )

    def test_upload_image_rejects_large_files(self):
        oversized_image = b"0" * ((5 * 1024 * 1024) + 1)

        with self.make_client(self.owner_user) as client:
            response = client.post(
                "/api/items/upload-image",
                files={"file": ("large.png", oversized_image, "image/png")},
            )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json()["detail"],
            "File too large. Maximum 5 MB.",
        )

    def test_upload_image_returns_secure_url(self):
        import io

        from PIL import Image

        buffer = io.BytesIO()
        Image.new("RGB", (8, 8), color="red").save(buffer, format="PNG")
        png_bytes = buffer.getvalue()

        async def fake_upload_image_to_cloudinary(*, file_name, content_type, file_bytes):
            self.assertTrue(file_name.endswith(".png"))
            self.assertEqual(content_type, "image/png")
            self.assertTrue(file_bytes.startswith(b"\x89PNG"))
            return "https://res.cloudinary.com/demo/image/upload/sample.png"

        items_routes.upload_image_to_cloudinary = fake_upload_image_to_cloudinary

        with self.make_client(self.owner_user) as client:
            response = client.post(
                "/api/items/upload-image",
                files={"file": ("lamp.png", png_bytes, "image/png")},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["secure_url"],
            "https://res.cloudinary.com/demo/image/upload/sample.png",
        )
