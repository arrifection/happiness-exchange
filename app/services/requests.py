def serialize_request(
    request: dict,
    *,
    requester_reputation: dict | None = None,
    item_image_url: str | None = None,
    item_listing_mode: str | None = None,
) -> dict:
    """Convert a MongoDB request document into an API-safe response shape."""
    payload = {
        "id": str(request["_id"]),
        "item_id": request["item_id"],
        "item_title": request["item_title"],
        "item_image_url": str(item_image_url) if item_image_url else None,
        "item_listing_mode": str(item_listing_mode).upper() if item_listing_mode else None,
        "requester_id": request["requester_id"],
        "requester_name": request["requester_name"],
        "requester_city": request.get("requester_city"),
        "owner_id": request["owner_id"],
        "owner_name": request.get("owner_name", ""),
        "reason": request.get("reason") or "",
        "status": request["status"],
        "created_at": request["created_at"],
    }
    if requester_reputation is not None:
        payload["requester_reputation"] = {
            "level": requester_reputation.get("level", "New Member"),
            "trust_score": int(requester_reputation.get("trust_score") or 0),
            "next_level_points": requester_reputation.get("next_level_points"),
            "average_rating": requester_reputation.get("average_rating"),
            "review_count": int(requester_reputation.get("review_count") or 0),
        }
    return payload


def build_request_document(item: dict, current_user: dict, *, reason: str, requester_city: str | None = None) -> dict:
    """Create the MongoDB document for a new item interest request."""
    return {
        "item_id": str(item["_id"]),
        "item_title": item["title"],
        "requester_id": current_user["id"],
        "requester_name": current_user["name"],
        "requester_city": requester_city,
        "owner_id": item["owner_id"],
        "owner_name": item.get("owner_name", ""),
        "reason": reason.strip(),
        "status": "pending",
    }
