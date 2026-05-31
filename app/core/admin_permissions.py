"""
Explicit admin-panel permissions per staff role.

The hired ``admin`` role is intentionally limited — not a superset of moderator.
"""
from app.core.roles import UserRole

PERMISSION_LISTINGS = "listings"
PERMISSION_MESSAGES = "messages"
PERMISSION_REVIEWS = "reviews"
PERMISSION_DELIVERIES = "deliveries"
PERMISSION_REQUESTS = "requests"
PERMISSION_REPORTS = "reports"
PERMISSION_USERS = "users"
PERMISSION_ANALYTICS = "analytics"
PERMISSION_TEAM = "team"
PERMISSION_DASHBOARD = "dashboard"

ROLE_PERMISSIONS: dict[str, set[str]] = {
    UserRole.SUPER_ADMIN.value: {
        PERMISSION_DASHBOARD,
        PERMISSION_LISTINGS,
        PERMISSION_MESSAGES,
        PERMISSION_REVIEWS,
        PERMISSION_DELIVERIES,
        PERMISSION_REQUESTS,
        PERMISSION_REPORTS,
        PERMISSION_USERS,
        PERMISSION_ANALYTICS,
        PERMISSION_TEAM,
    },
    UserRole.MODERATOR.value: {
        PERMISSION_DASHBOARD,
        PERMISSION_LISTINGS,
        PERMISSION_MESSAGES,
        PERMISSION_REVIEWS,
        PERMISSION_REQUESTS,
        PERMISSION_REPORTS,
        PERMISSION_USERS,
    },
    UserRole.ADMIN.value: {
        PERMISSION_DASHBOARD,
        PERMISSION_LISTINGS,
        PERMISSION_MESSAGES,
        PERMISSION_REVIEWS,
        PERMISSION_DELIVERIES,
    },
    UserRole.COURIER.value: {
        PERMISSION_DASHBOARD,
        PERMISSION_DELIVERIES,
    },
}


def role_has_permission(role: str, permission: str) -> bool:
    return permission in ROLE_PERMISSIONS.get(role, set())
