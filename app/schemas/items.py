from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, HttpUrl


ItemStatus = Literal["available", "reserved", "completed"]


class ItemCreateRequest(BaseModel):
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
    image_url: str | None = None
    status: ItemStatus
    owner_id: str
    owner_name: str
    owner_badge: str | None = None
    owner_average_rating: float | None = None
    owner_review_count: int | None = None
    created_at: datetime
    request_count: int | None = None


class ItemImageUploadResponse(BaseModel):
    secure_url: HttpUrl
