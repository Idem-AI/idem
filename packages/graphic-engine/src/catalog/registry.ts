/**
 * LE REGISTRE DU CATALOGUE — d'où viennent les gabarits, et comment ils se mettent à jour SANS rebuild.
 *
 * Sources, dans l'ordre :
 *   1. `IDEM_TEMPLATES_DIR`  le dépôt `idem-templates` sur le disque (développement, contributions) : relu toutes les
 *                            10 s, un fichier modifié est servi à la génération suivante ;
 *   2. `IDEM_TEMPLATES_URL`  le catalogue PUBLIÉ (CDN) : `manifest.json` relu toutes les `IDEM_TEMPLATES_TTL_S`
 *                            (300 s) avec ETag, ou tout de suite par `refreshCatalog()` (webhook de publication) ;
 *                            le HTML d'un nœud est téléchargé à la demande, vérifié par son sha256, gardé sur disque ;
 *   3. le cache disque       le dernier manifeste valide (le CDN peut tomber) ;
 *   4. l'instantané embarqué `catalog/snapshot.json` du paquet (aucun réseau) ;
 *   5. le minimum intégré    une page empilée sobre : aucune génération ne s'arrête faute de catalogue.
 *
 * Sécurité : un manifeste signé (ed25519, `IDEM_TEMPLATES_PUBKEY`) est exigé dès qu'une clé publique est donnée ; un
 * nœud invalide, dangereux (script, adresse étrangère, CSS natif) ou qui écrit des mots en dur est ÉCARTÉ et dit ;
 * une version de catalogue trop récente pour ce moteur est refusée (le précédent reste servi).
 */
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { engineHost, log } from '../host';
import { ENGINE_VERSION } from '../version';
import { BUILTIN_NODES } from './builtin';
import { CatalogNode, CatalogOverrides, LoadedCatalog, Manifest } from './types';

/** L'instantané embarqué : `IDEM_TEMPLATES_SNAPSHOT` (image Docker), sinon à côté des sources du paquet. */
const snapshotFile = (): string => process.env.IDEM_TEMPLATES_SNAPSHOT?.trim() || path.resolve(__dirname, '../../catalog/snapshot.json');

const ttlMs = (): number => {
  if (process.env.IDEM_TEMPLATES_DIR) return 10_000;
  const n = Number(process.env.IDEM_TEMPLATES_TTL_S);
  return (Number.isFinite(n) && n >= 5 ? n : 300) * 1000;
};
const cacheDir = (): string => process.env.IDEM_TEMPLATES_CACHE || path.join(os.tmpdir(), 'idem-templates-cache');

let current: LoadedCatalog | null = null;
let loadedAt = 0;
let inflight: Promise<LoadedCatalog> | null = null;
let etag: string | undefined;
let overrides: { at: number; value: CatalogOverrides } = { at: 0, value: {} };

// ── Sécurité d'un nœud ───────────────────────────────────────────────────────────────────────

