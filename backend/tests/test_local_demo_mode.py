"""Local demo sandbox: production locks, demo login, and seeded dataset shape."""

import sys
from datetime import datetime, timezone
from pathlib import Path
from unittest import TestCase
from unittest.mock import patch

from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes import dev_demo
from app.core.config import Settings
from app.core.runtime import local_demo_mode_enabled

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import demo_env  # noqa: E402


class FakeUsersCollection:
    def __init__(self, documents):
        self.documents = documents
        self.updates = []

    def _matches(self, document, query):
        for key, value in query.items():
            if document.get(key) != value:
                return False
        return True

    async def find_one(self, query):
        for document in self.documents:
            if self._matches(document, query):
                return document
        return None

    def find(self, query):
        matched = [doc for doc in self.documents if self._matches(doc, query)]

        class Cursor:
            def sort(self, *_args, **_kwargs):
                return self

            async def to_list(self, length=None):
                return matched[:length] if length else matched

        return Cursor()

    async def update_one(self, query, update):
        self.updates.append((query, update))
        return type("Result", (), {"modified_count": 1})()


def build_demo_user(**overrides):
    now = datetime.now(timezone.utc)
    user = {
        "_id": ObjectId(),
        "name": "Sarah Demo",
        "email": "sarah.demo@example.com",
        "role": "user",
        "account_type": "member",
        "country": "Pakistan",
        "whatsapp_number": "+923004440001",
        "is_verified": True,
        "is_banned": False,
        "is_local_demo": True,
        "local_demo_key": "user-a",
        "created_at": now,
        "updated_at": now,
    }
    user.update(overrides)
    return user


class DemoModeRuntimeTests(TestCase):
    def test_settings_default_demo_mode_is_false(self):
        self.assertIs(Settings.model_fields["LOCAL_DEMO_MODE"].default, False)

    def test_demo_mode_enabled_in_development_when_flag_set(self):
        self.assertTrue(
            local_demo_mode_enabled(demo_flag=True, environment="development", space_id="")
        )

    def test_demo_mode_disabled_without_flag(self):
        self.assertFalse(
            local_demo_mode_enabled(demo_flag=False, environment="development", space_id="")
        )

    def test_demo_mode_cannot_activate_in_production(self):
        for environment in ("production", "prod"):
            self.assertFalse(
                local_demo_mode_enabled(demo_flag=True, environment=environment, space_id="")
            )

    def test_demo_mode_cannot_activate_on_huggingface_space(self):
        self.assertFalse(
            local_demo_mode_enabled(demo_flag=True, environment="development", space_id="a-space")
        )


class DemoEndpointTests(TestCase):
    def setUp(self):
        self.user = build_demo_user()
        self.users_collection = FakeUsersCollection([self.user])

        async def get_users_collection_async():
            return self.users_collection

        self.patches = [
            patch.object(dev_demo, "get_users_collection_async", get_users_collection_async),
        ]
        for entry in self.patches:
            entry.start()

        app = FastAPI()
        app.include_router(dev_demo.router, prefix="/api/dev")
        self.client = TestClient(app)

    def tearDown(self):
        for entry in self.patches:
            entry.stop()

    def test_endpoints_are_hidden_when_demo_mode_is_off(self):
        with patch.object(dev_demo, "local_demo_mode_enabled", return_value=False):
            self.assertEqual(self.client.get("/api/dev/demo/users").status_code, 404)
            self.assertEqual(
                self.client.post("/api/dev/demo/login", json={"email": self.user["email"]}).status_code,
                404,
            )
            self.assertEqual(self.client.post("/api/dev/demo/reset").status_code, 404)

    def test_demo_login_issues_a_normal_token(self):
        with patch.object(dev_demo, "local_demo_mode_enabled", return_value=True):
            response = self.client.post("/api/dev/demo/login", json={"user_id": str(self.user["_id"])})
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertTrue(body["access_token"])
        self.assertEqual(body["user"]["email"], self.user["email"])
        self.assertEqual(body["user"]["whatsapp_number"], self.user["whatsapp_number"])

    def test_demo_login_refuses_non_demo_accounts(self):
        self.users_collection.documents = [build_demo_user(is_local_demo=False)]
        with patch.object(dev_demo, "local_demo_mode_enabled", return_value=True):
            response = self.client.post("/api/dev/demo/login", json={"email": "sarah.demo@example.com"})
        self.assertEqual(response.status_code, 404)

    def test_demo_login_can_switch_country(self):
        with patch.object(dev_demo, "local_demo_mode_enabled", return_value=True):
            response = self.client.post(
                "/api/dev/demo/login",
                json={"user_id": str(self.user["_id"]), "country": "Saudi Arabia"},
            )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["user"]["country"], "Saudi Arabia")

    def test_demo_users_listing_only_returns_demo_accounts(self):
        self.users_collection.documents.append(build_demo_user(is_local_demo=False, email="real@example.com"))
        with patch.object(dev_demo, "local_demo_mode_enabled", return_value=True):
            response = self.client.get("/api/dev/demo/users")
        self.assertEqual(response.status_code, 200, response.text)
        emails = [user["email"] for user in response.json()["users"]]
        self.assertEqual(emails, ["sarah.demo@example.com"])


