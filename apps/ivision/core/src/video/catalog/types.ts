/**
 * LE CATALOGUE VIDÉO — ses nœuds et ses règles (les mêmes que `idem-templates/scripts/video-rules.mjs`, appliquées une
 * seconde fois au chargement : un nœud qui les enfreint est écarté et dit, jamais exécuté).
 *
 *   layout      une MISE EN PAGE de scène : HTML Tailwind à emplacements (`{{title}}`, `[[media]]`…), une zone sûre,
 *               responsive sur les quatre formats (unités `cqmin`, variantes `[[ls:…]]`) ;
 *   theme       la personnalité du FILM : durées, courbes, décalages, distances, traitement typographique et couleurs ;
 *   animation   l'entrée / la sortie / la tenue d'un rôle : des tweens DÉCLARATIFS (aucun JavaScript publié) ;
 *   transition  le passage d'une scène à la suivante : tweens de sortie, d'entrée, et panneaux de marque ;
 *   gabarit     une recette de scène : mise en page + animation par rôle + transition d'entrée ;
 *   develop     (22/11/2026) le DÉVELOPPEMENT d'une scène : ce qui se passe une fois tout posé (l'image se découvre,
 *               la liste s'accomplit, le problème se barre) — la scène évolue au lieu d'attendre la coupe ;
 *   sequence    (22/11/2026) 2 ou 3 scènes ENCHAÎNÉES : chacune a sa mise en page, et un élément (média, chiffre,
 *               logo) traverse la coupe — il glisse de sa place d'avant à sa place d'après (pas de diapositives).
 */

export type VideoNodeKind = 'layout' | 'theme' | 'animation' | 'transition' | 'gabarit' | 'develop' | 'sequence';
export type SceneRole = 'hook' | 'problem' | 'reveal' | 'feature' | 'benefits' | 'proof' | 'cta' | 'signature' | 'statement' | 'data';
export type VideoStyle = 'energetic' | 'premium' | 'playful' | 'corporate';
export type Slot = 'title' | 'body' | 'cta' | 'figure' | 'label' | 'attribution' | 'items' | 'media' | 'logo';
export type AnimRole = 'title' | 'body' | 'cta' | 'figure' | 'label' | 'attribution' | 'items' | 'item' | 'media' | 'logo' | 'rule' | 'mark' | 'bg';
export type AnimTarget = 'text' | 'block' | 'items' | 'figure' | 'logo' | 'cta' | 'media' | 'rule' | 'bg';
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
  /** La gamme (18/11/2026) : le cran qui sert ce nœud, du plus sobre au plus premium. Absent : tous les crans. */
  tier?: 'low' | 'medium' | 'high' | 'ultra';
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
  /** Décalage par rapport au DÉBUT du tween précédent (absent : à sa fin) ; un jeton (`$dIn*0.6`) est permis. */
  at?: TweenValue;
  /** Animation : `self` (défaut) ou `inner` (l'image dans son cadre) ; transition : `prev`, `next`, `overlay:N`. */
  target?: string;
  counter?: true;
  /** Un EFFET de texte nommé, implémenté par le runtime (jamais du code publié) : voir `TEXT_FX`. */
  fx?: TextFx;
  /** Les réglages bornés de l'effet (`TEXT_FX[fx].opts`). */
  opts?: Record<string, number>;
  /** Les unités visées d'un texte découpé : la première, la dernière, ou toutes sauf la dernière. */
  pick?: 'first' | 'last' | 'rest';
}

/**
 * LES EFFETS DE TEXTE (18/11/2026) — ce que des tweens de propriétés ne savent pas faire (frappe, décodage, surligneur,
 * contour, glitch, vague, soulignement, relief, rature, coupe en deux, balayage de lumière). Le catalogue les NOMME ;
 * le runtime les pose en GSAP (plugin `geFx`, rendu image par image, même quand HyperFrames coupe les événements),
 * de façon déterministe, avec les couleurs de la marque. `split` : le découpage qu'exige l'effet (`any` : tous).
 */
