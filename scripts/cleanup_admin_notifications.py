"""
Remove admin/platform notifications from MongoDB.

By default: deletes admin-type notifications for non-staff users only
(staff = moderator, admin, super_admin — admin panel keeps its alerts).

Usage:
    python scripts/cleanup_admin_notifications.py              # dry run
    python scripts/cleanup_admin_notifications.py --execute    # delete
    python scripts/cleanup_admin_notifications.py --execute --all  # delete for everyone
"""

from __future__ import annotations

import argparse
import asyncio
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv

load_dotenv()

from app.db.mongodb import close_mongo_connection, connect_to_mongo, get_db_async

STAFF_ROLES = frozenset({"moderator", "admin", "super_admin"})

ADMIN_NOTIFICATION_TYPES = frozenset({
    "new_user_signup",
    "new_item_listed",
    "low_rating_review",
    "suspicious_activity",
    "delivery_match_created",
})

ADMIN_TITLE_PATTERNS = [
    re.compile(r"^new user signup$", re.I),
    re.compile(r"^new item listed$", re.I),
    re.compile(r"needs review", re.I),
    re.compile(r"has joined the platform", re.I),
    re.compile(r"suspicious activity", re.I),
]


def is_admin_notification(doc: dict) -> bool:
    type_ = str(doc.get("type") or "").lower()
    if type_ in ADMIN_NOTIFICATION_TYPES:
        return True
    if type_.endswith("_reported"):
        return True
    title = str(doc.get("title") or "").strip()
    return any(pattern.search(title) for pattern in ADMIN_TITLE_PATTERNS)


async def run(execute: bool, delete_all: bool) -> int:
    await connect_to_mongo()
    db = await get_db_async()
    if db is None:
        print("ERROR: Could not connect to MongoDB.")
        return 1

    notifications = db["notifications"]
    users = db["users"]

    staff_ids: set[str] = set()
    async for user in users.find({"role": {"$in": list(STAFF_ROLES)}}, {"_id": 1}):
        staff_ids.add(str(user["_id"]))

    to_delete: list[dict] = []
    async for doc in notifications.find({}):
        if not is_admin_notification(doc):
            continue
        user_id = str(doc.get("user_id") or "")
        if delete_all or user_id not in staff_ids:
            to_delete.append(doc)

    print(f"Found {len(to_delete)} admin/platform notification(s) to remove.")
    for doc in to_delete[:25]:
        print(
            f"  - {doc.get('_id')} | user={doc.get('user_id')} | "
            f"type={doc.get('type')!r} | title={doc.get('title')!r}"
        )
    if len(to_delete) > 25:
        print(f"  ... and {len(to_delete) - 25} more")

    if not execute:
        print("\nDry run only. Re-run with --execute to delete.")
        await close_mongo_connection()
        return 0

    if not to_delete:
        print("Nothing to delete.")
        await close_mongo_connection()
        return 0

    ids = [doc["_id"] for doc in to_delete]
    result = await notifications.delete_many({"_id": {"$in": ids}})
    print(f"\nDeleted {result.deleted_count} notification(s).")
    await close_mongo_connection()
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Remove admin/platform notifications from MongoDB.")
    parser.add_argument("--execute", action="store_true", help="Apply deletes (default is dry-run).")
    parser.add_argument(
        "--all",
        action="store_true",
        help="Also delete admin notifications for staff users (not just normal users).",
    )
    args = parser.parse_args()
    return asyncio.run(run(execute=args.execute, delete_all=args.all))


if __name__ == "__main__":
    raise SystemExit(main())
