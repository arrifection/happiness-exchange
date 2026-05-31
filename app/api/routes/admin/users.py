"""
Admin user management routes.

GET    /api/admin/users          — list all users (paginated)
GET    /api/admin/users/{id}     — get single user
PATCH  /api/admin/users/{id}/ban   — ban a user
PATCH  /api/admin/users/{id}/unban — unban a user
PATCH  /api/admin/users/{id}/role  — change a user's role (super_admin only)
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pymongo import DESCENDING

from app.api.deps.admin import get_super_admin, require_permission
from app.core.admin_permissions import PERMISSION_USERS
from app.db.mongodb import get_users_collection_async
from app.services.audit import AuditAction, write_audit_log
from app.services.auth import parse_object_id, serialize_user
from app.core.roles import UserRole
from app.services.trust import admin_deduct_points
from pydantic import BaseModel

router = APIRouter()


@router.get("")
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: str = Query(""),
    admin: dict = Depends(require_permission(PERMISSION_USERS)),
):
    """List all users with optional text search. Moderator+ required."""
    users_collection = await get_users_collection_async()
    if users_collection is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")

    query: dict = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
        ]

    total = await users_collection.count_documents(query)
    cursor = users_collection.find(query).sort("created_at", DESCENDING).skip(skip).limit(limit)
    users = await cursor.to_list(length=limit)

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "users": [serialize_user(u) for u in users],
    }


@router.get("/{user_id}")
async def get_user(
    user_id: str,
    admin: dict = Depends(require_permission(PERMISSION_USERS)),
):
    """Get a single user by ID. Moderator+ required."""
    users_collection = await get_users_collection_async()
    if users_collection is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")

    oid = parse_object_id(user_id)
    if oid is None:
        raise HTTPException(status_code=400, detail="Invalid user ID.")

    user = await users_collection.find_one({"_id": oid})
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")

    return serialize_user(user)


@router.patch("/{user_id}/ban")
async def ban_user(
    user_id: str,
    admin: dict = Depends(require_permission(PERMISSION_USERS)),
):
    """
    Ban a user — prevents login and all platform actions.
    Moderator+ required. Cannot ban another admin.
    """
    users_collection = await get_users_collection_async()
    if users_collection is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")

    oid = parse_object_id(user_id)
    if oid is None:
        raise HTTPException(status_code=400, detail="Invalid user ID.")

    user = await users_collection.find_one({"_id": oid})
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")

    # Prevent banning admin-level accounts unless you're super_admin
    from app.core.roles import has_role, ROLE_LEVEL, UserRole
    target_role = user.get("role", "user")
    if has_role(target_role, UserRole.MODERATOR) and not has_role(admin.get("role", "user"), UserRole.SUPER_ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super admins can ban other staff accounts.",
        )

    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="You cannot ban yourself.")

    await users_collection.update_one(
        {"_id": oid},
        {"$set": {"is_banned": True, "banned_at": datetime.now(timezone.utc), "banned_by": admin["id"]}},
    )

    await write_audit_log(
        action=AuditAction.USER_BANNED,
        admin_user=admin,
        target_type="user",
        target_id=user_id,
        detail={"target_email": user.get("email"), "target_name": user.get("name")},
    )

    return {"message": f"User {user.get('email')} has been banned.", "user_id": user_id}


@router.patch("/{user_id}/unban")
async def unban_user(
    user_id: str,
    admin: dict = Depends(require_permission(PERMISSION_USERS)),
):
    """Lift a ban. Moderator+ required."""
    users_collection = await get_users_collection_async()
    if users_collection is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")

    oid = parse_object_id(user_id)
    if oid is None:
        raise HTTPException(status_code=400, detail="Invalid user ID.")

    user = await users_collection.find_one({"_id": oid})
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")

    await users_collection.update_one(
        {"_id": oid},
        {"$set": {"is_banned": False, "unbanned_at": datetime.now(timezone.utc), "unbanned_by": admin["id"]}},
    )

    await write_audit_log(
        action=AuditAction.USER_UNBANNED,
        admin_user=admin,
        target_type="user",
        target_id=user_id,
        detail={"target_email": user.get("email")},
    )

    return {"message": f"User {user.get('email')} has been unbanned.", "user_id": user_id}


@router.patch("/{user_id}/role")
async def change_user_role(
    user_id: str,
    body: dict,
    admin: dict = Depends(get_super_admin),
):
    """
    Change a user's role. Super admin only.
    Body: { "role": "moderator" }
    """
    new_role = body.get("role")
    if new_role not in [r.value for r in UserRole]:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid role. Must be one of: {[r.value for r in UserRole]}",
        )

    users_collection = await get_users_collection_async()
    if users_collection is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")

    oid = parse_object_id(user_id)
    if oid is None:
        raise HTTPException(status_code=400, detail="Invalid user ID.")

    user = await users_collection.find_one({"_id": oid})
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")

    old_role = user.get("role", "user")

    await users_collection.update_one(
        {"_id": oid},
        {"$set": {"role": new_role, "role_updated_at": datetime.now(timezone.utc), "role_updated_by": admin["id"]}},
    )

    await write_audit_log(
        action=AuditAction.USER_ROLE_CHANGED,
        admin_user=admin,
        target_type="user",
        target_id=user_id,
        detail={"from_role": old_role, "to_role": new_role, "target_email": user.get("email")},
    )

    return {"message": f"Role updated to '{new_role}'.", "user_id": user_id, "role": new_role}

class TrustPenaltyRequest(BaseModel):
    amount: int
    reason: str

@router.post("/{user_id}/trust-penalty")
async def apply_trust_penalty(
    user_id: str,
    payload: TrustPenaltyRequest,
    admin: dict = Depends(require_permission(PERMISSION_USERS)),
):
    """
    Manually deduct trust points from a user. Moderator+ required.
    """
    users_collection = await get_users_collection_async()
    if users_collection is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")

    oid = parse_object_id(user_id)
    if oid is None:
        raise HTTPException(status_code=400, detail="Invalid user ID.")

    user = await users_collection.find_one({"_id": oid})
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")

    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be a positive integer to deduct.")

    await admin_deduct_points(
        user_id=user_id,
        admin_id=admin["id"],
        amount=payload.amount,
        reason=payload.reason
    )

    # Note: we don't have a specific AuditAction for trust penalty yet, 
    # but we can log it if we add it. For now, it is recorded in the trust_events ledger.

    return {"message": f"Deducted {payload.amount} points from user.", "user_id": user_id}
