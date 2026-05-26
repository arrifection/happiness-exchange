import logging

from pymongo import DESCENDING

from app.services.auth import parse_object_id

from app.db.mongodb import get_users_collection_async, get_trust_events_collection_async

logger = logging.getLogger(__name__)

# Dynamic Levels
LEVEL_NEW = "New Member"
LEVEL_TRUSTED = "Trusted Giver"
LEVEL_HELPER = "Community Helper"
LEVEL_VERIFIED = "Verified Donor"

def determine_level(trust_score: int) -> str:
    if trust_score >= 250: return LEVEL_VERIFIED
    if trust_score >= 100: return LEVEL_HELPER
    if trust_score >= 20: return LEVEL_TRUSTED
    return LEVEL_NEW

def get_next_level_points(trust_score: int) -> int | None:
    if trust_score >= 250: return None
    if trust_score >= 100: return 250
    if trust_score >= 20: return 100
    return 20

def determine_badges(completed_shared_count: int) -> list[str]:
    badges = []
    if completed_shared_count >= 1:
        badges.append("First Donation")
    if completed_shared_count >= 10:
        badges.append("10 Donations")
    if completed_shared_count >= 50:
        badges.append("50 Donations")
    return badges


async def calculate_reputation_summary(
    user_id: str,
    *,
    items_collection,
    requests_collection,
    reviews_collection,
) -> dict:
    """Build the lightweight MVP reputation summary for a user."""
    completed_shared_items = await items_collection.find(
        {"owner_id": user_id, "status": "completed"},
    ).to_list(length=500)
    completed_shared_count = len(completed_shared_items)

    approved_requests = await requests_collection.find(
        {"requester_id": user_id, "status": "approved"},
    ).to_list(length=500)
    completed_received_count = 0
    for request in approved_requests:
        item_object_id = parse_object_id(request["item_id"])
        if item_object_id is None:
            continue

        item = await items_collection.find_one({"_id": item_object_id})
        if item is not None and item.get("status") == "completed":
            completed_received_count += 1

    completed_exchange_count = completed_shared_count + completed_received_count

    received_reviews = await reviews_collection.find(
        {"reviewed_user_id": user_id},
    ).sort("created_at", DESCENDING).to_list(length=200)
    review_count = len(received_reviews)
    average_rating = 0.0
    if review_count > 0:
        average_rating = round(
            sum(review["rating"] for review in received_reviews) / review_count,
            1,
        )

    submitted_reviews = await reviews_collection.find(
        {"reviewer_id": user_id},
    ).to_list(length=200)

    # Fetch User Trust Score
    users_collection = await get_users_collection_async()
    user_oid = parse_object_id(user_id)
    user_doc = await users_collection.find_one({"_id": user_oid}) if user_oid and users_collection is not None else None
    trust_score = int(user_doc.get("trust_score") or 0) if user_doc else 0

    # Fetch Trust Events
    trust_events_collection = await get_trust_events_collection_async()
    trust_events = []
    if trust_events_collection is not None:
        events_cursor = trust_events_collection.find(
            {"user_id": user_id}
        ).sort("created_at", DESCENDING).limit(10)
        
        for e in await events_cursor.to_list(length=10):
            trust_events.append({
                "event_type": e["event_type"],
                "points_change": e["points_change"],
                "description": e.get("description", ""),
                "created_at": e["created_at"]
            })

    return {
        "user_id": user_id,
        "trust_score": trust_score,
        "level": determine_level(trust_score),
        "next_level_points": get_next_level_points(trust_score),
        "badges": determine_badges(completed_shared_count),
        "completed_shared_count": completed_shared_count,
        "completed_received_count": completed_received_count,
        "completed_exchange_count": completed_exchange_count,
        "average_rating": average_rating,
        "review_count": review_count,
        "submitted_review_item_ids": sorted(
            {review["item_id"] for review in submitted_reviews if review.get("item_id")}
        ),
        "trust_events": trust_events,
    }


async def build_reputation_lookup(
    user_ids: list[str],
    *,
    items_collection,
    requests_collection,
    reviews_collection,
) -> dict[str, dict]:
    """Build a simple reputation map for the given user ids."""
    lookup = {}
    for user_id in dict.fromkeys(str(uid) for uid in user_ids if uid):
        try:
            lookup[user_id] = await calculate_reputation_summary(
                user_id,
                items_collection=items_collection,
                requests_collection=requests_collection,
                reviews_collection=reviews_collection,
            )
        except Exception:
            logger.exception("Failed to calculate reputation for user %s", user_id)
    return lookup
