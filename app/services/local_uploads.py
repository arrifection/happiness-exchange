import logging
import mimetypes
import os
import uuid
from pathlib import Path

from app.core.config import settings

logger = logging.getLogger(__name__)

UPLOADS_ROOT = Path(__file__).resolve().parents[2] / "uploads"
ITEMS_UPLOAD_DIR = UPLOADS_ROOT / "items"


def is_huggingface_space() -> bool:
    return bool(os.getenv("SPACE_ID") or os.getenv("SYSTEM") == "spaces")


def is_local_dev_environment() -> bool:
    mongo = (settings.MONGODB_URI or "").lower()
    return any(host in mongo for host in ("localhost", "127.0.0.1"))


def should_use_local_upload_fallback() -> bool:
    if is_huggingface_space():
        return False
    explicit = os.getenv("ENABLE_LOCAL_IMAGE_UPLOADS", "").strip().lower()
    if explicit in ("0", "false", "no"):
        return False
    if explicit in ("1", "true", "yes"):
        return True
    if is_local_dev_environment():
        return True
    # Local uvicorn on a dev machine (Atlas is fine) when Cloudinary is not configured.
    return not (
        settings.CLOUDINARY_CLOUD_NAME
        and settings.CLOUDINARY_API_KEY
        and settings.CLOUDINARY_API_SECRET
    )


def local_upload_base_url() -> str:
    explicit = (getattr(settings, "PUBLIC_API_BASE_URL", "") or "").strip()
    if explicit:
        return explicit.rstrip("/")
    return "http://127.0.0.1:8000"


def save_local_item_image(
    *,
    file_name: str,
    content_type: str,
    file_bytes: bytes,
) -> str:
    ITEMS_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    extension = Path(file_name or "").suffix.lower()
    if not extension or len(extension) > 6:
        guessed = mimetypes.guess_extension(content_type or "") or ".jpg"
        extension = guessed if guessed != ".jpe" else ".jpg"

    stored_name = f"{uuid.uuid4().hex}{extension}"
    target_path = ITEMS_UPLOAD_DIR / stored_name
    target_path.write_bytes(file_bytes)

    public_url = f"{local_upload_base_url()}/api/uploads/items/{stored_name}"
    logger.info("Saved local dev item image: %s", stored_name)
    return public_url
