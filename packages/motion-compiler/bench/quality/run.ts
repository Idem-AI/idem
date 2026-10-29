/**
 * `npm run bench:quality --prefix packages/motion-compiler -- --levels low,high --engine intent [--briefs product-hook,…] [--limit 8] [--providers Alibaba]`
 *
 * LE BANC QUALITÉ (phase 0 du plan) — avec les VRAIS modèles (payant : à lancer sur décision, jamais pour itérer).
 * Chaque demande du banc (`briefs.ts`, 40) est créée par le moteur, à chaque cran demandé, puis exportée dans son format.
 *
 *   --engine intent   le moteur du plan (intentions échantillonnées et jugées, compilateur 0.3) ;
 *   --engine program  l'auteur de programmes (un jet par scène) — la LIGNE DE BASE. Pour la ligne de base du moteur
 *                     d'avant le plan, lancer ce banc sur ce commit-là (`--label baseline`) : le code et ses réglages
 *                     sont ceux de la vidéo mesurée, et le résultat garde le commit.
 *
 * Sorties (bench/out/quality/, ignoré par Git) : `results.json` (une entrée par demande × moteur × cran : scores et
 * mesures du juge par scène, défauts au premier jet, recours à l'aplat, échantillonnage, jetons, coût EXACT, fournisseurs
 * servis, durées), `videos/<label>-<cran>-<demande>.mp4`. Puis `bench:quality:rate` (paires à l'aveugle), `…:fit`.
 */
process.env.VIDEO_MUSIC_OPENVERSE = 'off';
process.env.VIDEO_MUSIC_CCMIXTER = 'off';
process.env.VIDEO_SFX_OFFLINE = '1';
process.env.VIDEO_ALLOW_FILE_URLS = '1';
delete process.env.PEXELS_API_KEY;
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { configureCore } from '../../../../apps/ivision/core/src/runtime/host';
import { drainRenderQueue, MotionVideoService } from '../../../../apps/ivision/core/src/video/motionVideo.service';
import { closeFilmBrowser } from '../../../../apps/ivision/core/src/video/rendering/runner';
import type { VideoStore } from '../../../../apps/ivision/core/src/video/contracts/store';
import type { MotionVideo } from '../../../../apps/ivision/core/src/video/contracts/model';
import { openRouterCall, zeroUsage } from './openrouter';
import { qualityBriefs, QualityBrief } from './briefs';

const OUT = path.join(__dirname, '../out/quality');
const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const LEVELS = arg('levels', 'low,medium,high,ultra').split(',') as ('low' | 'medium' | 'high' | 'ultra')[];
const ENGINE = arg('engine', 'intent') as 'intent' | 'program';
const LABEL = arg('label', ENGINE);
const ONLY = arg('briefs', '').split(',').filter(Boolean);
const LIMIT = Number(arg('limit', '40'));
const PROVIDERS = arg('providers', '').split(',').filter(Boolean);
const FORCE = process.argv.includes('--force');
process.env.VIDEO_AUTHOR_MODE = ENGINE;

export interface QualityResult {
  key: string;
  label: string;
  engine: string;
  commit: string;
  level: string;
  brief: string;
  type: string;
  beat: string;
  format: string;
  language: string;
  ok: boolean;
  error?: string;
  mp4?: string;
  direction?: string;
  scenes: { key: string; role?: string; score?: number; features?: Record<string, number>; status: string; layout: number }[];
  firstPassLayout: number;
  inkFallbacks: number;
  sampling?: Record<string, number>;
  usage: ReturnType<typeof zeroUsage>;
  genMs: number;
  renderMs: number;
}

function commit(): string {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: __dirname }).toString().trim();
  } catch {
    return 'unknown';
  }
}

