#!/usr/bin/env python3
"""Contrôle de « Vilevile » : rendu réel + mesures d'impact sur les gabarits.

    python3 specimen.py

Rend la police construite à ses sept graisses via FreeType (donc avar comprise),
et chiffre deux choses que l'œil ne sait pas juger :

  * la variation de largeur du texte par rapport à l'ancien couple
    « Jura de Google + letter-spacing: -0.07em », graisse par graisse ;
  * l'aire des contreformes du Black rapportée à celle du Bold d'origine,
    pour vérifier qu'aucun œil de lettre ne s'est refermé.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont

HERE = Path(__file__).resolve().parent
SOURCE = HERE / "src" / "Jura[wght].ttf"
BUILT = HERE.parent.parent / "fonts" / "vilevile-var.ttf"

WEIGHTS = [(300, "Light"), (400, "Regular"), (500, "Medium"), (600, "SemiBold"),
           (700, "Bold"), (800, "ExtraBold"), (900, "Black")]

SAMPLES = [
    "Idem Africa — Business Plan 2026",
    "Chiffre d'affaires prévisionnel : 12 450 000 FCFA",
    "Analyse de viabilité · Trésorerie · SYSCOHADA",
]


# --- mesures ------------------------------------------------------------------

def advance_sum(path: Path, wght: float, text: str, tracking_units: int = 0) -> float:
    """Largeur d'une chaîne, en unités em, à une graisse donnée."""
    from fontTools.varLib.instancer import instantiateVariableFont

    font = instantiateVariableFont(TTFont(path), {"wght": wght}, inplace=True)
    upem = font["head"].unitsPerEm
    cmap, hmtx = font.getBestCmap(), font["hmtx"]
    total = 0
    for ch in text:
        gname = cmap.get(ord(ch))
        if gname is None:
            continue
        total += hmtx[gname][0] + tracking_units
    return total / upem


def width_report() -> list[str]:
    """Compare l'ancien rendu (Jura + CSS) au nouveau (Vilevile, approche incorporée)."""
    lines = ["  graisse     avant (Jura + CSS -0.07em)     après (Vilevile)    écart"]
    text = " ".join(SAMPLES)
    for wght, style in WEIGHTS:
        # avant : Jura s'arrêtait à 700, au-delà le navigateur ne pouvait que
        # graisser artificiellement — on compare donc au plafond réel, 700.
        old_w = min(wght, 700)
        old = advance_sum(SOURCE, old_w, text, tracking_units=-140)
        new = advance_sum(BUILT, wght, text)
        flag = "  (plafonné à 700)" if wght > 700 else ""
        lines.append(f"  {style:11} {old:>14.2f} em {new:>20.2f} em {(new / old - 1) * 100:>+7.1f}%{flag}")
    return lines


def counter_report() -> list[str]:
    """Aire des contreformes du Black, rapportée au Bold de Jura d'origine."""
    ref = _counters(SOURCE, 700)
    cur = _counters(BUILT, 900)
    ratios = []
    for ch, holes in ref.items():
        mine = cur.get(ch, [])
        if len(mine) < len(holes):
            ratios.append((0.0, ch))
            continue
        ratios.extend((mine[i] / h, ch) for i, h in enumerate(holes))
    ratios.sort()
    worst = ", ".join(f"{ch} {r * 100:.0f}%" for r, ch in ratios[:6])
    closed = [ch for r, ch in ratios if r == 0]
    return [
        f"  contreformes du Black, en % de celles du Bold d'origine",
        f"    les plus serrées : {worst}",
        f"    refermées        : {', '.join(closed) if closed else 'aucune'}",
    ]


