from datetime import datetime, timezone

from app.schemas.items import ItemCreateRequest

VALID_ITEM_STATUSES = frozenset({"available", "reserved", "completed"})


def _owner_id_str(item: dict) -> str:
    owner_id = item.get("owner_id")
    return str(owner_id) if owner_id is not None else ""


def serialize_item(
    item: dict,
    request_count: int | None = None,
    owner_reputation: dict | None = None,
) -> dict:
    """Convert a MongoDB item document into an API-safe response shape."""
    status = item.get("status") or "available"
    if status not in VALID_ITEM_STATUSES:
        status = "available"

    created_at = item.get("created_at")
    if created_at is None:
        created_at = datetime.now(timezone.utc)

    image_url = item.get("image_url")
    if image_url is not None:
        image_url = str(image_url)

    return {
        "id": str(item["_id"]),
        "title": item.get("title") or "Untitled item",
        "description": item.get("description") or "",
        "category": item.get("category") or "Other",
        "condition": item.get("condition") or "Good",
        "location": item.get("location") or "Unknown",
        "image_url": image_url,
        "status": status,
        "owner_id": _owner_id_str(item),
        "owner_name": item.get("owner_name") or "Community Member",
        "owner_badge": owner_reputation.get("level") if owner_reputation else None,
        "owner_average_rating": owner_reputation.get("average_rating") if owner_reputation else None,
        "owner_review_count": owner_reputation.get("review_count") if owner_reputation else None,
        "created_at": created_at,
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
