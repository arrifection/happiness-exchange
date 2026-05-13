from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """
    Central configuration loaded from environment variables.
    All values can be overridden in a .env file at the project root.
    """

    # ── Project info ────────────────────────────────────────────────────────
    PROJECT_NAME: str = "Happiness Exchange"
    VERSION: str = "0.1.0"

    # ── Database ─────────────────────────────────────────────────────────────
    MONGODB_URI: str = "mongodb://localhost:27017"
    DB_NAME: str = "happiness_exchange"

    # ── CORS ─────────────────────────────────────────────────────────────────
    # Comma-separated list of allowed origins.  Example in .env:
    #   ALLOWED_ORIGINS=http://localhost:5173,https://happiness-exchange.vercel.app
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        # Allow parsing comma-separated list from a single env var
        "env_nested_delimiter": ",",
    }


# Single shared instance — import this everywhere
settings = Settings()
