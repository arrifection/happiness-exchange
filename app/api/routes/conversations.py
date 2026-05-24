from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from bson import ObjectId

from app.api.deps.auth import get_current_user, get_verified_user
from app.db.mongodb import get_conversations_collection_async, get_messages_collection_async
from app.schemas.conversations import ConversationResponse, MessageResponse, SendMessageRequest
from app.services.auth import parse_object_id
from app.services.notifications import create_notification
from app.services.cloudinary import (
    CloudinaryConfigError,
    CloudinaryUploadError,
    MAX_IMAGE_SIZE_BYTES,
    upload_image_to_cloudinary,
)

router = APIRouter()


def serialize_conversation(doc: dict, current_user_id: str) -> dict:
    """Convert a MongoDB conversation document to API response shape."""
    unread = doc.get("unread_counts", {}).get(current_user_id, 0)
    return {
        "id": str(doc["_id"]),
        "item_id": doc["item_id"],
        "item_title": doc.get("item_title", ""),
        "giver_id": doc["giver_id"],
        "giver_name": doc.get("giver_name", ""),
        "receiver_id": doc["receiver_id"],
        "receiver_name": doc.get("receiver_name", ""),
        "request_id": doc["request_id"],
        "created_at": doc["created_at"],
        "last_message_at": doc.get("last_message_at"),
        "last_message_text": doc.get("last_message_text"),
        "unread_count": unread,
        "is_flagged": doc.get("is_flagged", False),
        "typing_status": doc.get("typing_status", {}),
    }


def serialize_message(doc: dict) -> dict:
    """Convert a MongoDB message document to API response shape."""
    return {
        "id": str(doc["_id"]),
        "conversation_id": doc["conversation_id"],
        "sender_id": doc["sender_id"],
        "sender_name": doc.get("sender_name", ""),
        "text": doc["text"],
        "message_type": doc.get("message_type", "text"),
        "image_url": doc.get("image_url"),
        "created_at": doc["created_at"],
        "read": doc.get("read", False),
    }


