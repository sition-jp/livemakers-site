#!/usr/bin/env python3
"""LiveMakers Weekly Brief thumbnail renderer (PIL one-off).

W19 introduces programmatic text-overlay rendering, replacing the prior
Canva manual workflow. This is the Plan B prototype — kept self-contained.
A future Plan C migration will fold this into
`auto_publisher/po/overlay_generator.py` with a proper
`render_weekly_brief_thumbnail` function + regression tests.

Visual style:
  - Background: MJ-generated art resized to 1792x1024
  - Top-left: rounded "LIVEMAKERS / WEEKLY BRIEF" badge (PIL native)
  - Bottom: semi-transparent dark gradient panel for title legibility
  - Title block: 4 lines (issue meta / main title / subtitle / metrics line)

Usage:
    python3 scripts/brief/render_thumbnail.py \\
        --art ~/Downloads/sition_sipo_..._1.png \\
        --output public/brief/2026-W19-brief/thumbnail.png \\
        --week-label "VOL.05 · W19 · 2026-05-09" \\
        --title "TRINITY GOES LIVE" \\
        --subtitle "CARDANO ASSEMBLES AI AGENT FINANCE LAYER" \\
        --metrics-line "EPOCH 629 · ADA \\$0.276 · NIGHT \\$0.033"
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

# --- Visual constants ---
CANVAS_W = 1792
CANVAS_H = 1024

# Bottom gradient panel (for title block legibility)
PANEL_RATIO = 0.42  # bottom 42% gets gradient
PANEL_BG = (8, 10, 22)  # near-black #080A16

# Top-left LIVEMAKERS badge
BADGE_POS = (40, 40)
BADGE_W = 280
BADGE_H = 88
BADGE_BG = (10, 10, 14, 220)  # near-black, mostly opaque
BADGE_BORDER = (255, 184, 0, 255)  # amber
BADGE_BORDER_WIDTH = 2
BADGE_RADIUS = 8

# Title block
TITLE_BLOCK_LEFT = 64
TITLE_BLOCK_BOTTOM_MARGIN = 64
TITLE_LINE_GAP = 16

# Colors
COLOR_BRAND_MAIN = (255, 255, 255, 255)
COLOR_META = (255, 255, 255, 200)
COLOR_TITLE = (255, 184, 0, 255)  # amber FFB800
COLOR_SUBTITLE = (255, 255, 255, 240)
COLOR_METRICS = (0, 212, 255, 255)  # cyan 00D4FF

# Font paths (macOS)
FONT_HELV_BOLD = "/System/Library/Fonts/Helvetica.ttc"  # index 1 = bold
FONT_HELV_REG = "/System/Library/Fonts/Helvetica.ttc"
FONT_MONO = "/System/Library/Fonts/SFNSMono.ttf"

# Japanese fonts (Hiragino Sans family supports both kana and kanji).
# Index 0 of W7 = bold weight for titles; W3 = regular for subtitles/meta.
FONT_JA_BOLD = "/System/Library/Fonts/ヒラギノ角ゴシック W7.ttc"
FONT_JA_REG = "/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc"

FALLBACK = "/System/Library/Fonts/Helvetica.ttc"


def _font(path: str, size: int, index: int = 0) -> ImageFont.FreeTypeFont:
    try:
        return ImageFont.truetype(path, size, index=index)
    except (OSError, IOError):
        return ImageFont.truetype(FALLBACK, size)


def load_and_resize_art(art_path: Path) -> Image.Image:
    """Load MJ art, convert RGBA, resize to 1792x1024 with LANCZOS."""
    img = Image.open(art_path).convert("RGBA")
    if img.size != (CANVAS_W, CANVAS_H):
        img = img.resize((CANVAS_W, CANVAS_H), Image.Resampling.LANCZOS)
    return img


def apply_bottom_gradient(canvas: Image.Image) -> Image.Image:
    """Draw a top-to-bottom gradient over the lower PANEL_RATIO of the canvas."""
    w, h = canvas.size
    panel_h = int(h * PANEL_RATIO)
    panel_top = h - panel_h

    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for y in range(panel_top, h):
        progress = (y - panel_top) / panel_h
        # Ease-in: 0 at top, ~220 at bottom
        alpha = int(220 * min(1.0, progress * 1.15))
        draw.line([(0, y), (w - 1, y)], fill=(*PANEL_BG, alpha))

    out = canvas.copy()
    out.alpha_composite(overlay)
    return out


def draw_badge(canvas: Image.Image) -> Image.Image:
    """Top-left rounded badge: 'LIVEMAKERS / WEEKLY BRIEF'."""
    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    x, y = BADGE_POS
    # Rounded rectangle background
    draw.rounded_rectangle(
        [(x, y), (x + BADGE_W, y + BADGE_H)],
        radius=BADGE_RADIUS,
        fill=BADGE_BG,
        outline=BADGE_BORDER,
        width=BADGE_BORDER_WIDTH,
    )

    # Text inside
    f_brand = _font(FONT_HELV_BOLD, 26, index=1)
    f_sub = _font(FONT_HELV_REG, 18)

    draw.text((x + 18, y + 14), "LIVEMAKERS", font=f_brand, fill=(255, 184, 0, 255))
    draw.text((x + 18, y + 50), "WEEKLY BRIEF", font=f_sub, fill=(0, 212, 255, 255))

    out = canvas.copy()
    out.alpha_composite(overlay)
    return out


def draw_title_block(
    canvas: Image.Image,
    *,
    week_label: str,
    title: str,
    subtitle: str,
    metrics_line: str,
    font_lang: str = "en",
) -> Image.Image:
    """Bottom-left title block — 4 lines.

    font_lang: "en" uses Helvetica (default; backward compatible with W19).
               "ja" uses Hiragino Sans for week_label/title/subtitle to render
               Japanese characters correctly. The metrics line always uses the
               mono font since it's ASCII numerics either way.
    """
    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    if font_lang == "ja":
        f_meta = _font(FONT_JA_REG, 26)
        f_title = _font(FONT_JA_BOLD, 64)
        f_subtitle = _font(FONT_JA_BOLD, 36)
    else:
        f_meta = _font(FONT_HELV_REG, 26)
        f_title = _font(FONT_HELV_BOLD, 64, index=1)
        f_subtitle = _font(FONT_HELV_BOLD, 36, index=1)
    f_metrics = _font(FONT_MONO, 24)

    # Compute text heights (use getbbox)
    def line_h(font: ImageFont.FreeTypeFont, text: str) -> int:
        bbox = font.getbbox(text)
        return bbox[3] - bbox[1]

    h_meta = line_h(f_meta, week_label)
    h_title = line_h(f_title, title)
    h_subtitle = line_h(f_subtitle, subtitle)
    h_metrics = line_h(f_metrics, metrics_line)

    total_h = h_meta + h_title + h_subtitle + h_metrics + TITLE_LINE_GAP * 3

    y_bottom = CANVAS_H - TITLE_BLOCK_BOTTOM_MARGIN
    y_meta = y_bottom - total_h
    y_title = y_meta + h_meta + TITLE_LINE_GAP
    y_subtitle = y_title + h_title + TITLE_LINE_GAP
    y_metrics = y_subtitle + h_subtitle + TITLE_LINE_GAP

    x = TITLE_BLOCK_LEFT

    draw.text((x, y_meta), week_label, font=f_meta, fill=COLOR_META)
    draw.text((x, y_title), title, font=f_title, fill=COLOR_TITLE)
    draw.text((x, y_subtitle), subtitle, font=f_subtitle, fill=COLOR_SUBTITLE)
    draw.text((x, y_metrics), metrics_line, font=f_metrics, fill=COLOR_METRICS)

    out = canvas.copy()
    out.alpha_composite(overlay)
    return out


def render(
    *,
    art_path: Path,
    output_path: Path,
    week_label: str,
    title: str,
    subtitle: str,
    metrics_line: str,
    font_lang: str = "en",
) -> Path:
    """Full pipeline: art → gradient → badge → title block → save."""
    canvas = load_and_resize_art(art_path)
    canvas = apply_bottom_gradient(canvas)
    canvas = draw_badge(canvas)
    canvas = draw_title_block(
        canvas,
        week_label=week_label,
        title=title,
        subtitle=subtitle,
        metrics_line=metrics_line,
        font_lang=font_lang,
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    # Save as PNG with optimization
    canvas.convert("RGB").save(output_path, "PNG", optimize=True)
    return output_path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--art", required=True, type=Path, help="MJ background image")
    parser.add_argument("--output", required=True, type=Path, help="Output thumbnail path")
    parser.add_argument("--week-label", required=True, help="e.g. 'VOL.05 · W19 · 2026-05-09'")
    parser.add_argument("--title", required=True, help="Main title in CAPS")
    parser.add_argument("--subtitle", required=True, help="Subtitle in CAPS")
    parser.add_argument("--metrics-line", required=True, help="e.g. 'EPOCH 629 · ADA $0.276 · NIGHT $0.033'")
    parser.add_argument(
        "--font-lang",
        choices=["en", "ja"],
        default="en",
        help="Font set for title/subtitle/meta. 'en' (default) = Helvetica. 'ja' = Hiragino Sans for Japanese text rendering.",
    )
    args = parser.parse_args()

    if not args.art.exists():
        print(f"ERROR: art file not found: {args.art}", file=sys.stderr)
        return 1

    out = render(
        art_path=args.art,
        output_path=args.output,
        week_label=args.week_label,
        title=args.title,
        subtitle=args.subtitle,
        metrics_line=args.metrics_line,
        font_lang=args.font_lang,
    )
    print(f"OK: rendered {out} ({out.stat().st_size:,} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
