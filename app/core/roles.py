"""
User role definitions for Happiness Exchange.

Role hierarchy (higher number = more permissions):
  user        → 1  (default for all signups)
  courier     → 2  (delivery coordination)
  moderator   → 3  (content moderation)
  admin       → 4  (platform management)
  super_admin → 5  (full control)
"""
from enum import Enum


class UserRole(str, Enum):
    USER        = "user"
    COURIER     = "courier"
    MODERATOR   = "moderator"
    ADMIN       = "admin"
    SUPER_ADMIN = "super_admin"


# Numeric hierarchy — used for >= comparisons
ROLE_LEVEL: dict[UserRole, int] = {
    UserRole.USER:        1,
    UserRole.COURIER:     2,
    UserRole.MODERATOR:   3,
    UserRole.ADMIN:       4,
    UserRole.SUPER_ADMIN: 5,
}

# Roles that can access the admin panel at all
ADMIN_ROLES: set[UserRole] = {
    UserRole.MODERATOR,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.COURIER,
}


def normalize_user_role(user_role: str | None) -> str:
    """Normalize role strings from DB/API (handles spacing and casing)."""
    if not user_role:
        return UserRole.USER.value
    normalized = str(user_role).strip().lower().replace(" ", "_").replace("-", "_")
    if normalized == "superadmin":
        return UserRole.SUPER_ADMIN.value
    return normalized


def has_role(user_role: str, required_role: UserRole) -> bool:
    """Return True if user_role meets or exceeds the required_role level."""
    try:
        ur = UserRole(normalize_user_role(user_role))
    except ValueError:
        return False
    return ROLE_LEVEL.get(ur, 0) >= ROLE_LEVEL.get(required_role, 99)


def is_admin_role(user_role: str) -> bool:
    """Return True if the role grants any level of admin panel access."""
    try:
        return UserRole(normalize_user_role(user_role)) in ADMIN_ROLES
    except ValueError:
        return False
