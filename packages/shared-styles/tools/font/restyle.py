#!/usr/bin/env python3
"""Redessine les icônes dans la main d'IDEM — masses pleines, angles adoucis.

LA DIRECTION ARTISTIQUE
-----------------------
Le vocabulaire graphique ouest-africain — tampons adinkra, bogolan, nsibidi —
ne dessine pas au trait fin : il pose des MASSES. Trait épais et constant,
terminaisons franches, angles convexes arrondis par l'outil, contreformes
larges. PrimeIcons est à l'opposé : un filet de 1,5 unité sur une boîte de 24,
dessiné à la plume.

On ne redessine pas 314 icônes à la main, et on ne le voudrait pas : leur
LECTURE est une convention qu'il faut préserver — une corbeille doit rester
une corbeille. Ce qu'on change, c'est la MAIN, pas le mot.

LA TRANSFORMATION
-----------------
Une dilatation morphologique par disque : chaque forme grossit de la même
quantité dans toutes les directions. C'est exactement l'outil du tampon — la
matrice mord le papier un peu au-delà de son bord. Elle épaissit les traits,
arrondit les angles saillants, et laisse la topologie intacte.

LA MESURE QUI PROTÈGE
---------------------
Grossir referme les petites contreformes et soude les éléments voisins : trois
points d'ellipse deviennent une barre, l'œil du « a » se bouche. Pour chaque
icône, on part du grossissement visé et on redescend tant que la dilatation
change le NOMBRE de taches d'encre ou le NOMBRE de trous. L'icône garde donc
sa structure, quoi qu'il arrive — et le journal dit lesquelles ont dû être
servies moins épaisses.

CE QU'ON NE TOUCHE PAS
----------------------
Les logos de marques. GitHub, PayPal, Microsoft, Visa et les autres sont des
marques déposées : leur dessin ne nous appartient pas, on n'a pas le droit de
le retoucher. Elles restent telles quelles, et la liste est explicite.
"""

from __future__ import annotations

import numpy as np
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.pens.ttGlyphPen import TTGlyphPen

#: Résolution de travail. La boîte d'icône fait 1024 unités de côté ; à 384 px
#: un pixel vaut 2,67 unités, assez fin pour que la simplification rende des
#: bords nets et assez grossier pour rester rapide sur 314 glyphes.
RASTER = 384

#: La boîte d'une icône PrimeIcons, en unités de sa police (1024 upem).
BOX_MIN, BOX_MAX = -64.0, 960.0
BOX_SIZE = BOX_MAX - BOX_MIN

#: Grossissement visé, en unités de la boîte de 24 de la viewBox. Le trait de
#: PrimeIcons passe ainsi d'environ 1,5 à 2,6 — l'épaisseur des motifs IDEM.
GROW_UNITS = 0.55

#: Tolérance de simplification, en pixels de travail. Au-delà, les courbes
#: deviennent anguleuses ; en deçà, le contour garde l'escalier du pixel.
SIMPLIFY = 1.15

#: Les marques déposées. On ne redessine pas le logo de quelqu'un d'autre.
TRADEMARKS = {
    "amazon", "android", "apple", "bitcoin", "discord", "ethereum", "facebook",
    "github", "google", "instagram", "linkedin", "microsoft", "paypal",
    "pinterest", "prime", "reddit", "slack", "telegram", "tiktok", "twitch",
    "twitter", "vimeo", "whatsapp", "youtube",
}


# --- morphologie --------------------------------------------------------------

def _shift(mask: np.ndarray, dy: int, dx: int) -> np.ndarray:
    """Décale sans reboucler.

    `np.roll` ramènerait l'encre sortie à droite sur le bord gauche ; plusieurs
    icônes touchent le bord de leur boîte, et la dilatation leur inventait une
    tache à l'opposé — c'est ce qui les faisait refuser tout grossissement.
    """
    out = np.zeros_like(mask)
    ys = slice(max(dy, 0), mask.shape[0] + min(dy, 0))
    xs = slice(max(dx, 0), mask.shape[1] + min(dx, 0))
    ys_src = slice(max(-dy, 0), mask.shape[0] + min(-dy, 0))
    xs_src = slice(max(-dx, 0), mask.shape[1] + min(-dx, 0))
    out[ys, xs] = mask[ys_src, xs_src]
    return out


def _dilate(mask: np.ndarray, radius: int) -> np.ndarray:
    """Dilatation par un disque approché.

    Un vrai disque coûterait une centaine de décalages par pixel de rayon. On
    alterne donc croix et carré 3×3 : la forme obtenue est un octogone, dont
    l'écart au disque est inférieur au pixel de travail.
    """
    out = mask
    for step in range(radius):
        shifts = [(1, 0), (-1, 0), (0, 1), (0, -1)]
        if step % 2:
            shifts += [(1, 1), (1, -1), (-1, 1), (-1, -1)]
        grown = out
        for dy, dx in shifts:
            grown = grown | _shift(out, dy, dx)
        out = grown
    return out