const FORBIDDEN: Array<[RegExp, string]> = [
  [/<\s*(script|iframe|object|embed|style|link|meta|base|form|input|button|template)\b/i, 'balise interdite'],
  [/\son[a-z]+\s*=/i, 'gestionnaire d’événement'],
  [/javascript:|vbscript:|data:text\/html/i, 'adresse exécutable'],
  [/https?:\/\/|\/\/[a-z0-9-]+\.[a-z]/i, 'adresse étrangère'],
  [/\sstyle\s*=|url\s*\(|@import|expression\s*\(/i, 'CSS natif'],
  // Un « > » dans une classe (`[&>p]:…`) ferme la balise pour le découpage du HTML : la classe est perdue. Écrire `*:…`.
  [/class="[^"]*>/i, '« > » dans une classe (écrire *:… ou [&_x]:…)'],
];

/** Le texte visible d'un fragment, directives et clés retirées : un mot écrit en dur est refusé (les mots viennent du contenu). */
export function hardcodedWords(html: string): string[] {
  const visible = html
    .replace(/\[\[[^\]]*\]\]/g, ' ')
    .replace(/\{\{[^}]*\}\}/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#\d+|#x[\da-f]+|[a-z]+);/gi, ' ');
  return [...visible.matchAll(/\p{L}[\p{L}'’-]*/gu)].map((m) => m[0]).slice(0, 6);
}

/** Les défauts de sécurité d'un fragment (HTML de composant, décor d'habillage, classes). */
export function unsafeReasons(text: string): string[] {
  return FORBIDDEN.filter(([re]) => re.test(text)).map(([, why]) => why);
}

function checkNode(node: CatalogNode): string | null {
  const texts: string[] = [];
  if (node.kind === 'component' && node.html) texts.push(node.html);
  if (node.kind === 'skin') texts.push(...Object.values(node.classes), ...Object.values(node.chrome ?? {}), ...(node.vars ?? []).flatMap((v) => v.options.flatMap((o) => Object.values(o.classes ?? {}))));
  if (node.kind === 'component') texts.push(...(node.vars ?? []).flatMap((v) => v.options.flatMap((o) => Object.values(o.classes ?? {}))));
  for (const t of texts) {
    const bad = unsafeReasons(t);
    if (bad.length) return `contenu refusé : ${bad.join(', ')}`;
  }
  const fragments = node.kind === 'component' && node.html ? [node.html] : node.kind === 'skin' ? Object.values(node.chrome ?? {}) : [];
  for (const f of fragments) {
    const words = hardcodedWords(f);
    if (words.length) return `mots écrits en dur (les textes viennent du contenu) : ${words.join(' ')}`;
  }
  return null;
}

/** Le gabarit pointe-t-il vers des nœuds présents (squelette, habillage, composants) ? */
function danglingRefs(node: CatalogNode, nodes: Map<string, CatalogNode>): string | null {
  if (node.kind !== 'gabarit') return null;
  const c = node.config;
  if (nodes.get(c.layout)?.kind !== 'layout') return `squelette inconnu : ${c.layout}`;
  if (nodes.get(c.skin)?.kind !== 'skin') return `habillage inconnu : ${c.skin}`;
  for (const id of Object.values(c.components)) if (nodes.get(id)?.kind !== 'component') return `composant inconnu : ${id}`;
  return null;
}

// ── Versions et signature ────────────────────────────────────────────────────────────────────

const semver = (v: string): number[] => v.split(/[.-]/).slice(0, 3).map((p) => Number(p) || 0);
export function engineSupports(required: string, engine = ENGINE_VERSION): boolean {
  const [a, b, c] = semver(engine);
  const [x, y, z] = semver(required);
  return a !== x ? a > x : b !== y ? b > y : c >= z;
}

/** Le JSON canonique (clés triées) : ce que la signature couvre. */
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

function publicKey(): crypto.KeyObject | null {
  const raw = process.env.IDEM_TEMPLATES_PUBKEY?.trim();
  if (!raw) return null;
  try {
    return raw.includes('BEGIN') ? crypto.createPublicKey(raw) : crypto.createPublicKey({ key: Buffer.from(raw, 'base64'), format: 'der', type: 'spki' });
  } catch (error) {
    log().error('catalog.pubkey_invalid', { reason: String((error as Error)?.message ?? error).slice(0, 160) });
    return null;
  }
}

export function verifyManifest(manifest: Manifest, key: crypto.KeyObject | null = publicKey()): { ok: boolean; reason?: string } {
  if (!key) return { ok: true };
  if (!manifest.signature) return { ok: false, reason: 'manifeste non signé alors qu’une clé publique est configurée' };
  const { signature, ...unsigned } = manifest;
  try {
    return crypto.verify(null, Buffer.from(canonicalJson(unsigned)), key, Buffer.from(signature, 'base64')) ? { ok: true } : { ok: false, reason: 'signature invalide' };
  } catch (error) {
    return { ok: false, reason: `signature illisible : ${String((error as Error)?.message ?? error).slice(0, 120)}` };
  }
}

const sha256 = (text: string | Buffer): string => crypto.createHash('sha256').update(text).digest('hex');

// ── Construction d'un catalogue à partir de nœuds bruts ──────────────────────────────────────

/** Valide des nœuds bruts (manifeste, dossier, instantané) et rend le catalogue chargé. Le minimum intégré est toujours là. */
export function buildCatalog(raw: Array<{ node: unknown; html?: { file: string; sha256: string } }>, meta: { version: string; source: LoadedCatalog['source'] }): LoadedCatalog {
  const nodes = new Map<string, CatalogNode>();
  const htmlRefs = new Map<string, { file: string; sha256: string }>();
  const rejected: LoadedCatalog['rejected'] = [];
  for (const b of BUILTIN_NODES) nodes.set(b.id, b);
  for (const entry of raw) {
    const id = String((entry.node as { id?: unknown })?.id ?? '?');
    const parsed = CatalogNode.safeParse(entry.node);
    if (!parsed.success) {
      rejected.push({ id, reason: parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join(' ; ').slice(0, 300) });
      continue;
    }
    if (id.startsWith('builtin.')) {
      rejected.push({ id, reason: 'préfixe réservé au moteur' });
      continue;
    }
    const bad = checkNode(parsed.data);
    if (bad) {
      rejected.push({ id, reason: bad });
      continue;
    }
    if (nodes.has(id)) {
      rejected.push({ id, reason: 'identifiant en double' });
      continue;
    }
    nodes.set(id, parsed.data);
    if (entry.html && parsed.data.kind === 'component' && !parsed.data.html) htmlRefs.set(id, entry.html);
  }
  // Un gabarit dont une pièce manque n'est pas servi.
  for (const node of [...nodes.values()]) {
    const why = danglingRefs(node, nodes);
    if (why) {
      nodes.delete(node.id);
      rejected.push({ id: node.id, reason: why });
    }
  }
  return { version: meta.version, source: meta.source, nodes, htmlRefs, rejected };
}

// ── Les sources ──────────────────────────────────────────────────────────────────────────────

/**
 * Le dépôt sur le disque : `catalog/images/<sorte>/…/<id>/node.json` (+ `config.json` d'un gabarit, `template.html` d'un
 * composant). Le catalogue VIDÉO (`catalog/videos/`) a son propre registre, dans le moteur vidéo : il n'est jamais lu ici.
 */
export function readTemplatesDir(dir: string): Array<{ node: unknown }> {
  const out: Array<{ node: unknown }> = [];
  const walk = (d: string) => {
    for (const name of fs.readdirSync(d)) {
      const p = path.join(d, name);
      const stat = fs.statSync(p);
      if (stat.isDirectory()) walk(p);
      else if (name === 'node.json') {
        try {
          const node = JSON.parse(fs.readFileSync(p, 'utf8')) as Record<string, unknown>;
          const html = path.join(d, 'template.html');
          const config = path.join(d, 'config.json');
          if (fs.existsSync(html)) node.html = fs.readFileSync(html, 'utf8').trim();
          if (fs.existsSync(config)) node.config = JSON.parse(fs.readFileSync(config, 'utf8'));
          out.push({ node });
        } catch (error) {
          out.push({ node: { id: path.basename(d), invalid: String((error as Error)?.message ?? error).slice(0, 120) } });
        }
      }
    }
  };
  // `catalog/images/` depuis la séparation images / vidéos (11/11/2026) ; `catalog/` pour un dépôt plus ancien.
  const root = fs.existsSync(path.join(dir, 'catalog', 'images')) ? path.join(dir, 'catalog', 'images') : fs.existsSync(path.join(dir, 'catalog')) ? path.join(dir, 'catalog') : dir;
  if (fs.existsSync(root)) walk(root);
  return out;
}

function readSnapshot(): LoadedCatalog | null {
  try {
    const file = snapshotFile();
    if (!fs.existsSync(file)) return null;
    const manifest = Manifest.parse(JSON.parse(fs.readFileSync(file, 'utf8')));
    return buildCatalog(manifest.entries, { version: manifest.version, source: 'snapshot' });
  } catch (error) {
    log().warn('catalog.snapshot_invalid', { reason: String((error as Error)?.message ?? error).slice(0, 200) });
    return null;
  }
}

async function fetchText(url: string, headers: Record<string, string> = {}, timeoutMs = 8000): Promise<{ status: number; text: string; etag?: string }> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: ctl.signal });
    return { status: res.status, text: res.status === 200 ? await res.text() : '', etag: res.headers.get('etag') ?? undefined };
  } finally {
    clearTimeout(timer);
  }
}

