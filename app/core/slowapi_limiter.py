"""SlowAPI rate limiter shared across FastAPI routes."""

from __future__ import annotations

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.services.auth import decode_access_token

limiter = Limiter(key_func=get_remote_address)


def authenticated_user_key(request: Request) -> str:
    """Rate-limit key for authenticated write routes (falls back to client IP)."""
    authorization = request.headers.get("Authorization", "")
    if authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        token_data = decode_access_token(token)
        if token_data and token_data.sub:
            return f"user:{token_data.sub}"
    return get_remote_address(request)
