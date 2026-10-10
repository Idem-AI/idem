/**
 * Les couleurs d'un site, devenues une palette de marque — et trois propositions.
 *
 * Le scan relève chaque couleur VUE (pondérée par la surface qu'elle occupe et par son rôle :
 * fond, texte, bouton, lien, titre, variable CSS nommée « primary » ou « brand », couleur du
 * thème du navigateur). Ici, sans aucun modèle :
 *
 *   1. regroupement des teintes voisines (distance perçue, OKLCH) ;
 *   2. neutres (peu de chroma) et couleurs de marque (chroma) séparés ;
 *   3. rôles : la couleur d'action la plus présente devient la primaire, puis une secondaire
 *      d'une autre teinte (ou la couleur sombre de la marque : en-tête, pied de page), un accent ;
 *      le fond est clair (politique de surface claire), le texte le neutre le plus sombre lisible ;
 *   4. trois propositions : fidèle au site, contraste renforcé, harmonie dérivée de la primaire.
 *
 * Toute couleur posée sur un fond reste lisible (contraste AA garanti par `ensureContrast`).
 */
import { contrastRatio, ensureContrast, hexToOklch, Oklch, oklchToHex } from '../design/color';
import { normalizeHex, BrandPalette } from '../brand/brand-kit';

export type ColorRole = 'background' | 'text' | 'action' | 'heading' | 'link' | 'surface' | 'variable' | 'theme' | 'border';

export interface SeenColor {
  hex: string;
  /** Surface vue (px²) ou poids conventionnel pour une variable, une couleur de thème. */
  weight: number;
  role: ColorRole;
}

export interface ColorCluster {
  hex: string;
  weight: number;
  roles: ColorRole[];
  chroma: number;
  lightness: number;
  hue: number;
}

export interface PaletteProposal {
  id: 'site' | 'contrast' | 'harmony';
  label: string;
  rationale: string;
  colors: BrandPalette;
}

/** Poids d'un rôle : une couleur de bouton dit plus de la marque qu'un fond de section. */
const ROLE_WEIGHT: Record<ColorRole, number> = { action: 6, theme: 5, variable: 4, link: 3, heading: 2.5, surface: 1.2, border: 0.6, text: 1, background: 1 };

const ok = (hex: string): Oklch => hexToOklch(hex) || { l: 0.5, c: 0, h: 0 };

function distance(a: Oklch, b: Oklch): number {
  const dh = Math.min(Math.abs(a.h - b.h), 360 - Math.abs(a.h - b.h)) / 180;
  const chromaFactor = Math.min(a.c, b.c) > 0.04 ? 1 : 0.2;
  return Math.sqrt((a.l - b.l) ** 2 * 2 + (a.c - b.c) ** 2 * 4 + (dh * chromaFactor) ** 2 * 0.6);
}

/** Les couleurs vues, regroupées : une teinte de marque déclinée en trois nuances reste une couleur. */
/**
 * Couleurs que le NAVIGATEUR donne aux liens non stylés (bleu, violet des liens visités, rouge
 * des liens actifs) : elles ne disent rien de la marque, un site qui n'a pas habillé ses liens
 * n'a pas choisi le bleu.
 */
const USER_AGENT_LINK_COLORS = new Set(['#0000ee', '#551a8b', '#ee0000', '#0000ff', '#1a0dab', '#660099']);

