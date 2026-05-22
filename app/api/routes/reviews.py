from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pymongo import DESCENDING

from app.api.deps.auth import get_current_user
from app.db.mongodb import (
    get_items_collection_async,
    get_requests_collection_async,
    get_reviews_collection_async,
)
from app.schemas.reviews import ReputationResponse, ReviewCreateRequest, ReviewResponse
from app.services.auth import parse_object_id
from app.services.reputation import calculate_reputation_summary
from app.services.reviews import build_review_document, serialize_review

router = APIRouter()


@router.post("/reviews", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
async def create_review(
    payload: ReviewCreateRequest,
    current_user: dict = Depends(get_current_user),
):
    """Create a review for the other participant in a completed exchange."""
    items_collection = await get_items_collection_async()
    requests_collection = await get_requests_collection_async()
    reviews_collection = await get_reviews_collection_async()
    if items_collection is None or requests_collection is None or reviews_collection is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is not available.",
        )

    if current_user["id"] == payload.reviewed_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot review yourself.",
        )

    item_object_id = parse_object_id(payload.item_id)
    if item_object_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid item id.",
        )

    item = await items_collection.find_one({"_id": item_object_id})
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found.",
        )

    if item.get("status") != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reviews are only allowed after a completed exchange.",
        )

    approved_request = await requests_collection.find_one(
        {
            "item_id": payload.item_id,
            "status": "approved",
        }
    )
    if approved_request is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This exchange is missing an approved request and cannot be reviewed.",
        )

    owner_id = item["owner_id"]
    requester_id = approved_request["requester_id"]
    participants = {owner_id, requester_id}
    if current_user["id"] not in participants:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only exchange participants can leave a review.",
        )

    counterpart_id = requester_id if current_user["id"] == owner_id else owner_id
    if payload.reviewed_user_id != counterpart_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only review the other participant in this exchange.",
        )

    existing_review = await reviews_collection.find_one(
        {
            "item_id": payload.item_id,
            "reviewer_id": current_user["id"],
        }
    )
    if existing_review is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already reviewed this exchange.",
        )

    cleaned_comment = " ".join(payload.comment.strip().split())
    if len(cleaned_comment) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please enter a short review comment.",
        )

    review_document = build_review_document(
        payload,
        item=item,
        approved_request=approved_request,
        current_user=current_user,
        comment=cleaned_comment,
        created_at=datetime.now(timezone.utc),
    )
    result = await reviews_collection.insert_one(review_document)
    created_review = await reviews_collection.find_one({"_id": result.inserted_id})
    return serialize_review(created_review)


@router.get("/users/{user_id}/reviews", response_model=list[ReviewResponse])
async def list_user_reviews(user_id: str):
    """Return the latest reviews left for a specific user."""
    reviews_collection = await get_reviews_collection_async()
    if reviews_collection is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is not available.",
        )

    cursor = reviews_collection.find(
        {"reviewed_user_id": user_id},
    ).sort("created_at", DESCENDING)
    reviews = await cursor.to_list(length=50)
    return [serialize_review(review) for review in reviews]


@router.get("/me/reputation", response_model=ReputationResponse)
async def read_my_reputation(current_user: dict = Depends(get_current_user)):
    """Return the authenticated user's review summary and badge."""
    items_collection = await get_items_collection_async()
    requests_collection = await get_requests_collection_async()
    reviews_collection = await get_reviews_collection_async()
    if items_collection is None or requests_collection is None or reviews_collection is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is not available.",
        )

    return await calculate_reputation_summary(
        current_user["id"],
        items_collection=items_collection,
        requests_collection=requests_collection,
        reviews_collection=reviews_collection,
    )
