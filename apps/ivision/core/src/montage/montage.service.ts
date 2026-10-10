/**
 * LE SERVICE DU MONTAGE — d'un enregistrement à une vidéo prête à publier.
 *
 *   créer     le fichier est sondé (durée → prix), déposé, puis traité EN TÂCHE DE FOND :
 *             transcription → coupes → plan du monteur → images d'illustration → musique ;
 *             l'interface suit `stage` et `progress` ;
 *   retoucher gratuit : style des sous-titres, mots corrigés, éléments (texte, retrait),
 *             carton final, musique. Changer les coupes ou le format relance les coupes seules :
 *             l'habillage, ancré sur les mots, suit ;
 *   exporter  la page du montage, rendue image par image ; la voix (piste de la vidéo montée)
 *             et la musique mixées par ffmpeg. Le premier export est inclus.
 *
 * Les travaux lourds (Whisper, ffmpeg, rendu) passent un par un : une file par processus.
 */
import axios from 'axios';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { brandSheet } from '../creativity/agent-io';
import { CreativityLevel, creativityCost, normalizeCreativity } from '../creativity/levels';
import { coreHost, requirePort } from '../runtime/host';
import logger from '../runtime/logger';
import { tierFor } from '../video/motionVideo.service';
import type { CopyWriter } from '../video/video.copy';
import { generateStill, searchPexelsPhotos } from '../video/video.media';
import { VIDEO_FORMATS, VideoFormat } from '../video/video.model';
import type { VideoStore } from '../video/video.store';
import { attributionLine, fetchTrack, pickTrack, resolveMood, searchMusic } from '../video/video.music';
import { VIDEO_PRICING } from '../video/video.pricing';
import { cleanupRender, probe, renderVideo } from '../video/video.renderer';
import { frameSpec } from '../video/video.composer';
import { buildVideoTheme } from '../video/video.theme';
import { composeMontageHtml } from './montage.composer';
import { cutVideo, editedDuration, keepRanges, retimeWords } from './montage.cuts';
import { assembleInputs } from './montage.assemble';
import { CAPTION_STYLES, CUT_MODES, CaptionStyle, CutMode, ELEMENT_TYPES, MONTAGE_LIMITS, MontageClip, MontageElement, MontageInput, MontageMessage, MontageStage, MontageVideo } from './montage.model';
import { planMontage, PlannerInput, revisePlan } from './montage.planner';
import { sentences, TimedWord } from './montage.timeline';
import { transcribe, transcriptionAvailable } from './montage.transcribe';

export class MontageInputError extends Error {}

/** La persistance de l'hôte (iVision : collection `montages`). */
export interface MontageStore {
  save(userId: string, brandId: string, montage: MontageVideo): Promise<void>;
  get(userId: string, id: string): Promise<{ brandId: string; montage: MontageVideo } | null>;
  list(userId: string, brandId?: string): Promise<{ brandId: string; montage: MontageVideo }[]>;
  /** Lecture puis écriture conditionnelle (deux écritures simultanées ne s'écrasent pas). */
  mutate(userId: string, id: string, fn: (m: MontageVideo) => MontageVideo): Promise<MontageVideo | null>;
  remove(userId: string, id: string): Promise<boolean>;
  /** Les montages restés « en cours » (processus arrêté) : marqués en échec au démarrage. */
  interrupted(): Promise<{ userId: string; brandId: string; montage: MontageVideo }[]>;
  /** Change la marque d'un montage (charte ajoutée après coup). */
  moveBrand(userId: string, id: string, brandId: string): Promise<boolean>;
}

// ─── Prix ───────────────────────────────────────────────────────────────────

/**
 * Prix d'un montage : 40 % d'une vidéo motion design de référence par demi-minute entamée
 * (il n'y a ni scène à écrire ni à animer : la matière est la parole), puis la jauge de créativité.
 * Un nouvel export coûte 10 % (une révision au moins), comme pour les vidéos.
 */
export const MONTAGE_PRICING = { perHalfMinute: 0.4, rerenderFactor: 0.1 };

export function montageCost(durationSec: number, level: CreativityLevel): number {
  const halves = Math.max(1, Math.ceil(durationSec / 30));
  return creativityCost(Math.ceil(VIDEO_PRICING.referenceCost * MONTAGE_PRICING.perHalfMinute * halves), level);
}

export function montageExportCost(m: Pick<MontageVideo, 'exportCount' | 'paidCredits'>): number {
  if (m.exportCount <= 0) return 0;
  return Math.max(VIDEO_PRICING.minRerender, Math.ceil(m.paidCredits * MONTAGE_PRICING.rerenderFactor));
}

// ─── File des travaux lourds ────────────────────────────────────────────────

let chain: Promise<unknown> = Promise.resolve();
function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const next = chain.then(job, job);
  chain = next.catch(() => undefined);
  return next;
}

/** Avancement des exports en mémoire (lu par l'interface pendant le rendu). */
const liveProgress = new Map<string, number>();

