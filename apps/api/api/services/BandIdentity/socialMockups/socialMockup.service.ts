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

import sharp from 'sharp';
import {
  BrandInput,
  buildTokens,
  contrastRatio,
  DesignTokens,
  DirectionInput,
  FormatId,
  motifCss,
  readableInk,
  renderSingle,
  screenshot,
  styleMotifs,
  visualContent,
} from '@idem/graphic-engine';
import '../../graphic/engine.host';
import logger from '../../../config/logger';
import {
  CoverFormat,
  fillMockupTemplate,
  loadSocialMockupLibrary,
  MediaFormat,
  MockupValues,
  readMockupTemplate,
  SocialMockupNetwork,
  SocialMockupTemplate,
} from './library';

/** Une bannière : une couverture de profil, une vignette vidéo, ou un visuel générique de secours. */
export type BannerFormat = CoverFormat | MediaFormat;

/**
 * Le format du moteur graphique de chaque bannière. Les couvertures ont leur zone sûre (l'avatar qui mord
 * le bas gauche, le recadrage mobile) ; elles sont rendues à leur taille canonique, et le gabarit du profil
 * les met à l'échelle.
 */
const ENGINE_FORMAT: Record<BannerFormat, { format: FormatId; canonical?: boolean }> = {
  'facebook-cover': { format: 'cover-facebook', canonical: true },
  'linkedin-cover': { format: 'cover-linkedin', canonical: true },
  'x-header': { format: 'cover-x', canonical: true },
  'youtube-banner': { format: 'cover-youtube', canonical: true },
  thumbnail: { format: 'flyer-banner' },
  banner: { format: 'flyer-banner' },
  post: { format: 'flyer-post' },
  square: { format: 'flyer-square' },
};

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
  /** La marque telle que le moteur graphique la lit (couleurs, polices, logos, motifs) et sa direction artistique. */
  brand: BrandInput;
  direction: DirectionInput;
  logos: {
    /** Logo complet à encre foncée, pour fond clair. */
    lightGround?: string;
    darkGround?: string;
    iconLightGround?: string;
    iconDarkGround?: string;
  };
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

/**
 * Les bannières livrées en FICHIERS, au format exact de chaque réseau.
 *
 * Dans la charte, une bannière n'existe que posée dans le mockup du profil ;
 * l'utilisateur, lui, doit pouvoir la téléverser telle quelle. Les mêmes
 * compositions sont donc rendues seules, pixel pour pixel.
 */
export const DOWNLOADABLE_BANNERS: readonly {
  id: string;
  label: string;
  format: BannerFormat;
  width: number;
  height: number;
}[] = [
  { id: 'facebook-cover', label: 'Couverture Facebook', format: 'facebook-cover', width: 1640, height: 624 },
  { id: 'linkedin-cover', label: 'Couverture LinkedIn', format: 'linkedin-cover', width: 1128, height: 191 },
  { id: 'x-header', label: 'En-tête X', format: 'x-header', width: 1500, height: 500 },
  { id: 'youtube-banner', label: 'Bannière YouTube', format: 'youtube-banner', width: 2560, height: 1440 },
];

/** Photo de profil : le carré que tous les réseaux recadrent en cercle. */
const PROFILE_PICTURE = { id: 'profile-picture', label: 'Photo de profil', width: 800, height: 800 } as const;

/** Un fichier de bannière rendu, prêt à être déposé ou zippé. */
export interface RenderedSocialAsset {
  id: string;
  label: string;
  width: number;
  height: number;
  png: Buffer;
}

/** Pixel transparent : une marque sans logo n'affiche pas d'image cassée. */
const EMPTY_IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAMAASsJTYQAAAAASUVORK5CYII=';

