/**
 * LE CATALOGUE DES DIRECTIONS ARTISTIQUES — la source unique des DA d'IDEM (dépôt `idem-templates`, `catalog/directions`).
 *
 * Une DA n'est plus jamais écrite par un modèle : l'agent de la charte CHOISIT une fiche et une déclinaison par champ.
 * Tout ce qui dépendait d'une table recopiée (fiches des prompts du cœur iVision, `STYLE_DATA` du moteur, humeurs du
 * graphe, styles d'appgen) se lit ici.
 *
 * Sources, dans l'ordre (comme le catalogue de gabarits) :
 *   1. `IDEM_TEMPLATES_DIR`  le dépôt sur le disque, relu toutes les 10 s ;
 *   2. `IDEM_TEMPLATES_URL`  `directions/manifest.json` publié, relu toutes les `IDEM_TEMPLATES_TTL_S` (ETag), ou tout de
 *                            suite par `refreshDirections()` (webhook de publication) ; signature exigée si une clé est posée ;
 *   3. le cache disque       le dernier manifeste valide ;
 *   4. l'instantané embarqué `catalog/directions-snapshot.json` du paquet.
 *
 * La lecture est SYNCHRONE (`directionsSync`) : les tables qui en dépendent (jetons, prompts) sont lues au milieu d'une
 * génération. Le premier accès lit le disque ; les mises à jour arrivent en arrière-plan.
 */
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { z } from 'zod';
import { log } from '../host';
import { STYLE_DATA } from '../design-system/tokens/styles.data';

export const DIRECTIONS_ENGINE = '1.0.0';

const Txt = (max: number) => z.string().min(1).max(max);
const Bi = (max: number) => z.object({ fr: Txt(max), en: Txt(max) });
const Mood = z.enum(['sober', 'editorial', 'bold', 'warm', 'playful', 'tech', 'luxury', 'organic', 'institutional', 'vibrant']);
const Density = z.enum(['airy', 'balanced', 'dense']);
const Id = z.string().regex(/^[a-z][a-z0-9-]{1,39}$/);
const VariantId = z.string().regex(/^[a-z][a-z0-9-]{0,15}$/);
const Variants = <T extends z.ZodRawShape>(shape: T) => z.array(z.object({ id: VariantId, ...shape })).min(2).max(8);

export const DirectionNode = z.object({
  id: Id,
  version: z.number().int().min(1).default(1),
  kind: z.literal('direction'),
  medium: z.literal('direction'),
  doc: z.object({ title: Txt(80), summary: Txt(320) }),
  name: Bi(60),
  essence: Bi(240),
  fitsBrands: Bi(320),
  surface: z.enum(['light', 'dark', 'either']),
  radius: z.number().min(0).max(64),
  typeRatio: z.number().min(1.2).max(1.7),
  selectable: z.boolean(),
  tags: z.object({ mood: z.array(Mood).min(1).max(5), density: Density, energy: z.number().int().min(1).max(5), imagery: z.string().max(20).optional() }),
  neighbors: z.array(Id).min(1).max(6),
  rules: z.object({ layout: Txt(800), color: Txt(800), typography: Txt(800), devices: Txt(800), imagery: Txt(800) }),
  image: z.object({ modifier: Txt(600), negative: Txt(400) }),
  bans: z.array(Txt(200)).min(1).max(8),
  engine: z.object({
    strategies: z.array(z.string().max(30)).min(1),
    moods: z.array(z.string().max(30)).min(1),
    tensions: z.array(z.string().max(30)).min(1),
    densities: z.array(Density).min(1),
    accents: z.array(z.string().max(30)).min(1),
    pairings: z.array(Txt(80)).min(1),
  }),
  variants: z.object({
    tagline: Variants({ text: Txt(120) }),
    keywords: Variants({ items: z.array(Txt(60)).min(3).max(10) }),
    grid: Variants({ text: Txt(300), density: Density }),
    whitespace: Variants({ text: Txt(300) }),
    signatureMove: Variants({ text: Txt(300) }),
    recipes: Variants({ items: z.array(z.object({ name: Txt(60), use: Txt(40), zones: Txt(400) })).min(1).max(4) }),
    color: Variants({ distribution: Txt(40), application: Txt(300), contrast: Txt(120) }),
    typography: Variants({ scaleContrast: Txt(200), caseAndTracking: Txt(200), treatment: Txt(200) }),
    imagery: Variants({ medium: z.enum(['photography', 'illustration', 'render-3d', 'collage', 'abstract', 'mixed']), treatment: Txt(300), lighting: Txt(200), framing: Txt(200) }),
    graphicDevices: Variants({ items: z.array(Txt(120)).min(2).max(6) }),
  }),
  dos: z.array(Txt(200)).min(3).max(10),
  donts: z.array(Txt(200)).min(3).max(10),
  inspirations: z.array(z.object({ title: Txt(160), author: Txt(160), year: z.number().int().optional(), note: Txt(300), url: z.string().url().max(400).optional() })).min(5),
  authors: z.array(z.string().max(60)).max(10).optional(),
});
export type DirectionNode = z.infer<typeof DirectionNode>;
export type DirectionVariantField = keyof DirectionNode['variants'];

