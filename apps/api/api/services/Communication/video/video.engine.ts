/**
 * Le moteur React des vidéos, empaqueté pour la page de rendu.
 *
 * Sources : `apps/api/video-engine/src` (TSX). Paquet : `public/video-engine/engine.js`,
 * produit par `npm run build:video-engine` (appelé par `npm run build`). En
 * développement, le paquet est reconstruit à la demande si les sources sont
 * plus récentes ; en production (image Docker), seul le paquet est présent.
 */
import fs from 'fs';
import path from 'path';
import logger from '../../../config/logger';

const SOURCE_DIR = (): string | null => {
  const candidates = [path.resolve(process.cwd(), 'video-engine/src'), path.resolve(__dirname, '../../../../video-engine/src')];
  return candidates.find((dir) => fs.existsSync(path.join(dir, 'index.tsx'))) || null;
};

const BUNDLE_FILE = (): string => {
  const candidates = [path.resolve(process.cwd(), 'public/video-engine/engine.js'), path.resolve(__dirname, '../../../../public/video-engine/engine.js')];
  return candidates.find((f) => fs.existsSync(f)) || candidates[0];
};

function newestSource(dir: string): number {
  return Math.max(...fs.readdirSync(dir).map((f) => fs.statSync(path.join(dir, f)).mtimeMs));
}

/** Construit le paquet (React + moteur + feuille de style) avec esbuild. */
export async function buildVideoEngine(outFile = BUNDLE_FILE()): Promise<string> {
  const src = SOURCE_DIR();
  if (!src) throw new Error('video-engine sources not found');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const esbuild = require('esbuild');
  const result = await esbuild.build({
    entryPoints: [path.join(src, 'index.tsx')],
    bundle: true,
    format: 'iife',
    minify: true,
    write: false,
    target: 'es2020',
    jsx: 'automatic',
    loader: { '.css': 'text' },
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'error',
  });
  const js = result.outputFiles[0].text as string;
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, js);
  return js;
}

let cached: { js: string; at: number } | null = null;

/** Le paquet du moteur : reconstruit si les sources ont changé (développement). */
export async function engineBundle(): Promise<string> {
  const file = BUNDLE_FILE();
  const src = SOURCE_DIR();
  const builtAt = fs.existsSync(file) ? fs.statSync(file).mtimeMs : 0;
  if (src && newestSource(src) > builtAt) {
    logger.info('video.engine.rebuild');
    const js = await buildVideoEngine(file);
    cached = { js, at: Date.now() };
    return js;
  }
  if (cached && cached.at >= builtAt) return cached.js;
  if (!builtAt) throw new Error('video engine bundle missing: run npm run build:video-engine');
  cached = { js: fs.readFileSync(file, 'utf8'), at: builtAt };
  return cached.js;
}
