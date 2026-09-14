#!/usr/bin/env python3
"""
Outil d'auteur : engendre les fichiers de niveaux src/data/levels/level-XX.json.

Chaque niveau est decrit ici par un MASQUE (forme) : 'o' = boule, '#' = case
grise, '.' = vide. Les couleurs sont tirees au sort (graine fixe, donc
reproductible) sous deux contraintes verifiees a la generation :
  - aucun groupe de 3 boules de meme couleur au depart (sinon il exploserait
    au premier contact sans effort) ;
  - toutes les boules tiennent (reliees au plafond ou a une case grise).

Les fichiers produits sont de la DONNEE : on peut les retoucher a la main, le
moteur ne connait que le JSON. Relancer ce script ecrase les dix niveaux.

    python tools/gen_levels.py
"""
from __future__ import annotations

import json
import math
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src" / "data" / "levels"

LEGEND = {"R": "ruby", "S": "sapphire", "E": "emerald", "A": "amber", "M": "amethyst", "#": "block", ".": ""}
COLOR_CHARS = {"ruby": "R", "sapphire": "S", "emerald": "E", "amber": "A", "amethyst": "M"}

# --- Les dix niveaux ---------------------------------------------------------
# name, mask, colors, intervalMs, warningMs, extra (sequence, physics...)
LEVELS = [
    {
        "name": "Première lumière",
        "mask": [
            ".oooooooo.",
            ".oooooooo.",
            "..ooooooo.",
        ],
        "intervalMs": 5000,
        "warningMs": 1200,
        "pairBias": 0.55,
    },
    {
        "name": "Reflets",
        "mask": [
            "oooooooooo",
            ".oooooooo.",
            "..oooooo..",
            "...oooo...",
        ],
        "intervalMs": 4500,
        "warningMs": 1100,
        "pairBias": 0.5,
    },
    {
        "name": "La pierre grise",
        "mask": [
            ".oooooooo.",
            ".oooooooo.",
            "..oo##oo..",
            "..oooooo..",
        ],
        "intervalMs": 4500,
        "warningMs": 1100,
        "pairBias": 0.5,
    },
    {
        "name": "Deux fenêtres",
        "mask": [
            "oooo##oooo",
            "oooo##oooo",
            ".ooo##ooo.",
            ".oo.##.oo.",
        ],
        "intervalMs": 4000,
        "warningMs": 1000,
        "pairBias": 0.5,
    },
    {
        "name": "Suspendu",
        "mask": [
            "..........",
            ".###..###.",
            ".ooo..ooo.",
            ".ooo..ooo.",
            "..oo..oo..",
        ],
        "intervalMs": 4000,
        "warningMs": 1000,
        "pairBias": 0.45,
    },
    {
        "name": "Cascade",
        "mask": [
            "oooooooooo",
            ".oooooooo.",
            ".oooooooo.",
            "..oooooo..",
            "..oooooo..",
            "...oooo...",
        ],
        "intervalMs": 4000,
        "warningMs": 1000,
        "pairBias": 0.5,
    },
    {
        "name": "Le couloir",
        "mask": [
            "oooooooooo",
            "oooooooooo",
            ".oooooooo.",
            "..........",
            "###....###",
            "..........",
        ],
        "intervalMs": 3500,
        "warningMs": 900,
        "pairBias": 0.5,
    },
    {
        "name": "Miroir",
        "mask": [
            "ooo....ooo",
            "ooo....ooo",
            "oo......oo",
            "oo......oo",
            "o........o",
        ],
        "intervalMs": 3500,
        "warningMs": 900,
        "pairBias": 0.5,
        "sequence": ["ruby", "sapphire", "emerald", "sapphire"],
    },
    {
        "name": "Le ciel",
        "mask": [
            "oooooooooo",
            "oooooooooo",
            "oooo..oooo",
            "oooo..oooo",
            ".oooooooo.",
            "..oooooo..",
            "...oooo...",
        ],
        "intervalMs": 3200,
        "warningMs": 850,
        "pairBias": 0.5,
    },
    {
        "name": "Portrait",
        "mask": [
            "oooooooooo",
            "oooooooooo",
            "o.oooooo.o",
            "o#oooooo#o",
            "oooooooooo",
            ".oooooooo.",
            "..oooooo..",
            "...oooo...",
        ],
        "intervalMs": 3000,
        "warningMs": 800,
        "pairBias": 0.5,
    },
]

COLORS = ["ruby", "sapphire", "emerald"]


def hex_neighbors(i: int, j: int) -> list[tuple[int, int]]:
    """Voisins d'une cellule en empilement hexagonal (rangees impaires decalees a droite)."""
    if i % 2 == 0:
        diag = [(i - 1, j - 1), (i - 1, j), (i + 1, j - 1), (i + 1, j)]
    else:
        diag = [(i - 1, j), (i - 1, j + 1), (i + 1, j), (i + 1, j + 1)]
    return [(i, j - 1), (i, j + 1)] + diag