/** La version légère d'une DA, portée par chaque manifeste de gabarits (images, vidéos, iCode). */
export const DirectionInfo = z.object({
  id: Id,
  name: Bi(60).optional(),
  surface: z.enum(['light', 'dark', 'either']).optional(),
  selectable: z.boolean().optional(),
  radius: z.number().optional(),
  typeRatio: z.number().optional(),
  neighbors: z.array(Id).max(6).default([]),
  tags: z.object({ mood: z.array(z.string().max(24)).max(8).default([]), density: Density.optional(), energy: z.number().optional() }).partial().optional(),
});
export type DirectionInfo = z.infer<typeof DirectionInfo>;

export interface LoadedDirections {
  version: string;
  source: 'dir' | 'url' | 'cache' | 'snapshot' | 'empty';
  nodes: Map<string, DirectionNode>;
  rejected: Array<{ id: string; reason: string }>;
}

const snapshotFile = (): string => process.env.IDEM_DIRECTIONS_SNAPSHOT?.trim() || path.resolve(__dirname, '../../catalog/directions-snapshot.json');
const cacheFile = (): string => path.join(process.env.IDEM_TEMPLATES_CACHE || path.join(os.tmpdir(), 'idem-templates-cache'), 'directions-manifest.json');
const ttlMs = (): number => {
  if (process.env.IDEM_TEMPLATES_DIR) return 10_000;
  const n = Number(process.env.IDEM_TEMPLATES_TTL_S);
  return (Number.isFinite(n) && n >= 5 ? n : 300) * 1000;
};

let current: LoadedDirections | null = null;
let loadedAt = 0;
let inflight: Promise<LoadedDirections> | null = null;
let etag: string | undefined;

function build(raw: unknown[], meta: { version: string; source: LoadedDirections['source'] }): LoadedDirections {
  const nodes = new Map<string, DirectionNode>();
  const rejected: LoadedDirections['rejected'] = [];
  for (const r of raw) {
    const parsed = DirectionNode.safeParse(r);
    const id = String((r as { id?: unknown })?.id ?? '?');
    if (!parsed.success) rejected.push({ id, reason: parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join(' ; ').slice(0, 300) });
    else if (nodes.has(id)) rejected.push({ id, reason: 'identifiant en double' });
    else nodes.set(id, parsed.data);
  }
  // Une voisine inconnue est retirée (la fiche reste servie).
  for (const n of nodes.values()) n.neighbors = n.neighbors.filter((x) => nodes.has(x));
  return { version: meta.version, source: meta.source, nodes, rejected };
}

