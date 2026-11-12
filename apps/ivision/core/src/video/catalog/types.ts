/**
 * LE CATALOGUE VIDÉO — ses nœuds et ses règles (les mêmes que `idem-templates/scripts/video-rules.mjs`, appliquées une
 * seconde fois au chargement : un nœud qui les enfreint est écarté et dit, jamais exécuté).
 *
 *   layout      une MISE EN PAGE de scène : HTML Tailwind à emplacements (`{{title}}`, `[[media]]`…), une zone sûre,
 *               responsive sur les quatre formats (unités `cqmin`, variantes `[[ls:…]]`) ;
 *   theme       la personnalité du FILM : durées, courbes, décalages, distances, traitement typographique et couleurs ;
 *   animation   l'entrée / la sortie / la tenue d'un rôle : des tweens DÉCLARATIFS (aucun JavaScript publié) ;
 *   transition  le passage d'une scène à la suivante : tweens de sortie, d'entrée, et panneaux de marque ;
 *   gabarit     une recette de scène : mise en page + animation par rôle + transition d'entrée.
 */

export type VideoNodeKind = 'layout' | 'theme' | 'animation' | 'transition' | 'gabarit';
export type SceneRole = 'hook' | 'problem' | 'reveal' | 'feature' | 'benefits' | 'proof' | 'cta' | 'signature' | 'statement' | 'data';
export type VideoStyle = 'energetic' | 'premium' | 'playful' | 'corporate';
export type Slot = 'title' | 'body' | 'cta' | 'figure' | 'label' | 'attribution' | 'items' | 'media' | 'logo';
export type AnimRole = 'title' | 'body' | 'cta' | 'figure' | 'label' | 'attribution' | 'items' | 'item' | 'media' | 'logo' | 'rule' | 'mark';
export type AnimTarget = 'text' | 'block' | 'items' | 'figure' | 'logo' | 'cta' | 'media' | 'rule';
export type FilmFormatId = 'story' | 'square' | 'portrait' | 'landscape';

export interface NodeDoc {
  title: string;
  summary: string;
  use?: string;
  avoid?: string;
}

interface BaseNode {
  id: string;
  version: number;
  medium: 'video';
  kind: VideoNodeKind;
  doc: NodeDoc;
  energy?: [number, number];
  tags?: { style?: VideoStyle[]; mood?: string[] };
  weight?: number;
  /** Les DA servies (catalogue `directions` du dépôt) : un film ne prend que les nœuds de la DA de sa marque. */
  directions?: string[];
}

export interface SlotDef {
  need: 'required' | 'optional';
  max?: number;
  min?: number;
  maxChars?: number;
  kinds?: Array<'image' | 'video'>;
}

export interface LayoutNode extends BaseNode {
  kind: 'layout';
  formats: FilmFormatId[];
  roles: Array<SceneRole | '*'>;
  slots: Partial<Record<Slot, SlotDef>>;
  duration?: { min: number; max: number };
  html: string;
}

export interface ThemeMotion {
  dIn: number;
  dOut: number;
  stagger: number;
  dist: number;
  easeOut: string;
  easeIn: string;
  easeMove: string;
  drift?: number;
}

export interface ThemeNode extends BaseNode {
  kind: 'theme';
  ground: 'light' | 'soft' | 'brand' | 'deep';
  requiresDark?: boolean;
  type?: { scale?: number };
  motion: ThemeMotion;
  classes: Record<string, string>;
  /** L'animation par défaut de chaque cible (`text`, `body`, `media`, `rule`, `figure`, `items`, `logo`, `cta`, `block`). */
  defaults: Record<string, string>;
  transitions: string[];
  vars?: Array<{ name: string; doc?: string; options: Array<{ id: string }> }>;
}

export type TweenValue = number | string;
export interface TweenStep {
  from?: Record<string, TweenValue>;
  to?: Record<string, TweenValue>;
  duration: TweenValue;
  ease?: string;
  stagger?: TweenValue;
  /** Décalage par rapport au DÉBUT du tween précédent (absent : à sa fin). */
  at?: number;
  /** Animation : `self` (défaut) ou `inner` (l'image dans son cadre) ; transition : `prev`, `next`, `overlay:N`. */
  target?: string;
  counter?: true;
}

