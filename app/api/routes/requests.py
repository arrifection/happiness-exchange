import asyncio
from datetime import datetime, timezone
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pymongo import DESCENDING
from pymongo.errors import DuplicateKeyError

from app.api.deps.auth import get_current_user, get_verified_user, get_whatsapp_user
from app.db.mongodb import (
    get_conversations_collection_async,
    get_exchange_shipping_collection_async,
    get_items_collection_async,
    get_requests_collection_async,
    get_reviews_collection_async,
    get_users_collection_async,
)
from app.schemas.requests import RequestCreateRequest, RequestResponse
from app.services.auth import parse_object_id
from app.services.requests import build_request_document, serialize_request
from app.services.listing_expiration import is_listing_publicly_active
from app.services.exchange_offers import is_listing_exchange_reserved, item_supports_giveaway
from app.services.notifications import create_notification
from app.services.reputation import build_public_reputation_lookup
from app.services.request_approval import approve_request_and_create_conversations
from app.services.exchange_shipping import build_shipping_document
from app.services.shipment_events import notify_shipment_status
from app.core.rate_limit import check_user_rate_limit

router = APIRouter()
logger = logging.getLogger(__name__)


async def build_request_item_lookup(requests: list[dict]) -> dict[str, dict]:
    """Map item_id -> listing photo and listing mode for request cards.

    Missing entries mean the listing was deleted, so callers fall back to the
    existing placeholder image and treat the mode as unknown.
    """
    item_ids = {str(request.get("item_id")) for request in requests if request.get("item_id")}
    object_ids = [oid for oid in (parse_object_id(item_id) for item_id in item_ids) if oid is not None]
    if not object_ids:
        return {}

    items_collection = await get_items_collection_async()
    if items_collection is None:
        return {}

    cursor = items_collection.find({"_id": {"$in": object_ids}})
    items = await cursor.to_list(length=len(object_ids))
    return {
        str(item["_id"]): {
            "image_url": str(item["image_url"]) if item.get("image_url") else None,
            "listing_mode": (item.get("listing_mode") or "GIVEAWAY").upper(),
        }
        for item in items
    }


@router.post("/requests/{item_id}", response_model=RequestResponse, status_code=status.HTTP_201_CREATED)
async def create_request(
    item_id: str,
    payload: RequestCreateRequest,
    current_user: dict = Depends(get_whatsapp_user),
):
    """Create an interest request for an item."""
    check_user_rate_limit(current_user["id"], "create_request", max_calls=60, window_seconds=3600)
    items_collection = await get_items_collection_async()
    requests_collection = await get_requests_collection_async()
    if items_collection is None or requests_collection is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is not available.",
        )

    reason = payload.reason.strip()
    if len(reason) < 30:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Please explain why you need this item in at least 30 characters.",
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
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot request your own item.",
        )

    if item["status"] != "available":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This item is not currently available for requests.",
        )

    if not item_supports_giveaway(item):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This listing is exchange-only and does not accept give-away requests.",
        )

    if is_listing_exchange_reserved(item) or item.get("giveaway_paused"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Give-away requests are paused while an exchange is in progress.",
        )

    if not is_listing_publicly_active(item):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This listing has expired and is no longer available for requests.",
        )

    request_document = build_request_document(
        item,
        current_user,
        reason=reason,
        requester_city=payload.requester_city,
    )
    request_document["created_at"] = datetime.now(timezone.utc)

    try:
        result = await requests_collection.insert_one(request_document)
    except DuplicateKeyError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already requested this item.",
        )

    created_request = await requests_collection.find_one({"_id": result.inserted_id})
    
    # Notify item owner
    asyncio.create_task(
        create_notification(
            user_id=item["owner_id"],
            title="New Request Received",
            message=f"{current_user.get('name')} requested your item '{item.get('title')}' and shared why they need it.",
            type_="request_received",
            action_url="/requests"
        )
    )
    
    return serialize_request(
        created_request,
        item_image_url=str(item["image_url"]) if item.get("image_url") else None,
        item_listing_mode=(item.get("listing_mode") or "GIVEAWAY").upper(),
    )


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
    item_lookup = await build_request_item_lookup(requests)
    return [
        serialize_request(
            request,
            item_image_url=item_lookup.get(str(request.get("item_id", "")), {}).get("image_url"),
            item_listing_mode=item_lookup.get(str(request.get("item_id", "")), {}).get("listing_mode"),
        )
        for request in requests
    ]


@router.get("/requests/incoming", response_model=list[RequestResponse])
async def list_incoming_requests(current_user: dict = Depends(get_current_user)):
    """Return requests for items owned by the logged-in user."""
    requests_collection = await get_requests_collection_async()
    users_collection = await get_users_collection_async()
    reviews_collection = await get_reviews_collection_async()
    if requests_collection is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is not available.",
        )

    cursor = requests_collection.find(
        {"owner_id": current_user["id"]},
    ).sort("created_at", DESCENDING)
    requests = await cursor.to_list(length=100)

    requester_ids = [str(request["requester_id"]) for request in requests if request.get("requester_id")]
    reputation_lookup: dict[str, dict] = {}
    if requester_ids and users_collection is not None and reviews_collection is not None:
        reputation_lookup = await build_public_reputation_lookup(
            requester_ids,
            users_collection=users_collection,
            reviews_collection=reviews_collection,
        )

    item_lookup = await build_request_item_lookup(requests)
    return [
        serialize_request(
            request,
            requester_reputation=reputation_lookup.get(str(request.get("requester_id", ""))),
            item_image_url=item_lookup.get(str(request.get("item_id", "")), {}).get("image_url"),
            item_listing_mode=item_lookup.get(str(request.get("item_id", "")), {}).get("listing_mode"),
        )
        for request in requests
    ]


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
    item_image_url = str(item["image_url"]) if item.get("image_url") else None
    item_listing_mode = (item.get("listing_mode") or "GIVEAWAY").upper()
    return [
        serialize_request(
            request,
            item_image_url=item_image_url,
            item_listing_mode=item_listing_mode,
        )
        for request in requests
    ]


