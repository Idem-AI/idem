/**
 * Adapter le logo EXISTANT à une nouvelle palette ou à une nouvelle police —
 * sans IA, sans toucher à son dessin.
 *
 * Deux gestes, tous deux déterministes :
 *
 *   · RECOLORER. Chaque couleur du logo est rattachée au rôle de la palette
 *     dont elle est la plus proche (principale, secondaire, accent, encre), puis
 *     remplacée par la nouvelle couleur de ce rôle en gardant son ÉCART — une
 *     teinte un peu plus sombre que la principale reste un peu plus sombre que
 *     la nouvelle principale. Une couleur qui ne se rattache à aucun rôle suit
 *     la marque par transport (cf. `paletteHarmony.transportColor`). Les gris,
 *     le noir et le blanc ne bougent pas. Le remplacement passe par le moteur
 *     de déclinaisons (`applyColorMappingToSvg`) qui résout styles, classes,
 *     héritage et dégradés : aucun aplat n'est oublié.
 *
 *   · RECOMPOSER LE NOM. Un logo « icône + nom » garde la recette de son
 *     lockup (`LogoModel.lockup`) : le nom est reposé dans la nouvelle police à
 *     partir de ses vraies métriques, icône et mise en page identiques.
 *     Un logo dont le nom est dessiné dans la forme (types « nom » et
 *     « initiales ») n'a pas de recette : il se régénère, il ne se recompose pas.
 */

import logger from '../../config/logger';
import { LogoModel } from '../../models/logo.model';
import { hexToOklch, oklchToHex } from '../design/color';
import { logoLockupService } from '../BandIdentity/lockup/logoLockup.service';
import { applyColorMappingToSvg } from '../logoVariationEngine.service';
import { extractColorsFromSvg, resolveSvgContent } from '../logo-import.service';
import { BrandFontTokens, BrandPalette, normalizeHex } from './brandTokens';
import { transportColor } from './paletteHarmony';

/** Distance OKLab sous laquelle une couleur du logo « est » un rôle de la palette. */
const ROLE_MATCH_DISTANCE = 0.16;
/** Chroma sous laquelle une couleur est un gris : elle ne suit pas la marque. */
const NEUTRAL_CHROMA = 0.03;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function oklabDistance(a: string, b: string): number {
  const x = hexToOklch(a);
  const y = hexToOklch(b);
  if (!x || !y) return Infinity;
  const ax = x.c * Math.cos((x.h * Math.PI) / 180);
  const ay = x.c * Math.sin((x.h * Math.PI) / 180);
  const bx = y.c * Math.cos((y.h * Math.PI) / 180);
  const by = y.c * Math.sin((y.h * Math.PI) / 180);
  return Math.hypot(x.l - y.l, ax - bx, ay - by);
}

/**
 * Table ancienne couleur → nouvelle couleur pour les couleurs d'un logo.
 * Pure et exportée : c'est elle que vérifie `check:brand`.
 */
export function buildLogoColorMapping(
  logoColors: string[],
  before: Partial<BrandPalette>,
  after: Partial<BrandPalette>
): Record<string, string> {
  const roles = (['primary', 'secondary', 'accent', 'text'] as const).filter(
    (role) => before[role] && after[role]
  );
  const mapping: Record<string, string> = {};

  for (const raw of logoColors) {
    const color = normalizeHex(raw);
    const lch = color ? hexToOklch(color) : null;
    if (!color || !lch || lch.c < NEUTRAL_CHROMA) continue;

    const nearest = roles
      .map((role) => ({ role, distance: oklabDistance(color, before[role]!) }))
      .sort((a, b) => a.distance - b.distance)[0];

    let next: string;
    if (nearest && nearest.distance <= ROLE_MATCH_DISTANCE) {
      // Rôle inchangé : la couleur ne bouge pas (et ne subit pas l'arrondi
      // d'un aller-retour OKLCH).
      if (normalizeHex(before[nearest.role]) === normalizeHex(after[nearest.role])) continue;
      const from = hexToOklch(before[nearest.role]!)!;
      const to = hexToOklch(after[nearest.role]!)!;
      next =
        nearest.distance < 0.01
          ? after[nearest.role]!
          : oklchToHex({
              l: clamp(to.l + (lch.l - from.l), 0.05, 0.98),
              c: clamp(from.c > 0 ? to.c * (lch.c / from.c) : to.c, 0, 0.35),
              h: (to.h + (lch.h - from.h) + 360) % 360,
            });
    } else if (before.primary && after.primary && normalizeHex(before.primary) !== normalizeHex(after.primary)) {
      next = transportColor(color, before.primary, after.primary, 'secondary');
    } else {
      continue;
    }

    if (next !== color) mapping[color] = next;
  }
  return mapping;
}

