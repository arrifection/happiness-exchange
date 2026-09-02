"""Issues #6, #7, and #8 — dismiss notifications, swap condition, password visibility."""

from __future__ import annotations

import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest import IsolatedAsyncioTestCase

import pytest
from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.api.deps import auth as auth_deps
from app.api.routes.notifications import router as notifications_router
from app.schemas.exchange import ExchangeOfferCreateRequest

REPO_ROOT = Path(__file__).resolve().parents[2]
ITEM_CONDITIONS = ["New", "Like New", "Good", "Gently Used", "Used"]


def match_query(document, query):
    for key, expected in query.items():
        actual = document.get(key)
        if isinstance(expected, dict):
            if "$in" in expected and actual not in expected["$in"]:
                return False
            continue
        if actual != expected:
            return False
    return True


class FakeCursor:
    def __init__(self, documents):
        self.documents = list(documents)

    def sort(self, key, direction=1):
        self.documents.sort(key=lambda document: str(document.get(key)), reverse=direction == -1)
        return self

    def limit(self, count):
        self.documents = self.documents[:count]
        return self

    async def to_list(self, length=100):
        return [dict(document) for document in self.documents[:length]]


class FakeCollection:
    def __init__(self, documents=None):
        self.documents = list(documents or [])

    def find(self, query):
        return FakeCursor([document for document in self.documents if match_query(document, query)])

    async def delete_one(self, query):
        for index, document in enumerate(self.documents):
            if match_query(document, query):
                del self.documents[index]
                return SimpleNamespace(deleted_count=1)
        return SimpleNamespace(deleted_count=0)

    async def update_one(self, query, update):
        for document in self.documents:
            if match_query(document, query):
                document.update(update.get("$set", {}))
                return SimpleNamespace(matched_count=1, modified_count=1)
        return SimpleNamespace(matched_count=0, modified_count=0)

    async def count_documents(self, query):
        return sum(1 for document in self.documents if match_query(document, query))


