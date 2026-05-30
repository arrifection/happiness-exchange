"""Generate public/og-image.png (1200x630) for social sharing previews."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "og-image.png"

WIDTH = 1200
HEIGHT = 630

PURPLE = (140, 87, 245)
PURPLE_DARK = (107, 56, 204)
CREAM = (255, 250, 240)
GOLD = (249, 200, 38)
WHITE = (255, 255, 255)


def _load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size=size)
    return ImageFont.load_default()


def draw_brand_mark(draw: ImageDraw.ImageDraw, origin_x: int, origin_y: int, scale: float = 1.0) -> None:
    dot_r = int(6.2 * scale)
    draw.ellipse(
        (origin_x, origin_y, origin_x + dot_r * 2, origin_y + dot_r * 2),
        fill=PURPLE,
    )
    square = (
        origin_x + int(24 * scale),
        origin_y - int(11 * scale),
        origin_x + int(59 * scale),
        origin_y + int(32 * scale),
    )
    draw.rounded_rectangle(square, radius=int(11 * scale), fill=GOLD)
    inner_dot = int(5.3 * scale)
    draw.ellipse(
        (
            origin_x + int(32 * scale),
            origin_y,
            origin_x + int(32 * scale) + inner_dot * 2,
            origin_y + inner_dot * 2,
        ),
        fill=PURPLE,
    )
    end_dot = int(5.2 * scale)
    draw.ellipse(
        (
            origin_x + int(40.5 * scale),
            origin_y + int(18 * scale),
            origin_x + int(40.5 * scale) + end_dot * 2,
            origin_y + int(18 * scale) + end_dot * 2,
        ),
        fill=PURPLE,
    )
    draw.arc(
        (
            origin_x - int(6 * scale),
            origin_y + int(11 * scale),
            origin_x + int(48 * scale),
            origin_y + int(50 * scale),
        ),
        start=300,
        end=120,
        fill=PURPLE,
        width=max(4, int(5.2 * scale)),
    )


def generate() -> Path:
    image = Image.new("RGB", (WIDTH, HEIGHT), CREAM)
    draw = ImageDraw.Draw(image)

    for y in range(HEIGHT):
        ratio = y / HEIGHT
        r = int(PURPLE[0] * (0.12 + 0.08 * ratio) + CREAM[0] * (0.88 - 0.08 * ratio))
        g = int(PURPLE[1] * (0.12 + 0.08 * ratio) + CREAM[1] * (0.88 - 0.08 * ratio))
        b = int(PURPLE[2] * (0.12 + 0.08 * ratio) + CREAM[2] * (0.88 - 0.08 * ratio))
        draw.line([(0, y), (WIDTH, y)], fill=(r, g, b))

    draw.rounded_rectangle((0, 0, WIDTH, 8), radius=0, fill=PURPLE)

    card = (72, 96, WIDTH - 72, HEIGHT - 96)
    draw.rounded_rectangle(card, radius=36, fill=WHITE)

    draw_brand_mark(draw, 120, 170, scale=2.2)

    title_font = _load_font(72, bold=True)
    subtitle_font = _load_font(38, bold=False)
    tagline_font = _load_font(30, bold=False)
    badge_font = _load_font(24, bold=True)

    draw.text((120, 300), "Happiness Exchange", fill=PURPLE_DARK, font=title_font)
    draw.text((120, 390), "Give what you don't need.", fill=(55, 65, 81), font=subtitle_font)
    draw.text((120, 442), "Receive what you do.", fill=(55, 65, 81), font=subtitle_font)
    draw.text((120, 510), "Trusted free item sharing · Pakistan & Saudi Arabia", fill=(104, 118, 109), font=tagline_font)

    badge_box = (860, 130, 1110, 190)
    draw.rounded_rectangle(badge_box, radius=24, fill=PURPLE)
    draw.text((895, 147), "happyexchange.net", fill=WHITE, font=badge_font)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    image.save(OUTPUT, format="PNG", optimize=True)
    return OUTPUT


if __name__ == "__main__":
    path = generate()
    print(f"Wrote {path} ({path.stat().st_size // 1024} KB)")
