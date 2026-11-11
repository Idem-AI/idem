/**
 * LE GRAPHE DU CATALOGUE VIDÉO — parcouru par le CODE (0 jeton) : ce que la scène a à montrer (ses emplacements), les
 * compositions qui le peuvent (filtre), et leur ordre (score : rôle narratif, énergie, style du film, variété d'une
 * scène à l'autre, mémoire des films déjà faits, graine). Le modèle, aux crans qui l'appellent, ne choisit que dans
 * cette liste courte.
 */
import crypto from 'crypto';
import type { AnimRole, FilmFormatId, GabaritNode, LayoutNode, LoadedVideoCatalog, SceneConfig, SceneRole, Slot, ThemeNode, TransitionNode, VideoStyle } from './types';
import { ROLE_TARGET } from './types';

/** Une empreinte stable (graine, mémoire) : les mêmes entrées donnent toujours la même. */
export const stableHash = (parts: unknown[], length = 10): string => crypto.createHash('sha1').update(JSON.stringify(parts)).digest('hex').slice(0, length);

// ── Les emplacements d'une scène ─────────────────────────────────────────────────────────────

/** Une scène vue par le catalogue : chaque texte rangé dans un emplacement, par sa CLÉ (aucun mot n'est réécrit). */
export interface SceneSlots {
  title?: string;
  body?: string;
  kicker?: string;
  cta?: string;
  figure?: string;
  label?: string;
  attribution?: string;
  /** Les autres textes, dans l'ordre : une liste (jamais perdus). */
  items: string[];
  media?: { id: string; kind: 'image' | 'video' };
  logo: boolean;
}

const KEY_SLOT: Array<[RegExp, Exclude<Slot, 'items' | 'media' | 'logo'>]> = [
  [/^(headline|title|heading|hook)$/i, 'title'],
  [/^(sub|subhead|subtitle|body|detail|support)$/i, 'body'],
  [/^(kicker|eyebrow|tag|overline)$/i, 'kicker'],
  [/^(cta|action|button)$/i, 'cta'],
  [/^(figure|stat|number|metric|price|offer|value)$/i, 'figure'],
  [/^(label|caption|unit)$/i, 'label'],
  [/^(author|attribution|name|signature|who)$/i, 'attribution'],
];

/** Un texte court qui EST un chiffre (« 1 200 », « +70 % », « 2,3 Md ») : il peut tenir l'emplacement du chiffre. */
export const isFigure = (text: string): boolean => text.length <= 16 && /\d/.test(text) && /^[~≈+\-−]?\s*\d[\d\s.,  ]*\s*(%|[kKmM]|Md|Mds|M\$|FCFA|XAF|€|\$|x|×|h|j|ans?)?\s*$/u.test(text.trim());

/** Les clés de la scène rangées : la clé contractuelle d'abord, puis la forme (un chiffre), puis l'ordre. */
export function sceneSlots(texts: Record<string, string>, media: Array<{ id: string; kind: 'image' | 'video' }>, hasLogo: boolean, role?: string): SceneSlots {
  const out: SceneSlots = { items: [], logo: hasLogo };
  const rest: string[] = [];
  for (const [key, value] of Object.entries(texts)) {
    if (!String(value ?? '').trim()) continue;
    const slot = KEY_SLOT.find(([re]) => re.test(key))?.[1];
    if (slot && !out[slot]) out[slot] = key;
    else rest.push(key);
  }
  // Un chiffre seul d'une scène de preuve ou de données occupe l'emplacement du chiffre (avant la ligne de soutien).
  if (!out.figure && (role === 'proof' || role === 'data')) {
    const k = rest.find((key) => isFigure(texts[key]));
    if (k) {
      out.figure = k;
      rest.splice(rest.indexOf(k), 1);
    }
  }
  if (!out.title) out.title = rest.shift();
  // Une scène sans titre (une légende sous une photo, un appel à l'action seul) : son texte principal EST le titre —
  // sinon aucune mise en page ne la montre, et elle retombe sur l'empilement de secours.
  if (!out.title) {
    const lead = (!out.figure && out.label ? 'label' : out.body ? 'body' : out.cta && !out.body ? 'cta' : undefined) as 'label' | 'body' | 'cta' | undefined;
    if (lead) {
      out.title = out[lead];
      delete out[lead];
    }
  }
  // Les clés génériques du storyboard (`text2`, `text3`, `prop1`…) : une seule est la ligne de soutien ; plusieurs
  // forment une liste (rien n'est perdu, rien n'est réécrit).
  if (!out.body && rest.length === 1) out.body = rest.shift();
  out.items = rest;
  const m = media.find((x) => x.kind === 'image' || x.kind === 'video');
  if (m) out.media = { id: m.id, kind: m.kind };
  return out;
}