export interface AnimationNode extends BaseNode {
  kind: 'animation';
  targets: AnimTarget[];
  split: 'none' | 'words' | 'chars' | 'lines';
  mask?: boolean;
  maxChars?: number;
  steps: { in: TweenStep[]; out?: TweenStep[]; hold?: TweenStep[] };
}

export interface TransitionNode extends BaseNode {
  kind: 'transition';
  duration: number;
  overlays: Array<{ color: 'primary' | 'secondary' | 'accent' | 'ground' | 'ink'; area: 'full' | 'top' | 'bottom' | 'left' | 'right' | 'band' }>;
  steps: { out: TweenStep[]; in: TweenStep[] };
}

export interface SceneConfig {
  gabarit?: string;
  layout: string;
  /** L'animation de chaque rôle (absent : le défaut du thème). */
  animations: Partial<Record<AnimRole, string>>;
  /** La transition par laquelle la scène ENTRE (la première scène n'en a pas). */
  transition?: string;
  vars?: Record<string, string>;
  /** Réglages continus (Ultra) : rythme (0,8–1,25 : plus lent ↔ plus vif). */
  params?: { pace?: number };
}

export interface GabaritNode extends BaseNode {
  kind: 'gabarit';
  roles: Array<SceneRole | '*'>;
  config: SceneConfig & { gabarit: string };
}

export type VideoNode = LayoutNode | ThemeNode | AnimationNode | TransitionNode | GabaritNode;

export interface LoadedVideoCatalog {
  version: string;
  source: 'dir' | 'url' | 'cache' | 'snapshot' | 'builtin';
  nodes: Map<string, VideoNode>;
  rejected: Array<{ id: string; reason: string }>;
  /** Les DA du dépôt et leurs voisines (vide : catalogue sans DA, aucun filtre). */
  directions: Map<string, { id: string; neighbors: string[] }>;
}

/** Ce qui est gardé avec le film : la version du catalogue et le thème ; avec chaque scène, sa configuration. */
export interface FilmCatalogInfo {
  version: string;
  theme: string;
  vars?: Record<string, string>;
}

// ── Les règles ───────────────────────────────────────────────────────────────────────────────

export const FORMAT_IDS: FilmFormatId[] = ['story', 'square', 'portrait', 'landscape'];
export const SCENE_ROLES: SceneRole[] = ['hook', 'problem', 'reveal', 'feature', 'benefits', 'proof', 'cta', 'signature', 'statement', 'data'];
const SLOTS = new Set<string>(['title', 'body', 'cta', 'figure', 'label', 'attribution', 'items', 'media', 'logo']);
export const ANIM_ROLES = new Set<string>(['title', 'body', 'cta', 'figure', 'label', 'attribution', 'items', 'item', 'media', 'logo', 'rule', 'mark']);
const TARGETS = new Set<string>(['text', 'block', 'items', 'figure', 'logo', 'cta', 'media', 'rule']);
/** La cible que porte chaque rôle : une animation ne s'applique qu'aux rôles de ses cibles. */
export const ROLE_TARGET: Record<AnimRole, AnimTarget> = { title: 'text', body: 'text', label: 'text', attribution: 'text', items: 'items', item: 'items', figure: 'figure', media: 'media', logo: 'logo', rule: 'rule', cta: 'cta', mark: 'block' };
/** Courbes permises : des décélérations franches. Ni rebond, ni élastique, ni « back ». */
export const EASE = /^(none|(power[1-4]|sine|expo|circ)\.(in|out|inOut))$/;
export const TOKEN = /^-?\$(dIn|dOut|stagger|dist|easeOut|easeIn|easeMove|half|d|hold)(\*\d+(\.\d+)?)?$/;
const ORIGINS = new Set(['left center', 'right center', 'center center', 'center top', 'center bottom', '50% 50%']);
export const CLIP = /^(inset\((-?\d+(\.\d+)?%\s*){4}\)|circle\(\d+(\.\d+)?% at \d+(\.\d+)?% \d+(\.\d+)?%\))$/;
export const PROPS: Record<string, [number, number]> = {
  x: [-400, 400],
  y: [-400, 400],
  xPercent: [-150, 150],
  yPercent: [-150, 150],
  scale: [0, 2],
  scaleX: [0, 2],
  scaleY: [0, 2],
  rotation: [-8, 8],
  opacity: [0, 1],
  blur: [0, 30],
};

