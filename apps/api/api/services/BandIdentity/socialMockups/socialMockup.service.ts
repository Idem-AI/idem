/**
 * Les mockups de réseaux sociaux de la charte : choisir, remplir, rendre.
 *
 * Deux pages en dépendent :
 *   · « Bannières réseaux sociaux » — la page ou le profil de la marque sur
 *     deux réseaux, avec une bannière composée pour elle ;
 *   · « Publications sociales » — deux publications, dont le visuel est produit
 *     par le pipeline des visuels du module communication.
 *
 * Aucun modèle d'image n'intervient dans le mockup lui-même : le gabarit HTML
 * est rempli (cf. `library.ts`), Chrome le photographie, l'image est déposée
 * dans le stockage. Seul le VISUEL d'une publication passe par l'IA, et s'il
 * manque, un visuel composé à la charte le remplace : la page n'est jamais vide.
 */

import crypto from 'crypto';
import sharp from 'sharp';
import logger from '../../../config/logger';
import { contrastRatio } from '../../design/color';
import { brandMotifs, patternCss } from '../../design/brandMotifs';
import { DocumentDesignSystem } from '../../design/documentDesignSystem';
import { buildGoogleFontLinks } from '../../../utils/google-fonts.util';
import { flyerRenderService } from '../../Communication/flyerRender.service';
import { BannerBrand, composeBannerHtml } from './bannerComposer';
import {
  fillMockupTemplate,
  loadSocialMockupLibrary,
  MockupValues,
  readMockupTemplate,
  SocialMockupNetwork,
  SocialMockupTemplate,
} from './library';

export interface SocialPostIdea {
  title: string;
  hook: string;
  description: string;
  hashtags: string[];
}

/** Tout ce qu'un mockup montre de la marque. Aucun champ n'est inventé ici. */
export interface SocialBrandKit {
  /** Graine : deux projets n'ont pas la même bannière, un projet garde la sienne. */
  projectKey: string;
  brandName: string;
  handle: string;
  category: string;
  promise: string;
  bio: string;
  posts: SocialPostIdea[];
  /** À qui la marque parle : décide des réseaux montrés. */
  audience: 'b2b' | 'b2c' | 'mixed';
  /** La vidéo porte-t-elle l'activité (formation, média, sport, tourisme) ? */
  videoLed: boolean;
  ds: DocumentDesignSystem;
  logos: BannerBrand['logos'];
}

export interface ShowcaseMockup {
  url: string;
  label: string;
  caption?: string;
  ratio: number;
}

export type PostVisualFormat = 'post' | 'square' | 'banner';

/** Produit le visuel d'une publication. `null` : le visuel de secours est composé. */
export type PostVisualRenderer = (
  idea: SocialPostIdea,
  format: PostVisualFormat,
  network: SocialMockupNetwork
) => Promise<Buffer | null>;

/** Dépose une image et rend son URL publique. */
export type MockupUploader = (image: Buffer, name: string, contentType: string) => Promise<string>;

/**
 * Les réseaux, par ordre de pertinence selon le public.
 *
 * Facebook reste haut dans toutes les listes : c'est le premier réseau des
 * marques sur les marchés d'Afrique francophone, quel que soit le public.
 */
const PROFILE_ORDER: Record<SocialBrandKit['audience'], SocialMockupNetwork[]> = {
  b2b: ['linkedin', 'facebook', 'x', 'youtube'],
  b2c: ['facebook', 'youtube', 'x', 'linkedin'],
  mixed: ['facebook', 'linkedin', 'youtube', 'x'],
};

const POST_ORDER: Record<SocialBrandKit['audience'], SocialMockupNetwork[]> = {
  b2b: ['linkedin', 'facebook', 'x', 'instagram'],
  b2c: ['instagram', 'facebook', 'x', 'linkedin'],
  mixed: ['instagram', 'linkedin', 'facebook', 'x'],
};

/** Dimensions réelles de chaque emplacement, affichées sous le mockup. */
const COVER_CAPTION: Record<string, string> = {
  'facebook-cover': 'Couverture 1640 × 624 px',
  'linkedin-cover': 'Couverture 1128 × 191 px',
  'x-header': 'En-tête 1500 × 500 px',
  'youtube-banner': 'Bannière 2560 × 1440 px, zone sûre 1546 × 423 px',
};

