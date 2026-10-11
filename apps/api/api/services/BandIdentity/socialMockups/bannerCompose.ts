/**
 * LA COMPOSITION D'UNE BANNIÈRE — exactement la méthode des flyers, appliquée aux bannières.
 *
 * Avant : une bannière était une seule composition fixe (`variant % 3`), les tailles de texte
 * devinées au nombre de signes, le contraste vérifié contre un fond supposé plat. Résultat jugé
 * « jamais professionnel » : les promesses longues débordaient, les logos se lisaient mal sur
 * certains fonds, les trois compositions se ressemblaient.
 *
 * Maintenant, la même méthode que `poster.compose.ts` :
 *  1. des palettes VÉRIFIÉES, tirées de la charte (`buildSchemes`, jamais de fond sombre : la
 *     politique de surface claire s'applique aux livrables de charte) ;
 *  2. un logo ANALYSÉ (`analyzeLogo`) : ses encres, pour le poser où il se lit, cartouche sinon ;
 *  3. plusieurs candidats (gabarit × palette), choisis par la graine du projet — deux marques ne
 *     reçoivent pas la même bannière, une marque régénérée garde la sienne ;
 *  4. chaque candidat RENDU ET MESURÉ dans le navigateur (`renderPoster`) : la promesse est
 *     ajustée AU MILLIMÈTRE à sa zone sûre (jamais devinée), le contraste est lu sur les pixels
 *     réels sous le texte et sous le logo. Le candidat le mieux mesuré est retenu.
 */
import crypto from 'crypto';
import type { DocumentDesignSystem } from '../../design/documentDesignSystem';
import { analyzeLogo } from '../../../../../ivision/core/src/visual/poster/poster.images';
import { posterFonts, renderPoster } from '../../../../../ivision/core/src/visual/poster/poster.render';
import { buildSchemes } from '../../../../../ivision/core/src/visual/poster/poster.schemes';
import type { PosterSpec } from '../../../../../ivision/core/src/visual/poster/poster.types';
import { AVATAR_ON_LEFT, bannerGeometry } from './bannerGeometry';
import type { BannerFormat } from './bannerGeometry';
import { BANNER_TEMPLATES } from './bannerTemplates';
import type { BannerCtx } from './bannerTemplates';

export interface BannerBrand {
  brandName: string;
  /** Une ligne, huit mots au plus. */
  promise: string;
  ds: DocumentDesignSystem;
  logos: {
    /** Logo complet à encre foncée, pour fond clair. */
    lightGround?: string;
    darkGround?: string;
    iconLightGround?: string;
    iconDarkGround?: string;
  };
  /** Graine : deux projets n'obtiennent pas la même bannière, un projet régénéré garde la sienne. */
  seedKey: string;
}

/** Candidats rendus par bannière : le coût (rendu Chromium mesuré) reste comparable à un flyer en cran Medium. */
const CANDIDATE_COUNT = 3;

function hash(text: string): number {
  return crypto.createHash('sha1').update(text).digest().readUInt32BE(0);
}

/** Mélange déterministe (Fisher-Yates sur une graine). */
function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  let s = seed || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Compose une bannière : plusieurs candidats construits, rendus et mesurés ; le mieux noté est
 * retenu (jamais de défaut bloquant qui ne cède pas la place à un autre candidat, sauf si aucun
 * n'y échappe — la meilleure mesure l'emporte alors, une bannière n'est jamais vide).
 */
export async function composeBanner(brand: BannerBrand, format: BannerFormat, width: number, height: number): Promise<Buffer> {
  const { colors, fonts: typography } = brand.ds;
  const palette = { primary: colors.primary, secondary: colors.secondary, accent: colors.accent, background: colors.surface, text: colors.ink };
  const schemes = buildSchemes(palette);
  const fonts = posterFonts({ primaryFont: typography.display, secondaryFont: typography.body, primary: { family: typography.display, cssUrl: typography.displayCss }, secondary: { family: typography.body, cssUrl: typography.bodyCss } });
  // L'icône se lit mieux à cette échelle que le lockup complet (nom + icône) : moins de détail à retenir.
  const logoUrl = brand.logos.iconDarkGround || brand.logos.iconLightGround || brand.logos.darkGround || brand.logos.lightGround;
  const logo = await analyzeLogo(logoUrl);
  const geometry = bannerGeometry(format, width, height);
  const ctx: BannerCtx = { ds: brand.ds, avatarLeft: AVATAR_ON_LEFT.has(format), promise: brand.promise.trim() || brand.brandName };

  const seed = hash(`${brand.seedKey}:${format}`);
  const templates = seededShuffle(BANNER_TEMPLATES, seed).slice(0, CANDIDATE_COUNT);

  // Le meilleur candidat SANS défaut bloquant l'emporte ; à défaut, le mieux noté des candidats
  // bloquants sert de filet — jamais d'échec, jamais de page vide.
  let bestClean: { png: Buffer; score: number } | null = null;
  let bestAny: { png: Buffer; score: number } | null = null;
  for (let i = 0; i < templates.length; i++) {
    const template = templates[i];
    const scheme = schemes[(seed + i) % schemes.length];
    const spec: PosterSpec = {
      format: 'banner',
      ...geometry,
      copy: { headline: ctx.promise, facts: [] },
      scheme,
      palette,
      extraImages: [],
      treatment: 'natural',
      logo,
      brandName: brand.brandName,
      mirror: false,
      language: 'fr',
    };
    try {
      const body = template.render(spec, ctx);
      const rendered = await renderPoster(spec, body, fonts);
      const candidate = { png: rendered.png, score: rendered.measure.score };
      if (!bestAny || candidate.score > bestAny.score) bestAny = candidate;
      if (!rendered.measure.blocking && (!bestClean || candidate.score > bestClean.score)) bestClean = candidate;
    } catch {
      // Un candidat qui échoue cède la place au suivant.
    }
  }
  const best = bestClean ?? bestAny;
  if (best) return best.png;

  // Filet : aucun candidat n'a pu être rendu (Chromium indisponible, police introuvable…) — la
  // composition la plus sobre du lot, posée sans mesure, pour que la page ne reste jamais vide.
  const fallbackScheme = schemes[0];
  const fallbackSpec: PosterSpec = { format: 'banner', ...geometry, copy: { headline: ctx.promise, facts: [] }, scheme: fallbackScheme, palette, extraImages: [], treatment: 'natural', logo, brandName: brand.brandName, mirror: false, language: 'fr' };
  const body = BANNER_TEMPLATES[2].render(fallbackSpec, ctx); // « Signature centrée » : la composition la plus universelle.
  const rendered = await renderPoster(fallbackSpec, body, fonts);
  return rendered.png;
}
