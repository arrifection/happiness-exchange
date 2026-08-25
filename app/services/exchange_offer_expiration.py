"""Expire stale PENDING/COUNTERED exchange offers without touching accepted exchanges."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from pymongo import ReturnDocument

from app.services.exchange_offers import utc_now

logger = logging.getLogger(__name__)

EXCHANGE_OFFER_EXPIRED_MESSAGE = "This exchange offer has expired."
EXPIRABLE_OFFER_STATUSES = frozenset({"PENDING", "COUNTERED"})
MIN_SWEEP_INTERVAL_SECONDS = 60

_sweep_lock: asyncio.Lock | None = None
_last_sweep_at: datetime | None = None


def _get_sweep_lock() -> asyncio.Lock:
    global _sweep_lock
    if _sweep_lock is None:
        _sweep_lock = asyncio.Lock()
    return _sweep_lock


def ensure_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def is_offer_past_expiry(offer: dict, now: datetime | None = None) -> bool:
    if offer.get("status") not in EXPIRABLE_OFFER_STATUSES:
        return False
    expires_at = ensure_utc(offer.get("expires_at"))
    if expires_at is None:
        return False
    reference = ensure_utc(now) or utc_now()
    return expires_at <= reference


def _stale_offer_query(now: datetime, extra_query: dict | None = None) -> dict:
    query = {
        "status": {"$in": list(EXPIRABLE_OFFER_STATUSES)},
        "expires_at": {"$lte": now},
    }
    if extra_query:
        query.update(extra_query)
    return query


async def expire_stale_exchange_offers(
    offers_collection,
    extra_query: dict | None = None,
    now: datetime | None = None,
) -> int:
    """CAS-expire PENDING/COUNTERED offers whose expires_at has passed. Idempotent."""
    if offers_collection is None:
        return 0
    reference = ensure_utc(now) or utc_now()
    result = await offers_collection.update_many(
        _stale_offer_query(reference, extra_query),
        {"$set": {"status": "EXPIRED", "updated_at": reference}},
    )
    return int(getattr(result, "modified_count", 0) or 0)


async def expire_offer_if_stale(offers_collection, offer: dict, now: datetime | None = None) -> dict:
    """Expire a single PENDING/COUNTERED offer if it is past expires_at. Never expires ACCEPTED."""
    if not offer or not is_offer_past_expiry(offer, now=now):
        return offer
    reference = ensure_utc(now) or utc_now()
    updated = await offers_collection.find_one_and_update(
        {
            "_id": offer["_id"],
            "status": {"$in": list(EXPIRABLE_OFFER_STATUSES)},
            "expires_at": {"$lte": reference},
        },
        {"$set": {"status": "EXPIRED", "updated_at": reference}},
        return_document=ReturnDocument.AFTER,
    )
    if updated is not None:
        return updated
    current = await offers_collection.find_one({"_id": offer["_id"]})
    return current or offer


async def run_exchange_offer_expiration_safely() -> int:
    """Periodic sweep used by the existing health ping. Safe to overlap; never raises."""
    global _last_sweep_at
    try:
        async with _get_sweep_lock():
            now = utc_now()
            if _last_sweep_at is not None:
                elapsed = (now - _last_sweep_at).total_seconds()
                if elapsed < MIN_SWEEP_INTERVAL_SECONDS:
                    return 0
            from app.db.mongodb import get_exchange_offers_collection_async
            offers_collection = await get_exchange_offers_collection_async()
            expired = await expire_stale_exchange_offers(offers_collection, now=now)
            _last_sweep_at = now
            if expired:
                logger.info("Expired %s stale exchange offer(s).", expired)
            return expired
    except Exception:
        logger.exception("Exchange offer expiration sweep failed.")
        return 0
