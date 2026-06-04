"""Per-message sender/receiver identity for admin-mediated chats."""

from __future__ import annotations

from app.core.roles import is_admin_role
from app.services.conversations import ADMIN_DISPLAY_NAME, ids_match, is_admin_mediated
from app.services.display_names import resolve_user_display_name, sanitize_display_name

SENDER_ROLE_ADMIN = "admin"
SENDER_ROLE_USER = "user"
RECEIVER_ROLE_ADMIN = "admin"
RECEIVER_ROLE_USER = "user"
MESSAGE_SOURCE_ADMIN_PANEL = "admin_panel"
MESSAGE_SOURCE_MEMBER_REPLY = "member_reply"

_ADMIN_SENDER_NAME_MARKERS = frozenset({
    "happiness exchange admin",
    "happiness exchange support",
})


def is_admin_sender_name(name: str | None) -> bool:
    normalized = (name or "").strip().lower()
    if not normalized:
        return False
    if normalized in _ADMIN_SENDER_NAME_MARKERS:
        return True
    return normalized.startswith("happiness exchange admin")


def infer_sender_role(
    doc: dict,
    *,
    conv: dict | None = None,
    current_user: dict | None = None,
) -> str:
    """Backward-compatible sender role when legacy messages omit sender_role."""
    stored = doc.get("sender_role")
    if stored in (SENDER_ROLE_ADMIN, SENDER_ROLE_USER):
        if stored == SENDER_ROLE_USER and is_admin_sender_name(doc.get("sender_name")):
            return SENDER_ROLE_ADMIN
        return stored

    if is_admin_sender_name(doc.get("sender_name")):
        return SENDER_ROLE_ADMIN

    sender_id = doc.get("sender_id", "")
    if conv and is_admin_mediated(conv):
        member_id = conv.get("member_id", "")
        admin_id = conv.get("admin_id", "")
        if ids_match(sender_id, member_id):
            return SENDER_ROLE_USER
        if ids_match(sender_id, admin_id):
            return SENDER_ROLE_ADMIN
        if member_id and sender_id and not ids_match(sender_id, member_id):
            return SENDER_ROLE_ADMIN

    if current_user:
        if is_admin_role(current_user.get("role", "user")) and ids_match(sender_id, current_user.get("id")):
            if conv and is_admin_mediated(conv) and ids_match(sender_id, conv.get("member_id")):
                return SENDER_ROLE_USER
            return SENDER_ROLE_ADMIN
        if ids_match(sender_id, current_user.get("id")):
            return SENDER_ROLE_USER

    return SENDER_ROLE_USER


async def resolve_admin_receiver_id(
    messages_col,
    *,
    conversation_id: str,
    fallback_admin_id: str,
    member_id: str = "",
) -> str:
    """Prefer the admin who last messaged in the thread, else platform admin id."""
    if messages_col is None:
        return fallback_admin_id

    last_admin = await messages_col.find_one(
        {"conversation_id": conversation_id, "sender_role": SENDER_ROLE_ADMIN},
        sort=[("created_at", -1)],
    )
    if last_admin and last_admin.get("sender_id"):
        return last_admin["sender_id"]

    if member_id:
        legacy_admin = await messages_col.find_one(
            {
                "conversation_id": conversation_id,
                "sender_id": {"$ne": member_id},
                "sender_role": {"$exists": False},
            },
            sort=[("created_at", -1)],
        )
        if legacy_admin and legacy_admin.get("sender_id"):
            return legacy_admin["sender_id"]

    return fallback_admin_id or ""


def build_message_identity(
    *,
    conv: dict,
    current_user: dict,
    receiver_id: str,
    receiver_role: str,
    force_admin_sender: bool = False,
) -> dict:
    """Derive sender/receiver fields from auth + conversation (never from request body)."""
    user_id = current_user["id"]
    user_role = current_user.get("role", "user")
    member_id = conv.get("member_id", "")

    if force_admin_sender:
        if not is_admin_role(user_role):
            raise ValueError("non_admin_non_member_sender")
        sender_role = SENDER_ROLE_ADMIN
        sender_name = conv.get("admin_display_name") or ADMIN_DISPLAY_NAME
    elif ids_match(user_id, member_id):
        sender_role = SENDER_ROLE_USER
        sender_name = sanitize_display_name(
            resolve_user_display_name(current_user, fallback="User"),
            fallback="User",
        )
    else:
        if not is_admin_role(user_role):
            raise ValueError("non_admin_non_member_sender")
        sender_role = SENDER_ROLE_ADMIN
        sender_name = conv.get("admin_display_name") or ADMIN_DISPLAY_NAME

    return {
        "sender_id": user_id,
        "sender_role": sender_role,
        "sender_name": sender_name,
        "receiver_id": receiver_id,
        "receiver_role": receiver_role,
    }


def serialize_message_fields(
    doc: dict,
    *,
    conv: dict | None = None,
    current_user: dict | None = None,
) -> dict:
    """Convert a MongoDB message document to API response shape."""
    message_source = doc.get("message_source") or ""
    stored = doc.get("sender_role")
    member_id = (conv or {}).get("member_id", "")
    sender_id = doc.get("sender_id", "")

    if message_source == MESSAGE_SOURCE_MEMBER_REPLY:
        sender_role = SENDER_ROLE_USER
    elif message_source == MESSAGE_SOURCE_ADMIN_PANEL:
        sender_role = SENDER_ROLE_ADMIN
    elif member_id and ids_match(sender_id, member_id):
        sender_role = SENDER_ROLE_USER
    elif stored in (SENDER_ROLE_ADMIN, SENDER_ROLE_USER):
        sender_role = stored
        if stored == SENDER_ROLE_USER and is_admin_sender_name(doc.get("sender_name")):
            sender_role = SENDER_ROLE_ADMIN
    else:
        sender_role = infer_sender_role(doc, conv=conv, current_user=current_user)
    receiver_role = doc.get("receiver_role")
    if not receiver_role and conv and is_admin_mediated(conv):
        receiver_role = RECEIVER_ROLE_USER if sender_role == SENDER_ROLE_ADMIN else RECEIVER_ROLE_ADMIN

    return {
        "id": str(doc["_id"]),
        "conversation_id": doc["conversation_id"],
        "sender_id": str(doc.get("sender_id") or ""),
        "sender_role": sender_role,
        "message_source": message_source,
        "sender_name": sanitize_display_name(doc.get("sender_name"), fallback="User"),
        "receiver_id": doc.get("receiver_id") or "",
        "receiver_role": receiver_role or "",
        "text": doc.get("text") or doc.get("body") or "",
        "message_type": doc.get("message_type", "text"),
        "image_url": doc.get("image_url"),
        "created_at": doc["created_at"],
        "read": doc.get("read", False),
    }
