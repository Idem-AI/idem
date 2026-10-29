/**
 * LE JUGE — ÉTAGE 2 : LA COMPOSITION, mesurée sur des boîtes exactes et des pixels (jamais le goût d'un modèle).
 *
 *   alignement    part des éléments qui partagent un bord ou un axe avec un autre (lignes d'alignement) ;
 *   grille        écart des bords aux colonnes de la grille ;
 *   équilibre     différence des masses gauche/droite et haut/bas (Ngo et al., « balance ») ;
 *   centre        distance du centre des masses au centre de l'image (Ngo et al., « equilibrium ») ;
 *   densité       part occupée de la zone sûre (ni vide, ni bourrée : 22–55 %) ;
 *   hiérarchie    rapport de taille titre / texte suivant (≥ 1,5) ;
 *   principal     l'élément principal n'est pas timide (titre ≥ 4,5 % de la hauteur, visuel ≥ 12 % de l'image) ;
 *   respiration   blanc autour de l'élément principal ;
 *   tailles       au plus 4 tailles de texte dans la scène ;
 *   encombrement  densité de contours de l'image rendue (AIM, « feature congestion » approchée) ;
 *   couleurs      nombre de teintes notables dans l'image (≤ 5) ;
 *   contraste     le texte le moins lisible (figure-fond, mesuré sur les pixels autour de lui).
 *
 * Chaque mesure vaut 0 → 1 (1 = bon) ; les réglages sont des points de départ, étalonnés sur le banc.
 */
import type { Box } from '../solver/geometry';

export interface JudgeElement {
  id: string;
  kind: 'text' | 'media' | 'shape' | 'logo' | 'icon' | 'other';
  box: Box;
  /** Taille du texte (u). */
  size?: number;
  rank?: number;
}

export interface JudgeFrame {
  W: number;
  H: number;
  L: number;
  R: number;
  T: number;
  B: number;
  SW: number;
  SH: number;
}

