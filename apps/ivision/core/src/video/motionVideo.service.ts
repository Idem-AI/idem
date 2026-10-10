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
import os from 'os';
import path from 'path';
import logger from '../runtime/logger';
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
  VideoSceneInstance,
  VideoVoice,
} from './video.model';
import { mediaWanted, planTypeScenes, TYPE_DEFS, MediaCounts } from './video.types';
import { planCreative } from './video.storyline';
import { conceptCopyHints, ensureScenes, sceneRange } from './video.concepts';
import { applyRules } from './video.rules';
import { motionFromArtDirection } from './video.artdirection';
import { enhanceRequest } from './video.enhance';
import { MediaStorage, Orientation, processUpload } from './video.media';
import { planMediaNeeds, runMediaDirector, SceneMedia, sceneMediaOf, sourceShots } from './video.sourcing';
import { fitScenesToVoice, personaById, personaMenu, runNarrator, sceneTexts, speakable, speechAvailable, synthesizeVoice, voiceTimeline } from './video.voice';
import { ensureSfxLibrary, pickSounds, previewGain, publicSoundName, SFX_DENSITY, SFX_GAIN_DB, sfxLibrary, soundFile, SfxLibrary } from './video.sfx';
import { coreHost, requirePort } from '../runtime/host';
import { DirectionId, DIRECTIONS, isMotionDirection, lintMotion, MotionTransition, pickDirection, planMotion, styleOfDirection, surfacesFor, transitionMenu } from './video.direction';
import { atLeast, CreativityLevel, normalizeCreativity } from '../creativity/levels';
import { assignLayouts, LAYOUT_CATALOGUE, LayoutId, layoutFits, layoutMenu, LayoutScene } from './video.layouts';
import { AgentRun, ArtDirectorChoice, brandSheet, runAnimator, runArtDirectors, runCritic, runSoundDesigner, TEMPO_PACE } from './video.agents';
import { applyKitOverrides, assignIcons, iconVocabulary, KitContext, KitOverrides, pickAccentEffect, pickRhythm, resolveKit, rhythmMenu, topNodes } from './video.capabilities';
import { analyzeLogo } from './video.logo';
import { VideoStore } from './video.store';
import { extractFacts, writeCopy, CopyContext, CopyWriter, fitLength, heuristicSlot } from './video.copy';
import { planScenes } from './video.recipes';
import { allocateDurations, buildStoryboard, resolveStyle, retime } from './video.storyboard';
import { buildVideoTheme, VideoTheme } from './video.theme';
import { composeVideoHtml, inlineAssets } from './video.composer';
import { analyzeTrack, pickExcerptStart } from './video.beats';
import { fetchTrack, pickTrack, resolveMood, searchMusic, MUSIC_PROVIDERS } from './video.music';
import { cleanupRender, renderVideo, withRenderPage } from './video.renderer';
import { codeScenes } from './video.coder';
import { AuthoredFilm, authorShots, buildDirectorPrompt, DirectorInput, parseFilm } from './video.author';
import { AgentCall, CreativeOrchestrator } from '../creativity/orchestrator';
import { exportCost, normalizeScope, videoCost } from './video.pricing';
import { SCENES } from './video.scenes';
import { applyCreativeAccent, briefCreative, CreativeBrief, creativeIntent, creativeUniverse, experimentalIn, patternTechnique, planPatterns, projectMemory, reconcilePatterns, refreshCreative, strategyMenu, withStrategy } from './video.planner';
import { PATTERN_BY_ID } from './video.patterns';
import { fingerprintOf, noveltyAgainst } from './video.fingerprint';
import { creativeLint } from './video.creativeLint';
import { ExperienceMemory, PatternOutcome, videoExperience } from './video.experience';
import type { ReferenceBlueprint } from '../reference/reference.analyzer';
import { blueprintForDirector, planFromBlueprint, ReferencePlan } from '../reference/reference.plan';

export class VideoInputError extends Error {}

/** Le nombre de plans d'un film qui reproduit un modèle : le sien, dans les bornes de lecture. */
function referenceRange(shots: number, durationSec: number): [number, number] {
  const [, max] = sceneRange(durationSec);
  const n = Math.max(2, Math.min(shots, max, Math.floor(durationSec / 1.6)));
  return [n, n];
}

export interface CreateVideoInput {
  brief: Partial<VideoBrief>;
  scope: unknown;
  /** Type de motion : imposé (calendrier, choix explicite), ou « auto » / « mix » = choisi par le modèle. */
  type?: VideoType | 'auto';
  language?: string;
  /** Contenu du calendrier éditorial qui demande cette vidéo (rattachement). */
  contentId?: string;
  /** Cran de la jauge de créativité (cf. packages/shared-models/src/creativity) ; Medium par défaut. */
  creativity?: CreativityLevel;
  /**
   * Une vidéo modèle analysée (`reference/reference.analyzer.ts`) : ses animations sont
   * reproduites (plans, durées, mises en page, entrées, transitions, caméra), avec la marque,
   * les textes et les médias de l'utilisateur.
   */
  reference?: ReferenceBlueprint & { id?: string };
}

/**
 * Progression RÉELLE d'une création, étape par étape : l'interface la montre en
 * direct (flux SSE). Les étapes médias, musique et effets tournent en parallèle.
 */
export type VideoProgressStage = 'plan' | 'copy' | 'layout' | 'media' | 'music' | 'sfx' | 'voice' | 'storyboard' | 'animation' | 'critique' | 'code' | 'direction' | 'shots';

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
  /** Essais de génération en échec (trois par média avant Pexels). */
  failedAttempts?: number;
  /** Photos reprises des visuels de la marque (dernier recours). */
  fromVisuals?: number;
  /** Plans demandés au directeur photo (médias que l'utilisateur n'a pas fournis). */
  planned?: number;
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
    // La voix off se choisit : jamais imposée.
    voice: b.voice === true,
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

/** Étage du modèle d'un appel vidéo. */
export type VideoModelTier = 'mechanical' | 'writing' | 'reasoning';

/**
 * L'étage du modèle selon le cran de créativité et le rôle de l'appel : la copie passe à
 * l'étage de rédaction dès Medium ; les agents de composition dès High ; le stratège au
 * raisonnement en Max ; le film d'auteur (Ultra) est écrit à l'étage de raisonnement.
 */
export function tierFor(level: CreativityLevel, role: 'copy' | 'strategist' | 'agents'): VideoModelTier {
  if (level === 'low') return 'mechanical';
  if (role === 'strategist') return atLeast(level, 'max') ? 'reasoning' : 'writing';
  if (role === 'agents') return atLeast(level, 'high') ? 'writing' : 'mechanical';
  return 'writing';
}

const orientationOf = (format: VideoFormat): Orientation => (format === 'landscape' ? 'landscape' : format === 'square' ? 'square' : 'portrait');

export class MotionVideoService {

  constructor(
    /** Les marques et les vidéos de l'hôte (projets IDEM, marques iVision). */
    private readonly communication: VideoStore,
    /** Remplaçable pour les tests (réponses écrites à la main, aucun appel réseau). */
    // L'étage du modèle suit la jauge de créativité (`tierFor`) : plus l'IA décide, plus le modèle est fort.
    private readonly writerFor: (userId: string, tier?: VideoModelTier) => CopyWriter | undefined = (userId, tier = 'mechanical') => (system, user) =>
      typeof communication.runVideoTieredPrompt === 'function'
        ? communication.runVideoTieredPrompt(userId, system, user, tier, 'copy')
        : typeof communication.runVideoCopyPrompt === 'function'
          ? communication.runVideoCopyPrompt(userId, system, user)
          : Promise.reject(new Error('no_copy_model')),
    /** Les agents (directeur artistique, animateur, sound designer, critique) : leur propre configuration. */
    private readonly agentWriterFor: (userId: string, tier?: VideoModelTier) => CopyWriter | undefined = (userId, tier = 'mechanical') => (system, user) =>
      typeof communication.runVideoTieredPrompt === 'function'
        ? communication.runVideoTieredPrompt(userId, system, user, tier, 'agents')
        : typeof communication.runVideoAgentPrompt === 'function'
          ? communication.runVideoAgentPrompt(userId, system, user)
          : Promise.reject(new Error('no_agent_model')),
    /** Cran Ultra : l'agent codeur (runtime d'agents, étage créatif) ; remplaçable dans les contrôles. */
    private readonly coderCallFor: (userId: string, projectId: string) => AgentCall | undefined = (userId, projectId) => coreHost().agentCall?.({ userId, projectId, element: 'motion_video' }),
    /** Cran Ultra : la critique visuelle des plans (modèle de vision) ; remplaçable dans les contrôles. */
    private readonly visionCritic: ((png: Buffer, prompt: string) => Promise<string>) | undefined = (png, prompt) =>
      requirePort('analyzeImage')(png.toString('base64'), 'image/png', prompt, { maxOutputTokens: 400, temperature: 0.2, purpose: 'shot-critic' }),
    /** La mémoire globale du moteur créatif (ce qui marche, tous projets) ; en mémoire dans les contrôles. */
    private readonly experience: ExperienceMemory = videoExperience
  ) {}

  // ── Contexte de marque (sans appel de modèle) ────────────────────────────

