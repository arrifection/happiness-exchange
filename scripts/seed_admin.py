"""
Seed script: creates the initial super_admin account.

Usage (run from project root with the venv active):
    # To create an admin:
    ADMIN_EMAIL=admin@yourdomain.com ADMIN_PASSWORD=SecurePass123! python scripts/seed_admin.py

    # To remove an admin:
    ADMIN_EMAIL=admin@yourdomain.com python scripts/seed_admin.py --remove

Note: 
    - The script loads `.env` automatically if present.
    - It is safe to use in production only if secure credentials are provided via environment variables.

IMPORTANT: Do NOT hardcode credentials here. Use environment variables.
"""
import os
from dotenv import load_dotenv
import argparse
import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path

# Allow running from project root without installing the package
sys.path.insert(0, str(Path(__file__).parent.parent))

# Load environment variables
load_dotenv()

from app.core.roles import UserRole
from app.db.mongodb import close_mongo_connection, connect_to_mongo, get_users_collection_async
from app.services.auth import hash_password

SEED_EMAIL    = os.getenv("ADMIN_EMAIL")
SEED_PASSWORD = os.getenv("ADMIN_PASSWORD")
SEED_NAME     = os.getenv("ADMIN_NAME", "Platform Admin")
SEED_ROLE     = UserRole.SUPER_ADMIN


async def seed_admin(remove: bool = False) -> None:
    if not SEED_EMAIL:
        print("ERROR: ADMIN_EMAIL environment variable must be set.")
        sys.exit(1)

    if not remove and not SEED_PASSWORD:
        print("ERROR: ADMIN_PASSWORD environment variable must be set to create an admin.")
        sys.exit(1)

    await connect_to_mongo()
    users_col = await get_users_collection_async()

    if users_col is None:
        print("ERROR: Could not connect to the database.")
        sys.exit(1)

    existing = await users_col.find_one({"email": SEED_EMAIL})

    # ── Remove mode ───────────────────────────────────────────────────────────
    if remove:
        if existing is None:
            print(f"INFO: Seed account '{SEED_EMAIL}' not found — nothing to remove.")
        else:
            await users_col.delete_one({"_id": existing["_id"]})
            print(f"✅  Seed account '{SEED_EMAIL}' removed successfully.")
        await close_mongo_connection()
        return

    # ── Seed mode ─────────────────────────────────────────────────────────────
    if existing is not None:
        print(f"INFO: Account '{SEED_EMAIL}' already exists.")
        current_role = existing.get("role", "user")
        if current_role != SEED_ROLE:
            await users_col.update_one(
                {"_id": existing["_id"]},
                {"$set": {"role": SEED_ROLE, "role_updated_at": datetime.now(timezone.utc)}},
            )
            print(f"  - Role updated from '{current_role}' to '{SEED_ROLE}'.")
        else:
            print(f"  - Role is already '{SEED_ROLE}'. No changes made.")
        await close_mongo_connection()
        return

    now = datetime.now(timezone.utc)
    doc = {
        "name":                        SEED_NAME,
        "name_normalized":             SEED_NAME.lower(),
        "email":                       SEED_EMAIL,
        "hashed_password":             hash_password(SEED_PASSWORD),
        "role":                        SEED_ROLE,
        "account_type":                "admin",
        "is_verified":                 True,    # Pre-verified — no email flow needed
        "is_banned":                   False,
        "is_seed_account":             True,    # Marker — makes it easy to find/remove
        "created_at":                  now,
        "updated_at":                  now,
    }
    result = await users_col.insert_one(doc)
    print(f"SUCCESS: Seed super_admin account created!")
    print(f"   ID:       {result.inserted_id}")
    print(f"   Email:    {SEED_EMAIL}")
    print(f"   Role:     {SEED_ROLE}")
    print()
    print("If you need to remove this account later, run:")
    print("   ADMIN_EMAIL=... python scripts/seed_admin.py --remove")

    await close_mongo_connection()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed or remove the test super_admin account.")
    parser.add_argument("--remove", action="store_true", help="Remove the seeded admin account.")
    args = parser.parse_args()
    asyncio.run(seed_admin(remove=args.remove))
