#!/usr/bin/env python3
"""Les motifs IDEM — un répertoire de marques, dessiné pour Vilevile.

NON BRANCHÉ. Ce module ne tourne pas : `build-fonts.py` ne l'appelle plus. Il
reste parce que c'est lui qui a fixé la direction artistique du restylage des
icônes — l'épaisseur de trait de `restyle.py` vise celle de ces marques. Pour
le remettre dans la police : réimporter `add_motifs` et `emit_motifs_css` dans
`build-fonts.py`, et rajouter `MOTIF_RANGE` à `KEEP_RANGES`.

POURQUOI CE N'EST PAS « les icônes en version africaine »
---------------------------------------------------------
Une icône d'interface est une convention, pas une image : une corbeille se lit
parce que tout le monde a appris à la lire. La redessiner en tampon adinkra la
rend illisible, et une trentaine des 314 icônes sont des marques déposées
(GitHub, PayPal, Microsoft…) qu'on n'a pas le droit de retoucher.

Ce qui porte réellement une identité visuelle, ce sont les marques EXPRESSIVES :
marqueurs de section, états vides, séparateurs, puces, chargement, accents.
Elles ne nomment rien, donc elles n'ont aucune convention à respecter — elles
n'ont qu'à être belles et reconnaissables entre toutes. C'est là que ce
répertoire intervient.

CE QUE CES FORMES SONT
----------------------
Des géométries ORIGINALES, construites ici au compas et à l'équerre, nourries
du vocabulaire des arts graphiques d'Afrique de l'Ouest — la spirale et le
peigne des tampons adinkra, les bandes de losanges du kente, les damiers et
zigzags du bogolan, les figures schématiques du nsibidi. Aucune n'est le calque
d'un symbole existant, et aucune ne porte de nom sacré : elles sont nommées par
ce qu'elles montrent (`spiral`, `comb`, `steps`), pas par une signification
qu'on n'aurait pas le droit de leur prêter.

LA GRAMMAIRE
------------
Une seule, pour que les vingt-quatre marques forment une famille :
  · tout est dessiné dans la boîte de 24 unités des icônes, marge de 2 ;
  · l'épaisseur de trait est constante (BAR), les terminaisons sont plates ;
  · il n'y a que des cercles, des barres droites et des diagonales à 45° —
    la même géométrie que Vilevile ;
  · les formes sont pleines, comme un tampon encré, jamais filaires.

Elles entrent dans Vilevile comme les icônes, à la même échelle et au même
endroit : à corps égal, un motif occupe la place d'une icône.
"""

from __future__ import annotations

import math
from pathlib import Path

from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables.TupleVariation import TupleVariation

#: Les motifs prennent la suite des icônes dans la zone à usage privé.
MOTIF_RANGE = (0xEB00, 0xEB3F)

#: La boîte de dessin, en unités SVG — celle des icônes PrimeIcons.
BOX = 24.0
MARGIN = 2.0
INNER = BOX - 2 * MARGIN          # 20 unités utiles

#: L'épaisseur de trait commune. Assez grasse pour tenir le tampon plein.
BAR = 2.6

PREFIX = "im."


# --- géométrie ----------------------------------------------------------------
#
# On travaille en coordonnées SVG (origine en haut à gauche, y vers le bas),
# comme les sources d'icônes, puis `_emit` bascule dans le repère de la police.

Contour = list[tuple[float, float]]


def rect(x: float, y: float, w: float, h: float) -> Contour:
    return [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]


def poly(*points: tuple[float, float]) -> Contour:
    return list(points)


def circle(cx: float, cy: float, r: float, steps: int = 32) -> Contour:
    return [(cx + r * math.cos(2 * math.pi * i / steps),
             cy + r * math.sin(2 * math.pi * i / steps)) for i in range(steps)]


def ring(cx: float, cy: float, r: float, t: float) -> list[Contour]:
    """Un anneau : disque extérieur, puis disque intérieur en sens inverse."""
    return [circle(cx, cy, r), circle(cx, cy, r - t)[::-1]]


def arc(cx: float, cy: float, r: float, a0: float, a1: float, t: float,
        steps: int = 24) -> Contour:
    """Un arc épais, terminaisons plates. Angles en degrés, sens horaire."""
    a0, a1 = math.radians(a0), math.radians(a1)
    outer = [(cx + (r + t / 2) * math.cos(a0 + (a1 - a0) * i / steps),
              cy + (r + t / 2) * math.sin(a0 + (a1 - a0) * i / steps))
             for i in range(steps + 1)]
    inner = [(cx + (r - t / 2) * math.cos(a0 + (a1 - a0) * i / steps),
              cy + (r - t / 2) * math.sin(a0 + (a1 - a0) * i / steps))
             for i in range(steps, -1, -1)]
    return outer + inner


