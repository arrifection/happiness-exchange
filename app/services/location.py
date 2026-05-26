"""Location helpers for listings — country/city filters and legacy compatibility."""

from __future__ import annotations

import math
from typing import Any, Literal

LocationSource = Literal["manual", "current_location"]

DEFAULT_COUNTRY = "Pakistan"
UNKNOWN_COUNTRY = "Unknown"

SUPPORTED_COUNTRIES = frozenset({"Pakistan", "Saudi Arabia"})

PAKISTAN_CITIES = frozenset({
    "Lahore", "Islamabad", "Karachi", "Rawalpindi", "Faisalabad", "Multan",
    "Gujrat", "Mandi Bahauddin", "Gujranwala", "Sialkot", "Peshawar", "Quetta",
    "Hyderabad", "Bahawalpur", "Sargodha", "Sukkur", "Larkana", "Sheikhupura",
    "Jhang", "Rahim Yar Khan", "Kasur",
})

SAUDI_CITIES = frozenset({
    "Riyadh", "Jeddah", "Makkah", "Madina", "Madinah", "Dammam", "Khobar", "Taif",
})

CITIES_BY_COUNTRY: dict[str, frozenset[str]] = {
    "Pakistan": PAKISTAN_CITIES,
    "Saudi Arabia": SAUDI_CITIES,
}


def normalize_country(value: str | None) -> str:
    if not value or not str(value).strip():
        return DEFAULT_COUNTRY
    cleaned = str(value).strip()
    for country in SUPPORTED_COUNTRIES:
        if cleaned.lower() == country.lower():
            return country
    return cleaned


def normalize_city(value: str | None) -> str | None:
    if not value or not str(value).strip():
        return None
    return str(value).strip()


def infer_country_from_city(city: str | None) -> str:
    if not city:
        return DEFAULT_COUNTRY
    if city in SAUDI_CITIES:
        return "Saudi Arabia"
    if city in PAKISTAN_CITIES:
        return "Pakistan"
    return DEFAULT_COUNTRY


def build_location_display(
    *,
    country: str,
    city: str | None,
    area: str | None = None,
    location_source: str = "manual",
) -> str:
    if location_source == "current_location":
        if city and country:
            return f"Current location · {city}, {country}"
        return "Current location selected"
    parts = [part for part in (area, city, country) if part]
    return ", ".join(parts) if parts else country


def enrich_item_location(item: dict[str, Any]) -> dict[str, Any]:
    """Fill missing location fields on a stored item document (legacy support)."""
    enriched = dict(item)
    legacy_location = normalize_city(item.get("location")) or normalize_city(item.get("city"))
    country = item.get("country")
    if country:
        country = normalize_country(country)
    else:
        country = infer_country_from_city(legacy_location)

    city = normalize_city(item.get("city")) or legacy_location
    area = normalize_city(item.get("area"))
    location_source = item.get("location_source") or "manual"
    if location_source not in ("manual", "current_location"):
        location_source = "manual"

    location_display = item.get("location_display")
    if not location_display:
        location_display = build_location_display(
            country=country,
            city=city,
            area=area,
            location_source=location_source,
        )

    enriched["country"] = country
    enriched["city"] = city
    enriched["area"] = area
    enriched["location"] = legacy_location or city or location_display
    enriched["location_source"] = location_source
    enriched["location_display"] = location_display
    return enriched


def build_item_location_payload(
    *,
    location: str,
    country: str | None = None,
    city: str | None = None,
    area: str | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
    location_source: str = "manual",
    location_display: str | None = None,
) -> dict[str, Any]:
    resolved_country = normalize_country(country)
    resolved_city = normalize_city(city) or normalize_city(location)
    resolved_area = normalize_city(area)
    resolved_source: LocationSource = (
        "current_location" if location_source == "current_location" else "manual"
    )
    resolved_display = location_display or build_location_display(
        country=resolved_country,
        city=resolved_city,
        area=resolved_area,
        location_source=resolved_source,
    )
    legacy_location = resolved_city or normalize_city(location) or resolved_display

    payload: dict[str, Any] = {
        "country": resolved_country,
        "city": resolved_city,
        "area": resolved_area,
        "location": legacy_location,
        "location_source": resolved_source,
        "location_display": resolved_display,
    }
    if latitude is not None:
        payload["latitude"] = float(latitude)
    if longitude is not None:
        payload["longitude"] = float(longitude)
    return payload


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    radius_km = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lng2 - lng1)
    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    )
    return radius_km * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def item_matches_country(item: dict[str, Any], country: str | None) -> bool:
    if not country:
        return True
    normalized = normalize_country(country)
    enriched = enrich_item_location(item)
    item_country = normalize_country(enriched.get("country"))
    if normalized == DEFAULT_COUNTRY:
        return item_country in {DEFAULT_COUNTRY, UNKNOWN_COUNTRY} or not item.get("country")
    return item_country.lower() == normalized.lower()


def item_matches_city(item: dict[str, Any], city: str | None) -> bool:
    if not city:
        return True
    enriched = enrich_item_location(item)
    item_city = (enriched.get("city") or enriched.get("location") or "").lower()
    return item_city == city.strip().lower()


def item_within_radius(
    item: dict[str, Any],
    near_lat: float,
    near_lng: float,
    radius_km: float,
) -> bool:
    lat = item.get("latitude")
    lng = item.get("longitude")
    if lat is None or lng is None:
        return False
    return haversine_km(near_lat, near_lng, float(lat), float(lng)) <= radius_km


def filter_and_sort_items(
    items: list[dict[str, Any]],
    *,
    country: str | None = None,
    city: str | None = None,
    near_lat: float | None = None,
    near_lng: float | None = None,
    radius_km: float | None = None,
) -> list[dict[str, Any]]:
    results = items
    if country:
        results = [item for item in results if item_matches_country(item, country)]
    if city:
        results = [item for item in results if item_matches_city(item, city)]

    if near_lat is not None and near_lng is not None:
        effective_radius = radius_km if radius_km and radius_km > 0 else 50.0
        with_coords = [
            item for item in results
            if item.get("latitude") is not None and item.get("longitude") is not None
            and item_within_radius(item, near_lat, near_lng, effective_radius)
        ]
        if with_coords:
            with_coords.sort(
                key=lambda item: haversine_km(
                    near_lat,
                    near_lng,
                    float(item["latitude"]),
                    float(item["longitude"]),
                )
            )
            return with_coords
        # Fall back to country/city filtering when no coordinates match.

    return results