@router.patch("/requests/{request_id}/{action}", response_model=RequestResponse)
async def update_request_status(
    request_id: str,
    action: str,
    current_user: dict = Depends(get_verified_user),
):
    """Approve a request and reserve the related item.

    This path also matches ``/requests/{id}/reject``, so declines are delegated
    to the dedicated reject handler instead of falling through to approval.
    """
    if action == "reject":
        return await reject_request(request_id, current_user)

    if action != "approve":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported request action.",
        )

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
        if request["status"] == "approved":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Request already processed",
            )
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

    if is_listing_exchange_reserved(item) or item.get("giveaway_paused"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Give-away requests are paused while an exchange is in progress.",
        )

    if not item_supports_giveaway(item):
        # Exchange-only listing: approving invites the requester into the swap
        # flow instead of the give-away flow. The listing deliberately stays
        # available so the requester can still send an exchange offer, and the
        # commitment happens when that offer is accepted.
        await requests_collection.update_one(
            {"_id": request_object_id},
            {"$set": {"status": "approved"}},
        )
        asyncio.create_task(
            create_notification(
                user_id=request["requester_id"],
                title="Swap Request Approved!",
                message=(
                    f"'{item.get('title')}' is a swap-only listing. Send your swap offer "
                    "to choose what you are offering in exchange."
                ),
                type_="request_approved",
                action_url="/requests",
            )
        )
        updated_request = await requests_collection.find_one({"_id": request_object_id})
        return serialize_request(
            updated_request,
            item_image_url=str(item["image_url"]) if item.get("image_url") else None,
            item_listing_mode=(item.get("listing_mode") or "GIVEAWAY").upper(),
        )

    conversations_collection = await get_conversations_collection_async()
    users_collection = await get_users_collection_async()

    await approve_request_and_create_conversations(
        requests_collection=requests_collection,
        items_collection=items_collection,
        conversations_collection=conversations_collection,
        users_collection=users_collection,
        request_object_id=request_object_id,
        request=request,
        item=item,
        item_object_id=item_object_id,
        current_user=current_user,
    )

    # Notify requester
    asyncio.create_task(
        create_notification(
            user_id=request["requester_id"],
            title="Request Approved!",
            message=f"Your request for '{item.get('title')}' was approved. Add shipping details to continue.",
            type_="request_approved",
            action_url="/requests"
        )
    )

    try:
        shipping_collection = await get_exchange_shipping_collection_async()
        if shipping_collection is not None:
            existing = await shipping_collection.find_one({
                "transaction_type": "GIVEAWAY",
                "transaction_id": str(request_object_id),
            })
            if existing is None:
                giver_name = request.get("owner_name") or item.get("owner_name") or current_user.get("name", "")
                taker_name = request.get("requester_name") or ""
                shipment = build_shipping_document(
                    exchange_transaction_id=str(request_object_id),
                    sender_user_id=request["owner_id"],
                    sender_user_name=giver_name,
                    receiver_user_id=request["requester_id"],
                    receiver_user_name=taker_name,
                    transaction_type="GIVEAWAY",
                    item_title=item.get("title"),
                    payer_user_id=request["requester_id"],
                )
                inserted = await shipping_collection.insert_one(shipment)
                shipment["_id"] = inserted.inserted_id
                notify_shipment_status(shipment, None, "PENDING")
                asyncio.create_task(create_notification(
                    user_id=request["requester_id"],
                    title="Shipping Details Needed",
                    message="The giver accepted your request. Submit your delivery address so admin can arrange shipping.",
                    type_="giveaway_shipping_pending",
                    action_url=f"/tracking/{inserted.inserted_id}",
                    dedupe_key=f"giveaway_shipping_pending:{inserted.inserted_id}",
                ))
    except Exception:
        logger.exception("Could not create Give Away shipment after request approval.")

    updated_request = await requests_collection.find_one({"_id": request_object_id})
    return serialize_request(updated_request)


@router.delete("/requests/{request_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_request(
    request_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Allow the requester to withdraw a pending request or clear a rejected one."""
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

    if request["requester_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the requester can cancel this request.",
        )

    if request["status"] not in {"pending", "rejected"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending or declined requests can be removed.",
        )

    await requests_collection.delete_one({"_id": request_object_id})



@router.patch("/requests/{request_id}/reject", response_model=RequestResponse)
async def reject_request(
    request_id: str,
    current_user: dict = Depends(get_verified_user),
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
    
    # Notify requester
    asyncio.create_task(
        create_notification(
            user_id=request["requester_id"],
            title="Request Declined",
            message=f"Your request was declined by the owner.",
            type_="request_rejected",
            action_url="/requests"
        )
    )
    
    updated_request = await requests_collection.find_one({"_id": request_object_id})
    return serialize_request(updated_request)

