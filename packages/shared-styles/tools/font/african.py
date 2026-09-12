#!/usr/bin/env python3
"""Ajoute à Vilevile les lettres des langues africaines.

Jura ne sait pas écrire le camerounais. Sur les dix-neuf lettres de l'Alphabet
Général des Langues Camerounaises, il lui en manque quatorze : ɓ ɗ ɛ ɨ ɲ ɔ ʉ et
leurs capitales. Un texte en ewondo, en duala, en fulfuldé ou en bamiléké y sort
troué de rectangles vides. C'est le geste « africain » le plus substantiel qu'on
puisse faire sur cette police, et le seul qui ne change rien à ce qui existe
déjà : on n'ajoute que des caractères, on n'en retouche aucun.

Chaque lettre est CONSTRUITE à partir des formes de Jura, jamais dessinée à
côté d'elles :

  · ɛ, ɣ, ɑ  sont déjà là sous un autre nom. L'epsilon grec de Jura EST un
    epsilon ouvert latin, son gamma un gamma latin, son « a » (à un seul étage,
    comme toute géométrique) un alpha. Une entrée `cmap` suffit — zéro glyphe
    ajouté, zéro octet.
  · ɔ Ɔ Ɛ  sont des miroirs de c, C et du chiffre 3.
  · ɨ Ɨ ʉ Ʉ ɵ Ɵ  sont la lettre plus le trait d'union, mis à la bonne longueur.
    Le trait d'union porte l'épaisseur de trait horizontale de la police, donc
    la barre s'épaissit avec la graisse toute seule.
  · ɓ Ɓ ɗ Ɗ  sont la lettre plus un crochet, un quart d'anneau raccordé au fût.
  · ɲ Ɲ  sont la lettre plus une queue — un fût droit qui descend sous la ligne,
    exactement comme Jura dessine déjà celle du ŋ.

Les deux seules pièces dessinées, le crochet et la queue, sont paramétrées par
l'épaisseur du trait. On les génère donc deux fois — au plus clair et au plus
gras — et la différence donne les deltas `gvar` exacts : elles grossissent avec
l'axe comme le reste de la police, sans approximation.

Les ancres de marques (`mark`) sont recopiées depuis le glyphe donneur, sinon
les tons — á à â ǎ sur ɛ, ɔ, ʉ… — retomberaient au pied de la lettre.
"""

from __future__ import annotations

import copy
import math
from dataclasses import dataclass

from fontTools.ttLib import TTFont
from fontTools.ttLib.tables import otTables as ot
from fontTools.ttLib.tables._g_l_y_f import Glyph, GlyphComponent, GlyphCoordinates
from fontTools.ttLib.tables.TupleVariation import TupleVariation

#: Le sommet de l'axe, en coordonnées utilisateur : c'est là qu'on mesure la
#: seconde extrémité de chaque pièce dessinée pour en déduire les deltas.
WGHT_MAX = 900

#: Rayon du crochet, en unités de police (upem 2000). Assez court pour que la
#: boucle reste au-dessus de la panse et ne se referme pas aux petits corps.
HOOK_RADIUS = 230
HOOK_RADIUS_CAPS = 200


# --- mesures sur la police ----------------------------------------------------

def _instance(font: TTFont, wght: float) -> TTFont:
    """Une copie figée à une graisse, pour mesurer la seconde extrémité."""
    import io
    from fontTools.varLib.instancer import instantiateVariableFont

    buf = io.BytesIO()
    font.save(buf)
    buf.seek(0)
    return instantiateVariableFont(TTFont(buf), {"wght": wght}, inplace=True)


def _crossings(font: TTFont, gname: str, y: float) -> list[float]:
    """Les abscisses où le contour du glyphe croise la ligne `y`."""
    from fontTools.pens.recordingPen import RecordingPen

    pen = RecordingPen()
    font.getGlyphSet()[gname].draw(pen)
    pts, cur = [], []
    for op, args in pen.value:
        if op == "moveTo":
            cur = [args[0]]
        elif op in ("lineTo",):
            cur.append(args[0])
        elif op in ("qCurveTo", "curveTo"):
            cur.extend(p for p in args if p is not None)
        elif op == "closePath" and cur:
            pts.append(cur)
            cur = []
    if cur:
        pts.append(cur)

    xs = []
    for contour in pts:
        n = len(contour)
        for i in range(n):
            x1, y1 = contour[i]
            x2, y2 = contour[(i + 1) % n]
            if (y1 <= y < y2) or (y2 <= y < y1):
                xs.append(x1 + (y - y1) / (y2 - y1) * (x2 - x1))
    return sorted(xs)