export type TextFx = 'type' | 'scramble' | 'sweep' | 'marker' | 'outline' | 'glitch' | 'wave' | 'underline' | 'extrude' | 'strike' | 'split';
export const TEXT_FX: Record<TextFx, { split: 'none' | 'words' | 'chars' | 'lines' | 'any'; opts: Record<string, [number, number]> }> = {
  type: { split: 'chars', opts: {} },
  scramble: { split: 'chars', opts: { window: [1, 8] } },
  sweep: { split: 'none', opts: {} },
  marker: { split: 'lines', opts: { height: [0.2, 1] } },
  outline: { split: 'none', opts: {} },
  glitch: { split: 'none', opts: { amp: [1, 14] } },
  wave: { split: 'chars', opts: { amp: [4, 40] } },
  underline: { split: 'any', opts: {} },
  extrude: { split: 'none', opts: { depth: [2, 10] } },
  strike: { split: 'any', opts: {} },
  split: { split: 'none', opts: { offset: [0.1, 1] } },
};
const PICKS = new Set(['first', 'last', 'rest']);

export interface AnimationNode extends BaseNode {
  kind: 'animation';
  targets: AnimTarget[];
  split: 'none' | 'words' | 'chars' | 'lines';
  mask?: boolean;
  maxChars?: number;
  /** Les seules scènes où l'animation a un sens (une rature : la scène « problème »). Absent : toutes. */
  sceneRoles?: SceneRole[];
  steps: { in: TweenStep[]; out?: TweenStep[]; hold?: TweenStep[] };
}

export interface TransitionNode extends BaseNode {
  kind: 'transition';
  duration: number;
  overlays: Array<{ color: 'primary' | 'secondary' | 'accent' | 'ground' | 'ink'; area: 'full' | 'top' | 'bottom' | 'left' | 'right' | 'band' }>;
  steps: { out: TweenStep[]; in: TweenStep[] };
}

/** Les éléments qui peuvent traverser une coupe (séquence). */
export type CarryRole = 'media' | 'figure' | 'logo';
export const CARRY_ROLES: CarryRole[] = ['media', 'figure', 'logo'];

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
  /** La séquence dont la scène fait partie, et son rang dans la séquence. */
  sequence?: string;
  step?: number;
  /** L'élément qui arrive de la scène d'avant SANS sortir ni rentrer : il glisse de sa place à la sienne. */
  carry?: CarryRole;
  /** Le développement choisi par une séquence (sinon, le code en pose un quand la scène a du temps libre). */
  develop?: string;
}

export interface GabaritNode extends BaseNode {
  kind: 'gabarit';
  roles: Array<SceneRole | '*'>;
  config: SceneConfig & { gabarit: string };
}

export interface DevelopNode extends BaseNode {
  kind: 'develop';
  /** Le rôle animable visé (titre, liste, média, chiffre, logo…). */
  role: AnimRole;
  /** `entered` : dès que son rôle est posé ; `read` : toute la scène posée et en partie lue. */
  start?: 'entered' | 'read';
  /** Le temps libre minimal (s) pour que le développement se voie : en dessous, la scène n'en reçoit pas. */
  minHold: number;
  split?: 'none' | 'words' | 'chars' | 'lines';
  sceneRoles?: SceneRole[];
  steps: TweenStep[];
}

export interface SequenceStep {
  roles: SceneRole[];
  layout: string;
  animations?: Partial<Record<AnimRole, string>>;
  carry?: CarryRole;
  develop?: string;
}

export interface SequenceNode extends BaseNode {
  kind: 'sequence';
  scenes: SequenceStep[];
}

