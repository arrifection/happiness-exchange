# Run once manually after deployment. Safe to re-run (idempotent).
"""
Backfill missing completed_donation trust events for exchanges completed before
award_completed_donation was restored.

Usage:
    python scripts/backfill_completed_donation_trust.py              # dry-run
    python scripts/backfill_completed_donation_trust.py --execute  # apply writes
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
from app.services.trust_backfill import apply_completed_donation_backfill, plan_completed_donation_backfill


async def run(*, execute: bool, verbose: bool) -> int:
    await connect_to_mongo()
    db = await get_db_async()
    if db is None:
        print("ERROR: Could not connect to MongoDB.")
        return 1

    report = await plan_completed_donation_backfill(db)

    print("=== Completed donation trust backfill ===")
    print(f"Total completed exchanges scanned: {report.completed_exchanges_scanned}")
    print(f"Total missing trust events: {report.missing_trust_events}")
    print(f"Users needing backfill: {report.users_needing_backfill}")
    print(f"Users already correct: {report.users_already_correct}")

    if verbose or not execute:
        for event in report.planned_events:
            print(
                f"  INSERT user={event['user_id']} item={event['reference_id']} "
                f"(+{event['points_change']}) title={event['_item_title']!r}"
            )

    if not execute:
        print("\nDry run only. Re-run with --execute to apply inserts and recalculate scores.")
        await close_mongo_connection()
        return 0

    report = await apply_completed_donation_backfill(db, report)
    print(f"Total trust events inserted: {report.events_inserted}")
    print(f"Users whose scores were updated: {report.users_scores_updated}")
    print(f"Users skipped (already had events): {report.users_already_correct}")

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
    if not args.execute:
        print("Running in dry-run mode (no writes). Pass --execute to apply changes.\n")
    return asyncio.run(run(execute=args.execute, verbose=args.verbose))


if __name__ == "__main__":
    raise SystemExit(main())