@dataclass
class Stem:
    """Un fût, mesuré aux deux extrémités de l'axe."""
    cx: float          # abscisse du milieu, au plus clair
    thickness: float   # épaisseur, au plus clair
    cx_max: float      # idem, au plus gras
    thickness_max: float

    @property
    def d_cx(self) -> float:
        return self.cx_max - self.cx


def measure_stem(light: TTFont, heavy: TTFont, gname: str, y: float,
                 pick: int = 0) -> Stem:
    """Mesure le n-ième fût vertical d'un glyphe, aux deux graisses.

    `pick` = 0 pour le fût le plus à gauche, -1 pour le plus à droite.
    """
    out = []
    for font in (light, heavy):
        xs = _crossings(font, gname, y)
        assert len(xs) >= 2, f"{gname} : pas de fût à y={y}"
        pair = (xs[0], xs[1]) if pick == 0 else (xs[-2], xs[-1])
        out.append(((pair[0] + pair[1]) / 2, pair[1] - pair[0]))
    return Stem(out[0][0], out[0][1], out[1][0], out[1][1])


# --- pièces dessinées ---------------------------------------------------------

def _arc(cx: float, cy: float, r: float, a0: float, a1: float, steps: int = 3):
    """Un arc en quadratiques, sous forme de points TrueType (x, y, on_curve)."""
    pts = [(cx + r * math.cos(a0), cy + r * math.sin(a0), 1)]
    for i in range(steps):
        b0 = a0 + (a1 - a0) * i / steps
        b1 = a0 + (a1 - a0) * (i + 1) / steps
        mid = (b0 + b1) / 2
        # le point de contrôle est à l'intersection des tangentes
        k = r / math.cos((b1 - b0) / 2)
        pts.append((cx + k * math.cos(mid), cy + k * math.sin(mid), 0))
        pts.append((cx + r * math.cos(b1), cy + r * math.sin(b1), 1))
    return pts


def hook_outline(thickness: float, radius: float = HOOK_RADIUS):
    """Un quart d'anneau : le fût monte, puis s'enroule.

    Origine locale au raccord, soit le milieu du sommet du fût. Le centre de
    courbure est à (radius, 0) et l'arc va de 180° à 270° : la boucle part de
    côté et retombe, terminaison à angle droit comme toutes les extrémités de
    Jura. Le glyphe est dessiné tourné vers la droite ; ɓ ɗ Ɓ Ɗ le posent
    tous en miroir, car c'est vers la gauche que ces crochets tournent.
    """
    cx, cy = radius, 0.0
    out_r, in_r = radius + thickness / 2, radius - thickness / 2
    a0, a1 = math.pi, 1.5 * math.pi
    pts = _arc(cx, cy, out_r, a0, a1)          # bord extérieur
    pts += _arc(cx, cy, in_r, a1, a0)[0:]      # bord intérieur, en sens inverse
    return pts


def tail_outline(thickness: float, depth: float):
    """La queue de ɲ : un fût droit qui descend sous la ligne de base.

    Origine locale au milieu du fût, sur la ligne de base. Jura dessine la
    queue du ŋ exactement ainsi — droite, terminaison plate.
    """
    h = thickness / 2
    return [(-h, 0.0, 1), (h, 0.0, 1), (h, -depth, 1), (-h, -depth, 1)]


def _as_glyph(points) -> Glyph:
    glyph = Glyph()
    glyph.numberOfContours = 1
    glyph.endPtsOfContours = [len(points) - 1]
    glyph.flags = bytearray(p[2] for p in points)
    glyph.coordinates = GlyphCoordinates([(round(p[0]), round(p[1])) for p in points])
    glyph.program = _empty_program()
    return glyph


