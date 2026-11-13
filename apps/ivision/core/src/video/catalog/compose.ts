/**
 * LE FILM ASSEMBLÉ DEPUIS LE CATALOGUE — l'orchestrateur du moteur vidéo par catalogue.
 *
 *   storyboard (scènes : rôle, énergie, textes exacts, médias) → emplacements de chaque scène (code)
 *   → liste courte par scène et thèmes classés (graphe, 0 jeton)
 *   → le MODÈLE choisit pour tout le film en un appel (Medium et au-delà ; Low : le code seul)
 *   → le CODE assemble chaque scène (HTML + chorégraphie) et ses transitions → contrat de scène HyperFrames
 *
 * Une scène qui plante ou dont un texte ne tient pas cède la place au candidat suivant (sans modèle). Une retouche
 * écrite repart de la configuration actuelle de la scène (un petit appel). Tout se rejoue sans modèle depuis les
 * configurations gardées (`reassembleFilm`).
 */
import logger from '../../runtime/logger';
import { coreHost } from '../../runtime/host';
import type { CreativityLevel } from '../../creativity/levels';
import { callFilmModel, FilmCallContext } from '../agents';
import { assembleScene, sceneHtml } from './assemble';
import { ChooseScene, chooseSystem, chooseUser, parseChoices, videoEffortFor } from './choose';
import { energyOf, FilmState, rankThemes, rolesIn, sceneFingerprint, sceneSlots, SceneFacts, SceneSlots, shortlist, SceneCandidate, transitionFor } from './graph';
import { videoCatalog } from './registry';
import type { FilmFormatId, LayoutNode, LoadedVideoCatalog, SceneConfig, SceneRole, ThemeNode, TransitionNode, VideoStyle } from './types';
import { ROLE_TARGET, SCENE_ROLES } from './types';

export interface CatalogScene {
  key: string;
  duration: number;
  texts: Record<string, string>;
  media: Array<{ id: string; kind: 'image' | 'video' }>;
  role?: string;
  energy?: number;
  beat?: { bpm: number; first: number };
}

export interface ComposeInput {
  scenes: CatalogScene[];
  film: { title: string; concept: string; style?: string; seed: string | number };
  brand: { name: string; hasLogo: boolean; hasDarkLogo?: boolean; line: string; /** La DA de la marque (catalogue des DA). */ direction?: string };
  formats: FilmFormatId[];
  level: CreativityLevel;
  call: FilmCallContext;
  /** Un fond sombre n'est permis que sur demande explicite (politique de surface claire). */
  allowDark?: boolean;
  /** La portée de la mémoire (marque, projet) : les combinaisons déjà livrées sont évitées. */
  memoryKey?: string;
}

export interface ComposedScene {
  key: string;
  html: string;
  script: string;
  config: SceneConfig;
}

export interface ComposedFilm {
  version: string;
  theme: string;
  vars: Record<string, string>;
  scenes: ComposedScene[];
  trace: { source: 'llm' | 'code'; tokens: { input: number; output: number }; ms: number; failure?: string; detail: string };
}

const STYLES: VideoStyle[] = ['energetic', 'premium', 'playful', 'corporate'];
const asRole = (r?: string): SceneRole | undefined => (SCENE_ROLES.includes(r as SceneRole) ? (r as SceneRole) : undefined);

/**
 * Le rôle narratif d'une scène que le storyboard n'a pas nommé : déduit de sa PLACE et de sa FORME (jamais de ses
 * mots) — la première accroche, la dernière conclut (appel à l'action s'il y en a un, sinon signature), un chiffre
 * prouve, une image montre, le reste affirme.
 */
function inferRole(s: CatalogScene, index: number, count: number, slots: SceneSlots): SceneRole {
  const hasCta = Object.keys(s.texts).some((k) => /^(cta|action|button)$/i.test(k));
  if (index === 0) return 'hook';
  if (index === count - 1) return hasCta ? 'cta' : 'signature';
  if (slots.figure) return 'proof';
  if (slots.items.length >= 2) return 'benefits';
  if (slots.media) return 'feature';
  return 'statement';
}

function factsOf(scenes: CatalogScene[], formats: FilmFormatId[], hasLogo: boolean): SceneFacts[] {
  return scenes.map((s, index) => {
    const given = asRole(s.role);
    const first = sceneSlots(s.texts, s.media, hasLogo, given);
    const role = given ?? inferRole(s, index, scenes.length, first);
    const slots = given ? first : sceneSlots(s.texts, s.media, hasLogo, role);
    return { index, count: scenes.length, role, energy: energyOf(role, s.energy), duration: s.duration, slots, texts: s.texts, formats };
  });
}

