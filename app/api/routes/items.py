import logging
import math

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from pymongo import DESCENDING

from app.api.deps.auth import get_current_user, get_verified_user
from app.db.mongodb import (
    get_items_collection_async,
    get_requests_collection_async,
    get_reviews_collection_async,
    get_users_collection_async,
)
from app.schemas.items import (
    ItemCreateRequest,
    ItemImageUploadResponse,
    ItemListResponse,
    ItemResponse,
)
from app.services.auth import parse_object_id
from app.services.cloudinary import (
    CloudinaryConfigError,
    CloudinaryUploadError,
    upload_image_to_cloudinary,
)
from app.core.slowapi_limiter import authenticated_user_key, limiter
from app.services.image_validation import validate_and_sanitize_image
from app.services.items import build_item_document, serialize_item
from app.services.location import build_items_list_query, filter_and_sort_items, haversine_km
from app.services.reputation import build_public_reputation_lookup, calculate_reputation_summary
from app.services.trust import award_completed_donation
from app.services.notifications import notify_moderators, create_notification
from app.core.rate_limit import check_user_rate_limit

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/items", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/hour", key_func=authenticated_user_key)
async def create_item(
    request: Request,
    payload: ItemCreateRequest,
    current_user: dict = Depends(get_verified_user),
):
    """Create a new item listing for the logged-in user."""
    del request
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


@router.get("/items", response_model=ItemListResponse)
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
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
):
    """Return paginated public item listings with optional location filters."""
    items_collection = await get_items_collection_async()
    if items_collection is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is not available.",
        )

    mongo_query = build_items_list_query(country=country, city=city, status=status)
    geo_mode = near_lat is not None and near_lng is not None
    location_prefiltered = bool(country or city)

    # Browse path: filter in MongoDB (indexed) → optional geo sort in app → paginate.
    # Previously we fetched up to 1,000 candidates then filtered in Python, which silently
    # hid listings beyond the cap in busy cities.
    if geo_mode:
        cursor = items_collection.find(mongo_query).sort("created_at", DESCENDING)
        candidate_items = await cursor.to_list(length=None)
        filtered_items = filter_and_sort_items(
            candidate_items,
            near_lat=near_lat,
            near_lng=near_lng,
            radius_km=radius_km,
            location_prefiltered=location_prefiltered,
        )
    else:
        total = await items_collection.count_documents(mongo_query)
        total_pages = max(1, math.ceil(total / limit)) if total else 1
        if page > total_pages:
            page = total_pages
        skip = (page - 1) * limit
        cursor = (
            items_collection.find(mongo_query)
            .sort("created_at", DESCENDING)
            .skip(skip)
            .limit(limit)
        )
        filtered_items = await cursor.to_list(length=limit)
        items = filtered_items
        owner_ids = [str(item["owner_id"]) for item in items if item.get("owner_id") is not None]

        owner_reputation_lookup: dict[str, dict] = {}
        try:
            users_collection = await get_users_collection_async()
            reviews_collection = await get_reviews_collection_async()
            if users_collection is not None and reviews_collection is not None and owner_ids:
                owner_reputation_lookup = await build_public_reputation_lookup(
                    owner_ids,
                    users_collection=users_collection,
                    reviews_collection=reviews_collection,
                )
        except Exception:
            logger.exception("Failed to build reputation lookup for public items list")

        results = []
        for item in items:
            owner_id = str(item.get("owner_id", ""))
            try:
                results.append(
                    serialize_item(
                        item,
                        owner_reputation=owner_reputation_lookup.get(owner_id),
                    )
                )
            except Exception:
                logger.exception("Failed to serialize item %s", item.get("_id"))

        return {
            "items": results,
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": total_pages,
        }

    total = len(filtered_items)
    total_pages = max(1, math.ceil(total / limit)) if total else 1
    if page > total_pages:
        page = total_pages

    start = (page - 1) * limit
    items = filtered_items[start : start + limit]
    owner_ids = [str(item["owner_id"]) for item in items if item.get("owner_id") is not None]

    owner_reputation_lookup: dict[str, dict] = {}
    try:
        users_collection = await get_users_collection_async()
        reviews_collection = await get_reviews_collection_async()
        if users_collection is not None and reviews_collection is not None and owner_ids:
            owner_reputation_lookup = await build_public_reputation_lookup(
                owner_ids,
                users_collection=users_collection,
                reviews_collection=reviews_collection,
            )
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

    return {
        "items": results,
        "page": page,
        "limit": limit,
        "total": total,
        "total_pages": total_pages,
    }


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

    request_counts: dict[str, int] = {}
    if items:
        item_ids = [str(item["_id"]) for item in items]
        pipeline = [
            {"$match": {"item_id": {"$in": item_ids}}},
            {"$group": {"_id": "$item_id", "count": {"$sum": 1}}},
        ]
        rows = await requests_collection.aggregate(pipeline).to_list(length=len(item_ids))
        for row in rows:
            request_counts[str(row["_id"])] = int(row["count"])

    serialized_items = []
    for item in items:
        serialized_items.append(
            serialize_item(
                item,
                request_count=request_counts.get(str(item["_id"]), 0),
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

    file_bytes = await file.read()
    await file.close()

    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The selected image is empty. Please choose a different file.",
        )

    clean_bytes, content_type, safe_name = validate_and_sanitize_image(
        file_name=file.filename,
        file_bytes=file_bytes,
    )

    try:
        secure_url = await upload_image_to_cloudinary(
            file_name=safe_name,
            content_type=content_type,
            file_bytes=clean_bytes,
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