@router.post(
    "/conversations/create",
    response_model=ConversationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_conversation(
    payload: dict,
    current_user: dict = Depends(get_current_user),
):
    """
    Create or return an existing conversation for an approved request.
    Payload: { "request_id": "..." }
    Only the giver or receiver of that request may call this.
    """
    from app.db.mongodb import get_items_collection_async, get_requests_collection_async

    conversations_col = await get_conversations_collection_async()
    requests_col = await get_requests_collection_async()
    items_col = await get_items_collection_async()

    if conversations_col is None or requests_col is None or items_col is None:
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
    if user_id not in (request["owner_id"], request["requester_id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the participants of this request can access the chat.",
        )

    # Return existing conversation if already exists
    existing = await conversations_col.find_one({"request_id": request_id_str})
    if existing is not None:
        return serialize_conversation(existing, user_id)

    # Fetch item for title
    item_oid = parse_object_id(request["item_id"])
    item = await items_col.find_one({"_id": item_oid}) if item_oid else None
    item_title = item["title"] if item else request.get("item_title", "")

    now = datetime.now(timezone.utc)
    doc = {
        "item_id": request["item_id"],
        "item_title": item_title,
        "giver_id": request["owner_id"],
        "giver_name": request.get("owner_name", ""),
        "receiver_id": request["requester_id"],
        "receiver_name": request.get("requester_name", ""),
        "request_id": request_id_str,
        "created_at": now,
        "last_message_at": None,
        "last_message_text": None,
        "unread_counts": {
            request["owner_id"]: 0,
            request["requester_id"]: 0,
        },
        "is_flagged": False,
    }
    result = await conversations_col.insert_one(doc)
    created = await conversations_col.find_one({"_id": result.inserted_id})
    return serialize_conversation(created, user_id)


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
        
    user_id = current_user["id"]
    if user_id not in (conv["giver_id"], conv["receiver_id"]):
        raise HTTPException(status_code=403, detail="Not a participant.")

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Please choose an image file (JPG, PNG, WEBP, etc.).")

    file_bytes = await file.read()
    await file.close()

    if not file_bytes:
        raise HTTPException(status_code=400, detail="The selected image is empty.")

    if len(file_bytes) > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="Please choose an image smaller than 5 MB.")

    try:
        secure_url = await upload_image_to_cloudinary(
            file_name=f"chat-{conversation_id}-{int(datetime.now(timezone.utc).timestamp())}",
            content_type=file.content_type,
            file_bytes=file_bytes,
        )
    except CloudinaryConfigError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except CloudinaryUploadError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    return {"image_url": secure_url}


@router.get("/conversations/my", response_model=list[ConversationResponse])
async def list_my_conversations(current_user: dict = Depends(get_current_user)):
    """Return all conversations where the current user is a participant."""
    conversations_col = await get_conversations_collection_async()
    if conversations_col is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is not available.",
        )

    user_id = current_user["id"]
    cursor = conversations_col.find(
        {"$or": [{"giver_id": user_id}, {"receiver_id": user_id}]}
    ).sort("last_message_at", -1)
    docs = await cursor.to_list(length=100)
    return [serialize_conversation(doc, user_id) for doc in docs]


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageResponse])
async def list_messages(
    conversation_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Return all messages in a conversation. Only participants may access."""
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
    if user_id not in (conv["giver_id"], conv["receiver_id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a participant in this conversation.",
        )

    # Mark messages as read for this user
    await messages_col.update_many(
        {"conversation_id": conversation_id, "sender_id": {"$ne": user_id}, "read": False},
        {"$set": {"read": True}},
    )
    # Reset unread count
    await conversations_col.update_one(
        {"_id": conv_oid},
        {"$set": {f"unread_counts.{user_id}": 0}},
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
    """Send a message to a conversation. Only participants may send."""
    from app.db.mongodb import get_users_collection_async
    
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
    if user_id not in (conv["giver_id"], conv["receiver_id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a participant in this conversation.",
        )

    # Determine the other participant
    other_id = conv["receiver_id"] if user_id == conv["giver_id"] else conv["giver_id"]

    # Blocked check
    other_user = await users_col.find_one({"_id": parse_object_id(other_id)})
    if other_user and user_id in other_user.get("blocked_users", []):
        raise HTTPException(status_code=403, detail="You have been blocked by this user.")
    
    current_db_user = await users_col.find_one({"_id": parse_object_id(user_id)})
    if current_db_user and other_id in current_db_user.get("blocked_users", []):
        raise HTTPException(status_code=403, detail="You have blocked this user. Unblock to send messages.")

    # Spam check (rate limit)
    now = datetime.now(timezone.utc)
    ten_seconds_ago = now - timedelta(seconds=10)
    recent_msgs = await messages_col.count_documents({
        "sender_id": user_id,
        "created_at": {"$gte": ten_seconds_ago}
    })
    if recent_msgs >= 5:
        raise HTTPException(status_code=429, detail="You are sending messages too fast. Please slow down.")

    # Profanity check
    if payload.text:
        profane_words = {"fuck", "shit", "bitch", "asshole", "cunt", "nigger", "faggot", "dick", "pussy", "slut", "whore"}
        text_lower = payload.text.lower()
        if any(bad_word in text_lower for bad_word in profane_words):
            raise HTTPException(status_code=400, detail="Your message contains prohibited language.")

    msg_doc = {
        "conversation_id": conversation_id,
        "sender_id": user_id,
        "sender_name": current_user["name"],
        "text": payload.text.strip() if payload.text else "",
        "message_type": payload.message_type,
        "image_url": payload.image_url,
        "created_at": now,
        "read": False,
    }
    result = await messages_col.insert_one(msg_doc)

    # Update conversation metadata
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

    # Notify receiver
    import asyncio
    asyncio.create_task(
        create_notification(
            user_id=other_id,
            title=f"New Message from {current_user['name']}",
            message=last_text,
            type_="new_message",
            action_url=f"/messages?conversation={conversation_id}"
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
    """Report a conversation."""
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
    if user_id not in (conv["giver_id"], conv["receiver_id"]):
        raise HTTPException(status_code=403, detail="Not a participant.")
        
    other_id = conv["receiver_id"] if user_id == conv["giver_id"] else conv["giver_id"]
    
    await conversations_col.update_one(
        {"_id": conv_oid},
        {"$set": {"is_flagged": True}}
    )
    
    reports_col = db["reports"]
    await reports_col.insert_one({
        "reporter_id": user_id,
        "reporter_name": current_user["name"],
        "target_id": conversation_id,
        "target_type": "conversation",
        "reported_user_id": other_id,
        "reason": payload.get("reason", "Inappropriate behavior in chat"),
        "status": "pending",
        "created_at": datetime.now(timezone.utc)
    })
    
    return {"status": "ok", "message": "Conversation reported successfully."}


@router.patch("/conversations/{conversation_id}/typing", response_model=dict)
async def set_typing_status(
    conversation_id: str,
    payload: dict,
    current_user: dict = Depends(get_current_user),
):
    """Update typing status. For polling MVPs, we update a transient field."""
    conversations_col = await get_conversations_collection_async()
    if conversations_col is None:
        raise HTTPException(status_code=503, detail="Database connection is not available.")
        
    conv_oid = parse_object_id(conversation_id)
    if not conv_oid:
        raise HTTPException(status_code=400, detail="Invalid conversation id.")
        
    is_typing = payload.get("is_typing", False)
    user_id = current_user["id"]
    
    # Store typing status with a timestamp so the other user can ignore stale typing states (>5s old)
    await conversations_col.update_one(
        {"_id": conv_oid},
        {"$set": {f"typing_status.{user_id}": datetime.now(timezone.utc) if is_typing else None}}
    )
    
    return {"status": "ok"}