def _empty_program():
    from fontTools.ttLib.tables import ttProgram
    program = ttProgram.Program()
    program.fromBytecode(b"")
    return program


# --- recettes -----------------------------------------------------------------

@dataclass
class Recipe:
    """Une lettre à fabriquer."""
    codepoint: int
    name: str
    donor: str                       # le glyphe dont elle hérite forme et ancres
    kind: str                        # alias | mirror | bar | hook | tail
    hook_left: bool = False          # crochet tourné vers la gauche
    bar_y: float = 0.0               # hauteur de la barre, pour `bar`
    bar_width: float = 0.0           # longueur de la barre, pour `bar`
    stem_y: float = 0.0              # hauteur où mesurer le fût
    stem_pick: int = 0               # quel fût : 0 = gauche, -1 = droite
    depth: float = 0.0               # profondeur de la queue
    radius: float = HOOK_RADIUS      # rayon du crochet
    shift: float = 0.0               # décalage du donneur, pour loger le crochet
    anchor_donor: str = ""           # d'où viennent les ancres, si le donneur
                                     # de forme n'en a pas (un chiffre, p. ex.)


#: L'Alphabet Général des Langues Camerounaises, puis ce que l'Alphabet de
#: Référence Africain ajoute et que Jura sait déjà dessiner sous un autre nom.
RECIPES = [
    # — déjà dessinées, il ne manque que l'entrée cmap —
    Recipe(0x025B, "uni025B", "epsilon", "alias"),   # ɛ  e ouvert
    Recipe(0x0263, "uni0263", "gamma", "alias"),     # ɣ  gamma latin
    Recipe(0x0251, "uni0251", "a", "alias"),         # ɑ  alpha latin

    # — miroirs —
    Recipe(0x0254, "uni0254", "c", "mirror"),        # ɔ  o ouvert
    Recipe(0x0186, "uni0186", "C", "mirror"),        # Ɔ
    # Le 3 donne la forme, mais un chiffre n'a pas d'ancre de marque : les tons
    # de Ɛ se calent donc sur ceux du E, recentrés sur la nouvelle largeur.
    Recipe(0x0190, "uni0190", "three", "mirror", anchor_donor="E"),  # Ɛ  E ouvert

    # — lettre barrée —
    Recipe(0x0268, "uni0268", "i", "bar", bar_y=478, bar_width=330),   # ɨ
    Recipe(0x0197, "uni0197", "I", "bar", bar_y=650, bar_width=330),   # Ɨ
    Recipe(0x0289, "uni0289", "u", "bar", bar_y=478, bar_width=1000),  # ʉ
    Recipe(0x0244, "uni0244", "U", "bar", bar_y=650, bar_width=1180),  # Ʉ
    Recipe(0x0275, "uni0275", "o", "bar", bar_y=478, bar_width=1000),  # ɵ
    Recipe(0x019F, "uni019F", "O", "bar", bar_y=650, bar_width=1180),  # Ɵ

    # — lettre à crochet —
    Recipe(0x0253, "uni0253", "b", "hook", stem_y=1200, stem_pick=0,
           hook_left=True, shift=100),                                                 # ɓ
    Recipe(0x0257, "uni0257", "d", "hook", stem_y=1200, stem_pick=-1,
           hook_left=True),                                                            # ɗ
    Recipe(0x0181, "uni0181", "B", "hook", stem_y=1150, stem_pick=0, hook_left=True,
           radius=HOOK_RADIUS_CAPS, shift=110),                                        # Ɓ
    Recipe(0x018A, "uni018A", "D", "hook", stem_y=650, stem_pick=0, hook_left=True,
           radius=HOOK_RADIUS_CAPS, shift=110),                                        # Ɗ

    # — lettre à queue —
    Recipe(0x0272, "uni0272", "n", "tail", stem_y=120, stem_pick=0),   # ɲ
    Recipe(0x019D, "uni019D", "N", "tail", stem_y=120, stem_pick=0),   # Ɲ
]