export interface RasterImage {
  data: Uint8Array | Buffer;
  width: number;
  height: number;
  /** 3 (RGB) ou 4 (RGBA). */
  channels: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const w = (b: Box) => b.x1 - b.x0;
const h = (b: Box) => b.y1 - b.y0;
const area = (b: Box) => Math.max(0, w(b)) * Math.max(0, h(b));

/** Les mesures de composition sur les boîtes (sans pixels). */
export function compositionMetrics(elements: JudgeElement[], frame: JudgeFrame, grid: { columns: number; gutter: number }): Record<string, number> {
  const els = elements.filter((e) => area(e.box) > 0.01 && w(e.box) < frame.W * 0.99);
  const out: Record<string, number> = {};
  // Alignement : une ligne partagée (bord gauche, axe, bord droit, haut) à 0,8 u près.
  const tol = 0.8;
  const lines = (e: JudgeElement) => [e.box.x0, (e.box.x0 + e.box.x1) / 2, e.box.x1, e.box.y0];
  const aligned = els.filter((e) => els.some((o) => o !== e && lines(e).some((a, k) => Math.abs(a - lines(o)[k]) <= tol)));
  out.alignment = els.length <= 1 ? 1 : aligned.length / els.length;
  // Grille : les bords gauches et droits des éléments sur les colonnes.
  const colW = (frame.SW - grid.gutter * (grid.columns - 1)) / grid.columns;
  const edges: number[] = [];
  for (let k = 0; k <= grid.columns; k++) {
    edges.push(frame.L + k * (colW + grid.gutter));
    edges.push(frame.L + k * (colW + grid.gutter) - grid.gutter);
  }
  edges.push(0);
  const dist = (x: number) => Math.min(...edges.map((e) => Math.abs(e - x)));
  const snapped = els.filter((e) => e.kind !== 'shape').map((e) => Math.min(dist(e.box.x0), dist((e.box.x0 + e.box.x1) / 2)));
  out.grid = snapped.length ? snapped.reduce((a, d) => a + Math.exp(-d / 1.5), 0) / snapped.length : 1;
  const content = els.filter((e) => e.kind !== 'shape');
  // Équilibre et centre des masses (masse = surface ; les textes pèsent double : le regard s'y arrête).
  const mass = (e: JudgeElement) => area(e.box) * (e.kind === 'text' ? 2 : 1);
  const total = els.reduce((a, e) => a + mass(e), 0) || 1;
  const mx = els.reduce((a, e) => a + mass(e) * ((e.box.x0 + e.box.x1) / 2), 0) / total;
  const my = els.reduce((a, e) => a + mass(e) * ((e.box.y0 + e.box.y1) / 2), 0) / total;
  const side = (pred: (c: number) => boolean, axis: 'x' | 'y') => els.reduce((a, e) => a + (pred(axis === 'x' ? (e.box.x0 + e.box.x1) / 2 : (e.box.y0 + e.box.y1) / 2) ? mass(e) : 0), 0);
  const bx = Math.abs(side((c) => c < 0, 'x') - side((c) => c > 0, 'x')) / total;
  const by = Math.abs(side((c) => c < 0, 'y') - side((c) => c > 0, 'y')) / total;
  // Une composition alignée à gauche (ou à droite) est asymétrique à dessein : l'équilibre se mesure alors autour de
  // son axe (le tiers où elle se pose), pas du centre de l'image.
  const lefts = content.filter((e) => Math.abs(e.box.x0 - Math.min(...content.map((o) => o.box.x0))) < 0.8).length;
  const anchoredLeft = content.length > 0 && lefts === content.length && Math.min(...content.map((o) => o.box.x0)) < frame.L + frame.SW * 0.1;
  const axis = anchoredLeft ? frame.L + frame.SW / 3 : 0;
  const bxa = anchoredLeft ? Math.abs(side((c) => c < axis, 'x') - side((c) => c > axis, 'x')) / total : bx;
  out.balance = clamp01(1 - (Math.min(bx, bxa) + by) / 2);
  out.equilibrium = clamp01(1 - Math.hypot((mx - axis) / (frame.SW / 2), my / (frame.SH / 2)) / 1.2);
  // Densité de la zone sûre.
  const occupied = content.reduce((a, e) => a + Math.min(area(e.box), frame.SW * frame.SH), 0) / (frame.SW * frame.SH);
  // Une scène d'une seule idée (un ou deux éléments) est légitimement aérée : le plancher suit le nombre d'éléments.
  const floor = 0.22 * Math.min(1, Math.max(0.3, content.length / 3));
  out.density = occupied < floor ? clamp01(occupied / floor) : occupied > 0.55 ? clamp01(1 - (occupied - 0.55) / 0.45) : 1;
  // Hiérarchie : le titre domine le texte suivant.
  const texts = els.filter((e) => e.kind === 'text' && e.size).sort((a, b) => (b.size || 0) - (a.size || 0));
  out.hierarchy = texts.length < 2 ? 1 : clamp01(((texts[0].size || 1) / (texts[1].size || 1) - 1) / 0.6);
  // L'élément principal.
  const main = els.find((e) => e.rank === 1) || texts[0];
  if (main) {
    // Un titre principal vise ≈ 6 % de la hauteur (fourchette 4–9 % des films de lancement mesurés par HyperFrames).
    out.mainScale = main.kind === 'text' && main.size ? clamp01((main.size / frame.H) / 0.06) : clamp01(area(main.box) / (frame.W * frame.H) / 0.12);
    const others = els.filter((e) => e !== main && e.kind !== 'shape');
    const gap = others.length ? Math.min(...others.map((o) => Math.max(o.box.x0 - main.box.x1, main.box.x0 - o.box.x1, o.box.y0 - main.box.y1, main.box.y0 - o.box.y1))) : 99;
    out.breathing = clamp01(gap / Math.max(1.5, (main.size || 6) * 0.35));
  } else {
    out.mainScale = 0.5;
    out.breathing = 0.5;
  }
  const sizes = new Set(texts.map((t) => Math.round((t.size || 0) * 2) / 2));
  out.sizes = sizes.size <= 4 ? 1 : clamp01(1 - (sizes.size - 4) * 0.25);
  return out;
}

/** Les mesures sur les pixels de l'image rendue : encombrement (contours), nombre de teintes notables. */
export function pixelMetrics(img: RasterImage): Record<string, number> {
  const { data, width, height, channels } = img;
  const lum = (x: number, y: number) => {
    const i = (y * width + x) * channels;
    return 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  };
  // Encombrement : part des pixels où le gradient (Sobel simplifié) dépasse un seuil.
  let edges = 0;
  let n = 0;
  const step = Math.max(1, Math.floor(Math.min(width, height) / 220));
  for (let y = step; y < height - step; y += step) {
    for (let x = step; x < width - step; x += step) {
      const gx = lum(x + step, y) - lum(x - step, y);
      const gy = lum(x, y + step) - lum(x, y - step);
      if (Math.hypot(gx, gy) > 38) edges++;
      n++;
    }
  }
  const edgeDensity = n ? edges / n : 0;
  // Teintes notables : 12 secteurs de teinte, saturation > 0,25, couverture > 2 %.
  const bins = new Array(12).fill(0);
  let counted = 0;
  for (let y = 0; y < height; y += step * 2) {
    for (let x = 0; x < width; x += step * 2) {
      const i = (y * width + x) * channels;
      const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      counted++;
      const sat = max === 0 ? 0 : (max - min) / max;
      if (sat < 0.25 || max < 0.15) continue;
      let hue = 0;
      if (max === r) hue = ((g - b) / (max - min)) % 6;
      else if (max === g) hue = (b - r) / (max - min) + 2;
      else hue = (r - g) / (max - min) + 4;
      bins[Math.floor((((hue * 60) % 360) + 360) % 360 / 30)]++;
    }
  }
  const hues = bins.filter((c) => counted && c / counted > 0.02).length;
  return {
    clutter: clamp01(1 - (edgeDensity - 0.05) / 0.2),
    colors: hues <= 5 ? 1 : clamp01(1 - (hues - 5) * 0.2),
    edgeDensity: Math.round(edgeDensity * 1000) / 1000,
  };
}

/** Le contraste figure-fond : le texte le moins lisible (contraste mesuré par le contrôle sur l'image rendue). */
export function contrastMetric(minContrast: number | undefined): number {
  if (minContrast === undefined) return 1;
  return clamp01((minContrast - 2.2) / (4.5 - 2.2));
}
