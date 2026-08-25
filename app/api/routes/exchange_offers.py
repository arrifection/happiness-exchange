import asyncio
import logging
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from pymongo import DESCENDING
from pymongo.errors import DuplicateKeyError

from app.api.deps.auth import get_current_user, get_verified_user, get_whatsapp_user
from app.core.rate_limit import check_user_rate_limit
from app.core.slowapi_limiter import authenticated_user_key, limiter
from app.db.mongodb import (
    get_exchange_offers_collection_async,
    get_exchange_shipping_collection_async,
    get_exchange_transactions_collection_async,
    get_items_collection_async,
    get_users_collection_async,
)
from app.schemas.exchange import (
    ExchangeCounterOfferRequest,
    ExchangeImageUploadResponse,
    ExchangeOfferCreateRequest,
    ExchangeOfferListResponse,
    ExchangeOfferResponse,
)
from app.services.auth import parse_object_id
from app.services.cloudinary import CloudinaryConfigError, CloudinaryUploadError, upload_image_to_cloudinary
from app.services.exchange_offers import (
    BLOCKING_LISTING_STATUSES,
    build_exchange_offer_document,
    is_listing_exchange_reserved,
    item_supports_exchange,
    serialize_exchange_offer,
    utc_now,
)
from app.services.exchange_offer_expiration import (
    EXCHANGE_OFFER_EXPIRED_MESSAGE,
    expire_offer_if_stale,
    expire_stale_exchange_offers,
)
from app.services.exchange_notifications import (
    counter_accepted_copy,
    counter_received_copy,
    new_swap_offer_copy,
    offer_declined_copy,
)
from app.services.exchange_workflow import accept_exchange_offer, ExchangeAcceptConflict
from app.services.image_validation import validate_and_sanitize_image
from app.services.listing_expiration import is_listing_publicly_active
from app.services.notifications import create_notification

router = APIRouter()
logger = logging.getLogger(__name__)

EXCHANGE_ACCEPT_UNAVAILABLE_MESSAGE = "This exchange is no longer available. Please try again later."


async def _get_offer_or_404(offers_collection, offer_id: str):
    object_id = parse_object_id(offer_id)
    if object_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid offer id.")
    offer = await offers_collection.find_one({"_id": object_id})
    if offer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exchange offer not found.")
    return await expire_offer_if_stale(offers_collection, offer)


def _reject_if_expired(offer: dict):
    if offer.get("status") == "EXPIRED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=EXCHANGE_OFFER_EXPIRED_MESSAGE,
        )


async def _serialize_with_listing(offers_collection, items_collection, offer: dict) -> dict:
    offered_listing = None
    if offer.get("offered_listing_id"):
        offered_oid = parse_object_id(offer["offered_listing_id"])
        if offered_oid is not None:
            offered_listing = await items_collection.find_one({"_id": offered_oid})
    return serialize_exchange_offer(offer, offered_listing=offered_listing)


async def _listing_blocks_new_offers(offers_collection, listing_id: str) -> bool:
    blocking = await offers_collection.find_one({
        "listing_id": listing_id,
        "status": {"$in": list(BLOCKING_LISTING_STATUSES)},
    })
    return blocking is not None


@router.post("/exchange-offers/upload-image", response_model=ExchangeImageUploadResponse)
@limiter.limit("40/hour", key_func=authenticated_user_key)
async def upload_exchange_item_image(
    request: Request,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_verified_user),
):
    del request
    check_user_rate_limit(current_user["id"], "upload_exchange_image", max_calls=40, window_seconds=3600)
    file_bytes = await file.read()
    await file.close()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="The selected image is empty.")
    try:
        clean_bytes, content_type, safe_name = validate_and_sanitize_image(
            file_name=file.filename,
            file_bytes=file_bytes,
            content_type=file.content_type,
        )
        secure_url = await upload_image_to_cloudinary(
            file_name=safe_name,
            content_type=content_type,
            file_bytes=clean_bytes,
        )
        return {"secure_url": secure_url}
    except CloudinaryConfigError:
        raise HTTPException(status_code=503, detail="Image upload is not configured.")
    except CloudinaryUploadError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.post("/exchange-offers", response_model=ExchangeOfferResponse, status_code=status.HTTP_201_CREATED)
