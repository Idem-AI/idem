/**
 * LE PARCOURS DU GRAPHE — ce que le CODE fait seul, sans un jeton :
 *
 *   1. filtre dur      élément, toile, rôle de la page, et CAPACITÉ (la répartition réelle des unités dans les zones
 *                      doit réussir : aucune zone obligatoire vide, chaque média à sa place) ;
 *   2. score           accord avec la direction artistique (humeurs, densité, rapport à l'image), enchaînement avec
 *                      la page voisine (arêtes `follows` / `contrasts` / `avoidAfter`), usure dans le document, mémoire
 *                      des combinaisons déjà livrées (marque, compte, tous les clients), poids d'exploitation, et une
 *                      part de hasard fixée par la graine ;
 *   3. liste courte    les meilleurs candidats, tous différents, montrés au modèle (ou retenus par le code au cran Low).
 *
 * L'HABILLAGE est choisi une fois par document (cohérence d'un même livrable) ; la variété d'une page à l'autre vient
 * du squelette, des composants, des réglages et du miroir.
 */
import type { CreativityLevel } from '../contracts/common';
import type { SectionRole } from '../contracts/content-model';
import type { FormatDef } from '../design-system/formats';
import type { DirectionInput } from '../design-system/tokens';
import { stableHash } from '../foundation/hash';
import { catalogEffortFor } from '../foundation/effort';
import { assignUnits, PageUnit, placedZones } from './assemble';
import { BUILTIN_LAYOUT, BUILTIN_SKIN } from './builtin';
import { getDirection } from '../directions';
import { ALL_ELEMENTS, type CatalogElement, type CatalogNode, type CatalogOverrides, type ComponentNode, type GabaritNode, type LayoutNode, type LoadedCatalog, type PageConfig, type SkinNode, type ZoneAccept } from './types';

// ── Les traits de la marque ──────────────────────────────────────────────────────────────────

export interface BrandTraits {
  /** La DA de la marque (catalogue `directions`) : le graphe ne sert que ses nœuds, ou ceux de ses voisines. */
  styleId?: string;
  moods: string[];
  density?: 'airy' | 'balanced' | 'dense';
  imagery: 'photo' | 'illustration' | 'none' | 'any';
  allowDark: boolean;
}

/** Des mots de la direction (mots-clés, grammaire) qui disent une humeur : un indice, pas une règle. */
const WORD_MOODS: Array<[RegExp, string]> = [
  [/\b(sobre|sober|minimal|épur|clean|calm|calme)/i, 'sober'],
  [/\b(éditorial|editorial|magazine|serif|classique)/i, 'editorial'],
  [/\b(audac|bold|fort|punch|impact|contrast)/i, 'bold'],
  [/\b(chaleur|warm|chaud|terre|earth|artisan)/i, 'warm'],
  [/\b(ludique|playful|fun|joyeu|enfant|kids)/i, 'playful'],
  [/\b(tech|digital|numérique|data|futur|innov)/i, 'tech'],
  [/\b(luxe|luxury|premium|élégan|elegan|raffin)/i, 'luxury'],
  [/\b(naturel|organic|bio|végétal|nature|agri)/i, 'organic'],
  [/\b(institution|corporate|banque|bank|confiance|trust|financ)/i, 'institutional'],
  [/\b(vibrant|coloré|colorful|énergi|energ|festi)/i, 'vibrant'],
];

export function brandTraits(direction: DirectionInput | undefined, allowDark: boolean): BrandTraits {
  // Les humeurs de la DA, lues dans sa fiche du catalogue (plus de table recopiée).
  const moods = new Set<string>(getDirection(direction?.styleId)?.tags.mood ?? []);
  const words = [...(direction?.keywords ?? []), direction?.grammar ?? ''].join(' ').slice(0, 2000);
  for (const [re, mood] of WORD_MOODS) if (re.test(words)) moods.add(mood);
  const medium = direction?.imageryMedium ?? '';
  const imagery = medium === 'photography' ? 'photo' : medium === 'illustration' || medium === 'render-3d' || medium === 'collage' ? 'illustration' : medium === 'abstract' ? 'none' : 'any';
  return { ...(direction?.styleId ? { styleId: direction.styleId } : {}), moods: [...moods], density: direction?.density, imagery, allowDark };
}