def spiral(cx: float, cy: float, r: float, turns: float, t: float,
           steps: int = 96) -> Contour:
    """Une spirale pleine, du centre vers l'extérieur."""
    total = turns * 2 * math.pi
    outer, inner = [], []
    for i in range(steps + 1):
        f = i / steps
        angle = total * f
        radius = r * f
        outer.append((cx + (radius + t / 2) * math.cos(angle),
                      cy + (radius + t / 2) * math.sin(angle)))
        inner.append((cx + max(0.0, radius - t / 2) * math.cos(angle),
                      cy + max(0.0, radius - t / 2) * math.sin(angle)))
    return outer + inner[::-1]


def band(y: float, h: float) -> Contour:
    return rect(MARGIN, y, INNER, h)


# --- le répertoire ------------------------------------------------------------
#
# Chaque entrée rend une liste de contours. L'ordre n'a pas d'importance : le
# remplissage est non-zéro et `_emit` oriente les contours qui font des trous.

def m_spiral() -> list[Contour]:
    return [spiral(12, 12, 9, 2.15, BAR)]


def m_double_spiral() -> list[Contour]:
    """Deux coquilles affrontées — la spirale du tampon, dédoublée."""
    return [spiral(6.8, 12, 4.8, 1.85, BAR * 0.92),
            spiral(17.2, 12, 4.8, 1.85, BAR * 0.92)]


def m_comb() -> list[Contour]:
    teeth = [rect(MARGIN + i * (INNER - BAR) / 3, MARGIN, BAR, INNER * 0.62)
             for i in range(4)]
    return teeth + [rect(MARGIN, BOX - MARGIN - BAR, INNER, BAR)]


def m_zigzag() -> list[Contour]:
    out, w, step = [], BAR, INNER / 3
    for i in range(3):
        x = MARGIN + i * step
        out.append(poly((x, 16.4), (x + step / 2, 7.6), (x + step / 2 + w, 7.6),
                        (x + w, 16.4)))
        out.append(poly((x + step / 2, 7.6), (x + step, 16.4),
                        (x + step - w, 16.4), (x + step / 2 - w, 7.6)))
    return out


def m_lozenge() -> list[Contour]:
    """La bande de losanges du kente : plein, creux, plein."""
    out: list[Contour] = []
    for cx, hollow in ((5.6, False), (12, True), (18.4, False)):
        r = 5.4 if hollow else 4.4
        out.append(poly((cx, 12 - r), (cx + r, 12), (cx, 12 + r), (cx - r, 12)))
        if hollow:
            i = r - BAR
            out.append(poly((cx, 12 - i), (cx - i, 12), (cx, 12 + i), (cx + i, 12)))
    return out


def m_concentric() -> list[Contour]:
    return [*ring(12, 12, 10, BAR), *ring(12, 12, 6.4, BAR), circle(12, 12, 2.6)]


def m_steps() -> list[Contour]:
    out, n = [], 4
    unit = INNER / n
    for i in range(n):
        out.append(rect(MARGIN + i * unit, BOX - MARGIN - (i + 1) * unit,
                        unit, (i + 1) * unit))
    return out


def m_sun() -> list[Contour]:
    out = [circle(12, 12, 4.6)]
    for i in range(8):
        a = math.radians(i * 45)
        x0, y0 = 12 + 6.4 * math.cos(a), 12 + 6.4 * math.sin(a)
        x1, y1 = 12 + 10 * math.cos(a), 12 + 10 * math.sin(a)
        nx, ny = -math.sin(a) * BAR / 2, math.cos(a) * BAR / 2
        out.append(poly((x0 + nx, y0 + ny), (x1 + nx, y1 + ny),
                        (x1 - nx, y1 - ny), (x0 - nx, y0 - ny)))
    return out


def m_vessel() -> list[Contour]:
    """La jarre : lèvre, col, panse. Trois volumes pleins qui s'unissent."""
    lip = rect(7.2, 2.6, 9.6, 2.1)
    neck = poly((9.2, 4.7), (14.8, 4.7), (15.8, 8.4), (8.2, 8.4))
    belly = [(12 + 6.9 * math.cos(math.radians(a)),
              14.2 + 7.0 * math.sin(math.radians(a))) for a in range(0, 360, 12)]
    shoulder = rect(8.2, 7.6, 7.6, 2.4)
    return [lip, neck, belly, shoulder]


