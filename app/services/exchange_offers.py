from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.core.config import settings
from app.schemas.exchange import ExchangeOfferCreateRequest

ACTIVE_OFFER_STATUSES = frozenset({
    "PENDING", "UNDER_REVIEW", "COUNTERED", "ACCEPTED",
    "SHIPPING", "SHIPPED", "DELIVERED",
})

BLOCKING_LISTING_STATUSES = frozenset({
    "ACCEPTED", "SHIPPING", "SHIPPED", "DELIVERED",
})

PAUSED_OFFER_STATUSES = frozenset({"UNDER_REVIEW"})


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def compute_offer_expires_at() -> datetime:
    days = getattr(settings, "EXCHANGE_OFFER_EXPIRE_DAYS", 14)
    return utc_now() + timedelta(days=days)


def item_supports_exchange(item: dict) -> bool:
    mode = (item.get("listing_mode") or "GIVEAWAY").upper()
    return mode in {"EXCHANGE", "BOTH"}


def item_supports_giveaway(item: dict) -> bool:
    mode = (item.get("listing_mode") or "GIVEAWAY").upper()
    return mode in {"GIVEAWAY", "BOTH"}


def is_listing_exchange_reserved(item: dict) -> bool:
    return item.get("status") == "exchange_reserved" or bool(item.get("giveaway_paused"))


def _decimal_to_float(value) -> float | None:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def build_exchange_offer_document(
    listing: dict,
    current_user: dict,
    payload: ExchangeOfferCreateRequest,
) -> dict:
    now = utc_now()
    doc = {
        "listing_id": str(listing["_id"]),
        "listing_title": listing.get("title") or "Listing",
        "offering_user_id": current_user["id"],
        "offering_user_name": current_user["name"],
        "offering_user_city": getattr(payload, "offering_user_city", None),
        "owner_user_id": listing["owner_id"],
        "owner_user_name": listing.get("owner_name") or "",
        "offered_listing_id": payload.offered_listing_id.strip() if payload.offered_listing_id else None,
        "custom_item_image": str(payload.custom_item_image) if payload.custom_item_image else None,
        "custom_item_title": payload.custom_item_title.strip() if payload.custom_item_title else None,
        "custom_item_description": payload.custom_item_description.strip() if payload.custom_item_description else None,
        "custom_item_condition": payload.custom_item_condition.strip() if payload.custom_item_condition else None,
        "custom_item_estimated_value": _decimal_to_float(payload.custom_item_estimated_value),
        "message": payload.message.strip(),
        "cash_adjustment": _decimal_to_float(payload.cash_adjustment),
        "status": "PENDING",
        "counter_message": None,
        "counter_cash_adjustment": None,
        "counter_offered_listing_id": None,
        "counter_custom_item_title": None,
        "counter_custom_item_description": None,
        "counter_custom_item_condition": None,
        "counter_custom_item_image": None,
        "transaction_id": None,
        "created_at": now,
        "updated_at": now,
        "expires_at": compute_offer_expires_at(),
    }
    return doc


def serialize_exchange_offer(
    offer: dict,
    *,
    offered_listing: dict | None = None,
) -> dict:
    offered_title = None
    offered_image = None
    if offered_listing:
        offered_title = offered_listing.get("title")
        offered_image = offered_listing.get("image_url")
        if offered_image is not None:
            offered_image = str(offered_image)

    custom_image = offer.get("custom_item_image")
    if custom_image is not None:
        custom_image = str(custom_image)

    counter_image = offer.get("counter_custom_item_image")
    if counter_image is not None:
        counter_image = str(counter_image)

    return {
        "id": str(offer["_id"]),
        "listing_id": offer.get("listing_id") or "",
        "listing_title": offer.get("listing_title") or "",
        "offering_user_id": offer.get("offering_user_id") or "",
        "offering_user_name": offer.get("offering_user_name") or "Community Member",
        "offering_user_city": offer.get("offering_user_city"),
        "owner_user_id": offer.get("owner_user_id") or "",
        "owner_user_name": offer.get("owner_user_name") or "",
        "offered_listing_id": offer.get("offered_listing_id"),
        "offered_listing_title": offered_title,
        "offered_listing_image": offered_image,
        "custom_item_image": custom_image,
        "custom_item_title": offer.get("custom_item_title"),
        "custom_item_description": offer.get("custom_item_description"),
        "custom_item_condition": offer.get("custom_item_condition"),
        "custom_item_estimated_value": offer.get("custom_item_estimated_value"),
        "message": offer.get("message") or "",
        "cash_adjustment": offer.get("cash_adjustment"),
        "status": offer.get("status") or "PENDING",
        "counter_message": offer.get("counter_message"),
        "counter_cash_adjustment": offer.get("counter_cash_adjustment"),
        "counter_offered_listing_id": offer.get("counter_offered_listing_id"),
        "counter_custom_item_title": offer.get("counter_custom_item_title"),
        "counter_custom_item_description": offer.get("counter_custom_item_description"),
        "counter_custom_item_condition": offer.get("counter_custom_item_condition"),
        "counter_custom_item_image": counter_image,
        "transaction_id": offer.get("transaction_id"),
        "created_at": offer.get("created_at") or utc_now(),
        "updated_at": offer.get("updated_at") or utc_now(),
        "expires_at": offer.get("expires_at"),
    }
