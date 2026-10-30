/**
 * Les pages de la charte COMPOSÉES par le code, sans rédaction.
 *
 * Deux familles :
 *
 *   · les quatre pages de DIRECTION ARTISTIQUE. Tout ce qu'une direction artistique contient a déjà été
 *     décidé et stocké (`ArtDirectionModel`) : son parti pris, sa grille, sa densité, son geste, son
 *     traitement d'image, ses règles. Ces pages le MONTRENT, sans le faire réécrire ;
 *
 *   · les deux pages SOCIALES, qui posent la marque dans les interfaces réelles des réseaux
 *     (cf. `socialMockups/`).
 *
 * Chaque page rend son CONTENU (des blocs du moteur graphique) ; le service le fait composer par le
 * document de la charte (@idem/graphic-engine), au même titre que les pages rédigées : même charte, même
 * plan, même mémoire de diversité.
 */

import type { BlockDraft, SectionContent, SectionRole } from '@idem/graphic-engine';
import { systemSection } from '@idem/graphic-engine';
import logger from '../../config/logger';
import { ArtDirectionModel } from '../../models/art-direction.model';
import { ProjectModel } from '../../models/project.model';
import { CHARTER_PAGE_HEADINGS } from './prompts/page-briefs.prompt';
import {
  MockupUploader,
  PostVisualRenderer,
  SocialBrandKit,
  socialMockupService,
} from './socialMockups/socialMockup.service';

/** Le contenu d'une page composée ; `null` : la page est omise (rien de vrai à y montrer). */
export type ComposedPage = () => Promise<SectionContent | null>;

export interface ComposedPagesContext {
  project: ProjectModel;
  artDirection: ArtDirectionModel | null;
  /** Logos pour les pages de repli : encre foncée (fond clair) et claire (fond sombre). */
  logos: { lightGround?: string; darkGround?: string };
  /** La photographie d'univers produite avec les mises en situation. */
  imageryUrl: () => Promise<string | null>;
  socialKit: () => Promise<SocialBrandKit>;
  renderPostVisual: PostVisualRenderer;
  uploadMockup: MockupUploader;
}

/**
 * Raccourcit un texte à des phrases entières — jamais à « … », jamais en plein sens.
 *
 * Les champs d'une direction artistique sont écrits pour être lus seuls ; une page de charte ne montre pas un texte
 * coupé. Ce qui ne tient pas en phrases entières n'est pas montré (`''`) : la page
 * présente l'élément, pas sa description.
 */
export function clip(text: string | undefined, max: number): string {
  const value = (text ?? '').replace(/\s+/g, ' ').trim();
  if (value.length <= max) return value;
  // Des phrases entières, prises DEPUIS LE DÉBUT : une fin de phrase est une ponctuation suivie d'un espace — jamais le
  // point d'un nombre (« Ratio 1.250 », « 0.05em » n'étaient plus coupés qu'en « 250 », « 05em »).
  const sentences = value.split(/(?<=[.!?])\s+/);
  let kept = '';
  for (const sentence of sentences) {
    if (`${kept} ${sentence}`.trim().length > max) break;
    kept = `${kept} ${sentence}`.trim();
  }
  if (kept && /[.!?]$/.test(kept)) return kept;
  // Une proposition coupée change le sens (« Contraste chaud et élevé entre le texte ») : rien plutôt qu'un faux.
  return '';
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
    : clip(trimmed, 90);
}

