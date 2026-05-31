"""
Admin-only login endpoint.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, Request, status

from app.core.slowapi_limiter import limiter
from app.db.mongodb import get_users_collection_async
from app.schemas.auth import (
    AcceptInviteRequest,
    InvitePreviewResponse,
    LoginRequest,
    TokenResponse,
)
from app.services.audit import AuditAction, write_audit_log
from app.services.auth import (
    create_access_token,
    hash_password,
    hash_verification_token,
    serialize_user,
    verify_password,
)
from app.core.roles import is_admin_role

router = APIRouter()


async def _find_user_by_invite_token(users_collection, token: str) -> dict | None:
    token_hash = hash_verification_token(token.strip())
    user = await users_collection.find_one({"admin_invite_token_hash": token_hash})
    if user is None:
        return None
    expires_at = user.get("admin_invite_expires_at")
    if isinstance(expires_at, datetime):
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > expires_at:
            return None
    return user


@router.get("/invite-preview", response_model=InvitePreviewResponse)
async def preview_admin_invite(token: str = Query(min_length=32, max_length=128)):
    """Return non-sensitive invite details for the accept-invite page."""
    users_collection = await get_users_collection_async()
    if users_collection is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is not available.",
        )

    user = await _find_user_by_invite_token(users_collection, token)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This invite link is invalid or has expired.",
        )

    return {
        "email": user["email"],
        "name": user.get("name", ""),
        "role": user.get("role", "user"),
        "expires_at": user.get("admin_invite_expires_at"),
    }


@router.post("/accept-invite", response_model=TokenResponse)
@limiter.limit("10/minute")
async def accept_admin_invite(request: Request, payload: AcceptInviteRequest):
    """Set password for a pending staff invite and sign the user into the admin panel."""
    users_collection = await get_users_collection_async()
    if users_collection is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is not available.",
        )

    user = await _find_user_by_invite_token(users_collection, payload.token)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This invite link is invalid or has expired.",
        )

    user_role = user.get("role", "user")
    if not is_admin_role(user_role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This invite does not grant admin panel access.",
        )

    now = datetime.now(timezone.utc)
    await users_collection.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "hashed_password": hash_password(payload.password),
                "updated_at": now,
                "last_admin_login_at": now,
            },
            "$unset": {
                "admin_invite_token_hash": "",
                "admin_invite_expires_at": "",
            },
        },
    )

    refreshed = await users_collection.find_one({"_id": user["_id"]})
    user_response = serialize_user(refreshed or user)
    token = create_access_token(user_response["id"], user_response["email"], user_role)

    await write_audit_log(
        action=AuditAction.ADMIN_LOGIN,
        admin_user=user_response,
        target_type="auth",
        target_id=user_response["id"],
        detail={"email": user_response["email"], "via": "invite_accept"},
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user_response,
    }


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def admin_login(request: Request, payload: LoginRequest):
    """
    Authenticate an admin/staff user.
    Returns 403 if the account exists but has no admin role.
    """
    users_collection = await get_users_collection_async()
    if users_collection is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is not available.",
        )

    normalized_email = payload.email.strip().lower()
    user = await users_collection.find_one({"email": normalized_email})

    if user is not None and user.get("admin_invite_token_hash"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please set your password using the invite link sent to your email.",
        )

    # Deliberate: use the same error message for both "not found" and "wrong password"
    # to prevent user enumeration attacks.
    if user is None or not verify_password(payload.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    user_response = serialize_user(user)
    user_role = user_response.get("role", "user")

    # ── Role gate: block normal users ────────────────────────────────────────
    if not is_admin_role(user_role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access the admin panel.",
        )

    # ── Ban check ────────────────────────────────────────────────────────────
    if user_response.get("is_banned"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been suspended.",
        )

    token = create_access_token(user_response["id"], user_response["email"], user_role)

    await users_collection.update_one(
        {"_id": user["_id"]},
        {"$set": {"last_admin_login_at": datetime.now(timezone.utc)}},
    )

    # Fire-and-forget audit log
    await write_audit_log(
        action=AuditAction.ADMIN_LOGIN,
        admin_user=user_response,
        target_type="auth",
        target_id=user_response["id"],
        detail={"email": normalized_email},
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user_response,
    }
