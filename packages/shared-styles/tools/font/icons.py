#!/usr/bin/env python3
"""Fait entrer les icônes PrimeIcons dans Vilevile.

Une police d'icônes est une police comme une autre : des dessins rangés dans la
zone à usage privé d'Unicode. Rien n'oblige à en charger une deuxième. On copie
donc les 313 glyphes de PrimeIcons dans Vilevile, à leurs codes d'origine, et
le produit n'a plus qu'UNE famille : le texte et les icônes en héritent
ensemble — même nom, même fichier, même couleur, même corps.

Ce que ça change concrètement :

  · `font-family: 'Vilevile'` suffit à dessiner un `<i class="pi pi-user">` ;
    plus de `@font-face` séparé, plus de fichier `primeicons.woff2` à servir,
    plus de règle `!important` pour rattraper la famille dans les composants ;
  · les icônes partent dans leur propre tranche `unicode-range`, donc une page
    qui n'en affiche aucune ne télécharge rien de plus qu'avant ;
  · le rendu est au pixel près celui d'aujourd'hui. Les contours sont mis à
    l'échelle de 1024 à 2000 unités par em, ce qui est un simple changement
    d'unité : à corps égal, l'icône occupe exactement la même place.

Ce que ça ne change PAS : l'épaisseur des icônes ne suit pas l'axe de graisse.
Les sources de PrimeIcons sont des contours pleins — le trait y est déjà
vectorisé, il n'y a pas de `stroke-width` à faire varier. Une icône garde donc
son épaisseur à côté d'un texte en Black. C'est la limite du jeu d'icônes, pas
celle de la police.
"""

from __future__ import annotations

import re
from pathlib import Path

from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables.TupleVariation import TupleVariation

from restyle import TRADEMARKS, restyle_contours

#: Le paquet d'icônes, tel qu'installé. On lit SA police et SA feuille de style
#: plutôt que de recopier une table de correspondance : une mise à jour de
#: PrimeIcons se répercute alors par une simple refabrication.
PRIMEICONS = Path("node_modules/primeicons")

#: Les icônes vivent dans la zone à usage privé. Cette plage sert à la fois au
#: sous-ensemble et à l'`unicode-range` de la tranche qui les porte.
ICON_RANGE = (0xE900, 0xEAFF)

#: Préfixe des noms de glyphes ajoutés, pour qu'on les reconnaisse dans la
#: police et qu'aucun ne puisse entrer en collision avec une lettre.
PREFIX = "pi."

#: Grossissement appliqué à chaque icône, en pixels de la grille de travail de
#: `restyle`. Douze rapproche le trait de la masse des tampons sans que les
#: contreformes se resserrent aux petits corps — arbitré à l'écran, à 16 px.
GROW_PX = 12


def _locate(start: Path) -> Path:
    """Remonte jusqu'au node_modules qui porte PrimeIcons."""
    for parent in [start, *start.parents]:
        candidate = parent / PRIMEICONS
        if candidate.is_dir():
            return candidate
    raise FileNotFoundError(
        "primeicons introuvable — `npm install` à la racine du dépôt"
    )


def _icon_names(pkg: Path) -> dict[int, str]:
    """Le nom de classe de chaque code, lu dans la feuille de PrimeIcons."""
    css = (pkg / "primeicons.css").read_text(encoding="utf-8")
    pattern = re.compile(r"""\.pi-([a-z0-9-]+):before\s*\{\s*content:\s*["']\\([0-9a-f]+)["']""")
    return {int(cp, 16): name for name, cp in pattern.findall(css)}


