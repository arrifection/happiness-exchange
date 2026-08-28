"""Previous-listing deletion and notification navigation — Issues #4 and #5.

Issue #4: an owner can permanently delete a finished listing, a swap that is
still in flight blocks the delete, and approved request history survives.

Issue #5: clicking a notification opens the page the notification is about,
including for notifications stored with API paths or dead ids.
"""

from __future__ import annotations

import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest import IsolatedAsyncioTestCase

from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import auth as auth_deps
from app.api.routes import items as items_routes

REPO_ROOT = Path(__file__).resolve().parents[2]


def match_query(document, query):
    for key, expected in query.items():
        actual = document.get(key)
        if isinstance(expected, dict):
            if "$ne" in expected and actual == expected["$ne"]:
                return False
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
        # Accepts both sort("created_at", -1) and sort([("created_at", -1), ...]).
        keys = key if isinstance(key, list) else [(key, direction)]
        for sort_key, sort_direction in reversed(keys):
            self.documents.sort(
                key=lambda document: str(document.get(sort_key)),
                reverse=sort_direction == -1,
            )
        return self

    def skip(self, count):
        self.documents = self.documents[count:]
        return self

    def limit(self, count):
        self.documents = self.documents[:count]
        return self

    async def to_list(self, length=100):
        return list(self.documents) if length is None else self.documents[:length]


class FakeCollection:
    def __init__(self, documents=None):
        self.documents = list(documents or [])

    async def find_one(self, query, projection=None, sort=None, session=None):
        for document in self.documents:
            if match_query(document, query):
                return document
        return None

    def find(self, query):
        return FakeCursor([document for document in self.documents if match_query(document, query)])

    def aggregate(self, pipeline):
        """Supports the $match + $group count pipeline the item routes use."""
        matched = self.documents
        group_field = None
        for stage in pipeline:
            if "$match" in stage:
                matched = [document for document in matched if match_query(document, stage["$match"])]
            if "$group" in stage:
                group_field = str(stage["$group"]["_id"]).lstrip("$")
        counts: dict = {}
        for document in matched:
            key = document.get(group_field) if group_field else None
            counts[key] = counts.get(key, 0) + 1
        return FakeCursor([{"_id": key, "count": value} for key, value in counts.items()])

    async def delete_one(self, query):
        for index, document in enumerate(self.documents):
            if match_query(document, query):
                del self.documents[index]
                return SimpleNamespace(deleted_count=1)
        return SimpleNamespace(deleted_count=0)

    async def delete_many(self, query):
        remaining = [document for document in self.documents if not match_query(document, query)]
        deleted = len(self.documents) - len(remaining)
        self.documents = remaining
        return SimpleNamespace(deleted_count=deleted)

    async def update_many(self, query, update):
        modified = 0
        for document in self.documents:
            if match_query(document, query):
                document.update(update.get("$set", {}))
                modified += 1
        return SimpleNamespace(modified_count=modified)

    async def count_documents(self, query):
        return sum(1 for document in self.documents if match_query(document, query))