def m_arch() -> list[Contour]:
    """La porte en plein cintre : deux montants et un arc."""
    x0, x1 = MARGIN, BOX - MARGIN
    cx, bar = (x0 + x1) / 2, BAR * 1.5
    foot, spring = BOX - MARGIN, 12.5
    r_out, r_in = (x1 - x0) / 2, (x1 - x0) / 2 - bar

    path: Contour = [(x0, foot), (x0, spring)]
    for a in range(0, 181, 8):
        path.append((cx - r_out * math.cos(math.radians(a)),
                     spring - r_out * math.sin(math.radians(a))))
    path += [(x1, foot), (x1 - bar, foot), (x1 - bar, spring)]
    for a in range(0, 181, 8):
        path.append((cx + r_in * math.cos(math.radians(a)),
                     spring - r_in * math.sin(math.radians(a))))
    path.append((x0 + bar, foot))
    return [path]


def m_hourglass() -> list[Contour]:
    return [poly((MARGIN, MARGIN), (BOX - MARGIN, MARGIN), (12, 11.4)),
            poly((MARGIN, BOX - MARGIN), (12, 12.6), (BOX - MARGIN, BOX - MARGIN))]


def m_crossroads() -> list[Contour]:
    return [rect(12 - BAR / 2, MARGIN, BAR, INNER),
            rect(MARGIN, 12 - BAR / 2, INNER, BAR),
            circle(5.6, 5.6, 1.7), circle(18.4, 5.6, 1.7),
            circle(5.6, 18.4, 1.7), circle(18.4, 18.4, 1.7)]


def m_bird() -> list[Contour]:
    """L'oiseau : queue balayée, aile levée, tête et bec."""
    return [poly((2.8, 16.4), (13.4, 12.0), (14.2, 15.0), (5.6, 18.2)),
            poly((9.4, 13.2), (14.0, 5.6), (15.6, 12.6)),
            circle(16.8, 10.4, 2.3),
            poly((18.6, 9.2), (22.0, 10.6), (18.6, 12.0))]


def m_fish() -> list[Contour]:
    return [poly((3.4, 12), (9, 7), (15.4, 7), (19.2, 12), (15.4, 17), (9, 17)),
            poly((19, 12), (22.4, 8.2), (22.4, 15.8)),
            circle(8.4, 11, 1.15)[::-1]]


def m_figure() -> list[Contour]:
    """La figure schématique : tête, bras ouverts, jambes plantées."""
    limb = BAR * 1.05
    return [circle(12, 5.2, 3.0),
            rect(12 - limb / 2, 8.0, limb, 6.8),
            poly((3.8, 9.2), (12, 12.2), (12, 14.4), (3.8, 11.4)),
            poly((20.2, 9.2), (12, 12.2), (12, 14.4), (20.2, 11.4)),
            poly((12, 13.4), (13.7, 14.6), (8.4, 21.6), (6.2, 20.4)),
            poly((12, 13.4), (10.3, 14.6), (15.6, 21.6), (17.8, 20.4))]


def m_waves() -> list[Contour]:
    out = []
    for row, y in enumerate((7.2, 12, 16.8)):
        for i in range(2):
            x = MARGIN + i * (INNER / 2)
            out.append(arc(x + INNER / 8, y, INNER / 8, 180, 360, BAR * 0.78))
            out.append(arc(x + 3 * INNER / 8, y, INNER / 8, 0, 180, BAR * 0.78))
    return out


def m_net() -> list[Contour]:
    """Le treillis : cinq mailles en quinconce, comme un filet noué."""
    out: list[Contour] = []
    r, t = 4.0, BAR * 0.78
    for cx, cy in ((6.8, 6.8), (17.2, 6.8), (12, 12), (6.8, 17.2), (17.2, 17.2)):
        out.append(poly((cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)))
        i = r - t
        out.append(poly((cx, cy - i), (cx - i, cy), (cx, cy + i), (cx + i, cy)))
    return out


def m_seed() -> list[Contour]:
    return [poly((12, MARGIN), (18.6, 12), (12, BOX - MARGIN), (5.4, 12)),
            circle(12, 12, 2.4)[::-1]]


def m_bowl() -> list[Contour]:
    """La calebasse : demi-disque plein sur son pied."""
    cup = [(12 + 7.6 * math.cos(math.radians(a)), 11.4 + 7.6 * math.sin(math.radians(a)))
           for a in range(0, 181, 10)]
    return [cup, rect(10.6, 18.4, BAR * 1.1, 2.6), rect(7.6, 20.6, 8.8, BAR)]