#: Deux glyphes que Jura porte déjà mais sans ancre de marque : le schwa
#: capitale et le gamma. Ils servent tous deux en orthographe africaine, et un
#: ton doit pouvoir s'y poser. On leur recopie l'ancre d'une lettre voisine,
#: recentrée sur leur propre boîte.
ANCHOR_FIXES = [("uni018F", "E"), ("gamma", "v")]


def _mirror_transform(font: TTFont, donor: str):
    """Le décalage qui remet un glyphe miroité à sa place dans sa chasse."""
    from fontTools.pens.boundsPen import BoundsPen

    pen = BoundsPen(font.getGlyphSet())
    font.getGlyphSet()[donor].draw(pen)
    x_min, _, x_max, _ = pen.bounds
    return x_min + x_max   # miroir autour de 0 puis translation


def _composite(parts) -> Glyph:
    """Un glyphe composite : une liste de (nom, dx, dy, transform|None)."""
    glyph = Glyph()
    glyph.numberOfContours = -1
    glyph.components = []
    for name, dx, dy, transform in parts:
        comp = GlyphComponent()
        comp.glyphName = name
        comp.x, comp.y = round(dx), round(dy)
        comp.flags = 0
        if transform is not None:
            comp.transform = transform
        glyph.components.append(comp)
    from fontTools.ttLib.tables._g_l_y_f import OVERLAP_COMPOUND
    glyph.components[0].flags |= OVERLAP_COMPOUND
    return glyph


# --- ancrage des marques de ton -----------------------------------------------

def _copy_mark_anchors(font: TTFont, pairs: list[tuple[str, str, float]]) -> int:
    """Recopie les ancres du donneur vers la lettre construite.

    `pairs` : (nouveau glyphe, donneur, décalage en x à appliquer aux ancres).
    Sans cela, un ton posé sur ɛ ou ɔ retomberait à l'origine du glyphe.
    """
    order = font.getGlyphOrder()
    gid = {g: i for i, g in enumerate(order)}
    added = 0
    for lookup in font["GPOS"].table.LookupList.Lookup:
        if lookup.LookupType != 4:
            continue
        for sub in lookup.SubTable:
            bases = sub.BaseCoverage.glyphs
            records = sub.BaseArray.BaseRecord
            for new, donor, dx in pairs:
                if donor not in bases or new in bases:
                    continue
                source = records[bases.index(donor)]
                clone = ot.BaseRecord()
                clone.BaseAnchor = []
                for anchor in source.BaseAnchor:
                    if anchor is None:
                        clone.BaseAnchor.append(None)
                        continue
                    # On recopie l'ancre telle quelle — y compris ses tables de
                    # variation, pour que le ton suive la graisse comme sur le
                    # donneur — et on ne déplace que l'abscisse.
                    moved = copy.copy(anchor)
                    moved.XCoordinate = round(anchor.XCoordinate + dx)
                    clone.BaseAnchor.append(moved)
                bases.append(new)
                records.append(clone)
                added += 1
            # la Coverage doit rester triée par identifiant de glyphe
            paired = sorted(zip(bases, records), key=lambda p: gid[p[0]])
            sub.BaseCoverage.glyphs = [g for g, _ in paired]
            sub.BaseArray.BaseRecord = [r for _, r in paired]
            sub.BaseArray.BaseCount = len(records)
    return added


# --- pilote -------------------------------------------------------------------

