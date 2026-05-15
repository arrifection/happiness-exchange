from datetime import datetime
from typing import Literal

from pydantic import BaseModel


RequestStatus = Literal["pending", "approved", "rejected"]


class RequestResponse(BaseModel):
    id: str
    item_id: str
    item_title: str
    requester_id: str
    requester_name: str
    owner_id: str
    status: RequestStatus
    created_at: datetime
