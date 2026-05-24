import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    uri = "mongodb+srv://arrrifection_db_user:pro66dd44@happiness-exchange.6o1iuqw.mongodb.net/?retryWrites=true&w=majority"
    client = AsyncIOMotorClient(uri)
    
    # List databases
    db_names = await client.list_database_names()
    print("Databases:", db_names)
    
    for db_name in db_names:
        if db_name in ["admin", "local"]:
            continue
        db = client[db_name]
        items = db["items"]
        docs = await items.find({"title": {"$regex": "heart", "$options": "i"}}).to_list(length=10)
        for d in docs:
            print(f"Found in DB {db_name}: {d}")
            # Delete it
            await items.delete_one({"_id": d["_id"]})
            print(f"DELETED FROM {db_name}: {d['_id']}")

if __name__ == "__main__":
    asyncio.run(main())
