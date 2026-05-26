from datetime import datetime
from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, HttpUrl, field_validator

from app.services.location import SUPPORTED_COUNTRIES, normalize_country


ItemStatus = Literal["available", "reserved", "completed"]
LocationSource = Literal["manual", "current_location"]
StorageCondition = Literal["room_temp", "refrigerated", "frozen"]


class ItemFoodFields(BaseModel):
    expiry_date: date | None = None
    sealed_packaging: bool | None = None
    storage_condition: StorageCondition | None = None


class ItemLocationFields(BaseModel):
    country: str | None = Field(default=None, max_length=80)
    city: str | None = Field(default=None, max_length=120)
    area: str | None = Field(default=None, max_length=120)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    location_source: LocationSource = "manual"
    location_display: str | None = Field(default=None, max_length=200)

    @field_validator("country")
    @classmethod
    def validate_country(cls, value: str | None) -> str | None:
        if value is None or not str(value).strip():
            return None
        normalized = normalize_country(value)
        if normalized not in SUPPORTED_COUNTRIES:
            raise ValueError(f"Country must be one of: {', '.join(sorted(SUPPORTED_COUNTRIES))}")
        return normalized


class ItemCreateRequest(ItemLocationFields, ItemFoodFields):
    title: str = Field(min_length=3, max_length=120)
    description: str = Field(min_length=10, max_length=2000)
    category: str = Field(min_length=2, max_length=60)
    condition: str = Field(min_length=2, max_length=60)
    location: str = Field(min_length=2, max_length=120)
    image_url: HttpUrl | None = None


class ItemResponse(BaseModel):
    id: str
    title: str
    description: str
    category: str
    condition: str
    location: str
    country: str
    city: str | None = None
    area: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    location_source: LocationSource = "manual"
    location_display: str
    image_url: str | None = None
    status: ItemStatus
    owner_id: str
    owner_name: str
    owner_badge: str | None = None
    owner_average_rating: float | None = None
    owner_review_count: int | None = None
    created_at: datetime
    request_count: int | None = None
    distance_km: float | None = None
    expiry_date: date | None = None
    sealed_packaging: bool | None = None
    storage_condition: StorageCondition | None = None


class ItemImageUploadResponse(BaseModel):
    secure_url: HttpUrl
