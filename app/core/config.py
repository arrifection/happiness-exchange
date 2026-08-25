import logging
import os
import re
from typing import List

from pydantic import AliasChoices, Field, field_validator, model_validator
from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    """
    Central configuration loaded from environment variables.
    All values can be overridden in a .env file at the project root.
    """

    PROJECT_NAME: str = "Happiness Exchange"
    VERSION: str = "0.1.0"

    # Local default is development. Production hosts must set ENVIRONMENT=production
    # (or APP_ENV=production). Hugging Face Spaces are also treated as production.
    ENVIRONMENT: str = Field(
        default="development",
        validation_alias=AliasChoices("ENVIRONMENT", "APP_ENV"),
    )

    # Local/dev only. Default FALSE. Ignored when the process is production.
    DEV_BYPASS_EMAIL_VERIFICATION: bool = False

    # Local SMTP sink (Mailpit). Unused in production — Resend remains the path.
    SMTP_HOST: str = ""
    SMTP_PORT: int = 1025
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_STARTTLS: bool = False

    MONGODB_URI: str = Field(
        default="mongodb://localhost:27017",
        validation_alias=AliasChoices(
            "MONGODB_URI",
            "MONGO_URL",
            "MONGO_URI",
            "MONGODB_URL",
            "DATABASE_URL",
        ),
    )
    DB_NAME: str = Field(
        default="happiness_exchange",
        validation_alias=AliasChoices(
            "DB_NAME",
            "MONGODB_DB_NAME",
            "MONGO_DB_NAME",
            "DATABASE_NAME",
        ),
    )

    JWT_SECRET_KEY: str = "change-this-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    LISTING_ACTIVE_DAYS: int = 14
    EXCHANGE_OFFER_EXPIRE_DAYS: int = 14
    EXCHANGE_SHIPPING_PAYMENT_DEADLINE_HOURS: int = 72

    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""
    CLOUDINARY_FOLDER: str = "happiness-exchange/items"
    PUBLIC_API_BASE_URL: str = ""

    # Email (Resend) — shared by main-site verification and admin team invites
    RESEND_API_KEY: str = ""
    EMAIL_FROM: str = Field(
        default="Happiness Exchange <verify@mail.happyexchange.net>",
        validation_alias=AliasChoices("EMAIL_FROM", "RESEND_FROM_EMAIL"),
    )
    APP_BASE_URL: str = "https://www.happyexchange.net"
    ADMIN_PANEL_URL: str = Field(
        default="https://admin-panel-happy-exchange.vercel.app",
        validation_alias=AliasChoices("ADMIN_PANEL_URL", "ADMIN_BASE_URL"),
    )
    ENABLE_EMAIL_DIAGNOSTICS: bool = False

    # Can be overridden via env: ALLOWED_ORIGINS=https://a.vercel.app,https://b.vercel.app
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:5200",
        "http://127.0.0.1:5200",
        # Public app
        "https://happyexchange.net",
        "https://www.happyexchange.net",
        "https://happiness-exchange.vercel.app",
        "https://admin.happyexchange.net",
    ]

    @field_validator("ENVIRONMENT", mode="before")
    @classmethod
    def normalize_environment(cls, v):
        if v is None or v == "":
            return "development"
        return str(v).strip().lower()

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def split_allowed_origins(cls, v):
        """
        If ALLOWED_ORIGINS is provided as a comma-separated string in the
        environment (e.g. in HF Spaces secrets), split it into a list.
        """
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    @model_validator(mode="after")
    def hydrate_cloudinary_from_url(self):
        if self.CLOUDINARY_CLOUD_NAME and self.CLOUDINARY_API_KEY and self.CLOUDINARY_API_SECRET:
            return self
        url = os.getenv("CLOUDINARY_URL", "").strip()
        if not url:
            return self
        match = re.match(r"^cloudinary://([^:]+):([^@]+)@([^/?]+)", url)
        if not match:
            return self
        api_key, api_secret, cloud_name = match.groups()
        return self.model_copy(update={
            "CLOUDINARY_API_KEY": api_key,
            "CLOUDINARY_API_SECRET": api_secret,
            "CLOUDINARY_CLOUD_NAME": cloud_name,
        })

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        # Use | as nested delimiter so commas in ALLOWED_ORIGINS are not consumed
        "env_nested_delimiter": "|",
        "str_strip_whitespace": True,
    }

    def log_startup_info(self) -> None:
        """Log safe startup diagnostics — never prints secrets."""
        uri_present = bool(self.MONGODB_URI and self.MONGODB_URI != "mongodb://localhost:27017")
        logger.info("=== Happiness Exchange startup ===")
        logger.info("MONGODB_URI present: %s", uri_present)
        logger.info("DB_NAME: %s", self.DB_NAME)
        logger.info("JWT_SECRET_KEY is default: %s", self.JWT_SECRET_KEY == "change-this-in-production")
        logger.info("CLOUDINARY_CLOUD_NAME present: %s", bool(self.CLOUDINARY_CLOUD_NAME))
        logger.info("CLOUDINARY_API_KEY present: %s", bool(self.CLOUDINARY_API_KEY))
        logger.info("CLOUDINARY_API_SECRET present: %s", bool(self.CLOUDINARY_API_SECRET))
        logger.info("CLOUDINARY_FOLDER: %s", self.CLOUDINARY_FOLDER)
        logger.info("ENVIRONMENT: %s", self.ENVIRONMENT)
        logger.info("RESEND_API_KEY present: %s", bool(self.RESEND_API_KEY))
        logger.info("EMAIL_FROM: %s", self.EMAIL_FROM)
        logger.info("APP_BASE_URL: %s", self.APP_BASE_URL)
        logger.info("ADMIN_PANEL_URL: %s", self.ADMIN_PANEL_URL)
        logger.info("ENABLE_EMAIL_DIAGNOSTICS: %s", self.ENABLE_EMAIL_DIAGNOSTICS)
        logger.info("SMTP_HOST: %s", self.SMTP_HOST or "(not set)")
        logger.info("SMTP_PORT: %s", self.SMTP_PORT)
        logger.info(
            "DEV_BYPASS_EMAIL_VERIFICATION requested: %s",
            self.DEV_BYPASS_EMAIL_VERIFICATION,
        )
        from app.core.runtime import email_verification_bypass_enabled, is_production_environment

        production = is_production_environment()
        bypass_active = email_verification_bypass_enabled()
        logger.info("is_production_environment: %s", production)
        logger.info("email_verification_bypass_enabled: %s", bypass_active)
        if self.DEV_BYPASS_EMAIL_VERIFICATION and production:
            logger.error(
                "DEV_BYPASS_EMAIL_VERIFICATION is set in a production environment. "
                "The bypass is IGNORED. Email verification remains required."
            )
        elif bypass_active:
            logger.warning(
                "DEV_BYPASS_EMAIL_VERIFICATION is enabled. This is a local/dev-only "
                "shortcut. Do not use it in production."
            )
        logger.info("ALLOWED_ORIGINS: %s", self.ALLOWED_ORIGINS)


settings = Settings()