def _label_runs(mask: np.ndarray, diagonal: bool) -> int:
    """Composantes connexes, comptées sur les PLAGES et non sur les pixels.

    Une icône de 384² fait 150 000 pixels mais quelques milliers de plages :
    l'union-find sur les plages rend le comptage instantané, là où un remplissage
    par récurrence coûtait plusieurs secondes par glyphe.
    """
    parent: list[int] = []

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(a: int, b: int) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[max(ra, rb)] = min(ra, rb)

    previous: list[tuple[int, int, int]] = []
    for row in mask:
        edges = np.flatnonzero(np.diff(np.concatenate(([False], row, [False])).astype(np.int8)))
        current = []
        for start, end in zip(edges[::2], edges[1::2]):
            index = len(parent)
            parent.append(index)
            current.append((int(start), int(end), index))
            slack = 1 if diagonal else 0
            for p_start, p_end, p_index in previous:
                if p_start - slack < end and start - slack < p_end:
                    union(index, p_index)
        previous = current

    return len({find(i) for i in range(len(parent))})


def _components(mask: np.ndarray) -> int:
    return _label_runs(mask, diagonal=True)


def _holes(mask: np.ndarray) -> int:
    """Les composantes de fond qui ne touchent pas le bord."""
    padded = np.zeros((mask.shape[0] + 2, mask.shape[1] + 2), dtype=bool)
    padded[1:-1, 1:-1] = mask
    # le fond extérieur est connexe et touche le bord : il compte pour une
    # composante, que l'on retranche.
    return _label_runs(~padded, diagonal=False) - 1


# --- vectorisation ------------------------------------------------------------

#: Les segments que chaque configuration de carré traverse, en coordonnées
#: relatives au coin haut-gauche de la cellule (marching squares, milieux
#: d'arêtes). L'orientation est constante : l'encre reste à gauche du sens de
#: parcours, ce qui donne aux trous le sens inverse des contours extérieurs —
#: exactement ce que le remplissage non-zéro attend.
_TOP, _RIGHT, _BOTTOM, _LEFT = (0.5, 0.0), (1.0, 0.5), (0.5, 1.0), (0.0, 0.5)
_CASES: dict[int, list[tuple[tuple, tuple]]] = {
    1: [(_LEFT, _BOTTOM)], 2: [(_BOTTOM, _RIGHT)], 3: [(_LEFT, _RIGHT)],
    4: [(_RIGHT, _TOP)], 5: [(_LEFT, _TOP), (_RIGHT, _BOTTOM)],
    6: [(_BOTTOM, _TOP)], 7: [(_LEFT, _TOP)], 8: [(_TOP, _LEFT)],
    9: [(_TOP, _BOTTOM)], 10: [(_TOP, _RIGHT), (_BOTTOM, _LEFT)],
    11: [(_TOP, _RIGHT)], 12: [(_RIGHT, _LEFT)], 13: [(_RIGHT, _BOTTOM)],
    14: [(_BOTTOM, _LEFT)],
}


def _trace(mask: np.ndarray) -> list[list[tuple[float, float]]]:
    """Extrait les contours fermés séparant l'encre du fond."""
    padded = np.zeros((mask.shape[0] + 2, mask.shape[1] + 2), dtype=np.uint8)
    padded[1:-1, 1:-1] = mask
    top_left, top_right = padded[:-1, :-1], padded[:-1, 1:]
    bottom_left, bottom_right = padded[1:, :-1], padded[1:, 1:]
    case = (top_left * 8 + top_right * 4 + bottom_right * 2 + bottom_left).astype(np.uint8)

    edges: dict[tuple[float, float], list[tuple[float, float]]] = {}
    for y, x in np.argwhere((case > 0) & (case < 15)):
        for start, end in _CASES[int(case[y, x])]:
            a = (x + start[0], y + start[1])
            b = (x + end[0], y + end[1])
            edges.setdefault(a, []).append(b)

    contours: list[list[tuple[float, float]]] = []
    while edges:
        start = next(iter(edges))
        contour, node = [], start
        while True:
            following = edges.get(node)
            if not following:
                break
            nxt = following.pop()
            if not following:
                del edges[node]
            contour.append(node)
            node = nxt
            if node == start:
                break
        if len(contour) > 3:
            contours.append(contour)
    return contours


def _simplify(points: list[tuple[float, float]], eps: float) -> list[tuple[float, float]]:
    """Douglas-Peucker sur un contour fermé."""
    if len(points) < 4:
        return points

    def walk(chunk):
        if len(chunk) < 3:
            return chunk
        (x0, y0), (x1, y1) = chunk[0], chunk[-1]
        dx, dy = x1 - x0, y1 - y0
        norm = (dx * dx + dy * dy) ** 0.5 or 1.0
        worst, index = 0.0, 0
        for i in range(1, len(chunk) - 1):
            x, y = chunk[i]
            distance = abs(dy * x - dx * y + x1 * y0 - y1 * x0) / norm
            if distance > worst:
                worst, index = distance, i
        if worst <= eps:
            return [chunk[0], chunk[-1]]
        return walk(chunk[:index + 1])[:-1] + walk(chunk[index:])

    # un contour fermé se simplifie en deux moitiés, pour ne pas figer un sommet
    half = len(points) // 2
    first = walk(points[:half + 1])
    second = walk(points[half:] + [points[0]])
    return first[:-1] + second[:-1]


