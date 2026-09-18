"""Public community impact stats — aggregate counts only, no user rankings."""
import asyncio
import time

from fastapi import APIRouter, HTTPException

from app.db.mongodb import (
    get_items_collection_async,
    get_need_requests_collection_async,
)

router = APIRouter()

_CACHE_TTL_SECONDS = 60
_cache_lock = asyncio.Lock()
_cache_value: dict | None = None
_cache_at: float | None = None


@router.get("/impact")
async def community_impact():
    """Return platform-wide impact totals for the Community Impact page."""
    global _cache_value, _cache_at

    now = time.time()
    if _cache_value is not None and _cache_at is not None and (now - _cache_at) < _CACHE_TTL_SECONDS:
        return _cache_value

    async with _cache_lock:
        # Double-check after acquiring the lock.
        now = time.time()
        if _cache_value is not None and _cache_at is not None and (now - _cache_at) < _CACHE_TTL_SECONDS:
            return _cache_value

        items_col = await get_items_collection_async()
        needs_col = await get_need_requests_collection_async()

        if items_col is None or needs_col is None:
            raise HTTPException(status_code=503, detail="Database unavailable.")

        items_shared = await items_col.count_documents({"status": "completed"})
        needs_fulfilled = await needs_col.count_documents({"status": "fulfilled"})
        active_givers = len(
            await items_col.distinct("owner_id", {"owner_id": {"$exists": True, "$ne": None}})
        )
        community_exchanges = items_shared

        result = {
            "items_shared": items_shared,
            "needs_fulfilled": needs_fulfilled,
            "active_givers": active_givers,
            "community_exchanges": community_exchanges,
        }

        _cache_value = result
        _cache_at = time.time()
        return result
