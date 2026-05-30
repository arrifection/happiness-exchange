from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile

from app.api.deps.auth import get_current_user, get_verified_user
from app.core.roles import is_admin_role
from app.db.mongodb import get_conversations_collection_async, get_messages_collection_async, get_users_collection_async
from app.schemas.conversations import ConversationResponse, MessageResponse, SendMessageRequest
from app.services.auth import parse_object_id
from app.services.conversations import (
    ADMIN_DISPLAY_NAME,
    ADMIN_MEDIATED_CHAT_TYPES,
    chat_type_for_request_participant,
    ensure_admin_mediated_conversations,
    get_other_participant_id,
    is_admin_mediated,
    user_is_participant,
)
from app.services.display_names import resolve_user_display_name, sanitize_display_name
from app.services.notifications import create_notification
from app.services.cloudinary import (
    CloudinaryConfigError,
    CloudinaryUploadError,
    upload_image_to_cloudinary,
)
from app.services.image_validation import validate_and_sanitize_image

router = APIRouter()


def serialize_conversation(doc: dict, current_user: dict) -> dict:
    """Convert a MongoDB conversation document to API response shape."""
    current_user_id = current_user["id"]
    current_role = current_user.get("role", "user")
    if is_admin_mediated(doc) and is_admin_role(current_role):
        unread = doc.get("unread_counts", {}).get(doc.get("admin_id"), 0)
    else:
        unread = doc.get("unread_counts", {}).get(current_user_id, 0)
    item_title = doc.get("item_title", "")

    base = {
        "id": str(doc["_id"]),
        "item_id": doc["item_id"],
        "item_title": item_title,
        "giver_id": doc.get("giver_id", ""),
        "giver_name": doc.get("giver_name", ""),
        "receiver_id": doc.get("receiver_id", ""),
        "receiver_name": doc.get("receiver_name", ""),
        "request_id": doc.get("request_id", ""),
        "created_at": doc["created_at"],
        "last_message_at": doc.get("last_message_at"),
        "last_message_text": doc.get("last_message_text"),
        "unread_count": unread,
        "is_flagged": doc.get("is_flagged", False),
        "typing_status": doc.get("typing_status", {}),
        "chat_type": doc.get("chat_type"),
        "member_role": doc.get("member_role"),
        "admin_id": doc.get("admin_id"),
        "admin_name": doc.get("admin_name"),
        "member_id": doc.get("member_id"),
        "member_name": doc.get("member_name"),
        "counterpart_id": None,
        "counterpart_name": None,
        "list_title": None,
        "role_label": None,
    }

    if is_admin_mediated(doc):
        admin_display = doc.get("admin_display_name") or ADMIN_DISPLAY_NAME
        member_name = sanitize_display_name(doc.get("member_name"), fallback="User")
        item_title = sanitize_display_name(item_title, fallback="Item")
        role_label = "Receiver" if doc.get("member_role") == "receiver" else "Lister"

        if is_admin_role(current_role):
            base["counterpart_id"] = doc.get("member_id")
            base["counterpart_name"] = member_name
            base["role_label"] = role_label
            base["list_title"] = f"{role_label}: {member_name} — {item_title}"
        elif current_user_id == doc.get("member_id"):
            base["counterpart_id"] = doc.get("admin_id")
            base["counterpart_name"] = admin_display
            base["list_title"] = f"{admin_display} — {item_title}"
        else:
            base["counterpart_id"] = doc.get("admin_id")
            base["counterpart_name"] = admin_display
            base["list_title"] = f"{admin_display} — {item_title}"

    base["member_name"] = sanitize_display_name(base.get("member_name"), fallback="User")
    base["admin_name"] = sanitize_display_name(base.get("admin_name"), fallback=ADMIN_DISPLAY_NAME)
    base["giver_name"] = sanitize_display_name(base.get("giver_name"), fallback="User")
    base["receiver_name"] = sanitize_display_name(base.get("receiver_name"), fallback="User")
    base["item_title"] = sanitize_display_name(base.get("item_title"), fallback="Item")
    return base


def serialize_message(doc: dict) -> dict:
    """Convert a MongoDB message document to API response shape."""
    return {
        "id": str(doc["_id"]),
        "conversation_id": doc["conversation_id"],
        "sender_id": doc["sender_id"],
        "sender_name": sanitize_display_name(doc.get("sender_name"), fallback="User"),
        "text": doc["text"],
        "message_type": doc.get("message_type", "text"),
        "image_url": doc.get("image_url"),
        "created_at": doc["created_at"],
        "read": doc.get("read", False),
    }