async def create_exchange_offer(
    payload: ExchangeOfferCreateRequest,
    current_user: dict = Depends(get_whatsapp_user),
):
    check_user_rate_limit(current_user["id"], "create_exchange_offer", max_calls=30, window_seconds=3600)
    items_collection = await get_items_collection_async()
    offers_collection = await get_exchange_offers_collection_async()
    if items_collection is None or offers_collection is None:
        raise HTTPException(status_code=503, detail="Database connection is not available.")

    listing_oid = parse_object_id(payload.listing_id)
    if listing_oid is None:
        raise HTTPException(status_code=400, detail="Invalid listing id.")

    listing = await items_collection.find_one({"_id": listing_oid})
    if listing is None:
        raise HTTPException(status_code=404, detail="Listing not found.")

    if listing["owner_id"] == current_user["id"]:
        raise HTTPException(status_code=403, detail="You cannot propose a swap for your own listing.")

    if not item_supports_exchange(listing):
        raise HTTPException(status_code=400, detail="This listing does not support exchange.")

    if listing.get("status") != "available":
        raise HTTPException(status_code=400, detail="This listing is not available for exchange offers.")

    if not is_listing_publicly_active(listing):
        raise HTTPException(status_code=400, detail="This listing has expired.")

    if is_listing_exchange_reserved(listing):
        raise HTTPException(status_code=400, detail="This listing is reserved for an active exchange.")

    if await _listing_blocks_new_offers(offers_collection, payload.listing_id):
        raise HTTPException(status_code=400, detail="This listing already has an accepted exchange in progress.")

    if payload.offered_listing_id:
        offered_oid = parse_object_id(payload.offered_listing_id)
        if offered_oid is None:
            raise HTTPException(status_code=400, detail="Invalid offered listing id.")
        offered = await items_collection.find_one({"_id": offered_oid})
        if offered is None:
            raise HTTPException(status_code=404, detail="Offered listing not found.")
        if offered["owner_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="You can only offer your own listings.")
        if offered.get("status") != "available":
            raise HTTPException(status_code=400, detail="Your offered listing must be available.")

    document = build_exchange_offer_document(listing, current_user, payload)
    try:
        result = await offers_collection.insert_one(document)
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="You already have an active exchange offer on this listing.")

    created = await offers_collection.find_one({"_id": result.inserted_id})
    offer_title, offer_message = new_swap_offer_copy(current_user.get("name"), listing.get("title"))
    asyncio.create_task(create_notification(
        user_id=listing["owner_id"],
        title=offer_title,
        message=offer_message,
        type_="exchange_offer_received",
        action_url=f"/items/{payload.listing_id}",
        dedupe_key=f"exchange_offer_received:{str(result.inserted_id)}",
    ))
    return await _serialize_with_listing(offers_collection, items_collection, created)


@router.get("/exchange-offers/my", response_model=ExchangeOfferListResponse)
async def list_my_exchange_offers(current_user: dict = Depends(get_current_user)):
    offers_collection = await get_exchange_offers_collection_async()
    items_collection = await get_items_collection_async()
    if offers_collection is None or items_collection is None:
        raise HTTPException(status_code=503, detail="Database connection is not available.")

    await expire_stale_exchange_offers(
        offers_collection,
        extra_query={"offering_user_id": current_user["id"]},
    )
    offers = []
    cursor = offers_collection.find({"offering_user_id": current_user["id"]}).sort("created_at", DESCENDING)
    async for offer in cursor:
        offers.append(await _serialize_with_listing(offers_collection, items_collection, offer))
    return {"offers": offers, "total": len(offers)}


@router.get("/exchange-offers/incoming", response_model=ExchangeOfferListResponse)
async def list_incoming_exchange_offers(current_user: dict = Depends(get_current_user)):
    offers_collection = await get_exchange_offers_collection_async()
    items_collection = await get_items_collection_async()
    if offers_collection is None or items_collection is None:
        raise HTTPException(status_code=503, detail="Database connection is not available.")

    await expire_stale_exchange_offers(
        offers_collection,
        extra_query={"owner_user_id": current_user["id"]},
    )
    offers = []
    cursor = offers_collection.find({"owner_user_id": current_user["id"]}).sort("created_at", DESCENDING)
    async for offer in cursor:
        offers.append(await _serialize_with_listing(offers_collection, items_collection, offer))
    return {"offers": offers, "total": len(offers)}


