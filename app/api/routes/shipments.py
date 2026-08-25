"""User shipment tracking APIs. Never returns partner address or phone."""

from datetime import timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pymongo import DESCENDING

from app.api.deps.auth import get_current_user, get_verified_user
from app.db.mongodb import get_exchange_shipping_collection_async
from app.schemas.exchange import ExchangePayShippingRequest, ExchangeShippingDetailsRequest
from app.services.auth import parse_object_id
from app.services.exchange_shipping import apply_shipping_details, serialize_shipping_for_participant, utc_now
from app.services.shipment_events import notify_shipment_status, notify_tracking_updated

router = APIRouter()

PRIVATE_KEYS = (
    "encrypted_full_name",
    "encrypted_phone_number",
    "encrypted_address_line1",
    "encrypted_address_line2",
    "encrypted_city",
    "encrypted_state",
    "encrypted_postal_code",
    "encrypted_country",
    "encrypted_notes",
    "full_name",
    "phone_number",
    "address_line1",
    "address_line2",
    "city",
    "state",
    "postal_code",
    "country",
    "notes",
    "admin_notes",
    "payment_reference",
)


def _is_participant(shipping: dict, user_id: str) -> bool:
    return user_id in {
        shipping.get("sender_user_id"),
        shipping.get("receiver_user_id"),
        shipping.get("payer_user_id"),
    }


def _public_for_user(shipping: dict, user_id: str) -> dict:
    payload = serialize_shipping_for_participant(shipping, user_id)
    for key in PRIVATE_KEYS:
        payload.pop(key, None)
    is_own_outbound = shipping.get("sender_user_id") == user_id
    is_payer = (shipping.get("payer_user_id") or shipping.get("sender_user_id")) == user_id
    if not is_own_outbound:
        payload["admin_instructions"] = None
        payload["shipping_cost"] = None
        payload["payment_due_at"] = None
    if not is_payer:
        payload["payment_reference"] = None
    payload["viewer_role"] = "sender" if is_own_outbound else "receiver"
    payload["details_submitted"] = bool(shipping.get("encrypted_address_line1"))
    return payload


async def _get_shipping_or_404(shipping_id: str):
    collection = await get_exchange_shipping_collection_async()
    if collection is None:
        raise HTTPException(status_code=503, detail="Database connection is not available.")
    object_id = parse_object_id(shipping_id)
    if object_id is None:
        raise HTTPException(status_code=400, detail="Invalid shipment id.")
    shipping = await collection.find_one({"_id": object_id})
    if shipping is None:
        raise HTTPException(status_code=404, detail="Shipment not found.")
    return collection, shipping


@router.get("/shipments/my")
async def list_my_shipments(current_user: dict = Depends(get_current_user)):
    collection = await get_exchange_shipping_collection_async()
    if collection is None:
        raise HTTPException(status_code=503, detail="Database connection is not available.")
    user_id = current_user["id"]
    query = {
        "$or": [
            {"sender_user_id": user_id},
            {"receiver_user_id": user_id},
            {"payer_user_id": user_id},
        ]
    }
    results = []
    async for shipping in collection.find(query).sort("updated_at", DESCENDING):
        results.append(_public_for_user(shipping, user_id))
    return {"shipments": results, "total": len(results)}


@router.get("/shipments/{shipment_id}")
async def get_shipment(shipment_id: str, current_user: dict = Depends(get_current_user)):
    _collection, shipping = await _get_shipping_or_404(shipment_id)
    if not _is_participant(shipping, current_user["id"]):
        raise HTTPException(status_code=403, detail="You do not have access to this shipment.")
    payload = _public_for_user(shipping, current_user["id"])

    related = []
    collection = await get_exchange_shipping_collection_async()
    transaction_id = shipping.get("transaction_id") or shipping.get("exchange_transaction_id")
    if collection is not None and transaction_id:
        async for record in collection.find({
            "$or": [
                {"transaction_id": transaction_id},
                {"exchange_transaction_id": transaction_id},
            ]
        }):
            if str(record["_id"]) == str(shipping["_id"]):
                continue
            if _is_participant(record, current_user["id"]):
                related.append(_public_for_user(record, current_user["id"]))
    payload["related_shipments"] = related
    return payload


@router.post("/shipments/{shipment_id}/shipping-details")
async def submit_shipment_details(
    shipment_id: str,
    payload: ExchangeShippingDetailsRequest,
    current_user: dict = Depends(get_verified_user),
):
    collection, shipping = await _get_shipping_or_404(shipment_id)
    user_id = current_user["id"]
    if not _is_participant(shipping, user_id):
        raise HTTPException(status_code=403, detail="You do not have access to this shipment.")
    payer_id = shipping.get("payer_user_id") or shipping.get("sender_user_id")
    allowed = {shipping.get("sender_user_id"), payer_id}
    if shipping.get("transaction_type") == "GIVEAWAY":
        allowed.add(shipping.get("receiver_user_id"))
    if user_id not in allowed:
        raise HTTPException(status_code=403, detail="You cannot submit shipping details for this shipment.")
    if shipping.get("encrypted_address_line1"):
        raise HTTPException(status_code=400, detail="Shipping details were already submitted.")
    updates = apply_shipping_details(shipping, payload)
    await collection.update_one({"_id": shipping["_id"]}, {"$set": updates})
    notify_shipment_status(shipping, shipping.get("shipping_status"), "PAYMENT_REQUIRED")
    updated = await collection.find_one({"_id": shipping["_id"]})
    return _public_for_user(updated, user_id)


@router.post("/shipments/{shipment_id}/pay-shipping")
async def pay_shipment(
    shipment_id: str,
    payload: ExchangePayShippingRequest,
    current_user: dict = Depends(get_verified_user),
):
    collection, shipping = await _get_shipping_or_404(shipment_id)
    user_id = current_user["id"]
    payer_id = shipping.get("payer_user_id") or shipping.get("sender_user_id")
    if user_id != payer_id:
        raise HTTPException(status_code=403, detail="Only the shipping payer can submit payment.")
    if not shipping.get("encrypted_address_line1"):
        raise HTTPException(status_code=400, detail="Submit shipping details before payment.")
    if shipping.get("shipping_cost") is None:
        raise HTTPException(status_code=400, detail="Shipping cost has not been set by admin yet.")
    if shipping.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="Shipping has already been paid.")

    due_at = shipping.get("payment_due_at")
    if due_at and due_at.tzinfo is None:
        due_at = due_at.replace(tzinfo=timezone.utc)
    if due_at and utc_now() > due_at:
        raise HTTPException(status_code=400, detail="Shipping payment deadline has passed.")

    now = utc_now()
    await collection.update_one(
        {"_id": shipping["_id"]},
        {"$set": {
            "payment_status": "paid",
            "payment_reference": payload.payment_reference.strip(),
            "payment_paid_at": now,
            "shipping_status": "ready_to_ship",
            "status": "READY_TO_SHIP",
            "updated_at": now,
        }},
    )
    notify_shipment_status(shipping, shipping.get("shipping_status"), "PAYMENT_CONFIRMED")
    notify_shipment_status({**shipping, "_id": shipping["_id"]}, "PAYMENT_CONFIRMED", "READY_TO_SHIP")
    updated = await collection.find_one({"_id": shipping["_id"]})
    return _public_for_user(updated, user_id)
