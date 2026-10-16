/**
 * `npm run bench --prefix packages/motion-compiler [-- --levels high,ultra --briefs typo,data]`
 *
 * LE BANC D'ESSAI du moteur vidéo, avec les vrais modèles (OpenRouter, l'échelle de modèles de chaque cran) :
 * quatre demandes, chacune rendue dans son format ET l'orientation opposée (un seul programme, responsive).
 *
 * Le directeur et le planificateur reçoivent les mêmes prompts à chaque passe et leur réponse est MISE EN CACHE
 * (bench/out/cache) : toutes les passes — celles d'avant la migration (`tsx`, `dsl` 0.1, gardées dans
 * results.json et baseline.json) comme la logique actuelle (`v2`) — partent du même storyboard ; seule l'écriture
 * des scènes diffère. Ni média généré, ni banque d'images, ni musique, ni voix : on mesure l'écriture et l'affichage
 * des scènes. L'autocorrection bornée du moteur reste active (comportement de production).
 *
 * Sorties : bench/out/results.json (mesures), bench/out/videos/<brief>-<logique>-<cran>[-<format>].mp4 (rendus),
 * bench/out/scenes/… (vignettes, code, programmes). Le rapport : `npm run bench:report`.
 */
process.env.VIDEO_MUSIC_OPENVERSE = 'off';
process.env.VIDEO_MUSIC_CCMIXTER = 'off';
process.env.VIDEO_SFX_OFFLINE = '1';
process.env.VIDEO_ALLOW_FILE_URLS = '1';
process.env.VIDEO_MEDIA_CHECK = 'off';
process.env.RENDER_ALLOWED_HOSTS = '127.0.0.1,localhost';
delete process.env.PEXELS_API_KEY;
import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { configureCore } from '../../../apps/ivision/core/src/runtime/host';
import { MotionVideoService } from '../../../apps/ivision/core/src/video/motionVideo.service';
import { createProgramAuthor, SceneAuthor, AuthorReport } from '../../../apps/ivision/core/src/video/author/program.author';
import type { VideoStore } from '../../../apps/ivision/core/src/video/contracts/store';
import type { MotionVideo } from '../../../apps/ivision/core/src/video/contracts/model';
import type { AgentCall } from '../../../apps/ivision/core/src/creativity/orchestrator';
import { closeFilmBrowser } from '../../../apps/ivision/core/src/video/rendering/runner';
import { MODEL_LADDERS } from '../../../apps/api/api/config/ai-models.config';
import { benchBriefs, BenchBrief } from './briefs';

const OUT = path.join(__dirname, 'out');
const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const LEVELS = arg('levels', 'high,ultra').split(',') as ('high' | 'ultra' | 'medium' | 'low')[];
/**
 * Depuis la migration, le moteur n'a plus qu'une logique : le programme compilé (`v2`, compilateur 0.2 : garanties
 * d'affichage, piste ajustée, responsive). Les mesures d'avant (`tsx` et `dsl` 0.1) restent dans `baseline.json`.
 */
const LOGICS = arg('logics', 'v2').split(',') as Logic[];
type Logic = 'tsx' | 'dsl' | 'v2';
/** Chaque vidéo est aussi rendue dans l'orientation opposée : un seul programme doit tenir dans les deux. */
const OPPOSITE: Record<string, 'story' | 'landscape'> = { story: 'landscape', portrait: 'landscape', square: 'story', landscape: 'story' };
const FORCE = process.argv.includes('--force');

// ─── Le fournisseur de modèles ──────────────────────────────────────────────

