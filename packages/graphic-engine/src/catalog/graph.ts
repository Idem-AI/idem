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
import type { CatalogElement, CatalogNode, CatalogOverrides, ComponentNode, GabaritNode, LayoutNode, LoadedCatalog, PageConfig, SkinNode, ZoneAccept } from './types';

// ── Les traits de la marque ──────────────────────────────────────────────────────────────────

export interface BrandTraits {
  moods: string[];
  density?: 'airy' | 'balanced' | 'dense';
  imagery: 'photo' | 'illustration' | 'none' | 'any';
  allowDark: boolean;
}

/** Les humeurs du catalogue que suggère chaque style de la direction artistique. */
const STYLE_MOODS: Record<string, string[]> = {
  minimalism: ['sober', 'airy'],
  maximalism: ['bold', 'vibrant'],
  futuristic: ['tech', 'bold'],
  'vector-art': ['playful', 'vibrant'],
  'collage-art': ['editorial', 'bold'],
  retro: ['warm', 'playful'],
  cyberpunk: ['tech', 'bold'],
  'pop-art': ['bold', 'playful', 'vibrant'],
  glassmorphism: ['tech', 'sober'],
  clay: ['playful', 'warm'],
  'pixel-art': ['playful', 'tech'],
  editorial: ['editorial', 'sober'],
  y2k: ['playful', 'vibrant'],
  swiss: ['sober', 'institutional'],
  surreal: ['editorial', 'luxury'],
  bohemian: ['warm', 'organic'],
  victorian: ['luxury', 'editorial'],
  graffiti: ['bold', 'vibrant'],
  aurora: ['tech', 'luxury'],
  handwritten: ['warm', 'organic', 'playful'],
};

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
  const moods = new Set<string>(STYLE_MOODS[direction?.styleId ?? ''] ?? []);
  const words = [...(direction?.keywords ?? []), direction?.grammar ?? ''].join(' ').slice(0, 2000);
  for (const [re, mood] of WORD_MOODS) if (re.test(words)) moods.add(mood);
  const medium = direction?.imageryMedium ?? '';
  const imagery = medium === 'photography' ? 'photo' : medium === 'illustration' || medium === 'render-3d' || medium === 'collage' ? 'illustration' : medium === 'abstract' ? 'none' : 'any';
  return { moods: [...moods], density: direction?.density, imagery, allowDark };
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

export function compatibleLayouts(cat: LoadedCatalog, facts: PageFacts, disabled: Set<string>, allowDark = false): LayoutNode[] {
  const out: LayoutNode[] = [];
  for (const n of cat.nodes.values()) {
    if (n.kind !== 'layout' || disabled.has(n.id) || n.id.startsWith('builtin.')) continue;
    if (n.darkGround && !allowDark) continue;
    if (!forElement(n, facts.element) || !fitsShape(n, facts.format) || !fitsRole(n.roles, facts.role)) continue;
    if (assignUnits(n, facts.units).error) continue;
    out.push(n);
  }
  return out;
}

export function compatibleSkins(cat: LoadedCatalog, element: CatalogElement, traits: BrandTraits, disabled: Set<string>): SkinNode[] {
  return [...cat.nodes.values()].filter((n): n is SkinNode => n.kind === 'skin' && !disabled.has(n.id) && !n.id.startsWith('builtin.') && forElement(n, element) && (!n.dark || traits.allowDark));
}

/** Les composants qui savent rendre cette unité dans cette zone. */
export function compatibleComponents(cat: LoadedCatalog, unit: PageUnit, zone: ZoneAccept[], disabled: Set<string>, width = 1): ComponentNode[] {
  return [...cat.nodes.values()].filter(
    (n): n is ComponentNode =>
      n.kind === 'component' &&
      !disabled.has(n.id) &&
      (!n.minWidth || width + 1e-6 >= n.minWidth) &&
      n.accepts.includes(unit.kind) &&
      (!n.items || (unit.items >= n.items.min && unit.items <= n.items.max)) &&
      (!n.zones?.length || n.zones.some((z) => zone.includes(z) || z === 'any'))
  );
}

// ── Le score ─────────────────────────────────────────────────────────────────────────────────

/** Une part de hasard fixée par la graine (0…1) : deux documents ne tirent pas les mêmes candidats, un rejeu si. */
export function jitter(seed: string, id: string): number {
  return parseInt(stableHash([seed, id], 8), 16) / 0xffffffff;
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
    const comps = compatibleComponents(cat, u, at.accepts, disabled, at.width);
    if (!comps.length) continue;
    const ranked = comps
      .map((c) => ({ c, v: ((prefer[u.kind] === c.id ? 0.6 : 0) + tagFit(c, traits, facts.units.some((x) => x.category === 'media')) + 0.35 * jitter(`${seed}|${u.id}|${rank}`, c.id)) * weightOf(overrides, c.id) }))
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
  const layouts = compatibleLayouts(cat, facts, disabled, o.traits.allowDark);
  const layoutIds = new Set(layouts.map((l) => l.id));
  const hasMedia = facts.units.some((u) => u.category === 'media');
  const seed = `${o.seed}|${facts.index}`;
  const skin = cat.nodes.get(o.skin) as SkinNode | undefined;
  const gabarits = [...cat.nodes.values()].filter((n): n is GabaritNode => n.kind === 'gabarit' && !disabled.has(n.id) && n.elements.includes(facts.element) && fitsRole(n.roles, facts.role) && layoutIds.has(n.config.layout));
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
    let score = 1 + fit + sequenceScore(ids, gabarit ?? layout, facts, o.state) + 0.3 * jitter(seed, `${ids.join('|')}|${rank}`);
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
