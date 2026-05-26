from datetime import datetime, timezone

from app.schemas.need_requests import NeedRequestCreateRequest
from app.services.location import normalize_country


VALID_NEED_STATUSES = frozenset({"open", "fulfilled", "closed"})


def serialize_need_request(document: dict) -> dict:
    status = document.get("status") or "open"
    if status not in VALID_NEED_STATUSES:
        status = "open"

    created_at = document.get("created_at")
    if created_at is None:
        created_at = datetime.now(timezone.utc)

    return {
        "id": str(document["_id"]),
        "title": document.get("title") or "Untitled need",
        "description": document.get("description") or "",
        "category": document.get("category") or "Other",
        "country": normalize_country(document.get("country")),
        "city": document.get("city") or "",
        "urgency": document.get("urgency") or "normal",
        "status": status,
        "created_by": str(document.get("created_by", "")),
        "created_by_name": document.get("created_by_name") or "Community Member",
        "created_at": created_at,
    }


def build_need_request_document(payload: NeedRequestCreateRequest, current_user: dict) -> dict:
    return {
        "title": payload.title.strip(),
        "description": payload.description.strip(),
        "category": payload.category.strip(),
        "country": normalize_country(payload.country),
        "city": payload.city.strip(),
        "urgency": payload.urgency,
        "status": "open",
        "created_by": current_user["id"],
        "created_by_name": current_user["name"],
    }
