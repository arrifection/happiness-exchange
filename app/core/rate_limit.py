"""Lightweight in-process rate limiting for launch safety (single HF Space instance)."""

from __future__ import annotations

import time
from collections import defaultdict
from threading import Lock

from fastapi import Depends, HTTPException, Request, status

from app.api.deps.auth import get_current_user

_buckets: dict[str, list[float]] = defaultdict(list)
_lock = Lock()


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    if forwarded:
        return forwarded
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _enforce(key: str, *, max_calls: int, window_seconds: int) -> None:
    now = time.time()
    with _lock:
        hits = _buckets[key]
        hits[:] = [stamp for stamp in hits if now - stamp < window_seconds]
        if len(hits) >= max_calls:
            retry_after = max(1, int(window_seconds - (now - hits[0])))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "message": "Too many requests. Please try again shortly.",
                    "retry_after_seconds": retry_after,
                },
            )
        hits.append(now)


def rate_limit_ip(scope: str, *, max_calls: int, window_seconds: int):
    """Rate limit by client IP — use on auth and anonymous write routes."""

    async def dependency(request: Request) -> None:
        ip = _client_ip(request)
        _enforce(f"{scope}:ip:{ip}", max_calls=max_calls, window_seconds=window_seconds)

    return dependency


def check_user_rate_limit(user_id: str, scope: str, *, max_calls: int, window_seconds: int) -> None:
    _enforce(f"{scope}:user:{user_id}", max_calls=max_calls, window_seconds=window_seconds)


def rate_limit_user(scope: str, *, max_calls: int, window_seconds: int):
    """Rate limit by authenticated user id."""

    async def dependency(
        request: Request,
        current_user: dict = Depends(get_current_user),
    ) -> dict:
        _enforce(
            f"{scope}:user:{current_user['id']}",
            max_calls=max_calls,
            window_seconds=window_seconds,
        )
        return current_user

    return dependency
