import re
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest import IsolatedAsyncioTestCase

from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes import items as items_routes
from app.services.location import (
    build_items_list_query,
    build_item_location_payload,
    enrich_item_location,
    filter_and_sort_items,
    get_city_coordinates,
    item_matches_country,
)


def _value_matches(actual, expected) -> bool:
    if isinstance(expected, dict):
        if "$exists" in expected:
            exists = actual is not None
            return exists if expected["$exists"] else not exists
        if "$in" in expected:
            return actual in expected["$in"]
        if "$ne" in expected:
            return actual != expected["$ne"]
        if "$regex" in expected:
            if actual is None:
                return False
            flags = re.I if expected.get("$options", "").find("i") >= 0 else 0
            return re.search(expected["$regex"], str(actual), flags) is not None
        return False
    return actual == expected


def document_matches(document: dict, query: dict) -> bool:
    for key, expected in query.items():
        if key == "$and":
            if not all(document_matches(document, clause) for clause in expected):
                return False
            continue
        if key == "$or":
            if not any(document_matches(document, clause) for clause in expected):
                return False
            continue
        actual = document.get(key)
        if not _value_matches(actual, expected):
            return False
    return True


def match_query(document, query):
    return document_matches(document, query)


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


class LocationServiceTests(IsolatedAsyncioTestCase):
    def test_legacy_item_defaults_to_pakistan(self):
        enriched = enrich_item_location({"location": "Lahore", "title": "Chair"})
        self.assertEqual(enriched["country"], "Pakistan")
        self.assertEqual(enriched["city"], "Lahore")
        self.assertIn("Lahore", enriched["location_display"])

    def test_saudi_city_inferred_from_legacy_location(self):
        enriched = enrich_item_location({"location": "Riyadh", "title": "Table"})
        self.assertEqual(enriched["country"], "Saudi Arabia")
        self.assertEqual(enriched["city"], "Riyadh")

    def test_filter_by_country(self):
        items = [
            {"country": "Pakistan", "city": "Lahore", "location": "Lahore"},
            {"country": "Saudi Arabia", "city": "Riyadh", "location": "Riyadh"},
            {"location": "Karachi"},
        ]
        pakistan_only = filter_and_sort_items(items, country="Pakistan")
        self.assertEqual(len(pakistan_only), 2)
        saudi_only = filter_and_sort_items(items, country="Saudi Arabia")
        self.assertEqual(len(saudi_only), 1)
        self.assertEqual(saudi_only[0]["city"], "Riyadh")

    def test_filter_by_city(self):
        items = [
            {"country": "Pakistan", "city": "Lahore", "location": "Lahore"},
            {"country": "Pakistan", "city": "Karachi", "location": "Karachi"},
        ]
        lahore = filter_and_sort_items(items, country="Pakistan", city="Lahore")
        self.assertEqual(len(lahore), 1)
        self.assertEqual(lahore[0]["city"], "Lahore")

    def test_legacy_item_matches_pakistan_filter(self):
        legacy = {"location": "Multan"}
        self.assertTrue(item_matches_country(legacy, "Pakistan"))

    def test_build_items_list_query_saudi_city(self):
        query = build_items_list_query(
            country="Saudi Arabia",
            city="Riyadh",
            status="available",
        )
        self.assertEqual(query["status"], "available")
        self.assertEqual(query["country"], "Saudi Arabia")
        self.assertIn("$and", query)

    def test_build_items_list_query_pakistan_legacy(self):
        query = build_items_list_query(country="Pakistan", status="available")
        self.assertEqual(query["status"], "available")
        self.assertIn("$and", query)

    def test_build_item_location_payload_uses_city_coordinates(self):
        payload = build_item_location_payload(
            location="Lahore",
            country="Pakistan",
            city="Lahore",
        )
        self.assertAlmostEqual(payload["latitude"], 31.5497, places=3)
        self.assertAlmostEqual(payload["longitude"], 74.3436, places=3)

    def test_build_item_location_payload_prefers_explicit_coordinates(self):
        payload = build_item_location_payload(
            location="Lahore",
            country="Pakistan",
            city="Lahore",
            latitude=31.55,
            longitude=74.34,
        )
        self.assertEqual(payload["latitude"], 31.55)
        self.assertEqual(payload["longitude"], 74.34)

    def test_get_city_coordinates_case_insensitive(self):
        coords = get_city_coordinates("Pakistan", "lahore")
        self.assertIsNotNone(coords)
        self.assertAlmostEqual(coords[0], 31.5497, places=3)