def _conversation_list_query(current_user: dict) -> dict:
    user_id = current_user["id"]
    role = current_user.get("role", "user")
    if is_admin_role(role):
        return {"chat_type": {"$in": list(ADMIN_MEDIATED_CHAT_TYPES)}}
    return {"member_id": user_id, "chat_type": {"$in": list(ADMIN_MEDIATED_CHAT_TYPES)}}


def _require_participant(conv: dict, user_id: str, *, current_user: dict | None = None) -> None:
    if not is_admin_mediated(conv):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Direct messaging between members is disabled. Contact Happiness Exchange Admin.",
        )
    role = (current_user or {}).get("role", "user")
    if user_is_participant(conv, user_id):
        return
    if current_user and is_admin_role(role):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You are not a participant in this conversation.",
    )


@router.post(
    "/conversations/create",
    response_model=ConversationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_conversation(
    payload: dict,
    current_user: dict = Depends(get_current_user),
):
    """Ensure admin-mediated conversations exist and return the caller's chat."""
    from app.db.mongodb import get_items_collection_async, get_requests_collection_async

    conversations_col = await get_conversations_collection_async()
    requests_col = await get_requests_collection_async()
    items_col = await get_items_collection_async()
    users_col = await get_users_collection_async()

    if conversations_col is None or requests_col is None or items_col is None or users_col is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is not available.",
        )

    request_id_str = payload.get("request_id", "")
    request_oid = parse_object_id(request_id_str)
    if request_oid is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid request id.")

    request = await requests_col.find_one({"_id": request_oid})
    if request is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found.")

    if request["status"] != "approved":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="A conversation can only be created for an approved request.",
        )

    user_id = current_user["id"]
    chat_type = chat_type_for_request_participant(user_id=user_id, request=request)
    if chat_type is None and not is_admin_role(current_user.get("role", "user")):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the request participants or admin staff can access this chat.",
        )

    item_oid = parse_object_id(request["item_id"])
    item = await items_col.find_one({"_id": item_oid}) if item_oid else None
    await ensure_admin_mediated_conversations(
        conversations_col,
        users_col,
        request_id_str=request_id_str,
        request=request,
        item=item,
    )

    lookup_type = chat_type or ADMIN_MEDIATED_CHAT_TYPES[0]
    existing = await conversations_col.find_one(
        {"request_id": request_id_str, "chat_type": lookup_type}
    )
    if existing is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not create admin-mediated conversation.",
        )

    return serialize_conversation(existing, current_user)


@router.post("/conversations/{conversation_id}/upload-image", response_model=dict)
async def upload_chat_image(
    conversation_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_verified_user),
):
    """Upload a chat image to Cloudinary and return its secure URL."""
    conversations_col = await get_conversations_collection_async()
    if conversations_col is None:
        raise HTTPException(status_code=503, detail="Database connection is not available.")

    conv_oid = parse_object_id(conversation_id)
    if not conv_oid:
        raise HTTPException(status_code=400, detail="Invalid conversation id.")

    conv = await conversations_col.find_one({"_id": conv_oid})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    _require_participant(conv, current_user["id"], current_user=current_user)

    file_bytes = await file.read()
    await file.close()

    clean_bytes, content_type, safe_name = validate_and_sanitize_image(
        file_name=file.filename,
        file_bytes=file_bytes,
        content_type=file.content_type,
    )

    try:
        secure_url = await upload_image_to_cloudinary(
            file_name=f"chat-{conversation_id}-{int(datetime.now(timezone.utc).timestamp())}{Path(safe_name).suffix}",
            content_type=content_type,
            file_bytes=clean_bytes,
        )
    except CloudinaryConfigError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except CloudinaryUploadError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    return {"image_url": secure_url}


