/**
 * Les pages de la charte COMPOSÉES par le code, sans rédaction.
 *
 * Deux familles :
 *
 *   · les quatre pages de DIRECTION ARTISTIQUE. Elles tenaient sur une page
 *     rédigée librement par le modèle — un nom de style, six mots-clés, quatre
 *     vignettes — que l'on jugeait à raison trop peu détaillée. Tout ce qu'une
 *     direction artistique contient a pourtant déjà été décidé et stocké
 *     (`ArtDirectionModel`) : son parti pris, sa grille, sa densité, son geste,
 *     son traitement d'image, ses règles. Ces pages le MONTRENT, sans le faire
 *     réécrire ;
 *
 *   · les deux pages SOCIALES, qui posent la marque dans les interfaces réelles
 *     des réseaux (cf. `socialMockups/`).
 *
 * Chaque page est rendue par `renderSection`, avec le design system et la
 * graine de la charte : elle appartient au document au même titre que les
 * pages rédigées.
 */

import logger from '../../config/logger';
import { ArtDirectionModel } from '../../models/art-direction.model';
import { ProjectModel } from '../../models/project.model';
import { resolveStyle } from '../design/artDirection.catalog';
import { SectionSeed } from '../design/designSeed';
import { DocumentDesignSystem } from '../design/documentDesignSystem';
import { Block } from '../design/sectionContent';
import {
  ARCHETYPE_LANDSCAPE,
  LandscapeLayout,
  RenderOptions,
  renderSection,
} from '../design/sectionRenderer';
import { CHARTER_PAGE_HEADINGS } from './prompts/page-briefs.prompt';
import {
  MockupUploader,
  PostVisualRenderer,
  SocialBrandKit,
  socialMockupService,
} from './socialMockups/socialMockup.service';

export type ComposedPage = (seed: SectionSeed, index: number) => Promise<string | null>;

export interface ComposedPagesContext {
  project: ProjectModel;
  artDirection: ArtDirectionModel | null;
  designSystem: DocumentDesignSystem;
  /** Options de rendu de la charte (logo de pied, format, page rognée). */
  render: RenderOptions;
  /** Logos pour les pages de repli : encre foncée (fond clair) et claire (fond sombre). */
  logos: { lightGround?: string; darkGround?: string };
  /** La photographie d'univers produite avec les mises en situation. */
  imageryUrl: () => Promise<string | null>;
  socialKit: () => Promise<SocialBrandKit>;
  renderPostVisual: PostVisualRenderer;
  uploadMockup: MockupUploader;
}

/**
 * Structures où les blocs ont la PLEINE largeur de la page.
 *
 * Une page de démonstration — deux mockups côte à côte, le logo et son
 * explication, quatre principes dessinés — ne tient pas dans la colonne des
 * 7/12 que laissent les structures latérales.
 */
const WIDE_LAYOUTS: ReadonlySet<LandscapeLayout> = new Set<LandscapeLayout>([
  'stacked',
  'banner',
  'centered',
  'inset',
  'base',
  // `corner` en est exclu : son titre, cantonné à la moitié de la largeur,
  // prend trois lignes, et les mockups qui suivent passaient sous le pied de
  // page (« Bannières réseaux sociaux », mesuré à l'aperçu).
]);

/**
 * La graine d'une page de démonstration, ramenée à une structure large.
 *
 * On reste dans l'espace de tirage du style : la page change d'archétype, pas
 * de direction artistique.
 */
export function wideSeed(seed: SectionSeed, styleId?: string | null): SectionSeed {
  if (WIDE_LAYOUTS.has(ARCHETYPE_LANDSCAPE[seed.archetype])) return seed;
  const pool = resolveStyle(styleId).seedSpace.archetypes.filter((archetype) =>
    WIDE_LAYOUTS.has(ARCHETYPE_LANDSCAPE[archetype])
  );
  const archetype = pool.length > 0 ? pool[seed.archetype.charCodeAt(0) % pool.length] : 'G';
  return { ...seed, archetype };
}

/**
 * La graine de la page des publications, ramenée à un RAIL.
 *
 * Deux publications en portrait sur une diapositive butent sur la HAUTEUR. Sous
 * un titre posé au-dessus, elles restaient trop petites pour se lire, même une
 * fois leur légende passée à côté. Le rail pose le titre tourné le long du
 * bord : il ne prend aucune hauteur, et les publications occupent presque
 * toute la page. On prend le rail du style quand il en a un, le rail muet sinon.
 */
