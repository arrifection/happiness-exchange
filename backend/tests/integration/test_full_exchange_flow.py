"""End-to-end exchange flow against a real MongoDB test database."""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone

import pytest
from bson import ObjectId
from fastapi.testclient import TestClient
from pymongo import MongoClient

# Configure test database before importing the app.
_test_uri = os.environ.get("TEST_MONGODB_URL") or os.environ.get("TEST_MONGODB_URI")
if _test_uri:
    os.environ["MONGODB_URI"] = _test_uri
else:
    _base = os.environ.get("MONGODB_URL") or os.environ.get("MONGODB_URI") or "mongodb://localhost:27017"
    os.environ["MONGODB_URI"] = _base
os.environ["DB_NAME"] = os.environ.get("TEST_DB_NAME", "happiness_exchange_test")

from api.index import app  # noqa: E402
from app.core.roles import UserRole  # noqa: E402
from app.services.auth import create_access_token, hash_password  # noqa: E402
from app.services.conversations import CHAT_ADMIN_LISTER, CHAT_ADMIN_RECEIVER  # noqa: E402


pytestmark = pytest.mark.integration


@pytest.fixture(scope="module")
def mongo_db():
    client = MongoClient(os.environ["MONGODB_URI"])
    db = client[os.environ["DB_NAME"]]
    try:
        client.admin.command("ping")
    except Exception as exc:
        pytest.skip(f"MongoDB test database is not available: {exc}")
    yield db
    client.close()


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def exchange_fixture(mongo_db):
    stamp = uuid.uuid4().hex[:8]
    now = datetime.now(timezone.utc)
    email_pattern = f"-{stamp}@example.com"

    def insert_user(*, email_suffix: str, name: str, role: str = UserRole.USER.value):
        doc = {
            "_id": ObjectId(),
            "name": name,
            "name_normalized": name.lower(),
            "email": f"{email_suffix}-{stamp}@example.com",
            "hashed_password": hash_password("IntegrationTest123!"),
            "role": role,
            "account_type": "member",
            "is_verified": True,
            "is_banned": False,
            "whatsapp_number": "+923001234567",
            "trust_score": 0,
            "created_at": now,
            "updated_at": now,
        }
        mongo_db.users.insert_one(doc)
        user = {
            "id": str(doc["_id"]),
            "name": doc["name"],
            "email": doc["email"],
            "role": doc["role"],
            "is_verified": True,
            "whatsapp_number": doc["whatsapp_number"],
        }
        token = create_access_token(user["id"], user["email"], user["role"])
        return user, token

    insert_user(email_suffix="admin", name="Integration Admin", role=UserRole.SUPER_ADMIN.value)
    lister_user, lister_token = insert_user(email_suffix="lister", name="Integration Lister")
    requester_user, requester_token = insert_user(email_suffix="requester", name="Integration Requester")

    yield {
        "email_pattern": email_pattern,
        "lister_user": lister_user,
        "requester_user": requester_user,
        "lister_token": lister_token,
        "requester_token": requester_token,
    }

    user_docs = list(mongo_db.users.find({"email": {"$regex": email_pattern}}))
    user_ids = [str(doc["_id"]) for doc in user_docs]
    if user_ids:
        mongo_db.trust_events.delete_many({"user_id": {"$in": user_ids}})
        request_docs = list(mongo_db.requests.find({"requester_id": {"$in": user_ids}}))
        request_ids = [str(doc["_id"]) for doc in request_docs]
        if request_ids:
            mongo_db.conversations.delete_many({"request_id": {"$in": request_ids}})
        item_docs = list(mongo_db.items.find({"owner_id": {"$in": user_ids}}))
        item_ids = [str(doc["_id"]) for doc in item_docs]
        if item_ids:
            mongo_db.requests.delete_many({"item_id": {"$in": item_ids}})
            mongo_db.conversations.delete_many({"item_id": {"$in": item_ids}})
            mongo_db.trust_events.delete_many({"reference_id": {"$in": item_ids}})
            mongo_db.items.delete_many({"_id": {"$in": [doc["_id"] for doc in item_docs]}})
    mongo_db.users.delete_many({"email": {"$regex": email_pattern}})


def test_full_exchange_happy_path(client, exchange_fixture, mongo_db):
    lister = exchange_fixture["lister_user"]
    lister_headers = {"Authorization": f"Bearer {exchange_fixture['lister_token']}"}
    requester_headers = {"Authorization": f"Bearer {exchange_fixture['requester_token']}"}

    item_payload = {
        "title": "Integration test lamp",
        "description": "A lamp listed during the integration exchange flow test.",
        "category": "Home",
        "condition": "Good",
        "location": "Karachi",
        "country": "Pakistan",
        "city": "Karachi",
    }
    create_item = client.post("/api/items", json=item_payload, headers=lister_headers)
    assert create_item.status_code == 201, create_item.text
    item_id = create_item.json()["id"]

    request_payload = {
        "reason": "I need this lamp for my study desk during the integration test run today.",
        "requester_city": "Karachi",
    }
    create_request = client.post(f"/api/requests/{item_id}", json=request_payload, headers=requester_headers)
    assert create_request.status_code == 201, create_request.text
    request_id = create_request.json()["id"]

    approve = client.patch(f"/api/requests/{request_id}/approve", headers=lister_headers)
    assert approve.status_code == 200, approve.text
    assert approve.json()["status"] == "approved"

    item_doc = mongo_db.items.find_one({"_id": ObjectId(item_id)})
    assert item_doc["status"] == "reserved"

    conversations = list(mongo_db.conversations.find({"request_id": request_id}))
    chat_types = sorted(conv["chat_type"] for conv in conversations)
    assert chat_types == sorted([CHAT_ADMIN_RECEIVER, CHAT_ADMIN_LISTER])

    duplicate_approve = client.patch(f"/api/requests/{request_id}/approve", headers=lister_headers)
    assert duplicate_approve.status_code == 409

    lister_before = mongo_db.users.find_one({"_id": ObjectId(lister["id"])})
    before_score = int(lister_before.get("trust_score") or 0)

    complete = client.patch(f"/api/items/{item_id}/complete", headers=lister_headers)
    assert complete.status_code == 200, complete.text
    assert complete.json()["status"] == "completed"

    trust_event = mongo_db.trust_events.find_one(
        {
            "user_id": lister["id"],
            "event_type": "completed_donation",
            "reference_id": item_id,
        }
    )
    assert trust_event is not None
    assert trust_event["points_change"] == 10

    lister_after = mongo_db.users.find_one({"_id": ObjectId(lister["id"])})
    assert int(lister_after.get("trust_score") or 0) == before_score + 10
