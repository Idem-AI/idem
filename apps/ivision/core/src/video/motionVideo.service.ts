/**
 * VIDÉOS MOTION DESIGN — l'orchestrateur (moteur Motion Canvas).
 *
 *   1. compréhension   la demande lue en entier (scénario, textes mot pour mot, langue), l'intention ;
 *   2. direction       le directeur invente le film (concept, bible, idée par scène) — dès Medium ;
 *   3. storyboard      le planificateur précise chaque scène (durée, intention, idées, textes, médias, voix) ;
 *   4. médias          imports et captures de la marque d'abord, puis génération, puis banque d'images ;
 *      musique, sons   banques libres, tempo analysé ; sonothèque CC0 ;
 *      voix off        dite, puis les scènes calées sur elle (sans changer la durée achetée) ;
 *   5. auteur          le code Motion Canvas de chaque scène, écrit par l'IA, gardé TEL QUEL ;
 *   6. contrôle        chaque scène compilée et exécutée : erreurs TECHNIQUES attribuées à leur scène,
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
import { enhanceRequest } from './request/enhance';
import { MediaInputError, MediaStorage, Orientation, processUpload } from './assets/media';
import { ShotPlan, sourceShots, SourcingOptions } from './assets/sourcing';
import { describeBrandMedia } from './assets/brandmedia';
import { embeddedFontCss, filmBrand, FilmBrand } from './assets/brand';
import { analyzeTrack, pickExcerptStart } from './audio/beats';
import { fetchTrack, pickTrack, resolveMood, searchMusic, MUSIC_PROVIDERS } from './audio/music';
import { ensureSfxLibrary, MUSIC_GAIN_DB, MUSIC_UNDER_VOICE_DB, pickSounds, previewGain, publicSoundName, SFX_GAIN_DB, sfxLibrary, SfxLibrary, soundFile } from './audio/sfx';
import { cleanSpoken, fitScenesToVoice, personaById, personaMenu, speakable, speechAvailable, synthesizeVoice, voiceTimeline } from './audio/voice';
import { callFilmModel, FilmCallContext, ModelRun, tierFor } from './agents';
import { FilmBrief, sceneRange } from './director/brief';
import { runConcept } from './director/concept.agent';
import { runPlanner, Storyboard } from './director/storyboard.agent';
import { AuthorContext } from './author/context-builder';
import { authorScene, authorScenes, AuthoredScene } from './author/motion-canvas.author';
import { pickSnippets } from './author/snippets';
import { RepairLedger, strategyLevel } from './author/repair';
import { buildFilmBundle, BundleScene } from './rendering/compiler';
import { COMPOSITION, frameSpec } from './rendering/formats';
import { cleanupFilmRender, localizeFilm, probeFilm, renderFilm } from './rendering/runner';
import { previewPageHtml } from './rendering/preview';
import { exportCost, normalizeScope, videoCost } from './pricing';
import { recordFromVideo } from './record';
import { buildVideoRevisionPrompt, parseVideoRevision, VideoRevisionPatch, videoSettingsFromText } from './revise';
import type { FilmAudio, FilmData } from '../../motion/runtime/film-data';
import type { ReferenceBlueprint } from '../reference/reference.analyzer';
import { blueprintForDirector } from '../reference/reference.plan';

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

  /** « Améliorer ma demande » : réécriture précise, faits conservés (gratuit). */
  async enhanceRequest(userId: string, projectId: string, text: string, media: VideoMediaAsset[] = []): Promise<{ prompt: string; source: 'llm' | 'template' }> {
    if (parseRequest(String(text || '')).mode === 'script') return { prompt: String(text).trim().slice(0, MAX_REQUEST_CHARS), source: 'template' };
    const clean = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 1200);
    if (clean.length < 3) throw new VideoInputError('message_required');
    const { brand, brandName, branding } = await this.brandContext(userId, projectId);
    const count = (kind: string) => media.filter((m) => m?.kind === kind).length;
    const art = branding?.artDirection ? [branding.artDirection.styleName, branding.artDirection.tagline, (branding.artDirection.keywords || []).slice(0, 5).join(', ')].filter(Boolean).join(' · ') : undefined;
    const result = await enhanceRequest(
      { text: clean, ctx: { brandName, businessType: brand.voice.businessType, tone: brand.voice.tone, valueProposition: brand.voice.valueProposition, keywords: brand.voice.keywords, language: brand.voice.language || 'fr' }, media: { images: count('image'), videos: count('video'), models: 0, lotties: 0 }, art },
      this.writer(userId)
    );
    return { prompt: result.prompt, source: result.source };
  }

  private async inputFromContent(userId: string, projectId: string, input: CreateVideoInput): Promise<CreateVideoInput> {
    const content = (await this.store.briefFromContent?.(userId, projectId, input.contentId!)) || null;
    if (!content) return input;
    const brief = { ...(input.brief || {}) };
    if (!brief.message || String(brief.message).trim().length < 3) brief.message = content.message.slice(0, 400);
    if (!brief.details && content.details) brief.details = content.details.slice(0, 800);
    if (!brief.objective && content.objective) brief.objective = content.objective;
    return { ...input, brief, type: input.type || content.type || 'auto' };
  }

  // ── Médias ────────────────────────────────────────────────────────────────

  /** Un import de l'utilisateur : photo ou clip (le moteur Motion Canvas ne lit ni 3D, ni Lottie, ni Rive). */
  async uploadMedia(userId: string, projectId: string, file: { buffer: Buffer; mimetype: string; originalname: string }): Promise<VideoMediaAsset> {
    const asset = await processUpload(file, this.mediaStorage(), `users/${userId}/projects/${projectId}/videos/uploads`);
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
    const picked = pickSounds(await this.library(), seed);
    const sounds: VideoSfx['sounds'] = {};
    for (const [kind, sound] of Object.entries(picked)) {
      const { file: _file, score: _score, ...rest } = sound;
      sounds[kind as SfxKind] = rest;
    }
    return { enabled: true, sounds };
  }

  private async sfxFiles(sfx?: VideoSfx): Promise<Partial<Record<SfxKind, string>>> {
    const out: Partial<Record<SfxKind, string>> = {};
    if (!sfx?.enabled) return out;
    for (const [kind, sound] of Object.entries(sfx.sounds)) {
      const file = sound ? await soundFile(sound) : null;
      if (file) out[kind as SfxKind] = file;
    }
    return out;
  }

  // ── Musique ───────────────────────────────────────────────────────────────

  async chooseMusic(opts: { mood: MusicMood; style: MotionStyle; objective: VideoObjective; durationSec: number; seed: number; avoidIds?: string[]; trackId?: string; brandText?: string }): Promise<VideoMusic | undefined> {
    const mood = resolveMood(opts.mood, opts.style, opts.objective, opts.brandText);
    if (!mood) return undefined;
    try {
      const candidates = await searchMusic({ mood, minDuration: opts.durationSec + 3 }, MUSIC_PROVIDERS);
      const first = opts.trackId ? candidates.find((t) => t.id === opts.trackId) || null : pickTrack(candidates, opts.seed, opts.avoidIds);
      if (!first) return undefined;
      const queue = [first, ...candidates.filter((t) => t.id !== first.id && !(opts.avoidIds || []).includes(t.id)).slice(0, 2)];
      let fallback: VideoMusic | undefined;
      for (const track of queue) {
        const prepared = await this.prepareTrack(track, opts.durationSec);
        if (prepared.beat) return prepared;
        fallback ??= prepared;
      }
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
      return {
        ...track,
        durationSec: track.durationSec || analysis.durationSec,
        startAt: pickExcerptStart(analysis, durationSec),
        beat: { bpm: track.bpm && Math.abs(track.bpm - analysis.bpm) < 4 ? track.bpm : analysis.bpm, offset: 0, confidence: analysis.confidence },
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
  private async voiceFilm(o: { userId: string; projectId: string; videoId: string; film: VideoFilm; style: MotionStyle; seed: number; only?: string[]; scripted: boolean; previous?: VideoVoice }): Promise<{ film: VideoFilm; voice: VideoVoice; voiced: string[]; failed: string[] }> {
    const base: VideoVoice = { enabled: true, language: o.film.language.slice(0, 5), persona: o.previous?.persona || 'warm', provider: 'openrouter', model: '', voice: '', source: 'llm', lines: [] };
    if (!speechAvailable()) return { film: o.film, voice: { ...base, enabled: false, unavailable: 'no_speech_model' }, voiced: [], failed: [] };
    const persona = o.previous?.persona ? personaById(o.previous.persona) : personaMenu(o.style, o.seed)[0];
    const keep = (o.previous?.lines || []).filter((l) => o.only && !o.only.includes(l.sceneKey));
    const wanted = o.film.scenes
      .map((sc, i) => ({ sc, i, text: cleanSpoken(sc.voiceText || '', 60, o.film.language, `${sc.voiceText}`) }))
      .filter((x) => x.text && (!o.only || o.only.includes(x.sc.key)));
    if (!wanted.length) return { film: o.film, voice: { ...base, persona: persona.id, lines: keep }, voiced: [], failed: [] };
    try {
      const said = await synthesizeVoice({
        lines: wanted.map((x) => ({ index: x.i, text: x.text, maxSec: speakable(x.sc.duration, x.i === 0) * 1.25 })),
        language: o.film.language,
        persona,
        storage: this.mediaStorage(),
        folder: `users/${o.userId}/projects/${o.projectId}/videos/${o.videoId}/voice`,
      });
      const fresh = said.lines.map((l) => ({ sceneKey: o.film.scenes[l.index].key, text: l.text, url: l.url, durationSec: l.durationSec }));
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

  // ── Données du film (aperçu, contrôle, rendu) ────────────────────────────

  /** Les données que lit le harnais : composition du format, marque, textes, médias, voix, tempo, sous-titres. */
  private filmData(video: MotionVideo, brand: FilmBrand, format: VideoFormat, mode: 'preview' | VideoQuality): FilmData {
    const film = video.film!;
    const spec = frameSpec(format, mode === 'preview' ? 'hd' : mode);
    const byId = new Map((video.media || []).map((m) => [m.id, m]));
    const voiceOf = new Map((video.voice?.enabled ? video.voice.lines : []).map((l) => [l.sceneKey, l]));
    const captions =
      film.captions && video.voice?.enabled
        ? voiceTimeline(film.scenes, video.voice, film.durationSec).map((l) => ({ text: l.text, start: l.at, end: Math.min(film.durationSec, l.at + l.durationSec + 0.2) }))
        : [];
    return {
      format,
      ...COMPOSITION[format],
      resolutionScale: mode === 'preview' ? 0.5 : spec.scale,
      fps: spec.fps,
      background: brand.tokens.colors.background,
      brand: brand.tokens,
      fontFamilies: [...new Set([brand.tokens.fonts.display, brand.tokens.fonts.body])],
      lang: (film.language || 'fr').startsWith('en') ? 'en' : 'fr',
      ...(video.music?.beat?.bpm ? { beat: { bpm: video.music.beat.bpm, offset: video.music.beat.offset || 0 } } : {}),
      ...(captions.length ? { captions } : {}),
      scenes: film.scenes.map((sc) => {
        const line = voiceOf.get(sc.key);
        return {
          key: sc.key,
          start: sc.start,
          duration: sc.duration,
          texts: sc.texts,
          media: sc.media
            .map((id) => byId.get(id))
            .filter((m): m is VideoMediaAsset => !!m && (m.kind === 'image' || m.kind === 'video'))
            .map((m) => ({ id: m.id, kind: m.kind as 'image' | 'video', url: m.url, width: m.width || 0, height: m.height || 0, ...(m.durationSec ? { durationSec: m.durationSec } : {}), ...(m.name ? { note: m.name } : {}) })),
          ...(line ? { voice: { text: line.text, at: line.offset, duration: line.durationSec } } : {}),
          ...(!sc.code || sc.error?.stage === 'compile' || sc.error?.stage === 'author' ? { compileError: sc.error?.message || 'aucun code' } : {}),
        };
      }),
    };
  }

  private bundleCache = new Map<string, Promise<string>>();

  /** Le paquet d'un film (mis en cache sur la signature de son code). */
  private bundle(film: VideoFilm, mode: 'render' | 'preview'): Promise<string> {
    const scenes: BundleScene[] = film.scenes.map((sc) => ({ key: sc.key, ...(sc.code && !sc.error?.stage?.match(/compile|author/) ? { code: sc.code } : {}) }));
    const key = `${mode}:${crypto.createHash('sha1').update(JSON.stringify(scenes)).digest('hex')}`;
    let job = this.bundleCache.get(key);
    if (!job) {
      job = buildFilmBundle(scenes, mode);
      this.bundleCache.set(key, job);
      job.catch(() => this.bundleCache.delete(key));
      if (this.bundleCache.size > 24) this.bundleCache.delete(this.bundleCache.keys().next().value as string);
    }
    return job;
  }

  /**
   * Le CONTRÔLE TECHNIQUE : chaque scène est exécutée une fois. Les erreurs d'exécution sont
   * attribuées à leur scène (elles ne changent ni le code ni le film), les vignettes déposées,
   * les effets sonores posés par le code relevés.
   */
  private async checkFilm(userId: string, projectId: string, video: MotionVideo, brand: FilmBrand): Promise<VideoFilm> {
    const film = video.film!;
    try {
      const data = this.filmData(video, brand, video.scope.formats[0] || 'story', 'standard');
      const local = await localizeFilm({ ...data, resolutionScale: 0.4 });
      const fontCss = await embeddedFontCss(brand, film.scenes.flatMap((s) => Object.values(s.texts)).join(' '));
      const probed = await probeFilm({ data: local.data, bundle: await this.bundle(film, 'render'), fontCss, files: local.files });
      const errors = new Map(probed.errors.map((e) => [e.key, e]));
      const folder = `users/${userId}/projects/${projectId}/videos/${video.id}/scenes`;
      const storage = this.mediaStorage();
      const stamp = Date.now().toString(36);
      const scenes = await Promise.all(
        film.scenes.map(async (sc): Promise<FilmScene> => {
          const e = errors.get(sc.key);
          const shot = probed.thumbnails[sc.key];
          let thumbnail = sc.thumbnail;
          if (shot) thumbnail = (await storage.uploadFile(shot, `${sc.key}-${stamp}.jpg`, folder, 'image/jpeg').catch(() => null))?.downloadURL || thumbnail;
          if (sc.error?.stage === 'author' || sc.error?.stage === 'compile') return { ...sc, ...(thumbnail ? { thumbnail } : {}) };
          if (e) return { ...sc, status: 'error', error: { stage: 'runtime', message: e.message.slice(0, 600) }, ...(thumbnail ? { thumbnail } : {}) };
          const { error: _drop, ...clean } = sc;
          return { ...clean, status: sc.code ? 'ready' : 'error', ...(thumbnail ? { thumbnail } : {}) };
        })
      );
      return { ...film, scenes, cues: probed.cues.map((c) => ({ kind: c.kind, t: c.t, scene: c.scene })), checkedAt: new Date().toISOString() };
    } catch (error: any) {
      // Le contrôle lui-même a échoué (navigateur indisponible) : le film reste tel quel, sans verdict.
      logger.warn('video.check_failed', { videoId: video.id, error: error?.message });
      return film;
    }
  }

  // ── Auteur ────────────────────────────────────────────────────────────────

  private authorContext(video: MotionVideo, brand: FilmBrand, sc: FilmScene, others: MotionVideo[], level: CreativityLevel, extra: Pick<AuthorContext, 'revise' | 'repair'> = {}): AuthorContext {
    const film = video.film!;
    const i = film.scenes.findIndex((s) => s.key === sc.key);
    const byId = new Map((video.media || []).map((m) => [m.id, m]));
    const line = video.voice?.enabled ? video.voice.lines.find((l) => l.sceneKey === sc.key) : undefined;
    const beat = video.music?.beat?.bpm ? video.music.beat : undefined;
    const period = beat ? 60 / beat.bpm : 0;
    return {
      film: { title: film.title, concept: film.concept, bible: film.bible },
      format: video.scope.formats[0] || 'story',
      brand: brand.tokens,
      scene: {
        key: sc.key,
        index: i,
        count: film.scenes.length,
        duration: sc.duration,
        purpose: sc.purpose,
        visual: sc.visual,
        motion: sc.motion,
        transition: sc.transition,
        texts: sc.texts,
        media: sc.media
          .map((id) => byId.get(id))
          .filter((m): m is VideoMediaAsset => !!m && (m.kind === 'image' || m.kind === 'video'))
          .map((m) => ({ id: m.id, kind: m.kind as 'image' | 'video', width: m.width || 0, height: m.height || 0, ...(m.name ? { note: m.name } : {}), ...(m.durationSec ? { durationSec: m.durationSec } : {}) })),
        ...(line ? { voice: { text: line.text, at: line.offset, duration: line.durationSec } } : {}),
        ...(beat ? { beat: { bpm: beat.bpm, first: round3(((((beat.offset || 0) - sc.start) % period) + period) % period) } } : {}),
      },
      ...(i > 0 ? { previous: { purpose: film.scenes[i - 1].purpose, visual: film.scenes[i - 1].visual } } : {}),
      ...(i < film.scenes.length - 1 ? { next: { purpose: film.scenes[i + 1].purpose, visual: film.scenes[i + 1].visual } } : {}),
      snippets: pickSnippets(others, `${sc.motion} ${sc.visual}`),
      level,
      ...extra,
    };
  }

  private static applyAuthored(sc: FilmScene, a: AuthoredScene, instruction?: string): FilmScene {
    const author = { tokens: a.tokens, ms: a.ms, at: new Date().toISOString(), attempts: a.attempts, ...(instruction ? { instruction: instruction.slice(0, 400) } : {}) };
    if (!a.code) return { ...sc, author, status: 'error', error: a.error || { stage: 'author', message: 'no code' } };
    const { error: _e, ...rest } = sc;
    return { ...rest, code: a.code, author, status: a.error ? 'error' : 'ready', ...(a.error ? { error: a.error } : {}) };
  }

  /**
   * L'AUTOCORRECTION BORNÉE (`author/repair.ts`) : les scènes en erreur (compilation ou exécution) sont
   * corrigées avant d'être montrées. Une tentative à la fois par scène, une approche différente à chaque
   * tentative (corriger › réécrire plus simplement avec le modèle du cran au-dessus › version minimale),
   * trois au plus, et un budget de jetons et de temps pour tout le film. Chaque tour se termine par le
   * contrôle réel (Motion Canvas exécute les scènes) : c'est lui, pas le modèle, qui dit si c'est corrigé.
   */
  private async repairScenes(userId: string, projectId: string, video: MotionVideo, ctx: Awaited<ReturnType<MotionVideoService['brandContext']>>, level: CreativityLevel, only?: Set<string>, emit?: (stage: VideoProgressStage, state: 'running' | 'done', data?: Record<string, unknown>) => void): Promise<VideoFilm> {
    let film = video.film!;
    const ledger = new RepairLedger();
    const broken = () => film.scenes.filter((sc) => sc.status === 'error' && sc.error && (!only || only.has(sc.key)));
    const initial = broken().map((sc) => sc.key);
    if (!initial.length || ledger.limits.attemptsPerScene === 0) return film;
    emit?.('repair', 'running', { scenes: initial.length });
    for (let round = 0; ; round++) {
      // Chaque scène en erreur reçoit SA prochaine approche ; aucune ne reçoit deux tentatives à la fois.
      const todo = broken()
        .map((sc) => {
          ledger.noteError(sc.key, sc.error!.message);
          return { sc, strategy: ledger.nextStrategy(sc.key) };
        })
        .filter((x): x is { sc: FilmScene; strategy: NonNullable<ReturnType<RepairLedger['nextStrategy']>> } => !!x.strategy);
      if (!todo.length) break;
      emit?.('repair', 'running', { round: round + 1, scenes: todo.map((x) => x.sc.key) });
      const results = new Array<{ key: string; strategy: string; a: AuthoredScene }>(todo.length);
      let next = 0;
      const worker = async () => {
        while (next < todo.length) {
          const k = next++;
          const { sc, strategy } = todo[k];
          const context = this.authorContext({ ...video, film }, ctx.film, sc, ctx.others, level, {
            repair: { strategy, ...(strategy === 'fix' && sc.code ? { code: sc.code } : {}), error: sc.error!.message, history: ledger.history(sc.key) },
          });
          const a = await authorScene(this.callContext(userId, projectId, strategyLevel(strategy, level)), context);
          results[k] = { key: sc.key, strategy, a };
        }
      };
      await Promise.all(Array.from({ length: Math.min(ledger.limits.concurrency, todo.length) }, worker));
      for (const { key, strategy, a } of results) {
        const i = film.scenes.findIndex((sc) => sc.key === key);
        const previous = film.scenes[i];
        const repairs = [...(previous.author?.repairs || []), { strategy: strategy as 'fix' | 'rewrite' | 'minimal', ok: !!a.code && !a.error, ...(a.error ? { error: a.error.message.slice(0, 200) } : {}) }];
        // Une réponse sans code ne remplace pas le code existant (l'erreur reste celle d'avant).
        const updated = a.code ? MotionVideoService.applyAuthored(previous, a, previous.author?.instruction) : previous;
        film.scenes[i] = { ...updated, author: { ...(updated.author || { tokens: a.tokens, ms: a.ms, at: new Date().toISOString(), attempts: a.attempts }), repairs } };
        film.agents = [...film.agents, { agent: `video.author:${key}:repair-${strategy}`, source: a.code ? 'llm' : 'none', tokens: a.tokens, ms: a.ms, ...(a.code ? {} : { failure: a.error?.message.slice(0, 120) }) }];
        ledger.record(key, { strategy: strategy as 'fix' | 'rewrite' | 'minimal', ok: !!a.code && !a.error, tokens: a.tokens.input + a.tokens.output, ...(a.error ? { error: a.error.message } : {}) });
      }
      // Le contrôle réel : les erreurs d'exécution des nouvelles versions apparaissent ici.
      film = await this.checkFilm(userId, projectId, { ...video, film }, ctx.film);
      // Les résultats de compilation de ce tour sont mesurés : le journal garde l'erreur réellement constatée.
      for (const { key } of results) {
        const sc = film.scenes.find((x) => x.key === key)!;
        const last = sc.author?.repairs?.[sc.author.repairs.length - 1];
        if (last) last.ok = sc.status === 'ready';
        if (last && sc.error) last.error = sc.error.message.slice(0, 200);
      }
    }
    const unresolved = broken().map((sc) => sc.key);
    const attempts = [...ledger.attempts.values()].reduce((n, a) => n + a.length, 0);
    const stopped = ledger.exhausted && unresolved.length ? (ledger.tokensUsed >= ledger.limits.tokenBudget ? 'budget' : 'time') : undefined;
    film = { ...film, repair: { attempts, fixed: initial.filter((k) => !unresolved.includes(k)), unresolved, tokens: ledger.tokensUsed, ...(stopped ? { stopped } : {}) } };
    logger.info('video.repair', { event: 'video.repair', videoId: video.id, attempts, fixed: film.repair!.fixed, unresolved, tokens: ledger.tokensUsed, ...(stopped ? { stopped } : {}) });
    emit?.('repair', 'done', { fixed: film.repair!.fixed.length, unresolved: unresolved.length, attempts });
    return film;
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
    const request = brief.request || [brief.message, brief.details].filter(Boolean).join('\n');
    const read = await readRequest(request, { fallbackLanguages: [input.language, ctx.brand.voice.language], writer: this.writer(userId, 'mechanical', 'video.reader') });
    const spec: RequestSpec = { ...read.spec, language: brief.language || read.spec.language };
    const language = spec.language || brief.language || 'fr';
    const intent = await this.readIntent(userId, input, brief, spec, ctx.brandMedia, creativity);
    const brandMedia = await this.describedBrandMedia(userId, projectId, ctx.brandMedia, brief.media || []);
    // Les médias du film : imports d'abord, puis les images de la marque (captures, photos).
    const uploads = (brief.media || []).filter((m) => m.kind === 'image' || m.kind === 'video');
    const assets: VideoMediaAsset[] = [];
    const notes = new Map(brandMedia.map((b) => [b.url, b.note]));
    for (const m of uploads) assets.push({ ...m, id: `m${assets.length + 1}`, ...(notes.get(m.url) || m.name ? { name: (notes.get(m.url) || m.name)!.slice(0, 200) } : {}) });
    for (const b of brandMedia.filter((b) => !uploads.some((u) => u.url === b.url)).slice(0, 6)) assets.push({ id: `m${assets.length + 1}`, kind: 'image', url: b.url, origin: 'library', name: b.note.slice(0, 200) });
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
      newMedia: { images: brief.allowGenerate || brief.allowStock ? Math.max(0, Number(process.env.VIDEO_GEN_MAX_IMAGES ?? 6)) : 0, clips: brief.allowGenerate || brief.allowStock ? Math.max(0, Number(process.env.VIDEO_GEN_MAX_CLIPS ?? 4)) : 0 },
      ...(reference ? { reference } : {}),
      previous: ctx.others.filter((v) => v.film).slice(-6).map((v) => `${v.film!.title} — ${v.film!.concept}`.slice(0, 200)),
      level: creativity,
    };
    const call = this.callContext(userId, projectId, creativity);
    // Les mêmes étapes à tous les crans : la jauge choisit le modèle de chaque rôle (échelles de l'hôte).
    emit('concept', 'running');
    const conceived = await runConcept(call, filmBrief);
    trace('video.concept', conceived.run, !!conceived.concept);
    const concept = conceived.concept;
    emit('concept', 'done', concept ? { title: concept.title, concept: concept.concept } : { failed: conceived.run.failure || 'unreadable' });
    emit('storyboard', 'running');
    const timeline = spec.mode === 'script' && spec.scenes.length ? sceneTimeline(spec, scope.durationSec) : input.reference ? referenceTimeline(input.reference, scope.durationSec) : undefined;
    const planned = await runPlanner(call, filmBrief, concept, timeline);
    planned.runs.forEach((r, i) => trace(`video.planner${i ? `:${i + 1}` : ''}`, r, !!planned.storyboard && i === planned.runs.length - 1));
    if (!planned.storyboard || !planned.storyboard.scenes.length) {
      const failure = planned.runs[planned.runs.length - 1]?.failure;
      throw new VideoInputError(failure === 'no_model' ? 'model_unavailable' : 'storyboard_failed');
    }
    const sb: Storyboard = planned.storyboard;
    // Ce que la demande exige et que la vidéo ne peut pas tenir (4K, 24 i/s…) : dit, jamais ignoré.
    for (const u of spec.unsupported || []) sb.fidelity.push(language.startsWith('en') ? `${u} requested: the video is delivered in ${scope.quality === 'standard' ? '720p' : '1080p'}, ${scope.quality === 'premium' ? 60 : 30} fps.` : `${u} demandé : la vidéo est livrée en ${scope.quality === 'standard' ? '720p' : '1080p'}, ${scope.quality === 'premium' ? 60 : 30} i/s.`);
    emit('storyboard', 'done', { title: sb.title, scenes: sb.scenes.map((s) => ({ duration: s.duration, purpose: s.purpose })) });

    let film: VideoFilm = {
      version: 2,
      engine: 'motion-canvas',
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

    // 4. Médias, musique, sons (en parallèle)
    const needs: ShotPlan[] = film.scenes.flatMap((sc, i) => (sc.needs || []).map((n, k) => ({ scene: i, sceneId: sc.key, kind: n.kind, slot: k, texts: Object.values(sc.texts), shot: n.shot, query: n.query, durationSec: sc.duration })));
    const mediaJob = (async () => {
      if (!needs.length) return { produced: [] as { plan: ShotPlan; asset: VideoMediaAsset }[], report: null as null | Awaited<ReturnType<typeof sourceShots>>['report'] };
      emit('media', 'running', { planned: needs.length });
      const res = await sourceShots({
        direction: { look: spec.look || '', shots: needs, source: 'llm' },
        orientation: orientationOf(scope.formats[0]),
        storage: this.mediaStorage(),
        folder: `users/${userId}/projects/${projectId}/videos/${videoId}/media`,
        allowGenerate: brief.allowGenerate !== false,
        allowStock: brief.allowStock !== false,
        // La qualité du modèle vidéo suit elle aussi le cran (le cran choisit la puissance des modèles).
        clipQuality: atLeast(creativity, 'high') ? 'quality' : 'speed',
        visualPhotos: ctx.visuals.map((v) => v.backgroundImageUrl).filter((u): u is string => !!u),
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
      const v = await this.voiceFilm({ userId, projectId, videoId, film, style, seed, scripted: spec.mode === 'script' });
      film = v.film;
      video = { ...video, film, voice: v.voice };
      if (v.failed.length) film.fidelity = { notes: [...(film.fidelity?.notes || []), ...v.failed.map((k) => say(`Scène ${k.slice(1)} : la voix off n’a pas pu être dite.`, `Scene ${k.slice(1)}: the voice-over could not be recorded.`))] };
      emit('voice', 'done', { lines: v.voice.lines.length, ...(v.voice.unavailable ? { unavailable: v.voice.unavailable } : {}) });
    }

    // 5. Auteur : le code de chaque scène
    emit('code', 'running', { scenes: film.scenes.length });
    const contexts = film.scenes.map((sc) => this.authorContext(video, ctx.film, sc, ctx.others, creativity));
    const authored = await authorScenes(call, contexts, Number(process.env.VIDEO_AUTHOR_CONCURRENCY) || 4, (a, done) => emit('code', 'running', { done, total: contexts.length, scene: a.key, ok: !a.error }));
    authored.forEach((a) => agents.push({ agent: `video.author:${a.key}`, source: a.code ? 'llm' : 'none', tokens: a.tokens, ms: a.ms, ...(a.code ? {} : { failure: a.error?.message.slice(0, 120) }) }));
    if (authored.every((a) => !a.code)) {
      const noModel = authored.some((a) => /no_model/.test(a.error?.message || ''));
      throw new VideoInputError(noModel ? 'model_unavailable' : 'author_failed');
    }
    film = { ...film, scenes: film.scenes.map((sc, i) => MotionVideoService.applyAuthored(sc, authored[i])) };
    video = { ...video, film };
    emit('code', 'done', { ready: film.scenes.filter((s) => s.status === 'ready').length, errors: film.scenes.filter((s) => s.status === 'error').map((s) => s.key) });

    // 6. Contrôle technique
    emit('check', 'running');
    film = await this.checkFilm(userId, projectId, video, ctx.film);
    emit('check', 'done', { errors: film.scenes.filter((s) => s.status === 'error').map((s) => ({ key: s.key, stage: s.error?.stage, message: s.error?.message })) });
    // Autocorrection bornée AVANT de montrer la vidéo.
    film = await this.repairScenes(userId, projectId, { ...video, film }, ctx, creativity, undefined, emit);
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
    const level = current.creativity || 'medium';
    let video: MotionVideo = { ...current, film: { ...current.film, scenes: current.film.scenes.map((s) => ({ ...s })) }, media: [...(current.media || [])] };
    let film = video.film!;
    const sceneOf = (key: string) => film.scenes.find((s) => s.key === key);
    let codeChanged = false;

    // Textes : seules les clés existantes de la scène (son code ne lit que celles-là).
    for (const [key, texts] of Object.entries({ ...(patch.slots || {}), ...(patch.texts || {}) })) {
      const sc = sceneOf(key);
      if (!sc || !texts || typeof texts !== 'object') continue;
      for (const [k, v] of Object.entries(texts)) if (k in sc.texts && typeof v === 'string') sc.texts[k] = v.replace(/\s+/g, ' ').trim().slice(0, 220);
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

    // Code : retouches visuelles, corrections, nouvelles versions.
    const call = this.callContext(userId, projectId, level);
    const jobs: { key: string; extra: Pick<AuthorContext, 'revise'>; instruction?: string; replaceBroken: boolean }[] = [];
    /** Le code qui marchait avant une retouche visuelle : rendu si la retouche ne s'exécute pas, même après correction. */
    const before = new Map<string, FilmScene>();
    const visual = { ...(patch.visual || {}) };
    if (visual.all) {
      for (const sc of film.scenes) visual[sc.key] ??= visual.all;
      delete visual.all;
    }
    for (const [key, instruction] of Object.entries(visual)) {
      const sc = sceneOf(key);
      if (!sc || !String(instruction || '').trim()) continue;
      jobs.push({ key, instruction: String(instruction), extra: sc.code ? { revise: { instruction: String(instruction).slice(0, 800), code: sc.code } } : {}, replaceBroken: sc.status === 'error' });
    }
    // « Corriger » (demandé) : pas d'appel ici — la boucle de correction bornée s'en charge plus bas.
    const fixKeys = (patch.fix || []).filter((key) => sceneOf(key)?.status === 'error' && !jobs.some((j) => j.key === key));
    for (const key of patch.regenerate || []) {
      const sc = sceneOf(key);
      if (!sc || jobs.some((j) => j.key === key)) continue;
      jobs.push({ key, extra: {}, replaceBroken: true });
    }

    // Voix : ligne réécrite par l'utilisateur, activée ou coupée.
    for (const [key, text] of Object.entries(patch.voiceLines || {})) {
      const sc = sceneOf(key);
      if (sc && typeof text === 'string') sc.voiceText = text.replace(/\s+/g, ' ').trim().slice(0, 400);
    }
    const voiceKeys = Object.keys(patch.voiceLines || {}).filter((k) => sceneOf(k));
    if (patch.voice === false && video.voice) video.voice = { ...video.voice, enabled: false };
    if (patch.voice === true || (voiceKeys.length && video.voice?.enabled)) {
      const v = await this.voiceFilm({ userId, projectId, videoId, film, style: 'energetic', seed: film.seed, scripted: video.brief.spec?.mode === 'script', ...(patch.voice === true && !video.voice?.lines.length ? {} : { only: voiceKeys }), ...(video.voice ? { previous: video.voice } : {}) });
      film = v.film;
      video = { ...video, film, voice: v.voice };
      report.voiced.push(...v.voiced);
      report.failed.push(...v.failed.map((key) => ({ key, what: 'voice' as const })));
    }
    if (typeof patch.captions === 'boolean') film = { ...film, captions: patch.captions };

    if (jobs.length) {
      const results = await Promise.all(jobs.map((j) => authorScene(call, this.authorContext({ ...video, film }, ctx.film, sceneOf(j.key)!, ctx.others, level, j.extra)).then((a) => ({ j, a }))));
      for (const { j, a } of results) {
        const i = film.scenes.findIndex((s) => s.key === j.key);
        film.agents = [...film.agents, { agent: `video.author:${j.key}:${j.extra.revise ? 'revise' : 'new'}`, source: a.code ? 'llm' : 'none', tokens: a.tokens, ms: a.ms, ...(a.code ? {} : { failure: a.error?.message.slice(0, 120) }) }];
        if (!j.replaceBroken) before.set(j.key, film.scenes[i]);
        film.scenes[i] = MotionVideoService.applyAuthored(film.scenes[i], a, j.instruction);
        report.recoded.push(j.key);
        codeChanged = true;
      }
    }

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
    if (codeChanged || fixKeys.length || patch.voice !== undefined || voiceKeys.length) video.film = await this.checkFilm(userId, projectId, video, ctx.film);
    // Les scènes réécrites (ou à corriger) qui ne s'exécutent pas passent par la correction BORNÉE.
    const touched = new Set([...jobs.map((j) => j.key), ...fixKeys]);
    if (touched.size && video.film!.scenes.some((sc) => touched.has(sc.key) && sc.status === 'error')) {
      video.film = await this.repairScenes(userId, projectId, video, ctx, level, touched);
      for (const key of fixKeys) if (video.film.scenes.find((sc) => sc.key === key)?.status === 'ready') report.recoded.push(key);
    }
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
    if (restored.length) video.film = await this.checkFilm(userId, projectId, video, ctx.film);

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
    const run = await callFilmModel(this.callContext(userId, projectId, video.creativity || 'medium'), 'video.reviser', system, user);
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
    const data = this.filmData(video, ctx.film, target, 'preview');
    const sounds: FilmAudio['sfx'] = {};
    for (const [kind, file] of Object.entries(await this.sfxFiles(video.sfx))) sounds[kind as SfxKind] = { url: coreHost().sfxUrl(publicSoundName(file!)), gain: previewGain(SFX_GAIN_DB[kind as SfxKind]) };
    const audio: FilmAudio = {
      ...(video.music ? { music: { url: video.music.url, startAt: video.music.startAt, gain: previewGain(video.voice?.enabled ? MUSIC_UNDER_VOICE_DB : MUSIC_GAIN_DB) } } : {}),
      voice: voiceTimeline(video.film.scenes, video.voice, video.film.durationSec).map((l) => ({ url: l.url, at: l.at })),
      sfx: sounds,
    };
    const fontCss = await embeddedFontCss(ctx.film, video.film.scenes.flatMap((s) => Object.values(s.texts)).join(' '));
    return previewPageHtml({ data, audio, bundle: await this.bundle(video.film, 'preview'), fontCss });
  }

  // ── Lecture, suppression ─────────────────────────────────────────────────

  quoteExport(video: MotionVideo, scopeInput?: unknown): { cost: number; scope: VideoScope } {
    const scope = scopeInput ? { ...normalizeScope(scopeInput), durationSec: video.scope.durationSec } : video.scope;
    return { cost: exportCost({ paidCredits: video.paidCredits, exportCount: video.exportCount, scope, creativity: video.creativity }), scope };
  }

  async getVideo(userId: string, projectId: string, videoId: string): Promise<MotionVideo | null> {
    const video = (await this.store.listVideos(userId, projectId)).find((v) => v.id === videoId) || null;
    return video ? withLiveProgress(video) : null;
  }

  async listVideos(userId: string, projectId: string): Promise<MotionVideo[]> {
    return (await this.store.listVideos(userId, projectId)).map(withLiveProgress);
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
    if (current.film.scenes.some((s) => s.status === 'error' || !s.code)) throw new VideoInputError('scene_errors');
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
    if (render?.prerender) return { state: 'claim', cost: exportCost({ paidCredits: video.paidCredits, exportCount: video.exportCount, scope: video.scope, creativity: video.creativity }) };
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

  /** Le travail de fond : chaque format est rendu par Motion Canvas, mixé, déposé, puis inscrit. */
  async runExport(job: RenderJob): Promise<void> {
    const { userId, projectId, videoId } = job;
    const video = (await this.store.listVideos(userId, projectId)).find((v) => v.id === videoId);
    if (!video?.film) return;
    const ctx = await this.brandContext(userId, projectId);
    const film = video.film;
    const sfxFiles = await this.sfxFiles(video.sfx);
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
    const fontCss = await embeddedFontCss(ctx.film, film.scenes.flatMap((s) => Object.values(s.texts)).join(' '));
    const bundle = await this.bundle(film, 'render');
    const results: VideoRender[] = [];
    let sceneErrors: { key: string; message: string }[] = [];
    const formats = job.formats?.length ? job.formats : video.scope.formats;
    const share = Math.max(1, Math.floor(renderConcurrency() / formats.length));
    await Promise.all(
      formats.map(async (format) => {
        liveProgress.set(`${videoId}:${format}`, 0);
        try {
          const local = await localizeFilm(this.filmData(video, ctx.film, format, video.scope.quality));
          const out = await renderFilm({
            data: local.data,
            files: local.files,
            bundle,
            fontCss,
            durationSec: film.durationSec,
            quality: video.scope.quality,
            ...(musicFile && video.music ? { music: { file: musicFile, startAt: video.music.startAt } } : {}),
            ...(Object.keys(sfxFiles).length ? { sfx: { files: sfxFiles, style: (video.brief.style && video.brief.style !== 'auto' ? video.brief.style : 'energetic') as MotionStyle, intensity: video.sfx?.intensity } } : {}),
            voice: voiceFiles,
            posterAt: Math.min(film.durationSec - 0.1, (film.scenes[0]?.start || 0) + Math.min((film.scenes[0]?.duration || 2) * 0.85, 2)),
            onProgress: (r) => liveProgress.set(`${videoId}:${format}`, r),
            concurrency: share,
          });
          if (out.errors.length) {
            // Une scène a échoué pendant le rendu : le fichier montrerait une erreur, il n'est pas livré.
            sceneErrors = out.errors.map((e) => ({ key: e.key, message: e.message }));
            cleanupFilmRender(out);
            throw new Error(`scene_error: ${out.errors.map((e) => `${e.key} ${e.message}`).join(' · ').slice(0, 300)}`);
          }
          const folder = `users/${userId}/projects/${projectId}/videos/${videoId}`;
          const stamp = Date.now().toString(36);
          const [mp4, poster] = await Promise.all([
            requirePort('storage').uploadFile(fs.readFileSync(out.file), `${format}-${stamp}.mp4`, folder, 'video/mp4'),
            requirePort('storage').uploadFile(fs.readFileSync(out.poster), `${format}-${stamp}.jpg`, folder, 'image/jpeg'),
          ]);
          cleanupFilmRender(out);
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