export function railSeed(seed: SectionSeed, styleId?: string | null): SectionSeed {
  if (ARCHETYPE_LANDSCAPE[seed.archetype] === 'rail') return seed;
  const pool = resolveStyle(styleId).seedSpace.archetypes.filter(
    (archetype) => ARCHETYPE_LANDSCAPE[archetype] === 'rail'
  );
  const archetype = pool.length > 0 ? pool[seed.archetype.charCodeAt(0) % pool.length] : 'M';
  return { ...seed, archetype };
}

/**
 * Raccourcit un texte à des phrases entières, sinon à un mot entier.
 *
 * Les champs d'une direction artistique sont écrits pour être lus seuls ; posés
 * dans une cellule de page rognée, ils doivent tenir sans être coupés en plein
 * mot.
 */
export function clip(text: string | undefined, max: number): string {
  const value = (text ?? '').replace(/\s+/g, ' ').trim();
  if (value.length <= max) return value;
  const sentences = value.match(/[^.!?]+[.!?]+(?:\s|$)/g);
  if (sentences) {
    let kept = '';
    for (const sentence of sentences) {
      if ((kept + sentence).trim().length > max) break;
      kept += sentence;
    }
    if (kept.trim()) return kept.trim();
  }
  const cut = value.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[,;:\s]+$/, '')}…`;
}

const MEDIUM_LABEL: Record<string, string> = {
  photography: 'Photographie',
  illustration: 'Illustration',
  'render-3d': 'Rendu 3D',
  collage: 'Collage',
  abstract: 'Abstrait',
  mixed: 'Mixte',
};

const DENSITY_LABEL: Record<'airy' | 'balanced' | 'dense', string> = {
  airy: "Aérée : peu d'éléments par surface, et de l'air entre chacun.",
  balanced: 'Équilibrée : le contenu et le vide se partagent la surface.',
  dense: 'Dense : la surface est occupée, la hiérarchie fait le tri.',
};

function densityOf(value: string | undefined): 'airy' | 'balanced' | 'dense' {
  const normalized = (value ?? '').toLowerCase();
  if (/airy|a[ée]r|l[ée]g/.test(normalized)) return 'airy';
  if (/dens|compact|serr/.test(normalized)) return 'dense';
  return 'balanced';
}

/** Le texte d'une densité : celui du modèle s'il en a écrit un, sinon celui du niveau. */
function densityText(value: string | undefined): string {
  const trimmed = (value ?? '').trim();
  return /^(airy|balanced|dense)$/i.test(trimmed) || trimmed.length < 12
    ? DENSITY_LABEL[densityOf(trimmed)]
    : clip(trimmed, 160);
}

const BANNERS_LEDE = "Chaque bannière garde son message hors de l'avatar et du recadrage mobile.";
const POSTS_LEDE = 'Deux publications au format natif de chaque réseau, signées par le logo.';

export function buildComposedCharterPages(ctx: ComposedPagesContext): Record<string, ComposedPage> {
  const ad = ctx.artDirection;

  const page = (
    stepName: string,
    content: { lede?: string; blocks: Block[] },
    seed: SectionSeed,
    index: number
  ): string =>
    renderSection(
      {
        title: CHARTER_PAGE_HEADINGS[stepName]?.title ?? stepName,
        lede: content.lede || undefined,
        blocks: content.blocks,
      },
      ctx.designSystem,
      seed,
      { ...ctx.render, index }
    );

  /** Une page de direction artistique n'existe que si la direction existe. */
  const artDirectionPage =
    (stepName: string, build: (direction: ArtDirectionModel) => Promise<{ lede?: string; blocks: Block[] }>): ComposedPage =>
    async (seed, index) => {
      if (!ad) {
        logger.warn(`[CHARTE] ${stepName} : pas de direction artistique — page omise`);
        return null;
      }
      return page(stepName, await build(ad), seed, index);
    };

  /** Repli d'une page sociale : la marque composée à la charte, sans interface. */
  const fallbackPromise = (): string =>
    clip(ctx.project.description || ctx.project.longDescription || ctx.project.name || '', 70);

  return {
    'Direction Artistique': artDirectionPage('Direction Artistique', async (direction) => ({
      lede: clip(direction.tagline, 160),
      blocks: [
        {
          kind: 'artDirectionStance',
          styleName: direction.styleName,
          rationale: clip(direction.rationale, 320),
          keywords: direction.keywords.slice(0, 8),
        },
      ],
    })),

    'Art Direction Grammar': artDirectionPage('Art Direction Grammar', async (direction) => ({
      lede: direction.graphicDevices.length
        ? clip(`Éléments récurrents : ${direction.graphicDevices.slice(0, 4).join(', ')}.`, 170)
        : undefined,
      blocks: [
        {
          kind: 'compositionPrinciples',
          density: densityOf(direction.layout.density),
          items: [
            { demo: 'grid', label: 'Grille', text: clip(direction.layout.grid, 160) },
            { demo: 'density', label: 'Densité', text: densityText(direction.layout.density) },
            { demo: 'whitespace', label: 'Espace négatif', text: clip(direction.layout.whitespace, 160) },
            { demo: 'signature', label: 'Geste signature', text: clip(direction.layout.signatureMove, 160) },
          ],
        },
      ],
    })),

    'Art Direction Imagery': artDirectionPage('Art Direction Imagery', async (direction) => ({
      lede: clip(direction.imagery.subjects, 160),
      blocks: [
        {
          kind: 'imageryShowcase',
          imageUrl: (await ctx.imageryUrl()) ?? undefined,
          rows: [
            { label: 'Médium', value: MEDIUM_LABEL[direction.imagery.medium] ?? clip(direction.imagery.medium, 60) },
            { label: 'Traitement', value: clip(direction.imagery.treatment, 180) },
            { label: 'Lumière', value: clip(direction.imagery.lighting, 180) },
            { label: 'Cadrage', value: clip(direction.imagery.framing, 180) },
          ].filter((row) => row.value),
        },
      ],
    })),

    'Art Direction Principles': artDirectionPage('Art Direction Principles', async (direction) => ({
      blocks: [
        {
          kind: 'artDirectionRules',
          rows: [
            { label: 'Répartition des couleurs', value: clip(direction.color.distribution, 120) },
            { label: 'Application', value: clip(direction.color.application, 150) },
            { label: 'Contraste', value: clip(direction.color.contrast, 120) },
            { label: 'Échelle typographique', value: clip(direction.typography.scaleContrast, 120) },
            { label: 'Casse et interlettrage', value: clip(direction.typography.caseAndTracking, 120) },
            { label: 'Traitement du texte', value: clip(direction.typography.treatment, 120) },
          ].filter((row) => row.value),
          dos: direction.dos.slice(0, 4).map((rule) => clip(rule, 110)),
          donts: direction.donts.slice(0, 4).map((rule) => clip(rule, 110)),
        },
      ],
    })),

    'Social Media Page Banners': async (seed, index) => {
      const stepName = 'Social Media Page Banners';
      try {
        const kit = await ctx.socialKit();
        const items = await socialMockupService.renderProfileMockups(kit, ctx.uploadMockup);
        if (items.length > 0) {
          return page(stepName, { lede: BANNERS_LEDE, blocks: [{ kind: 'mockupShowcase', items }] }, seed, index);
        }
      } catch (error: any) {
        logger.error(
          `[CHARTE] Bannières réseaux sociaux : mockups indisponibles (${error?.message}) — bannières composées à la charte`
        );
      }
      const name = ctx.project.name || 'La marque';
      return page(
        stepName,
        {
          lede: BANNERS_LEDE,
          blocks: [
            {
              kind: 'socialBanners',
              banners: [
                { platform: 'LinkedIn', ratio: '1128 × 191', headline: name, tagline: fallbackPromise(), ground: 'primary', logoUrl: ctx.logos.darkGround },
                { platform: 'Facebook', ratio: '1640 × 624', headline: name, tagline: fallbackPromise(), ground: 'light', logoUrl: ctx.logos.lightGround },
              ],
            },
          ],
        },
        seed,
        index
      );
    },

    'Social Media Creatives': async (seed, index) => {
      const stepName = 'Social Media Creatives';
      try {
        const kit = await ctx.socialKit();
        const items = await socialMockupService.renderPostMockups(kit, ctx.renderPostVisual, ctx.uploadMockup);
        if (items.length > 0) {
          // Ni chapeau ni titre au-dessus : toute la hauteur va aux publications.
          return page(
            stepName,
            { blocks: [{ kind: 'mockupShowcase', items }] },
            railSeed(seed, ad?.styleId),
            index
          );
        }
      } catch (error: any) {
        logger.error(
          `[CHARTE] Publications sociales : mockups indisponibles (${error?.message}) — publications composées à la charte`
        );
      }
      const name = ctx.project.name || 'La marque';
      return page(
        stepName,
        {
          lede: POSTS_LEDE,
          blocks: [
            {
              kind: 'socialPosts',
              posts: [
                { platform: 'Instagram — 1080 × 1350', headline: name, ground: 'primary', logoUrl: ctx.logos.darkGround },
                { platform: 'LinkedIn — 1080 × 1080', headline: fallbackPromise(), ground: 'light', logoUrl: ctx.logos.lightGround },
              ],
            },
          ],
        },
        seed,
        index
      );
    },
  };
}
