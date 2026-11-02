"""Convert the site's PNG/JPG images in assets/img to WebP (keeps alpha). Originals stay as sources.

Usage:  python scripts/optimize-images.py
Requires Pillow (pip install pillow).
"""
from pathlib import Path
from PIL import Image

SRC = Path(__file__).resolve().parent.parent / "assets" / "img"
# Not referenced by the app; skipped so they don't bloat the deploy.
SKIP = {"living-room-hero.png", "service-cards-pick-compare-book.png"}

total_before = total_after = 0
for path in sorted(SRC.iterdir()):
    if path.suffix.lower() not in {".png", ".jpg", ".jpeg"} or path.name in SKIP:
        continue
    out = path.with_suffix(".webp")
    with Image.open(path) as im:
        im.save(out, "WEBP", quality=82, method=6)
    before, after = path.stat().st_size, out.stat().st_size
    total_before += before
    total_after += after
    print(f"{path.name:42s} {before // 1024:4d} KB -> {after // 1024:4d} KB")

print(f"total {total_before // 1024} KB -> {total_after // 1024} KB")
