import logging

from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import settings

logger = logging.getLogger(__name__)

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
        await client.admin.command("ping")
        db = client[settings.DB_NAME]
        await db.users.create_index("email", unique=True)
        logger.info("MongoDB connected - database: '%s'", settings.DB_NAME)
    except Exception as exc:
        logger.error("MongoDB connection failed: %s", exc)
        # We log but do not crash the app during startup.


async def close_mongo_connection() -> None:
    """Called once at application shutdown."""
    global client
    if client:
        client.close()
        logger.info("MongoDB connection closed.")


def get_db():
    """Return the current MongoDB database object."""
    return db


def get_users_collection():
    """Return the MongoDB collection used for application users."""
    if db is None:
        return None
    return db.users
