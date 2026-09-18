from datetime import datetime, timedelta, timezone
from unittest import IsolatedAsyncioTestCase

from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import auth as auth_deps
from app.api.routes import items as items_routes
from app.services.listing_expiration import (
    LISTING_ACTIVE_DAYS,
    active_listings_mongo_clause,
    compute_listing_expires_at,
    is_listing_expired,
    is_listing_publicly_active,
)


class ListingExpirationTests(IsolatedAsyncioTestCase):
    def test_compute_listing_expires_at_still_returns_timestamp(self):
        created = datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc)
        expires = compute_listing_expires_at(created)
        self.assertEqual(expires, created + timedelta(days=LISTING_ACTIVE_DAYS))

    def test_listings_never_expire(self):
        created = datetime.now(timezone.utc) - timedelta(days=400)
        item = {"created_at": created, "status": "available"}
        self.assertFalse(is_listing_expired(item))
        self.assertTrue(is_listing_publicly_active(item))
        self.assertFalse(is_listing_publicly_active({"status": "completed"}))

    def test_active_listings_mongo_clause_is_empty(self):
        self.assertEqual(active_listings_mongo_clause(), {})

    def test_renew_endpoint_is_gone(self):
        owner_id = str(ObjectId())
        item_id = ObjectId()

        async def get_items_collection_async():
            return None

        items_routes.get_items_collection_async = get_items_collection_async

        app = FastAPI()
        app.include_router(items_routes.router, prefix="/api")
        app.dependency_overrides[auth_deps.get_verified_user] = lambda: {
            "id": owner_id,
            "name": "Owner",
            "email": "owner@example.com",
            "is_verified": True,
        }

        with TestClient(app) as client:
            response = client.post(f"/api/items/{item_id}/renew")

        self.assertEqual(response.status_code, 410)
        self.assertIn("do not expire", response.json()["detail"].lower())
