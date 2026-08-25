from datetime import datetime, timedelta, timezone

from app.core.config import settings
from app.services.encryption import decrypt_text, encrypt_text
from app.services.shipping_providers import public_carrier_tracking_url
from app.services.shipping_status import canonical_status, status_label, storage_status, timeline_for_status

PRIVACY_MASK = "[Hidden for privacy]"


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def payment_deadline() -> datetime:
    hours = getattr(settings, "EXCHANGE_SHIPPING_PAYMENT_DEADLINE_HOURS", 72)
    return utc_now() + timedelta(hours=hours)


def build_shipping_document(
    *,
    exchange_transaction_id: str,
    sender_user_id: str,
    sender_user_name: str,
    receiver_user_id: str,
    transaction_type: str = "EXCHANGE",
    item_title: str | None = None,
    payer_user_id: str | None = None,
    receiver_user_name: str | None = None,
) -> dict:
    now = utc_now()
    return {
        "exchange_transaction_id": exchange_transaction_id,
        "transaction_id": exchange_transaction_id,
        "transaction_type": transaction_type,
        "item_title": item_title,
        "sender_user_id": sender_user_id,
        "sender_user_name": sender_user_name,
        "receiver_user_id": receiver_user_id,
        "receiver_user_name": receiver_user_name or "",
        "payer_user_id": payer_user_id or sender_user_id,
        "shipping_status": "awaiting_details",
        "status": "PENDING",
        "shipping_cost": None,
        "payment_status": "pending",
        "payment_reference": None,
        "payment_paid_at": None,
        "payment_due_at": None,
        "tracking_number": None,
        "tracking_url": None,
        "carrier": None,
        "estimated_delivery": None,
        "shipped_at": None,
        "delivered_at": None,
        "admin_notes": None,
        "admin_instructions": None,
        "encrypted_full_name": None,
        "encrypted_phone_number": None,
        "encrypted_address_line1": None,
        "encrypted_address_line2": None,
        "encrypted_city": None,
        "encrypted_state": None,
        "encrypted_postal_code": None,
        "encrypted_country": None,
        "encrypted_notes": None,
        "created_at": now,
        "updated_at": now,
    }


def apply_shipping_details(shipping: dict, payload) -> dict:
    now = utc_now()
    return {
        "encrypted_full_name": encrypt_text(payload.full_name.strip()),
        "encrypted_phone_number": encrypt_text(payload.phone_number.strip()),
        "encrypted_address_line1": encrypt_text(payload.address_line1.strip()),
        "encrypted_address_line2": encrypt_text(payload.address_line2.strip()) if payload.address_line2 else None,
        "encrypted_city": encrypt_text(payload.city.strip()),
        "encrypted_state": encrypt_text(payload.state.strip()) if payload.state else None,
        "encrypted_postal_code": encrypt_text(payload.postal_code.strip()),
        "encrypted_country": encrypt_text(payload.country.strip()),
        "encrypted_notes": encrypt_text(payload.notes.strip()) if payload.notes else None,
        "shipping_status": "awaiting_payment",
        "status": "PAYMENT_REQUIRED",
        "payment_due_at": payment_deadline(),
        "updated_at": now,
    }


def serialize_shipping_public(shipping: dict) -> dict:
    storage = shipping.get("shipping_status") or "awaiting_details"
    canonical = shipping.get("status") or canonical_status(storage)
    tracking_number = shipping.get("tracking_number")
    carrier = shipping.get("carrier")
    shipment_id = str(shipping["_id"])
    return {
        "id": shipment_id,
        "transaction_id": shipping.get("transaction_id") or shipping.get("exchange_transaction_id") or "",
        "transaction_type": shipping.get("transaction_type") or "EXCHANGE",
        "item_title": shipping.get("item_title"),
        "sender_user_id": shipping.get("sender_user_id") or "",
        "sender_user_name": shipping.get("sender_user_name") or "Community Member",
        "receiver_user_id": shipping.get("receiver_user_id") or "",
        "receiver_user_name": shipping.get("receiver_user_name") or "Community Member",
        "payer_user_id": shipping.get("payer_user_id") or shipping.get("sender_user_id") or "",
        "shipping_status": storage,
        "status": canonical_status(canonical),
        "status_label": status_label(canonical),
        "shipping_cost": shipping.get("shipping_cost"),
        "payment_status": shipping.get("payment_status") or "pending",
        "payment_due_at": shipping.get("payment_due_at"),
        "tracking_number": tracking_number,
        "tracking_url": shipping.get("tracking_url") or public_carrier_tracking_url(carrier, tracking_number),
        "tracking_page_url": f"/tracking/{shipment_id}",
        "carrier": carrier,
        "estimated_delivery": shipping.get("estimated_delivery"),
        "shipped_at": shipping.get("shipped_at"),
        "delivered_at": shipping.get("delivered_at"),
        "admin_instructions": shipping.get("admin_instructions"),
        "timeline": timeline_for_status(canonical),
        "updated_at": shipping.get("updated_at") or utc_now(),
        "created_at": shipping.get("created_at") or utc_now(),
    }


def serialize_shipping_for_participant(shipping: dict, viewer_user_id: str) -> dict:
    """Public shipping for a participant. Partner records never include private or admin-only fields."""
    public = serialize_shipping_public(shipping)
    public = {key: value for key, value in public.items() if not str(key).startswith("encrypted_")}
    if shipping.get("sender_user_id") != viewer_user_id:
        public["admin_instructions"] = None
        public["shipping_cost"] = None
        public["payment_due_at"] = None
    return public


def serialize_shipping_admin(shipping: dict) -> dict:
    public = serialize_shipping_public(shipping)
    public.update({
        "full_name": decrypt_text(shipping.get("encrypted_full_name") or ""),
        "phone_number": decrypt_text(shipping.get("encrypted_phone_number") or ""),
        "address_line1": decrypt_text(shipping.get("encrypted_address_line1") or ""),
        "address_line2": decrypt_text(shipping.get("encrypted_address_line2") or ""),
        "city": decrypt_text(shipping.get("encrypted_city") or ""),
        "state": decrypt_text(shipping.get("encrypted_state") or ""),
        "postal_code": decrypt_text(shipping.get("encrypted_postal_code") or ""),
        "country": decrypt_text(shipping.get("encrypted_country") or ""),
        "notes": decrypt_text(shipping.get("encrypted_notes") or ""),
        "admin_notes": shipping.get("admin_notes"),
        "payment_reference": shipping.get("payment_reference"),
        "payment_paid_at": shipping.get("payment_paid_at"),
    })
    return public