const now = () => new Date().toISOString();
const newId = () => `mtg_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

async function downloadTo(url: string, file: string): Promise<void> {
  const res = await axios.get(url, { responseType: 'stream', timeout: 120000, maxContentLength: MONTAGE_LIMITS.maxBytes });
  await new Promise<void>((resolve, reject) => {
    const out = fs.createWriteStream(file);
    res.data.pipe(out);
    out.on('finish', () => resolve());
    out.on('error', reject);
    res.data.on('error', reject);
  });
}

export interface CreateMontageInput {
  /** Les vidéos importées (déjà déposées dans le stockage), dans l'ordre. */
  inputs: MontageInput[];
  prompt: string;
  format: VideoFormat;
  creativity: CreativityLevel;
  cuts: CutMode;
  music: boolean;
  sessionId?: string;
}

const msgId = () => `msg_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const message = (role: MontageMessage['role'], text: string, extra: Partial<MontageMessage> = {}): MontageMessage => ({ id: msgId(), role, text, createdAt: now(), ...extra });
const push = (m: MontageVideo, ...messages: MontageMessage[]): MontageVideo => ({ ...m, messages: [...(m.messages || []), ...messages].slice(-200) });
const seconds = (n: number) => (n >= 60 ? `${Math.floor(n / 60)} min ${String(Math.round(n % 60)).padStart(2, '0')} s` : `${Math.round(n)} s`);

export class MontageService {
  constructor(
    private readonly store: MontageStore,
    /** Les marques de l'hôte (charte, ton, photos) et ses modèles de texte. */
    private readonly brands: Pick<VideoStore, 'loadBrand' | 'runVideoTieredPrompt'>,
    /** Remplaçable dans les contrôles. */
    private readonly writerFor: (userId: string, level: CreativityLevel) => CopyWriter | undefined = (userId, level) =>
      typeof brands.runVideoTieredPrompt === 'function' ? (system, user) => brands.runVideoTieredPrompt!(userId, system, user, tierFor(level, 'agents'), 'agents') : undefined
  ) {}

  available(): boolean {
    return transcriptionAvailable();
  }

  /** Sonde un fichier importé (local ou URL du stockage) : durée, cadre, son. */
  async inspect(file: string): Promise<{ durationSec: number; width: number; height: number; hasAudio: boolean }> {
    let info;
    try {
      info = await probe(file);
    } catch {
      throw new MontageInputError('unreadable_video');
    }
    if (!info.width || !info.height || !info.duration) throw new MontageInputError('unreadable_video');
    return { durationSec: info.duration, width: info.width, height: info.height, hasAudio: info.hasAudio };
  }

  /** Les bornes d'un ensemble de vidéos (avant tout débit) : au moins une avec du son, durée totale. */
  checkInputs(inputs: { durationSec: number; hasAudio: boolean }[]): number {
    if (!inputs.length) throw new MontageInputError('no_video');
    if (inputs.length > MONTAGE_LIMITS.maxFiles) throw new MontageInputError('too_many');
    if (!inputs.some((i) => i.hasAudio)) throw new MontageInputError('no_audio');
    const total = inputs.reduce((sum, i) => sum + i.durationSec, 0);
    if (total < MONTAGE_LIMITS.minDurationSec) throw new MontageInputError('too_short');
    if (total > MONTAGE_LIMITS.maxDurationSec + 1) throw new MontageInputError('too_long');
    return total;
  }

  quote(durationSec: number, level: CreativityLevel) {
    return { action: 'motion_video', cost: montageCost(durationSec, level), note: `montage:${level}` };
  }

  // ── Création ──────────────────────────────────────────────────────────────