const MEDIA_CAPTION: Record<PostVisualFormat, string> = {
  post: 'Visuel 1080 × 1350 px',
  square: 'Visuel 1080 × 1080 px',
  banner: 'Visuel 1200 × 630 px',
};

const MEDIA_SIZE: Record<PostVisualFormat, { width: number; height: number }> = {
  post: { width: 1200, height: 1500 },
  square: { width: 1080, height: 1080 },
  banner: { width: 1200, height: 630 },
};

/** Pixel transparent : une marque sans logo n'affiche pas d'image cassée. */
const EMPTY_IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAMAASsJTYQAAAAASUVORK5CYII=';

export class SocialMockupService {
  /** Les `count` gabarits du type demandé, dans l'ordre de pertinence du public. */
  selectTemplates(kit: SocialBrandKit, kind: 'profile' | 'post', count = 2): SocialMockupTemplate[] {
    const library = loadSocialMockupLibrary().filter((template) => {
      if (template.kind !== kind) return false;
      // Une page de bannières ne montre que des profils qui en portent une.
      return kind === 'post' ? Boolean(template.media) : Boolean(template.cover);
    });
    const order = [...(kind === 'profile' ? PROFILE_ORDER : POST_ORDER)[kit.audience]];
    // Une activité portée par la vidéo montre sa chaîne en second.
    if (kind === 'profile' && kit.videoLed) {
      order.splice(order.indexOf('youtube'), 1);
      order.splice(1, 0, 'youtube');
    }
    return order
      .map((network) => library.find((template) => template.network === network))
      .filter((template): template is SocialMockupTemplate => Boolean(template))
      .slice(0, count);
  }

  /** Les deux profils de la page « Bannières réseaux sociaux ». */
  async renderProfileMockups(kit: SocialBrandKit, upload: MockupUploader): Promise<ShowcaseMockup[]> {
    const templates = this.selectTemplates(kit, 'profile');
    const brand = this.bannerBrand(kit, kit.promise);
    const lead = kit.posts[0];

    return Promise.all(
      templates.map(async (template) => {
        const values: MockupValues = {
          ...this.identity(kit),
          postText: lead?.description || kit.bio,
          title: lead?.title || kit.promise,
          coverHtml: template.cover
            ? composeBannerHtml(brand, template.cover.format, template.cover.width, template.cover.height)
            : '',
          mediaHtml:
            template.media?.format === 'thumbnail'
              ? composeBannerHtml(
                  this.bannerBrand(kit, lead?.title || kit.promise),
                  'thumbnail',
                  template.media.width,
                  template.media.height
                )
              : '',
          tiles: template.tiles ? this.tilesHtml(kit, template.tiles.count) : '',
        };
        const url = await this.renderAndUpload(template, values, upload);
        return {
          url,
          label: template.label,
          caption: template.cover ? COVER_CAPTION[template.cover.format] : undefined,
          ratio: template.width / template.height,
        };
      })
    );
  }

  /** Les deux publications de la page « Publications sociales ». */
  async renderPostMockups(
    kit: SocialBrandKit,
    renderVisual: PostVisualRenderer,
    upload: MockupUploader
  ): Promise<ShowcaseMockup[]> {
    const templates = this.selectTemplates(kit, 'post');

    return Promise.all(
      templates.map(async (template, index) => {
        const idea: SocialPostIdea = kit.posts[index % Math.max(kit.posts.length, 1)] ?? {
          title: kit.promise,
          hook: kit.promise,
          description: kit.bio,
          hashtags: [],
        };
        const format = template.media!.format as PostVisualFormat;

        let visual: Buffer | null = null;
        try {
          visual = await renderVisual(idea, format, template.network);
        } catch (error: any) {
          logger.warn(
            `[SOCIAL MOCKUPS] Visuel ${template.network} indisponible (${error?.message}) — visuel composé à la charte`
          );
        }
        if (!visual) visual = await this.fallbackVisual(kit, idea, format);

        const hashtags = idea.hashtags
          .map((tag) => tag.trim())
          .filter(Boolean)
          .slice(0, 3)
          .map((tag) => (tag.startsWith('#') ? tag : `#${tag.replace(/\s+/g, '')}`))
          .join(' ');

        const values: MockupValues = {
          ...this.identity(kit),
          postText: idea.description || idea.hook,
          caption: idea.hook || idea.title,
          hashtags,
          mediaSrc: `data:image/png;base64,${visual.toString('base64')}`,
        };
        const url = await this.renderAndUpload(template, values, upload);
        return {
          url,
          label: template.label,
          caption: MEDIA_CAPTION[format],
          ratio: template.width / template.height,
        };
      })
    );
  }

