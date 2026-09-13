"""Regression tests for unread-count query efficiency and staff-alert tagging."""

from app.services.notifications import (
    STAFF_ALERT_TYPES,
    is_staff_alert_type,
    user_unread_count_query,
)


class NotificationUnreadQueryTests:
    def test_staff_alert_types_match_known_admin_alerts(self):
        assert "new_user_signup" in STAFF_ALERT_TYPES
        assert "exchange_admin_action" in STAFF_ALERT_TYPES
        assert is_staff_alert_type("new_user_signup") is True
        assert is_staff_alert_type("item_reported") is True
        assert is_staff_alert_type("request_received") is False

    def test_user_unread_count_query_avoids_title_regex(self):
        query = user_unread_count_query("user-123")
        assert query["user_id"] == "user-123"
        assert query["read"] is False
        assert query["is_staff_alert"] == {"$ne": True}
        assert query["type"]["$nin"]
        serialized = str(query)
        assert "$regex" not in serialized
        assert "title" not in serialized
