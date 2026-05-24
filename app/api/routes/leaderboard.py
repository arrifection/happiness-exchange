from fastapi import APIRouter, HTTPException
from pymongo import DESCENDING

from app.db.mongodb import get_users_collection_async
from app.services.auth import serialize_user

router = APIRouter()

@router.get("")
async def get_leaderboard():
    """Get the top 50 users by trust_score."""
    users_collection = await get_users_collection_async()
    if users_collection is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")

    cursor = users_collection.find(
        # Optional: we could filter out banned users or admin users
        {"is_banned": {"$ne": True}}
    ).sort("trust_score", DESCENDING).limit(50)
    
    users = await cursor.to_list(length=50)
    
    leaderboard = []
    for u in users:
        serialized = serialize_user(u)
        # Add the trust_score explicitly since it might not be in the default serialize_user if it's a new field
        # serialize_user might drop unknown fields or we just ensure it's there
        serialized["trust_score"] = u.get("trust_score", 0)
        from app.services.reputation import determine_level
        serialized["level"] = determine_level(serialized["trust_score"])
        leaderboard.append(serialized)

    return {"leaderboard": leaderboard}
