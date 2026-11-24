/**
 * VIDÉOS MOTION DESIGN — l'orchestrateur (moteur HyperFrames, catalogue `idem-templates`).
 *
 *   1. compréhension   la demande lue en entier (scénario, textes mot pour mot, langue), l'intention ;
 *   2. direction       le directeur invente le film (concept, bible, idée par scène) — dès Medium ;
 *   3. storyboard      le planificateur précise chaque scène (durée, intention, idées, textes, médias, voix) ;
 *   4. médias          imports et captures de la marque d'abord, puis génération, puis banque d'images ;
 *      musique, sons   banques libres, tempo analysé ; sonothèque CC0 ;
 *      voix off        dite, puis les scènes calées sur elle (sans changer la durée achetée) ;
 *   5. auteur          chaque scène ASSEMBLÉE par le code depuis le catalogue (HTML Tailwind, animation GSAP) ;
 *   6. contrôle        chaque scène jouée dans Chrome : erreurs TECHNIQUES attribuées à leur scène,
 *                      vignettes, effets sonores posés. Aucune critique esthétique, aucune réécriture.
 *
 * L'aperçu joue le même paquet que le rendu, en temps réel dans le navigateur ; retoucher un texte ou
 * une photo change des DONNÉES, jamais le code. Le MP4 est rendu à l'export, sur nos serveurs.
 */
import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import logger from '../runtime/logger';
import { libraryAnimationAssets } from './assets/lottie';
import { DemoDevice, recordDemo } from './assets/demo';
import { coreHost, requirePort } from '../runtime/host';
import { atLeast, CreativityLevel, normalizeCreativity } from '../creativity/levels';
import type { AgentCall } from '../creativity/orchestrator';
import { brandSheet as genericBrandSheet } from '../creativity/agent-io';
import { resolveLanguage } from '../text/language';
import {
  FilmAgentTrace,
  FilmScene,
  MOTION_STYLES,
  MotionStyle,
  MotionVideo,
  MUSIC_MOODS,
  MusicMood,
  MusicTrack,
  SfxKind,
  VIDEO_FORMATS,
  VIDEO_OBJECTIVES,
  VIDEO_TYPES,
  VideoBrief,
  VideoFilm,
  VideoFormat,
  VideoMediaAsset,
  VideoMusic,
  VideoObjective,
  VideoQuality,
  VideoRender,
  VideoScope,
  VideoSfx,
  VideoType,
  VideoVoice,
} from './contracts/model';
import type { VideoStore } from './contracts/store';
import { CopyWriter } from './request/facts';
import { MAX_REQUEST_CHARS, parseRequest, readRequest, RequestSpec, sceneTimeline } from './request/request';
import { applyClarification, ClassifyInput, clarifyVideoIntent, classifyVideoIntent, describeVideoIntent, IntentAsset, legacyOf, refineVideoIntent, VideoClarification, VideoIntentSpec } from './request/intent';
import { CreativeBrief, enhanceRequest } from './request/enhance';
import { MediaInputError, MediaStorage, Orientation, processUpload } from './assets/media';
import { ShotPlan, sourceShots, SourcingOptions } from './assets/sourcing';
import { describeBrandMedia } from './assets/brandmedia';
import { embeddedFontCss, filmBrand, FilmBrand } from './assets/brand';
import { analyzeTrack, beatGrid, phraseExcerpt, pickExcerptStart } from './audio/beats';
import { alignWords } from './audio/align';
import { prepareMedia } from './assets/prepare';
import { planFilm, plannedCues } from './composition';
import { fetchTrack, pickTrack, resolveMood, searchMusic, MUSIC_PROVIDERS } from './audio/music';
import { ensureSfxLibrary, MUSIC_GAIN_DB, MUSIC_UNDER_VOICE_DB, SFX_UNDER_VOICE_DB, pickSounds, pickTakes, previewGain, publicSoundName, SFX_GAIN_DB, sfxLibrary, SfxLibrary, soundFile } from './audio/sfx';
import { cleanSpoken, plainSpoken, fitScenesToVoice, personaById, personaMenu, speakable, speechAvailable, steadyNarration, synthesizeVoice, voiceTimeline, VOICE_PERSONAS } from './audio/voice';
import { callFilmModel, FilmCallContext, ModelRun, tierFor } from './agents';
import { FilmBrief, sceneRange } from './director/brief';
import { runConcept } from './director/concept.agent';
import { axisLine, pickAxis } from '../../../../../packages/design-tools/src';
import { runPlanner, Storyboard } from './director/storyboard.agent';
import { snapCutsToBeats } from '../../../../../packages/motion-compiler/src';
import { COMPOSITION, frameSpec } from './rendering/formats';
import { fetchMedia } from './rendering/runner';
import { seekableClip } from './rendering/ffmpeg';
import { buildComposition, CompositionInput, CompositionMedia } from './rendering/hyperframes/composition';
import { probeComposition, ProbeFile } from './rendering/hyperframes/probe';
import { renderHyperFrames } from './rendering/hyperframes/render';
import { shapeCadence } from './catalog/metrics';
import { sanitizeLogoSvg } from './rendering/logo-svg';
import { naturalColourModifier } from '../../../../../packages/design-tools/src';
import { foleyGenUrl, generatedFoley, generatedMusic, musicGenUrl } from './audio/generated';
import type { SceneMedia as SceneMediaPrep } from './catalog/graph';
import { ComposeInput, composeFilmFromCatalog, ComposedScene, nextSceneConfig, reassembleFilm, reviseSceneConfig } from './catalog/compose';
import type { FilmFormatId, SceneConfig } from './catalog/types';
import { refineCues } from './audio/sfx';
import { exportCost, normalizeScope, videoCost } from './pricing';
import { recordFromVideo } from './record';
import { buildVideoRevisionPrompt, parseVideoRevision, VideoRevisionPatch, videoSettingsFromText } from './revise';
import type { ReferenceBlueprint } from '../reference/reference.analyzer';
import { blueprintForDirector, referenceShotCards } from '../reference/reference.plan';

export { tierFor };
export type { VideoModelTier } from './agents';

// ─── Contrats publics ───────────────────────────────────────────────────────

export class VideoInputError extends Error {}

/** Ce qu'une retouche a vraiment fait (dit tel quel par la conversation). */
export interface RevisionReport {
  /** Scènes dont le code a été réécrit (retouche visuelle, correction, nouvelle version). */
  recoded: string[];
  /** Conservé pour les anciens appelants : toujours vide (aucune scène n'est remplacée par une composition de secours). */
  fallback: string[];
  /** Scènes dont la ligne de voix off a été redite. */
  voiced: string[];
  /** Ce qui n'a pas pu être fait, et pourquoi. */
  failed: { key: string; what: 'visual' | 'voice'; reason?: string }[];
}

export const emptyRevisionReport = (): RevisionReport => ({ recoded: [], fallback: [], voiced: [], failed: [] });

export interface CreateVideoInput {
  brief: Partial<VideoBrief>;
  scope: unknown;
  /** Famille demandée (une indication pour le directeur) ; « auto » / « mix » = libre. */
  type?: VideoType | 'auto';
  language?: string;
  contentId?: string;
  creativity?: CreativityLevel;
  /** Une vidéo modèle analysée : son découpage et son rythme sont suivis, avec la marque de l'utilisateur. */
  reference?: ReferenceBlueprint & { id?: string };
  /** L'interprétation corrigée par l'utilisateur, ou sa réponse à la question de clarification. */
  intent?: Partial<Pick<VideoIntentSpec, 'objective' | 'productionModes' | 'motionDirection' | 'subtitles' | 'voiceover' | 'music'>>;
  clarification?: { id: string; option: string };
  /**
   * Une DÉMO PRODUIT à filmer (`assets/demo.ts`) : l'interface publique `url` est parcourue par un agent selon `goal`
   * (par défaut la demande), chaque écran devient un média avec le point de l'action (zoom automatique).
   */
  demo?: { url: string; goal?: string; device?: DemoDevice };
  /** Le personnage de voix voulu (plan du calendrier) : il l'emporte sur celui que propose le directeur de création. */
  voicePersona?: string;
}

/** Progression RÉELLE d'une création (flux SSE). */
export type VideoProgressStage = 'plan' | 'concept' | 'storyboard' | 'media' | 'music' | 'sfx' | 'voice' | 'code' | 'check' | 'repair';

export interface VideoProgressEvent {
  stage: VideoProgressStage;
  state: 'running' | 'done';
  data?: Record<string, unknown>;
}

export type VideoProgressListener = (event: VideoProgressEvent) => void;

/** Facturation à restituer si le rendu échoue après la réponse HTTP. */
export interface RenderCharge {
  cost: number;
  action: string;
}

/** Une retouche (gratuite) : données, réglages, ou nouvelles versions du code de certaines scènes. */
/** L'endroit pointé dans l'aperçu : instant dans la scène (s), zone (fractions du cadre), éléments et textes dessous. */
export interface ScenePoint {
  at: number;
  zone: { x: number; y: number; w: number; h: number };
  roles: string[];
  texts?: string[];
}

export interface VideoPatch {
  /** Textes par scène (clé de scène → clé de texte → texte). `slots` : ancien nom, même sens. */
  texts?: Record<string, Record<string, string>>;
  slots?: Record<string, Record<string, string>>;
  /** Une autre image pour une scène (clé → URL importée) : remplace sa première image. */
  images?: Record<string, string>;
  musicMood?: MusicMood;
  musicTrackId?: string;
  sfx?: boolean;
  voice?: boolean;
  captions?: boolean;
  /** Ligne de voix off d'une scène (clé → ce que dit la voix), dite telle quelle. */
  voiceLines?: Record<string, string>;
  /** Retouche VISUELLE d'une scène (clé → la demande, en clair) : son code est réécrit par l'auteur. `all` : toutes. */
  visual?: Record<string, string>;
  /**
   * L'endroit POINTÉ par l'utilisateur pour une retouche visuelle (clé → instant, zone et éléments sous la zone,
   * relevés par l'aperçu) : la consigne de `visual` porte d'abord sur ces éléments (idée de motlab, 22/11/2026).
   */
  points?: Record<string, ScenePoint>;
  /** Correction VOLONTAIRE d'une scène en erreur : l'auteur reçoit son code et l'erreur. */
  fix?: string[];
  /** Nouvelle version d'une scène, écrite de zéro depuis sa fiche. */
  regenerate?: string[];
  scope?: Partial<VideoScope>;
}

/** Le corps d'une retouche, venu d'un client HTTP : seuls les champs et les formes attendus passent. */
export function sanitizeVideoPatch(raw: unknown): VideoPatch {
  const b = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const key = (k: string) => /^[a-z][a-z0-9_-]{0,23}$/i.test(k);
  const strings = (v: unknown, max: number): Record<string, string> | undefined => {
    if (!v || typeof v !== 'object') return undefined;
    const out = Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([k, x]) => key(k) && typeof x === 'string').map(([k, x]) => [k, (x as string).slice(0, max)]));
    return Object.keys(out).length ? out : undefined;
  };
  const nested = (v: unknown): Record<string, Record<string, string>> | undefined => {
    if (!v || typeof v !== 'object') return undefined;
    const out = Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([k]) => key(k)).map(([k, x]) => [k, strings(x, 220)] as const).filter((e): e is [string, Record<string, string>] => !!e[1]));
    return Object.keys(out).length ? out : undefined;
  };
  const num = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : undefined);
  const points = (v: unknown): Record<string, ScenePoint> | undefined => {
    if (!v || typeof v !== 'object') return undefined;
    const out: Record<string, ScenePoint> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      const p = x && typeof x === 'object' ? (x as Record<string, any>) : null;
      const z = p?.zone && typeof p.zone === 'object' ? p.zone : null;
      if (!key(k) || !p || !z) continue;
      const zone = { x: num(z.x, 0, 1), y: num(z.y, 0, 1), w: num(z.w, 0, 1), h: num(z.h, 0, 1) };
      if (Object.values(zone).some((n) => n === undefined)) continue;
      out[k] = {
        at: num(p.at, 0, 600) ?? 0,
        zone: zone as ScenePoint['zone'],
        roles: (Array.isArray(p.roles) ? p.roles : []).filter((r: unknown): r is string => typeof r === 'string' && /^[a-z]{2,16}$/.test(r)).slice(0, 6),
        texts: (Array.isArray(p.texts) ? p.texts : []).filter((t: unknown): t is string => typeof t === 'string').map((t: string) => t.replace(/\s+/g, ' ').trim().slice(0, 80)).filter(Boolean).slice(0, 4),
      };
      if (Object.keys(out).length >= 30) break;
    }
    return Object.keys(out).length ? out : undefined;
  };
  const keys = (v: unknown) => (Array.isArray(v) ? v.filter((k): k is string => typeof k === 'string' && key(k)).slice(0, 30) : undefined);
  const bool = (v: unknown) => (typeof v === 'boolean' ? v : undefined);
  const patch: VideoPatch = {
    texts: nested(b.texts) || nested(b.slots),
    images: strings(b.images, 2000),
    musicMood: MUSIC_MOODS.includes(b.musicMood as MusicMood) ? (b.musicMood as MusicMood) : undefined,
    musicTrackId: typeof b.musicTrackId === 'string' ? b.musicTrackId.slice(0, 120) : undefined,
    sfx: bool(b.sfx),
    voice: bool(b.voice),
    captions: bool(b.captions),
    voiceLines: strings(b.voiceLines, 400),
    visual: strings(b.visual, 800),
    points: points(b.points),
    fix: keys(b.fix),
    regenerate: keys(b.regenerate),
    scope: b.scope && typeof b.scope === 'object' ? (b.scope as Partial<VideoScope>) : undefined,
  };
  return Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) as VideoPatch;
}

// ─── Brief ──────────────────────────────────────────────────────────────────

const MAX_IMAGES = 6;

function mediaUrlAllowed(url: string): boolean {
  if (/^https?:\/\/[^\s]+$/.test(url)) return true;
  return process.env.VIDEO_ALLOW_FILE_URLS === '1' && process.env.NODE_ENV !== 'production' && /^file:\/\/\//.test(url);
}

