"""
Admin item management routes.

GET    /api/admin/items          — list all items (paginated + filter)
GET    /api/admin/items/{id}     — get single item
DELETE /api/admin/items/{id}     — admin delete any item
"""
from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.deps.admin import get_moderator_or_admin
from app.db.mongodb import get_items_collection_async, get_requests_collection_async
from app.services.audit import AuditAction, write_audit_log
from app.services.auth import parse_object_id
from app.services.items import serialize_item
from pymongo import DESCENDING

router = APIRouter()


@router.get("")
async def list_items_admin(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: str = Query(""),
    status_filter: str = Query("", alias="status"),
    admin: dict = Depends(get_moderator_or_admin),
):
    """List all platform items with optional search and status filter. Moderator+ required."""
    items_collection = await get_items_collection_async()
    if items_collection is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")

    query: dict = {}
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
        ]
    if status_filter:
        query["status"] = status_filter

    total = await items_collection.count_documents(query)
    cursor = items_collection.find(query).sort("created_at", DESCENDING).skip(skip).limit(limit)
    items = await cursor.to_list(length=limit)

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "items": [serialize_item(i) for i in items],
    }


@router.get("/{item_id}")
async def get_item_admin(
    item_id: str,
    admin: dict = Depends(get_moderator_or_admin),
):
    """Get a single item by ID. Moderator+ required."""
    items_collection = await get_items_collection_async()
    if items_collection is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")

    oid = parse_object_id(item_id)
    if oid is None:
        raise HTTPException(status_code=400, detail="Invalid item ID.")

    item = await items_collection.find_one({"_id": oid})
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found.")

    return serialize_item(item)


@router.delete("/{item_id}", status_code=204)
async def admin_delete_item(
    item_id: str,
    admin: dict = Depends(get_moderator_or_admin),
):
    """
    Delete any item regardless of ownership (admin override).
    Moderator+ required. Audit logged.
    """
    items_collection = await get_items_collection_async()
    if items_collection is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")

    oid = parse_object_id(item_id)
    if oid is None:
        raise HTTPException(status_code=400, detail="Invalid item ID.")

    item = await items_collection.find_one({"_id": oid})
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found.")

    await items_collection.delete_one({"_id": oid})

    # Clean up associated requests
    requests_collection = await get_requests_collection_async()
    if requests_collection is not None:
        await requests_collection.delete_many({"item_id": item_id})

    await write_audit_log(
        action=AuditAction.ITEM_DELETED,
        admin_user=admin,
        target_type="item",
        target_id=item_id,
        detail={
            "title":    item.get("title"),
            "owner_id": item.get("owner_id"),
            "status":   item.get("status"),
        },
    )
