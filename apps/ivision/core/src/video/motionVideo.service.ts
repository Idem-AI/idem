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
  VIDEO_FORMATS,
  VideoQuality,
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
import { CreativePlan, inferObjective, planCreative } from './video.storyline';
import { conceptCopyHints, ensureScenes, sceneRange } from './video.concepts';
import { applyRules } from './video.rules';
import { motionFromArtDirection } from './video.artdirection';
import { enhanceRequest } from './video.enhance';
import { MediaStorage, Orientation, processUpload } from './video.media';
import { planMediaNeeds, runMediaDirector, SceneMedia, sceneMediaOf, SourcingOptions, sourceShots } from './video.sourcing';
import { applyClarification, ClassifyInput, clarifyVideoIntent, classifyVideoIntent, describeVideoIntent, IntentAsset, legacyOf, refineVideoIntent, VideoClarification, VideoIntentSpec } from './video.intent';
import { fitScenesToVoice, Narration, personaById, personaMenu, runNarrator, sceneTexts, speakable, speechAvailable, synthesizeVoice, voiceTimeline } from './video.voice';
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
import { canRecode, recodeScene, unreadSlots } from './video.recode';
import { recordFromVideo } from './video.record';
import { recordSummary } from '@idem/graphic-engine';
import { AUTHOR_MEANS, AuthoredFilm, authorShots, buildDirectorPrompt, DirectorInput, filmAssetPlan, parseFilm } from './video.author';
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
import { resolveLanguage } from '../text/language';
import { describesFilmedAction, MAX_REQUEST_CHARS, negativeCues, parseRequest, readRequest, RequestSpec, sceneTimeline, specConstraints } from './video.request';
import { checkFidelity, planScriptShots, ScriptShot } from './video.script';
import { BrandMediaItem, brandMediaLine, describeBrandMedia, pickScreens } from './video.brandmedia';
import { ShotPlan, stockQuery } from './video.sourcing';
import { LAYOUT_SCENES } from './video.layouts';

/** Ce qu'une retouche a vraiment fait (dit tel quel par la conversation). */
export interface RevisionReport {
  /** Scènes dont le code a été réécrit. */
  recoded: string[];
  /** Scènes revenues à leur composition éprouvée (leur code n'aurait pas montré les nouveaux textes). */
  fallback: string[];
  /** Scènes dont la ligne de voix off a été redite. */
  voiced: string[];
  /** Ce qui n'a pas pu être fait. */
  failed: { key: string; what: 'visual' | 'voice' }[];
}

export const emptyRevisionReport = (): RevisionReport => ({ recoded: [], fallback: [], voiced: [], failed: [] });

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
  /**
   * L'interprétation CORRIGÉE par l'utilisateur (objectif, mode, langage de motion…), ou la réponse à la
   * question de clarification : elle l'emporte sur la lecture du code (décision explicite).
   */
  intent?: Partial<Pick<VideoIntentSpec, 'objective' | 'productionModes' | 'motionDirection' | 'subtitles' | 'voiceover' | 'music'>>;
  clarification?: { id: string; option: string };
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
  /** La génération coupée pour toute la vidéo (fournisseur sans crédit, service absent). */
  blocked?: 'payment' | 'unavailable';
  /** Captures et photos de la marque montrées. */
  fromBrand?: number;
  /** Médias repris du registre du projet. */
  fromRegistry?: number;
  /** Le plan de médias résolu (provenance de chaque média : `scène ← source (fournisseur)`). */
  assets?: string[];
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
  // La demande EN ENTIER (un script d'une page n'est plus coupé à 400 + 800 signes) ; sa langue est
  // celle que l'utilisateur écrit — l'interface et la marque ne sont que des replis.
  const request = String(b.request || [b.message, b.details].filter(Boolean).join('\n')).replace(/\r\n?/g, '\n').trim().slice(0, MAX_REQUEST_CHARS);
  const spoken = resolveLanguage(request || message, [language, b.language]);
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
    language: spoken.code.slice(0, 5),
    ...(request ? { request } : {}),
    ...(b.spec && (b.spec as RequestSpec).v === 1 ? { spec: b.spec as RequestSpec } : {}),
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

