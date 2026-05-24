"""
Audit logging service for admin actions.

Every moderation action (ban, delete, review removal, etc.) is written to
the `admin_audit_log` MongoDB collection with:
  - who did it (admin user id + email + role)
  - what they did (action)
  - what it targeted (target_type + target_id)
  - optional detail payload
  - timestamp

The collection is append-only from the application side.
"""
import logging
from datetime import datetime, timezone
from typing import Any

from app.db.mongodb import get_db_async

logger = logging.getLogger(__name__)

# ── Collection name ───────────────────────────────────────────────────────────
AUDIT_COLLECTION = "admin_audit_log"

# ── Action constants (use these instead of raw strings) ──────────────────────
class AuditAction:
    # Items
    ITEM_DELETED   = "item.deleted"
    ITEM_APPROVED  = "item.approved"

    # Users
    USER_BANNED    = "user.banned"
    USER_UNBANNED  = "user.unbanned"
    USER_ROLE_CHANGED = "user.role_changed"

    # Reviews
    REVIEW_DELETED = "review.deleted"

    # Reports
    REPORT_RESOLVED = "report.resolved"
    REPORT_DISMISSED = "report.dismissed"

    # Team
    TEAM_MEMBER_INVITED = "team.member_invited"
    TEAM_MEMBER_REMOVED = "team.member_removed"

    # Auth
    ADMIN_LOGIN    = "auth.admin_login"


async def write_audit_log(
    action: str,
    admin_user: dict,
    target_type: str,
    target_id: str,
    detail: dict[str, Any] | None = None,
) -> None:
    """
    Write a single audit log entry to MongoDB.
    Never raises — logging failures are swallowed so they don't break the request.
    """
    try:
        db = await get_db_async()
        if db is None:
            logger.warning("audit_log: DB unavailable, skipping log entry for action=%s", action)
            return

        entry = {
            "action":       action,
            "admin_id":     admin_user.get("id", "unknown"),
            "admin_email":  admin_user.get("email", "unknown"),
            "admin_role":   admin_user.get("role", "unknown"),
            "target_type":  target_type,
            "target_id":    target_id,
            "detail":       detail or {},
            "timestamp":    datetime.now(timezone.utc),
        }
        await db[AUDIT_COLLECTION].insert_one(entry)
        logger.info(
            "AUDIT | action=%s | admin=%s | target=%s/%s",
            action,
            admin_user.get("email"),
            target_type,
            target_id,
        )
    except Exception as exc:  # noqa: BLE001
        logger.error("audit_log: failed to write log entry: %s", exc)
