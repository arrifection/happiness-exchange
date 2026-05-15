from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pymongo import DESCENDING

from app.api.deps.auth import get_current_user
from app.db.mongodb import get_items_collection, get_requests_collection
from app.schemas.items import ItemCreateRequest, ItemResponse
from app.services.auth import parse_object_id
from app.services.items import build_item_document, serialize_item

router = APIRouter()


@router.post("/items", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
async def create_item(
    payload: ItemCreateRequest,
    current_user: dict = Depends(get_current_user),
):
    """Create a new item listing for the logged-in user."""
    items_collection = get_items_collection()
    if items_collection is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is not available.",
        )

    item_document = build_item_document(payload, current_user)
    item_document["created_at"] = datetime.now(timezone.utc)

    result = await items_collection.insert_one(item_document)
    created_item = await items_collection.find_one({"_id": result.inserted_id})
    return serialize_item(created_item)


@router.get("/items", response_model=list[ItemResponse])
async def list_items():
    """Return public item listings with their current status."""
    items_collection = get_items_collection()
    if items_collection is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is not available.",
        )

    cursor = items_collection.find({}).sort("created_at", DESCENDING)
    items = await cursor.to_list(length=100)
    return [serialize_item(item) for item in items]


@router.get("/items/my", response_model=list[ItemResponse])
async def list_my_items(current_user: dict = Depends(get_current_user)):
    """Return item listings created by the logged-in user."""
    items_collection = get_items_collection()
    requests_collection = get_requests_collection()
    if items_collection is None or requests_collection is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is not available.",
        )

    cursor = items_collection.find(
        {"owner_id": current_user["id"]},
    ).sort("created_at", DESCENDING)
    items = await cursor.to_list(length=100)

    serialized_items = []
    for item in items:
        request_count = await requests_collection.count_documents(
            {"item_id": str(item["_id"])}
        )
        serialized_items.append(serialize_item(item, request_count=request_count))

    return serialized_items


@router.get("/items/{item_id}", response_model=ItemResponse)
async def get_item(item_id: str):
    """Return a single item listing by its id."""
    items_collection = get_items_collection()
    if items_collection is None:
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

    return serialize_item(item)
