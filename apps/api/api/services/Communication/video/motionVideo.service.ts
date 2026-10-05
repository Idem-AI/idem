/**
 * VIDÉOS MOTION DESIGN — l'orchestrateur.
 *
 * Une vidéo naît en quatre étapes, dont UNE seule appelle un modèle :
 *
 *   1. recette    objectif + durée + faits du brief → suite de scènes   (code)
 *   2. copie      cases numérotées remplies en une passe                (LLM, ~500 tokens)
 *   3. musique    plusieurs banques libres, tempo et extrait analysés   (code)
 *   4. storyboard minutage calé sur le temps, variantes, transitions    (code)
 *
 * L'aperçu est le même moteur que le rendu, joué en temps réel dans le
 * navigateur : retoucher un texte, changer de musique ou de style ne coûte
 * rien. Le MP4 n'est produit qu'à l'export, sur nos serveurs (Puppeteer +
 * ffmpeg), un format après l'autre.
 */
import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs';
import logger from '../../../config/logger';
import {
  MOTION_STYLES,
  MUSIC_MOODS,
  MotionStyle,
  MotionVideo,
  MusicMood,
  MusicTrack,
  VIDEO_OBJECTIVES,
  VideoBrief,
  VideoFormat,
  VideoMusic,
  VideoObjective,
  VideoRender,
  VideoScope,
  VIDEO_TYPES,
  VideoMediaAsset,
  VideoMediaKind,
  VideoSfx,
  VideoType,
  VideoKit,
  VideoStoryboard,
  SfxKind,
} from '../../../models/motionVideo.model';
import { mediaWanted, planTypeScenes, TYPE_DEFS, MediaCounts } from './video.types';
import { planCreative } from './video.storyline';
import { conceptCopyHints, ensureScenes, sceneRange } from './video.concepts';
import { applyRules } from './video.rules';
import { objectiveForContent } from './video.calendar';
import { motionFromArtDirection } from './video.artdirection';
import { enhanceRequest } from './video.enhance';
import { generateClip, generateStill, MediaStorage, Orientation, processUpload, searchPexelsPhotos, searchPexelsVideos } from './video.media';
import { ensureSfxLibrary, pickSounds, publicSoundName, SFX_DENSITY, SFX_GAIN_DB, sfxLibrary, soundFile, SfxLibrary } from './video.sfx';
import { apiBaseUrl } from '../visualUrl';
import { DirectionId, DIRECTIONS, isMotionDirection, lintMotion, pickDirection, planMotion, styleOfDirection, surfacesFor } from './video.direction';
import { applyKitOverrides, assignIcons, iconVocabulary, KitContext, KitOverrides, pickAccentEffect, pickRhythm, resolveKit, rhythmMenu, topNodes } from './video.capabilities';
import { analyzeLogo } from './video.logo';
import { CommunicationService } from '../communication.service';
import { StorageService } from '../../storage.service';
import { extractFacts, writeCopy, CopyContext, CopyWriter, fitLength, heuristicSlot } from './video.copy';
import { planScenes } from './video.recipes';
import { buildStoryboard, resolveStyle, retime } from './video.storyboard';
import { buildVideoTheme, VideoTheme } from './video.theme';
import { composeVideoHtml, inlineAssets } from './video.composer';
import { analyzeTrack, pickExcerptStart } from './video.beats';
import { fetchTrack, pickTrack, resolveMood, searchMusic, MUSIC_PROVIDERS } from './video.music';
import { cleanupRender, renderVideo } from './video.renderer';
import { exportCost, normalizeScope, videoCost } from './video.pricing';
import { SCENES } from './video.scenes';

export class VideoInputError extends Error {}

export interface CreateVideoInput {
  brief: Partial<VideoBrief>;
  scope: unknown;
  /** Type de motion : imposé (calendrier, choix explicite), ou « auto » / « mix » = choisi par le modèle. */
  type?: VideoType | 'auto';
  language?: string;
  /** Contenu du calendrier éditorial qui demande cette vidéo (rattachement). */
  contentId?: string;
}

/**
 * Progression RÉELLE d'une création, étape par étape : l'interface la montre en
 * direct (flux SSE). Les étapes médias, musique et effets tournent en parallèle.
 */
export type VideoProgressStage = 'plan' | 'copy' | 'media' | 'music' | 'sfx' | 'storyboard';

export interface VideoProgressEvent {
  stage: VideoProgressStage;
  state: 'running' | 'done';
  /** Détails affichables (scènes prévues, titre écrit, médias trouvés, piste…). */
  data?: Record<string, unknown>;
}

export type VideoProgressListener = (event: VideoProgressEvent) => void;

/** Ce que la création a fait pour trouver ses médias (journal et contrôles). */
export interface MediaReport {
  stockPhotos: number;
  stockVideos: number;
  generatedImages: number;
  generatedVideos: number;
  query?: string;
}

/** Facturation à restituer si le rendu échoue après la réponse HTTP. */
export interface RenderCharge {
  cost: number;
  action: string;
}

const MAX_IMAGES = 6;
const MEDIA_KINDS: VideoMediaKind[] = ['image', 'video', 'model3d', 'lottie', 'rive'];

/**
 * URL de média acceptée : http(s) uniquement. `VIDEO_ALLOW_FILE_URLS=1` (contrôles
 * locaux seulement, jamais en production) autorise aussi les fichiers du stockage de test.
 */
function mediaUrlAllowed(url: string): boolean {
  if (/^https?:\/\/[^\s]+$/.test(url)) return true;
  return process.env.VIDEO_ALLOW_FILE_URLS === '1' && process.env.NODE_ENV !== 'production' && /^file:\/\/\//.test(url);
}

/** Médias déclarés par le client : seuls les champs attendus, URL http(s) seulement. */
function normalizeMedia(raw: unknown): VideoMediaAsset[] {
  return (Array.isArray(raw) ? raw : [])
    .filter((m: any) => m && MEDIA_KINDS.includes(m.kind) && mediaUrlAllowed(String(m.url || '')))
    .slice(0, 16)
    .map((m: any) => ({
      id: String(m.id || crypto.randomBytes(4).toString('hex')).slice(0, 64),
      kind: m.kind,
      url: String(m.url),
      origin: 'upload' as const,
      name: m.name ? String(m.name).slice(0, 80) : undefined,
      durationSec: Number(m.durationSec) || undefined,
      posterUrl: mediaUrlAllowed(String(m.posterUrl || '')) ? String(m.posterUrl) : undefined,
    }));
}