const baseUrl = (): string | undefined => process.env.IDEM_TEMPLATES_URL?.trim().replace(/\/+$/, '') || undefined;

function fromManifest(manifest: Manifest, source: LoadedCatalog['source']): LoadedCatalog | { error: string } {
  if (!engineSupports(manifest.engine)) return { error: `le catalogue ${manifest.version} demande le moteur ${manifest.engine} (ici ${ENGINE_VERSION})` };
  const signed = verifyManifest(manifest);
  if (!signed.ok) return { error: signed.reason ?? 'signature refusée' };
  return buildCatalog(manifest.entries, { version: manifest.version, source });
}

async function loadFromUrl(base: string): Promise<LoadedCatalog | 'unchanged' | null> {
  const dir = cacheDir();
  const cached = path.join(dir, 'manifest.json');
  try {
    const res = await fetchText(`${base}/manifest.json`, etag && current?.source === 'url' ? { 'if-none-match': etag } : {});
    if (res.status === 304) return 'unchanged';
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
    const manifest = Manifest.parse(JSON.parse(res.text));
    const loaded = fromManifest(manifest, 'url');
    if ('error' in loaded) {
      log().error('catalog.manifest_refused', { reason: loaded.error, version: manifest.version });
      return null;
    }
    etag = res.etag;
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(cached, res.text);
    } catch {
      /* cache disque facultatif */
    }
    return loaded;
  } catch (error) {
    log().warn('catalog.fetch_failed', { reason: String((error as Error)?.message ?? error).slice(0, 200) });
    // Le CDN est tombé : le dernier manifeste valide sur le disque.
    try {
      if (!current && fs.existsSync(cached)) {
        const loaded = fromManifest(Manifest.parse(JSON.parse(fs.readFileSync(cached, 'utf8'))), 'cache');
        if (!('error' in loaded)) return loaded;
      }
    } catch {
      /* cache illisible : instantané */
    }
    return null;
  }
}