def add_icons(font: TTFont, log=print) -> tuple[int, int]:
    """Copie les glyphes d'icônes dans la police, redessinés dans notre main."""
    pkg = _locate(Path(__file__).resolve().parent)
    icons = TTFont(pkg / "fonts" / "primeicons.ttf")
    names = _icon_names(pkg)

    scale = font["head"].unitsPerEm / icons["head"].unitsPerEm
    source_set = icons.getGlyphSet()
    cmap = icons.getBestCmap()

    glyf, hmtx, gvar = font["glyf"], font["hmtx"], font["gvar"]
    order = list(font.getGlyphOrder())
    added: dict[int, str] = {}
    restyled = skipped = 0
    softened: list[str] = []

    for codepoint in sorted(cmap):
        if not ICON_RANGE[0] <= codepoint <= ICON_RANGE[1]:
            continue                      # .notdef et compagnie
        source_name = cmap[codepoint]
        name = PREFIX + source_name
        icon = names.get(codepoint, "")

        # Le logo d'une marque déposée n'est pas à nous : on le recopie tel quel.
        result = None if icon in TRADEMARKS else restyle_contours(
            source_set, source_name, GROW_PX)

        if result is not None:
            contours, radius = result
            restyled += 1
            if radius < GROW_PX:
                softened.append(f"{icon}:{radius}")
            pen = TTGlyphPen(None)
            for contour in contours:
                pen.moveTo((round(contour[0][0] * scale), round(contour[0][1] * scale)))
                for x, y in contour[1:]:
                    pen.lineTo((round(x * scale), round(y * scale)))
                pen.closePath()
        else:
            if icon in TRADEMARKS:
                skipped += 1
            # Décomposant : une icône peut être composite, et on ne copie que des
            # contours — les composants renverraient à des glyphes inexistants ici.
            recorder = DecomposingRecordingPen(source_set)
            source_set[source_name].draw(recorder)
            pen = TTGlyphPen(None)
            recorder.replay(TransformPen(pen, (scale, 0, 0, scale, 0, 0)))

        glyf.glyphs[name] = pen.glyph()
        hmtx[name] = (round(icons["hmtx"][source_name][0] * scale), 0)
        order.append(name)
        added[codepoint] = name

    font.setGlyphOrder(order)
    glyf.setGlyphOrder(order)

    # Les icônes ne varient pas : une entrée `gvar` vide, et une chasse
    # constante dans `HVAR`. Sans ces deux-là, le sous-ensemble bute sur des
    # glyphes que les tables de variation ne connaissent pas.
    for name in added.values():
        gvar.variations[name] = []
    _extend_hvar(font, list(added.values()))

    for table in font["cmap"].tables:
        if table.isUnicode():
            table.cmap.update(added)

    classes = font["GDEF"].table.GlyphClassDef.classDefs
    for name in added.values():
        classes[name] = 1                 # glyphe de base

    log(f"  icônes : {len(added)} intégrées — {restyled} redessinées dans la main "
        f"IDEM (grossies de {GROW_PX}), {skipped} marques déposées laissées telles "
        f"quelles")
    if softened:
        log(f"    grossissement réduit pour préserver la structure : "
            f"{', '.join(softened[:12])}"
            + (f" … (+{len(softened) - 12})" if len(softened) > 12 else ""))
    return len(added), len(added)


def _extend_hvar(font: TTFont, names: list[str]) -> None:
    """Donne aux icônes une chasse qui ne varie pas.

    `HVAR` n'a pas de table de correspondance dans Jura : l'indice de variation
    d'un glyphe EST son identifiant. Les icônes arrivant après la fin du
    tableau, il faut l'allonger dans le même ordre.
    """
    import fontTools.varLib.varStore  # greffe VarData.calculateNumShorts

    store = font["HVAR"].table.VarStore
    data = store.VarData[0]
    gid = {g: i for i, g in enumerate(font.getGlyphOrder())}
    for name in sorted(names, key=lambda n: gid[n]):
        assert gid[name] == len(data.Item), f"{name} : trou dans l'indice HVAR"
        data.Item.append([0] * data.VarRegionCount)
    data.ItemCount = len(data.Item)
    data.calculateNumShorts()


# --- la feuille de style des icônes -------------------------------------------

CSS_HEADER = """/* Icônes IDEM — générées par tools/font/build-fonts.py.
   NE PAS ÉDITER À LA MAIN.

   Les dessins de PrimeIcons sont dans Vilevile : il n'y a plus de police
   d'icônes séparée à charger, et plus de famille à rattraper. Les classes
   ci-dessous sont celles de PrimeIcons, à l'identique — seule la famille
   change. Tout code existant (`<i class="pi pi-user">`) fonctionne tel quel.

   Une icône hérite donc de la couleur et du corps de son texte, comme
   n'importe quel caractère. Elle n'hérite pas de sa graisse : les sources de
   PrimeIcons sont des contours pleins, sans trait à épaissir. */

"""


def emit_icons_css(out: Path, family: str, log=print) -> None:
    """Réécrit la feuille de PrimeIcons en la pointant sur Vilevile.

    On transforme la leur plutôt que d'en régénérer une : la correspondance
    classe → code reste exacte, y compris `.pi-fw`, `.pi-spin` et son
    animation, et une mise à jour du paquet suit toute seule.
    """
    pkg = _locate(Path(__file__).resolve().parent)
    css = (pkg / "primeicons.css").read_text(encoding="utf-8")

    # Le @font-face de PrimeIcons n'a plus lieu d'être : les dessins sont dans
    # Vilevile, déclarée par fonts.css.
    css = re.sub(r"@font-face\s*\{[^}]*\}\s*", "", css, count=1)
    css = css.replace("font-family: 'primeicons';", f"font-family: '{family}';")

    out.write_text(CSS_HEADER + css.strip() + "\n", encoding="utf-8")
    count = len(re.findall(r"\.pi-[a-z0-9-]+:before", css))
    log(f"  {out.name:28} {count:4d} classes      {out.stat().st_size / 1024:6.1f} Ko")
