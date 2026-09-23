"""
Trace the web logo (public/logo.png) into vector paths for the app icon.

Writes mobile/assets/brand/tripmate-glyph.json, which generate-icons.mjs turns
into the launcher icon, adaptive icon layers, splash image and themed icon.
Only needed when the web logo artwork changes.

    pip install pillow numpy potracer
    python mobile/scripts/trace-logo.py
"""
import json
import os

import numpy as np
import potrace
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
LOGO = os.path.join(ROOT, "public", "logo.png")
OUT = os.path.join(ROOT, "mobile", "assets", "brand", "tripmate-glyph.json")
UP = 8  # upscale factor before tracing — smooths the 512px source

src = Image.open(LOGO).convert("RGB")
a = np.asarray(src).astype(np.float32)
H, W = a.shape[:2]
mn, mx = a.min(-1), a.max(-1)
sat = mx - mn

# White glyph (pin, palm, plane, contrail, river): ~#F2F8F8 on a saturated gradient.
white = np.clip((mn - 150.0) / (236.0 - 150.0), 0, 1) * np.clip((70.0 - sat) / 50.0, 0, 1)
# Glyph region only: skips the tile's top highlight and the "TripMate" wordmark.
x0, y0, x1, y1 = 100, 52, 428, 386
region = np.zeros_like(white)
region[y0:y1, x0:x1] = 1
white *= region


def trace(mask01, blur=2.2, turd=60):
    """Upscale + blur + threshold a [0,1] mask, trace it, return SVG path data
    in source (512px) coordinates."""
    img = Image.fromarray((mask01 * 255).astype(np.uint8), "L")
    big = img.resize((W * UP, H * UP), Image.LANCZOS).filter(ImageFilter.GaussianBlur(blur))
    bits = np.asarray(big) > 127
    # potracer treats DARK pixels as foreground, so pass the inverted mask
    # (otherwise it traces the background as a canvas-sized rectangle).
    plist = potrace.Bitmap(np.logical_not(bits)).trace(
        turdsize=turd, turnpolicy=potrace.POTRACE_TURNPOLICY_MINORITY,
        alphamax=1.0, opticurve=True, opttolerance=0.45)
    s = 1.0 / UP

    def pt(p):
        return f"{p.x * s:.2f} {p.y * s:.2f}"

    parts = []
    for curve in plist:
        parts.append(f"M{pt(curve.start_point)}")
        for seg in curve.segments:
            if seg.is_corner:
                parts.append(f"L{pt(seg.c)}L{pt(seg.end_point)}")
            else:
                parts.append(f"C{pt(seg.c1)} {pt(seg.c2)} {pt(seg.end_point)}")
        parts.append("Z")
    return "".join(parts)


# Scene layers inside the pin: flood-fill a colour class from a seed point.
r, g, b = a[..., 0], a[..., 1], a[..., 2]
delta = np.maximum(sat, 1e-6)
hue = np.zeros_like(mx)
m = mx == r
hue[m] = ((g[m] - b[m]) / delta[m]) % 6
m = mx == g
hue[m] = ((b[m] - r[m]) / delta[m]) + 2
m = mx == b
hue[m] = ((r[m] - g[m]) / delta[m]) + 4
hue *= 60


def component(class_mask, seed):
    # .copy(): fromarray shares the numpy buffer read-only, and floodfill
    # silently ignores the resulting write error.
    img = Image.fromarray((class_mask * 255).astype(np.uint8), "L").copy()
    ImageDraw.floodfill(img, seed, 128, thresh=0)
    return (np.asarray(img) == 128).astype(np.float32)


not_white = white < 0.5
lake = component((((hue > 195) & (hue < 250)) & (sat > 60) & not_white).astype(np.float32), (200, 283))
mountains = component(
    (((hue > 250) & (hue < 335)) & (sat > 60) & (mx < 235) & not_white).astype(np.float32), (318, 244))

data = {
    "source": "public/logo.png",
    "viewBox": [0, 0, W, H],
    "glyph": trace(white),
    "lake": trace(lake, blur=2.6, turd=200),
    "mountains": trace(mountains, blur=2.6, turd=200),
    # The sun is partly hidden by the mountains, so it is drawn as a true circle.
    "sun": {"cx": 276, "cy": 241, "r": 32.5},
}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w") as f:
    json.dump(data, f)
print(f"wrote {OUT} ({os.path.getsize(OUT) // 1024} KB)")
