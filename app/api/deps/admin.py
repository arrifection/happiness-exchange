"""
Admin authorization dependencies for FastAPI route injection.

Usage in a route:
    @router.get("/admin/users")
    async def list_users(admin: dict = Depends(get_admin_user)):
        ...

Hierarchy:
    get_current_user       → any valid JWT (existing dep, unchanged)
    get_admin_user         → moderator | courier | admin | super_admin
    get_moderator_or_admin → moderator | admin | super_admin
    get_admin_only         → admin | super_admin
    get_super_admin        → super_admin only
"""
from fastapi import Depends, HTTPException, status

from app.api.deps.auth import get_current_user
from app.core.roles import UserRole, has_role, is_admin_role


def _role_guard(required_role: UserRole, label: str):
    """
    Factory that creates a FastAPI dependency function for a given minimum role.
    Returns a dependency that raises 403 if the user's role is insufficient.
    """
    async def _dependency(current_user: dict = Depends(get_current_user)) -> dict:
        user_role = current_user.get("role", "user")

        # First: ensure the user has any admin access at all
        if not is_admin_role(user_role):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin panel access is restricted to authorized staff only.",
            )

        # Then: check the specific minimum level required
        if not has_role(user_role, required_role):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"This action requires the '{required_role.value}' role or higher. "
                    f"Your current role is '{user_role}'."
                ),
            )

        # Block banned admins
        if current_user.get("is_banned"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This account has been suspended.",
            )

        return current_user

    _dependency.__name__ = label
    return _dependency


# ── Public dependency callables ───────────────────────────────────────────────

# Any recognized admin role (courier, moderator, admin, super_admin)
get_admin_user = _role_guard(UserRole.COURIER, "get_admin_user")

# Moderator level or higher
get_moderator_or_admin = _role_guard(UserRole.MODERATOR, "get_moderator_or_admin")

# Admin level or higher (not courier, not moderator)
get_admin_only = _role_guard(UserRole.ADMIN, "get_admin_only")

# Super admin only
get_super_admin = _role_guard(UserRole.SUPER_ADMIN, "get_super_admin")


async def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """Require any staff/admin role. Returns 403 (not 401) for authenticated non-admins."""
    if not is_admin_role(current_user.get("role", "user")):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    if current_user.get("is_banned"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been suspended.",
        )
    return current_user
