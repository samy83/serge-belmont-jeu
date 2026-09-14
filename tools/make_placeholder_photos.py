#!/usr/bin/env python3
"""
Photographies de substitution : dix images 900 x 1280 (les proportions du
cadre du plateau) au grain de vieille pellicule, une palette par niveau.
Elles n'ont aucune valeur artistique : elles servent a evaluer la mecanique de
revelation en attendant les vraies photographies de Serge Belmont.

Pour remplacer une photo : deposer un fichier au meme nom dans public/photos/
(ou changer `photo.src` dans le niveau). Aucune ligne de code a toucher.

    python tools/make_placeholder_photos.py
"""
from __future__ import annotations

import json
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "photos"
LEVELS = ROOT / "src" / "data" / "levels"
W, H = 900, 1280

# Palettes "souvenir" : (haut, milieu, bas) en RGB.
PALETTES = [
    ((214, 176, 122), (150, 104, 66), (58, 38, 30)),   # sepia dore
    ((196, 200, 210), (120, 128, 146), (40, 44, 58)),  # argentique
    ((222, 170, 150), (156, 96, 96), (60, 32, 44)),    # rose poudre
    ((170, 196, 190), (90, 128, 128), (30, 50, 58)),   # vert-de-gris
    ((236, 206, 150), (176, 120, 70), (70, 40, 26)),   # ambre
    ((190, 176, 210), (118, 96, 150), (44, 30, 64)),   # lavande
    ((210, 190, 160), (130, 110, 90), (48, 40, 34)),   # kraft
    ((160, 190, 220), (80, 110, 160), (26, 36, 66)),   # bleu nuit
    ((230, 210, 190), (170, 130, 110), (66, 46, 40)),  # peche
    ((200, 180, 140), (120, 96, 60), (40, 30, 20)),    # or vieilli
]


def lerp(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))  # type: ignore[return-value]


def make_photo(index: int, title: str, palette: tuple, seed: int) -> Image.Image:
    rng = random.Random(seed)
    top, mid, bottom = palette
    img = Image.new("RGB", (W, H))
    px = img.load()
    for y in range(H):
        t = y / (H - 1)
        col = lerp(top, mid, t * 2) if t < 0.5 else lerp(mid, bottom, (t - 0.5) * 2)
        for x in range(W):
            px[x, y] = col

    # Formes douces : un "sujet" central et quelques halos (bokeh).
    shapes = Image.new("RGB", (W, H), (0, 0, 0))
    sd = ImageDraw.Draw(shapes)
    cx, cy = W * 0.5 + rng.uniform(-80, 80), H * 0.42 + rng.uniform(-60, 60)
    for k in range(3, 0, -1):
        r = 150 + k * 90
        c = lerp(top, (255, 250, 235), 0.35 - k * 0.08)
        sd.ellipse((cx - r * 0.7, cy - r, cx + r * 0.7, cy + r), fill=c)
    for _ in range(9):
        x, y = rng.uniform(0, W), rng.uniform(0, H)
        r = rng.uniform(30, 120)
        c = lerp(top, (255, 255, 255), rng.uniform(0.2, 0.6))
        sd.ellipse((x - r, y - r, x + r, y + r), fill=c)
    shapes = shapes.filter(ImageFilter.GaussianBlur(70))
    img = Image.blend(img, Image.composite(shapes, img, Image.new("L", (W, H), 90)), 0.55)

    # Vignette : claire au centre (masque 255 = image intacte), sombre aux bords.
    vig = Image.new("L", (W, H), 0)
    vd = ImageDraw.Draw(vig)
    for i in range(40):
        t = i / 39
        pad = int(-260 + t * 300)
        vd.ellipse((pad, pad, W - pad, H - pad), fill=int(255 * min(1.0, 0.35 + t)))
    vig = vig.filter(ImageFilter.GaussianBlur(80))
    dark = Image.new("RGB", (W, H), lerp(bottom, (0, 0, 0), 0.5))
    img = Image.composite(img, dark, vig)

    # Grain de pellicule.
    grain = Image.effect_noise((W, H), 26).convert("L")
    grain_rgb = Image.merge("RGB", (grain, grain, grain))
    img = Image.blend(img, grain_rgb, 0.10)

    # Texte : numero discret et mention de substitution, sur un calque fondu.
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    try:
        big = ImageFont.truetype("georgia.ttf", 260)
        small = ImageFont.truetype("georgia.ttf", 30)
        tiny = ImageFont.truetype("arial.ttf", 20)
    except OSError:
        big = ImageFont.load_default()
        small = big
        tiny = big
    num = f"{index:02d}"
    bbox = d.textbbox((0, 0), num, font=big)
    d.text(((W - (bbox[2] - bbox[0])) / 2, H * 0.34), num, font=big, fill=(255, 250, 235, 46))
    bbox = d.textbbox((0, 0), title, font=small)
    d.text(((W - (bbox[2] - bbox[0])) / 2, H * 0.80), title, font=small, fill=(255, 250, 235, 200))
    note = "Serge Belmont · photographie de substitution"
    bbox = d.textbbox((0, 0), note, font=tiny)
    d.text(((W - (bbox[2] - bbox[0])) / 2, H * 0.845), note, font=tiny, fill=(255, 250, 235, 120))
    # Liseret interieur.
    d.rectangle((22, 22, W - 23, H - 23), outline=(255, 245, 220, 70), width=2)
    img = Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")
    return img


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    files = sorted(LEVELS.glob("level-*.json"))
    for i, path in enumerate(files):
        level = json.loads(path.read_text(encoding="utf-8"))
        index = int(level.get("index", i + 1))
        title = level.get("photo", {}).get("title") or level.get("name", f"Niveau {index}")
        src = level.get("photo", {}).get("src", f"photos/level-{index:02d}.jpg")
        out = ROOT / "public" / src
        out.parent.mkdir(parents=True, exist_ok=True)
        img = make_photo(index, title, PALETTES[(index - 1) % len(PALETTES)], seed=1000 + index)
        img.save(out, "JPEG", quality=82, optimize=True, progressive=True)
        print(f"{out.relative_to(ROOT)}  {out.stat().st_size // 1024} Ko")


if __name__ == "__main__":
    main()
