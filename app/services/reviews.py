from app.schemas.reviews import ReviewCreateRequest


def build_review_document(
    payload: ReviewCreateRequest,
    *,
    item: dict,
    approved_request: dict,
    current_user: dict,
    comment: str,
    created_at,
) -> dict:
    """Create the MongoDB document for a new exchange review."""
    return {
        "item_id": payload.item_id,
        "request_id": str(approved_request["_id"]),
        "item_title": item["title"],
        "reviewer_id": current_user["id"],
        "reviewer_name": current_user["name"],
        "reviewed_user_id": payload.reviewed_user_id,
        "rating": payload.rating,
        "comment": comment,
        "created_at": created_at,
    }


def serialize_review(review: dict) -> dict:
    """Convert a MongoDB review document into an API-safe response shape."""
    return {
        "id": str(review["_id"]),
        "item_id": review["item_id"],
        "request_id": review.get("request_id"),
        "item_title": review["item_title"],
        "reviewer_id": review["reviewer_id"],
        "reviewer_name": review["reviewer_name"],
        "reviewed_user_id": review["reviewed_user_id"],
        "rating": review["rating"],
        "comment": review["comment"],
        "created_at": review["created_at"],
    }