const SLOT_KEYS: Array<Exclude<Slot, 'items' | 'media' | 'logo'>> = ['title', 'body', 'kicker', 'cta', 'figure', 'label', 'attribution'];

/** Les emplacements présents (le logo n'en est un que si la mise en page le prévoit). */
export function presentSlots(s: SceneSlots): Slot[] {
  return [...SLOT_KEYS.filter((k) => s[k]), ...(s.items.length ? (['items'] as Slot[]) : []), ...(s.media ? (['media'] as Slot[]) : [])];
}

// ── Les faits et le filtre ───────────────────────────────────────────────────────────────────

export interface SceneFacts {
  index: number;
  count: number;
  role?: SceneRole;
  energy: number;
  duration: number;
  slots: SceneSlots;
  texts: Record<string, string>;
  formats: FilmFormatId[];
}

/** L'énergie d'une scène sans énergie déclarée : celle de son rôle narratif. */
const ROLE_ENERGY: Partial<Record<SceneRole, number>> = { hook: 4, problem: 2, reveal: 4, feature: 3, benefits: 3, proof: 3, data: 3, statement: 3, cta: 4, signature: 2 };
export const energyOf = (role?: string, energy?: number): number => (energy && energy >= 1 && energy <= 5 ? energy : ROLE_ENERGY[role as SceneRole] ?? 3);

/** La mise en page peut-elle montrer TOUTE la scène (aucun texte perdu, chaque emplacement exigé rempli) ? */
export function layoutFits(layout: LayoutNode, f: SceneFacts): boolean {
  if (!f.formats.every((x) => layout.formats.includes(x))) return false;
  const slots = layout.slots ?? {};
  for (const [slot, def] of Object.entries(slots) as Array<[Slot, NonNullable<LayoutNode['slots'][Slot]>]>) {
    if (def.need !== 'required') continue;
    if (slot === 'logo') continue; // un logo absent est remplacé par le nom de la marque
    if (slot === 'items' ? f.slots.items.length < (def.min ?? 1) : !(slot === 'media' ? f.slots.media : f.slots[slot as keyof SceneSlots])) return false;
  }
  for (const slot of presentSlots(f.slots)) {
    const def = slots[slot];
    if (!def) return false;
    if (slot === 'items') {
      if (f.slots.items.length > (def.max ?? 6) || f.slots.items.length < (def.min ?? 1)) return false;
      if (def.maxChars && f.slots.items.some((k) => (f.texts[k] ?? '').length > def.maxChars! * 1.3)) return false;
    } else if (slot === 'media') {
      if (def.kinds && f.slots.media && !def.kinds.includes(f.slots.media.kind)) return false;
    } else if (def.max) {
      const key = f.slots[slot as keyof SceneSlots] as string;
      if ((f.texts[key] ?? '').length > def.max * 1.3) return false;
    }
  }
  return true;
}

const roleMatch = (roles: string[] | undefined, role?: string): number => (!roles?.length ? 0 : roles.includes(role ?? '') ? 1 : roles.includes('*') ? 0.3 : 0);
const energyMatch = (range: [number, number] | undefined, e: number): number => (!range ? 0.5 : e >= range[0] && e <= range[1] ? 1 : 1 - Math.min(1, Math.min(Math.abs(e - range[0]), Math.abs(e - range[1])) / 2));
const jitter = (seed: string): number => (parseInt(stableHash([seed], 6), 16) % 1000) / 1000;

