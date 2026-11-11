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
import { KindNode, LoadedSectionCatalog, nodeErrors, SectionNode, ShellNode } from './types.js';

export const ICODE_CATALOG_ENGINE = '1.0.0';
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
export function buildSectionCatalog(entries: RawEntry[], version: string, source: LoadedSectionCatalog['source']): LoadedSectionCatalog {
  const rejected: LoadedSectionCatalog['rejected'] = [];
  const kinds = new Map<string, KindNode>();
  for (const e of entries) {
    const n = e.node as unknown as KindNode;
    if (n?.kind !== 'kind') continue;
    const errors = nodeErrors(n, kinds);
    if (errors.length) rejected.push({ id: String(n.id), reason: errors.join(' · ') });
    else kinds.set(n.layout, n);
  }
  const sections: SectionNode[] = [];
  const headers: ShellNode[] = [];
  const footers: ShellNode[] = [];
  for (const e of entries) {
    const n = { ...e.node, ...(e.template ? { template: e.template } : {}) } as unknown as SectionNode | ShellNode;
    if ((n as { kind: string }).kind === 'kind') continue;
    const errors = nodeErrors(n, kinds);
    if (errors.length) {
      rejected.push({ id: String(n.id), reason: errors.slice(0, 3).join(' · ') });
      continue;
    }
    if (n.kind === 'section') sections.push(n);
    else if (n.kind === 'header') headers.push(n);
    else if (n.kind === 'footer') footers.push(n);
  }
  return { version, source, kinds, sections, headers, footers, rejected };
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
  return buildSectionCatalog(manifest.entries, manifest.version, source);
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
      next = buildSectionCatalog(readIcodeTemplatesDir(dir), `dir:${new Date().toISOString().slice(0, 19)}`, 'dir');
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
