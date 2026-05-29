import hashlib
import logging
from time import time

import httpx

from app.core.config import settings
from app.services.local_uploads import save_local_item_image, should_use_local_upload_fallback

logger = logging.getLogger(__name__)

MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024


class CloudinaryConfigError(RuntimeError):
    """Raised when Cloudinary credentials are missing."""


class CloudinaryUploadError(RuntimeError):
    """Raised when Cloudinary rejects an upload."""


def _build_signature(params: dict[str, str | int], api_secret: str) -> str:
    filtered = {
        key: value
        for key, value in params.items()
        if value is not None and value != ""
    }
    payload = "&".join(f"{key}={filtered[key]}" for key in sorted(filtered))
    return hashlib.sha1(f"{payload}{api_secret}".encode("utf-8")).hexdigest()


def ensure_cloudinary_is_configured() -> None:
    pass


async def upload_image_to_cloudinary(
    *,
    file_name: str,
    content_type: str,
    file_bytes: bytes,
) -> str:
    if (
        not settings.CLOUDINARY_CLOUD_NAME
        or not settings.CLOUDINARY_API_KEY
        or not settings.CLOUDINARY_API_SECRET
    ):
        if should_use_local_upload_fallback():
            logger.warning(
                "Cloudinary not configured — using local uploads folder for development."
            )
            return save_local_item_image(
                file_name=file_name,
                content_type=content_type,
                file_bytes=file_bytes,
            )
        raise CloudinaryConfigError(
            "Cloudinary credentials are not configured. Image uploads are disabled."
        )

    timestamp = int(time())
    upload_params: dict[str, str | int] = {
        "timestamp": timestamp,
    }
    if settings.CLOUDINARY_FOLDER:
        upload_params["folder"] = settings.CLOUDINARY_FOLDER

    signature = _build_signature(upload_params, settings.CLOUDINARY_API_SECRET)
    endpoint = (
        f"https://api.cloudinary.com/v1_1/"
        f"{settings.CLOUDINARY_CLOUD_NAME}/image/upload"
    )

    form_data = {
        **upload_params,
        "api_key": settings.CLOUDINARY_API_KEY,
        "signature": signature,
    }
    files = {
        "file": (file_name or "item-image", file_bytes, content_type),
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(endpoint, data=form_data, files=files)
    except httpx.HTTPError as exc:
        logger.warning("Cloudinary upload request failed: %s", exc)
        raise CloudinaryUploadError(
            "We could not upload that image right now. Please try again in a moment."
        ) from exc

    try:
        payload = response.json()
    except ValueError:
        payload = {}

    if response.is_error:
        error_detail = payload.get("error", {}).get("message")
        logger.warning("Cloudinary upload rejected: %s", error_detail or payload)
        raise CloudinaryUploadError(
            "We could not upload that image right now. Please try another image or try again shortly."
        )

    secure_url = payload.get("secure_url")
    if not secure_url:
        logger.warning("Cloudinary upload succeeded without secure_url: %s", payload)
        raise CloudinaryUploadError(
            "The image upload finished, but the image URL was missing. Please try again."
        )

    return secure_url
