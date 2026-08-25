"""Admin shipping management for Give Away and Exchange shipments."""

from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo import DESCENDING

from app.api.deps.admin import require_permission
from app.core.admin_permissions import PERMISSION_DELIVERIES
from app.db.mongodb import get_exchange_shipping_collection_async
from app.schemas.exchange import AdminExchangeShippingUpdateRequest
from app.services.auth import parse_object_id
from app.services.exchange_shipping import serialize_shipping_admin, utc_now
from app.services.shipment_events import notify_shipment_status, notify_tracking_updated
from app.services.shipping_providers import public_carrier_tracking_url
from app.services.shipping_status import canonical_status, storage_status

router = APIRouter()


def _admin_row(shipping: dict) -> dict:
    payload = serialize_shipping_admin(shipping)
    payload["transaction_id"] = shipping.get("transaction_id") or shipping.get("exchange_transaction_id")
    payload["transaction_type"] = shipping.get("transaction_type") or "EXCHANGE"
    payload["item_title"] = shipping.get("item_title")
    return payload


@router.get("/shipments")
async def admin_list_shipments(
    q: str = Query("", description="Search shipment id, tracking number, user name, or user id"),
    transaction_type: str = Query("", description="EXCHANGE or GIVEAWAY"),
    status_filter: str = Query("", alias="status"),
    admin: dict = Depends(require_permission(PERMISSION_DELIVERIES)),
):
    del admin
    collection = await get_exchange_shipping_collection_async()
    if collection is None:
        raise HTTPException(status_code=503, detail="Database connection is not available.")

    query: dict = {}
    if transaction_type:
        query["transaction_type"] = transaction_type.upper()
    if status_filter:
        canonical = canonical_status(status_filter)
        query["$or"] = [
            {"status": canonical},
            {"shipping_status": storage_status(canonical)},
        ]

    results = []
    needle = q.strip().lower()
    async for shipping in collection.find(query).sort("updated_at", DESCENDING):
        row = _admin_row(shipping)
        if needle:
            haystack = " ".join([
                str(row.get("id") or ""),
                str(row.get("tracking_number") or ""),
                str(row.get("sender_user_id") or ""),
                str(row.get("receiver_user_id") or ""),
                str(row.get("sender_user_name") or ""),
                str(row.get("receiver_user_name") or ""),
                str(row.get("transaction_id") or ""),
                str(row.get("item_title") or ""),
            ]).lower()
            if needle not in haystack:
                continue
        results.append(row)

    grouped = {}
    for row in results:
        key = f"{row.get('transaction_type')}:{row.get('transaction_id')}"
        grouped.setdefault(key, []).append(row)
    return {"shipments": results, "groups": grouped, "total": len(results)}


@router.get("/shipments/{shipment_id}")
async def admin_get_shipment(
    shipment_id: str,
    admin: dict = Depends(require_permission(PERMISSION_DELIVERIES)),
):
    del admin
    collection = await get_exchange_shipping_collection_async()
    if collection is None:
        raise HTTPException(status_code=503, detail="Database connection is not available.")
    object_id = parse_object_id(shipment_id)
    if object_id is None:
        raise HTTPException(status_code=400, detail="Invalid shipment id.")
    shipping = await collection.find_one({"_id": object_id})
    if shipping is None:
        raise HTTPException(status_code=404, detail="Shipment not found.")
    payload = _admin_row(shipping)
    related = []
    transaction_id = payload.get("transaction_id")
    if transaction_id:
        async for record in collection.find({
            "$or": [
                {"transaction_id": transaction_id},
                {"exchange_transaction_id": transaction_id},
            ]
        }):
            if str(record["_id"]) != shipment_id:
                related.append(_admin_row(record))
    payload["related_shipments"] = related
    return payload


@router.patch("/shipments/{shipment_id}")
async def admin_update_shipment(
    shipment_id: str,
    payload: AdminExchangeShippingUpdateRequest,
    admin: dict = Depends(require_permission(PERMISSION_DELIVERIES)),
):
    del admin
    collection = await get_exchange_shipping_collection_async()
    if collection is None:
        raise HTTPException(status_code=503, detail="Database connection is not available.")
    object_id = parse_object_id(shipment_id)
    if object_id is None:
        raise HTTPException(status_code=400, detail="Invalid shipment id.")
    shipping = await collection.find_one({"_id": object_id})
    if shipping is None:
        raise HTTPException(status_code=404, detail="Shipment not found.")

    previous_status = shipping.get("shipping_status") or shipping.get("status")
    previous_tracking = shipping.get("tracking_number")
    now = utc_now()
    updates: dict = {"updated_at": now}

    if payload.shipping_cost is not None:
        updates["shipping_cost"] = payload.shipping_cost
    if payload.payment_status is not None:
        updates["payment_status"] = payload.payment_status
    if payload.tracking_number is not None:
        updates["tracking_number"] = payload.tracking_number
    if payload.carrier is not None:
        updates["carrier"] = payload.carrier
    if payload.tracking_url is not None:
        updates["tracking_url"] = payload.tracking_url
    if payload.estimated_delivery is not None:
        updates["estimated_delivery"] = payload.estimated_delivery
    if payload.admin_notes is not None:
        updates["admin_notes"] = payload.admin_notes
    if payload.admin_instructions is not None:
        updates["admin_instructions"] = payload.admin_instructions
    if payload.shipping_status is not None:
        canonical = canonical_status(payload.shipping_status)
        updates["status"] = canonical
        updates["shipping_status"] = storage_status(canonical)
        if canonical in {"PICKED_UP", "IN_TRANSIT"} and not shipping.get("shipped_at"):
            updates["shipped_at"] = now
        if canonical == "DELIVERED":
            updates["delivered_at"] = now

    carrier = updates.get("carrier", shipping.get("carrier"))
    tracking_number = updates.get("tracking_number", shipping.get("tracking_number"))
    if tracking_number and not updates.get("tracking_url") and not shipping.get("tracking_url"):
        generated = public_carrier_tracking_url(carrier, tracking_number)
        if generated:
            updates["tracking_url"] = generated

    await collection.update_one({"_id": object_id}, {"$set": updates})
    updated = await collection.find_one({"_id": object_id})

    if payload.shipping_status is not None:
        notify_shipment_status(updated, previous_status, updates.get("status"))
    if payload.tracking_number is not None and updates.get("tracking_number") != previous_tracking:
        notify_tracking_updated(updated)
    if payload.shipping_cost is not None and shipping.get("shipping_cost") != payload.shipping_cost:
        notify_shipment_status(updated, previous_status, "PAYMENT_REQUIRED")

    return _admin_row(updated)
