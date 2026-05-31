from datetime import datetime, timezone
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile

from app.api.deps.admin import require_permission
from app.core.admin_permissions import PERMISSION_DELIVERIES
from app.db.mongodb import get_deliveries_collection_async
from app.schemas.deliveries import DeliveryResponse, DeliveryStatusUpdateRequest
from app.services.auth import parse_object_id
from app.services.encryption import decrypt_text
from app.services.notifications import create_notification
from app.services.cloudinary import upload_image_to_cloudinary, CloudinaryConfigError, CloudinaryUploadError
from app.services.image_validation import validate_and_sanitize_image

router = APIRouter()

def serialize_delivery_admin(doc: dict) -> dict:
    """
    Serializes a delivery for couriers/admins, decrypting the sensitive addresses.
    """
    return {
        "id": str(doc["_id"]),
        "request_id": doc["request_id"],
        "item_id": doc["item_id"],
        "item_title": doc.get("item_title", "Unknown Item"),
        "giver_id": doc["giver_id"],
        "receiver_id": doc["receiver_id"],
        "status": doc["status"],
        
        "pickup_address": decrypt_text(doc.get("pickup_address", "")),
        "pickup_contact_number": decrypt_text(doc.get("pickup_contact_number", "")),
        "pickup_preferred_time": decrypt_text(doc.get("pickup_preferred_time", "")),
        "pickup_notes": decrypt_text(doc.get("pickup_notes", "")),
        
        "dropoff_address": decrypt_text(doc.get("dropoff_address", "")),
        "receiver_contact_number": decrypt_text(doc.get("receiver_contact_number", "")),
        "dropoff_preferred_time": decrypt_text(doc.get("dropoff_preferred_time", "")),
        "dropoff_notes": decrypt_text(doc.get("dropoff_notes", "")),
        
        "courier_id": doc.get("courier_id"),
        "proof_of_delivery_url": doc.get("proof_of_delivery_url"),
        "notes": doc.get("notes"),
        
        "created_at": doc["created_at"],
        "updated_at": doc["updated_at"],
    }

@router.get("/deliveries", response_model=list[DeliveryResponse])
async def list_deliveries(current_admin: dict = Depends(require_permission(PERMISSION_DELIVERIES))):
    """Courier dashboard: lists all ready or active deliveries with decrypted addresses."""
    deliveries_col = await get_deliveries_collection_async()
    if deliveries_col is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
        
    cursor = deliveries_col.find({
        "status": {"$in": [
            "ready_for_courier", 
            "assigned", 
            "picked_up", 
            "in_transit", 
            "delivered",
            "completed"
        ]}
    }).sort("updated_at", -1)
    
    deliveries = await cursor.to_list(length=200)
    return [serialize_delivery_admin(d) for d in deliveries]

@router.patch("/deliveries/{delivery_id}/status", response_model=DeliveryResponse)
async def update_delivery_status(
    delivery_id: str,
    payload: DeliveryStatusUpdateRequest,
    current_admin: dict = Depends(require_permission(PERMISSION_DELIVERIES))
):
    """Update delivery status (e.g. assigned -> picked_up -> delivered)."""
    deliveries_col = await get_deliveries_collection_async()
    if deliveries_col is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
        
    del_oid = parse_object_id(delivery_id)
    if not del_oid:
        raise HTTPException(status_code=400, detail="Invalid delivery ID")
        
    doc = await deliveries_col.find_one({"_id": del_oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Delivery not found")
        
    valid_statuses = ["assigned", "picked_up", "in_transit", "delivered", "cancelled"]
    if payload.status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Invalid status update")
        
    update_data = {
        "status": payload.status,
        "updated_at": datetime.now(timezone.utc)
    }
    if payload.status == "assigned" and not doc.get("courier_id"):
        update_data["courier_id"] = current_admin["id"]
        
    if payload.notes:
        update_data["notes"] = payload.notes
        
    await deliveries_col.update_one({"_id": del_oid}, {"$set": update_data})
    
    # Send notifications
    import asyncio
    if payload.status == "picked_up":
        asyncio.create_task(create_notification(
            user_id=doc["receiver_id"],
            title="Item Picked Up!",
            message=f"The courier has picked up '{doc['item_title']}' and it will be in transit soon.",
            type_="delivery_picked_up",
            action_url=f"/deliveries/{delivery_id}"
        ))
    elif payload.status == "delivered":
        asyncio.create_task(create_notification(
            user_id=doc["giver_id"],
            title="Item Delivered!",
            message=f"Your item '{doc['item_title']}' has been delivered to the receiver.",
            type_="delivery_delivered",
            action_url=f"/deliveries/{delivery_id}"
        ))
        asyncio.create_task(create_notification(
            user_id=doc["receiver_id"],
            title="Item Delivered!",
            message=f"Your requested item '{doc['item_title']}' has been delivered. Please confirm completion.",
            type_="delivery_delivered",
            action_url=f"/deliveries/{delivery_id}"
        ))
        
    updated = await deliveries_col.find_one({"_id": del_oid})
    return serialize_delivery_admin(updated)

@router.patch("/deliveries/{delivery_id}/proof", response_model=DeliveryResponse)
async def upload_proof(
    delivery_id: str,
    file: UploadFile = File(...),
    current_admin: dict = Depends(require_permission(PERMISSION_DELIVERIES))
):
    """Courier uploads proof of delivery photo."""
    deliveries_col = await get_deliveries_collection_async()
    if deliveries_col is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
        
    del_oid = parse_object_id(delivery_id)
    if not del_oid:
        raise HTTPException(status_code=400, detail="Invalid delivery ID")
        
    doc = await deliveries_col.find_one({"_id": del_oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Delivery not found")

    file_bytes = await file.read()
    await file.close()

    clean_bytes, content_type, safe_name = validate_and_sanitize_image(
        file_name=file.filename,
        file_bytes=file_bytes,
        content_type=file.content_type,
    )

    try:
        secure_url = await upload_image_to_cloudinary(
            file_name=f"pod-{delivery_id}-{int(datetime.now(timezone.utc).timestamp())}",
            content_type=content_type,
            file_bytes=clean_bytes,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    await deliveries_col.update_one(
        {"_id": del_oid},
        {"$set": {
            "proof_of_delivery_url": secure_url,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    updated = await deliveries_col.find_one({"_id": del_oid})
    return serialize_delivery_admin(updated)
