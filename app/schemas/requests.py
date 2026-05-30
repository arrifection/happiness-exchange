from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


RequestStatus = Literal["pending", "approved", "rejected"]


class RequestCreateRequest(BaseModel):
    reason: str = Field(
        ...,
        min_length=30,
        max_length=500,
        description="Why the requester needs this item.",
    )


class RequesterReputationSummary(BaseModel):
    level: str
    trust_score: int
    next_level_points: int | None = None
    average_rating: float | None = None
    review_count: int = 0


class RequestResponse(BaseModel):
    id: str
    item_id: str
    item_title: str
    requester_id: str
    requester_name: str
    owner_id: str
    reason: str
    status: RequestStatus
    created_at: datetime
    requester_reputation: RequesterReputationSummary | None = None
