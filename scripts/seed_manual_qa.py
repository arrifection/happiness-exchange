#!/usr/bin/env python3
"""Seed local Mongo fixtures for manual QA of the uncommitted working tree.

LOCAL ONLY. Refuses non-localhost MongoDB. Does not modify application code.

Usage (from repo root, with local env overrides already applied):

    python scripts/seed_manual_qa.py
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

# Prefer the local manual override so we never seed Atlas from the root .env.
load_dotenv(ROOT / ".env.manual-local", override=True)
load_dotenv(ROOT / ".env", override=False)

from bson import ObjectId

from seed_helpers import assert_seed_database_allowed
from seed_local_users import DEFAULT_ADMIN, DEFAULT_USER_A, DEFAULT_USER_B, guard_local_seed

from app.core.roles import UserRole
from app.db.mongodb import close_mongo_connection, connect_to_mongo, get_db_async
from app.services.auth import hash_password, normalize_name
from app.services.encryption import encrypt_text
from app.services.exchange_shipping import build_shipping_document

QA_MARKER = "is_manual_qa"
QA_PREFIX = "ab" * 11  # 22 hex chars; + 2 suffix = ObjectId


def qa_oid(suffix: str) -> ObjectId:
    if len(suffix) != 2:
        raise ValueError("suffix must be 2 hex chars")
    return ObjectId(QA_PREFIX + suffix)


async def upsert_user(users, spec: dict, *, password: str) -> dict:
    now = datetime.now(timezone.utc)
    email = spec["email"].strip().lower()
    existing = await users.find_one({"email": email})
    doc = {
        "name": spec["name"],
        "name_normalized": normalize_name(spec["name"]),
        "email": email,
        "hashed_password": hash_password(password),
        "whatsapp_number": spec.get("whatsapp_number"),
        "role": spec.get("role", UserRole.USER),
        "account_type": spec.get("account_type", "member"),
        "is_verified": True,
        "is_banned": False,
        "country": "Pakistan",
        "updated_at": now,
        QA_MARKER: True,
    }
    if existing:
        await users.update_one({"_id": existing["_id"]}, {"$set": doc})
        existing.update(doc)
        return existing
    doc["_id"] = ObjectId()
    doc["created_at"] = now
    await users.insert_one(doc)
    return doc


async def seed() -> None:
    guard_local_seed()
    assert_seed_database_allowed()
    await connect_to_mongo()
    db = await get_db_async()
    if db is None:
        raise SystemExit("ERROR: Could not connect to local MongoDB.")

    users = db["users"]
    items = db["items"]
    requests = db["requests"]
    transactions = db["exchange_transactions"]
    shipping = db["exchange_shipping"]
    notifications = db["notifications"]

    # Wipe previous QA fixtures only (leave load-test / demo data alone).
    for col in (items, requests, transactions, shipping, notifications):
        await col.delete_many({QA_MARKER: True})

    user_a = await upsert_user(users, DEFAULT_USER_A, password=DEFAULT_USER_A["password"])
    user_b = await upsert_user(users, DEFAULT_USER_B, password=DEFAULT_USER_B["password"])
    admin = await upsert_user(users, DEFAULT_ADMIN, password=DEFAULT_ADMIN["password"])

    now = datetime.now(timezone.utc)
    old = now - timedelta(days=60)

    listings = [
        {
            "_id": qa_oid("01"),
            "title": "QA Giveaway Desk Chair",
            "description": "Sturdy desk chair for giveaway testing (city+image present).",
            "category": "Furniture",
            "condition": "Good",
            "status": "available",
            "listing_mode": "GIVEAWAY",
            "city": "Karachi",
            "location": "Karachi",
            "location_display": "Karachi, Pakistan",
            "image_url": "https://placehold.co/600x400/png?text=QA+Chair",
            "created_at": now - timedelta(days=2),
        },
        {
            "_id": qa_oid("02"),
            "title": "QA Exchange Textbook Bundle",
            "description": "Swap-only textbooks for exchange button-state testing.",
            "category": "Books",
            "condition": "Like New",
            "status": "available",
            "listing_mode": "EXCHANGE",
            "city": "Lahore",
            "location": "Lahore",
            "location_display": "Lahore, Pakistan",
            "image_url": "https://placehold.co/600x400/png?text=QA+Books",
            "created_at": now - timedelta(days=3),
        },
        {
            "_id": qa_oid("03"),
            "title": "QA Fallback Location Lamp",
            "description": "No city/image — admin should fall back to location_display.",
            "category": "Home",
            "condition": "Fair",
            "status": "available",
            "listing_mode": "GIVEAWAY",
            "location": "Gulshan-e-Iqbal",
            "location_display": "Gulshan-e-Iqbal, Karachi",
            "created_at": now - timedelta(days=5),
        },
        {
            "_id": qa_oid("04"),
            "title": "QA Would-Have-Expired Blanket",
            "description": "Created 60 days ago — under old 14-day expiry this would be gone; still active now.",
            "category": "Home",
            "condition": "Good",
            "status": "available",
            "listing_mode": "GIVEAWAY",
            "city": "Islamabad",
            "location": "Islamabad",
            "location_display": "Islamabad, Pakistan",
            "image_url": "https://placehold.co/600x400/png?text=QA+Old+Listing",
            "listing_expires_at": old + timedelta(days=14),
            "created_at": old,
        },
    ]

    item_docs = []
    for listing in listings:
        doc = {
            **listing,
            "owner_id": str(user_a["_id"]),
            "owner_name": user_a["name"],
            "updated_at": now,
            QA_MARKER: True,
            "country": "Pakistan",
        }
        item_docs.append(doc)
    await items.insert_many(item_docs)

    request_docs = [
        {
            "_id": qa_oid("11"),
            "item_id": str(listings[0]["_id"]),
            "item_title": listings[0]["title"],
            "item_image_url": listings[0]["image_url"],
            "requester_id": str(user_b["_id"]),
            "requester_name": user_b["name"],
            "requester_email": user_b["email"],
            "requester_city": "Lahore",
            "owner_id": str(user_a["_id"]),
            "owner_name": user_a["name"],
            "owner_email": user_a["email"],
            "reason": "Need a chair for remote work at home this month.",
            "status": "pending",
            "created_at": now - timedelta(hours=6),
            "updated_at": now - timedelta(hours=6),
            QA_MARKER: True,
        },
        {
            "_id": qa_oid("12"),
            "item_id": str(listings[3]["_id"]),
            "item_title": listings[3]["title"],
            "item_image_url": listings[3]["image_url"],
            "requester_id": str(user_b["_id"]),
            "requester_name": user_b["name"],
            "requester_email": user_b["email"],
            "requester_city": "Rawalpindi",
            "owner_id": str(user_a["_id"]),
            "owner_name": user_a["name"],
            "owner_email": user_a["email"],
            "reason": "Cold evenings and this blanket would help a lot.",
            "status": "pending",
            "created_at": now - timedelta(hours=2),
            "updated_at": now - timedelta(hours=2),
            QA_MARKER: True,
        },
        {
            "_id": qa_oid("13"),
            "item_id": str(listings[2]["_id"]),
            "item_title": listings[2]["title"],
            "requester_id": str(user_b["_id"]),
            "requester_name": user_b["name"],
            "requester_email": user_b["email"],
            # Intentionally omit requester_city — admin should show "—"
            "owner_id": str(user_a["_id"]),
            "owner_name": user_a["name"],
            "owner_email": user_a["email"],
            "reason": "Older request without a stored city for dash fallback.",
            "status": "pending",
            "created_at": now - timedelta(days=1),
            "updated_at": now - timedelta(days=1),
            QA_MARKER: True,
        },
    ]
    await requests.insert_many(request_docs)

    tx_docs = []
    for index in range(25):
        created = now - timedelta(minutes=index)
        tx_docs.append(
            {
                "_id": ObjectId(),
                "exchange_offer_id": str(ObjectId()),
                "listing_id": str(listings[1]["_id"]),
                "listing_title": f"QA Exchange Tx #{index + 1}",
                "user_a_id": str(user_a["_id"]),
                "user_a_name": user_a["name"],
                "user_b_id": str(user_b["_id"]),
                "user_b_name": user_b["name"],
                "status": "COLLECTING_SHIPPING" if index % 3 else "IN_TRANSIT",
                "created_at": created,
                "updated_at": created,
                "completed_at": None,
                QA_MARKER: True,
            }
        )
    await transactions.insert_many(tx_docs)

    shipment_docs = []
    for index, tx in enumerate(tx_docs[:5]):
        doc = build_shipping_document(
            exchange_transaction_id=str(tx["_id"]),
            sender_user_id=str(user_a["_id"]),
            sender_user_name=user_a["name"],
            receiver_user_id=str(user_b["_id"]),
            receiver_user_name=user_b["name"],
            transaction_type="EXCHANGE",
            item_title=tx["listing_title"],
        )
        doc.update(
            {
                QA_MARKER: True,
                "shipping_status": "in_transit",
                "status": "IN_TRANSIT",
                "payment_status": "paid",
                "carrier": "TCS",
                "tracking_number": f"QATCS{index + 1:04d}",
                "tracking_url": f"https://example.com/track/QATCS{index + 1:04d}",
                "encrypted_full_name": encrypt_text(user_a["name"]),
                "encrypted_phone_number": encrypt_text("+923001111111"),
                "encrypted_address_line1": encrypt_text("12 QA Street"),
                "encrypted_city": encrypt_text("Karachi"),
                "encrypted_postal_code": encrypt_text("74000"),
                "encrypted_country": encrypt_text("PK"),
                "updated_at": now - timedelta(minutes=index),
            }
        )
        shipment_docs.append(doc)
    await shipping.insert_many(shipment_docs)

    await notifications.insert_many(
        [
            {
                "_id": ObjectId(),
                "user_id": str(user_a["_id"]),
                "title": "QA: New request on your listing",
                "message": "Local User B requested QA Giveaway Desk Chair.",
                "type": "new_request",
                "is_read": False,
                "created_at": now,
                QA_MARKER: True,
            },
            {
                "_id": ObjectId(),
                "user_id": str(user_b["_id"]),
                "title": "QA: Welcome to manual testing",
                "message": "Use this account to request and swap.",
                "type": "system",
                "is_read": False,
                "created_at": now,
                QA_MARKER: True,
            },
        ]
    )

    print("=== Manual QA seed complete ===")
    print(f"DB: {db.name}")
    print(f"Admin: {admin['email']} / {DEFAULT_ADMIN['password']}")
    print(f"User A: {user_a['email']} / {DEFAULT_USER_A['password']}")
    print(f"User B: {user_b['email']} / {DEFAULT_USER_B['password']}")
    print(f"Giveaway listing id: {listings[0]['_id']}")
    print(f"Exchange listing id: {listings[1]['_id']}")
    print(f"Fallback (no city/image) listing id: {listings[2]['_id']}")
    print(f"Old (would-have-expired) listing id: {listings[3]['_id']}")
    print(f"Requests with requester_city: 2 (+ 1 without)")
    print(f"Exchange transactions: {len(tx_docs)}")
    print(f"Shipments: {len(shipment_docs)}")
    await close_mongo_connection()


if __name__ == "__main__":
    import asyncio

    asyncio.run(seed())
