import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
from bson import ObjectId
from jose import JWTError, jwt

from app.core.config import settings
from app.core.roles import UserRole
from app.core.whatsapp import normalize_whatsapp_number, validate_whatsapp_number
from app.schemas.auth import TokenPayload

USERNAME_CHANGE_WINDOW_DAYS = 7


def hash_password(password: str) -> str:
    """Hash a plain-text password using bcrypt."""
    password_bytes = password.encode("utf-8")
    hashed_bytes = bcrypt.hashpw(password_bytes, bcrypt.gensalt())
    return hashed_bytes.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Compare a plain-text password against a stored hash."""
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8"),
    )


def generate_verification_token() -> str:
    """Generate a random 64-character hex string for email verification."""
    return secrets.token_hex(32)


def hash_verification_token(token: str) -> str:
    """Hash the verification token using SHA-256 for secure DB storage."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_access_token(user_id: str, email: str, role: str = UserRole.USER) -> str:
    """Create a signed JWT access token for a user, embedding their role."""
    expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    expire = datetime.now(timezone.utc) + expires_delta
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": expire,
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> TokenPayload | None:
    """Decode a JWT access token and return its payload when valid."""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return TokenPayload(**payload)
    except JWTError:
        return None


def serialize_user(user: dict, *, include_whatsapp: bool = False) -> dict:
    """Convert a MongoDB user document into an API-safe response shape."""
    created_at = user.get("created_at")
    username_change_deadline = None
    can_change_username = False

    if isinstance(created_at, datetime):
        # MongoDB may return naive UTC datetimes, so normalize before comparisons.
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)

        username_change_deadline = created_at + timedelta(days=USERNAME_CHANGE_WINDOW_DAYS)
        can_change_username = datetime.now(timezone.utc) <= username_change_deadline

    payload = {
        "id": str(user["_id"]),
        "name": user["name"],
        "email": user["email"],
        "role": user.get("role", UserRole.USER),
        "account_type": user.get("account_type"),
        "created_at": created_at,
        "updated_at": user.get("updated_at"),
        "is_verified": user.get("is_verified", False),
        "is_banned": user.get("is_banned", False),
        "can_change_username": can_change_username,
        "username_change_deadline": username_change_deadline,
        "blocked_users": user.get("blocked_users", []),
    }
    if include_whatsapp:
        payload["whatsapp_number"] = user.get("whatsapp_number")
    return payload


def normalize_name(value: str) -> str:
    """Normalize a display name for uniqueness checks."""
    return " ".join(value.strip().split()).lower()


def parse_object_id(value: str) -> ObjectId | None:
    """Safely parse a string into an ObjectId."""
    if not ObjectId.is_valid(value):
        return None
    return ObjectId(value)
