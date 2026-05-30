from unittest import TestCase

from app.services.display_names import resolve_user_display_name, sanitize_display_name


class DisplayNameTests(TestCase):
    def test_resolve_prefers_full_name(self):
        name = resolve_user_display_name(
            {"full_name": "Sara Khan", "name": "Unknown", "email": "sara@example.com"}
        )
        self.assertEqual(name, "Sara Khan")

    def test_resolve_falls_back_to_email_prefix(self):
        name = resolve_user_display_name({"email": "student.user@example.com"})
        self.assertEqual(name, "student.user")

    def test_unknown_values_are_rejected(self):
        self.assertEqual(sanitize_display_name("Unknown"), "User")
        self.assertEqual(sanitize_display_name("unknown user"), "User")
        self.assertEqual(sanitize_display_name(None), "User")

    def test_final_fallback_is_user(self):
        self.assertEqual(resolve_user_display_name({}), "User")