  private async brandContext(userId: string, projectId: string) {
    const brand = await this.communication.loadBrand(userId, projectId);
    if (!brand) throw new VideoInputError('project_not_found');
    const branding: any = brand.branding || {};
    // Une marque ANONYME (création sans charte) : pas de nom inventé, pas de signature à la fin.
    const anonymous = !!brand.anonymous;
    const brandName = brand.brandName || (anonymous ? '' : 'Marque');
    const theme = buildVideoTheme(branding, brandName);
    // Le contexte de la marque est réutilisé tel quel : on ne relance JAMAIS une extraction pour une vidéo.
    const ctx: CopyContext = {
      brandName,
      businessType: brand.voice.businessType,
      tone: brand.voice.tone,
      valueProposition: brand.voice.valueProposition,
      keywords: brand.voice.keywords,
      language: brand.voice.language || 'fr',
    };
    return { theme, ctx, branding, visuals: brand.visuals || [], otherVideos: brand.videos || [], anonymous };
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
    const content = (await this.communication.briefFromContent?.(userId, projectId, input.contentId!)) || null;
    if (!content) return input;
    const brief = { ...(input.brief || {}) };
    if (!brief.message || String(brief.message).trim().length < 3) brief.message = content.message.slice(0, 400);
    if (!brief.details && content.details) brief.details = content.details.slice(0, 800);
    if (!brief.objective && content.objective) brief.objective = content.objective;
    return { ...input, brief, type: input.type || content.type || 'auto' };
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
    /** Le moteur créatif : usage des nœuds dans le projet, exploration du cran, expérience. */
    memory?: KitContext['memory'];
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
      ...(opts.memory ? { memory: opts.memory } : {}),
    };
  }

  /** La mémoire du routeur du kit, tirée du brief créatif. */
  private kitMemory(creative: CreativeBrief): NonNullable<KitContext['memory']> {
    return { usage: creative.memory.nodeUsage, exploration: creative.budget, delta: (id: string) => this.experience.nodeDelta(id) };
  }

  // ── Médias ──────────────────────────────────────────────────────────────

  /** Stockage des médias trouvés ou générés (remplaçable dans les tests). */
  protected mediaStorage(): MediaStorage {
    return requirePort('storage') as unknown as MediaStorage;
  }

  /**
   * Les médias de la vidéo (cf. video.sourcing.ts) : les imports de l'utilisateur remplissent
   * d'abord les scènes ; pour le reste, le directeur photo écrit un plan par besoin (au texte de
   * SA scène), les modèles de l'hôte le génèrent (trois essais), Pexels ne vient qu'après trois
   * échecs, puis les photos des visuels de la marque.
   */
  private async acquireMedia(opts: {
    /** Rendu imposé par la DA de la charte aux images et clips générés. */
    artModifier?: string;
    userId: string;
    projectId: string;
    videoId: string;
    brief: VideoBrief;
    visuals: any[];
    /** Les scènes prévues (type et textes à l'écran) : chacune a ses besoins. */
    scenes: { sceneId: string; texts: string[] }[];
    query: string;
    orientation: Orientation;
    ctx: CopyContext;
    facts: ReturnType<typeof extractFacts>;
    sheet: string;
    writer?: CopyWriter;
    clipQuality: 'speed' | 'quality';
    onProgress?: (data: Record<string, unknown>) => void;
  }): Promise<{ assets: VideoMediaAsset[]; sceneMedia: Record<number, SceneMedia>; report: MediaReport; run?: AgentRun }> {
    const { brief, orientation } = opts;
    const own = brief.media || [];
    const folder = `users/${opts.userId}/projects/${opts.projectId}/videos/${opts.videoId}/media`;
    const { assigned, missing } = planMediaNeeds(opts.scenes, {
      images: own.filter((a) => a.kind === 'image').map((a) => a.url),
      videos: own.filter((a) => a.kind === 'video').map((a) => a.url),
      models: own.filter((a) => a.kind === 'model3d').length,
    });
    const report: MediaReport = { stockPhotos: 0, stockVideos: 0, generatedImages: 0, generatedVideos: 0, failedAttempts: 0, fromVisuals: 0, planned: missing.length, query: opts.query };
    if (!missing.length || (!brief.allowGenerate && !brief.allowStock)) return { assets: [...own], sceneMedia: assigned, report };

    const { direction, run } = await runMediaDirector(opts.writer, {
      sheet: opts.sheet,
      brief: `${brief.message}\n${brief.details || ''}`,
      businessType: opts.ctx.businessType,
      facts: opts.facts,
      artModifier: opts.artModifier,
      query: opts.query,
      needs: missing,
      orientation,
    });
    opts.onProgress?.({ planned: direction.shots.length, look: direction.look, source: direction.source });
    const visualPhotos = [...new Set(
      [...opts.visuals]
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
        .map((v) => v.backgroundImageUrl)
        .filter((u: unknown): u is string => typeof u === 'string' && /^https?:\/\//.test(u))
    )];
    const sourced = await sourceShots({
      direction,
      orientation,
      storage: this.mediaStorage(),
      folder,
      allowGenerate: brief.allowGenerate !== false,
      allowStock: brief.allowStock !== false,
      artModifier: opts.artModifier,
      clipQuality: opts.clipQuality,
      visualPhotos,
      onProgress: (done, total, last) => opts.onProgress?.({ done, total, ...(last ? { last } : {}) }),
    });
    Object.assign(report, sourced.report);
    return { assets: [...own, ...sourced.assets], sceneMedia: sceneMediaOf(assigned, sourced.byNeed), report, run };
  }

  // ── Voix off ────────────────────────────────────────────────────────────

  /**
   * Écrit la voix off (agent narrateur) et la fait dire (modèle de voix de l'hôte), ligne par
   * ligne, dans la langue de la vidéo. Les lignes sont rendues par index de scène : l'appelant
   * les rattache aux clés des scènes une fois le storyboard posé.
   */
  private async narrate(opts: {
    userId: string;
    projectId: string;
    videoId: string;
    language: string;
    brandName: string;
    sheet: string;
    brief: string;
    facts: ReturnType<typeof extractFacts>;
    style: MotionStyle;
    seed: number;
    scenes: { sceneId: string; duration: number; texts: string[] }[];
    writer?: CopyWriter;
    concept?: string;
  }): Promise<{ voice: Omit<VideoVoice, 'lines'>; lines: { index: number; text: string; url: string; durationSec: number }[]; run?: AgentRun }> {
    const base = { enabled: true, language: opts.language.slice(0, 5), persona: 'warm', provider: 'glm' as const, model: '', voice: '', source: 'heuristic' as const };
    if (!speechAvailable()) return { voice: { ...base, enabled: false, unavailable: 'no_speech_model' }, lines: [] };
    const personas = personaMenu(opts.style, opts.seed);
    const { narration, run } = await runNarrator(opts.writer, {
      sheet: opts.sheet,
      brandName: opts.brandName,
      language: opts.language,
      brief: opts.brief,
      facts: opts.facts,
      style: opts.style,
      scenes: opts.scenes,
      personas,
      concept: opts.concept,
    });
    const persona = personaById(narration.persona);
    try {
      const said = await synthesizeVoice({
        lines: Object.entries(narration.lines).map(([i, text]) => ({ index: Number(i), text, maxSec: speakable(opts.scenes[Number(i)].duration, Number(i) === 0) * 1.25 })),
        language: opts.language,
        persona,
        style: narration.style,
        storage: this.mediaStorage(),
        folder: `users/${opts.userId}/projects/${opts.projectId}/videos/${opts.videoId}/voice`,
      });
      return {
        voice: { ...base, persona: persona.id, provider: said.provider, model: said.model, voice: said.voice, style: narration.style, source: narration.source === 'llm' ? 'llm' : 'heuristic' },
        lines: said.lines,
        run,
      };
    } catch (error: any) {
      logger.warn('video.voice_failed', { projectId: opts.projectId, error: error?.message });
      return { voice: { ...base, persona: persona.id, enabled: false, unavailable: String(error?.message || 'voice_failed').slice(0, 60) }, lines: [], run };
    }
  }

  /**
   * Rattache les lignes dites à leurs scènes (par clé) et cale le minutage sur elles. Modifie
   * les scènes du storyboard en place ; rend la voix de la vidéo (absente si non demandée).
   */
  private attachVoice(
    storyboard: VideoStoryboard,
    narrated: Awaited<ReturnType<MotionVideoService['narrate']>> | undefined,
    keyOf: (index: number) => string | undefined
  ): VideoVoice | undefined {
    if (!narrated) return undefined;
    const lines = narrated.lines
      .map((l) => ({ sceneKey: keyOf(l.index) || '', text: l.text, url: l.url, durationSec: l.durationSec, offset: 0 }))
      .filter((l) => l.sceneKey);
    const voice: VideoVoice = { ...narrated.voice, lines };
    if (!voice.enabled) return voice;
    if (!lines.length) return { ...voice, enabled: false, unavailable: voice.unavailable || 'no_lines' };
    const fitted = fitScenesToVoice(storyboard, voice);
    storyboard.scenes = fitted.storyboard.scenes;
    if (fitted.dropped.length) logger.info('video.voice.lines_dropped', { dropped: fitted.dropped });
    return fitted.voice;
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
    /** Ton et promesse de la marque : ils orientent l'ambiance quand elle est « automatique ». */
    brandText?: string;
    /** L'agent sound designer choisit parmi les meilleures pistes (sinon : tirage par la graine). */
    pick?: (tracks: MusicTrack[], mood: string) => Promise<string | undefined>;
  }): Promise<VideoMusic | undefined> {
    const mood = resolveMood(opts.mood, opts.style, opts.objective, opts.brandText);
    if (!mood) return undefined;
    try {
      const candidates = await searchMusic({ mood, minDuration: opts.durationSec + 3 }, MUSIC_PROVIDERS);
      let first = opts.trackId ? candidates.find((t) => t.id === opts.trackId) || null : null;
      if (!first && !opts.trackId && opts.pick && candidates.length > 1) {
        const fresh = candidates.filter((t) => !(opts.avoidIds || []).includes(t.id)).slice(0, 6);
        const id = await opts.pick(fresh.length ? fresh : candidates.slice(0, 6), mood).catch(() => undefined);
        first = candidates.find((t) => t.id === id) || null;
      }
      first ??= opts.trackId ? null : pickTrack(candidates, opts.seed, opts.avoidIds);
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
    const { theme, ctx, branding, visuals, otherVideos, anonymous } = await this.brandContext(userId, projectId);
    ctx.language = brief.language || ctx.language;
    // La DA de la charte, traduite en paramètres de motion (directions, casse, rythme, couleur, décor).
    const art = motionFromArtDirection(branding?.artDirection);

    const videoId = `video-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
    const seed = crypto.randomInt(1, 2 ** 31 - 1);
    // La jauge de créativité : ce que l'IA décide à ce cran (cf. CREATIVITY.md). En dessous,
    // le graphe et les mises en page éprouvées décident — toujours à partir de la charte et de sa DA.
    const creativity: CreativityLevel = normalizeCreativity(input.creativity);
    const aiFrom = (min: CreativityLevel) => atLeast(creativity, min);
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
      artExcluded: art.excluded,
      seed,
      avoid: otherVideos.map((v) => v.storyboard?.direction).filter(Boolean) as string[],
      // Une vidéo modèle impose sa direction (si la DA de la charte ne l'exclut pas).
      requested: isMotionDirection(brief.direction)
        ? brief.direction
        : input.reference?.direction && !(art.excluded || []).includes(input.reference.direction)
          ? input.reference.direction
          : undefined,
    });

    // Le moteur créatif (video.planner.ts) : la mémoire du projet (empreintes de ses vidéos), la
    // mémoire globale (ce qui marche), la part d'exploration du cran et trois directions créatives.
    // Zéro token : tout est calculé ; les agents ne reçoivent ensuite que ses meilleures options.
    const startedAt = Date.now();
    await this.experience.refresh();
    const memory = projectMemory(otherVideos);
    const brief0 = briefCreative({
      level: creativity,
      direction,
      facts,
      photos: own('image') + visuals.filter((v) => v.backgroundImageUrl).length,
      durationSec: scope.durationSec,
      excludedLayouts: art.excludedLayouts,
      boosts: art.boosts,
      memory,
      experience: this.experience,
      seed,
    });

    // Cran Ultra : le FILM D'AUTEUR — l'IA invente et crée tout (video.author.ts). Si le directeur
    // échoue deux fois, la création continue par le pipeline des menus (repli complet, au même cran).
    if (creativity === 'ultra') {
      const authored = await this.createAuthoredVideo({ userId, projectId, input, scope, brief, theme, ctx, branding, visuals, otherVideos, art, videoId, seed, direction, orientation, facts, paidCredits, requested, emit, creative: brief0, startedAt, anonymous }).catch((error: any) => {
        logger.warn('video.authored_failed', { projectId, error: error?.message });
        return null;
      });
      if (authored) return authored;
    }

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
      memory: this.kitMemory(brief0),
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
        // Les entrées de titre et l'animation du logo reviennent à l'agent animateur.
        delegateMotion: true,
        // Ce que l'utilisateur a fourni (et les photos de ses visuels) : toujours montré.
        owned: { images: own('image') || visuals.filter((v) => v.backgroundImageUrl).length, videos: own('video'), models: own('model3d'), lotties: own('lottie') + own('rive') },
        // Les concepts sous-explorés dans le projet passent devant (moteur créatif).
        conceptBoosts: brief0.conceptBoosts,
        // Cran Max : le stratège choisit aussi la direction créative parmi les trois du planificateur.
        strategies: aiFrom('max') ? strategyMenu(brief0) : undefined,
        seed,
      },
      // Structure (concept, scènes, grand moment, rythme) : l'IA dès Medium, le graphe en dessous.
      aiFrom('medium') ? this.writerFor(userId, tierFor(creativity, 'strategist')) : undefined
    );
    const type: VideoType = plan.type;
    brief.objective = plan.objective;
    // Une vidéo modèle : ses plans deviennent les scènes (au rôle près), la structure ne vient plus du concept.
    const refPlan: ReferencePlan | null = input.reference ? planFromBlueprint(input.reference, { facts, media: optimistic, durationSec: scope.durationSec }) : null;
    if (refPlan) {
      plan.scenes = refPlan.sceneIds;
      plan.accent = refPlan.accent;
      if (refPlan.rhythm) plan.rhythm = refPlan.rhythm;
    }
    // Règle « call-to-action » appliquée dès le plan : un objectif qui vend, invite ou ouvre a son appel.
    let sceneIds = plan.scenes;
    // Sans marque, pas de scène « logo » : il n'y a ni logo ni nom à signer.
    if (anonymous && sceneIds.length > 2) sceneIds = sceneIds.filter((id) => id !== 'logo');
    if (!refPlan && ['promotion', 'event', 'opening', 'product', 'recruitment'].includes(plan.objective) && scope.durationSec >= 15 && !sceneIds.some((id) => id === 'cta' || id === 'offer' || id === 'event')) {
      sceneIds = ensureScenes(sceneIds, ['cta'], scope.durationSec);
    }
    const storylineTokens = plan.tokens;
    const typeDef = TYPE_DEFS[type];
    const creative = withStrategy(brief0, plan.strategy);
    const accentEffect = pickAccentEffect(direction, seed, art.boosts);

    // Le langage de mouvement (effets sonores, ambiance musicale) suit la direction, sauf choix explicite.
    const style = brief.style && brief.style !== 'auto' ? resolveStyle(brief.style, undefined, brief.objective) : styleOfDirection(direction);
    emit('plan', 'done', { type, objective: brief.objective, concept: plan.concept, rhythm: plan.rhythm, accent: accentEffect, style, direction, scenes: sceneIds, durationSec: scope.durationSec, source: plan.source, creative: { strategy: creative.strategy.label, exploration: creative.strategy.exploration } });
    const wanted = mediaWanted(sceneIds);
    const needsStock = (wanted.images > own('image') || wanted.videos > own('video')) && (brief.allowStock || brief.allowGenerate);

    // 2. Copie (un appel) : textes + mots-clés de recherche des médias.
    emit('copy', 'running');
    // Le graphe donne au modèle un vocabulaire court de concepts d'icônes (scène « avantages » seulement).
    const vocabText = [brief.message, brief.details, ctx.businessType, ...(ctx.keywords || [])].filter(Boolean).join(' ');
    const copy = await writeCopy(sceneIds, brief, ctx, this.writerFor(userId, tierFor(creativity, 'copy')), {
      mediaQuery: needsStock,
      icons: sceneIds.includes('benefits') ? iconVocabulary(vocabText) : undefined,
      // Le concept oriente les textes (question, problème, preuve…) ; le grand moment reçoit la ligne la plus forte.
      hints: { ...conceptCopyHints(plan.concept), ...(refPlan?.copyHints || {}) },
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

    // L'équipe d'agents : tous reçoivent la même fiche de la charte et de sa DA.
    const sheet = brandSheet({ ctx, palette: theme.palette, fonts: theme.fonts, art: branding?.artDirection });
    // Les agents de composition (mises en page, transitions, relecture) : dès High.
    const agentWriter = aiFrom('high') ? this.agentWriterFor(userId, tierFor(creativity, 'agents')) : undefined;
    // Le sound designer (piste, intensité des effets) : dès Medium.
    const soundWriter = aiFrom('medium') ? this.agentWriterFor(userId, tierFor(creativity, 'agents')) : undefined;
    const agentRuns: AgentRun[] = [
      { agent: 'strategist', source: plan.source, tokens: storylineTokens, ms: 0 },
      { agent: 'writer', source: copy.source === 'llm' ? 'llm' : 'graph', tokens: copy.tokens, ms: 0 },
    ];
    const layoutCtx = {
      direction,
      excluded: art.excludedLayouts,
      boosts: art.boosts,
      recent: otherVideos.map((v) => (v.storyboard?.scenes || []).map((sc) => sc.layout).filter(Boolean) as string[]),
    };
    const sceneOf = (id: string, i: number): LayoutScene => ({ sceneId: id, slots: copy.copy[i + 1] || {} });
    // Les motifs que le planificateur jugeait les meilleurs pour la scène i du film (repli des réconciliations).
    let preferredPatterns = (_i: number): string[] => [];
    // Les surfaces que la stratégie de couleur de la DA emploie pour ce film (+ la surface claire).
    const strategySurfaces = [...new Set([...surfacesFor(sceneIds, art.overrides.color || DIRECTIONS[direction].color, seed), 'light'])];
    const titleOf = (slots: Record<string, string> = {}) => slots.title || slots.name || slots.quote || slots.value || slots.price || slots.l1 || '';

    // Un motif par scène (intention → motif → mise en page, entrée du titre), l'accent créatif et
    // les menus des agents : 3 à 5 motifs jugés pertinents, nouveaux et fidèles à la charte.
    const patternPlan = planPatterns(creative, sceneIds.map((id, i) => ({ sceneId: id, slots: copy.copy[i + 1] || {} })), { concept: plan.concept, accentIndex: plan.accent, seed });
    if (refPlan) {
      // Reproduire, c'est garder la mise en scène du modèle : ses motifs, et pas de surprise ajoutée.
      patternPlan.accent = undefined;
      refPlan.patterns.forEach((id, i) => {
        if (!id || !patternPlan.scenes[i]) return;
        patternPlan.scenes[i] = { ...patternPlan.scenes[i], pattern: id, options: [id] };
      });
    }
    const menuOf = (i: number) =>
      patternPlan.scenes[i]?.options.length >= 2 ? { patterns: patternPlan.scenes[i].options.map((id) => ({ id, pitch: PATTERN_BY_ID.get(id)!.pitch, layout: PATTERN_BY_ID.get(id)!.tools.layout })), intent: patternPlan.scenes[i].intent } : {};

    // 3. Médias, musique (choisie par le sound designer) et effets sonores — et, en même temps,
    //    un directeur artistique par scène pour sa mise en page.
    emit('layout', 'running', { scenes: sceneIds.length });
    const artDirectors = runArtDirectors(
      agentWriter,
      sheet,
      direction,
      sceneIds.map((id, i) => ({
        index: i,
        count: sceneIds.length,
        sceneId: id,
        texts: [titleOf(copy.copy[i + 1]), ...Object.entries(copy.copy[i + 1] || {}).filter(([k]) => !['title', 'name', 'quote', 'visual'].includes(k)).map(([, v]) => v)].slice(0, 4),
        accent: i === plan.accent,
        menu: layoutMenu(sceneOf(id, i), layoutCtx),
        ...menuOf(i),
        // Cran Max : paramètres bornés ; surfaces limitées à celles que la stratégie de couleur de la DA emploie.
        ...(aiFrom('max') && id !== 'logo' ? { tune: { surfaces: strategySurfaces } } : {}),
      })),
      4,
      // Cran Max : accroche et grand moment tirés trois fois, départagés par le code (poids du catalogue
      // pour la direction, mises en page des dernières vidéos évitées, composition classique en dernier).
      aiFrom('max')
        ? {
            samples: (sc) => (sc.index === 0 || sc.accent ? 3 : 1),
            // Un motif se départage par le score créatif du planificateur ; une mise en page seule,
            // par son poids pour la direction (dernières vidéos évitées, composition classique en dernier).
            score: (choice, sc) =>
              choice.pattern
                ? -10 * (patternPlan.scenes[sc.index]?.scored.find((x) => x.id === choice.pattern)?.score ?? 0) + (choice.layout && layoutCtx.recent.flat().includes(choice.layout) ? 2 : 0)
                : !choice.layout
                  ? 9
                  : -((choice.layout === 'classic' ? 0 : LAYOUT_CATALOGUE[choice.layout as Exclude<LayoutId, 'classic'>]?.directions[direction]) || 0) +
                    (layoutCtx.recent.flat().includes(choice.layout) ? 2 : 0) +
                    (choice.layout === 'classic' ? 1.5 : 0),
          }
        : undefined
    ).then((res) => {
      agentRuns.push(res.run);
      return res;
    });
    let soundIntensity: 'subtle' | 'normal' | 'punchy' | undefined;
    // Le rédacteur (étage de la copie) écrit aussi les plans des médias et la voix off : du contenu.
    const contentWriter = this.writerFor(userId, tierFor(creativity, 'copy'));
    emit('media', 'running', { query, wanted });
    emit('music', 'running', { mood: brief.musicMood });
    if (brief.sfx) emit('sfx', 'running');
    if (brief.voice) emit('voice', 'running', { language: brief.language });
    const planned = sceneIds.map((id, i) => ({ sceneId: id, texts: sceneTexts(copy.copy[i + 1]) }));
    // La voix off s'écrit sur les durées prévues (même calcul que le storyboard) ; le calage final suit.
    const plannedDurations = allocateDurations(sceneIds, sceneIds.map((_, i) => copy.copy[i + 1] || {}), scope.durationSec);
    const [media, music, sfx, narrated] = await Promise.all([
      this.acquireMedia({
        userId,
        projectId,
        videoId,
        brief,
        visuals,
        scenes: planned,
        query,
        orientation,
        ctx,
        facts,
        sheet,
        writer: contentWriter,
        clipQuality: aiFrom('high') ? 'quality' : 'speed',
        artModifier: branding?.artDirection?.imagePromptModifier,
        onProgress: (data) => emit('media', 'running', { query, wanted, ...data }),
      }).then((m) => {
        if (m.run) agentRuns.push(m.run);
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
        brandText: [ctx.tone, ctx.valueProposition, ctx.businessType, ...(ctx.keywords || []), brief.message].filter(Boolean).join(' '),
        pick: async (tracks, mood) => {
          const res = await runSoundDesigner(soundWriter, { sheet, request: `${brief.message} ${brief.details || ''}`, rhythm: plan.rhythm, mood, durationSec: scope.durationSec, tracks });
          agentRuns.push(res.run);
          soundIntensity = res.choice.intensity;
          return res.choice.trackId;
        },
      }).then((track) => {
        emit('music', 'done', track ? { title: track.title, artist: track.artist, provider: track.provider, bpm: track.beat?.bpm, license: track.license, pickedBy: agentRuns.some((r) => r.agent === 'soundDesigner' && r.source === 'llm') ? 'agent' : 'graph' } : { none: true });
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
      brief.voice
        ? this.narrate({
            userId,
            projectId,
            videoId,
            language: brief.language || ctx.language,
            brandName: theme.brandName,
            sheet,
            brief: `${brief.message}\n${brief.details || ''}`,
            facts,
            style,
            seed,
            scenes: planned.map((p, i) => ({ ...p, duration: plannedDurations[i] })),
            writer: contentWriter,
          }).then((res) => {
            if (res.run) agentRuns.push(res.run);
            emit('voice', 'done', res.voice.enabled ? { lines: res.lines.length, language: res.voice.language, provider: res.voice.provider, persona: res.voice.persona } : { unavailable: res.voice.unavailable });
            return res;
          })
        : Promise.resolve(undefined),
    ]);
    const designed = await artDirectors;
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
    // (Une vidéo modèle garde ses plans : on ne lui ajoute pas de scène.)
    if (!refPlan) {
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
    preferredPatterns = (i) => (kept[i]?.from >= 0 ? patternPlan.scenes[kept[i].from]?.scored.map((x) => x.id) || [] : []);
    // Le grand moment suit sa scène ; si elle est tombée, la première scène de contenu le reprend.
    const accentAt = kept.findIndex((k) => k.from === plan.accent);
    const accentIndex = accentAt >= 0 && sceneIds[accentAt] !== 'logo' ? accentAt : Math.min(1, Math.max(0, sceneIds.length - 2));
    // Le menu des transitions : tout le catalogue, filtré par la direction et la DA de la charte,
    // moins celles des dernières vidéos du projet.
    const transitions = transitionMenu(direction, {
      excluded: art.excludedTransitions,
      boosts: art.boosts,
      recent: otherVideos.map((v) => (v.storyboard?.scenes || []).map((sc) => sc.motion?.transition).filter(Boolean) as string[]),
    });

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
      transitions: transitions,
      // Chaque scène reçoit le média produit pour SON texte (imports, génération, Pexels).
      sceneMedia: kept.reduce<Record<number, SceneMedia>>((acc, k, i) => (k.from >= 0 && media.sceneMedia[k.from] ? { ...acc, [i]: media.sceneMedia[k.from] } : acc), {}),
    });
    // La voix off a été écrite par index de scène prévue : elle suit sa scène par sa clé (les
    // règles peuvent ensuite retirer une scène, sa ligne part avec elle).
    const sceneKeyOf = new Map<number, string>();
    kept.forEach((k, i) => k.from >= 0 && storyboard.scenes[i] && sceneKeyOf.set(k.from, storyboard.scenes[i].key));
    // Une vidéo modèle : chaque scène prend la durée de SON plan (à l'échelle) ; les règles de
    // lecture passent après et rallongent un plan trop court pour être lu.
    if (refPlan) {
      const wanted = kept.map((k) => (k.from >= 0 ? refPlan.durations[k.from] : undefined));
      const known = wanted.reduce((n: number, d) => n + (d || 0), 0);
      const missing = wanted.filter((d) => !d).length;
      const rest = Math.max(0, scope.durationSec - known);
      let start = 0;
      storyboard.scenes.forEach((sc, i) => {
        const d = wanted[i] || (missing ? rest / missing : sc.duration);
        sc.start = Math.round(start * 1000) / 1000;
        sc.duration = Math.round(d * 1000) / 1000;
        start += d;
      });
      const lastScene = storyboard.scenes[storyboard.scenes.length - 1];
      if (lastScene) lastScene.duration = Math.round((scope.durationSec - lastScene.start) * 1000) / 1000;
    }

    const decorWanted = new Map<string, boolean>();
    // Les mises en page : celles des directeurs artistiques, validées pour tout le film
    // (menu de la scène, médias réellement obtenus, jamais deux fois de suite).
    {
      const chosen: Record<number, string> = {};
      const emphasis: Record<number, number> = {};
      // Mémoire de session : un motif déjà servi dans le film (autre que la composition de la
      // direction) n'est pas repris, même si l'agent le choisit ; le planificateur reprend la main.
      const servedPatterns: string[] = [];
      kept.forEach((k, i) => {
        const choice: ArtDirectorChoice | undefined = k.from >= 0 ? designed.choices[k.from] : undefined;
        const planned = k.from >= 0 ? patternPlan.scenes[k.from] : undefined;
        const free = (id?: string) => !!id && (PATTERN_BY_ID.get(id)?.generic || !servedPatterns.includes(id));
        // Le motif de l'agent, sinon celui du planificateur (à tous les crans : Low = créativité du moteur).
        // Le motif d'un plan de la vidéo modèle passe avant tout : on reproduit sa mise en scène.
        const reference = k.from >= 0 ? refPlan?.patterns[k.from] : undefined;
        const agentPattern = !reference && free(choice?.pattern) ? choice!.pattern : undefined;
        const pattern = reference || agentPattern || (free(planned?.pattern) ? planned!.pattern : planned?.options.find(free));
        if (pattern) {
          storyboard.scenes[i].pattern = pattern;
          servedPatterns.push(pattern);
        }
        const layout = pattern ? PATTERN_BY_ID.get(pattern)?.tools.layout : undefined;
        if (!reference && choice?.layout && (agentPattern || !choice.pattern)) chosen[i] = choice.layout;
        else if (layout) chosen[i] = layout;
        if (choice?.emphasis != null) emphasis[i] = choice.emphasis;
      });
      const layouts = assignLayouts(
        storyboard.scenes.map((sc) => ({ sceneId: sc.sceneId, slots: sc.slots, image: sc.image, video: sc.video })),
        { ...layoutCtx, seed, chosen }
      );
      storyboard.scenes.forEach((sc, i) => {
        if (layouts[i]) sc.layout = layouts[i];
        if (emphasis[i] != null) sc.emphasis = emphasis[i];
        // Cran Max : les réglages bornés du directeur artistique (revalidés ici, puis par les règles).
        const tuning = kept[i]?.from >= 0 ? designed.choices[kept[i].from]?.tuning : undefined;
        if (!tuning || sc.sceneId === 'logo') return;
        if (tuning.scale) sc.scale = tuning.scale;
        if (tuning.surface && strategySurfaces.includes(tuning.surface)) sc.surface = tuning.surface as VideoSceneInstance['surface'];
        if (tuning.tempo) sc.pace = Math.min(1.3, Math.max(0.8, (sc.pace || 1) * TEMPO_PACE[tuning.tempo]));
        if (tuning.align && sc.motion) {
          const centered = ['center', 'bottom-center', 'top-center'].includes(sc.motion.anchor);
          if (tuning.align === 'center' && !centered) sc.motion = { ...sc.motion, anchor: 'center', align: 'center' };
          if (tuning.align === 'left' && centered) sc.motion = { ...sc.motion, anchor: 'center-left', align: 'left' };
        }
        if (tuning.decor !== undefined) decorWanted.set(sc.key, tuning.decor);
      });
      // Une mise en page remplacée par la validation (répétition, médias) emporte son motif.
      reconcilePatterns(storyboard, preferredPatterns);
      emit('layout', 'done', { layouts: storyboard.scenes.map((sc) => sc.layout).filter((l) => l && l !== 'classic'), source: designed.run.source });
    }

    // 5. Le kit : le graphe de capacités choisit fond, annotation, animation du logo,
    //    icônes, effets — selon le projet, la DA, la charte et les médias.
    const kctx = this.kitContext({ type, brief, scope, direction, storyboard, theme, branding, ctx, media: media.assets, otherVideos, memory: this.kitMemory(creative) });
    let kit = resolveKit(kctx);

    // 6. L'agent animateur : la transition de chaque coupe (catalogue filtré), quelques entrées
    //    de titre, la caméra, la famille d'entrée et l'animation du logo — dans les menus du graphe.
    emit('animation', 'running');
    const freshLogos = topNodes('logo', kctx, 4).filter((l) => !otherVideos.slice(-2).some((v) => v.storyboard?.kit?.logo === l));
    const animator = await runAnimator(agentWriter, {
      sheet,
      direction,
      rhythm: plan.rhythm,
      scenes: storyboard.scenes.map((sc) => ({ sceneId: sc.sceneId, layout: sc.layout, duration: sc.duration, title: titleOf(sc.slots) })),
      transitions,
      techniques: DIRECTIONS[direction].headline,
      cameras: topNodes('camera', kctx, 3),
      entrances: topNodes('entrance', kctx, 3),
      logos: freshLogos.length >= 2 ? freshLogos : topNodes('logo', kctx, 4),
    });
    agentRuns.push(animator.run);
    {
      // Les entrées des motifs (dans le vocabulaire de la direction), puis celles du stratège (si un
      // ancien modèle en propose encore), puis celles de l'animateur.
      const motions = storyboard.scenes.map((sc) => ({ ...sc.motion! }));
      const lastHeadlines = (otherVideos[otherVideos.length - 1]?.storyboard?.scenes || []).map((sc) => sc.motion?.headline).filter(Boolean) as string[];
      const usedTitles: string[] = [];
      storyboard.scenes.forEach((sc, i) => {
        const t = motions[i] ? patternTechnique(sc.pattern, direction, motions[i - 1]?.headline, usedTitles, lastHeadlines) : undefined;
        if (t) motions[i].headline = t as any;
        if (motions[i]?.headline) usedTitles.push(motions[i].headline);
      });
      for (const [i, technique] of Object.entries(plan.moves)) {
        const at = kept.findIndex((k) => k.from === Number(i));
        if (at >= 0 && motions[at]) motions[at].headline = technique as any;
      }
      for (const [i, technique] of Object.entries(animator.choice.titles)) if (motions[Number(i)]) motions[Number(i)].headline = technique as any;
      for (const [i, cut] of Object.entries(animator.choice.cuts)) if (motions[Number(i)] && Number(i) > 0) motions[Number(i)].transition = cut;
      // Le contrôle anti-réflexe : un choix qui créerait une répétition est réparé par le code.
      const linted = lintMotion(motions as any, sceneIds, DIRECTIONS[direction], transitions.map((t) => t.id)).plan;
      storyboard.scenes.forEach((sc, i) => (sc.motion = linted[i] as any));
      // La vidéo modèle : son entrée de titre et sa coupe, plan par plan (sauf ce que la DA exclut).
      if (refPlan) {
        storyboard.scenes.forEach((sc, i) => {
          const from = kept[i]?.from;
          if (from == null || from < 0 || !sc.motion) return;
          const technique = refPlan.techniques[from];
          const cut = refPlan.transitions[from];
          sc.motion = {
            ...sc.motion,
            ...(technique && sc.sceneId !== 'logo' ? { headline: technique } : {}),
            ...(cut && i > 0 && !(art.excludedTransitions || []).includes(cut) ? { transition: cut } : {}),
          };
        });
      }
    }
    const logoChoice = animator.choice.logo || plan.logo;
    const camera = refPlan?.camera || animator.choice.camera;
    const overrides = { ...(logoChoice && logoChoice !== kit.logo ? { logo: logoChoice } : {}), ...(camera ? { camera } : {}), ...(animator.choice.entrance ? { entrance: animator.choice.entrance } : {}) };
    if (Object.keys(overrides).length) kit = applyKitOverrides(kit, overrides, kctx).kit;
    kit.icons = assignIcons(storyboard.scenes);
    // Cran Max : le fond du kit posé (ou retiré) là où le directeur artistique l'a voulu.
    if (kit.background !== 'none' && decorWanted.size) {
      const backdrops = new Set(kit.backdropScenes);
      for (const [key, on] of decorWanted) (on ? backdrops.add(key) : backdrops.delete(key));
      kit = { ...kit, backdropScenes: [...backdrops].slice(0, 3) };
    }
    // L'accent créatif : la touche inattendue d'une autre famille, sur UNE scène (fond, annotation
    // ou traversée) — l'ADN de la vidéo reste celui de sa direction partout ailleurs.
    const accent = applyCreativeAccent(storyboard, kit, patternPlan.accent ? { ...patternPlan.accent, index: kept.findIndex((k) => k.from === patternPlan.accent!.index) } : undefined, kctx, art.excludedTransitions);
    kit = accent.kit;
    storyboard.kit = kit;
    reconcilePatterns(storyboard, preferredPatterns);
    applyTreatmentSurfaces(storyboard);
    emit('animation', 'done', {
      transitions: storyboard.scenes.map((sc) => sc.motion?.transition).filter(Boolean),
      camera: kit.camera,
      logo: kit.logo,
      source: animator.run.source,
    });

    // Les bonnes pratiques (lecture, tenues, entrées, signature…) : vérifiées et réparées, toujours.
    let qa = applyRules(storyboard, { objective: brief.objective });

    // 7. L'agent critique relit le film résumé : au plus cinq corrections, dans une grammaire
    //    fermée (mise en page, coupe, entrée de titre), chacune validée par le code.
    emit('critique', 'running');
    const critic = await runCritic(agentWriter, {
      sheet,
      direction,
      rhythm: plan.rhythm,
      scenes: storyboard.scenes.map((sc) => ({
        sceneId: sc.sceneId,
        duration: sc.duration,
        layout: sc.layout,
        transition: sc.motion?.transition,
        technique: sc.motion?.headline,
        title: titleOf(sc.slots),
        layouts: layoutMenu({ sceneId: sc.sceneId, slots: sc.slots, image: sc.image, video: sc.video }, layoutCtx, 5),
        scale: sc.scale,
        tempo: sc.pace && sc.pace > 1.05 ? 'calm' : sc.pace && sc.pace < 0.95 ? 'lively' : 'normal',
      })),
      transitions: transitions.map((t) => t.id),
      techniques: DIRECTIONS[direction].headline,
      warnings: (qa.warnings || []).map((w) => w.detail),
      tuning: aiFrom('max'),
    });
    agentRuns.push(critic.run);
    let applied = 0;
    // Les scènes que la relecture a dû corriger (mémoire d'expérience : un motif réparé a moins réussi).
    const touched = new Set<number>();
    for (const fix of critic.fixes) {
      const sc = storyboard.scenes[fix.index];
      const prev = storyboard.scenes[fix.index - 1];
      const next = storyboard.scenes[fix.index + 1];
      if (fix.field === 'layout' && layoutFits(fix.value, { sceneId: sc.sceneId, slots: sc.slots, image: sc.image, video: sc.video }, layoutCtx) && fix.value !== prev?.layout && fix.value !== next?.layout) {
        sc.layout = fix.value;
        applied++;
        touched.add(fix.index);
      } else if (fix.field === 'cut' && sc.motion && fix.value !== prev?.motion?.transition && fix.value !== next?.motion?.transition) {
        sc.motion = { ...sc.motion, transition: fix.value as MotionTransition };
        applied++;
        touched.add(fix.index);
      } else if (fix.field === 'title' && sc.motion && fix.value !== prev?.motion?.headline && fix.value !== next?.motion?.headline) {
        sc.motion = { ...sc.motion, headline: fix.value as any };
        applied++;
        touched.add(fix.index);
      } else if (fix.field === 'scale') {
        sc.scale = Number(fix.value);
        applied++;
        touched.add(fix.index);
      } else if (fix.field === 'tempo' && fix.value in TEMPO_PACE) {
        sc.pace = Math.min(1.3, Math.max(0.8, TEMPO_PACE[fix.value as keyof typeof TEMPO_PACE]));
        applied++;
        touched.add(fix.index);
      }
    }
    if (applied) {
      const linted = lintMotion(storyboard.scenes.map((sc) => ({ ...sc.motion! })) as any, sceneIds, DIRECTIONS[direction], transitions.map((t) => t.id)).plan;
      storyboard.scenes.forEach((sc, i) => (sc.motion = linted[i] as any));
      qa = applyRules(storyboard, { objective: brief.objective });
    }
    emit('critique', 'done', { fixes: applied, source: critic.run.source });
    // Les réparations des règles (texte secondaire retiré, scène retirée) peuvent rendre une mise
    // en page vide ou répétée : elle repasse alors à la composition de la direction.
    storyboard.scenes.forEach((sc, i) => {
      if (!sc.layout || sc.layout === 'classic') return;
      const fits = layoutFits(sc.layout, { sceneId: sc.sceneId, slots: sc.slots, image: sc.image, video: sc.video }, layoutCtx);
      if (!fits || sc.layout === storyboard.scenes[i - 1]?.layout) sc.layout = 'classic';
    });
    storyboard.qa = { repaired: qa.repaired.length, issues: qa.issues, warnings: qa.warnings };

    // Le contrôle créatif : récit, composition, mouvement, coupes, motifs, outils, tempo, attention,
    // accent — et l'empreinte, réparée si elle est trop proche d'une vidéo récente du projet. Les
    // réparations restent dans les menus de la direction et de la DA, puis l'anti-réflexe repasse.
    const lintScene = (sc: VideoSceneInstance): LayoutScene => ({ sceneId: sc.sceneId, slots: sc.slots, image: sc.image, video: sc.video });
    const lint = creativeLint(storyboard, {
      direction,
      memory,
      transitions: transitions.map((t) => t.id),
      layoutsFor: (i) => layoutMenu(lintScene(storyboard.scenes[i]), layoutCtx, 6).filter((l) => layoutFits(l, lintScene(storyboard.scenes[i]), layoutCtx)),
      cameras: topNodes('camera', kctx, 4),
      entrances: topNodes('entrance', kctx, 4),
      surfaces: strategySurfaces,
      experience: this.experience,
      // Reproduire une vidéo modèle, c'est lui ressembler : le contrôle signale, il ne « dé-reproduit » pas.
      repair: !refPlan,
    });
    if (lint.repaired.length) {
      const ids = storyboard.scenes.map((sc) => sc.sceneId);
      const linted = lintMotion(storyboard.scenes.map((sc) => ({ ...sc.motion! })) as any, ids, DIRECTIONS[direction], transitions.map((t) => t.id)).plan;
      storyboard.scenes.forEach((sc, i) => (sc.motion = linted[i] as any));
      kit = storyboard.kit!;
      for (const m of lint.repaired.join(' ').matchAll(/scène (\d+)/g)) touched.add(Number(m[1]) - 1);
      reconcilePatterns(storyboard, preferredPatterns);
    }

    // La voix off, en dernier sur le minutage : chaque scène dure au moins le temps de sa ligne
    // (la durée achetée ne change pas). Les plans écrits par l'IA (étape 8) lisent ces durées.
    const voice = this.attachVoice(storyboard, narrated, (index) => sceneKeyOf.get(index));

    // 8. Cran Ultra : l'agent codeur écrit le composant React de chaque scène possible. Chaque
    //    composant est linté, compilé et rendu en bac à sable ; refusé, la scène garde son rendu Max.
    if (aiFrom('ultra')) {
      emit('code', 'running', { scenes: storyboard.scenes.length });
      const orchestrator = new CreativeOrchestrator({ level: creativity, call: this.coderCallFor(userId, projectId) });
      const coded = await codeScenes(
        {
          storyboard,
          sheet,
          direction,
          formats: scope.formats,
          compose: async (sb) => composeVideoHtml({ ...(await inlineAssets(sb, theme, 'render')), format: scope.formats[0], quality: 'standard', mode: 'render' }),
          withPage: withRenderPage,
        },
        orchestrator
      ).catch((error: any) => {
        logger.warn('video.code_scenes_failed', { projectId, error: error?.message });
        return { tried: 0, coded: 0, rejected: {} as Record<string, string[]> };
      });
      for (const trace of orchestrator.traces) agentRuns.push({ agent: trace.agent, source: trace.source, tokens: trace.tokens, ms: trace.ms, kept: trace.source === 'llm' ? 1 : 0 });
      if (Object.keys(coded.rejected).length) logger.info('video.code_scenes_rejected', { projectId, rejected: coded.rejected });
      emit('code', 'done', { coded: coded.coded, tried: coded.tried });
    }
    storyboard.agents = agentRuns.map((r) => ({ agent: r.agent, source: r.source, tokens: r.tokens, ms: r.ms, kept: r.kept }));

    // Le rapport du moteur créatif : exploration, ADN, accent, intention, empreinte, nouveauté.
    const experimental = storyboard.scenes.filter((sc) => sc.pattern && PATTERN_BY_ID.has(sc.pattern) && experimentalIn(PATTERN_BY_ID.get(sc.pattern)!, creative)).length + (accent.applied?.kind === 'overlay' && experimentalIn(PATTERN_BY_ID.get(accent.applied.pattern)!, creative) ? 1 : 0);
    storyboard.creative = {
      v: 1,
      level: creativity,
      exploration: { budget: creative.strategy.exploration, experimental, scenes: patternPlan.considered },
      dna: { direction, rhythm: plan.rhythm, families: creative.strategy.families },
      strategy: { id: creative.strategy.id, label: creative.strategy.label, source: plan.strategy ? 'llm' : 'graph' },
      // L'accent est suivi par sa clé : une scène retirée par les règles ne laisse pas d'index faux.
      ...(accent.applied && storyboard.scenes.some((sc) => sc.key === accent.applied!.key) ? { accent: { ...accent.applied, index: storyboard.scenes.findIndex((sc) => sc.key === accent.applied!.key) } } : {}),
      lint: { issues: lint.issues, repaired: lint.repaired },
      ...(input.reference ? { reference: { id: input.reference.id, summary: input.reference.summary, shots: input.reference.shots.length, scenes: storyboard.scenes.length } } : {}),
    };
    const fingerprint = fingerprintOf(storyboard);
    const { index: _nearestIndex, ...novelty } = noveltyAgainst(fingerprint, memory.fingerprints);
    storyboard.creative.fingerprint = fingerprint;
    storyboard.creative.novelty = { ...novelty, target: creative.noveltyTarget, compared: memory.fingerprints.length };
    storyboard.creative.intent = creativeIntent({ concept: plan.concept, strategy: creative.strategy, direction, rhythm: plan.rhythm, camera: kit.camera, entrance: kit.entrance, narrative: fingerprint.narrative, accent: storyboard.creative.accent });

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
      sfx: sfx ? { ...sfx, ...(soundIntensity ? { intensity: soundIntensity } : {}) } : brief.sfx ? undefined : { enabled: false, sounds: {} },
      ...(voice ? { voice } : {}),
      media: media.assets.filter((a) => used.has(a.url) || a.origin === 'upload'),
      renders: [],
      status: 'draft',
      paidCredits,
      creativity,
      exportCount: 0,
      // Tous les appels de modèle de la vidéo : stratège, rédacteur et agents.
      copyTokens: {
        input: agentRuns.reduce((n, r) => n + r.tokens.input, 0),
        output: agentRuns.reduce((n, r) => n + r.tokens.output, 0),
        source: copy.source,
      },
      createdAt: now,
      updatedAt: now,
    };
    emit('storyboard', 'done', {
      scenes: storyboard.scenes.map((sc) => ({ sceneId: sc.sceneId, duration: sc.duration, surface: sc.surface })),
      bpm: storyboard.beat?.bpm,
      kit: { logo: kit.logo, background: kit.background, annotate: kit.annotate, iconSet: kit.iconSet, addons: kit.addons },
      novelty: { verdict: novelty.verdict, nearest: novelty.nearest },
    });
    await this.communication.saveVideo(userId, projectId, video);
    if (input.contentId) await this.communication.linkVideoToContent?.(userId, projectId, input.contentId, videoId).catch(() => undefined);
    // La mémoire globale : ce que chaque motif a donné (retenu, réparé), sans attendre l'écriture.
    {
      const outcomes: PatternOutcome[] = [];
      storyboard.scenes.forEach((sc, i) => {
        if (!sc.pattern || !PATTERN_BY_ID.has(sc.pattern)) return;
        const def = PATTERN_BY_ID.get(sc.pattern)!;
        outcomes.push({ pattern: sc.pattern, direction, transitionIn: sc.motion?.transition, experimental: experimentalIn(def, creative), kept: true, repaired: touched.has(i) });
        // Le motif voulu par le planificateur (ou l'agent) et remplacé en route : il n'a pas tenu.
        const planned = kept[i]?.from >= 0 ? patternPlan.scenes[kept[i].from]?.pattern : undefined;
        if (planned && planned !== sc.pattern && PATTERN_BY_ID.has(planned)) outcomes.push({ pattern: planned, direction, experimental: experimentalIn(PATTERN_BY_ID.get(planned)!, creative), kept: false });
      });
      if (accent.applied?.kind === 'overlay') outcomes.push({ pattern: accent.applied.pattern, direction, experimental: experimentalIn(PATTERN_BY_ID.get(accent.applied.pattern)!, creative), kept: true });
      void this.experience.record({ level: creativity, direction, patterns: outcomes, nodes: fingerprint.nodes, novelty: novelty.nearest, tokens: video.copyTokens || { input: 0, output: 0 }, ms: Date.now() - startedAt });
    }
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
      voice: voice ? (voice.enabled ? { lines: voice.lines.length, provider: voice.provider, language: voice.language } : { unavailable: voice.unavailable }) : undefined,
      kit: { logo: kit.logo, background: kit.background, annotate: kit.annotate, iconSet: kit.iconSet, camera: kit.camera, entrance: kit.entrance, addons: kit.addons },
      creative: { concept: plan.concept, rhythm: plan.rhythm, source: plan.source, strategy: creative.strategy.label, families: creative.strategy.families, accent: accent.applied?.pattern, experimental, novelty: novelty.nearest, verdict: novelty.verdict, lint: lint.issues.length, repaired: lint.repaired.length },
      patterns: storyboard.scenes.map((sc) => sc.pattern || '-').join(','),
      agents: agentRuns.map((r) => `${r.agent}:${r.source}:${r.kept ?? 0}`).join(' '),
      layouts: storyboard.scenes.map((sc) => sc.layout || '-').join(','),
      transitions: storyboard.scenes.map((sc) => sc.motion?.transition || '-').join(','),
      qa: storyboard.qa,
    });
    this.lastMediaReport = media.report;
    return video;
  }

  /**
   * LE FILM D'AUTEUR (cran Ultra, video.author.ts) : le directeur IA invente le film, un codeur
   * IA écrit chaque plan avec tout le kit du moteur, la boucle rendu → contrôles → critique
   * visuelle → correction garantit la qualité. `null` si le directeur n'a pas livré de film
   * utilisable (le service reprend alors le pipeline des menus).
   */
  private async createAuthoredVideo(o: {
    userId: string;
    projectId: string;
    input: CreateVideoInput;
    scope: VideoScope;
    brief: VideoBrief;
    theme: VideoTheme;
    ctx: CopyContext;
    branding: any;
    visuals: any[];
    otherVideos: MotionVideo[];
    art: ReturnType<typeof motionFromArtDirection>;
    videoId: string;
    seed: number;
    direction: DirectionId;
    orientation: Orientation;
    facts: ReturnType<typeof extractFacts>;
    paidCredits: number;
    requested: VideoType | null;
    emit: (stage: VideoProgressStage, state: 'running' | 'done', data?: Record<string, unknown>) => void;
    /** Le brief du moteur créatif : mémoire du projet, ADN, accent, univers des motifs. */
    creative: CreativeBrief;
    startedAt: number;
    anonymous?: boolean;
  }): Promise<MotionVideo | null> {
    const { userId, projectId, scope, brief, theme, ctx, branding, otherVideos, art, videoId, seed, direction, emit, creative } = o;
    const agentRuns: AgentRun[] = [];
    const sheet = brandSheet({ ctx, palette: theme.palette, fonts: theme.fonts, art: branding?.artDirection });
    const briefText = `${brief.message}\n${brief.details || ''}`;
    const style = brief.style && brief.style !== 'auto' ? resolveStyle(brief.style, undefined, brief.objective) : styleOfDirection(direction);

    // 1. Les photos d'abord : le directeur compose avec ce qui existe vraiment.
    const query = ([ctx.businessType, ...(ctx.keywords || []).slice(0, 2)].filter(Boolean).join(' ') || brief.message).slice(0, 60);
    emit('media', 'running', { query, wanted: { images: 4, videos: 0 } });
    // Quatre photos de la marque pour le directeur : l'offre, les gens, le lieu, un détail.
    const angles = ['the offer itself, hero shot', 'the people it serves, in their daily life', 'the place and its atmosphere', 'a telling close-up detail'];
    const contentWriter = this.writerFor(userId, 'writing');
    const media = await this.acquireMedia({
      userId,
      projectId,
      videoId,
      brief,
      visuals: o.visuals,
      scenes: angles.map((angle) => ({ sceneId: 'product', texts: [angle, brief.message] })),
      query,
      orientation: o.orientation,
      ctx,
      facts: o.facts,
      sheet,
      writer: contentWriter,
      clipQuality: 'quality',
      artModifier: branding?.artDirection?.imagePromptModifier,
      onProgress: (data) => emit('media', 'running', { query, wanted: { images: 4, videos: 0 }, ...data }),
    });
    if (media.run) agentRuns.push(media.run);
    const photos = media.assets.filter((a) => a.kind === 'image');
    emit('media', 'done', { query, ...media.report, items: photos.slice(0, 8).map((a) => ({ kind: a.kind, origin: a.origin, url: a.url, credit: a.credit, name: a.name })) });

    // 2. Le directeur invente le film (deux tentatives) ; le code le valide.
    emit('direction', 'running');
    const directorInput: DirectorInput = {
      brief: { message: brief.message, details: brief.details, objective: brief.objective },
      briefText,
      facts: o.facts,
      sheet,
      direction,
      durationSec: scope.durationSec,
      formats: scope.formats,
      // Une vidéo modèle fixe le nombre de plans (dans les bornes de lecture de la durée).
      range: o.input.reference ? referenceRange(o.input.reference.shots.length, scope.durationSec) : sceneRange(scope.durationSec),
      media: photos.map((a) => [a.origin === 'upload' ? 'photo of the brand (provided by the client)' : a.origin === 'visual' ? 'photo from the brand visuals' : a.origin === 'generated' ? 'generated photo' : 'stock photo', a.name || query].join(': ').slice(0, 120)),
      brandName: theme.brandName,
      language: brief.language || ctx.language || 'fr',
      recentConcepts: otherVideos.map((v) => v.storyboard?.authored?.concept || v.storyboard?.concept).filter(Boolean) as string[],
      // L'univers créatif au lieu de la documentation du moteur : motifs possibles, ce qui a servi,
      // ce qui reste sous-exploré, des combinaisons à explorer, l'ADN et l'accent suggérés.
      universe: creativeUniverse(creative, { photos: photos.length }).text,
      ...(o.input.reference ? { reference: blueprintForDirector(o.input.reference, scope.durationSec) } : {}),
    };
    const director = this.writerFor(userId, 'reasoning');
    let film: AuthoredFilm | undefined;
    for (let attempt = 0; attempt < 2 && !film && director; attempt++) {
      const prompt = buildDirectorPrompt(directorInput);
      const started = Date.now();
      const raw = await director(prompt.system, attempt ? `${prompt.user}\n\nYour previous answer could not be used: follow the OUTPUT format exactly, with ${directorInput.range[0]} to ${directorInput.range[1]} shots and a TITLE on every shot but the signature.` : prompt.user).catch(() => '');
      film = parseFilm(raw, directorInput);
      agentRuns.push({ agent: 'director', source: film ? 'llm' : 'graph', tokens: { input: Math.round((prompt.system.length + prompt.user.length) / 4), output: Math.round(raw.length / 4) }, ms: Date.now() - started, kept: film ? 1 : 0 });
    }
    if (!film) {
      emit('direction', 'done', { fallback: true });
      return null;
    }
    // Sans marque, le plan de signature (logo) disparaît ; les autres s'allongent d'autant.
    if (o.anonymous && film.shots.length > 2 && film.shots.some((sh) => sh.kind === 'logo')) {
      const kept = film.shots.filter((sh) => sh.kind !== 'logo');
      const total = film.shots.reduce((sum, sh) => sum + sh.duration, 0);
      const keptTotal = kept.reduce((sum, sh) => sum + sh.duration, 0) || 1;
      film = { ...film, shots: kept.map((sh) => ({ ...sh, duration: Math.round(((sh.duration * total) / keptTotal) * 100) / 100 })) };
    }
    emit('direction', 'done', { title: film.title, concept: film.concept, shots: film.shots.map((sh) => ({ kind: sh.kind, duration: sh.duration, visual: sh.visual.slice(0, 140) })) });

    // 3. Musique et effets sonores, pendant que les plans s'écrivent.
    emit('music', 'running', { mood: brief.musicMood });
    if (brief.sfx) emit('sfx', 'running');
    const soundWriter = this.agentWriterFor(userId, 'writing');
    const musicP = this.chooseMusic({
      mood: brief.musicMood,
      style,
      objective: brief.objective,
      durationSec: scope.durationSec,
      seed,
      avoidIds: otherVideos.map((v) => v.music?.id).filter(Boolean) as string[],
      brandText: [ctx.tone, ctx.valueProposition, ctx.businessType, ...(ctx.keywords || []), brief.message, film.concept].filter(Boolean).join(' '),
      pick: async (tracks, mood) => {
        const res = await runSoundDesigner(soundWriter, { sheet, request: `${brief.message} ${film!.concept}`, rhythm: 'steady', mood, durationSec: scope.durationSec, tracks });
        agentRuns.push(res.run);
        return res.choice.trackId;
      },
    }).then((track) => {
      emit('music', 'done', track ? { title: track.title, artist: track.artist, provider: track.provider, bpm: track.beat?.bpm, license: track.license, pickedBy: 'agent' } : { none: true });
      return track;
    });
    const sfxP = brief.sfx
      ? this.chooseSfx(seed)
          .catch(() => undefined)
          .then((fx) => {
            emit('sfx', 'done', { sounds: Object.values(fx?.sounds || {}).map((snd) => ({ kind: snd!.kind, title: snd!.title })) });
            return fx;
          })
      : Promise.resolve(undefined);
    // La voix off, sur les plans du directeur (pendant que la musique se prépare).
    if (brief.voice) emit('voice', 'running', { language: brief.language });
    const voiceP = brief.voice
      ? this.narrate({
          userId,
          projectId,
          videoId,
          language: brief.language || ctx.language,
          brandName: theme.brandName,
          sheet,
          brief: briefText,
          facts: o.facts,
          style,
          seed,
          scenes: film.shots.map((sh) => ({ sceneId: sh.kind, duration: sh.duration, texts: sceneTexts(sh.slots) })),
          writer: contentWriter,
          concept: film.concept,
        }).then((res) => {
          if (res.run) agentRuns.push(res.run);
          emit('voice', 'done', res.voice.enabled ? { lines: res.lines.length, language: res.voice.language, provider: res.voice.provider, persona: res.voice.persona } : { unavailable: res.voice.unavailable });
          return res;
        })
      : Promise.resolve(undefined);
    const music = await musicP;

    // 4. Le storyboard aux durées, surfaces et photos du directeur ; coupes franches (chaque plan
    //    fait lui-même son entrée et sa sortie, comme le directeur les a imaginées).
    const storyboard = buildStoryboard({
      sceneIds: film.shots.map((sh) => sh.kind),
      slots: film.shots.map((sh) => sh.slots),
      durationSec: scope.durationSec,
      style,
      seed,
      beat: music?.beat,
      images: [],
      objective: brief.objective,
      direction,
      landscape: scope.formats[0] === 'landscape',
      art: art.overrides,
    });
    let start = 0;
    storyboard.scenes.forEach((sc, i) => {
      const shot = film!.shots[i];
      sc.start = Math.round(start * 1000) / 1000;
      sc.duration = shot.duration;
      start += shot.duration;
      if (shot.surface) sc.surface = shot.surface;
      if (shot.media && photos[shot.media - 1]) sc.image = photos[shot.media - 1].url;
      if (sc.motion) sc.motion = { ...sc.motion, transition: 'cut' as MotionTransition };
      delete sc.accent;
      delete sc.layout;
      if (shot.pattern) sc.pattern = shot.pattern;
    });
    const last = storyboard.scenes[storyboard.scenes.length - 1];
    if (last) last.duration = Math.round((scope.durationSec - last.start) * 1000) / 1000;
    // Les plans durent au moins le temps de leur ligne : les codeurs écrivent sur ces durées.
    const voice = this.attachVoice(storyboard, await voiceP, (i) => storyboard.scenes[i]?.key);
    const type: VideoType = o.requested ?? 'mix';
    const kctx = this.kitContext({ type, brief, scope, direction, storyboard, theme, branding, ctx, media: media.assets, otherVideos });
    // Le kit ne décore plus rien : l'IA dessine ses fonds et ses annotations. Il garde l'animation
    // du logo et les icônes (repli de la signature, briques du codeur).
    storyboard.kit = { ...resolveKit({ ...kctx, memory: this.kitMemory(creative) }), background: 'none', backdropScenes: [], annotate: 'none', annotateScene: undefined };
    storyboard.kit.icons = {};

    // 5. Chaque plan écrit par un codeur IA, rendu, contrôlé, critiqué, corrigé.
    emit('shots', 'running', { total: storyboard.scenes.length, done: 0, coded: 0 });
    const orchestrator = new CreativeOrchestrator({ level: 'ultra', call: this.coderCallFor(userId, projectId) });
    let done = 0;
    let codedSoFar = 0;
    const result = await authorShots({
      storyboard,
      film,
      sheet,
      direction,
      formats: scope.formats,
      compose: async (sb) => composeVideoHtml({ ...(await inlineAssets(sb, theme, 'render')), format: scope.formats[0], quality: 'standard', mode: 'render' }),
      withPage: withRenderPage,
      orchestrator,
      critic: this.visionCritic,
      rounds: 3,
      // Vidéo modèle : chaque codeur reçoit son plan à reproduire, la critique compare au modèle.
      ...(o.input.reference
        ? {
            reference: {
              shots: film.shots.map((_, i) => o.input.reference!.shots[Math.min(i, o.input.reference!.shots.length - 1)]?.description),
              sheets: film.shots.map((_, i) => o.input.reference!.shots[Math.min(i, o.input.reference!.shots.length - 1)]?.sheet),
            },
          }
        : {}),
      onShot: (index, state, info) => {
        if (state === 'done') {
          done++;
          if (info?.ok) codedSoFar++;
        }
        emit('shots', 'running', { total: storyboard.scenes.length, done, coded: codedSoFar, current: index + 1, step: state, round: info?.round });
      },
    });
    for (const trace of orchestrator.traces) agentRuns.push({ agent: trace.agent, source: trace.source, tokens: trace.tokens, ms: trace.ms, kept: trace.source === 'llm' ? 1 : 0 });
    if (result.fallback.length) logger.info('video.authored_fallback', { projectId, fallback: result.fallback, rejected: result.rejected });
    emit('shots', 'done', { total: storyboard.scenes.length, coded: result.coded, reviewed: result.reviewed });

    storyboard.authored = { title: film.title, concept: film.concept, bible: film.bible, shots: storyboard.scenes.length, coded: result.coded, fallback: result.fallback, reviewed: result.reviewed, rounds: result.rounds };
    storyboard.concept = 'authored';
    storyboard.agents = agentRuns.map((r) => ({ agent: r.agent, source: r.source, tokens: r.tokens, ms: r.ms, kept: r.kept }));
    // Le moteur créatif en Ultra : l'IA est libre, le code mesure. L'accent est le premier plan (ni
    // l'ouverture ni la signature) dont le motif sort de l'ADN ; rien n'est réparé, tout est signalé.
    reconcilePatterns(storyboard);
    const dna = creative.strategy.families;
    const accentAt = storyboard.scenes.findIndex((sc, i) => i > 0 && i < storyboard.scenes.length - 1 && !!sc.pattern && PATTERN_BY_ID.has(sc.pattern) && !dna.includes(PATTERN_BY_ID.get(sc.pattern)!.family) && PATTERN_BY_ID.get(sc.pattern)!.family !== 'brand');
    const authoredAccent = accentAt > 0 ? { index: accentAt, key: storyboard.scenes[accentAt].key, pattern: storyboard.scenes[accentAt].pattern!, family: PATTERN_BY_ID.get(storyboard.scenes[accentAt].pattern!)!.family, kind: 'scene' as const } : undefined;
    storyboard.creative = {
      v: 1,
      level: 'ultra',
      exploration: { budget: creative.budget, experimental: result.explored.length, scenes: film.shots.length - 1 },
      dna: { direction, families: dna },
      strategy: { id: creative.strategy.id, label: creative.strategy.label, source: 'graph' },
      ...(authoredAccent ? { accent: authoredAccent } : {}),
    };
    const lint = creativeLint(storyboard, { direction, memory: creative.memory, transitions: [], repair: false });
    const { index: _nearest, ...novelty } = lint.novelty;
    storyboard.creative = { ...storyboard.creative, fingerprint: lint.fingerprint, novelty: { ...novelty, target: creative.noveltyTarget, compared: creative.memory.fingerprints.length }, lint: { issues: lint.issues, repaired: [] } };
    storyboard.creative.intent = { ...creativeIntent({ concept: film.concept, strategy: creative.strategy, direction, narrative: lint.fingerprint.narrative, accent: authoredAccent }), concept: film.concept };
    const sfx = await sfxP;

    const now = new Date().toISOString();
    const used = new Set(storyboard.scenes.map((sc) => sc.image).filter(Boolean));
    const video: MotionVideo = {
      id: videoId,
      title: fitLength(film.title || brief.message, 60),
      type,
      brief,
      scope,
      storyboard,
      music,
      sfx: sfx ? sfx : brief.sfx ? undefined : { enabled: false, sounds: {} },
      ...(voice ? { voice } : {}),
      media: media.assets.filter((a) => used.has(a.url) || a.origin === 'upload'),
      renders: [],
      status: 'draft',
      paidCredits: o.paidCredits,
      creativity: 'ultra',
      exportCount: 0,
      copyTokens: {
        input: agentRuns.reduce((n, r) => n + r.tokens.input, 0),
        output: agentRuns.reduce((n, r) => n + r.tokens.output, 0),
        source: 'llm',
      },
      createdAt: now,
      updatedAt: now,
    };
    emit('storyboard', 'done', {
      scenes: storyboard.scenes.map((sc) => ({ sceneId: sc.sceneId, duration: sc.duration, surface: sc.surface })),
      bpm: storyboard.beat?.bpm,
      authored: { shots: storyboard.authored.shots, coded: storyboard.authored.coded },
    });
    await this.communication.saveVideo(userId, projectId, video);
    if (o.input.contentId) await this.communication.linkVideoToContent?.(userId, projectId, o.input.contentId, videoId).catch(() => undefined);
    // La mémoire globale : chaque plan, son motif (ou son exploration), ses tours, son repli, sa critique.
    void this.experience.record({
      level: 'ultra',
      direction,
      patterns: storyboard.scenes
        .map((sc, i) => {
          const shot = film!.shots[i];
          const id = shot?.explore?.length ? `explore:${[...shot.explore].sort().join('+')}` : sc.pattern;
          if (!id || sc.sceneId === 'logo') return null;
          return { pattern: id, direction, experimental: result.explored.includes(sc.key), kept: !result.fallback.includes(sc.key), fallback: result.fallback.includes(sc.key), repaired: (result.rounds[sc.key] || 1) > 1, critic: result.critic[sc.key] } as PatternOutcome;
        })
        .filter((x): x is PatternOutcome => !!x),
      nodes: lint.fingerprint.nodes,
      novelty: novelty.nearest,
      tokens: video.copyTokens || { input: 0, output: 0 },
      ms: Date.now() - o.startedAt,
    });
    logger.info('video.created', {
      event: 'video.created',
      projectId,
      videoId,
      type,
      creativity: 'ultra',
      creative: { strategy: creative.strategy.label, explored: result.explored.length, accent: authoredAccent?.pattern, novelty: novelty.nearest, verdict: novelty.verdict, lint: lint.issues.length },
      patterns: storyboard.scenes.map((sc) => sc.pattern || '-').join(','),
      authored: { title: film.title, concept: film.concept, shots: storyboard.authored.shots, coded: result.coded, fallback: result.fallback, reviewed: result.reviewed, rounds: result.rounds },
      agents: agentRuns.map((r) => `${r.agent}:${r.source}:${r.kept ?? 0}`).join(' '),
      music: music?.provider,
      media: media.report,
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
      /** Voix off : coupée (gardée pour plus tard) ou ajoutée (écrite et dite dans la langue de la vidéo). */
      voice?: boolean;
      direction?: string;
      /** Retouche du kit : acceptée seulement si le graphe la permet. */
      kit?: KitOverrides;
      /**
       * Remplacement de la photo d'une scène (clé de scène → URL http(s)) : seulement là où la
       * scène en montre déjà une — la mise en page, elle, ne change pas.
       */
      images?: Record<string, string>;
    }
  ): Promise<MotionVideo | null> {
    const all = await this.communication.listVideos(userId, projectId);
    const current = all.find((v) => v.id === videoId);
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

    if (patch.images) {
      storyboard = {
        ...storyboard,
        scenes: storyboard.scenes.map((scene) => {
          const url = String(patch.images?.[scene.key] || '').trim();
          return url && scene.image && mediaUrlAllowed(url) ? { ...scene, image: url } : scene;
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

    // Autre direction : nouvelle composition, nouvelles techniques, nouvelle couleur — toujours
    // dans ce que la DA de la charte admet (transitions et mises en page exclues retirées).
    if (isMotionDirection(patch.direction) && patch.direction !== storyboard.direction) {
      const { branding, otherVideos } = await this.brandContext(userId, projectId);
      const art = motionFromArtDirection(branding?.artDirection);
      const others = otherVideos.filter((v) => v.id !== videoId);
      const ids = storyboard.scenes.map((sc) => sc.sceneId);
      const transitions = transitionMenu(patch.direction, {
        excluded: art.excludedTransitions,
        boosts: art.boosts,
        recent: others.map((v) => (v.storyboard?.scenes || []).map((sc) => sc.motion?.transition).filter(Boolean) as string[]),
      });
      const plan = planMotion(ids, patch.direction, storyboard.seed, { landscape: scope.formats[0] === 'landscape', transitions });
      const surfaces = surfacesFor(ids, storyboard.art?.color || DIRECTIONS[patch.direction].color, storyboard.seed);
      // Les mises en page gardées si la nouvelle direction les porte, sinon tirées à nouveau.
      const layoutCtx = { direction: patch.direction, excluded: art.excludedLayouts, boosts: art.boosts, recent: others.map((v) => (v.storyboard?.scenes || []).map((sc) => sc.layout).filter(Boolean) as string[]) };
      const chosen: Record<number, string> = {};
      storyboard.scenes.forEach((sc, i) => sc.layout && (chosen[i] = sc.layout));
      const layouts = assignLayouts(storyboard.scenes.map((sc) => ({ sceneId: sc.sceneId, slots: sc.slots, image: sc.image, video: sc.video })), { ...layoutCtx, seed: storyboard.seed, chosen });
      storyboard = {
        ...storyboard,
        direction: patch.direction,
        style: styleOfDirection(patch.direction),
        scenes: storyboard.scenes.map((sc, i) => ({ ...sc, motion: plan[i], layout: layouts[i], surface: sc.sceneId === 'logo' && sc.variant === 2 ? 'light' : surfaces[i] })),
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

    // Un film d'auteur (Ultra) garde le minutage et le découpage de son directeur : re-minuter ou
    // réparer par les règles du graphe défairait ce que l'IA a composé (les plans codés lisent
    // leurs cases, une retouche de texte s'y affiche telle quelle).
    if (!storyboard.authored) {
      storyboard = retime(storyboard, music?.beat);
      const qa = applyRules(storyboard, { objective: brief.objective });
      storyboard = { ...storyboard, qa: { repaired: qa.repaired.length, issues: qa.issues, warnings: qa.warnings } };
    } else if (music?.beat) {
      storyboard = { ...storyboard, beat: music.beat };
    }

    // La voix off : coupée, elle est gardée (la remettre est gratuit) ; demandée sans lignes (ou
    // dans une autre langue), elle est écrite et dite. Active, le minutage se recale sur elle.
    let voice = current.voice;
    if (patch.voice === false && voice) voice = { ...voice, enabled: false };
    if (patch.voice === true) {
      const language = brief.language || 'fr';
      if (voice?.lines.length && voice.language === language.slice(0, 5)) voice = { ...voice, enabled: true, unavailable: undefined };
      else {
        const { theme, ctx, branding } = await this.brandContext(userId, projectId);
        const sb: VideoStoryboard = { ...storyboard, scenes: storyboard.scenes.map((sc) => ({ ...sc })) };
        const narrated = await this.narrate({
          userId,
          projectId,
          videoId,
          language,
          brandName: theme.brandName,
          sheet: brandSheet({ ctx, palette: theme.palette, fonts: theme.fonts, art: branding?.artDirection }),
          brief: `${brief.message}\n${brief.details || ''}`,
          facts: extractFacts(`${brief.message}\n${brief.details || ''}`),
          style: storyboard.style,
          seed: storyboard.seed,
          scenes: sb.scenes.map((sc) => ({ sceneId: sc.sceneId, duration: sc.duration, texts: sceneTexts(sc.slots) })),
          writer: this.writerFor(userId, tierFor(normalizeCreativity(current.creativity), 'copy')),
          concept: storyboard.authored?.concept,
        });
        voice = this.attachVoice(sb, narrated, (i) => sb.scenes[i]?.key);
        storyboard = sb;
      }
      brief = { ...brief, voice: true };
    } else if (patch.voice === false) brief = { ...brief, voice: false };
    if (voice?.enabled && voice.lines.length) {
      const fitted = fitScenesToVoice(storyboard, voice);
      storyboard = fitted.storyboard;
      voice = fitted.voice;
    }

    // L'empreinte suit la retouche (autre direction, autres mises en page, autre kit) : la mémoire du
    // projet reste juste, et la nouveauté affichée est celle de la vidéo telle qu'elle est.
    {
      const sb: VideoStoryboard = { ...storyboard, scenes: storyboard.scenes.map((sc) => ({ ...sc })) };
      reconcilePatterns(sb);
      const before = all.filter((v) => v.id !== videoId && (!v.createdAt || !current.createdAt || v.createdAt <= current.createdAt));
      storyboard = { ...sb, creative: refreshCreative(sb, projectMemory(before), normalizeCreativity(current.creativity)) };
    }

    return this.communication.mutateVideo(userId, projectId, videoId, (v) => ({
      ...v,
      brief,
      scope,
      storyboard,
      music,
      sfx,
      ...(voice ? { voice } : {}),
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
      const shift = video.sfx?.intensity === 'subtle' ? -4 : video.sfx?.intensity === 'punchy' ? 3 : 0;
      const db = SFX_GAIN_DB[kind as SfxKind] + (density[kind as SfxKind] ?? 0) + shift;
      if (db < -40) continue;
      sounds[kind] = { url: coreHost().sfxUrl(publicSoundName(file!)), gain: previewGain(db) };
    }
    const { html } = await composeVideoHtml({
      ...assets,
      format: target,
      quality: 'standard',
      mode: 'preview',
      music: video.music ? { url: video.music.url, startAt: video.music.startAt } : undefined,
      sfx: { enabled: !!video.sfx?.enabled, sounds },
      voice: voiceTimeline(video.storyboard, video.voice),
    });
    return html;
  }

  // ── Export ───────────────────────────────────────────────────────────────

  quoteExport(video: MotionVideo, scopeInput?: unknown): { cost: number; scope: VideoScope } {
    const scope = scopeInput ? { ...normalizeScope(scopeInput), durationSec: video.scope.durationSec } : video.scope;
    return { cost: exportCost({ paidCredits: video.paidCredits, exportCount: video.exportCount, scope, creativity: video.creativity }), scope };
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

    // La voix off : chaque ligne téléchargée une fois, mixée à son instant dans chaque format.
    const voiceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'idem-voice-render-'));
    const voiceFiles: { file: string; at: number }[] = [];
    for (const [i, line] of voiceTimeline(video.storyboard, video.voice).entries()) {
      try {
        const file = path.join(voiceDir, `line-${i}.mp3`);
        await downloadTo(line.url, file);
        voiceFiles.push({ file, at: line.at });
      } catch (error: any) {
        logger.warn('video.voice_download_failed', { videoId, line: i, error: error.message });
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
          sfx: Object.keys(sfxFiles).length ? { files: sfxFiles, style: video.storyboard.style, intensity: video.sfx?.intensity } : undefined,
          voice: voiceFiles,
          posterAt: first ? first.start + Math.min(first.duration * 0.85, 2) : 1,
          onProgress: (r) => liveProgress.set(`${videoId}:${format}`, r),
          // Code écrit par l'IA (cran Ultra) dans la page : garde réseau strict.
          strict: video.storyboard.scenes.some((sc) => !!sc.code?.tsx),
        });
        const folder = `users/${userId}/projects/${projectId}/videos/${videoId}`;
        const stamp = Date.now().toString(36);
        const [mp4, poster] = await Promise.all([
          requirePort('storage').uploadFile(fs.readFileSync(out.file), `${format}-${stamp}.mp4`, folder, 'video/mp4'),
          requirePort('storage').uploadFile(fs.readFileSync(out.poster), `${format}-${stamp}.jpg`, folder, 'image/jpeg'),
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

    fs.rmSync(voiceDir, { recursive: true, force: true });

    const allFailed = results.every((r) => r.status === 'failed');
    // L'utilisateur a exporté : le signal le plus fiable pour la mémoire globale du moteur créatif.
    if (!allFailed && !video.exportCount) {
      const fp = video.storyboard.creative?.fingerprint || fingerprintOf(video.storyboard);
      void this.experience.recordExport(fp.patterns.filter((p) => PATTERN_BY_ID.has(p)), fp.nodes, video.storyboard.direction);
    }
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

// ─── Téléchargement d'un fichier du stockage (voix off) ─────────────────────

async function downloadTo(url: string, file: string): Promise<void> {
  if (url.startsWith('file://') && process.env.VIDEO_ALLOW_FILE_URLS === '1' && process.env.NODE_ENV !== 'production') {
    fs.copyFileSync(url.replace('file://', ''), file);
    return;
  }
  if (!/^https?:\/\//.test(url)) throw new Error('voice_url_refused');
  const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000, maxContentLength: 20 * 1024 * 1024 });
  fs.writeFileSync(file, Buffer.from(res.data));
}

// ─── Restitution des crédits d'un rendu en échec ───────────────────────────

async function refundCharge(userId: string, charge: RenderCharge, note: string): Promise<void> {
  try {
    // La facturation appartient à l'hôte (crédits IDEM, dans IDEM comme dans iVision).
    await requirePort('refundCredits')(userId, charge.cost, { action: charge.action, note });
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
