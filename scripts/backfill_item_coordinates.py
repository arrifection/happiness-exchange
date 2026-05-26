"""
Backfill missing latitude/longitude on item documents using city-center coordinates.

Safe by default: dry-run unless --execute is passed.

Usage:
    python scripts/backfill_item_coordinates.py
    python scripts/backfill_item_coordinates.py --execute
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv

load_dotenv()

from app.db.mongodb import close_mongo_connection, connect_to_mongo, get_db_async
from app.services.location import enrich_item_location, get_city_coordinates


async def run(execute: bool, verbose: bool) -> int:
    await connect_to_mongo()
    db = await get_db_async()
    if db is None:
        print("ERROR: Could not connect to MongoDB.")
        return 1

    items = db["items"]
    cursor = items.find(
        {
            "$or": [
                {"latitude": None},
                {"latitude": {"$exists": False}},
                {"longitude": None},
                {"longitude": {"$exists": False}},
            ]
        }
    )
    pending = []
    async for doc in cursor:
        enriched = enrich_item_location(doc)
        lat = enriched.get("latitude")
        lng = enriched.get("longitude")
        if lat is None or lng is None:
            if verbose:
                print(f"SKIP (no city coords): {doc.get('_id')} {doc.get('title')!r}")
            continue
        pending.append((doc["_id"], lat, lng, doc.get("title")))

    print(f"Found {len(pending)} item(s) to backfill.")
    for item_id, lat, lng, title in pending:
        print(f"  {item_id} {title!r} -> ({lat}, {lng})")

    if not execute:
        print("\nDry run only. Re-run with --execute to apply updates.")
        await close_mongo_connection()
        return 0

    updated = 0
    for item_id, lat, lng, _title in pending:
        result = await items.update_one(
            {"_id": item_id},
            {"$set": {"latitude": lat, "longitude": lng}},
        )
        if result.modified_count:
            updated += 1

    print(f"\nUpdated {updated} item(s).")
    await close_mongo_connection()
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Backfill item map coordinates from city centers.")
    parser.add_argument("--execute", action="store_true", help="Apply updates (default is dry-run).")
    parser.add_argument("--verbose", action="store_true", help="Log skipped items.")
    args = parser.parse_args()
    return asyncio.run(run(execute=args.execute, verbose=args.verbose))


if __name__ == "__main__":
    raise SystemExit(main())