  async create(userId: string, brandId: string, input: CreateMontageInput, paid: number, onFailed?: (m: MontageVideo) => Promise<void>): Promise<MontageVideo> {
    const id = newId();
    const first = input.inputs[0];
    const prompt = input.prompt.trim().slice(0, 1200);
    const montage: MontageVideo = {
      id,
      ...(input.sessionId ? { sessionId: input.sessionId } : {}),
      title: prompt ? prompt.replace(/\s+/g, ' ').slice(0, 60) : (first?.name || 'Montage').replace(/\.[a-z0-9]+$/i, '').slice(0, 60),
      status: 'processing',
      stage: 'prepare',
      prompt,
      format: VIDEO_FORMATS.includes(input.format) ? input.format : 'story',
      quality: 'hd',
      creativity: normalizeCreativity(input.creativity),
      // La prise définitive est connue après l'assemblage ; d'ici là, la première vidéo.
      source: { url: first.url, durationSec: first.durationSec, width: first.width, height: first.height, name: first.name },
      inputs: input.inputs,
      words: [],
      cuts: { mode: CUT_MODES.includes(input.cuts) ? input.cuts : 'tight', ranges: [], removedSec: 0 },
      captions: { style: 'pop' },
      elements: [],
      musicEnabled: input.music,
      paidCredits: paid,
      exportCount: 0,
      renders: [],
      messages: [
        message('user', prompt, { kind: 'request', inputs: input.inputs.map((i) => ({ url: i.url, name: i.name, posterUrl: i.posterUrl, durationSec: i.durationSec })) }),
        message('assistant', 'Je prépare votre montage. Vous pouvez quitter cette page, il continue.', { kind: 'progress', i18n: { key: 'montage.chat.preparing' } }),
      ],
      createdAt: now(),
      updatedAt: now(),
    };
    await this.store.save(userId, brandId, montage);
    void enqueue(() => this.process(userId, brandId, id)).catch(async (error: any) => {
      const code = String(error?.message || 'failed').slice(0, 160);
      logger.error('montage.failed', { event: 'montage.failed', montageId: id, error: code, alert: code === 'no_speech' ? undefined : 'critical' });
      const failed = await this.store.mutate(userId, id, (m) =>
        push(
          { ...m, status: 'failed', error: code, updatedAt: now() },
          message('assistant', code === 'no_speech' ? 'Je n’ai entendu personne parler dans ces vidéos. Ajoutez une vidéo où vous parlez.' : 'Le montage n’a pas abouti. Vos crédits vous sont rendus.', {
            kind: 'error',
            i18n: { key: code === 'no_speech' ? 'montage.chat.noSpeech' : 'montage.chat.failed', params: { cost: m.paidCredits } },
          })
        )
      );
      if (failed && onFailed) await onFailed(failed).catch(() => undefined);
    });
    return montage;
  }

  /** Les entrées du monteur, communes à la création et aux retours. */
  private async plannerInput(userId: string, brandId: string, m: MontageVideo): Promise<PlannerInput> {
    const brand = await this.brands.loadBrand(userId, brandId);
    const theme = buildVideoTheme((brand?.branding as any) || {}, brand?.brandName || '');
    return {
      words: m.words,
      timed: this.timedWords(m),
      durationSec: m.edit!.durationSec,
      prompt: m.prompt,
      brandName: theme.brandName,
      sheet: theme.brandName || brand?.voice.businessType ? brandSheet({ brandName: theme.brandName || '(no brand name)', businessType: brand?.voice.businessType, tone: brand?.voice.tone, palette: theme.palette, fonts: theme.fonts, art: (brand?.branding as any)?.artDirection }) : '',
      contacts: this.contactsOf(brand),
      language: m.language || 'fr',
      format: m.format,
      creativity: m.creativity,
      clips: (m.clips || []).map((c) => ({ id: c.id, durationSec: c.durationSec, name: c.name })),
    };
  }

  private async setStage(userId: string, id: string, stage: MontageStage, progress?: number): Promise<void> {
    await this.store.mutate(userId, id, (m) => ({ ...m, stage, progress, updatedAt: now() }));
  }