/** Une bannière composée par le moteur, prête à poser dans un gabarit : un `<img>` à sa taille exacte. */
function bannerImg(png: Buffer, width: number, height: number): string {
  return `<img src="data:image/png;base64,${png.toString('base64')}" width="${width}" height="${height}" alt="" style="display:block;width:${width}px;height:${height}px">`;
}

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
    const lead = kit.posts[0];

    return Promise.all(
      templates.map(async (template) => {
        const [coverPng, mediaPng] = await Promise.all([
          template.cover ? this.banner(kit, template.cover.format, template.cover.width, template.cover.height, kit.promise) : null,
          template.media?.format === 'thumbnail'
            ? this.banner(kit, 'thumbnail', template.media.width, template.media.height, lead?.title || kit.promise)
            : null,
        ]);
        const values: MockupValues = {
          ...this.identity(kit),
          postText: lead?.description || kit.bio,
          title: lead?.title || kit.promise,
          coverHtml: coverPng && template.cover ? bannerImg(coverPng, template.cover.width, template.cover.height) : '',
          mediaHtml: mediaPng && template.media ? bannerImg(mediaPng, template.media.width, template.media.height) : '',
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

  /**
   * Les bannières de chaque réseau et la photo de profil, en fichiers PNG aux
   * dimensions exactes. Même composition que la page « Bannières réseaux
   * sociaux » : ce que l'utilisateur télécharge est ce que la charte montre.
   */
  async renderStandaloneAssets(kit: SocialBrandKit): Promise<RenderedSocialAsset[]> {
    // En série : chaque bannière est composée, rendue et mesurée dans Chrome, et la bannière YouTube pèse
    // à elle seule 3,7 millions de pixels.
    const assets: RenderedSocialAsset[] = [];
    for (const banner of DOWNLOADABLE_BANNERS) {
      const png = await this.banner(kit, banner.format, banner.width, banner.height, kit.promise);
      assets.push({ id: banner.id, label: banner.label, width: banner.width, height: banner.height, png });
    }

    // La photo de profil : le symbole de la marque, composé par le moteur (format carré, recadré en cercle).
    const avatar = await renderSingle({
      documentType: 'brand-charter',
      format: 'avatar-square',
      brand: kit.brand,
      direction: kit.direction,
      seed: `avatar:${kit.projectKey}`,
      memoryScope: { documentType: 'brand-charter', key: kit.projectKey },
      png: true,
      content: { id: 'avatar', role: 'visual', title: kit.brandName.slice(0, 160) || 'Marque', blocks: [] },
    });
    if (avatar.png) assets.push({ ...PROFILE_PICTURE, png: avatar.png });

    return assets;
  }

  // ───────────────────────────────────────────────────────────────────────────

  /** Les jetons de la marque (couleurs garanties lisibles, polices) : ceux de toutes ses pages. */
  private tokens(kit: SocialBrandKit): DesignTokens {
    return buildTokens({ brand: kit.brand, direction: kit.direction, format: 'avatar-square' });
  }

  private identity(kit: SocialBrandKit): MockupValues {
    const tokens = this.tokens(kit);
    // L'avatar prend la primaire quand elle porte une encre claire, le fond de la charte sinon — et la
    // déclinaison du logo qui contraste avec ce fond.
    const darkGround = contrastRatio('#ffffff', tokens.color.primary) >= 3;
    const avatarSrc = darkGround
      ? kit.logos.iconDarkGround || kit.logos.darkGround
      : kit.logos.iconLightGround || kit.logos.lightGround;
    return {
      brandName: kit.brandName,
      handle: kit.handle,
      category: kit.category,
      bio: kit.bio,
      avatarSrc: avatarSrc || EMPTY_IMAGE,
      avatarGround: darkGround ? tokens.color.primary : tokens.color.ground,
      fontLinks: tokens.font.headHtml,
    };
  }

  /**
   * Une bannière composée par le moteur graphique : contenu (la promesse), charte, zone sûre du format ;
   * plusieurs compositions explorées, la page mesurée et réparée dans Chrome. Les couvertures sont rendues
   * à leur taille canonique (le gabarit les met à l'échelle), les autres à la taille demandée.
   */
  private async banner(kit: SocialBrandKit, format: BannerFormat, width: number, height: number, headline: string): Promise<Buffer> {
    const target = ENGINE_FORMAT[format];
    const content = visualContent({ id: 'banner', copy: { headline: (headline || kit.brandName).trim().slice(0, 180) || kit.brandName } });
    if (!content) throw new Error(`bannière ${format} : rien à composer`);
    const out = await renderSingle({
      documentType: 'brand-charter',
      format: target.format,
      brand: kit.brand,
      direction: kit.direction,
      seed: `banner:${kit.projectKey}:${format}`,
      memoryScope: { documentType: 'brand-charter', key: kit.projectKey },
      png: true,
      content,
      ...(target.canonical ? {} : { size: { width, height } }),
    });
    if (!out.png) throw new Error(`bannière ${format} : rendu indisponible`);
    return out.png;
  }

  private tilesHtml(kit: SocialBrandKit, count: number): string {
    const tokens = this.tokens(kit);
    const motifs = styleMotifs(kit.direction.styleId);
    const grounds = [tokens.color.primary, tokens.color.ground, tokens.color.accent];
    return Array.from({ length: count }, (_, index) => {
      const ground = grounds[index % grounds.length];
      const ink = readableInk(contrastRatio('#ffffff', ground) >= 3 ? '#ffffff' : tokens.color.ink, ground, 3);
      const body = Object.entries(motifCss(motifs[index % motifs.length], ink, ground, 2))
        .map(([property, value]) => `${property}:${value}`)
        .join(';');
      return `<div style="width:100%;height:100%;${body}"></div>`;
    }).join('');
  }

  /** Visuel composé à la charte, quand le pipeline des visuels n'a rien rendu. */
  private async fallbackVisual(kit: SocialBrandKit, idea: SocialPostIdea, format: PostVisualFormat): Promise<Buffer> {
    const { width, height } = MEDIA_SIZE[format];
    return this.banner(kit, format, width, height, idea.title || kit.promise);
  }

  private async renderAndUpload(
    template: SocialMockupTemplate,
    values: MockupValues,
    upload: MockupUploader
  ): Promise<string> {
    const html = fillMockupTemplate(readMockupTemplate(template), values, template.id);
    // Le gabarit est un document complet (ses polices, ses styles) : photographié tel quel.
    const png = await screenshot(html, { width: template.width, height: template.height, scale: 2 }, { fullPage: false });
    // JPEG : un mockup est plein cadre, sans transparence, et pèse quatre fois moins.
    const jpeg = await sharp(png).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
    return upload(jpeg, template.id, 'image/jpeg');
  }
}

export const socialMockupService = new SocialMockupService();
