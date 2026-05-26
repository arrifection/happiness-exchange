from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.services.location import SUPPORTED_COUNTRIES, normalize_country


NeedUrgency = Literal["low", "normal", "urgent"]
NeedStatus = Literal["open", "fulfilled", "closed"]


class NeedRequestCreateRequest(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    description: str = Field(min_length=10, max_length=2000)
    category: str = Field(min_length=2, max_length=60)
    country: str = Field(min_length=2, max_length=80)
    city: str = Field(min_length=2, max_length=120)
    urgency: NeedUrgency = "normal"

    @field_validator("country")
    @classmethod
    def validate_country(cls, value: str) -> str:
        normalized = normalize_country(value)
        if normalized not in SUPPORTED_COUNTRIES:
            raise ValueError(f"Country must be one of: {', '.join(sorted(SUPPORTED_COUNTRIES))}")
        return normalized


class NeedRequestResponse(BaseModel):
    id: str
    title: str
    description: str
    category: str
    country: str
    city: str
    urgency: NeedUrgency
    status: NeedStatus
    created_by: str
    created_by_name: str
    created_at: datetime
