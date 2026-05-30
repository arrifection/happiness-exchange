"""Image upload security validation tests."""

from __future__ import annotations

import io
from unittest import TestCase

from fastapi import HTTPException
from PIL import Image

from app.services.image_validation import MAX_IMAGE_SIZE_BYTES, validate_and_sanitize_image


def _make_png_bytes() -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (8, 8), color="blue").save(buffer, format="PNG")
    return buffer.getvalue()


class ImageUploadSecurityTests(TestCase):
    def test_valid_png_passes_and_is_reencoded(self):
        clean_bytes, content_type, safe_name = validate_and_sanitize_image(
            file_name="photo.png",
            file_bytes=_make_png_bytes(),
            content_type="image/png",
        )
        self.assertEqual(content_type, "image/png")
        self.assertTrue(safe_name.endswith(".png"))
        self.assertTrue(clean_bytes.startswith(b"\x89PNG"))

    def test_fake_jpg_containing_script_is_rejected(self):
        payload = b"\xff\xd8\xff" + b"<script>alert(1)</script>"
        with self.assertRaises(HTTPException) as ctx:
            validate_and_sanitize_image(
                file_name="evil.jpg",
                file_bytes=payload,
                content_type="image/jpeg",
            )
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("Invalid or corrupted", ctx.exception.detail)

    def test_wrong_mime_type_is_rejected(self):
        with self.assertRaises(HTTPException) as ctx:
            validate_and_sanitize_image(
                file_name="photo.png",
                file_bytes=_make_png_bytes(),
                content_type="image/jpeg",
            )
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("does not match", ctx.exception.detail)

    def test_oversized_image_is_rejected(self):
        oversized = b"\x89PNG\r\n\x1a\n" + (b"0" * (MAX_IMAGE_SIZE_BYTES + 1))
        with self.assertRaises(HTTPException) as ctx:
            validate_and_sanitize_image(
                file_name="large.png",
                file_bytes=oversized,
                content_type="image/png",
            )
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("too large", ctx.exception.detail.lower())

    def test_svg_upload_is_rejected(self):
        svg_bytes = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
        with self.assertRaises(HTTPException) as ctx:
            validate_and_sanitize_image(
                file_name="icon.svg",
                file_bytes=svg_bytes,
                content_type="image/svg+xml",
            )
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("SVG", ctx.exception.detail)

    def test_corrupted_image_is_rejected(self):
        with self.assertRaises(HTTPException) as ctx:
            validate_and_sanitize_image(
                file_name="broken.png",
                file_bytes=b"\x89PNG\r\n\x1a\n" + b"not-a-real-png",
                content_type="image/png",
            )
        self.assertEqual(ctx.exception.status_code, 400)

    def test_renamed_executable_extension_is_rejected(self):
        with self.assertRaises(HTTPException) as ctx:
            validate_and_sanitize_image(
                file_name="payload.exe",
                file_bytes=_make_png_bytes(),
                content_type="image/png",
            )
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("not allowed", ctx.exception.detail.lower())

    def test_extension_content_mismatch_is_rejected(self):
        with self.assertRaises(HTTPException) as ctx:
            validate_and_sanitize_image(
                file_name="photo.jpg",
                file_bytes=_make_png_bytes(),
                content_type="image/png",
            )
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("extension", ctx.exception.detail.lower())