async function runOne(brief: QualityBrief, level: string): Promise<QualityResult> {
  const usage = zeroUsage();
  const storage = path.join(OUT, 'storage', `${LABEL}-${level}-${brief.id}`);
  configureCore({
    storage: {
      uploadFile: async (content, name, folder) => {
        const dir = path.join(storage, folder);
        fs.mkdirSync(dir, { recursive: true });
        const file = path.join(dir, name);
        fs.writeFileSync(file, content);
        return { downloadURL: `file://${file}` };
      },
    },
    agentCall: () => openRouterCall(usage, { providers: PROVIDERS }),
  });
  const videos = new Map<string, MotionVideo>();
  const store: VideoStore = {
    loadBrand: async () => ({ brandName: brief.brand.name, branding: { colors: { colors: brief.brand.colors }, typography: { primaryFont: brief.brand.fonts.display, secondaryFont: brief.brand.fonts.body } } as never, voice: { tone: brief.brand.tone, language: brief.language }, visuals: [], videos: [...videos.values()] }),
    listVideos: async () => [...videos.values()],
    saveVideo: async (_u, _p, v) => void videos.set(v.id, v),
    mutateVideo: async (_u, _p, id, fn) => {
      const v = videos.get(id);
      if (!v) return null;
      const next = fn(v);
      videos.set(id, next);
      return next;
    },
    removeVideo: async (_u, _p, id) => videos.delete(id),
  };
  const service = new MotionVideoService(store);
  const base: QualityResult = { key: `${LABEL}|${level}|${brief.id}`, label: LABEL, engine: ENGINE, commit: commit(), level, brief: brief.id, type: brief.type, beat: brief.beat, format: brief.format, language: brief.language, ok: false, scenes: [], firstPassLayout: 0, inkFallbacks: 0, usage, genMs: 0, renderMs: 0 };
  const t0 = Date.now();
  try {
    const video = await service.createVideo('bench', 'bench', { brief: { message: brief.request.slice(0, 380), request: brief.request, objective: brief.objective, musicMood: 'none', sfx: true, allowGenerate: false, allowStock: false, language: brief.language }, scope: { durationSec: brief.durationSec, formats: [brief.format], quality: 'standard' }, creativity: level as never, language: brief.language }, 0);
    base.genMs = Date.now() - t0;
    const film = video.film!;
    const t1 = Date.now();
    if (!film.scenes.some((s) => s.status === 'error')) {
      await service.startExport('bench', 'bench', video.id, video.scope);
      await drainRenderQueue();
    }
    base.renderMs = Date.now() - t1;
    const done = (await service.getVideo('bench', 'bench', video.id))!;
    const render = done.renders.find((r) => r.format === brief.format && r.status === 'done');
    if (render?.url) {
      const dest = path.join(OUT, 'videos', `${LABEL}-${level}-${brief.id}.mp4`);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(render.url.replace('file://', ''), dest);
      base.mp4 = path.relative(OUT, dest);
    }
    return {
      ...base,
      ok: !!render,
      direction: film.design?.direction,
      scenes: film.scenes.map((s) => ({ key: s.key, role: s.role, score: s.judge?.score, features: s.judge?.features, status: s.status, layout: s.layout?.length || 0 })),
      firstPassLayout: film.repair?.firstPassLayout || 0,
      inkFallbacks: film.repair?.inkFallbacks || 0,
      ...(film.sampling ? { sampling: film.sampling as unknown as Record<string, number> } : {}),
    };
  } catch (error) {
    return { ...base, genMs: Date.now() - t0, error: (error as Error).message.slice(0, 300) };
  }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, 'results.json');
  const results: Record<string, QualityResult> = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const briefs = qualityBriefs().filter((b) => !ONLY.length || ONLY.includes(b.id)).slice(0, LIMIT);
  for (const level of LEVELS) {
    for (const brief of briefs) {
      const key = `${LABEL}|${level}|${brief.id}`;
      if (results[key]?.ok && !FORCE) continue;
      console.log(`→ ${key}`);
      const r = await runOne(brief, level);
      results[key] = r;
      fs.writeFileSync(file, JSON.stringify(results, null, 2));
      console.log(`  ${r.ok ? '✓' : '✗'} ${(r.genMs / 1000).toFixed(0)} s · ${r.usage.calls} appels · ${r.usage.cost.toFixed(4)} $${r.error ? ` · ${r.error}` : ''}`);
      if (/openrouter_40[123]/.test(r.error || '')) {
        console.log('Arrêt : compte OpenRouter refusé (clé, crédit ou plafond).');
        await closeFilmBrowser();
        process.exit(1);
      }
    }
  }
  await closeFilmBrowser();
  const all = Object.values(results).filter((r) => r.label === LABEL);
  console.log(`\n${all.filter((r) => r.ok).length}/${all.length} vidéos · ${all.reduce((a, r) => a + r.usage.cost, 0).toFixed(3)} $`);
})();