export type VideoNode = LayoutNode | ThemeNode | AnimationNode | TransitionNode | GabaritNode | DevelopNode | SequenceNode;

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
export const ANIM_ROLES = new Set<string>(['title', 'body', 'cta', 'figure', 'label', 'attribution', 'items', 'item', 'media', 'logo', 'rule', 'mark', 'bg']);
const TARGETS = new Set<string>(['text', 'block', 'items', 'figure', 'logo', 'cta', 'media', 'rule', 'bg']);
/** La cible que porte chaque rôle : une animation ne s'applique qu'aux rôles de ses cibles. */
export const ROLE_TARGET: Record<AnimRole, AnimTarget> = { title: 'text', body: 'text', label: 'text', attribution: 'text', items: 'items', item: 'items', figure: 'figure', media: 'media', logo: 'logo', rule: 'rule', cta: 'cta', mark: 'block', bg: 'bg' };
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
  /** La 3D (bascule d'une lettre, d'un mot) : le runtime pose la perspective. */
  rotationX: [-100, 100],
  rotationY: [-100, 100],
  skewX: [-20, 20],
  opacity: [0, 1],
  blur: [0, 30],
  /** L'approche, en em, AJOUTÉE à celle du texte (0 : celle de la mise en page). */
  letterSpacing: [-0.2, 0.6],
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