export interface SceneCandidate {
  ref: string;
  layout: LayoutNode;
  gabarit?: GabaritNode;
  config: SceneConfig;
  score: number;
}

export interface FilmState {
  /** La mise en page de chaque scène déjà choisie (variété : jamais deux fois de suite). */
  layouts: string[];
  use: Map<string, number>;
  /** Les combinaisons déjà livrées à la marque (mémoire). */
  seen: Set<string>;
}

export const sceneFingerprint = (c: SceneConfig): string => stableHash([c.gabarit ?? '', c.layout, ...Object.entries(c.animations ?? {}).sort().map(([r, a]) => `${r}=${a}`), c.transition ?? ''], 10);

/** La liste courte d'une scène : gabarits et mises en page qui la montrent entière, du plus juste au moins juste. */
/**
 * Les nœuds de la DA de la marque ; aucun : ceux de ses voisines ; aucun non plus : la liste entière (un film ne
 * s'arrête jamais faute de couverture). Sans DA connue, aucun filtre.
 */
export function inDirection<T extends { directions?: string[] }>(cat: LoadedVideoCatalog, list: T[], direction?: string): T[] {
  if (!direction || !cat.directions?.size || !cat.directions.has(direction)) return list;
  const own = list.filter((n) => n.directions?.includes(direction));
  if (own.length) return own;
  const neighbors = cat.directions.get(direction)?.neighbors ?? [];
  const near = list.filter((n) => n.directions?.some((d) => neighbors.includes(d)));
  return near.length ? near : list;
}

export function shortlist(cat: LoadedVideoCatalog, f: SceneFacts, o: { style?: VideoStyle; direction?: string; state: FilmState; seed: string; size: number }): SceneCandidate[] {
  const layouts = inDirection(cat, [...cat.nodes.values()].filter((n): n is LayoutNode => n.kind === 'layout' && !n.id.startsWith('builtin.') && layoutFits(n, f)), o.direction);
  const fitting = new Set(layouts.map((l) => l.id));
  const previous = o.state.layouts[f.index - 1];
  const score = (layout: LayoutNode, node: { roles?: string[]; energy?: [number, number]; tags?: { style?: VideoStyle[] }; weight?: number; id: string }, config: SceneConfig): number => {
    let s = 0.35 * roleMatch(node.roles, f.role) + 0.2 * roleMatch(layout.roles, f.role) + 0.15 * energyMatch(node.energy ?? layout.energy, f.energy);
    if (o.style && node.tags?.style?.includes(o.style)) s += 0.12;
    if (layout.id === previous) s -= 0.6;
    s -= 0.12 * (o.state.use.get(layout.id) ?? 0);
    if (o.state.seen.has(sceneFingerprint(config))) s -= 0.15;
    // La première scène accroche, la dernière conclut : les rôles du récit le disent déjà ; la position renforce.
    if (f.index === f.count - 1 && layout.roles.includes('cta')) s += 0.08;
    return s + 0.06 * (node.weight ?? 1) + 0.08 * jitter(`${o.seed}|${f.index}|${node.id}`);
  };
  const out: SceneCandidate[] = [];
  const gabarits = inDirection(cat, [...cat.nodes.values()].filter((g): g is GabaritNode => g.kind === 'gabarit'), o.direction);
  for (const g of gabarits) {
    if (!fitting.has(g.config.layout) || roleMatch(g.roles, f.role) === 0) continue;
    const layout = cat.nodes.get(g.config.layout) as LayoutNode;
    const config: SceneConfig = { gabarit: g.id, layout: layout.id, animations: { ...g.config.animations }, ...(g.config.transition ? { transition: g.config.transition } : {}), vars: { ...(g.config.vars ?? {}) } };
    out.push({ ref: '', layout, gabarit: g, config, score: score(layout, g, config) + 0.1 });
  }
  // Les mises en page nues (animations du thème) complètent la liste : plus de combinaisons, jamais moins juste.
  for (const layout of layouts) {
    if (out.some((c) => c.layout.id === layout.id && c.score > 0.5)) continue;
    const config: SceneConfig = { layout: layout.id, animations: {} };
    out.push({ ref: '', layout, config, score: score(layout, layout, config) });
  }
  // Rien ne montre la scène entière : le minimum intégré (empilement) la montre toujours.
  if (!out.length) {
    const builtin = cat.nodes.get('builtin.stack') as LayoutNode;
    out.push({ ref: '', layout: builtin, config: { layout: builtin.id, animations: {} }, score: 0 });
  }
  return out
    .sort((a, b) => b.score - a.score)
    .slice(0, o.size)
    .map((c, i) => ({ ...c, ref: String.fromCharCode(65 + i) }));
}

