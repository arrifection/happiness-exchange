"""Local/dev email verification bypass, Mailpit delivery, and dummy-user auth."""

from datetime import datetime, timezone
from pathlib import Path
from unittest import IsolatedAsyncioTestCase, TestCase
from unittest.mock import patch

from bson import ObjectId
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.deps.auth import get_verified_user
from app.api.routes import auth as auth_routes
from app.core.config import Settings
from app.core.runtime import email_verification_bypass_enabled, is_production_environment
from app.core.slowapi_limiter import limiter
from app.services.auth import hash_password, serialize_user, verify_password
from app.services.email import (
    build_verification_email_content,
    get_email_delivery_mode,
    send_verification_email,
)

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "scripts"
import sys

if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import seed_local_users as local_seed  # noqa: E402


class FakeUsersCollection:
    def __init__(self, user=None):
        self.user = user
        self.documents = [user] if user else []
        self.inserted = []

    async def find_one(self, query):
        for document in self.documents:
            if document is None:
                continue
            if query.get("email") == document.get("email"):
                return document
            if query.get("_id") == document.get("_id"):
                return document
            if query.get("name_normalized") == document.get("name_normalized"):
                return document
        return None

    async def insert_one(self, document):
        stored = {**document, "_id": ObjectId()}
        self.documents.append(stored)
        self.inserted.append(stored)
        self.user = stored
        return type("Result", (), {"inserted_id": stored["_id"]})()

    async def update_one(self, query, update):
        return type("Result", (), {"modified_count": 1})()


class RuntimeBypassTests(TestCase):
    def test_settings_default_bypass_is_false(self):
        field = Settings.model_fields["DEV_BYPASS_EMAIL_VERIFICATION"]
        self.assertIs(field.default, False)

    def test_settings_default_environment_is_development(self):
        field = Settings.model_fields["ENVIRONMENT"]
        default = field.default
        if default is None or str(default) == "PydanticUndefined":
            default = field.get_default(call_default_factory=True)
        self.assertEqual(str(default), "development")

    def test_bypass_enabled_in_development(self):
        self.assertTrue(
            email_verification_bypass_enabled(
                bypass_flag=True,
                environment="development",
                space_id="",
            )
        )

    def test_bypass_disabled_requires_normal_verification(self):
        self.assertFalse(
            email_verification_bypass_enabled(
                bypass_flag=False,
                environment="development",
                space_id="",
            )
        )

    def test_bypass_cannot_activate_in_production(self):
        self.assertFalse(
            email_verification_bypass_enabled(
                bypass_flag=True,
                environment="production",
                space_id="",
            )
        )
        self.assertFalse(
            email_verification_bypass_enabled(
                bypass_flag=True,
                environment="prod",
                space_id="",
            )
        )

    def test_bypass_cannot_activate_on_huggingface_space(self):
        self.assertTrue(is_production_environment("development", space_id="some-space"))
        self.assertFalse(
            email_verification_bypass_enabled(
                bypass_flag=True,
                environment="development",
                space_id="some-space",
            )
        )

    def test_serialize_user_verified_when_bypass_on(self):
        user = {
            "_id": ObjectId(),
            "name": "Local User A",
            "email": "user-a@example.com",
            "role": "user",
            "is_verified": False,
            "is_banned": False,
        }
        with patch("app.services.auth.email_verification_bypass_enabled", return_value=True):
            payload = serialize_user(user)
        self.assertTrue(payload["is_verified"])

    def test_serialize_user_unverified_when_bypass_off(self):
        user = {
            "_id": ObjectId(),
            "name": "Local User A",
            "email": "user-a@example.com",
            "role": "user",
            "is_verified": False,
            "is_banned": False,
        }
        with patch("app.services.auth.email_verification_bypass_enabled", return_value=False):
            payload = serialize_user(user)
        self.assertFalse(payload["is_verified"])


