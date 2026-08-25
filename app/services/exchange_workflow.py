"""
Exchange workflow helpers — accept, decline, counter, resume, expiration.
"""
import asyncio
import logging
from datetime import datetime, timezone

from bson import ObjectId
from pymongo import ReturnDocument

from app.services.exchange_offers import (
    PAUSED_OFFER_STATUSES,
    serialize_exchange_offer,
    utc_now,
)
from app.services.exchange_shipping import build_shipping_document
from app.services.shipping_status import is_delivered_storage, is_in_motion_storage
from app.services.exchange_notifications import (
    completed_copy,
    expired_copy,
    offer_accepted_copy,
    reserved_copy,
)
from app.services.exchange_transactions import (
    attach_exchange_item_details,
    build_transaction_document,
    serialize_transaction,
)
from app.services.notifications import create_notification, notify_admins

logger = logging.getLogger(__name__)


class ExchangeAcceptConflict(Exception):
    """Raised when a listing cannot be reserved or an offer cannot be accepted atomically."""


async def _notify(
    user_id: str,
    title: str,
    message: str,
    type_: str,
    action_url: str | None = None,
    dedupe_key: str | None = None,
):
    asyncio.create_task(create_notification(
        user_id, title, message, type_, action_url, dedupe_key=dedupe_key,
    ))


async def resume_paused_offers(offers_collection, listing_id: str, exclude_offer_id: str | None = None):
    query = {
        "listing_id": listing_id,
        "status": {"$in": list(PAUSED_OFFER_STATUSES)},
    }
    if exclude_offer_id:
        query["_id"] = {"$ne": ObjectId(exclude_offer_id)}
    await offers_collection.update_many(
        query,
        {"$set": {"status": "PENDING", "updated_at": utc_now()}},
    )


async def release_listing_after_exchange_failure(items_collection, offers_collection, listing_id: str):
    await items_collection.update_one(
        {"_id": ObjectId(listing_id)},
        {"$set": {
            "status": "available",
            "giveaway_paused": False,
            "active_exchange_offer_id": None,
            "updated_at": utc_now(),
        }},
    )
    await resume_paused_offers(offers_collection, listing_id)


async def _rollback_listing_reservation(items_collection, listing_oid, offer_id: str):
    await items_collection.update_one(
        {
            "_id": listing_oid,
            "status": "exchange_reserved",
            "active_exchange_offer_id": offer_id,
        },
        {"$set": {
            "status": "available",
            "giveaway_paused": False,
            "active_exchange_offer_id": None,
            "updated_at": utc_now(),
        }},
    )


