import asyncio
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pymongo import DESCENDING

from app.api.deps.admin import require_permission
from app.core.admin_permissions import PERMISSION_DELIVERIES
from app.db.mongodb import (
    get_exchange_offers_collection_async,
    get_exchange_shipping_collection_async,
    get_exchange_transactions_collection_async,
    get_items_collection_async,
)
from app.schemas.exchange import AdminExchangeShippingUpdateRequest, AdminExchangeTransactionStatusRequest
from app.services.auth import parse_object_id
from app.services.exchange_notifications import (
    cancelled_copy,
    item_delivered_copy,
    item_shipped_copy,
    shipping_payment_required_copy,
    tracking_updated_copy,
)
from app.services.exchange_shipping import serialize_shipping_admin, utc_now
from app.services.shipping_providers import public_carrier_tracking_url
from app.services.shipping_status import canonical_status, storage_status
from app.services.shipment_events import notify_shipment_status, notify_tracking_updated
from app.services.exchange_transactions import serialize_transaction
from app.services.exchange_workflow import expire_unpaid_exchange, release_listing_after_exchange_failure, sync_transaction_progress
from app.services.notifications import create_notification

router = APIRouter()


async def _load_shipping_records(shipping_collection, transaction_id: str) -> list[dict]:
    records = []
    async for record in shipping_collection.find({"exchange_transaction_id": transaction_id}):
        records.append(record)
    return records


async def _admin_transaction_summary(
    transaction: dict,
    shipping_records: list[dict],
    items_collection,
    offers_collection,
) -> dict:
    """Public shipping summary plus listing/offer context. No decrypted PII."""
    payload = serialize_transaction(transaction, shipping_records)
    payload["updated_at"] = transaction.get("updated_at") or payload.get("created_at")

    listing_oid = parse_object_id(transaction.get("listing_id") or "")
    if listing_oid is not None and items_collection is not None:
        listing = await items_collection.find_one({"_id": listing_oid})
        if listing:
            image = listing.get("image_url")
            payload["listing_image_url"] = str(image) if image else None

    offer_oid = parse_object_id(transaction.get("exchange_offer_id") or "")
    if offer_oid is not None and offers_collection is not None:
        offer = await offers_collection.find_one({"_id": offer_oid})
        if offer:
            payload["offered_item_title"] = (
                offer.get("custom_item_title")
                or offer.get("offered_listing_title")
                or offer.get("counter_custom_item_title")
            )
            offered_image = offer.get("custom_item_image") or offer.get("counter_custom_item_image")
            if not offered_image and offer.get("offered_listing_id") and items_collection is not None:
                offered_oid = parse_object_id(offer["offered_listing_id"])
                if offered_oid is not None:
                    offered_listing = await items_collection.find_one({"_id": offered_oid})
                    if offered_listing:
                        payload["offered_item_title"] = payload.get("offered_item_title") or offered_listing.get("title")
                        offered_image = offered_listing.get("image_url")
            payload["offered_item_image"] = str(offered_image) if offered_image else None
    return payload


@router.get("/exchange-transactions")
async def admin_list_exchange_transactions(
    admin: dict = Depends(require_permission(PERMISSION_DELIVERIES)),
):
    del admin
    transactions_collection = await get_exchange_transactions_collection_async()
    shipping_collection = await get_exchange_shipping_collection_async()
    items_collection = await get_items_collection_async()
    offers_collection = await get_exchange_offers_collection_async()
    if transactions_collection is None or shipping_collection is None:
        raise HTTPException(status_code=503, detail="Database connection is not available.")

    results = []
    cursor = transactions_collection.find({}).sort("created_at", DESCENDING)
    async for transaction in cursor:
        transaction_id = str(transaction["_id"])
        shipping_records = await _load_shipping_records(shipping_collection, transaction_id)
        results.append(await _admin_transaction_summary(
            transaction,
            shipping_records,
            items_collection,
            offers_collection,
        ))
    return {"transactions": results, "total": len(results)}


@router.get("/exchange-transactions/{transaction_id}")
async def admin_get_exchange_transaction(
    transaction_id: str,
    admin: dict = Depends(require_permission(PERMISSION_DELIVERIES)),
):
    del admin
    transactions_collection = await get_exchange_transactions_collection_async()
    shipping_collection = await get_exchange_shipping_collection_async()
    items_collection = await get_items_collection_async()
    offers_collection = await get_exchange_offers_collection_async()
    if transactions_collection is None or shipping_collection is None:
        raise HTTPException(status_code=503, detail="Database connection is not available.")

    object_id = parse_object_id(transaction_id)
    if object_id is None:
        raise HTTPException(status_code=400, detail="Invalid transaction id.")
    transaction = await transactions_collection.find_one({"_id": object_id})
    if transaction is None:
        raise HTTPException(status_code=404, detail="Exchange transaction not found.")

    shipping_records = await _load_shipping_records(shipping_collection, transaction_id)
    return await _admin_transaction_summary(
        transaction,
        shipping_records,
        items_collection,
        offers_collection,
    )


