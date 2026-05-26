from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pymongo import DESCENDING

from app.api.deps.auth import get_current_user, get_verified_user
from app.core.roles import UserRole, has_role
from app.db.mongodb import get_need_requests_collection_async
from app.schemas.need_requests import NeedRequestCreateRequest, NeedRequestResponse
from app.services.auth import parse_object_id
from app.services.need_requests import build_need_request_document, serialize_need_request

router = APIRouter()


def _is_moderator_or_admin(user: dict) -> bool:
    return has_role(user.get("role", "user"), UserRole.MODERATOR)


async def _get_need_request_or_404(need_id: str):
    collection = await get_need_requests_collection_async()
    if collection is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is not available.",
        )

    object_id = parse_object_id(need_id)
    if object_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid need request id.",
        )

    document = await collection.find_one({"_id": object_id})
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Need request not found.",
        )
    return collection, document


@router.get("/need-requests", response_model=list[NeedRequestResponse])
async def list_need_requests(
    status_filter: str | None = Query(default="open", alias="status"),
    country: str | None = Query(default=None),
    city: str | None = Query(default=None),
    category: str | None = Query(default=None),
):
    """Return community need requests with optional filters."""
    collection = await get_need_requests_collection_async()
    if collection is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is not available.",
        )

    query: dict = {}
    if status_filter and status_filter.lower() != "all":
        query["status"] = status_filter.lower()
    if country:
        query["country"] = country.strip()
    if city:
        query["city"] = city.strip()
    if category:
        query["category"] = category.strip()

    cursor = collection.find(query).sort("created_at", DESCENDING)
    documents = await cursor.to_list(length=100)
    return [serialize_need_request(document) for document in documents]


@router.post("/need-requests", response_model=NeedRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_need_request(
    payload: NeedRequestCreateRequest,
    current_user: dict = Depends(get_verified_user),
):
    """Create a community need request (verified users only)."""
    collection = await get_need_requests_collection_async()
    if collection is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is not available.",
        )

    document = build_need_request_document(payload, current_user)
    document["created_at"] = datetime.now(timezone.utc)
    result = await collection.insert_one(document)
    created = await collection.find_one({"_id": result.inserted_id})
    return serialize_need_request(created)


@router.patch("/need-requests/{need_id}/close", response_model=NeedRequestResponse)
async def close_need_request(
    need_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Close an open need request (owner or moderator/admin)."""
    collection, document = await _get_need_request_or_404(need_id)
    is_owner = document.get("created_by") == current_user["id"]
    if not is_owner and not _is_moderator_or_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only close your own need requests.",
        )

    await collection.update_one(
        {"_id": document["_id"]},
        {"$set": {"status": "closed", "updated_at": datetime.now(timezone.utc)}},
    )
    updated = await collection.find_one({"_id": document["_id"]})
    return serialize_need_request(updated)


@router.patch("/need-requests/{need_id}/fulfilled", response_model=NeedRequestResponse)
async def fulfill_need_request(
    need_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Mark a need request as fulfilled (owner or moderator/admin)."""
    collection, document = await _get_need_request_or_404(need_id)
    is_owner = document.get("created_by") == current_user["id"]
    if not is_owner and not _is_moderator_or_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own need requests.",
        )

    await collection.update_one(
        {"_id": document["_id"]},
        {"$set": {"status": "fulfilled", "updated_at": datetime.now(timezone.utc)}},
    )
    updated = await collection.find_one({"_id": document["_id"]})
    return serialize_need_request(updated)


@router.delete("/need-requests/{need_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_need_request(
    need_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Remove a need request (owner or moderator/admin)."""
    collection, document = await _get_need_request_or_404(need_id)
    is_owner = document.get("created_by") == current_user["id"]
    if not is_owner and not _is_moderator_or_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only remove your own need requests.",
        )

    await collection.delete_one({"_id": document["_id"]})
