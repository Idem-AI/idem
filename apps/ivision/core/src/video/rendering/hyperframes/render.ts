/**
 * LE RENDU HYPERFRAMES — la composition (`composition.ts`) devient un MP4 muet par le producteur HyperFrames
 * (`@hyperframes/producer`, Chrome sans interface + FFmpeg), puis le code d'IDEM mixe la bande son (musique, voix,
 * effets planifiés) et tire l'affiche — exactement comme pour Motion Canvas (`rendering/ffmpeg.ts`).
 *
 * Mesuré sur la machine de test (MacBook Pro 2019, Intel, sans GPU) : 4 s en 1080 × 1080 rendues en 28 s, dont ~22 s de
 * démarrage de Chrome. Le producteur est un module ESM : il est chargé par un vrai `import()` (le code est compilé en
 * CommonJS). Il demande Node 22 ou plus (la production passe en Node 22).
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
import { mixAudio, run } from '../ffmpeg';
import type { SfxKind, VideoQuality } from '../../contracts/model';
import type { SfxCue } from '../../audio/sfx';

export interface HyperFramesRenderInput {
  html: string;
  /** Les fichiers servis à côté de la page (médias, logo), par nom. */
  files: { name: string; data: Buffer }[];
  durationSec: number;
  fps: number;
  quality: VideoQuality;
  music?: { file: string; startAt: number; phraseEnd?: boolean };
  sfx?: { files: Partial<Record<SfxKind, string | string[]>>; cues: (SfxCue & { db: number; take?: number })[] };
  voice?: { file: string; at: number }[];
  posterAt?: number;
  onProgress?: (ratio: number) => void;
}

export interface HyperFramesRenderOutput {
  file: string;
  poster: string;
  workDir: string;
  sizeBytes: number;
}

// Un vrai `import()` (le compilateur TypeScript le changerait en `require`, qui ne charge pas un module ESM en Node 20).
const esmImport = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<any>;

let producer: Promise<{ createRenderJob: (c: Record<string, unknown>) => any; executeRenderJob: (job: any, dir: string, out: string, progress?: (job: any, message: string) => void) => Promise<void> }> | null = null;

/**
 * Le fichier d'entrée du producteur : le paquet n'exporte qu'une entrée ESM (`import`), que `require.resolve` ne voit
 * pas ; on le cherche donc dans les `node_modules` en remontant depuis ce fichier.
 */
function producerEntry(): string {
  for (let dir = __dirname; ; dir = path.dirname(dir)) {
    const file = path.join(dir, 'node_modules', '@hyperframes', 'producer', 'dist', 'index.js');
    if (fs.existsSync(file)) return file;
    if (path.dirname(dir) === dir) throw new Error('hyperframes_missing: @hyperframes/producer introuvable');
  }
}

function loadProducer() {
  if (!producer) producer = esmImport(pathToFileURL(producerEntry()).href);
  return producer;
}

/** La qualité d'IDEM → celle d'HyperFrames. */
const QUALITY: Record<VideoQuality, 'draft' | 'standard' | 'high'> = { standard: 'standard', hd: 'standard', premium: 'high' };

export async function renderHyperFrames(input: HyperFramesRenderInput): Promise<HyperFramesRenderOutput> {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'idem-hf-'));
  try {
    const project = path.join(workDir, 'project');
    fs.mkdirSync(project);
    fs.writeFileSync(path.join(project, 'index.html'), input.html);
    for (const f of input.files) fs.writeFileSync(path.join(project, path.basename(f.name)), f.data);
    const { createRenderJob, executeRenderJob } = await loadProducer();
    const job = createRenderJob({ fps: input.fps, quality: QUALITY[input.quality] ?? 'standard' });
    const silent = path.join(workDir, 'silent.mp4');
    await executeRenderJob(job, project, silent, (j) => input.onProgress?.(Math.min(0.9, (Number(j.progress) || 0) / 100 * 0.9)));
    if (job.status && job.status !== 'complete') throw new Error(`hyperframes_render_failed: ${String(job.error || job.status).slice(0, 300)}`);
    const file = path.join(workDir, 'video.mp4');
    await mixAudio({ silent, file, d: input.durationSec, music: input.music, cues: input.sfx?.cues ?? [], files: input.sfx?.files ?? {}, voice: input.voice ?? [] });
    const poster = path.join(workDir, 'poster.jpg');
    const posterAt = Math.max(0, Math.min(input.durationSec - 0.1, input.posterAt ?? input.durationSec * 0.2));
    await run(['-y', '-v', 'error', '-ss', posterAt.toFixed(3), '-i', file, '-frames:v', '1', '-q:v', '3', poster]);
    input.onProgress?.(1);
    return { file, poster, workDir, sizeBytes: fs.statSync(file).size };
  } catch (error) {
    fs.rmSync(workDir, { recursive: true, force: true });
    throw error;
  }
}
