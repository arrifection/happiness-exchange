"""Consistent user display name resolution for chat and UI."""

from __future__ import annotations

INVALID_DISPLAY_VALUES = frozenset({"unknown", "unknown user", "n/a", "na", ""})


def resolve_user_display_name(
    user: dict | None = None,
    *,
    fallback: str = "User",
    **fields,
) -> str:
    """Resolve a display name using full name → display name → name → username → email prefix."""
    candidates = [
        fields.get("full_name"),
        fields.get("display_name"),
        fields.get("name"),
        fields.get("username"),
    ]

    if user:
        candidates = [
            user.get("full_name"),
            user.get("display_name"),
            user.get("name"),
            user.get("username"),
            *candidates,
        ]
        email = user.get("email")
        if email and "@" in str(email):
            candidates.append(str(email).split("@", 1)[0])

    email_field = fields.get("email")
    if email_field and "@" in str(email_field):
        candidates.append(str(email_field).split("@", 1)[0])

    for candidate in candidates:
        if candidate is None:
            continue
        cleaned = " ".join(str(candidate).strip().split())
        if cleaned.lower() in INVALID_DISPLAY_VALUES:
            continue
        return cleaned

    return fallback


def sanitize_display_name(value: str | None, *, fallback: str = "User") -> str:
    """Normalize a stored display string, replacing invalid values with fallback."""
    if value is None:
        return fallback
    cleaned = " ".join(str(value).strip().split())
    if not cleaned or cleaned.lower() in INVALID_DISPLAY_VALUES:
        return fallback
    return cleaned