def m_ladder() -> list[Contour]:
    """L'échelle : deux montants et trois barreaux, comme un peigne double."""
    rail, rung = BAR, BAR * 0.95
    out = [rect(6.4, MARGIN, rail, INNER), rect(BOX - 6.4 - rail, MARGIN, rail, INNER)]
    for i in range(3):
        out.append(rect(6.4, 6.3 + i * 5.2, BOX - 12.8, rung))
    return out


def m_eye() -> list[Contour]:
    upper = [(2.6 + i * 18.8 / 24, 12 - 6.6 * math.sin(math.pi * i / 24))
             for i in range(25)]
    lower = [(21.4 - i * 18.8 / 24, 12 + 6.6 * math.sin(math.pi * i / 24))
             for i in range(25)]
    return [upper + lower, circle(12, 12, 2.9)[::-1], circle(12, 12, 1.2)]


def m_palm() -> list[Contour]:
    """Le palmier : un tronc et cinq palmes en éventail."""
    apex, out = (12.0, 11.2), [rect(12 - BAR * 0.45, 10.6, BAR * 0.9, 11.2)]
    for angle in (-162, -126, -90, -54, -18):
        a = math.radians(angle)
        tip = (apex[0] + 9.4 * math.cos(a), apex[1] + 9.4 * math.sin(a))
        nx, ny = -math.sin(a) * 1.55, math.cos(a) * 1.55
        out.append(poly(apex, (tip[0] + nx, tip[1] + ny), (tip[0] - nx, tip[1] - ny)))
    return out


def m_burst() -> list[Contour]:
    out = [circle(12, 12, 2.2)]
    for i in range(12):
        a = math.radians(i * 30)
        r0, r1 = 4.4, 9.8 if i % 2 == 0 else 7.4
        nx, ny = -math.sin(a) * BAR * 0.42, math.cos(a) * BAR * 0.42
        out.append(poly((12 + r0 * math.cos(a) + nx, 12 + r0 * math.sin(a) + ny),
                        (12 + r1 * math.cos(a) + nx, 12 + r1 * math.sin(a) + ny),
                        (12 + r1 * math.cos(a) - nx, 12 + r1 * math.sin(a) - ny),
                        (12 + r0 * math.cos(a) - nx, 12 + r0 * math.sin(a) - ny)))
    return out


def m_chain() -> list[Contour]:
    """Deux carrés enlacés — le lien. Ils se décalent pour rester lisibles."""
    out: list[Contour] = []
    side = 10.4
    for cx, cy in ((8.6, 8.6), (15.4, 15.4)):
        out.append(rect(cx - side / 2, cy - side / 2, side, side))
        out.append(rect(cx - side / 2 + BAR, cy - side / 2 + BAR,
                        side - 2 * BAR, side - 2 * BAR)[::-1])
    return out


def m_triangles() -> list[Contour]:
    out, n = [], 3
    w = INNER / n
    for i in range(n):
        x = MARGIN + i * w
        out.append(poly((x, 17.4), (x + w / 2, 6.6), (x + w, 17.4)))
        out.append(poly((x + w / 2, 10.6), (x + w * 0.78, 15.6),
                        (x + w * 0.22, 15.6))[::-1])
    return out


#: Le répertoire, dans l'ordre des codes. Le nom dit ce que la marque MONTRE.
MOTIFS: list[tuple[str, callable]] = [
    ("spiral", m_spiral), ("double-spiral", m_double_spiral), ("comb", m_comb),
    ("zigzag", m_zigzag), ("lozenge", m_lozenge), ("concentric", m_concentric),
    ("steps", m_steps), ("sun", m_sun), ("vessel", m_vessel), ("arch", m_arch),
    ("hourglass", m_hourglass), ("crossroads", m_crossroads), ("bird", m_bird),
    ("fish", m_fish), ("figure", m_figure), ("waves", m_waves), ("net", m_net),
    ("seed", m_seed), ("bowl", m_bowl), ("ladder", m_ladder), ("eye", m_eye),
    ("palm", m_palm), ("burst", m_burst), ("chain", m_chain),
    ("triangles", m_triangles),
]


# --- intégration --------------------------------------------------------------

def _signed_area(contour: Contour) -> float:
    total = 0.0
    for i in range(len(contour)):
        x0, y0 = contour[i]
        x1, y1 = contour[(i + 1) % len(contour)]
        total += x0 * y1 - x1 * y0
    return total / 2