export function normalizeBrief(raw: Partial<VideoBrief> | undefined, language?: string): VideoBrief {
  const b = raw || {};
  const message = String(b.message || '').replace(/\s+/g, ' ').trim().slice(0, 400);
  if (message.length < 3) throw new VideoInputError('message_required');
  const objective = VIDEO_OBJECTIVES.includes(b.objective as VideoObjective) ? (b.objective as VideoObjective) : 'promotion';
  const musicMood = MUSIC_MOODS.includes(b.musicMood as MusicMood) ? (b.musicMood as MusicMood) : 'auto';
  const style = b.style && (b.style === 'auto' || MOTION_STYLES.includes(b.style as MotionStyle)) ? b.style : 'auto';
  const imageUrls = (Array.isArray(b.imageUrls) ? b.imageUrls : [])
    .map((u) => String(u || '').trim())
    .filter((u) => /^https?:\/\/[^\s]+$/.test(u))
    .slice(0, MAX_IMAGES);
  return {
    objective,
    message,
    details: String(b.details || '').trim().slice(0, 800) || undefined,
    musicMood,
    style,
    direction: isMotionDirection(b.direction) ? b.direction : undefined,
    imageUrls,
    language: String(b.language || language || 'fr').slice(0, 5),
    media: [
      ...normalizeMedia(b.media),
      ...imageUrls.map((url, i) => ({ id: `legacy-${i}`, kind: 'image' as const, url, origin: 'upload' as const })),
    ],
    allowStock: b.allowStock !== false,
    allowGenerate: b.allowGenerate !== false,
    sfx: b.sfx !== false,
  };
}

/** Type par défaut (appels sans type) : déduit de l'objectif et des photos fournies. */
export function defaultType(brief: VideoBrief): VideoType {
  const hasPhotos = (brief.media || []).some((m) => m.kind === 'image');
  if (brief.objective === 'promotion') return 'promo';
  if (brief.objective === 'product' || hasPhotos) return 'product';
  return 'kinetic';
}

/**
 * Surfaces exigées par certaines mises en scène : le clip dans les lettres a besoin
 * d'un aplat très clair (ou très sombre) pour que seules les lettres laissent passer
 * l'image ; la bichromie prend la couleur de la marque.
 */
export function applyTreatmentSurfaces(storyboard: VideoStoryboard): void {
  for (const sc of storyboard.scenes) {
    const t = storyboard.kit?.treatments?.[sc.key];
    if (t === 'knockout' && !['light', 'tint', 'deep'].includes(sc.surface)) sc.surface = 'light';
    if (t === 'duotone' && ['light', 'tint'].includes(sc.surface)) sc.surface = 'primary';
  }
}

const orientationOf = (format: VideoFormat): Orientation => (format === 'landscape' ? 'landscape' : format === 'square' ? 'square' : 'portrait');

export class MotionVideoService {
  private readonly storage = new StorageService();

  constructor(
    private readonly communication: CommunicationService,
    /** Remplaçable pour les tests (réponses écrites à la main, aucun appel réseau). */
    private readonly writerFor: (userId: string) => CopyWriter | undefined = (userId) => (system, user) =>
      communication.runVideoCopyPrompt(userId, system, user)
  ) {}

  // ── Contexte de marque (sans appel de modèle) ────────────────────────────

  private async brandContext(userId: string, projectId: string) {
    const project = await this.communication.loadProjectForVideo(userId, projectId);
    if (!project) throw new VideoInputError('project_not_found');
    const analysis: any = project.analysisResultModel || {};
    const stored = analysis.communication?.context;
    const branding = analysis.branding;
    const brandName = stored?.brandName || project.name || 'Marque';
    const theme = buildVideoTheme(branding, brandName);
    // Le contexte déjà extrait par le module est réutilisé ; sinon on lit le
    // projet directement. On ne relance JAMAIS une extraction pour une vidéo.
    const ctx: CopyContext = {
      brandName,
      businessType: stored?.businessType || project.type,
      tone: stored?.tone,
      valueProposition: stored?.valueProposition || project.description || undefined,
      keywords: stored?.keywords,
      language: stored?.language || 'fr',
    };
    const visuals: any[] = analysis.communication?.visuals || [];
    const otherVideos: MotionVideo[] = analysis.communication?.videos || [];
    return { project, theme, ctx, branding, visuals, otherVideos };
  }

  // ── « Améliorer ma demande » ─────────────────────────────────────────────

