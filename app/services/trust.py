from datetime import datetime, timezone
from pymongo.errors import DuplicateKeyError

from app.db.mongodb import get_users_collection_async, get_trust_events_collection_async
from app.services.auth import parse_object_id

async def record_trust_event(
    user_id: str,
    event_type: str,
    points_change: int,
    reference_id: str | None = None,
    description: str | None = None,
) -> bool:
    """
    Record a trust event and update the user's trust score.
    Returns True if the event was recorded, False if it was a duplicate.
    """
    users_collection = await get_users_collection_async()
    trust_events_collection = await get_trust_events_collection_async()
    
    if users_collection is None or trust_events_collection is None:
        return False

    now = datetime.now(timezone.utc)
    
    event_doc = {
        "user_id": user_id,
        "event_type": event_type,
        "points_change": points_change,
        "reference_id": reference_id,
        "description": description,
        "created_at": now,
    }

    try:
        await trust_events_collection.insert_one(event_doc)
    except DuplicateKeyError:
        # Event for this reference_id already exists, prevent duplicate scoring
        return False

    # Update user's total trust_score
    user_oid = parse_object_id(user_id)
    if user_oid:
        await users_collection.update_one(
            {"_id": user_oid},
            {"$inc": {"trust_score": points_change}}
        )
    return True

async def award_completed_donation(user_id: str, item_id: str) -> bool:
    """Award +10 points for a successfully completed donation."""
    return await record_trust_event(
        user_id=user_id,
        event_type="completed_donation",
        points_change=10,
        reference_id=item_id,
        description="Successfully completed a donation exchange."
    )

async def award_positive_review(user_id: str, review_id: str, rating: int) -> bool:
    """Award +5 for positive review, +15 for 5-star review."""
    if rating < 4:
        return False
        
    points = 15 if rating == 5 else 5
    desc = "Received a 5-star review." if rating == 5 else "Received a positive review."
    
    return await record_trust_event(
        user_id=user_id,
        event_type="positive_review",
        points_change=points,
        reference_id=review_id,
        description=desc
    )

async def admin_deduct_points(
    user_id: str,
    admin_id: str,
    amount: int,
    reason: str,
    reference_id: str | None = None
) -> bool:
    """Admin manually deducts points (e.g., -15 abusive chat, -30 scam behavior)."""
    # ensure amount is negative
    points_change = -abs(amount)
    
    # We append a unique suffix to reference_id if provided to allow multiple admin actions
    # or just use None since admin actions don't need a strict unique reference constraint.
    # Actually we can just use the reason as description.
    
    return await record_trust_event(
        user_id=user_id,
        event_type="admin_penalty",
        points_change=points_change,
        reference_id=reference_id, # Can be None to allow multiple
        description=reason
    )
