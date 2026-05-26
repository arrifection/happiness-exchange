import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv

load_dotenv()

from app.db.mongodb import close_mongo_connection, connect_to_mongo, get_db_async


async def main():
    needle = (sys.argv[1] if len(sys.argv) > 1 else "arrif").lower()
    await connect_to_mongo()
    db = await get_db_async()
    users = await db.users.find({}).to_list(500)
    matches = [
        u for u in users
        if needle in (u.get("email") or "").lower()
        or needle in (u.get("name") or "").lower()
        or needle in (u.get("name_normalized") or "").lower()
    ]
    if not matches:
        print(f"No users matching '{needle}'")
    for u in matches:
        print(
            u.get("email"),
            "|",
            u.get("name"),
            "| verified:",
            u.get("is_verified"),
            "| id:",
            u["_id"],
        )
    await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(main())
