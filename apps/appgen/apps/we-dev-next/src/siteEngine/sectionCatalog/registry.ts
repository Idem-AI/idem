/**
 * LE REGISTRE DU CATALOGUE ICODE — d'où viennent les sections, en-têtes et pieds de page des sites vitrines, et
 * comment ils se mettent à jour SANS redéploiement. Même dépôt (`idem-templates`, dossier `catalog/icode/`), même CDN,
 * même signature que les catalogues des images et des vidéos ; un manifeste à part (`icode/manifest.json`).
 *
 * Sources, dans l'ordre : `IDEM_TEMPLATES_DIR` (le dépôt, relu toutes les 10 s) › `IDEM_TEMPLATES_URL` (+
 * `/icode/manifest.json`, ETag, `IDEM_TEMPLATES_TTL_S`) › le cache disque › l'instantané embarqué
 * (`sectionCatalog/snapshot.json`, `npm run catalog:snapshot`) › rien (le moteur écrit alors les sections comme avant).
 *
 * Sécurité : signature ed25519 exigée dès que `IDEM_TEMPLATES_PUBKEY` est posée ; un nœud qui enfreint les règles
 * (`types.ts`) est écarté et dit.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ChatLogger } from '../../utils/logger.js';
import { CatalogDirection, KindNode, LoadedSectionCatalog, nodeErrors, SectionNode, ShellNode } from './types.js';

// 2.0 : chaque nœud déclare ses directions artistiques (catalogue `directions` du dépôt).
export const ICODE_CATALOG_ENGINE = '2.0.0';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const snapshotFile = (): string => process.env.IDEM_ICODE_TEMPLATES_SNAPSHOT?.trim() || path.join(HERE, 'snapshot.json');
const cacheFile = (): string => path.join(process.env.IDEM_TEMPLATES_CACHE || path.join(os.tmpdir(), 'idem-templates-cache'), 'icode-manifest.json');
const ttlMs = (): number => {
  if (process.env.IDEM_TEMPLATES_DIR) return 10_000;
  const n = Number(process.env.IDEM_TEMPLATES_TTL_S);
  return (Number.isFinite(n) && n >= 5 ? n : 300) * 1000;
};

type RawEntry = { node: Record<string, unknown>; template?: string };
interface IcodeManifest {
  schema: number;
  version: string;
  engine?: string;
  directions?: Array<Record<string, unknown>>;
  entries: RawEntry[];
  signature?: string;
}

let current: LoadedSectionCatalog | null = null;
let loadedAt = 0;
let inflight: Promise<LoadedSectionCatalog> | null = null;
let etag: string | undefined;

/** Le JSON canonique (clés triées) : ce que la signature couvre — identique au dépôt. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.keys(value as Record<string, unknown>)
      .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  return JSON.stringify(value);
}

function verify(manifest: IcodeManifest): { ok: boolean; reason?: string } {
  const raw = process.env.IDEM_TEMPLATES_PUBKEY?.trim();
  if (!raw) return { ok: true };
  if (!manifest.signature) return { ok: false, reason: 'manifeste non signé alors qu’une clé publique est configurée' };
  try {
    const key = raw.includes('BEGIN') ? crypto.createPublicKey(raw) : crypto.createPublicKey({ key: Buffer.from(raw, 'base64'), format: 'der', type: 'spki' });
    const { signature, ...unsigned } = manifest;
    return crypto.verify(null, Buffer.from(canonicalJson(unsigned)), key, Buffer.from(signature, 'base64')) ? { ok: true } : { ok: false, reason: 'signature invalide' };
  } catch (error) {
    return { ok: false, reason: `signature illisible : ${(error as Error).message}` };
  }
}

/** Des entrées brutes → un catalogue VÉRIFIÉ. */
export function buildSectionCatalog(entries: RawEntry[], version: string, source: LoadedSectionCatalog['source'], rawDirections: Array<Record<string, any>> = []): LoadedSectionCatalog {
  const rejected: LoadedSectionCatalog['rejected'] = [];
  const directions = new Map<string, CatalogDirection>();
  for (const d of rawDirections) {
    if (typeof d?.id !== 'string') continue;
    directions.set(d.id, {
      id: d.id,
      neighbors: Array.isArray(d.neighbors) ? d.neighbors.map(String) : [],
      ...(d.name ? { name: d.name } : {}),
      ...(typeof d.radius === 'number' ? { radius: d.radius } : {}),
      ...(typeof d.typeRatio === 'number' ? { typeRatio: d.typeRatio } : {}),
      ...(d.tags?.density ? { density: d.tags.density } : {}),
    });
  }
  // Rangé par DA : un nœud sans DA, ou d'une DA inconnue, n'est pas servi.
  const directionErrors = (n: { directions?: string[] }): string[] => {
    if (!directions.size) return [];
    const own = Array.isArray(n.directions) ? n.directions : [];
    if (!own.length) return ['aucune direction artistique'];
    const unknown = own.filter((d) => !directions.has(d));
    return unknown.length ? [`direction artistique inconnue : ${unknown.join(', ')}`] : [];
  };
  const kinds = new Map<string, KindNode>();
  for (const e of entries) {
    const n = e.node as unknown as KindNode;
    if (n?.kind !== 'kind') continue;
    const errors = [...nodeErrors(n, kinds), ...directionErrors(n)];
    if (errors.length) rejected.push({ id: String(n.id), reason: errors.join(' · ') });
    else kinds.set(n.layout, n);
  }
  const sections: SectionNode[] = [];
  const headers: ShellNode[] = [];
  const footers: ShellNode[] = [];
  for (const e of entries) {
    const n = { ...e.node, ...(e.template ? { template: e.template } : {}) } as unknown as SectionNode | ShellNode;
    if ((n as { kind: string }).kind === 'kind') continue;
    const errors = [...nodeErrors(n, kinds), ...directionErrors(n)];
    if (errors.length) {
      rejected.push({ id: String(n.id), reason: errors.slice(0, 3).join(' · ') });
      continue;
    }
    if (n.kind === 'section') sections.push(n);
    else if (n.kind === 'header') headers.push(n);
    else if (n.kind === 'footer') footers.push(n);
  }
  return { version, source, kinds, sections, headers, footers, rejected, directions };
}

