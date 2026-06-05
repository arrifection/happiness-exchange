"""Tests for admin-mediated conversation serialization and display mapping."""

from datetime import datetime, timezone
from unittest import TestCase

from bson import ObjectId

from app.api.routes.conversations import serialize_conversation
from app.services.conversations import (
    ADMIN_DISPLAY_NAME,
    ADMIN_LIST_TITLE_PREFIX,
    CHAT_ADMIN_LISTER,
    CHAT_ADMIN_RECEIVER,
)
from app.services.message_identity import (
    MESSAGE_SOURCE_ADMIN_PANEL,
    MESSAGE_SOURCE_MEMBER_REPLY,
    SENDER_ROLE_ADMIN,
    SENDER_ROLE_USER,
    serialize_message_fields,
)


def _mediated_conv(*, chat_type, member_id, member_name, member_role, admin_id=None):
    admin_id = admin_id or str(ObjectId())
    return {
        "_id": ObjectId(),
        "item_id": str(ObjectId()),
        "item_title": "Handsfree/Earphones",
        "request_id": str(ObjectId()),
        "created_at": datetime.now(timezone.utc),
        "chat_type": chat_type,
        "admin_id": admin_id,
        "admin_name": "Sarah Ahmed",
        "admin_display_name": ADMIN_DISPLAY_NAME,
        "member_id": member_id,
        "member_name": member_name,
        "member_role": member_role,
        "giver_id": str(ObjectId()),
        "giver_name": "Donor",
        "receiver_id": str(ObjectId()),
        "receiver_name": "Requester",
        "unread_counts": {admin_id: 0, member_id: 0},
    }


class ConversationSerializeTests(TestCase):
    def test_member_receiver_chat_title_and_roles(self):
        member_id = str(ObjectId())
        conv = _mediated_conv(
            chat_type=CHAT_ADMIN_RECEIVER,
            member_id=member_id,
            member_name="sarah",
            member_role="receiver",
        )
        member_user = {"id": member_id, "role": "user"}

        payload = serialize_conversation(conv, member_user)

        self.assertEqual(payload["role_label"], "Receiver")
        self.assertEqual(payload["counterpart_name"], ADMIN_DISPLAY_NAME)
        self.assertEqual(payload["admin_name"], ADMIN_DISPLAY_NAME)
        self.assertEqual(payload["member_name"], "sarah")
        self.assertEqual(payload["list_title"], f"{ADMIN_LIST_TITLE_PREFIX} — Handsfree/Earphones")
        self.assertNotIn("Sarah Ahmed", payload["list_title"])

    def test_member_lister_chat_title_and_roles(self):
        member_id = str(ObjectId())
        conv = _mediated_conv(
            chat_type=CHAT_ADMIN_LISTER,
            member_id=member_id,
            member_name="Muaaz Khan",
            member_role="lister",
        )
        member_user = {"id": member_id, "role": "user"}

        payload = serialize_conversation(conv, member_user)

        self.assertEqual(payload["role_label"], "Lister")
        self.assertEqual(payload["list_title"], f"{ADMIN_LIST_TITLE_PREFIX} — Handsfree/Earphones")
        self.assertEqual(payload["counterpart_name"], ADMIN_DISPLAY_NAME)

    def test_staff_sees_member_in_list_title_not_admin_name(self):
        member_id = str(ObjectId())
        conv = _mediated_conv(
            chat_type=CHAT_ADMIN_LISTER,
            member_id=member_id,
            member_name="Muaaz Khan",
            member_role="lister",
        )
        staff = {"id": str(ObjectId()), "role": "super_admin"}

        payload = serialize_conversation(conv, staff)

        self.assertEqual(payload["role_label"], "Lister")
        self.assertEqual(payload["counterpart_name"], "Muaaz Khan")
        self.assertEqual(payload["list_title"], "Lister: Muaaz Khan — Handsfree/Earphones")
        self.assertEqual(payload["admin_name"], ADMIN_DISPLAY_NAME)

    def test_staff_who_is_also_member_gets_member_view(self):
        member_id = str(ObjectId())
        conv = _mediated_conv(
            chat_type=CHAT_ADMIN_LISTER,
            member_id=member_id,
            member_name="Sarah Ahmed",
            member_role="lister",
        )
        staff_member = {"id": member_id, "role": "super_admin"}

        payload = serialize_conversation(conv, staff_member)

        self.assertEqual(payload["role_label"], "Lister")
        self.assertEqual(payload["list_title"], f"{ADMIN_LIST_TITLE_PREFIX} — Handsfree/Earphones")
        self.assertEqual(payload["counterpart_name"], ADMIN_DISPLAY_NAME)