/** La forme d'une scène pour le modèle : des longueurs et des genres, jamais les mots. */
function shapeOf(slots: SceneSlots, texts: Record<string, string>): string {
  const parts: string[] = [];
  for (const k of ['title', 'body', 'figure', 'label', 'cta', 'attribution'] as const) if (slots[k]) parts.push(`${k} ${(texts[slots[k]!] ?? '').length} chars`);
  if (slots.items.length) parts.push(`${slots.items.length} items`);
  if (slots.media) parts.push(`media ${slots.media.kind}`);
  return parts.join(', ') || 'no text';
}

async function memoryOf(key?: string): Promise<{ templates: Set<string>; themes: string[] }> {
  const host = coreHost();
  if (!key || !host.recentFingerprints || process.env.IDEM_QUALITY_MEMORY === '0') return { templates: new Set(), themes: [] };
  const marks = await host.recentFingerprints({ documentType: 'video', key }).catch(() => [] as string[]);
  return { templates: new Set(marks.filter((m) => m.startsWith('vtpl:')).map((m) => m.slice(5))), themes: marks.filter((m) => m.startsWith('vtheme:')).map((m) => m.slice(7)) };
}

/** Assembler toutes les scènes d'après leurs configurations (aucun modèle) : transitions et sorties comprises. */
export function assembleFilm(cat: LoadedVideoCatalog, input: Pick<ComposeInput, 'scenes' | 'brand' | 'formats'>, theme: ThemeNode, configs: SceneConfig[], vars: Record<string, string> = {}): ComposedScene[] {
  const facts = factsOf(input.scenes, input.formats, input.brand.hasLogo);
  const used: string[] = [];
  const transitions: Array<TransitionNode | undefined> = configs.map((c, i) => {
    if (i === 0) return undefined;
    const tr = transitionFor(cat, theme, c, used);
    used.push(tr.id);
    return tr;
  });
  // Un film posé laisse ses éléments sortir juste avant une coupe ; les autres transitions s'en chargent elles-mêmes.
  const calm = theme.motion.dIn >= 0.85;
  return input.scenes.map((s, i) => {
    // La première scène n'entre par aucune transition : la configuration ne garde que celle qui sert.
    const { transition: _unused, ...rest } = configs[i];
    const config: SceneConfig = { ...rest, ...(transitions[i] ? { transition: transitions[i]!.id } : {}) };
    const next = transitions[i + 1];
    const a = assembleScene({
      cat,
      theme,
      config,
      slots: facts[i].slots,
      texts: s.texts,
      scene: { key: s.key, duration: s.duration, energy: facts[i].energy, ...(s.beat ? { beat: s.beat } : {}) },
      brand: input.brand,
      ...(transitions[i] ? { transitionIn: transitions[i], prevKey: input.scenes[i - 1].key } : {}),
      exitAtEnd: calm && i < input.scenes.length - 1 && (!next || next.duration === 0),
      vars,
    });
    return { key: s.key, html: a.html, script: a.script, config };
  });
}

