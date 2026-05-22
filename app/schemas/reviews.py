from datetime import datetime

from pydantic import BaseModel, Field


class ReviewCreateRequest(BaseModel):
    item_id: str
    reviewed_user_id: str
    rating: int = Field(ge=1, le=5)
    comment: str = Field(min_length=2, max_length=400)


class ReviewResponse(BaseModel):
    id: str
    item_id: str
    request_id: str | None = None
    item_title: str
    reviewer_id: str
    reviewer_name: str
    reviewed_user_id: str
    rating: int
    comment: str
    created_at: datetime


class ReputationResponse(BaseModel):
    user_id: str
    current_badge: str
    completed_shared_count: int
    completed_received_count: int
    completed_exchange_count: int
    average_rating: float
    review_count: int
    submitted_review_item_ids: list[str]