/** Les fiches du dépôt sur le disque (`catalog/directions/<id>/node.json`). */
export function readDirectionsDir(dir: string): unknown[] {
  const root = fs.existsSync(path.join(dir, 'catalog', 'directions')) ? path.join(dir, 'catalog', 'directions') : dir;
  if (!fs.existsSync(root)) return [];
  const out: unknown[] = [];
  for (const name of fs.readdirSync(root).sort()) {
    const file = path.join(root, name, 'node.json');
    if (!fs.existsSync(file)) continue;
    try {
      out.push(JSON.parse(fs.readFileSync(file, 'utf8')));
    } catch (error) {
      out.push({ id: name, invalid: String((error as Error)?.message ?? error).slice(0, 120) });
    }
  }
  return out;
}

interface DirectionsManifest {
  schema?: number;
  version?: string;
  engine?: string;
  entries?: Array<{ node: unknown }>;
  signature?: string;
}

const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.keys(value as Record<string, unknown>)
      .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  return JSON.stringify(value);
};

function signedOk(manifest: DirectionsManifest): boolean {
  const raw = process.env.IDEM_TEMPLATES_PUBKEY?.trim();
  if (!raw) return true;
  if (!manifest.signature) return false;
  try {
    const key = raw.includes('BEGIN') ? crypto.createPublicKey(raw) : crypto.createPublicKey({ key: Buffer.from(raw, 'base64'), format: 'der', type: 'spki' });
    const { signature, ...unsigned } = manifest;
    return crypto.verify(null, Buffer.from(canonical(unsigned)), key, Buffer.from(signature, 'base64'));
  } catch {
    return false;
  }
}

function fromManifest(manifest: DirectionsManifest, source: LoadedDirections['source']): LoadedDirections | null {
  const major = (v?: string) => Number(String(v ?? '1').split('.')[0]) || 0;
  if (major(manifest.engine) !== major(DIRECTIONS_ENGINE)) {
    log().warn('directions.engine_mismatch', { engine: manifest.engine, here: DIRECTIONS_ENGINE });
    return null;
  }
  if (!signedOk(manifest)) {
    log().error('directions.signature_refused', { version: manifest.version });
    return null;
  }
  return build((manifest.entries ?? []).map((e) => e.node), { version: String(manifest.version ?? '?'), source });
}

function readFileManifest(file: string, source: LoadedDirections['source']): LoadedDirections | null {
  try {
    if (!fs.existsSync(file)) return null;
    return fromManifest(JSON.parse(fs.readFileSync(file, 'utf8')) as DirectionsManifest, source);
  } catch (error) {
    log().warn('directions.file_invalid', { file: path.basename(file), reason: String((error as Error)?.message ?? error).slice(0, 160) });
    return null;
  }
}

/** Ce qui se lit sans réseau : dépôt, cache, instantané. */
function loadLocal(): LoadedDirections {
  const dir = process.env.IDEM_TEMPLATES_DIR?.trim();
  if (dir) {
    const fromDir = build(readDirectionsDir(dir), { version: `dir:${new Date().toISOString().slice(0, 19)}`, source: 'dir' });
    if (fromDir.nodes.size) return fromDir;
  }
  return readFileManifest(cacheFile(), 'cache') ?? readFileManifest(snapshotFile(), 'snapshot') ?? { version: 'empty', source: 'empty', nodes: new Map(), rejected: [] };
}