def _emit(contours: list[Contour], upem: int) -> object:
    """Bascule du repère SVG vers celui de la police et referme les contours.

    Les icônes occupent la boîte 0..24 de leur viewBox, posée entre -64 et 960
    dans une police à 1024 unités. À 2000 unités, cela donne le facteur
    ci-dessous : un motif tombe donc exactement là où tombe une icône.
    """
    k = upem / BOX
    top = 0.9375 * upem            # 1875 pour 2000 : le haut de la boîte d'icône
    pen = TTGlyphPen(None)
    for contour in contours:
        if len(contour) < 3:
            continue
        pen.moveTo((round(contour[0][0] * k), round(top - contour[0][1] * k)))
        for x, y in contour[1:]:
            pen.lineTo((round(x * k), round(top - y * k)))
        pen.closePath()
    return pen.glyph()


def add_motifs(font: TTFont, log=print) -> dict[int, str]:
    """Dessine le répertoire dans la police. Rend {codepoint: nom de classe}."""
    upem = font["head"].unitsPerEm
    glyf, hmtx, gvar = font["glyf"], font["hmtx"], font["gvar"]
    order = list(font.getGlyphOrder())
    added: dict[int, str] = {}
    classes: dict[int, str] = {}

    for index, (name, draw) in enumerate(MOTIFS):
        codepoint = MOTIF_RANGE[0] + index
        assert codepoint <= MOTIF_RANGE[1], "le répertoire déborde sa plage"
        glyph_name = PREFIX + name

        contours = draw()
        glyf.glyphs[glyph_name] = _emit(contours, upem)
        hmtx[glyph_name] = (upem, 0)
        order.append(glyph_name)
        added[codepoint] = glyph_name
        classes[codepoint] = name

    font.setGlyphOrder(order)
    glyf.setGlyphOrder(order)

    for glyph_name in added.values():
        gvar.variations[glyph_name] = []
    _extend_hvar(font, list(added.values()))

    for table in font["cmap"].tables:
        if table.isUnicode():
            table.cmap.update(added)

    class_defs = font["GDEF"].table.GlyphClassDef.classDefs
    for glyph_name in added.values():
        class_defs[glyph_name] = 1

    log(f"  motifs : {len(added)} marques IDEM dessinées "
        f"({MOTIF_RANGE[0]:#x}–{MOTIF_RANGE[0] + len(added) - 1:#x})")
    return classes


def _extend_hvar(font: TTFont, names: list[str]) -> None:
    import fontTools.varLib.varStore  # greffe VarData.calculateNumShorts

    data = font["HVAR"].table.VarStore.VarData[0]
    gid = {g: i for i, g in enumerate(font.getGlyphOrder())}
    for name in sorted(names, key=lambda n: gid[n]):
        assert gid[name] == len(data.Item), f"{name} : trou dans l'indice HVAR"
        data.Item.append([0] * data.VarRegionCount)
    data.ItemCount = len(data.Item)
    data.calculateNumShorts()


CSS_HEADER = """
/* Motifs IDEM — le répertoire de marques de la maison.

   Ce ne sont PAS des icônes d'interface : elles ne nomment rien. Elles servent
   de marqueurs de section, d'états vides, de séparateurs, de puces, d'accents.
   Géométries originales, nourries du vocabulaire graphique ouest-africain —
   spirale et peigne des tampons adinkra, bandes de losanges du kente, damiers
   du bogolan, figures schématiques du nsibidi.

   Usage : <i class="im im-spiral"></i>
   Comme les icônes, elles sont DANS Vilevile : couleur et corps s'héritent. */

.im {
    font-family: '%(family)s';
    speak: none;
    font-style: normal;
    font-weight: normal;
    font-variant: normal;
    text-transform: none;
    line-height: 1;
    display: inline-block;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
}
"""


def emit_motifs_css(out: Path, family: str, classes: dict[int, str], log=print) -> None:
    """Ajoute les classes des motifs à la feuille d'icônes."""
    rules = "\n".join(
        f'\n.im-{name}:before {{\n    content: "\\{codepoint:x}";\n}}'
        for codepoint, name in sorted(classes.items()))
    with out.open("a", encoding="utf-8") as handle:
        handle.write("\n" + CSS_HEADER % {"family": family} + rules + "\n")
    log(f"  {out.name:28} {len(classes):4d} motifs       "
        f"{out.stat().st_size / 1024:6.1f} Ko")