@router.get("/conversations/my", response_model=list[ConversationResponse])
async def list_my_conversations(current_user: dict = Depends(get_current_user)):
    """Return admin-mediated conversations visible to the current user."""
    conversations_col = await get_conversations_collection_async()
    if conversations_col is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is not available.",
        )

    query = _conversation_list_query(current_user)
    cursor = conversations_col.find(query).sort("last_message_at", -1)
    docs = await cursor.to_list(length=100)
    return [serialize_conversation(doc, current_user) for doc in docs]


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageResponse])
async def list_messages(
    conversation_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Return all messages in a conversation."""
    conversations_col = await get_conversations_collection_async()
    messages_col = await get_messages_collection_async()
    if conversations_col is None or messages_col is None:
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
    _require_participant(conv, user_id, current_user=current_user)

    unread_key = user_id
    if is_admin_role(current_user.get("role", "user")) and user_id != conv.get("admin_id"):
        unread_key = conv.get("admin_id")

    await messages_col.update_many(
        {"conversation_id": conversation_id, "sender_id": {"$ne": unread_key}, "read": False},
        {"$set": {"read": True}},
    )
    await conversations_col.update_one(
        {"_id": conv_oid},
        {"$set": {f"unread_counts.{unread_key}": 0}},
    )

    cursor = messages_col.find({"conversation_id": conversation_id}).sort("created_at", 1)
    docs = await cursor.to_list(length=500)
    return [serialize_message(doc) for doc in docs]


@router.post("/conversations/{conversation_id}/message", response_model=MessageResponse)
async def send_message(
    conversation_id: str,
    payload: SendMessageRequest,
    current_user: dict = Depends(get_verified_user),
):
    """Send a message to an admin-mediated conversation."""
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
    _require_participant(conv, user_id, current_user=current_user)

    if user_id == conv.get("member_id"):
        other_id = conv.get("admin_id")
    else:
        other_id = conv.get("member_id")

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
        profane_words = {"fuck", "shit", "bitch", "asshole", "cunt", "nigger", "faggot", "dick", "pussy", "slut", "whore"}
        text_lower = payload.text.lower()
        if any(bad_word in text_lower for bad_word in profane_words):
            raise HTTPException(status_code=400, detail="Your message contains prohibited language.")

    sender_name = resolve_user_display_name(current_user, fallback="User")
    if user_id != conv.get("member_id"):
        sender_name = conv.get("admin_display_name") or ADMIN_DISPLAY_NAME
    else:
        sender_name = sanitize_display_name(sender_name, fallback="User")

    msg_doc = {
        "conversation_id": conversation_id,
        "sender_id": user_id,
        "sender_name": sender_name,
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
    return serialize_message(created_msg)


@router.post("/conversations/{conversation_id}/report", response_model=dict)
async def report_conversation(
    conversation_id: str,
    payload: dict,
    current_user: dict = Depends(get_verified_user),
):
    """Report a conversation to admins."""
    from app.db.mongodb import get_db_async

    conversations_col = await get_conversations_collection_async()
    db = await get_db_async()
    if conversations_col is None or db is None:
        raise HTTPException(status_code=503, detail="Database connection is not available.")

    conv_oid = parse_object_id(conversation_id)
    if not conv_oid:
        raise HTTPException(status_code=400, detail="Invalid conversation id.")

    conv = await conversations_col.find_one({"_id": conv_oid})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    user_id = current_user["id"]
    _require_participant(conv, user_id, current_user=current_user)

    await conversations_col.update_one(
        {"_id": conv_oid},
        {"$set": {"is_flagged": True}},
    )

    reports_col = db["admin_reports"]
    await reports_col.insert_one({
        "reporter_id": user_id,
        "reporter_name": current_user["name"],
        "target_id": conversation_id,
        "target_type": "conversation",
        "reported_user_id": get_other_participant_id(conv, user_id),
        "reason": payload.get("reason", "Inappropriate behavior in chat"),
        "status": "open",
        "created_at": datetime.now(timezone.utc),
    })

    return {"status": "ok", "message": "Conversation reported successfully."}


@router.patch("/conversations/{conversation_id}/typing", response_model=dict)
async def set_typing_status(
    conversation_id: str,
    payload: dict,
    current_user: dict = Depends(get_current_user),
):
    """Update typing status."""
    conversations_col = await get_conversations_collection_async()
    if conversations_col is None:
        raise HTTPException(status_code=503, detail="Database connection is not available.")

    conv_oid = parse_object_id(conversation_id)
    if not conv_oid:
        raise HTTPException(status_code=400, detail="Invalid conversation id.")

    conv = await conversations_col.find_one({"_id": conv_oid})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    user_id = current_user["id"]
    _require_participant(conv, user_id, current_user=current_user)

    is_typing = payload.get("is_typing", False)
    await conversations_col.update_one(
        {"_id": conv_oid},
        {"$set": {f"typing_status.{user_id}": datetime.now(timezone.utc) if is_typing else None}},
    )

    return {"status": "ok"}