async def accept_exchange_offer(
    *,
    offers_collection,
    items_collection,
    transactions_collection,
    shipping_collection,
    users_collection,
    offer: dict,
    listing: dict,
    expected_offer_statuses: frozenset[str] | set[str] | None = None,
):
    offer_id = str(offer["_id"])
    listing_id = offer["listing_id"]
    listing_oid = listing.get("_id")
    if listing_oid is None:
        listing_oid = ObjectId(listing_id)
    allowed_statuses = frozenset(expected_offer_statuses or {"PENDING"})
    now = utc_now()

    owner = await users_collection.find_one({"_id": ObjectId(offer["owner_user_id"])})
    offerer = await users_collection.find_one({"_id": ObjectId(offer["offering_user_id"])})
    if owner is None or offerer is None:
        raise ValueError("Participant accounts not found.")

    reserved_listing = await items_collection.find_one_and_update(
        {
            "_id": listing_oid,
            "status": "available",
        },
        {"$set": {
            "status": "exchange_reserved",
            "giveaway_paused": True,
            "active_exchange_offer_id": offer_id,
            "updated_at": now,
        }},
        return_document=ReturnDocument.AFTER,
    )
    if reserved_listing is None:
        raise ExchangeAcceptConflict("This listing is no longer available for exchange acceptance.")

    accepted_offer = await offers_collection.find_one_and_update(
        {
            "_id": offer["_id"],
            "listing_id": listing_id,
            "status": {"$in": list(allowed_statuses)},
        },
        {"$set": {
            "status": "ACCEPTED",
            "updated_at": now,
        }},
        return_document=ReturnDocument.AFTER,
    )
    if accepted_offer is None:
        await _rollback_listing_reservation(items_collection, listing_oid, offer_id)
        raise ExchangeAcceptConflict("This offer can no longer be accepted.")

    try:
        transaction_doc = build_transaction_document(
            exchange_offer=accepted_offer,
            listing=reserved_listing,
            owner_user={"name": owner.get("name", "")},
            offerer_user={"name": offerer.get("name", "")},
        )
        transaction_doc["status"] = "COLLECTING_SHIPPING"
        tx_result = await transactions_collection.insert_one(transaction_doc)
        transaction_id = str(tx_result.inserted_id)

        shipping_a = build_shipping_document(
            exchange_transaction_id=transaction_id,
            sender_user_id=offer["owner_user_id"],
            sender_user_name=offer.get("owner_user_name") or owner.get("name", ""),
            receiver_user_id=offer["offering_user_id"],
            receiver_user_name=offer.get("offering_user_name") or offerer.get("name", ""),
            transaction_type="EXCHANGE",
            item_title=listing.get("title") or offer.get("listing_title"),
        )
        shipping_b = build_shipping_document(
            exchange_transaction_id=transaction_id,
            sender_user_id=offer["offering_user_id"],
            sender_user_name=offer.get("offering_user_name") or offerer.get("name", ""),
            receiver_user_id=offer["owner_user_id"],
            receiver_user_name=offer.get("owner_user_name") or owner.get("name", ""),
            transaction_type="EXCHANGE",
            item_title=offer.get("custom_item_title") or offer.get("offered_listing_title") or "Swap item",
        )
        await shipping_collection.insert_many([shipping_a, shipping_b])

        await offers_collection.update_one(
            {"_id": offer["_id"], "status": "ACCEPTED"},
            {"$set": {"transaction_id": transaction_id, "updated_at": utc_now()}},
        )

        await offers_collection.update_many(
            {
                "listing_id": listing_id,
                "_id": {"$ne": offer["_id"]},
                "status": {"$in": ["PENDING", "COUNTERED"]},
            },
            {"$set": {"status": "UNDER_REVIEW", "updated_at": utc_now()}},
        )
    except Exception:
        previous_status = offer.get("status") if offer.get("status") in allowed_statuses else next(iter(allowed_statuses))
        await offers_collection.update_one(
            {"_id": offer["_id"], "status": "ACCEPTED"},
            {"$set": {"status": previous_status, "transaction_id": None, "updated_at": utc_now()}},
        )
        await _rollback_listing_reservation(items_collection, listing_oid, offer_id)
        raise

    action_url = f"/exchange/{transaction_id}"
    listing_title = listing.get("title") or offer.get("listing_title")
    accepted_title, accepted_message = offer_accepted_copy(listing_title)
    reserved_title, reserved_message = reserved_copy(listing_title)
    await _notify(
        offer["offering_user_id"],
        accepted_title,
        accepted_message,
        "exchange_offer_accepted",
        action_url,
        dedupe_key=f"exchange_offer_accepted:{transaction_id}",
    )
    await _notify(
        offer["owner_user_id"],
        reserved_title,
        reserved_message,
        "exchange_reserved",
        action_url,
        dedupe_key=f"exchange_reserved:{transaction_id}",
    )
    asyncio.create_task(notify_admins(
        title="Exchange Accepted",
        message=f"Listing \"{listing.get('title', '')}\" has an accepted swap — shipping coordination required.",
        type_="exchange_admin_action",
        action_url=f"/exchange/{transaction_id}",
    ))

    updated_offer = await offers_collection.find_one({"_id": offer["_id"]})
    shipping_records = []
    async for record in shipping_collection.find({"exchange_transaction_id": transaction_id}):
        shipping_records.append(record)
    transaction = await transactions_collection.find_one({"_id": tx_result.inserted_id})
    return serialize_exchange_offer(updated_offer), serialize_transaction(transaction, shipping_records)


async def _serialize_synced_transaction(
    transaction: dict,
    shipping_records: list[dict],
    *,
    viewer_user_id: str | None = None,
    items_collection=None,
    offers_collection=None,
) -> dict:
    payload = serialize_transaction(
        transaction, shipping_records, viewer_user_id=viewer_user_id,
    )
    if viewer_user_id:
        payload = await attach_exchange_item_details(
            payload, transaction, items_collection, offers_collection,
        )
    return payload