/** Les DA du dépôt sur le disque (`catalog/directions/<id>/node.json`), en version légère. */
export function readDirectionsDir(dir: string): Array<Record<string, unknown>> {
  const root = path.join(dir, 'catalog', 'directions');
  if (!fs.existsSync(root)) return [];
  const out: Array<Record<string, unknown>> = [];
  for (const name of fs.readdirSync(root).sort()) {
    const file = path.join(root, name, 'node.json');
    if (!fs.existsSync(file)) continue;
    try {
      const n = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, any>;
      out.push({ id: n.id, name: n.name, surface: n.surface, selectable: n.selectable, radius: n.radius, typeRatio: n.typeRatio, neighbors: n.neighbors, tags: n.tags });
    } catch {
      /* une fiche illisible est écartée par la construction du dépôt */
    }
  }
  return out;
}

/** La DA telle que le catalogue chargé la connaît (rayon, échelle, densité), pour le design system du site. */
export function catalogDirection(id?: string | null): CatalogDirection | undefined {
  return id ? current?.directions.get(String(id).trim()) : undefined;
}

/** Le dépôt sur le disque : `catalog/icode/**​/node.json` (+ `template.tsx`). */
export function readIcodeTemplatesDir(dir: string): RawEntry[] {
  const root = fs.existsSync(path.join(dir, 'catalog', 'icode')) ? path.join(dir, 'catalog', 'icode') : dir;
  const out: RawEntry[] = [];
  const walk = (d: string) => {
    for (const name of fs.readdirSync(d).sort()) {
      const p = path.join(d, name);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (name === 'node.json') {
        try {
          const node = JSON.parse(fs.readFileSync(p, 'utf8')) as Record<string, unknown>;
          const tpl = path.join(d, 'template.tsx');
          out.push({ node, ...(fs.existsSync(tpl) ? { template: fs.readFileSync(tpl, 'utf8').trim() } : {}) });
        } catch (error) {
          out.push({ node: { id: path.basename(d), invalid: (error as Error).message.slice(0, 120) } });
        }
      }
    }
  };
  if (fs.existsSync(root)) walk(root);
  return out;
}

