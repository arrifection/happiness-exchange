"""
Admin reviews management routes.

GET    /api/admin/reviews        — list all reviews (paginated)
DELETE /api/admin/reviews/{id}   — remove any review (moderation)
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo import DESCENDING

from app.api.deps.admin import require_permission
from app.core.admin_permissions import PERMISSION_REVIEWS
from app.db.mongodb import get_reviews_collection_async
from app.services.audit import AuditAction, write_audit_log
from app.services.auth import parse_object_id
from app.services.reviews import serialize_review

router = APIRouter()


@router.get("")
async def list_reviews_admin(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    admin: dict = Depends(require_permission(PERMISSION_REVIEWS)),
):
    """List all platform reviews. Moderator+ required."""
    reviews_collection = await get_reviews_collection_async()
    if reviews_collection is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")

    total = await reviews_collection.count_documents({})
    cursor = reviews_collection.find({}).sort("created_at", DESCENDING).skip(skip).limit(limit)
    reviews = await cursor.to_list(length=limit)

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "reviews": [serialize_review(r) for r in reviews],
    }


@router.delete("/{review_id}", status_code=204)
async def admin_delete_review(
    review_id: str,
    admin: dict = Depends(require_permission(PERMISSION_REVIEWS)),
):
    """
    Remove any review as a moderation action.
    Moderator+ required. Audit logged.
    """
    reviews_collection = await get_reviews_collection_async()
    if reviews_collection is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")

    oid = parse_object_id(review_id)
    if oid is None:
        raise HTTPException(status_code=400, detail="Invalid review ID.")

    review = await reviews_collection.find_one({"_id": oid})
    if review is None:
        raise HTTPException(status_code=404, detail="Review not found.")

    await reviews_collection.delete_one({"_id": oid})

    await write_audit_log(
        action=AuditAction.REVIEW_DELETED,
        admin_user=admin,
        target_type="review",
        target_id=review_id,
        detail={
            "reviewer_id":    review.get("reviewer_id"),
            "reviewed_user_id": review.get("reviewed_user_id"),
            "rating":         review.get("rating"),
            "comment":        review.get("comment", "")[:100],
        },
    )
