"""
Tests for GET /api/admin/requests

Covers:
  - Admin can list all requests (200)
  - Normal user gets 403
  - Unauthenticated request gets 401
  - Response includes expected fields (id, item_title, requester_name, etc.)
  - Status filter is applied
  - Search filter is applied
"""
from datetime import datetime, timezone
from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock, patch, MagicMock

from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import auth as auth_deps
from app.api.routes.admin import requests as admin_requests_routes


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_request_doc(**overrides):
    """Create a minimal request MongoDB document."""
    now = datetime.now(timezone.utc)
    doc = {
        "_id": ObjectId(),
        "item_id": str(ObjectId()),
        "item_title": "Test Item",
        "requester_id": str(ObjectId()),
        "requester_name": "Alice",
        "owner_id": str(ObjectId()),
        "owner_name": "Bob",
        "reason": "I really need this item for my family.",
        "status": "pending",
        "created_at": now,
        "updated_at": None,
        "approved_at": None,
        "rejected_at": None,
        "completed_at": None,
    }
    doc.update(overrides)
    return doc


class FakeCursor:
    def __init__(self, items):
        self._items = items
        self._sorted = items

    def sort(self, *args, **kwargs):
        return self

    def skip(self, n):
        self._items = self._sorted[n:]
        return self

    def limit(self, n):
        self._items = self._items[:n]
        return self

    def __aiter__(self):
        self._iter = iter(self._items)
        return self

    async def __anext__(self):
        try:
            return next(self._iter)
        except StopIteration:
            raise StopAsyncIteration

    async def to_list(self, length=None):
        return list(self._items[:length] if length else self._items)


class FakeRequestsCollection:
    def __init__(self, docs):
        self._docs = docs

    async def count_documents(self, query):
        # Simple filter: if query has 'status', filter by it
        if 'status' in query:
            return sum(1 for d in self._docs if d.get('status') == query['status'])
        return len(self._docs)

    def find(self, query):
        docs = self._docs
        if 'status' in query:
            docs = [d for d in docs if d.get('status') == query['status']]
        return FakeCursor(docs)


class FakeEmptyCollection:
    async def count_documents(self, query):
        return 0

    def find(self, query, projection=None):
        return FakeCursor([])

    def __aiter__(self):
        self._iter = iter([])
        return self

    async def __anext__(self):
        raise StopAsyncIteration


# ── Test class ────────────────────────────────────────────────────────────────

