"""Generate public/og-image.png for social sharing (1200x630)."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def main() -> None:
    width, height = 1200, 630
    image = Image.new("RGB", (width, height), "#6b38cc")
    draw = ImageDraw.Draw(image)

    for y in range(height):
        ratio = y / max(height - 1, 1)
        red = int(140 + (107 - 140) * ratio)
        green = int(87 + (56 - 87) * ratio)
        blue = int(245 + (204 - 245) * ratio)
        draw.line([(0, y), (width, y)], fill=(red, green, blue))

    draw.ellipse((780, -60, 1140, 300), fill=(249, 200, 38, 46))
    draw.ellipse((-40, 420, 380, 720), fill=(255, 255, 255, 20))

    title_font = ImageFont.load_default()
    subtitle_font = ImageFont.load_default()
    tagline_font = ImageFont.load_default()

    draw.text((96, 220), "Happiness Exchange", fill="#ffffff", font=title_font)
    draw.text((96, 290), "Give & Receive Free Items", fill="#fffbea", font=subtitle_font)
    draw.text((96, 350), "Pakistan · Saudi Arabia", fill="#ede9ff", font=tagline_font)

    output = Path(__file__).resolve().parents[1] / "public" / "og-image.png"
    output.parent.mkdir(parents=True, exist_ok=True)
    image.save(output, format="PNG", optimize=True)
    print(f"Wrote {output}")


if __name__ == "__main__":
    main()
