"""UGC XSS safety — no unsafe HTML rendering paths; payloads stored as plain text."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest import IsolatedAsyncioTestCase

from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import auth as auth_deps
from app.api.routes import conversations as conversations_routes
from app.schemas.items import ItemCreateRequest
from app.services.items import build_item_document, serialize_item

SCRIPT_PAYLOAD = "<script>alert(1)</script>"
HTML_PAYLOAD = "<img src=x onerror=alert(1)>"


class UgcXssSafetyTests(IsolatedAsyncioTestCase):
    def test_frontend_has_no_dangerously_set_inner_html(self):
        repo_root = Path(__file__).resolve().parents[2]
        patterns = ("dangerouslySetInnerHTML", ".innerHTML", "insertAdjacentHTML")
        offenders: list[str] = []
        for subdir in ("src", Path("admin panel") / "src"):
            root = repo_root / subdir
            if not root.exists():
                continue
            for path in root.rglob("*"):
                if path.suffix not in {".jsx", ".js", ".tsx", ".ts"}:
                    continue
                text = path.read_text(encoding="utf-8")
                for pattern in patterns:
                    if pattern in text:
                        offenders.append(f"{path.relative_to(repo_root)}: {pattern}")
        self.assertEqual(offenders, [], msg=f"Unsafe HTML rendering found: {offenders}")

    def test_item_description_script_payload_serializes_as_literal_text(self):
        user = {
            "id": str(ObjectId()),
            "name": "Lister",
            "email": "lister@example.com",
        }
        payload = ItemCreateRequest(
            title="Lamp",
            description=f"Bright lamp for study. {SCRIPT_PAYLOAD}",
            category="Home",
            condition="Good",
            location="Karachi",
            country="Pakistan",
            city="Karachi",
        )
        document = build_item_document(payload, user)
        document["_id"] = ObjectId()
        document["created_at"] = datetime.now(timezone.utc)
        serialized = serialize_item(document)
        self.assertIn(SCRIPT_PAYLOAD, serialized["description"])
        self.assertIn("<script>", serialized["description"])

    def test_chat_message_with_html_is_stored_verbatim_not_executed_server_side(self):
        requester_id = str(ObjectId())
        admin_id = str(ObjectId())
        conversation_id = ObjectId()
        now = datetime.now(timezone.utc)

        conversation = {
            "_id": conversation_id,
            "chat_type": "admin_receiver",
            "admin_id": admin_id,
            "member_id": requester_id,
            "request_id": str(ObjectId()),
            "unread_counts": {admin_id: 0, requester_id: 0},
            "admin_display_name": "Happiness Exchange Admin",
        }
        messages: list[dict] = []

        class FakeConversationsCollection:
            async def find_one(self, query):
                if query.get("_id") == conversation_id:
                    return conversation
                return None

            async def update_one(self, query, update):
                return SimpleNamespace(modified_count=1)

        class FakeMessagesCollection:
            async def count_documents(self, query):
                return 0

            async def insert_one(self, document):
                stored = {**document, "_id": ObjectId()}
                messages.append(stored)
                return SimpleNamespace(inserted_id=stored["_id"])

            async def find_one(self, query):
                for message in messages:
                    if message["_id"] == query.get("_id"):
                        return message
                return None

        class FakeUsersCollection:
            async def find_one(self, query):
                oid = query.get("_id")
                if oid is None:
                    return None
                return {
                    "_id": oid,
                    "name": "Requester",
                    "email": "req@example.com",
                    "blocked_users": [],
                }

        async def get_conversations_collection_async():
            return FakeConversationsCollection()

        async def get_messages_collection_async():
            return FakeMessagesCollection()

        async def get_users_collection_async():
            return FakeUsersCollection()

        async def fake_create_notification(*args, **kwargs):
            return None

        conversations_routes.get_conversations_collection_async = get_conversations_collection_async
        conversations_routes.get_messages_collection_async = get_messages_collection_async
        conversations_routes.get_users_collection_async = get_users_collection_async
        conversations_routes.create_notification = fake_create_notification

        app = FastAPI()
        app.include_router(conversations_routes.router, prefix="/api")
        app.dependency_overrides[auth_deps.get_verified_user] = lambda: {
            "id": requester_id,
            "name": "Requester",
            "email": "req@example.com",
            "is_verified": True,
            "whatsapp_number": "+923001234567",
        }

        with TestClient(app) as client:
            response = client.post(
                f"/api/conversations/{conversation_id}/message",
                json={"text": HTML_PAYLOAD, "message_type": "text"},
            )

        self.assertIn(response.status_code, (200, 201), response.text)
        self.assertEqual(messages[0]["text"], HTML_PAYLOAD)
        self.assertIn(HTML_PAYLOAD, response.json()["text"])
