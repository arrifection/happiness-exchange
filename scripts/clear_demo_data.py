"""
Remove demo, test, and smoke-test data from MongoDB.

Safe by default: runs in dry-run mode unless --execute is passed.
Never deletes users marked is_seed_account=True (your super_admin seed account).

Usage (from project root with venv active):
    python scripts/clear_demo_data.py              # preview what would be deleted
    python scripts/clear_demo_data.py --execute    # actually delete

Optional:
    python scripts/clear_demo_data.py --execute --verbose
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

DEMO_EMAILS = {
    "demo@happinessexchange.com",
    "demo_admin@happinessexchange.com",
    "admin@localhost.com",
}

DEMO_EMAIL_PATTERNS = [
    re.compile(r"^demo@", re.I),
    re.compile(r"^test_", re.I),
    re.compile(r"@example\.com$", re.I),
]

DEMO_TITLE_PATTERNS = [
    re.compile(r"^(smoke test|demo |test item|sample )", re.I),
    re.compile(r"\b(smoke test|demo listing|test listing)\b", re.I),
]


def is_protected_user(doc: dict) -> bool:
    if doc.get("is_seed_account"):
        return True
    role = doc.get("role")
    if role == "super_admin" and not doc.get("is_demo") and not doc.get("is_test"):
        return True
    return False


def is_demo_user(doc: dict) -> bool:
    if is_protected_user(doc):
        return False
    if doc.get("is_demo") or doc.get("is_test"):
        return True
    email = (doc.get("email") or "").strip().lower()
    if email in DEMO_EMAILS:
        return True
    if doc.get("username") in {"demo_admin", "test_user", "smoke_test_user"}:
        return True
    return any(p.search(email) for p in DEMO_EMAIL_PATTERNS)


def is_demo_item(doc: dict) -> bool:
    if doc.get("is_demo") or doc.get("is_test"):
        return True
    title = doc.get("title") or doc.get("name") or ""
    return any(p.search(title) for p in DEMO_TITLE_PATTERNS)


def is_demo_doc(doc: dict) -> bool:
    if doc.get("is_demo") or doc.get("is_test"):
        return True
    for field in ("title", "name", "description", "type", "message"):
        value = doc.get(field)
        if isinstance(value, str) and any(p.search(value) for p in DEMO_TITLE_PATTERNS):
            return True
    return False


async def clear_demo_data(execute: bool = False, verbose: bool = False) -> None:
    await connect_to_mongo()
    db = await get_db_async()
    if db is None:
        print("ERROR: Could not connect to the database.")
        sys.exit(1)

    demo_user_ids: set[str] = set()
    users = await db.users.find({}).to_list(length=10_000)
    demo_users = [u for u in users if is_demo_user(u)]
    for u in demo_users:
        demo_user_ids.add(str(u["_id"]))

    plan: list[tuple[str, dict, int]] = []

    if demo_users:
        plan.append(("users", {"_id": {"$in": [u["_id"] for u in demo_users]}}, len(demo_users)))

    demo_items = [i async for i in db.items.find({}) if is_demo_item(i)]
    if demo_items:
        plan.append(("items", {"_id": {"$in": [i["_id"] for i in demo_items]}}, len(demo_items)))

    for collection in ("requests", "reviews", "conversations", "notifications", "deliveries"):
        docs = await db[collection].find({}).to_list(length=10_000)
        demo_docs = [d for d in docs if is_demo_doc(d)]
        if demo_docs:
            plan.append((collection, {"_id": {"$in": [d["_id"] for d in demo_docs]}}, len(demo_docs)))

    reports = await db.admin_reports.find({}).to_list(length=10_000)
    demo_reports = [r for r in reports if is_demo_doc(r)]
    if demo_reports:
        plan.append(("admin_reports", {"_id": {"$in": [r["_id"] for r in demo_reports]}}, len(demo_reports)))

    if demo_user_ids:
        user_linked = {"user_id": {"$in": list(demo_user_ids)}}
        for collection in ("notifications", "requests", "reviews"):
            count = await db[collection].count_documents(user_linked)
            if count:
                plan.append((f"{collection} (by demo user)", user_linked, count))

    if not plan:
        print("No demo/test documents matched. Database is clean.")
        await close_mongo_connection()
        return

    print("=== Demo data cleanup plan ===")
    total = 0
    for label, _query, count in plan:
        total += count
        print(f"  {label}: {count}")
        if verbose:
            print(f"    filter: {_query}")
    print(f"Total documents: {total}")

    if not execute:
        print("\nDry run only. Re-run with --execute to delete.")
        await close_mongo_connection()
        return

    print("\nDeleting…")
    for label, query, _ in plan:
        if label.endswith("(by demo user)"):
            collection = label.split(" ")[0]
        else:
            collection = label
        result = await db[collection].delete_many(query)
        print(f"  {collection}: deleted {result.deleted_count}")

    print("\nDone.")
    await close_mongo_connection()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Remove demo/test data from MongoDB.")
    parser.add_argument("--execute", action="store_true", help="Actually delete matched documents.")
    parser.add_argument("--verbose", action="store_true", help="Show query filters.")
    args = parser.parse_args()
    asyncio.run(clear_demo_data(execute=args.execute, verbose=args.verbose))
