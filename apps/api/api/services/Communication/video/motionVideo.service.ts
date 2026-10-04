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
} from '../../../models/motionVideo.model';
import { CommunicationService } from '../communication.service';
import { StorageService } from '../../storage.service';
import { extractFacts, writeCopy, CopyContext, CopyWriter, fitLength } from './video.copy';
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
  language?: string;
}

/** Facturation à restituer si le rendu échoue après la réponse HTTP. */
export interface RenderCharge {
  cost: number;
  action: string;
}

const MAX_IMAGES = 6;

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
    imageUrls,
    language: String(b.language || language || 'fr').slice(0, 5),
  };
}

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

  // ── Images ───────────────────────────────────────────────────────────────

  /**
   * Photos de la vidéo : celles de l'utilisateur d'abord, puis les photos déjà
   * utilisées dans ses visuels (payées, à la charte), puis la banque d'images.
   */
  private async gatherImages(brief: VideoBrief, visuals: any[], ctx: CopyContext, orientation: string): Promise<string[]> {
    const own = brief.imageUrls || [];
    if (own.length) return own;
    const fromVisuals = [...visuals]
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      .map((v) => v.backgroundImageUrl)
      .filter((u: unknown): u is string => typeof u === 'string' && /^https?:\/\//.test(u));
    const unique = [...new Set(fromVisuals)].slice(0, 4);
    if (unique.length >= 2 || !process.env.PEXELS_API_KEY) return unique;
    try {
      const query = [ctx.businessType, ...(ctx.keywords || []).slice(0, 2)].filter(Boolean).join(' ') || brief.message.split(/\s+/).slice(0, 4).join(' ');
      const res = await axios.get('https://api.pexels.com/v1/search', {
        headers: { Authorization: process.env.PEXELS_API_KEY },
        params: { query, per_page: 4, orientation, locale: ctx.language?.startsWith('en') ? 'en-US' : 'fr-FR' },
        timeout: 8000,
      });
      const stock = (res.data?.photos || []).map((p: any) => p.src?.large2x || p.src?.large).filter(Boolean);
      return [...unique, ...stock].slice(0, 4);
    } catch (error: any) {
      logger.warn('video.pexels_failed', { error: error.message });
      return unique;
    }
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
      const track = opts.trackId ? candidates.find((t) => t.id === opts.trackId) || null : pickTrack(candidates, opts.seed, opts.avoidIds);
      if (!track) return undefined;
      return await this.prepareTrack(track, opts.durationSec);
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
      logger.warn('video.track_analysis_failed', { id: track.id, error: error.message });
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

  async createVideo(userId: string, projectId: string, input: CreateVideoInput, paidCredits: number): Promise<MotionVideo> {
    const scope = normalizeScope(input.scope);
    const brief = normalizeBrief(input.brief, input.language);
    const { theme, ctx, branding, visuals, otherVideos } = await this.brandContext(userId, projectId);
    ctx.language = brief.language || ctx.language;

    const seed = crypto.randomInt(1, 2 ** 31 - 1);
    const style = resolveStyle(brief.style, branding?.artDirection?.styleId, brief.objective);
    const primary = scope.formats[0];
    const orientation = primary === 'landscape' ? 'landscape' : primary === 'square' ? 'square' : 'portrait';

    const [images, music] = await Promise.all([
      this.gatherImages(brief, visuals, ctx, orientation),
      this.chooseMusic({
        mood: brief.musicMood,
        style,
        objective: brief.objective,
        durationSec: scope.durationSec,
        seed,
        avoidIds: otherVideos.map((v) => v.music?.id).filter(Boolean) as string[],
      }),
    ]);

    const facts = extractFacts(`${brief.message}\n${brief.details || ''}`);
    const sceneIds = planScenes(brief.objective, scope.durationSec, facts, images.length);
    const copy = await writeCopy(sceneIds, brief, ctx, this.writerFor(userId));
    const keptIds = sceneIds.filter((_, i) => !copy.dropped.includes(i + 1));
    const slots = sceneIds.map((_, i) => copy.copy[i + 1]).filter((s, i) => !copy.dropped.includes(i + 1) && !!s);

    const storyboard = buildStoryboard({
      sceneIds: keptIds,
      slots: keptIds.map((_, i) => slots[i] || {}),
      durationSec: scope.durationSec,
      style,
      seed,
      beat: music?.beat,
      images,
    });

    const now = new Date().toISOString();
    const hook = storyboard.scenes[0]?.slots?.title || brief.message;
    const video: MotionVideo = {
      id: `video-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
      title: fitLength(hook, 60),
      brief,
      scope,
      storyboard,
      music,
      renders: [],
      status: 'draft',
      paidCredits,
      exportCount: 0,
      copyTokens: { ...copy.tokens, source: copy.source },
      createdAt: now,
      updatedAt: now,
    };
    await this.communication.saveVideo(userId, projectId, video);
    logger.info('video.created', {
      event: 'video.created',
      projectId,
      videoId: video.id,
      scenes: keptIds.length,
      copySource: copy.source,
      tokens: copy.tokens,
      music: music?.provider,
    });
    return video;
  }

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

    storyboard = retime(storyboard, music?.beat);

    return this.communication.mutateVideo(userId, projectId, videoId, (v) => ({
      ...v,
      brief,
      scope,
      storyboard,
      music,
      title: fitLength(storyboard.scenes[0]?.slots?.title || v.title, 60),
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
    const { html } = await composeVideoHtml({
      storyboard: video.storyboard,
      theme,
      format: target,
      quality: 'standard',
      mode: 'preview',
      music: video.music ? { url: video.music.url, startAt: video.music.startAt } : undefined,
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
    const assets = await inlineAssets(video.storyboard, theme);
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
