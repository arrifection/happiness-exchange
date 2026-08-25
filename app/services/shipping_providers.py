"""Carrier provider interface. Manual admin updates are the default implementation."""

from __future__ import annotations

from abc import ABC, abstractmethod


class ShippingProvider(ABC):
    """Future carrier APIs (DHL, TCS, FedEx, Leopards) implement this contract."""

    name: str = "manual"

    @abstractmethod
    def tracking_url(self, tracking_number: str) -> str | None:
        """Public carrier tracking URL. Must not include private addresses."""

    def supports_live_status(self) -> bool:
        return False

    def fetch_status(self, tracking_number: str) -> dict | None:
        del tracking_number
        return None


class ManualShippingProvider(ShippingProvider):
    name = "manual"

    def tracking_url(self, tracking_number: str) -> str | None:
        if not tracking_number:
            return None
        return None


class DhlShippingProvider(ShippingProvider):
    name = "dhl"

    def tracking_url(self, tracking_number: str) -> str | None:
        if not tracking_number:
            return None
        return f"https://www.dhl.com/en/express/tracking.html?AWB={tracking_number}"


class FedexShippingProvider(ShippingProvider):
    name = "fedex"

    def tracking_url(self, tracking_number: str) -> str | None:
        if not tracking_number:
            return None
        return f"https://www.fedex.com/fedextrack/?trknbr={tracking_number}"


class TcsShippingProvider(ShippingProvider):
    name = "tcs"

    def tracking_url(self, tracking_number: str) -> str | None:
        if not tracking_number:
            return None
        return "https://www.tcsexpress.com/track"


class LeopardsShippingProvider(ShippingProvider):
    name = "leopards"

    def tracking_url(self, tracking_number: str) -> str | None:
        if not tracking_number:
            return None
        return "https://www.leopardscourier.com/leopards-tracking"


_PROVIDERS: dict[str, ShippingProvider] = {
    "manual": ManualShippingProvider(),
    "dhl": DhlShippingProvider(),
    "fedex": FedexShippingProvider(),
    "tcs": TcsShippingProvider(),
    "leopards": LeopardsShippingProvider(),
}


def get_shipping_provider(carrier: str | None) -> ShippingProvider:
    key = str(carrier or "manual").strip().lower()
    return _PROVIDERS.get(key, _PROVIDERS["manual"])


def public_carrier_tracking_url(carrier: str | None, tracking_number: str | None) -> str | None:
    if not tracking_number:
        return None
    return get_shipping_provider(carrier).tracking_url(tracking_number.strip())