class NotificationDismissTests(IsolatedAsyncioTestCase):
    """Issue #6 — owner-only dismiss of a single notification."""

    def setUp(self):
        self.now = datetime.now(timezone.utc)
        self.owner_id = str(ObjectId())
        self.other_id = str(ObjectId())
        self.keep_id = ObjectId()
        self.dismiss_id = ObjectId()
        self.other_notification_id = ObjectId()

        self.owner = {
            "id": self.owner_id,
            "name": "Owner",
            "email": "owner@example.com",
            "is_verified": True,
        }
        self.other = {
            "id": self.other_id,
            "name": "Other",
            "email": "other@example.com",
            "is_verified": True,
        }

        self.notifications = FakeCollection([
            {
                "_id": self.dismiss_id,
                "user_id": self.owner_id,
                "title": "New Request Received",
                "message": "Someone requested your item.",
                "type": "request_received",
                "action_url": "/requests",
                "read": False,
                "created_at": self.now,
            },
            {
                "_id": self.keep_id,
                "user_id": self.owner_id,
                "title": "Swap offer",
                "message": "A swap was offered.",
                "type": "exchange_offer_received",
                "action_url": "/items/abc",
                "read": True,
                "created_at": self.now,
            },
            {
                "_id": self.other_notification_id,
                "user_id": self.other_id,
                "title": "Private to someone else",
                "message": "Should never be dismissed by the owner.",
                "type": "request_received",
                "action_url": "/requests",
                "read": False,
                "created_at": self.now,
            },
        ])

        async def get_notifications_collection_async():
            return self.notifications

        from app.api.routes import notifications as notifications_routes

        self._routes = notifications_routes
        self._original_getter = notifications_routes.get_notifications_collection_async
        notifications_routes.get_notifications_collection_async = get_notifications_collection_async

        self.app = FastAPI()
        self.app.include_router(notifications_router, prefix="/api/notifications")

    def tearDown(self):
        self._routes.get_notifications_collection_async = self._original_getter
        self.app.dependency_overrides.clear()

    def client_as(self, user):
        self.app.dependency_overrides[auth_deps.get_current_user] = lambda: user
        return TestClient(self.app)

    def anonymous_client(self):
        self.app.dependency_overrides.clear()
        return TestClient(self.app)

    def ids(self):
        return {str(document["_id"]) for document in self.notifications.documents}

    def test_owner_can_dismiss_own_notification(self):
        with self.client_as(self.owner) as client:
            response = client.delete(f"/api/notifications/{self.dismiss_id}")

        self.assertEqual(response.status_code, 204)
        self.assertNotIn(str(self.dismiss_id), self.ids())
        self.assertIn(str(self.keep_id), self.ids())
        self.assertIn(str(self.other_notification_id), self.ids())

    def test_dismissed_notification_no_longer_appears_in_the_feed(self):
        with self.client_as(self.owner) as client:
            before = client.get("/api/notifications")
            self.assertEqual(before.status_code, 200)
            before_ids = {entry["id"] for entry in before.json()}
            self.assertEqual(before_ids, {str(self.dismiss_id), str(self.keep_id)})

            self.assertEqual(client.delete(f"/api/notifications/{self.dismiss_id}").status_code, 204)

            after = client.get("/api/notifications")
            after_ids = {entry["id"] for entry in after.json()}

        self.assertEqual(after_ids, {str(self.keep_id)})
        self.assertEqual(len(after.json()), 1)
        self.assertTrue(after.json()[0]["read"])

    def test_unread_count_drops_when_an_unread_notification_is_dismissed(self):
        with self.client_as(self.owner) as client:
            before = client.get("/api/notifications/unread-count")
            self.assertEqual(before.json()["count"], 1)
            self.assertEqual(client.delete(f"/api/notifications/{self.dismiss_id}").status_code, 204)
            after = client.get("/api/notifications/unread-count")

        self.assertEqual(after.json()["count"], 0)

    def test_mark_as_read_still_works_and_does_not_delete(self):
        with self.client_as(self.owner) as client:
            response = client.patch(f"/api/notifications/{self.dismiss_id}/read")

        self.assertEqual(response.status_code, 200)
        remaining = {str(document["_id"]): document for document in self.notifications.documents}
        self.assertTrue(remaining[str(self.dismiss_id)]["read"])
        self.assertIn(str(self.dismiss_id), remaining)

    def test_other_user_cannot_dismiss_someone_elses_notification(self):
        with self.client_as(self.other) as client:
            response = client.delete(f"/api/notifications/{self.dismiss_id}")

        self.assertEqual(response.status_code, 404)
        self.assertIn(str(self.dismiss_id), self.ids())

    def test_unauthenticated_request_cannot_dismiss(self):
        with self.anonymous_client() as client:
            response = client.delete(f"/api/notifications/{self.dismiss_id}")

        self.assertEqual(response.status_code, 401)
        self.assertIn(str(self.dismiss_id), self.ids())

    def test_invalid_notification_id_is_rejected(self):
        with self.client_as(self.owner) as client:
            response = client.delete("/api/notifications/not-an-object-id")

        self.assertEqual(response.status_code, 400)


def run_node(script):
    result = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    return result.stdout


def test_bell_dismiss_does_not_navigate_and_row_click_still_does():
    bell = (REPO_ROOT / "src" / "components" / "NotificationBell.jsx").read_text(encoding="utf-8")
    context = (REPO_ROOT / "src" / "components" / "NotificationContext.jsx").read_text(encoding="utf-8")

    assert "Dismiss notification" in bell
    assert "handleDismiss" in bell
    assert "event.stopPropagation()" in bell
    assert "navigate(resolveNotificationTarget(notification))" in bell
    assert "await markAsRead(notification.id)" in bell
    assert "method: 'DELETE'" in context
    assert "/api/notifications/${id}" in context
    # Unread count is derived from remaining notifications after a successful dismiss.
    assert "prev.filter((notification) => notification.id !== id)" in context