export function clusterColors(seen: SeenColor[]): ColorCluster[] {
  const clusters: { members: SeenColor[]; center: Oklch }[] = [];
  for (const s of seen) {
    const hex = normalizeHex(s.hex);
    if (!hex) continue;
    if (s.role === 'link' && USER_AGENT_LINK_COLORS.has(hex)) continue;
    const o = ok(hex);
    const near = clusters.find((c) => distance(c.center, o) < 0.09);
    if (near) near.members.push({ ...s, hex });
    else clusters.push({ members: [{ ...s, hex }], center: o });
  }
  return clusters
    .map((c) => {
      // Le représentant : la nuance la plus « pesée » du groupe (pas une moyenne qui n'existe nulle part).
      const byHex = new Map<string, number>();
      for (const m of c.members) byHex.set(m.hex, (byHex.get(m.hex) || 0) + m.weight * ROLE_WEIGHT[m.role]);
      const hex = [...byHex.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const o = ok(hex);
      return {
        hex,
        weight: c.members.reduce((s, m) => s + m.weight * ROLE_WEIGHT[m.role], 0),
        roles: [...new Set(c.members.map((m) => m.role))],
        chroma: o.c,
        lightness: o.l,
        hue: o.h,
      };
    })
    .sort((a, b) => b.weight - a.weight);
}

const isNeutral = (c: { chroma: number }) => c.chroma < 0.045;
const hueGap = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

/** La palette « fidèle au site ». */
export function paletteFromClusters(clusters: ColorCluster[]): { palette: BrandPalette; warnings: string[] } {
  const warnings: string[] = [];
  const chromatic = clusters.filter((c) => !isNeutral(c));
  const neutrals = clusters.filter(isNeutral);
  // Les couleurs d'action et de thème décident de la primaire, avant la surface.
  const actionScore = (c: ColorCluster) => c.weight * (c.roles.some((r) => r === 'action' || r === 'theme' || r === 'variable') ? 3 : 1) * (0.6 + Math.min(c.chroma, 0.25) * 2);
  const ranked = [...chromatic].sort((a, b) => actionScore(b) - actionScore(a));
  let primary = ranked[0]?.hex;
  if (!primary) {
    warnings.push('Aucune couleur de marque nette sur le site : primaire déduite du neutre le plus sombre.');
    primary = neutrals.find((n) => n.lightness < 0.45)?.hex || '#1f4e5f';
  }
  const p = ok(primary);
  // Secondaire : une autre teinte, sinon la couleur sombre de la marque (en-tête, pied de page).
  const secondary =
    ranked.find((c) => c.hex !== primary && hueGap(c.hue, p.h) > 25)?.hex ||
    ranked.find((c) => c.hex !== primary && Math.abs(c.lightness - p.l) > 0.18)?.hex ||
    neutrals.filter((n) => n.lightness < 0.35).sort((a, b) => b.weight - a.weight)[0]?.hex ||
    oklchToHex({ l: Math.max(0.22, p.l - 0.28), c: p.c * 0.7, h: p.h });
  const s = ok(secondary);
  // Accent : une troisième teinte du site, sinon la complémentaire douce de la primaire.
  const accent =
    ranked.find((c) => ![primary, secondary].includes(c.hex) && hueGap(c.hue, p.h) > 35 && hueGap(c.hue, s.h) > 25)?.hex ||
    oklchToHex({ l: Math.min(0.78, Math.max(0.62, p.l + 0.12)), c: Math.max(0.12, p.c), h: (p.h + 150) % 360 });
  // Fond : le neutre clair le plus présent (surface claire, toujours) ; texte : le neutre sombre lisible.
  const light = neutrals.filter((n) => n.lightness > 0.9).sort((a, b) => b.weight - a.weight)[0]?.hex;
  const background = light || '#ffffff';
  if (!light && neutrals.some((n) => n.lightness < 0.3 && n.roles.includes('background'))) {
    warnings.push('Site sur fond sombre : les créations gardent une surface claire, teintée de la marque.');
  }
  const darkText = neutrals.filter((n) => n.lightness < 0.4 && n.roles.includes('text')).sort((a, b) => b.weight - a.weight)[0]?.hex;
  const text = ensureContrast(darkText || '#16181d', background, 7);
  return { palette: { primary, secondary, accent, background, text }, warnings };
}

/** Trois propositions à partir de la palette du site : fidèle, contrastée, harmonie dérivée. */
export function paletteProposals(site: BrandPalette): PaletteProposal[] {
  const p = ok(site.primary);
  const contrast: BrandPalette = {
    primary: ensureContrast(site.primary, site.background, 3),
    secondary: oklchToHex({ ...ok(site.secondary), l: Math.min(ok(site.secondary).l, 0.32) }),
    accent: oklchToHex({ ...ok(site.accent), c: Math.max(ok(site.accent).c, 0.15) }),
    background: site.background,
    text: ensureContrast(site.text, site.background, 7),
  };
  const harmony: BrandPalette = {
    primary: site.primary,
    secondary: oklchToHex({ l: Math.max(0.24, Math.min(0.4, p.l - 0.25)), c: Math.max(0.05, p.c * 0.8), h: (p.h + 330) % 360 }),
    accent: oklchToHex({ l: Math.min(0.8, Math.max(0.66, p.l + 0.1)), c: Math.max(0.12, p.c * 0.9), h: (p.h + 40) % 360 }),
    background: oklchToHex({ l: 0.975, c: Math.min(0.012, p.c * 0.08), h: p.h }),
    text: oklchToHex({ l: 0.2, c: Math.min(0.02, p.c * 0.15), h: p.h }),
  };
  return [
    { id: 'site', label: 'Fidèle au site', rationale: 'Les couleurs relevées sur votre site, telles quelles.', colors: site },
    { id: 'contrast', label: 'Contraste renforcé', rationale: 'Les mêmes teintes, plus affirmées : lisibles sur mobile et en vidéo.', colors: contrast },
    { id: 'harmony', label: 'Harmonie', rationale: 'Votre couleur principale, entourée de teintes voisines calculées pour elle.', colors: harmony },
  ].map((x) => ({ ...x, colors: { ...x.colors, text: contrastRatio(x.colors.text, x.colors.background) >= 4.5 ? x.colors.text : ensureContrast(x.colors.text, x.colors.background, 4.5) } })) as PaletteProposal[];
}