/** Une description bornée, sans guillemets ni balisage (consignes aux modèles d'image et de vidéo). */
const cleanText = (value: string, max: number) => String(value || '').replace(/["«»“”`*_#]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);

/** Les mises en page qui réduisent une phrase à un mot géant ou la font défiler : jamais sur les mots d'un scénario. */
const VERBATIM_UNSAFE = new Set(['spotlightWord', 'ticker']);

/**
 * Un plan filmé de la demande (des personnes, des gestes) reste GRAND : plein cadre en cinéma ou sur
 * une moitié du cadre — jamais dans les lettres du titre, une capsule, une petite fenêtre ou derrière
 * des lames, où le personnage disparaîtrait.
 */
function keepFootageLarge(storyboard: VideoStoryboard, isFilmed: (sc: VideoSceneInstance) => boolean = (sc) => sc.script?.medium === 'footage'): void {
  const kit = storyboard.kit;
  if (!kit) return;
  const LARGE = ['cinema', 'split', 'magazine', 'broadcast'];
  kit.treatments = { ...(kit.treatments || {}) };
  let previous = '';
  for (const sc of storyboard.scenes) {
    if (sc.sceneId !== 'footage' || !isFilmed(sc) || (!sc.video && !sc.image)) continue;
    const current = kit.treatments[sc.key];
    if (!current || !LARGE.includes(current) || current === previous) kit.treatments[sc.key] = previous === 'cinema' ? 'split' : 'cinema';
    previous = kit.treatments[sc.key];
  }
}

/** Les plans filmés qu'une vidéo peut porter : le plafond de clips générés, ou les banques de vidéos libres. */
function clipCap(brief: VideoBrief): number {
  const generated = Math.max(0, Number(process.env.VIDEO_GEN_MAX_CLIPS ?? 4));
  const stock = brief.allowStock !== false && !!process.env.PEXELS_API_KEY ? 4 : 0;
  const own = (brief.media || []).filter((m) => m.kind === 'video').length;
  return Math.max(own, brief.allowGenerate !== false ? generated : 0, stock);
}

/**
 * Le plan créatif d'un SCÉNARIO (aucun appel au stratège) : ses plans tels que le code les a
 * découpés ; le grand moment sur la rafale de mots (ou le premier plan de motion du milieu).
 */
function scriptPlan(shots: ScriptShot[], brief: VideoBrief, spec: RequestSpec): CreativePlan {
  const burst = shots.findIndex((sh, i) => i > 0 && sh.sceneId === 'kinetic');
  const middle = shots.findIndex((sh, i) => i > 0 && i < shots.length - 1 && sh.medium === 'motion');
  return {
    objective: VIDEO_OBJECTIVES.includes(brief.objective) && brief.objective !== 'promotion' ? brief.objective : inferObjective(`${spec.objective || ''} ${brief.message}`),
    type: 'mix',
    concept: 'journey',
    scenes: shots.map((sh) => sh.sceneId),
    accent: burst > 0 ? burst : middle > 0 ? middle : Math.min(1, shots.length - 1),
    moves: {},
    rhythm: spec.musicMood === 'epic' || /mont[ée]e|build|crescendo/i.test(spec.music || '') ? 'crescendo' : spec.musicMood === 'calm' ? 'breathe' : 'steady',
    source: 'graph',
    tokens: { input: 0, output: 0 },
  };
}

/** La voix off écrite par l'utilisateur, posée sur le premier plan de sa scène (index de plan → ligne). */
function scriptedVoice(shots: ScriptShot[], spec: RequestSpec): Record<number, string> | undefined {
  const out: Record<number, string> = {};
  spec.scenes.forEach((scene, k) => {
    if (!scene.voice.length) return;
    const first = shots.findIndex((sh) => sh.scene === k);
    if (first >= 0) out[first] = scene.voice.join(' ');
  });
  return Object.keys(out).length ? out : undefined;
}

/** « VIDÉO OFFICIELLE DE LANCEMENT D'IDEM » → « Vidéo officielle de lancement d'IDEM » (les sigles restent). */
const SMALL_WORDS = new Set(['LA', 'LE', 'LES', 'DE', 'DU', 'DES', 'ET', 'UN', 'UNE', 'EN', 'AU', 'AUX', 'POUR', 'PAR', 'SUR', 'MON', 'MA', 'MES', 'TON', 'TA', 'SON', 'SA', 'NOS', 'VOS', 'CE', 'CES', 'QUI', 'QUE', 'EST', 'NEW', 'THE', 'AND', 'OF', 'FOR', 'OUR', 'YOUR', 'MY', 'TO', 'IN', 'ON']);
export function titleCase(title: string): string {
  const t = title.trim();
  if (!t || t !== t.toUpperCase()) return t;
  return t
    .split(/(\s+)/)
    .map((w) => {
      if (/^\s+$/.test(w)) return w;
      const m = w.match(/^([DLdl]['’])?(.*)$/);
      const prefix = (m?.[1] || '').toLocaleLowerCase();
      const core = m?.[2] ?? w;
      const letters = core.replace(/[^\p{L}]/gu, '');
      // Un sigle ou un nom court en capitales sans accent (IDEM, PME, IA) reste tel quel.
      const acronym = /^[A-Z]{2,6}$/.test(letters) && !SMALL_WORDS.has(letters);
      return prefix + (acronym ? core : core.toLocaleLowerCase());
    })
    .join('')
    .replace(/^\p{Ll}/u, (c) => c.toLocaleUpperCase());
}

export class MotionVideoService {

  constructor(
    /** Les marques et les vidéos de l'hôte (projets IDEM, marques iVision). */
    private readonly communication: VideoStore,
    /** Remplaçable pour les tests (réponses écrites à la main, aucun appel réseau). */
    // L'étage du modèle suit la jauge de créativité (`tierFor`) : plus l'IA décide, plus le modèle est fort.
    // `role` : le rôle logique de l'appel (`video.director`…) — l'hôte peut l'aiguiller vers un modèle ou un
    // point d'accès configuré pour ce rôle (config/creative-roles.ts chez IDEM) ; sinon l'étage décide.
    private readonly writerFor: (userId: string, tier?: VideoModelTier, role?: string) => CopyWriter | undefined = (userId, tier = 'mechanical', role) => (system, user) =>
      typeof communication.runVideoTieredPrompt === 'function'
        ? communication.runVideoTieredPrompt(userId, system, user, tier, 'copy', role)
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

  /** Les médias d'une création, vus par le classificateur d'intention. */
  private intentAssets(media: VideoMediaAsset[], brandMedia: { url: string; kind?: 'screen' | 'photo'; note?: string }[]): IntentAsset[] {
    return [
      ...media.map((m) => ({ id: m.id, kind: m.kind, ...(m.width ? { width: m.width } : {}), ...(m.height ? { height: m.height } : {}), ...(m.durationSec ? { durationSec: m.durationSec } : {}), ...(m.name ? { note: m.name } : {}) })),
      ...brandMedia.filter((m) => m.kind === 'screen').map((m, i) => ({ id: `brand-screen-${i + 1}`, kind: 'screen' as const, ...(m.note ? { note: m.note } : {}) })),
    ];
  }

  /** L'intention d'une création : code, puis agent si peu sûre (dès Medium), puis corrections de l'utilisateur. */
  private async readIntent(userId: string, input: CreateVideoInput, brief: VideoBrief, spec: RequestSpec, brandMedia: { url: string; kind?: 'screen' | 'photo'; note?: string }[], creativity: CreativityLevel): Promise<VideoIntentSpec> {
    const classify: ClassifyInput = { request: brief.request || `${brief.message}\n${brief.details || ''}`, spec, assets: this.intentAssets(brief.media || [], brandMedia), requestedType: VIDEO_TYPES.includes(input.type as VideoType) ? (input.type as VideoType) : 'auto', brandHasScreens: brandMedia.some((m) => m.kind === 'screen'), language: spec.language };
    let intent = classifyVideoIntent(classify);
    if (atLeast(creativity, 'medium')) intent = await refineVideoIntent(intent, classify.request, this.writerFor(userId, 'mechanical', 'video.intent-classifier'));
    if (input.clarification) {
      const question = clarifyVideoIntent(intent, classify);
      if (question && question.id === input.clarification.id) intent = applyClarification(intent, question, input.clarification.option);
    }
    if (input.intent) {
      const patch = Object.fromEntries(Object.entries(input.intent).filter(([, v]) => v !== undefined));
      intent = { ...intent, ...patch, source: 'user', decided: { objective: input.intent.objective ? 'explicit' : intent.decided.objective, productionModes: input.intent.productionModes ? 'explicit' : intent.decided.productionModes, motionDirection: input.intent.motionDirection ? 'explicit' : intent.decided.motionDirection } };
      // L'interprétation revue : sa traduction suit (type, objectif, direction).
      intent.legacy = legacyOf(intent, classify);
    }
    return intent;
  }

  /**
   * L'INTERPRÉTATION d'une demande, avant toute création (gratuite, sans crédits) : l'intention lue, ses
   * étiquettes et sa phrase pour l'interface, et la question à poser si — et seulement si — une décision qui
   * change le pipeline manque.
   */
  async interpretVideo(userId: string, projectId: string, input: Pick<CreateVideoInput, 'brief' | 'type' | 'language' | 'creativity'>): Promise<{ intent: VideoIntentSpec; interpretation: { tags: string[]; summary: string }; clarification: VideoClarification | null }> {
    const brief = normalizeBrief(input.brief, input.language);
    const { brandMedia } = await this.brandContext(userId, projectId);
    const read = await readRequest(brief.request || brief.message, { fallbackLanguages: [input.language], skipReader: true });
    const intent = await this.readIntent(userId, { ...input, scope: undefined } as CreateVideoInput, brief, { ...read.spec, language: brief.language || read.spec.language }, brandMedia, normalizeCreativity(input.creativity));
    const classify: ClassifyInput = { request: brief.request || brief.message, spec: read.spec, assets: this.intentAssets(brief.media || [], brandMedia), brandHasScreens: brandMedia.some((m) => m.kind === 'screen'), language: intent.language };
    return { intent, interpretation: describeVideoIntent(intent), clarification: clarifyVideoIntent(intent, classify) };
  }

  /** Le registre des ressources du projet pour le sourcing (vide sans hôte qui le porte). */
  private async registryFor(userId: string, projectId: string): Promise<{ registry?: SourcingOptions['registry'] }> {
    const registry = coreHost().assetRegistry;
    if (!registry) return {};
    const records = await registry.list({ userId, projectId }).catch(() => []);
    return { registry: { records, remember: (fresh) => registry.remember({ userId, projectId }, fresh) } };
  }

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
    return { theme, ctx, branding, visuals: brand.visuals || [], otherVideos: brand.videos || [], anonymous, brandMedia: brand.media || [] };
  }

  /**
   * Les images de la marque décrites pour les agents (captures du site et du produit, photos) ;
   * les descriptions nouvelles sont gardées par l'hôte (une seule lecture par la vision par image).
   */
  private async brandMedia(userId: string, projectId: string, raw: { url: string; kind?: 'screen' | 'photo'; note?: string }[], uploads: VideoMediaAsset[]): Promise<BrandMediaItem[]> {
    const items = [...uploads.filter((m) => m.kind === 'image').map((m) => ({ url: m.url, kind: 'photo' as const, note: m.name ? `photo provided by the client: ${m.name}` : undefined })), ...raw];
    const seen = new Set<string>();
    const unique = items.filter((m) => !seen.has(m.url) && seen.add(m.url));
    if (!unique.length) return [];
    const described = await describeBrandMedia(unique, 10);
    const fresh = Object.fromEntries(described.filter((d) => raw.some((r) => r.url === d.url && !r.note)).map((d) => [d.url, `${d.kind === 'screen' ? 'screenshot' : 'photo'}: ${d.note.replace(/^(screenshot|photo)\s*:\s*/i, '')}`]));
    if (Object.keys(fresh).length) await this.communication.saveMediaNotes?.(userId, projectId, fresh).catch(() => undefined);
    return described;
  }

  // ── « Améliorer ma demande » ─────────────────────────────────────────────

  /** Réécrit la demande de l'utilisateur, dans le contexte de la marque et de sa DA (gratuit). */
  async enhanceRequest(userId: string, projectId: string, text: string, media: VideoMediaAsset[] = []): Promise<{ prompt: string; source: 'llm' | 'template' }> {
    // Un scénario écrit scène par scène ne se « réécrit » pas : ses textes et son minutage sont la demande.
    if (parseRequest(String(text || '')).mode === 'script') return { prompt: String(text).trim().slice(0, MAX_REQUEST_CHARS), source: 'template' };
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
      // La demande entière (personnes, lieux, gestes, interdits), pas son résumé de 400 signes.
      brief: brief.request || `${brief.message}\n${brief.details || ''}`,
      ...(brief.spec?.cast ? { cast: brief.spec.cast } : {}),
      ...(negativeCues(brief.spec) ? { avoid: negativeCues(brief.spec) } : {}),
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
      ...(brief.spec?.cast ? { cast: brief.spec.cast } : {}),
      ...(await this.registryFor(opts.userId, opts.projectId)),
      onProgress: (done, total, last) => opts.onProgress?.({ done, total, ...(last ? { last } : {}) }),
    });
    Object.assign(report, sourced.report);
    return { assets: [...own, ...sourced.assets], sceneMedia: sceneMediaOf(assigned, sourced.byNeed), report, run };
  }

  /**
   * LES MÉDIAS D'UN FILM DÉCOUPÉ (scénario de l'utilisateur ou film d'auteur) : pour chaque plan,
   * l'outil que son support demande —
   *   plan filmé  clip généré (sa description, le même personnage, la lumière commune, les interdits
   *               de la demande), sinon vidéo libre, sinon photo animée ;
   *   photo       image générée, sinon photo libre, sinon photo de la marque ;
   *   interface   la capture de la marque qui correspond (décrite par la vision), sinon dessinée ;
   *   « média n » la photo ou la capture de la marque désignée par le directeur.
   * Les clips importés par l'utilisateur passent d'abord, sur les plans filmés, dans l'ordre.
   */
  private async produceShotMedia(o: {
    userId: string;
    projectId: string;
    videoId: string;
    brief: VideoBrief;
    shots: { medium?: string; footage?: string; query?: string; duration: number; hint?: string; media?: number; props?: string[] }[];
    cast?: string;
    look?: string;
    avoid?: string;
    described: BrandMediaItem[];
    orientation: Orientation;
    ctx: CopyContext;
    clipQuality: 'speed' | 'quality';
    artModifier?: string;
    onProgress?: (data: Record<string, unknown>) => void;
  }): Promise<{ assets: VideoMediaAsset[]; sceneMedia: Record<number, SceneMedia>; report: MediaReport }> {
    const { brief, shots, described } = o;
    const sceneMedia: Record<number, SceneMedia> = {};
    const assets: VideoMediaAsset[] = [...(brief.media || [])];
    const report: MediaReport = { stockPhotos: 0, stockVideos: 0, generatedImages: 0, generatedVideos: 0, failedAttempts: 0, fromVisuals: 0, fromBrand: 0, planned: 0 };
    const ownVideos = (brief.media || []).filter((m) => m.kind === 'video');
    let ownAt = 0;
    const usedBrand = new Set<string>();
    const english = (t: string) => /\b(?:the|and|with|of|in|a|an|on|at)\b/i.test(t);
    const plans: ShotPlan[] = [];
    shots.forEach((sh, i) => {
      // Le média que le directeur désigne (photo ou capture de la marque, import).
      const named = sh.media ? described[sh.media - 1] : undefined;
      if (sh.medium === 'footage' && ownAt < ownVideos.length) {
        sceneMedia[i] = { video: ownVideos[ownAt++].url };
        return;
      }
      if (sh.medium === 'footage' || sh.medium === 'photo') {
        const what = cleanText(sh.footage || '', 230);
        const prompt = [what, o.cast ? `The same person in every shot: ${cleanText(o.cast, 110)}` : '', o.avoid].filter(Boolean).join('. ');
        const base = sh.query || (english(what) ? what.split(/[,.;]/)[0].split(/\s+/).filter((w) => w.length > 3).slice(0, 4).join(' ') : '') || [o.ctx.businessType, 'people'].filter(Boolean).join(' ');
        plans.push({ scene: i, sceneId: 'footage', kind: sh.medium === 'footage' ? 'video' : 'image', slot: 0, texts: [], shot: prompt || what || base, query: stockQuery(base, o.cast), durationSec: sh.duration });
        return;
      }
      if (named) {
        sceneMedia[i] = { image: named.url };
        usedBrand.add(named.url);
        report.fromBrand = (report.fromBrand || 0) + 1;
      }
    });
    // Les plans d'interface sans capture désignée : la capture de la marque qui leur correspond le mieux.
    // Une interface que la demande DÉCRIT avec ses mots (un dossier et ses fichiers, une saisie) se
    // dessine avec eux : aucune capture ne la remplace d'office.
    const screenAt = shots.map((sh, i) => (sh.medium === 'screen' && !sceneMedia[i] && !sh.props?.length ? i : -1)).filter((i) => i >= 0);
    const free = described.filter((m) => !usedBrand.has(m.url));
    pickScreens(screenAt.map((i) => shots[i].hint || shots[i].footage || ''), free).forEach((m, k) => {
      if (!m) return;
      sceneMedia[screenAt[k]] = { image: m.url };
      report.fromBrand = (report.fromBrand || 0) + 1;
    });
    if (plans.length && (brief.allowGenerate !== false || brief.allowStock !== false)) {
      report.planned = plans.length;
      o.onProgress?.({ planned: plans.length, look: o.look, source: 'director' });
      const sourced = await sourceShots({
        direction: { look: o.look || 'natural light, true colours, shallow depth of field, premium commercial cinematography', shots: plans, source: 'llm' },
        orientation: o.orientation,
        storage: this.mediaStorage(),
        folder: `users/${o.userId}/projects/${o.projectId}/videos/${o.videoId}/media`,
        allowGenerate: brief.allowGenerate !== false,
        allowStock: brief.allowStock !== false,
        artModifier: o.artModifier,
        clipQuality: o.clipQuality,
        visualPhotos: [],
        cast: o.cast,
        ...(await this.registryFor(o.userId, o.projectId)),
        onProgress: (done, total, last) => o.onProgress?.({ done, total, ...(last ? { last } : {}) }),
      });
      Object.assign(report, { ...sourced.report, fromBrand: report.fromBrand, planned: report.planned });
      for (const [plan, asset] of sourced.byNeed) sceneMedia[plan.scene] = asset.kind === 'video' ? { video: asset.url } : { image: asset.url };
      assets.push(...sourced.assets);
    }
    // Un plan filmé resté vide prend une photo de la marque (jamais une capture d'écran) plutôt que rien.
    const photos = described.filter((m) => m.kind === 'photo' && !usedBrand.has(m.url));
    plans.forEach((plan) => {
      if (sceneMedia[plan.scene] || !photos.length) return;
      const photo = photos.shift()!;
      sceneMedia[plan.scene] = { image: photo.url };
      report.fromBrand = (report.fromBrand || 0) + 1;
    });
    // Les images de la marque montrées comptent parmi les médias de la vidéo (crédits, retouches).
    for (const m of described) if (Object.values(sceneMedia).some((x) => x.image === m.url) && !assets.some((a) => a.url === m.url)) assets.push({ id: `brand-${assets.length}`, kind: 'image', url: m.url, origin: 'visual', name: m.note.slice(0, 80) });
    return { assets, sceneMedia, report };
  }

  /** Les médias d'un scénario découpé par le code (crans Low à Max). */
  private acquireScriptMedia(o: {
    userId: string;
    projectId: string;
    videoId: string;
    brief: VideoBrief;
    shots: ScriptShot[];
    spec: RequestSpec;
    described: BrandMediaItem[];
    orientation: Orientation;
    ctx: CopyContext;
    clipQuality: 'speed' | 'quality';
    artModifier?: string;
    onProgress?: (data: Record<string, unknown>) => void;
  }) {
    return this.produceShotMedia({
      ...o,
      shots: o.shots.map((sh) => ({ medium: sh.medium, footage: sh.footage, query: sh.query, duration: sh.duration, hint: sh.hint, props: sh.props })),
      cast: o.spec.cast,
      look: o.spec.look,
      avoid: negativeCues(o.spec),
    });
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
    /** La voix off écrite par l'utilisateur (index de scène → ligne) : dite mot pour mot, sans agent. */
    scripted?: Record<number, string>;
    /** Seules ces scènes sont dites (retouche) ; le narrateur lit quand même tout le film. */
    only?: number[];
  }): Promise<{ voice: Omit<VideoVoice, 'lines'>; lines: { index: number; text: string; url: string; durationSec: number }[]; run?: AgentRun }> {
    const base = { enabled: true, language: opts.language.slice(0, 5), persona: 'warm', provider: 'openrouter' as const, model: '', voice: '', source: 'heuristic' as const };
    if (!speechAvailable()) return { voice: { ...base, enabled: false, unavailable: 'no_speech_model' }, lines: [] };
    const personas = personaMenu(opts.style, opts.seed);
    const { narration, run } = opts.scripted
      ? { narration: { lines: opts.scripted, persona: personas[0].id, source: 'llm' } as Narration, run: undefined as AgentRun | undefined }
      : await runNarrator(opts.writer, {
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
    if (opts.only) narration.lines = Object.fromEntries(Object.entries(narration.lines).filter(([i]) => opts.only!.includes(Number(i))));
    const persona = personaById(narration.persona);
    // Le temps d'une ligne : sa scène et les plans muets qui la suivent (une ligne du scénario
    // couvre toute sa scène, même découpée en plusieurs plans).
    const voiced = new Set(Object.keys(narration.lines).map(Number));
    const span = (i: number) => {
      let d = opts.scenes[i].duration;
      for (let j = i + 1; j < opts.scenes.length && !voiced.has(j); j++) d += opts.scenes[j].duration;
      return d;
    };
    try {
      const said = await synthesizeVoice({
        lines: Object.entries(narration.lines).map(([i, text]) => ({ index: Number(i), text, maxSec: speakable(opts.scripted ? span(Number(i)) : opts.scenes[Number(i)].duration, Number(i) === 0) * 1.25 })),
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
    keyOf: (index: number) => string | undefined,
    opts: { keepTiming?: boolean } = {}
  ): VideoVoice | undefined {
    if (!narrated) return undefined;
    const lines = narrated.lines
      .map((l) => ({ sceneKey: keyOf(l.index) || '', text: l.text, url: l.url, durationSec: l.durationSec, offset: 0 }))
      .filter((l) => l.sceneKey);
    const voice: VideoVoice = { ...narrated.voice, lines };
    if (!voice.enabled) return voice;
    if (!lines.length) return { ...voice, enabled: false, unavailable: voice.unavailable || 'no_lines' };
    const fitted = fitScenesToVoice(storyboard, voice, opts);
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
    let objectiveGiven = VIDEO_OBJECTIVES.includes(input.brief?.objective as VideoObjective);
    const { theme, ctx, branding, visuals, otherVideos, anonymous, brandMedia } = await this.brandContext(userId, projectId);
    // La DA de la charte, traduite en paramètres de motion (directions, casse, rythme, couleur, décor).
    const art = motionFromArtDirection(branding?.artDirection);

    const videoId = `video-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
    const seed = crypto.randomInt(1, 2 ** 31 - 1);
    // La jauge de créativité : ce que l'IA décide à ce cran (cf. CREATIVITY.md). En dessous,
    // le graphe et les mises en page éprouvées décident — toujours à partir de la charte et de sa DA.
    const creativity: CreativityLevel = normalizeCreativity(input.creativity);
    const aiFrom = (min: CreativityLevel) => atLeast(creativity, min);
    const orientation = orientationOf(scope.formats[0]);

    // 0. LA DEMANDE LUE EN ENTIER (video.request.ts) : langue (celle que l'utilisateur écrit, pas celle
    //    de la page), scénario scène par scène, textes mot pour mot, consignes, supports de chaque
    //    scène. Le lecteur IA complète le code dès Medium (au cran Ultra, le directeur s'en charge).
    emit('plan', 'running', { stage: 'read' });
    const read = brief.spec
      ? { spec: brief.spec, tokens: { input: 0, output: 0 }, ms: 0, source: 'parser' as const }
      : await readRequest(brief.request || brief.message, {
          fallbackLanguages: [input.language, ctx.language],
          writer: aiFrom('medium') && creativity !== 'ultra' && !input.reference ? this.writerFor(userId, tierFor(creativity, 'copy')) : undefined,
        });
    const spec: RequestSpec = { ...read.spec, language: brief.language || read.spec.language };
    brief.spec = spec;
    ctx.language = spec.language;
    // La musique décrite par l'utilisateur, sa voix off (voulue ou refusée en toutes lettres).
    if (brief.musicMood === 'auto' && spec.musicMood) brief.musicMood = spec.musicMood;
    if (spec.voiceOver === 'none') brief.voice = false;
    else if (spec.voiceOver === 'wanted') brief.voice = true;
    const readerRun: AgentRun | undefined = read.source === 'reader' || read.tokens.input ? { agent: 'reader', source: read.source === 'reader' ? 'llm' : 'graph', tokens: read.tokens, ms: read.ms, kept: read.source === 'reader' ? 1 : 0 } : undefined;
    // L'INTENTION (video.intent.ts) : objectif, mode de production, langage de motion — lus par le code dans
    // la demande, le scénario et les médias, affinés par un agent si la lecture est peu sûre (High+), corrigés
    // par l'utilisateur s'il a revu l'interprétation. Elle choisit ce que l'utilisateur n'a pas imposé.
    const intent = await this.readIntent(userId, input, brief, spec, brandMedia, creativity);
    brief.intent = intent;
    if (!objectiveGiven && intent.decided.objective !== 'auto') {
      brief.objective = intent.legacy.objective;
      objectiveGiven = true;
    }
    if (!isMotionDirection(brief.direction) && intent.legacy.direction) brief.direction = intent.legacy.direction;
    if (intent.voiceover === 'yes' && input.brief?.voice === undefined) brief.voice = true;
    logger.info('video.intent', { projectId, objective: intent.objective, modes: intent.productionModes, motion: intent.motionDirection, decided: intent.decided, confidence: intent.confidence, pipeline: intent.pipeline, type: intent.legacy.type, source: intent.source });
    // Le scénario de l'utilisateur est suivi tel quel (sauf une vidéo modèle, qui impose ses plans).
    const script = spec.mode === 'script' && spec.scenes.length >= 2 && !input.reference ? spec : undefined;
    const facts = extractFacts(brief.request || `${brief.message}\n${brief.details || ''}`);
    logger.info('video.request_read', { projectId, language: spec.language, languageSource: spec.languageSource, mode: spec.mode, scenes: spec.scenes.length, texts: spec.scenes.reduce((n, sc) => n + sc.texts.length, 0), media: spec.scenes.map((sc) => sc.media.join('+')).join(' | '), unsupported: spec.unsupported, source: read.source });
    emit('plan', 'running', { stage: 'read', language: spec.language, script: script ? script.scenes.length : 0, texts: spec.scenes.reduce((n, sc) => n + sc.texts.length, 0) });

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
    // Un type imposé l'emporte ; sinon celui que l'intention traduit — seulement si elle a réellement décidé
    // la matière ou le mouvement (médias, consigne, scénario). Une lecture qui n'a rien appris n'impose rien :
    // le planificateur créatif choisit, comme avant.
    const intentDecided = intent.decided.productionModes !== 'auto' || intent.decided.motionDirection === 'explicit';
    const requested = VIDEO_TYPES.includes(input.type as VideoType) ? (input.type as VideoType) : intentDecided && intent.legacy.type !== 'auto' && intent.confidence >= 0.4 ? intent.legacy.type : null;
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

    // Crans High, Max, Ultra : le FILM D'AUTEUR — l'IA invente et crée tout (video.author.ts), avec les
    // moyens du cran (`AUTHOR_MEANS`). Si le directeur échoue deux fois, la création continue par le pipeline
    // des menus, au même cran — et ce repli est DIT : gardé avec la vidéo, journalisé, montré en progression.
    let authorFallback: string | undefined;
    if (creativity === 'high' || creativity === 'max' || creativity === 'ultra') {
      const authored = await this.createAuthoredVideo({ userId, projectId, input, scope, brief, theme, ctx, branding, visuals, otherVideos, art, videoId, seed, direction, orientation, facts, paidCredits, requested, emit, creative: brief0, startedAt, anonymous, spec, brandMedia, level: creativity }).catch((error: any) => {
        logger.warn('video.authored_failed', { projectId, creativity, error: error?.message });
        authorFallback = `film d'auteur impossible (${String(error?.message || 'erreur').slice(0, 120)}) : pipeline des menus`;
        return null;
      });
      if (authored) return authored;
      authorFallback ??= "le directeur n'a pas livré de film utilisable : pipeline des menus";
      emit('direction', 'done', { fallback: true });
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
    // Un SCÉNARIO de l'utilisateur : ses scènes deviennent les plans (découpés par le code, un par
    // support), ses textes les cases — ni stratège, ni rédacteur : rien n'est inventé.
    const describedMedia = script ? await this.brandMedia(userId, projectId, brandMedia, brief.media || []) : [];
    const scriptShots: ScriptShot[] | null = script
      ? planScriptShots(script, scope.durationSec, { maxClips: clipCap(brief), hasScreens: describedMedia.some((m) => m.kind === 'screen'), brandName: theme.brandName })
      : null;
    const plan = scriptShots
      ? scriptPlan(scriptShots, brief, spec)
      : await planCreative(
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
    // (Un scénario garde exactement ses scènes : « ne pas ajouter de scènes ».)
    let sceneIds = plan.scenes;
    // Sans marque, pas de scène « logo » : il n'y a ni logo ni nom à signer.
    if (!script && anonymous && sceneIds.length > 2) sceneIds = sceneIds.filter((id) => id !== 'logo');
    if (!refPlan && !script && ['promotion', 'event', 'opening', 'product', 'recruitment'].includes(plan.objective) && scope.durationSec >= 15 && !sceneIds.some((id) => id === 'cta' || id === 'offer' || id === 'event')) {
      sceneIds = ensureScenes(sceneIds, ['cta'], scope.durationSec);
    }
    // Une demande sans scénario qui DÉCRIT des personnes, des lieux ou des gestes (« un jeune
    // entrepreneur qui travaille sur son ordinateur ») appelle un plan filmé : le bon outil, pas
    // seulement de la typographie — quand un clip peut être généré ou trouvé, et sauf type imposé.
    if (!refPlan && !script && (!requested || requested === 'mix') && scope.durationSec >= 10 && !sceneIds.includes('footage') && clipCap(brief) > 0 && describesFilmedAction(brief.request || brief.message)) {
      sceneIds = ensureScenes(sceneIds, ['footage'], scope.durationSec);
      if (anonymous && sceneIds.length > 2) sceneIds = sceneIds.filter((id) => id !== 'logo');
    }
    const storylineTokens = plan.tokens;
    const typeDef = TYPE_DEFS[type];
    const creative = withStrategy(brief0, plan.strategy);
    const accentEffect = pickAccentEffect(direction, seed, art.boosts);

    // Le langage de mouvement (effets sonores, ambiance musicale) suit la direction, sauf choix explicite.
    const style = brief.style && brief.style !== 'auto' ? resolveStyle(brief.style, undefined, brief.objective) : styleOfDirection(direction);
    emit('plan', 'done', { type, objective: brief.objective, concept: plan.concept, rhythm: plan.rhythm, accent: accentEffect, style, direction, scenes: sceneIds, durationSec: scope.durationSec, source: plan.source, language: spec.language, ...(script ? { script: script.scenes.length } : {}), creative: { strategy: creative.strategy.label, exploration: creative.strategy.exploration } });
    const wanted = mediaWanted(sceneIds);
    const needsStock = (wanted.images > own('image') || wanted.videos > own('video')) && (brief.allowStock || brief.allowGenerate);

    // 2. Copie (un appel) : textes + mots-clés de recherche des médias.
    emit('copy', 'running');
    // Le graphe donne au modèle un vocabulaire court de concepts d'icônes (scène « avantages » seulement).
    const vocabText = [brief.message, brief.details, ctx.businessType, ...(ctx.keywords || [])].filter(Boolean).join(' ');
    const copy = scriptShots
      ? { copy: Object.fromEntries(scriptShots.map((sh, i) => [i + 1, { ...sh.slots }])) as Record<number, Record<string, string>>, dropped: [] as number[], source: 'heuristic' as const, tokens: { input: 0, output: 0 } }
      : await writeCopy(sceneIds, brief, ctx, this.writerFor(userId, tierFor(creativity, 'copy')), {
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
      ...(readerRun ? [readerRun] : []),
      ...(script ? [] : [{ agent: 'strategist', source: plan.source, tokens: storylineTokens, ms: 0 } as AgentRun, { agent: 'writer', source: copy.source === 'llm' ? 'llm' : 'graph', tokens: copy.tokens, ms: 0 } as AgentRun]),
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
    const plannedDurations = scriptShots ? scriptShots.map((sh) => sh.duration) : allocateDurations(sceneIds, sceneIds.map((_, i) => copy.copy[i + 1] || {}), scope.durationSec);
    const [media, music, sfx, narrated] = await Promise.all([
      (scriptShots
        ? this.acquireScriptMedia({
            userId,
            projectId,
            videoId,
            brief,
            shots: scriptShots,
            spec,
            described: describedMedia,
            orientation,
            ctx,
            clipQuality: aiFrom('high') ? 'quality' : 'speed',
            artModifier: branding?.artDirection?.imagePromptModifier,
            onProgress: (data) => emit('media', 'running', { query, wanted, ...data }),
          })
        : this.acquireMedia({
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
          })
      ).then((m) => {
        const run = (m as { run?: AgentRun }).run;
        if (run) agentRuns.push(run);
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
        brandText: [spec.music, ctx.tone, ctx.valueProposition, ctx.businessType, ...(ctx.keywords || []), brief.message].filter(Boolean).join(' '),
        pick: async (tracks, mood) => {
          const res = await runSoundDesigner(soundWriter, { sheet, request: `${spec.music ? `MUSIC WANTED BY THE CLIENT: ${spec.music}. ` : ''}${brief.message} ${brief.details || ''}`, rhythm: plan.rhythm, mood, durationSec: scope.durationSec, tracks });
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
            language: spec.voiceLanguage || brief.language || ctx.language,
            brandName: theme.brandName,
            sheet,
            brief: brief.request || `${brief.message}\n${brief.details || ''}`,
            facts,
            style,
            seed,
            scenes: planned.map((p, i) => ({ ...p, duration: plannedDurations[i] })),
            writer: contentWriter,
            // La voix off que l'utilisateur a écrite est dite mot pour mot, sur le premier plan de sa scène.
            scripted: scriptShots ? scriptedVoice(scriptShots, spec) : undefined,
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
      // Scénario : un plan filmé resté sans image (génération et banques en échec) devient du motion
      // design s'il porte un texte ; sans texte, son temps revient aux autres plans de sa scène.
      if (scriptShots && id === 'footage' && !media.sceneMedia[i]?.video && !media.sceneMedia[i]?.image) {
        if (!Object.keys(slotsByIndex[i]).length) return;
        return void kept.push({ id: 'statement', slots: slotsByIndex[i], from: i });
      }
      kept.push({ id, slots: slotsByIndex[i], from: i });
    });
    // Trop peu de scènes pour la durée (le modèle en a laissé de côté) : des scènes de texte tirées
    // du brief les remplacent, pour que chaque scène garde un temps de lecture juste (video.rules.ts).
    // (Une vidéo modèle garde ses plans, un scénario ses scènes : on ne leur ajoute rien.)
    if (!refPlan && !scriptShots) {
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
    // Le scénario : chaque plan prend SA durée (celle de sa scène, partagée entre ses plans ; le temps
    // d'un plan retiré revient aux autres plans de la même scène), sa scène et son support.
    if (scriptShots) {
      const perScene = new Map<number, number>();
      scriptShots.forEach((sh) => perScene.set(sh.scene, (perScene.get(sh.scene) || 0) + sh.duration));
      const keptPerScene = new Map<number, number>();
      kept.forEach((k) => keptPerScene.set(scriptShots[k.from].scene, (keptPerScene.get(scriptShots[k.from].scene) || 0) + scriptShots[k.from].duration));
      let start = 0;
      storyboard.scenes.forEach((sc, i) => {
        const shot = scriptShots[kept[i].from];
        const scale = (perScene.get(shot.scene) || shot.duration) / (keptPerScene.get(shot.scene) || shot.duration);
        const duration = Math.round(shot.duration * scale * 1000) / 1000;
        sc.start = Math.round(start * 1000) / 1000;
        sc.duration = duration;
        start += duration;
        sc.script = { scene: shot.scene, medium: shot.medium };
        if (shot.props?.length) sc.props = shot.props;
        if (shot.surface) sc.surface = shot.surface;
      });
      const lastScene = storyboard.scenes[storyboard.scenes.length - 1];
      if (lastScene) lastScene.duration = Math.round((scope.durationSec - lastScene.start) * 1000) / 1000;
    }
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
    let qa = applyRules(storyboard, { objective: brief.objective, preserve: !!scriptShots });

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
      qa = applyRules(storyboard, { objective: brief.objective, preserve: !!scriptShots });
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
    const voice = this.attachVoice(storyboard, narrated, (index) => sceneKeyOf.get(index), { keepTiming: !!scriptShots });

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

    // Un scénario : les fonds qu'il demande en toutes lettres (« écran noir ») et ses plans filmés grands
    // l'emportent sur les choix des agents et des contrôles (réappliqués en dernier).
    if (scriptShots) {
      storyboard.scenes.forEach((sc, i) => {
        const shot = scriptShots[kept[i]?.from ?? -1];
        if (shot?.surface) sc.surface = shot.surface;
        // La phrase de l'utilisateur reste le titre : pas de mise en page qui la réduit à un mot ou la fait défiler.
        if (sc.layout && VERBATIM_UNSAFE.has(sc.layout)) sc.layout = 'classic';
      });
      keepFootageLarge(storyboard);
    }
    // Le film comparé à la demande : scènes, textes mot pour mot, minutage, plans filmés, langue.
    // Le plan de médias du livrable : la provenance de chaque média, gardée avec le film.
    if (media.report.assets?.length) storyboard.assetPlan = media.report.assets;
    storyboard.fidelity = checkFidelity(spec, storyboard, {
      brandName: theme.brandName,
      total: scope.durationSec,
      originOf: (url) => media.assets.find((a) => a.url === url)?.origin,
      blocked: media.report.blocked,
      voice: { requested: !!brief.voice, language: spec.language, enabled: voice?.enabled },
    });

    const now = new Date().toISOString();
    const hook = (script && spec.title ? titleCase(spec.title) : '') || storyboard.scenes.find((sc) => sc.slots.title)?.slots.title || brief.message;
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
      fidelity: { notes: storyboard.fidelity.notes, codes: storyboard.fidelity.codes },
      kit: { logo: kit.logo, background: kit.background, annotate: kit.annotate, iconSet: kit.iconSet, addons: kit.addons },
      novelty: { verdict: novelty.verdict, nearest: novelty.nearest },
    });
    // Le repli du film d'auteur (High+) est gardé avec la vidéo, avant son enregistrement.
    if (authorFallback) video.storyboard.authorFallback = authorFallback;
    // L'enregistrement de la génération (format commun aux documents) : gardé avec la vidéo, résumé au journal.
    video.record = recordFromVideo(video, Date.now() - startedAt);
    logger.info('generation.record', recordSummary(video.record));
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
      fidelity: { mode: storyboard.fidelity.mode, language: spec.language, texts: storyboard.fidelity.texts, footage: storyboard.fidelity.footage, drift: storyboard.fidelity.drift, notes: storyboard.fidelity.notes.length },
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
    /** La demande lue (video.request.ts) : langue, scénario, consignes, supports. */
    spec: RequestSpec;
    /** Les images propres à la marque (captures du site et du produit, photos). */
    brandMedia: { url: string; kind?: 'screen' | 'photo'; note?: string }[];
    /** Le cran (High, Max, Ultra) : il règle les moyens du film, jamais sa liberté. */
    level: 'high' | 'max' | 'ultra';
  }): Promise<MotionVideo | null> {
    const { userId, projectId, scope, brief, theme, ctx, branding, otherVideos, art, videoId, seed, direction, emit, creative, spec } = o;
    const agentRuns: AgentRun[] = [];
    const sheet = brandSheet({ ctx, palette: theme.palette, fonts: theme.fonts, art: branding?.artDirection });
    const briefText = brief.request || `${brief.message}\n${brief.details || ''}`;
    const style = brief.style && brief.style !== 'auto' ? resolveStyle(brief.style, undefined, brief.objective) : styleOfDirection(direction);
    // Le scénario de l'utilisateur, suivi tel quel (sauf une vidéo modèle, qui impose ses plans).
    const script = spec.mode === 'script' && spec.scenes.length >= 2 && !o.input.reference ? spec : undefined;
    const timeline = script ? sceneTimeline(script, scope.durationSec) : undefined;
    const constraints = specConstraints(spec);
    const contentWriter = this.writerFor(userId, 'writing');

    // 1. Ce qui existe déjà : les images PROPRES à la marque (captures du site et du produit,
    //    photos, imports), décrites pour le directeur. Le reste se produit APRÈS, plan par plan,
    //    pour ce que le directeur aura décidé — plus de photos génériques choisies d'avance.
    emit('media', 'running', { stage: 'brand' });
    const described = await this.brandMedia(userId, projectId, o.brandMedia, brief.media || []);

    // 2. Le directeur conçoit le film (deux tentatives) ; le code le valide. Avec un scénario, il le
    //    DÉCOUPE : mêmes scènes, même minutage, textes mot pour mot, l'outil de chaque plan.
    emit('direction', 'running', { script: script ? script.scenes.length : 0 });
    const directorInput: DirectorInput = {
      brief: { message: brief.message, details: brief.details, objective: brief.objective },
      briefText,
      facts: o.facts,
      sheet,
      direction,
      durationSec: scope.durationSec,
      formats: scope.formats,
      // Une vidéo modèle fixe le nombre de plans ; un scénario, au moins une par scène.
      range: o.input.reference ? referenceRange(o.input.reference.shots.length, scope.durationSec) : script ? [script.scenes.length, Math.min(18, script.scenes.length * 3)] : sceneRange(scope.durationSec),
      media: described.map(brandMediaLine),
      brandName: theme.brandName,
      language: brief.language || ctx.language || 'fr',
      recentConcepts: otherVideos.map((v) => v.storyboard?.authored?.concept || v.storyboard?.concept).filter(Boolean) as string[],
      // L'univers créatif au lieu de la documentation du moteur : motifs possibles, ce qui a servi,
      // ce qui reste sous-exploré, des combinaisons à explorer, l'ADN et l'accent suggérés.
      universe: creativeUniverse(creative, { photos: described.length }).text,
      ...(o.input.reference ? { reference: blueprintForDirector(o.input.reference, scope.durationSec) } : {}),
      ...(script && timeline ? { script, timeline } : {}),
      ...(constraints ? { constraints } : {}),
      maxFootage: clipCap(brief),
    };
    const means = AUTHOR_MEANS[o.level];
    const director = this.writerFor(userId, means.director, 'video.director');
    let film: AuthoredFilm | undefined;
    for (let attempt = 0; attempt < 2 && !film && director; attempt++) {
      const prompt = buildDirectorPrompt(directorInput);
      const started = Date.now();
      const retry = script
        ? `\n\nYour previous answer could not be used: follow the OUTPUT format exactly — every SCENE of the SCRIPT, in order, each SHOT line with its scene and medium, and the on-screen texts on TEXT lines, verbatim.`
        : `\n\nYour previous answer could not be used: follow the OUTPUT format exactly, with ${directorInput.range[0]} to ${directorInput.range[1]} shots and a TITLE on every shot but the signature.`;
      const raw = await director(prompt.system, attempt ? `${prompt.user}${retry}` : prompt.user).catch(() => '');
      film = parseFilm(raw, directorInput);
      agentRuns.push({ agent: 'director', source: film ? 'llm' : 'graph', tokens: { input: Math.round((prompt.system.length + prompt.user.length) / 4), output: Math.round(raw.length / 4) }, ms: Date.now() - started, kept: film ? 1 : 0 });
    }
    if (!film) {
      emit('direction', 'done', { fallback: true });
      return null;
    }
    // Sans marque, le plan de signature (logo) disparaît ; les autres s'allongent d'autant (jamais dans un scénario).
    if (!script && o.anonymous && film.shots.length > 2 && film.shots.some((sh) => sh.kind === 'logo')) {
      const kept = film.shots.filter((sh) => sh.kind !== 'logo');
      const total = film.shots.reduce((sum, sh) => sum + sh.duration, 0);
      const keptTotal = kept.reduce((sum, sh) => sum + sh.duration, 0) || 1;
      film = { ...film, shots: kept.map((sh) => ({ ...sh, duration: Math.round(((sh.duration * total) / keptTotal) * 100) / 100 })) };
    }
    if (film.repairs?.length) logger.info('video.authored.repairs', { projectId, repairs: film.repairs });
    // Le plan de médias du film : le rôle visuel de chaque plan et les sources admises (une interface
    // ne vient que du produit). La résolution, plan par plan, est gardée ensuite dans `assetPlan`.
    logger.info('video.authored.asset_plan', { projectId, assets: filmAssetPlan(film).map((r) => `${r.assetId}:${r.role}<${r.sources.join('|')}>`) });
    emit('direction', 'done', { title: film.title, concept: film.concept, repairs: film.repairs?.length || 0, shots: film.shots.map((sh) => ({ kind: sh.kind, medium: sh.medium, scene: sh.scene, duration: sh.duration, visual: sh.visual.slice(0, 140) })) });

    // 3. Les médias de chaque plan, pendant que la musique, les effets et la voix se préparent :
    //    un clip filmé (même personnage, même lumière), une photo, la capture de la marque voulue.
    const filmed = film.shots.filter((sh) => sh.medium === 'footage' || sh.medium === 'photo').length;
    emit('media', 'running', { planned: filmed, brand: described.length });
    const mediaP = this.produceShotMedia({
      userId,
      projectId,
      videoId,
      brief,
      shots: film.shots.map((sh) => ({ medium: sh.medium, footage: sh.footage, query: sh.query, duration: sh.duration, media: sh.media, props: sh.props, hint: `${sh.visual} ${script && sh.scene != null ? script.scenes[sh.scene]?.description || '' : ''}` })),
      cast: film.cast || spec.cast,
      look: film.look || spec.look,
      avoid: negativeCues(spec),
      described,
      orientation: o.orientation,
      ctx,
      clipQuality: 'quality',
      artModifier: branding?.artDirection?.imagePromptModifier,
      onProgress: (data) => emit('media', 'running', { planned: filmed, ...data }),
    }).then((m) => {
      const shown = Object.values(m.sceneMedia).map((x) => x.video || x.image).filter(Boolean) as string[];
      emit('media', 'done', { ...m.report, items: m.assets.filter((a) => shown.includes(a.url)).slice(0, 8).map((a) => ({ kind: a.kind, origin: a.origin, url: a.kind === 'video' ? a.posterUrl : a.url, credit: a.credit, name: a.name })) });
      return m;
    });

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
      brandText: [spec.music, ctx.tone, ctx.valueProposition, ctx.businessType, ...(ctx.keywords || []), brief.message, film.concept].filter(Boolean).join(' '),
      pick: async (tracks, mood) => {
        const res = await runSoundDesigner(soundWriter, { sheet, request: `${spec.music ? `MUSIC WANTED BY THE CLIENT: ${spec.music}. ` : ''}${brief.message} ${film!.concept}`, rhythm: script && /mont[ée]e|build|crescendo/i.test(spec.music || '') ? 'crescendo' : 'steady', mood, durationSec: scope.durationSec, tracks });
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
    // La voix off, sur les plans du directeur, dans la langue de la demande (ou celle de la voix
    // demandée) ; la voix off écrite par l'utilisateur est dite mot pour mot.
    const voiceLanguage = spec.voiceLanguage || brief.language || ctx.language;
    if (brief.voice) emit('voice', 'running', { language: voiceLanguage });
    const scripted: Record<number, string> = {};
    if (script) script.scenes.forEach((scene, k) => {
      const first = film!.shots.findIndex((sh) => sh.scene === k);
      if (scene.voice.length && first >= 0) scripted[first] = scene.voice.join(' ');
    });
    const voiceP = brief.voice
      ? this.narrate({
          userId,
          projectId,
          videoId,
          language: voiceLanguage,
          brandName: theme.brandName,
          sheet,
          brief: briefText,
          facts: o.facts,
          style,
          seed,
          scenes: film.shots.map((sh) => ({ sceneId: sh.kind, duration: sh.duration, texts: sceneTexts(sh.slots) })),
          writer: contentWriter,
          concept: film.concept,
          ...(Object.keys(scripted).length ? { scripted } : {}),
        }).then((res) => {
          if (res.run) agentRuns.push(res.run);
          emit('voice', 'done', res.voice.enabled ? { lines: res.lines.length, language: res.voice.language, provider: res.voice.provider, persona: res.voice.persona } : { unavailable: res.voice.unavailable });
          return res;
        })
      : Promise.resolve(undefined);
    const [media, music] = await Promise.all([mediaP, musicP]);
    // Un plan filmé resté sans image (génération et banques en échec) devient du motion design : le
    // codeur le compose sans média, et le contrôle de fidélité le dit.
    film = {
      ...film,
      shots: film.shots.map((sh, i) => ((sh.kind === 'footage' && !media.sceneMedia[i]?.video && !media.sceneMedia[i]?.image) ? { ...sh, kind: (sh.slots.l1 ? 'kinetic' : 'statement') as AuthoredFilm['shots'][number]['kind'] } : sh)),
    };

    // 4. Le storyboard aux durées, surfaces et médias du directeur ; coupes franches (chaque plan
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
      delete sc.image;
      delete sc.video;
      const m = media.sceneMedia[i];
      if (m?.video) sc.video = m.video;
      else if (m?.image) sc.image = m.image;
      if (shot.props?.length) sc.props = shot.props;
      if (script && shot.scene != null) sc.script = { scene: shot.scene, medium: shot.medium || 'motion' };
      if (sc.motion) sc.motion = { ...sc.motion, transition: 'cut' as MotionTransition };
      delete sc.accent;
      delete sc.layout;
      if (shot.pattern) sc.pattern = shot.pattern;
    });
    const last = storyboard.scenes[storyboard.scenes.length - 1];
    if (last) last.duration = Math.round((scope.durationSec - last.start) * 1000) / 1000;
    // Les plans durent au moins le temps de leur ligne (sauf un scénario, dont le minutage ne bouge pas) :
    // les codeurs écrivent sur ces durées.
    const voice = this.attachVoice(storyboard, await voiceP, (i) => storyboard.scenes[i]?.key, { keepTiming: !!script });
    const type: VideoType = o.requested ?? 'mix';
    const kctx = this.kitContext({ type, brief, scope, direction, storyboard, theme, branding, ctx, media: media.assets, otherVideos });
    // Le kit ne décore plus rien : l'IA dessine ses fonds et ses annotations. Il garde l'animation
    // du logo et les icônes (repli de la signature, briques du codeur).
    storyboard.kit = { ...resolveKit({ ...kctx, memory: this.kitMemory(creative) }), background: 'none', backdropScenes: [], annotate: 'none', annotateScene: undefined };
    storyboard.kit.icons = {};
    // Les plans filmés restent grands dans leur composition de repli (jamais dans les lettres ou une capsule).
    keepFootageLarge(storyboard, (sc) => sc.sceneId === 'footage');

    // 5. Chaque plan écrit par un codeur IA, rendu, contrôlé, critiqué, corrigé.
    emit('shots', 'running', { total: storyboard.scenes.length, done: 0, coded: 0 });
    const orchestrator = new CreativeOrchestrator({ level: o.level, call: this.coderCallFor(userId, projectId) });
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
      critic: means.critic ? this.visionCritic : undefined,
      rounds: means.rounds,
      // Les consignes de l'utilisateur, pour chaque codeur et pour la critique visuelle.
      ...(constraints ? { constraints } : {}),
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
    // Un plan que le codeur n'a pas réussi garde la composition éprouvée de SON support (plan filmé,
    // interface, signature) ; une phrase sans média reçoit une mise en page du catalogue (jamais une
    // simple carte de texte, l'effet « diaporama »).
    if (result.fallback.length) {
      const layouts = assignLayouts(
        storyboard.scenes.map((sc) => ({ sceneId: sc.sceneId, slots: sc.slots, image: sc.image, video: sc.video })),
        { direction, excluded: art.excludedLayouts, boosts: art.boosts, recent: otherVideos.map((v) => (v.storyboard?.scenes || []).map((sc) => sc.layout).filter(Boolean) as string[]), seed }
      );
      storyboard.scenes.forEach((sc, i) => {
        if (!result.fallback.includes(sc.key) || sc.image || sc.video || !LAYOUT_SCENES.has(sc.sceneId)) return;
        if (layouts[i] && layouts[i] !== 'classic' && !(script && VERBATIM_UNSAFE.has(layouts[i]!))) sc.layout = layouts[i];
      });
    }

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
      level: o.level,
      exploration: { budget: creative.budget, experimental: result.explored.length, scenes: film.shots.length - 1 },
      dna: { direction, families: dna },
      strategy: { id: creative.strategy.id, label: creative.strategy.label, source: 'graph' },
      ...(authoredAccent ? { accent: authoredAccent } : {}),
    };
    const lint = creativeLint(storyboard, { direction, memory: creative.memory, transitions: [], repair: false });
    const { index: _nearest, ...novelty } = lint.novelty;
    // High et Max garantissent l'écart avec les vidéos récentes de la marque (Ultra le signale seulement) : un
    // film d'auteur trop proche laisse la place au pipeline des menus, qui le garantit — repli DIT.
    if (o.level !== 'ultra' && novelty.verdict === 'too-close') throw new Error(`film d'auteur trop proche d'une vidéo récente (écart ${novelty.nearest})`);
    storyboard.creative = { ...storyboard.creative, fingerprint: lint.fingerprint, novelty: { ...novelty, target: creative.noveltyTarget, compared: creative.memory.fingerprints.length }, lint: { issues: lint.issues, repaired: [] } };
    storyboard.creative.intent = { ...creativeIntent({ concept: film.concept, strategy: creative.strategy, direction, narrative: lint.fingerprint.narrative, accent: authoredAccent }), concept: film.concept };
    const sfx = await sfxP;
    // Le film comparé à la demande : scènes, textes mot pour mot, minutage, plans filmés, langue.
    // Le plan de médias du livrable : la provenance de chaque média, gardée avec le film.
    if (media.report.assets?.length) storyboard.assetPlan = media.report.assets;
    storyboard.fidelity = checkFidelity(spec, storyboard, {
      brandName: theme.brandName,
      total: scope.durationSec,
      originOf: (url) => media.assets.find((a) => a.url === url)?.origin,
      blocked: media.report.blocked,
      voice: { requested: !!brief.voice, language: voiceLanguage, enabled: voice?.enabled },
    });

    const now = new Date().toISOString();
    const used = new Set(storyboard.scenes.flatMap((sc) => [sc.image, sc.video]).filter(Boolean));
    const video: MotionVideo = {
      id: videoId,
      title: fitLength((script && spec.title ? titleCase(spec.title) : '') || film.title || brief.message, 60),
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
      creativity: o.level,
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
      fidelity: { notes: storyboard.fidelity.notes, codes: storyboard.fidelity.codes },
    });
    // L'enregistrement de la génération (format commun aux documents) : gardé avec la vidéo, résumé au journal.
    video.record = recordFromVideo(video, Date.now() - o.startedAt);
    logger.info('generation.record', recordSummary(video.record));
    await this.communication.saveVideo(userId, projectId, video);
    if (o.input.contentId) await this.communication.linkVideoToContent?.(userId, projectId, o.input.contentId, videoId).catch(() => undefined);
    // La mémoire globale : chaque plan, son motif (ou son exploration), ses tours, son repli, sa critique.
    void this.experience.record({
      level: o.level,
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
      creativity: o.level,
      creative: { strategy: creative.strategy.label, explored: result.explored.length, accent: authoredAccent?.pattern, novelty: novelty.nearest, verdict: novelty.verdict, lint: lint.issues.length },
      patterns: storyboard.scenes.map((sc) => sc.pattern || '-').join(','),
      authored: { title: film.title, concept: film.concept, shots: storyboard.authored.shots, coded: result.coded, fallback: result.fallback, reviewed: result.reviewed, rounds: result.rounds, repairs: film.repairs?.length || 0 },
      fidelity: { mode: storyboard.fidelity.mode, language: spec.language, texts: storyboard.fidelity.texts, footage: storyboard.fidelity.footage, drift: storyboard.fidelity.drift, notes: storyboard.fidelity.notes.length },
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
      /** Voix off d'une scène (clé → ligne dite telle quelle). */
      voiceLines?: Record<string, string>;
      /** Changement visuel d'une scène (clé → demande) : appliqué à son code (video.recode.ts). */
      visual?: Record<string, string>;
    },
    /** Ce qui a vraiment été fait (rempli par la retouche) : la conversation le dit sans l'enjoliver. */
    report?: RevisionReport
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
            // Un texte du scénario de l'utilisateur peut dépasser la case standard : une retouche ne le recoupe pas.
            const value = fitLength(String(edits[def.key] ?? '').replace(/\s+/g, ' ').trim(), scene.script ? Math.max(def.max, 160) : def.max);
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

    // Un film d'auteur (Ultra) garde le minutage et le découpage de son directeur, un scénario celui
    // de l'utilisateur : re-minuter ou réparer par les règles du graphe défairait ce qu'ils ont
    // voulu (les plans codés lisent leurs cases, une retouche de texte s'y affiche telle quelle).
    const scripted = storyboard.scenes.some((sc) => sc.script);
    if (!storyboard.authored && !scripted) {
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
      const language = brief.spec?.voiceLanguage || brief.language || 'fr';
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
          brief: brief.request || `${brief.message}\n${brief.details || ''}`,
          facts: extractFacts(brief.request || `${brief.message}\n${brief.details || ''}`),
          style: storyboard.style,
          seed: storyboard.seed,
          scenes: sb.scenes.map((sc) => ({ sceneId: sc.sceneId, duration: sc.duration, texts: sceneTexts(sc.slots) })),
          writer: this.writerFor(userId, tierFor(normalizeCreativity(current.creativity), 'copy')),
          concept: storyboard.authored?.concept,
        });
        voice = this.attachVoice(sb, narrated, (i) => sb.scenes[i]?.key, { keepTiming: scripted });
        storyboard = sb;
      }
      brief = { ...brief, voice: true };
    } else if (patch.voice === false) brief = { ...brief, voice: false };

    // La voix suit les textes : une ligne demandée est dite telle quelle ; une scène dont les textes
    // ont changé (ou qui vient d'en recevoir) est redite par le narrateur — sauf si la voix off est
    // celle que l'utilisateur a écrite dans son scénario (elle ne bouge que s'il le demande).
    if (voice?.enabled && patch.voice !== true) {
      const indexOf = (key: string) => storyboard.scenes.findIndex((sc) => sc.key === key);
      const verbatim: Record<number, string> = {};
      for (const [key, text] of Object.entries(patch.voiceLines || {})) if (indexOf(key) >= 0) verbatim[indexOf(key)] = text;
      const userVoice = (brief.spec?.scenes || []).some((sc) => sc.voice.length);
      const renarrate = userVoice ? [] : Object.keys(patch.slots || {}).map(indexOf).filter((i) => i >= 0 && !(i in verbatim));
      if (Object.keys(verbatim).length || renarrate.length) {
        const { theme, ctx, branding } = await this.brandContext(userId, projectId);
        const common = {
          userId,
          projectId,
          videoId,
          language: voice.language || brief.spec?.voiceLanguage || brief.language || 'fr',
          brandName: theme.brandName,
          sheet: brandSheet({ ctx, palette: theme.palette, fonts: theme.fonts, art: branding?.artDirection }),
          brief: brief.request || `${brief.message}\n${brief.details || ''}`,
          facts: extractFacts(brief.request || `${brief.message}\n${brief.details || ''}`),
          style: storyboard.style,
          seed: storyboard.seed,
          scenes: storyboard.scenes.map((sc) => ({ sceneId: sc.sceneId, duration: sc.duration, texts: sceneTexts(sc.slots) })),
          concept: storyboard.authored?.concept,
        };
        const said = await Promise.all([
          Object.keys(verbatim).length ? this.narrate({ ...common, scripted: verbatim }) : null,
          renarrate.length ? this.narrate({ ...common, only: renarrate, writer: this.writerFor(userId, tierFor(normalizeCreativity(current.creativity), 'copy')) }) : null,
        ]);
        const fresh = said.flatMap((res) => (res?.voice.enabled ? res.lines : [])).map((l) => ({ sceneKey: storyboard.scenes[l.index]?.key || '', text: l.text, url: l.url, durationSec: l.durationSec, offset: 0 })).filter((l) => l.sceneKey);
        const wanted = new Set([...Object.keys(verbatim).map(Number), ...renarrate].map((i) => storyboard.scenes[i].key));
        const replaced = new Set(fresh.map((l) => l.sceneKey));
        voice = { ...voice, lines: [...voice.lines.filter((l) => !replaced.has(l.sceneKey)), ...fresh] };
        report?.voiced.push(...replaced);
        // Une ligne DEMANDÉE qui n'a pas pu être dite est signalée ; une ligne redite en échec garde l'ancienne.
        for (const key of Object.keys(patch.voiceLines || {})) if (wanted.has(key) && !replaced.has(key)) report?.failed.push({ key, what: 'voice' });
      }
    }

    if (voice?.enabled && voice.lines.length) {
      const fitted = fitScenesToVoice(storyboard, voice, { keepTiming: scripted });
      storyboard = fitted.storyboard;
      voice = fitted.voice;
    }

    // Le rendu est du CODE (plans écrits par l'IA) : une retouche s'applique à ce code. Un texte que
    // le code lit déjà s'affiche tel quel ; un texte qu'il ignore (scène qui était vide) ou une demande
    // visuelle passe par le codeur, contrôlé comme à la création. Refusé : la scène garde son code,
    // ou revient à sa composition éprouvée si l'ancien code ne montrerait pas ses nouveaux textes.
    {
      const changed = new Set(Object.keys(patch.slots || {}));
      const jobs: { key: string; instruction?: string; missing: string[] }[] = [];
      for (const sc of storyboard.scenes) {
        const instruction = patch.visual?.[sc.key];
        const missing = sc.code?.tsx && changed.has(sc.key) ? await unreadSlots(sc.code.tsx, sc.sceneId, sc.slots) : [];
        if (instruction && !canRecode(storyboard, sc.key)) report?.failed.push({ key: sc.key, what: 'visual' });
        else if (instruction || missing.length) jobs.push({ key: sc.key, instruction, missing });
      }
      if (jobs.length) {
        storyboard = { ...storyboard, scenes: storyboard.scenes.map((sc) => ({ ...sc })) };
        const { theme, ctx, branding } = await this.brandContext(userId, projectId);
        const orchestrator = new CreativeOrchestrator({ level: current.creativity === 'high' || current.creativity === 'max' ? current.creativity : 'ultra', call: this.coderCallFor(userId, projectId) });
        const base = storyboard;
        for (const job of jobs) {
          const res = await recodeScene({
            storyboard: base,
            key: job.key,
            instruction: job.instruction,
            sheet: brandSheet({ ctx, palette: theme.palette, fonts: theme.fonts, art: branding?.artDirection }),
            direction: (isMotionDirection(storyboard.direction) ? storyboard.direction : 'editorial') as DirectionId,
            formats: scope.formats,
            compose: async (sb) => composeVideoHtml({ ...(await inlineAssets(sb, theme, 'render')), format: scope.formats[0], quality: 'standard', mode: 'render' }),
            withPage: withRenderPage,
            orchestrator,
          }).catch((error: any) => ({ ok: false, tsx: undefined, issues: [String(error?.message || error)] }));
          const sc = storyboard.scenes.find((x) => x.key === job.key)!;
          if (res.ok && res.tsx) {
            sc.code = { tsx: res.tsx, agent: 'sceneEditor' };
            report?.recoded.push(job.key);
          } else if (job.missing.length) {
            delete sc.code;
            report?.fallback.push(job.key);
            if (job.instruction) report?.failed.push({ key: job.key, what: 'visual' });
          } else report?.failed.push({ key: job.key, what: 'visual' });
          if (!res.ok) logger.info('video.recode_rejected', { videoId, key: job.key, issues: res.issues.slice(0, 5) });
        }
      }
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
      // Le titre d'un scénario est celui que l'utilisateur lui a donné : une retouche de texte ne le remplace pas.
      title: scripted ? v.title : fitLength(storyboard.scenes.find((sc) => sc.slots.title)?.slots.title || v.title, 60),
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
    charge?: RenderCharge,
    opts: {
      /** Seuls ces formats sont rendus ; les MP4 des autres formats sont gardés tels quels. */
      only?: VideoFormat[];
      /** Rendu d'avance (ni compté ni facturé) : cf. `prerender`. */
      prerender?: boolean;
    } = {}
  ): Promise<MotionVideo | null> {
    const current = (await this.communication.listVideos(userId, projectId)).find((v) => v.id === videoId);
    if (!current) return null;
    if (isJobActive(videoId)) throw new VideoInputError('already_rendering');
    const { scope } = this.quoteExport(current, scopeInput);
    const only = opts.only?.filter((f) => scope.formats.includes(f));
    const targets = only?.length ? only : scope.formats;
    const queued: VideoRender[] = targets.map((format) => ({ format, status: 'queued', progress: 0 }));
    // Un export partiel garde les fichiers des autres formats ; un export complet repart de zéro.
    const renders = (keep: VideoRender[]) => (only?.length ? [...keep.filter((r) => !targets.includes(r.format) && scope.formats.includes(r.format)), ...queued] : queued);
    const updated = await this.communication.mutateVideo(userId, projectId, videoId, (v) => ({
      ...v,
      scope,
      status: 'rendering',
      renders: renders(v.renders),
      paidCredits: opts.prerender ? v.paidCredits : Math.max(v.paidCredits, videoCost(scope)),
      updatedAt: new Date().toISOString(),
    }));
    if (!updated) return null;
    const job: RenderJob = { userId, projectId, videoId, charge, paidBefore: current.paidCredits, service: this, formats: targets, ...(opts.prerender ? { prerender: true } : {}) };
    // Un export demandé passe devant les rendus d'avance en attente.
    if (opts.prerender) renderQueue.push(job);
    else {
      const firstPrerender = renderQueue.findIndex((j) => j.prerender);
      renderQueue.splice(firstPrerender < 0 ? renderQueue.length : firstPrerender, 0, job);
    }
    pumpQueue();
    return withLiveProgress(updated);
  }

  /**
   * Rend D'AVANCE le format principal, dès que la vidéo (ou sa retouche) est prête : quand
   * l'utilisateur clique sur « Télécharger », le MP4 est déjà là. Ni compté ni facturé ici : il
   * devient un export au premier téléchargement (`claimRender`), au prix d'un export.
   * Sans effet si le MP4 du format est à jour ou si un rendu de la vidéo est déjà en cours.
   */
  async prerender(userId: string, projectId: string, videoId: string): Promise<void> {
    if (process.env.VIDEO_PRERENDER === '0' || isJobActive(videoId)) return;
    const video = (await this.communication.listVideos(userId, projectId)).find((v) => v.id === videoId);
    const format = video?.scope.formats[0];
    if (!video || !format || video.renders.some((r) => r.format === format && isRenderFresh(video, r))) return;
    await this.startExport(userId, projectId, videoId, video.scope, undefined, { only: [format], prerender: true }).catch((error) => {
      if (!(error instanceof VideoInputError)) logger.warn('video.prerender_failed', { videoId, error: error?.message });
    });
  }

  /**
   * Ce que coûte et ce que demande le téléchargement d'un format :
   *   ready     le MP4 à jour est déjà un export : il se télécharge ;
   *   claim     un rendu d'avance à jour attend : il devient un export (prix d'un export) ;
   *   busy      un rendu de cette vidéo tourne : on attend (progression du format) ;
   *   start     le format est à rendre : export de CE format seul (prix d'un export du périmètre élargi).
   */
  downloadPlan(video: MotionVideo, format: VideoFormat):
    | { state: 'ready' }
    | { state: 'claim'; cost: number }
    | { state: 'busy'; progress: number }
    | { state: 'start'; cost: number; scope: VideoScope } {
    const live = withLiveProgress(video);
    const render = live.renders.find((r) => r.format === format && isRenderFresh(video, r));
    if (render && !render.prerender) return { state: 'ready' };
    if (render?.prerender) return { state: 'claim', cost: exportCost({ paidCredits: video.paidCredits, exportCount: video.exportCount, scope: video.scope, creativity: video.creativity }) };
    if (isJobActive(video.id)) {
      const r = live.renders.find((x) => x.format === format && (x.status === 'rendering' || x.status === 'queued'));
      return { state: 'busy', progress: r?.progress || 0 };
    }
    const scope = { ...video.scope, formats: [...new Set([...video.scope.formats, format])] };
    return { state: 'start', ...this.quoteExport(video, scope) };
  }

  /** Les quatre formats, prêts ou non, et leur prix de téléchargement (affichés dans le menu). */
  downloadOptions(video: MotionVideo): { format: VideoFormat; ready: boolean; cost: number; busy: boolean }[] {
    return VIDEO_FORMATS.map((format) => {
      const plan = this.downloadPlan(video, format);
      return { format, ready: plan.state === 'ready', busy: plan.state === 'busy', cost: plan.state === 'claim' || plan.state === 'start' ? plan.cost : 0 };
    });
  }

  /** Le rendu d'avance devient l'export de l'utilisateur (compté ; payé par l'appelant). */
  async claimRender(userId: string, projectId: string, videoId: string, format: VideoFormat): Promise<boolean> {
    let claimed = false;
    await this.communication.mutateVideo(userId, projectId, videoId, (v) => {
      const target = v.renders.find((r) => r.format === format && r.prerender && isRenderFresh(v, r));
      if (!target) return v;
      claimed = true;
      return {
        ...v,
        exportCount: v.exportCount + 1,
        dirty: false,
        renders: v.renders.map((r) => (r === target ? { ...r, prerender: undefined } : r)),
        updatedAt: new Date().toISOString(),
      };
    });
    return claimed;
  }

  async markExportFailed(job: Pick<RenderJob, 'userId' | 'projectId' | 'videoId' | 'paidBefore' | 'prerender'>): Promise<void> {
    await this.communication.mutateVideo(job.userId, job.projectId, job.videoId, (v) => ({
      ...v,
      // Un rendu d'avance raté ne met pas la vidéo en échec : l'export se fera à la demande.
      status: job.prerender ? (v.renders.some((r) => r.status === 'done') ? 'ready' : 'draft') : 'failed',
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
    await Promise.all(
      voiceTimeline(video.storyboard, video.voice).map(async (line, i) => {
        try {
          const file = path.join(voiceDir, `line-${i}.mp3`);
          await downloadTo(line.url, file);
          voiceFiles.push({ file, at: line.at });
        } catch (error: any) {
          logger.warn('video.voice_download_failed', { videoId, line: i, error: error.message });
        }
      })
    );

    const results: VideoRender[] = [];
    let failed = false;
    const formats = job.formats?.length ? job.formats : video.scope.formats;
    // Les formats se rendent EN MÊME TEMPS, chacun avec sa part des onglets de rendu.
    const share = Math.max(1, Math.floor(renderConcurrency() / formats.length));
    await Promise.all(formats.map(async (format) => {
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
          concurrency: share,
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
          quality: video.scope.quality,
          // La vidéo telle qu'elle était au début du rendu : retouchée entre-temps, le fichier est périmé.
          key: renderSignature(video, format),
          ...(job.prerender ? { prerender: true } : {}),
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
    }));

    fs.rmSync(voiceDir, { recursive: true, force: true });

    const allFailed = results.every((r) => r.status === 'failed');
    if (job.prerender) {
      // Un rendu d'avance ne compte pas comme un export : seul l'état de la vidéo change.
      await this.communication.mutateVideo(userId, projectId, videoId, (v) => ({ ...v, status: v.renders.some((r) => r.status === 'done') ? 'ready' : v.status === 'rendering' ? 'draft' : v.status }));
      return;
    }
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

// ─── Fraîcheur d'un rendu ───────────────────────────────────────────────────

/**
 * La signature de ce qu'un MP4 montre et fait entendre : scènes (textes, médias, code des plans),
 * kit, minutage, musique, effets, voix, format et qualité. Les rapports (créatif, agents, contrôles)
 * n'en font pas partie : les recalculer ne périme pas un fichier.
 */
export function renderSignature(video: MotionVideo, format: VideoFormat, quality: VideoQuality = video.scope.quality): string {
  const { creative: _c, agents: _a, qa: _q, fidelity: _f, ...visible } = video.storyboard as VideoStoryboard & Record<string, unknown>;
  const payload = JSON.stringify({
    format,
    quality,
    storyboard: visible,
    music: video.music ? [video.music.id, video.music.url, video.music.startAt] : null,
    sfx: video.sfx?.enabled ? [video.sfx.intensity || '', Object.values(video.sfx.sounds || {}).map((x) => x?.id)] : null,
    voice: video.voice?.enabled ? video.voice.lines.map((l) => [l.sceneKey, l.url, l.offset]) : null,
  });
  return crypto.createHash('sha1').update(payload).digest('hex').slice(0, 20);
}

/** Le MP4 d'un format reflète-t-il la vidéo telle qu'elle est ? (anciens rendus : le drapeau `dirty`). */
export function isRenderFresh(video: MotionVideo, render: VideoRender): boolean {
  if (render.status !== 'done' || !render.url) return false;
  return render.key ? render.key === renderSignature(video, render.format, render.quality || video.scope.quality) && (render.quality || video.scope.quality) === video.scope.quality : !video.dirty;
}

/** Onglets de rendu d'un export (partagés entre ses formats). */
function renderConcurrency(): number {
  return Math.max(1, Number(process.env.VIDEO_RENDER_CONCURRENCY) || Math.min(6, Math.max(1, Math.floor(os.cpus().length * 0.75))));
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
  /** Les formats à rendre (défaut : tout le périmètre). */
  formats?: VideoFormat[];
  /** Rendu d'avance : ni compté, ni facturé, ni remboursé. */
  prerender?: boolean;
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
        // Retouchée pendant son rendu d'avance : le format principal est rendu à nouveau (sans effet s'il est à jour).
        if (job.prerender) void job.service.prerender(job.userId, job.projectId, job.videoId).catch(() => undefined);
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
  video = { ...video, renders: video.renders.map((r) => (r.status === 'done' && r.url && !isRenderFresh(video, r) ? { ...r, stale: true } : r)) };
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