  /** Réécrit la demande de l'utilisateur, dans le contexte de la marque et de sa DA (gratuit). */
  async enhanceRequest(userId: string, projectId: string, text: string, media: VideoMediaAsset[] = []): Promise<{ prompt: string; source: 'llm' | 'template' }> {
    const clean = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 1200);
    if (clean.length < 3) throw new VideoInputError('message_required');
    const { ctx, branding } = await this.brandContext(userId, projectId);
    const count = (kind: VideoMediaKind) => media.filter((m) => m?.kind === kind).length;
    const result = await enhanceRequest(
      { text: clean, ctx, media: { images: count('image'), videos: count('video'), models: count('model3d'), lotties: count('lottie') + count('rive') }, art: motionFromArtDirection(branding?.artDirection).summary },
      this.writerFor(userId)
    );
    logger.info('video.request_enhanced', { event: 'video.request_enhanced', projectId, source: result.source, tokens: result.tokens });
    return { prompt: result.prompt, source: result.source };
  }

  // ── Calendrier éditorial ─────────────────────────────────────────────────

  /** Complète la demande avec le contenu du calendrier : ce que l'utilisateur n'a pas écrit vient du post. */
  private async inputFromContent(userId: string, projectId: string, input: CreateVideoInput): Promise<CreateVideoInput> {
    const item = await this.communication.findPlanItem(userId, projectId, input.contentId!);
    if (!item) return input;
    const brief = { ...(input.brief || {}) };
    if (!brief.message || String(brief.message).trim().length < 3) brief.message = (item.hook || item.title).slice(0, 400);
    if (!brief.details) brief.details = [item.title !== brief.message ? item.title : '', item.description, item.callToAction].filter(Boolean).join('\n').slice(0, 800);
    if (!brief.objective) brief.objective = objectiveForContent(item);
    return { ...input, brief, type: input.type || item.videoType || 'auto' };
  }

  // ── Kit (graphe de capacités) ───────────────────────────────────────────

  /** Contexte du routeur de capacités pour une vidéo. */
  private kitContext(opts: {
    type: VideoType;
    brief: VideoBrief;
    scope: VideoScope;
    direction: DirectionId;
    storyboard: VideoStoryboard;
    theme: VideoTheme;
    branding: any;
    ctx: CopyContext;
    media: VideoMediaAsset[];
    otherVideos: MotionVideo[];
  }): KitContext {
    const { theme } = opts;
    const count = (kind: VideoMediaKind) => opts.media.filter((a) => a.kind === kind).length;
    return {
      type: opts.type,
      objective: opts.brief.objective,
      direction: opts.direction,
      artStyleId: opts.branding?.artDirection?.styleId,
      quality: opts.scope.quality,
      format: opts.scope.formats[0],
      durationSec: opts.scope.durationSec,
      logo: analyzeLogo(theme.logo.fullSvgMarkup, theme.logo.svgMarkup !== theme.logo.fullSvgMarkup ? theme.logo.svgMarkup : undefined),
      hasLogoIcon: !!theme.logo.icon,
      media: { images: count('image'), videos: count('video'), models: count('model3d'), lotties: count('lottie'), rive: count('rive') },
      scenes: opts.storyboard.scenes.map((sc) => ({
        key: sc.key,
        sceneId: sc.sceneId,
        hasMedia: !!(sc.image || sc.video || sc.images?.length),
        hasTitle: (sc.slots.title || '').split(/\s+/).length >= 3,
        three: sc.sceneId === 'showcase3d' || (sc.sceneId === 'logo' && sc.variant === 2),
      })),
      text: [opts.brief.message, opts.brief.details, opts.ctx.businessType, opts.ctx.valueProposition, ...(opts.ctx.keywords || [])].filter(Boolean).join(' '),
      seed: opts.storyboard.seed,
      recent: opts.otherVideos.map((v) => v.storyboard?.kit).filter(Boolean) as VideoKit[],
      boosts: motionFromArtDirection(opts.branding?.artDirection).boosts,
    };
  }

  // ── Médias ──────────────────────────────────────────────────────────────

  /** Stockage des médias trouvés ou générés (remplaçable dans les tests). */
  protected mediaStorage(): MediaStorage {
    return this.storage as unknown as MediaStorage;
  }

  /**
   * Les médias de la vidéo, dans l'ordre : importés → photos des visuels →
   * Pexels (photos, vidéos) → génération (image Gemini, clip Veo — un seul).
   */
  private async acquireMedia(opts: {
    /** Rendu imposé par la DA de la charte aux images et clips générés. */
    artModifier?: string;
    userId: string;
    projectId: string;
    videoId: string;
    brief: VideoBrief;
    visuals: any[];
    wanted: { images: number; videos: number };
    query: string;
    orientation: Orientation;
    ctx: CopyContext;
  }): Promise<{ assets: VideoMediaAsset[]; report: MediaReport }> {
    const { brief, wanted, query, orientation } = opts;
    const assets: VideoMediaAsset[] = [...(brief.media || [])];
    const report: MediaReport = { stockPhotos: 0, stockVideos: 0, generatedImages: 0, generatedVideos: 0, query };
    const count = (kind: VideoMediaKind) => assets.filter((a) => a.kind === kind).length;
    const folder = `users/${opts.userId}/projects/${opts.projectId}/videos/${opts.videoId}/media`;

    // Les photos déjà utilisées dans ses visuels : payées et à la charte.
    if (count('image') < wanted.images) {
      const fromVisuals = [...new Set(
        [...opts.visuals]
          .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
          .map((v) => v.backgroundImageUrl)
          .filter((u: unknown): u is string => typeof u === 'string' && /^https?:\/\//.test(u))
      )].slice(0, wanted.images - count('image'));
      fromVisuals.forEach((url, i) => assets.push({ id: `visual-${i}`, kind: 'image', url, origin: 'visual' }));
    }

    if (brief.allowStock && count('image') < wanted.images) {
      const photos = await searchPexelsPhotos(query, orientation, wanted.images - count('image'), opts.ctx.language?.startsWith('en') ? 'en-US' : 'fr-FR').catch((e) => {
        logger.warn('video.pexels_photos_failed', { error: e.message });
        return [];
      });
      assets.push(...photos);
      report.stockPhotos = photos.length;
    }
    if (brief.allowStock && count('video') < wanted.videos) {
      const clips = await searchPexelsVideos(query, orientation, wanted.videos - count('video'), this.mediaStorage(), folder).catch((e) => {
        logger.warn('video.pexels_videos_failed', { error: e.message });
        return [];
      });
      assets.push(...clips);
      report.stockVideos = clips.length;
    }

    // Ce qui est généré suit la DA de la charte (traitement, lumière, cadrage), comme les visuels.
    const prompt = `${query}${opts.ctx.businessType ? `, ${opts.ctx.businessType}` : ''}, for ${opts.ctx.brandName}${opts.artModifier ? `. ${opts.artModifier.slice(0, 300)}` : ''}`;
    // Aucune vidéo trouvée alors que le type en a besoin : Gemini Veo, un seul clip.
    if (brief.allowGenerate && wanted.videos > 0 && count('video') === 0) {
      try {
        assets.push(await generateClip(prompt, orientation === 'landscape' ? 'landscape' : 'portrait', this.mediaStorage(), folder));
        report.generatedVideos = 1;
      } catch (error: any) {
        logger.warn('video.veo_failed', { error: error.message });
      }
    }
    // Pas une seule photo pour une vidéo qui en a besoin : une image générée.
    if (brief.allowGenerate && wanted.images > 0 && count('image') === 0 && count('video') === 0) {
      try {
        assets.push(await generateStill(prompt, orientation, this.mediaStorage(), folder, !!opts.artModifier));
        report.generatedImages = 1;
      } catch (error: any) {
        logger.warn('video.image_generation_failed', { error: error.message });
      }
    }
    return { assets, report };
  }

  /** Fichier importé par l'utilisateur (photo, clip, modèle 3D, Lottie). */
  async uploadMedia(userId: string, projectId: string, file: { buffer: Buffer; mimetype: string; originalname: string }): Promise<VideoMediaAsset> {
    return processUpload(file, this.mediaStorage(), `users/${userId}/projects/${projectId}/videos/uploads`);
  }

  // ── Effets sonores ───────────────────────────────────────────────────────

  /** La sonothèque, sans bloquer une création plus de 30 s (repli : synthèse). */
  private async library(): Promise<SfxLibrary> {
    const timer = new Promise<null>((r) => setTimeout(() => r(null), 30000));
    const lib = await Promise.race([sfxLibrary(), timer]);
    return lib || ensureSfxLibrary({ offline: true });
  }

  private async chooseSfx(seed: number): Promise<VideoSfx> {
    const lib = await this.library();
    const picked = pickSounds(lib, seed);
    const sounds: VideoSfx['sounds'] = {};
    for (const [kind, sound] of Object.entries(picked)) {
      const { file: _file, score: _score, ...rest } = sound;
      sounds[kind as SfxKind] = rest;
    }
    return { enabled: true, sounds };
  }

  /** Fichiers des sons retenus (rendu). */
  private async sfxFiles(sfx?: VideoSfx): Promise<Partial<Record<SfxKind, string>>> {
    const out: Partial<Record<SfxKind, string>> = {};
    if (!sfx?.enabled) return out;
    for (const [kind, sound] of Object.entries(sfx.sounds)) {
      const file = sound ? await soundFile(sound) : null;
      if (file) out[kind as SfxKind] = file;
    }
    return out;
  }

  // ── Musique ──────────────────────────────────────────────────────────────

  /** Choisit, télécharge et analyse une piste. Sans musique possible : vidéo muette. */
  async chooseMusic(opts: {
    mood: MusicMood;
    style: MotionStyle;
    objective: VideoObjective;
    durationSec: number;
    seed: number;
    avoidIds?: string[];
    trackId?: string;
  }): Promise<VideoMusic | undefined> {
    const mood = resolveMood(opts.mood, opts.style, opts.objective);
    if (!mood) return undefined;
    try {
      const candidates = await searchMusic({ mood, minDuration: opts.durationSec + 3 }, MUSIC_PROVIDERS);
      const first = opts.trackId ? candidates.find((t) => t.id === opts.trackId) || null : pickTrack(candidates, opts.seed, opts.avoidIds);
      if (!first) return undefined;
      // Une piste qui ne se télécharge pas ou ne s'analyse pas laisse sa place
      // à la suivante : la vidéo garde une musique calée sur le temps.
      const queue = [first, ...candidates.filter((t) => t.id !== first.id && !(opts.avoidIds || []).includes(t.id)).slice(0, 2)];
      let fallback: VideoMusic | undefined;
      for (const track of queue) {
        const prepared = await this.prepareTrack(track, opts.durationSec);
        if (prepared.beat) return prepared;
        fallback ??= prepared;
      }
      // Aucune piste analysable (réseau) : mieux vaut une musique sans coupes
      // calées sur le temps qu'une vidéo muette ; elle sera retéléchargée à l'export.
      return fallback;
    } catch (error: any) {
      logger.warn('video.music_failed', { error: error.message });
      return undefined;
    }
  }

  private async prepareTrack(track: MusicTrack, durationSec: number): Promise<VideoMusic> {
    try {
      const file = await fetchTrack(track);
      const analysis = await analyzeTrack(file);
      const startAt = pickExcerptStart(analysis, durationSec);
      // L'extrait commence sur un temps : la grille, en temps vidéo, part de 0.
      return {
        ...track,
        durationSec: track.durationSec || analysis.durationSec,
        startAt,
        beat: { bpm: track.bpm && Math.abs(track.bpm - analysis.bpm) < 4 ? track.bpm : analysis.bpm, offset: 0, confidence: analysis.confidence },
      };
    } catch (error: any) {
      logger.warn('video.track_analysis_failed', {
        id: track.id,
        error: error?.message || String(error),
        code: error?.code,
        stack: String(error?.stack || '').split('\n').slice(0, 3).join(' | '),
      });
      return { ...track, startAt: 0 };
    }
  }

  /** Pistes proposées pour « changer de musique » (gratuit). */
  async musicOptions(mood: MusicMood, style: MotionStyle, objective: VideoObjective, durationSec: number): Promise<MusicTrack[]> {
    const resolved = resolveMood(mood, style, objective);
    if (!resolved) return [];
    return (await searchMusic({ mood: resolved, minDuration: durationSec + 3, limit: 12 })).map((t) => ({ ...t }));
  }

  // ── Création ─────────────────────────────────────────────────────────────

  async createVideo(
    userId: string,
    projectId: string,
    input: CreateVideoInput,
    paidCredits: number,
    onProgress?: VideoProgressListener
  ): Promise<MotionVideo> {
    const emit = (stage: VideoProgressStage, state: 'running' | 'done', data?: Record<string, unknown>) => {
      try {
        onProgress?.({ stage, state, data });
      } catch {
        /* un client déconnecté ne doit pas interrompre la création */
      }
    };
    // Depuis le calendrier : le brief vient du contenu (accroche, angle, appel à
    // l'action), le type est celui que le calendrier affiche.
    if (input.contentId) input = await this.inputFromContent(userId, projectId, input);
    const scope = normalizeScope(input.scope);
    const brief = normalizeBrief(input.brief, input.language);
    const objectiveGiven = VIDEO_OBJECTIVES.includes(input.brief?.objective as VideoObjective);
    const { theme, ctx, branding, visuals, otherVideos } = await this.brandContext(userId, projectId);
    ctx.language = brief.language || ctx.language;
    // La DA de la charte, traduite en paramètres de motion (directions, casse, rythme, couleur, décor).
    const art = motionFromArtDirection(branding?.artDirection);

    const videoId = `video-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
    const seed = crypto.randomInt(1, 2 ** 31 - 1);
    const orientation = orientationOf(scope.formats[0]);
    const facts = extractFacts(`${brief.message}\n${brief.details || ''}`);

    // 1. Recette, avec les médias qu'on peut raisonnablement obtenir.
    const own = (kind: VideoMediaKind) => (brief.media || []).filter((m) => m.kind === kind).length;
    const stockable = brief.allowStock && !!process.env.PEXELS_API_KEY;
    const optimistic: MediaCounts = {
      images: Math.max(own('image'), stockable ? 6 : 0, visuals.filter((v) => v.backgroundImageUrl).length),
      videos: Math.max(own('video'), stockable || brief.allowGenerate ? 4 : 0),
      models: own('model3d'),
      lotties: own('lottie') + own('rive'),
    };

    // Type demandé (calendrier, choix explicite), ou « auto » / « mix » : le modèle compose.
    const requested = VIDEO_TYPES.includes(input.type as VideoType) ? (input.type as VideoType) : null;
    emit('plan', 'running', { type: requested || 'auto' });

    // La direction de motion d'abord : celle de la DA de la charte, différente des
    // dernières vidéos du projet. Elle fixe le menu des entrées et l'effet du grand moment.
    const direction = pickDirection({
      type: requested ?? 'mix',
      artStyleId: branding?.artDirection?.styleId,
      artDirections: art.directions,
      seed,
      avoid: otherVideos.map((v) => v.storyboard?.direction).filter(Boolean) as string[],
      requested: isMotionDirection(brief.direction) ? brief.direction : undefined,
    });

    // La direction créative : le modèle CHOISIT dans des menus que le graphe a filtrés
    // (concepts, scènes, grand moment, entrées, animation du logo) ; le code valide tout.
    const prelim = this.kitContext({
      type: requested ?? 'mix',
      brief,
      scope,
      direction,
      storyboard: { version: 1, seed, style: 'premium', durationSec: scope.durationSec, scenes: [] },
      theme,
      branding,
      ctx,
      media: brief.media || [],
      otherVideos,
    });
    const plan = await planCreative(
      {
        message: brief.message,
        details: brief.details,
        durationSec: scope.durationSec,
        media: optimistic,
        facts,
        ctx,
        objective: objectiveGiven ? brief.objective : undefined,
        type: requested ?? undefined,
        direction,
        techniques: DIRECTIONS[direction].headline,
        logoMenu: topNodes('logo', prelim, 4),
        rhythmMenu: rhythmMenu(prelim, otherVideos.map((v) => v.storyboard?.rhythm).filter(Boolean) as string[]),
        graphRhythm: pickRhythm(prelim, otherVideos.map((v) => v.storyboard?.rhythm).filter(Boolean) as string[]),
        art: { medium: art.medium, summary: art.summary, styleId: branding?.artDirection?.styleId },
        recentConcepts: otherVideos.map((v) => v.storyboard?.concept).filter(Boolean) as string[],
        recentSequences: otherVideos.slice(-2).map((v) => (v.storyboard?.scenes || []).map((sc) => sc.sceneId).join('>')),
        recentLogos: otherVideos.map((v) => v.storyboard?.kit?.logo).filter(Boolean) as string[],
        // Ce que l'utilisateur a fourni (et les photos de ses visuels) : toujours montré.
        owned: { images: own('image') || visuals.filter((v) => v.backgroundImageUrl).length, videos: own('video'), models: own('model3d'), lotties: own('lottie') + own('rive') },
        seed,
      },
      this.writerFor(userId)
    );
    const type: VideoType = plan.type;
    brief.objective = plan.objective;
    // Règle « call-to-action » appliquée dès le plan : un objectif qui vend, invite ou ouvre a son appel.
    let sceneIds = plan.scenes;
    if (['promotion', 'event', 'opening', 'product', 'recruitment'].includes(plan.objective) && scope.durationSec >= 15 && !sceneIds.some((id) => id === 'cta' || id === 'offer' || id === 'event')) {
      sceneIds = ensureScenes(sceneIds, ['cta'], scope.durationSec);
    }
    const storylineTokens = plan.tokens;
    const typeDef = TYPE_DEFS[type];
    const accentEffect = pickAccentEffect(direction, seed, art.boosts);

    // Le langage de mouvement (effets sonores, ambiance musicale) suit la direction, sauf choix explicite.
    const style = brief.style && brief.style !== 'auto' ? resolveStyle(brief.style, undefined, brief.objective) : styleOfDirection(direction);
    emit('plan', 'done', { type, objective: brief.objective, concept: plan.concept, rhythm: plan.rhythm, accent: accentEffect, style, direction, scenes: sceneIds, durationSec: scope.durationSec, source: plan.source });
    const wanted = mediaWanted(sceneIds);
    const needsStock = (wanted.images > own('image') || wanted.videos > own('video')) && (brief.allowStock || brief.allowGenerate);

    // 2. Copie (un appel) : textes + mots-clés de recherche des médias.
    emit('copy', 'running');
    // Le graphe donne au modèle un vocabulaire court de concepts d'icônes (scène « avantages » seulement).
    const vocabText = [brief.message, brief.details, ctx.businessType, ...(ctx.keywords || [])].filter(Boolean).join(' ');
    const copy = await writeCopy(sceneIds, brief, ctx, this.writerFor(userId), {
      mediaQuery: needsStock,
      icons: sceneIds.includes('benefits') ? iconVocabulary(vocabText) : undefined,
      // Le concept oriente les textes (question, problème, preuve…) ; le grand moment reçoit la ligne la plus forte.
      hints: conceptCopyHints(plan.concept),
      accentIndex: plan.accent,
      durationSec: scope.durationSec,
    });
    const query = (copy.copy[0]?.visual || [ctx.businessType, ...(ctx.keywords || []).slice(0, 2)].filter(Boolean).join(' ') || brief.message).slice(0, 60);
    const firstTitle = sceneIds.map((_, i) => copy.copy[i + 1]?.title || copy.copy[i + 1]?.l1).find(Boolean);
    emit('copy', 'done', {
      title: firstTitle || brief.message,
      lines: Object.values(copy.copy).reduce((n, slots) => n + Object.keys(slots || {}).length, 0),
      source: copy.source,
    });

    // 3. Médias, musique et effets sonores, en parallèle.
    emit('media', 'running', { query, wanted });
    emit('music', 'running', { mood: brief.musicMood });
    if (brief.sfx) emit('sfx', 'running');
    const [media, music, sfx] = await Promise.all([
      this.acquireMedia({ userId, projectId, videoId, brief, visuals, wanted, query, orientation, ctx, artModifier: branding?.artDirection?.imagePromptModifier }).then((m) => {
        const preview = (a: VideoMediaAsset) => ({ kind: a.kind, origin: a.origin, url: a.kind === 'video' ? a.posterUrl : a.kind === 'image' ? a.url : undefined, credit: a.credit, name: a.name });
        emit('media', 'done', { query, ...m.report, items: m.assets.slice(0, 8).map(preview) });
        return m;
      }),
      this.chooseMusic({
        mood: brief.musicMood,
        style,
        objective: brief.objective,
        durationSec: scope.durationSec,
        seed,
        avoidIds: otherVideos.map((v) => v.music?.id).filter(Boolean) as string[],
      }).then((track) => {
        emit('music', 'done', track ? { title: track.title, artist: track.artist, provider: track.provider, bpm: track.beat?.bpm, license: track.license } : { none: true });
        return track;
      }),
      brief.sfx
        ? this.chooseSfx(seed)
            .catch(() => undefined)
            .then((fx) => {
              emit('sfx', 'done', { sounds: Object.values(fx?.sounds || {}).map((snd) => ({ kind: snd!.kind, title: snd!.title })) });
              return fx;
            })
        : Promise.resolve(undefined),
    ]);
    emit('storyboard', 'running');
    const urls = (kind: VideoMediaKind) => media.assets.filter((a) => a.kind === kind).map((a) => a.url);
    const images = urls('image');

    // 4. Une scène dont le média manque se replie sur une scène sans média.
    const slotsByIndex = sceneIds.map((_, i) => copy.copy[i + 1]);
    const kept: { id: string; slots: Record<string, string>; from: number }[] = [];
    sceneIds.forEach((id, i) => {
      if (copy.dropped.includes(i + 1) || !slotsByIndex[i]) return;
      if (id === 'gallery' && images.length < 2) return;
      kept.push({ id, slots: slotsByIndex[i], from: i });
    });
    // Trop peu de scènes pour la durée (le modèle en a laissé de côté) : des scènes de texte tirées
    // du brief les remplacent, pour que chaque scène garde un temps de lecture juste (video.rules.ts).
    {
      const [minScenes] = sceneRange(scope.durationSec);
      for (const id of ['statement', 'benefits', 'kinetic', 'wordswap']) {
        if (kept.length >= minScenes) break;
        if (kept.some((k) => k.id === id)) continue;
        const slots: Record<string, string> = {};
        for (const slot of SCENES[id].slots) {
          const value = fitLength(heuristicSlot(id, slot.key, kept.length + 1, brief, facts, ctx), slot.max);
          if (value) slots[slot.key] = value;
        }
        if (SCENES[id].slots.some((sl) => sl.required && !slots[sl.key])) continue;
        const ctaAt = kept.findIndex((k) => k.id === 'cta' || k.id === 'logo');
        kept.splice(ctaAt > 0 ? ctaAt : kept.length, 0, { id, slots, from: -1 });
      }
    }
    sceneIds = kept.map((k) => k.id);
    // Le grand moment suit sa scène ; si elle est tombée, la première scène de contenu le reprend.
    const accentAt = kept.findIndex((k) => k.from === plan.accent);
    const accentIndex = accentAt >= 0 && sceneIds[accentAt] !== 'logo' ? accentAt : Math.min(1, Math.max(0, sceneIds.length - 2));

    const storyboard = buildStoryboard({
      sceneIds,
      slots: kept.map((k) => k.slots),
      durationSec: scope.durationSec,
      style,
      seed,
      beat: music?.beat,
      images,
      videos: urls('video'),
      models: urls('model3d'),
      lotties: urls('lottie'),
      rives: urls('rive'),
      objective: brief.objective,
      logo3d: typeDef.logoVariant === 2 && !!theme.logo.svgMarkup,
      direction,
      landscape: scope.formats[0] === 'landscape',
      art: art.overrides,
      accent: sceneIds.length > 2 ? { index: accentIndex, effect: accentEffect } : undefined,
      concept: plan.concept,
      rhythm: plan.rhythm,
      // Les entrées de titre de la dernière vidéo du projet : la nouvelle en prend d'autres.
      avoidHeadlines: (otherVideos[otherVideos.length - 1]?.storyboard?.scenes || []).map((sc) => sc.motion?.headline).filter(Boolean) as string[],
    });

    // Les entrées choisies par le modèle (dans le menu de la direction), puis le contrôle
    // anti-réflexe : un choix qui créerait une répétition est réparé par le code.
    const moved = Object.entries(plan.moves).map(([i, technique]) => [kept.findIndex((k) => k.from === Number(i)), technique] as [number, string]).filter(([i]) => i >= 0);
    if (moved.length) {
      const motions = storyboard.scenes.map((sc) => ({ ...sc.motion! }));
      for (const [i, technique] of moved) if (motions[i]) motions[i].headline = technique;
      const linted = lintMotion(motions as any, sceneIds, DIRECTIONS[direction]).plan;
      storyboard.scenes.forEach((sc, i) => (sc.motion = linted[i] as any));
    }

    // 5. Le kit : le graphe de capacités choisit fond, annotation, animation du logo,
    //    icônes, effets — selon le projet, la DA, la charte et les médias.
    const kctx = this.kitContext({ type, brief, scope, direction, storyboard, theme, branding, ctx, media: media.assets, otherVideos });
    let kit = resolveKit(kctx);
    // L'animation de logo choisie par le modèle, si elle est dans le menu du graphe et possible ici.
    if (plan.logo && plan.logo !== kit.logo) kit = applyKitOverrides(kit, { logo: plan.logo }, kctx).kit;
    kit.icons = assignIcons(storyboard.scenes);
    storyboard.kit = kit;
    applyTreatmentSurfaces(storyboard);
    // Les bonnes pratiques (lecture, tenues, entrées, signature…) : vérifiées et réparées, toujours.
    const qa = applyRules(storyboard, { objective: brief.objective });
    storyboard.qa = { repaired: qa.repaired.length, issues: qa.issues, warnings: qa.warnings };

    const now = new Date().toISOString();
    const hook = storyboard.scenes.find((sc) => sc.slots.title)?.slots.title || brief.message;
    const used = new Set(storyboard.scenes.flatMap((sc) => [sc.image, sc.video, sc.model, sc.lottie, sc.rive, ...(sc.images || [])].filter(Boolean)));
    const video: MotionVideo = {
      id: videoId,
      title: fitLength(hook, 60),
      type,
      brief,
      scope,
      storyboard,
      music,
      sfx: sfx || (brief.sfx ? undefined : { enabled: false, sounds: {} }),
      media: media.assets.filter((a) => used.has(a.url) || a.origin === 'upload'),
      renders: [],
      status: 'draft',
      paidCredits,
      exportCount: 0,
      copyTokens: { input: copy.tokens.input + storylineTokens.input, output: copy.tokens.output + storylineTokens.output, source: copy.source },
      createdAt: now,
      updatedAt: now,
    };
    emit('storyboard', 'done', {
      scenes: storyboard.scenes.map((sc) => ({ sceneId: sc.sceneId, duration: sc.duration, surface: sc.surface })),
      bpm: storyboard.beat?.bpm,
      kit: { logo: kit.logo, background: kit.background, annotate: kit.annotate, iconSet: kit.iconSet, addons: kit.addons },
    });
    await this.communication.saveVideo(userId, projectId, video);
    if (input.contentId) await this.communication.linkVideoToContent(userId, projectId, input.contentId, videoId).catch(() => undefined);
    logger.info('video.created', {
      event: 'video.created',
      projectId,
      videoId,
      type,
      scenes: sceneIds.length,
      copySource: copy.source,
      tokens: copy.tokens,
      music: music?.provider,
      media: media.report,
      sfx: sfx ? Object.keys(sfx.sounds).length : 0,
      kit: { logo: kit.logo, background: kit.background, annotate: kit.annotate, iconSet: kit.iconSet, camera: kit.camera, entrance: kit.entrance, addons: kit.addons },
      creative: { concept: plan.concept, rhythm: plan.rhythm, source: plan.source },
      qa: storyboard.qa,
    });
    this.lastMediaReport = media.report;
    return video;
  }

  /** Dernier rapport de médias (contrôles). */
  lastMediaReport?: MediaReport;

  // ── Retouches (gratuites) ────────────────────────────────────────────────

  async updateVideo(
    userId: string,
    projectId: string,
    videoId: string,
    patch: {
      slots?: Record<string, Record<string, string>>;
      style?: MotionStyle;
      musicMood?: MusicMood;
      musicTrackId?: string | null;
      scope?: unknown;
      sfx?: boolean;
      direction?: string;
      /** Retouche du kit : acceptée seulement si le graphe la permet. */
      kit?: KitOverrides;
    }
  ): Promise<MotionVideo | null> {
    const current = (await this.communication.listVideos(userId, projectId)).find((v) => v.id === videoId);
    if (!current) return null;

    let storyboard = current.storyboard;
    let music = current.music;
    let brief = current.brief;
    let scope = current.scope;

    if (patch.slots) {
      storyboard = {
        ...storyboard,
        scenes: storyboard.scenes.map((scene) => {
          const edits = patch.slots?.[scene.key];
          if (!edits) return scene;
          const defs = SCENES[scene.sceneId]?.slots || [];
          const slots = { ...scene.slots };
          for (const def of defs) {
            if (!(def.key in edits)) continue;
            const value = fitLength(String(edits[def.key] ?? '').replace(/\s+/g, ' ').trim(), def.max);
            if (value) slots[def.key] = def.key === 'kicker' ? value.toUpperCase() : value;
            else if (!def.required) delete slots[def.key];
          }
          return { ...scene, slots };
        }),
      };
    }

    if (patch.scope) {
      const next = normalizeScope(patch.scope);
      // Les formats et la qualité se changent librement (payés à l'export) ;
      // la durée, elle, change le storyboard : elle n'est pas modifiable ici.
      scope = { ...next, durationSec: scope.durationSec };
    }

    if (patch.style && MOTION_STYLES.includes(patch.style)) {
      storyboard = { ...storyboard, style: patch.style };
      brief = { ...brief, style: patch.style };
    }

    // Autre direction : nouvelle composition, nouvelles techniques, nouvelle couleur.
    if (isMotionDirection(patch.direction) && patch.direction !== storyboard.direction) {
      const ids = storyboard.scenes.map((sc) => sc.sceneId);
      const plan = planMotion(ids, patch.direction, storyboard.seed, { landscape: scope.formats[0] === 'landscape' });
      const surfaces = surfacesFor(ids, storyboard.art?.color || DIRECTIONS[patch.direction].color, storyboard.seed);
      storyboard = {
        ...storyboard,
        direction: patch.direction,
        style: styleOfDirection(patch.direction),
        scenes: storyboard.scenes.map((sc, i) => ({ ...sc, motion: plan[i], surface: sc.sceneId === 'logo' && sc.variant === 2 ? 'light' : surfaces[i] })),
      };
      brief = { ...brief, direction: patch.direction };
    }

    if (patch.musicMood !== undefined || patch.musicTrackId !== undefined) {
      const mood = patch.musicMood && MUSIC_MOODS.includes(patch.musicMood) ? patch.musicMood : brief.musicMood;
      brief = { ...brief, musicMood: mood };
      music =
        mood === 'none'
          ? undefined
          : await this.chooseMusic({
              mood,
              style: storyboard.style,
              objective: brief.objective,
              durationSec: scope.durationSec,
              seed: storyboard.seed + Date.now() % 997,
              avoidIds: current.music ? [current.music.id] : [],
              trackId: patch.musicTrackId || undefined,
            });
    }

    let sfx = current.sfx;
    if (patch.sfx !== undefined) {
      sfx = patch.sfx ? (current.sfx?.sounds && Object.keys(current.sfx.sounds).length ? { ...current.sfx, enabled: true } : await this.chooseSfx(storyboard.seed)) : { enabled: false, sounds: current.sfx?.sounds || {} };
      brief = { ...brief, sfx: patch.sfx };
    }

    // Le kit suit la direction et la qualité ; les retouches explicites passent par le graphe.
    const directionChanged = storyboard.direction !== current.storyboard.direction;
    if (storyboard.kit || directionChanged || patch.kit) {
      const { theme, branding, ctx, otherVideos } = await this.brandContext(userId, projectId);
      const kctx = this.kitContext({
        type: current.type || defaultType(brief),
        brief,
        scope,
        direction: (isMotionDirection(storyboard.direction) ? storyboard.direction : 'editorial') as DirectionId,
        storyboard,
        theme,
        branding,
        ctx,
        media: current.media || [],
        otherVideos: otherVideos.filter((v) => v.id !== videoId),
      });
      let kit = storyboard.kit && !directionChanged ? storyboard.kit : resolveKit(kctx);
      kit = { ...kit, icons: storyboard.kit?.icons || assignIcons(storyboard.scenes) };
      if (patch.kit) kit = applyKitOverrides(kit, patch.kit, kctx).kit;
      storyboard = { ...storyboard, kit, scenes: storyboard.scenes.map((sc) => ({ ...sc })) };
      applyTreatmentSurfaces(storyboard);
    }

    storyboard = retime(storyboard, music?.beat);
    {
      const qa = applyRules(storyboard, { objective: brief.objective });
      storyboard = { ...storyboard, qa: { repaired: qa.repaired.length, issues: qa.issues, warnings: qa.warnings } };
    }

    return this.communication.mutateVideo(userId, projectId, videoId, (v) => ({
      ...v,
      brief,
      scope,
      storyboard,
      music,
      sfx,
      title: fitLength(storyboard.scenes.find((sc) => sc.slots.title)?.slots.title || v.title, 60),
      dirty: v.exportCount > 0 ? true : v.dirty,
      updatedAt: new Date().toISOString(),
    }));
  }

  // ── Aperçu ───────────────────────────────────────────────────────────────

  async previewHtml(userId: string, projectId: string, videoId: string, format?: VideoFormat): Promise<string | null> {
    const video = (await this.communication.listVideos(userId, projectId)).find((v) => v.id === videoId);
    if (!video) return null;
    const { theme } = await this.brandContext(userId, projectId);
    const target = format && video.scope.formats.includes(format) ? format : video.scope.formats[0];
    const assets = await inlineAssets(video.storyboard, theme, 'preview');
    const files = await this.sfxFiles(video.sfx);
    const density = SFX_DENSITY[video.storyboard.style] || {};
    const sounds: Record<string, { url: string; gain: number }> = {};
    for (const [kind, file] of Object.entries(files)) {
      const db = SFX_GAIN_DB[kind as SfxKind] + (density[kind as SfxKind] ?? 0) + 6; // l'aperçu n'a pas de normalisation finale
      if (db < -40) continue;
      sounds[kind] = { url: `${apiBaseUrl()}/project/communication/sfx/${publicSoundName(file!)}`, gain: Math.min(1, Math.pow(10, db / 20)) };
    }
    const { html } = await composeVideoHtml({
      ...assets,
      format: target,
      quality: 'standard',
      mode: 'preview',
      music: video.music ? { url: video.music.url, startAt: video.music.startAt } : undefined,
      sfx: { enabled: !!video.sfx?.enabled, sounds },
    });
    return html;
  }

  // ── Export ───────────────────────────────────────────────────────────────

  quoteExport(video: MotionVideo, scopeInput?: unknown): { cost: number; scope: VideoScope } {
    const scope = scopeInput ? { ...normalizeScope(scopeInput), durationSec: video.scope.durationSec } : video.scope;
    return { cost: exportCost({ paidCredits: video.paidCredits, exportCount: video.exportCount, scope }), scope };
  }

  async getVideo(userId: string, projectId: string, videoId: string): Promise<MotionVideo | null> {
    const video = (await this.communication.listVideos(userId, projectId)).find((v) => v.id === videoId) || null;
    return video ? withLiveProgress(video) : null;
  }

  async listVideos(userId: string, projectId: string): Promise<MotionVideo[]> {
    return (await this.communication.listVideos(userId, projectId)).map(withLiveProgress);
  }

  async deleteVideo(userId: string, projectId: string, videoId: string): Promise<boolean> {
    return this.communication.removeVideo(userId, projectId, videoId);
  }

  /**
   * Met l'export en file. Répond tout de suite : le rendu tourne en tâche de
   * fond, la progression se lit sur `GET …/videos/:id`.
   */
  async startExport(
    userId: string,
    projectId: string,
    videoId: string,
    scopeInput: unknown,
    charge?: RenderCharge
  ): Promise<MotionVideo | null> {
    const current = (await this.communication.listVideos(userId, projectId)).find((v) => v.id === videoId);
    if (!current) return null;
    if (current.status === 'rendering' && isJobActive(videoId)) throw new VideoInputError('already_rendering');
    const { scope } = this.quoteExport(current, scopeInput);
    const renders: VideoRender[] = scope.formats.map((format) => ({ format, status: 'queued', progress: 0 }));
    const updated = await this.communication.mutateVideo(userId, projectId, videoId, (v) => ({
      ...v,
      scope,
      status: 'rendering',
      renders,
      paidCredits: Math.max(v.paidCredits, videoCost(scope)),
      updatedAt: new Date().toISOString(),
    }));
    if (!updated) return null;
    renderQueue.push({ userId, projectId, videoId, charge, paidBefore: current.paidCredits, service: this });
    pumpQueue();
    return withLiveProgress(updated);
  }

  async markExportFailed(job: Pick<RenderJob, 'userId' | 'projectId' | 'videoId' | 'paidBefore'>): Promise<void> {
    await this.communication.mutateVideo(job.userId, job.projectId, job.videoId, (v) => ({
      ...v,
      status: 'failed',
      paidCredits: job.paidBefore,
      renders: v.renders.map((r) => (r.status === 'done' ? r : { ...r, status: 'failed', error: 'render_failed' })),
    }));
  }

  /** Le travail de fond : chaque format est rendu, déposé, puis inscrit. */
  async runExport(job: RenderJob): Promise<void> {
    const { userId, projectId, videoId } = job;
    const video = (await this.communication.listVideos(userId, projectId)).find((v) => v.id === videoId);
    if (!video) return;
    const { theme } = await this.brandContext(userId, projectId);
    const assets = await inlineAssets(video.storyboard, theme, 'render');
    const sfxFiles = await this.sfxFiles(video.sfx);
    let musicFile: string | undefined;
    if (video.music) {
      try {
        musicFile = await fetchTrack(video.music);
      } catch (error: any) {
        logger.warn('video.music_download_failed', { videoId, error: error.message });
      }
    }

    const results: VideoRender[] = [];
    let failed = false;
    for (const format of video.scope.formats) {
      liveProgress.set(`${videoId}:${format}`, 0);
      try {
        const { html, spec } = await composeVideoHtml({ ...assets, format, quality: video.scope.quality, mode: 'render' });
        const first = video.storyboard.scenes[0];
        const out = await renderVideo({
          html,
          width: spec.width,
          height: spec.height,
          fps: spec.fps,
          durationSec: video.storyboard.durationSec,
          quality: video.scope.quality,
          music: musicFile && video.music ? { file: musicFile, startAt: video.music.startAt } : undefined,
          sfx: Object.keys(sfxFiles).length ? { files: sfxFiles, style: video.storyboard.style } : undefined,
          posterAt: first ? first.start + Math.min(first.duration * 0.85, 2) : 1,
          onProgress: (r) => liveProgress.set(`${videoId}:${format}`, r),
        });
        const folder = `users/${userId}/projects/${projectId}/videos/${videoId}`;
        const stamp = Date.now().toString(36);
        const [mp4, poster] = await Promise.all([
          this.storage.uploadFile(fs.readFileSync(out.file), `${format}-${stamp}.mp4`, folder, 'video/mp4'),
          this.storage.uploadFile(fs.readFileSync(out.poster), `${format}-${stamp}.jpg`, folder, 'image/jpeg'),
        ]);
        cleanupRender(out);
        results.push({
          format,
          status: 'done',
          progress: 1,
          url: mp4.downloadURL,
          posterUrl: poster.downloadURL,
          sizeBytes: out.sizeBytes,
          width: out.width,
          height: out.height,
          fps: out.fps,
          renderedAt: new Date().toISOString(),
        });
      } catch (error: any) {
        failed = true;
        logger.error('video.render_failed', { event: 'video.render_failed', videoId, format, error: error.message, stack: error.stack });
        results.push({ format, status: 'failed', progress: 0, error: 'render_failed' });
      } finally {
        liveProgress.delete(`${videoId}:${format}`);
      }
      // Inscrit au fil de l'eau : le premier format est téléchargeable sans attendre les autres.
      await this.communication.mutateVideo(userId, projectId, videoId, (v) => ({
        ...v,
        renders: v.renders.map((r) => results.find((x) => x.format === r.format) || r),
      }));
    }

    const allFailed = results.every((r) => r.status === 'failed');
    await this.communication.mutateVideo(userId, projectId, videoId, (v) => ({
      ...v,
      status: allFailed ? 'failed' : 'ready',
      exportCount: allFailed ? v.exportCount : v.exportCount + 1,
      paidCredits: allFailed ? job.paidBefore : v.paidCredits,
      dirty: allFailed ? v.dirty : false,
      updatedAt: new Date().toISOString(),
    }));

    if (allFailed && job.charge && job.charge.cost > 0) {
      await refundCharge(userId, job.charge, 'Export vidéo en échec — crédits restitués');
    } else if (failed) {
      logger.warn('video.partial_render', { videoId });
    }
  }
}

// ─── Restitution des crédits d'un rendu en échec ───────────────────────────

async function refundCharge(userId: string, charge: RenderCharge, note: string): Promise<void> {
  try {
    const { creditLedgerService } = await import('../../billing/credit-ledger.service');
    const { entitlementsService } = await import('../../billing/entitlements.service');
    await creditLedgerService.refundDebit(userId, 'business', charge.cost, { action: charge.action, note });
    await entitlementsService.invalidate(userId);
  } catch (error: any) {
    logger.error(`billing.refund_failed: ${error.message}`, { event: 'billing.refund_failed', userId, ...charge });
  }
}

// ─── File de rendu ──────────────────────────────────────────────────────────
// Un rendu occupe plusieurs cœurs : on en lance un à la fois par instance
// (VIDEO_RENDER_JOBS pour en autoriser davantage sur une grosse machine).

export interface RenderJob {
  userId: string;
  projectId: string;
  videoId: string;
  charge?: RenderCharge;
  /** Montant payé avant cet export : restauré si le rendu échoue (et que les crédits sont rendus). */
  paidBefore: number;
  service: MotionVideoService;
}

const renderQueue: RenderJob[] = [];
let runningJobs = 0;
const runningVideos = new Set<string>();

/** Vrai si un rendu de cette vidéo est en file ou en cours DANS ce processus. */
function isJobActive(videoId: string): boolean {
  return runningVideos.has(videoId) || renderQueue.some((j) => j.videoId === videoId);
}
const liveProgress = new Map<string, number>();

function pumpQueue(): void {
  const max = Math.max(1, Number(process.env.VIDEO_RENDER_JOBS) || 1);
  while (runningJobs < max && renderQueue.length) {
    const job = renderQueue.shift()!;
    runningJobs++;
    runningVideos.add(job.videoId);
    job.service
      .runExport(job)
      .catch(async (error) => {
        logger.error('video.export_crashed', { videoId: job.videoId, error: error.message, stack: error.stack });
        await job.service.markExportFailed(job).catch(() => undefined);
        if (job.charge && job.charge.cost > 0) await refundCharge(job.userId, job.charge, 'Export vidéo en échec — crédits restitués');
      })
      .finally(() => {
        runningJobs--;
        runningVideos.delete(job.videoId);
        pumpQueue();
      });
  }
}

/** Attente de la file (tests et arrêt propre). */
export async function drainRenderQueue(): Promise<void> {
  while (runningJobs > 0 || renderQueue.length) await new Promise((r) => setTimeout(r, 200));
}

/** Progression en mémoire fusionnée dans la vidéo lue en base. */
function withLiveProgress(video: MotionVideo): MotionVideo {
  if (video.status !== 'rendering') return video;
  // Rendu interrompu (redémarrage du serveur) : on le montre en échec pour
  // que l'utilisateur puisse relancer, au lieu d'une barre figée.
  if (!isJobActive(video.id)) {
    return {
      ...video,
      status: video.renders.some((r) => r.status === 'done') ? 'ready' : 'failed',
      renders: video.renders.map((r) => (r.status === 'done' ? r : { ...r, status: 'failed', error: 'interrupted' })),
    };
  }
  const queuedAt = renderQueue.findIndex((j) => j.videoId === video.id);
  return {
    ...video,
    renders: video.renders.map((r) => {
      const live = liveProgress.get(`${video.id}:${r.format}`);
      if (live !== undefined) return { ...r, status: 'rendering', progress: live };
      return queuedAt >= 0 ? { ...r, status: 'queued' } : r;
    }),
  };
}

export type { VideoTheme };