async function load(): Promise<LoadedCatalog> {
  const dir = process.env.IDEM_TEMPLATES_DIR?.trim();
  if (dir) {
    try {
      return buildCatalog(readTemplatesDir(dir), { version: `dir:${new Date().toISOString().slice(0, 19)}`, source: 'dir' });
    } catch (error) {
      log().error('catalog.dir_failed', { dir, reason: String((error as Error)?.message ?? error).slice(0, 200) });
    }
  }
  const base = baseUrl();
  if (base) {
    const loaded = await loadFromUrl(base);
    if (loaded === 'unchanged' && current) return current;
    if (loaded && loaded !== 'unchanged') return loaded;
    if (current && current.source !== 'builtin' && current.source !== 'snapshot') return current;
  }
  return readSnapshot() ?? buildCatalog([], { version: 'builtin', source: 'builtin' });
}

function report(next: LoadedCatalog, previous: LoadedCatalog | null): void {
  if (previous && previous.version === next.version && previous.source === next.source) return;
  const counts = [...next.nodes.values()].reduce<Record<string, number>>((acc, n) => ((acc[n.kind] = (acc[n.kind] ?? 0) + 1), acc), {});
  log().info('catalog.loaded', { version: next.version, source: next.source, ...counts, rejected: next.rejected.length });
  for (const r of next.rejected.slice(0, 20)) log().warn('catalog.node_rejected', { id: r.id, reason: r.reason });
}

