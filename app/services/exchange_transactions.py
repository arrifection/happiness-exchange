from app.services.auth import parse_object_id
from app.services.exchange_shipping import (
    serialize_shipping_for_participant,
    serialize_shipping_public,
    utc_now,
)


def build_transaction_document(
    *,
    exchange_offer: dict,
    listing: dict,
    owner_user: dict,
    offerer_user: dict,
) -> dict:
    now = utc_now()
    return {
        "exchange_offer_id": str(exchange_offer["_id"]),
        "listing_id": offer.get("listing_id") if (offer := exchange_offer) else str(listing["_id"]),
        "listing_title": listing.get("title") or exchange_offer.get("listing_title") or "Listing",
        "user_a_id": exchange_offer["owner_user_id"],
        "user_a_name": exchange_offer.get("owner_user_name") or owner_user.get("name") or "",
        "user_b_id": exchange_offer["offering_user_id"],
        "user_b_name": exchange_offer.get("offering_user_name") or offerer_user.get("name") or "",
        "status": "ACCEPTED",
        "created_at": now,
        "updated_at": now,
        "completed_at": None,
    }


def serialize_transaction(
    transaction: dict,
    shipping_records: list[dict] | None = None,
    *,
    viewer_user_id: str | None = None,
) -> dict:
    records = shipping_records or []
    if viewer_user_id:
        serialized_shipping = [
            serialize_shipping_for_participant(record, viewer_user_id) for record in records
        ]
    else:
        serialized_shipping = [serialize_shipping_public(record) for record in records]
    return {
        "id": str(transaction["_id"]),
        "exchange_offer_id": transaction.get("exchange_offer_id") or "",
        "listing_id": transaction.get("listing_id") or "",
        "listing_title": transaction.get("listing_title") or "",
        "listing_image_url": None,
        "offered_item_title": None,
        "offered_item_image": None,
        "offered_item_description": None,
        "offered_item_condition": None,
        "cash_adjustment": None,
        "user_a_id": transaction.get("user_a_id") or "",
        "user_a_name": transaction.get("user_a_name") or "",
        "user_b_id": transaction.get("user_b_id") or "",
        "user_b_name": transaction.get("user_b_name") or "",
        "status": transaction.get("status") or "ACCEPTED",
        "shipping_records": serialized_shipping,
        "created_at": transaction.get("created_at") or utc_now(),
        "completed_at": transaction.get("completed_at"),
    }


async def attach_exchange_item_details(
    payload: dict,
    transaction: dict,
    items_collection,
    offers_collection,
) -> dict:
    """Lookup listing image and offered item for participant/admin summaries. No schema migration."""
    listing_oid = parse_object_id(transaction.get("listing_id") or "")
    if listing_oid is not None and items_collection is not None:
        listing = await items_collection.find_one({"_id": listing_oid})
        if listing:
            image = listing.get("image_url")
            payload["listing_image_url"] = str(image) if image else None

    offer_oid = parse_object_id(transaction.get("exchange_offer_id") or "")
    if offer_oid is None or offers_collection is None:
        return payload

    offer = await offers_collection.find_one({"_id": offer_oid})
    if offer is None:
        return payload

    title = (
        offer.get("counter_custom_item_title")
        or offer.get("custom_item_title")
        or offer.get("offered_listing_title")
    )
    description = offer.get("counter_custom_item_description") or offer.get("custom_item_description")
    condition = offer.get("counter_custom_item_condition") or offer.get("custom_item_condition")
    image = offer.get("counter_custom_item_image") or offer.get("custom_item_image")
    cash = offer.get("counter_cash_adjustment")
    if cash is None:
        cash = offer.get("cash_adjustment")

    offered_listing_id = offer.get("counter_offered_listing_id") or offer.get("offered_listing_id")
    if offered_listing_id and items_collection is not None:
        offered_oid = parse_object_id(str(offered_listing_id))
        if offered_oid is not None:
            offered = await items_collection.find_one({"_id": offered_oid})
            if offered:
                title = title or offered.get("title")
                description = description or offered.get("description")
                condition = condition or offered.get("condition")
                if not image:
                    image = offered.get("image_url")

    payload["offered_item_title"] = title
    payload["offered_item_description"] = description
    payload["offered_item_condition"] = condition
    payload["offered_item_image"] = str(image) if image else None
    try:
        payload["cash_adjustment"] = float(cash) if cash is not None else None
    except (TypeError, ValueError):
        payload["cash_adjustment"] = None
    return payload
