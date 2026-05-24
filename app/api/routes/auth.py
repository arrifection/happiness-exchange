from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.errors import DuplicateKeyError

from app.core.roles import UserRole
from app.db.mongodb import get_users_collection_async
from app.schemas.auth import LoginRequest, SignupRequest, TokenResponse, VerifyEmailResponse, ResendVerificationResponse
from app.services.auth import (
    create_access_token,
    generate_verification_token,
    hash_password,
    hash_verification_token,
    normalize_name,
    serialize_user,
    verify_password,
)
from app.core.config import settings
from app.services.email import EmailSendError, get_email_diagnostics, send_verification_email
from app.services.notifications import notify_admins
from app.api.deps.auth import get_current_user, get_optional_current_user

router = APIRouter()


def _email_diagnostics_allowed() -> bool:
    """Expose email config check only in dev or when explicitly enabled."""
    if settings.ENABLE_EMAIL_DIAGNOSTICS:
        return True
    base = (settings.APP_BASE_URL or "").lower()
    return base.startswith("http://localhost") or base.startswith("http://127.0.0.1")


@router.get("/email-config-check")
async def email_config_check():
    """Safe Resend configuration snapshot — never exposes secrets."""
    if not _email_diagnostics_allowed():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found.")
    return get_email_diagnostics()


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(payload: SignupRequest):
    """Create a new community member account and immediately return an access token."""
    users_collection = await get_users_collection_async()
    if users_collection is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is not available.",
        )

    normalized_email = payload.email.strip().lower()
    normalized_name = normalize_name(payload.name)
    now = datetime.now(timezone.utc)

    existing_name = await users_collection.find_one({"name_normalized": normalized_name})
    if existing_name is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That username is already taken.",
        )

    raw_token = generate_verification_token()
    token_hash = hash_verification_token(raw_token)
    token_expiry = now + timedelta(hours=24)

    user_document = {
        "name": " ".join(payload.name.strip().split()),
        "name_normalized": normalized_name,
        "email": normalized_email,
        "hashed_password": hash_password(payload.password),
        "role": UserRole.USER,          # default role for all public signups
        "account_type": "member",
        "is_verified": False,
        "is_banned": False,
        "email_verification_token_hash": token_hash,
        "email_verification_expires_at": token_expiry,
        "created_at": now,
        "updated_at": now,
    }

    try:
        result = await users_collection.insert_one(user_document)
    except DuplicateKeyError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    created_user = {
        "_id": result.inserted_id,
        "name": user_document["name"],
        "email": user_document["email"],
        "account_type": user_document["account_type"],
        "is_verified": False,
        "created_at": user_document["created_at"],
        "updated_at": user_document["updated_at"],
    }
    user_response = serialize_user(created_user)
    token = create_access_token(user_response["id"], user_response["email"], user_response["role"])

    try:
        send_verification_email(normalized_email, raw_token)
    except EmailSendError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=exc.message,
        )

    # Trigger admin notification
    import asyncio
    asyncio.create_task(
        notify_admins(
            title="New User Signup",
            message=f"A new user ({payload.name}) has joined the platform.",
            type_="new_user_signup",
            action_url=f"/users/{user_response['id']}" # URL intended for admin panel routing
        )
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user_response,
    }


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest):
    """Authenticate an existing user and return an access token."""
    users_collection = await get_users_collection_async()
    if users_collection is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is not available.",
        )

    normalized_email = payload.email.strip().lower()
    user = await users_collection.find_one({"email": normalized_email})
    if user is None or not verify_password(payload.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    user_response = serialize_user(user)

    # Block banned accounts from logging in
    if user_response.get("is_banned"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been suspended.",
        )

    token = create_access_token(user_response["id"], user_response["email"], user_response["role"])

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user_response,
    }


@router.get("/verify-email", response_model=VerifyEmailResponse)
async def verify_email(
    token: str,
    current_user: dict | None = Depends(get_optional_current_user),
):
    """Verify a user's email using the token sent to them."""
    users_collection = await get_users_collection_async()
    if users_collection is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is not available.",
        )

    token_hash = hash_verification_token(token)
    user = await users_collection.find_one({"email_verification_token_hash": token_hash})

    if not user:
        if current_user and current_user.get("is_verified"):
            return {
                "message": "Your email is already verified.",
                "status": "already_verified",
            }
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This verification link is invalid or expired.",
        )

    if user.get("is_verified"):
        return {
            "message": "Your email is already verified.",
            "status": "already_verified",
        }

    now = datetime.now(timezone.utc)
    expires_at = user.get("email_verification_expires_at")

    if not expires_at or now > expires_at.replace(tzinfo=timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This verification link is invalid or expired.",
        )

    await users_collection.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "is_verified": True,
                "verified_at": now,
            },
            "$unset": {
                "email_verification_token_hash": "",
                "email_verification_expires_at": "",
            }
        }
    )
    return {
        "message": "Email verified successfully.",
        "status": "verified",
    }


@router.post("/resend-verification", response_model=ResendVerificationResponse)
async def resend_verification(current_user: dict = Depends(get_current_user)):
    """Resend verification email if user is not already verified."""
    if current_user.get("is_verified"):
        return {
            "message": "Your email is already verified.",
            "status": "already_verified",
        }

    users_collection = await get_users_collection_async()
    if users_collection is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is not available.",
        )

    raw_token = generate_verification_token()
    token_hash = hash_verification_token(raw_token)
    now = datetime.now(timezone.utc)
    token_expiry = now + timedelta(hours=24)

    from app.services.auth import parse_object_id
    user_id = parse_object_id(current_user["id"])
    
    await users_collection.update_one(
        {"_id": user_id},
        {
            "$set": {
                "email_verification_token_hash": token_hash,
                "email_verification_expires_at": token_expiry,
            }
        }
    )

    try:
        send_verification_email(current_user["email"], raw_token)
    except EmailSendError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=exc.message,
        )
    return {
        "message": "New verification email sent. Please check your inbox.",
        "status": "sent",
    }
