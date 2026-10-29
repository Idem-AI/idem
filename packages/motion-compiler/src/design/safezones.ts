/**
 * LES ZONES SÛRES PAR PLATEFORME — la source unique, lue par le compilateur, le solveur, l'auteur et le kit
 * du navigateur (`safeArea`). Aucune dépendance : ce fichier entre aussi dans le paquet de la page.
 *
 * Les marges sont en pixels de COMPOSITION (1080×1920, 1080×1350, 1080×1080, 1920×1080) :
 *
 *   story      les guides 2026 divergent (TikTok, Reels, Shorts posent leurs boutons à des endroits
 *              différents) : on retient l'enveloppe prudente, ≈ 900×1400 au centre ;
 *   portrait   le fil 4:5 : peu d'interface par-dessus, une marge de respiration ;
 *   square     idem ;
 *   landscape  la zone « titre » de la télévision et de YouTube (≈ 90 % de l'image).
 */

export type SafeFormat = 'story' | 'portrait' | 'square' | 'landscape';

export interface SafeMargins {
  /** Marge à gauche et à droite (px de composition). */
  x: number;
  /** Marge en haut et en bas (px de composition). */
  y: number;
}

export const SAFE_MARGINS: Record<SafeFormat, SafeMargins> = {
  story: { x: 90, y: 260 },
  portrait: { x: 72, y: 96 },
  square: { x: 72, y: 72 },
  landscape: { x: 108, y: 72 },
};

export const COMPOSITION_SIZE: Record<SafeFormat, { width: number; height: number }> = {
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1350 },
  landscape: { width: 1920, height: 1080 },
};

export interface SafeBox {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** La zone sûre d'un format, origine au centre, dans l'unité voulue (px par défaut, `unit` = 1 % du petit côté pour des u). */
export function safeBox(format: SafeFormat, size?: { width: number; height: number }, unit = 1): SafeBox {
  const base = COMPOSITION_SIZE[format] || COMPOSITION_SIZE.story;
  const w = size?.width ?? base.width;
  const h = size?.height ?? base.height;
  // Une composition d'une autre taille (rare) garde les mêmes proportions de marge.
  const m = SAFE_MARGINS[format] || SAFE_MARGINS.story;
  const mx = (m.x * w) / base.width;
  const my = (m.y * h) / base.height;
  const width = (w - 2 * mx) / unit;
  const height = (h - 2 * my) / unit;
  return { width, height, left: -width / 2, right: width / 2, top: -height / 2, bottom: height / 2 };
}

/** Le cadre d'un format en u (1 % du petit côté) : ce que le langage appelle W, H, L, R, T, B, SW, SH. */
export function frameInUnits(format: SafeFormat): { W: number; H: number; L: number; R: number; T: number; B: number; SW: number; SH: number; u: number } {
  const size = COMPOSITION_SIZE[format] || COMPOSITION_SIZE.story;
  const u = Math.min(size.width, size.height) / 100;
  const box = safeBox(format, size, u);
  return { W: size.width / u, H: size.height / u, L: box.left, R: box.right, T: box.top, B: box.bottom, SW: box.width, SH: box.height, u };
}
