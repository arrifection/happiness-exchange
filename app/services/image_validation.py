"""Validate and sanitize uploaded images before storage."""

from __future__ import annotations

import io
from pathlib import Path

from fastapi import HTTPException, status
from PIL import Image, UnidentifiedImageError

MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def _detect_image_type(file_bytes: bytes) -> str | None:
    if file_bytes.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if file_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if len(file_bytes) >= 12 and file_bytes[:4] == b"RIFF" and file_bytes[8:12] == b"WEBP":
        return "webp"
    return None


def _save_format_for_type(image_type: str) -> tuple[str, str]:
    if image_type == "png":
        return "PNG", "image/png"
    if image_type == "webp":
        return "WEBP", "image/webp"
    return "JPEG", "image/jpeg"


def validate_and_sanitize_image(*, file_name: str | None, file_bytes: bytes) -> tuple[bytes, str, str]:
    """
    Validate upload bytes and return re-encoded image bytes, MIME type, and safe filename stem.

    Checks (in order): size, extension whitelist, magic-byte type, Pillow re-encode.
    """
    if len(file_bytes) > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum 5 MB.",
        )

    extension = Path(file_name or "").suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File type not allowed. Use JPG, PNG, or WEBP.",
        )

    detected_type = _detect_image_type(file_bytes)
    if detected_type is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File type not allowed.",
        )

    try:
        image = Image.open(io.BytesIO(file_bytes))
        image.verify()
        image = Image.open(io.BytesIO(file_bytes))
    except (UnidentifiedImageError, OSError, SyntaxError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or corrupted image file.",
        ) from None

    save_format, content_type = _save_format_for_type(detected_type)
    if save_format == "JPEG" and image.mode not in ("RGB", "L"):
        image = image.convert("RGB")

    output = io.BytesIO()
    save_kwargs = {"format": save_format}
    if save_format == "JPEG":
        save_kwargs["quality"] = 85
        save_kwargs["optimize"] = True
    elif save_format == "PNG":
        save_kwargs["optimize"] = True
    elif save_format == "WEBP":
        save_kwargs["quality"] = 85

    try:
        image.save(output, **save_kwargs)
    except OSError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or corrupted image file.",
        ) from None

    clean_bytes = output.getvalue()
    if not clean_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or corrupted image file.",
        )

    stem = Path(file_name or "item-image").stem or "item-image"
    safe_ext = ".jpg" if save_format == "JPEG" else f".{save_format.lower()}"
    return clean_bytes, content_type, f"{stem}{safe_ext}"