/** LE FILM : liste courte, choix (code ou modèle), assemblage. Jamais d'exception : au pire, le choix du code. */
export async function composeFilmFromCatalog(input: ComposeInput): Promise<ComposedFilm> {
  const t0 = Date.now();
  const cat = await videoCatalog();
  const effort = videoEffortFor(input.level);
  const memory = await memoryOf(input.memoryKey);
  const facts = factsOf(input.scenes, input.formats, input.brand.hasLogo);
  const style = STYLES.includes(input.film.style as VideoStyle) ? (input.film.style as VideoStyle) : undefined;
  const seed = `${input.brand.name}|${input.film.seed}`;
  const state: FilmState = { layouts: [], use: new Map(), seen: memory.templates };
  const lists: SceneCandidate[][] = [];
  for (const f of facts) {
    const list = shortlist(cat, f, { style, direction: input.brand.direction, state, seed, size: effort.shortlist });
    lists.push(list);
    state.layouts[f.index] = list[0].layout.id;
    state.use.set(list[0].layout.id, (state.use.get(list[0].layout.id) ?? 0) + 1);
  }
  const avgEnergy = facts.reduce((n, f) => n + f.energy, 0) / Math.max(1, facts.length);
  const themes = rankThemes(cat, { style, direction: input.brand.direction, energy: avgEnergy, allowDark: input.allowDark === true, seed, used: memory.themes });
  let theme = themes[0];
  let configs = lists.map((l) => l[0].config);
  let trace: ComposedFilm['trace'] = { source: 'code', tokens: { input: 0, output: 0 }, ms: 0, detail: '' };

  if (effort.chooser === 'model' && (lists.some((l) => l.length > 1) || (effort.themes > 1 && themes.length > 1))) {
    const offered = themes.slice(0, effort.themes);
    const scenes: ChooseScene[] = facts.map((f, i) => ({
      key: input.scenes[i].key,
      role: f.role,
      energy: f.energy,
      duration: f.duration,
      shape: shapeOf(f.slots, f.texts),
      candidates: lists[i],
      roles: Object.fromEntries(lists[i].map((c) => [c.ref, rolesIn(sceneHtml(c.layout, theme, f.slots, input.brand)).filter((r) => r !== 'item')])),
    }));
    const user = chooseUser(cat, { brandLine: input.brand.line, film: input.film, themes: offered, scenes, effort });
    const run = await callFilmModel(input.call, 'video.template', chooseSystem(), user, (raw) => parseChoices(raw, cat, { themes: offered, scenes, effort }) !== null);
    const parsed = run.raw ? parseChoices(run.raw, cat, { themes: offered, scenes, effort }) : null;
    trace = { source: parsed ? 'llm' : 'code', tokens: run.tokens, ms: run.ms, ...(run.failure ? { failure: run.failure } : {}), detail: '' };
    if (parsed) {
      if (parsed.theme) theme = parsed.theme;
      configs = scenes.map((s, i) => parsed.scenes.get(s.key)?.config ?? configs[i]);
    }
  }
  // La variété, garantie par le code : jamais la même mise en page deux scènes de suite (le candidat suivant la remplace).
  for (let i = 1; i < configs.length; i++) {
    if (configs[i].layout !== configs[i - 1].layout) continue;
    const alt = lists[i].find((c) => c.layout.id !== configs[i - 1].layout);
    if (alt) configs[i] = alt.config;
  }
  const scenes = assembleFilm(cat, input, theme, configs);
  trace.ms = Date.now() - t0;
  trace.detail = `catalogue ${cat.version} · thème ${theme.id} · ${scenes.map((s) => `${s.key}=${s.config.gabarit ?? s.config.layout}${s.config.transition ? `↤${s.config.transition}` : ''}`).join(', ')}`.slice(0, 600);
  logger.info('video.catalog_film', { event: 'video.catalog_film', level: input.level, by: trace.source, detail: trace.detail });
  const host = coreHost();
  if (input.memoryKey && host.rememberFingerprints && process.env.IDEM_QUALITY_MEMORY !== '0') {
    await host.rememberFingerprints({ documentType: 'video', key: input.memoryKey }, [`vtheme:${theme.id}`, ...scenes.map((s) => `vtpl:${sceneFingerprint(s.config)}`)]).catch(() => undefined);
  }
  return { version: cat.version, theme: theme.id, vars: {}, scenes, trace };
}

/** Le film réassemblé depuis ses configurations gardées (texte, durée ou ordre changés) : aucun modèle. */
export async function reassembleFilm(input: Pick<ComposeInput, 'scenes' | 'brand' | 'formats'>, themeId: string, configs: SceneConfig[], vars: Record<string, string> = {}): Promise<ComposedScene[]> {
  const cat = await videoCatalog();
  const theme = (cat.nodes.get(themeId)?.kind === 'theme' ? cat.nodes.get(themeId) : cat.nodes.get('builtin.plain')) as ThemeNode;
  // Un nœud retiré du catalogue depuis : l'empilement intégré montre la scène.
  const safe = configs.map((c): SceneConfig => (c && cat.nodes.get(c.layout)?.kind === 'layout' ? c : { layout: 'builtin.stack', animations: {} }));
  return assembleFilm(cat, input, theme, safe, vars);
}

/**
 * Le candidat SUIVANT d'une scène (elle plante, un texte ne tient pas, ou le client veut « une autre version ») : le
 * premier de sa liste courte qui n'a pas encore été essayé, sans modèle. `null` : la liste est épuisée.
 */