class LocationApiTests(IsolatedAsyncioTestCase):
    def setUp(self):
        self.owner_id = str(ObjectId())
        self.now = datetime.now(timezone.utc)
        self.owner_user = {
            "id": self.owner_id,
            "name": "Owner User",
            "email": "owner@example.com",
            "account_type": "giver",
            "email_verified": True,
        }

        self.items_collection = FakeCollection(
            [
                {
                    "_id": ObjectId(),
                    "title": "Pakistan Lamp",
                    "description": "A lamp available in Lahore for pickup.",
                    "category": "Home",
                    "condition": "Good",
                    "location": "Lahore",
                    "country": "Pakistan",
                    "city": "Lahore",
                    "location_source": "manual",
                    "location_display": "Lahore, Pakistan",
                    "status": "available",
                    "owner_id": self.owner_id,
                    "owner_name": self.owner_user["name"],
                    "created_at": self.now,
                },
                {
                    "_id": ObjectId(),
                    "title": "Saudi Desk",
                    "description": "A desk available in Riyadh for pickup.",
                    "category": "Home",
                    "condition": "Good",
                    "location": "Riyadh",
                    "country": "Saudi Arabia",
                    "city": "Riyadh",
                    "location_source": "manual",
                    "location_display": "Riyadh, Saudi Arabia",
                    "status": "available",
                    "owner_id": self.owner_id,
                    "owner_name": self.owner_user["name"],
                    "created_at": self.now,
                },
                {
                    "_id": ObjectId(),
                    "title": "Completed Chair",
                    "description": "Already completed and should not appear in browse.",
                    "category": "Home",
                    "condition": "Good",
                    "location": "Lahore",
                    "country": "Pakistan",
                    "city": "Lahore",
                    "location_source": "manual",
                    "location_display": "Lahore, Pakistan",
                    "status": "completed",
                    "owner_id": self.owner_id,
                    "owner_name": self.owner_user["name"],
                    "created_at": self.now,
                },
            ]
        )

        async def get_items_collection_async():
            return self.items_collection

        async def get_requests_collection_async():
            return None

        async def get_reviews_collection_async():
            return None

        items_routes.get_items_collection_async = get_items_collection_async
        items_routes.get_requests_collection_async = get_requests_collection_async
        items_routes.get_reviews_collection_async = get_reviews_collection_async

        app = FastAPI()
        app.include_router(items_routes.router, prefix="/api")
        self.client = TestClient(app)

    def test_list_items_filtered_by_pakistan(self):
        response = self.client.get("/api/items", params={"country": "Pakistan"})
        self.assertEqual(response.status_code, 200)
        titles = [item["title"] for item in response.json()]
        self.assertIn("Pakistan Lamp", titles)
        self.assertNotIn("Saudi Desk", titles)

    def test_list_items_filtered_by_saudi_city(self):
        response = self.client.get("/api/items", params={"country": "Saudi Arabia", "city": "Riyadh"})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["country"], "Saudi Arabia")
        self.assertEqual(data[0]["city"], "Riyadh")

    def test_list_items_default_status_available_only(self):
        response = self.client.get("/api/items", params={"country": "Pakistan"})
        self.assertEqual(response.status_code, 200)
        titles = [item["title"] for item in response.json()]
        self.assertIn("Pakistan Lamp", titles)
        self.assertNotIn("Completed Chair", titles)
        for item in response.json():
            self.assertEqual(item["status"], "available")
            self.assertEqual(item["request_count"], 0)
            self.assertIsNone(item["owner_average_rating"])