function stepsErrors(steps: unknown, target: (t: string) => boolean, counter: boolean, fx?: { split: string }): string[] {
  if (!Array.isArray(steps)) return ['liste de tweens attendue'];
  const errors: string[] = [];
  const timing = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && v >= lo && v <= hi) || (typeof v === 'string' && TOKEN.test(v));
  for (const step of steps as TweenStep[]) {
    if (!step || typeof step !== 'object') {
      errors.push('tween invalide');
      continue;
    }
    for (const k of Object.keys(step)) if (!['from', 'to', 'duration', 'ease', 'stagger', 'at', 'target', 'counter', 'fx', 'opts', 'pick'].includes(k)) errors.push(`clé inconnue « ${k} »`);
    if (step.target !== undefined && !target(step.target)) errors.push(`cible invalide « ${step.target} »`);
    if (step.counter !== undefined && (step.counter !== true || !counter)) errors.push('compteur réservé aux chiffres');
    if (step.pick !== undefined && (!PICKS.has(step.pick) || !fx)) errors.push(`sélection invalide « ${String(step.pick)} »`);
    if (step.fx !== undefined) {
      const def = TEXT_FX[step.fx as TextFx];
      if (!def || !fx) errors.push(`effet inconnu ou réservé au texte « ${String(step.fx)} »`);
      else {
        if (def.split !== 'any' && def.split !== fx.split) errors.push(`l'effet ${step.fx} exige le découpage « ${def.split} »`);
        for (const [k, v] of Object.entries(step.opts ?? {})) {
          const r = def.opts[k];
          if (!r || typeof v !== 'number' || v < r[0] || v > r[1]) errors.push(`réglage ${step.fx}.${k} invalide`);
        }
      }
    } else if (step.opts !== undefined) errors.push('réglages sans effet');
    if (!step.counter && !step.fx && (!step.to || typeof step.to !== 'object')) errors.push('« to » manquant');
    for (const part of [step.from, step.to]) for (const [p, v] of Object.entries(part ?? {})) {
      const e = valueError(p, v);
      if (e) errors.push(e);
    }
    if (!timing(step.duration, 0, 6)) errors.push('durée invalide');
    if (step.ease !== undefined && !(EASE.test(step.ease) || TOKEN.test(step.ease))) errors.push(`courbe non permise « ${step.ease} »`);
    if (step.stagger !== undefined && !timing(step.stagger, 0, 0.5)) errors.push('décalage invalide');
    if (step.at !== undefined && !timing(step.at, -2, 6)) errors.push('« at » invalide');
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
      if (node.sceneRoles !== undefined && (!Array.isArray(node.sceneRoles) || node.sceneRoles.some((r) => !SCENE_ROLES.includes(r)))) errors.push('rôles de scène invalides');
      // Les effets et la sélection d'unités ne valent que pour une animation de TEXTE seul.
      const textOnly = node.targets?.length === 1 && node.targets[0] === 'text' ? { split: node.split ?? 'none' } : undefined;
      for (const phase of ['in', 'out', 'hold'] as const) if (node.steps?.[phase]) errors.push(...stepsErrors(node.steps[phase], (t) => t === 'self' || t === 'inner', node.targets?.includes('figure'), textOnly));
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
    case 'develop': {
      if (!ANIM_ROLES.has(node.role) || node.role === 'item' || node.role === 'bg') errors.push('rôle visé invalide');
      if (node.start !== undefined && node.start !== 'entered' && node.start !== 'read') errors.push('début invalide');
      if (!(typeof node.minHold === 'number' && node.minHold >= 0.6 && node.minHold <= 6)) errors.push('temps libre minimal invalide');
      if (!['none', 'words', 'chars', 'lines'].includes(node.split ?? 'none')) errors.push('découpage invalide');
      if (node.sceneRoles !== undefined && (!Array.isArray(node.sceneRoles) || node.sceneRoles.some((r) => !SCENE_ROLES.includes(r)))) errors.push('rôles de scène invalides');
      if (!node.steps?.length) errors.push('aucun tween');
      const text = ROLE_TARGET[node.role] === 'text' ? { split: node.split ?? 'none' } : undefined;
      errors.push(...stepsErrors(node.steps ?? [], (t) => t === 'self' || t === 'inner', false, text));
      break;
    }
    case 'sequence': {
      const scenes = node.scenes;
      if (!Array.isArray(scenes) || scenes.length < 2 || scenes.length > 3) errors.push('2 ou 3 scènes attendues');
      (scenes ?? []).forEach((s, i) => {
        if (!Array.isArray(s?.roles) || !s.roles.length || s.roles.some((r) => !SCENE_ROLES.includes(r))) errors.push(`scène ${i + 1} : rôles invalides`);
        if (typeof s?.layout !== 'string') errors.push(`scène ${i + 1} : mise en page manquante`);
        for (const role of Object.keys(s?.animations ?? {})) if (!ANIM_ROLES.has(role)) errors.push(`scène ${i + 1} : rôle inconnu « ${role} »`);
        if (s?.carry !== undefined && (!i || !CARRY_ROLES.includes(s.carry))) errors.push(`scène ${i + 1} : élément traversant invalide`);
      });
      if ((scenes ?? []).slice(1).every((s) => !s?.carry)) errors.push('aucun élément ne traverse la coupe');
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
  if (node.kind === 'sequence') {
    node.scenes.forEach((s, i) => {
      const layout = nodes.get(s.layout);
      if (layout?.kind !== 'layout') return errors.push(`scène ${i + 1} : mise en page inconnue ${s.layout}`);
      const has = (html: string | undefined, role: string) => new RegExp(`data-v="${role}"`).test(html ?? '');
      if (s.carry) {
        const prev = nodes.get(node.scenes[i - 1]?.layout);
        if (!has(layout.html, s.carry) || prev?.kind !== 'layout' || !has(prev.html, s.carry)) errors.push(`scène ${i + 1} : ${s.carry} absent d’un côté de la coupe`);
      }
      for (const [role, id] of Object.entries(s.animations ?? {})) {
        const a = nodes.get(id as string);
        if (a?.kind !== 'animation' || !a.targets.includes(ROLE_TARGET[role as AnimRole])) errors.push(`scène ${i + 1} : animation ${id} invalide pour ${role}`);
      }
      if (s.develop) {
        const d = nodes.get(s.develop);
        if (d?.kind !== 'develop' || !has(layout.html, d.role)) errors.push(`scène ${i + 1} : développement ${s.develop} invalide`);
      }
    });
  }
  return errors;
}
