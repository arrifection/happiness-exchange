"""
Admin-only login endpoint.

POST /api/admin/auth/login
- Accepts email + password (same credentials as public login)
- Rejects any user whose role is not in ADMIN_ROLES
- Returns the same TokenResponse shape as the public login
- Logs the admin login event to the audit log
"""
from fastapi import APIRouter, HTTPException, status

from app.db.mongodb import get_users_collection_async
from app.schemas.auth import LoginRequest, TokenResponse
from app.services.audit import AuditAction, write_audit_log
from app.services.auth import create_access_token, serialize_user, verify_password
from app.core.roles import is_admin_role

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
async def admin_login(payload: LoginRequest):
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