def cell(mask: list[str], i: int, j: int) -> str:
    if i < 0 or i >= len(mask) or j < 0 or j >= len(mask[i]):
        return "."
    return mask[i][j]


def group_size(colors: dict[tuple[int, int], str], start: tuple[int, int], color: str) -> int:
    """Taille du groupe de meme couleur qui contiendrait `start` (deja colore ou non)."""
    seen = {start}
    stack = [start]
    while stack:
        i, j = stack.pop()
        for n in hex_neighbors(i, j):
            if n not in seen and colors.get(n) == color:
                seen.add(n)
                stack.append(n)
    return len(seen)


def fill_colors(mask: list[str], colors: list[str], rng: random.Random, pair_bias: float) -> dict[tuple[int, int], str]:
    """Attribue les couleurs cellule par cellule sans jamais former un groupe de 3."""
    cells = [(i, j) for i, row in enumerate(mask) for j, ch in enumerate(row) if ch == "o"]
    for _attempt in range(200):
        assigned: dict[tuple[int, int], str] = {}
        ok = True
        for c in cells:
            candidates = []
            for color in colors:
                assigned[c] = color
                size = group_size(assigned, c, color)
                del assigned[c]
                if size <= 2:
                    candidates.append((color, size))
            if not candidates:
                ok = False
                break
            pairs = [c2 for c2 in candidates if c2[1] == 2]
            singles = [c2 for c2 in candidates if c2[1] == 1]
            if pairs and (not singles or rng.random() < pair_bias):
                assigned[c] = rng.choice(pairs)[0]
            else:
                assigned[c] = rng.choice(singles or pairs)[0]
        if ok:
            return assigned
    raise RuntimeError("impossible de colorer le masque sans groupe de 3")


def check_support(mask: list[str]) -> None:
    """Toutes les boules doivent etre reliees au plafond ou a une case grise."""
    supported: set[tuple[int, int]] = set()
    stack = []
    for i, row in enumerate(mask):
        for j, ch in enumerate(row):
            if ch != "o":
                continue
            anchored = i == 0 or any(cell(mask, a, b) == "#" for a, b in hex_neighbors(i, j))
            if anchored:
                supported.add((i, j))
                stack.append((i, j))
    while stack:
        c = stack.pop()
        for n in hex_neighbors(*c):
            if cell(mask, *n) == "o" and n not in supported:
                supported.add(n)
                stack.append(n)
    loose = [(i, j) for i, row in enumerate(mask) for j, ch in enumerate(row) if ch == "o" and (i, j) not in supported]
    if loose:
        raise RuntimeError(f"boules qui ne tiennent pas : {loose}")


def build_level(index: int, spec: dict, rng: random.Random) -> dict:
    mask = spec["mask"]
    check_support(mask)
    colors = spec.get("colors", COLORS)
    assigned = fill_colors(mask, colors, rng, spec.get("pairBias", 0.5))
    rows = []
    for i, row in enumerate(mask):
        out = []
        for j, ch in enumerate(row):
            if ch == "o":
                out.append(COLOR_CHARS[assigned[(i, j)]])
            else:
                out.append(ch)
        rows.append("".join(out))
    ball_count = len(assigned)
    # Un tir qui rejoint une paire retire 2 boules existantes : ~N/2 tirs sans
    # chute ni gros groupe. L'or recompense les chutes et les cascades.
    gold = max(3, math.ceil(ball_count / 2.3))
    level_id = f"level-{index:02d}"
    return {
        "id": level_id,
        "index": index,
        "name": spec["name"],
        "colors": colors,
        "colorSequence": {
            "sequence": spec.get("sequence", colors),
            "intervalMs": spec["intervalMs"],
            "warningMs": spec["warningMs"],
        },
        "layout": {
            "legend": {k: v for k, v in LEGEND.items() if k in "".join(rows) or k in ".#"},
            "packing": "hex",
            "rows": rows,
        },
        "photo": {
            "src": f"photos/{level_id}.jpg",
            "title": spec["name"],
            "credit": "Photographie de substitution — à remplacer",
            "focusY": 0.4,
        },
        "reveal": {"radiusFactor": 1.7, "softness": 0.55},
        "trophies": {"metric": "shots", "gold": gold, "silver": gold + 4, "bronze": gold + 9},
        "difficulty": {"predictionBounces": -1},
    }


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    rng = random.Random(20260914)
    ids = []
    for n, spec in enumerate(LEVELS, start=1):
        level = build_level(n, spec, rng)
        path = OUT / f"{level['id']}.json"
        path.write_text(json.dumps(level, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        balls = sum(ch in "RSEAM" for row in level["layout"]["rows"] for ch in row)
        ids.append(level["id"])
        print(f"{level['id']}  {level['name']:<18} {balls:3d} boules  or<={level['trophies']['gold']}")
    print(f"{len(ids)} niveaux ecrits dans {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