/**
 * Les nœuds de la DA de la marque. Aucun pour cette liste : ceux de ses DA voisines (déclarées dans sa fiche). Aucun
 * non plus : la liste entière — une génération ne s'arrête jamais faute de couverture (le dépôt la contrôle à la
 * construction). Sans DA connue (marque sans direction, catalogue sans DA), aucun filtre.
 */
export function inDirection<T extends { directions?: string[] }>(cat: LoadedCatalog, list: T[], styleId?: string): T[] {
  if (!styleId || !cat.directions?.size || !cat.directions.has(styleId)) return list;
  const own = list.filter((n) => n.directions?.includes(styleId));
  if (own.length) return own;
  const neighbors = cat.directions.get(styleId)?.neighbors ?? [];
  const near = list.filter((n) => n.directions?.some((d) => neighbors.includes(d)));
  return near.length ? near : list;
}

// ── L'INDEX DU CATALOGUE ─────────────────────────────────────────────────────────────────────

/**
 * Le catalogue rangé une fois par version, pour que le parcours d'une page ne relise jamais tout.
 *
 * Sans index, chaque page relit les N nœuds et appelle `assignUnits` (le placement réel des unités, la partie
 * chère) sur CHAQUE squelette. À 300 nœuds c'est gratuit ; à 10 000, une page de business plan paierait
 * 10 000 placements. L'index range par élément et par type de bloc : une page ne voit plus que ce qui la concerne.
 *
 * L'index vit dans une `WeakMap` sur l'objet catalogue : une nouvelle version du dépôt est un nouvel objet, donc
 * un nouvel index — rien à invalider, rien à vider.
 */
export interface CatalogIndex {
  layoutsByElement: Map<CatalogElement, LayoutNode[]>;
  gabaritsByElement: Map<CatalogElement, GabaritNode[]>;
  skinsByElement: Map<CatalogElement, SkinNode[]>;
  /** Les composants par type de bloc accepté (`metrics`, `chart`…). */
  componentsByKind: Map<string, ComponentNode[]>;
  nodes: number;
}

const INDEXES = new WeakMap<LoadedCatalog, CatalogIndex>();

/** Au-delà de ce nombre de squelettes compatibles, on ne mesure le placement que des mieux classés. */
export const PLACEMENT_BUDGET = 60;

export function catalogIndex(cat: LoadedCatalog): CatalogIndex {
  const found = INDEXES.get(cat);
  if (found) return found;
  const index: CatalogIndex = { layoutsByElement: new Map(), gabaritsByElement: new Map(), skinsByElement: new Map(), componentsByKind: new Map(), nodes: cat.nodes.size };
  const push = <T>(map: Map<string, T[]>, key: string, value: T): void => {
    const list = map.get(key);
    if (list) list.push(value);
    else map.set(key, [value]);
  };
  // Un nœud sans `elements` sert TOUS les éléments : il entre dans chaque panier (le filtre dur le disait déjà).
  const elementsOf = (n: { elements?: CatalogElement[] }): CatalogElement[] => (n.elements?.length ? n.elements : (ALL_ELEMENTS as CatalogElement[]));
  for (const n of cat.nodes.values()) {
    if (n.id.startsWith('builtin.')) continue;
    if (n.kind === 'layout') for (const e of elementsOf(n)) push(index.layoutsByElement as Map<string, LayoutNode[]>, e, n);
    else if (n.kind === 'gabarit') for (const e of elementsOf(n)) push(index.gabaritsByElement as Map<string, GabaritNode[]>, e, n);
    else if (n.kind === 'skin') for (const e of elementsOf(n)) push(index.skinsByElement as Map<string, SkinNode[]>, e, n);
    else if (n.kind === 'component') for (const k of n.accepts) push(index.componentsByKind, k, n);
  }
  INDEXES.set(cat, index);
  return index;
}