function apiKey(): string {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
  for (const f of ['../../../apps/api/.env.secret', '../../../apps/api/.env']) {
    const p = path.join(__dirname, f);
    if (!fs.existsSync(p)) continue;
    const m = fs.readFileSync(p, 'utf8').match(/^OPENROUTER_API_KEY=(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  throw new Error('OPENROUTER_API_KEY introuvable');
}

const MAX_OUT: Record<string, number> = { 'video.concept': 2500, 'video.planner': 9000, 'video.author': 8000, 'video.reviser': 800 };

interface Usage { calls: number; input: number; output: number; cost: number; ms: number }
const zero = (): Usage => ({ calls: 0, input: 0, output: 0, cost: 0, ms: 0 });
const add = (a: Usage, b: Usage) => { a.calls += b.calls; a.input += b.input; a.output += b.output; a.cost += b.cost; a.ms += b.ms; };

/** Un appel réel, avec la consommation EXACTE (jetons et coût en dollars rendus par OpenRouter). */
async function chat(model: string, system: string, user: string, maxTokens: number): Promise<{ text: string; usage: Usage }> {
  const started = Date.now();
  let lastError = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { data } = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        { model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: maxTokens, temperature: 0.7, reasoning: { enabled: false }, usage: { include: true } },
        { headers: { Authorization: `Bearer ${apiKey()}`, 'HTTP-Referer': 'https://idem.africa', 'X-Title': 'IDEM bench' }, timeout: 170_000 }
      );
      const u = data.usage || {};
      return { text: String(data.choices?.[0]?.message?.content || ''), usage: { calls: 1, input: u.prompt_tokens || 0, output: u.completion_tokens || 0, cost: u.cost || 0, ms: Date.now() - started } };
    } catch (error: any) {
      lastError = `${error?.response?.status || ''} ${JSON.stringify(error?.response?.data || error.message).slice(0, 200)}`;
      if (error?.response?.status === 402 || error?.response?.status === 401) break;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  console.warn(`    ✗ ${model} : ${lastError}`);
  return { text: '', usage: { calls: 1, input: 0, output: 0, cost: 0, ms: Date.now() - started } };
}

/** Le modèle d'un rôle à un cran : l'échelle de production (design / code). Lecture, intention : le plus léger. */
function modelFor(role: string, level: string): string {
  if (role === 'video.author') return MODEL_LADDERS.code[level as 'high'];
  if (role === 'video.concept' || role === 'video.planner' || role === 'video.reviser') return MODEL_LADDERS.design[level as 'high'];
  return MODEL_LADDERS.design.low;
}

interface Meter { shared: Usage; author: Usage; byModel: Record<string, Usage> }

/** L'appel d'agent du banc : cache des réponses NON-auteur (même storyboard pour les deux logiques), mesure par catégorie. */
function makeCall(meter: Meter): AgentCall {
  fs.mkdirSync(path.join(OUT, 'cache'), { recursive: true });
  return async ({ role, system, user, level }) => {
    const lv = level || 'high';
    const model = modelFor(role, lv);
    const isAuthor = role === 'video.author';
    const key = crypto.createHash('sha1').update(`${role}|${model}|${system}|${user}`).digest('hex');
    const file = path.join(OUT, 'cache', `${key}.json`);
    if (!isAuthor && fs.existsSync(file)) {
      const hit = JSON.parse(fs.readFileSync(file, 'utf8')) as { text: string; usage: Usage };
      add(meter.shared, hit.usage);
      return hit.text;
    }
    const { text, usage } = await chat(model, system, user, MAX_OUT[role] || 3000);
    add(isAuthor ? meter.author : meter.shared, usage);
    add((meter.byModel[model] ||= zero()), usage);
    if (!isAuthor && text) fs.writeFileSync(file, JSON.stringify({ text, usage }));
    return text;
  };
}

// ─── L'hôte : stockage disque, marque, vidéos en mémoire ─────────────────────

class BenchStore implements VideoStore {
  videos: MotionVideo[] = [];
  constructor(private readonly brief: BenchBrief) {}
  async loadBrand() {
    const b = this.brief.brand;
    return {
      brandName: b.name,
      branding: { colors: { colors: b.colors }, typography: { primary: { family: b.fonts.display }, secondary: { family: b.fonts.body } }, logo: { svg: b.logoSvg } } as any,
      voice: { brandName: b.name, ...b.voice, keywords: [] },
      visuals: [],
      videos: [],
      media: this.brief.brandMedia.map((m) => ({ url: `file://${m.file}`, kind: m.kind, note: m.note })),
    };
  }
  async listVideos() { return JSON.parse(JSON.stringify(this.videos)); }
  async saveVideo(_u: string, _p: string, video: MotionVideo) { this.videos = [...this.videos.filter((v) => v.id !== video.id), JSON.parse(JSON.stringify(video))]; }
  async mutateVideo(_u: string, _p: string, id: string, mutate: (v: MotionVideo) => MotionVideo) {
    let out: MotionVideo | null = null;
    this.videos = this.videos.map((v) => (v.id === id ? (out = mutate(v)) : v));
    return out;
  }
  async removeVideo() { return true; }
}

configureCore({
  apiBaseUrl: () => 'http://127.0.0.1:1',
  sfxUrl: (n) => `http://127.0.0.1:1/sfx/${n}`,
  storage: {
    async uploadFile(content, fileName, folder) {
      const dir = path.join(OUT, 'storage', folder.replace(/[^a-zA-Z0-9/_-]/g, '_'));
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, fileName);
      fs.writeFileSync(file, content);
      return { fileName, downloadURL: `file://${file}` };
    },
  },
});

// ─── Une exécution ──────────────────────────────────────────────────────────

export interface RunResult {
  brief: string;
  logic: Logic;
  /** Les formats rendus (le premier est le principal) et les MP4 de chacun. */
  formats?: string[];
  mp4s?: Record<string, string>;
  /** Défauts d'affichage relevés puis corrigés, et ceux qui restent. */
  layoutFixed?: number;
  layoutLeft?: number;
  level: string;
  ok: boolean;
  error?: string;
  /** Temps (ms). */
  genMs: number;
  renderMs: number;
  scenes: number;
  /** Scènes qui s'exécutent après autocorrection ; premières écritures qui échouaient. */
  scenesReady: number;
  firstPassErrors: number;
  repairAttempts: number;
  repairedScenes: number;
  /** Consommation réelle : l'auteur seul (ce qui diffère), et la direction + storyboard (commune, mise en cache). */
  author: Usage;
  shared: Usage;
  /** Moyennes de l'auteur par scène. */
  authorCodeChars: number;
  validationRetries: number;
  warnings: number;
  mp4?: string;
  mp4Seconds?: number;
  mp4Bytes?: number;
  title?: string;
  concept?: string;
  fidelity: string[];
  sceneList: { key: string; status: string; error?: string; layout?: string[]; start?: number; duration?: number; texts: Record<string, string>; purpose: string; thumb?: string; codeFile: string }[];
  perModel: Record<string, Usage>;
}

async function runOne(brief: BenchBrief, logic: Logic, level: string): Promise<RunResult> {
  const tag = `${brief.id}-${logic}-${level}`;
  const meter: Meter = { shared: zero(), author: zero(), byModel: {} };
  const reports: AuthorReport[] = [];
  const store = new BenchStore(brief);
  // Mesure de la 1re écriture : les erreurs AVANT autocorrection (compilation) — relevées par l'auteur lui-même.
  let firstPassErrors = 0;
  let checkErrors = 0;
  let codeChars = 0;
  let authored = 0;
  const wrap = (inner: SceneAuthor): SceneAuthor => async (ctx, context) => {
    const r = await inner(ctx, context);
    if (!context.repair && !context.revise) {
      authored++;
      if (r.error) firstPassErrors++;
      if (r.code) codeChars += r.code.length;
    }
    return r;
  };
  if (logic !== 'v2') throw new Error(`la logique « ${logic} » n'existe plus dans le moteur (voir baseline.json)`);
  const author = wrap(createProgramAuthor({ onReport: (r) => reports.push(r) }));
  const formats = [brief.format, OPPOSITE[brief.format]];
  const service = new MotionVideoService(store, makeCall(meter), author);
  const started = Date.now();
  const base: RunResult = { brief: brief.id, logic, level, ok: false, genMs: 0, renderMs: 0, scenes: 0, scenesReady: 0, firstPassErrors: 0, repairAttempts: 0, repairedScenes: 0, author: meter.author, shared: meter.shared, authorCodeChars: 0, validationRetries: 0, warnings: 0, fidelity: [], sceneList: [], perModel: meter.byModel };
  try {
    const video = await service.createVideo(
      'bench',
      'bench',
      {
        brief: {
          objective: brief.objective,
          message: brief.request.slice(0, 400),
          request: brief.request,
          musicMood: 'none',
          sfx: false,
          voice: false,
          allowGenerate: false,
          allowStock: false,
          language: 'fr',
          media: brief.uploads.map((u, i) => ({ id: `u${i}`, kind: 'image' as const, url: `file://${u.file}`, origin: 'upload' as const, name: u.name, width: u.width, height: u.height })),
        } as any,
        scope: { durationSec: brief.durationSec, formats, quality: 'standard' },
        creativity: level as 'high',
        language: 'fr',
      },
      0,
      // Le premier contrôle (avant l'autocorrection) : les erreurs de compilation ET d'exécution de la 1re écriture.
      (ev) => {
        if (ev.stage === 'check' && ev.state === 'done' && Array.isArray(ev.data?.errors)) checkErrors = (ev.data!.errors as unknown[]).length;
      }
    );
    base.genMs = Date.now() - started;
    const film = video.film!;
    base.title = film.title;
    base.concept = film.concept;
    base.scenes = film.scenes.length;
    base.scenesReady = film.scenes.filter((s) => s.status === 'ready').length;
    base.firstPassErrors = Math.max(firstPassErrors, checkErrors);
    base.repairAttempts = film.repair?.attempts || 0;
    base.repairedScenes = film.repair?.fixed.length || 0;
    base.authorCodeChars = authored ? Math.round(codeChars / authored) : 0;
    base.validationRetries = reports.reduce((n, r) => n + r.validationRetries, 0);
    base.warnings = reports.reduce((n, r) => n + r.warnings.length, 0);
    base.fidelity = film.fidelity?.notes || [];
    base.formats = formats;
    base.layoutFixed = film.repair?.layoutFixed?.length || 0;
    base.layoutLeft = film.scenes.filter((s) => s.layout?.length).length;
    const sceneDir = path.join(OUT, 'scenes', tag);
    fs.mkdirSync(sceneDir, { recursive: true });
    base.sceneList = film.scenes.map((s) => {
      const codeFile = `scenes/${tag}/${s.key}.tsx`;
      fs.writeFileSync(path.join(OUT, codeFile), s.code || `// aucun code : ${s.error?.message || ''}`);
      let thumb: string | undefined;
      if (s.thumbnail?.startsWith('file://')) {
        thumb = `scenes/${tag}/${s.key}.jpg`;
        fs.copyFileSync(s.thumbnail.slice(7), path.join(OUT, thumb));
      }
      return { key: s.key, status: s.status, ...(s.error ? { error: s.error.message.slice(0, 300) } : {}), ...(s.layout?.length ? { layout: s.layout } : {}), texts: s.texts, purpose: s.purpose, start: s.start, duration: s.duration, ...(thumb ? { thumb } : {}), codeFile };
    });
    if (reports.length) fs.writeFileSync(path.join(sceneDir, 'author-reports.json'), JSON.stringify(reports, null, 1));
    // Le rendu : le MÊME chemin que l'export de production, sur le MP4 lisible ou pas.
    const rs = Date.now();
    store.videos = [{ ...video, renders: video.scope.formats.map((format) => ({ format, status: 'queued' as const, progress: 0 })) }];
    await service.runExport({ userId: 'bench', projectId: 'bench', videoId: video.id, paidBefore: 0, service });
    base.renderMs = Date.now() - rs;
    fs.mkdirSync(path.join(OUT, 'videos'), { recursive: true });
    base.mp4s = {};
    for (const r of store.videos[0]?.renders || []) {
      if (r.status !== 'done' || !r.url?.startsWith('file://')) continue;
      const name = r.format === brief.format ? tag : `${tag}-${r.format}`;
      fs.copyFileSync(r.url.slice(7), path.join(OUT, 'videos', `${name}.mp4`));
      if (r.posterUrl?.startsWith('file://')) fs.copyFileSync(r.posterUrl.slice(7), path.join(OUT, 'videos', `${name}.jpg`));
      base.mp4s[r.format] = `videos/${name}.mp4`;
      if (r.format === brief.format) {
        base.mp4 = `videos/${name}.mp4`;
        base.mp4Bytes = r.sizeBytes;
        base.mp4Seconds = film.durationSec;
      }
    }
    if (!base.mp4) base.error = `rendu : ${store.videos[0]?.renders.find((r) => r.status === 'failed')?.error || 'aucun MP4'}`;
    base.ok = !!base.mp4;
  } catch (error: any) {
    base.genMs = base.genMs || Date.now() - started;
    base.error = String(error?.message || error).slice(0, 300);
  }
  return base;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const briefs = (await benchBriefs(path.join(OUT, 'assets'))).filter((b) => arg('briefs', '').split(',').filter(Boolean).length === 0 || arg('briefs', '').split(',').includes(b.id));
  const file = path.join(OUT, 'results.json');
  const results: RunResult[] = fs.existsSync(file) && !FORCE ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
  console.log(`Banc d'essai : ${briefs.length} demandes × ${LOGICS.join('/')} × ${LEVELS.join('/')}\n`);
  for (const level of LEVELS) {
    for (const brief of briefs) {
      for (const logic of LOGICS) {
        if (!FORCE && results.some((r) => r.brief === brief.id && r.logic === logic && r.level === level && r.ok)) {
          console.log(`  · ${brief.id} ${logic} ${level} : déjà mesuré`);
          continue;
        }
        process.stdout.write(`  → ${brief.id} ${logic} ${level} …\n`);
        const r = await runOne(brief, logic, level);
        const i = results.findIndex((x) => x.brief === r.brief && x.logic === r.logic && x.level === r.level);
        if (i >= 0) results.splice(i, 1);
        results.push(r);
        fs.writeFileSync(file, JSON.stringify(results, null, 1));
        console.log(`    ${r.ok ? '✓' : '✗'} ${(r.genMs / 1000).toFixed(0)} s · scènes ${r.scenesReady}/${r.scenes} (1re écriture en échec : ${r.firstPassErrors}, corrigées : ${r.repairedScenes}) · auteur ${r.author.calls} appels, ${r.author.input + r.author.output} jetons, $${r.author.cost.toFixed(4)}${r.error ? ` · ${r.error}` : ''}`);
      }
    }
  }
  await closeFilmBrowser();
  console.log(`\nMesures : ${file}`);
  process.exit(0);
})().catch(async (e) => {
  console.error(e);
  await closeFilmBrowser().catch(() => undefined);
  process.exit(1);
});
