"""Upload public/og-image.png to Cloudinary for social preview meta tags."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv

load_dotenv()

from app.services.cloudinary import upload_image_to_cloudinary


async def main() -> int:
    image_path = Path(__file__).resolve().parents[1] / "public" / "og-image.png"
    if not image_path.is_file():
        print(f"Missing {image_path}")
        return 1

    file_bytes = image_path.read_bytes()
    url = await upload_image_to_cloudinary(
        file_name="og-image.png",
        content_type="image/png",
        file_bytes=file_bytes,
    )
    print(url)
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
