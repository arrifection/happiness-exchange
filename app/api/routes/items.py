import logging

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pymongo import DESCENDING

from app.api.deps.auth import get_current_user, get_verified_user
from app.db.mongodb import (
    get_items_collection_async,
    get_requests_collection_async,
    get_reviews_collection_async,
)
from app.schemas.items import (
    ItemCreateRequest,
    ItemImageUploadResponse,
    ItemResponse,
)
from app.services.auth import parse_object_id
from app.services.cloudinary import (
    CloudinaryConfigError,
    CloudinaryUploadError,
    MAX_IMAGE_SIZE_BYTES,
    upload_image_to_cloudinary,
)
from app.services.items import build_item_document, serialize_item
from app.services.location import build_items_list_query, filter_and_sort_items, haversine_km
from app.services.reputation import build_reputation_lookup, calculate_reputation_summary
from app.services.notifications import notify_moderators, create_notification
from app.core.rate_limit import check_user_rate_limit

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/items", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
async def create_item(
    payload: ItemCreateRequest,
    current_user: dict = Depends(get_verified_user),
):
    """Create a new item listing for the logged-in user."""
    check_user_rate_limit(current_user["id"], "create_item", max_calls=30, window_seconds=3600)
    items_collection = await get_items_collection_async()
    if items_collection is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is not available.",
        )

    item_document = build_item_document(payload, current_user)
    item_document["created_at"] = datetime.now(timezone.utc)

    result = await items_collection.insert_one(item_document)
    created_item = await items_collection.find_one({"_id": result.inserted_id})
    
    # Notify moderators of a new item
    import asyncio
    asyncio.create_task(
        notify_moderators(
            title="New Item Listed",
            message=f"'{payload.title}' was just listed and needs review.",
            type_="new_item_listed",
            action_url=f"/items/{str(result.inserted_id)}"
        )
    )
    
    return serialize_item(created_item)


@router.get("/items", response_model=list[ItemResponse])
async def list_items(
    country: str | None = Query(default=None, description="Filter by country"),
    city: str | None = Query(default=None, description="Filter by city"),
    status: str | None = Query(
        default="available",
        description="Filter by item status (default: available)",
    ),
    near_lat: float | None = Query(default=None, ge=-90, le=90),
    near_lng: float | None = Query(default=None, ge=-180, le=180),
    radius_km: float | None = Query(default=None, gt=0, le=500),
):
    """Return public item listings with optional location filters."""
    items_collection = await get_items_collection_async()
    if items_collection is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is not available.",
        )

    mongo_query = build_items_list_query(country=country, city=city, status=status)
    cursor = items_collection.find(mongo_query).sort("created_at", DESCENDING)
    items = await cursor.to_list(length=100)
    items = filter_and_sort_items(
        items,
        country=country,
        city=city,
        near_lat=near_lat,
        near_lng=near_lng,
        radius_km=radius_km,
    )
    owner_ids = [str(item["owner_id"]) for item in items if item.get("owner_id") is not None]

    owner_reputation_lookup: dict[str, dict] = {}
    try:
        requests_collection = await get_requests_collection_async()
        reviews_collection = await get_reviews_collection_async()
        if requests_collection is not None and reviews_collection is not None and owner_ids:
            raw_lookup = await build_reputation_lookup(
                owner_ids,
                items_collection=items_collection,
                requests_collection=requests_collection,
                reviews_collection=reviews_collection,
            )
            owner_reputation_lookup = {str(key): value for key, value in raw_lookup.items()}
    except Exception:
        logger.exception("Failed to build reputation lookup for public items list")

    results = []
    for item in items:
        owner_id = str(item.get("owner_id", ""))
        distance_km = None
        if near_lat is not None and near_lng is not None and item.get("latitude") is not None and item.get("longitude") is not None:
            distance_km = round(
                haversine_km(near_lat, near_lng, float(item["latitude"]), float(item["longitude"])),
                1,
            )
        try:
            results.append(
                serialize_item(
                    item,
                    owner_reputation=owner_reputation_lookup.get(owner_id),
                    distance_km=distance_km,
                )
            )
        except Exception:
            logger.exception("Failed to serialize item %s", item.get("_id"))
    return results