/** Les thèmes du film, classés : style demandé, énergie moyenne du film, fond sombre seulement s'il est permis. */
export function rankThemes(cat: LoadedVideoCatalog, o: { style?: VideoStyle; direction?: string; energy: number; allowDark: boolean; seed: string; used: string[] }): ThemeNode[] {
  const themes = inDirection(cat, [...cat.nodes.values()].filter((n): n is ThemeNode => n.kind === 'theme' && !n.id.startsWith('builtin.') && (o.allowDark || !n.requiresDark)), o.direction);
  if (!themes.length) return [cat.nodes.get('builtin.plain') as ThemeNode];
  return themes
    .map((t) => ({ t, s: (o.style && t.tags?.style?.includes(o.style) ? 0.5 : 0) + 0.3 * energyMatch(t.energy, Math.round(o.energy)) - (o.used.includes(t.id) ? 0.25 : 0) + 0.15 * jitter(`${o.seed}|${t.id}`) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.t);
}

/** Les rôles animables présents dans un HTML de scène (dans l'ordre du document). */
export function rolesIn(html: string): AnimRole[] {
  return [...new Set([...html.matchAll(/data-v="([a-z]+)"/g)].map((m) => m[1] as AnimRole))];
}

/** L'animation d'un rôle : celle de la configuration si elle convient, sinon le défaut du thème pour sa cible. */
export function animationFor(cat: LoadedVideoCatalog, theme: ThemeNode, config: SceneConfig, role: AnimRole, text?: string): string {
  const target = ROLE_TARGET[role];
  const ok = (id?: string): id is string => {
    const a = id ? cat.nodes.get(id) : undefined;
    return a?.kind === 'animation' && a.targets.includes(target) && (!a.maxChars || !text || text.length <= a.maxChars);
  };
  const chosen = config.animations?.[role];
  if (ok(chosen)) return chosen;
  const byTheme = role === 'body' || role === 'kicker' || role === 'label' || role === 'attribution' ? theme.defaults.body ?? theme.defaults.text : theme.defaults[target];
  if (ok(byTheme)) return byTheme;
  const any = [...cat.nodes.values()].find((n) => n.kind === 'animation' && n.targets.includes(target) && !n.id.startsWith('builtin.'));
  return any?.id ?? 'builtin.rise';
}

/**
 * La transition d'ENTRÉE d'une scène : celle de sa configuration si le thème l'admet, sinon la première du thème. Un
 * film n'emploie pas plus de deux transitions différentes (au-delà, le montage paraît désordonné).
 */
export function transitionFor(cat: LoadedVideoCatalog, theme: ThemeNode, config: SceneConfig, used: string[]): TransitionNode {
  const palette = theme.transitions.filter((id) => cat.nodes.get(id)?.kind === 'transition');
  const distinct = [...new Set(used)];
  let id = config.transition && palette.includes(config.transition) ? config.transition : palette[0];
  if (id && distinct.length >= 2 && !distinct.includes(id)) id = distinct[distinct.length - 1];
  const node = id ? cat.nodes.get(id) : undefined;
  return (node?.kind === 'transition' ? node : cat.nodes.get('builtin.cut')) as TransitionNode;
}
