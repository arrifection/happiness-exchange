"""
Admin team management routes.

GET    /api/admin/team                 — list all staff accounts
POST   /api/admin/team/invite          — invite/create staff by email (super_admin only)
PATCH  /api/admin/team/{user_id}/role  — change staff role (super_admin only)
DELETE /api/admin/team/{user_id}       — demote staff to user (super_admin only)
"""
from datetime import datetime, timedelta, timezone
import secrets

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from pymongo import DESCENDING
from pymongo.errors import DuplicateKeyError

from app.api.deps.admin import get_admin_user, get_super_admin
from app.core.config import settings
from app.core.roles import ADMIN_ROLES, UserRole
from app.db.mongodb import get_users_collection_async
from app.services.audit import AuditAction, write_audit_log
from app.services.auth import (
    generate_verification_token,
    hash_password,
    hash_verification_token,
    normalize_name,
    parse_object_id,
    serialize_user,
)
from app.services.email import EmailSendError, send_team_invite_email

router = APIRouter()

INVITABLE_ROLES = {
    UserRole.COURIER.value,
    UserRole.MODERATOR.value,
    UserRole.ADMIN.value,
}


class TeamInviteRequest(BaseModel):
    email: EmailStr
    role: str
    name: str = Field(min_length=2, max_length=100)


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


async def _create_invited_staff_user(
    users_col,
    *,
    normalized_email: str,
    display_name: str,
    role: str,
    admin: dict,
) -> tuple[dict, str]:
    """Create a pending staff account and return the user doc + raw invite token."""
    normalized_name = normalize_name(display_name)
    existing_name = await users_col.find_one({"name_normalized": normalized_name})
    if existing_name is not None:
        raise HTTPException(
            status_code=409,
            detail="That display name is already taken. Choose a different name.",
        )

    now = datetime.now(timezone.utc)
    raw_token = generate_verification_token()
    token_hash = hash_verification_token(raw_token)
    token_expiry = now + timedelta(days=7)
    placeholder_password = hash_password(secrets.token_urlsafe(32))

    user_document = {
        "name": " ".join(display_name.strip().split()),
        "name_normalized": normalized_name,
        "email": normalized_email,
        "hashed_password": placeholder_password,
        "role": role,
        "account_type": "staff",
        "is_verified": True,
        "is_banned": False,
        "admin_invite_token_hash": token_hash,
        "admin_invite_expires_at": token_expiry,
        "invited_by": admin["id"],
        "invited_at": now,
        "created_at": now,
        "updated_at": now,
    }

    try:
        result = await users_col.insert_one(user_document)
    except DuplicateKeyError:
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists.",
        )

    created = {**user_document, "_id": result.inserted_id}
    return created, raw_token


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
    Invite someone to the admin team by email.
    Creates a new staff account when needed, or promotes an existing user.
    Sends an invite email via Resend when configured.
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
    display_name = payload.name.strip()
    user = await users_col.find_one({"email": normalized_email})
    setup_link = None
    created_new = False

    if user is None:
        user, raw_token = await _create_invited_staff_user(
            users_col,
            normalized_email=normalized_email,
            display_name=display_name,
            role=role,
            admin=admin,
        )
        setup_link = f"{settings.ADMIN_PANEL_URL.rstrip('/')}/accept-invite?token={raw_token}"
        old_role = "none"
        created_new = True
    else:
        old_role = user.get("role", "user")
        normalized_name = normalize_name(display_name)
        existing_name = await users_col.find_one({"name_normalized": normalized_name})
        if existing_name is not None and str(existing_name["_id"]) != str(user["_id"]):
            raise HTTPException(
                status_code=409,
                detail="That display name is already taken. Choose a different name.",
            )
        update_fields = {
            "role": role,
            "role_updated_at": datetime.now(timezone.utc),
            "role_updated_by": admin["id"],
            "name": display_name,
            "name_normalized": normalize_name(display_name),
            "updated_at": datetime.now(timezone.utc),
        }
        await users_col.update_one({"_id": user["_id"]}, {"$set": update_fields})

    await write_audit_log(
        action=AuditAction.TEAM_MEMBER_INVITED,
        admin_user=admin,
        target_type="user",
        target_id=str(user["_id"]),
        detail={
            "email": normalized_email,
            "from_role": old_role,
            "to_role": role,
            "created_new": created_new,
        },
    )

    email_sent = False
    email_error = None
    recipient_name = display_name
    inviter_name = admin.get("name") or admin.get("full_name") or admin.get("email") or "Super Admin"
    try:
        email_sent = send_team_invite_email(
            to_email=normalized_email,
            recipient_name=recipient_name,
            inviter_name=inviter_name,
            role=role,
            setup_link=setup_link,
        )
    except EmailSendError as exc:
        email_error = exc.message

    refreshed = await users_col.find_one({"_id": user["_id"]})
    if created_new:
        if email_sent:
            message = (
                f"Invite sent to '{normalized_email}'. "
                "They can set their password from the email link to access the admin panel."
            )
        elif email_error:
            message = (
                f"Staff account created for '{normalized_email}', "
                f"but the invite email could not be sent: {email_error}"
            )
        else:
            message = (
                f"Staff account created for '{normalized_email}'. "
                "Email sending is not configured — share the admin panel link manually."
            )
    elif email_sent:
        message = (
            f"'{normalized_email}' now has '{role}' access. "
            "An invitation email was sent with admin panel login instructions."
        )
    elif email_error:
        message = (
            f"'{normalized_email}' now has '{role}' access, "
            f"but the notification email could not be sent: {email_error}"
        )
    else:
        message = (
            f"'{normalized_email}' now has '{role}' access. "
            "Email sending is not configured — access was applied immediately."
        )

    return {
        "message": message,
        "user_id": str(user["_id"]),
        "role": role,
        "email_sent": email_sent,
        "email_error": email_error,
        "created_new": created_new,
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
