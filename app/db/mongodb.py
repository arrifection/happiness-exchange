import asyncio
import logging
import os
from contextlib import suppress

from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import settings

logger = logging.getLogger(__name__)

client: AsyncIOMotorClient | None = None
db = None
_connect_lock: asyncio.Lock | None = None
_indexes_ready = False
_last_connection_error: str | None = None

CONNECT_RETRY_ATTEMPTS = 3
CONNECT_RETRY_DELAY_SECONDS = 1


def _get_connect_lock() -> asyncio.Lock:
    global _connect_lock
    if _connect_lock is None:
        _connect_lock = asyncio.Lock()
    return _connect_lock


async def _ensure_indexes(database) -> None:
    global _indexes_ready
    if _indexes_ready:
        return

    await database.users.create_index("email", unique=True)
    await database.users.create_index("name_normalized", unique=True)
    await database.items.create_index("status")
    await database.items.create_index("created_at")
    await database.requests.create_index(
        [("item_id", 1), ("requester_id", 1)],
        unique=True,
    )
    await database.requests.create_index("owner_id")
    await database.requests.create_index("requester_id")
    _indexes_ready = True


async def _create_client_and_ping() -> AsyncIOMotorClient:
    last_error: Exception | None = None

    for attempt in range(1, CONNECT_RETRY_ATTEMPTS + 1):
        pending_client = AsyncIOMotorClient(
            settings.MONGODB_URI,
            serverSelectionTimeoutMS=8000,
            connectTimeoutMS=8000,
        )
        try:
            await pending_client.admin.command("ping")
            return pending_client
        except Exception as exc:
            last_error = exc
            pending_client.close()
            logger.warning(
                "MongoDB ping attempt %s/%s failed: %s",
                attempt,
                CONNECT_RETRY_ATTEMPTS,
                exc,
            )
            if attempt < CONNECT_RETRY_ATTEMPTS:
                await asyncio.sleep(CONNECT_RETRY_DELAY_SECONDS)

    assert last_error is not None
    raise last_error


async def connect_to_mongo() -> None:
    """
    Connect once and reuse the client across requests.
    """
    global client, db, _indexes_ready, _last_connection_error
    if db is not None:
        return

    async with _get_connect_lock():
        if db is not None:
            return

        pending_client = None
        uri_present = bool(os.environ.get("MONGODB_URI"))
        logger.info("[DB] MONGODB_URI present: %s", uri_present)
        logger.info("[DB] DB_NAME: %s", settings.DB_NAME)
        try:
            logger.info("[DB] Connecting to MongoDB...")
            pending_client = await _create_client_and_ping()
            database = pending_client[settings.DB_NAME]
            client = pending_client
            db = database
            _last_connection_error = None
            try:
                await _ensure_indexes(database)
            except Exception as exc:
                logger.warning("[DB] MongoDB connected but index sync failed: %s", exc)
            logger.info("[DB] MongoDB ping: ok — database: '%s'", settings.DB_NAME)
        except Exception as exc:
            _indexes_ready = False
            if pending_client is not None:
                with suppress(Exception):
                    pending_client.close()
            client = None
            db = None
            _last_connection_error = str(exc)
            # Strip credentials from error before logging
            safe_msg = str(exc).split("@")[-1] if "@" in str(exc) else str(exc)
            logger.error("[DB] MongoDB ping: FAILED — %s", safe_msg)


async def get_db_async():
    await connect_to_mongo()
    return db


async def get_users_collection_async():
    database = await get_db_async()
    if database is None:
        return None
    return database.users


async def get_items_collection_async():
    database = await get_db_async()
    if database is None:
        return None
    return database.items


async def get_requests_collection_async():
    database = await get_db_async()
    if database is None:
        return None
    return database.requests


async def close_mongo_connection() -> None:
    """Called once at application shutdown."""
    global client, db, _indexes_ready
    try:
        if client:
            client.close()
            logger.info("MongoDB connection closed.")
    finally:
        client = None
        db = None
        _indexes_ready = False


def get_db():
    """Return the current MongoDB database object."""
    return db


def get_users_collection():
    """Return the MongoDB collection used for application users."""
    database = get_db()
    if database is None:
        return None
    return database.users


def get_items_collection():
    """Return the MongoDB collection used for item listings."""
    database = get_db()
    if database is None:
        return None
    return database.items


def get_requests_collection():
    """Return the MongoDB collection used for item requests."""
    database = get_db()
    if database is None:
        return None
    return database.requests


def get_last_connection_error() -> str | None:
    """Return the last MongoDB connection error for debugging."""
    return _last_connection_error
