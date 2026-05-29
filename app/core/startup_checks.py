"""Production startup validation — logs warnings, never blocks boot."""

from __future__ import annotations

import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


def validate_production_settings() -> list[str]:
    """Return human-readable warnings for risky launch configuration."""
    warnings: list[str] = []
    base = (settings.APP_BASE_URL or "").lower()
    is_prod = base.startswith("https://") and "localhost" not in base

    if settings.JWT_SECRET_KEY == "change-this-in-production":
        warnings.append("JWT_SECRET_KEY is still the default value.")

    if is_prod and not settings.RESEND_API_KEY:
        warnings.append("RESEND_API_KEY is missing — verification emails will fail.")

    if is_prod and not settings.CLOUDINARY_CLOUD_NAME:
        warnings.append("Cloudinary is not configured — image uploads will fail in production.")

    if settings.MONGODB_URI.startswith("mongodb://localhost"):
        warnings.append("MONGODB_URI points to localhost — Atlas connection expected in production.")

    return warnings


def log_production_warnings() -> None:
    warnings = validate_production_settings()
    if not warnings:
        logger.info("Production startup checks passed with no warnings.")
        return
    for warning in warnings:
        logger.warning("STARTUP WARNING: %s", warning)
