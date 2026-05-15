from datetime import datetime, timedelta, timezone

import bcrypt
from bson import ObjectId
from jose import JWTError, jwt

from app.core.config import settings
from app.schemas.auth import TokenPayload


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


def create_access_token(user_id: str, email: str) -> str:
    """Create a signed JWT access token for a user."""
    expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    expire = datetime.now(timezone.utc) + expires_delta
    payload = {
        "sub": user_id,
        "email": email,
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


def serialize_user(user: dict) -> dict:
    """Convert a MongoDB user document into an API-safe response shape."""
    return {
        "id": str(user["_id"]),
        "name": user["name"],
        "email": user["email"],
        "account_type": user.get("account_type"),
    }


def parse_object_id(value: str) -> ObjectId | None:
    """Safely parse a string into an ObjectId."""
    if not ObjectId.is_valid(value):
        return None
    return ObjectId(value)
