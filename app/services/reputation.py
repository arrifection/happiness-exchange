from pymongo import DESCENDING

from app.services.auth import parse_object_id

NEW_MEMBER = "New Member"
KIND_SHARER = "Kind Sharer"
TRUSTED_MEMBER = "Trusted Member"
COMMUNITY_HERO = "Community Hero"


def determine_badge(*, completed_shared_count: int, completed_exchange_count: int) -> str:
    """Return the member badge for a user based on completed exchanges."""
    if completed_exchange_count >= 10:
        return COMMUNITY_HERO
    if completed_exchange_count >= 5:
        return TRUSTED_MEMBER
    if completed_shared_count >= 1:
        return KIND_SHARER
    return NEW_MEMBER


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

    return {
        "user_id": user_id,
        "current_badge": determine_badge(
            completed_shared_count=completed_shared_count,
            completed_exchange_count=completed_exchange_count,
        ),
        "completed_shared_count": completed_shared_count,
        "completed_received_count": completed_received_count,
        "completed_exchange_count": completed_exchange_count,
        "average_rating": average_rating,
        "review_count": review_count,
        "submitted_review_item_ids": sorted(
            {review["item_id"] for review in submitted_reviews if review.get("item_id")}
        ),
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
    for user_id in dict.fromkeys(user_ids):
        if not user_id:
            continue
        lookup[user_id] = await calculate_reputation_summary(
            user_id,
            items_collection=items_collection,
            requests_collection=requests_collection,
            reviews_collection=reviews_collection,
        )
    return lookup
