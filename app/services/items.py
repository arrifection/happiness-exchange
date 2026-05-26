from datetime import datetime, timezone

from app.schemas.items import ItemCreateRequest
from app.services.location import enrich_item_location, build_item_location_payload


VALID_ITEM_STATUSES = frozenset({"available", "reserved", "completed"})


def _owner_id_str(item: dict) -> str:
    owner_id = item.get("owner_id")
    return str(owner_id) if owner_id is not None else ""


def serialize_item(
    item: dict,
    request_count: int | None = None,
    owner_reputation: dict | None = None,
    distance_km: float | None = None,
) -> dict:
    """Convert a MongoDB item document into an API-safe response shape."""
    enriched = enrich_item_location(item)
    status = enriched.get("status") or "available"
    if status not in VALID_ITEM_STATUSES:
        status = "available"

    created_at = enriched.get("created_at")
    if created_at is None:
        created_at = datetime.now(timezone.utc)

    image_url = enriched.get("image_url")
    if image_url is not None:
        image_url = str(image_url)

    return {
        "id": str(enriched["_id"]),
        "title": enriched.get("title") or "Untitled item",
        "description": enriched.get("description") or "",
        "category": enriched.get("category") or "Other",
        "condition": enriched.get("condition") or "Good",
        "location": enriched.get("location") or "Unknown",
        "country": enriched.get("country") or "Pakistan",
        "city": enriched.get("city"),
        "area": enriched.get("area"),
        "latitude": enriched.get("latitude"),
        "longitude": enriched.get("longitude"),
        "location_source": enriched.get("location_source") or "manual",
        "location_display": enriched.get("location_display") or enriched.get("location") or "Unknown",
        "image_url": image_url,
        "status": status,
        "owner_id": _owner_id_str(enriched),
        "owner_name": enriched.get("owner_name") or "Community Member",
        "owner_badge": owner_reputation.get("level") if owner_reputation else None,
        "owner_average_rating": owner_reputation.get("average_rating") if owner_reputation else None,
        "owner_review_count": owner_reputation.get("review_count") if owner_reputation else None,
        "created_at": created_at,
        "request_count": request_count,
        "distance_km": distance_km,
    }


def build_item_document(payload: ItemCreateRequest, current_user: dict) -> dict:
    """Create the MongoDB document for a new item listing."""
    location_fields = build_item_location_payload(
        location=payload.location.strip(),
        country=payload.country,
        city=payload.city,
        area=payload.area,
        latitude=payload.latitude,
        longitude=payload.longitude,
        location_source=payload.location_source,
        location_display=payload.location_display,
    )
    return {
        "title": payload.title.strip(),
        "description": payload.description.strip(),
        "category": payload.category.strip(),
        "condition": payload.condition.strip(),
        **location_fields,
        "image_url": str(payload.image_url) if payload.image_url else None,
        "status": "available",
        "owner_id": current_user["id"],
        "owner_name": current_user["name"],
    }
