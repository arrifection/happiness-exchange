"""Listing visibility helpers — listings no longer expire."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

# Retained for schema/response compatibility; expiry is no longer enforced.
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
    """Kept for document shape compatibility; value is unused for visibility."""
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
    """Listings never expire."""
    del item, now
    return False


def is_listing_publicly_active(item: dict, now: datetime | None = None) -> bool:
    """Available listings are always publicly active (no expiry gate)."""
    del now
    return item.get("status") == "available"


def active_listings_mongo_clause(now: datetime | None = None) -> dict:
    """No expiry filter — browse relies on status (and other callers) alone."""
    del now
    return {}