/** Médias déclarés par le client : images et clips seulement, URL http(s). */
function normalizeMedia(raw: unknown): VideoMediaAsset[] {
  return (Array.isArray(raw) ? raw : [])
    .filter((m: any) => m && (m.kind === 'image' || m.kind === 'video') && mediaUrlAllowed(String(m.url || '')))
    .slice(0, 16)
    .map((m: any) => ({
      id: String(m.id || crypto.randomBytes(4).toString('hex')).slice(0, 64),
      kind: m.kind,
      url: String(m.url),
      origin: 'upload' as const,
      name: m.name ? String(m.name).slice(0, 80) : undefined,
      durationSec: Number(m.durationSec) || undefined,
      width: Number(m.width) || undefined,
      height: Number(m.height) || undefined,
      posterUrl: mediaUrlAllowed(String(m.posterUrl || '')) ? String(m.posterUrl) : undefined,
    }));
}

export function normalizeBrief(raw: Partial<VideoBrief> | undefined, language?: string): VideoBrief {
  const b = raw || {};
  const message = String(b.message || '').replace(/\s+/g, ' ').trim().slice(0, 400);
  if (message.length < 3) throw new VideoInputError('message_required');
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
    imageUrls,
    language: spoken.code.slice(0, 5),
    ...(request ? { request } : {}),
    ...(b.spec && (b.spec as RequestSpec).v === 1 ? { spec: b.spec as RequestSpec } : {}),
    media: [...normalizeMedia(b.media), ...imageUrls.map((url, i) => ({ id: `legacy-${i}`, kind: 'image' as const, url, origin: 'upload' as const }))],
    allowStock: b.allowStock !== false,
    allowGenerate: b.allowGenerate !== false,
    sfx: b.sfx !== false,
    voice: b.voice === true,
  };
}

/**
 * Le plafond d'images nouvelles d'une vidéo : il suit la durée (une image pour ~8 s, 6 au moins, 14 au plus) — six
 * images pour trois minutes laissaient la plupart des scènes en typographie seule. `VIDEO_GEN_MAX_IMAGES` l'impose.
 * Les clips, plus coûteux, gardent leur plafond fixe (`VIDEO_GEN_MAX_CLIPS`).
 */
export function imageCap(durationSec: number): number {
  const forced = process.env.VIDEO_GEN_MAX_IMAGES;
  if (forced !== undefined && forced !== '' && Number.isFinite(Number(forced))) return Math.max(0, Number(forced));
  return Math.min(14, Math.max(6, Math.round(durationSec / 8)));
}

