"""Public community impact stats — aggregate counts only, no user rankings."""

from fastapi import APIRouter, HTTPException

from app.db.mongodb import (
    get_items_collection_async,
    get_need_requests_collection_async,
)

router = APIRouter()


@router.get("/impact")
async def community_impact():
    """Return platform-wide impact totals for the Community Impact page."""
    items_col = await get_items_collection_async()
    needs_col = await get_need_requests_collection_async()

    if items_col is None or needs_col is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")

    items_shared = await items_col.count_documents({"status": "completed"})
    needs_fulfilled = await needs_col.count_documents({"status": "fulfilled"})
    active_givers = len(await items_col.distinct("owner_id", {"owner_id": {"$exists": True, "$ne": None}}))
    community_exchanges = items_shared

    return {
        "items_shared": items_shared,
        "needs_fulfilled": needs_fulfilled,
        "active_givers": active_givers,
        "community_exchanges": community_exchanges,
    }
