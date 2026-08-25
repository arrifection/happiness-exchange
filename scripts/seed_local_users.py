#!/usr/bin/env python3
"""
Create local-only dummy users for Happiness Exchange development.

This script NEVER runs against production. It refuses:
  - ENVIRONMENT=production / prod
  - Hugging Face Spaces (SPACE_ID)
  - Non-local MongoDB URIs

Usage (from repo root, venv active):

    python scripts/seed_local_users.py

Credentials come from environment variables. Documented local defaults are
used only after the production/local-DB guards pass.

    LOCAL_USER_A_EMAIL / LOCAL_USER_A_PASSWORD
    LOCAL_USER_B_EMAIL / LOCAL_USER_B_PASSWORD
    LOCAL_ADMIN_EMAIL / LOCAL_ADMIN_PASSWORD   (optional admin panel account)
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv()

from seed_helpers import assert_seed_database_allowed

from app.core.roles import UserRole
from app.core.runtime import email_verification_bypass_enabled, is_production_environment
from app.db.mongodb import close_mongo_connection, connect_to_mongo, get_users_collection_async
from app.services.auth import hash_password, verify_password

# Documented local-only dummy credentials. Override with env vars.
DEFAULT_USER_A = {
    "key": "A",
    "name": "Local User A",
    "email": "user-a@example.com",
    "password": "LocalTest123!",
    "whatsapp_number": "+923001111111",
    "role": UserRole.USER,
    "account_type": "member",
}
DEFAULT_USER_B = {
    "key": "B",
    "name": "Local User B",
    "email": "user-b@example.com",
    "password": "LocalTest123!",
    "whatsapp_number": "+923002222222",
    "role": UserRole.USER,
    "account_type": "member",
}
DEFAULT_ADMIN = {
    "key": "ADMIN",
    "name": "Local Admin",
    "email": "admin-local@example.com",
    "password": "LocalAdmin123!",
    "whatsapp_number": "+923003333333",
    "role": UserRole.SUPER_ADMIN,
    "account_type": "admin",
}


def guard_local_seed() -> None:
    """Refuse to create dummy users outside a local development database."""
    if is_production_environment():
        raise SystemExit(
            "ERROR: Refusing to seed dummy users in production "
            "(ENVIRONMENT=production/prod or SPACE_ID is set)."
        )
    assert_seed_database_allowed()


def resolve_local_accounts() -> list[dict]:
    """Build account specs from env vars, falling back to documented defaults."""
    specs = [
        {
            **DEFAULT_USER_A,
            "email": os.getenv("LOCAL_USER_A_EMAIL", DEFAULT_USER_A["email"]).strip().lower(),
            "password": os.getenv("LOCAL_USER_A_PASSWORD", DEFAULT_USER_A["password"]),
            "name": os.getenv("LOCAL_USER_A_NAME", DEFAULT_USER_A["name"]),
            "whatsapp_number": os.getenv(
                "LOCAL_USER_A_WHATSAPP", DEFAULT_USER_A["whatsapp_number"]
            ),
        },
        {
            **DEFAULT_USER_B,
            "email": os.getenv("LOCAL_USER_B_EMAIL", DEFAULT_USER_B["email"]).strip().lower(),
            "password": os.getenv("LOCAL_USER_B_PASSWORD", DEFAULT_USER_B["password"]),
            "name": os.getenv("LOCAL_USER_B_NAME", DEFAULT_USER_B["name"]),
            "whatsapp_number": os.getenv(
                "LOCAL_USER_B_WHATSAPP", DEFAULT_USER_B["whatsapp_number"]
            ),
        },
        {
            **DEFAULT_ADMIN,
            "email": os.getenv("LOCAL_ADMIN_EMAIL", DEFAULT_ADMIN["email"]).strip().lower(),
            "password": os.getenv("LOCAL_ADMIN_PASSWORD", DEFAULT_ADMIN["password"]),
            "name": os.getenv("LOCAL_ADMIN_NAME", DEFAULT_ADMIN["name"]),
            "whatsapp_number": os.getenv(
                "LOCAL_ADMIN_WHATSAPP", DEFAULT_ADMIN["whatsapp_number"]
            ),
        },
    ]
    for spec in specs:
        if not spec["email"] or not spec["password"]:
            raise SystemExit(f"ERROR: Missing email/password for local user {spec['key']}.")
    return specs


def local_accounts_should_be_verified() -> bool:
    """Dummy users are marked verified only in non-production local mode."""
    return not is_production_environment()


async def upsert_local_user(users_col, spec: dict, *, verified: bool) -> str:
    now = datetime.now(timezone.utc)
    existing = await users_col.find_one({"email": spec["email"]})
    hashed = hash_password(spec["password"])
    doc = {
        "name": spec["name"],
        "name_normalized": " ".join(spec["name"].strip().split()).lower(),
        "email": spec["email"],
        "whatsapp_number": spec["whatsapp_number"],
        "hashed_password": hashed,
        "role": spec["role"],
        "account_type": spec["account_type"],
        "is_verified": verified,
        "is_banned": False,
        "is_local_dummy": True,
        "country": "Pakistan",
        "updated_at": now,
    }
    if existing is None:
        doc["created_at"] = now
        await users_col.insert_one(doc)
        return "created"
    await users_col.update_one({"_id": existing["_id"]}, {"$set": doc})
    return "updated"


async def seed_local_users() -> None:
    guard_local_seed()
    verified = local_accounts_should_be_verified()
    bypass = email_verification_bypass_enabled()

    await connect_to_mongo()
    users_col = await get_users_collection_async()
    if users_col is None:
        raise SystemExit("ERROR: Could not connect to the local database.")

    print("Seeding local dummy users (local MongoDB only).")
    print(f"  ENVIRONMENT production lock: {is_production_environment()}")
    print(f"  DEV_BYPASS_EMAIL_VERIFICATION active: {bypass}")
    print(f"  Mark accounts verified in DB: {verified}")
    print()

    for spec in resolve_local_accounts():
        action = await upsert_local_user(users_col, spec, verified=verified)
        stored = await users_col.find_one({"email": spec["email"]})
        password_ok = verify_password(spec["password"], stored["hashed_password"])
        print(
            f"  User {spec['key']}: {action}  email={spec['email']}  "
            f"role={getattr(spec['role'], 'value', spec['role'])}  verified={stored.get('is_verified')}  "
            f"password_check={'ok' if password_ok else 'FAILED'}"
        )

    await close_mongo_connection()
    print()
    print("Login at the local app with the documented LOCAL_USER_* credentials.")
    print("Enable DEV_BYPASS_EMAIL_VERIFICATION=true so unverified local signups")
    print("are also treated as verified. Keep it false to exercise Mailpit.")


if __name__ == "__main__":
    import asyncio

    asyncio.run(seed_local_users())
