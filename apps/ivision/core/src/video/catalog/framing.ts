/**
 * LE SUJET HORS DES TEXTES (24/11/2026) — la préparation des médias (`assets/prepare.ts`) trouve le point d'intérêt de
 * chaque image, par format ; jusqu'ici le moteur catalogue ne s'en servait pas : une image plein cadre restait centrée
 * (`object-position: 50% 50%`) et un titre pouvait tomber sur le visage ou le produit.
 *
 * Une image en `object-fit: cover` déborde de son cadre sur un axe : ce débord est une marge de manœuvre. La page mesure
 * le cadre et les textes posés dessus (après leur mise à la taille), puis cherche, sur une grille, la position de
 * l'image (`object-position`) qui :
 *   1. garde le sujet HORS des textes (aire du sujet sous un texte, poids 3) ;
 *   2. garde le sujet DANS le cadre (aire hors cadre, poids 2) ;
 *   3. s'écarte le moins possible du cadrage centré sur le sujet (poids 0,4).
 * Sans texte dessus, c'est le cadrage centré sur le sujet (le recadrage de smartcrop, appliqué enfin).
 *
 * Fonction PURE, recopiée telle quelle dans le runtime de la page (`toString`) : elle ne lit rien hors d'elle-même.
 */

export interface FrameBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FramingResult {
  /** La position de l'image (0..1 sur chaque axe), à poser en `object-position`. */
  px: number;
  py: number;
  /** La part du sujet sous un texte : au cadrage centré, puis à la position retenue. */
  before: number;
  after: number;
  /** Le centre du sujet dans le cadre (0..1) à la position retenue. */
  cx: number;
  cy: number;
}

/**
 * `frame` : taille du cadre ; `aspect` : largeur / hauteur de l'image ; `focus` : point d'intérêt (0..1 dans l'image) ;
 * `obstacles` : boîtes des textes, dans le repère du cadre.
 */
export const frameSubject = (frame: { w: number; h: number }, aspect: number, focus: { x: number; y: number }, obstacles: FrameBox[]): FramingResult | null => {
  if (!(frame.w > 0 && frame.h > 0 && aspect > 0)) return null;
  const wide = frame.w / frame.h > aspect;
  const rw = wide ? frame.w : frame.h * aspect;
  const rh = wide ? frame.w / aspect : frame.h;
  const sx = rw - frame.w;
  const sy = rh - frame.h;
  // La préparation donne le CENTRE du sujet, pas sa taille : on le suppose assez grand (42 % du petit côté) — mieux
  // vaut ne pas bouger que couper un visage au bord du cadre.
  const side = 0.42 * Math.min(frame.w, frame.h);
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const px0 = sx > 1 ? clamp((focus.x * rw - frame.w / 2) / sx) : 0.5;
  const py0 = sy > 1 ? clamp((focus.y * rh - frame.h / 2) / sy) : 0.5;
  const subjectAt = (px: number, py: number) => {
    const cx = -sx * px + focus.x * rw;
    const cy = -sy * py + focus.y * rh;
    return { x: cx - side / 2, y: cy - side / 2, w: side, h: side };
  };
  const inter = (a: FrameBox, b: FrameBox) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const area = side * side;
  const covered = (s: FrameBox) => Math.min(1, obstacles.reduce((n, o) => n + inter(s, o), 0) / area);
  const outside = (s: FrameBox) => 1 - inter(s, { x: 0, y: 0, w: frame.w, h: frame.h }) / area;
  // Le sujet ne sort JAMAIS plus du cadre qu'au cadrage centré (contrainte dure : un visage coupé est pire qu'un titre
  // posé dessus — le voile de la mise en page garde le titre lisible).
  const out0 = outside(subjectAt(px0, py0));
  // LA BANDE DES TIERS : le centre du sujet reste entre 30 et 70 % du cadre sur chaque axe (une ligne de tiers est une
  // place classique du sujet) — ou pas plus loin du bord qu'au cadrage centré. La taille réelle du sujet est inconnue :
  // cette borne évite de couper un grand sujet en le poussant vers un bord.
  const inBand = (c: number, size: number, c0: number) => {
    const f = c / size;
    const f0 = c0 / size;
    return f >= Math.min(0.3, f0) - 1e-6 && f <= Math.max(0.7, f0) + 1e-6;
  };
  const s0 = subjectAt(px0, py0);
  const cost = (px: number, py: number) => {
    const s = subjectAt(px, py);
    if (outside(s) > out0 + 0.005) return Infinity;
    if (!inBand(s.x + side / 2, frame.w, s0.x + side / 2) || !inBand(s.y + side / 2, frame.h, s0.y + side / 2)) return Infinity;
    return 3 * covered(s) + 0.4 * (Math.abs(px - px0) + Math.abs(py - py0));
  };
  let best = { px: px0, py: py0, c: cost(px0, py0) };
  if (obstacles.length && (sx > 1 || sy > 1)) {
    const xs = sx > 1 ? Array.from({ length: 21 }, (_, k) => k / 20) : [px0];
    const ys = sy > 1 ? Array.from({ length: 21 }, (_, k) => k / 20) : [py0];
    for (const px of xs) for (const py of ys) {
      const c = cost(px, py);
      if (c < best.c - 1e-6) best = { px, py, c };
    }
    // Affinage autour du meilleur point (pas de 0,5 %) : la place où le sujet tient entier à côté d'un texte est
    // souvent étroite.
    const fine = (v0: number, slack: number) => (slack > 1 ? Array.from({ length: 21 }, (_, k) => Math.max(0, Math.min(1, v0 - 0.05 + k * 0.005))) : [v0]);
    const gx = best.px;
    const gy = best.py;
    for (const px of fine(gx, sx)) for (const py of fine(gy, sy)) {
      const c = cost(px, py);
      if (c < best.c - 1e-6) best = { px, py, c };
    }
    // Un gain trop faible ne vaut pas de décentrer l'image (8 points et 40 % de ce qui était couvert, au moins).
    const c0 = covered(s0);
    const c1 = covered(subjectAt(best.px, best.py));
    if (c0 - c1 < 0.08 || c1 > c0 * 0.6) best = { px: px0, py: py0, c: 0 };
  }
  const r3 = (v: number) => Math.round(v * 1000) / 1000;
  const s1 = subjectAt(best.px, best.py);
  return { px: r3(best.px), py: r3(best.py), before: r3(covered(s0)), after: r3(covered(s1)), cx: r3((s1.x + side / 2) / frame.w), cy: r3((s1.y + side / 2) / frame.h) };
};

/** Le code de la page (même source que ci-dessus). */
export const FRAMING_JS = `var frameSubject = ${frameSubject.toString()};`;

/** Les formats du catalogue → leur code dans la page (`#comp[data-f]`). */
export const FORMAT_CODE: Record<string, 'st' | 'po' | 'sq' | 'ls'> = { story: 'st', portrait: 'po', square: 'sq', landscape: 'ls' };