class DemoSeedGuardTests(TestCase):
    def test_seed_refuses_production(self):
        with patch.object(demo_env, "is_production_environment", return_value=True):
            with self.assertRaises(demo_env.DemoSeedError):
                demo_env.guard_demo_environment()

    def test_seed_refuses_non_local_mongo(self):
        with (
            patch.object(demo_env, "is_production_environment", return_value=False),
            patch.dict("os.environ", {"MONGODB_URI": "mongodb+srv://user:pass@cluster0.mongodb.net"}),
        ):
            with self.assertRaises(demo_env.DemoSeedError):
                demo_env.guard_demo_environment()

    def test_seed_allows_localhost(self):
        with (
            patch.object(demo_env, "is_production_environment", return_value=False),
            patch.dict("os.environ", {"MONGODB_URI": "mongodb://localhost:27017"}),
        ):
            demo_env.guard_demo_environment()


class DemoDatasetTests(TestCase):
    @classmethod
    def setUpClass(cls):
        with patch.object(demo_env, "write_demo_image", lambda key, title: f"http://127.0.0.1:8000/api/uploads/items/demo-{key}.png"):
            cls.documents = demo_env.build_demo_documents()

    def test_demo_emails_are_token_compatible(self):
        from pydantic import EmailStr, TypeAdapter

        adapter = TypeAdapter(EmailStr)
        for user in self.documents["users"]:
            adapter.validate_python(user["email"])
            self.assertTrue(user["is_verified"])
            self.assertTrue(user["whatsapp_number"])
            self.assertTrue(user["is_local_demo"])

    def test_every_listing_has_an_image_and_a_known_mode(self):
        for item in self.documents["items"]:
            self.assertTrue(item["image_url"])
            self.assertIn(item["listing_mode"], {"GIVEAWAY", "EXCHANGE", "BOTH"})
            self.assertTrue(item["is_local_demo"])

    def test_both_users_own_a_giveaway_and_a_swap_listing(self):
        user_ids = {user["local_demo_key"]: str(user["_id"]) for user in self.documents["users"]}
        for key in ("user-a", "user-b"):
            owned = [item for item in self.documents["items"] if item["owner_id"] == user_ids[key]]
            modes = {item["listing_mode"] for item in owned}
            self.assertIn("GIVEAWAY", modes)
            self.assertIn("EXCHANGE", modes)

    def test_requests_cover_pending_approved_and_rejected(self):
        statuses = [request["status"] for request in self.documents["requests"]]
        self.assertIn("pending", statuses)
        self.assertIn("approved", statuses)
        self.assertEqual(statuses.count("rejected"), 1)

    def test_requests_are_unique_per_item_and_requester(self):
        pairs = [(r["item_id"], r["requester_id"]) for r in self.documents["requests"]]
        self.assertEqual(len(pairs), len(set(pairs)))

    def test_nobody_requests_or_offers_on_their_own_listing(self):
        for request in self.documents["requests"]:
            self.assertNotEqual(request["requester_id"], request["owner_id"])
        for offer in self.documents["exchange_offers"]:
            self.assertNotEqual(offer["offering_user_id"], offer["owner_user_id"])

    def test_seeded_offer_targets_a_swap_listing_with_an_offered_listing(self):
        items_by_id = {str(item["_id"]): item for item in self.documents["items"]}
        self.assertEqual(len(self.documents["exchange_offers"]), 1)
        offer = self.documents["exchange_offers"][0]
        self.assertEqual(offer["status"], "PENDING")
        self.assertEqual(items_by_id[offer["listing_id"]]["listing_mode"], "EXCHANGE")
        offered = items_by_id[offer["offered_listing_id"]]
        self.assertEqual(offered["owner_id"], offer["offering_user_id"])
        self.assertEqual(offered["status"], "available")

    def test_approved_request_listing_is_reserved(self):
        items_by_id = {str(item["_id"]): item for item in self.documents["items"]}
        approved = [r for r in self.documents["requests"] if r["status"] == "approved"]
        self.assertTrue(approved)
        for request in approved:
            self.assertEqual(items_by_id[request["item_id"]]["status"], "reserved")

    def test_demo_users_start_as_new_members(self):
        for user in self.documents["users"]:
            self.assertEqual(user["trust_score"], 0)
