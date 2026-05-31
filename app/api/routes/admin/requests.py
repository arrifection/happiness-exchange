"""
Admin requests management routes.

GET /api/admin/requests         — list all exchange requests (paginated, filtered)
GET /api/admin/requests/{id}    — get single request with enriched details

Request statuses: pending | approved | rejected | completed | cancelled

The existing serialize_request() from app.services.requests is intentionally NOT
used here; we need richer data (user emails, item image, etc.) that requires
joining users and items collections.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo import DESCENDING

from app.api.deps.admin import get_moderator_or_admin
from app.db.mongodb import (
    get_items_collection_async,
    get_requests_collection_async,
    get_users_collection_async,
)
from app.services.auth import parse_object_id

router = APIRouter()

# All known statuses — used for server-side filter validation
VALID_STATUSES = frozenset({"pending", "approved", "rejected", "completed", "cancelled"})


def _serialize_request_admin(req: dict, user_lookup: dict, item_lookup: dict) -> dict:
    """
    Serialize a request document into the admin response shape.
    Enriches with user email from user_lookup and item image from item_lookup.
    """
    req_id = str(req["_id"])
    requester_id = str(req.get("requester_id", ""))
    owner_id = str(req.get("owner_id", ""))
    item_id = str(req.get("item_id", ""))

    requester = user_lookup.get(requester_id, {})
    owner = user_lookup.get(owner_id, {})
    item = item_lookup.get(item_id, {})

    return {
        "id": req_id,
        "item_id": item_id,
        "item_title": req.get("item_title") or item.get("title") or "—",
        "item_image_url": item.get("image_url"),
        "item_status": item.get("status"),
        "requester_id": requester_id,
        "requester_name": req.get("requester_name") or requester.get("name") or "—",
        "requester_email": requester.get("email") or "—",
        "owner_id": owner_id,
        "owner_name": req.get("owner_name") or owner.get("name") or "—",
        "owner_email": owner.get("email") or "—",
        "reason": req.get("reason") or "",
        "status": req.get("status") or "pending",
        "created_at": req.get("created_at"),
        "updated_at": req.get("updated_at"),
        "approved_at": req.get("approved_at"),
        "rejected_at": req.get("rejected_at"),
        "completed_at": req.get("completed_at"),
    }


async def _enrich_requests(requests: list[dict]) -> list[dict]:
    """Batch-load users and items referenced by the request list."""
    if not requests:
        return []

    users_col = await get_users_collection_async()
    items_col = await get_items_collection_async()

    # Collect unique IDs
    requester_ids = set()
    owner_ids = set()
    item_ids = set()
    for req in requests:
        if req.get("requester_id"):
            requester_ids.add(str(req["requester_id"]))
        if req.get("owner_id"):
            owner_ids.add(str(req["owner_id"]))
        if req.get("item_id"):
            item_ids.add(str(req["item_id"]))

    all_user_ids = requester_ids | owner_ids
    user_lookup: dict = {}
    item_lookup: dict = {}

    # Batch load users
    if users_col is not None and all_user_ids:
        from bson import ObjectId
        oids = [ObjectId(uid) for uid in all_user_ids if _is_valid_oid(uid)]
        if oids:
            cursor = users_col.find(
                {"_id": {"$in": oids}},
                {"name": 1, "email": 1},
            )
            async for user in cursor:
                user_lookup[str(user["_id"])] = {
                    "name": user.get("name", ""),
                    "email": user.get("email", ""),
                }

    # Batch load items (for image_url and current status)
    if items_col is not None and item_ids:
        from bson import ObjectId
        oids = [ObjectId(iid) for iid in item_ids if _is_valid_oid(iid)]
        if oids:
            cursor = items_col.find(
                {"_id": {"$in": oids}},
                {"title": 1, "image_url": 1, "status": 1},
            )
            async for item in cursor:
                item_lookup[str(item["_id"])] = {
                    "title": item.get("title", ""),
                    "image_url": item.get("image_url"),
                    "status": item.get("status"),
                }

    return [_serialize_request_admin(req, user_lookup, item_lookup) for req in requests]


def _is_valid_oid(value: str) -> bool:
    try:
        from bson import ObjectId
        ObjectId(value)
        return True
    except Exception:
        return False


@router.get("")
async def list_requests_admin(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: str = Query("", description="Search by item title, requester name, or reason"),
    status_filter: str = Query("", alias="status", description="Filter by request status"),
    admin: dict = Depends(get_moderator_or_admin),
):
    """
    List all platform exchange requests with enriched user/item data.
    Moderator+ required.
    """
    requests_col = await get_requests_collection_async()
    if requests_col is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")

    query: dict = {}

    if status_filter and status_filter in VALID_STATUSES:
        query["status"] = status_filter

    if search:
        query["$or"] = [
            {"item_title":      {"$regex": search, "$options": "i"}},
            {"requester_name":  {"$regex": search, "$options": "i"}},
            {"owner_name":      {"$regex": search, "$options": "i"}},
            {"reason":          {"$regex": search, "$options": "i"}},
        ]

    total = await requests_col.count_documents(query)
    cursor = requests_col.find(query).sort("created_at", DESCENDING).skip(skip).limit(limit)
    requests = await cursor.to_list(length=limit)

    enriched = await _enrich_requests(requests)

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "requests": enriched,
    }


@router.get("/{request_id}")
async def get_request_admin(
    request_id: str,
    admin: dict = Depends(get_moderator_or_admin),
):
    """
    Get a single exchange request with full enriched details.
    Moderator+ required.
    """
    requests_col = await get_requests_collection_async()
    if requests_col is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")

    oid = parse_object_id(request_id)
    if oid is None:
        raise HTTPException(status_code=400, detail="Invalid request ID.")

    req = await requests_col.find_one({"_id": oid})
    if req is None:
        raise HTTPException(status_code=404, detail="Request not found.")

    enriched = await _enrich_requests([req])
    return enriched[0]
