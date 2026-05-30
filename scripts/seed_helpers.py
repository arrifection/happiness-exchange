"""Shared helpers for development-only test data seeding."""

from __future__ import annotations

import os
import random
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv()

from app.core.config import settings

SEED_EMAIL_DOMAIN = "seed.happyexchange.local"
SEED_PASSWORD = "LoadTest123!"
SEED_BATCH_PREFIX = "loadtest-batch"

PRODUCTION_DB_HOST_MARKERS = (
    "happyexchange",
    "happiness-exchange",
    "arrifection",
    "prod",
    "production",
)

LOCAL_DB_HOSTS = {"localhost", "127.0.0.1"}

CATEGORIES = [
    "Furniture",
    "Books",
    "Clothes",
    "Food",
    "Kitchen",
    "Family Items",
    "Kids Goods",
    "Home",
]

CONDITIONS = ["Like New", "Good", "Fair", "Used"]

PK_CITIES = [
    "Karachi",
    "Lahore",
    "Islamabad",
    "Rawalpindi",
    "Faisalabad",
    "Multan",
    "Peshawar",
    "Hyderabad",
]

SA_CITIES = ["Riyadh", "Jeddah", "Makkah", "Madina", "Dammam", "Khobar", "Taif"]

ITEM_TITLES = {
    "Furniture": ["Wooden study desk", "Dining chairs set", "Bookshelf unit", "Single bed frame"],
    "Books": ["Class 8 textbooks", "Urdu literature set", "Science reference books", "Story books bundle"],
    "Clothes": ["Winter jacket size M", "Kids shalwar kameez", "Office formal shirts", "Baby clothes pack"],
    "Food": ["Unopened rice bag", "Sealed cooking oil", "Tea and biscuits box", "Dry fruit pack"],
    "Kitchen": ["Non-stick pots set", "Steel dinner plates", "Electric kettle", "Storage containers"],
    "Family Items": ["Baby stroller", "Family prayer mat set", "Extra blankets", "Home first-aid kit"],
    "Kids Goods": ["School bag", "Color pencils set", "Toy blocks", "Kids bicycle"],
    "Home": ["Floor lamp", "Curtain set", "Storage rack", "Wall clock"],
}

DESCRIPTIONS = [
    "Gently used and cleaned. Pickup from a public meeting point only.",
    "Available for a family in need. Item is in good working condition.",
    "Shared through Happiness Exchange to help someone nearby.",
    "No longer needed at home but still useful for someone else.",
    "Please request only if you genuinely need this item.",
]


def assert_seed_database_allowed(*, allow_staging: bool = False) -> None:
    """Refuse production-like MongoDB targets unless explicitly overridden."""
    uri = (os.environ.get("MONGODB_URI") or settings.MONGODB_URI or "").strip()
    db_name = (os.environ.get("DB_NAME") or settings.DB_NAME or "").strip().lower()

    if not uri:
        raise SystemExit("ERROR: MONGODB_URI is not configured.")

    host = (urlparse(uri).hostname or "").lower()
    is_local = host in LOCAL_DB_HOSTS

    if not is_local and not allow_staging:
        raise SystemExit(
            "ERROR: Refusing non-local MongoDB URI.\n"
            "Seed only against localhost/127.0.0.1, or pass --allow-staging with SEED_STAGING_CONFIRM=1."
        )

    if allow_staging and os.environ.get("SEED_STAGING_CONFIRM") != "1":
        raise SystemExit("ERROR: --allow-staging requires SEED_STAGING_CONFIRM=1 in environment.")

    if any(marker in db_name for marker in PRODUCTION_DB_HOST_MARKERS):
        if os.environ.get("SEED_STAGING_CONFIRM") != "1":
            raise SystemExit(
                f"ERROR: DB_NAME '{settings.DB_NAME}' looks production-like. "
                "Use a dedicated staging database name."
            )

    if "mongodb+srv://" in uri and is_local is False and allow_staging:
        cluster = host.split(".")[0] if host else ""
        if cluster and any(marker in cluster.lower() for marker in PRODUCTION_DB_HOST_MARKERS):
            if os.environ.get("SEED_STAGING_CONFIRM") != "1":
                raise SystemExit(
                    "ERROR: Atlas cluster name looks production-like. "
                    "Use a staging cluster or set SEED_STAGING_CONFIRM=1 intentionally."
                )


def random_past_datetime(days: int = 90, rng: random.Random | None = None) -> datetime:
    r = rng or random
    offset_seconds = r.randint(0, days * 24 * 60 * 60)
    return datetime.now(timezone.utc) - timedelta(seconds=offset_seconds)


def pick_city_country(rng: random.Random) -> tuple[str, str]:
    if rng.random() < 0.75:
        return "Pakistan", rng.choice(PK_CITIES)
    return "Saudi Arabia", rng.choice(SA_CITIES)


def build_placeholder_image_url(seed_key: str) -> str:
    safe = re.sub(r"[^a-zA-Z0-9_-]", "-", seed_key)[:48]
    return f"https://placehold.co/640x480/f5f0e8/7340d2/png?text={safe}"


def make_seed_email(index: int) -> str:
    return f"loadtest.user{index:03d}@{SEED_EMAIL_DOMAIN}"


def make_seed_username(index: int) -> str:
    return f"LoadTest User {index:03d}"


def seed_batch_id() -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    return f"{SEED_BATCH_PREFIX}-{stamp}"
