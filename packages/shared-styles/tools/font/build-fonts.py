#!/usr/bin/env python3
"""Fabrique « Vilevile » — la police de marque IDEM, dérivée de Jura.

Trois transformations, dans cet ordre :

  1. EXTENSION DE L'AXE  Jura s'arrête à wght 700. Le code utilise déjà
     `font-black` (64 fois) et `font-extrabold` (9 fois), qui tombaient donc
     en faux-gras synthétique. Jura est un variable font à deux masters
     (300 et 700) : toutes ses tuiles gvar sont sur la région (0, 1, 1). On
     peut donc extrapoler proprement en multipliant les deltas par K et en
     ré-étiquetant l'axe, jusqu'à DESIGN_CEIL.

  2. DÉCALAGE DE GRAISSE  L'axe est ensuite restreint à [DESIGN_FLOOR,
     DESIGN_CEIL] puis ré-étiqueté 300..900. Vilevile est donc Jura décalée
     d'un cran et demi vers le gras : ce que le CSS appelle 400 dessine à
     542, ce qu'il appelle 700 dessine à 817. Le rapport est affine, il n'y a
     pas de marche dans l'échelle et aucune table `avar` n'est nécessaire.

  3. APPROCHE INCORPORÉE  L'approche est soustraite des chasses (hmtx), donc
     plus aucune feuille de style n'a à la poser : ni sur `*`, ni ailleurs.
     Les polices d'icônes ligaturées ne sont plus resserrées au passage.

Puis : sous-ensemble Unicode, renommage, et export .ttf + .woff2.

    python3 build-fonts.py            # écrit vilevile-*.woff2 et fonts.css
    python3 build-fonts.py --specimen # + un PNG de contrôle

Dépendances : fonttools, brotli (pip install fonttools brotli).
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._f_v_a_r import NamedInstance
from fontTools.ttLib.tables import otTables as ot
from fontTools.subset import Subsetter, Options

from african import add_african_letters

HERE = Path(__file__).resolve().parent
SOURCE = HERE / "src" / "Jura[wght].ttf"

#: Où la police est SERVIE. Ce dossier ne contient que la typographie : les
#: woff2, leur feuille `@font-face`, la licence. La fabrique reste ici.
FONTS = HERE.parent.parent / "fonts"

# --- paramètres de dessin -----------------------------------------------------

#: Les deux bornes de l'échelle de Jura que Vilevile expose, sur l'échelle de
#: dessin d'origine (300 = Light de Jura, 700 = son Bold, au-delà = extrapolé).
#:
#: DESIGN_FLOOR est LE bouton de graisse : le monter épaissit tout le jeu.
#: DESIGN_CEIL est plafonné par la mesure — au-delà de 1100 l'anneau du « å »
#: se referme et « œ / æ / ‰ » s'empâtent (voir README et specimen.py).
DESIGN_FLOOR = 450
DESIGN_CEIL = 1000

#: Facteur d'extrapolation nécessaire pour atteindre DESIGN_CEIL. Jura n'ayant
#: qu'une région de variation, multiplier ses deltas par K prolonge exactement
#: la droite qui joint son Light à son Bold.
K = (DESIGN_CEIL - 300) / 400

#: Approche à incorporer, en em. Négatif = resserrement. Aucune feuille de
#: style ne doit plus poser de `letter-spacing` : tout part d'ici.
TRACKING_EM = -0.09

#: Bornes exposées au CSS.
WGHT_MIN, WGHT_MAX = 300, 900

FAMILY = "Vilevile"
POSTSCRIPT_PREFIX = "Vilevile"
VERSION = "1.0"

INSTANCES = [
    (300, "Light"),
    (400, "Regular"),
    (500, "Medium"),
    (600, "SemiBold"),
    (700, "Bold"),
    (800, "ExtraBold"),
    (900, "Black"),
]

#: Blocs conservés. Latin complet (y compris Ext-B / Ext-Add, qui portent les
#: lettres des orthographes ouest-africaines), ponctuation, devises (₣ ₦ ₵),
#: maths et grec de base. Écartés : cyrillique, grec polytonique et kayah li,
#: soit 381 glyphes sur 1115 dont IDEM n'a pas l'usage.
KEEP_RANGES = [
    (0x0000, 0x02FF),  # latin de base -> lettres modificatives
    (0x0300, 0x036F),  # diacritiques combinantes
    (0x0370, 0x03FF),  # grec (µ, Ω, Δ, π…)
    (0x1E00, 0x1EFF),  # latin étendu additionnel
    (0x2000, 0x206F),  # ponctuation générale
    (0x2070, 0x209F),  # exposants / indices
    (0x20A0, 0x20CF),  # devises
    (0x2100, 0x214F),  # symboles lettrés (№ ™ Ω)
    (0x2150, 0x218F),  # formes numériques
    (0x2190, 0x21FF),  # flèches
    (0x2200, 0x22FF),  # opérateurs mathématiques
    (0x2300, 0x23FF),  # divers techniques
    (0x25A0, 0x25FF),  # formes géométriques
    (0xFB00, 0xFB4F),  # ligatures ﬁ ﬂ
    (0xFFFD, 0xFFFD),  # caractère de remplacement
]


def log(msg: str) -> None:
    print(msg, file=sys.stderr)


# --- 1. extension de l'axe ----------------------------------------------------

def extend_axis(font: TTFont, k: float) -> None:
    """Multiplie tous les deltas de variation par `k`.

    Jura n'a qu'une seule région de variation, (start=0, peak=1, end=1) sur
    wght : mettre les deltas à l'échelle revient exactement à prolonger la
    droite qui joint le master Light au master Bold.
    """
    regions = {
        tuple(ax.get("wght", (0, 0, 0)))
        for tuples in font["gvar"].variations.values()
        for tv in tuples
        for ax in [tv.axes]
    }
    assert regions == {(0.0, 1.0, 1.0)}, f"régions gvar inattendues : {regions}"

    for tuples in font["gvar"].variations.values():
        for tv in tuples:
            tv.coordinates = [
                None if c is None else (round(c[0] * k), round(c[1] * k))
                for c in tv.coordinates
            ]

    import fontTools.varLib.varStore  # greffe VarData.calculateNumShorts

    for tag in ("HVAR", "GDEF"):
        store = getattr(font[tag].table, "VarStore", None) if tag in font else None
        if store is None:
            continue
        assert len(store.VarRegionList.Region) == 1
        for data in store.VarData:
            for item in data.Item:
                item[:] = [round(v * k) for v in item]
            # Les deltas élargis ne tiennent plus forcément sur un octet :
            # il faut refaire le calcul court/long avant la compilation.
            data.calculateNumShorts()

    axis = font["fvar"].axes[0]
    axis.maxValue = 300 + 400 * k
    log(f"  axe prolongé : dessin 300..700 -> 300..{axis.maxValue:.0f} (K={k:g})")


def shift_weights(font: TTFont) -> None:
    """Ampute le bas de l'axe, puis ré-étiquette ce qui reste 300..900.

    Jura est une police claire : son 400 est mince et son 700 ne pèse guère
    plus qu'un semi-gras. On coupe donc tout ce qui est plus fin que
    DESIGN_FLOOR et on renumérote — chaque graisse demandée par le CSS reçoit
    un dessin nettement plus épais, sans que l'échelle cesse d'être affine.
    """
    from fontTools.varLib.instancer import instantiateVariableFont

    instantiateVariableFont(
        font, {"wght": (DESIGN_FLOOR, DESIGN_FLOOR, DESIGN_CEIL)},
        inplace=True, overlap=True)
    assert "avar" not in font, "l'amputation d'un axe affine ne doit pas créer d'avar"

    axis = font["fvar"].axes[0]
    axis.minValue, axis.defaultValue, axis.maxValue = WGHT_MIN, WGHT_MIN, WGHT_MAX
    log("  graisses : " + "  ".join(f"{u}→{design_for(u):.0f}" for u, _ in INSTANCES))


def design_for(css_weight: int) -> float:
    """Le poids Jura que dessine une graisse CSS donnée."""
    span = (css_weight - WGHT_MIN) / (WGHT_MAX - WGHT_MIN)
    return DESIGN_FLOOR + span * (DESIGN_CEIL - DESIGN_FLOOR)


# --- 2. approche incorporée ---------------------------------------------------

def bake_tracking(font: TTFont, tracking_em: float) -> None:
    """Soustrait l'approche des chasses, à l'identique de `letter-spacing`.

    `letter-spacing` ajoute l'espace APRÈS le glyphe sans le déplacer : on
    reproduit exactement ce comportement en ne touchant qu'à la chasse, ce qui
    évite au passage de manipuler les décalages des glyphes composites (é, à…).

    Les deltas HVAR / gvar sont relatifs à la chasse par défaut : une constante
    retranchée ici se propage telle quelle sur tout l'axe. L'approche reste donc
    absolue en em, et devient donc proportionnellement plus lâche vers le Black
    — ce qu'on veut, un Black a besoin de respirer.
    """
    upem = font["head"].unitsPerEm
    delta = round(tracking_em * upem)
    hmtx = font["hmtx"]
    clamped = []
    for name in font.getGlyphOrder():
        adv, lsb = hmtx[name]
        if adv == 0:  # marques combinantes : chasse nulle, on n'y touche pas
            continue
        new = adv + delta
        if new < 0:
            clamped.append(name)
            new = 0
        hmtx[name] = (new, lsb)
    font["hhea"].advanceWidthMax = max(a for a, _ in hmtx.metrics.values())
    log(f"  approche incorporée : {tracking_em:+g} em = {delta:+d}/{upem} unités"
        + (f" ({len(clamped)} glyphes bornés à 0 : {', '.join(clamped[:6])})" if clamped else ""))


# --- 3. métriques, noms, instances -------------------------------------------

def widen_bbox(font: TTFont) -> None:
    """Élargit la bbox `head` à l'union Light..Black.

    La bbox par défaut ne décrit que le Light ; certains moteurs s'en servent
    pour découper. On y verse les extrêmes du Black pour éviter tout rognage.
    """
    from fontTools.varLib.instancer import instantiateVariableFont

    heavy = instantiateVariableFont(_clone(font), {"wght": WGHT_MAX},
                                    inplace=True, overlap=True)
    hb, head = heavy["head"], font["head"]
    before = (head.xMin, head.yMin, head.xMax, head.yMax)
    head.xMin = min(head.xMin, hb.xMin)
    head.yMin = min(head.yMin, hb.yMin)
    head.xMax = max(head.xMax, hb.xMax)
    head.yMax = max(head.yMax, hb.yMax)
    os2, hhea = font["OS/2"], font["hhea"]
    os2.usWinAscent = max(os2.usWinAscent, head.yMax)
    os2.usWinDescent = max(os2.usWinDescent, -head.yMin)
    hhea.yMax = head.yMax
    hhea.yMin = head.yMin
    log(f"  bbox : {before} -> {(head.xMin, head.yMin, head.xMax, head.yMax)}")


def _clone(font: TTFont) -> TTFont:
    import io
    buf = io.BytesIO()
    font.save(buf)
    buf.seek(0)
    return TTFont(buf)


def set_instances(font: TTFont) -> None:
    """Réécrit les instances nommées fvar et la table STAT."""
    name = font["name"]
    fvar = font["fvar"]
    fvar.instances = []
    for wght, style in INSTANCES:
        inst = NamedInstance()
        inst.coordinates = {"wght": float(wght)}
        inst.subfamilyNameID = name.addName(style)
        inst.postscriptNameID = name.addName(f"{POSTSCRIPT_PREFIX}-{style}")
        fvar.instances.append(inst)

    stat = font["STAT"].table
    values = []
    for i, (wght, style) in enumerate(INSTANCES):
        av = ot.AxisValue()
        av.Format = 1
        av.AxisIndex = 0
        av.Flags = 2 if wght == 400 else 0  # ElidableAxisValueName sur Regular
        av.ValueNameID = name.addName(style)
        av.Value = float(wght)
        values.append(av)
    stat.AxisValueArray = ot.AxisValueArray()
    stat.AxisValueArray.AxisValue = values
    stat.ElidedFallbackNameID = name.addName("Regular")
    log(f"  instances : {', '.join(f'{s} {w}' for w, s in INSTANCES)}")


def rename(font: TTFont) -> None:
    """Renomme la famille et consigne les modifications dans le nom 0."""
    name = font["name"]
    default_style = "Light"  # l'instance par défaut de fvar reste wght 300
    notice = (
        "Copyright 2019 The Jura Project Authors "
        "(https://github.com/ossobuffo/jura). "
        f"Vilevile : axe des graisses prolongé (K={K:g}) puis restreint à "
        f"[{DESIGN_FLOOR}, {DESIGN_CEIL}] et ré-étiqueté {WGHT_MIN}..{WGHT_MAX}, "
        f"approche de {TRACKING_EM:+g} em incorporée aux chasses, "
        "sous-ensemble latin. "
        "Modifications par IDEM AFRICA, sous SIL Open Font License 1.1."
    )
    records = {
        0: notice,
        1: f"{FAMILY} {default_style}",
        2: "Regular",
        3: f"{VERSION};IDEM;{POSTSCRIPT_PREFIX}-{default_style}",
        4: f"{FAMILY} {default_style}",
        5: f"Version {VERSION}",
        6: f"{POSTSCRIPT_PREFIX}-{default_style}",
        16: FAMILY,
        17: default_style,
        25: POSTSCRIPT_PREFIX,
    }
    for nid, value in records.items():
        name.setName(value, nid, 3, 1, 0x409)
        name.setName(value, nid, 1, 0, 0)
    for rec in list(name.names):
        if rec.platformID == 1:  # Macintosh : plus personne ne le lit, on allège
            name.names.remove(rec)
    log(f"  famille : « {FAMILY} »")


def subset(font: TTFont) -> None:
    unicodes = {cp for lo, hi in KEEP_RANGES for cp in range(lo, hi + 1)}
    before = len(font.getGlyphOrder())
    # L'amputation de l'axe vide les deltas de quelques glyphes (« NULL »…) et
    # `gvar` perd leur entrée ; le subsetter, lui, les cherche toutes. On les
    # remet à vide plutôt que de le laisser buter dessus.
    variations = font["gvar"].variations
    for gname in font.getGlyphOrder():
        variations.setdefault(gname, [])
    options = Options()
    options.layout_features = ["*"]      # kern, liga, ccmp, mark, tnum… tout
    options.name_IDs = ["*"]
    options.name_languages = ["*"]
    options.notdef_outline = True
    options.recalc_bounds = False        # on a déjà posé la bbox nous-mêmes
    options.drop_tables += ["DSIG"]      # signature invalidée par la modification
    options.glyph_names = True
    subsetter = Subsetter(options=options)
    subsetter.populate(unicodes=unicodes)
    subsetter.subset(font)
    log(f"  sous-ensemble : {before} -> {len(font.getGlyphOrder())} glyphes")


# --- pilote -------------------------------------------------------------------

def build() -> TTFont:
    log(f"source : {SOURCE.name}")
    font = TTFont(SOURCE)
    extend_axis(font, K)
    shift_weights(font)
    add_african_letters(font, log)
    bake_tracking(font, TRACKING_EM)
    widen_bbox(font)
    set_instances(font)
    rename(font)
    subset(font)
    font["OS/2"].usWeightClass = WGHT_MIN  # = l'instance fvar par défaut
    return font


# --- découpe par unicode-range ------------------------------------------------

#: Plage « latin » : celle que Google Fonts sert au français et à l'anglais
#: (Latin-1 complet, œ, les diacritiques combinantes usuelles, la ponctuation
#: générale), élargie aux devises — ₣ et ₦ servent ici — et aux quelques
#: symboles mathématiques et géométriques présents dans Jura. Tout le reste
#: part dans « latin-ext », que le navigateur ne télécharge que s'il en a besoin.
LATIN_SPEC = (
    "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,"
    "U+0300-0304,U+0308-0309,U+030A-030C,U+0327,U+0329,"
    "U+2000-206F,U+2070-209F,U+20A0-20CF,U+2100-214F,U+2150-218F,"
    "U+2190-21FF,U+2200-22FF,U+2300-23FF,U+25A0-25FF,U+FB00-FB04,U+FEFF,U+FFFD"
)


def _parse_spec(spec: str) -> set[int]:
    out: set[int] = set()
    for part in spec.replace("U+", "").split(","):
        if "-" in part:
            lo, hi = part.split("-")
            out |= set(range(int(lo, 16), int(hi, 16) + 1))
        else:
            out.add(int(part, 16))
    return out


def _to_spec(cps: set[int]) -> str:
    """Recompose des codepoints en une liste `unicode-range` compacte."""
    parts, ordered = [], sorted(cps)
    i = 0
    while i < len(ordered):
        j = i
        while j + 1 < len(ordered) and ordered[j + 1] == ordered[j] + 1:
            j += 1
        parts.append(f"U+{ordered[i]:04X}"
                     if i == j else f"U+{ordered[i]:04X}-{ordered[j]:04X}")
        i = j + 1
    return ",".join(parts)


def emit_slices(font: TTFont, out_dir: Path, stem: str) -> list[tuple[str, str, Path]]:
    """Écrit une woff2 par plage. Les plages sont disjointes par construction."""
    covered = set(font.getBestCmap())
    latin = _parse_spec(LATIN_SPEC) & covered
    slices = [("latin", latin), ("latin-ext", covered - latin)]

    written = []
    for label, cps in slices:
        sliced = _clone(font)
        options = Options()
        options.layout_features = ["*"]
        options.name_IDs = ["*"]
        options.name_languages = ["*"]
        options.notdef_outline = True
        options.recalc_bounds = False
        options.glyph_names = False  # inutile au navigateur, et ça allège
        sub = Subsetter(options=options)
        sub.populate(unicodes=cps)
        sub.subset(sliced)
        path = out_dir / f"{stem}-{label}.woff2"
        sliced.flavor = "woff2"
        sliced.save(path)
        written.append((label, _to_spec(cps), path))
        log(f"  {path.name:28} {len(cps):4d} caractères  "
            f"{path.stat().st_size / 1024:6.1f} Ko")
    return written


CSS_HEADER = """/* Vilevile — police de marque IDEM, générée par tools/font/build-fonts.py.
   NE PAS ÉDITER À LA MAIN : relancer `python3 build-fonts.py` après tout
   changement de paramètre (graisse, approche, sous-ensemble).

   Vilevile est dérivée de Jura (SIL OFL 1.1, voir OFL.txt) sur trois points :
     · l'axe des graisses monte jusqu'à 900 — `font-black` dessine enfin
       un vrai Black au lieu d'un faux-gras synthétique ;
     · toute l'échelle est décalée vers le gras — ce que le CSS appelle 400
       dessine un Jura 542, ce qu'il appelle 700 un Jura 817 ;
     · l'approche est incorporée aux chasses. Aucune feuille de style ne doit
       plus déclarer de `letter-spacing` : elle vient de la police. */

