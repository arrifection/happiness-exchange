"""Shared conversation message send logic."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status

from app.core.roles import is_admin_role
from app.db.mongodb import (
    get_conversations_collection_async,
    get_messages_collection_async,
    get_users_collection_async,
)
from app.schemas.conversations import SendMessageRequest
from app.services.auth import parse_object_id
from app.services.conversations import is_admin_mediated
from app.services.message_identity import (
    RECEIVER_ROLE_ADMIN,
    RECEIVER_ROLE_USER,
    _ids_match,
    build_message_identity,
    resolve_admin_receiver_id,
    serialize_message_fields,
)
from app.services.notifications import create_notification


def _require_admin_mediated_participant(conv: dict, user_id: str, *, current_user: dict) -> None:
    if not is_admin_mediated(conv):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Direct messaging between members is disabled. Contact Happiness Exchange Admin.",
        )
    member_id = conv.get("member_id")
    admin_id = conv.get("admin_id")
    role = current_user.get("role", "user")
    if user_id in (member_id, admin_id):
        return
    if is_admin_role(role):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You are not a participant in this conversation.",
    )


async def send_conversation_message(
    *,
    conversation_id: str,
    payload: SendMessageRequest,
    current_user: dict,
    force_admin_sender: bool = False,
) -> dict:
    """Insert a message; sender identity always comes from auth, never the request body."""
    conversations_col = await get_conversations_collection_async()
    messages_col = await get_messages_collection_async()
    users_col = await get_users_collection_async()
    if conversations_col is None or messages_col is None or users_col is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is not available.",
        )

    conv_oid = parse_object_id(conversation_id)
    if conv_oid is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid conversation id.")

    conv = await conversations_col.find_one({"_id": conv_oid})
    if conv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")

    user_id = current_user["id"]
    user_role = current_user.get("role", "user")
    _require_admin_mediated_participant(conv, user_id, current_user=current_user)

    member_id = conv.get("member_id")
    admin_id = conv.get("admin_id")

    if force_admin_sender:
        if not is_admin_role(user_role):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admin staff can send admin messages in this thread.",
            )
        other_id = member_id
        receiver_id = member_id or ""
        receiver_role = RECEIVER_ROLE_USER
    elif _ids_match(user_id, member_id):
        other_id = admin_id
        receiver_id = await resolve_admin_receiver_id(
            messages_col,
            conversation_id=conversation_id,
            fallback_admin_id=admin_id or "",
            member_id=str(member_id or ""),
        )
        receiver_role = RECEIVER_ROLE_ADMIN
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the conversation member can reply here. Admin staff should use the admin panel.",
        )

    if not other_id:
        raise HTTPException(status_code=400, detail="Invalid conversation participants.")

    if other_id != conv.get("admin_id"):
        other_user = await users_col.find_one({"_id": parse_object_id(other_id)})
        if other_user and user_id in other_user.get("blocked_users", []):
            raise HTTPException(status_code=403, detail="You have been blocked by this user.")

        current_db_user = await users_col.find_one({"_id": parse_object_id(user_id)})
        if current_db_user and other_id in current_db_user.get("blocked_users", []):
            raise HTTPException(status_code=403, detail="You have blocked this user. Unblock to send messages.")

    now = datetime.now(timezone.utc)
    ten_seconds_ago = now - timedelta(seconds=10)
    recent_msgs = await messages_col.count_documents({
        "sender_id": user_id,
        "created_at": {"$gte": ten_seconds_ago},
    })
    if recent_msgs >= 5:
        raise HTTPException(status_code=429, detail="You are sending messages too fast. Please slow down.")

    if payload.text:
        profane_words = {
            "fuck", "shit", "bitch", "asshole", "cunt", "nigger",
            "faggot", "dick", "pussy", "slut", "whore",
        }
        text_lower = payload.text.lower()
        if any(bad_word in text_lower for bad_word in profane_words):
            raise HTTPException(status_code=400, detail="Your message contains prohibited language.")

    try:
        identity = build_message_identity(
            conv=conv,
            current_user=current_user,
            receiver_id=receiver_id,
            receiver_role=receiver_role,
            force_admin_sender=force_admin_sender,
        )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not allowed to send messages in this conversation.",
        )

    sender_name = identity["sender_name"]

    msg_doc = {
        "conversation_id": conversation_id,
        "sender_id": identity["sender_id"],
        "sender_role": identity["sender_role"],
        "sender_name": identity["sender_name"],
        "receiver_id": identity["receiver_id"],
        "receiver_role": identity["receiver_role"],
        "text": payload.text.strip() if payload.text else "",
        "message_type": payload.message_type,
        "image_url": payload.image_url,
        "created_at": now,
        "read": False,
    }
    result = await messages_col.insert_one(msg_doc)

    last_text = payload.text.strip()[:100] if payload.text else "Sent an image"
    await conversations_col.update_one(
        {"_id": conv_oid},
        {
            "$set": {
                "last_message_at": now,
                "last_message_text": last_text,
            },
            "$inc": {f"unread_counts.{other_id}": 1},
        },
    )

    import asyncio

    asyncio.create_task(
        create_notification(
            user_id=other_id,
            title=f"New message from {sender_name}",
            message=last_text,
            type_="new_message",
            action_url=f"/messages/{conversation_id}",
        )
    )

    created_msg = await messages_col.find_one({"_id": result.inserted_id})
    return serialize_message_fields(created_msg, conv=conv, current_user=current_user)
