from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pymongo import DESCENDING
from pymongo.errors import DuplicateKeyError

from app.api.deps.auth import get_current_user
from app.db.mongodb import get_items_collection_async, get_requests_collection_async
from app.schemas.requests import RequestResponse
from app.services.auth import parse_object_id
from app.services.requests import build_request_document, serialize_request

router = APIRouter()


@router.post("/requests/{item_id}", response_model=RequestResponse, status_code=status.HTTP_201_CREATED)
async def create_request(
    item_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Create an interest request for an item."""
    items_collection = await get_items_collection_async()
    requests_collection = await get_requests_collection_async()
    if items_collection is None or requests_collection is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is not available.",
        )

    object_id = parse_object_id(item_id)
    if object_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid item id.",
        )

    item = await items_collection.find_one({"_id": object_id})
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found.",
        )

    if item["owner_id"] == current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot request your own item.",
        )

    if item["status"] != "available":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This item is not currently available for requests.",
        )

    request_document = build_request_document(item, current_user)
    request_document["created_at"] = datetime.now(timezone.utc)

    try:
        result = await requests_collection.insert_one(request_document)
    except DuplicateKeyError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already requested this item.",
        )

    created_request = await requests_collection.find_one({"_id": result.inserted_id})
    return serialize_request(created_request)


@router.get("/requests/my", response_model=list[RequestResponse])
async def list_my_requests(current_user: dict = Depends(get_current_user)):
    """Return requests created by the logged-in user."""
    requests_collection = await get_requests_collection_async()
    if requests_collection is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is not available.",
        )

    cursor = requests_collection.find(
        {"requester_id": current_user["id"]},
    ).sort("created_at", DESCENDING)
    requests = await cursor.to_list(length=100)
    return [serialize_request(request) for request in requests]


@router.get("/requests/incoming", response_model=list[RequestResponse])
async def list_incoming_requests(current_user: dict = Depends(get_current_user)):
    """Return requests for items owned by the logged-in user."""
    requests_collection = await get_requests_collection_async()
    if requests_collection is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is not available.",
        )

    cursor = requests_collection.find(
        {"owner_id": current_user["id"]},
    ).sort("created_at", DESCENDING)
    requests = await cursor.to_list(length=100)
    return [serialize_request(request) for request in requests]


@router.get("/items/{item_id}/requests", response_model=list[RequestResponse])
async def list_item_requests(
    item_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Return requests for an item, only for that item's owner."""
    items_collection = await get_items_collection_async()
    requests_collection = await get_requests_collection_async()
    if items_collection is None or requests_collection is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is not available.",
        )

    object_id = parse_object_id(item_id)
    if object_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid item id.",
        )

    item = await items_collection.find_one({"_id": object_id})
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found.",
        )

    if item["owner_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the item owner can view these requests.",
        )

    cursor = requests_collection.find({"item_id": item_id}).sort("created_at", DESCENDING)
    requests = await cursor.to_list(length=100)
    return [serialize_request(request) for request in requests]


@router.patch("/requests/{request_id}/approve", response_model=RequestResponse)
async def approve_request(
    request_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Approve a request and reserve the related item."""
    items_collection = await get_items_collection_async()
    requests_collection = await get_requests_collection_async()
    if items_collection is None or requests_collection is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is not available.",
        )

    request_object_id = parse_object_id(request_id)
    if request_object_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid request id.",
        )

    request = await requests_collection.find_one({"_id": request_object_id})
    if request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found.",
        )

    if request["owner_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the item owner can approve requests.",
        )

    if request["status"] != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending requests can be approved.",
        )

    item_object_id = parse_object_id(request["item_id"])
    if item_object_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This request references an invalid item.",
        )

    item = await items_collection.find_one({"_id": item_object_id})
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found.",
        )

    if item["status"] == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Completed items cannot accept requests.",
        )

    existing_approved = await requests_collection.find_one(
        {
            "item_id": request["item_id"],
            "status": "approved",
            "_id": {"$ne": request_object_id},
        }
    )
    if existing_approved is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Another request has already been approved for this item.",
        )

    await requests_collection.update_one(
        {"_id": request_object_id},
        {"$set": {"status": "approved"}},
    )
    await requests_collection.update_many(
        {
            "item_id": request["item_id"],
            "status": "pending",
            "_id": {"$ne": request_object_id},
        },
        {"$set": {"status": "rejected"}},
    )
    await items_collection.update_one(
        {"_id": item_object_id},
        {"$set": {"status": "reserved"}},
    )

    updated_request = await requests_collection.find_one({"_id": request_object_id})
    return serialize_request(updated_request)


@router.patch("/requests/{request_id}/reject", response_model=RequestResponse)
async def reject_request(
    request_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Reject a pending request."""
    requests_collection = await get_requests_collection_async()
    if requests_collection is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is not available.",
        )

    request_object_id = parse_object_id(request_id)
    if request_object_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid request id.",
        )

    request = await requests_collection.find_one({"_id": request_object_id})
    if request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found.",
        )

    if request["owner_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the item owner can reject requests.",
        )

    if request["status"] != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending requests can be rejected.",
        )

    await requests_collection.update_one(
        {"_id": request_object_id},
        {"$set": {"status": "rejected"}},
    )
    updated_request = await requests_collection.find_one({"_id": request_object_id})
    return serialize_request(updated_request)
