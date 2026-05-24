"""
Admin team management routes.

GET   /api/admin/team            — list all staff accounts
POST  /api/admin/team/invite     — invite (role-change) a user to staff (super_admin only)
DELETE /api/admin/team/{user_id} — remove staff role (demote to user) (super_admin only)
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


class TeamInviteRequest(BaseModel):
    email: EmailStr
    role: str


@router.get("")
async def list_team(admin: dict = Depends(get_admin_user)):
    """List all staff members. Any admin role can view."""
    users_col = await get_users_collection_async()
    if users_col is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")

    admin_role_values = [r.value for r in ADMIN_ROLES]
    cursor = users_col.find({"role": {"$in": admin_role_values}}).sort("created_at", DESCENDING)
    members = await cursor.to_list(length=200)

    return {"total": len(members), "members": [serialize_user(m) for m in members]}


@router.post("/invite", status_code=200)
async def invite_team_member(
    payload: TeamInviteRequest,
    admin: dict = Depends(get_super_admin),
):
    """
    Promote an existing user to a staff role by email.
    Super admin only. The user must already have an account.
    """
    if payload.role not in [r.value for r in UserRole]:
        raise HTTPException(status_code=400, detail=f"Invalid role: {payload.role}")

    if UserRole(payload.role) not in ADMIN_ROLES:
        raise HTTPException(status_code=400, detail="Target role must be a staff role (courier, moderator, admin, super_admin).")

    users_col = await get_users_collection_async()
    if users_col is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")

    normalized_email = payload.email.strip().lower()
    user = await users_col.find_one({"email": normalized_email})
    if user is None:
        raise HTTPException(
            status_code=404,
            detail=f"No account found with email '{normalized_email}'. The user must sign up first.",
        )

    old_role = user.get("role", "user")
    await users_col.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "role":             payload.role,
            "role_updated_at":  datetime.now(timezone.utc),
            "role_updated_by":  admin["id"],
        }},
    )

    await write_audit_log(
        action=AuditAction.TEAM_MEMBER_INVITED,
        admin_user=admin,
        target_type="user",
        target_id=str(user["_id"]),
        detail={"email": normalized_email, "from_role": old_role, "to_role": payload.role},
    )

    return {
        "message": f"'{normalized_email}' has been promoted to '{payload.role}'.",
        "user_id": str(user["_id"]),
        "role":    payload.role,
    }


@router.delete("/{user_id}", status_code=200)
async def remove_team_member(
    user_id: str,
    admin: dict = Depends(get_super_admin),
):
    """
    Demote a staff member back to 'user' role.
    Super admin only. Cannot demote yourself.
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

    old_role = user.get("role", "user")
    await users_col.update_one(
        {"_id": oid},
        {"$set": {
            "role":            UserRole.USER,
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

    return {"message": f"'{user.get('email')}' demoted to 'user'.", "user_id": user_id}