def _counters(path: Path, wght: float, ppem: int = 160) -> dict[str, list[int]]:
    """Aire des trous fermés de chaque glyphe, par rasterisation FreeType."""
    from fontTools.varLib.instancer import instantiateVariableFont
    import tempfile

    font = instantiateVariableFont(TTFont(path), {"wght": wght}, inplace=True, overlap=True)
    with tempfile.NamedTemporaryFile(suffix=".ttf", delete=False) as tmp:
        font.save(tmp.name)
        fnt = ImageFont.truetype(tmp.name, ppem)

    out = {}
    for ch in "aåbdeéêgkmnopqrsàABDEGKOPQRSW02346789&@%$€§":
        img = Image.new("L", (ppem * 2, ppem * 2), 0)
        ImageDraw.Draw(img).text((ppem // 2, ppem // 2), ch, fill=255, font=fnt)
        ink = np.array(img) > 96
        out[ch] = _hole_areas(ink)
    return out


def _hole_areas(ink: np.ndarray) -> list[int]:
    """Composantes de fond non reliées au bord = contreformes fermées."""
    h, w = ink.shape
    bg = ~ink
    seen = np.zeros_like(bg)
    stack = [(0, 0)]
    seen[0, 0] = True
    while stack:
        r, c = stack.pop()
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nr, nc = r + dr, c + dc
            if 0 <= nr < h and 0 <= nc < w and bg[nr, nc] and not seen[nr, nc]:
                seen[nr, nc] = True
                stack.append((nr, nc))
    holes = bg & ~seen
    visited = np.zeros_like(holes)
    areas = []
    for r, c in np.argwhere(holes):
        if visited[r, c]:
            continue
        stack, area = [(r, c)], 0
        visited[r, c] = True
        while stack:
            rr, cc = stack.pop()
            area += 1
            for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nr, nc = rr + dr, cc + dc
                if 0 <= nr < h and 0 <= nc < w and holes[nr, nc] and not visited[nr, nc]:
                    visited[nr, nc] = True
                    stack.append((nr, nc))
        if area >= 4:
            areas.append(area)
    return sorted(areas, reverse=True)


# --- rendu --------------------------------------------------------------------
#
# Pillow ne sait pas positionner les marques : il pose un ton à côté de sa
# lettre au lieu de le poser dessus. L'épreuve serait donc un faux témoignage.
# On compose donc avec HarfBuzz — le moteur des navigateurs — et on remplit
# soi-même les contours, règle non-zéro, en suréchantillonnant pour le lissage.

SUPERSAMPLE = 3


def _shape(path: Path, wght: float, text: str):
    """Les glyphes d'une chaîne, positionnés : (nom, x, y) en unités de police."""
    import uharfbuzz as hb

    blob = hb.Blob.from_file_path(str(path))
    font = hb.Font(hb.Face(blob))
    font.scale = (2000, 2000)
    font.set_variations({"wght": wght})
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(font, buf)

    order = TTFont(path).getGlyphOrder()
    out, pen_x = [], 0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        out.append((order[info.codepoint], pen_x + pos.x_offset, pos.y_offset))
        pen_x += pos.x_advance
    return out, pen_x


def _contours(glyphset, gname: str, dx: float, dy: float, steps: int = 6):
    """Les contours d'un glyphe, aplatis et déplacés."""
    from fontTools.pens.recordingPen import DecomposingRecordingPen

    # Décomposant : les lettres africaines sont des composites (ɔ = c en miroir,
    # ɓ = b + crochet). Un RecordingPen ordinaire n'en enregistrerait que la
    # référence, et elles sortiraient vides de l'épreuve.
    pen = DecomposingRecordingPen(glyphset)
    glyphset[gname].draw(pen)
    out, cur = [], []

    def quad(p0, points):
        points = list(points)
        if points[-1] is None:      # contour entièrement hors courbe
            points[-1] = ((points[0][0] + points[-2][0]) / 2,
                          (points[0][1] + points[-2][1]) / 2)
        prev, result = p0, []
        for i in range(len(points) - 1):
            ctrl = points[i]
            nxt = (points[i + 1] if i + 1 == len(points) - 1 else
                   ((points[i][0] + points[i + 1][0]) / 2,
                    (points[i][1] + points[i + 1][1]) / 2))
            for s in range(1, steps + 1):
                t = s / steps
                m = 1 - t
                result.append((m * m * prev[0] + 2 * m * t * ctrl[0] + t * t * nxt[0],
                               m * m * prev[1] + 2 * m * t * ctrl[1] + t * t * nxt[1]))
            prev = nxt
        return result

    for op, args in pen.value:
        if op == "moveTo":
            cur = [args[0]]
        elif op == "lineTo":
            cur.append(args[0])
        elif op == "qCurveTo":
            cur.extend(quad(cur[-1], args))
        elif op == "curveTo":
            a, (c1, c2, b) = cur[-1], args
            for s in range(1, steps * 2 + 1):
                t = s / (steps * 2)
                m = 1 - t
                cur.append((m**3 * a[0] + 3 * m * m * t * c1[0] + 3 * m * t * t * c2[0] + t**3 * b[0],
                            m**3 * a[1] + 3 * m * m * t * c1[1] + 3 * m * t * t * c2[1] + t**3 * b[1]))
        elif op == "closePath" and len(cur) > 2:
            out.append([(x + dx, y + dy) for x, y in cur])
            cur = []
    if len(cur) > 2:
        out.append([(x + dx, y + dy) for x, y in cur])
    return out


def _fill(contours, width: int, height: int, scale: float, baseline: int):
    """Remplissage non-zéro par balayage, puis réduction pour le lissage."""
    ss = SUPERSAMPLE
    w, h = width * ss, height * ss
    mask = np.zeros((h, w), dtype=np.float32)
    edges = []
    for contour in contours:
        n = len(contour)
        for i in range(n):
            x1, y1 = contour[i]
            x2, y2 = contour[(i + 1) % n]
            px1, py1 = x1 * scale * ss, (baseline - y1 * scale) * ss
            px2, py2 = x2 * scale * ss, (baseline - y2 * scale) * ss
            if py1 != py2:
                edges.append((px1, py1, px2, py2))
    if not edges:
        return np.zeros((height, width), dtype=np.float32)

    top = max(0, int(min(min(e[1], e[3]) for e in edges)))
    bottom = min(h, int(max(max(e[1], e[3]) for e in edges)) + 1)
    for row in range(top, bottom):
        y = row + 0.5
        hits = []
        for x1, y1, x2, y2 in edges:
            if (y1 <= y < y2) or (y2 <= y < y1):
                hits.append((x1 + (y - y1) / (y2 - y1) * (x2 - x1), 1 if y2 > y1 else -1))
        if not hits:
            continue
        hits.sort()
        wind, start = 0, None
        for x, direction in hits:
            was = wind
            wind += direction
            if was == 0 and wind != 0:
                start = x
            elif was != 0 and wind == 0 and start is not None:
                mask[row, max(0, int(round(start))):max(0, int(round(x)))] = 1.0
                start = None
    return mask.reshape(height, ss, width, ss).mean(axis=(1, 3))


def draw_line(img: Image.Image, path: Path, wght: float, text: str,
              size_px: float, x: int, baseline: int, colour=(17, 20, 24)) -> int:
    """Écrit une ligne dans l'image et rend l'abscisse d'arrivée."""
    from fontTools.varLib.instancer import instantiateVariableFont

    glyphs, advance = _shape(path, wght, text)
    font = instantiateVariableFont(TTFont(path), {"wght": wght}, inplace=True)
    glyphset = font.getGlyphSet()
    scale = size_px / font["head"].unitsPerEm

    contours = []
    for gname, gx, gy in glyphs:
        contours += _contours(glyphset, gname, gx, gy)
    if not contours:
        return x

    width = int(advance * scale) + int(size_px)
    height = int(size_px * 2)
    mask = _fill(contours, width, height, scale, int(size_px * 1.4))
    tile = Image.fromarray((mask * 255).astype("uint8"), mode="L")
    img.paste(Image.new("RGB", tile.size, colour), (x, baseline - int(size_px * 1.4)), tile)
    return x + int(advance * scale)


# --- épreuve ------------------------------------------------------------------

LADDER = [(w, name) for w, name in WEIGHTS]

#: L'inventaire de l'Alphabet Général des Langues Camerounaises. On montre les
#: lettres et les tons plutôt que des phrases : une épreuve ne doit affirmer que
#: ce qu'on peut vérifier.
AGLC_LOWER = "a b ɓ c d ɗ e ɛ ǝ f g h i ɨ j k l m n ŋ ɲ o ɔ p r s t u ʉ v w y z"
AGLC_UPPER = "A B Ɓ C D Ɗ E Ɛ Ə F G H I Ɨ J K L M N Ŋ Ɲ O Ɔ P R S T U Ʉ V W Y Z"
TONES = "á à â ǎ  ɛ́ ɛ̀ ɛ̂ ɛ̌  ɔ́ ɔ̀ ɔ̂ ɔ̌  ʉ́ ʉ̀ ʉ̂ ʉ̌  ɨ́ ɨ̀ ɨ̂ ɨ̌  ə́ ə̀ ə̂ ə̌"


def proof_sheet(path: Path, out: Path) -> None:
    width = 1560
    img = Image.new("RGB", (width, 1180), "white")
    draw = ImageDraw.Draw(img)
    label = ImageFont.load_default(15)
    y = 60

    draw.text((48, 24), "VILEVILE — ÉCHELLE DES GRAISSES", fill="#9aa1ab", font=label)
    for wght, name in LADDER:
        draw.text((48, y + 12), f"{name} {wght}", fill="#9aa1ab", font=label)
        draw_line(img, path, wght, "Idem Africa — Business Plan 2026", 40, 230, y + 34)
        y += 62

    y += 26
    draw.line([(48, y), (width - 48, y)], fill="#e6e9ed")
    y += 34
    draw.text((48, y - 24), "ALPHABET GÉNÉRAL DES LANGUES CAMEROUNAISES", fill="#9aa1ab", font=label)
    for text, wght in ((AGLC_UPPER, 600), (AGLC_LOWER, 400)):
        draw_line(img, path, wght, text, 34, 48, y + 44)
        y += 66

    y += 20
    draw.line([(48, y), (width - 48, y)], fill="#e6e9ed")
    y += 34
    draw.text((48, y - 24), "TONS — HAUT, BAS, DESCENDANT, MONTANT", fill="#9aa1ab", font=label)
    draw_line(img, path, 500, TONES, 40, 48, y + 52)
    y += 96

    draw.line([(48, y), (width - 48, y)], fill="#e6e9ed")
    y += 34
    draw.text((48, y - 24), "LETTRES CONSTRUITES — CLAIR ET NOIR", fill="#9aa1ab", font=label)
    draw_line(img, path, 300, "ɓ Ɓ ɗ Ɗ ɲ Ɲ ɔ Ɔ ɛ Ɛ ɨ Ɨ ʉ Ʉ ɵ Ɵ", 40, 48, y + 50)
    draw_line(img, path, 900, "ɓ Ɓ ɗ Ɗ ɲ Ɲ ɔ Ɔ ɛ Ɛ ɨ Ɨ ʉ Ʉ ɵ Ɵ", 40, 790, y + 50)

    img.save(out)
    print(f"  {out.name}")


def main() -> int:
    print("Vilevile — contrôle\n")
    print("\n".join(width_report()))
    print()
    print("\n".join(counter_report()))
    print()
    proof_sheet(BUILT, HERE / "vilevile-specimen.png")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
