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
    is_flagged: bool = False
    typing_status: dict = Field(default_factory=dict)
    chat_type: str | None = None
    member_role: str | None = None
    admin_id: str | None = None
    admin_name: str | None = None
    member_id: str | None = None
    member_name: str | None = None
    counterpart_id: str | None = None
    counterpart_name: str | None = None
    list_title: str | None = None
    role_label: str | None = None

    model_config = ConfigDict(from_attributes=True)


class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    sender_id: str
    sender_name: str
    text: str
    message_type: str = "text"
    image_url: str | None = None
    created_at: datetime
    read: bool = False

    model_config = ConfigDict(from_attributes=True)


class SendMessageRequest(BaseModel):
    text: str | None = Field(default=None, max_length=2000)
    message_type: str = "text"
    image_url: str | None = None
