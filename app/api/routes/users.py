from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps.auth import get_current_user
from app.db.mongodb import (
    get_items_collection,
    get_requests_collection,
    get_users_collection,
)
from app.schemas.auth import ProfileUpdateRequest, UserResponse
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
    users_collection = get_users_collection()
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

    items_collection = get_items_collection()
    if items_collection is not None:
        await items_collection.update_many(
            {"owner_id": current_user["id"]},
            {"$set": {"owner_name": cleaned_name}},
        )

    requests_collection = get_requests_collection()
    if requests_collection is not None:
        await requests_collection.update_many(
            {"requester_id": current_user["id"]},
            {"$set": {"requester_name": cleaned_name}},
        )
        await requests_collection.update_many(
            {"owner_id": current_user["id"]},
            {"$set": {"owner_name": cleaned_name}},
        )

    updated_user = await users_collection.find_one({"_id": user_object_id})
    return serialize_user(updated_user)