// ── Le filtre dur ────────────────────────────────────────────────────────────────────────────

export interface PageFacts {
  element: CatalogElement;
  format: FormatDef;
  role?: SectionRole;
  units: PageUnit[];
  index: number;
  total: number;
}

function fitsShape(node: { shape: LayoutNode['shape'] }, format: FormatDef): boolean {
  const s = node.shape;
  if (s.kind && s.kind !== format.kind) return false;
  if (s.formats?.length && !s.formats.includes(format.id)) return false;
  if (s.orientations?.length && !s.orientations.includes(format.orientation)) return false;
  const aspect = format.width / Math.max(1, format.height);
  if (s.minAspect && aspect < s.minAspect) return false;
  if (s.maxAspect && aspect > s.maxAspect) return false;
  return true;
}

/** Le rôle de la page convient-il ? Une couverture ne prend qu'un nœud fait pour elle ; un nœud de couverture ne sert qu'elle. */
function fitsRole(roles: string[], role: SectionRole | undefined): boolean {
  const coverOnly = roles.length === 1 && roles[0] === 'cover';
  if (role === 'cover') return roles.includes('cover');
  if (coverOnly) return false;
  return roles.includes('*') || !role || roles.includes(role);
}

const forElement = (n: { elements?: CatalogElement[] }, e: CatalogElement) => !n.elements?.length || n.elements.includes(e);

/**
 * Les squelettes qui savent tenir CETTE page. Deux étages, dans cet ordre de coût :
 *   1. les tests qui ne coûtent rien (élément — lu dans l'index —, toile, rôle, fond sombre) ;
 *   2. le placement réel des unités (`assignUnits`), seul test cher, fait en dernier.
 *
 * `rank` trie les survivants du premier étage quand ils sont trop nombreux : on ne mesure alors le placement
 * que des `PLACEMENT_BUDGET` mieux classés. En deçà du budget (le cas d'aujourd'hui), rien ne change.
 */
export function compatibleLayouts(cat: LoadedCatalog, facts: PageFacts, disabled: Set<string>, allowDark = false, rank?: (n: LayoutNode) => number): LayoutNode[] {
  const pool = catalogIndex(cat).layoutsByElement.get(facts.element) ?? [];
  let eligible = pool.filter((n) => !disabled.has(n.id) && (!n.darkGround || allowDark) && fitsShape(n, facts.format) && fitsRole(n.roles, facts.role));
  if (rank && eligible.length > PLACEMENT_BUDGET) {
    eligible = eligible
      .map((n) => ({ n, v: rank(n) }))
      .sort((a, b) => b.v - a.v)
      .slice(0, PLACEMENT_BUDGET)
      .map((x) => x.n);
  }
  return eligible.filter((n) => !assignUnits(n, facts.units).error);
}

export function compatibleSkins(cat: LoadedCatalog, element: CatalogElement, traits: BrandTraits, disabled: Set<string>): SkinNode[] {
  const pool = catalogIndex(cat).skinsByElement.get(element) ?? [];
  return inDirection(cat, pool.filter((n) => !disabled.has(n.id) && (!n.dark || traits.allowDark)), traits.styleId);
}

/** Les composants qui savent rendre cette unité dans cette zone. */
export function compatibleComponents(cat: LoadedCatalog, unit: PageUnit, zone: ZoneAccept[], disabled: Set<string>, width = 1): ComponentNode[] {
  const pool = catalogIndex(cat).componentsByKind.get(unit.kind) ?? [];
  return pool.filter(
    (n) =>
      !disabled.has(n.id) &&
      (!n.minWidth || width + 1e-6 >= n.minWidth) &&
      (!n.items || (unit.items >= n.items.min && unit.items <= n.items.max)) &&
      (!n.zones?.length || n.zones.some((z) => zone.includes(z) || z === 'any'))
  );
}

// ── Le score ─────────────────────────────────────────────────────────────────────────────────