@router.get("/items/my", response_model=list[ItemResponse])
async def list_my_items(current_user: dict = Depends(get_current_user)):
    """Return item listings created by the logged-in user."""
    items_collection = await get_items_collection_async()
    requests_collection = await get_requests_collection_async()
    reviews_collection = await get_reviews_collection_async()
    if items_collection is None or requests_collection is None or reviews_collection is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is not available.",
        )

    cursor = items_collection.find(
        {"owner_id": current_user["id"]},
    ).sort("created_at", DESCENDING)
    items = await cursor.to_list(length=100)

    owner_reputation = await calculate_reputation_summary(
        current_user["id"],
        items_collection=items_collection,
        requests_collection=requests_collection,
        reviews_collection=reviews_collection,
    )
    serialized_items = []
    for item in items:
        request_count = await requests_collection.count_documents(
            {"item_id": str(item["_id"])}
        )
        serialized_items.append(
            serialize_item(
                item,
                request_count=request_count,
                owner_reputation=owner_reputation,
            )
        )

    return serialized_items


@router.post("/items/upload-image", response_model=ItemImageUploadResponse)
async def upload_item_image(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Upload an item image to Cloudinary and return its secure URL."""
    check_user_rate_limit(current_user["id"], "upload_image", max_calls=40, window_seconds=3600)
    del current_user

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please choose an image file (JPG, PNG, WEBP, etc.).",
        )

    file_bytes = await file.read()
    await file.close()

    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The selected image is empty. Please choose a different file.",
        )

    if len(file_bytes) > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please choose an image smaller than 5 MB.",
        )

    try:
        secure_url = await upload_image_to_cloudinary(
            file_name=file.filename or "item-image",
            content_type=file.content_type,
            file_bytes=file_bytes,
        )
    except CloudinaryConfigError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except CloudinaryUploadError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    return {"secure_url": secure_url}


@router.get("/items/{item_id}", response_model=ItemResponse)
async def get_item(item_id: str):
    """Return a single item listing by its id."""
    items_collection = await get_items_collection_async()
    requests_collection = await get_requests_collection_async()
    reviews_collection = await get_reviews_collection_async()
    if items_collection is None or requests_collection is None or reviews_collection is None:
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

    owner_reputation = await calculate_reputation_summary(
        item["owner_id"],
        items_collection=items_collection,
        requests_collection=requests_collection,
        reviews_collection=reviews_collection,
    )
    return serialize_item(item, owner_reputation=owner_reputation)


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(
    item_id: str,
    current_user: dict = Depends(get_verified_user),
):
    """Delete an item listing. Only the owner can delete."""
    items_collection = await get_items_collection_async()
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

    if item["owner_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this item.",
        )

    await items_collection.delete_one({"_id": object_id})

    # Clean up associated requests
    requests_collection = await get_requests_collection_async()
    if requests_collection is not None:
        await requests_collection.delete_many({"item_id": item_id})

    return


@router.patch("/items/{item_id}/complete", response_model=ItemResponse)
async def complete_item(
    item_id: str,
    current_user: dict = Depends(get_verified_user),
):
    """Mark an item as successfully taken/completed. Only the owner can do this."""
    items_collection = await get_items_collection_async()
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

    if item["owner_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify this item.",
        )

    result = await items_collection.update_one(
        {"_id": object_id},
        {"$set": {"status": "completed"}},
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Item already completed or not updated")

    # Award trust points for completed donation
    await award_completed_donation(current_user["id"], item_id)

    requests_collection = await get_requests_collection_async()
    if requests_collection is not None:
        # Find if there's an approved request to notify the requester
        approved_request = await requests_collection.find_one({
            "item_id": item_id,
            "status": "approved"
        })
        
        await requests_collection.update_many(
            {
                "item_id": item_id,
                "status": "pending",
            },
            {"$set": {"status": "rejected"}},
        )
        
        if approved_request:
            import asyncio
            asyncio.create_task(
                create_notification(
                    user_id=approved_request["requester_id"],
                    title="Item Completed!",
                    message=f"The item '{item.get('title', 'you requested')}' has been marked as completed.",
                    type_="item_completed",
                    action_url=f"/items/{item_id}"
                )
            )

    updated_item = await items_collection.find_one({"_id": object_id})
    owner_reputation = None
    reviews_collection = await get_reviews_collection_async()
    if requests_collection is not None and reviews_collection is not None:
        owner_reputation = await calculate_reputation_summary(
            current_user["id"],
            items_collection=items_collection,
            requests_collection=requests_collection,
            reviews_collection=reviews_collection,
        )

    return serialize_item(updated_item, owner_reputation=owner_reputation)