function valueError(prop: string, value: unknown): string | null {
  if (prop === 'clip') return typeof value === 'string' && CLIP.test(value) ? null : `découpe invalide « ${String(value)} »`;
  if (prop === 'transformOrigin') return ORIGINS.has(String(value)) ? null : `origine invalide « ${String(value)} »`;
  const range = PROPS[prop];
  if (!range) return `propriété non permise « ${prop} »`;
  if (typeof value === 'string') return TOKEN.test(value) ? null : `valeur invalide « ${value} »`;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < range[0] || value > range[1]) return `${prop} hors bornes`;
  return null;
}

function stepsErrors(steps: unknown, target: (t: string) => boolean, counter: boolean): string[] {
  if (!Array.isArray(steps)) return ['liste de tweens attendue'];
  const errors: string[] = [];
  const timing = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && v >= lo && v <= hi) || (typeof v === 'string' && TOKEN.test(v));
  for (const step of steps as TweenStep[]) {
    if (!step || typeof step !== 'object') {
      errors.push('tween invalide');
      continue;
    }
    for (const k of Object.keys(step)) if (!['from', 'to', 'duration', 'ease', 'stagger', 'at', 'target', 'counter'].includes(k)) errors.push(`clé inconnue « ${k} »`);
    if (step.target !== undefined && !target(step.target)) errors.push(`cible invalide « ${step.target} »`);
    if (step.counter !== undefined && (step.counter !== true || !counter)) errors.push('compteur réservé aux chiffres');
    if (!step.counter && (!step.to || typeof step.to !== 'object')) errors.push('« to » manquant');
    for (const part of [step.from, step.to]) for (const [p, v] of Object.entries(part ?? {})) {
      const e = valueError(p, v);
      if (e) errors.push(e);
    }
    if (!timing(step.duration, 0, 6)) errors.push('durée invalide');
    if (step.ease !== undefined && !(EASE.test(step.ease) || TOKEN.test(step.ease))) errors.push(`courbe non permise « ${step.ease} »`);
    if (step.stagger !== undefined && !timing(step.stagger, 0, 0.5)) errors.push('décalage invalide');
    if (step.at !== undefined && !(typeof step.at === 'number' && step.at >= -2 && step.at <= 6)) errors.push('« at » invalide');
  }
  return errors;
}

const TOKEN_FORMS = [/^safe$/, /^media$/, /^logo$/, /^n$/, /^\/if$/, /^\/each$/, /^if (\w+)$/, /^ifnot (\w+)$/, /^each items$/, /^t\.[a-zA-Z]+$/, /^(ls|sq|st|po|tall):[\s\S]+$/];
export const htmlTokens = (html: string): string[] => [...html.matchAll(/\[\[([^\]]*(?:\[[^\]]*\][^\]]*)*)\]\]/g)].map((m) => m[1].trim());

