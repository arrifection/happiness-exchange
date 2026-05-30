import asyncio
import logging
import os
from contextlib import suppress

from pymongo import ASCENDING, DESCENDING

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorCollection

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
    await database.items.create_index("owner_id")
    await database.items.create_index("category")
    await database.items.create_index("country")
    await database.items.create_index("city")
    await database.items.create_index([("status", ASCENDING), ("created_at", DESCENDING)])
    await database.items.create_index([("country", ASCENDING), ("city", ASCENDING), ("status", ASCENDING)])
    await database.items.create_index([("owner_id", ASCENDING), ("status", ASCENDING)])
    await database.requests.create_index(
        [("item_id", 1), ("requester_id", 1)],
        unique=True,
    )
    await database.requests.create_index("item_id")
    await database.requests.create_index("owner_id")
    await database.requests.create_index("requester_id")
    await database.requests.create_index("status")
    await database.requests.create_index([("owner_id", ASCENDING), ("status", ASCENDING), ("created_at", DESCENDING)])
    await database.requests.create_index([("item_id", ASCENDING), ("status", ASCENDING)])
    await database.requests.create_index([("requester_id", ASCENDING), ("status", ASCENDING), ("created_at", DESCENDING)])
    await database.reviews.create_index(
        [("item_id", 1), ("reviewer_id", 1)],
        unique=True,
    )
    await database.reviews.create_index("reviewed_user_id")
    await database.reviews.create_index("reviewer_id")
    await database.reviews.create_index("created_at")
    await database.reviews.create_index([("reviewed_user_id", ASCENDING), ("created_at", DESCENDING)])
    # Chat indexes — admin-mediated: two chats per request (admin↔receiver, admin↔lister)
    with suppress(Exception):
        await database.conversations.drop_index("request_id_1")
    await database.conversations.create_index(
        [("request_id", ASCENDING), ("chat_type", ASCENDING)],
        unique=True,
        name="request_id_chat_type_unique",
        partialFilterExpression={"chat_type": {"$exists": True}},
    )
    await database.conversations.create_index("chat_type")
    await database.conversations.create_index("admin_id")
    await database.conversations.create_index("member_id")
    await database.conversations.create_index("item_id")
    await database.conversations.create_index("giver_id")
    await database.conversations.create_index("receiver_id")
    await database.conversations.create_index("last_message_at")
    await database.conversations.create_index([("giver_id", ASCENDING), ("last_message_at", DESCENDING)])
    await database.conversations.create_index([("receiver_id", ASCENDING), ("last_message_at", DESCENDING)])
    await database.conversations.create_index([("member_id", ASCENDING), ("last_message_at", DESCENDING)])
    await database.conversations.create_index([("admin_id", ASCENDING), ("last_message_at", DESCENDING)])
    await database.conversations.create_index(
        [("chat_type", ASCENDING), ("last_message_at", DESCENDING)],
    )
    await database.conversations.create_index(
        [("member_id", ASCENDING), ("chat_type", ASCENDING), ("last_message_at", DESCENDING)],
    )
    await database.messages.create_index("conversation_id")
    await database.messages.create_index("created_at")
    await database.messages.create_index([("conversation_id", ASCENDING), ("created_at", ASCENDING)])
    await database.messages.create_index([("sender_id", ASCENDING), ("created_at", DESCENDING)])
    # Notifications indexes
    await database.notifications.create_index("user_id")
    await database.notifications.create_index("created_at")
    await database.notifications.create_index("read")
    await database.notifications.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
    await database.notifications.create_index([("user_id", ASCENDING), ("read", ASCENDING)])
    await database.notifications.create_index([("user_id", ASCENDING), ("read", ASCENDING), ("created_at", DESCENDING)])
    # Deliveries indexes
    await database.deliveries.create_index("request_id", unique=True)
    await database.deliveries.create_index("giver_id")
    await database.deliveries.create_index("receiver_id")
    await database.deliveries.create_index("status")
    await database.deliveries.create_index("created_at")
    # Community need requests
    await database.need_requests.create_index("status")
    await database.need_requests.create_index("created_at")
    await database.need_requests.create_index("created_by")
    await database.need_requests.create_index([("country", 1), ("city", 1)])
    # Trust Events indexes
    await database.trust_events.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
    await database.trust_events.create_index(
        [("user_id", ASCENDING), ("event_type", ASCENDING), ("reference_id", ASCENDING)],
        unique=True,
        partialFilterExpression={"reference_id": {"$exists": True, "$ne": None}},
    )
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


async def get_reviews_collection_async():
    database = await get_db_async()
    if database is None:
        return None
    return database.reviews


async def get_conversations_collection_async():
    database = await get_db_async()
    if database is None:
        return None
    return database.conversations


async def get_messages_collection_async():
    database = await get_db_async()
    if database is None:
        return None
    return database.messages


async def get_notifications_collection_async() -> AsyncIOMotorCollection | None:
    database = await get_db_async()
    if database is None:
        return None
    return database.notifications


async def get_trust_events_collection_async() -> AsyncIOMotorCollection | None:
    database = await get_db_async()
    if database is None:
        return None
    return database.trust_events


async def get_deliveries_collection_async():
    database = await get_db_async()
    if database is None:
        return None
    return database.deliveries


async def get_need_requests_collection_async():
    database = await get_db_async()
    if database is None:
        return None
    return database.need_requests


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


def get_reviews_collection():
    """Return the MongoDB collection used for user reviews."""
    database = get_db()
    if database is None:
        return None
    return database.reviews


def get_notifications_collection():
    """Return the MongoDB collection used for user notifications."""
    database = get_db()
    if database is None:
        return None
    return database.notifications


def get_deliveries_collection():
    """Return the MongoDB collection used for deliveries."""
    database = get_db()
    if database is None:
        return None
    return database.deliveries


def get_last_connection_error() -> str | None:
    """Return the last MongoDB connection error for debugging."""
    return _last_connection_error