class PreviousListingDeleteTests(IsolatedAsyncioTestCase):
    """Issue #4 — owner-only permanent delete of a finished listing."""

    def setUp(self):
        self.now = datetime.now(timezone.utc)
        self.owner_id = str(ObjectId())
        self.other_user_id = str(ObjectId())
        self.requester_id = str(ObjectId())

        self.completed_item_id = ObjectId()
        self.reserved_item_id = ObjectId()
        self.other_listing_id = ObjectId()

        self.owner_user = {
            "id": self.owner_id,
            "name": "Owner User",
            "email": "owner@example.com",
            "is_verified": True,
            "whatsapp_number": "+923001234567",
        }
        self.other_user = {
            "id": self.other_user_id,
            "name": "Other User",
            "email": "other@example.com",
            "is_verified": True,
            "whatsapp_number": "+923001234567",
        }

        self.items_collection = FakeCollection([
            {
                "_id": self.completed_item_id,
                "title": "Desk lamp",
                "owner_id": self.owner_id,
                "owner_name": "Owner User",
                "status": "completed",
                "listing_mode": "BOTH",
                "created_at": self.now,
            },
            {
                # A swap is mid-flight on this one.
                "_id": self.reserved_item_id,
                "title": "Nike shoes",
                "owner_id": self.owner_id,
                "owner_name": "Owner User",
                "status": "exchange_reserved",
                "listing_mode": "BOTH",
                "active_exchange_offer_id": str(ObjectId()),
                "created_at": self.now,
            },
            {
                "_id": self.other_listing_id,
                "title": "Someone else's chair",
                "owner_id": self.other_user_id,
                "owner_name": "Other User",
                "status": "completed",
                "listing_mode": "GIVEAWAY",
                "created_at": self.now,
            },
        ])

        self.approved_request_id = ObjectId()
        self.pending_request_id = ObjectId()
        self.unrelated_request_id = ObjectId()
        self.requests_collection = FakeCollection([
            {
                "_id": self.approved_request_id,
                "item_id": str(self.completed_item_id),
                "item_title": "Desk lamp",
                "requester_id": self.requester_id,
                "requester_name": "Requester User",
                "owner_id": self.owner_id,
                "status": "approved",
                "created_at": self.now,
            },
            {
                "_id": self.pending_request_id,
                "item_id": str(self.completed_item_id),
                "item_title": "Desk lamp",
                "requester_id": str(ObjectId()),
                "requester_name": "Hopeful User",
                "owner_id": self.owner_id,
                "status": "pending",
                "created_at": self.now,
            },
            {
                "_id": self.unrelated_request_id,
                "item_id": str(self.other_listing_id),
                "item_title": "Someone else's chair",
                "requester_id": self.requester_id,
                "requester_name": "Requester User",
                "owner_id": self.other_user_id,
                "status": "approved",
                "created_at": self.now,
            },
        ])

        self.pending_offer_id = ObjectId()
        self.completed_offer_id = ObjectId()
        self.offers_collection = FakeCollection([
            {
                "_id": self.pending_offer_id,
                "listing_id": str(self.completed_item_id),
                "listing_title": "Desk lamp",
                "offering_user_id": str(ObjectId()),
                "owner_user_id": self.owner_id,
                "status": "PENDING",
                "created_at": self.now,
            },
            {
                "_id": self.completed_offer_id,
                "listing_id": str(self.completed_item_id),
                "listing_title": "Desk lamp",
                "offering_user_id": str(ObjectId()),
                "owner_user_id": self.owner_id,
                "status": "COMPLETED",
                "created_at": self.now,
            },
        ])
        self.transactions_collection = FakeCollection([
            {
                "_id": ObjectId(),
                "listing_id": str(self.completed_item_id),
                "status": "COMPLETED",
                "created_at": self.now,
            },
        ])

        self.reviews_collection = FakeCollection([])
        self.users_collection = FakeCollection([])

        async def get_items_collection_async():
            return self.items_collection

        async def get_requests_collection_async():
            return self.requests_collection

        async def get_exchange_offers_collection_async():
            return self.offers_collection

        async def get_reviews_collection_async():
            return self.reviews_collection

        async def get_users_collection_async():
            return self.users_collection

        async def fake_reputation_summary(*args, **kwargs):
            return None

        async def fake_public_reputation_lookup(*args, **kwargs):
            return {}

        self._originals = {
            name: getattr(items_routes, name)
            for name in (
                "get_items_collection_async",
                "get_requests_collection_async",
                "get_exchange_offers_collection_async",
                "get_reviews_collection_async",
                "get_users_collection_async",
                "calculate_reputation_summary",
                "build_public_reputation_lookup",
            )
        }
        items_routes.get_items_collection_async = get_items_collection_async
        items_routes.get_requests_collection_async = get_requests_collection_async
        items_routes.get_exchange_offers_collection_async = get_exchange_offers_collection_async
        items_routes.get_reviews_collection_async = get_reviews_collection_async
        items_routes.get_users_collection_async = get_users_collection_async
        items_routes.calculate_reputation_summary = fake_reputation_summary
        items_routes.build_public_reputation_lookup = fake_public_reputation_lookup

        self.app = FastAPI()
        self.app.include_router(items_routes.router, prefix="/api")

    def tearDown(self):
        for name, original in self._originals.items():
            setattr(items_routes, name, original)
        self.app.dependency_overrides.clear()

    def client_as(self, user):
        self.app.dependency_overrides[auth_deps.get_current_user] = lambda: user
        self.app.dependency_overrides[auth_deps.get_verified_user] = lambda: user
        return TestClient(self.app)

    def anonymous_client(self):
        """No dependency override: the real auth dependency rejects the call."""
        self.app.dependency_overrides.clear()
        return TestClient(self.app)

    def item_ids(self):
        return {str(document["_id"]) for document in self.items_collection.documents}

    def test_owner_can_delete_completed_previous_listing(self):
        with self.client_as(self.owner_user) as client:
            response = client.delete(f"/api/items/{self.completed_item_id}")

        self.assertEqual(response.status_code, 204)
        self.assertNotIn(str(self.completed_item_id), self.item_ids())

    def test_deleted_listing_is_gone_from_owner_and_public_listings(self):
        with self.client_as(self.owner_user) as client:
            before_mine = client.get("/api/items/my")
            before_public = client.get("/api/items?status=completed")
            self.assertEqual(before_mine.status_code, 200)
            self.assertEqual(before_public.status_code, 200)
            self.assertIn(
                str(self.completed_item_id),
                {entry["id"] for entry in before_mine.json()},
            )
            self.assertIn(
                str(self.completed_item_id),
                {entry["id"] for entry in before_public.json()["items"]},
            )

            self.assertEqual(client.delete(f"/api/items/{self.completed_item_id}").status_code, 204)

            after_mine = client.get("/api/items/my")
            after_public = client.get("/api/items?status=completed")

        self.assertNotIn(
            str(self.completed_item_id),
            {entry["id"] for entry in after_mine.json()},
        )
        self.assertNotIn(
            str(self.completed_item_id),
            {entry["id"] for entry in after_public.json()["items"]},
        )

    def test_delete_is_blocked_while_a_swap_is_in_flight(self):
        with self.client_as(self.owner_user) as client:
            response = client.delete(f"/api/items/{self.reserved_item_id}")

        self.assertEqual(response.status_code, 409)
        self.assertIn("swap", response.json()["detail"].lower())
        self.assertIn(str(self.reserved_item_id), self.item_ids())

    def test_non_owner_cannot_delete_another_users_listing(self):
        with self.client_as(self.other_user) as client:
            response = client.delete(f"/api/items/{self.completed_item_id}")

        self.assertEqual(response.status_code, 403)
        self.assertIn(str(self.completed_item_id), self.item_ids())

    def test_unauthenticated_request_cannot_delete_a_listing(self):
        with self.anonymous_client() as client:
            response = client.delete(f"/api/items/{self.completed_item_id}")

        self.assertIn(response.status_code, (401, 403))
        self.assertIn(str(self.completed_item_id), self.item_ids())

    def test_approved_request_history_survives_the_delete(self):
        with self.client_as(self.owner_user) as client:
            self.assertEqual(client.delete(f"/api/items/{self.completed_item_id}").status_code, 204)

        remaining = {str(document["_id"]): document for document in self.requests_collection.documents}
        # Approved history is kept and flagged, unanswered requests are removed.
        self.assertIn(str(self.approved_request_id), remaining)
        self.assertTrue(remaining[str(self.approved_request_id)]["listing_deleted"])
        self.assertEqual(remaining[str(self.approved_request_id)]["item_title"], "Desk lamp")
        self.assertNotIn(str(self.pending_request_id), remaining)
        # Another listing's history is untouched.
        self.assertIn(str(self.unrelated_request_id), remaining)
        self.assertNotIn("listing_deleted", remaining[str(self.unrelated_request_id)])

    def test_open_offers_are_withdrawn_and_finished_ones_are_kept(self):
        with self.client_as(self.owner_user) as client:
            self.assertEqual(client.delete(f"/api/items/{self.completed_item_id}").status_code, 204)

        offers = {str(document["_id"]): document for document in self.offers_collection.documents}
        self.assertEqual(offers[str(self.pending_offer_id)]["status"], "CANCELLED")
        self.assertEqual(offers[str(self.completed_offer_id)]["status"], "COMPLETED")

    def test_transaction_history_is_not_cascade_deleted(self):
        with self.client_as(self.owner_user) as client:
            self.assertEqual(client.delete(f"/api/items/{self.completed_item_id}").status_code, 204)

        self.assertEqual(len(self.transactions_collection.documents), 1)

    def test_deleting_a_missing_listing_reports_not_found(self):
        with self.client_as(self.owner_user) as client:
            response = client.delete(f"/api/items/{ObjectId()}")

        self.assertEqual(response.status_code, 404)


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