/**
 * Le moteur pose la nouvelle couleur en style sur chaque élément, mais laisse
 * en place les attributs `fill`/`stroke` et les blocs `<style>` d'origine :
 * masqués, ils porteraient encore l'ancienne marque dans le fichier. Toute
 * occurrence restante d'une couleur de la table est donc remplacée — sans
 * risque, la table ne contient que des couleurs de marque du logo.
 */
function remapRemainingHex(svg: string, mapping: Record<string, string>): string {
  return svg.replace(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/g, (hex) => mapping[normalizeHex(hex)] ?? hex);
}

async function readSvg(value?: string): Promise<string | null> {
  if (!value) return null;
  try {
    const content = await resolveSvgContent(value);
    return content.includes('<svg') ? content : null;
  } catch (error: any) {
    logger.warn(`Logo illisible pour l'adaptation : ${error.message}`);
    return null;
  }
}

/** Le nom du logo peut-il être recomposé dans une autre police, sans IA ? */
export function canRetypesetLogo(logo?: Partial<LogoModel> | null): boolean {
  return !!(logo?.lockup?.brandName && logo.iconSvg);
}

export interface LogoAdaptation {
  /** SVG complet adapté (contenu, pas URL). */
  svg: string;
  /** Icône seule adaptée, si le logo en a une. */
  iconSvg?: string;
  lockup?: LogoModel['lockup'];
  colors: string[];
  recolored: boolean;
  retypeset: boolean;
}

/**
 * Adapte le logo. Renvoie `null` quand rien n'est applicable (logo illisible,
 * aucune couleur de marque dedans, pas de recette de nom) — l'appelant garde
 * alors le logo tel quel plutôt que d'en produire un abîmé.
 */
export async function adaptLogo(
  logo: LogoModel,
  options: {
    palette?: { before: Partial<BrandPalette>; after: Partial<BrandPalette> };
    fonts?: { before: BrandFontTokens; after: BrandFontTokens };
  }
): Promise<LogoAdaptation | null> {
  const [svgSource, iconSource] = await Promise.all([readSvg(logo.svg), readSvg(logo.iconSvg)]);
  if (!svgSource) return null;

  let svg = svgSource;
  let iconSvg = iconSource ?? undefined;
  let lockup = logo.lockup ? { ...logo.lockup } : undefined;
  let recolored = false;
  let retypeset = false;

  // ── 1. Couleurs ─────────────────────────────────────────────────────
  let mapping: Record<string, string> = {};
  if (options.palette) {
    const found = new Set([
      ...extractColorsFromSvg(svgSource),
      ...(iconSource ? extractColorsFromSvg(iconSource) : []),
      ...(logo.colors ?? []),
      ...(lockup?.wordmarkColor ? [lockup.wordmarkColor] : []),
    ]);
    mapping = buildLogoColorMapping([...found], options.palette.before, options.palette.after);
    if (Object.keys(mapping).length > 0) {
      svg = remapRemainingHex(await applyColorMappingToSvg(svg, mapping), mapping);
      if (iconSvg) iconSvg = remapRemainingHex(await applyColorMappingToSvg(iconSvg, mapping), mapping);
      if (lockup?.wordmarkColor) {
        const key = normalizeHex(lockup.wordmarkColor);
        if (mapping[key]) lockup.wordmarkColor = mapping[key];
      }
      recolored = true;
    }
  }

  // ── 2. Nom recomposé dans la nouvelle police ────────────────────────
  const nextFamily = options.fonts?.after.display;
  if (
    options.fonts &&
    nextFamily &&
    nextFamily !== options.fonts.before.display &&
    lockup &&
    iconSvg &&
    canRetypesetLogo(logo)
  ) {
    const composed = await logoLockupService.compose(iconSvg, {
      ...lockup,
      fontFamily: nextFamily,
      fontCssUrl: options.fonts.after.displayCss,
    });
    if (composed) {
      svg = composed.svg;
      iconSvg = composed.iconSvg;
      lockup = composed.spec;
      retypeset = true;
    }
  }

  if (!recolored && !retypeset) return null;

  const colors = (logo.colors ?? []).map((color) => mapping[normalizeHex(color)] ?? color);
  return { svg, iconSvg, lockup, colors, recolored, retypeset };
}