@router.get("/items/{item_id}/exchange-offers", response_model=ExchangeOfferListResponse)
async def list_exchange_offers_for_listing(
    item_id: str,
    current_user: dict = Depends(get_current_user),
):
    offers_collection = await get_exchange_offers_collection_async()
    items_collection = await get_items_collection_async()
    if offers_collection is None or items_collection is None:
        raise HTTPException(status_code=503, detail="Database connection is not available.")

    listing_oid = parse_object_id(item_id)
    if listing_oid is None:
        raise HTTPException(status_code=400, detail="Invalid listing id.")
    listing = await items_collection.find_one({"_id": listing_oid})
    if listing is None:
        raise HTTPException(status_code=404, detail="Listing not found.")
    if listing["owner_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the listing owner can view exchange offers.")

    await expire_stale_exchange_offers(
        offers_collection,
        extra_query={"listing_id": item_id},
    )
    offers = []
    cursor = offers_collection.find({"listing_id": item_id}).sort("created_at", DESCENDING)
    async for offer in cursor:
        offers.append(await _serialize_with_listing(offers_collection, items_collection, offer))
    return {"offers": offers, "total": len(offers)}


@router.patch("/exchange-offers/{offer_id}/accept", response_model=ExchangeOfferResponse)
async def accept_offer(offer_id: str, current_user: dict = Depends(get_verified_user)):
    offers_collection = await get_exchange_offers_collection_async()
    items_collection = await get_items_collection_async()
    transactions_collection = await get_exchange_transactions_collection_async()
    shipping_collection = await get_exchange_shipping_collection_async()
    users_collection = await get_users_collection_async()
    if not all([offers_collection, items_collection, transactions_collection, shipping_collection, users_collection]):
        raise HTTPException(status_code=503, detail="Database connection is not available.")

    offer = await _get_offer_or_404(offers_collection, offer_id)
    if offer["owner_user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the listing owner can accept exchange offers.")
    _reject_if_expired(offer)
    if offer.get("status") != "PENDING":
        if offer.get("status") == "COUNTERED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A countered offer can only be accepted by the original offering user.",
            )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This offer cannot be accepted in its current state.")

    listing = await items_collection.find_one({"_id": ObjectId(offer["listing_id"])})
    if listing is None:
        raise HTTPException(status_code=404, detail="Listing not found.")

    try:
        updated_offer, _transaction = await accept_exchange_offer(
            offers_collection=offers_collection,
            items_collection=items_collection,
            transactions_collection=transactions_collection,
            shipping_collection=shipping_collection,
            users_collection=users_collection,
            offer=offer,
            listing=listing,
            expected_offer_statuses={"PENDING"},
        )
    except ExchangeAcceptConflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=EXCHANGE_ACCEPT_UNAVAILABLE_MESSAGE,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return updated_offer


@router.patch("/exchange-offers/{offer_id}/decline", response_model=ExchangeOfferResponse)
async def decline_offer(offer_id: str, current_user: dict = Depends(get_verified_user)):
    offers_collection = await get_exchange_offers_collection_async()
    items_collection = await get_items_collection_async()
    if offers_collection is None or items_collection is None:
        raise HTTPException(status_code=503, detail="Database connection is not available.")

    offer = await _get_offer_or_404(offers_collection, offer_id)
    if offer["owner_user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the listing owner can decline exchange offers.")
    _reject_if_expired(offer)
    if offer.get("status") not in {"PENDING", "COUNTERED"}:
        raise HTTPException(status_code=400, detail="This offer cannot be declined.")

    now = utc_now()
    await offers_collection.update_one(
        {"_id": offer["_id"]},
        {"$set": {"status": "DECLINED", "updated_at": now}},
    )
    updated = await offers_collection.find_one({"_id": offer["_id"]})
    declined_title, declined_message = offer_declined_copy(offer.get("listing_title"))
    asyncio.create_task(create_notification(
        user_id=offer["offering_user_id"],
        title=declined_title,
        message=declined_message,
        type_="exchange_offer_declined",
        action_url=f"/items/{offer['listing_id']}",
        dedupe_key=f"exchange_offer_declined:{offer_id}",
    ))
    return await _serialize_with_listing(offers_collection, items_collection, updated)


