"""14-day listing visibility helpers — all times in UTC."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

LISTING_ACTIVE_DAYS = 14


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def ensure_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def compute_listing_expires_at(from_time: datetime | None = None) -> datetime:
    base = ensure_utc(from_time) or utc_now()
    return base + timedelta(days=LISTING_ACTIVE_DAYS)


def resolve_listing_expires_at(item: dict) -> datetime:
    stored = item.get("listing_expires_at")
    if stored is not None:
        return ensure_utc(stored) or compute_listing_expires_at()
    created = ensure_utc(item.get("created_at"))
    if created is not None:
        return created + timedelta(days=LISTING_ACTIVE_DAYS)
    return compute_listing_expires_at()


def is_listing_expired(item: dict, now: datetime | None = None) -> bool:
    if item.get("status") == "completed":
        return False
    reference = ensure_utc(now) or utc_now()
    return resolve_listing_expires_at(item) <= reference


def is_listing_publicly_active(item: dict, now: datetime | None = None) -> bool:
    if item.get("status") != "available":
        return False
    return not is_listing_expired(item, now=now)


def active_listings_mongo_clause(now: datetime | None = None) -> dict:
    """Mongo filter: listing still within its 14-day active window."""
    reference = ensure_utc(now) or utc_now()
    legacy_cutoff = reference - timedelta(days=LISTING_ACTIVE_DAYS)
    return {
        "$or": [
            {"listing_expires_at": {"$gt": reference}},
            {
                "$and": [
                    {"listing_expires_at": {"$exists": False}},
                    {"created_at": {"$gt": legacy_cutoff}},
                ]
            },
        ]
    }