/** Les défauts d'un nœud seul (les références se vérifient avec le catalogue entier : `refErrors`). */
export function nodeErrors(node: VideoNode): string[] {
  const errors: string[] = [];
  if (node.medium !== 'video') errors.push('medium « video » attendu');
  if (!node.doc?.title || !node.doc?.summary) errors.push('doc.title et doc.summary obligatoires');
  const e = node.energy;
  if (e !== undefined && !(Array.isArray(e) && e.length === 2 && e.every((x) => Number.isInteger(x) && x >= 1 && x <= 5) && e[0] <= e[1])) errors.push('énergie invalide');
  switch (node.kind) {
    case 'layout': {
      if (!node.html) errors.push('HTML manquant');
      if (!node.formats?.length || node.formats.some((f) => !FORMAT_IDS.includes(f))) errors.push('formats invalides');
      for (const [slot, def] of Object.entries(node.slots ?? {})) if (!SLOTS.has(slot) || !['required', 'optional'].includes(def?.need ?? '')) errors.push(`emplacement invalide « ${slot} »`);
      if (node.html) {
        if ((node.html.match(/\bdata-safe\b/g) ?? []).length !== 1) errors.push('une zone sûre (data-safe) exactement');
        for (const t of htmlTokens(node.html)) if (!TOKEN_FORMS.some((re) => re.test(t))) errors.push(`jeton inconnu [[${t}]]`);
        for (const [, v] of node.html.matchAll(/data-v="([^"]+)"/g)) if (!ANIM_ROLES.has(v)) errors.push(`rôle animable inconnu « ${v} »`);
      }
      break;
    }
    case 'theme': {
      const m = node.motion;
      const r = (v: unknown, lo: number, hi: number) => typeof v === 'number' && v >= lo && v <= hi;
      if (!['light', 'soft', 'brand', 'deep'].includes(node.ground)) errors.push('fond invalide');
      if (node.ground === 'deep' && node.requiresDark !== true) errors.push('un fond profond exige requiresDark');
      if (!m || !r(m.dIn, 0.2, 1.6) || !r(m.dOut, 0.15, 1) || !r(m.stagger, 0, 0.25) || !r(m.dist, 0, 120) || !r(m.drift ?? 0, 0, 0.08) || m.dOut > m.dIn) errors.push('mouvement hors bornes');
      for (const k of ['easeOut', 'easeIn', 'easeMove'] as const) if (!EASE.test(m?.[k] ?? '')) errors.push(`courbe ${k} non permise`);
      if (!node.classes || typeof node.classes !== 'object') errors.push('classes manquantes');
      break;
    }
    case 'animation': {
      if (!node.targets?.length || node.targets.some((t) => !TARGETS.has(t))) errors.push('cibles invalides');
      if (!['none', 'words', 'chars', 'lines'].includes(node.split ?? 'none')) errors.push('découpage invalide');
      if (!node.steps?.in?.length) errors.push('aucun tween d’entrée');
      for (const phase of ['in', 'out', 'hold'] as const) if (node.steps?.[phase]) errors.push(...stepsErrors(node.steps[phase], (t) => t === 'self' || t === 'inner', node.targets?.includes('figure')));
      break;
    }
    case 'transition': {
      if (!(typeof node.duration === 'number' && node.duration >= 0 && node.duration <= 1.6)) errors.push('durée invalide');
      const n = (node.overlays ?? []).length;
      for (const ov of node.overlays ?? []) if (!['primary', 'secondary', 'accent', 'ground', 'ink'].includes(ov?.color) || !['full', 'top', 'bottom', 'left', 'right', 'band'].includes(ov?.area)) errors.push('panneau invalide');
      const target = (t: string) => t === 'prev' || t === 'next' || (/^overlay:\d$/.test(t) && Number(t.slice(8)) < n);
      for (const phase of ['out', 'in'] as const) errors.push(...stepsErrors(node.steps?.[phase] ?? [], target, false));
      break;
    }
    case 'gabarit': {
      if (!node.config?.layout) errors.push('configuration manquante');
      for (const role of Object.keys(node.config?.animations ?? {})) if (!ANIM_ROLES.has(role)) errors.push(`rôle inconnu « ${role} »`);
      break;
    }
    default:
      errors.push('sorte inconnue');
  }
  return errors;
}

/** Les références d'un nœud vers le catalogue entier. */
export function refErrors(node: VideoNode, nodes: Map<string, VideoNode>): string[] {
  const kindOf = (id?: string) => (id ? nodes.get(id)?.kind : undefined);
  const errors: string[] = [];
  if (node.kind === 'theme') {
    for (const id of Object.values(node.defaults ?? {})) if (kindOf(id) !== 'animation') errors.push(`animation par défaut inconnue : ${id}`);
    for (const id of node.transitions ?? []) if (kindOf(id) !== 'transition') errors.push(`transition inconnue : ${id}`);
  }
  if (node.kind === 'gabarit') {
    const c = node.config;
    if (kindOf(c.layout) !== 'layout') errors.push(`mise en page inconnue : ${c.layout}`);
    if (c.transition && kindOf(c.transition) !== 'transition') errors.push(`transition inconnue : ${c.transition}`);
    for (const [role, id] of Object.entries(c.animations ?? {})) {
      const a = nodes.get(id as string);
      if (a?.kind !== 'animation') errors.push(`animation inconnue : ${id}`);
      else if (!a.targets.includes(ROLE_TARGET[role as AnimRole])) errors.push(`${id} ne s’applique pas au rôle ${role}`);
    }
  }
  return errors;
}