def add_african_letters(font: TTFont, log=print) -> None:
    heavy = _instance(font, WGHT_MAX)
    glyf, hmtx, gvar = font["glyf"], font["hmtx"], font["gvar"]
    order = list(font.getGlyphOrder())

    new_glyphs: list[tuple[str, Glyph, int, list]] = []   # nom, glyphe, chasse, deltas
    anchors: list[tuple[str, str, float]] = []
    cmap_adds: dict[int, str] = {}
    drawn: dict[str, tuple[Glyph, list]] = {}
    counts = {"alias": 0, "mirror": 0, "bar": 0, "hook": 0, "tail": 0}

    def part(name: str, light_pts, heavy_pts) -> str:
        """Enregistre une pièce dessinée et ses deltas."""
        if name not in drawn:
            deltas = [(round(h[0] - l[0]), round(h[1] - l[1]))
                      for l, h in zip(light_pts, heavy_pts)]
            drawn[name] = (_as_glyph(light_pts), deltas)
        return name

    for r in RECIPES:
        counts[r.kind] += 1

        if r.kind == "alias":
            cmap_adds[r.codepoint] = r.donor       # aucun glyphe créé
            continue

        if r.kind == "mirror":
            shift = _mirror_transform(font, r.donor)
            glyph = _composite([(r.donor, shift, 0, [[-1, 0], [0, 1]])])
            # l'ancre se replie comme la forme : x' = shift - x, donc le
            # décalage à appliquer vaut shift - 2x.
            if r.anchor_donor:
                centre = shift / 2      # le miroir laisse la boîte en place
                anchors.append((r.name, r.anchor_donor,
                                centre - _anchor_x(font, r.anchor_donor)))
            else:
                anchors.append((r.name, r.donor, shift - 2 * _anchor_x(font, r.donor)))
            new_glyphs.append((r.name, glyph, hmtx[r.donor][0], None))
            cmap_adds[r.codepoint] = r.name
            continue

        if r.kind == "bar":
            hy_adv, _ = hmtx["hyphen"]
            from fontTools.pens.boundsPen import BoundsPen
            pen = BoundsPen(font.getGlyphSet())
            font.getGlyphSet()["hyphen"].draw(pen)
            hx0, hy0, hx1, hy1 = pen.bounds
            scale = r.bar_width / (hx1 - hx0)
            pen2 = BoundsPen(font.getGlyphSet())
            font.getGlyphSet()[r.donor].draw(pen2)
            dx0, _, dx1, _ = pen2.bounds
            centre = (dx0 + dx1) / 2
            glyph = _composite([
                (r.donor, 0, 0, None),
                ("hyphen", centre - scale * (hx0 + hx1) / 2,
                 r.bar_y - (hy0 + hy1) / 2, [[scale, 0], [0, 1]]),
            ])
            new_glyphs.append((r.name, glyph, hmtx[r.donor][0], None))
            anchors.append((r.name, r.donor, 0))
            cmap_adds[r.codepoint] = r.name
            continue

        if r.kind == "hook":
            stem = measure_stem(font, heavy, r.donor, r.stem_y, r.stem_pick)
            top = _top_of(font, r.donor)
            top_max = _top_of(heavy, r.donor)
            name = part(f"_hook{r.radius:.0f}",
                        hook_outline(stem.thickness, r.radius),
                        hook_outline(stem.thickness_max, r.radius))
            transform = [[-1, 0], [0, 1]] if r.hook_left else None
            glyph = _composite([
                (r.donor, r.shift, 0, None),
                (name, stem.cx + r.shift, top, transform),
            ])
            # le fût se déplace avec la graisse : le raccord doit suivre
            deltas = [(0, 0), (round(stem.d_cx), round(top_max - top)), *_phantom()]
            new_glyphs.append((r.name, glyph, hmtx[r.donor][0] + r.shift, deltas))
            anchors.append((r.name, r.donor, r.shift))
            cmap_adds[r.codepoint] = r.name
            continue

        if r.kind == "tail":
            stem = measure_stem(font, heavy, r.donor, r.stem_y, r.stem_pick)
            depth = 403        # la profondeur de la queue du ŋ de Jura
            name = part("_tail",
                        tail_outline(stem.thickness, depth),
                        tail_outline(stem.thickness_max, depth))
            glyph = _composite([(r.donor, 0, 0, None), (name, stem.cx, 0, None)])
            deltas = [(0, 0), (round(stem.d_cx), 0), *_phantom()]
            new_glyphs.append((r.name, glyph, hmtx[r.donor][0], deltas))
            anchors.append((r.name, r.donor, 0))
            cmap_adds[r.codepoint] = r.name

    # --- les pièces dessinées entrent d'abord, les composites les référencent --
    for name, (glyph, deltas) in drawn.items():
        order.append(name)
        glyf.glyphs[name] = glyph
        hmtx[name] = (0, min(x for x, _ in glyph.coordinates))
        gvar.variations[name] = [
            TupleVariation({"wght": (0.0, 1.0, 1.0)}, [*deltas, *_phantom()])]

    for name, glyph, advance, deltas in new_glyphs:
        order.append(name)
        glyf.glyphs[name] = glyph
        hmtx[name] = (advance, 0)
        gvar.variations[name] = (
            [TupleVariation({"wght": (0.0, 1.0, 1.0)}, deltas)] if deltas else [])

    font.setGlyphOrder(order)
    glyf.setGlyphOrder(order)
    _extend_hvar(font, [(name, None) for name in drawn]
                 + [(name, donor) for name, donor, _ in anchors])

    # --- cmap, ancres, classes GDEF -------------------------------------------
    for table in font["cmap"].tables:
        if table.isUnicode():
            table.cmap.update(cmap_adds)

    classes = font["GDEF"].table.GlyphClassDef.classDefs
    for name, _, _, _ in new_glyphs:
        classes[name] = 1        # glyphe de base, comme les autres lettres

    for target, donor in ANCHOR_FIXES:
        if target in font.getGlyphOrder():
            anchors.append((target, donor,
                            _centre_x(font, target) - _anchor_x(font, donor)))
    anchored = _copy_mark_anchors(font, anchors)

    log(f"  alphabet africain : {len(cmap_adds)} lettres "
        f"({counts['alias']} par renommage, {counts['mirror']} en miroir, "
        f"{counts['bar']} barrées, {counts['hook']} à crochet, "
        f"{counts['tail']} à queue) — {len(drawn)} pièces dessinées, "
        f"{anchored} ancres de ton recopiées")