export function buildComposedCharterPages(ctx: ComposedPagesContext): Record<string, ComposedPage> {
  const ad = ctx.artDirection;

  /** Une page posée par le code : la nomenclature de la charte pour titre, ses blocs exacts. */
  const page = (stepName: string, content: { lede?: string; blocks: BlockDraft[] }, role: SectionRole): SectionContent | null =>
    systemSection({
      id: 'page',
      role,
      title: CHARTER_PAGE_HEADINGS[stepName]?.title ?? stepName,
      ...(content.lede ? { lede: content.lede } : {}),
      blocks: content.blocks,
    });

  /** Une page de direction artistique n'existe que si la direction existe. */
  const artDirectionPage =
    (stepName: string, build: (direction: ArtDirectionModel) => Promise<{ lede?: string; blocks: BlockDraft[] }>): ComposedPage =>
    async () => {
      if (!ad) {
        logger.warn(`[CHARTE] ${stepName} : pas de direction artistique — page omise`);
        return null;
      }
      return page(stepName, await build(ad), 'specimen');
    };

  /** Repli d'une page sociale : la marque composée à la charte, sans interface. */
  const fallbackPromise = (): string =>
    clip(ctx.project.description || ctx.project.longDescription || ctx.project.name || '', 70);

  return {
    'Direction Artistique': artDirectionPage('Direction Artistique', async (direction) => ({
      lede: clip(direction.tagline, 90),
      blocks: [
        {
          kind: 'artDirectionStance',
          styleName: direction.styleName,
          rationale: clip(direction.rationale, 110),
          keywords: direction.keywords.slice(0, 4),
        },
      ],
    })),

    // Les principes eux-mêmes (démonstrations dessinées par le code) : aucun chapô.
    'Art Direction Grammar': artDirectionPage('Art Direction Grammar', async (direction) => ({
      blocks: [
        {
          kind: 'compositionPrinciples',
          density: densityOf(direction.layout.density),
          items: (
            [
              { demo: 'grid', label: 'Grille', text: clip(direction.layout.grid, 90) },
              { demo: 'density', label: 'Densité', text: densityText(direction.layout.density) },
              { demo: 'whitespace', label: 'Espace négatif', text: clip(direction.layout.whitespace, 90) },
              { demo: 'signature', label: 'Geste signature', text: clip(direction.layout.signatureMove, 90) },
            ] as Array<{ demo: 'grid' | 'density' | 'whitespace' | 'signature'; label: string; text: string }>
          ).filter((item) => item.text),
        },
      ],
    })),

    'Art Direction Imagery': artDirectionPage('Art Direction Imagery', async (direction) => {
      const imageUrl = await ctx.imageryUrl();
      return {
        blocks: [
          {
            kind: 'imageryShowcase',
            ...(imageUrl ? { imageUrl } : {}),
            rows: [
              { label: 'Traitement', value: clip(direction.imagery.treatment, 90) },
              { label: 'Lumière', value: clip(direction.imagery.lighting, 90) },
              { label: 'Cadrage', value: clip(direction.imagery.framing, 90) },
            ].filter((row) => row.value),
          },
        ],
      };
    }),

    'Art Direction Principles': artDirectionPage('Art Direction Principles', async (direction) => ({
      blocks: [
        {
          kind: 'artDirectionRules',
          rows: [
            // L'essentiel seulement : une page de règles se lit d'un coup d'œil (quatre règles, trois à faire, trois à éviter).
            { label: 'Couleurs', value: clip(direction.color.distribution, 90) },
            { label: 'Contraste', value: clip(direction.color.contrast, 90) },
            { label: 'Échelle typographique', value: clip(direction.typography.scaleContrast, 90) },
            { label: 'Casse', value: clip(direction.typography.caseAndTracking, 90) },
          ].filter((row) => row.value),
          dos: direction.dos.map((rule) => clip(rule, 80)).filter(Boolean).slice(0, 3),
          donts: direction.donts.map((rule) => clip(rule, 80)).filter(Boolean).slice(0, 3),
        },
      ],
    })),

    'Social Media Page Banners': async () => {
      const stepName = 'Social Media Page Banners';
      try {
        const kit = await ctx.socialKit();
        const items = await socialMockupService.renderProfileMockups(kit, ctx.uploadMockup);
        if (items.length > 0) {
          // Les bannières seules, entières, sans texte : elles sont la démonstration.
          return page(stepName, { blocks: [{ kind: 'mockupShowcase', items }] }, 'showcase');
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
          blocks: [
            {
              kind: 'socialBanners',
              banners: [
                { platform: 'LinkedIn', ratio: '1128 × 191', headline: name, tagline: fallbackPromise() || undefined, ground: 'primary', ...(ctx.logos.darkGround ? { logoUrl: ctx.logos.darkGround } : {}) },
                { platform: 'Facebook', ratio: '1640 × 624', headline: name, tagline: fallbackPromise() || undefined, ground: 'light', ...(ctx.logos.lightGround ? { logoUrl: ctx.logos.lightGround } : {}) },
              ],
            },
          ],
        },
        'showcase'
      );
    },

    'Social Media Creatives': async () => {
      const stepName = 'Social Media Creatives';
      try {
        const kit = await ctx.socialKit();
        const items = await socialMockupService.renderPostMockups(kit, ctx.renderPostVisual, ctx.uploadMockup);
        // Ni chapeau ni texte au-dessus : toute la hauteur va aux publications.
        if (items.length > 0) return page(stepName, { blocks: [{ kind: 'mockupShowcase', items }] }, 'showcase');
      } catch (error: any) {
        logger.error(
          `[CHARTE] Publications sociales : mockups indisponibles (${error?.message}) — publications composées à la charte`
        );
      }
      const name = ctx.project.name || 'La marque';
      return page(
        stepName,
        {
          blocks: [
            {
              kind: 'socialPosts',
              posts: [
                { platform: 'Instagram — 1080 × 1350', headline: name, ground: 'primary', ...(ctx.logos.darkGround ? { logoUrl: ctx.logos.darkGround } : {}) },
                { platform: 'LinkedIn — 1080 × 1080', headline: fallbackPromise() || name, ground: 'light', ...(ctx.logos.lightGround ? { logoUrl: ctx.logos.lightGround } : {}) },
              ],
            },
          ],
        },
        'showcase'
      );
    },
  };
}
