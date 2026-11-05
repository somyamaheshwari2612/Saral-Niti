#!/usr/bin/env python3
"""
backend/scripts/generate_icons.py
---------------------------------
Generates high-resolution PWA icons (192x192, 512x512, maskable, favicon)
and scalable SVG icon for Saral Niti citizen welfare portal.
"""

import os
from PIL import Image, ImageDraw, ImageFont

ICONS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'static', 'icons'))
os.makedirs(ICONS_DIR, exist_ok=True)

def create_pwa_icon(size=512, is_maskable=False):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Padding
    pad = int(size * 0.1) if is_maskable else int(size * 0.04)
    r = int(size * 0.22) if not is_maskable else 0

    # Draw base card background
    bg_box = [pad, pad, size - pad, size - pad]
    if is_maskable:
        # Full bleed for maskable
        draw.rectangle([0, 0, size, size], fill="#0F172A")
        # Central circular gradient-like backdrop
        draw.ellipse([pad, pad, size - pad, size - pad], fill="#1E3A8A")
    else:
        draw.rounded_rectangle(bg_box, radius=r, fill="#0F172A")
        # Gradient inner card
        inner_pad = pad + int(size * 0.02)
        draw.rounded_rectangle([inner_pad, inner_pad, size - inner_pad, size - inner_pad], radius=r-int(size*0.02), fill="#1E293B")

    # Center circle for emblem
    center_x = size // 2
    center_y = size // 2
    circle_r = int(size * 0.32)

    # Tricolor outer decorative glow / rings
    # Saffron arc (top-right)
    draw.arc([center_x - circle_r - 8, center_y - circle_r - 8, center_x + circle_r + 8, center_y + circle_r + 8],
             start=200, end=340, fill="#FF9933", width=max(4, size // 64))
    # Green arc (bottom-left)
    draw.arc([center_x - circle_r - 8, center_y - circle_r - 8, center_x + circle_r + 8, center_y + circle_r + 8],
             start=20, end=160, fill="#10B981", width=max(4, size // 64))

    # Inner circular medallion
    draw.ellipse([center_x - circle_r, center_y - circle_r, center_x + circle_r, center_y + circle_r], fill="#2563EB")

    # Inner subtle border
    draw.ellipse([center_x - circle_r + 4, center_y - circle_r + 4, center_x + circle_r - 4, center_y + circle_r - 4],
                 outline="#60A5FA", width=max(2, size // 128))

    # Try font loading: mangalb.ttf, Nirmala.ttc, or fallback
    font_size = int(size * 0.38)
    font = None
    for font_path in [
        "C:/Windows/Fonts/mangalb.ttf",
        "C:/Windows/Fonts/mangal.ttf",
        "C:/Windows/Fonts/Nirmala.ttc",
        "C:/Windows/Fonts/arialbd.ttf"
    ]:
        if os.path.exists(font_path):
            try:
                font = ImageFont.truetype(font_path, font_size)
                break
            except Exception:
                continue

    char = "स"
    if font is None:
        font = ImageFont.load_default()
        char = "S"

    # Position character in center
    bbox = draw.textbbox((0, 0), char, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]

    # Center calculation
    tx = center_x - (bbox[0] + bbox[2]) / 2
    ty = center_y - (bbox[1] + bbox[3]) / 2 - int(size * 0.02)

    draw.text((tx, ty), char, fill="#FFFFFF", font=font)

    return img


def generate_svg():
    svg_content = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1E293B"/>
      <stop offset="100%" stop-color="#0F172A"/>
    </linearGradient>
    <linearGradient id="blueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3B82F6"/>
      <stop offset="100%" stop-color="#1D4ED8"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.5"/>
    </filter>
  </defs>
  <!-- Background Squircle -->
  <rect x="24" y="24" width="464" height="464" rx="112" fill="url(#bgGrad)" stroke="#334155" stroke-width="4"/>
  
  <!-- Tricolor Accent Arcs -->
  <path d="M 140 140 A 176 176 0 0 1 372 140" fill="none" stroke="#FF9933" stroke-width="8" stroke-linecap="round"/>
  <path d="M 372 372 A 176 176 0 0 1 140 372" fill="none" stroke="#10B981" stroke-width="8" stroke-linecap="round"/>
  
  <!-- Central Emblem Medallion -->
  <circle cx="256" cy="256" r="150" fill="url(#blueGrad)" filter="url(#shadow)"/>
  <circle cx="256" cy="256" r="142" fill="none" stroke="#60A5FA" stroke-width="3" opacity="0.6"/>
  
  <!-- Devanagari 'स' Character -->
  <text x="256" y="316" font-family="'Sora', 'Mangal', 'Nirmala UI', sans-serif" font-weight="700" font-size="186" fill="#FFFFFF" text-anchor="middle" dominant-baseline="central">स</text>
</svg>"""
    svg_path = os.path.join(ICONS_DIR, "favicon.svg")
    with open(svg_path, "w", encoding="utf-8") as f:
        f.write(svg_content)
    print(f"Generated {svg_path}")


def main():
    print("Generating PWA icons...")
    # 512x512
    icon512 = create_pwa_icon(512, is_maskable=False)
    icon512_path = os.path.join(ICONS_DIR, "icon-512.png")
    icon512.save(icon512_path, format="PNG")
    print(f"Generated {icon512_path}")

    # 192x192
    icon192 = icon512.resize((192, 192), Image.Resampling.LANCZOS)
    icon192_path = os.path.join(ICONS_DIR, "icon-192.png")
    icon192.save(icon192_path, format="PNG")
    print(f"Generated {icon192_path}")

    # 512x512 Maskable
    icon_maskable = create_pwa_icon(512, is_maskable=True)
    maskable_path = os.path.join(ICONS_DIR, "icon-maskable.png")
    icon_maskable.save(maskable_path, format="PNG")
    print(f"Generated {maskable_path}")

    # Favicon ICO
    fav_path = os.path.join(ICONS_DIR, "favicon.ico")
    icon512.resize((64, 64), Image.Resampling.LANCZOS).save(
        fav_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)]
    )
    print(f"Generated {fav_path}")

    # SVG Icon
    generate_svg()

    print("All icons successfully generated!")

if __name__ == "__main__":
    main()

