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

    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""
    CLOUDINARY_FOLDER: str = "happiness-exchange/items"
    PUBLIC_API_BASE_URL: str = ""

    # Email (Resend)
    RESEND_API_KEY: str = ""
    EMAIL_FROM: str = "Happiness Exchange <verify@mail.happyexchange.net>"
    APP_BASE_URL: str = "https://www.happyexchange.net"
    ENABLE_EMAIL_DIAGNOSTICS: bool = False

    # Can be overridden via env: ALLOWED_ORIGINS=https://a.vercel.app,https://b.vercel.app
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
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
        logger.info("RESEND_API_KEY present: %s", bool(self.RESEND_API_KEY))
        logger.info("EMAIL_FROM: %s", self.EMAIL_FROM)
        logger.info("APP_BASE_URL: %s", self.APP_BASE_URL)
        logger.info("ENABLE_EMAIL_DIAGNOSTICS: %s", self.ENABLE_EMAIL_DIAGNOSTICS)
        logger.info("ALLOWED_ORIGINS: %s", self.ALLOWED_ORIGINS)


settings = Settings()