"""

FACE = """@font-face {{
  font-family: 'Vilevile';
  font-style: normal;
  font-weight: {wmin} {wmax};
  font-display: swap;
  src: url('./{file}') format('woff2');
  unicode-range: {ranges};
}}
"""


def emit_css(slices: list[tuple[str, str, Path]], out: Path) -> None:
    blocks = [CSS_HEADER]
    for label, ranges, path in slices:
        blocks.append(f"/* {label} */\n" + FACE.format(
            wmin=WGHT_MIN, wmax=WGHT_MAX, file=path.name, ranges=ranges))
    out.write_text("\n".join(blocks), encoding="utf-8")
    log(f"  {out.name:28} {out.stat().st_size / 1024:6.1f} Ko")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", default="vilevile", help="préfixe de sortie")
    ap.add_argument("--specimen", action="store_true", help="écrit un PNG de contrôle")
    args = ap.parse_args()

    font = build()
    log("")

    # La TTF complète n'est pas chargée par le navigateur : elle sert aux
    # outils de maquette (Figma, Illustrator) et à réinstaller la police.
    ttf = FONTS / f"{args.out}-var.ttf"
    font.flavor = None
    font.save(ttf)
    log(f"  {ttf.name:28} {'':17} {ttf.stat().st_size / 1024:6.1f} Ko  (maquette)")

    slices = emit_slices(font, FONTS, args.out)
    emit_css(slices, FONTS / "fonts.css")

    if args.specimen:
        from specimen import proof_sheet
        proof_sheet(ttf, HERE / f"{args.out}-specimen.png")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