# --- le restylage -------------------------------------------------------------

def _rasterize(contours, size: int) -> np.ndarray:
    """Remplissage non-zéro par balayage, dans la boîte de l'icône."""
    scale = size / BOX_SIZE
    mask = np.zeros((size, size), dtype=bool)
    edges = []
    for contour in contours:
        n = len(contour)
        for i in range(n):
            x0, y0 = contour[i]
            x1, y1 = contour[(i + 1) % n]
            px0, py0 = (x0 - 0) * scale, (BOX_MAX - y0) * scale
            px1, py1 = (x1 - 0) * scale, (BOX_MAX - y1) * scale
            if py0 != py1:
                edges.append((px0, py0, px1, py1))
    if not edges:
        return mask

    for row in range(size):
        y = row + 0.5
        hits = []
        for x0, y0, x1, y1 in edges:
            if (y0 <= y < y1) or (y1 <= y < y0):
                hits.append((x0 + (y - y0) / (y1 - y0) * (x1 - x0), 1 if y1 > y0 else -1))
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
                mask[row, max(0, int(round(start))):max(0, int(round(x)))] = True
                start = None
    return mask


def _flatten(glyphset, name: str, steps: int = 8):
    """Contours aplatis d'un glyphe, composites décomposés."""
    pen = DecomposingRecordingPen(glyphset)
    glyphset[name].draw(pen)
    out, current = [], []

    def quad(p0, points):
        points = list(points)
        if points[-1] is None:
            points[-1] = ((points[0][0] + points[-2][0]) / 2,
                          (points[0][1] + points[-2][1]) / 2)
        prev, result = p0, []
        for i in range(len(points) - 1):
            control = points[i]
            nxt = (points[i + 1] if i + 1 == len(points) - 1 else
                   ((points[i][0] + points[i + 1][0]) / 2,
                    (points[i][1] + points[i + 1][1]) / 2))
            for s in range(1, steps + 1):
                t = s / steps
                m = 1 - t
                result.append((m * m * prev[0] + 2 * m * t * control[0] + t * t * nxt[0],
                               m * m * prev[1] + 2 * m * t * control[1] + t * t * nxt[1]))
            prev = nxt
        return result

    for op, args in pen.value:
        if op == "moveTo":
            current = [args[0]]
        elif op == "lineTo":
            current.append(args[0])
        elif op == "qCurveTo":
            current.extend(quad(current[-1], args))
        elif op == "curveTo":
            a, (c1, c2, b) = current[-1], args
            for s in range(1, steps * 2 + 1):
                t = s / (steps * 2)
                m = 1 - t
                current.append(
                    (m**3 * a[0] + 3 * m * m * t * c1[0] + 3 * m * t * t * c2[0] + t**3 * b[0],
                     m**3 * a[1] + 3 * m * m * t * c1[1] + 3 * m * t * t * c2[1] + t**3 * b[1]))
        elif op == "closePath" and len(current) > 2:
            out.append(current)
            current = []
    if len(current) > 2:
        out.append(current)
    return out


def restyle_contours(glyphset, name: str, grow_px: int) -> tuple[list, int] | None:
    """Rend (contours redessinés, grossissement retenu), ou None si rien à faire.

    Le grossissement descend tant que la dilatation change la structure : ni le
    nombre de taches d'encre, ni le nombre de trous ne doivent bouger.
    """
    contours = _flatten(glyphset, name)
    if not contours:
        return None

    mask = _rasterize(contours, RASTER)
    if not mask.any():
        return None

    ink_before, holes_before = _components(mask), _holes(mask)

    radius = grow_px
    while radius > 0:
        grown = _dilate(mask, radius)
        if _components(grown) == ink_before and _holes(grown) == holes_before:
            break
        radius -= 1
    if radius == 0:
        return None                       # l'icône ne supporte aucun grossissement

    grown = _dilate(mask, radius)
    scale = BOX_SIZE / RASTER
    contours = []
    for contour in _trace(grown):
        simplified = _simplify(contour, SIMPLIFY)
        if len(simplified) >= 3:
            contours.append([(px * scale, BOX_MAX - py * scale)
                             for px, py in simplified])
    return (contours, radius) if contours else None


def restyle_glyph(glyphset, name: str, grow_px: int):
    """Même chose, rendue sous forme de glyphe — pratique pour les épreuves."""
    result = restyle_contours(glyphset, name, grow_px)
    if result is None:
        return None
    contours, radius = result
    pen = TTGlyphPen(None)
    for contour in contours:
        pen.moveTo((round(contour[0][0]), round(contour[0][1])))
        for x, y in contour[1:]:
            pen.lineTo((round(x), round(y)))
        pen.closePath()
    return pen.glyph(), radius
