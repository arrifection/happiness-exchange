"""Account lifecycle helpers."""

from app.db.mongodb import get_db_async
from app.services.auth import parse_object_id


async def delete_user_account(user_id: str) -> bool:
    """Delete a user and their linked data. Returns True if the user was removed."""
    db = await get_db_async()
    if db is None:
        return False

    user_oid = parse_object_id(user_id)
    if user_oid is None:
        return False

    user = await db.users.find_one({"_id": user_oid})
    if user is None:
        return False

    uid = str(user_oid)

    await db.items.delete_many({"owner_id": {"$in": [uid, user_oid]}})
    await db.requests.delete_many({"$or": [{"requester_id": uid}, {"owner_id": uid}]})
    await db.reviews.delete_many({"$or": [{"reviewer_id": uid}, {"reviewed_user_id": uid}]})
    await db.notifications.delete_many({"user_id": uid})
    await db.trust_events.delete_many({"user_id": uid})
    await db.deliveries.delete_many({"$or": [{"giver_id": uid}, {"receiver_id": uid}]})

    conversations = await db.conversations.find(
        {"$or": [{"giver_id": uid}, {"receiver_id": uid}]}
    ).to_list(length=500)
    if conversations:
        conversation_ids = [str(c["_id"]) for c in conversations]
        await db.messages.delete_many({"conversation_id": {"$in": conversation_ids}})
        await db.conversations.delete_many({"_id": {"$in": [c["_id"] for c in conversations]}})

    result = await db.users.delete_one({"_id": user_oid})
    return result.deleted_count == 1
