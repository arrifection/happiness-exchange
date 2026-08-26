"""Runtime environment helpers.

Used to keep local-only development shortcuts from activating in production.
"""

from __future__ import annotations

import os

from app.core.config import settings

PRODUCTION_ENVIRONMENTS = frozenset({"production", "prod"})


def is_production_environment(
    environment: str | None = None,
    *,
    space_id: str | None = None,
) -> bool:
    """Return True when this process must be treated as production.

    Production is detected from ENVIRONMENT/APP_ENV values ``production`` or
    ``prod``, or from a Hugging Face Spaces ``SPACE_ID`` (hosted deploys).
    """
    env_value = settings.ENVIRONMENT if environment is None else environment
    if (env_value or "").strip().lower() in PRODUCTION_ENVIRONMENTS:
        return True

    sid = os.environ.get("SPACE_ID", "") if space_id is None else space_id
    if (sid or "").strip():
        return True
    return False


def email_verification_bypass_enabled(
    *,
    bypass_flag: bool | None = None,
    environment: str | None = None,
    space_id: str | None = None,
) -> bool:
    """Return True only for an explicit local/dev verification bypass.

    The flag defaults to False. Production (including Hugging Face Spaces)
    always returns False even if DEV_BYPASS_EMAIL_VERIFICATION is set.
    """
    if is_production_environment(environment, space_id=space_id):
        return False

    if bypass_flag is None:
        return bool(settings.DEV_BYPASS_EMAIL_VERIFICATION)
    return bool(bypass_flag)


def local_demo_mode_enabled(
    *,
    demo_flag: bool | None = None,
    environment: str | None = None,
    space_id: str | None = None,
) -> bool:
    """Return True only for an explicit local demo sandbox.

    The flag defaults to False. Production (including Hugging Face Spaces)
    always returns False even if LOCAL_DEMO_MODE is set, so the demo login and
    seeding endpoints can never exist on a deployed backend.
    """
    if is_production_environment(environment, space_id=space_id):
        return False

    if demo_flag is None:
        return bool(settings.LOCAL_DEMO_MODE)
    return bool(demo_flag)
