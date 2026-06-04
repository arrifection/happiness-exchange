"""Tests for role normalization."""

import unittest

from app.core.roles import is_admin_role, normalize_user_role


class RoleNormalizationTests(unittest.TestCase):
    def test_normalize_super_admin_variants(self):
        self.assertEqual(normalize_user_role("super_admin"), "super_admin")
        self.assertEqual(normalize_user_role("Super Admin"), "super_admin")
        self.assertEqual(normalize_user_role("SUPER_ADMIN"), "super_admin")
        self.assertEqual(normalize_user_role("superadmin"), "super_admin")

    def test_is_admin_role_accepts_normalized_values(self):
        self.assertTrue(is_admin_role("super_admin"))
        self.assertTrue(is_admin_role("Super Admin"))
        self.assertTrue(is_admin_role("moderator"))
        self.assertTrue(is_admin_role("Admin"))
        self.assertFalse(is_admin_role("user"))
        self.assertFalse(is_admin_role("Super User"))


if __name__ == "__main__":
    unittest.main()