@router.get("/exchange-shipping/{shipping_id}")
async def admin_get_exchange_shipping(
    shipping_id: str,
    admin: dict = Depends(require_permission(PERMISSION_DELIVERIES)),
):
    del admin
    shipping_collection = await get_exchange_shipping_collection_async()
    if shipping_collection is None:
        raise HTTPException(status_code=503, detail="Database connection is not available.")

    object_id = parse_object_id(shipping_id)
    if object_id is None:
        raise HTTPException(status_code=400, detail="Invalid shipping id.")
    shipping = await shipping_collection.find_one({"_id": object_id})
    if shipping is None:
        raise HTTPException(status_code=404, detail="Shipping record not found.")
    return serialize_shipping_admin(shipping)


@router.patch("/exchange-shipping/{shipping_id}")
async def admin_update_exchange_shipping(
    shipping_id: str,
    payload: AdminExchangeShippingUpdateRequest,
    admin: dict = Depends(require_permission(PERMISSION_DELIVERIES)),
):
    shipping_collection = await get_exchange_shipping_collection_async()
    transactions_collection = await get_exchange_transactions_collection_async()
    offers_collection = await get_exchange_offers_collection_async()
    items_collection = await get_items_collection_async()
    if not all([shipping_collection, transactions_collection, offers_collection, items_collection]):
        raise HTTPException(status_code=503, detail="Database connection is not available.")

    object_id = parse_object_id(shipping_id)
    if object_id is None:
        raise HTTPException(status_code=400, detail="Invalid shipping id.")
    shipping = await shipping_collection.find_one({"_id": object_id})
    if shipping is None:
        raise HTTPException(status_code=404, detail="Shipping record not found.")

    previous_cost = shipping.get("shipping_cost")
    previous_status = shipping.get("shipping_status")
    previous_tracking = shipping.get("tracking_number")
    previous_carrier = shipping.get("carrier")
    previous_instructions = shipping.get("admin_instructions")

    updates = {"updated_at": utc_now()}
    if payload.shipping_cost is not None:
        updates["shipping_cost"] = payload.shipping_cost
    if payload.shipping_status is not None:
        canonical = canonical_status(payload.shipping_status)
        updates["status"] = canonical
        updates["shipping_status"] = storage_status(canonical)
        if canonical in {"PICKED_UP", "IN_TRANSIT"} and not shipping.get("shipped_at"):
            updates["shipped_at"] = utc_now()
        if canonical == "DELIVERED":
            updates["delivered_at"] = utc_now()
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

    carrier = updates.get("carrier", shipping.get("carrier"))
    tracking_number = updates.get("tracking_number", shipping.get("tracking_number"))
    if tracking_number and not updates.get("tracking_url") and not shipping.get("tracking_url"):
        generated = public_carrier_tracking_url(carrier, tracking_number)
        if generated:
            updates["tracking_url"] = generated

    await shipping_collection.update_one({"_id": object_id}, {"$set": updates})

    transaction = await transactions_collection.find_one({
        "_id": ObjectId(shipping["exchange_transaction_id"])
        if ObjectId.is_valid(shipping["exchange_transaction_id"])
        else shipping["exchange_transaction_id"]
    })
    if transaction is None:
        tx_oid = parse_object_id(shipping["exchange_transaction_id"])
        if tx_oid is not None:
            transaction = await transactions_collection.find_one({"_id": tx_oid})

    if transaction:
        sender_id = shipping.get("sender_user_id")
        receiver_id = shipping.get("receiver_user_id")
        action_url = f"/exchange/{shipping['exchange_transaction_id']}"
        shipping_key = str(shipping["_id"])

        new_instructions = updates.get("admin_instructions", previous_instructions)
        if payload.admin_instructions is not None and new_instructions != previous_instructions:
            asyncio.create_task(create_notification(
                user_id=sender_id,
                title="Shipping Instructions Available",
                message="Admin provided shipping instructions for your exchange.",
                type_="exchange_shipping_instructions",
                action_url=action_url,
                dedupe_key=f"exchange_shipping_instructions:{shipping_key}",
            ))

        new_tracking = updates.get("tracking_number", previous_tracking)
        new_carrier = updates.get("carrier", previous_carrier)
        tracking_changed = (
            (payload.tracking_number is not None and new_tracking != previous_tracking)
            or (payload.carrier is not None and new_carrier != previous_carrier)
        )
        if tracking_changed and new_tracking:
            tracking_title, tracking_message = tracking_updated_copy()
            asyncio.create_task(create_notification(
                user_id=receiver_id,
                title=tracking_title,
                message=tracking_message,
                type_="exchange_tracking_updated",
                action_url=action_url,
                dedupe_key=f"exchange_tracking_updated:{shipping_key}:{new_tracking}:{new_carrier or ''}",
            ))
            notify_tracking_updated({**shipping, **updates, "_id": shipping["_id"]})

        stored_status = updates.get("shipping_status", previous_status)
        if stored_status == "shipped" and previous_status != "shipped":
            shipped_title, shipped_message = item_shipped_copy()
            asyncio.create_task(create_notification(
                user_id=receiver_id,
                title=shipped_title,
                message=shipped_message,
                type_="exchange_item_shipped",
                action_url=action_url,
                dedupe_key=f"exchange_item_shipped:{shipping_key}",
            ))
        if stored_status == "delivered" and previous_status != "delivered":
            delivered_title, delivered_message = item_delivered_copy()
            asyncio.create_task(create_notification(
                user_id=receiver_id,
                title=delivered_title,
                message=delivered_message,
                type_="exchange_item_delivered",
                action_url=action_url,
                dedupe_key=f"exchange_item_delivered:{shipping_key}",
            ))
        if payload.shipping_status is not None:
            notify_shipment_status({**shipping, **updates, "_id": shipping["_id"]}, previous_status, updates.get("status"))
        if payload.shipping_cost is not None and payload.shipping_cost != previous_cost:
            payment_title, payment_message = shipping_payment_required_copy()
            asyncio.create_task(create_notification(
                user_id=sender_id,
                title=payment_title,
                message=payment_message,
                type_="exchange_shipping_payment_required",
                action_url=action_url,
                dedupe_key=f"exchange_shipping_payment_required:{shipping_key}:{payload.shipping_cost}",
            ))

        return await sync_transaction_progress(
            transactions_collection=transactions_collection,
            shipping_collection=shipping_collection,
            offers_collection=offers_collection,
            items_collection=items_collection,
            transaction=transaction,
        )

    updated = await shipping_collection.find_one({"_id": object_id})
    return serialize_shipping_admin(updated)