/** Une part de hasard fixée par la graine (0…1) : deux documents ne tirent pas les mêmes candidats, un rejeu si. */
export function jitter(seed: string, id: string): number {
  return parseInt(stableHash([seed, id], 8), 16) / 0xffffffff;
}

/**
 * LE PROFIL DU CONTENU — ce que la page a RÉELLEMENT à montrer, mesuré par le code (0 jeton).
 *
 * Le filtre dur dit déjà si une composition PEUT tenir le contenu (`assignUnits` : nombre de blocs, types, éléments).
 * Le profil, lui, sert le CLASSEMENT : une grille serrée pour deux blocs légers reste vide, un squelette aéré pour
 * huit blocs chargés étouffe. Les deux passent le filtre dur ; ils ne se valent pas.
 */
export interface ContentProfile {
  blocks: number;
  items: number;
  /** Signes de texte des blocs (titres, libellés, corps). */
  chars: number;
  hasMedia: boolean;
  /** La charge rapportée à la surface de la toile : < 0,55 aérée, > 1,35 dense. */
  load: number;
  density: 'airy' | 'balanced' | 'dense';
}

/** Les signes portés par un bloc : ce que le lecteur aura sous les yeux, pas la structure. */
function charsOf(u: PageUnit): number {
  const b = u.block as Record<string, unknown> | undefined;
  if (!b) return 0;
  let n = 0;
  const walk = (v: unknown, depth: number): void => {
    if (depth > 3) return;
    if (typeof v === 'string') n += v.length;
    else if (Array.isArray(v)) for (const x of v.slice(0, 24)) walk(x, depth + 1);
    else if (v && typeof v === 'object') for (const x of Object.values(v as Record<string, unknown>).slice(0, 24)) walk(x, depth + 1);
  };
  walk(b, 0);
  return n;
}

export function contentProfile(units: PageUnit[], format: FormatDef): ContentProfile {
  const blocks = units.filter((u) => u.category !== 'header');
  const items = blocks.reduce((n, u) => n + u.items, 0);
  const chars = units.reduce((n, u) => n + charsOf(u), 0);
  const hasMedia = units.some((u) => u.category === 'media');
  // Une page A4 (≈ 744 × 1052) tient confortablement ~1 800 signes et ~6 blocs : la référence de la charge.
  const area = (format.width * format.height) / (744 * 1052);
  const load = (chars / 1800 + blocks.length / 6 + items / 14) / 3 / Math.max(0.35, area);
  return { blocks: blocks.length, items, chars, hasMedia, load, density: load < 0.55 ? 'airy' : load > 1.35 ? 'dense' : 'balanced' };
}

/**
 * L'accord entre une composition et le contenu réel : sa densité annoncée, et le remplissage qu'elle vise.
 * Volontairement plus faible que l'accord artistique — le contenu départage, il ne commande pas.
 */
function contentFit(node: CatalogNode, profile: ContentProfile): number {
  let s = 0;
  const d = node.tags?.density;
  if (d) s += d === profile.density ? 0.2 : d === 'balanced' || profile.density === 'balanced' ? 0 : -0.25;
  if (node.kind === 'layout') {
    const cap = (node as LayoutNode).capacity;
    // Le milieu de ce que le squelette sait tenir : trop loin, la page sonne vide ou se bouscule.
    const mid = (Math.max(1, cap.minBlocks) + Math.min(12, cap.maxBlocks)) / 2;
    s -= Math.min(0.3, Math.abs(profile.blocks - mid) * 0.06);
    if (cap.maxItems && profile.items > cap.maxItems * 0.9) s -= 0.1;
  }
  return s;
}

function tagFit(node: CatalogNode, traits: BrandTraits, hasMedia: boolean): number {
  const t = node.tags;
  if (!t) return 0;
  let s = 0;
  if (t.mood?.length && traits.moods.length) s += (0.45 * t.mood.filter((m) => traits.moods.includes(m)).length) / Math.min(t.mood.length, traits.moods.length);
  if (t.density && traits.density) s += t.density === traits.density ? 0.15 : t.density === 'balanced' || traits.density === 'balanced' ? 0 : -0.15;
  if (t.imagery === 'photo') s += hasMedia ? 0.1 : -0.4;
  if (t.imagery === 'none' && hasMedia) s -= 0.1;
  if (t.imagery && traits.imagery !== 'any' && t.imagery === traits.imagery) s += 0.1;
  return s;
}