async function loadFromUrl(base: string): Promise<LoadedDirections | 'unchanged' | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch(`${base}/directions/manifest.json`, { headers: etag && current?.source === 'url' ? { 'if-none-match': etag } : {}, signal: ctl.signal });
    if (res.status === 304) return 'unchanged';
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const loaded = fromManifest(JSON.parse(text) as DirectionsManifest, 'url');
    if (!loaded) return null;
    etag = res.headers.get('etag') ?? undefined;
    try {
      fs.mkdirSync(path.dirname(cacheFile()), { recursive: true });
      fs.writeFileSync(cacheFile(), text);
    } catch {
      /* le cache est un confort */
    }
    return loaded;
  } catch (error) {
    log().warn('directions.url_failed', { reason: String((error as Error)?.message ?? error).slice(0, 160) });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function load(): Promise<LoadedDirections> {
  const dir = process.env.IDEM_TEMPLATES_DIR?.trim();
  const base = process.env.IDEM_TEMPLATES_URL?.trim().replace(/\/+$/, '');
  if (!dir && base) {
    const loaded = await loadFromUrl(base);
    if (loaded === 'unchanged' && current) return current;
    if (loaded && loaded !== 'unchanged') return loaded;
    if (current && current.source === 'url') return current;
  }
  return loadLocal();
}

function install(next: LoadedDirections): void {
  const changed = !current || current.version !== next.version || current.source !== next.source;
  current = next;
  loadedAt = Date.now();
  applyToStyleData(next);
  if (changed) {
    log().info('directions.loaded', { version: next.version, source: next.source, directions: next.nodes.size, rejected: next.rejected.length });
    for (const r of next.rejected.slice(0, 10)) log().warn('directions.rejected', r);
  }
}

/** Les données du moteur (`STYLE_DATA`) tirées des fiches : plus de table recopiée à tenir en accord. */
function applyToStyleData(loaded: LoadedDirections): void {
  for (const d of loaded.nodes.values()) {
    STYLE_DATA[d.id] = {
      id: d.id,
      name: d.name.en,
      surface: d.surface,
      radius: d.radius,
      typeRatio: d.typeRatio,
      selectable: d.selectable,
      strategies: d.engine.strategies as never,
      moods: d.engine.moods as never,
      tensions: d.engine.tensions as never,
      densities: d.engine.densities,
      accents: d.engine.accents as never,
      pairings: d.engine.pairings,
    };
  }
}

/** Les fiches, tout de suite (lecture disque au premier appel) ; une mise à jour part en arrière-plan si elles ont vieilli. */
export function directionsSync(): Map<string, DirectionNode> {
  if (!current) install(loadLocal());
  if (Date.now() - loadedAt > ttlMs() && !inflight) void directionCatalog();
  return current!.nodes;
}

/** Le catalogue des DA à jour (attend le chargement en cours). */
export async function directionCatalog(): Promise<LoadedDirections> {
  if (current && Date.now() - loadedAt <= ttlMs()) return current;
  if (!inflight) {
    inflight = load()
      .then((next) => {
        install(next);
        return next;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return current ?? inflight;
}

/** Relecture immédiate (webhook de publication du dépôt). */
export async function refreshDirections(): Promise<{ version: string; source: string; directions: number; rejected: number }> {
  loadedAt = 0;
  etag = undefined;
  const next = await directionCatalog();
  const done = inflight ? await inflight : next;
  return { version: done.version, source: done.source, directions: done.nodes.size, rejected: done.rejected.length };
}

export function resetDirections(): void {
  current = null;
  loadedAt = 0;
  etag = undefined;
}

export function getDirection(id?: string | null): DirectionNode | undefined {
  return id ? directionsSync().get(String(id).trim()) : undefined;
}

/** Les DA que l'agent de la charte peut proposer (les fonds sombres obligatoires restent hors choix : surface claire). */
export function selectableDirections(): DirectionNode[] {
  return [...directionsSync().values()].filter((d) => d.selectable);
}

/** La déclinaison choisie d'un champ, ou la première (un identifiant inconnu ne casse jamais une charte). */
export function pickVariant<F extends DirectionVariantField>(d: DirectionNode, field: F, id?: string | null): DirectionNode['variants'][F][number] {
  const list = d.variants[field] as Array<{ id: string }>;
  return (list.find((v) => v.id === id) ?? list[0]) as DirectionNode['variants'][F][number];
}
