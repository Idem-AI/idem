/**
 * Les couleurs du site s'accordent-elles avec son logo ?
 *
 * Une refonte garde la marque telle qu'elle est (couleurs, polices, logo). Une seule exception, proposée et jamais
 * imposée : quand la couleur principale du site n'a rien à voir avec le logo (un site bleu pour un logo vert et
 * orange), on demande à l'utilisateur s'il veut des couleurs fidèles au logo. Mesuré, pas deviné : distance
 * perceptuelle (CIELAB, ΔE 1976) entre la couleur principale du site et les couleurs franches du logo.
 */

interface Lab {
  l: number;
  a: number;
  b: number;
}

function hexToLab(hex: string): Lab | null {
  const m = String(hex || '').trim().match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (!m) return null;
  const full = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return { l: 116 * f(y) - 16, a: 500 * (f(x) - f(y)), b: 200 * (f(y) - f(z)) };
}

const deltaE = (p: Lab, q: Lab) => Math.hypot(p.l - q.l, p.a - q.a, p.b - q.b);
const chroma = (p: Lab) => Math.hypot(p.a, p.b);

export interface BrandCheck {
  /** Les couleurs du site et du logo vont ensemble (ou le logo est sans couleur franche). */
  coherent: boolean;
  sitePrimary: string;
  /** Les couleurs franches du logo. */
  logoColors: string[];
  /** La distance mesurée (pour les journaux). */
  distance: number;
}

/** Au-delà, deux couleurs ne passent plus pour la même teinte de marque. */
const MAX_DISTANCE = 28;

export function checkBrandColors(sitePrimary: string, logoColors: string[]): BrandCheck {
  const site = hexToLab(sitePrimary);
  const chromatic = logoColors.filter((hex) => {
    const lab = hexToLab(hex);
    return !!lab && chroma(lab) >= 18 && lab.l > 8 && lab.l < 96;
  });
  if (!site || !chromatic.length) return { coherent: true, sitePrimary, logoColors: chromatic, distance: 0 };
  const distance = Math.min(...chromatic.map((hex) => deltaE(site, hexToLab(hex)!)));
  return { coherent: distance <= MAX_DISTANCE, sitePrimary, logoColors: chromatic.slice(0, 4), distance: Math.round(distance) };
}