/** L'état d'un document : ce que ses pages ont déjà pris, et la mémoire des combinaisons déjà livrées. */
export interface CatalogState {
  skin?: string;
  /** Le squelette (et le gabarit) de chaque page déjà composée, par rang. */
  byIndex: Map<number, { layout: string; gabarit?: string }>;
  /** Combien de fois chaque nœud a servi dans ce document. */
  use: Map<string, number>;
  /** Les empreintes de combinaisons déjà livrées (mémoire de la portée exigée par le cran). */
  seen: Set<string>;
  /** Les habillages déjà donnés à cette marque (cohérence entre ses livrables). */
  brandSkins: string[];
}

export const newCatalogState = (seen: string[] = [], brandSkins: string[] = []): CatalogState => ({ byIndex: new Map(), use: new Map(), seen: new Set(seen), brandSkins });

/** L'empreinte d'une combinaison (squelette, habillage, composants, réglages, miroir). */
export function comboFingerprint(c: Pick<PageConfig, 'layout' | 'skin' | 'components' | 'vars' | 'mirror'>): string {
  const comps = Object.entries(c.components ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const vars = Object.entries(c.vars ?? {}).sort(([a], [b]) => a.localeCompare(b));
  return stableHash([c.layout, c.skin, comps, vars, c.mirror ? 1 : 0], 12);
}

function sequenceScore(ids: string[], node: CatalogNode, facts: PageFacts, state: CatalogState): number {
  const prev = state.byIndex.get(facts.index - 1);
  const next = state.byIndex.get(facts.index + 1);
  let s = 0;
  const e = node.edges ?? {};
  for (const n of [prev, next]) {
    if (!n) continue;
    if (ids.includes(n.layout)) s -= 0.7;
    if (n.gabarit && ids.includes(n.gabarit)) s -= 0.4;
    if (e.avoidAfter?.includes(n.layout) || (n.gabarit && e.avoidAfter?.includes(n.gabarit))) s -= 0.5;
  }
  if (prev && (e.follows?.includes(prev.layout) || (prev.gabarit && e.follows?.includes(prev.gabarit)))) s += 0.2;
  if (prev && (e.contrasts?.includes(prev.layout) || (prev.gabarit && e.contrasts?.includes(prev.gabarit)))) s += 0.12;
  for (const id of ids) s -= 0.18 * (state.use.get(id) ?? 0);
  return s;
}

// ── La liste courte ──────────────────────────────────────────────────────────────────────────

export interface Candidate {
  /** Lettre montrée au modèle. */
  ref: string;
  gabarit?: GabaritNode;
  layout: LayoutNode;
  config: PageConfig;
  score: number;
  fingerprint: string;
}

const weightOf = (o: CatalogOverrides, id: string) => Math.min(3, Math.max(0, o.weights?.[id] ?? 1));

/**
 * L'HABILLAGE du document, choisi par le code : l'accord avec la direction artistique, la cohérence avec les livrables
 * déjà faits pour la marque (bonus), la part de hasard de la graine. Rend les meilleurs, le premier en tête.
 */
export function rankSkins(cat: LoadedCatalog, element: CatalogElement, traits: BrandTraits, state: CatalogState, seed: string, overrides: CatalogOverrides): SkinNode[] {
  const disabled = new Set(overrides.disabled ?? []);
  const skins = compatibleSkins(cat, element, traits, disabled);
  if (!skins.length) return [cat.nodes.get(BUILTIN_SKIN) as SkinNode];
  return skins
    .map((s) => ({ s, v: (1 + tagFit(s, traits, true) + (state.brandSkins.includes(s.id) ? 0.35 : 0) + 0.3 * jitter(seed, s.id)) * weightOf(overrides, s.id) }))
    .sort((a, b) => b.v - a.v)
    .map((x) => x.s);
}

/** Le meilleur composant de chaque unité, pour un squelette (le gabarit propose, le graphe complète). */
export function pickComponents(cat: LoadedCatalog, layout: LayoutNode, facts: PageFacts, prefer: Record<string, string>, seed: string, overrides: CatalogOverrides, traits: BrandTraits, rank = 0): Record<string, string> {
  const disabled = new Set(overrides.disabled ?? []);
  const assigned = assignUnits(layout, facts.units).zones;
  const zoneOf = new Map<string, { accepts: ZoneAccept[]; width: number }>();
  for (const z of layout.zones) for (const u of assigned.get(z.id) ?? []) zoneOf.set(u.id, { accepts: z.accepts, width: z.span / layout.grid.columns });
  const out: Record<string, string> = {};
  for (const u of facts.units) {
    const at = zoneOf.get(u.id) ?? { accepts: ['any'] as ZoneAccept[], width: 1 };
    const comps = inDirection(cat, compatibleComponents(cat, u, at.accepts, disabled, at.width), traits.styleId);
    if (!comps.length) continue;
    const ranked = comps
      .map((c) => ({ c, v: ((prefer[u.kind] === c.id ? 1.5 : 0) + tagFit(c, traits, facts.units.some((x) => x.category === 'media')) + 0.35 * jitter(`${seed}|${u.id}|${rank}`, c.id)) * weightOf(overrides, c.id) }))
      .sort((a, b) => b.v - a.v);
    out[u.id] = ranked[Math.min(rank, ranked.length - 1)].c.id;
  }
  return out;
}

/** Les réglages discrets tirés par le code (cran Low) : une option par réglage, par la graine. */
export function drawVars(nodes: Array<{ vars?: Array<{ name: string; options: Array<{ id: string }> }> } | undefined>, seed: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const n of nodes) for (const v of n?.vars ?? []) out[v.name] = v.options[Math.floor(jitter(seed, v.name) * v.options.length) % v.options.length].id;
  return out;
}

