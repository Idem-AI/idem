/**
 * LE REGISTRE DU CATALOGUE VIDÉO — d'où viennent les mises en page de scène, thèmes, animations, transitions et
 * gabarits, et comment ils se mettent à jour SANS rebuild. Même dépôt (`idem-templates`, dossier `catalog/videos/`),
 * même CDN, même signature que le catalogue des images ; un manifeste à part (`videos/manifest.json`).
 *
 * Sources, dans l'ordre :
 *   1. `IDEM_TEMPLATES_DIR`  le dépôt sur le disque (`catalog/videos/`), relu toutes les 10 s ;
 *   2. `IDEM_TEMPLATES_URL`  `<url>/videos/manifest.json`, relu toutes les `IDEM_TEMPLATES_TTL_S` (300 s) avec ETag, ou
 *                            tout de suite par `refreshVideoCatalog()` (webhook de publication) ;
 *   3. le cache disque       le dernier manifeste valide ;
 *   4. l'instantané          `IDEM_VIDEO_TEMPLATES_SNAPSHOT`, sinon `apps/ivision/core/catalog/video-snapshot.json` ;
 *   5. le minimum intégré    (`builtin.ts`) : aucun film ne s'arrête faute de catalogue.
 *
 * Sécurité : signature exigée dès que `IDEM_TEMPLATES_PUBKEY` est posée ; un nœud qui enfreint les règles (`types.ts`),
 * dangereux ou qui écrit des mots en dur est ÉCARTÉ et dit ; un manifeste d'une version majeure inconnue est refusé.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { hardcodedWords, unsafeReasons, verifyManifest } from '@idem/graphic-engine';
import logger from '../../runtime/logger';
import { BUILTIN_VIDEO_NODES } from './builtin';
import { LoadedVideoCatalog, nodeErrors, refErrors, VideoNode } from './types';

/** La version du moteur vidéo par catalogue : un manifeste d'une autre version MAJEURE est refusé. */
export const VIDEO_CATALOG_ENGINE = '1.0.0';

interface VideoManifest {
  schema: number;
  medium?: string;
  version: string;
  engine?: string;
  entries: Array<{ node: Record<string, unknown>; html?: string }>;
  signature?: string;
}

const snapshotFile = (): string => process.env.IDEM_VIDEO_TEMPLATES_SNAPSHOT?.trim() || path.resolve(__dirname, '../../../catalog/video-snapshot.json');
const cacheFile = (): string => path.join(process.env.IDEM_TEMPLATES_CACHE || path.join(os.tmpdir(), 'idem-templates-cache'), 'videos-manifest.json');
const ttlMs = (): number => {
  if (process.env.IDEM_TEMPLATES_DIR) return 10_000;
  const n = Number(process.env.IDEM_TEMPLATES_TTL_S);
  return (Number.isFinite(n) && n >= 5 ? n : 300) * 1000;
};

let current: LoadedVideoCatalog | null = null;
let loadedAt = 0;
let inflight: Promise<LoadedVideoCatalog> | null = null;
let etag: string | undefined;

/** Les textes d'un nœud qui doivent être sûrs (HTML, classes du thème). */
function unsafe(node: VideoNode): string[] {
  const texts = node.kind === 'layout' ? [node.html] : node.kind === 'theme' ? Object.values(node.classes ?? {}) : [];
  const bad = texts.flatMap((t) => unsafeReasons(String(t ?? '')));
  if (node.kind === 'layout') {
    const words = hardcodedWords(node.html.replace(/&[a-z]+;/gi, ' '));
    if (words.length) bad.push(`mots écrits en dur : ${words.join(' ')}`);
  }
  return bad;
}

/** Des entrées brutes → un catalogue VÉRIFIÉ (le minimum intégré toujours présent, jamais remplacé). */
export function buildVideoCatalog(entries: Array<{ node: Record<string, unknown>; html?: string }>, version: string, source: LoadedVideoCatalog['source']): LoadedVideoCatalog {
  const nodes = new Map<string, VideoNode>(BUILTIN_VIDEO_NODES.map((n) => [n.id, n]));
  const rejected: LoadedVideoCatalog['rejected'] = [];
  const candidates: VideoNode[] = [];
  for (const entry of entries) {
    const raw = { ...entry.node, ...(entry.html ? { html: entry.html } : {}) } as unknown as VideoNode;
    const id = String((raw as { id?: unknown }).id ?? '?');
    if (id.startsWith('builtin.')) {
      rejected.push({ id, reason: 'préfixe réservé' });
      continue;
    }
    const errors = [...nodeErrors(raw), ...unsafe(raw)];
    if (errors.length) rejected.push({ id, reason: errors.slice(0, 3).join(' · ') });
    else candidates.push(raw);
  }
  for (const n of candidates) nodes.set(n.id, n);
  // Les références, avec le catalogue entier (un gabarit vers une animation écartée est écarté à son tour).
  for (let pass = 0; pass < 3; pass++) {
    for (const n of [...nodes.values()]) {
      if (n.id.startsWith('builtin.')) continue;
      const errors = refErrors(n, nodes);
      if (errors.length) {
        nodes.delete(n.id);
        rejected.push({ id: n.id, reason: errors.slice(0, 2).join(' · ') });
      }
    }
  }
  return { version, source, nodes, rejected };
}

