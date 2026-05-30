def serialize_request(request: dict) -> dict:
    """Convert a MongoDB request document into an API-safe response shape."""
    return {
        "id": str(request["_id"]),
        "item_id": request["item_id"],
        "item_title": request["item_title"],
        "requester_id": request["requester_id"],
        "requester_name": request["requester_name"],
        "owner_id": request["owner_id"],
        "owner_name": request.get("owner_name", ""),
        "status": request["status"],
        "created_at": request["created_at"],
    }


def build_request_document(item: dict, current_user: dict) -> dict:
    """Create the MongoDB document for a new item interest request."""
    return {
        "item_id": str(item["_id"]),
        "item_title": item["title"],
        "requester_id": current_user["id"],
        "requester_name": current_user["name"],
        "owner_id": item["owner_id"],
        "owner_name": item.get("owner_name", ""),
        "status": "pending",
    }
