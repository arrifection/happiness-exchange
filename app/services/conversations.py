"""Admin-mediated conversation helpers."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from pymongo import ASCENDING
from pymongo.errors import DuplicateKeyError

from app.core.roles import UserRole
from app.services.auth import parse_object_id
from app.services.display_names import resolve_user_display_name, sanitize_display_name


def ids_match(a, b) -> bool:
    if a is None or b is None or a == "" or b == "":
        return False
    return str(a) == str(b)

logger = logging.getLogger(__name__)

ADMIN_DISPLAY_NAME = "Happiness Exchange Admin"
ADMIN_LIST_TITLE_PREFIX = "Admin Support"
CHAT_ADMIN_RECEIVER = "admin_receiver"
CHAT_ADMIN_LISTER = "admin_lister"
ADMIN_MEDIATED_CHAT_TYPES = (CHAT_ADMIN_RECEIVER, CHAT_ADMIN_LISTER)


async def get_platform_admin(users_col):
    """Return the primary platform admin account used for mediated chats."""
    for role in (UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MODERATOR):
        user = await users_col.find_one(
            {"role": role.value, "is_banned": {"$ne": True}},
            sort=[("created_at", ASCENDING)],
        )
        if user is not None:
            return user
    return None


async def resolve_user_name(users_col, user_id: str, fallback: str = "User") -> str:
    user_oid = parse_object_id(user_id)
    if user_oid is None:
        return fallback
    user = await users_col.find_one({"_id": user_oid})
    if user is None:
        return fallback
    return resolve_user_display_name(user, fallback=fallback)


def is_admin_mediated(conv: dict) -> bool:
    return conv.get("chat_type") in ADMIN_MEDIATED_CHAT_TYPES


def conversation_participant_ids(conv: dict) -> tuple[str, str]:
    if is_admin_mediated(conv):
        return conv["admin_id"], conv["member_id"]
    return conv.get("giver_id", ""), conv.get("receiver_id", "")


def user_is_participant(conv: dict, user_id: str) -> bool:
    if not is_admin_mediated(conv):
        return False
    admin_id, member_id = conversation_participant_ids(conv)
    return ids_match(user_id, admin_id) or ids_match(user_id, member_id)


def get_other_participant_id(conv: dict, user_id: str) -> str:
    admin_id, member_id = conversation_participant_ids(conv)
    return member_id if user_id == admin_id else admin_id


def chat_type_for_request_participant(*, user_id: str, request: dict) -> str | None:
    if user_id == request.get("requester_id"):
        return CHAT_ADMIN_RECEIVER
    if user_id == request.get("owner_id"):
        return CHAT_ADMIN_LISTER
    return None


async def ensure_admin_mediated_conversations(
    conversations_col,
    users_col,
    *,
    request_id_str: str,
    request: dict,
    item: dict | None,
    session=None,
) -> list[str]:
    """Create admin↔receiver and admin↔lister chats for an approved request."""
    admin = await get_platform_admin(users_col)
    if admin is None:
        logger.warning("No platform admin account found; mediated chats were not created.")
        return []

    admin_id = str(admin["_id"])
    admin_name = resolve_user_display_name(admin, fallback=ADMIN_DISPLAY_NAME)
    owner_id = str(request.get("owner_id", ""))
    requester_id = str(request.get("requester_id", ""))
    item_title = request.get("item_title") or (item or {}).get("title", "")
    item_id = str(request.get("item_id", ""))

    owner_name = sanitize_display_name(
        request.get("owner_name")
        or (item or {}).get("owner_name")
        or await resolve_user_name(users_col, owner_id),
        fallback="User",
    )
    requester_name = sanitize_display_name(
        request.get("requester_name") or await resolve_user_name(users_col, requester_id),
        fallback="User",
    )

    now = datetime.now(timezone.utc)
    created_ids: list[str] = []
    specs = (
        (CHAT_ADMIN_RECEIVER, requester_id, requester_name, "receiver"),
        (CHAT_ADMIN_LISTER, owner_id, owner_name, "lister"),
    )

    for chat_type, member_id, member_name, member_role in specs:
        existing = await conversations_col.find_one(
            {"request_id": request_id_str, "chat_type": chat_type},
            session=session,
        )
        if existing is not None:
            created_ids.append(str(existing["_id"]))
            continue

        doc = {
            "item_id": item_id,
            "item_title": item_title,
            "request_id": request_id_str,
            "chat_type": chat_type,
            "admin_id": admin_id,
            "admin_name": admin_name,
            "admin_display_name": ADMIN_DISPLAY_NAME,
            "member_id": member_id,
            "member_name": member_name,
            "member_role": member_role,
            "giver_id": owner_id,
            "giver_name": owner_name,
            "receiver_id": requester_id,
            "receiver_name": requester_name,
            "created_at": now,
            "last_message_at": None,
            "last_message_text": None,
            "unread_counts": {admin_id: 0, member_id: 0},
            "is_flagged": False,
        }
        try:
            result = await conversations_col.insert_one(doc, session=session)
            created_ids.append(str(result.inserted_id))
        except DuplicateKeyError:
            existing = await conversations_col.find_one(
                {"request_id": request_id_str, "chat_type": chat_type},
                session=session,
            )
            if existing is not None:
                created_ids.append(str(existing["_id"]))

    return created_ids
