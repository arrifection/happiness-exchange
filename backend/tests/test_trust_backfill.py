"""Trust backfill migration tests."""

from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest import IsolatedAsyncioTestCase

from bson import ObjectId
from pymongo.errors import DuplicateKeyError

from app.services.trust_backfill import (
    COMPLETED_DONATION_POINTS,
    COMPLETED_DONATION_TYPE,
    apply_completed_donation_backfill,
    plan_completed_donation_backfill,
)


class FakeCollection:
    def __init__(self, documents=None):
        self.documents = list(documents or [])

    def find(self, query):
        class Cursor:
            def __init__(self, docs):
                self.docs = docs

            async def to_list(self, length=None):
                return list(self.docs)

        if query.get("status") == "completed":
            return Cursor([doc for doc in self.documents if doc.get("status") == "completed"])
        return Cursor([])

    async def find_one(self, query):
        for document in self.documents:
            if all(document.get(key) == value for key, value in query.items()):
                return document
        return None

    async def insert_one(self, document):
        for existing in self.documents:
            if (
                existing.get("user_id") == document.get("user_id")
                and existing.get("event_type") == document.get("event_type")
                and existing.get("reference_id") == document.get("reference_id")
            ):
                raise DuplicateKeyError("duplicate trust event")
        stored = {**document, "_id": ObjectId()}
        self.documents.append(stored)
        return SimpleNamespace(inserted_id=stored["_id"])

    def aggregate(self, pipeline):
        class Cursor:
            def __init__(self, docs, pipeline):
                self.docs = docs
                self.pipeline = pipeline

            async def to_list(self, length=1):
                match = self.pipeline[0]["$match"]
                user_id = match["user_id"]
                total = sum(
                    int(doc.get("points_change") or 0)
                    for doc in self.docs
                    if doc.get("user_id") == user_id
                )
                return [{"total": total}] if total else []

        return Cursor(self.documents, pipeline)


class FakeUsersCollection:
    def __init__(self):
        self.documents = []

    async def find_one(self, query):
        user_id = query.get("_id")
        if user_id is None:
            return None
        for document in self.documents:
            if document["_id"] == user_id:
                return document
        return None

    async def update_one(self, query, update):
        for document in self.documents:
            if document.get("_id") == query.get("_id") or str(document.get("_id")) == query.get("_id"):
                document.update(update.get("$set", {}))
                return SimpleNamespace(modified_count=1)
        return SimpleNamespace(modified_count=0)


class TrustBackfillTests(IsolatedAsyncioTestCase):
    async def test_plan_finds_missing_trust_events_only(self):
        owner_id = str(ObjectId())
        item_with_event = ObjectId()
        item_missing = ObjectId()
        now = datetime.now(timezone.utc)

        db = {
            "items": FakeCollection(
                [
                    {
                        "_id": item_with_event,
                        "owner_id": owner_id,
                        "status": "completed",
                        "title": "Already credited",
                        "created_at": now,
                    },
                    {
                        "_id": item_missing,
                        "owner_id": owner_id,
                        "status": "completed",
                        "title": "Needs backfill",
                        "created_at": now,
                    },
                ]
            ),
            "trust_events": FakeCollection(
                [
                    {
                        "_id": ObjectId(),
                        "user_id": owner_id,
                        "event_type": COMPLETED_DONATION_TYPE,
                        "reference_id": str(item_with_event),
                        "points_change": COMPLETED_DONATION_POINTS,
                    }
                ]
            ),
        }

        report = await plan_completed_donation_backfill(db)
        self.assertEqual(report.completed_exchanges_scanned, 2)
        self.assertEqual(report.missing_trust_events, 1)
        self.assertEqual(report.planned_events[0]["reference_id"], str(item_missing))

    async def test_apply_backfill_is_idempotent(self):
        owner_id = str(ObjectId())
        item_id = ObjectId()
        now = datetime.now(timezone.utc)

        db = {
            "items": FakeCollection(
                [
                    {
                        "_id": item_id,
                        "owner_id": owner_id,
                        "status": "completed",
                        "title": "Lamp",
                        "created_at": now,
                    }
                ]
            ),
            "trust_events": FakeCollection([]),
            "users": FakeUsersCollection(),
        }
        db["users"].documents.append({"_id": ObjectId(owner_id), "trust_score": 0})

        plan = await plan_completed_donation_backfill(db)
        first = await apply_completed_donation_backfill(db, plan)
        self.assertEqual(first.events_inserted, 1)

        second_plan = await plan_completed_donation_backfill(db)
        self.assertEqual(second_plan.missing_trust_events, 0)
        second = await apply_completed_donation_backfill(db, second_plan)
        self.assertEqual(second.events_inserted, 0)