def _phantom():
    """Les quatre points fantômes (chasse et bearings), sans variation."""
    return [(0, 0), (0, 0), (0, 0), (0, 0)]


def _top_of(font: TTFont, gname: str) -> float:
    from fontTools.pens.boundsPen import BoundsPen
    pen = BoundsPen(font.getGlyphSet())
    font.getGlyphSet()[gname].draw(pen)
    return pen.bounds[3]


def _centre_x(font: TTFont, gname: str) -> float:
    from fontTools.pens.boundsPen import BoundsPen
    pen = BoundsPen(font.getGlyphSet())
    font.getGlyphSet()[gname].draw(pen)
    return (pen.bounds[0] + pen.bounds[2]) / 2


def _anchor_x(font: TTFont, gname: str) -> float:
    """L'abscisse de l'ancre haute du donneur, pour la replier en miroir."""
    for lookup in font["GPOS"].table.LookupList.Lookup:
        if lookup.LookupType != 4:
            continue
        for sub in lookup.SubTable:
            if gname in sub.BaseCoverage.glyphs:
                rec = sub.BaseArray.BaseRecord[sub.BaseCoverage.glyphs.index(gname)]
                for anchor in rec.BaseAnchor:
                    if anchor is not None:
                        return anchor.XCoordinate
    return 0.0


def _extend_hvar(font: TTFont, added: list[tuple[str, str | None]]) -> None:
    """Donne aux lettres construites la variation de chasse de leur donneur.

    `HVAR` n'a pas de table de correspondance dans Jura : l'indice de variation
    d'un glyphe EST son identifiant. Les nouveaux glyphes arrivent donc après la
    fin du tableau, et il faut l'allonger dans le même ordre — sans quoi leur
    chasse resterait celle du plus clair à toutes les graisses.
    """
    store = font["HVAR"].table.VarStore
    assert font["HVAR"].table.AdvWidthMap is None, "HVAR a une table de correspondance"
    assert len(store.VarData) == 1, "plusieurs VarData dans HVAR"

    data = store.VarData[0]
    gid = {g: i for i, g in enumerate(font.getGlyphOrder())}
    for name, donor in sorted(added, key=lambda p: gid[p[0]]):
        assert gid[name] == len(data.Item), f"{name} : trou dans l'indice HVAR"
        # une pièce dessinée n'a pas de chasse propre ; une lettre prend celle
        # du glyphe dont elle est faite
        data.Item.append(list(data.Item[gid[donor]]) if donor else [0] * data.VarRegionCount)
    data.ItemCount = len(data.Item)
    data.calculateNumShorts()
