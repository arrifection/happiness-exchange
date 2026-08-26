#!/usr/bin/env python3
"""Seed the local demo/testing sandbox for Happiness Exchange.

LOCAL DEVELOPMENT ONLY. The script refuses to run when the process looks like
production (ENVIRONMENT=production/prod or a Hugging Face ``SPACE_ID``) or when
MongoDB points anywhere other than localhost.

Everything it writes is built with the real application document builders, so
the seeded rows behave exactly like rows created through the UI.

Usage (repo root, venv active, local MongoDB running):

    python scripts/demo_env.py            # wipe + reseed the demo sandbox
    python scripts/demo_env.py --clear    # remove the demo sandbox only
    python scripts/demo_env.py --summary  # print what is currently seeded
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(Path(__file__).parent) not in sys.path:
    sys.path.insert(0, str(Path(__file__).parent))
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv()

from bson import ObjectId

from app.core.config import settings
from app.core.roles import UserRole
from app.core.runtime import is_production_environment
from app.db.mongodb import close_mongo_connection, connect_to_mongo, get_db_async
from app.schemas.exchange import ExchangeOfferCreateRequest
from app.schemas.items import ItemCreateRequest
from app.services.auth import hash_password
from app.services.exchange_offers import build_exchange_offer_document
from app.services.items import build_item_document
from app.services.requests import build_request_document

DEMO_MARKER = "is_local_demo"
DEMO_PASSWORD = os.getenv("LOCAL_DEMO_PASSWORD", "LocalDemo123!")
UPLOADS_DIR = ROOT / "uploads" / "items"

# Obviously fake but valid ObjectIds, so demo rows are easy to spot in Mongo
# and every reseed reuses the same ids (stable URLs while testing).
_ID_PREFIX = "de" * 11


class DemoSeedError(RuntimeError):
    """Raised when the sandbox cannot be seeded (guards, DB, or dataset)."""


def demo_object_id(suffix: str) -> ObjectId:
    if len(suffix) != 2:
        raise ValueError("Demo id suffix must be two hex characters.")
    return ObjectId(_ID_PREFIX + suffix)


DEMO_USERS = [
    {
        "key": "A",
        "_id": demo_object_id("a1"),
        "name": "Sarah Demo",
        "email": "sarah.demo@example.com",
        "whatsapp_number": "+923004440001",
        "city": "Karachi",
        "note": "User A — owns a Give Away and a Swap Only listing",
    },
    {
        "key": "B",
        "_id": demo_object_id("b2"),
        "name": "Muaaz Demo",
        "email": "muaaz.demo@example.com",
        "whatsapp_number": "+923004440002",
        "city": "Lahore",
        "note": "User B — requests Sarah's items and sends the swap offer",
    },
]

DEMO_LISTINGS = [
    {
        "key": "a-giveaway-jacket",
        "_id": demo_object_id("11"),
        "owner": "A",
        "title": "Blue Denim Jacket",
        "description": "Barely worn denim jacket, size M. Giving it away to someone who needs a warm layer.",
        "category": "Clothes",
        "condition": "Like New",
        "city": "Karachi",
        "listing_mode": "GIVEAWAY",
        "status": "available",
    },
    {
        "key": "a-swap-speaker",
        "_id": demo_object_id("12"),
        "owner": "A",
        "title": "Bluetooth Speaker",
        "description": "Loud little speaker with good battery life. Swap only — looking for books or study gear.",
        "category": "Home",
        "condition": "Good",
        "city": "Karachi",
        "listing_mode": "EXCHANGE",
        "status": "available",
    },
    {
        "key": "b-giveaway-earphones",
        "_id": demo_object_id("13"),
        "owner": "B",
        "title": "Wireless Earphones",
        "description": "Spare pair of wireless earphones. Free to a good home, charging case included.",
        "category": "Home",
        "condition": "Good",
        "city": "Lahore",
        "listing_mode": "GIVEAWAY",
        "status": "available",
    },
    {
        "key": "b-swap-books",
        "_id": demo_object_id("14"),
        "owner": "B",
        "title": "Study Books Bundle",
        "description": "Bundle of clean, complete study books. Swap only — happy to trade for something useful.",
        "category": "Books",
        "condition": "Good",
        "city": "Lahore",
        "listing_mode": "EXCHANGE",
        "status": "available",
    },
    {
        # Carries Sarah's already-approved request, so it is reserved exactly
        # like a listing the owner has accepted through the UI.
        "key": "b-giveaway-desk-lamp",
        "_id": demo_object_id("15"),
        "owner": "B",
        "title": "Study Desk Lamp",
        "description": "Adjustable desk lamp that still works perfectly. Already promised to another member.",
        "category": "Home",
        "condition": "Good",
        "city": "Lahore",
        "listing_mode": "GIVEAWAY",
        "status": "reserved",
    },
]

DEMO_REQUESTS = [
    {
        "key": "b-pending-on-a-giveaway",
        "_id": demo_object_id("21"),
        "listing": "a-giveaway-jacket",
        "requester": "B",
        "status": "pending",
        "reason": "Winters get cold here and I could really use a warm jacket for my commute.",
        "age_days": 1,
    },
    {
        # Swap-only request: created while the listing accepted give-aways and
        # left behind when the owner switched it to Swap Only. This is the state
        # the "Send Swap Offer" call to action on the request card exists for.
        "key": "b-pending-on-a-swap",
        "_id": demo_object_id("22"),
        "listing": "a-swap-speaker",
        "requester": "B",
        "status": "pending",
        "reason": "I would love this speaker for study sessions and can offer my books bundle in exchange.",
        "age_days": 2,
    },
    {
        "key": "a-approved-on-b-giveaway",
        "_id": demo_object_id("23"),
        "listing": "b-giveaway-desk-lamp",
        "requester": "A",
        "status": "approved",
        "reason": "My study corner has no light after sunset, this lamp would help a lot.",
        "age_days": 4,
    },
    {
        "key": "a-rejected-on-b-giveaway",
        "_id": demo_object_id("24"),
        "listing": "b-giveaway-earphones",
        "requester": "A",
        "status": "rejected",
        "reason": "My old earphones stopped working and I use them for online classes.",
        "age_days": 9,
    },
]

DEMO_OFFERS = [
    {
        "key": "b-offer-on-a-swap",
        "_id": demo_object_id("31"),
        "listing": "a-swap-speaker",
        "offered_listing": "b-swap-books",
        "offering_user": "B",
        "message": "Happy to trade my full study books bundle for your Bluetooth speaker if that works for you.",
        "age_days": 1,
    },
]


def guard_demo_environment() -> None:
    """Refuse anything that is not an obviously local development target."""
    if is_production_environment():
        raise DemoSeedError(
            "Refusing to seed the demo sandbox: this process looks like production "
            "(ENVIRONMENT=production/prod or SPACE_ID is set)."
        )

    uri = (os.environ.get("MONGODB_URI") or settings.MONGODB_URI or "").strip()
    if not uri:
        raise DemoSeedError("MONGODB_URI is not configured.")

    from urllib.parse import urlparse

    host = (urlparse(uri).hostname or "").lower()
    if host not in {"localhost", "127.0.0.1"}:
        raise DemoSeedError(
            f"Refusing non-local MongoDB host '{host or uri}'. "
            "The demo sandbox only runs against localhost."
        )


def image_base_url() -> str:
    configured = (
        os.getenv("LOCAL_DEMO_IMAGE_BASE_URL")
        or settings.PUBLIC_API_BASE_URL
        or "http://127.0.0.1:8000"
    )
    return configured.rstrip("/")


def write_demo_image(key: str, title: str) -> str:
    """Render a labelled placeholder PNG into the local uploads folder.

    Listing photos are served by the backend's existing /api/uploads/items
    mount, so the demo works with no network access and no Cloudinary keys.
    """
    from PIL import Image, ImageDraw

    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"demo-{key}.png"
    path = UPLOADS_DIR / filename

    image = Image.new("RGB", (640, 480), (245, 240, 232))
    draw = ImageDraw.Draw(image)
    draw.rectangle([(0, 0), (640, 96)], fill=(115, 64, 210))
    draw.text((24, 40), "HAPPINESS EXCHANGE · DEMO", fill=(255, 255, 255))

    words = title.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if len(candidate) > 22:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)

    for index, line in enumerate(lines):
        draw.text((24, 180 + index * 28), line, fill=(58, 32, 110))

    image.save(path, format="PNG")
    return f"{image_base_url()}/api/uploads/items/{filename}"


def build_demo_documents() -> dict[str, list[dict]]:
    """Build every demo document through the real application builders."""
    now = datetime.now(timezone.utc)
    users_by_key = {spec["key"]: spec for spec in DEMO_USERS}

    user_docs = []
    for spec in DEMO_USERS:
        user_docs.append(
            {
                "_id": spec["_id"],
                "name": spec["name"],
                "name_normalized": " ".join(spec["name"].strip().split()).lower(),
                "email": spec["email"],
                "whatsapp_number": spec["whatsapp_number"],
                "hashed_password": hash_password(DEMO_PASSWORD),
                "role": UserRole.USER,
                "account_type": "member",
                # Verified so the sandbox needs no email, OTP, or phone step.
                "is_verified": True,
                "is_banned": False,
                "country": "Pakistan",
                "city": spec["city"],
                # No trust events are seeded, so both accounts stay "New Member".
                "trust_score": 0,
                "created_at": now - timedelta(days=12),
                "updated_at": now,
                DEMO_MARKER: True,
                "local_demo_key": f"user-{spec['key'].lower()}",
            }
        )

    item_docs = []
    items_by_key: dict[str, dict] = {}
    for spec in DEMO_LISTINGS:
        owner = users_by_key[spec["owner"]]
        payload = ItemCreateRequest(
            title=spec["title"],
            description=spec["description"],
            category=spec["category"],
            condition=spec["condition"],
            location=spec["city"],
            country="Pakistan",
            city=spec["city"],
            image_url=write_demo_image(spec["key"], spec["title"]),
            listing_mode=spec["listing_mode"],
        )
        document = build_item_document(
            payload,
            {"id": str(owner["_id"]), "name": owner["name"]},
        )
        document["_id"] = spec["_id"]
        document["status"] = spec["status"]
        document["created_at"] = now - timedelta(days=6)
        document["updated_at"] = now
        document[DEMO_MARKER] = True
        document["local_demo_key"] = spec["key"]
        item_docs.append(document)
        items_by_key[spec["key"]] = document

    request_docs = []
    for spec in DEMO_REQUESTS:
        item = items_by_key[spec["listing"]]
        requester = users_by_key[spec["requester"]]
        document = build_request_document(
            item,
            {"id": str(requester["_id"]), "name": requester["name"]},
            reason=spec["reason"],
            requester_city=requester["city"],
        )
        document["_id"] = spec["_id"]
        document["status"] = spec["status"]
        document["created_at"] = now - timedelta(days=spec["age_days"])
        document[DEMO_MARKER] = True
        document["local_demo_key"] = spec["key"]
        request_docs.append(document)

    offer_docs = []
    for spec in DEMO_OFFERS:
        listing = items_by_key[spec["listing"]]
        offered = items_by_key[spec["offered_listing"]]
        offering_user = users_by_key[spec["offering_user"]]
        payload = ExchangeOfferCreateRequest(
            listing_id=str(listing["_id"]),
            offered_listing_id=str(offered["_id"]),
            message=spec["message"],
            offering_user_city=offering_user["city"],
        )
        document = build_exchange_offer_document(
            listing,
            {"id": str(offering_user["_id"]), "name": offering_user["name"]},
            payload,
        )
        document["_id"] = spec["_id"]
        document["created_at"] = now - timedelta(days=spec["age_days"])
        document["updated_at"] = now
        document[DEMO_MARKER] = True
        document["local_demo_key"] = spec["key"]
        offer_docs.append(document)

    return {
        "users": user_docs,
        "items": item_docs,
        "requests": request_docs,
        "exchange_offers": offer_docs,
    }


def _demo_user_ids() -> list[str]:
    return [str(spec["_id"]) for spec in DEMO_USERS]


async def clear_demo_environment(db) -> dict[str, int]:
    """Delete demo rows plus anything the demo users produced while testing."""
    user_object_ids = [spec["_id"] for spec in DEMO_USERS]
    user_ids = _demo_user_ids()
    emails = [spec["email"] for spec in DEMO_USERS]
    marker = {DEMO_MARKER: True}
    deleted: dict[str, int] = {}

    conversation_ids = [
        str(doc["_id"])
        async for doc in db.conversations.find(
            {
                "$or": [
                    marker,
                    {"member_id": {"$in": user_ids}},
                    {"giver_id": {"$in": user_ids}},
                    {"receiver_id": {"$in": user_ids}},
                ]
            },
            {"_id": 1},
        )
    ]
    if conversation_ids:
        deleted["messages"] = (
            await db.messages.delete_many({"conversation_id": {"$in": conversation_ids}})
        ).deleted_count

    plan: list[tuple[str, dict]] = [
        ("conversations", {"$or": [marker, {"member_id": {"$in": user_ids}}, {"giver_id": {"$in": user_ids}}, {"receiver_id": {"$in": user_ids}}]}),
        ("requests", {"$or": [marker, {"requester_id": {"$in": user_ids}}, {"owner_id": {"$in": user_ids}}]}),
        ("exchange_offers", {"$or": [marker, {"offering_user_id": {"$in": user_ids}}, {"owner_user_id": {"$in": user_ids}}]}),
        ("exchange_transactions", {"$or": [marker, {"user_a_id": {"$in": user_ids}}, {"user_b_id": {"$in": user_ids}}]}),
        ("exchange_shipping", {"$or": [marker, {"sender_user_id": {"$in": user_ids}}, {"receiver_user_id": {"$in": user_ids}}]}),
        ("deliveries", {"$or": [marker, {"giver_id": {"$in": user_ids}}, {"receiver_id": {"$in": user_ids}}]}),
        ("reviews", {"$or": [marker, {"reviewer_id": {"$in": user_ids}}, {"reviewed_user_id": {"$in": user_ids}}]}),
        ("need_requests", {"$or": [marker, {"created_by": {"$in": user_ids}}]}),
        ("notifications", {"$or": [marker, {"user_id": {"$in": user_ids}}]}),
        ("trust_events", {"$or": [marker, {"user_id": {"$in": user_ids}}]}),
        ("items", {"$or": [marker, {"owner_id": {"$in": user_ids}}]}),
        ("users", {"$or": [{"_id": {"$in": user_object_ids}}, {"email": {"$in": emails}}, marker]}),
    ]

    for collection, query in plan:
        deleted[collection] = (await db[collection].delete_many(query)).deleted_count

    return {name: count for name, count in deleted.items() if count}


async def seed_demo_environment(*, connect: bool = True) -> dict:
    """Reset the sandbox to its documented starting state."""
    guard_demo_environment()

    if connect:
        await connect_to_mongo()
    db = await get_db_async()
    if db is None:
        raise DemoSeedError("Could not connect to the local MongoDB instance.")

    documents = build_demo_documents()
    removed = await clear_demo_environment(db)

    inserted: dict[str, int] = {}
    for collection, docs in documents.items():
        if docs:
            result = await db[collection].insert_many(docs)
            inserted[collection] = len(result.inserted_ids)

    return {
        "removed": removed,
        "inserted": inserted,
        "users": [
            {
                "key": spec["key"],
                "id": str(spec["_id"]),
                "name": spec["name"],
                "email": spec["email"],
                "note": spec["note"],
            }
            for spec in DEMO_USERS
        ],
    }


async def summarize_demo_environment() -> dict[str, int]:
    guard_demo_environment()
    await connect_to_mongo()
    db = await get_db_async()
    if db is None:
        raise DemoSeedError("Could not connect to the local MongoDB instance.")
    counts = {}
    for collection in ("users", "items", "requests", "exchange_offers"):
        counts[collection] = await db[collection].count_documents({DEMO_MARKER: True})
    return counts


def print_report(result: dict) -> None:
    print("Demo sandbox reseeded (local MongoDB only).")
    print(f"  Database: {settings.DB_NAME}")
    print(f"  Removed:  {result['removed'] or 'nothing'}")
    print(f"  Inserted: {result['inserted']}")
    print()
    print("Sign in with one click from the login page or the dev bar — no email or OTP.")
    for user in result["users"]:
        print(f"  User {user['key']}: {user['name']} <{user['email']}> id={user['id']}")
        print(f"           {user['note']}")
    print()
    print(f"  Password fallback for the normal login form: {DEMO_PASSWORD}")
    print("  Frontend: http://localhost:5173/browse")


async def _main(args: argparse.Namespace) -> None:
    try:
        if args.summary:
            counts = await summarize_demo_environment()
            print(f"Demo documents currently seeded: {counts}")
            return
        if args.clear:
            guard_demo_environment()
            await connect_to_mongo()
            db = await get_db_async()
            if db is None:
                raise DemoSeedError("Could not connect to the local MongoDB instance.")
            removed = await clear_demo_environment(db)
            print(f"Demo sandbox cleared. Removed: {removed or 'nothing'}")
            return
        print_report(await seed_demo_environment())
    except DemoSeedError as exc:
        raise SystemExit(f"ERROR: {exc}")
    finally:
        await close_mongo_connection()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed the local demo sandbox.")
    parser.add_argument("--clear", action="store_true", help="Remove demo data without reseeding.")
    parser.add_argument("--summary", action="store_true", help="Print seeded demo document counts.")
    asyncio.run(_main(parser.parse_args()))
