from types import SimpleNamespace
from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock, patch

from bson import ObjectId

from app.services.reputation import build_public_reputation_lookup, calculate_reputation_summary


def match_query(document, query):
    for key, expected in query.items():
        actual = document.get(key)
        if isinstance(expected, dict):
            if "$in" in expected:
                if actual not in expected["$in"]:
                    return False
                continue
            if "$ne" in expected and actual == expected["$ne"]:
                return False
            continue
        if actual != expected:
            return False
    return True


class FakeCursor:
    def __init__(self, documents):
        self.documents = list(documents)

    def sort(self, key, direction):
        reverse = direction == -1
        self.documents.sort(key=lambda document: document.get(key), reverse=reverse)
        return self

    def limit(self, count):
        self.documents = self.documents[:count]
        return self

    async def to_list(self, length=100):
        return self.documents[:length]


class FakeCollection:
    def __init__(self, documents=None):
        self.documents = list(documents or [])

    async def find_one(self, query, projection=None):
        for document in self.documents:
            if match_query(document, query):
                return document
        return None

    def find(self, query, projection=None):
        matched = [document for document in self.documents if match_query(document, query)]
        return FakeCursor(matched)

    async def count_documents(self, query):
        return len([document for document in self.documents if match_query(document, query)])

    def aggregate(self, pipeline):
        documents = list(self.documents)
        for stage in pipeline:
            if "$match" in stage:
                documents = [
                    document for document in documents if match_query(document, stage["$match"])
                ]
            elif "$group" in stage:
                grouped = {}
                for document in documents:
                    group_id = document.get(stage["$group"]["_id"].lstrip("$"))
                    bucket = grouped.setdefault(group_id, {"_id": group_id, "review_count": 0, "ratings": []})
                    bucket["review_count"] += 1
                    bucket["ratings"].append(document["rating"])
                documents = []
                for bucket in grouped.values():
                    count = bucket["review_count"]
                    average = sum(bucket["ratings"]) / count if count else 0.0
                    documents.append(
                        {
                            "_id": bucket["_id"],
                            "review_count": count,
                            "average_rating": average,
                        }
                    )
        return FakeCursor(documents)


class ReputationBatchTests(IsolatedAsyncioTestCase):
    async def test_build_public_reputation_lookup_batches_queries(self):
        owner_a = str(ObjectId())
        owner_b = str(ObjectId())
        users = FakeCollection(
            [
                {"_id": ObjectId(owner_a), "trust_score": 120},
                {"_id": ObjectId(owner_b), "trust_score": 5},
            ]
        )
        reviews = FakeCollection(
            [
                {"reviewed_user_id": owner_a, "rating": 5},
                {"reviewed_user_id": owner_a, "rating": 4},
                {"reviewed_user_id": owner_b, "rating": 3},
            ]
        )

        lookup = await build_public_reputation_lookup(
            [owner_a, owner_b, owner_a],
            users_collection=users,
            reviews_collection=reviews,
        )

        self.assertEqual(lookup[owner_a]["level"], "Community Helper")
        self.assertEqual(lookup[owner_a]["review_count"], 2)
        self.assertEqual(lookup[owner_a]["average_rating"], 4.5)
        self.assertEqual(lookup[owner_b]["level"], "New Member")
        self.assertEqual(lookup[owner_b]["review_count"], 1)

    async def test_calculate_reputation_summary_avoids_per_request_item_lookup(self):
        user_id = str(ObjectId())
        item_completed = ObjectId()
        item_pending = ObjectId()
        items = FakeCollection(
            [
                {"_id": item_completed, "owner_id": user_id, "status": "completed"},
                {"_id": item_pending, "owner_id": str(ObjectId()), "status": "available"},
            ]
        )
        requests = FakeCollection(
            [
                {"requester_id": user_id, "status": "approved", "item_id": str(item_completed)},
                {"requester_id": user_id, "status": "approved", "item_id": str(item_pending)},
            ]
        )
        reviews = FakeCollection([])

        original_find_one = items.find_one
        find_one_calls = {"count": 0}

        async def counting_find_one(query, projection=None):
            find_one_calls["count"] += 1
            return await original_find_one(query, projection)

        items.find_one = counting_find_one

        async def empty_collection():
            return FakeCollection([])

        with patch(
            "app.services.reputation.get_users_collection_async",
            new=AsyncMock(return_value=FakeCollection([{"_id": ObjectId(user_id), "trust_score": 0}])),
        ), patch(
            "app.services.reputation.get_trust_events_collection_async",
            new=empty_collection,
        ):
            summary = await calculate_reputation_summary(
                user_id,
                items_collection=items,
                requests_collection=requests,
                reviews_collection=reviews,
            )

        self.assertEqual(summary["completed_shared_count"], 1)
        self.assertEqual(summary["completed_received_count"], 1)
        self.assertEqual(find_one_calls["count"], 0)
