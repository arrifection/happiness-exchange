# Run once manually after deployment. Safe to re-run (idempotent).
"""
Backfill missing completed_donation trust events for exchanges completed before
commit 6ecb439 (when award_completed_donation was broken).

Note: In this schema, completed exchanges are items with status "completed".
award_completed_donation awards +10 points to the item owner (lister/giver) only,
with reference_id=item_id and event_type="completed_donation".

Usage:
    python scripts/backfill_trust_scores.py              # dry-run (default)
    python scripts/backfill_trust_scores.py --execute  # apply writes
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv

load_dotenv()

from pymongo.errors import DuplicateKeyError

from app.db.mongodb import close_mongo_connection, connect_to_mongo, get_db_async
from app.services.trust import recalculate_user_trust_score

COMPLETED_DONATION_TYPE = "completed_donation"
COMPLETED_DONATION_POINTS = 10
COMPLETED_DONATION_DESCRIPTION = "Successfully completed a donation exchange."


async def trust_event_exists(trust_events, *, user_id: str, item_id: str) -> bool:
    existing = await trust_events.find_one(
        {
            "user_id": user_id,
            "event_type": COMPLETED_DONATION_TYPE,
            "reference_id": item_id,
        }
    )
    return existing is not None


async def run(*, execute: bool, verbose: bool) -> int:
    await connect_to_mongo()
    db = await get_db_async()
    if db is None:
        print("ERROR: Could not connect to MongoDB.")
        return 1

    items = db["items"]
    trust_events = db["trust_events"]
    users = db["users"]

    completed_items = await items.find({"status": "completed"}).to_list(length=None)
    scanned = len(completed_items)

    users_needing_backfill: set[str] = set()
    users_skipped: set[str] = set()
    events_to_insert: list[dict] = []

    for item in completed_items:
        owner_id = str(item.get("owner_id") or "")
        item_id = str(item["_id"])
        if not owner_id:
            if verbose:
                print(f"SKIP (no owner): item {item_id}")
            continue

        if await trust_event_exists(trust_events, user_id=owner_id, item_id=item_id):
            users_skipped.add(owner_id)
            continue

        users_needing_backfill.add(owner_id)
        events_to_insert.append(
            {
                "user_id": owner_id,
                "event_type": COMPLETED_DONATION_TYPE,
                "points_change": COMPLETED_DONATION_POINTS,
                "reference_id": item_id,
                "description": COMPLETED_DONATION_DESCRIPTION,
                "created_at": item.get("updated_at") or item.get("created_at") or datetime.now(timezone.utc),
                "_item_title": item.get("title", ""),
            }
        )

    print("=== Trust score backfill summary ===")
    print(f"Completed items scanned: {scanned}")
    print(f"Users needing backfill: {len(users_needing_backfill)}")
    print(f"Trust events to insert: {len(events_to_insert)}")
    print(f"Users skipped (already correct): {len(users_skipped)}")

    if verbose or not execute:
        for event in events_to_insert:
            print(
                f"  INSERT user={event['user_id']} item={event['reference_id']} "
                f"(+{event['points_change']}) title={event['_item_title']!r}"
            )

    if not execute:
        print("\nDry run only. Re-run with --execute to apply inserts and recalculate scores.")
        await close_mongo_connection()
        return 0

    inserted = 0
    affected_users: set[str] = set()

    for event in events_to_insert:
        doc = {key: value for key, value in event.items() if not key.startswith("_")}
        try:
            await trust_events.insert_one(doc)
            inserted += 1
            affected_users.add(event["user_id"])
        except DuplicateKeyError:
            users_skipped.add(event["user_id"])
            continue

    scores_updated = 0
    for user_id in affected_users:
        await recalculate_user_trust_score(
            user_id,
            users_collection=users,
            trust_events_collection=trust_events,
        )
        scores_updated += 1

    print(f"Trust events inserted: {inserted}")
    print(f"Users whose scores were updated: {scores_updated}")
    print(f"Users skipped (already had events): {len(users_skipped)}")

    await close_mongo_connection()
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Backfill missing completed_donation trust events.")
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Apply inserts and recalculate trust scores (default is dry-run).",
    )
    parser.add_argument("--verbose", action="store_true", help="Print each planned insert.")
    args = parser.parse_args()
    dry_run = not args.execute
    if dry_run:
        print("Running in dry-run mode (no writes). Pass --execute to apply changes.\n")
    return asyncio.run(run(execute=args.execute, verbose=args.verbose))


if __name__ == "__main__":
    raise SystemExit(main())
