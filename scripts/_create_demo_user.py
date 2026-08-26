import bcrypt
from datetime import datetime, timezone
from pymongo import MongoClient

c = MongoClient("mongodb://localhost:27017", serverSelectionTimeoutMS=3000)
db = c["happiness_exchange"]
email = "demo@example.com"
existing = db.users.find_one({"email": email})
pwd = bcrypt.hashpw(b"Demo1234!", bcrypt.gensalt()).decode()
now = datetime.now(timezone.utc)
doc = {
    "name": "Demo User",
    "name_normalized": "demo user",
    "email": email,
    "whatsapp_number": "+923001112233",
    "hashed_password": pwd,
    "role": "user",
    "account_type": "member",
    "is_verified": True,
    "is_banned": False,
    "updated_at": now,
}
if existing:
    db.users.update_one({"_id": existing["_id"]}, {"$set": doc})
    print("updated", email)
else:
    doc["created_at"] = now
    db.users.insert_one(doc)
    print("created", email)
print("password: Demo1234!")