/** Le dépôt sur le disque : `catalog/videos/<sorte>/<groupe>/<id>/node.json` (+ `template.html`, `config.json`). */
export function readVideoTemplatesDir(dir: string): Array<{ node: Record<string, unknown>; html?: string }> {
  const root = fs.existsSync(path.join(dir, 'catalog', 'videos')) ? path.join(dir, 'catalog', 'videos') : dir;
  const out: Array<{ node: Record<string, unknown>; html?: string }> = [];
  const walk = (d: string) => {
    for (const name of fs.readdirSync(d).sort()) {
      const p = path.join(d, name);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (name === 'node.json') {
        try {
          const node = JSON.parse(fs.readFileSync(p, 'utf8')) as Record<string, unknown>;
          const config = path.join(d, 'config.json');
          const html = path.join(d, 'template.html');
          if (fs.existsSync(config)) node.config = JSON.parse(fs.readFileSync(config, 'utf8'));
          out.push({ node, ...(fs.existsSync(html) ? { html: fs.readFileSync(html, 'utf8').trim() } : {}) });
        } catch (error) {
          out.push({ node: { id: path.basename(d), invalid: String((error as Error)?.message ?? error).slice(0, 120) } });
        }
      }
    }
  };
  if (fs.existsSync(root)) walk(root);
  return out;
}

function fromManifest(manifest: VideoManifest, source: LoadedVideoCatalog['source']): LoadedVideoCatalog | { error: string } {
  if (!manifest || !Array.isArray(manifest.entries)) return { error: 'manifeste illisible' };
  const major = (v?: string) => Number(String(v ?? '1').split('.')[0]) || 0;
  if (major(manifest.engine) !== major(VIDEO_CATALOG_ENGINE)) return { error: `catalogue pour le moteur vidéo ${manifest.engine} (celui-ci : ${VIDEO_CATALOG_ENGINE})` };
  const signed = verifyManifest(manifest as never);
  if (!signed.ok) return { error: signed.reason ?? 'signature refusée' };
  return buildVideoCatalog(manifest.entries, manifest.version, source);
}

async function fromUrl(base: string): Promise<LoadedVideoCatalog | null> {
  const url = `${base.replace(/\/+$/, '')}/videos/manifest.json`;
  try {
    const res = await fetch(url, { headers: etag && current?.source === 'url' ? { 'if-none-match': etag } : {}, signal: AbortSignal.timeout(8000) });
    if (res.status === 304 && current) return current;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const loaded = fromManifest(JSON.parse(text) as VideoManifest, 'url');
    if ('error' in loaded) {
      logger.error('video.catalog_manifest_refused', { reason: loaded.error });
      return null;
    }
    etag = res.headers.get('etag') ?? undefined;
    try {
      fs.mkdirSync(path.dirname(cacheFile()), { recursive: true });
      fs.writeFileSync(cacheFile(), text);
    } catch {
      /* le cache disque est un confort */
    }
    return loaded;
  } catch (error) {
    logger.warn('video.catalog_fetch_failed', { reason: String((error as Error)?.message ?? error).slice(0, 200) });
    return null;
  }
}

function fromFile(file: string, source: LoadedVideoCatalog['source']): LoadedVideoCatalog | null {
  try {
    if (!fs.existsSync(file)) return null;
    const loaded = fromManifest(JSON.parse(fs.readFileSync(file, 'utf8')) as VideoManifest, source);
    return 'error' in loaded ? null : loaded;
  } catch {
    return null;
  }
}

async function load(): Promise<LoadedVideoCatalog> {
  let next: LoadedVideoCatalog | null = null;
  const dir = process.env.IDEM_TEMPLATES_DIR?.trim();
  if (dir) {
    try {
      next = buildVideoCatalog(readVideoTemplatesDir(dir), `dir:${new Date().toISOString().slice(0, 19)}`, 'dir');
    } catch (error) {
      logger.error('video.catalog_dir_failed', { dir, reason: String((error as Error)?.message ?? error).slice(0, 200) });
    }
  }
  const url = process.env.IDEM_TEMPLATES_URL?.trim();
  if (!next && url) next = await fromUrl(url);
  if (!next) next = fromFile(cacheFile(), 'cache') ?? fromFile(snapshotFile(), 'snapshot');
  if (!next) next = buildVideoCatalog([], 'builtin', 'builtin');
  if (next !== current) {
    const counts: Record<string, number> = {};
    for (const n of next.nodes.values()) if (!n.id.startsWith('builtin.')) counts[n.kind] = (counts[n.kind] ?? 0) + 1;
    logger.info('video.catalog_loaded', { version: next.version, source: next.source, ...counts, rejected: next.rejected.length });
    for (const r of next.rejected.slice(0, 20)) logger.warn('video.catalog_node_rejected', { id: r.id, reason: r.reason });
  }
  return next;
}

/** Le catalogue vidéo en vigueur (relu à l'expiration du cache, une seule lecture à la fois). */
export async function videoCatalog(): Promise<LoadedVideoCatalog> {
  if (current && Date.now() - loadedAt < ttlMs()) return current;
  if (!inflight) {
    inflight = load()
      .then((c) => {
        current = c;
        loadedAt = Date.now();
        return c;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Relire tout de suite (webhook `POST /catalog/refresh` après une publication). */
export async function refreshVideoCatalog(): Promise<LoadedVideoCatalog> {
  loadedAt = 0;
  return videoCatalog();
}

/** Contrôles : oublier le catalogue servi. */
export function resetVideoCatalog(): void {
  current = null;
  loadedAt = 0;
  etag = undefined;
}