@router.patch("/exchange-transactions/{transaction_id}/status")
async def admin_update_exchange_transaction_status(
    transaction_id: str,
    payload: AdminExchangeTransactionStatusRequest,
    admin: dict = Depends(require_permission(PERMISSION_DELIVERIES)),
):
    del admin
    transactions_collection = await get_exchange_transactions_collection_async()
    shipping_collection = await get_exchange_shipping_collection_async()
    offers_collection = await get_exchange_offers_collection_async()
    items_collection = await get_items_collection_async()
    if not all([transactions_collection, shipping_collection, offers_collection, items_collection]):
        raise HTTPException(status_code=503, detail="Database connection is not available.")

    transaction = await transactions_collection.find_one({"_id": parse_object_id(transaction_id)})
    if transaction is None:
        raise HTTPException(status_code=404, detail="Exchange transaction not found.")

    now = utc_now()
    updates = {"status": payload.status, "updated_at": now}
    if payload.status == "COMPLETED":
        updates["completed_at"] = now
    await transactions_collection.update_one({"_id": transaction["_id"]}, {"$set": updates})

    if payload.status in {"EXPIRED", "CANCELLED"}:
        await expire_unpaid_exchange(
            transactions_collection=transactions_collection,
            shipping_collection=shipping_collection,
            offers_collection=offers_collection,
            items_collection=items_collection,
            transaction=transaction,
        )
        offer = await offers_collection.find_one({"transaction_id": transaction_id})
        if offer:
            await offers_collection.update_one(
                {"_id": offer["_id"]},
                {"$set": {"status": payload.status, "updated_at": now}},
            )
        await release_listing_after_exchange_failure(
            items_collection, offers_collection, transaction["listing_id"]
        )
        for user_id in {transaction["user_a_id"], transaction["user_b_id"]}:
            if payload.status == "CANCELLED":
                cancelled_title, cancelled_message = cancelled_copy()
                asyncio.create_task(create_notification(
                    user_id=user_id,
                    title=cancelled_title,
                    message=cancelled_message,
                    type_="exchange_cancelled",
                    action_url=f"/exchange/{transaction_id}",
                    dedupe_key=f"exchange_cancelled:{transaction_id}",
                ))
            elif payload.status == "EXPIRED":
                # expire_unpaid_exchange already notifies both participants.
                continue

    updated = await transactions_collection.find_one({"_id": transaction["_id"]})
    return await sync_transaction_progress(
        transactions_collection=transactions_collection,
        shipping_collection=shipping_collection,
        offers_collection=offers_collection,
        items_collection=items_collection,
        transaction=updated,
    )
