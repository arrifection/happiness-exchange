"""Delete a user and related data by email (for testing signup/verification again)."""
from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv

load_dotenv()

from app.db.mongodb import close_mongo_connection, connect_to_mongo, get_db_async
from app.services.account import delete_user_account


async def delete_user_by_email(email: str, *, execute: bool = False) -> None:
    normalized = email.strip().lower()
    await connect_to_mongo()
    db = await get_db_async()
    if db is None:
        print("ERROR: Could not connect to the database.")
        sys.exit(1)

    user = await db.users.find_one({"email": normalized})
    if user is None:
        print(f"No user found for {normalized}")
        await close_mongo_connection()
        return

    uid = str(user["_id"])
    print(f"Found: {user.get('name')} | verified={user.get('is_verified')} | id={uid}")

    if not execute:
        print("\nDry run — would delete user and all linked data.")
        print("Re-run with --execute to delete.")
        await close_mongo_connection()
        return

    deleted = await delete_user_account(uid)
    print("Account removed:" if deleted else "ERROR: delete failed", normalized)
    await close_mongo_connection()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("email")
    parser.add_argument("--execute", action="store_true")
    args = parser.parse_args()
    asyncio.run(delete_user_by_email(args.email, execute=args.execute))
