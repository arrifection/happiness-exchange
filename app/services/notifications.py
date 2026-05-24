"""
Notification service for real-time polling updates.

Provides functions to create individual notifications and broadcast notifications
to specific staff roles.
"""
import logging
from datetime import datetime, timezone
from typing import Any

from app.db.mongodb import get_notifications_collection_async, get_users_collection_async
from app.core.roles import UserRole, ADMIN_ROLES, has_role

logger = logging.getLogger(__name__)


async def create_notification(
    user_id: str,
    title: str,
    message: str,
    type_: str,
    action_url: str | None = None,
) -> None:
    """
    Create a notification for a specific user.
    Fire-and-forget: swallows errors so it doesn't break the main request flow.
    """
    try:
        notifications_col = await get_notifications_collection_async()
        if notifications_col is None:
            logger.warning("create_notification: Database unavailable.")
            return

        doc = {
            "user_id": user_id,
            "title": title,
            "message": message,
            "type": type_,
            "action_url": action_url,
            "read": False,
            "created_at": datetime.now(timezone.utc),
        }
        await notifications_col.insert_one(doc)
    except Exception as exc:
        logger.error("create_notification failed for user %s: %s", user_id, exc)


async def notify_roles(
    roles: list[UserRole],
    title: str,
    message: str,
    type_: str,
    action_url: str | None = None,
) -> None:
    """
    Broadcast a notification to all users who have ANY of the specified roles.
    Fire-and-forget.
    """
    try:
        users_col = await get_users_collection_async()
        notifications_col = await get_notifications_collection_async()

        if users_col is None or notifications_col is None:
            logger.warning("notify_roles: Database unavailable.")
            return

        # Find all users with one of these roles who are not banned
        role_values = [r.value for r in roles]
        cursor = users_col.find({"role": {"$in": role_values}, "is_banned": {"$ne": True}})
        
        now = datetime.now(timezone.utc)
        docs = []
        async for user in cursor:
            docs.append({
                "user_id": str(user["_id"]),
                "title": title,
                "message": message,
                "type": type_,
                "action_url": action_url,
                "read": False,
                "created_at": now,
            })

        if docs:
            await notifications_col.insert_many(docs)
            
    except Exception as exc:
        logger.error("notify_roles failed: %s", exc)


async def notify_admins(
    title: str,
    message: str,
    type_: str,
    action_url: str | None = None,
) -> None:
    """Notify all admin-tier staff (admin, super_admin)."""
    await notify_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN], title, message, type_, action_url)


async def notify_moderators(
    title: str,
    message: str,
    type_: str,
    action_url: str | None = None,
) -> None:
    """Notify all moderation staff (moderator, admin, super_admin)."""
    await notify_roles([UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN], title, message, type_, action_url)


async def notify_couriers(
    title: str,
    message: str,
    type_: str,
    action_url: str | None = None,
) -> None:
    """Notify couriers (and admins who might oversee them)."""
    await notify_roles([UserRole.COURIER, UserRole.ADMIN, UserRole.SUPER_ADMIN], title, message, type_, action_url)


async def notify_delivery_match(
    title: str,
    message: str,
    action_url: str | None = None,
) -> None:
    """Helper to notify couriers of a new delivery match (placeholder for future)."""
    await notify_couriers(title, message, "delivery_match_created", action_url)


async def notify_suspicious_activity(
    title: str,
    message: str,
    action_url: str | None = None,
) -> None:
    """Placeholder helper to alert admins of suspicious activity."""
    await notify_admins(title, message, "suspicious_activity", action_url)


