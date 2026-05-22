from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ConversationResponse(BaseModel):
    id: str
    item_id: str
    item_title: str
    giver_id: str
    giver_name: str
    receiver_id: str
    receiver_name: str
    request_id: str
    created_at: datetime
    last_message_at: datetime | None = None
    last_message_text: str | None = None
    unread_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    sender_id: str
    sender_name: str
    text: str
    created_at: datetime
    read: bool = False

    model_config = ConfigDict(from_attributes=True)


class SendMessageRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