/** Un titre lisible : majuscule initiale, sans point final. */
export function titleCase(title: string): string {
  const t = String(title || '').replace(/\s+/g, ' ').trim().replace(/[.。]+$/, '');
  return t ? t.charAt(0).toLocaleUpperCase() + t.slice(1) : t;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;
const orientationOf = (format: VideoFormat): Orientation => (format === 'landscape' ? 'landscape' : format === 'square' ? 'square' : 'portrait');

// ─── Le service ─────────────────────────────────────────────────────────────

export class MotionVideoService {
  constructor(
    /** Les marques et les vidéos de l'hôte (projets IDEM, marques iVision). */
    private readonly store: VideoStore,
    /** Appel de modèle imposé (contrôles) : remplace `agentCall` de l'hôte pour les agents du film. */
    private readonly filmCall?: AgentCall
  ) {}

  /** Un rédacteur simple, à l'étage voulu (lecture de la demande, intention, « améliorer », retouche écrite). */
  private writer(userId: string, tier: 'mechanical' | 'writing' | 'reasoning' = 'mechanical', role?: string): CopyWriter | undefined {
    if (this.filmCall) return (system, user) => this.filmCall!({ role: role || 'video.reader', profile: 'agents', system, user });
    if (typeof this.store.runVideoTieredPrompt === 'function') return (system, user) => this.store.runVideoTieredPrompt!(userId, system, user, tier, 'copy', role);
    if (typeof this.store.runVideoCopyPrompt === 'function') return (system, user) => this.store.runVideoCopyPrompt!(userId, system, user);
    return undefined;
  }

  private callContext(userId: string, projectId: string, level: CreativityLevel): FilmCallContext {
    return { userId, projectId, level, ...(this.filmCall ? { call: this.filmCall } : {}) };
  }

  /**
   * La musique de l'aperçu : une copie sur notre stockage. Les banques (ccMixter) refusent la lecture
   * directe depuis le navigateur (403) alors que le serveur, lui, a la piste en cache : l'export avait
   * sa musique, l'aperçu restait muet. Une copie par piste, retrouvée par son adresse.
   */
  private readonly hostedTracks = new Map<string, Promise<string>>();
  private previewTrackUrl(music: VideoMusic): Promise<string> {
    if (music.provider === 'local' || !/^https?:\/\//.test(music.url)) return Promise.resolve(music.url);
    let job = this.hostedTracks.get(music.url);
    if (!job) {
      job = (async () => {
        const file = await fetchTrack(music);
        const ext = (music.url.split('?')[0].match(/\.(mp3|ogg|wav|m4a|flac)$/i)?.[1] || 'mp3').toLowerCase();
        const type = ext === 'mp3' ? 'audio/mpeg' : ext === 'm4a' ? 'audio/mp4' : `audio/${ext}`;
        const name = `${crypto.createHash('sha1').update(music.url).digest('hex')}.${ext}`;
        return (await this.mediaStorage().uploadFile(fs.readFileSync(file), name, 'shared/video-music', type)).downloadURL;
      })().catch((error: any) => {
        logger.warn('video.music_preview_copy_failed', { id: music.id, error: error?.message || String(error) });
        this.hostedTracks.delete(music.url);
        return music.url;
      });
      this.hostedTracks.set(music.url, job);
    }
    return job;
  }

  protected mediaStorage(): MediaStorage {
    return requirePort('storage') as unknown as MediaStorage;
  }

  // ── Marque ────────────────────────────────────────────────────────────────

  private async brandContext(userId: string, projectId: string) {
    const brand = await this.store.loadBrand(userId, projectId);
    if (!brand) throw new VideoInputError('project_not_found');
    const anonymous = !!brand.anonymous;
    const brandName = brand.brandName || (anonymous ? '' : 'Marque');
    const branding: any = brand.branding || {};
    const fb = filmBrand(branding, brandName, { anonymous });
    const sheet = genericBrandSheet({
      brandName: brandName || 'none',
      businessType: brand.voice.businessType,
      tone: brand.voice.tone,
      palette: fb.tokens.colors as unknown as Record<string, string>,
      fonts: fb.tokens.fonts,
      art: branding.artDirection || null,
    });
    return { brand, brandName, anonymous, branding, film: fb, sheet, visuals: brand.visuals || [], others: brand.videos || [], brandMedia: brand.media || [] };
  }

  // ── Compréhension ────────────────────────────────────────────────────────

  private intentAssets(media: VideoMediaAsset[], brandMedia: { url: string; kind?: 'screen' | 'photo'; note?: string }[]): IntentAsset[] {
    return [
      ...media.map((m) => ({ id: m.id, kind: m.kind, ...(m.width ? { width: m.width } : {}), ...(m.height ? { height: m.height } : {}), ...(m.durationSec ? { durationSec: m.durationSec } : {}), ...(m.name ? { note: m.name } : {}) })),
      ...brandMedia.filter((m) => m.kind === 'screen').map((m, i) => ({ id: `brand-screen-${i + 1}`, kind: 'screen' as const, ...(m.note ? { note: m.note } : {}) })),
    ];
  }

  private async readIntent(userId: string, input: CreateVideoInput, brief: VideoBrief, spec: RequestSpec, brandMedia: { url: string; kind?: 'screen' | 'photo'; note?: string }[], creativity: CreativityLevel): Promise<VideoIntentSpec> {
    const classify: ClassifyInput = { request: brief.request || `${brief.message}\n${brief.details || ''}`, spec, assets: this.intentAssets(brief.media || [], brandMedia), requestedType: VIDEO_TYPES.includes(input.type as VideoType) ? (input.type as VideoType) : 'auto', brandHasScreens: brandMedia.some((m) => m.kind === 'screen'), language: spec.language };
    let intent = classifyVideoIntent(classify);
    intent = await refineVideoIntent(intent, classify.request, this.writer(userId, 'mechanical', 'video.intent-classifier'));
    if (input.clarification) {
      const question = clarifyVideoIntent(intent, classify);
      if (question && question.id === input.clarification.id) intent = applyClarification(intent, question, input.clarification.option);
    }
    if (input.intent) {
      const patch = Object.fromEntries(Object.entries(input.intent).filter(([, v]) => v !== undefined));
      intent = { ...intent, ...patch, source: 'user', decided: { objective: input.intent.objective ? 'explicit' : intent.decided.objective, productionModes: input.intent.productionModes ? 'explicit' : intent.decided.productionModes, motionDirection: input.intent.motionDirection ? 'explicit' : intent.decided.motionDirection } };
      intent.legacy = legacyOf(intent, classify);
    }
    return intent;
  }

  /** L'interprétation d'une demande avant création (gratuite) : intention, étiquettes, question éventuelle. */
  async interpretVideo(userId: string, projectId: string, input: Pick<CreateVideoInput, 'brief' | 'type' | 'language' | 'creativity'>): Promise<{ intent: VideoIntentSpec; interpretation: { tags: string[]; summary: string }; clarification: VideoClarification | null }> {
    const brief = normalizeBrief(input.brief, input.language);
    const { brandMedia } = await this.brandContext(userId, projectId);
    const read = await readRequest(brief.request || brief.message, { fallbackLanguages: [input.language], skipReader: true });
    const intent = await this.readIntent(userId, { ...input, scope: undefined } as CreateVideoInput, brief, { ...read.spec, language: brief.language || read.spec.language }, brandMedia, normalizeCreativity(input.creativity));
    const classify: ClassifyInput = { request: brief.request || brief.message, spec: read.spec, assets: this.intentAssets(brief.media || [], brandMedia), brandHasScreens: brandMedia.some((m) => m.kind === 'screen'), language: intent.language };
    return { intent, interpretation: describeVideoIntent(intent), clarification: clarifyVideoIntent(intent, classify) };
  }

  /**
   * Le cœur de « améliorer ma demande » : partagé entre l'appel explicite (gratuit, bouton dédié) et la
   * reformulation AUTOMATIQUE de `createVideo` — jamais visible, jamais bloquante (une demande trop
   * courte ou un modèle en panne renvoie le texte tel quel, pas une erreur).
   */
  private async enhanceVideoRequest(
    userId: string,
    text: string,
    media: VideoMediaAsset[],
    ctx: Awaited<ReturnType<MotionVideoService['brandContext']>>,
    o: { durationSec?: number; voice?: boolean; objective?: string; mediaNotes?: string[]; language?: string } = {}
  ): Promise<{ prompt: string; source: 'llm' | 'template'; brief?: CreativeBrief }> {
    if (parseRequest(String(text || '')).mode === 'script') return { prompt: String(text).trim().slice(0, MAX_REQUEST_CHARS), source: 'template' };
    // La demande gardée en entier (un brief déjà détaillé, celui du calendrier éditorial par exemple, est complété, pas résumé).
    const clean = String(text || '').replace(/[ \t]+/g, ' ').trim().slice(0, 4000);
    if (clean.replace(/\s+/g, '').length < 3) return { prompt: text, source: 'template' };
    const { brand, brandName, branding } = ctx;
    const count = (kind: string) => media.filter((m) => m?.kind === kind).length;
    const art = branding?.artDirection ? [branding.artDirection.styleName, branding.artDirection.tagline, (branding.artDirection.keywords || []).slice(0, 5).join(', ')].filter(Boolean).join(' · ') : undefined;
    const result = await enhanceRequest(
      {
        text: clean,
        ctx: { brandName, businessType: brand.voice.businessType, tone: brand.voice.tone, valueProposition: brand.voice.valueProposition, keywords: brand.voice.keywords, language: o.language || brand.voice.language || 'fr' },
        media: { images: count('image'), videos: count('video'), models: 0, lotties: 0 },
        art,
        ...(o.mediaNotes?.length ? { mediaNotes: o.mediaNotes } : {}),
        ...(o.durationSec ? { durationSec: o.durationSec } : {}),
        ...(typeof o.voice === 'boolean' ? { voice: o.voice } : {}),
        ...(o.objective ? { objective: o.objective } : {}),
      },
      // Le directeur de création écrit un brief de production : l'étage « rédaction », pas l'étage mécanique.
      this.writer(userId, 'writing', 'video.brief')
    ).catch(() => ({ prompt: text, source: 'template' as const, tokens: { input: 0, output: 0 } }));
    return { prompt: result.prompt, source: result.source, ...('brief' in result && result.brief ? { brief: result.brief } : {}) };
  }

  /** « Améliorer ma demande » : réécriture précise, faits conservés (gratuit, bouton dédié). */
  async enhanceRequest(userId: string, projectId: string, text: string, media: VideoMediaAsset[] = []): Promise<{ prompt: string; source: 'llm' | 'template' }> {
    if (parseRequest(String(text || '')).mode !== 'script' && String(text || '').replace(/\s+/g, ' ').trim().length < 3) throw new VideoInputError('message_required');
    const ctx = await this.brandContext(userId, projectId);
    return this.enhanceVideoRequest(userId, text, media, ctx);
  }

  /**
   * Un contenu du calendrier éditorial → la demande de la vidéo. Le PLAN écrit avec le calendrier (déroulé, ce qu'on
   * montre, ton de la narration, musique, durée) devient la demande entière ; ce que l'utilisateur a choisi au moment de
   * générer (durée, voix, musique) l'emporte toujours.
   */
  private async inputFromContent(userId: string, projectId: string, input: CreateVideoInput): Promise<CreateVideoInput> {
    const content = (await this.store.briefFromContent?.(userId, projectId, input.contentId!)) || null;
    if (!content) return input;
    const brief = { ...(input.brief || {}) };
    if (!brief.message || String(brief.message).trim().length < 3) brief.message = content.message.slice(0, 400);
    if (!brief.details && content.details) brief.details = content.details.slice(0, 800);
    if (!brief.objective && content.objective) brief.objective = content.objective;
    if (!brief.request && content.request) brief.request = content.request;
    if (typeof brief.voice !== 'boolean' && typeof content.voice === 'boolean') brief.voice = content.voice;
    if ((!brief.musicMood || brief.musicMood === 'auto') && content.musicMood) brief.musicMood = content.musicMood;
    const rawScope = (input.scope && typeof input.scope === 'object' ? input.scope : {}) as Record<string, unknown>;
    const scope = rawScope.durationSec || !content.durationSec ? input.scope : { ...rawScope, durationSec: content.durationSec };
    return { ...input, brief, scope, type: input.type || content.type || 'auto', ...(content.voicePersona && !input.voicePersona ? { voicePersona: content.voicePersona } : {}) };
  }

  // ── Médias ────────────────────────────────────────────────────────────────

  /**
   * Un import de l'utilisateur : photo, clip, ou animation Lottie (.json / .lottie) rendue en clip transparent
   * (`assets/lottie.ts`). Le moteur ne lit ni 3D ni Rive.
   */
  async uploadMedia(userId: string, projectId: string, file: { buffer: Buffer; mimetype: string; originalname: string }): Promise<VideoMediaAsset> {
    const asset = await processUpload(file, this.mediaStorage(), `users/${userId}/projects/${projectId}/videos/uploads`, { lottieAsClip: true });
    if (asset.kind !== 'image' && asset.kind !== 'video') throw new MediaInputError('unsupported_media');
    return asset;
  }

  /** Les images de la marque décrites (une lecture par image, gardée par l'hôte). */
  private async describedBrandMedia(userId: string, projectId: string, raw: { url: string; kind?: 'screen' | 'photo'; note?: string }[], uploads: VideoMediaAsset[]) {
    const items = [...uploads.filter((m) => m.kind === 'image').map((m) => ({ url: m.url, kind: 'photo' as const, note: m.name ? `photo provided by the client: ${m.name}` : undefined })), ...raw];
    const seen = new Set<string>();
    const unique = items.filter((m) => !seen.has(m.url) && seen.add(m.url));
    if (!unique.length) return [];
    const described = await describeBrandMedia(unique, 10).catch(() => unique.map((u) => ({ url: u.url, kind: u.kind || 'photo', note: u.note || '' })));
    const fresh = Object.fromEntries(described.filter((d) => raw.some((r) => r.url === d.url && !r.note)).map((d) => [d.url, d.note]));
    if (Object.keys(fresh).length) await this.store.saveMediaNotes?.(userId, projectId, fresh).catch(() => undefined);
    return described;
  }

  private async registryFor(userId: string, projectId: string): Promise<{ registry?: SourcingOptions['registry'] }> {
    const registry = coreHost().assetRegistry;
    if (!registry) return {};
    const records = await registry.list({ userId, projectId }).catch(() => []);
    return { registry: { records, remember: (fresh) => registry.remember({ userId, projectId }, fresh) } };
  }

  // ── Sons ──────────────────────────────────────────────────────────────────

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
    // Plusieurs prises par moment sonore : les transitions tournent (jamais le même whoosh à chaque coupe).
    const takes: NonNullable<VideoSfx['takes']> = {};
    for (const [kind, list] of Object.entries(pickTakes(lib))) takes[kind as SfxKind] = (list || []).map(({ file: _f, score: _s, ...rest }) => rest);
    return { enabled: true, sounds, ...(Object.keys(takes).length ? { takes } : {}) };
  }

  /** Les fichiers des effets : un par moment sonore (aperçu), ou toutes ses prises (`withTakes`, rendu). */
  private async sfxFiles(sfx?: VideoSfx): Promise<Partial<Record<SfxKind, string>>>;
  private async sfxFiles(sfx: VideoSfx | undefined, withTakes: true): Promise<Partial<Record<SfxKind, string | string[]>>>;
  private async sfxFiles(sfx?: VideoSfx, withTakes = false): Promise<Partial<Record<SfxKind, string | string[]>>> {
    const out: Partial<Record<SfxKind, string | string[]>> = {};
    if (!sfx?.enabled) return out;
    for (const [kind, sound] of Object.entries(sfx.sounds)) {
      const file = sound ? await soundFile(sound) : null;
      if (!file) continue;
      const takes = withTakes ? (await Promise.all((sfx.takes?.[kind as SfxKind] || []).map((t) => soundFile(t)))).filter((f): f is string => !!f) : [];
      out[kind as SfxKind] = takes.length > 1 ? takes : file;
    }
    return out;
  }

  // ── Musique ───────────────────────────────────────────────────────────────

  async chooseMusic(opts: { mood: MusicMood; style: MotionStyle; objective: VideoObjective; durationSec: number; seed: number; avoidIds?: string[]; trackId?: string; brandText?: string }): Promise<VideoMusic | undefined> {
    const mood = resolveMood(opts.mood, opts.style, opts.objective, opts.brandText);
    if (!mood) return undefined;
    // Le serveur de musique d'IDEM (ACE-Step), s'il est configuré : une musique originale passe avant les banques ;
    // son échec leur rend la main (`audio/generated.ts`).
    if (!opts.trackId && musicGenUrl()) {
      const original = await generatedMusic({ mood, durationSec: opts.durationSec, seed: opts.seed });
      const prepared = original ? await this.prepareTrack(original, opts.durationSec) : null;
      if (prepared) return prepared;
    }
    try {
      const candidates = await searchMusic({ mood, minDuration: opts.durationSec + 3 }, MUSIC_PROVIDERS);
      const first = opts.trackId ? candidates.find((t) => t.id === opts.trackId) || null : pickTrack(candidates, opts.seed, opts.avoidIds);
      if (!first) return undefined;
      const queue = [first, ...candidates.filter((t) => t.id !== first.id && !(opts.avoidIds || []).includes(t.id)).slice(0, 4)];
      let fallback: VideoMusic | undefined;
      for (const track of queue) {
        const prepared = await this.prepareTrack(track, opts.durationSec);
        // Une piste qu'on ne peut pas télécharger (ccMixter répond 403) est écartée : gardée, elle donnait une
        // vidéo muette à l'export comme à l'aperçu.
        if (!prepared) continue;
        if (prepared.beat) return prepared;
        fallback ??= prepared;
      }
      return fallback;
    } catch (error: any) {
      logger.warn('video.music_failed', { error: error.message });
      return undefined;
    }
  }

  private async prepareTrack(track: MusicTrack, durationSec: number): Promise<VideoMusic | null> {
    let file: string;
    try {
      file = await fetchTrack(track);
    } catch (error: any) {
      logger.warn('video.track_download_failed', { id: track.id, error: error?.message || String(error) });
      return null;
    }
    try {
      const analysis = await analyzeTrack(file);
      // La grille des temps (BeatRoot) : l'extrait commence sur une phrase et FINIT sur une fin de phrase ; les temps de
      // l'extrait servent au calage des coupes et des gestes.
      const grid = await beatGrid(file, analysis).catch(() => null);
      const startAt = grid ? phraseExcerpt(grid, analysis, durationSec) : pickExcerptStart(analysis, durationSec);
      const local = (list?: number[]) => (list || []).filter((b) => b >= startAt - 1e-3 && b <= startAt + durationSec + 0.5).map((b) => Math.round((b - startAt) * 1000) / 1000);
      const bpm = grid?.bpm || (track.bpm && Math.abs(track.bpm - analysis.bpm) < 4 ? track.bpm : analysis.bpm);
      return {
        ...track,
        durationSec: track.durationSec || analysis.durationSec,
        startAt,
        beat: {
          bpm,
          offset: grid ? local(grid.beats)[0] ?? 0 : 0,
          confidence: analysis.confidence,
          ...(grid ? { beats: local(grid.beats), downbeats: local(grid.downbeats), phrases: local(grid.phrases) } : {}),
        },
      };
    } catch (error: any) {
      logger.warn('video.track_analysis_failed', { id: track.id, error: error?.message || String(error) });
      return { ...track, startAt: 0 };
    }
  }

  async musicOptions(mood: MusicMood, style: MotionStyle, objective: VideoObjective, durationSec: number): Promise<MusicTrack[]> {
    const resolved = resolveMood(mood, style, objective);
    if (!resolved) return [];
    return (await searchMusic({ mood: resolved, minDuration: durationSec + 3, limit: 12 })).map((t) => ({ ...t }));
  }

  // ── Voix off ──────────────────────────────────────────────────────────────

  /** Dit les lignes des scènes et cale le film sur elles. Sans service de voix : la vidéo reste sans voix, et le dit. */
  private async voiceFilm(o: { userId: string; projectId: string; videoId: string; film: VideoFilm; style: MotionStyle; seed: number; only?: string[]; scripted: boolean; previous?: VideoVoice; persona?: string }): Promise<{ film: VideoFilm; voice: VideoVoice; voiced: string[]; failed: string[] }> {
    const base: VideoVoice = { enabled: true, language: o.film.language.slice(0, 5), persona: o.previous?.persona || 'warm', provider: 'openrouter', model: '', voice: '', source: 'llm', lines: [] };
    if (!speechAvailable()) return { film: o.film, voice: { ...base, enabled: false, unavailable: 'no_speech_model' }, voiced: [], failed: [] };
    // Le personnage : celui de la voix déjà dite, sinon celui que le brief de production a choisi, sinon le menu du style.
    const persona = o.previous?.persona ? personaById(o.previous.persona) : o.persona ? personaById(o.persona) : personaMenu(o.style, o.seed)[0];
    const keep = (o.previous?.lines || []).filter((l) => o.only && !o.only.includes(l.sceneKey));
    // UN ton pour tout le film (`steadyNarration`) : une seule direction de jeu, pas de cri, pas de saut d'énergie.
    const steady = steadyNarration(o.film.scenes.map((sc) => cleanSpoken(sc.voiceText || '', 60, o.film.language, `${sc.voiceText}`)), persona.id);
    const wanted = o.film.scenes
      .map((sc, i) => ({ sc, i, text: plainSpoken(steady.lines[i]) ? steady.lines[i] : '' }))
      .filter((x) => x.text && (!o.only || o.only.includes(x.sc.key)));
    if (!wanted.length) return { film: o.film, voice: { ...base, persona: persona.id, lines: keep }, voiced: [], failed: [] };
    try {
      const said = await synthesizeVoice({
        lines: wanted.map((x) => ({ index: x.i, text: x.text, maxSec: speakable(x.sc.duration, x.i === 0) * 1.25 })),
        language: o.film.language,
        persona,
        storage: this.mediaStorage(),
        folder: `users/${o.userId}/projects/${o.projectId}/videos/${o.videoId}/voice`,
        // Toute la narration d'une prise ; une retouche de scène ne redit que sa ligne.
        continuous: !o.only,
        ...(steady.tag ? { deliveryTag: steady.tag } : {}),
      });
      const fresh = await Promise.all(said.lines.map(async (l) => ({ sceneKey: o.film.scenes[l.index].key, text: l.text, url: l.url, durationSec: l.durationSec, ...(await this.wordsOf(l.text, l.url, l.durationSec)) })));
      const all = [...keep.map(({ offset: _o, ...l }) => l), ...fresh];
      const fit = fitScenesToVoice(o.film.scenes, all, o.film.durationSec, { keepTiming: o.scripted });
      const voiced = fresh.map((l) => l.sceneKey);
      return {
        film: { ...o.film, scenes: fit.scenes },
        voice: { ...base, persona: persona.id, provider: said.provider, model: said.model, voice: said.voice, lines: fit.lines },
        voiced,
        failed: [...wanted.map((x) => x.sc.key).filter((k) => !voiced.includes(k)), ...fit.dropped],
      };
    } catch (error: any) {
      logger.warn('video.voice_failed', { projectId: o.projectId, error: error?.message });
      return { film: o.film, voice: { ...base, persona: persona.id, enabled: false, unavailable: String(error?.message || 'voice_failed').slice(0, 60), lines: keep }, voiced: [], failed: wanted.map((x) => x.sc.key) };
    }
  }

  /** L'instant de chaque mot d'une ligne dite (sous-titres mot par mot) ; rien si l'alignement échoue. */
  private async wordsOf(text: string, url: string, durationSec: number): Promise<{ words?: { text: string; start: number; end: number }[] }> {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'idem-align-'));
    try {
      const file = path.join(dir, 'line.mp3');
      fs.writeFileSync(file, (await fetchMedia(url)).buffer);
      const words = await alignWords(plainSpoken(text), file, durationSec);
      return words.length ? { words } : {};
    } catch {
      return {};
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  // ── Le rendu HyperFrames (plan qualité créative) ─────────────────────────────

  // ── Le CATALOGUE vidéo (11/11/2026) : les scènes HTML assemblées par le code depuis le dépôt `idem-templates` ──

  /** Ce que le catalogue lit d'un film : scènes (rôle, énergie, textes, médias, temps fort), marque, formats, cran. */
  private catalogInput(userId: string, projectId: string, video: MotionVideo, brand: FilmBrand, level: CreativityLevel): ComposeInput {
    const film = video.film!;
    const byId = new Map((video.media || []).map((m) => [m.id, m]));
    const beat = video.music?.beat?.bpm ? video.music.beat : undefined;
    const period = beat ? 60 / beat.bpm : 0;
    // La grille de la musique vue depuis chaque scène (s, depuis son début) : temps, temps forts, phrases — le catalogue
    // y pose l'instant où le rôle principal se pose (calage hiérarchique, `catalog/rhythm.ts`).
    const localGrid = (start: number, duration: number) => {
      const near = (list?: number[]) => (list || []).map((b) => round3(b - start)).filter((t) => t >= -0.5 && t <= duration + 0.5);
      return beat?.beats?.length ? { beats: near(beat.beats), downbeats: near(beat.downbeats), phrases: near(beat.phrases) } : {};
    };
    // Les mots de la voix off, datés depuis le début de leur scène : le catalogue y cale les entrées (titre, chiffre,
    // éléments d'une liste entrent quand la voix les dit).
    const spokenOf = (key: string) => {
      const line = video.voice?.enabled ? video.voice.lines.find((l) => l.sceneKey === key) : undefined;
      return line?.words?.length ? line.words.map((w) => ({ text: w.text, t: round3(line.offset + w.start) })) : undefined;
    };
    return {
      scenes: film.scenes.map((sc) => ({
        key: sc.key,
        duration: sc.duration,
        texts: sc.texts,
        media: sc.media.map((id) => byId.get(id)).filter((m): m is VideoMediaAsset => !!m && (m.kind === 'image' || m.kind === 'video')).map((m) => ({
            id: m.id,
            kind: m.kind as 'image' | 'video',
            // Ce que la préparation a lu (point d'intérêt, zone calme) : le catalogue cadre le sujet hors des textes.
            ...(m.prep?.focus ? { focus: m.prep.focus as SceneMediaPrep['focus'] } : {}),
            ...(m.prep?.calm ? { calm: m.prep.calm as SceneMediaPrep['calm'] } : {}),
            ...(m.width && m.height ? { aspect: Math.round((m.width / m.height) * 1000) / 1000 } : {}),
          })),
        ...(sc.role ? { role: sc.role } : {}),
        ...(sc.energy ? { energy: sc.energy } : {}),
        ...(beat ? { beat: { bpm: beat.bpm, first: round3(((((beat.offset || 0) - sc.start) % period) + period) % period), ...localGrid(sc.start, sc.duration) } } : {}),
        ...(spokenOf(sc.key) ? { spoken: spokenOf(sc.key) } : {}),
      })),
      film: { title: film.title, concept: film.concept, style: video.brief.style, seed: film.seed },
      brand: { name: brand.tokens.name, hasLogo: Boolean(brand.tokens.logo?.light), hasDarkLogo: Boolean(brand.tokens.logo?.dark), line: [brand.tokens.name, (brand.art || '').split('\n')[0]].filter(Boolean).join(' · ').slice(0, 220), ...(brand.styleId ? { direction: brand.styleId } : {}) },
      formats: (video.scope.formats.length ? video.scope.formats : ['story']) as FilmFormatId[],
      level,
      call: this.callContext(userId, projectId, level),
      memoryKey: projectId,
    };
  }

  /** Les scènes assemblées posées sur le film (HTML, script, configuration ; aucun auteur, aucun jeton par scène). */
  private static applyCatalog(film: VideoFilm, scenes: ComposedScene[], info: { version: string; theme: string }, keep?: Map<string, string[]>): VideoFilm {
    const byKey = new Map(scenes.map((s) => [s.key, s]));
    return {
      ...film,
      engine: 'hyperframes',
      catalog: { version: info.version, theme: info.theme },
      scenes: film.scenes.map((sc) => {
        const c = byKey.get(sc.key);
        if (!c) return sc;
        const { error: _e, ...rest } = sc;
        return { ...rest, html: c.html, script: c.script, animation: 'gsap' as const, status: 'ready' as const, catalog: { ...c.config, ...(keep?.get(sc.key)?.length ? { tried: keep.get(sc.key) } : {}) } };
      }),
    };
  }

  /** Le film réassemblé depuis ses configurations (une scène changée change aussi la transition et la sortie voisines). */
  private async reassembleCatalogFilm(video: MotionVideo, brand: FilmBrand, film: VideoFilm, level: CreativityLevel): Promise<VideoFilm> {
    const input = this.catalogInput('', '', { ...video, film }, brand, level);
    const configs = film.scenes.map((sc) => sc.catalog ?? ({ layout: 'builtin.stack', animations: {} } as SceneConfig));
    const scenes = await reassembleFilm(input, film.catalog?.theme ?? 'builtin.plain', configs);
    return MotionVideoService.applyCatalog(film, scenes, { version: film.catalog?.version ?? '', theme: film.catalog?.theme ?? 'builtin.plain' }, new Map(film.scenes.map((sc) => [sc.key, sc.catalog?.tried ?? []])));
  }

  /**
   * Les scènes HTML du film, ASSEMBLÉES depuis le catalogue vidéo : un choix (le code au cran Low, sinon un appel
   * `video.template` pour tout le film), puis l'assemblage par le code. Aucun modèle n'écrit de HTML.
   */
  private async authorHtmlFilm(userId: string, projectId: string, video: MotionVideo, ctx: Awaited<ReturnType<MotionVideoService['brandContext']>>, level: CreativityLevel, onDone?: (key: string, done: number, ok: boolean) => void): Promise<{ film: VideoFilm | null; traces: FilmAgentTrace[]; failed: string[] }> {
    const film = video.film!;
    const composed = await composeFilmFromCatalog(this.catalogInput(userId, projectId, video, ctx.film, level));
    composed.scenes.forEach((s, i) => onDone?.(s.key, i + 1, true));
    const trace: FilmAgentTrace = { agent: 'video.template', source: composed.trace.source === 'llm' ? 'llm' : 'none', tokens: composed.trace.tokens, ms: composed.trace.ms, ...(composed.trace.failure ? { failure: composed.trace.failure.slice(0, 120) } : {}) };
    return { film: MotionVideoService.applyCatalog(film, composed.scenes, composed), traces: [trace], failed: [] };
  }

  /**
   * Un film HTML écrit AVANT le catalogue (11/11/2026, sans configuration) passe au catalogue la première fois qu'il
   * est retouché ou corrigé : ses scènes sont assemblées (mêmes textes, mêmes médias), en un appel pour tout le film.
   */
  private async catalogFilmOf(userId: string, projectId: string, video: MotionVideo, ctx: Awaited<ReturnType<MotionVideoService['brandContext']>>, level: CreativityLevel): Promise<VideoFilm> {
    const film = video.film!;
    if (film.catalog) return film;
    const out = await this.authorHtmlFilm(userId, projectId, video, ctx, level);
    logger.info('video.catalog_migrated', { event: 'video.catalog_migrated', videoId: video.id, scenes: film.scenes.length });
    return { ...out.film!, agents: [...film.agents, ...out.traces] };
  }

  /** La page HyperFrames d'un format : médias servis depuis le dossier du rendu (ou leurs URL en aperçu). */
  private async hyperframesProject(video: MotionVideo, brand: FilmBrand, format: VideoFormat, mode: 'render' | 'preview', quality: VideoQuality, audio?: CompositionInput['audio']): Promise<{ html: string; files: ProbeFile[]; size: { width: number; height: number }; out: { width: number; height: number }; fps: number }> {
    const film = video.film!;
    const comp = COMPOSITION[format] ?? COMPOSITION.story;
    const spec = frameSpec(format, quality);
    const byId = new Map((video.media || []).map((m) => [m.id, m]));
    const files: ProbeFile[] = [];
    const media: Record<string, CompositionMedia> = {};
    const extOf = (mime: string, kind: 'image' | 'video') => (/png/.test(mime) ? '.png' : /svg/.test(mime) ? '.svg' : /webp/.test(mime) ? '.webp' : /webm/.test(mime) ? '.webm' : /mp4|video/.test(mime) || kind === 'video' ? '.mp4' : '.jpg');
    await Promise.all(
      [...new Set(film.scenes.flatMap((s) => s.media))].map(async (id) => {
        const m = byId.get(id);
        if (!m || (m.kind !== 'image' && m.kind !== 'video')) return;
        if (mode === 'preview') return void (media[id] = { src: m.url, kind: m.kind });
        const served = await fetchMedia(m.url).catch(() => null);
        if (!served) return;
        const name = `${id}${extOf(served.mimeType, m.kind)}`;
        // Un clip sans durée (WebM écrit vers un tube, clips déjà stockés) est remis en conteneur : sinon le rendu le refuse.
        const data = m.kind === 'video' ? await seekableClip(served.buffer, extOf(served.mimeType, 'video')) : served.buffer;
        files.push({ name, data, mimeType: served.mimeType });
        media[id] = { src: name, kind: m.kind };
      })
    );
    let logo = brand.tokens.logo?.light;
    // Le logo SVG (assaini) est aussi posé dans la page : la signature le dessine trait par trait (aperçu et rendu).
    let logoSvg: string | undefined;
    if (logo && /^https?:/.test(logo)) {
      const served = await fetchMedia(logo).catch(() => null);
      if (served && /svg/.test(served.mimeType)) logoSvg = sanitizeLogoSvg(served.buffer.toString('utf8')) ?? undefined;
      if (mode === 'render') {
        if (served) {
          const name = `logo${extOf(served.mimeType, 'image')}`;
          files.push({ name, data: served.buffer, mimeType: served.mimeType });
          logo = name;
        } else logo = undefined;
      }
    }
      // Les motifs de la charte : en rendu, la tuile devient un fichier du dossier (la page n'a pas de réseau) ; en aperçu, son adresse.
    const patterns = (
      await Promise.all(
        (brand.patterns ?? []).map(async (p, i) => {
          const served = await fetchMedia(p.url).catch(() => null);
          if (!served && mode === 'render') return null;
          let src: string = p.url;
          if (served && mode === 'render') {
            if (!/svg|image/.test(served.mimeType)) return null;
            src = `pattern-${i}${/svg/.test(served.mimeType) ? '.svg' : '.png'}`;
            files.push({ name: src, data: served.buffer, mimeType: served.mimeType });
          }
          // Le code de la tuile : l'encre pourra être adaptée au fond de chaque scène (palette de la marque).
          const svg = served && /svg/.test(served.mimeType) ? served.buffer.toString('utf8').slice(0, 200_000) : undefined;
          return { src, tile: p.tile, ink: p.ink.toLowerCase(), ground: p.ground.toLowerCase(), ...(svg ? { svg } : {}), ...(p.kind ? { kind: p.kind } : {}) };
        })
      )
    ).filter((p): p is NonNullable<typeof p> => !!p);
    const fontCss = await embeddedFontCss(brand, film.scenes.flatMap((s) => Object.values(s.texts)).join(' '));
    const scenes = film.scenes.filter((s) => s.html && s.script).map((s) => ({ key: s.key, start: s.start, duration: s.duration, html: s.html!, script: s.script!, animation: s.animation ?? 'gsap', texts: s.texts }));
    const html = await buildComposition({ scenes, width: comp.width, height: comp.height, output: { width: spec.width, height: spec.height }, durationSec: film.durationSec, brand: brand.tokens, media, ...(logo ? { logo } : {}), ...(logoSvg ? { logoSvg } : {}), fontCss, mode, ...(patterns.length ? { patterns } : {}), ...(brand.styleId ? { styleId: brand.styleId } : {}), ...(audio ? { audio } : {}) });
    return { html, files, size: comp, out: { width: spec.width, height: spec.height }, fps: spec.fps };
  }

  /** Le contrôle technique d'un film HTML : erreurs de script par scène, et vignettes (un format, qualité réduite). */
  private async checkHtmlFilm(userId: string, projectId: string, video: MotionVideo, brand: FilmBrand): Promise<VideoFilm> {
    const film = video.film!;
    const format = video.scope.formats[0] || 'story';
    try {
      const project = await this.hyperframesProject(video, brand, format, 'render', 'standard');
      const probed = await probeComposition(project.html, project.files, film.scenes, project.out);
      const errors = new Map(probed.errors.map((e) => [e.key, e.message]));
      // Une scène du catalogue dont un texte ne tient pas, même au plus petit corps : à recomposer (candidat suivant).
      for (const key of probed.fit ?? []) if (!errors.has(key) && film.scenes.find((s) => s.key === key)?.catalog) errors.set(key, 'a text does not fit its zone, even at the smallest size allowed');
      const storage = this.mediaStorage();
      const folder = `users/${userId}/projects/${projectId}/videos/${video.id}/thumbs`;
      const stamp = Date.now().toString(36);
      const scenes = await Promise.all(
        film.scenes.map(async (sc) => {
          const shot = probed.thumbnails[sc.key];
          const thumbnail = shot ? (await storage.uploadFile(shot, `${sc.key}-${stamp}.jpg`, folder, 'image/jpeg').catch(() => null))?.downloadURL || sc.thumbnail : sc.thumbnail;
          const e = errors.get(sc.key);
          const { error: _e, ...clean } = sc;
          return e ? { ...clean, status: 'error' as const, error: { stage: 'runtime' as const, message: e.slice(0, 600) }, ...(thumbnail ? { thumbnail } : {}) } : { ...clean, status: (sc.html ? 'ready' : 'error') as FilmScene['status'], ...(thumbnail ? { thumbnail } : {}) };
        })
      );
      return { ...film, scenes, checkedAt: new Date().toISOString() };
    } catch (error: any) {
      // Le navigateur absent ou en panne : rien n'est jugé (le rendu dira ce qui ne va pas).
      logger.warn('video.hyperframes_check_failed', { videoId: video.id, error: error?.message });
      return film;
    }
  }

  /** La correction bornée d'un film HTML : chaque scène en erreur est réécrite une fois avec son erreur, puis recontrôlée. */
  private async repairHtmlScenes(userId: string, projectId: string, video: MotionVideo, ctx: Awaited<ReturnType<MotionVideoService['brandContext']>>, level: CreativityLevel): Promise<VideoFilm> {
    let film = video.film!;
    const broken = film.scenes.filter((sc) => sc.status === 'error' && sc.error);
    if (!broken.length) return film;
    // Un film d'avant le catalogue y passe d'abord (puis est recontrôlé).
    if (!film.catalog) {
      film = await this.catalogFilmOf(userId, projectId, video, ctx, level);
      film = await this.checkHtmlFilm(userId, projectId, { ...video, film }, ctx.film);
    }
    // Un film du CATALOGUE se corrige SANS modèle : chaque scène en défaut prend le candidat suivant de sa liste, deux
    // fois au plus, puis le film est réassemblé et recontrôlé.
    {
      for (let round = 0; round < 2; round++) {
        const bad = film.scenes.filter((sc) => sc.status === 'error' && sc.catalog);
        if (!bad.length) break;
        const input = this.catalogInput(userId, projectId, { ...video, film }, ctx.film, level);
        const scenes = [...film.scenes];
        let changed = false;
        for (const sc of bad) {
          const i = scenes.findIndex((s) => s.key === sc.key);
          const tried = [...(sc.catalog?.tried ?? []), JSON.stringify(sc.catalog)];
          const next = await nextSceneConfig(input, i, tried.map((t) => JSON.parse(t) as SceneConfig));
          if (!next) continue;
          scenes[i] = { ...sc, catalog: { ...next, tried } };
          changed = true;
        }
        if (!changed) break;
        film = await this.reassembleCatalogFilm(video, ctx.film, { ...film, scenes }, level);
        film = await this.checkHtmlFilm(userId, projectId, { ...video, film }, ctx.film);
      }
      return film;
    }
  }

  /** Le rendu d'un format par HyperFrames, avec la bande son mixée par le code d'IDEM. */
  private async renderHtmlFormat(video: MotionVideo, brand: FilmBrand, format: VideoFormat, o: { musicFile?: string; sfxFiles: Partial<Record<SfxKind, string | string[]>>; voiceFiles: { file: string; at: number }[]; onProgress: (r: number) => void }): Promise<{ file: string; poster: string; workDir: string; width: number; height: number; fps: number; sizeBytes: number; errors: { key: string; message: string }[] }> {
    const film = video.film!;
    const project = await this.hyperframesProject(video, brand, format, 'render', video.scope.quality);
    const style = (video.brief.style && video.brief.style !== 'auto' ? video.brief.style : 'energetic') as MotionStyle;
    const cues = Object.keys(o.sfxFiles).length ? refineCues(plannedCues(film).map((c) => ({ t: c.t, kind: c.kind as SfxKind, ...(c.gain !== undefined ? { gain: c.gain } : {}), ...(c.take !== undefined ? { take: c.take } : {}) })), style, film.durationSec, video.sfx?.intensity).filter((c) => o.sfxFiles[c.kind]) : [];
    const ambience = await this.foleyBeds(video);
    const out = await renderHyperFrames({
      ...(ambience.length ? { ambience } : {}),
      html: project.html,
      files: project.files,
      durationSec: film.durationSec,
      fps: project.fps,
      quality: video.scope.quality,
      ...(o.musicFile && video.music ? { music: { file: o.musicFile, startAt: video.music.startAt, ...(video.music.beat?.phrases?.length ? { phraseEnd: true } : {}) } } : {}),
      ...(cues.length ? { sfx: { files: o.sfxFiles, cues } } : {}),
      voice: o.voiceFiles,
      posterAt: Math.min(film.durationSec - 0.1, (film.scenes[0]?.start || 0) + Math.min((film.scenes[0]?.duration || 2) * 0.85, 2)),
      onProgress: o.onProgress,
    });
    return { ...out, width: project.out.width, height: project.out.height, fps: project.fps, errors: [] };
  }

  /**
   * Le BRUITAGE des clips générés (muets), par le serveur MMAudio d'IDEM s'il est configuré : un fichier par scène qui
   * montre un clip, posé à son début, sur la durée de la scène. Rien sans serveur.
   */
  private async foleyBeds(video: MotionVideo): Promise<{ file: string; at: number; duration: number }[]> {
    if (!foleyGenUrl() || !video.film) return [];
    const byId = new Map((video.media || []).map((m) => [m.id, m]));
    const beds: { file: string; at: number; duration: number }[] = [];
    for (const sc of video.film.scenes) {
      const clip = sc.media.map((id) => byId.get(id)).find((m) => m?.kind === 'video' && m.origin === 'generated');
      if (!clip) continue;
      const file = await generatedFoley({ videoUrl: clip.url, prompt: sc.purpose, durationSec: sc.duration, seed: video.film.seed ?? 0 });
      if (file) beds.push({ file, at: sc.start, duration: sc.duration });
    }
    return beds;
  }

  private snapToBeats(film: VideoFilm, voice: VideoVoice | undefined, beats: number[]): { film: VideoFilm; voice?: VideoVoice } | null {
    const lineOf = new Map((voice?.enabled ? voice.lines : []).map((l) => [l.sceneKey, l]));
    const snapped = snapCutsToBeats(film.scenes.map((sc) => ({ start: sc.start, duration: sc.duration, ...(lineOf.get(sc.key) ? { voice: { at: lineOf.get(sc.key)!.offset, duration: lineOf.get(sc.key)!.durationSec } } : {}) })), beats, { minDuration: 1 });
    if (snapped.every((s, i) => Math.abs(s.start - film.scenes[i].start) < 1e-6)) return null;
    const lines = (voice?.lines || []).map((l) => {
      const i = film.scenes.findIndex((sc) => sc.key === l.sceneKey);
      if (i < 0) return l;
      return { ...l, offset: Math.round((film.scenes[i].start + l.offset - snapped[i].start) * 1000) / 1000 };
    });
    if (lines.some((l) => l.offset < 0.04)) return null;
    return { film: { ...film, scenes: film.scenes.map((sc, i) => ({ ...sc, start: snapped[i].start, duration: snapped[i].duration })) }, ...(voice ? { voice: { ...voice, lines } } : {}) };
  }


  // ── Création ──────────────────────────────────────────────────────────────

  async createVideo(userId: string, projectId: string, rawInput: CreateVideoInput, paidCredits: number, onProgress?: VideoProgressListener): Promise<MotionVideo> {
    const started = Date.now();
    const emit = (stage: VideoProgressStage, state: 'running' | 'done', data?: Record<string, unknown>) => onProgress?.({ stage, state, ...(data ? { data } : {}) });
    const input = rawInput.contentId ? await this.inputFromContent(userId, projectId, rawInput) : rawInput;
    const brief = normalizeBrief(input.brief, input.language);
    const scope = normalizeScope(input.scope);
    const creativity = normalizeCreativity(input.creativity);
    const ctx = await this.brandContext(userId, projectId);
    const videoId = `video-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
    const seed = crypto.randomBytes(4).readUInt32BE(0);
    const agents: FilmAgentTrace[] = [];
    const trace = (agent: string, run: ModelRun, ok: boolean) => agents.push({ agent, source: ok ? 'llm' : 'none', tokens: run.tokens, ms: run.ms, ...(ok ? {} : { failure: run.failure || 'unreadable' }) });

    // 1. Compréhension
    emit('plan', 'running');
    const rawRequest = brief.request || [brief.message, brief.details].filter(Boolean).join('\n');
    // Les images de la marque, décrites (gardées par l'hôte) : le directeur de création sait ce qu'elles montrent.
    const brandMedia = await this.describedBrandMedia(userId, projectId, ctx.brandMedia, brief.media || []);
    // Le DIRECTEUR DE CRÉATION automatique (`video.brief`) : depuis le 22/11/2026 il ne part plus à chaque film — le
    // storyboard, en un seul appel, lit la demande entière, en tire l'idée, les temps forts, la musique et la voix.
    // `IDEM_VIDEO_AUTO_BRIEF=1` le rétablit ; « Améliorer ma demande » (bouton, gratuit) le garde toujours.
    const enhanced = process.env.IDEM_VIDEO_AUTO_BRIEF === '1'
      ? await this.enhanceVideoRequest(userId, rawRequest, brief.media || [], ctx, {
          durationSec: scope.durationSec,
          // Le choix de l'utilisateur (case « voix off », ou plan du calendrier) fait autorité : le brief ne le contredit jamais.
          voice: brief.voice === true,
          objective: brief.objective,
          language: brief.language,
          mediaNotes: [...(brief.media || []).filter((m) => m.kind === 'image' || m.kind === 'video').map((m) => `${m.kind === 'video' ? 'clip' : 'photo'} provided by the client${m.name ? `: ${m.name}` : ''}`), ...brandMedia.map((b) => `${b.kind === 'screen' ? 'screenshot of the brand' : 'brand photo'}: ${b.note}`)].filter((n) => n.length > 12),
        })
      : { prompt: rawRequest, source: 'template' as const };
    const request = enhanced.prompt || rawRequest;
    // Le reste de la création (intention, storyboard…) lit la même demande reformulée ; le brief structuré est gardé.
    brief.request = request;
    if (enhanced.brief) {
      brief.creative = { ...enhanced.brief, ...(input.voicePersona && VOICE_PERSONAS.some((p) => p.id === input.voicePersona) ? { persona: input.voicePersona as CreativeBrief['persona'] } : {}) };
      // La musique que le brief propose, quand l'utilisateur a laissé le choix.
      if (brief.musicMood === 'auto' && enhanced.brief.music) brief.musicMood = enhanced.brief.music;
    }
    const read = await readRequest(request, { fallbackLanguages: [input.language, ctx.brand.voice.language], writer: this.writer(userId, 'mechanical', 'video.reader') });
    const spec: RequestSpec = { ...read.spec, language: brief.language || read.spec.language };
    const language = spec.language || brief.language || 'fr';
    const intent = await this.readIntent(userId, input, brief, spec, ctx.brandMedia, creativity);
    // Les médias du film : imports d'abord, puis les images de la marque (captures, photos).
    const uploads = (brief.media || []).filter((m) => m.kind === 'image' || m.kind === 'video');
    const assets: VideoMediaAsset[] = [];
    const notes = new Map(brandMedia.map((b) => [b.url, b.note]));
    for (const m of uploads) assets.push({ ...m, id: `m${assets.length + 1}`, ...(notes.get(m.url) || m.name ? { name: (notes.get(m.url) || m.name)!.slice(0, 200) } : {}) });
    for (const b of brandMedia.filter((b) => !uploads.some((u) => u.url === b.url)).slice(0, 6)) assets.push({ id: `m${assets.length + 1}`, kind: 'image', url: b.url, origin: 'library', name: b.note.slice(0, 200) });
    // La petite sélection d'animations (Lottie rendues en clips transparents) : proposée, jamais imposée.
    for (const a of await libraryAnimationAssets(this.mediaStorage(), ctx.film.tokens.colors.primary).catch(() => [])) assets.push({ ...a, id: `m${assets.length + 1}` });
    // La démo produit demandée : ses écrans (avec le point de chaque action) rejoignent les médias du film.
    if (input.demo?.url) {
      const shots = await recordDemo({ url: input.demo.url, goal: input.demo.goal || request, device: input.demo.device, storage: this.mediaStorage(), folder: `users/${userId}/projects/${projectId}/videos/demo`, call: this.callContext(userId, projectId, creativity) }).catch((error) => {
        logger.warn('video.demo_failed', { error: (error as Error).message });
        return [];
      });
      for (const s of shots) assets.push({ ...s, id: `m${assets.length + 1}` });
    }
    emit('plan', 'done', { language, scripted: spec.mode === 'script', scenes: spec.scenes.length, media: assets.length });

    // 2-3. Direction et storyboard
    const reference = input.reference ? blueprintForDirector(input.reference, scope.durationSec) : undefined;
    const filmBrief: FilmBrief = {
      request,
      language,
      objective: brief.objective,
      type: input.type,
      intent,
      spec,
      brandSheet: ctx.sheet,
      anonymous: ctx.anonymous,
      format: scope.formats[0],
      durationSec: scope.durationSec,
      media: assets.map((m) => ({ id: m.id, kind: m.kind as 'image' | 'video', ...(m.name ? { note: m.name } : {}), ...(m.durationSec ? { durationSec: m.durationSec } : {}), origin: m.origin === 'upload' ? 'provided by the client' : 'brand' })),
      voice: brief.voice === true,
      newMedia: { images: brief.allowGenerate || brief.allowStock ? imageCap(scope.durationSec) : 0, clips: brief.allowGenerate || brief.allowStock ? Math.max(0, Number(process.env.VIDEO_GEN_MAX_CLIPS ?? 2)) : 0 },
      ...(reference ? { reference } : {}),
      ...(input.reference && !(spec.mode === 'script' && spec.scenes.length) ? { referenceShots: referenceShotCards(input.reference, sceneRange(scope.durationSec)[1]) } : {}),
      previous: ctx.others.filter((v) => v.film).slice(-6).map((v) => `${v.film!.title} — ${v.film!.concept}`.slice(0, 200)),
      // Jamais la même direction visuelle deux films de suite (le plus récent d'abord).
      previousDirections: ctx.others.filter((v) => v.film?.design).slice(-6).reverse().map((v) => v.film!.design!.direction),
      // Vidéo produit : les huit temps (accroche … signature) servent de squelette.
      skeleton: ['product', 'promotion', 'announce'].includes(brief.objective) || ['product', 'promo'].includes(String(input.type)),
      level: creativity,
      // L'axe de départ (plan qualité créative) : tiré par le code, jamais deux fois le même pour la marque.
      ...(() => {
        if (process.env.IDEM_QUALITY_EXPLORE === '0') return {};
        const axis = pickAxis({ seed: `${projectId}|${request.slice(0, 400)}`, country: ctx.brand.country, used: ctx.others.map((v) => v.film?.axis).filter((x): x is string => !!x), medium: 'video' });
        return { axis: { id: axis.id, line: axisLine(axis, 'video') } };
      })(),
    };
    const call = this.callContext(userId, projectId, creativity);
    // UN appel pour le film (22/11/2026) : le storyboard écrit aussi l'idée (titre, concept, direction, musique,
    // narrateur). L'ancien directeur (`video.concept`, et l'exploration en quatre pistes à l'Ultra) précédait le
    // storyboard et relisait toute la demande : `IDEM_VIDEO_CONCEPT=1` le rétablit.
    emit('concept', 'running');
    const conceived = process.env.IDEM_VIDEO_CONCEPT === '1' ? await runConcept(call, filmBrief) : null;
    if (conceived?.explore) trace('video.concept-explore', conceived.explore.run, !!conceived.explore.chosen);
    if (conceived) trace('video.concept', conceived.run, !!conceived.concept);
    const concept = conceived?.concept ?? null;
    emit('concept', 'done', concept ? { title: concept.title, concept: concept.concept } : conceived ? { failed: conceived.run.failure || 'unreadable' } : { inStoryboard: true });
    emit('storyboard', 'running');
    const timeline = spec.mode === 'script' && spec.scenes.length ? sceneTimeline(spec, scope.durationSec) : input.reference ? referenceTimeline(input.reference, scope.durationSec) : undefined;
    const planned = await runPlanner(call, filmBrief, concept, timeline);
    planned.runs.forEach((r, i) => trace(`video.planner${i ? `:${i + 1}` : ''}`, r, !!planned.storyboard && i === planned.runs.length - 1));
    if (!planned.storyboard || !planned.storyboard.scenes.length) {
      const failure = planned.runs[planned.runs.length - 1]?.failure;
      throw new VideoInputError(failure === 'no_model' ? 'model_unavailable' : 'storyboard_failed');
    }
    const sb: Storyboard = planned.storyboard;
    // La cadence (22/11/2026) : un film sans voix ni scénario ni modèle aux durées presque égales est un diaporama ; le
    // code module ses durées selon le rôle de chaque scène, à durée totale égale.
    if (!brief.voice && spec.mode !== 'script' && !input.reference) {
      const shaped = shapeCadence(sb.scenes, scope.durationSec);
      let at = 0;
      sb.scenes = shaped.map((s) => {
        const placed = { ...s, start: Math.round(at * 1000) / 1000 };
        at += s.duration;
        return placed;
      });
    }
    // L'idée écrite par le storyboard lui-même : la voix et la musique qu'il propose quand l'utilisateur a laissé le choix.
    if (!concept) {
      const persona = input.voicePersona && VOICE_PERSONAS.some((p) => p.id === input.voicePersona) ? (input.voicePersona as CreativeBrief['persona']) : sb.persona;
      if (!brief.creative && (persona || sb.music)) brief.creative = { voiceover: brief.voice === true, show: [], beats: [], ...(persona ? { persona } : {}), ...(sb.music ? { music: sb.music } : {}) };
      if (brief.musicMood === 'auto' && sb.music) brief.musicMood = sb.music;
    }
    // Ce que la demande exige et que la vidéo ne peut pas tenir (4K, 24 i/s…) : dit, jamais ignoré.
    for (const u of spec.unsupported || []) sb.fidelity.push(language.startsWith('en') ? `${u} requested: the video is delivered in ${scope.quality === 'standard' ? '720p' : '1080p'}, ${scope.quality === 'premium' ? 60 : 30} fps.` : `${u} demandé : la vidéo est livrée en ${scope.quality === 'standard' ? '720p' : '1080p'}, ${scope.quality === 'premium' ? 60 : 30} i/s.`);
    emit('storyboard', 'done', { title: sb.title, scenes: sb.scenes.map((s) => ({ duration: s.duration, purpose: s.purpose })) });

    let film: VideoFilm = {
      version: 2,
      engine: 'hyperframes',
      title: titleCase(sb.title || brief.message.slice(0, 60)),
      concept: sb.concept,
      bible: sb.bible,
      durationSec: scope.durationSec,
      seed,
      language,
      captions: intent.subtitles !== 'no',
      agents,
      ...(sb.fidelity.length ? { fidelity: { notes: sb.fidelity } } : {}),
      ...(input.reference ? { reference: { ...(input.reference.id ? { id: input.reference.id } : {}), summary: input.reference.summary.slice(0, 300) } } : {}),
      ...(filmBrief.axis ? { axis: filmBrief.axis.id } : {}),
      ...(conceived?.explore?.chosen ? { explored: { tracks: conceived.explore.tracks, chosen: conceived.explore.chosen.title, novelty: conceived.explore.novelty ?? 1 } } : {}),
      scenes: sb.scenes.map((s, i) => ({
        key: `s${i + 1}`,
        start: s.start,
        duration: s.duration,
        purpose: s.purpose,
        visual: s.visual,
        motion: s.motion,
        ...(s.transition ? { transition: s.transition } : {}),
        texts: s.texts,
        media: s.media,
        ...(s.needs.length ? { needs: s.needs } : {}),
        ...(s.voice ? { voiceText: s.voice } : {}),
        status: 'planned' as const,
      })),
    };

    // Le plan du film, calculé par le code (compilateur 0.3) : la direction visuelle (jamais celle du film précédent),
    // l'énergie de chaque scène, le système de design, les coutures entre scènes et les sons des transitions.
    const plan = planFilm({ brand: ctx.film, scenes: sb.scenes.map((s) => ({ role: s.role, energy: s.energy })), direction: concept?.direction ?? sb.direction, alternative: concept?.alternative ?? sb.alternative, energy: concept?.energy, previousDirection: filmBrief.previousDirections?.[0], seed });
    film = {
      ...film,
      design: plan.design,
      seams: plan.seams,
      transitionCues: plan.cues,
      direction: plan.direction,
      scenes: film.scenes.map((sc, i) => ({ ...sc, ...(plan.roles[i] ? { role: plan.roles[i] } : {}), energy: plan.design.energy[i] })),
    };

    // 4. Médias, musique, sons (en parallèle)
    const needs: ShotPlan[] = film.scenes.flatMap((sc, i) => (sc.needs || []).map((n, k) => ({ scene: i, sceneId: sc.key, kind: n.kind, slot: k, texts: Object.values(sc.texts), shot: n.shot, query: n.query, durationSec: sc.duration })));
    const mediaJob = (async () => {
      if (!needs.length) return { produced: [] as { plan: ShotPlan; asset: VideoMediaAsset }[], report: null as null | Awaited<ReturnType<typeof sourceShots>>['report'] };
      emit('media', 'running', { planned: needs.length });
      // L'ANCRE DE COHÉRENCE du film (22/11/2026, idée des « playbooks » d'OpenMontage) : toutes les images d'un film
      // partagent la même lumière, la même optique et la même ambiance — celles de la DA de la charte, assainies
      // (jamais de filtre de couleur : design-tools/photo-integrity) — et la même personne quand le film en a une.
      const daLook = naturalColourModifier([ctx.branding?.artDirection?.imagery?.lighting, ctx.branding?.artDirection?.imagery?.treatment].filter(Boolean).join(', '));
      const anchor = [spec.look, daLook, 'Same lighting, same lens and same colour mood in every shot of this film', spec.cast ? `the same person in every shot: ${spec.cast}` : ''].filter(Boolean).join('. ').slice(0, 420);
      const res = await sourceShots({
        direction: { look: anchor, shots: needs, source: 'llm' },
        orientation: orientationOf(scope.formats[0]),
        storage: this.mediaStorage(),
        folder: `users/${userId}/projects/${projectId}/videos/${videoId}/media`,
        allowGenerate: brief.allowGenerate !== false,
        allowStock: brief.allowStock !== false,
        // La qualité du modèle vidéo suit elle aussi le cran (le cran choisit la puissance des modèles).
        clipQuality: atLeast(creativity, 'high') ? 'quality' : 'speed',
        ...(spec.cast ? { cast: spec.cast } : {}),
        ...(await this.registryFor(userId, projectId)),
        onProgress: (done, total, last) => emit('media', 'running', { done, total, ...(last ? { last } : {}) }),
      }).catch((error) => {
        logger.warn('video.media_failed', { videoId, error: error?.message });
        return null;
      });
      const produced = res ? needs.filter((p) => res.byNeed.has(p)).map((plan) => ({ plan, asset: res.byNeed.get(plan)! })) : [];
      emit('media', 'done', res ? { generatedImages: res.report.generatedImages, generatedVideos: res.report.generatedVideos, stockPhotos: res.report.stockPhotos, stockVideos: res.report.stockVideos, missing: needs.length - produced.length, ...(res.report.blocked ? { blocked: res.report.blocked } : {}) } : { missing: needs.length });
      return { produced, report: res?.report || null };
    })();
    const musicJob = (async () => {
      if (brief.musicMood === 'none') return undefined;
      emit('music', 'running');
      const style = (brief.style && brief.style !== 'auto' ? brief.style : 'energetic') as MotionStyle;
      const music = await this.chooseMusic({ mood: spec.musicMood || brief.musicMood, style, objective: brief.objective, durationSec: scope.durationSec, seed, brandText: `${ctx.brand.voice.tone || ''} ${ctx.brand.voice.valueProposition || ''}`, avoidIds: ctx.others.map((v) => v.music?.id).filter((x): x is string => !!x) });
      emit('music', 'done', music ? { title: music.title, artist: music.artist, bpm: music.beat?.bpm } : { none: true });
      return music;
    })();
    const sfxJob = brief.sfx !== false ? this.chooseSfx(seed).catch(() => undefined) : Promise.resolve(undefined);
    const [media, music, sfx] = await Promise.all([mediaJob, musicJob, sfxJob]);
    for (const { plan, asset } of media.produced) {
      const id = `m${assets.length + 1}`;
      assets.push({ ...asset, id, name: (asset.name || plan.shot).slice(0, 200) });
      film.scenes[plan.scene] = { ...film.scenes[plan.scene], media: [...film.scenes[plan.scene].media, id] };
    }
    const say = (fr: string, en: string) => (language.startsWith('en') ? en : fr);
    const missing = needs.filter((p) => !media.produced.some((x) => x.plan === p));
    if (missing.length) film.fidelity = { notes: [...(film.fidelity?.notes || []), ...missing.map((p) => say(`Scène ${p.scene + 1} : aucun${p.kind === 'video' ? ' clip' : 'e photo'} n’a pu être obtenu${p.kind === 'video' ? '' : 'e'} (« ${p.shot.slice(0, 80)} »).`, `Scene ${p.scene + 1}: no ${p.kind === 'video' ? 'clip' : 'photo'} could be obtained ("${p.shot.slice(0, 80)}").`))] };
    film.scenes = film.scenes.map(({ needs: _n, ...sc }) => sc);

    // La préparation des médias (sans modèle) : recadrage par format, zone calme, teintes, extrait propre des clips,
    // étalonnage commun du film (jamais sur une capture d'interface).
    const screens = new Set([...brandMedia.filter((b) => b.kind === 'screen').map((b) => b.url), ...assets.filter((m) => m.prep?.screen).map((m) => m.url)]);
    if (assets.length) {
      emit('media', 'running', { preparing: assets.length });
      const prepared = await mapLimit(assets, 3, (m) => prepareMedia(m, { storage: this.mediaStorage(), folder: `users/${userId}/projects/${projectId}/videos/${videoId}/prepared`, formats: scope.formats, grade: plan.design.grade, brandHex: plan.design.colors.primary, screen: screens.has(m.url) }));
      assets.splice(0, assets.length, ...prepared);
      emit('media', 'done', { prepared: prepared.filter((m) => m.prep).length, graded: prepared.filter((m) => m.prep?.graded).length });
    }

    const style = (brief.style && brief.style !== 'auto' ? brief.style : 'energetic') as MotionStyle;
    let video: MotionVideo = {
      id: videoId,
      title: film.title,
      type: VIDEO_TYPES.includes(input.type as VideoType) ? (input.type as VideoType) : undefined,
      media: assets,
      ...(sfx ? { sfx } : {}),
      brief: { ...brief, spec, intent },
      scope,
      film,
      ...(music ? { music } : {}),
      renders: [],
      status: 'draft',
      paidCredits,
      exportCount: 0,
      creativity,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // La voix : dite avant le codage, pour que chaque scène connaisse sa durée finale et sa ligne.
    if (brief.voice) {
      emit('voice', 'running');
      const v = await this.voiceFilm({ userId, projectId, videoId, film, style, seed, scripted: spec.mode === 'script', ...(brief.creative?.persona || input.voicePersona ? { persona: brief.creative?.persona || input.voicePersona } : {}) });
      film = v.film;
      video = { ...video, film, voice: v.voice };
      if (v.failed.length) film.fidelity = { notes: [...(film.fidelity?.notes || []), ...v.failed.map((k) => say(`Scène ${k.slice(1)} : la voix off n’a pas pu être dite.`, `Scene ${k.slice(1)}: the voice-over could not be recorded.`))] };
      emit('voice', 'done', { lines: v.voice.lines.length, ...(v.voice.unavailable ? { unavailable: v.voice.unavailable } : {}) });
    }

    // Les coupes calées sur les temps de la musique (±120 ms), sans changer la durée achetée ni couper une ligne de voix.
    if (video.music?.beat?.beats?.length && (process.env.VIDEO_SNAP_CUTS ?? 'on') !== 'off') {
      const snapped = this.snapToBeats(film, video.voice, video.music.beat.beats);
      if (snapped) {
        film = snapped.film;
        video = { ...video, film, ...(snapped.voice ? { voice: snapped.voice } : {}) };
      }
    }

    // 5. Le rendu HYPERFRAMES (seul moteur) : chaque scène écrite en HTML Tailwind animé (GSAP), contrôlée par le
    //    code puis jouée dans Chrome.
    emit('code', 'running', { scenes: film.scenes.length, renderer: 'hyperframes' });
    video = { ...video, film };
    const hf = await this.authorHtmlFilm(userId, projectId, video, ctx, creativity, (key, done, ok) => emit('code', 'running', { done, total: film.scenes.length, scene: key, ok }));
    agents.push(...hf.traces);
    if (!hf.film) {
      logger.warn('video.hyperframes_failed', { event: 'video.hyperframes_failed', videoId, failed: hf.failed });
      throw new VideoInputError('author_failed');
    }
    film = hf.film;
    video = { ...video, film };
    emit('code', 'done', { ready: film.scenes.length, errors: [] });
    emit('check', 'running');
    film = await this.checkHtmlFilm(userId, projectId, video, ctx.film);
    film = await this.repairHtmlScenes(userId, projectId, { ...video, film }, ctx, creativity);
    emit('check', 'done', { errors: film.scenes.filter((s) => s.status === 'error').map((s) => ({ key: s.key, stage: s.error?.stage, message: s.error?.message })) });
    video = { ...video, film, record: recordFromVideo({ film, creativity, brief: video.brief }, Date.now() - started, (media.report?.assets || []).slice(0, 40)) };

    await this.store.saveVideo(userId, projectId, video);
    if (input.contentId) await this.store.linkVideoToContent?.(userId, projectId, input.contentId, video.id).catch(() => undefined);
    logger.info('video.created', { event: 'video.created', projectId, videoId, creativity, scenes: film.scenes.length, errors: film.scenes.filter((s) => s.error).length, ms: Date.now() - started });
    return withLiveProgress(video);
  }

  // ── Retouches ─────────────────────────────────────────────────────────────

  /**
   * Une retouche (gratuite). Les textes et les photos changent les DONNÉES (le code reste) ; une
   * demande visuelle, une correction ou une nouvelle version réécrivent le code de la scène visée
   * par l'auteur. Une réécriture qui ne compile pas ne remplace pas un code qui marchait : l'échec
   * est rendu dans le rapport, la scène reste telle qu'elle était.
   */
  async updateVideo(userId: string, projectId: string, videoId: string, rawPatch: VideoPatch, report: RevisionReport = emptyRevisionReport()): Promise<MotionVideo | null> {
    const current = (await this.store.listVideos(userId, projectId)).find((v) => v.id === videoId);
    if (!current) return null;
    if (!current.film) throw new VideoInputError('legacy_video');
    const patch = rawPatch as VideoPatch;
    const ctx = await this.brandContext(userId, projectId);
    const level = normalizeCreativity(current.creativity);
    let video: MotionVideo = { ...current, film: { ...current.film, scenes: current.film.scenes.map((s) => ({ ...s })) }, media: [...(current.media || [])] };
    let film = video.film!;
    const sceneOf = (key: string) => film.scenes.find((s) => s.key === key);
    let codeChanged = false;

    // Textes : seules les clés existantes de la scène (son code ne lit que celles-là ; la vidéo les pose au rendu,
    // sans réassembler la scène).
    for (const [key, texts] of Object.entries({ ...(patch.slots || {}), ...(patch.texts || {}) })) {
      const sc = sceneOf(key);
      if (!sc || !texts || typeof texts !== 'object') continue;
      for (const [k, v] of Object.entries(texts)) if (k in sc.texts && typeof v === 'string' && sc.texts[k] !== v) sc.texts[k] = v.replace(/\s+/g, ' ').trim().slice(0, 220);
    }
    // Photos : la première image de la scène est remplacée par l'import.
    for (const [key, url] of Object.entries(patch.images || {})) {
      const sc = sceneOf(key);
      if (!sc || !mediaUrlAllowed(String(url))) continue;
      const id = `m${(video.media || []).length + 1}-${crypto.randomBytes(2).toString('hex')}`;
      video.media!.push({ id, kind: 'image', url: String(url), origin: 'upload' });
      const firstImage = sc.media.findIndex((mid) => video.media!.find((m) => m.id === mid)?.kind === 'image');
      sc.media = firstImage >= 0 ? sc.media.map((mid, i) => (i === firstImage ? id : mid)) : [...sc.media, id];
    }

    // Code : retouches visuelles, corrections, nouvelles versions — toutes dans le CATALOGUE (seul moteur).
    /** Le code qui marchait avant une retouche visuelle : rendu si la retouche ne s'exécute pas, même après correction. */
    const before = new Map<string, FilmScene>();
    const visual = { ...(patch.visual || {}) };
    if (visual.all) {
      for (const sc of film.scenes) visual[sc.key] ??= visual.all;
      delete visual.all;
    }
    {
      const htmlJobs = [
        ...Object.entries(visual).filter(([key, instruction]) => sceneOf(key) && String(instruction || '').trim()).map(([key, instruction]) => ({ key, instruction: String(instruction).slice(0, 800), point: patch.points?.[key] })),
        ...(patch.regenerate || []).filter((key) => sceneOf(key)).map((key) => ({ key, instruction: undefined as string | undefined })),
        ...(patch.fix || []).filter((key) => sceneOf(key)?.status === 'error').map((key) => ({ key, instruction: undefined as string | undefined, fix: true })),
      ];
      let catalogChanged = false;
      // Un film d'avant le catalogue y passe d'abord : ses scènes ont alors chacune leur configuration.
      if (htmlJobs.length && !film.catalog) {
        film = await this.catalogFilmOf(userId, projectId, { ...video, film }, ctx, level);
        catalogChanged = true;
      }
      for (const job of htmlJobs) {
        const i = film.scenes.findIndex((sc) => sc.key === job.key);
        const sc = film.scenes[i];
        // Une scène du CATALOGUE : la consigne modifie sa configuration (un petit appel) ; « nouvelle version » et
        // « corriger » prennent le candidat suivant (aucun modèle). Le film est réassemblé une fois, à la fin.
        if (sc.catalog && film.catalog) {
          const input = this.catalogInput(userId, projectId, { ...video, film }, ctx.film, level);
          const tried = [...(sc.catalog.tried ?? []), JSON.stringify({ ...sc.catalog, tried: undefined })];
          let next: SceneConfig | null;
          if (job.instruction) {
            const r = await reviseSceneConfig(input, i, film.catalog.theme, { ...sc.catalog, tried: undefined } as SceneConfig, job.instruction, 'point' in job ? (job.point as ScenePoint | undefined) : undefined);
            film.agents = [...film.agents, { agent: `video.template:${job.key}:revise`, source: r.trace.source === 'llm' ? 'llm' : 'none', tokens: r.trace.tokens, ms: r.trace.ms, ...(r.trace.failure ? { failure: r.trace.failure.slice(0, 120) } : {}) }];
            next = r.config;
          } else next = await nextSceneConfig(input, i, tried.map((t) => JSON.parse(t) as SceneConfig));
          if (!next) {
            report.failed.push({ key: job.key, what: 'visual', reason: 'no other composition in the catalogue' });
            continue;
          }
          if (sc.status !== 'error') before.set(job.key, sc);
          film.scenes[i] = { ...sc, catalog: { ...next, tried }, author: { tokens: { input: 0, output: 0 }, ms: 0, at: new Date().toISOString(), attempts: 1, ...(job.instruction ? { instruction: job.instruction.slice(0, 400) } : {}) } };
          report.recoded.push(job.key);
          catalogChanged = true;
        }
      }
      if (catalogChanged) {
        film = await this.reassembleCatalogFilm(video, ctx.film, film, level);
        codeChanged = true;
      }
    }
    // Voix : ligne réécrite par l'utilisateur, activée ou coupée.
    for (const [key, text] of Object.entries(patch.voiceLines || {})) {
      const sc = sceneOf(key);
      if (sc && typeof text === 'string') sc.voiceText = text.replace(/\s+/g, ' ').trim().slice(0, 400);
    }
    const voiceKeys = Object.keys(patch.voiceLines || {}).filter((k) => sceneOf(k));
    if (patch.voice === false && video.voice) video.voice = { ...video.voice, enabled: false };
    if (patch.voice === true || (voiceKeys.length && video.voice?.enabled)) {
      // Une voix ajoutée après coup : le personnage du brief de production, sinon une voix chaleureuse (jamais tirée au
      // hasard parmi les voix « énergiques » : elles poussaient au cri).
      const v = await this.voiceFilm({ userId, projectId, videoId, film, style: 'corporate', seed: film.seed, persona: video.brief.creative?.persona || 'warm', scripted: video.brief.spec?.mode === 'script', ...(patch.voice === true && !video.voice?.lines.length ? {} : { only: voiceKeys }), ...(video.voice ? { previous: video.voice } : {}) });
      film = v.film;
      video = { ...video, film, voice: v.voice };
      report.voiced.push(...v.voiced);
      report.failed.push(...v.failed.map((key) => ({ key, what: 'voice' as const })));
    }
    if (typeof patch.captions === 'boolean') film = { ...film, captions: patch.captions };

    video = { ...video, film };
    // Musique, effets, périmètre.
    if (patch.musicMood || patch.musicTrackId) {
      const mood = MUSIC_MOODS.includes(patch.musicMood as MusicMood) ? (patch.musicMood as MusicMood) : video.brief.musicMood;
      video.brief = { ...video.brief, musicMood: mood };
      video.music = mood === 'none' ? undefined : await this.chooseMusic({ mood, style: 'energetic', objective: video.brief.objective, durationSec: film.durationSec, seed: crypto.randomBytes(4).readUInt32BE(0), avoidIds: video.music ? [video.music.id] : [], ...(patch.musicTrackId ? { trackId: String(patch.musicTrackId) } : {}) });
    }
    if (typeof patch.sfx === 'boolean') video.sfx = patch.sfx ? (video.sfx?.sounds && Object.keys(video.sfx.sounds).length ? { ...video.sfx, enabled: true } : await this.chooseSfx(film.seed)) : video.sfx ? { ...video.sfx, enabled: false } : undefined;
    if (patch.scope) {
      const next = normalizeScope({ ...video.scope, ...patch.scope, durationSec: video.scope.durationSec });
      video.scope = { ...next, durationSec: video.scope.durationSec };
    }
    if (codeChanged) video.film = await this.checkHtmlFilm(userId, projectId, video, ctx.film);
    // Une retouche visuelle qui ne s'exécute toujours pas ne remplace pas un code qui marchait.
    const restored: string[] = [];
    for (const [key, previous] of before) {
      const i = video.film!.scenes.findIndex((sc) => sc.key === key);
      if (i < 0 || video.film!.scenes[i].status !== 'error') continue;
      report.failed.push({ key, what: 'visual', reason: video.film!.scenes[i].error?.message });
      report.recoded = report.recoded.filter((k) => k !== key);
      video.film!.scenes[i] = previous;
      restored.push(key);
    }
    if (restored.length) video.film = await this.checkHtmlFilm(userId, projectId, video, ctx.film);

    const saved = await this.store.mutateVideo(userId, projectId, videoId, (v) => ({
      ...v,
      film: video.film,
      media: video.media,
      voice: video.voice,
      music: video.music,
      sfx: video.sfx,
      brief: video.brief,
      scope: video.scope,
      dirty: v.exportCount > 0 ? true : v.dirty,
      updatedAt: new Date().toISOString(),
    }));
    return saved ? withLiveProgress(saved) : null;
  }

  /**
   * Une retouche écrite en clair (« le titre de la scène 2 en … », « plus dynamique », « sans musique ») :
   * lue par le rôle `video.reviser`, au modèle du cran de la vidéo. Rend aussi ce qui a été écarté.
   */
  async reviseFromText(userId: string, projectId: string, videoId: string, text: string, language: string): Promise<{ video: MotionVideo | null; report: RevisionReport; reply?: string; newRequest: boolean; patch: VideoRevisionPatch; rejected: number }> {
    const video = await this.getVideo(userId, projectId, videoId);
    const report = emptyRevisionReport();
    if (!video?.film) return { video, report, newRequest: false, patch: {}, rejected: 0 };
    const { system, user } = buildVideoRevisionPrompt(video, text, video.brief.language || language);
    const run = await callFilmModel(this.callContext(userId, projectId, normalizeCreativity(video.creativity)), 'video.reviser', system, user);
    const revision = run.raw ? parseVideoRevision(run.raw, video) : null;
    if (revision?.newRequest) return { video, report, newRequest: true, patch: {}, rejected: 0 };
    const patch: VideoRevisionPatch = { ...videoSettingsFromText(text), ...(revision?.patch || {}) };
    if (!Object.keys(patch).length) return { video, report, newRequest: false, patch, rejected: revision?.rejected || 0 };
    const updated = await this.updateVideo(userId, projectId, videoId, patch, report);
    return { video: updated, report, ...(revision?.reply ? { reply: revision.reply } : {}), newRequest: false, patch, rejected: revision?.rejected || 0 };
  }

  // ── Aperçu ────────────────────────────────────────────────────────────────

  async previewHtml(userId: string, projectId: string, videoId: string, format?: VideoFormat): Promise<string | null> {
    const video = (await this.store.listVideos(userId, projectId)).find((v) => v.id === videoId);
    if (!video) return null;
    if (!video.film) throw new VideoInputError('legacy_video');
    const ctx = await this.brandContext(userId, projectId);
    const target = format && video.scope.formats.includes(format) ? format : video.scope.formats[0];
    const audio: CompositionInput['audio'] = {
      ...(video.music ? { music: { url: await this.previewTrackUrl(video.music), startAt: video.music.startAt, gain: previewGain(video.voice?.enabled ? MUSIC_UNDER_VOICE_DB : MUSIC_GAIN_DB) } } : {}),
      voice: voiceTimeline(video.film.scenes, video.voice, video.film.durationSec).map((l) => ({ url: l.url, at: l.at })),
    };
    return (await this.hyperframesProject(video, ctx.film, target, 'preview', 'hd', audio)).html;
  }

  // ── Lecture, suppression ─────────────────────────────────────────────────

  quoteExport(video: MotionVideo, scopeInput?: unknown): { cost: number; scope: VideoScope } {
    const scope = scopeInput ? { ...normalizeScope(scopeInput), durationSec: video.scope.durationSec } : video.scope;
    return { cost: exportCost({ paidCredits: video.paidCredits, exportCount: video.exportCount, scope, creativity: normalizeCreativity(video.creativity) }), scope };
  }

  async getVideo(userId: string, projectId: string, videoId: string): Promise<MotionVideo | null> {
    const video = (await this.store.listVideos(userId, projectId)).find((v) => v.id === videoId) || null;
    return video ? withLiveProgress(video) : null;
  }

  async listVideos(userId: string, projectId: string): Promise<MotionVideo[]> {
    const videos = await this.store.listVideos(userId, projectId);
    // Toute vidéo a une miniature dans la liste : celles dont les scènes n'ont jamais été photographiées
    // (contrôle qui n'a pas pu tourner) le sont en tâche de fond ; la liste suivante les montre.
    for (const v of videos) if (needsThumbnails(v)) void this.ensureThumbnails(userId, projectId, v.id);
    return videos.map(withLiveProgress);
  }

  /** Photographie les scènes d'une vidéo qui n'en a aucune vignette (une seule fois à la fois par vidéo). */
  async ensureThumbnails(userId: string, projectId: string, videoId: string): Promise<void> {
    if (thumbnailJobs.has(videoId) || isJobActive(videoId)) return;
    thumbnailJobs.add(videoId);
    try {
      const video = (await this.store.listVideos(userId, projectId)).find((v) => v.id === videoId);
      if (!video || !needsThumbnails(video)) return;
      const ctx = await this.brandContext(userId, projectId);
      const film = await this.checkHtmlFilm(userId, projectId, video, ctx.film);
      const shots = new Map(film.scenes.filter((sc) => sc.thumbnail).map((sc) => [sc.key, sc.thumbnail!]));
      if (!shots.size) return;
      // Seules les vignettes sont reprises : le reste du film (retouché entre-temps peut-être) n'est pas touché.
      await this.store.mutateVideo(userId, projectId, videoId, (v) => (v.film ? { ...v, film: { ...v.film, scenes: v.film.scenes.map((sc) => (shots.has(sc.key) && !sc.thumbnail ? { ...sc, thumbnail: shots.get(sc.key) } : sc)) } } : v));
      logger.info('video.thumbnails_backfilled', { videoId, scenes: shots.size });
    } catch (error: any) {
      logger.warn('video.thumbnails_failed', { videoId, error: error?.message });
    } finally {
      thumbnailJobs.delete(videoId);
    }
  }

  async deleteVideo(userId: string, projectId: string, videoId: string): Promise<boolean> {
    return this.store.removeVideo(userId, projectId, videoId);
  }

  // ── Export ────────────────────────────────────────────────────────────────

  /** Met l'export en file ; la progression se lit sur `GET …/videos/:id`. Refusé si une scène est en erreur. */
  async startExport(userId: string, projectId: string, videoId: string, scopeInput: unknown, charge?: RenderCharge, opts: { only?: VideoFormat[]; prerender?: boolean } = {}): Promise<MotionVideo | null> {
    const current = (await this.store.listVideos(userId, projectId)).find((v) => v.id === videoId);
    if (!current) return null;
    if (!current.film) throw new VideoInputError('legacy_video');
    if (current.film.scenes.some((s) => s.status === 'error' || !(s.html && s.script))) throw new VideoInputError('scene_errors');
    if (isJobActive(videoId)) throw new VideoInputError('already_rendering');
    const { scope } = this.quoteExport(current, scopeInput);
    const only = opts.only?.filter((f) => scope.formats.includes(f));
    const targets = only?.length ? only : scope.formats;
    const queued: VideoRender[] = targets.map((format) => ({ format, status: 'queued', progress: 0 }));
    const renders = (keep: VideoRender[]) => (only?.length ? [...keep.filter((r) => !targets.includes(r.format) && scope.formats.includes(r.format)), ...queued] : queued);
    const updated = await this.store.mutateVideo(userId, projectId, videoId, (v) => ({
      ...v,
      scope,
      status: 'rendering',
      renders: renders(v.renders),
      paidCredits: opts.prerender ? v.paidCredits : Math.max(v.paidCredits, videoCost(scope)),
      updatedAt: new Date().toISOString(),
    }));
    if (!updated) return null;
    const job: RenderJob = { userId, projectId, videoId, charge, paidBefore: current.paidCredits, service: this, formats: targets, ...(opts.prerender ? { prerender: true } : {}) };
    if (opts.prerender) renderQueue.push(job);
    else {
      const firstPrerender = renderQueue.findIndex((j) => j.prerender);
      renderQueue.splice(firstPrerender < 0 ? renderQueue.length : firstPrerender, 0, job);
    }
    pumpQueue();
    return withLiveProgress(updated);
  }

  /** Rend d'avance le format principal (ni compté ni facturé ; il devient un export au premier téléchargement). */
  async prerender(userId: string, projectId: string, videoId: string): Promise<void> {
    if (process.env.VIDEO_PRERENDER === '0' || isJobActive(videoId)) return;
    const video = (await this.store.listVideos(userId, projectId)).find((v) => v.id === videoId);
    const format = video?.scope.formats[0];
    if (!video?.film || !format || video.film.scenes.some((s) => s.status === 'error') || video.renders.some((r) => r.format === format && isRenderFresh(video, r))) return;
    await this.startExport(userId, projectId, videoId, video.scope, undefined, { only: [format], prerender: true }).catch((error) => {
      if (!(error instanceof VideoInputError)) logger.warn('video.prerender_failed', { videoId, error: error?.message });
    });
  }

  downloadPlan(video: MotionVideo, format: VideoFormat): { state: 'ready' } | { state: 'claim'; cost: number } | { state: 'busy'; progress: number } | { state: 'start'; cost: number; scope: VideoScope } {
    const live = withLiveProgress(video);
    const render = live.renders.find((r) => r.format === format && isRenderFresh(video, r));
    if (render && !render.prerender) return { state: 'ready' };
    if (render?.prerender) return { state: 'claim', cost: exportCost({ paidCredits: video.paidCredits, exportCount: video.exportCount, scope: video.scope, creativity: normalizeCreativity(video.creativity) }) };
    if (isJobActive(video.id)) {
      const r = live.renders.find((x) => x.format === format && (x.status === 'rendering' || x.status === 'queued'));
      return { state: 'busy', progress: r?.progress || 0 };
    }
    const scope = { ...video.scope, formats: [...new Set([...video.scope.formats, format])] };
    return { state: 'start', ...this.quoteExport(video, scope) };
  }

  downloadOptions(video: MotionVideo): { format: VideoFormat; ready: boolean; cost: number; busy: boolean }[] {
    return VIDEO_FORMATS.map((format) => {
      const plan = this.downloadPlan(video, format);
      return { format, ready: plan.state === 'ready', busy: plan.state === 'busy', cost: plan.state === 'claim' || plan.state === 'start' ? plan.cost : 0 };
    });
  }

  async claimRender(userId: string, projectId: string, videoId: string, format: VideoFormat): Promise<boolean> {
    let claimed = false;
    await this.store.mutateVideo(userId, projectId, videoId, (v) => {
      const target = v.renders.find((r) => r.format === format && r.prerender && isRenderFresh(v, r));
      if (!target) return v;
      claimed = true;
      return { ...v, exportCount: v.exportCount + 1, dirty: false, renders: v.renders.map((r) => (r === target ? { ...r, prerender: undefined } : r)), updatedAt: new Date().toISOString() };
    });
    return claimed;
  }

  async markExportFailed(job: Pick<RenderJob, 'userId' | 'projectId' | 'videoId' | 'paidBefore' | 'prerender'>, error = 'render_failed'): Promise<void> {
    await this.store.mutateVideo(job.userId, job.projectId, job.videoId, (v) => ({
      ...v,
      status: job.prerender ? (v.renders.some((r) => r.status === 'done') ? 'ready' : 'draft') : 'failed',
      paidCredits: job.paidBefore,
      renders: v.renders.map((r) => (r.status === 'done' ? r : { ...r, status: 'failed', error })),
    }));
  }

  /** Le travail de fond : chaque format est rendu par HyperFrames, mixé, déposé, puis inscrit. */
  async runExport(job: RenderJob): Promise<void> {
    const { userId, projectId, videoId } = job;
    const video = (await this.store.listVideos(userId, projectId)).find((v) => v.id === videoId);
    if (!video?.film) return;
    const ctx = await this.brandContext(userId, projectId);
    const film = video.film;
    const sfxFiles = await this.sfxFiles(video.sfx, true);
    let musicFile: string | undefined;
    if (video.music) musicFile = await fetchTrack(video.music).catch((error) => (logger.warn('video.music_download_failed', { videoId, error: error.message }), undefined));
    const voiceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'idem-voice-render-'));
    const voiceFiles: { file: string; at: number }[] = [];
    await Promise.all(
      voiceTimeline(film.scenes, video.voice, film.durationSec).map(async (line, i) => {
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
    let sceneErrors: { key: string; message: string }[] = [];
    const formats = job.formats?.length ? job.formats : video.scope.formats;
    const share = Math.max(1, Math.floor(renderConcurrency() / formats.length));
    await Promise.all(
      formats.map(async (format) => {
        liveProgress.set(`${videoId}:${format}`, 0);
        let workDir: string | undefined;
        try {
          const out = await this.renderHtmlFormat(video, ctx.film, format, { musicFile, sfxFiles, voiceFiles, onProgress: (r) => liveProgress.set(`${videoId}:${format}`, r) });
          workDir = out.workDir;
          if (out.errors.length) {
            // Une scène a échoué pendant le rendu : le fichier montrerait une erreur, il n'est pas livré.
            sceneErrors = out.errors.map((e) => ({ key: e.key, message: e.message }));
            throw new Error(`scene_error: ${out.errors.map((e) => `${e.key} ${e.message}`).join(' · ').slice(0, 300)}`);
          }
          const folder = `users/${userId}/projects/${projectId}/videos/${videoId}`;
          const stamp = Date.now().toString(36);
          const [mp4, poster] = await Promise.all([
            requirePort('storage').uploadFile(fs.readFileSync(out.file), `${format}-${stamp}.mp4`, folder, 'video/mp4'),
            requirePort('storage').uploadFile(fs.readFileSync(out.poster), `${format}-${stamp}.jpg`, folder, 'image/jpeg'),
          ]);
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
            key: renderSignature(video, format),
            ...(job.prerender ? { prerender: true } : {}),
          });
        } catch (error: any) {
          logger.error('video.render_failed', { event: 'video.render_failed', videoId, format, error: error.message, stack: error.stack });
          results.push({ format, status: 'failed', progress: 0, error: /^scene_error/.test(error.message) ? 'scene_error' : 'render_failed' });
        } finally {
          liveProgress.delete(`${videoId}:${format}`);
          if (workDir) fs.rmSync(workDir, { recursive: true, force: true });
        }
        await this.store.mutateVideo(userId, projectId, videoId, (v) => ({ ...v, renders: v.renders.map((r) => results.find((x) => x.format === r.format) || r) }));
      })
    );
    fs.rmSync(voiceDir, { recursive: true, force: true });

    const allFailed = results.every((r) => r.status === 'failed');
    const markErrors = (v: MotionVideo): MotionVideo =>
      sceneErrors.length && v.film ? { ...v, film: { ...v.film, scenes: v.film.scenes.map((s) => { const e = sceneErrors.find((x) => x.key === s.key); return e ? { ...s, status: 'error' as const, error: { stage: 'runtime' as const, message: e.message.slice(0, 600) } } : s; }) } } : v;
    if (job.prerender) {
      await this.store.mutateVideo(userId, projectId, videoId, (v) => markErrors({ ...v, status: v.renders.some((r) => r.status === 'done') ? 'ready' : 'draft' }));
      return;
    }
    await this.store.mutateVideo(userId, projectId, videoId, (v) =>
      markErrors({
        ...v,
        status: allFailed ? 'failed' : 'ready',
        exportCount: allFailed ? v.exportCount : v.exportCount + 1,
        paidCredits: allFailed ? job.paidBefore : v.paidCredits,
        dirty: allFailed ? v.dirty : false,
        updatedAt: new Date().toISOString(),
      })
    );
    if (allFailed && job.charge && job.charge.cost > 0) await refundCharge(userId, job.charge, 'Export vidéo en échec — crédits restitués');
  }
}

// ─── Minutage d'une vidéo modèle ────────────────────────────────────────────

/** Les vidéos dont les vignettes sont en cours de prise (une à la fois par vidéo). */
const thumbnailJobs = new Set<string>();

/** Une vidéo du moteur actuel sans aucune image pour la liste (ni rendu, ni vignette de scène). */
function needsThumbnails(video: MotionVideo): boolean {
  if (!video.film?.scenes.length) return false;
  if (video.renders.some((r) => r.status === 'done' && r.posterUrl)) return false;
  return !video.film.scenes.some((sc) => sc.thumbnail);
}

function referenceTimeline(bp: ReferenceBlueprint, total: number): { start: number; duration: number }[] | undefined {
  const [, max] = sceneRange(total);
  const shots = bp.shots.slice(0, max);
  if (!shots.length) return undefined;
  const sum = shots.reduce((a, s) => a + s.duration, 0) || 1;
  let start = 0;
  return shots.map((s) => {
    const duration = round3((s.duration * total) / sum);
    const at = round3(start);
    start += duration;
    return { start: at, duration };
  });
}

// ─── Fraîcheur d'un rendu ───────────────────────────────────────────────────

/** La signature de ce qu'un MP4 montre et fait entendre : code, textes, médias, minutage, sons, voix, format, qualité. */
export function renderSignature(video: MotionVideo, format: VideoFormat, quality: VideoQuality = video.scope.quality): string {
  const film = video.film;
  const payload = JSON.stringify({
    format,
    quality,
    scenes: (film?.scenes || []).map((s) => [s.key, s.start, s.duration, s.code, s.texts, s.media]),
    media: (video.media || []).map((m) => [m.id, m.url]),
    captions: film?.captions,
    music: video.music ? [video.music.id, video.music.url, video.music.startAt] : null,
    sfx: video.sfx?.enabled ? [video.sfx.intensity || '', Object.values(video.sfx.sounds || {}).map((x) => x?.id)] : null,
    voice: video.voice?.enabled ? video.voice.lines.map((l) => [l.sceneKey, l.url, l.offset]) : null,
  });
  return crypto.createHash('sha1').update(payload).digest('hex').slice(0, 20);
}

export function isRenderFresh(video: MotionVideo, render: VideoRender): boolean {
  if (render.status !== 'done' || !render.url) return false;
  if (!video.film) return true;
  return render.key ? render.key === renderSignature(video, render.format, render.quality || video.scope.quality) && (render.quality || video.scope.quality) === video.scope.quality : !video.dirty;
}

function renderConcurrency(): number {
  return Math.max(1, Number(process.env.VIDEO_RENDER_CONCURRENCY) || Math.min(6, Math.max(1, Math.floor(os.cpus().length * 0.75))));
}

async function downloadTo(url: string, file: string): Promise<void> {
  if (url.startsWith('file://') && process.env.VIDEO_ALLOW_FILE_URLS === '1' && process.env.NODE_ENV !== 'production') {
    fs.copyFileSync(url.replace('file://', ''), file);
    return;
  }
  if (!/^https?:\/\//.test(url)) throw new Error('voice_url_refused');
  const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000, maxContentLength: 20 * 1024 * 1024 });
  fs.writeFileSync(file, Buffer.from(res.data));
}

async function refundCharge(userId: string, charge: RenderCharge, note: string): Promise<void> {
  try {
    await requirePort('refundCredits')(userId, charge.cost, { action: charge.action, note });
  } catch (error: any) {
    logger.error(`billing.refund_failed: ${error.message}`, { event: 'billing.refund_failed', userId, ...charge });
  }
}

// ─── File de rendu (un rendu à la fois par instance, VIDEO_RENDER_JOBS pour davantage) ──────

export interface RenderJob {
  userId: string;
  projectId: string;
  videoId: string;
  charge?: RenderCharge;
  paidBefore: number;
  service: MotionVideoService;
  formats?: VideoFormat[];
  prerender?: boolean;
}

const renderQueue: RenderJob[] = [];
let runningJobs = 0;
const runningVideos = new Set<string>();
const liveProgress = new Map<string, number>();

function isJobActive(videoId: string): boolean {
  return runningVideos.has(videoId) || renderQueue.some((j) => j.videoId === videoId);
}

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
        if (job.prerender) void job.service.prerender(job.userId, job.projectId, job.videoId).catch(() => undefined);
        pumpQueue();
      });
  }
}

export async function drainRenderQueue(): Promise<void> {
  while (runningJobs > 0 || renderQueue.length) await new Promise((r) => setTimeout(r, 200));
}

/** Progression en mémoire fusionnée dans la vidéo lue en base ; une vidéo de l'ancien moteur est marquée `legacy`. */
function withLiveProgress(video: MotionVideo): MotionVideo {
  video = { ...video, ...(video.film ? {} : { legacy: true }), renders: video.renders.map((r) => (r.status === 'done' && r.url && !isRenderFresh(video, r) ? { ...r, stale: true } : r)) };
  if (video.status !== 'rendering') return video;
  if (!isJobActive(video.id)) {
    return { ...video, status: video.renders.some((r) => r.status === 'done') ? 'ready' : 'failed', renders: video.renders.map((r) => (r.status === 'done' ? r : { ...r, status: 'failed', error: 'interrupted' })) };
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

/** `fn` sur chaque élément, `limit` à la fois ; l'ordre des résultats suit celui des éléments. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const k = next++;
      out[k] = await fn(items[k]);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return out;
}