/**
 * LA LISTE COURTE d'une page : les candidats classés, chacun avec sa configuration complète (prête à rendre si
 * personne ne la modifie). Jamais vide : le squelette intégré ferme la marche.
 */
export function shortlist(cat: LoadedCatalog, facts: PageFacts, o: { level: CreativityLevel; skin: string; traits: BrandTraits; state: CatalogState; seed: string; overrides: CatalogOverrides; exclude?: string[] }): Candidate[] {
  const effort = catalogEffortFor(o.level);
  const disabled = new Set(o.overrides.disabled ?? []);
  // Le pré-classement qui borne le travail : il ne coûte que des comparaisons de traits, jamais un placement.
  const preRank = (n: LayoutNode): number => tagFit(n, o.traits, facts.units.some((u) => u.category === 'media')) + contentFit(n, contentProfile(facts.units, facts.format)) - 0.18 * (o.state.use.get(n.id) ?? 0);
  const layouts = inDirection(cat, compatibleLayouts(cat, facts, disabled, o.traits.allowDark, preRank), o.traits.styleId);
  const layoutIds = new Set(layouts.map((l) => l.id));
  const hasMedia = facts.units.some((u) => u.category === 'media');
  const profile = contentProfile(facts.units, facts.format);
  const seed = `${o.seed}|${facts.index}`;
  const skin = cat.nodes.get(o.skin) as SkinNode | undefined;
  // Les gabarits de la DA de la marque (ou de ses voisines).
  const gabarits = inDirection(
    cat,
    (catalogIndex(cat).gabaritsByElement.get(facts.element) ?? []).filter((n) => !disabled.has(n.id) && fitsRole(n.roles, facts.role) && layoutIds.has(n.config.layout)),
    o.traits.styleId
  );
  const raw: Array<Omit<Candidate, 'ref'>> = [];
  const push = (layout: LayoutNode, gabarit: GabaritNode | undefined, rank: number) => {
    const prefer = gabarit?.config.components ?? {};
    const components = pickComponents(cat, layout, facts, prefer, seed, o.overrides, o.traits, effort.assembly === 'gabarit' ? 0 : rank);
    const compNodes = Object.values(components).map((id) => cat.nodes.get(id) as ComponentNode);
    const vars = { ...drawVars([skin, ...compNodes], `${seed}|${layout.id}|${rank}`), ...(gabarit?.config.vars ?? {}) };
    const mirror = layout.mirrorable ? (gabarit?.config.mirror ?? false) !== jitter(seed, `mirror|${layout.id}|${rank}`) > 0.5 : false;
    const params = effort.assembly === 'mixed' ? Object.fromEntries((layout.params ?? []).map((p) => [p.name, p.min + (p.max - p.min) * jitter(seed, `${p.name}|${layout.id}|${rank}`)])) : {};
    const config: PageConfig = { ...(gabarit ? { gabarit: gabarit.id } : {}), layout: layout.id, skin: o.skin, components, vars, params, mirror };
    const fingerprint = comboFingerprint(config);
    const ids = [layout.id, ...(gabarit ? [gabarit.id] : [])];
    const fit = tagFit(layout, o.traits, hasMedia) + (gabarit ? tagFit(gabarit, o.traits, hasMedia) : 0);
    const content = contentFit(layout, profile) + (gabarit ? contentFit(gabarit, profile) : 0);
    let score = 1 + fit + content + sequenceScore(ids, gabarit ?? layout, facts, o.state) + 0.3 * jitter(seed, `${ids.join('|')}|${rank}`);
    if (o.state.seen.has(fingerprint)) score -= 0.6;
    if (o.exclude?.includes(fingerprint) || o.exclude?.includes(layout.id)) score -= 2;
    score *= weightOf(o.overrides, layout.id) * (gabarit ? weightOf(o.overrides, gabarit.id) : 1);
    raw.push({ gabarit, layout, config, score, fingerprint });
  };
  // Low et Medium partent des gabarits documentés ; High et Ultra assemblent aussi depuis les squelettes seuls.
  for (const g of gabarits) push(cat.nodes.get(g.config.layout) as LayoutNode, g, 0);
  if (effort.assembly === 'zones' || effort.assembly === 'mixed' || !gabarits.length) {
    for (const l of layouts) {
      if (effort.assembly !== 'mixed' && gabarits.length && !gabarits.some((g) => g.config.layout === l.id)) continue;
      for (let rank = 1; rank <= (effort.assembly === 'mixed' ? 2 : 1); rank++) push(l, undefined, rank);
    }
  }
  // Une combinaison n'apparaît qu'une fois ; puis le classement.
  const unique = new Map<string, Omit<Candidate, 'ref'>>();
  for (const c of raw.sort((a, b) => b.score - a.score)) if (!unique.has(c.fingerprint)) unique.set(c.fingerprint, c);
  // Deux pages voisines n'ont jamais le même squelette (quand le graphe offre autre chose).
  const near = [o.state.byIndex.get(facts.index - 1)?.layout, o.state.byIndex.get(facts.index + 1)?.layout].filter(Boolean);
  let ranked = [...unique.values()];
  if (near.length && ranked.some((c) => !near.includes(c.layout.id))) ranked = ranked.filter((c) => !near.includes(c.layout.id));
  let list = ranked.slice(0, Math.max(1, effort.shortlist));
  if (!list.length) {
    const builtin = cat.nodes.get(BUILTIN_LAYOUT[facts.format.kind]) as LayoutNode;
    const config: PageConfig = { layout: builtin.id, skin: o.skin, components: pickComponents(cat, builtin, facts, {}, seed, o.overrides, o.traits), vars: {}, params: {}, mirror: false };
    list = [{ layout: builtin, config, score: 0, fingerprint: comboFingerprint(config) }];
  }
  return list.map((c, i) => ({ ...c, ref: String.fromCharCode(65 + i) }));
}

/** Les zones placées d'un candidat (miroir et réglages compris), pour l'assemblage. */
export const candidateZones = (c: Candidate) => placedZones(c.layout, c.config);
