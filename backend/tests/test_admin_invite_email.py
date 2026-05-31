"""Email helper tests for admin invite links."""

from unittest import TestCase

from app.core.config import settings
from app.services.email import build_admin_invite_link, get_email_diagnostics


class AdminInviteEmailTests(TestCase):
    def test_build_admin_invite_link_uses_admin_panel_url(self):
        link = build_admin_invite_link("abc123token")
        self.assertTrue(link.startswith(settings.ADMIN_PANEL_URL.rstrip("/")))
        self.assertIn("/accept-invite?token=abc123token", link)
        self.assertNotIn(settings.APP_BASE_URL.rstrip("/"), link)

    def test_email_diagnostics_include_admin_panel_url(self):
        diagnostics = get_email_diagnostics()
        self.assertIn("admin_panel_url", diagnostics)
        self.assertEqual(
            diagnostics["admin_panel_url"],
            settings.ADMIN_PANEL_URL.rstrip("/"),
        )
