import asyncio
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pymongo import DESCENDING

from app.api.deps.auth import get_current_user, get_verified_user
from app.core.config import settings
from app.db.mongodb import (
    get_exchange_offers_collection_async,
    get_exchange_shipping_collection_async,
    get_exchange_transactions_collection_async,
    get_items_collection_async,
)
from app.schemas.exchange import (
    ExchangePayShippingRequest,
    ExchangeShippingDetailsRequest,
    ExchangeTransactionResponse,
)
from app.services.auth import parse_object_id
from app.services.exchange_notifications import (
    partner_shipping_update_copy,
    shipping_payment_confirmed_copy,
)
from app.services.exchange_shipping import apply_shipping_details, utc_now
from app.services.exchange_transactions import attach_exchange_item_details, serialize_transaction
from app.services.exchange_workflow import expire_unpaid_exchange, sync_transaction_progress
from app.services.notifications import create_notification

router = APIRouter()


def _is_participant(transaction: dict, user_id: str) -> bool:
    return user_id in {transaction.get("user_a_id"), transaction.get("user_b_id")}


async def _get_transaction_or_404(transactions_collection, transaction_id: str):
    object_id = parse_object_id(transaction_id)
    if object_id is None:
        raise HTTPException(status_code=400, detail="Invalid transaction id.")
    transaction = await transactions_collection.find_one({"_id": object_id})
    if transaction is None:
        raise HTTPException(status_code=404, detail="Exchange transaction not found.")
    return transaction


@router.get("/exchange-transactions/my", response_model=list[ExchangeTransactionResponse])
async def list_my_exchange_transactions(current_user: dict = Depends(get_current_user)):
    transactions_collection = await get_exchange_transactions_collection_async()
    shipping_collection = await get_exchange_shipping_collection_async()
    offers_collection = await get_exchange_offers_collection_async()
    items_collection = await get_items_collection_async()
    if not all([transactions_collection, shipping_collection, offers_collection, items_collection]):
        raise HTTPException(status_code=503, detail="Database connection is not available.")

    results = []
    query = {"$or": [{"user_a_id": current_user["id"]}, {"user_b_id": current_user["id"]}]}
    cursor = transactions_collection.find(query).sort("created_at", DESCENDING)
    async for transaction in cursor:
        transaction_id = str(transaction["_id"])
        shipping_records = []
        async for record in shipping_collection.find({"exchange_transaction_id": transaction_id}):
            shipping_records.append(record)
        payload = serialize_transaction(
            transaction, shipping_records, viewer_user_id=current_user["id"],
        )
        payload = await attach_exchange_item_details(
            payload, transaction, items_collection, offers_collection,
        )
        results.append(payload)
    return results


@router.get("/exchange-transactions/{transaction_id}", response_model=ExchangeTransactionResponse)
async def get_exchange_transaction(
    transaction_id: str,
    current_user: dict = Depends(get_current_user),
):
    transactions_collection = await get_exchange_transactions_collection_async()
    shipping_collection = await get_exchange_shipping_collection_async()
    offers_collection = await get_exchange_offers_collection_async()
    items_collection = await get_items_collection_async()
    if not all([transactions_collection, shipping_collection, offers_collection, items_collection]):
        raise HTTPException(status_code=503, detail="Database connection is not available.")

    transaction = await _get_transaction_or_404(transactions_collection, transaction_id)
    if not _is_participant(transaction, current_user["id"]):
        raise HTTPException(status_code=403, detail="You do not have access to this exchange.")

    return await sync_transaction_progress(
        transactions_collection=transactions_collection,
        shipping_collection=shipping_collection,
        offers_collection=offers_collection,
        items_collection=items_collection,
        transaction=transaction,
        viewer_user_id=current_user["id"],
    )