async def sync_transaction_progress(
    *,
    transactions_collection,
    shipping_collection,
    offers_collection,
    items_collection,
    transaction: dict,
    viewer_user_id: str | None = None,
):
    transaction_id = str(transaction["_id"])
    shipping_records = []
    async for record in shipping_collection.find({"exchange_transaction_id": transaction_id}):
        shipping_records.append(record)

    if not shipping_records:
        return await _serialize_synced_transaction(
            transaction,
            shipping_records,
            viewer_user_id=viewer_user_id,
            items_collection=items_collection,
            offers_collection=offers_collection,
        )

    all_details = all(r.get("encrypted_address_line1") for r in shipping_records)
    all_paid = all(r.get("payment_status") == "paid" for r in shipping_records)
    all_delivered = all(is_delivered_storage(r.get("shipping_status") or r.get("status")) for r in shipping_records)
    any_shipped = any(is_in_motion_storage(r.get("shipping_status") or r.get("status")) for r in shipping_records)
    now = utc_now()

    new_tx_status = transaction.get("status")
    new_offer_status = None

    if all_delivered:
        new_tx_status = "COMPLETED"
        new_offer_status = "COMPLETED"
    elif any_shipped:
        new_tx_status = "SHIPPED"
        new_offer_status = "SHIPPED"
    elif all_paid:
        new_tx_status = "SHIPPING"
        new_offer_status = "SHIPPING"
    elif all_details:
        new_tx_status = "AWAITING_PAYMENT"
        new_offer_status = "ACCEPTED"

    updates = {}
    if new_tx_status and new_tx_status != transaction.get("status"):
        updates["status"] = new_tx_status
        updates["updated_at"] = now
        if new_tx_status == "COMPLETED":
            updates["completed_at"] = now

    if updates:
        await transactions_collection.update_one({"_id": transaction["_id"]}, {"$set": updates})
        transaction = {**transaction, **updates}

    if new_offer_status:
        offer = await offers_collection.find_one({"transaction_id": transaction_id})
        if offer and offer.get("status") != new_offer_status:
            await offers_collection.update_one(
                {"_id": offer["_id"]},
                {"$set": {"status": new_offer_status, "updated_at": now}},
            )
            if new_offer_status == "COMPLETED":
                await items_collection.update_one(
                    {"_id": ObjectId(transaction["listing_id"])},
                    {"$set": {"status": "completed", "updated_at": now}},
                )
                completed_title, completed_message = completed_copy(transaction.get("listing_title"))
                completed_url = f"/exchange/{transaction_id}"
                completed_key = f"exchange_completed:{transaction_id}"
                await _notify(
                    transaction["user_a_id"],
                    completed_title,
                    completed_message,
                    "exchange_completed",
                    completed_url,
                    dedupe_key=completed_key,
                )
                await _notify(
                    transaction["user_b_id"],
                    completed_title,
                    completed_message,
                    "exchange_completed",
                    completed_url,
                    dedupe_key=completed_key,
                )

    shipping_records = []
    async for record in shipping_collection.find({"exchange_transaction_id": transaction_id}):
        shipping_records.append(record)
    return await _serialize_synced_transaction(
        transaction,
        shipping_records,
        viewer_user_id=viewer_user_id,
        items_collection=items_collection,
        offers_collection=offers_collection,
    )


async def expire_unpaid_exchange(
    *,
    transactions_collection,
    shipping_collection,
    offers_collection,
    items_collection,
    transaction: dict,
):
    transaction_id = str(transaction["_id"])
    listing_id = transaction["listing_id"]
    now = utc_now()

    updated_transaction = await transactions_collection.find_one_and_update(
        {
            "_id": transaction["_id"],
            "status": {"$nin": ["COMPLETED", "EXPIRED", "CANCELLED"]},
        },
        {"$set": {"status": "EXPIRED", "updated_at": now}},
        return_document=ReturnDocument.AFTER,
    )
    if updated_transaction is None:
        return

    offer = await offers_collection.find_one({"transaction_id": transaction_id})
    if offer:
        await offers_collection.update_one(
            {
                "_id": offer["_id"],
                "status": {"$nin": ["COMPLETED", "CANCELLED", "EXPIRED"]},
            },
            {"$set": {"status": "EXPIRED", "updated_at": now}},
        )

    await release_listing_after_exchange_failure(items_collection, offers_collection, listing_id)

    expired_title, expired_message = expired_copy()
    expired_url = f"/exchange/{transaction_id}"
    expired_key = f"exchange_expired:{transaction_id}"
    await _notify(
        transaction["user_a_id"],
        expired_title,
        expired_message,
        "exchange_expired",
        expired_url,
        dedupe_key=expired_key,
    )
    await _notify(
        transaction["user_b_id"],
        expired_title,
        expired_message,
        "exchange_expired",
        expired_url,
        dedupe_key=expired_key,
    )