export async function nextSceneConfig(input: Pick<ComposeInput, 'scenes' | 'brand' | 'formats' | 'film'>, index: number, tried: SceneConfig[]): Promise<SceneConfig | null> {
  const cat = await videoCatalog();
  const facts = factsOf(input.scenes, input.formats, input.brand.hasLogo);
  const style = STYLES.includes(input.film.style as VideoStyle) ? (input.film.style as VideoStyle) : undefined;
  const list = shortlist(cat, facts[index], { style, direction: input.brand.direction, state: { layouts: [], use: new Map(), seen: new Set() }, seed: `${input.brand.name}|${input.film.seed}`, size: 12 });
  const done = new Set(tried.map(sceneFingerprint));
  const fresh = list.find((c) => !done.has(sceneFingerprint(c.config)));
  if (fresh) return fresh.config;
  // Une seule mise en page montre la scène : une nouvelle version change alors le MOUVEMENT de son rôle principal
  // (une autre animation compatible), dans l'ordre du catalogue — jamais au hasard.
  const base = list[0]?.config;
  if (!base) return null;
  const html = sceneHtml(list[0].layout, cat.nodes.get('builtin.plain') as ThemeNode, facts[index].slots, input.brand);
  const roles = rolesIn(html).filter((r) => r !== 'item');
  const lead = (['title', 'figure', 'media', 'logo'] as const).find((r) => roles.includes(r));
  if (!lead) return null;
  const target = ROLE_TARGET[lead];
  const alternatives = [...cat.nodes.values()].filter((n) => n.kind === 'animation' && !n.id.startsWith('builtin.') && n.targets.includes(target)).map((n) => n.id).sort();
  for (const id of alternatives) {
    const variant: SceneConfig = { ...base, animations: { ...base.animations, [lead]: id } };
    if (!done.has(sceneFingerprint(variant))) return variant;
  }
  return null;
}

/** La RETOUCHE écrite d'une scène : le modèle repart de sa configuration actuelle et de la consigne (un appel). */
export async function reviseSceneConfig(input: ComposeInput, index: number, themeId: string, current: SceneConfig, instruction: string): Promise<{ config: SceneConfig; trace: ComposedFilm['trace'] }> {
  const cat = await videoCatalog();
  const effort = { ...videoEffortFor(input.level), chooser: 'model' as const, motion: true };
  const facts = factsOf(input.scenes, input.formats, input.brand.hasLogo);
  const f = facts[index];
  const theme = (cat.nodes.get(themeId)?.kind === 'theme' ? cat.nodes.get(themeId) : cat.nodes.get('builtin.plain')) as ThemeNode;
  const style = STYLES.includes(input.film.style as VideoStyle) ? (input.film.style as VideoStyle) : undefined;
  let list = shortlist(cat, f, { style, direction: input.brand.direction, state: { layouts: [], use: new Map(), seen: new Set() }, seed: `${input.brand.name}|${input.film.seed}|revise`, size: Math.max(6, effort.shortlist) });
  // La configuration actuelle en tête (« A ») : la consigne la modifie, elle ne repart pas de zéro.
  const layout = cat.nodes.get(current.layout);
  if (layout?.kind === 'layout') list = [{ ref: 'A', layout: layout as LayoutNode, config: current, score: 99 }, ...list.filter((c) => sceneFingerprint(c.config) !== sceneFingerprint(current))].map((c, i) => ({ ...c, ref: String.fromCharCode(65 + i) }));
  const key = input.scenes[index].key;
  const scenes: ChooseScene[] = [{ key, role: f.role, energy: f.energy, duration: f.duration, shape: shapeOf(f.slots, f.texts), candidates: list, roles: Object.fromEntries(list.map((c) => [c.ref, rolesIn(sceneHtml(c.layout, theme, f.slots, input.brand)).filter((r) => r !== 'item')])) }];
  const user = chooseUser(cat, { brandLine: input.brand.line, film: input.film, themes: [theme], scenes, effort, revise: { key, current, instruction } });
  const run = await callFilmModel(input.call, 'video.template', chooseSystem(), user, (raw) => (parseChoices(raw, cat, { themes: [theme], scenes, effort })?.scenes.size ?? 0) > 0);
  const parsed = run.raw ? parseChoices(run.raw, cat, { themes: [theme], scenes, effort }) : null;
  const config = parsed?.scenes.get(key)?.config ?? list.find((c) => sceneFingerprint(c.config) !== sceneFingerprint(current))?.config ?? current;
  return { config, trace: { source: parsed ? 'llm' : 'code', tokens: run.tokens, ms: run.ms, ...(run.failure ? { failure: run.failure } : {}), detail: `${key}: ${config.gabarit ?? config.layout}` } };
}
