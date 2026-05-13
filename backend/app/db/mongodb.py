from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

# Module-level holder so other parts of the app can import `db`
client: AsyncIOMotorClient | None = None
db = None


async def connect_to_mongo() -> None:
    """
    Called once at application startup (via lifespan in main.py).
    Creates a Motor async client and pings the server to verify connectivity.
    """
    global client, db
    try:
        logger.info("Connecting to MongoDB...")
        client = AsyncIOMotorClient(settings.MONGODB_URI)
        # Lightweight ping - fails fast if the URI is wrong
        await client.admin.command("ping")
        db = client[settings.DB_NAME]
        logger.info("MongoDB connected - database: '%s'", settings.DB_NAME)
    except Exception as exc:
        logger.error("MongoDB connection failed: %s", exc)
        # We log but don't crash - the /api/status endpoint will still respond


async def close_mongo_connection() -> None:
    """Called once at application shutdown."""
    global client
    if client:
        client.close()
        logger.info("MongoDB connection closed.")


def get_db():
    """
    Dependency helper for FastAPI routes.

    Usage in a route:
        from app.db.mongodb import get_db
        ...
        db = get_db()
    """
    return db