@router.post("/exchange-transactions/{transaction_id}/shipping-details", response_model=ExchangeTransactionResponse)
async def submit_shipping_details(
    transaction_id: str,
    payload: ExchangeShippingDetailsRequest,
    current_user: dict = Depends(get_verified_user),
):
    transactions_collection = await get_exchange_transactions_collection_async()
    shipping_collection = await get_exchange_shipping_collection_async()
    offers_collection = await get_exchange_offers_collection_async()
    items_collection = await get_items_collection_async()
    if not all([transactions_collection, shipping_collection, offers_collection, items_collection]):
        raise HTTPException(status_code=503, detail="Database connection is not available.")

    transaction = await _get_transaction_or_404(transactions_collection, transaction_id)
    if not _is_participant(transaction, current_user["id"]):
        raise HTTPException(status_code=403, detail="You do not have access to this exchange.")
    if transaction.get("status") in {"COMPLETED", "EXPIRED", "CANCELLED"}:
        raise HTTPException(status_code=400, detail="This exchange is no longer active.")

    shipping = await shipping_collection.find_one({
        "exchange_transaction_id": transaction_id,
        "sender_user_id": current_user["id"],
    })
    if shipping is None:
        raise HTTPException(status_code=404, detail="Shipping record not found.")
    if shipping.get("encrypted_address_line1"):
        raise HTTPException(status_code=400, detail="Shipping details were already submitted.")

    updates = apply_shipping_details(shipping, payload)
    await shipping_collection.update_one({"_id": shipping["_id"]}, {"$set": updates})

    other_party_id = (
        transaction["user_b_id"]
        if current_user["id"] == transaction["user_a_id"]
        else transaction["user_a_id"]
    )
    shipping_update_title, shipping_update_message = partner_shipping_update_copy()
    asyncio.create_task(create_notification(
        user_id=other_party_id,
        title=shipping_update_title,
        message=shipping_update_message,
        type_="exchange_shipping_update",
        action_url=f"/exchange/{transaction_id}",
        dedupe_key=f"exchange_shipping_update:{transaction_id}:{current_user['id']}",
    ))

    updated_transaction = await transactions_collection.find_one({"_id": transaction["_id"]})
    return await sync_transaction_progress(
        transactions_collection=transactions_collection,
        shipping_collection=shipping_collection,
        offers_collection=offers_collection,
        items_collection=items_collection,
        transaction=updated_transaction,
        viewer_user_id=current_user["id"],
    )


@router.post("/exchange-transactions/{transaction_id}/pay-shipping", response_model=ExchangeTransactionResponse)
async def pay_exchange_shipping(
    transaction_id: str,
    payload: ExchangePayShippingRequest,
    current_user: dict = Depends(get_verified_user),
):
    transactions_collection = await get_exchange_transactions_collection_async()
    shipping_collection = await get_exchange_shipping_collection_async()
    offers_collection = await get_exchange_offers_collection_async()
    items_collection = await get_items_collection_async()
    if not all([transactions_collection, shipping_collection, offers_collection, items_collection]):
        raise HTTPException(status_code=503, detail="Database connection is not available.")

    transaction = await _get_transaction_or_404(transactions_collection, transaction_id)
    if not _is_participant(transaction, current_user["id"]):
        raise HTTPException(status_code=403, detail="You do not have access to this exchange.")

    shipping = await shipping_collection.find_one({
        "exchange_transaction_id": transaction_id,
        "sender_user_id": current_user["id"],
    })
    if shipping is None:
        raise HTTPException(status_code=404, detail="Shipping record not found.")
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
        await expire_unpaid_exchange(
            transactions_collection=transactions_collection,
            shipping_collection=shipping_collection,
            offers_collection=offers_collection,
            items_collection=items_collection,
            transaction=transaction,
        )
        raise HTTPException(status_code=400, detail="Shipping payment deadline has passed. This exchange expired.")

    now = utc_now()
    await shipping_collection.update_one(
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

    confirmed_title, confirmed_message = shipping_payment_confirmed_copy()
    asyncio.create_task(create_notification(
        user_id=current_user["id"],
        title=confirmed_title,
        message=confirmed_message,
        type_="exchange_shipping_payment_confirmed",
        action_url=f"/exchange/{transaction_id}",
        dedupe_key=f"exchange_shipping_payment_confirmed:{str(shipping['_id'])}",
    ))

    updated_transaction = await transactions_collection.find_one({"_id": transaction["_id"]})
    return await sync_transaction_progress(
        transactions_collection=transactions_collection,
        shipping_collection=shipping_collection,
        offers_collection=offers_collection,
        items_collection=items_collection,
        transaction=updated_transaction,
        viewer_user_id=current_user["id"],
    )
