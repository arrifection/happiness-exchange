from typing import List

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    Central configuration loaded from environment variables.
    All values can be overridden in a .env file at the project root.
    """

    PROJECT_NAME: str = "Happiness Exchange"
    VERSION: str = "0.1.0"

    MONGODB_URI: str = "mongodb://localhost:27017"
    DB_NAME: str = "happiness_exchange"

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
