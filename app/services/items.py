from datetime import datetime, timezone

from app.schemas.items import ItemCreateRequest
from app.services.listing_expiration import (
    compute_listing_expires_at,
    is_listing_expired,
    is_listing_publicly_active,
    resolve_listing_expires_at,
)
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

    review_count = 0
    average_rating = None
    if owner_reputation:
        review_count = int(owner_reputation.get("review_count") or 0)
        if review_count >= 1:
            average_rating = owner_reputation.get("average_rating")

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
        "owner_average_rating": average_rating,
        "owner_review_count": review_count if review_count >= 1 else 0,
        "created_at": created_at,
        "request_count": 0 if request_count is None else request_count,
        "distance_km": distance_km,
        "expiry_date": enriched.get("expiry_date"),
        "sealed_packaging": enriched.get("sealed_packaging"),
        "storage_condition": enriched.get("storage_condition"),
        "listing_expires_at": resolve_listing_expires_at(enriched),
        "is_expired": is_listing_expired(enriched),
        "listing_active": is_listing_publicly_active(enriched),
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
    document = {
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
    if payload.expiry_date is not None:
        document["expiry_date"] = payload.expiry_date.isoformat()
    if payload.sealed_packaging is not None:
        document["sealed_packaging"] = payload.sealed_packaging
    if payload.storage_condition is not None:
        document["storage_condition"] = payload.storage_condition
    document["listing_expires_at"] = compute_listing_expires_at()
    return document
