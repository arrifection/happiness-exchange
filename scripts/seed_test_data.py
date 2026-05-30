#!/usr/bin/env python3
"""
Development-only seed script for Happiness Exchange load testing.

NEVER runs automatically. Requires explicit:
    python scripts/seed_test_data.py --execute

Dry run (default):
    python scripts/seed_test_data.py

Safety:
    - Local MongoDB only by default (localhost / 127.0.0.1)
    - All records tagged is_test_data=True
    - Does not modify non-test records
"""

from __future__ import annotations

import argparse
import asyncio
import json
import random
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv()

from seed_helpers import (
    CATEGORIES,
    CONDITIONS,
    DESCRIPTIONS,
    ITEM_TITLES,
    SEED_PASSWORD,
    assert_seed_database_allowed,
    build_placeholder_image_url,
    make_seed_email,
    make_seed_username,
    pick_city_country,
    random_past_datetime,
    seed_batch_id,
)

from app.core.roles import UserRole
from app.db.mongodb import close_mongo_connection, connect_to_mongo, get_db_async
from app.services.auth import create_access_token, hash_password, normalize_name

SEED_DIR = Path(__file__).resolve().parent / ".seed"
TOKEN_FILE = SEED_DIR / "load_test_tokens.json"
REPORT_FILE = SEED_DIR / "seed_report.json"

TARGETS = {
    "users": 100,
    "items": 200,
    "requests": 500,
    "conversations": 100,
    "messages": 1000,
    "reviews": 50,
    "notifications": 200,
}


async def _existing_test_count(db, collection: str) -> int:
    return await db[collection].count_documents({"is_test_data": True})