def test_previous_listing_eligibility_matches_the_backend_rule():
    """Issue #4 — only finished listings without a live swap offer Delete."""
    script = """
    import { canDeletePreviousListing, selectPreviousListings }
      from './src/lib/previousListings.js';
    const items = [
      { id: 'a', status: 'completed' },
      { id: 'b', status: 'available' },
      { id: 'c', status: 'reserved' },
      { id: 'd', status: 'exchange_reserved' },
      { id: 'e', status: 'completed', active_exchange_offer_id: 'offer-1' },
    ];
    const out = {
      previous: selectPreviousListings(items).map((item) => item.id),
      deletable: items.filter(canDeletePreviousListing).map((item) => item.id),
      nullSafe: canDeletePreviousListing(null),
    };
    process.stdout.write(JSON.stringify(out));
    """
    result = json.loads(run_node(script))

    assert result["previous"] == ["a", "e"]
    assert result["deletable"] == ["a"]
    assert result["nullSafe"] is False


def test_dashboard_offers_delete_only_for_previous_listings():
    dashboard = (REPO_ROOT / "src" / "pages" / "DashboardPage.jsx").read_text(encoding="utf-8")
    app_source = (REPO_ROOT / "src" / "App.jsx").read_text(encoding="utf-8")

    assert "Previous listings" in dashboard
    assert "selectPreviousListings(myItems)" in dashboard
    assert "canDeletePreviousListing(item)" in dashboard
    assert "Delete listing" in dashboard
    # Reuses the existing delete handler, which already confirms and refreshes.
    assert "onDeleteItem={handleDeleteItem}" in app_source
    assert "window.confirm" in app_source


