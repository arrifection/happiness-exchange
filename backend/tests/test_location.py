import re
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest import IsolatedAsyncioTestCase

from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes import items as items_routes
from app.services.location import (
    GEO_CANDIDATE_LIMIT,
    apply_geo_bounds_to_query,
    build_items_list_query,
    build_item_location_payload,
    enrich_item_location,
    filter_and_sort_items,
    geo_bounding_box,
    get_city_coordinates,
    item_matches_country,
)


def _value_matches(actual, expected) -> bool:
    if isinstance(expected, dict) and any(str(key).startswith("$") for key in expected):
        for op, value in expected.items():
            if op == "$exists":
                exists = actual is not None
                if not (exists if value else not exists):
                    return False
            elif op == "$in":
                if actual not in value:
                    return False
            elif op == "$nin":
                if actual in value:
                    return False
            elif op == "$ne":
                if actual == value:
                    return False
            elif op == "$lt":
                if actual is None or not (actual < value):
                    return False
            elif op == "$lte":
                if actual is None or not (actual <= value):
                    return False
            elif op == "$gt":
                if actual is None or not (actual > value):
                    return False
            elif op == "$gte":
                if actual is None or not (actual >= value):
                    return False
            elif op == "$regex":
                if actual is None:
                    return False
                flags = re.I if expected.get("$options", "").find("i") >= 0 else 0
                if not re.search(value, str(actual), flags):
                    return False
            elif op == "$options":
                continue
            elif op == "$not":
                if _value_matches(actual, value):
                    return False
            else:
                return False
        return True
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

    def sort(self, key_or_keys, direction=None):
        if isinstance(key_or_keys, list):
            sort_keys = key_or_keys
        else:
            sort_keys = [(key_or_keys, direction)]

        for key, dir_value in reversed(sort_keys):
            reverse = dir_value == -1
            self.documents.sort(key=lambda document, sort_key=key: document.get(sort_key), reverse=reverse)
        return self

    def skip(self, count):
        self.documents = self.documents[count:]
        return self

    def limit(self, count):
        self.documents = self.documents[:count]
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

    async def count_documents(self, query):
        return len([document for document in self.documents if match_query(document, query)])

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
        self.assertAlmostEqual(enriched["latitude"], 31.5497, places=3)
        self.assertAlmostEqual(enriched["longitude"], 74.3436, places=3)

    def test_missing_coordinates_backfilled_from_city(self):
        enriched = enrich_item_location(
            {
                "country": "Pakistan",
                "city": "Lahore",
                "location": "Lahore",
                "latitude": None,
                "longitude": None,
            }
        )
        self.assertAlmostEqual(enriched["latitude"], 31.5497, places=3)
        self.assertAlmostEqual(enriched["longitude"], 74.3436, places=3)

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

    def test_geo_bounding_box_contains_center(self):
        box = geo_bounding_box(31.5497, 74.3436, 50)
        self.assertLess(box["min_lat"], 31.5497)
        self.assertGreater(box["max_lat"], 31.5497)
        self.assertLess(box["min_lng"], 74.3436)
        self.assertGreater(box["max_lng"], 74.3436)

    def test_apply_geo_bounds_to_query_adds_lat_lng_ranges(self):
        base = build_items_list_query(country="Pakistan", status="available")
        geo_query = apply_geo_bounds_to_query(
            base,
            near_lat=31.5497,
            near_lng=74.3436,
            radius_km=25,
        )
        self.assertEqual(GEO_CANDIDATE_LIMIT, 2000)
        # Bounds live in $and when country filters already use $and.
        and_clauses = geo_query.get("$and") or []
        lat_lng_clause = next(
            (clause for clause in and_clauses if "latitude" in clause and "longitude" in clause),
            None,
        )
        self.assertIsNotNone(lat_lng_clause)
        self.assertIn("$gte", lat_lng_clause["latitude"])
        self.assertIn("$lte", lat_lng_clause["latitude"])


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
                    "latitude": 31.5497,
                    "longitude": 74.3436,
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
                    "latitude": 24.7136,
                    "longitude": 46.6753,
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
                    "latitude": 31.5497,
                    "longitude": 74.3436,
                    "status": "completed",
                    "owner_id": self.owner_id,
                    "owner_name": self.owner_user["name"],
                    "created_at": self.now,
                },
                {
                    "_id": ObjectId(),
                    "title": "Far Away Item",
                    "description": "Karachi item should be outside a tight Lahore radius.",
                    "category": "Home",
                    "condition": "Good",
                    "location": "Karachi",
                    "country": "Pakistan",
                    "city": "Karachi",
                    "location_source": "manual",
                    "location_display": "Karachi, Pakistan",
                    "latitude": 24.8607,
                    "longitude": 67.0011,
                    "status": "available",
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
        payload = response.json()
        titles = [item["title"] for item in payload["items"]]
        self.assertIn("Pakistan Lamp", titles)
        self.assertNotIn("Saudi Desk", titles)
        self.assertEqual(payload["page"], 1)
        self.assertIn("total", payload)

    def test_list_items_filtered_by_saudi_city(self):
        response = self.client.get("/api/items", params={"country": "Saudi Arabia", "city": "Riyadh"})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload["items"]), 1)
        self.assertEqual(payload["items"][0]["country"], "Saudi Arabia")
        self.assertEqual(payload["items"][0]["city"], "Riyadh")

    def test_list_items_default_status_available_only(self):
        response = self.client.get("/api/items", params={"country": "Pakistan"})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        titles = [item["title"] for item in payload["items"]]
        self.assertIn("Pakistan Lamp", titles)
        self.assertNotIn("Completed Chair", titles)
        for item in payload["items"]:
            self.assertEqual(item["status"], "available")
            self.assertEqual(item["request_count"], 0)
            self.assertIsNone(item["owner_average_rating"])

    def test_list_items_pagination_metadata(self):
        response = self.client.get("/api/items", params={"country": "Pakistan", "page": 1, "limit": 1})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["page"], 1)
        self.assertEqual(payload["limit"], 1)
        self.assertGreaterEqual(payload["total"], 1)
        self.assertGreaterEqual(payload["total_pages"], 1)
        self.assertEqual(len(payload["items"]), 1)

    def test_list_items_geo_zero_results(self):
        response = self.client.get(
            "/api/items",
            params={
                "near_lat": 0.0,
                "near_lng": 0.0,
                "radius_km": 5,
            },
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["items"], [])
        self.assertEqual(payload["total"], 0)

    def test_list_items_geo_nearby_lahore(self):
        response = self.client.get(
            "/api/items",
            params={
                "country": "Pakistan",
                "near_lat": 31.5497,
                "near_lng": 74.3436,
                "radius_km": 30,
            },
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        titles = [item["title"] for item in payload["items"]]
        self.assertIn("Pakistan Lamp", titles)
        self.assertNotIn("Far Away Item", titles)
        self.assertNotIn("Saudi Desk", titles)
        self.assertNotIn("Completed Chair", titles)

    def test_list_items_geo_pagination(self):
        response = self.client.get(
            "/api/items",
            params={
                "country": "Pakistan",
                "near_lat": 31.5497,
                "near_lng": 74.3436,
                "radius_km": 30,
                "limit": 1,
            },
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload["items"]), 1)
        self.assertEqual(payload["limit"], 1)
        self.assertIn("distance_km", payload["items"][0])

    def test_list_items_geo_does_not_load_unbounded_candidates(self):
        # Add many far items; geo path must still return quickly with a bounded find.
        for index in range(50):
            self.items_collection.documents.append(
                {
                    "_id": ObjectId(),
                    "title": f"Noise {index}",
                    "description": "Far noise listing",
                    "category": "Home",
                    "condition": "Good",
                    "location": "Karachi",
                    "country": "Pakistan",
                    "city": "Karachi",
                    "latitude": 24.8607,
                    "longitude": 67.0011,
                    "status": "available",
                    "owner_id": self.owner_id,
                    "owner_name": self.owner_user["name"],
                    "created_at": self.now,
                }
            )
        response = self.client.get(
            "/api/items",
            params={
                "near_lat": 31.5497,
                "near_lng": 74.3436,
                "radius_km": 20,
                "limit": 20,
            },
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        titles = [item["title"] for item in payload["items"]]
        self.assertTrue(all(not title.startswith("Noise ") for title in titles))
        self.assertIn("Pakistan Lamp", titles)

    def test_geo_candidate_cap_hit_logs_only_when_truncated(self):
        original_cap = items_routes.GEO_CANDIDATE_LIMIT
        try:
            # Below-cap path: default fixtures are far under the real cap.
            with self.assertNoLogs("app.api.routes.items", level="WARNING"):
                response = self.client.get(
                    "/api/items",
                    params={
                        "near_lat": 31.5497,
                        "near_lng": 74.3436,
                        "radius_km": 20,
                        "limit": 20,
                    },
                )
            self.assertEqual(response.status_code, 200)

            # At-cap path: shrink the imported route constant so few nearby docs trigger it.
            items_routes.GEO_CANDIDATE_LIMIT = 1
            for index in range(3):
                self.items_collection.documents.append(
                    {
                        "_id": ObjectId(),
                        "title": f"Nearby Cap {index}",
                        "description": "Extra Lahore listing for cap logging",
                        "category": "Home",
                        "condition": "Good",
                        "location": "Lahore",
                        "country": "Pakistan",
                        "city": "Lahore",
                        "latitude": 31.5497 + index * 0.001,
                        "longitude": 74.3436 + index * 0.001,
                        "status": "available",
                        "owner_id": self.owner_id,
                        "owner_name": self.owner_user["name"],
                        "created_at": self.now,
                    }
                )
            with self.assertLogs("app.api.routes.items", level="WARNING") as at_cap_logs:
                response = self.client.get(
                    "/api/items",
                    params={
                        "near_lat": 31.5497,
                        "near_lng": 74.3436,
                        "radius_km": 20,
                        "limit": 20,
                    },
                )
            self.assertEqual(response.status_code, 200)
            self.assertTrue(
                any("geo_candidate_cap_hit" in message for message in at_cap_logs.output),
                at_cap_logs.output,
            )
        finally:
            items_routes.GEO_CANDIDATE_LIMIT = original_cap