@router.post("/exchange-offers/{offer_id}/counter", response_model=ExchangeOfferResponse)
async def counter_offer(
    offer_id: str,
    payload: ExchangeCounterOfferRequest,
    current_user: dict = Depends(get_verified_user),
):
    offers_collection = await get_exchange_offers_collection_async()
    items_collection = await get_items_collection_async()
    if offers_collection is None or items_collection is None:
        raise HTTPException(status_code=503, detail="Database connection is not available.")

    offer = await _get_offer_or_404(offers_collection, offer_id)
    if offer["owner_user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the listing owner can send a counter offer.")
    _reject_if_expired(offer)
    if offer.get("status") not in {"PENDING", "COUNTERED"}:
        raise HTTPException(status_code=400, detail="This offer cannot be countered.")

    now = utc_now()
    await offers_collection.update_one(
        {"_id": offer["_id"]},
        {"$set": {
            "status": "COUNTERED",
            "counter_message": payload.message.strip(),
            "counter_cash_adjustment": float(payload.cash_adjustment) if payload.cash_adjustment is not None else None,
            "counter_offered_listing_id": payload.offered_listing_id,
            "counter_custom_item_title": payload.custom_item_title,
            "counter_custom_item_description": payload.custom_item_description,
            "counter_custom_item_condition": payload.custom_item_condition,
            "counter_custom_item_image": str(payload.custom_item_image) if payload.custom_item_image else None,
            "updated_at": now,
        }},
    )
    updated = await offers_collection.find_one({"_id": offer["_id"]})
    counter_title, counter_message = counter_received_copy(offer.get("listing_title"))
    asyncio.create_task(create_notification(
        user_id=offer["offering_user_id"],
        title=counter_title,
        message=counter_message,
        type_="exchange_counter_received",
        action_url=f"/items/{offer['listing_id']}",
        dedupe_key=f"exchange_counter_received:{offer_id}:{now.isoformat()}",
    ))
    return await _serialize_with_listing(offers_collection, items_collection, updated)


@router.patch("/exchange-offers/{offer_id}/accept-counter", response_model=ExchangeOfferResponse)
async def accept_counter_offer(offer_id: str, current_user: dict = Depends(get_verified_user)):
    offers_collection = await get_exchange_offers_collection_async()
    items_collection = await get_items_collection_async()
    transactions_collection = await get_exchange_transactions_collection_async()
    shipping_collection = await get_exchange_shipping_collection_async()
    users_collection = await get_users_collection_async()
    if not all([offers_collection, items_collection, transactions_collection, shipping_collection, users_collection]):
        raise HTTPException(status_code=503, detail="Database connection is not available.")

    offer = await _get_offer_or_404(offers_collection, offer_id)
    if offer["offering_user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the offer sender can accept a counter offer.")
    _reject_if_expired(offer)
    if offer.get("status") != "COUNTERED":
        raise HTTPException(status_code=400, detail="No counter offer is pending.")

    listing = await items_collection.find_one({"_id": ObjectId(offer["listing_id"])})
    if listing is None:
        raise HTTPException(status_code=404, detail="Listing not found.")

    try:
        updated_offer, _transaction = await accept_exchange_offer(
            offers_collection=offers_collection,
            items_collection=items_collection,
            transactions_collection=transactions_collection,
            shipping_collection=shipping_collection,
            users_collection=users_collection,
            offer=offer,
            listing=listing,
            expected_offer_statuses={"COUNTERED"},
        )
    except ExchangeAcceptConflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=EXCHANGE_ACCEPT_UNAVAILABLE_MESSAGE,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    counter_title, counter_message = counter_accepted_copy(offer.get("listing_title"))
    asyncio.create_task(create_notification(
        user_id=offer["owner_user_id"],
        title=counter_title,
        message=counter_message,
        type_="exchange_counter_accepted",
        action_url=f"/exchange/{updated_offer.get('transaction_id')}",
        dedupe_key=f"exchange_counter_accepted:{updated_offer.get('transaction_id')}",
    ))
    return updated_offer


@router.delete("/exchange-offers/{offer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_exchange_offer(offer_id: str, current_user: dict = Depends(get_current_user)):
    offers_collection = await get_exchange_offers_collection_async()
    if offers_collection is None:
        raise HTTPException(status_code=503, detail="Database connection is not available.")

    offer = await _get_offer_or_404(offers_collection, offer_id)
    if offer["offering_user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="You can only cancel your own exchange offers.")
    _reject_if_expired(offer)
    if offer.get("status") not in {"PENDING", "COUNTERED", "UNDER_REVIEW"}:
        raise HTTPException(status_code=400, detail="This offer cannot be cancelled.")

    await offers_collection.update_one(
        {"_id": offer["_id"]},
        {"$set": {"status": "CANCELLED", "updated_at": utc_now()}},
    )
    asyncio.create_task(create_notification(
        user_id=offer["owner_user_id"],
        title="Exchange Offer Cancelled",
        message=f"A swap offer for \"{offer.get('listing_title', 'your listing')}\" was cancelled.",
        type_="exchange_offer_cancelled",
        action_url=f"/items/{offer['listing_id']}",
    ))