# ── Issue #5 — notification navigation ───────────────────────────────────────

NOTIFICATION_TARGET_SCRIPT = """
import { resolveNotificationTarget, NOTIFICATION_FALLBACK_ROUTE }
  from './src/lib/notificationTargets.js';
const cases = %s;
process.stdout.write(JSON.stringify({
  targets: cases.map((notification) => resolveNotificationTarget(notification)),
  fallback: NOTIFICATION_FALLBACK_ROUTE,
}));
"""


def resolve_targets(notifications):
    script = NOTIFICATION_TARGET_SCRIPT % json.dumps(notifications)
    return json.loads(run_node(script))


def test_each_notification_type_navigates_to_its_page():
    listing_id = "651f1f77bcf86cd799439011"
    transaction_id = "651f1f77bcf86cd799439012"
    shipment_id = "651f1f77bcf86cd799439013"
    delivery_id = "651f1f77bcf86cd799439014"

    notifications = [
        {"type": "exchange_offer_received", "action_url": f"/items/{listing_id}"},
        {"type": "item_completed", "action_url": f"/items/{listing_id}"},
        {"type": "exchange_counter_accepted", "action_url": f"/exchange/{transaction_id}"},
        {"type": "exchange_shipping_update", "action_url": f"/exchange/{transaction_id}"},
        {"type": "giveaway_shipping_pending", "action_url": f"/tracking/{shipment_id}"},
        {"type": "delivery_ready", "action_url": f"/deliveries/{delivery_id}"},
        {"type": "review_received", "action_url": "/profile"},
        {"type": "request_approved", "action_url": "/requests"},
        {"type": "new_message", "action_url": "/messages?conversation=abc"},
    ]

    assert resolve_targets(notifications)["targets"] == [
        f"/items/{listing_id}",
        f"/items/{listing_id}",
        f"/exchange/{transaction_id}",
        f"/exchange/{transaction_id}",
        f"/tracking/{shipment_id}",
        f"/deliveries/{delivery_id}",
        "/profile",
        "/requests",
        "/requests",
    ]


def test_api_style_action_urls_reach_the_real_page():
    """These were stored as API paths and used to fall through to the catch-all."""
    notifications = [
        {"type": "request_received", "action_url": "/requests/incoming"},
        {"type": "request_rejected", "action_url": "/requests/my"},
        {"type": "exchange_offer_received", "action_url": "/exchange-offers"},
    ]

    assert resolve_targets(notifications)["targets"] == ["/requests", "/requests", "/swaps"]


def test_missing_or_dead_targets_fall_back_gracefully():
    notifications = [
        {"type": "exchange_offer_received", "action_url": None},
        {"type": "request_received"},
        {"type": "delivery_ready", "action_url": ""},
        {"type": "exchange_counter_accepted", "action_url": "/exchange/None"},
        {"type": "item_completed", "action_url": "/items/undefined"},
        {"type": "exchange_shipping_update", "action_url": "/exchange/"},
        {"type": "totally_unknown_type", "action_url": "/no/such/page"},
        {},
    ]

    result = resolve_targets(notifications)
    assert result["targets"] == [
        "/swaps",
        "/requests",
        "/deliveries",
        "/swaps",
        "/dashboard",
        "/swaps",
        "/dashboard",
        "/dashboard",
    ]
    assert result["fallback"] == "/dashboard"


