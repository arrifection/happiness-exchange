"""Location helpers for listings — country/city filters and legacy compatibility."""

from __future__ import annotations

import math
import re
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

CITY_COORDINATES: dict[str, dict[str, tuple[float, float]]] = {
    "Pakistan": {
        "Lahore": (31.5497, 74.3436),
        "Islamabad": (33.6844, 73.0479),
        "Karachi": (24.8607, 67.0011),
        "Rawalpindi": (33.5651, 73.0169),
        "Faisalabad": (31.4504, 73.1350),
        "Multan": (30.1575, 71.5249),
        "Gujrat": (32.5742, 74.0754),
        "Mandi Bahauddin": (32.5870, 73.4910),
        "Gujranwala": (32.1877, 74.1945),
        "Sialkot": (32.4945, 74.5229),
        "Peshawar": (34.0151, 71.5249),
        "Quetta": (30.1798, 66.9750),
        "Hyderabad": (25.3960, 68.3578),
        "Bahawalpur": (29.3956, 71.6833),
        "Sargodha": (32.0836, 72.6711),
        "Sukkur": (27.7052, 68.8574),
        "Larkana": (27.5600, 68.2260),
        "Sheikhupura": (31.7167, 73.9850),
        "Jhang": (31.2682, 72.3181),
        "Rahim Yar Khan": (28.4202, 70.2989),
        "Kasur": (31.1156, 74.4508),
    },
    "Saudi Arabia": {
        "Riyadh": (24.7136, 46.6753),
        "Jeddah": (21.4858, 39.1925),
        "Makkah": (21.3891, 39.8579),
        "Madina": (24.5247, 39.5692),
        "Madinah": (24.5247, 39.5692),
        "Dammam": (26.3927, 49.9777),
        "Khobar": (26.2172, 50.1971),
        "Taif": (21.4373, 40.5127),
    },
}


def get_city_coordinates(country: str | None, city: str | None) -> tuple[float, float] | None:
    if not country or not city:
        return None
    normalized_country = normalize_country(country)
    city_clean = normalize_city(city)
    if not city_clean:
        return None
    coords = CITY_COORDINATES.get(normalized_country, {}).get(city_clean)
    if coords:
        return coords
    for name, value in CITY_COORDINATES.get(normalized_country, {}).items():
        if name.lower() == city_clean.lower():
            return value
    return None


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
    if latitude is not None and longitude is not None:
        payload["latitude"] = float(latitude)
        payload["longitude"] = float(longitude)
    else:
        city_coords = get_city_coordinates(resolved_country, resolved_city)
        if city_coords:
            payload["latitude"] = city_coords[0]
            payload["longitude"] = city_coords[1]
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


def build_items_list_query(
    *,
    country: str | None = None,
    city: str | None = None,
    status: str | None = "available",
) -> dict[str, Any]:
    """Build a MongoDB filter for public item browse queries."""
    query: dict[str, Any] = {}
    and_clauses: list[dict[str, Any]] = []

    if status:
        query["status"] = status

    if country:
        normalized = normalize_country(country)
        if normalized == DEFAULT_COUNTRY:
            and_clauses.append(
                {
                    "$or": [
                        {"country": DEFAULT_COUNTRY},
                        {"country": UNKNOWN_COUNTRY},
                        {"country": None},
                        {"country": {"$exists": False}},
                    ]
                }
            )
        elif normalized in SUPPORTED_COUNTRIES:
            query["country"] = normalized

    if city:
        city_clean = city.strip()
        if city_clean:
            pattern = {"$regex": f"^{re.escape(city_clean)}$", "$options": "i"}
            and_clauses.append({"$or": [{"city": pattern}, {"location": pattern}]})

    if and_clauses:
        query["$and"] = and_clauses

    return query


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
