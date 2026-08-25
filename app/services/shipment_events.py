"""User notifications for shipment status changes (Give Away and Exchange)."""

from __future__ import annotations

import asyncio

from app.services.notifications import create_notification
from app.services.shipping_status import canonical_status

STATUS_COPY = {
    "PAYMENT_REQUIRED": ("Shipping Payment Required", "Shipping payment is required for your shipment."),
    "PAYMENT_CONFIRMED": ("Shipping Payment Confirmed", "Your shipping payment has been confirmed."),
    "READY_TO_SHIP": ("Shipment Created", "Your shipment has been created. Tracking will appear when the carrier picks it up."),
    "PICKUP_SCHEDULED": ("Pickup Scheduled", "Pickup has been scheduled for your shipment."),
    "PICKED_UP": ("Item Picked Up", "Your shipment has been picked up."),
    "IN_TRANSIT": ("In Transit", "Your shipment is now in transit."),
    "OUT_FOR_DELIVERY": ("Out for Delivery", "Your shipment is out for delivery."),
    "DELIVERED": ("Delivered", "Your shipment has been delivered."),
    "DELIVERY_FAILED": ("Delivery Failed", "Delivery was unsuccessful. Admin will follow up."),
    "RETURNED": ("Returned", "Your shipment was returned."),
    "CANCELLED": ("Shipment Cancelled", "This shipment was cancelled."),
}

TRACKING_COPY = ("Tracking Updated", "A tracking number is available for your shipment.")


def tracking_action_url(shipping: dict) -> str:
    shipment_id = str(shipping.get("_id") or shipping.get("id") or "")
    return f"/tracking/{shipment_id}" if shipment_id else "/swaps"


def notify_shipment_status(shipping: dict, previous_status: str | None, new_status: str | None) -> None:
    previous = canonical_status(previous_status) if previous_status else None
    current = canonical_status(new_status)
    if previous == current:
        return
    title, message = STATUS_COPY.get(current, (None, None))
    if not title:
        return
    action_url = tracking_action_url(shipping)
    shipment_id = str(shipping.get("_id") or "")
    recipients = {shipping.get("sender_user_id"), shipping.get("receiver_user_id")}
    recipients.discard(None)
    recipients.discard("")
    for user_id in recipients:
        asyncio.create_task(create_notification(
            user_id=user_id,
            title=title,
            message=message,
            type_=f"shipment_{current.lower()}",
            action_url=action_url,
            dedupe_key=f"shipment_{current.lower()}:{shipment_id}",
        ))


def notify_tracking_updated(shipping: dict) -> None:
    action_url = tracking_action_url(shipping)
    shipment_id = str(shipping.get("_id") or "")
    tracking = shipping.get("tracking_number") or ""
    recipients = {shipping.get("sender_user_id"), shipping.get("receiver_user_id")}
    recipients.discard(None)
    recipients.discard("")
    title, message = TRACKING_COPY
    for user_id in recipients:
        asyncio.create_task(create_notification(
            user_id=user_id,
            title=title,
            message=message,
            type_="shipment_tracking_updated",
            action_url=action_url,
            dedupe_key=f"shipment_tracking_updated:{shipment_id}:{tracking}",
        ))
