#!/usr/bin/env python3
"""Create local demo shipments for User A / User B so tracking can be opened immediately."""

from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv()

from seed_helpers import assert_seed_database_allowed
from seed_local_users import DEFAULT_USER_A, DEFAULT_USER_B, guard_local_seed

from app.db.mongodb import close_mongo_connection, connect_to_mongo, get_exchange_shipping_collection_async, get_users_collection_async
from app.services.exchange_shipping import build_shipping_document
from app.services.encryption import encrypt_text


async def seed() -> None:
    guard_local_seed()
    assert_seed_database_allowed()
    await connect_to_mongo()
    users = await get_users_collection_async()
    shipping = await get_exchange_shipping_collection_async()
    if users is None or shipping is None:
        raise SystemExit("ERROR: Could not connect to local MongoDB.")

    user_a = await users.find_one({"email": DEFAULT_USER_A["email"]})
    user_b = await users.find_one({"email": DEFAULT_USER_B["email"]})
    if not user_a or not user_b:
        raise SystemExit("ERROR: Seed dummy users first: python scripts/seed_local_users.py")

    demo_id = "local-demo-exchange"
    await shipping.delete_many({"transaction_id": demo_id})
    now = datetime.now(timezone.utc)
    eta = now + timedelta(days=3)

    shipment_a = build_shipping_document(
        exchange_transaction_id=demo_id,
        sender_user_id=str(user_a["_id"]),
        sender_user_name=user_a.get("name") or "Local User A",
        receiver_user_id=str(user_b["_id"]),
        receiver_user_name=user_b.get("name") or "Local User B",
        transaction_type="EXCHANGE",
        item_title="Nike Shoes",
    )
    shipment_a.update({
        "shipping_status": "in_transit",
        "status": "IN_TRANSIT",
        "payment_status": "paid",
        "carrier": "DHL",
        "tracking_number": "DHLLOCAL001",
        "tracking_url": "https://www.dhl.com/en/express/tracking.html?AWB=DHLLOCAL001",
        "estimated_delivery": eta,
        "shipped_at": now,
        "encrypted_full_name": encrypt_text("Local User A"),
        "encrypted_phone_number": encrypt_text("+923001111111"),
        "encrypted_address_line1": encrypt_text("12 Demo Street"),
        "encrypted_city": encrypt_text("Karachi"),
        "encrypted_postal_code": encrypt_text("74000"),
        "encrypted_country": encrypt_text("PK"),
    })
    shipment_b = build_shipping_document(
        exchange_transaction_id=demo_id,
        sender_user_id=str(user_b["_id"]),
        sender_user_name=user_b.get("name") or "Local User B",
        receiver_user_id=str(user_a["_id"]),
        receiver_user_name=user_a.get("name") or "Local User A",
        transaction_type="EXCHANGE",
        item_title="Leather Jacket",
    )
    shipment_b.update({
        "shipping_status": "out_for_delivery",
        "status": "OUT_FOR_DELIVERY",
        "payment_status": "paid",
        "carrier": "TCS",
        "tracking_number": "TCSLOCAL002",
        "estimated_delivery": eta,
        "shipped_at": now,
        "encrypted_full_name": encrypt_text("Local User B"),
        "encrypted_phone_number": encrypt_text("+923002222222"),
        "encrypted_address_line1": encrypt_text("88 Partner Avenue"),
        "encrypted_city": encrypt_text("Lahore"),
        "encrypted_postal_code": encrypt_text("54000"),
        "encrypted_country": encrypt_text("PK"),
    })
    giveaway_id = "local-demo-giveaway"
    await shipping.delete_many({"transaction_id": giveaway_id})
    giveaway = build_shipping_document(
        exchange_transaction_id=giveaway_id,
        sender_user_id=str(user_b["_id"]),
        sender_user_name=user_b.get("name") or "Local User B",
        receiver_user_id=str(user_a["_id"]),
        receiver_user_name=user_a.get("name") or "Local User A",
        transaction_type="GIVEAWAY",
        item_title="Winter Blanket",
        payer_user_id=str(user_a["_id"]),
    )
    giveaway.update({
        "shipping_status": "in_transit",
        "status": "IN_TRANSIT",
        "payment_status": "paid",
        "carrier": "Leopards",
        "tracking_number": "LEOLOCAL003",
        "estimated_delivery": eta,
        "shipped_at": now,
        "encrypted_full_name": encrypt_text("Local User A"),
        "encrypted_phone_number": encrypt_text("+923001111111"),
        "encrypted_address_line1": encrypt_text("12 Demo Street"),
        "encrypted_city": encrypt_text("Karachi"),
        "encrypted_postal_code": encrypt_text("74000"),
        "encrypted_country": encrypt_text("PK"),
    })
    result = await shipping.insert_many([shipment_a, shipment_b, giveaway])
    print("Created local demo shipments. Log in as User A, then open Delivery:")
    print("  http://localhost:5173/deliveries")
    print("  http://localhost:5174/deliveries")
    print(f"  Exchange Nike Shoes:     http://localhost:5173/tracking/{result.inserted_ids[0]}")
    print(f"  Exchange Leather Jacket: http://localhost:5173/tracking/{result.inserted_ids[1]}")
    print(f"  Give Away Winter Blanket: http://localhost:5173/tracking/{result.inserted_ids[2]}")
    await close_mongo_connection()


if __name__ == "__main__":
    import asyncio

    asyncio.run(seed())