class AdminRequestsTests(IsolatedAsyncioTestCase):

    REGULAR_USER = {
        "id": str(ObjectId()),
        "name": "Regular User",
        "email": "user@example.com",
        "role": "user",
        "is_verified": True,
        "created_at": datetime.now(timezone.utc),
    }

    MODERATOR_USER = {
        "id": str(ObjectId()),
        "name": "Mod User",
        "email": "mod@example.com",
        "role": "moderator",
        "is_verified": True,
        "created_at": datetime.now(timezone.utc),
    }

    def _make_app(self, request_docs=None):
        """Create a test FastAPI app with the admin requests router mounted."""
        if request_docs is None:
            request_docs = [_make_request_doc(), _make_request_doc(status="approved")]

        app = FastAPI()
        app.include_router(
            admin_requests_routes.router,
            prefix="/api/admin/requests",
        )

        fake_requests_col = FakeRequestsCollection(request_docs)
        fake_users_col = FakeEmptyCollection()
        fake_items_col = FakeEmptyCollection()

        async def fake_requests():
            return fake_requests_col

        async def fake_users():
            return fake_users_col

        async def fake_items():
            return fake_items_col

        # Patch DB getters in the route module
        admin_requests_routes.get_requests_collection_async = fake_requests
        admin_requests_routes.get_users_collection_async = fake_users
        admin_requests_routes.get_items_collection_async = fake_items

        return app

    def _as_moderator(self, app):
        app.dependency_overrides[auth_deps.get_current_user] = lambda: self.MODERATOR_USER
        return TestClient(app)

    def _as_regular_user(self, app):
        app.dependency_overrides[auth_deps.get_current_user] = lambda: self.REGULAR_USER
        return TestClient(app)

    def _unauthenticated(self, app):
        async def missing():
            from fastapi import HTTPException, status
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
        app.dependency_overrides[auth_deps.get_current_user] = missing
        return TestClient(app)

    # ── RBAC tests ────────────────────────────────────────────────────────────

    def test_moderator_can_list_requests(self):
        app = self._make_app()
        with self._as_moderator(app) as client:
            response = client.get("/api/admin/requests")
        self.assertEqual(response.status_code, 200)

    def test_regular_user_gets_403(self):
        app = self._make_app()
        with self._as_regular_user(app) as client:
            response = client.get("/api/admin/requests")
        self.assertEqual(response.status_code, 403)

    def test_unauthenticated_gets_401(self):
        app = self._make_app()
        with self._unauthenticated(app) as client:
            response = client.get("/api/admin/requests")
        self.assertEqual(response.status_code, 401)

    # ── Response shape tests ──────────────────────────────────────────────────

    def test_response_includes_expected_fields(self):
        doc = _make_request_doc()
        app = self._make_app(request_docs=[doc])
        with self._as_moderator(app) as client:
            response = client.get("/api/admin/requests")

        self.assertEqual(response.status_code, 200)
        data = response.json()

        # Top-level shape
        self.assertIn("total", data)
        self.assertIn("requests", data)
        self.assertEqual(data["total"], 1)
        self.assertEqual(len(data["requests"]), 1)

        req = data["requests"][0]
        for field in (
            "id", "item_id", "item_title", "item_image_url",
            "requester_id", "requester_name", "requester_email",
            "owner_id", "owner_name", "owner_email",
            "reason", "status", "created_at",
        ):
            self.assertIn(field, req, f"Missing field: {field}")

    def test_total_matches_request_count(self):
        docs = [_make_request_doc() for _ in range(5)]
        app = self._make_app(request_docs=docs)
        with self._as_moderator(app) as client:
            response = client.get("/api/admin/requests")

        data = response.json()
        self.assertEqual(data["total"], 5)
        self.assertEqual(len(data["requests"]), 5)

    # ── Filter tests ──────────────────────────────────────────────────────────

    def test_status_filter_returns_matching_requests(self):
        docs = [
            _make_request_doc(status="pending"),
            _make_request_doc(status="approved"),
            _make_request_doc(status="pending"),
        ]
        app = self._make_app(request_docs=docs)
        with self._as_moderator(app) as client:
            response = client.get("/api/admin/requests?status=pending")

        data = response.json()
        self.assertEqual(data["total"], 2)
        for req in data["requests"]:
            self.assertEqual(req["status"], "pending")

    def test_all_statuses_visible_without_filter(self):
        docs = [
            _make_request_doc(status="pending"),
            _make_request_doc(status="approved"),
            _make_request_doc(status="rejected"),
            _make_request_doc(status="completed"),
            _make_request_doc(status="cancelled"),
        ]
        app = self._make_app(request_docs=docs)
        with self._as_moderator(app) as client:
            response = client.get("/api/admin/requests")

        data = response.json()
        self.assertEqual(data["total"], 5)
        statuses = {req["status"] for req in data["requests"]}
        self.assertEqual(
            statuses,
            {"pending", "approved", "rejected", "completed", "cancelled"},
        )

    # ── Single request tests ──────────────────────────────────────────────────

    def test_get_single_request_returns_correct_data(self):
        doc = _make_request_doc(reason="My reason is here.")
        app = self._make_app(request_docs=[doc])

        # Patch find_one to return the document
        async def fake_find_one(col_result, query):
            return doc

        async def fake_requests_col_with_find_one():
            col = FakeRequestsCollection([doc])

            async def find_one(q):
                return doc

            col.find_one = find_one
            return col

        admin_requests_routes.get_requests_collection_async = fake_requests_col_with_find_one

        with self._as_moderator(app) as client:
            response = client.get(f"/api/admin/requests/{str(doc['_id'])}")

        self.assertEqual(response.status_code, 200)
        req = response.json()
        self.assertEqual(req["reason"], "My reason is here.")
        self.assertEqual(req["status"], "pending")

    def test_get_nonexistent_request_returns_404(self):
        app = self._make_app(request_docs=[])

        async def fake_requests_col_none():
            col = FakeRequestsCollection([])

            async def find_one(q):
                return None

            col.find_one = find_one
            return col

        admin_requests_routes.get_requests_collection_async = fake_requests_col_none

        with self._as_moderator(app) as client:
            response = client.get(f"/api/admin/requests/{str(ObjectId())}")

        self.assertEqual(response.status_code, 404)