function fromManifest(manifest: IcodeManifest, source: LoadedSectionCatalog['source']): LoadedSectionCatalog | { error: string } {
  if (!manifest || !Array.isArray(manifest.entries)) return { error: 'manifeste illisible' };
  const major = (v?: string) => Number(String(v ?? '1').split('.')[0]) || 0;
  if (major(manifest.engine) !== major(ICODE_CATALOG_ENGINE)) return { error: `catalogue pour le moteur ${manifest.engine}` };
  const signed = verify(manifest);
  if (!signed.ok) return { error: signed.reason ?? 'signature refusée' };
  return buildSectionCatalog(manifest.entries, manifest.version, source, manifest.directions ?? []);
}

async function fromUrl(base: string): Promise<LoadedSectionCatalog | null> {
  try {
    const res = await fetch(`${base.replace(/\/+$/, '')}/icode/manifest.json`, { headers: etag && current?.source === 'url' ? { 'if-none-match': etag } : {}, signal: AbortSignal.timeout(8000) });
    if (res.status === 304 && current) return current;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const loaded = fromManifest(JSON.parse(text) as IcodeManifest, 'url');
    if ('error' in loaded) {
      ChatLogger.error('SITE_CATALOG', 'Manifeste iCode refusé', { reason: loaded.error });
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
    ChatLogger.warn('SITE_CATALOG', 'Catalogue iCode injoignable', { reason: (error as Error).message.slice(0, 200) });
    return null;
  }
}

function fromFile(file: string, source: LoadedSectionCatalog['source']): LoadedSectionCatalog | null {
  try {
    if (!fs.existsSync(file)) return null;
    const loaded = fromManifest(JSON.parse(fs.readFileSync(file, 'utf8')) as IcodeManifest, source);
    return 'error' in loaded ? null : loaded;
  } catch {
    return null;
  }
}

async function load(): Promise<LoadedSectionCatalog> {
  let next: LoadedSectionCatalog | null = null;
  const dir = process.env.IDEM_TEMPLATES_DIR?.trim();
  if (dir) {
    try {
      next = buildSectionCatalog(readIcodeTemplatesDir(dir), `dir:${new Date().toISOString().slice(0, 19)}`, 'dir', readDirectionsDir(dir));
    } catch (error) {
      ChatLogger.error('SITE_CATALOG', 'Dépôt de gabarits illisible', { dir, reason: (error as Error).message.slice(0, 200) });
    }
  }
  const url = process.env.IDEM_TEMPLATES_URL?.trim();
  if (!next && url) next = await fromUrl(url);
  if (!next) next = fromFile(cacheFile(), 'cache') ?? fromFile(snapshotFile(), 'snapshot');
  if (!next) next = buildSectionCatalog([], 'none', 'none');
  if (next !== current) {
    ChatLogger.info('SITE_CATALOG', 'Catalogue iCode chargé', { version: next.version, source: next.source, kinds: next.kinds.size, sections: next.sections.length, headers: next.headers.length, footers: next.footers.length, rejected: next.rejected.length });
    for (const r of next.rejected.slice(0, 20)) ChatLogger.warn('SITE_CATALOG', `Nœud écarté : ${r.id}`, { reason: r.reason });
  }
  return next;
}

/** Le catalogue en vigueur (relu à l'expiration du cache, une seule lecture à la fois). */
export async function sectionCatalog(): Promise<LoadedSectionCatalog> {
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

/** Relire tout de suite (webhook de publication). */
export async function refreshSectionCatalog(): Promise<LoadedSectionCatalog> {
  loadedAt = 0;
  return sectionCatalog();
}

export function resetSectionCatalog(): void {
  current = null;
  loadedAt = 0;
  etag = undefined;
}