def test_item_conditions_match_the_existing_listing_vocabulary():
    script = """
    import { ITEM_CONDITIONS } from './src/lib/categories.js';
    process.stdout.write(JSON.stringify(ITEM_CONDITIONS));
    """
    assert json.loads(run_node(script)) == ITEM_CONDITIONS


def test_propose_swap_condition_dropdown_uses_select_options():
    modal = (REPO_ROOT / "src" / "components" / "ProposeSwapModal.jsx").read_text(encoding="utf-8")
    select_field = (REPO_ROOT / "src" / "components" / "ui.jsx").read_text(encoding="utf-8")

    assert "options={CONDITIONS}" in modal
    assert 'placeholder="Select condition"' in modal
    assert "id=\"swap-custom-condition\"" in modal
    assert "payload.custom_item_condition = customCondition" in modal
    # The previous children-only usage is gone; SelectField only renders
    # options from the options prop (plus optional children as a fallback).
    assert "{CONDITIONS.map((entry)" not in modal
    assert "options.map((opt)" in select_field
    assert "{children}" in select_field


@pytest.mark.parametrize("condition", ITEM_CONDITIONS)
def test_backend_accepts_each_supported_swap_condition(condition):
    payload = ExchangeOfferCreateRequest(
        listing_id=str(ObjectId()),
        custom_item_title="Leather jacket",
        custom_item_condition=condition,
        custom_item_image="https://cdn.example.com/jacket.jpg",
        offering_user_city="Lahore",
        message="Would love to swap this jacket for your shoes.",
    )
    assert payload.custom_item_condition == condition


def test_backend_still_rejects_a_custom_swap_without_condition():
    with pytest.raises(ValidationError):
        ExchangeOfferCreateRequest(
            listing_id=str(ObjectId()),
            custom_item_title="Leather jacket",
            custom_item_condition="",
            custom_item_image="https://cdn.example.com/jacket.jpg",
            offering_user_city="Lahore",
            message="Would love to swap this jacket for your shoes.",
        )


def test_backend_rejects_an_overlong_condition():
    with pytest.raises(ValidationError):
        ExchangeOfferCreateRequest(
            listing_id=str(ObjectId()),
            custom_item_title="Leather jacket",
            custom_item_condition="x" * 61,
            custom_item_image="https://cdn.example.com/jacket.jpg",
            offering_user_city="Lahore",
            message="Would love to swap this jacket for your shoes.",
        )


def test_listing_source_swap_still_does_not_require_a_condition():
    payload = ExchangeOfferCreateRequest(
        listing_id=str(ObjectId()),
        offered_listing_id=str(ObjectId()),
        offering_user_city="Lahore",
        message="Swap my existing listing for yours please.",
    )
    assert payload.custom_item_condition is None


def test_password_fields_are_hidden_by_default_and_toggle_without_changing_value():
    field = (REPO_ROOT / "src" / "components" / "PasswordField.jsx").read_text(encoding="utf-8")
    login = (REPO_ROOT / "src" / "pages" / "LoginPage.jsx").read_text(encoding="utf-8")
    signup = (REPO_ROOT / "src" / "pages" / "SignupPage.jsx").read_text(encoding="utf-8")

    assert "useState(false)" in field
    assert "type={visible ? 'text' : 'password'}" in field
    assert 'aria-label={toggleLabel}' in field
    assert "aria-pressed={visible}" in field
    assert "value={value}" in field
    # Visibility is local; the form still owns the password value.
    assert "setFormData" not in field
    assert "<PasswordField" in login
    assert "<PasswordField" in signup
    assert 'id="login-password"' in login
    assert 'id="signup-password"' in signup
    assert 'id="signup-confirm"' in signup
    # Submission still sends the same password field from form state.
    assert "JSON.stringify({ email, password })" in login
    assert "password: formData.password" in signup
    # The previous keyboard-inaccessible toggle is gone.
    assert "tabIndex={-1}" not in signup
    assert "type=\"password\"" not in login
    assert "type=\"password\"" not in signup
