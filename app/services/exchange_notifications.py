"""User-facing Exchange notification copy. Reuses the existing notification service."""


def listing_label(title: str | None, fallback: str = "this listing") -> str:
    text = " ".join(str(title or "").split())
    return text[:120] if text else fallback


def person_label(name: str | None, fallback: str = "Someone") -> str:
    text = " ".join(str(name or "").split())
    return text[:80] if text else fallback


def new_swap_offer_copy(offerer_name: str | None, listing_title: str | None) -> tuple[str, str]:
    return (
        "New Swap Offer",
        f"{person_label(offerer_name)} sent you a swap offer for {listing_label(listing_title)}.",
    )


def offer_accepted_copy(listing_title: str | None) -> tuple[str, str]:
    return (
        "Swap Accepted",
        f"Your swap offer for {listing_label(listing_title)} was accepted. Add shipping details to continue.",
    )


def reserved_copy(listing_title: str | None) -> tuple[str, str]:
    return (
        "Swap Reserved",
        f"{listing_label(listing_title, 'Your listing')} is reserved for an exchange. Add shipping details to continue.",
    )


def offer_declined_copy(listing_title: str | None) -> tuple[str, str]:
    return (
        "Swap Declined",
        f"Your swap offer for {listing_label(listing_title)} was declined.",
    )


def counter_received_copy(listing_title: str | None) -> tuple[str, str]:
    return (
        "Counter Offer",
        f"The owner sent you a counter offer for {listing_label(listing_title)}.",
    )


def counter_accepted_copy(listing_title: str | None) -> tuple[str, str]:
    return (
        "Counter Offer Accepted",
        f"Your counter offer for {listing_label(listing_title)} was accepted.",
    )


def shipping_payment_required_copy() -> tuple[str, str]:
    return (
        "Shipping Payment Required",
        "Shipping payment is required for your exchange.",
    )


def shipping_payment_confirmed_copy() -> tuple[str, str]:
    return (
        "Shipping Payment Confirmed",
        "Your shipping payment reference was recorded. Admin will share shipping instructions next.",
    )


def item_shipped_copy() -> tuple[str, str]:
    return (
        "Item Shipped",
        "Your exchange partner has shipped their item.",
    )


def tracking_updated_copy() -> tuple[str, str]:
    return (
        "Tracking Updated",
        "New tracking information is available for your exchange.",
    )


def item_delivered_copy() -> tuple[str, str]:
    return (
        "Item Delivered",
        "Your exchange item has been marked delivered.",
    )


def completed_copy(listing_title: str | None) -> tuple[str, str]:
    return (
        "Exchange Completed",
        f"Your exchange for {listing_label(listing_title, 'your item')} has been completed.",
    )


def expired_copy() -> tuple[str, str]:
    return (
        "Exchange Expired",
        "An exchange has expired.",
    )


def cancelled_copy() -> tuple[str, str]:
    return (
        "Exchange Cancelled",
        "An exchange has been cancelled.",
    )


def partner_shipping_update_copy() -> tuple[str, str]:
    return (
        "Shipping Details Received",
        "Your swap partner submitted shipping details. Payment may be required next.",
    )
