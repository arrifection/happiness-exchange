"""Focused tests for async bcrypt wrappers used by auth routes."""

from unittest import IsolatedAsyncioTestCase

from app.services.auth import (
    hash_password,
    hash_password_async,
    verify_password,
    verify_password_async,
)


class AsyncPasswordHashingTests(IsolatedAsyncioTestCase):
    async def test_hash_password_async_matches_sync_verify(self):
        hashed = await hash_password_async("Password123!")
        self.assertTrue(hashed.startswith("$2"))
        self.assertTrue(verify_password("Password123!", hashed))
        self.assertTrue(await verify_password_async("Password123!", hashed))
        self.assertFalse(await verify_password_async("wrong-password", hashed))

    async def test_verify_password_async_accepts_sync_hashes(self):
        hashed = hash_password("AnotherPass456!")
        self.assertTrue(await verify_password_async("AnotherPass456!", hashed))
        self.assertFalse(await verify_password_async("nope", hashed))
