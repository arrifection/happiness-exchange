from fastapi import APIRouter, Depends, HTTPException, Query, status
from pymongo import DESCENDING

from app.api.deps.auth import get_current_user
from app.db.mongodb import get_notifications_collection_async
from app.schemas.notifications import NotificationResponse, UnreadCountResponse
from app.services.auth import parse_object_id

router = APIRouter()


@router.get("", response_model=list[NotificationResponse])
async def list_notifications(
    limit: int = Query(20, ge=1, le=50),
    current_user: dict = Depends(get_current_user),
):
    """List recent notifications for the logged-in user."""
    col = await get_notifications_collection_async()
    if col is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")

    cursor = col.find({"user_id": current_user["id"]}).sort("created_at", DESCENDING).limit(limit)
    docs = await cursor.to_list(length=limit)
    
    # Serialize
    for d in docs:
        d["id"] = str(d.pop("_id"))
    return docs


@router.get("/unread-count", response_model=UnreadCountResponse)
async def get_unread_count(
    current_user: dict = Depends(get_current_user),
):
    """Fast endpoint for polling the unread count badge."""
    col = await get_notifications_collection_async()
    if col is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")

    count = await col.count_documents({
        "user_id": current_user["id"],
        "read": False
    })
    return {"count": count}


@router.patch("/{notification_id}/read", status_code=200)
async def mark_as_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Mark a specific notification as read."""
    col = await get_notifications_collection_async()
    if col is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")

    oid = parse_object_id(notification_id)
    if oid is None:
        raise HTTPException(status_code=400, detail="Invalid notification ID.")

    result = await col.update_one(
        {"_id": oid, "user_id": current_user["id"]},
        {"$set": {"read": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found.")

    return {"status": "ok"}


@router.patch("/read-all", status_code=200)
async def mark_all_as_read(
    current_user: dict = Depends(get_current_user),
):
    """Mark all unread notifications as read for the user."""
    col = await get_notifications_collection_async()
    if col is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")

    await col.update_many(
        {"user_id": current_user["id"], "read": False},
        {"$set": {"read": True}}
    )

    return {"status": "ok"}