class VerifiedUserDependencyTests(IsolatedAsyncioTestCase):
    async def test_bypass_allows_unverified_user(self):
        user = {"id": "abc", "email": "user-a@example.com", "is_verified": False}
        with patch("app.api.deps.auth.email_verification_bypass_enabled", return_value=True):
            result = await get_verified_user(current_user=user)
        self.assertEqual(result["id"], "abc")

    async def test_bypass_off_rejects_unverified_user(self):
        user = {"id": "abc", "email": "user-a@example.com", "is_verified": False}
        with patch("app.api.deps.auth.email_verification_bypass_enabled", return_value=False):
            with self.assertRaises(HTTPException) as caught:
                await get_verified_user(current_user=user)
        self.assertEqual(caught.exception.status_code, 403)


class DummyUserAuthTests(IsolatedAsyncioTestCase):
    def setUp(self):
        self.now = datetime.now(timezone.utc)
        self.password_a = local_seed.DEFAULT_USER_A["password"]
        self.password_b = local_seed.DEFAULT_USER_B["password"]
        self.user_a = {
            "_id": ObjectId(),
            "name": local_seed.DEFAULT_USER_A["name"],
            "name_normalized": "local user a",
            "email": local_seed.DEFAULT_USER_A["email"],
            "hashed_password": hash_password(self.password_a),
            "role": "user",
            "account_type": "member",
            "is_verified": True,
            "is_banned": False,
            "whatsapp_number": local_seed.DEFAULT_USER_A["whatsapp_number"],
            "created_at": self.now,
            "updated_at": self.now,
        }
        self.user_b = {
            **self.user_a,
            "_id": ObjectId(),
            "name": local_seed.DEFAULT_USER_B["name"],
            "name_normalized": "local user b",
            "email": local_seed.DEFAULT_USER_B["email"],
            "hashed_password": hash_password(self.password_b),
            "whatsapp_number": local_seed.DEFAULT_USER_B["whatsapp_number"],
        }
        self.users_collection = FakeUsersCollection()
        self.users_collection.documents = [self.user_a, self.user_b]

        async def get_users_collection_async():
            return self.users_collection

        async def fake_notify(*args, **kwargs):
            return None

        auth_routes.get_users_collection_async = get_users_collection_async
        auth_routes.send_verification_email = lambda *args, **kwargs: None
        auth_routes.notify_admins = fake_notify

        self.app = FastAPI()
        self.app.state.limiter = limiter
        self.app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
        self.app.add_middleware(SlowAPIMiddleware)
        self.app.include_router(auth_routes.router, prefix="/api/auth")
        storage = getattr(limiter, "_storage", None)
        if storage is not None and hasattr(storage, "storage"):
            storage.storage.clear()

    def test_dummy_password_hashes_verify(self):
        self.assertTrue(verify_password(self.password_a, self.user_a["hashed_password"]))
        self.assertTrue(verify_password(self.password_b, self.user_b["hashed_password"]))
        self.assertFalse(verify_password("wrong-password", self.user_a["hashed_password"]))

    def test_dummy_users_can_login(self):
        with TestClient(self.app) as client:
            response_a = client.post(
                "/api/auth/login",
                json={"email": self.user_a["email"], "password": self.password_a},
            )
            response_b = client.post(
                "/api/auth/login",
                json={"email": self.user_b["email"], "password": self.password_b},
            )
        self.assertEqual(response_a.status_code, 200, response_a.text)
        self.assertEqual(response_b.status_code, 200, response_b.text)
        self.assertEqual(response_a.json()["user"]["email"], "user-a@example.com")
        self.assertEqual(response_b.json()["user"]["email"], "user-b@example.com")

    def test_login_saves_selected_country(self):
        with TestClient(self.app) as client:
            response = client.post(
                "/api/auth/login",
                json={
                    "email": self.user_a["email"],
                    "password": self.password_a,
                    "country": "Saudi Arabia",
                },
            )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["user"]["country"], "Saudi Arabia")

    def test_wrong_password_is_still_rejected(self):
        with TestClient(self.app) as client:
            response = client.post(
                "/api/auth/login",
                json={"email": self.user_a["email"], "password": "NotThePassword1!"},
            )
        self.assertEqual(response.status_code, 401)

    def test_signup_verified_when_bypass_enabled(self):
        self.users_collection.documents = []
        payload = {
            "name": "Fresh Local User",
            "email": "fresh-local@example.com",
            "password": "LocalTest123!",
            "whatsapp_number": "+923004444444",
        }
        with patch("app.api.routes.auth.email_verification_bypass_enabled", return_value=True):
            with TestClient(self.app) as client:
                response = client.post("/api/auth/signup", json=payload)
        self.assertEqual(response.status_code, 201, response.text)
        self.assertTrue(response.json()["user"]["is_verified"])
        self.assertTrue(self.users_collection.inserted[0]["is_verified"])

    def test_signup_requires_verification_when_bypass_disabled(self):
        self.users_collection.documents = []
        payload = {
            "name": "Unverified Local User",
            "email": "unverified-local@example.com",
            "password": "LocalTest123!",
            "whatsapp_number": "+923005555555",
        }
        with patch("app.api.routes.auth.email_verification_bypass_enabled", return_value=False):
            with TestClient(self.app) as client:
                response = client.post("/api/auth/signup", json=payload)
        self.assertEqual(response.status_code, 201, response.text)
        self.assertFalse(response.json()["user"]["is_verified"])
        self.assertFalse(self.users_collection.inserted[0]["is_verified"])


