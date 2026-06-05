from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps.auth import get_current_user
from app.db.mongodb import (
    get_items_collection_async,
    get_requests_collection_async,
    get_reviews_collection_async,
    get_users_collection_async,
)
from app.schemas.auth import ProfileUpdateRequest, UserResponse, WhatsAppUpdateRequest
from app.core.roles import is_admin_role
from app.services.account import delete_user_account

from app.services.auth import USERNAME_CHANGE_WINDOW_DAYS, normalize_name, parse_object_id, serialize_user

router = APIRouter()


@router.get("/me", response_model=UserResponse)
async def read_me(current_user: dict = Depends(get_current_user)):
    """Return the currently authenticated user."""
    return current_user


@router.patch("/me", response_model=UserResponse)
async def update_me(
    payload: ProfileUpdateRequest,
    current_user: dict = Depends(get_current_user),
):
    """Update the authenticated user's profile within allowed rules."""
    users_collection = await get_users_collection_async()
    if users_collection is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is not available.",
        )

    user_object_id = parse_object_id(current_user["id"])
    if user_object_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user id.",
        )

    user = await users_collection.find_one({"_id": user_object_id})
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    created_at = user.get("created_at")
    if created_at is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account is missing a creation date and cannot be updated right now.",
        )

    change_deadline = created_at + timedelta(days=USERNAME_CHANGE_WINDOW_DAYS)
    if datetime.now(timezone.utc) > change_deadline:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Username can only be changed during the first 7 days after signup.",
        )

    cleaned_name = " ".join(payload.name.strip().split())
    normalized_name = normalize_name(cleaned_name)
    if len(cleaned_name) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username must be at least 2 characters long.",
        )

    existing_user = await users_collection.find_one(
        {
            "name_normalized": normalized_name,
            "_id": {"$ne": user_object_id},
        }
    )
    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That username is already taken.",
        )

    await users_collection.update_one(
        {"_id": user_object_id},
        {
            "$set": {
                "name": cleaned_name,
                "name_normalized": normalized_name,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    items_collection = await get_items_collection_async()
    if items_collection is not None:
        await items_collection.update_many(
            {"owner_id": current_user["id"]},
            {"$set": {"owner_name": cleaned_name}},
        )

    requests_collection = await get_requests_collection_async()
    if requests_collection is not None:
        await requests_collection.update_many(
            {"requester_id": current_user["id"]},
            {"$set": {"requester_name": cleaned_name}},
        )
        await requests_collection.update_many(
            {"owner_id": current_user["id"]},
            {"$set": {"owner_name": cleaned_name}},
        )

    reviews_collection = await get_reviews_collection_async()
    if reviews_collection is not None:
        await reviews_collection.update_many(
            {"reviewer_id": current_user["id"]},
            {"$set": {"reviewer_name": cleaned_name}},
        )

    updated_user = await users_collection.find_one({"_id": user_object_id})
    return serialize_user(updated_user, include_whatsapp=True)


@router.patch("/me/whatsapp", response_model=UserResponse)
async def update_whatsapp(
    payload: WhatsAppUpdateRequest,
    current_user: dict = Depends(get_current_user),
):
    """Update the authenticated user's private WhatsApp contact number."""
    users_collection = await get_users_collection_async()
    if users_collection is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is not available.",
        )

    user_object_id = parse_object_id(current_user["id"])
    if user_object_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user id.",
        )

    await users_collection.update_one(
        {"_id": user_object_id},
        {
            "$set": {
                "whatsapp_number": payload.whatsapp_number,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    updated_user = await users_collection.find_one({"_id": user_object_id})
    return serialize_user(updated_user, include_whatsapp=True)


@router.delete("/me", status_code=status.HTTP_200_OK)
async def delete_me(current_user: dict = Depends(get_current_user)):
    """Permanently delete the authenticated user's account and linked data."""
    if current_user.get("is_seed_account"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account cannot be deleted.",
        )
    if is_admin_role(current_user.get("role", "")):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin accounts cannot be deleted from the public app. Contact support.",
        )

    deleted = await delete_user_account(current_user["id"])
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found or could not be deleted.",
        )

    return {"status": "deleted", "message": "Your account has been permanently deleted."}


@router.post("/{user_id}/block", response_model=dict)
async def block_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Block a user."""
    users_collection = await get_users_collection_async()
    if users_collection is None:
        raise HTTPException(status_code=503, detail="DB unavailable")
    
    current_oid = parse_object_id(current_user["id"])
    target_oid = parse_object_id(user_id)
    if not current_oid or not target_oid:
        raise HTTPException(status_code=400, detail="Invalid user ID")
        
    if current_user["id"] == user_id:
        raise HTTPException(status_code=400, detail="Cannot block yourself")
        
    await users_collection.update_one(
        {"_id": current_oid},
        {"$addToSet": {"blocked_users": user_id}}
    )
    return {"status": "ok"}


@router.post("/{user_id}/unblock", response_model=dict)
async def unblock_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Unblock a user."""
    users_collection = await get_users_collection_async()
    if users_collection is None:
        raise HTTPException(status_code=503, detail="DB unavailable")
        
    current_oid = parse_object_id(current_user["id"])
    if not current_oid:
        raise HTTPException(status_code=400, detail="Invalid user ID")
        
    await users_collection.update_one(
        {"_id": current_oid},
        {"$pull": {"blocked_users": user_id}}
    )
    return {"status": "ok"}


@router.patch("/me/online", response_model=dict)
async def update_online_status(current_user: dict = Depends(get_current_user)):
    """Update last_online_at timestamp for the current user."""
    users_collection = await get_users_collection_async()
    if users_collection is None:
        raise HTTPException(status_code=503, detail="DB unavailable")
        
    current_oid = parse_object_id(current_user["id"])
    if not current_oid:
        raise HTTPException(status_code=400, detail="Invalid user ID")
        
    await users_collection.update_one(
        {"_id": current_oid},
        {"$set": {"last_online_at": datetime.now(timezone.utc)}}
    )
    return {"status": "ok"}


@router.get("/{user_id}/status", response_model=dict)
async def get_user_status(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get the online status (last_online_at) of another user."""
    users_collection = await get_users_collection_async()
    if users_collection is None:
        raise HTTPException(status_code=503, detail="DB unavailable")
        
    target_oid = parse_object_id(user_id)
    if not target_oid:
        raise HTTPException(status_code=400, detail="Invalid user ID")
        
    user = await users_collection.find_one({"_id": target_oid}, {"last_online_at": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    return {"last_online_at": user.get("last_online_at")}
