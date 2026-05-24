from datetime import datetime, timezone
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps.auth import get_verified_user
from app.db.mongodb import (
    get_deliveries_collection_async,
    get_requests_collection_async,
    get_items_collection_async,
)
from app.schemas.deliveries import (
    DeliveryCreateRequest,
    DeliveryDropoffRequest,
    DeliveryResponse,
)
from app.services.auth import parse_object_id
from app.services.encryption import encrypt_text
from app.services.notifications import create_notification

router = APIRouter()

def serialize_delivery_public(doc: dict, user_id: str) -> dict:
    """
    Serializes a delivery for a normal user.
    Hides the OTHER party's encrypted fields for privacy.
    """
    safe_doc = {
        "id": str(doc["_id"]),
        "request_id": doc["request_id"],
        "item_id": doc["item_id"],
        "item_title": doc.get("item_title", "Unknown Item"),
        "giver_id": doc["giver_id"],
        "receiver_id": doc["receiver_id"],
        "status": doc["status"],
        "courier_id": doc.get("courier_id"),
        "proof_of_delivery_url": doc.get("proof_of_delivery_url"),
        "notes": doc.get("notes"),
        "created_at": doc["created_at"],
        "updated_at": doc["updated_at"],
    }
    
    # Giver can see their own pickup details (encrypted, so we don't show the raw here, 
    # but the frontend doesn't need to decrypt it to know it was submitted).
    # We just return placeholders so the UI knows they exist.
    if doc["giver_id"] == user_id:
        safe_doc["pickup_address"] = "[Submitted]" if doc.get("pickup_address") else None
        safe_doc["pickup_contact_number"] = "[Submitted]" if doc.get("pickup_contact_number") else None
        safe_doc["pickup_preferred_time"] = "[Submitted]" if doc.get("pickup_preferred_time") else None
        safe_doc["pickup_notes"] = "[Submitted]" if doc.get("pickup_notes") else None
    else:
        safe_doc["pickup_address"] = "[Hidden for privacy]" if doc.get("pickup_address") else None

    # Receiver can see their own dropoff details placeholders.
    if doc["receiver_id"] == user_id:
        safe_doc["dropoff_address"] = "[Submitted]" if doc.get("dropoff_address") else None
        safe_doc["receiver_contact_number"] = "[Submitted]" if doc.get("receiver_contact_number") else None
        safe_doc["dropoff_preferred_time"] = "[Submitted]" if doc.get("dropoff_preferred_time") else None
        safe_doc["dropoff_notes"] = "[Submitted]" if doc.get("dropoff_notes") else None
    else:
        safe_doc["dropoff_address"] = "[Hidden for privacy]" if doc.get("dropoff_address") else None

    return safe_doc


@router.post("/deliveries", response_model=DeliveryResponse, status_code=status.HTTP_201_CREATED)
async def create_delivery(
    payload: DeliveryCreateRequest,
    current_user: dict = Depends(get_verified_user),
):
    """
    Giver initializes the delivery with their pickup address.
    """
    deliveries_col = await get_deliveries_collection_async()
    requests_col = await get_requests_collection_async()
    items_col = await get_items_collection_async()
    
    if deliveries_col is None or requests_col is None or items_col is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
        
    req_oid = parse_object_id(payload.request_id)
    if not req_oid:
        raise HTTPException(status_code=400, detail="Invalid request ID")
        
    request_doc = await requests_col.find_one({"_id": req_oid})
    if not request_doc:
        raise HTTPException(status_code=404, detail="Request not found")
        
    if request_doc["owner_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the giver can initiate delivery")
        
    if request_doc["status"] != "approved":
        raise HTTPException(status_code=400, detail="Request is not approved")
        
    existing = await deliveries_col.find_one({"request_id": payload.request_id})
    if existing:
        raise HTTPException(status_code=400, detail="Delivery already initiated for this request")
        
    item_doc = await items_col.find_one({"_id": parse_object_id(request_doc["item_id"])})
    item_title = item_doc["title"] if item_doc else "Unknown Item"

    now = datetime.now(timezone.utc)
    
    delivery_doc = {
        "request_id": payload.request_id,
        "item_id": request_doc["item_id"],
        "item_title": item_title,
        "giver_id": current_user["id"],
        "receiver_id": request_doc["requester_id"],
        "status": "awaiting_dropoff_address",
        
        "pickup_address": encrypt_text(payload.pickup_address),
        "pickup_contact_number": encrypt_text(payload.pickup_contact_number),
        "pickup_preferred_time": encrypt_text(payload.pickup_preferred_time),
        "pickup_notes": encrypt_text(payload.pickup_notes) if payload.pickup_notes else None,
        
        "created_at": now,
        "updated_at": now,
    }
    
    result = await deliveries_col.insert_one(delivery_doc)
    created = await deliveries_col.find_one({"_id": result.inserted_id})
    
    import asyncio
    asyncio.create_task(
        create_notification(
            user_id=request_doc["requester_id"],
            title="Delivery Address Needed",
            message=f"The giver for '{item_title}' is arranging delivery. Please provide your drop-off address.",
            type_="delivery_address_needed",
            action_url=f"/deliveries/{str(result.inserted_id)}"
        )
    )
    
    return serialize_delivery_public(created, current_user["id"])