class VerificationEmailTests(TestCase):
    def test_verification_email_content_includes_token(self):
        content = build_verification_email_content("abc123token")
        self.assertEqual(content["subject"], "Verify your Happiness Exchange account")
        self.assertIn("abc123token", content["verify_link"])
        self.assertIn("/verify-email?token=abc123token", content["text"])
        self.assertIn("abc123token", content["html"])

    def test_smtp_delivery_in_development(self):
        sent = []

        class FakeSMTP:
            def __init__(self, host, port, timeout=None):
                self.host = host
                self.port = port

            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, tb):
                return False

            def send_message(self, message):
                sent.append(message)

        with (
            patch("app.services.email.is_production_environment", return_value=False),
            patch("app.services.email.settings.SMTP_HOST", "127.0.0.1"),
            patch("app.services.email.settings.SMTP_PORT", 1025),
            patch("app.services.email.settings.SMTP_STARTTLS", False),
            patch("app.services.email.settings.SMTP_USER", ""),
            patch("app.services.email.smtplib.SMTP", FakeSMTP),
        ):
            self.assertEqual(get_email_delivery_mode(), "smtp")
            send_verification_email("user-a@example.com", "mailpit-token")

        self.assertEqual(len(sent), 1)
        raw = sent[0].as_string()
        self.assertIn("mailpit-token", raw)
        self.assertIn("Verify your Happiness Exchange account", raw)

    def test_development_never_uses_resend(self):
        with (
            patch("app.services.email.is_production_environment", return_value=False),
            patch("app.services.email.settings.SMTP_HOST", ""),
            patch("app.services.email.settings.RESEND_API_KEY", "re_should_not_be_used"),
        ):
            self.assertEqual(get_email_delivery_mode(), "terminal_fallback")

    def test_production_uses_resend_not_smtp(self):
        with (
            patch("app.services.email.is_production_environment", return_value=True),
            patch("app.services.email.settings.SMTP_HOST", "127.0.0.1"),
            patch("app.services.email.settings.RESEND_API_KEY", "re_production_key"),
        ):
            self.assertEqual(get_email_delivery_mode(), "resend")


class LocalSeedGuardTests(TestCase):
    def test_seed_refuses_production(self):
        with patch.object(local_seed, "is_production_environment", return_value=True):
            with self.assertRaises(SystemExit):
                local_seed.guard_local_seed()

    def test_dummy_account_emails_are_login_compatible(self):
        from pydantic import EmailStr, TypeAdapter

        adapter = TypeAdapter(EmailStr)
        for spec in local_seed.resolve_local_accounts():
            adapter.validate_python(spec["email"])
            self.assertTrue(spec["password"])
            self.assertNotIn("@gmail.com", spec["email"])
            self.assertNotIn("@happyexchange.net", spec["email"])
