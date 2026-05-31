"""
Admin team management routes.

GET    /api/admin/team                 — list all staff accounts
POST   /api/admin/team/invite          — promote existing user to staff (super_admin only)
PATCH  /api/admin/team/{user_id}/role  — change staff role (super_admin only)
DELETE /api/admin/team/{user_id}       — demote staff to user (super_admin only)
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from pymongo import DESCENDING

from app.api.deps.admin import get_admin_user, get_super_admin
from app.core.roles import ADMIN_ROLES, UserRole
from app.db.mongodb import get_users_collection_async
from app.services.audit import AuditAction, write_audit_log
from app.services.auth import parse_object_id, serialize_user

router = APIRouter()

INVITABLE_ROLES = {
    UserRole.COURIER.value,
    UserRole.MODERATOR.value,
    UserRole.ADMIN.value,
}


class TeamInviteRequest(BaseModel):
    email: EmailStr
    role: str
    name: str | None = None


class TeamRoleUpdateRequest(BaseModel):
    role: str


def _serialize_team_member(user: dict) -> dict:
    payload = serialize_user(user)
    payload["status"] = "suspended" if user.get("is_banned") else "active"
    payload["last_login_at"] = user.get("last_admin_login_at")
    return payload


async def _count_super_admins(users_col) -> int:
    return await users_col.count_documents(
        {
            "role": UserRole.SUPER_ADMIN.value,
            "is_banned": {"$ne": True},
        }
    )


async def _ensure_not_last_super_admin(users_col, user: dict, *, new_role: str | None = None) -> None:
    if user.get("role") != UserRole.SUPER_ADMIN.value:
        return
    if new_role == UserRole.SUPER_ADMIN.value:
        return
    if await _count_super_admins(users_col) <= 1:
        raise HTTPException(status_code=400, detail="Cannot remove the last super admin.")


def _validate_staff_role(role: str, *, allow_super_admin: bool = False) -> str:
    if role not in [r.value for r in UserRole]:
        raise HTTPException(status_code=400, detail=f"Invalid role: {role}")
    if UserRole(role) not in ADMIN_ROLES:
        raise HTTPException(
            status_code=400,
            detail="Target role must be a staff role (courier, moderator, admin, super_admin).",
        )
    if not allow_super_admin and role == UserRole.SUPER_ADMIN.value:
        raise HTTPException(
            status_code=400,
            detail="Promoting to super admin is not allowed through this action.",
        )
    return role


@router.get("")
async def list_team(admin: dict = Depends(get_admin_user)):
    """List all staff members. Any admin role can view."""
    users_col = await get_users_collection_async()
    if users_col is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")

    admin_role_values = [r.value for r in ADMIN_ROLES]
    cursor = users_col.find({"role": {"$in": admin_role_values}}).sort("created_at", DESCENDING)
    members = await cursor.to_list(length=200)

    return {
        "total": len(members),
        "members": [_serialize_team_member(m) for m in members],
    }


@router.post("/invite", status_code=200)
async def invite_team_member(
    payload: TeamInviteRequest,
    admin: dict = Depends(get_super_admin),
):
    """
    Promote an existing user to a staff role by email.
    Super admin only. The user must already have an account.
    Email delivery is not configured — access is granted immediately.
    """
    role = _validate_staff_role(payload.role, allow_super_admin=False)
    if role not in INVITABLE_ROLES:
        raise HTTPException(
            status_code=400,
            detail="Invite role must be courier, moderator, or admin.",
        )

    users_col = await get_users_collection_async()
    if users_col is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")

    normalized_email = payload.email.strip().lower()
    user = await users_col.find_one({"email": normalized_email})
    if user is None:
        raise HTTPException(
            status_code=404,
            detail=(
                f"No account found with email '{normalized_email}'. "
                "The user must sign up on the platform first."
            ),
        )

    old_role = user.get("role", "user")
    update_fields = {
        "role": role,
        "role_updated_at": datetime.now(timezone.utc),
        "role_updated_by": admin["id"],
    }
    if payload.name and payload.name.strip():
        update_fields["name"] = payload.name.strip()

    await users_col.update_one({"_id": user["_id"]}, {"$set": update_fields})

    await write_audit_log(
        action=AuditAction.TEAM_MEMBER_INVITED,
        admin_user=admin,
        target_type="user",
        target_id=str(user["_id"]),
        detail={"email": normalized_email, "from_role": old_role, "to_role": role},
    )

    refreshed = await users_col.find_one({"_id": user["_id"]})
    return {
        "message": (
            f"'{normalized_email}' now has '{role}' access. "
            "Email sending is not configured — access was applied immediately."
        ),
        "user_id": str(user["_id"]),
        "role": role,
        "email_sent": False,
        "member": _serialize_team_member(refreshed or user),
    }


@router.patch("/{user_id}/role")
async def update_team_member_role(
    user_id: str,
    payload: TeamRoleUpdateRequest,
    admin: dict = Depends(get_super_admin),
):
    """Change a staff member's role. Super admin only."""
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="You cannot change your own staff role.")

    role = _validate_staff_role(payload.role, allow_super_admin=False)
    if role not in INVITABLE_ROLES:
        raise HTTPException(
            status_code=400,
            detail="Role must be courier, moderator, or admin.",
        )

    users_col = await get_users_collection_async()
    if users_col is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")

    oid = parse_object_id(user_id)
    if oid is None:
        raise HTTPException(status_code=400, detail="Invalid user ID.")

    user = await users_col.find_one({"_id": oid})
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")

    if user.get("role") not in [r.value for r in ADMIN_ROLES]:
        raise HTTPException(status_code=400, detail="Target user is not a staff member.")

    await _ensure_not_last_super_admin(users_col, user, new_role=role)

    old_role = user.get("role", "user")
    await users_col.update_one(
        {"_id": oid},
        {"$set": {
            "role": role,
            "role_updated_at": datetime.now(timezone.utc),
            "role_updated_by": admin["id"],
        }},
    )

    await write_audit_log(
        action=AuditAction.TEAM_MEMBER_ROLE_CHANGED,
        admin_user=admin,
        target_type="user",
        target_id=user_id,
        detail={"email": user.get("email"), "from_role": old_role, "to_role": role},
    )

    refreshed = await users_col.find_one({"_id": oid})
    return {
        "message": f"Role updated to '{role}'.",
        "user_id": user_id,
        "role": role,
        "member": _serialize_team_member(refreshed or user),
    }


@router.delete("/{user_id}", status_code=200)
async def remove_team_member(
    user_id: str,
    admin: dict = Depends(get_super_admin),
):
    """
    Demote a staff member back to 'user' role.
    Super admin only. Cannot demote yourself or the last super admin.
    """
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="You cannot remove yourself from the team.")

    users_col = await get_users_collection_async()
    if users_col is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")

    oid = parse_object_id(user_id)
    if oid is None:
        raise HTTPException(status_code=400, detail="Invalid user ID.")

    user = await users_col.find_one({"_id": oid})
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")

    await _ensure_not_last_super_admin(users_col, user, new_role=UserRole.USER.value)

    old_role = user.get("role", "user")
    await users_col.update_one(
        {"_id": oid},
        {"$set": {
            "role": UserRole.USER.value,
            "role_updated_at": datetime.now(timezone.utc),
            "role_updated_by": admin["id"],
        }},
    )

    await write_audit_log(
        action=AuditAction.TEAM_MEMBER_REMOVED,
        admin_user=admin,
        target_type="user",
        target_id=user_id,
        detail={"email": user.get("email"), "from_role": old_role},
    )

    return {
        "message": f"Admin access removed for '{user.get('email')}'. Account remains as a regular user.",
        "user_id": user_id,
    }
