"""
Admin analytics routes.

GET /api/admin/analytics/summary  — platform-wide counts
GET /api/admin/analytics/audit    — recent audit log entries
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo import DESCENDING

from app.api.deps.admin import get_admin_user
from app.db.mongodb import (
    get_db_async,
    get_items_collection_async,
    get_requests_collection_async,
    get_reviews_collection_async,
    get_users_collection_async,
)
from app.services.audit import AUDIT_COLLECTION

router = APIRouter()


@router.get("/summary")
async def analytics_summary(admin: dict = Depends(get_admin_user)):
    """Return high-level platform counts. Any admin role required."""
    users_col    = await get_users_collection_async()
    items_col    = await get_items_collection_async()
    requests_col = await get_requests_collection_async()
    reviews_col  = await get_reviews_collection_async()

    if any(c is None for c in [users_col, items_col, requests_col, reviews_col]):
        raise HTTPException(status_code=503, detail="Database unavailable.")

    total_users     = await users_col.count_documents({})
    total_items     = await items_col.count_documents({})
    active_items    = await items_col.count_documents({"status": "active"})
    completed_items = await items_col.count_documents({"status": "completed"})
    total_requests  = await requests_col.count_documents({})
    open_requests   = await requests_col.count_documents({"status": "pending"})
    total_reviews   = await reviews_col.count_documents({})
    banned_users    = await users_col.count_documents({"is_banned": True})

    return {
        "users": {
            "total":  total_users,
            "banned": banned_users,
        },
        "items": {
            "total":     total_items,
            "active":    active_items,
            "completed": completed_items,
        },
        "requests": {
            "total": total_requests,
            "open":  open_requests,
        },
        "reviews": {
            "total": total_reviews,
        },
    }


@router.get("/audit")
async def recent_audit_log(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    admin: dict = Depends(get_admin_user),
):
    """Return recent audit log entries (newest first). Any admin role required."""
    db = await get_db_async()
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")

    col = db[AUDIT_COLLECTION]
    cursor = col.find({}).sort("timestamp", DESCENDING).skip(skip).limit(limit)
    entries = await cursor.to_list(length=limit)

    def serialize(e):
        e["id"] = str(e.pop("_id"))
        return e

    return {
        "total":   await col.count_documents({}),
        "entries": [serialize(e) for e in entries],
    }