class MessageDisplayIdentityTests(TestCase):
    def test_admin_panel_message_normalized_to_admin_display_name(self):
        conv = _mediated_conv(
            chat_type=CHAT_ADMIN_RECEIVER,
            member_id=str(ObjectId()),
            member_name="sarah",
            member_role="receiver",
        )
        doc = {
            "_id": ObjectId(),
            "conversation_id": str(conv["_id"]),
            "sender_id": str(ObjectId()),
            "sender_role": SENDER_ROLE_ADMIN,
            "message_source": MESSAGE_SOURCE_ADMIN_PANEL,
            "sender_name": "Sarah Ahmed",
            "text": "hi",
            "created_at": datetime.now(timezone.utc),
        }

        payload = serialize_message_fields(doc, conv=conv)

        self.assertEqual(payload["sender_role"], SENDER_ROLE_ADMIN)
        self.assertEqual(payload["sender_name"], ADMIN_DISPLAY_NAME)

    def test_member_reply_stays_member(self):
        member_id = str(ObjectId())
        conv = _mediated_conv(
            chat_type=CHAT_ADMIN_RECEIVER,
            member_id=member_id,
            member_name="sarah",
            member_role="receiver",
        )
        doc = {
            "_id": ObjectId(),
            "conversation_id": str(conv["_id"]),
            "sender_id": member_id,
            "sender_role": SENDER_ROLE_USER,
            "message_source": MESSAGE_SOURCE_MEMBER_REPLY,
            "sender_name": "sarah",
            "text": "thanks",
            "created_at": datetime.now(timezone.utc),
        }

        payload = serialize_message_fields(doc, conv=conv)

        self.assertEqual(payload["sender_role"], SENDER_ROLE_USER)
        self.assertEqual(payload["sender_name"], "sarah")

    def test_messages_are_scoped_by_conversation_id(self):
        receiver_conv_id = str(ObjectId())
        lister_conv_id = str(ObjectId())

        receiver_msg = {
            "_id": ObjectId(),
            "conversation_id": receiver_conv_id,
            "sender_id": str(ObjectId()),
            "sender_role": SENDER_ROLE_ADMIN,
            "message_source": MESSAGE_SOURCE_ADMIN_PANEL,
            "sender_name": ADMIN_DISPLAY_NAME,
            "text": "receiver thread only",
            "created_at": datetime.now(timezone.utc),
        }
        lister_msg = {
            "_id": ObjectId(),
            "conversation_id": lister_conv_id,
            "sender_id": str(ObjectId()),
            "sender_role": SENDER_ROLE_ADMIN,
            "message_source": MESSAGE_SOURCE_ADMIN_PANEL,
            "sender_name": ADMIN_DISPLAY_NAME,
            "text": "lister thread only",
            "created_at": datetime.now(timezone.utc),
        }

        receiver_docs = [m for m in (receiver_msg, lister_msg) if m["conversation_id"] == receiver_conv_id]
        lister_docs = [m for m in (receiver_msg, lister_msg) if m["conversation_id"] == lister_conv_id]

        self.assertEqual(len(receiver_docs), 1)
        self.assertEqual(receiver_docs[0]["text"], "receiver thread only")
        self.assertEqual(len(lister_docs), 1)
        self.assertEqual(lister_docs[0]["text"], "lister thread only")