  /** La chaîne complète : assemblage, transcription, coupes, plan, images, musique. */
  private async process(userId: string, brandId: string, id: string): Promise<void> {
    const started = Date.now();
    const current = await this.store.get(userId, id);
    if (!current) return;
    const storage = requirePort('storage');
    const folder = `users/${userId}/brands/${brandId}/montages/${id}`;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'idem-montage-in-'));
    try {
      // 0. Les vidéos importées : celles qui parlent bout à bout, les autres en plans de coupe.
      const inputs = current.montage.inputs || [{ url: current.montage.source.url, durationSec: current.montage.source.durationSec, width: current.montage.source.width, height: current.montage.source.height }];
      const files: string[] = [];
      for (const [i, input] of inputs.entries()) {
        const file = path.join(dir, `in-${i}${(path.extname(new URL(input.url).pathname) || '.mp4').slice(0, 6)}`);
        await downloadTo(input.url, file);
        files.push(file);
      }
      const assembled = await assembleInputs(files, dir);
      if (!assembled.source) throw new Error('no_speech');
      const sourceUrl =
        files.length === 1 || assembled.source.file === files[assembled.speech.indexOf(true)]
          ? inputs[assembled.speech.indexOf(true)].url
          : (await storage.uploadFile(fs.readFileSync(assembled.source.file), 'source.mp4', folder, 'video/mp4')).downloadURL;
      const clips: MontageClip[] = [];
      for (const c of assembled.clips) {
        const key = `c${clips.length + 1}`;
        const [video, poster] = await Promise.all([
          storage.uploadFile(fs.readFileSync(c.file), `clip-${key}.webm`, folder, 'video/webm'),
          storage.uploadFile(fs.readFileSync(c.poster), `clip-${key}.jpg`, folder, 'image/jpeg'),
        ]);
        clips.push({ id: key, url: video.downloadURL, posterUrl: poster.downloadURL, durationSec: Math.round(c.durationSec * 100) / 100, name: inputs[c.index].name?.slice(0, 60) });
      }
      const src = assembled.source;
      await this.store.mutate(userId, id, (m) => ({
        ...m,
        source: { url: sourceUrl, durationSec: Math.round(src.durationSec * 1000) / 1000, width: src.width, height: src.height, name: m.source.name },
        inputs: inputs.map((x, i) => ({ ...x, speech: assembled.speech[i] })),
        clips,
        stage: 'transcribe',
        progress: 0,
        updatedAt: now(),
      }));

      const brand = await this.brands.loadBrand(userId, brandId);
      // 1. Transcription.
      let lastWrite = 0;
      const { words, language } = await transcribe(src.file, {
        onProgress: (r) => {
          if (Date.now() - lastWrite < 1500) return;
          lastWrite = Date.now();
          void this.setStage(userId, id, 'transcribe', r);
        },
      });
      if (!words.length) throw new Error('no_speech');
      await this.store.mutate(userId, id, (m) => ({ ...m, words, language: language || brand?.voice.language || 'fr', stage: 'cut', progress: undefined, updatedAt: now() }));
      // 2. Coupes.
      await this.recut(userId, id, src.file);
      // 3. Plan du monteur.
      await this.setStage(userId, id, 'plan');
      const m1 = (await this.store.get(userId, id))!.montage;
      const plan = await planMontage(await this.plannerInput(userId, brandId, m1), this.writerFor(userId, m1.creativity));
      await this.store.mutate(userId, id, (m) => ({
        ...m,
        title: m.prompt ? m.title : plan.title || m.title,
        captions: { style: plan.captions },
        elements: plan.elements,
        intro: plan.intro,
        outro: plan.outro,
        plannedBy: plan.source,
        stage: 'media',
        updatedAt: now(),
      }));
      // 4. Images d'illustration (les plans de coupe fournis n'en ont pas besoin).
      const elements = await this.sourceImages(userId, brandId, id, plan.elements, m1.creativity, m1.format);
      // 5. Musique (sous la voix).
      const music = m1.musicEnabled ? await this.pickMusic(brand, (plan.intro?.durationSec || 0) + m1.edit!.durationSec + (plan.outro?.durationSec || 0)) : undefined;
      const shown = elements.filter((e) => e.type !== 'zoom').length;
      await this.store.mutate(userId, id, (m) =>
        push(
          { ...m, elements, ...(music ? { music } : {}), status: 'ready', stage: 'ready', progress: undefined, updatedAt: now() },
          message('assistant', `Votre montage est prêt : ${seconds(m.edit!.durationSec)}${m.cuts.removedSec >= 1 ? `, ${seconds(m.cuts.removedSec)} de blancs retirés` : ''}, sous-titres et ${shown} élément(s) à l’écran. Dites-moi ce qu’il faut changer, ou téléchargez-le.`, {
            kind: 'result',
            i18n: { key: 'montage.chat.ready', params: { duration: seconds(m.edit!.durationSec), removed: m.cuts.removedSec >= 1 ? seconds(m.cuts.removedSec) : '', count: shown } },
          })
        )
      );
      logger.info('montage.ready', { event: 'montage.ready', montageId: id, inputs: inputs.length, clips: clips.length, words: words.length, elements: elements.length, plannedBy: plan.source, removedSec: m1.cuts.removedSec, ms: Date.now() - started });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  /** Coupes + vidéo montée (recadrée au format) : à la création, ou quand les coupes ou le format changent. */
  private async recut(userId: string, id: string, localSource?: string): Promise<void> {
    const found = await this.store.get(userId, id);
    if (!found) return;
    const m = found.montage;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'idem-montage-'));
    try {
      let source = localSource;
      if (!source) {
        source = path.join(dir, 'source');
        await downloadTo(m.source.url, source);
      }
      const { ranges, dropped } = keepRanges(m.words, m.source.durationSec, m.cuts.mode);
      const spec = frameSpec(m.format, m.quality);
      const { file, poster } = await cutVideo({ input: source, ranges, width: spec.width, height: spec.height, hasAudio: true, outDir: dir });
      const storage = requirePort('storage');
      const folder = `users/${userId}/brands/${found.brandId}/montages/${id}`;
      const stamp = Date.now().toString(36);
      const [video, still] = await Promise.all([
        storage.uploadFile(fs.readFileSync(file), `edit-${m.format}-${stamp}.webm`, folder, 'video/webm'),
        storage.uploadFile(fs.readFileSync(poster), `edit-${m.format}-${stamp}.jpg`, folder, 'image/jpeg'),
      ]);
      const info = await probe(file);
      const durationSec = Math.round(Math.min(info.duration || Infinity, editedDuration(ranges)) * 1000) / 1000;
      await this.store.mutate(userId, id, (x) => ({
        ...x,
        cuts: { mode: x.cuts.mode, ranges, removedSec: Math.round((x.source.durationSec - durationSec) * 10) / 10, dropped: [...dropped] },
        edit: { url: video.downloadURL, posterUrl: still.downloadURL, durationSec, width: spec.width, height: spec.height },
        updatedAt: now(),
      }));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  /** Les mots dans le temps de la vidéo montée. */
  timedWords(m: MontageVideo): TimedWord[] {
    const dropped = new Set<number>(m.cuts.dropped || []);
    return retimeWords(m.words, m.cuts.ranges, dropped);
  }

  private contactsOf(brand: Awaited<ReturnType<VideoStore['loadBrand']>>): string[] {
    const b: any = brand?.branding || {};
    const v: any = brand?.voice || {};
    return [b.website, b.siteUrl, v.website, v.phone, b.phone, b.contact?.phone, b.contact?.website]
      .filter((x): x is string => typeof x === 'string' && x.trim().length > 3)
      .map((x) => x.replace(/^https?:\/\//, '').replace(/\/$/, ''))
      .filter((x, i, all) => all.indexOf(x) === i)
      .slice(0, 3);
  }

  /** Une image par illustration : générée aux crans hauts, sinon banque d'images (et l'inverse en repli). */
  private async sourceImages(userId: string, brandId: string, id: string, elements: MontageElement[], level: CreativityLevel, format: VideoFormat): Promise<MontageElement[]> {
    const storage = requirePort('storage');
    const folder = `users/${userId}/brands/${brandId}/montages/${id}/images`;
    const out: MontageElement[] = [];
    const generate = !!coreHost().generateImage;
    const genFirst = level === 'high' || level === 'max' || level === 'ultra';
    for (const el of elements) {
      if (el.type !== 'broll' || el.image || el.clip) {
        out.push(el);
        continue;
      }
      const orientation = el.mode === 'full' ? (format === 'landscape' ? 'landscape' : format === 'square' ? 'square' : 'portrait') : 'landscape';
      const tryGenerate = async () => {
        if (!generate) return null;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const still = await generateStill(el.text || el.query || '', orientation, storage, folder);
            return { image: still.url, credit: still.credit };
          } catch (error: any) {
            logger.warn('montage.broll_generate_failed', { montageId: id, attempt, error: error?.message });
          }
        }
        return null;
      };
      const tryStock = async () => {
        try {
          const [photo] = await searchPexelsPhotos(el.query || '', orientation, 1, 'en-US');
          return photo ? { image: photo.url, credit: photo.credit } : null;
        } catch (error: any) {
          logger.warn('montage.broll_stock_failed', { montageId: id, error: error?.message });
          return null;
        }
      };
      const found = genFirst ? (await tryGenerate()) || (await tryStock()) : (await tryStock()) || (await tryGenerate());
      // Sans image, l'illustration n'a rien à montrer : elle est retirée.
      if (found) out.push({ ...el, ...found });
    }
    return out;
  }

  private async pickMusic(brand: Awaited<ReturnType<VideoStore['loadBrand']>>, durationSec: number): Promise<MontageVideo['music']> {
    try {
      const text = `${brand?.voice.tone || ''} ${brand?.voice.businessType || ''} ${brand?.voice.valueProposition || ''}`;
      const mood = resolveMood('auto', 'corporate', 'announce' as never, text) || 'corporate';
      const track = pickTrack(await searchMusic({ mood, minDuration: durationSec + 3 }), Date.now() % 9973);
      if (!track) return undefined;
      return { id: track.id, url: track.url, title: track.title, artist: track.artist, provider: track.provider, attribution: attributionLine(track), startAt: 0 };
    } catch (error: any) {
      logger.warn('montage.music_failed', { error: error?.message });
      return undefined;
    }
  }

  // ── Lecture ───────────────────────────────────────────────────────────────

  async get(userId: string, id: string): Promise<{ brandId: string; montage: MontageVideo } | null> {
    const found = await this.store.get(userId, id);
    if (!found) return null;
    const m = found.montage;
    const live = m.renders.map((r) => (r.status === 'rendering' && liveProgress.has(`${m.id}:${r.format}`) ? { ...r, progress: liveProgress.get(`${m.id}:${r.format}`)! } : r));
    return { brandId: found.brandId, montage: { ...m, renders: live } };
  }

  list(userId: string, brandId?: string) {
    return this.store.list(userId, brandId);
  }

  async remove(userId: string, id: string): Promise<boolean> {
    return this.store.remove(userId, id);
  }

  async previewHtml(userId: string, id: string): Promise<string | null> {
    const found = await this.store.get(userId, id);
    if (!found?.montage.edit) return null;
    const { montage } = found;
    const brand = await this.brands.loadBrand(userId, found.brandId);
    const theme = buildVideoTheme((brand?.branding as any) || {}, brand?.brandName || '');
    const { html } = await composeMontageHtml({ montage, timed: this.timedWords(montage), theme, mode: 'preview', videoUrl: montage.edit!.url, musicUrl: montage.musicEnabled ? montage.music?.url : undefined });
    return html;
  }

  // ── Retouches (gratuites) ─────────────────────────────────────────────────

  async update(
    userId: string,
    id: string,
    patch: { captions?: string; words?: Record<string, string>; elements?: unknown[]; intro?: { title?: string; kicker?: string } | null; outro?: { text?: string; detail?: string } | null; music?: boolean; cuts?: string; format?: string; title?: string }
  ): Promise<MontageVideo | null> {
    const found = await this.store.get(userId, id);
    if (!found) return null;
    if (found.montage.status === 'processing') throw new MontageInputError('still_processing');
    const recut = (CUT_MODES.includes(patch.cuts as CutMode) && patch.cuts !== found.montage.cuts.mode) || (VIDEO_FORMATS.includes(patch.format as VideoFormat) && patch.format !== found.montage.format);
    const updated = await this.store.mutate(userId, id, (m) => {
      const next = { ...m, updatedAt: now() };
      if (typeof patch.title === 'string' && patch.title.trim()) next.title = patch.title.trim().slice(0, 60);
      if (CAPTION_STYLES.includes(patch.captions as CaptionStyle)) next.captions = { style: patch.captions as CaptionStyle };
      if (patch.words && typeof patch.words === 'object') {
        // Une faute de transcription corrigée : le texte change, jamais le temps.
        next.words = m.words.map((w, i) => {
          const fix = patch.words![String(i)];
          return typeof fix === 'string' && fix.trim() ? { ...w, text: fix.trim().slice(0, 40), p: 1 } : w;
        });
      }
      if (Array.isArray(patch.elements)) next.elements = this.cleanElements(patch.elements, m);
      if (patch.intro === null) next.intro = undefined;
      else if (patch.intro && typeof patch.intro === 'object') {
        const title = String(patch.intro.title || '').trim().slice(0, 60);
        next.intro = title ? { title, kicker: String(patch.intro.kicker || '').trim().slice(0, 30) || undefined, durationSec: m.intro?.durationSec || 2.6 } : undefined;
      }
      if (patch.outro === null) next.outro = undefined;
      else if (patch.outro && typeof patch.outro === 'object') {
        const text = String(patch.outro.text || '').trim().slice(0, 60);
        next.outro = text ? { text, detail: String(patch.outro.detail || '').trim().slice(0, 60) || undefined, durationSec: m.outro?.durationSec || 2.6 } : undefined;
      }
      if (typeof patch.music === 'boolean') next.musicEnabled = patch.music;
      if (recut) {
        if (CUT_MODES.includes(patch.cuts as CutMode)) next.cuts = { ...m.cuts, mode: patch.cuts as CutMode };
        if (VIDEO_FORMATS.includes(patch.format as VideoFormat)) next.format = patch.format as VideoFormat;
        next.status = 'processing';
        next.stage = 'cut';
      }
      return next;
    });
    if (updated && recut) {
      void enqueue(() => this.recut(userId, id))
        .then(() => this.store.mutate(userId, id, (m) => ({ ...m, status: 'ready', stage: 'ready', updatedAt: now() })))
        .catch((error: any) => {
          logger.error('montage.recut_failed', { event: 'montage.recut_failed', montageId: id, error: error?.message });
          return this.store.mutate(userId, id, (m) => ({ ...m, status: 'ready', stage: 'ready', error: 'recut_failed', updatedAt: now() }));
        });
    }
    if (updated && patch.music === true && !updated.music) {
      const brand = await this.brands.loadBrand(userId, found.brandId);
      const music = await this.pickMusic(brand, (updated.edit?.durationSec || 0) + (updated.outro?.durationSec || 0));
      if (music) return this.store.mutate(userId, id, (m) => ({ ...m, music }));
    }
    return updated;
  }

  /**
   * Un RETOUR écrit dans la conversation (« sans musique », « plus de zooms », « en carré ») :
   * les réglages dits en clair sont appliqués par le code, le reste par le monteur qui reprend
   * son montage. Gratuit, comme toute retouche. La réponse arrive dans le fil.
   */
  async revise(userId: string, id: string, text: string): Promise<MontageVideo | null> {
    const found = await this.store.get(userId, id);
    if (!found) return null;
    if (found.montage.status === 'processing') throw new MontageInputError('still_processing');
    const feedback = text.replace(/\s+/g, ' ').trim().slice(0, 600);
    if (!feedback) throw new MontageInputError('empty_message');
    await this.store.mutate(userId, id, (m) => push(m, message('user', feedback, { kind: 'request' })));
    const m = found.montage;
    const input = await this.plannerInput(userId, found.brandId, m);
    const revision = await revisePlan(input, { elements: m.elements, intro: m.intro, outro: m.outro, captions: m.captions.style }, feedback, this.writerFor(userId, m.creativity));
    // Le titre d'une intro ajoutée sans titre : la marque, sinon les premiers mots dits (jamais la consigne).
    const firstWords = sentences(m.words, input.timed)[0]?.text.split(' ').slice(0, 6).join(' ').replace(/[.,!?…;:]+$/, '');
    const introTitle = input.brandName || firstWords || m.title;
    const { settings } = revision;
    const changes: string[] = [];
    if (settings.music === false) changes.push('musique retirée');
    if (settings.music === true) changes.push('musique ajoutée');
    if (settings.captions) changes.push(settings.captions === 'none' ? 'sous-titres retirés' : 'sous-titres changés');
    if (settings.format) changes.push('format changé');
    if (settings.cuts) changes.push(settings.cuts === 'none' ? 'vidéo remise intacte' : 'coupes refaites');
    if (settings.outro === false) changes.push('carton de fin retiré');
    if (settings.intro === true) changes.push('intro animée ajoutée');
    if (settings.intro === false) changes.push('intro retirée');
    if (revision.elements) changes.push('habillage revu');
    if (!changes.length) {
      // Rien de compris : on le dit, sans rien casser.
      return this.store.mutate(userId, id, (x) =>
        push(x, message('assistant', 'Je n’ai pas compris ce qu’il faut changer. Dites par exemple « sans musique », « sous-titres plus sobres », « en carré » ou « ajoute le prix en grand ».', { kind: 'revision', i18n: { key: 'montage.chat.notUnderstood' } }))
      );
    }
    // Les éléments du monteur, puis les réglages (qui relancent les coupes au besoin).
    if (revision.elements) {
      await this.store.mutate(userId, id, (x) => ({ ...x, elements: revision.elements!, outro: settings.outro === false ? undefined : revision.outro ?? x.outro, plannedBy: 'llm', updatedAt: now() }));
      const withImages = await this.sourceImages(userId, found.brandId, id, revision.elements, m.creativity, (settings.format as VideoFormat) || m.format);
      await this.store.mutate(userId, id, (x) => ({ ...x, elements: withImages }));
    }
    await this.update(userId, id, {
      ...(settings.captions ? { captions: settings.captions } : {}),
      ...(typeof settings.music === 'boolean' ? { music: settings.music } : {}),
      ...(settings.cuts ? { cuts: settings.cuts } : {}),
      ...(settings.format ? { format: settings.format } : {}),
      ...(settings.outro === false ? { outro: null } : {}),
      // L'intro : celle du monteur, sinon le titre du montage ; retirée sur demande.
      ...(settings.intro === false ? { intro: null } : settings.intro === true || (revision.intro && m.intro) ? { intro: revision.intro || m.intro || { title: introTitle } } : {}),
    });
    const reply = revision.reply || `C’est fait : ${changes.join(', ')}.`;
    return this.store.mutate(userId, id, (x) => push(x, message('assistant', reply, { kind: 'revision' })));
  }

  /** Une charte ajoutée après coup : le montage la prend (l'aperçu et l'export suivent). */
  async setBrand(userId: string, id: string, brandId: string): Promise<boolean> {
    return this.store.moveBrand(userId, id, brandId);
  }

  /** Les éléments retouchés : mêmes bornes que ceux du monteur, textes libres (c'est l'utilisateur qui écrit). */
  private cleanElements(raw: unknown[], m: MontageVideo): MontageElement[] {
    const n = m.words.length;
    const byId = new Map(m.elements.map((e) => [e.id, e]));
    const clip = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : undefined);
    return raw
      .slice(0, 80)
      .map((x: any): MontageElement | null => {
        if (!x || !ELEMENT_TYPES.includes(x.type)) return null;
        const from = Math.max(0, Math.min(n - 1, Math.round(Number(x.from))));
        const to = Math.max(from, Math.min(n - 1, Math.round(Number(x.to ?? from))));
        if (!Number.isFinite(from)) return null;
        const prev = byId.get(String(x.id));
        return {
          id: prev?.id || `${x.type}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
          type: x.type,
          from,
          to,
          text: clip(x.text, 80),
          value: clip(x.value, 60),
          label: clip(x.label, 60),
          items: Array.isArray(x.items) ? x.items.map((i: unknown) => clip(i, 60)).filter(Boolean).slice(0, 5) : undefined,
          icon: clip(x.icon, 24),
          // Une image ne vient que du monteur (déposée chez nous) : jamais d'une URL envoyée par le client.
          image: prev?.image,
          clip: prev?.clip,
          credit: prev?.credit,
          query: prev?.query,
          mode: x.mode === 'full' ? 'full' : x.mode === 'card' ? 'card' : prev?.mode,
          off: x.off === true,
        };
      })
      .filter((e): e is MontageElement => !!e);
  }

  // ── Export ────────────────────────────────────────────────────────────────

  quoteExport(m: MontageVideo): { cost: number } {
    return { cost: montageExportCost(m) };
  }

  async startExport(userId: string, id: string, paid?: { cost: number; action: string }): Promise<MontageVideo | null> {
    const found = await this.store.get(userId, id);
    if (!found) return null;
    if (found.montage.status !== 'ready' || !found.montage.edit) throw new MontageInputError('not_ready');
    if (found.montage.renders.some((r) => r.status === 'rendering')) throw new MontageInputError('already_rendering');
    const format = found.montage.format;
    const started = await this.store.mutate(userId, id, (m) => ({ ...m, renders: [{ format, status: 'rendering', progress: 0 }], updatedAt: now() }));
    liveProgress.set(`${id}:${format}`, 0);
    void enqueue(() => this.runExport(userId, found.brandId, id))
      .catch(async (error: any) => {
        logger.error('montage.export_failed', { event: 'montage.export_failed', montageId: id, error: error?.message });
        await this.store.mutate(userId, id, (m) => ({ ...m, renders: m.renders.map((r) => ({ ...r, status: 'failed' as const, error: String(error?.message || 'render_failed').slice(0, 160) })), updatedAt: now() }));
        if (paid?.cost) await coreHost().refundCredits?.(userId, paid.cost, { action: paid.action, note: 'Export du montage en échec — crédits restitués' }).catch(() => undefined);
      })
      .finally(() => liveProgress.delete(`${id}:${format}`));
    return started;
  }

  private async runExport(userId: string, brandId: string, id: string): Promise<void> {
    const found = await this.store.get(userId, id);
    if (!found?.montage.edit) return;
    const m = found.montage;
    const brand = await this.brands.loadBrand(userId, brandId);
    const theme = buildVideoTheme((brand?.branding as any) || {}, brand?.brandName || '');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'idem-montage-render-'));
    let output: Awaited<ReturnType<typeof renderVideo>> | null = null;
    try {
      // La voix : la piste de la vidéo montée, posée à 0 (la musique s'efface dessous).
      const voice = path.join(dir, 'edit.webm');
      await downloadTo(m.edit!.url, voice);
      let musicFile: string | undefined;
      if (m.musicEnabled && m.music) musicFile = await fetchTrack(m.music as never).catch(() => undefined);
      const { html, width, height, fps, duration } = await composeMontageHtml({ montage: m, timed: this.timedWords(m), theme, mode: 'render', videoUrl: m.edit!.url });
      output = await renderVideo({
        html,
        width,
        height,
        fps,
        durationSec: duration,
        quality: m.quality,
        music: musicFile ? { file: musicFile, startAt: m.music!.startAt } : undefined,
        voice: [{ file: voice, at: m.intro?.durationSec || 0 }],
        posterAt: Math.min(duration - 0.1, 1.2),
        onProgress: (r) => liveProgress.set(`${id}:${m.format}`, r),
        // Ni 3D ni code d'IA dans la page : le navigateur sans WebGL logiciel capture deux fois plus vite.
        webgl: false,
      });
      const storage = requirePort('storage');
      const folder = `users/${userId}/brands/${brandId}/montages/${id}/renders`;
      const stamp = Date.now().toString(36);
      const [mp4, poster] = await Promise.all([
        storage.uploadFile(fs.readFileSync(output.file), `montage-${m.format}-${stamp}.mp4`, folder, 'video/mp4'),
        storage.uploadFile(fs.readFileSync(output.poster), `montage-${m.format}-${stamp}.jpg`, folder, 'image/jpeg'),
      ]);
      const out = output;
      await this.store.mutate(userId, id, (x) => ({
        ...x,
        exportCount: x.exportCount + 1,
        renders: [{ format: m.format, status: 'done', progress: 1, url: mp4.downloadURL, posterUrl: poster.downloadURL, sizeBytes: out.sizeBytes, width: out.width, height: out.height, fps: out.fps, renderedAt: now() }],
        updatedAt: now(),
      }));
      logger.info('montage.exported', { event: 'montage.exported', montageId: id, format: m.format, sizeBytes: out.sizeBytes, durationSec: duration });
    } finally {
      if (output) cleanupRender(output);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  /** Au démarrage : les montages interrompus passent en échec (l'hôte rembourse). */
  async recoverInterrupted(onFailed: (userId: string, m: MontageVideo) => Promise<void>): Promise<number> {
    const list = await this.store.interrupted();
    for (const { userId, montage } of list) {
      const wasCreating = montage.status === 'processing' && montage.stage !== 'cut';
      const next = await this.store.mutate(userId, montage.id, (m) => ({
        ...m,
        // Une création coupée en route échoue ; une simple reprise des coupes revient à l'état d'avant.
        status: wasCreating || !m.edit ? 'failed' : 'ready',
        stage: wasCreating || !m.edit ? m.stage : 'ready',
        error: wasCreating || !m.edit ? 'interrupted' : m.error,
        renders: m.renders.map((r) => (r.status === 'rendering' ? { ...r, status: 'failed' as const, error: 'interrupted' } : r)),
        updatedAt: now(),
      }));
      if (next?.status === 'failed') await onFailed(userId, next).catch(() => undefined);
    }
    return list.length;
  }
}
