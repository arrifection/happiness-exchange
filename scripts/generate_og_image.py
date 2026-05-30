"""Generate public/og-image.png (1200x630) for social sharing previews."""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "og-image.png"

WIDTH = 1200
HEIGHT = 630
SAFE = 88

PURPLE = (140, 87, 245)
PURPLE_DARK = (107, 56, 204)
PURPLE_DEEP = (88, 48, 196)
CREAM = (255, 251, 245)
WHITE = (255, 255, 255)
GOLD = (249, 200, 38)
MUTED = (237, 233, 255)


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


def _text_size(draw: ImageDraw.ImageDraw, text: str, font) -> tuple[int, int]:
    box = draw.textbbox((0, 0), text, font=font)
    return box[2] - box[0], box[3] - box[1]


def _cubic_point(t: float, p0, p1, p2, p3) -> tuple[float, float]:
    u = 1 - t
    x = u**3 * p0[0] + 3 * u**2 * t * p1[0] + 3 * u * t**2 * p2[0] + t**3 * p3[0]
    y = u**3 * p0[1] + 3 * u**2 * t * p1[1] + 3 * u * t**2 * p2[1] + t**3 * p3[1]
    return x, y


def _sample_bezier_segments(segments: list[tuple], steps: int = 40) -> list[tuple[float, float]]:
    points: list[tuple[float, float]] = []
    for p0, p1, p2, p3 in segments:
        for i in range(steps + 1):
            points.append(_cubic_point(i / steps, p0, p1, p2, p3))
    return points


def render_brand_mark(target_width: int) -> Image.Image:
    """Render favicon.svg mark using exact viewBox coordinates (74 x 56)."""
    view_w, view_h = 74, 56
    scale = target_width / view_w
    width = max(1, int(round(view_w * scale)))
    height = max(1, int(round(view_h * scale)))

    mark = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(mark)

    def sx(value: float) -> float:
        return value * scale

    def sy(value: float) -> float:
        return value * scale

    def dot(x: float, y: float, r: float, fill) -> None:
        rx = sx(r)
        draw.ellipse((sx(x) - rx, sy(y) - rx, sx(x) + rx, sy(y) + rx), fill=fill)

    draw.rounded_rectangle(
        (sx(24), sy(5), sx(59), sy(48)),
        radius=max(2, int(round(sx(11)))),
        fill=GOLD,
    )
    dot(12, 16.5, 6.2, PURPLE)
    dot(38, 16.5, 5.3, PURPLE)
    dot(46.5, 34.5, 5.2, PURPLE)

    segments = [
        ((6, 27.5), (6, 41), (15.5, 50), (29.5, 50)),
        ((29.5, 50), (40.5, 50), (48, 44.5), (48, 35)),
    ]
    curve_points = _sample_bezier_segments(segments, steps=36)
    stroke = max(3, int(round(sx(5.2))))
    for idx in range(len(curve_points) - 1):
        x0, y0 = curve_points[idx]
        x1, y1 = curve_points[idx + 1]
        draw.line((sx(x0), sy(y0), sx(x1), sy(y1)), fill=PURPLE, width=stroke)

    return mark


def draw_pill_button(
    draw: ImageDraw.ImageDraw,
    *,
    text: str,
    font,
    center_x: int,
    top_y: int,
    fill,
    text_fill,
    pad_x: int = 36,
    pad_y: int = 18,
) -> tuple[int, int, int, int]:
    text_w, text_h = _text_size(draw, text, font)
    box_w = text_w + pad_x * 2
    box_h = text_h + pad_y * 2
    left = center_x - box_w // 2
    right = left + box_w
    bottom = top_y + box_h
    draw.rounded_rectangle((left, top_y, right, bottom), radius=box_h // 2, fill=fill)
    draw.text((center_x, top_y + box_h // 2), text, fill=text_fill, font=font, anchor="mm")
    return left, top_y, right, bottom


def generate() -> Path:
    image = Image.new("RGB", (WIDTH, HEIGHT), PURPLE)
    draw = ImageDraw.Draw(image)

    for y in range(HEIGHT):
        t = y / max(1, HEIGHT - 1)
        r = int(PURPLE[0] * (1 - t) + PURPLE_DEEP[0] * t)
        g = int(PURPLE[1] * (1 - t) + PURPLE_DEEP[1] * t)
        b = int(PURPLE[2] * (1 - t) + PURPLE_DEEP[2] * t)
        draw.line([(0, y), (WIDTH, y)], fill=(r, g, b))

    glow = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse((760, -140, 1180, 280), fill=(249, 200, 38, 42))
    glow_draw.ellipse((-180, 360, 260, 760), fill=(255, 255, 255, 24))
    image = Image.alpha_composite(image.convert("RGBA"), glow).convert("RGB")
    draw = ImageDraw.Draw(image)

    card_left = SAFE
    card_top = 72
    card_right = WIDTH - SAFE
    card_bottom = HEIGHT - 72
    draw.rounded_rectangle(
        (card_left, card_top, card_right, card_bottom),
        radius=32,
        fill=WHITE,
    )

    inner_left = card_left + 56
    inner_right = card_right - 56
    content_width = inner_right - inner_left

    mark = render_brand_mark(120)
    mark_x = inner_left
    mark_y = card_top + 44
    image.paste(mark, (mark_x, mark_y), mark)

    word_font = _load_font(40, bold=True)
    word_x = mark_x + mark.width + 24
    word_y = mark_y + 4
    draw.text((word_x, word_y), "Happiness", fill=PURPLE, font=word_font)
    draw.text((word_x, word_y + 44), "Exchange", fill=PURPLE, font=word_font)

    title_font = _load_font(52, bold=True)
    subtitle_font = _load_font(30, bold=False)
    footer_font = _load_font(22, bold=False)
    button_font = _load_font(24, bold=True)

    title = "Give what you don't need."
    subtitle = "Receive what you do."
    footer = "Trusted free item sharing · Pakistan & Saudi Arabia"
    button_text = "happyexchange.net"

    header_bottom = max(mark_y + mark.height, word_y + 92)
    title_y = header_bottom + 36
    draw.text((inner_left, title_y), title, fill=(45, 55, 72), font=title_font)
    subtitle_y = title_y + 60
    draw.text((inner_left, subtitle_y), subtitle, fill=(45, 55, 72), font=subtitle_font)

    button_top = subtitle_y + 64
    button_box = draw_pill_button(
        draw,
        text=button_text,
        font=button_font,
        center_x=inner_left + content_width // 2,
        top_y=button_top,
        fill=PURPLE,
        text_fill=WHITE,
        pad_x=40,
        pad_y=18,
    )

    footer_w, footer_h = _text_size(draw, footer, footer_font)
    footer_x = inner_left + max(0, (content_width - footer_w) // 2)
    footer_y = min(button_box[3] + 24, card_bottom - 32 - footer_h)
    draw.text((footer_x, footer_y), footer, fill=(104, 118, 109), font=footer_font)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    image.save(OUTPUT, format="PNG", optimize=True)
    return OUTPUT


if __name__ == "__main__":
    path = generate()
    print(f"Wrote {path} ({path.stat().st_size // 1024} KB)")