def test_deleted_listing_notification_opens_the_listing_page_not_a_dead_end():
    """Issue #4 deletes listings, so old notifications can point at a gone item.

    The id is still well formed, so the user is taken to the item page, which
    already renders its own "Item not found" state instead of crashing.
    """
    deleted_id = "651f1f77bcf86cd799439099"
    targets = resolve_targets([{"type": "exchange_offer_received", "action_url": f"/items/{deleted_id}"}])["targets"]

    assert targets == [f"/items/{deleted_id}"]

    details = (REPO_ROOT / "src" / "pages" / "ItemDetailsPage.jsx").read_text(encoding="utf-8")
    assert "Item not found" in details


def test_notification_navigation_cannot_leave_the_site_or_reach_admin_pages():
    notifications = [
        {"type": "request_received", "action_url": "https://evil.example.com/steal"},
        {"type": "request_received", "action_url": "//evil.example.com/steal"},
        {"type": "request_received", "action_url": "javascript:alert(1)"},
        {"type": "exchange_offer_received", "action_url": "/admin/exchange"},
        {"type": "request_received", "action_url": "../../etc/passwd"},
    ]

    targets = resolve_targets(notifications)["targets"]

    assert targets == ["/requests", "/requests", "/requests", "/swaps", "/requests"]
    assert all(target.startswith("/") and not target.startswith("//") for target in targets)
    assert not any("admin" in target for target in targets)
    assert not any("evil.example.com" in target for target in targets)


def test_bell_navigates_every_notification_and_keeps_marking_them_read():
    bell = (REPO_ROOT / "src" / "components" / "NotificationBell.jsx").read_text(encoding="utf-8")

    assert "resolveNotificationTarget" in bell
    assert "navigate(resolveNotificationTarget(notification))" in bell
    # Existing read behaviour is preserved.
    assert "await markAsRead(notification.id)" in bell
    # The old pass-through helper is gone, so raw action_urls are never used.
    assert "normalizeActionUrl" not in bell
    # Issue #6 dismiss must not hijack the row click used for navigation.
    assert "event.stopPropagation()" in bell
    assert "Dismiss notification" in bell


DUMMY_ID = "651f1f77bcf86cd799439000"

# Notifications raised through these helpers go to the admin/moderator panel and
# are filtered out of the user bell, so their urls are not app routes.
ADMIN_NOTIFIERS = ("notify_admins", "notify_moderators")


def collect_notification_urls():
    """Map each notification action_url to whether it targets the admin panel."""
    urls: dict[str, bool] = {}
    pattern = re.compile(r"(notify_admins|notify_moderators|create_notification)\s*\(")
    for source_path in (REPO_ROOT / "app").rglob("*.py"):
        source = source_path.read_text(encoding="utf-8")
        for call in pattern.finditer(source):
            window = source[call.start(): call.start() + 700]
            found = re.search(r"action_url=f?\"([^\"]+)\"", window)
            if not found:
                continue
            url = re.sub(r"\{[^}]*\}", DUMMY_ID, found.group(1))
            admin_only = call.group(1) in ADMIN_NOTIFIERS
            urls[url] = urls.get(url, True) and admin_only
    return urls


def test_every_user_facing_notification_url_is_already_a_real_app_route():
    """Each user-facing action_url must resolve to itself, unchanged.

    A url the resolver has to rewrite is one that would have dead-ended before
    this fix, so this keeps new notifications honest at the source.
    """
    urls = collect_notification_urls()
    user_urls = sorted(url for url, admin_only in urls.items() if not admin_only)

    assert "/requests" in user_urls
    assert not any(url.startswith("/requests/") for url in user_urls)

    resolved = resolve_targets([{"type": "", "action_url": url} for url in user_urls])["targets"]
    rewritten = {
        url: target for url, target in zip(user_urls, resolved) if url != target
    }
    # "report_resolved" reuses the moderator "/reports" url and the app has no
    # user-facing reports page, so it is expected to land on the dashboard.
    # Anything else pointing at a non-route is a new bug.
    assert rewritten == {"/reports": "/dashboard"}, (
        f"user notifications point at non-routes: {rewritten}"
    )


def test_admin_panel_notification_urls_degrade_to_the_dashboard():
    """Admin urls are filtered from the bell, and would still not dead-end."""
    urls = collect_notification_urls()
    admin_urls = sorted(url for url, admin_only in urls.items() if admin_only)

    assert admin_urls, "expected admin/moderator notifications to exist"

    resolved = resolve_targets([{"type": "", "action_url": url} for url in admin_urls])["targets"]
    assert set(resolved) == {"/dashboard"}
