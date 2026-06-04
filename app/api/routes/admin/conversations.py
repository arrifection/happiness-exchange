"""
Admin mediated conversation routes.

GET  /api/admin/conversations              — grouped exchanges with receiver/lister chats
POST /api/admin/conversations/{request_id}/repair — ensure missing chats exist
POST /api/admin/conversations/{conversation_id}/message — admin send (always sender_role=admin)
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo import DESCENDING

from app.api.deps.admin import require_permission
from app.core.admin_permissions import PERMISSION_MESSAGES
from app.db.mongodb import (
    get_conversations_collection_async,
    get_items_collection_async,
    get_requests_collection_async,
    get_users_collection_async,
)
from app.schemas.conversations import MessageResponse, SendMessageRequest
from app.services.auth import parse_object_id
from app.services.conversation_messages import send_conversation_message
from app.services.conversations import (
    CHAT_ADMIN_LISTER,
    CHAT_ADMIN_RECEIVER,
    ensure_admin_mediated_conversations,
)

router = APIRouter()

MEDIATED_REQUEST_STATUSES = frozenset({"approved", "completed"})


def _serialize_chat(doc: dict | None) -> dict | None:
    if doc is None:
        return None
    admin_id = doc.get("admin_id", "")
    unread = doc.get("unread_counts", {}).get(admin_id, 0)
    chat_type = doc.get("chat_type")
    member_role = doc.get("member_role")
    role_label = "Receiver" if member_role == "receiver" or chat_type == CHAT_ADMIN_RECEIVER else "Lister"

    return {
        "id": str(doc["_id"]),
        "chat_type": chat_type,
        "member_role": member_role,
        "role_label": role_label,
        "member_id": doc.get("member_id"),
        "member_name": doc.get("member_name"),
        "admin_id": admin_id,
        "admin_name": doc.get("admin_name"),
        "last_message_text": doc.get("last_message_text"),
        "last_message_at": doc.get("last_message_at"),
        "unread_count": unread,
        "created_at": doc.get("created_at"),
    }


async def _load_user_emails(user_ids: set[str]) -> dict[str, dict]:
    users_col = await get_users_collection_async()
    lookup: dict[str, dict] = {}
    if users_col is None or not user_ids:
        return lookup

    oids = [oid for uid in user_ids if (oid := parse_object_id(uid)) is not None]
    if not oids:
        return lookup

    cursor = users_col.find({"_id": {"$in": oids}}, {"name": 1, "email": 1})
    async for user in cursor:
        lookup[str(user["_id"])] = {
            "name": user.get("name") or "",
            "email": user.get("email") or "",
        }
    return lookup


async def _load_item_images(item_ids: set[str]) -> dict[str, dict]:
    items_col = await get_items_collection_async()
    lookup: dict[str, dict] = {}
    if items_col is None or not item_ids:
        return lookup

    oids = [oid for iid in item_ids if (oid := parse_object_id(iid)) is not None]
    if not oids:
        return lookup

    cursor = items_col.find({"_id": {"$in": oids}}, {"title": 1, "image_url": 1, "status": 1})
    async for item in cursor:
        lookup[str(item["_id"])] = {
            "title": item.get("title") or "",
            "image_url": item.get("image_url"),
            "status": item.get("status"),
        }
    return lookup


async def _conversations_for_requests(request_ids: list[str]) -> dict[str, dict[str, dict]]:
    conversations_col = await get_conversations_collection_async()
    grouped: dict[str, dict[str, dict]] = {rid: {} for rid in request_ids}
    if conversations_col is None or not request_ids:
        return grouped

    cursor = conversations_col.find(
        {
            "request_id": {"$in": request_ids},
            "chat_type": {"$in": [CHAT_ADMIN_RECEIVER, CHAT_ADMIN_LISTER]},
        }
    )
    async for doc in cursor:
        request_id = doc.get("request_id")
        chat_type = doc.get("chat_type")
        if request_id in grouped and chat_type:
            grouped[request_id][chat_type] = doc
    return grouped


def _matches_search(exchange: dict, query: str) -> bool:
    q = query.lower()
    haystack = " ".join(
        str(exchange.get(key) or "")
        for key in (
            "request_id",
            "item_title",
            "requester_name",
            "requester_email",
            "owner_name",
            "owner_email",
            "reason",
            "receiver_last_message",
            "lister_last_message",
        )
    ).lower()
    return q in haystack


@router.get("")
async def list_admin_conversations(
    search: str = Query("", description="Search item, people, request id, or message preview"),
    status_filter: str = Query("", alias="status", description="approved | completed | all"),
    chat_filter: str = Query("all", description="all | receiver | lister | unread"),
    item_id: str = Query("", description="Filter by listing/item id"),
    request_id: str = Query("", description="Filter by exact request id"),
    limit: int = Query(50, ge=1, le=100),
    skip: int = Query(0, ge=0),
    repair_missing: bool = Query(True, description="Create missing mediated chats for approved requests"),
    admin: dict = Depends(require_permission(PERMISSION_MESSAGES)),
):
    """List approved exchanges grouped with admin_receiver and admin_lister chats."""
    requests_col = await get_requests_collection_async()
    conversations_col = await get_conversations_collection_async()
    users_col = await get_users_collection_async()
    items_col = await get_items_collection_async()

    if requests_col is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")

    query: dict = {"status": {"$in": sorted(MEDIATED_REQUEST_STATUSES)}}
    if status_filter and status_filter in MEDIATED_REQUEST_STATUSES:
        query["status"] = status_filter
    if item_id:
        query["item_id"] = item_id
    if request_id:
        oid = parse_object_id(request_id)
        if oid is None:
            raise HTTPException(status_code=400, detail="Invalid request ID.")
        query["_id"] = oid

    if search and not item_id and not request_id:
        query["$or"] = [
            {"item_title": {"$regex": search, "$options": "i"}},
            {"requester_name": {"$regex": search, "$options": "i"}},
            {"owner_name": {"$regex": search, "$options": "i"}},
            {"reason": {"$regex": search, "$options": "i"}},
        ]

    total = await requests_col.count_documents(query)
    cursor = requests_col.find(query).sort("updated_at", DESCENDING).skip(skip).limit(limit)
    requests = await cursor.to_list(length=limit)
    request_ids = [str(req["_id"]) for req in requests]

    user_ids = set()
    item_ids = set()
    for req in requests:
        if req.get("requester_id"):
            user_ids.add(str(req["requester_id"]))
        if req.get("owner_id"):
            user_ids.add(str(req["owner_id"]))
        if req.get("item_id"):
            item_ids.add(str(req["item_id"]))

    user_lookup = await _load_user_emails(user_ids)
    item_lookup = await _load_item_images(item_ids)
    chats_by_request = await _conversations_for_requests(request_ids)

    exchanges = []
    for req in requests:
        request_id = str(req["_id"])
        item_id_str = str(req.get("item_id") or "")
        item = item_lookup.get(item_id_str, {})
        requester_id = str(req.get("requester_id") or "")
        owner_id = str(req.get("owner_id") or "")
        requester = user_lookup.get(requester_id, {})
        owner = user_lookup.get(owner_id, {})

        chat_map = chats_by_request.get(request_id, {})
        receiver_doc = chat_map.get(CHAT_ADMIN_RECEIVER)
        lister_doc = chat_map.get(CHAT_ADMIN_LISTER)

        needs_repair = receiver_doc is None or lister_doc is None
        if needs_repair and repair_missing and conversations_col is not None and users_col is not None:
            item_doc = None
            if items_col is not None and item_id_str:
                item_oid = parse_object_id(item_id_str)
                if item_oid is not None:
                    item_doc = await items_col.find_one({"_id": item_oid})
            await ensure_admin_mediated_conversations(
                conversations_col,
                users_col,
                request_id_str=request_id,
                request=req,
                item=item_doc or {"title": req.get("item_title"), "owner_name": req.get("owner_name")},
            )
            refreshed = await conversations_col.find(
                {
                    "request_id": request_id,
                    "chat_type": {"$in": [CHAT_ADMIN_RECEIVER, CHAT_ADMIN_LISTER]},
                }
            ).to_list(length=2)
            chat_map = {doc["chat_type"]: doc for doc in refreshed}
            receiver_doc = chat_map.get(CHAT_ADMIN_RECEIVER)
            lister_doc = chat_map.get(CHAT_ADMIN_LISTER)
            needs_repair = receiver_doc is None or lister_doc is None

        receiver_chat = _serialize_chat(receiver_doc)
        lister_chat = _serialize_chat(lister_doc)

        exchange = {
            "request_id": request_id,
            "request_status": req.get("status") or "approved",
            "item_id": item_id_str,
            "item_title": req.get("item_title") or item.get("title") or "—",
            "item_image_url": item.get("image_url"),
            "item_status": item.get("status"),
            "requester_id": requester_id,
            "requester_name": req.get("requester_name") or requester.get("name") or "—",
            "requester_email": requester.get("email") or "—",
            "owner_id": owner_id,
            "owner_name": req.get("owner_name") or owner.get("name") or "—",
            "owner_email": owner.get("email") or "—",
            "reason": req.get("reason") or "",
            "created_at": req.get("created_at"),
            "approved_at": req.get("approved_at") or req.get("updated_at"),
            "updated_at": req.get("updated_at"),
            "receiver_chat": receiver_chat,
            "lister_chat": lister_chat,
            "needs_repair": needs_repair,
            "receiver_last_message": receiver_chat.get("last_message_text") if receiver_chat else "",
            "lister_last_message": lister_chat.get("last_message_text") if lister_chat else "",
            "total_unread": (receiver_chat or {}).get("unread_count", 0) + (lister_chat or {}).get("unread_count", 0),
        }

        if chat_filter == "receiver" and not receiver_chat:
            continue
        if chat_filter == "lister" and not lister_chat:
            continue
        if chat_filter == "unread" and exchange["total_unread"] <= 0:
            continue
        if search and not _matches_search(exchange, search):
            continue

        exchanges.append(exchange)

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "exchanges": exchanges,
    }


@router.post("/{request_id}/repair")
async def repair_admin_conversations(
    request_id: str,
    admin: dict = Depends(require_permission(PERMISSION_MESSAGES)),
):
    """Ensure admin_receiver and admin_lister chats exist for an approved request."""
    requests_col = await get_requests_collection_async()
    conversations_col = await get_conversations_collection_async()
    users_col = await get_users_collection_async()
    items_col = await get_items_collection_async()

    if requests_col is None or conversations_col is None or users_col is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")

    oid = parse_object_id(request_id)
    if oid is None:
        raise HTTPException(status_code=400, detail="Invalid request ID.")

    req = await requests_col.find_one({"_id": oid})
    if req is None:
        raise HTTPException(status_code=404, detail="Request not found.")

    if req.get("status") not in MEDIATED_REQUEST_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Mediated chats are only available for approved or completed requests.",
        )

    item_doc = None
    item_id_str = str(req.get("item_id") or "")
    if items_col is not None and item_id_str:
        item_oid = parse_object_id(item_id_str)
        if item_oid is not None:
            item_doc = await items_col.find_one({"_id": item_oid})

    created_ids = await ensure_admin_mediated_conversations(
        conversations_col,
        users_col,
        request_id_str=str(req["_id"]),
        request=req,
        item=item_doc or {"title": req.get("item_title"), "owner_name": req.get("owner_name")},
    )

    refreshed = await conversations_col.find(
        {
            "request_id": str(req["_id"]),
            "chat_type": {"$in": [CHAT_ADMIN_RECEIVER, CHAT_ADMIN_LISTER]},
        }
    ).to_list(length=2)
    chat_map = {doc["chat_type"]: doc for doc in refreshed}

    return {
        "request_id": str(req["_id"]),
        "created_or_found": len(created_ids),
        "receiver_chat": _serialize_chat(chat_map.get(CHAT_ADMIN_RECEIVER)),
        "lister_chat": _serialize_chat(chat_map.get(CHAT_ADMIN_LISTER)),
        "repaired_at": datetime.now(timezone.utc),
    }


@router.post("/{conversation_id}/message", response_model=MessageResponse)
async def send_admin_conversation_message(
    conversation_id: str,
    payload: SendMessageRequest,
    admin: dict = Depends(require_permission(PERMISSION_MESSAGES)),
):
    """Send an admin-mediated message; always stored with sender_role=admin."""
    if not admin.get("is_verified"):
        raise HTTPException(status_code=403, detail="You must verify your email to perform this action.")
    return await send_conversation_message(
        conversation_id=conversation_id,
        payload=payload,
        current_user=admin,
        force_admin_sender=True,
    )
