from typing import List

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings


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

    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "https://happiness-exchange.vercel.app",
    ]

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "env_nested_delimiter": ",",
    }


settings = Settings()