@router.post("/deliveries/{delivery_id}/dropoff", response_model=DeliveryResponse)
async def submit_dropoff(
    delivery_id: str,
    payload: DeliveryDropoffRequest,
    current_user: dict = Depends(get_verified_user),
):
    """
    Receiver submits their dropoff address.
    """
    deliveries_col = await get_deliveries_collection_async()
    if deliveries_col is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
        
    del_oid = parse_object_id(delivery_id)
    if not del_oid:
        raise HTTPException(status_code=400, detail="Invalid delivery ID")
        
    delivery_doc = await deliveries_col.find_one({"_id": del_oid})
    if not delivery_doc:
        raise HTTPException(status_code=404, detail="Delivery not found")
        
    if delivery_doc["receiver_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the receiver can submit dropoff details")
        
    if delivery_doc["status"] != "awaiting_dropoff_address":
        raise HTTPException(status_code=400, detail="Dropoff address not expected in current state")
        
    update_data = {
        "dropoff_address": encrypt_text(payload.dropoff_address),
        "receiver_contact_number": encrypt_text(payload.receiver_contact_number),
        "dropoff_preferred_time": encrypt_text(payload.dropoff_preferred_time),
        "dropoff_notes": encrypt_text(payload.dropoff_notes) if payload.dropoff_notes else None,
        "status": "ready_for_courier",
        "updated_at": datetime.now(timezone.utc)
    }
    
    await deliveries_col.update_one({"_id": del_oid}, {"$set": update_data})
    
    import asyncio
    asyncio.create_task(
        create_notification(
            user_id=delivery_doc["giver_id"],
            title="Courier Delivery Ready",
            message=f"The receiver provided their address for '{delivery_doc['item_title']}'. It is now ready for a courier.",
            type_="delivery_ready",
            action_url=f"/deliveries/{delivery_id}"
        )
    )
    
    updated = await deliveries_col.find_one({"_id": del_oid})
    return serialize_delivery_public(updated, current_user["id"])


@router.get("/deliveries/my", response_model=list[DeliveryResponse])
async def list_my_deliveries(current_user: dict = Depends(get_verified_user)):
    """Return deliveries involving the user."""
    deliveries_col = await get_deliveries_collection_async()
    if deliveries_col is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
        
    cursor = deliveries_col.find({
        "$or": [{"giver_id": current_user["id"]}, {"receiver_id": current_user["id"]}]
    }).sort("updated_at", -1)
    
    deliveries = await cursor.to_list(length=100)
    return [serialize_delivery_public(d, current_user["id"]) for d in deliveries]


@router.get("/deliveries/{delivery_id}", response_model=DeliveryResponse)
async def get_delivery(delivery_id: str, current_user: dict = Depends(get_verified_user)):
    """Return a single delivery's masked info."""
    deliveries_col = await get_deliveries_collection_async()
    if deliveries_col is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
        
    del_oid = parse_object_id(delivery_id)
    if not del_oid:
        raise HTTPException(status_code=400, detail="Invalid delivery ID")
        
    delivery_doc = await deliveries_col.find_one({"_id": del_oid})
    if not delivery_doc:
        raise HTTPException(status_code=404, detail="Delivery not found")
        
    if current_user["id"] not in (delivery_doc["giver_id"], delivery_doc["receiver_id"]):
        raise HTTPException(status_code=403, detail="Not authorized to view this delivery")
        
    return serialize_delivery_public(delivery_doc, current_user["id"])


@router.post("/deliveries/{delivery_id}/confirm", response_model=DeliveryResponse)
async def confirm_delivery(delivery_id: str, current_user: dict = Depends(get_verified_user)):
    """User confirms delivery is complete."""
    deliveries_col = await get_deliveries_collection_async()
    if deliveries_col is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
        
    del_oid = parse_object_id(delivery_id)
    if not del_oid:
        raise HTTPException(status_code=400, detail="Invalid delivery ID")
        
    delivery_doc = await deliveries_col.find_one({"_id": del_oid})
    if not delivery_doc:
        raise HTTPException(status_code=404, detail="Delivery not found")
        
    if current_user["id"] not in (delivery_doc["giver_id"], delivery_doc["receiver_id"]):
        raise HTTPException(status_code=403, detail="Not authorized")
        
    if delivery_doc["status"] != "delivered":
        raise HTTPException(status_code=400, detail="Delivery must be marked delivered by courier first")
        
    # Mark completed
    await deliveries_col.update_one(
        {"_id": del_oid},
        {"$set": {"status": "completed", "updated_at": datetime.now(timezone.utc)}}
    )
    
    updated = await deliveries_col.find_one({"_id": del_oid})
    return serialize_delivery_public(updated, current_user["id"])
