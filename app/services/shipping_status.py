"""Canonical shipment statuses shared by Give Away and Exchange.

Existing Exchange records store lowercase values such as ``awaiting_details``.
New writes keep that storage form so workflow/tests stay compatible, and APIs
also expose a canonical uppercase ``status``.
"""

from __future__ import annotations

CANONICAL_STATUSES = (
    "PENDING",
    "PAYMENT_REQUIRED",
    "PAYMENT_CONFIRMED",
    "READY_TO_SHIP",
    "PICKUP_SCHEDULED",
    "PICKED_UP",
    "IN_TRANSIT",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "DELIVERY_FAILED",
    "RETURNED",
    "CANCELLED",
)

# Stored shipping_status values used by existing Exchange workflow.
STORAGE_FOR_CANONICAL = {
    "PENDING": "awaiting_details",
    "PAYMENT_REQUIRED": "awaiting_payment",
    "PAYMENT_CONFIRMED": "paid",
    "READY_TO_SHIP": "ready_to_ship",
    "PICKUP_SCHEDULED": "pickup_scheduled",
    "PICKED_UP": "shipped",
    "IN_TRANSIT": "in_transit",
    "OUT_FOR_DELIVERY": "out_for_delivery",
    "DELIVERED": "delivered",
    "DELIVERY_FAILED": "delivery_failed",
    "RETURNED": "returned",
    "CANCELLED": "cancelled",
}

CANONICAL_FOR_STORAGE = {
    "awaiting_details": "PENDING",
    "pending": "PENDING",
    "awaiting_payment": "PAYMENT_REQUIRED",
    "payment_required": "PAYMENT_REQUIRED",
    "paid": "PAYMENT_CONFIRMED",
    "payment_confirmed": "PAYMENT_CONFIRMED",
    "ready_to_ship": "READY_TO_SHIP",
    "pickup_scheduled": "PICKUP_SCHEDULED",
    "shipped": "PICKED_UP",
    "picked_up": "PICKED_UP",
    "in_transit": "IN_TRANSIT",
    "out_for_delivery": "OUT_FOR_DELIVERY",
    "delivered": "DELIVERED",
    "delivery_failed": "DELIVERY_FAILED",
    "returned": "RETURNED",
    "cancelled": "CANCELLED",
}

DELIVERED_STORAGE = frozenset({"delivered"})
IN_MOTION_STORAGE = frozenset({
    "shipped",
    "picked_up",
    "in_transit",
    "out_for_delivery",
    "delivered",
    "pickup_scheduled",
})

TIMELINE_STEPS = (
    ("PAYMENT_CONFIRMED", "Shipping Payment Confirmed"),
    ("READY_TO_SHIP", "Shipment Created"),
    ("PICKED_UP", "Picked Up"),
    ("IN_TRANSIT", "In Transit"),
    ("OUT_FOR_DELIVERY", "Out for Delivery"),
    ("DELIVERED", "Delivered"),
)

STATUS_RANK = {name: index for index, (name, _label) in enumerate(TIMELINE_STEPS)}
STATUS_RANK["PENDING"] = -2
STATUS_RANK["PAYMENT_REQUIRED"] = -1
STATUS_RANK["PICKUP_SCHEDULED"] = STATUS_RANK["READY_TO_SHIP"]
STATUS_RANK["DELIVERY_FAILED"] = STATUS_RANK["OUT_FOR_DELIVERY"]
STATUS_RANK["RETURNED"] = STATUS_RANK["DELIVERED"]
STATUS_RANK["CANCELLED"] = -3

STATUS_LABELS = {
    "PENDING": "Pending",
    "PAYMENT_REQUIRED": "Payment Required",
    "PAYMENT_CONFIRMED": "Payment Confirmed",
    "READY_TO_SHIP": "Ready to Ship",
    "PICKUP_SCHEDULED": "Pickup Scheduled",
    "PICKED_UP": "Picked Up",
    "IN_TRANSIT": "In Transit",
    "OUT_FOR_DELIVERY": "Out for Delivery",
    "DELIVERED": "Delivered",
    "DELIVERY_FAILED": "Delivery Failed",
    "RETURNED": "Returned",
    "CANCELLED": "Cancelled",
}


def canonical_status(value: str | None) -> str:
    raw = str(value or "PENDING").strip()
    upper = raw.upper()
    if upper in CANONICAL_STATUSES:
        return upper
    return CANONICAL_FOR_STORAGE.get(raw.lower(), "PENDING")


def storage_status(value: str | None) -> str:
    return STORAGE_FOR_CANONICAL[canonical_status(value)]


def status_label(value: str | None) -> str:
    return STATUS_LABELS.get(canonical_status(value), str(value or "Unknown").replace("_", " ").title())


def timeline_for_status(value: str | None) -> list[dict]:
    current = canonical_status(value)
    rank = STATUS_RANK.get(current, -2)
    steps = []
    for name, label in TIMELINE_STEPS:
        step_rank = STATUS_RANK[name]
        if current == "CANCELLED":
            state = "upcoming"
        elif current == "DELIVERY_FAILED" and name == "OUT_FOR_DELIVERY":
            state = "current"
        elif current == "RETURNED" and name == "DELIVERED":
            state = "current"
        elif step_rank < rank:
            state = "done"
        elif name == current or (current == "PICKUP_SCHEDULED" and name == "READY_TO_SHIP"):
            state = "current"
        else:
            state = "upcoming"
        steps.append({"key": name, "label": label, "state": state})
    return steps


def is_delivered_storage(value: str | None) -> bool:
    return storage_status(value) in DELIVERED_STORAGE


def is_in_motion_storage(value: str | None) -> bool:
    return storage_status(value) in IN_MOTION_STORAGE