async def seed_all(*, execute: bool, allow_staging: bool) -> dict:
    assert_seed_database_allowed(allow_staging=allow_staging)

    await connect_to_mongo()
    db = await get_db_async()
    if db is None:
        raise SystemExit("ERROR: Could not connect to MongoDB.")

    batch = seed_batch_id()
    rng = random.Random(42)

    existing = {
        name: await _existing_test_count(db, name if name != "users" else "users")
        for name in ["users", "items", "requests", "conversations", "messages", "reviews", "notifications"]
    }

    if any(existing.values()) and execute:
        print("WARNING: Existing is_test_data records found:")
        for name, count in existing.items():
            if count:
                print(f"  {name}: {count}")
        print("Run scripts/clear_seed_data.py --execute first for a clean seed.\n")

    plan = {**TARGETS, "batch_id": batch, "execute": execute}
    if not execute:
        print("=== Dry run — no writes will be performed ===")
        print(json.dumps(plan, indent=2))
        print("\nRe-run with --execute to insert test data.")
        await close_mongo_connection()
        return plan

    started = time.perf_counter()
    created = {key: 0 for key in TARGETS}

    # ── Users ────────────────────────────────────────────────────────────────
    user_docs = []
    user_ids: list[str] = []
    for idx in range(1, TARGETS["users"] + 1):
        created_at = random_past_datetime(90, rng)
        name = make_seed_username(idx)
        doc = {
            "name": name,
            "name_normalized": normalize_name(name),
            "email": make_seed_email(idx),
            "hashed_password": hash_password(SEED_PASSWORD),
            "role": UserRole.USER,
            "account_type": "member",
            "is_verified": True,
            "is_banned": False,
            "trust_score": rng.randint(0, 280),
            "created_at": created_at,
            "updated_at": created_at,
            "is_test_data": True,
            "seed_batch_id": batch,
        }
        user_docs.append(doc)

    user_result = await db.users.insert_many(user_docs)
    user_ids = [str(_id) for _id in user_result.inserted_ids]
    user_names = {uid: make_seed_username(index + 1) for index, uid in enumerate(user_ids)}
    created["users"] = len(user_ids)

    # ── Items ────────────────────────────────────────────────────────────────
    item_docs = []
    status_pool = (["available"] * 12 + ["reserved"] * 5 + ["completed"] * 3)
    for idx in range(TARGETS["items"]):
        owner_id = rng.choice(user_ids)
        owner_name = user_names[owner_id]
        category = rng.choice(CATEGORIES)
        country, city = pick_city_country(rng)
        title = rng.choice(ITEM_TITLES[category])
        created_at = random_past_datetime(90, rng)
        item_key = f"item-{idx:03d}"
        doc = {
            "title": f"{title} — {city}",
            "description": rng.choice(DESCRIPTIONS),
            "category": category,
            "condition": rng.choice(CONDITIONS),
            "location": f"{city}, {country}",
            "country": country,
            "city": city,
            "area": f"{city} area",
            "location_source": "manual",
            "location_display": f"{city}, {country}",
            "image_url": build_placeholder_image_url(item_key),
            "status": rng.choice(status_pool),
            "owner_id": owner_id,
            "owner_name": owner_name,
            "created_at": created_at,
            "is_test_data": True,
            "seed_batch_id": batch,
        }
        item_docs.append(doc)

    item_result = await db.items.insert_many(item_docs)
    item_records = list(zip([str(_id) for _id in item_result.inserted_ids], item_docs))
    created["items"] = len(item_records)

    items_by_id = {item_id: doc for item_id, doc in item_records}

    # ── Requests ─────────────────────────────────────────────────────────────
    pairs: list[tuple[str, str]] = []
    for item_id, doc in item_records:
        owner_id = doc["owner_id"]
        for requester_id in user_ids:
            if requester_id != owner_id:
                pairs.append((item_id, requester_id))
    rng.shuffle(pairs)
    selected_pairs = pairs[: TARGETS["requests"]]

    request_docs = []
    for idx, (item_id, requester_id) in enumerate(selected_pairs):
        item_doc = items_by_id[item_id]
        if idx < TARGETS["conversations"]:
            status = "approved"
        elif idx < TARGETS["conversations"] + 200:
            status = "pending"
        else:
            status = "rejected"
        requester_name = user_names[requester_id]
        request_docs.append(
            {
                "item_id": item_id,
                "item_title": item_doc["title"],
                "requester_id": requester_id,
                "requester_name": requester_name,
                "owner_id": item_doc["owner_id"],
                "owner_name": item_doc["owner_name"],
                "status": status,
                "created_at": random_past_datetime(90, rng),
                "is_test_data": True,
                "seed_batch_id": batch,
            }
        )

    request_result = await db.requests.insert_many(request_docs)
    request_records = list(zip([str(_id) for _id in request_result.inserted_ids], request_docs))
    created["requests"] = len(request_records)

    approved_requests = [(rid, doc) for rid, doc in request_records if doc["status"] == "approved"][
        : TARGETS["conversations"]
    ]

    # ── Conversations ────────────────────────────────────────────────────────
    conversation_docs = []
    for request_id, req in approved_requests:
        conversation_docs.append(
            {
                "item_id": req["item_id"],
                "item_title": req["item_title"],
                "giver_id": req["owner_id"],
                "giver_name": req["owner_name"],
                "receiver_id": req["requester_id"],
                "receiver_name": req["requester_name"],
                "request_id": request_id,
                "created_at": req["created_at"],
                "last_message_at": req["created_at"],
                "last_message_text": "Thanks for approving my request.",
                "unread_counts": {req["owner_id"]: 0, req["requester_id"]: 0},
                "is_flagged": False,
                "is_test_data": True,
                "seed_batch_id": batch,
            }
        )

    conv_result = await db.conversations.insert_many(conversation_docs)
    conv_records = list(zip([str(_id) for _id in conv_result.inserted_ids], conversation_docs))
    created["conversations"] = len(conv_records)

    # ── Messages ─────────────────────────────────────────────────────────────
    message_samples = [
        "Assalam o Alaikum, is this still available?",
        "Thank you — when would pickup work for you?",
        "I can meet near the main market this weekend.",
        "That time works for me.",
        "JazakAllah khair for sharing this item.",
    ]
    message_docs = []
    for conv_id, conv in conv_records:
        per_conv = TARGETS["messages"] // max(1, len(conv_records))
        participants = [
            (conv["giver_id"], conv["giver_name"]),
            (conv["receiver_id"], conv["receiver_name"]),
        ]
        for msg_idx in range(per_conv):
            sender_id, sender_name = participants[msg_idx % 2]
            created_at = random_past_datetime(60, rng)
            message_docs.append(
                {
                    "conversation_id": conv_id,
                    "sender_id": sender_id,
                    "sender_name": sender_name,
                    "text": rng.choice(message_samples),
                    "message_type": "text",
                    "image_url": None,
                    "created_at": created_at,
                    "read": rng.choice([True, False]),
                    "is_test_data": True,
                    "seed_batch_id": batch,
                }
            )

    while len(message_docs) < TARGETS["messages"]:
        conv_id, conv = rng.choice(conv_records)
        sender_id, sender_name = rng.choice(
            [(conv["giver_id"], conv["giver_name"]), (conv["receiver_id"], conv["receiver_name"])]
        )
        message_docs.append(
            {
                "conversation_id": conv_id,
                "sender_id": sender_id,
                "sender_name": sender_name,
                "text": rng.choice(message_samples),
                "message_type": "text",
                "image_url": None,
                "created_at": random_past_datetime(60, rng),
                "read": rng.choice([True, False]),
                "is_test_data": True,
                "seed_batch_id": batch,
            }
        )

    message_docs = message_docs[: TARGETS["messages"]]
    if message_docs:
        msg_result = await db.messages.insert_many(message_docs)
        created["messages"] = len(msg_result.inserted_ids)

    # ── Reviews ──────────────────────────────────────────────────────────────
    completed_items = [(iid, doc) for iid, doc in item_records if doc["status"] == "completed"]
    review_docs = []
    used_review_pairs: set[tuple[str, str]] = set()
    for item_id, item_doc in completed_items:
        if len(review_docs) >= TARGETS["reviews"]:
            break
        owner_id = item_doc["owner_id"]
        candidates = [uid for uid in user_ids if uid != owner_id]
        reviewer_id = rng.choice(candidates)
        pair_key = (item_id, reviewer_id)
        if pair_key in used_review_pairs:
            continue
        used_review_pairs.add(pair_key)
        review_docs.append(
            {
                "item_id": item_id,
                "request_id": None,
                "item_title": item_doc["title"],
                "reviewer_id": reviewer_id,
                "reviewer_name": user_names[reviewer_id],
                "reviewed_user_id": owner_id,
                "rating": rng.randint(3, 5),
                "comment": rng.choice(
                    [
                        "Smooth and respectful exchange.",
                        "Item matched the description. Very kind giver.",
                        "Pickup was easy and the item helped our family.",
                    ]
                ),
                "created_at": random_past_datetime(90, rng),
                "is_test_data": True,
                "seed_batch_id": batch,
            }
        )

    while len(review_docs) < TARGETS["reviews"]:
        item_id, item_doc = rng.choice(item_records)
        reviewer_id = rng.choice([uid for uid in user_ids if uid != item_doc["owner_id"]])
        pair_key = (item_id, reviewer_id)
        if pair_key in used_review_pairs:
            continue
        used_review_pairs.add(pair_key)
        review_docs.append(
            {
                "item_id": item_id,
                "request_id": None,
                "item_title": item_doc["title"],
                "reviewer_id": reviewer_id,
                "reviewer_name": user_names[reviewer_id],
                "reviewed_user_id": item_doc["owner_id"],
                "rating": rng.randint(1, 5),
                "comment": "Test review generated for load testing.",
                "created_at": random_past_datetime(90, rng),
                "is_test_data": True,
                "seed_batch_id": batch,
            }
        )

    review_docs = review_docs[: TARGETS["reviews"]]
    if review_docs:
        review_result = await db.reviews.insert_many(review_docs)
        created["reviews"] = len(review_result.inserted_ids)

    # ── Notifications ────────────────────────────────────────────────────────
    notification_types = [
        ("request_received", "New request on your item"),
        ("request_approved", "Your request was approved"),
        ("new_message", "You have a new message"),
        ("review_received", "You received a new review"),
    ]
    notification_docs = []
    for _ in range(TARGETS["notifications"]):
        user_id = rng.choice(user_ids)
        type_, title = rng.choice(notification_types)
        notification_docs.append(
            {
                "user_id": user_id,
                "title": title,
                "message": "Generated seed notification for load testing.",
                "type": type_,
                "action_url": "/requests",
                "read": rng.choice([True, False]),
                "created_at": random_past_datetime(90, rng),
                "is_test_data": True,
                "seed_batch_id": batch,
            }
        )

    notif_result = await db.notifications.insert_many(notification_docs)
    created["notifications"] = len(notif_result.inserted_ids)

    elapsed = round(time.perf_counter() - started, 2)

    # ── Verification queries ─────────────────────────────────────────────────
    sample_queries = {}
    t0 = time.perf_counter()
    sample_queries["available_items_pk"] = await db.items.count_documents(
        {"is_test_data": True, "status": "available", "country": "Pakistan"}
    )
    sample_queries["available_items_pk_ms"] = round((time.perf_counter() - t0) * 1000, 2)

    t0 = time.perf_counter()
    sample_queries["pending_requests"] = await db.requests.count_documents(
        {"is_test_data": True, "status": "pending"}
    )
    sample_queries["pending_requests_ms"] = round((time.perf_counter() - t0) * 1000, 2)

    t0 = time.perf_counter()
    sample_user = user_ids[0]
    sample_queries["unread_notifications"] = await db.notifications.count_documents(
        {"is_test_data": True, "user_id": sample_user, "read": False}
    )
    sample_queries["unread_notifications_ms"] = round((time.perf_counter() - t0) * 1000, 2)

    index_counts = {}
    for collection in ["users", "items", "requests", "conversations", "messages", "notifications", "reviews"]:
        indexes = await db[collection].index_information()
        index_counts[collection] = len(indexes)

    # ── Token file for load tests ────────────────────────────────────────────
    SEED_DIR.mkdir(parents=True, exist_ok=True)
    tokens = []
    for idx, user_id in enumerate(user_ids[: min(100, len(user_ids))], start=1):
        email = make_seed_email(idx)
        tokens.append(
            {
                "user_id": user_id,
                "email": email,
                "token": create_access_token(user_id, email, UserRole.USER),
            }
        )
    TOKEN_FILE.write_text(json.dumps(tokens, indent=2), encoding="utf-8")

    estimated_bytes = (
        created["users"] * 900
        + created["items"] * 1200
        + created["requests"] * 500
        + created["conversations"] * 700
        + created["messages"] * 350
        + created["reviews"] * 450
        + created["notifications"] * 300
    )

    report = {
        "batch_id": batch,
        "created": created,
        "elapsed_seconds": elapsed,
        "sample_queries": sample_queries,
        "index_counts": index_counts,
        "estimated_storage_bytes": estimated_bytes,
        "estimated_storage_mb": round(estimated_bytes / (1024 * 1024), 2),
        "test_login": {
            "email": make_seed_email(1),
            "password": SEED_PASSWORD,
        },
        "token_file": str(TOKEN_FILE),
    }
    REPORT_FILE.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print("=== Seed complete ===")
    for key, value in created.items():
        print(f"  {key}: {value}")
    print(f"\nBatch: {batch}")
    print(f"Elapsed: {elapsed}s")
    print(f"Estimated added storage: ~{report['estimated_storage_mb']} MB")
    print("\nSample queries:")
    for key, value in sample_queries.items():
        if not key.endswith("_ms"):
            ms_key = f"{key}_ms"
            print(f"  {key}: {value} ({sample_queries.get(ms_key, '?')} ms)")
    print("\nIndexes present:")
    for collection, count in index_counts.items():
        print(f"  {collection}: {count}")
    print(f"\nLoad-test tokens written to: {TOKEN_FILE}")
    print(f"Report written to: {REPORT_FILE}")
    print(f"\nTest login: {make_seed_email(1)} / {SEED_PASSWORD}")

    await close_mongo_connection()
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed development test data for Happiness Exchange.")
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Required to write data. Without this flag the script dry-runs only.",
    )
    parser.add_argument(
        "--allow-staging",
        action="store_true",
        help="Allow non-local MongoDB when SEED_STAGING_CONFIRM=1 is set.",
    )
    args = parser.parse_args()

    asyncio.run(seed_all(execute=args.execute, allow_staging=args.allow_staging))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
