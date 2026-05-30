#!/usr/bin/env python3
"""
Remove seeded test data tagged with is_test_data=True.

Dry run by default. Requires explicit:
    python scripts/clear_seed_data.py --execute

Never deletes:
    - users with is_seed_account=True
    - any document without is_test_data=True
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv()

from seed_helpers import assert_seed_database_allowed

from app.db.mongodb import close_mongo_connection, connect_to_mongo, get_db_async

COLLECTIONS_IN_DELETE_ORDER = [
    "messages",
    "conversations",
    "notifications",
    "reviews",
    "requests",
    "items",
    "users",
]


def _user_filter() -> dict:
    return {
        "is_test_data": True,
        "is_seed_account": {"$ne": True},
    }


async def clear_seed_data(*, execute: bool, allow_staging: bool, verbose: bool) -> None:
    assert_seed_database_allowed(allow_staging=allow_staging)

    await connect_to_mongo()
    db = await get_db_async()
    if db is None:
        raise SystemExit("ERROR: Could not connect to MongoDB.")

    plan: list[tuple[str, dict, int]] = []
    for collection in COLLECTIONS_IN_DELETE_ORDER:
        query = _user_filter() if collection == "users" else {"is_test_data": True}
        count = await db[collection].count_documents(query)
        if count:
            plan.append((collection, query, count))

    if not plan:
        print("No is_test_data records found. Nothing to delete.")
        await close_mongo_connection()
        return

    print("=== Seed cleanup plan (is_test_data=True only) ===")
    total = 0
    for collection, query, count in plan:
        total += count
        print(f"  {collection}: {count}")
        if verbose:
            print(f"    filter: {query}")
    print(f"Total documents: {total}")

    if not execute:
        print("\nDry run only. Re-run with --execute to delete.")
        await close_mongo_connection()
        return

    print("\nDeleting…")
    deleted_total = 0
    for collection, query, _ in plan:
        result = await db[collection].delete_many(query)
        deleted_total += result.deleted_count
        print(f"  {collection}: deleted {result.deleted_count}")

    token_file = Path(__file__).resolve().parent / ".seed" / "load_test_tokens.json"
    report_file = Path(__file__).resolve().parent / ".seed" / "seed_report.json"
    for path in (token_file, report_file):
        if path.exists():
            path.unlink()
            print(f"  removed file: {path}")

    print(f"\nDone. Deleted {deleted_total} documents.")
    await close_mongo_connection()


def main() -> int:
    parser = argparse.ArgumentParser(description="Clear seeded test data (is_test_data=True).")
    parser.add_argument("--execute", action="store_true", help="Required to delete records.")
    parser.add_argument(
        "--allow-staging",
        action="store_true",
        help="Allow non-local MongoDB when SEED_STAGING_CONFIRM=1 is set.",
    )
    parser.add_argument("--verbose", action="store_true", help="Print delete filters.")
    args = parser.parse_args()
    asyncio.run(clear_seed_data(execute=args.execute, allow_staging=args.allow_staging, verbose=args.verbose))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
