#!/usr/bin/env python3
"""Create local Give Away listings owned by User B so User A can request them."""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv()

from seed_helpers import assert_seed_database_allowed, build_placeholder_image_url
from seed_local_users import DEFAULT_USER_A, DEFAULT_USER_B, guard_local_seed

from app.db.mongodb import (
    close_mongo_connection,
    connect_to_mongo,
    get_items_collection_async,
    get_users_collection_async,
)
from app.services.listing_expiration import compute_listing_expires_at
from app.services.location import build_item_location_payload

LOCAL_LISTING_TAG = "local-demo-listing"


async def seed() -> None:
    guard_local_seed()
    assert_seed_database_allowed()
    await connect_to_mongo()
    users = await get_users_collection_async()
    items = await get_items_collection_async()
    if users is None or items is None:
        raise SystemExit("ERROR: Could not connect to local MongoDB.")

    user_a = await users.find_one({"email": DEFAULT_USER_A["email"]})
    user_b = await users.find_one({"email": DEFAULT_USER_B["email"]})
    if not user_a or not user_b:
        raise SystemExit("ERROR: Seed dummy users first: python scripts/seed_local_users.py")

    now = datetime.now(timezone.utc)
    owner_b = {
        "id": str(user_b["_id"]),
        "name": user_b.get("name") or "Local User B",
    }

    listings = [
        {
            "local_demo_key": "giveaway-desk-lamp",
            "title": "Study Desk Lamp",
            "description": "Working desk lamp for late-night studying. Pickup or shipping after the request is approved.",
            "category": "Home",
            "condition": "Good",
            "location": "Lahore",
            "country": "Pakistan",
            "city": "Lahore",
            "listing_mode": "GIVEAWAY",
        },
        {
            "local_demo_key": "giveaway-kitchen-set",
            "title": "Kitchen Pan Set",
            "description": "Gently used non-stick pans. Listed so you can test the Give Away request city selector.",
            "category": "Kitchen",
            "condition": "Like New",
            "location": "Karachi",
            "country": "Pakistan",
            "city": "Karachi",
            "listing_mode": "GIVEAWAY",
        },
        {
            "local_demo_key": "exchange-jacket",
            "title": "Leather Jacket for Exchange",
            "description": "Local User A listed this for swap testing. User B can propose an exchange and must pick a city.",
            "category": "Clothes",
            "condition": "Good",
            "location": "Islamabad",
            "country": "Pakistan",
            "city": "Islamabad",
            "listing_mode": "EXCHANGE",
            "owner": {
                "id": str(user_a["_id"]),
                "name": user_a.get("name") or "Local User A",
            },
        },
    ]

    await items.delete_many({"local_demo_key": {"$exists": True}})
    inserted = []
    for spec in listings:
        owner = spec.pop("owner", owner_b)
        local_demo_key = spec.pop("local_demo_key")
        location_fields = build_item_location_payload(
            location=spec["location"],
            country=spec["country"],
            city=spec["city"],
        )
        document = {
            **spec,
            **location_fields,
            "image_url": build_placeholder_image_url(local_demo_key),
            "status": "available",
            "giveaway_paused": False,
            "active_exchange_offer_id": None,
            "owner_id": owner["id"],
            "owner_name": owner["name"],
            "created_at": now,
            "updated_at": now,
            "listing_expires_at": compute_listing_expires_at(now),
            "local_demo_key": local_demo_key,
            "is_local_demo": True,
        }
        result = await items.insert_one(document)
        inserted.append((document["title"], document["listing_mode"], result.inserted_id))

    print("Created local demo listings. Log in as User A to request a Give Away item:")
    print("  user-a@example.com / LocalTest123!")
    print("  Browse: http://localhost:5173/browse")
    for title, mode, item_id in inserted:
        print(f"  {mode} {title}: http://localhost:5173/items/{item_id}")
    await close_mongo_connection()


if __name__ == "__main__":
    import asyncio

    asyncio.run(seed())