  // ───────────────────────────────────────────────────────────────────────────

  private identity(kit: SocialBrandKit): MockupValues {
    const { ds } = kit;
    // L'avatar prend la primaire quand elle porte une encre claire, le fond de
    // la charte sinon — et la déclinaison du logo qui contraste avec ce fond.
    const darkGround = contrastRatio('#ffffff', ds.colors.primary) >= 3;
    const avatarSrc = darkGround
      ? kit.logos.iconDarkGround || kit.logos.darkGround
      : kit.logos.iconLightGround || kit.logos.lightGround;
    return {
      brandName: kit.brandName,
      handle: kit.handle,
      category: kit.category,
      bio: kit.bio,
      avatarSrc: avatarSrc || EMPTY_IMAGE,
      avatarGround: darkGround ? ds.colors.primary : ds.colors.surface,
      fontLinks: buildGoogleFontLinks([ds.fonts.display, ds.fonts.body]),
    };
  }

  private bannerBrand(kit: SocialBrandKit, promise: string): BannerBrand {
    const digest = crypto.createHash('sha256').update(`banner:${kit.projectKey}`).digest();
    return {
      brandName: kit.brandName,
      promise,
      ds: kit.ds,
      logos: kit.logos,
      variant: digest.readUInt32BE(0) % 3,
    };
  }

  private tilesHtml(kit: SocialBrandKit, count: number): string {
    const { ds } = kit;
    const motifs = brandMotifs(ds);
    const grounds = [ds.colors.primary, ds.colors.surface, ds.colors.accent];
    return Array.from({ length: count }, (_, index) => {
      const ground = grounds[index % grounds.length];
      const ink = contrastRatio('#ffffff', ground) >= 3 ? '#ffffff' : ds.colors.ink;
      const css = patternCss(motifs[index % motifs.length], ink, ground, 2);
      const body = Object.entries(css)
        .map(([property, value]) => `${property}:${value}`)
        .join(';');
      return `<div style="width:100%;height:100%;${body}"></div>`;
    }).join('');
  }

  /** Visuel composé à la charte, quand le pipeline des visuels n'a rien rendu. */
  private async fallbackVisual(kit: SocialBrandKit, idea: SocialPostIdea, format: PostVisualFormat): Promise<Buffer> {
    const { width, height } = MEDIA_SIZE[format];
    // Le format paysage d'une publication X se compose comme une vignette vidéo.
    const composition = format === 'banner' ? 'thumbnail' : format;
    const inner = composeBannerHtml(this.bannerBrand(kit, idea.title || kit.promise), composition, width, height);
    const html = `<!doctype html><html><head><meta charset="utf-8">${buildGoogleFontLinks([kit.ds.fonts.display, kit.ds.fonts.body])}<style>html,body{margin:0;padding:0}</style></head><body>${inner}</body></html>`;
    return flyerRenderService.renderDocumentToPng(html, width, height, 1);
  }

  private async renderAndUpload(
    template: SocialMockupTemplate,
    values: MockupValues,
    upload: MockupUploader
  ): Promise<string> {
    const html = fillMockupTemplate(readMockupTemplate(template), values, template.id);
    const png = await flyerRenderService.renderDocumentToPng(html, template.width, template.height, 2);
    // JPEG : un mockup est plein cadre, sans transparence, et pèse quatre fois moins.
    const jpeg = await sharp(png).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
    return upload(jpeg, template.id, 'image/jpeg');
  }
}

export const socialMockupService = new SocialMockupService();
