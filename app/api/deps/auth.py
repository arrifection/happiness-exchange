from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.db.mongodb import get_users_collection_async
from app.services.auth import decode_access_token, parse_object_id, serialize_user
from app.core.runtime import email_verification_bypass_enabled

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
):
    """Resolve the current user from a bearer token."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is required.",
        )

    token_data = decode_access_token(credentials.credentials)
    if token_data is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
        )

    users_collection = await get_users_collection_async()
    if users_collection is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is not available.",
        )

    user_id = parse_object_id(token_data.sub)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
        )

    user = await users_collection.find_one({"_id": user_id})
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User for this token was not found.",
        )

    return serialize_user(user, include_whatsapp=True)


async def get_optional_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict | None:
    """Return the current user when a valid bearer token is present, else None."""
    if credentials is None:
        return None

    token_data = decode_access_token(credentials.credentials)
    if token_data is None:
        return None

    users_collection = await get_users_collection_async()
    if users_collection is None:
        return None

    user_id = parse_object_id(token_data.sub)
    if user_id is None:
        return None

    user = await users_collection.find_one({"_id": user_id})
    if user is None:
        return None

    return serialize_user(user)


async def get_verified_user(
    current_user: dict = Depends(get_current_user),
):
    """Ensure the resolved user has verified their email."""
    if current_user.get("is_verified") or email_verification_bypass_enabled():
        return current_user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You must verify your email to perform this action.",
    )


async def get_whatsapp_user(
    current_user: dict = Depends(get_verified_user),
):
    """Ensure the user has a WhatsApp number saved for coordination."""
    if not current_user.get("whatsapp_number"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please add your WhatsApp number in Settings before listing or requesting.",
        )
    return current_user
