from app.schemas.items import ItemCreateRequest


def serialize_item(
    item: dict,
    request_count: int | None = None,
    owner_reputation: dict | None = None,
) -> dict:
    """Convert a MongoDB item document into an API-safe response shape."""
    return {
        "id": str(item["_id"]),
        "title": item["title"],
        "description": item["description"],
        "category": item["category"],
        "condition": item["condition"],
        "location": item["location"],
        "image_url": item.get("image_url"),
        "status": item["status"],
        "owner_id": item["owner_id"],
        "owner_name": item["owner_name"],
        "owner_badge": owner_reputation["current_badge"] if owner_reputation else None,
        "owner_average_rating": owner_reputation["average_rating"] if owner_reputation else None,
        "owner_review_count": owner_reputation["review_count"] if owner_reputation else None,
        "created_at": item["created_at"],
        "request_count": request_count,
    }


def build_item_document(payload: ItemCreateRequest, current_user: dict) -> dict:
    """Create the MongoDB document for a new item listing."""
    return {
        "title": payload.title.strip(),
        "description": payload.description.strip(),
        "category": payload.category.strip(),
        "condition": payload.condition.strip(),
        "location": payload.location.strip(),
        "image_url": str(payload.image_url) if payload.image_url else None,
        "status": "available",
        "owner_id": current_user["id"],
        "owner_name": current_user["name"],
    }
