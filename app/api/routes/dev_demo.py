"""Local demo sandbox endpoints — development only.

Two independent locks keep these routes off any deployed backend:

1. ``api/index.py`` only mounts this router when ``local_demo_mode_enabled()``
   is true, so in production the paths do not exist at all.
2. Every handler re-checks the flag, so flipping ENVIRONMENT without a restart
   cannot leave a live shortcut behind.

The endpoints issue ordinary access tokens for seeded demo accounts. There is no
new authentication path: tokens are created by the same ``create_access_token``
helper the real login uses, so requests afterwards run through the normal
``get_current_user`` dependencies.
"""

from __future__ import annotations

import importlib.util
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from app.core.runtime import local_demo_mode_enabled
from app.db.mongodb import get_users_collection_async
from app.schemas.auth import TokenResponse
from app.services.auth import create_access_token, parse_object_id, serialize_user
from app.services.location import SUPPORTED_COUNTRIES, normalize_country

router = APIRouter()
logger = logging.getLogger(__name__)

DEMO_USER_FILTER = {"is_local_demo": True, "account_type": "member"}


async def require_local_demo_mode() -> None:
    """Behave exactly like an unknown path when the sandbox is off."""
    if not local_demo_mode_enabled():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not Found")


class DemoLoginRequest(BaseModel):
    user_id: str | None = None
    email: str | None = Field(default=None, max_length=254)
    # Same optional country switch the normal login supports, so the dev bar can
    # test Pakistan and Saudi Arabia catalogues without editing the profile.
    country: str | None = None

    @field_validator("country")
    @classmethod
    def validate_country(cls, value: str | None) -> str | None:
        if not value or not str(value).strip():
            return None
        normalized = normalize_country(value)
        if normalized not in SUPPORTED_COUNTRIES:
            raise ValueError("Unsupported country.")
        return normalized


class DemoUser(BaseModel):
    id: str
    name: str
    email: str
    country: str
    demo_key: str | None = None


class DemoUserListResponse(BaseModel):
    users: list[DemoUser]


class DemoResetResponse(BaseModel):
    message: str
    removed: dict[str, int]
    inserted: dict[str, int]


def _load_demo_env_module():
    """Import scripts/demo_env.py lazily so production never touches it."""
    module = sys.modules.get("demo_env")
    if module is not None:
        return module

    script_path = Path(__file__).resolve().parents[3] / "scripts" / "demo_env.py"
    spec = importlib.util.spec_from_file_location("demo_env", script_path)
    if spec is None or spec.loader is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Demo seed script not found at {script_path}.",
        )
    module = importlib.util.module_from_spec(spec)
    sys.modules["demo_env"] = module
    spec.loader.exec_module(module)
    return module


@router.get(
    "/demo/users",
    response_model=DemoUserListResponse,
    dependencies=[Depends(require_local_demo_mode)],
)
async def list_demo_users():
    """List the seeded demo accounts available for one-click sign-in."""
    users_collection = await get_users_collection_async()
    if users_collection is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is not available.",
        )

    cursor = users_collection.find(DEMO_USER_FILTER).sort("local_demo_key", 1)
    users = await cursor.to_list(length=20)
    return {
        "users": [
            {
                "id": str(user["_id"]),
                "name": user.get("name") or "Demo user",
                "email": user.get("email") or "",
                "country": user.get("country") or "Pakistan",
                "demo_key": user.get("local_demo_key"),
            }
            for user in users
        ]
    }


@router.post(
    "/demo/login",
    response_model=TokenResponse,
    dependencies=[Depends(require_local_demo_mode)],
)
async def demo_login(payload: DemoLoginRequest):
    """Issue a normal access token for a seeded demo account."""
    users_collection = await get_users_collection_async()
    if users_collection is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is not available.",
        )

    query: dict = dict(DEMO_USER_FILTER)
    if payload.user_id:
        user_object_id = parse_object_id(payload.user_id)
        if user_object_id is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid demo user id.")
        query["_id"] = user_object_id
    elif payload.email:
        query["email"] = payload.email.strip().lower()
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide a demo user_id or email.",
        )

    user = await users_collection.find_one(query)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Demo user not found. Run: python scripts/demo_env.py",
        )

    if payload.country:
        now = datetime.now(timezone.utc)
        await users_collection.update_one(
            {"_id": user["_id"]},
            {"$set": {"country": payload.country, "updated_at": now}},
        )
        user["country"] = payload.country
        user["updated_at"] = now

    user_response = serialize_user(user, include_whatsapp=True)
    token = create_access_token(user_response["id"], user_response["email"], user_response["role"])
    logger.warning("Local demo sign-in issued for %s", user_response["email"])
    return {"access_token": token, "token_type": "bearer", "user": user_response}


@router.post(
    "/demo/reset",
    response_model=DemoResetResponse,
    dependencies=[Depends(require_local_demo_mode)],
)
async def reset_demo_data():
    """Wipe and reseed the demo sandbox back to its documented start state."""
    demo_env = _load_demo_env_module()
    try:
        result = await demo_env.seed_demo_environment(connect=False)
    except demo_env.DemoSeedError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    return {
        "message": "Demo data reset.",
        "removed": result["removed"],
        "inserted": result["inserted"],
    }