/**
 * Le catalogue courant. Le premier appel attend le chargement ; ensuite, un catalogue périmé est servi pendant que le
 * suivant se charge (jamais d'attente réseau sur le chemin d'une génération).
 */
export async function catalog(): Promise<LoadedCatalog> {
  const stale = Date.now() - loadedAt > ttlMs();
  if (current && !stale) return current;
  if (!inflight) {
    inflight = load()
      .then((next) => {
        report(next, current);
        current = next;
        loadedAt = Date.now();
        return next;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return current ?? inflight;
}

/** Relit le catalogue tout de suite (webhook de publication, panneau d'administration). */
export async function refreshCatalog(): Promise<{ version: string; source: string; nodes: number; rejected: LoadedCatalog['rejected'] }> {
  loadedAt = 0;
  etag = undefined;
  const next = await catalog();
  const fresh = inflight ? await inflight : next;
  return { version: fresh.version, source: fresh.source, nodes: fresh.nodes.size, rejected: fresh.rejected };
}

/** Pour les contrôles : oublie le catalogue chargé. */
export function resetCatalog(): void {
  current = null;
  loadedAt = 0;
  inflight = null;
  etag = undefined;
  overrides = { at: 0, value: {} };
}

/**
 * Le HTML des composants retenus : déjà là (dossier, instantané), sinon lu dans le cache disque, sinon téléchargé et
 * VÉRIFIÉ par son empreinte. Un composant dont le HTML ne vient pas est rendu `false` (le code prendra un autre composant).
 */
export async function ensureHtml(cat: LoadedCatalog, ids: string[]): Promise<Map<string, boolean>> {
  const out = new Map<string, boolean>();
  const base = baseUrl();
  await Promise.all(
    [...new Set(ids)].map(async (id) => {
      const node = cat.nodes.get(id);
      if (!node || node.kind !== 'component') return out.set(id, false);
      if (node.html) return out.set(id, true);
      const ref = cat.htmlRefs.get(id);
      if (!ref) return out.set(id, false);
      const file = path.join(cacheDir(), 'html', `${ref.sha256}.html`);
      let text: string | null = null;
      try {
        if (fs.existsSync(file)) {
          const disk = fs.readFileSync(file, 'utf8');
          if (sha256(disk) === ref.sha256) text = disk;
        }
      } catch {
        /* relu par le réseau */
      }
      if (!text && base) {
        try {
          const res = await fetchText(`${base}/${ref.file.replace(/^\/+/, '')}`);
          if (res.status === 200 && sha256(res.text) === ref.sha256) {
            text = res.text;
            try {
              fs.mkdirSync(path.dirname(file), { recursive: true });
              fs.writeFileSync(file, text);
            } catch {
              /* cache disque facultatif */
            }
          } else log().warn('catalog.html_refused', { id, reason: res.status === 200 ? 'empreinte différente' : `HTTP ${res.status}` });
        } catch (error) {
          log().warn('catalog.html_failed', { id, reason: String((error as Error)?.message ?? error).slice(0, 160) });
        }
      }
      if (!text) return out.set(id, false);
      const bad = unsafeReasons(text);
      const words = hardcodedWords(text);
      if (bad.length || words.length) {
        log().warn('catalog.html_refused', { id, reason: bad.length ? bad.join(', ') : `mots en dur : ${words.join(' ')}` });
        return out.set(id, false);
      }
      node.html = text.trim();
      return out.set(id, true);
    })
  );
  return out;
}

/** Les surcharges d'exploitation de l'hôte (nœuds retirés, poids), relues toutes les 15 s. */
export async function catalogOverrides(): Promise<CatalogOverrides> {
  const port = engineHost().catalogOverrides;
  if (!port) return {};
  if (Date.now() - overrides.at < 15_000) return overrides.value;
  try {
    overrides = { at: Date.now(), value: (await port()) ?? {} };
  } catch {
    overrides = { at: Date.now(), value: overrides.value };
  }
  return overrides.value;
}

export { sha256 };
