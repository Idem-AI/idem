/**
 * L'ASSEMBLAGE D'UNE SCÈNE — par le CODE, à partir de sa configuration (mise en page, animations, transition) et du
 * thème du film. Aucun modèle, aucun mot réécrit : les textes restent des clés (`{{text.<clé>}}`, posés par
 * `fillScene` au rendu), si bien qu'une retouche de texte ne demande pas de réassembler.
 *
 * Sortie : le contrat de scène du rendu HyperFrames (`html` + `script`). Le script ne contient que des DONNÉES (la
 * chorégraphie résolue en nombres) passées au runtime `__ge` embarqué dans la composition (`runtime.ts`), qui découpe
 * les textes, les fait tenir, puis pose les tweens GSAP.
 *
 * La chorégraphie (bonnes pratiques du motion design, appliquées par le code) :
 *   · ordre de lecture : média, guillemet, sur-titre, chiffre, titre, filet, libellé, texte, signature, liste, action,
 *     logo — un seul élément entre à la fois au premier plan, les suivants se chevauchent légèrement ;
 *   · temps de lecture garanti : ≈ 15 signes par seconde, 0,9 s au moins une fois tout posé ; une scène trop courte
 *     resserre ses entrées (jusqu'à 45 %) plutôt que de couper la lecture ;
 *   · temps fort : le titre d'une scène énergique se cale sur le battement suivant de la musique ;
 *   · mouvement continu : l'image avance lentement, le titre dérive à peine (le plan ne se fige jamais) ;
 *   · sorties plus courtes que les entrées (≈ 75 %), jouées seulement avant une coupe dans un film posé.
 *
 * Depuis le 22/11/2026 (leçons de la revue d'OpenMotion : « une mise en page complète, une entrée, une pause, on
 * vide l'écran » est ce qui donne l'effet diaporama) :
 *   · DÉVELOPPEMENT : une scène qui a du temps libre après sa lecture ne fait plus qu'attendre — un nœud `develop`
 *     prend le relais de la tenue (l'image se découvre, la liste s'accomplit, le problème se barre) ;
 *   · TRAVERSÉE : dans une séquence, l'élément porté (`carry`) ne sort pas puis ne rentre pas : il glisse de sa
 *     place dans la scène d'avant à sa place dans celle-ci, mesurées dans la page (FLIP) ;
 *   · RÉPÉTITION RESSERRÉE : les éléments d'une liste arrivent de plus en plus vite (le premier installe la
 *     grammaire, les suivants s'y appuient) ;
 *   · MESURE : chaque scène dit son temps mort (le temps qui reste après les entrées, le développement et la
 *     lecture) — le code s'en sert pour choisir les développements, les contrôles pour le borner.
 */
import type { AnimationNode, AnimRole, CarryRole, DevelopNode, LayoutNode, LoadedVideoCatalog, PrimitiveNode, SceneConfig, ThemeNode, TransitionNode, TweenStep } from './types';
import { ROLE_TARGET } from './types';
import { animationFor, figureParts, isFigure, rolesIn, SceneSlots } from './graph';

/** L'ordre d'entrée des rôles. */
const ENTRANCE: AnimRole[] = ['bg', 'media', 'mark', 'figure', 'title', 'rule', 'label', 'body', 'attribution', 'items', 'cta', 'logo'];
/** Signes lus par seconde à l'écran (sous-titrage professionnel : 12 à 17) et temps minimal d'un texte posé. */
const READ_CPS = 15;
const READ_MIN = 0.9;

/** La zone sûre de chaque format (interfaces des réseaux : haut et surtout bas des formats verticaux). */
const SAFE: Record<'st' | 'po' | 'sq' | 'ls', { top: number; bottom: number; side: number }> = {
  st: { top: 12, bottom: 21, side: 7 },
  po: { top: 7, bottom: 9, side: 7 },
  sq: { top: 7, bottom: 7, side: 7 },
  ls: { top: 8, bottom: 9, side: 6 },
};
const variant = (f: 'st' | 'po' | 'sq' | 'ls', cls: string) => `group-data-[f=${f}]/f:${cls}`;

function safeClasses(): string {
  const base = SAFE.st;
  const out = ['absolute', `top-[${base.top}%]`, `bottom-[${base.bottom}%]`, `left-[${base.side}%]`, `right-[${base.side}%]`];
  for (const f of ['po', 'sq', 'ls'] as const) {
    const s = SAFE[f];
    out.push(variant(f, `top-[${s.top}%]`), variant(f, `bottom-[${s.bottom}%]`), variant(f, `left-[${s.side}%]`), variant(f, `right-[${s.side}%]`));
  }
  return out.join(' ');
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Les classes du thème, avec l'accent choisi (`vars.accent`). */
function themeClasses(theme: ThemeNode, vars: Record<string, string> = {}): Record<string, string> {
  const classes = { ...theme.classes };
  const accent = vars.accent;
  if (accent === 'accent' || accent === 'secondary') {
    for (const k of ['accentInk', 'rule', 'button', 'mark']) {
      if (!classes[k]) continue;
      classes[k] = accent === 'accent' ? classes[k].replace(/bg-brand-primary text-on-brand/g, 'bg-brand-accent text-on-accent').replace(/brand-primary/g, 'brand-accent') : k === 'button' ? classes[k] : classes[k].replace(/brand-primary/g, 'brand-secondary');
    }
  }
  return classes;
}

/** Garde, pour chaque élément, la DERNIÈRE classe de position d'une même variante (la mise en page déplace la zone sûre). */
function dedupePositions(html: string): string {
  return html.replace(/class="([^"]*)"/g, (_m, list: string) => {
    const tokens = list.split(/\s+/).filter(Boolean);
    const keyOf = (t: string): string | null => {
      const at = t.lastIndexOf(':', t.indexOf('[') >= 0 ? t.indexOf('[') : t.length);
      const v = at >= 0 && t.startsWith('group-data') ? t.slice(0, at + 1) : '';
      const prop = (v ? t.slice(v.length) : t).match(/^-?(top|bottom|left|right|inset-x|inset-y|h|w)-/)?.[1];
      return prop ? `${v}${prop}` : null;
    };
    const last = new Map<string, number>();
    tokens.forEach((t, i) => {
      const k = keyOf(t);
      if (k) last.set(k, i);
    });
    return `class="${tokens.filter((t, i) => {
      const k = keyOf(t);
      return !k || last.get(k) === i;
    }).join(' ')}"`;
  });
}

export interface AssembleInput {
  cat: LoadedVideoCatalog;
  theme: ThemeNode;
  config: SceneConfig;
  slots: SceneSlots;
  texts: Record<string, string>;
  scene: { key: string; duration: number; energy: number; role?: string; beat?: { bpm: number; first: number }; spoken?: Array<{ text: string; t: number }> };
  brand: { name: string; hasLogo: boolean; hasDarkLogo?: boolean };
  /** La transition par laquelle la scène entre, et la scène d'avant. */
  transitionIn?: TransitionNode;
  prevKey?: string;
  /** Les éléments sortent avant la fin (une coupe suit, dans un film posé). */
  exitAtEnd?: boolean;
  vars?: Record<string, string>;
  /** Les développements de la scène (résolus par le film : séquence, puis temps libre) — deux au plus, sur deux rôles. */
  develop?: DevelopNode | DevelopNode[];
  /** L'élément qui arrive de la scène d'avant en glissant (séquence), et l'échelle finale de son image là-bas. */
  carryIn?: { role: CarryRole; prevKey: string; innerFrom?: number };
  /** L'élément que la scène suivante reprend : il ne sort pas avant la coupe. */
  carryOut?: CarryRole;
}

/** Ce que l'assemblage mesure d'une scène (contrôles, choix des développements). */
export interface SceneQuality {
  /** Le temps libre (s) une fois tout entré et lu, avant tout développement. */
  free: number;
  /** Le temps mort (s) qui reste après le dernier mouvement utile (entrées, développement) et la lecture. */
  idle: number;
  develop?: string;
  /** Tous les développements posés (le premier est `develop`). */
  develops?: string[];
  carry?: CarryRole;
}

/** Le temps libre au-delà duquel une scène reçoit un développement, et le temps mort toléré au plus (contrôles). */
export const DEVELOP_FREE_MIN = 1.1;
export const IDLE_MAX = 2.2;

/** Le HTML de la scène : la mise en page dépliée (conditions, liste, emplacements, classes, zone sûre, formats). */
export function sceneHtml(layout: LayoutNode, theme: ThemeNode, slots: SceneSlots, brand: { name: string; hasLogo: boolean; hasDarkLogo?: boolean }, vars: Record<string, string> = {}): string {
  let html = layout.html;
  const present = (slot: string): boolean => {
    if (slot === 'items') return slots.items.length > 0;
    if (slot === 'media') return Boolean(slots.media);
    if (slot === 'logo') return Boolean(layout.slots.logo) && (brand.hasLogo || layout.slots.logo?.need === 'required');
    return Boolean((slots as unknown as Record<string, unknown>)[slot]);
  };
  // 1. Les conditions (de l'intérieur vers l'extérieur).
  for (let i = 0; i < 20; i++) {
    const next = html.replace(/\[\[(if|ifnot) (\w+)\]\]((?:(?!\[\[if(?:not)? )[\s\S])*?)\[\[\/if\]\]/g, (_m, op: string, slot: string, body: string) => ((op === 'if') === present(slot) ? body : ''));
    if (next === html) break;
    html = next;
  }
  // 2. La liste.
  html = html.replace(/\[\[each items\]\]([\s\S]*?)\[\[\/each\]\]/g, (_m, body: string) => slots.items.map((key, i) => body.replace(/\{\{\s*item\s*\}\}/g, `{{text.${key}}}`).replace(/\[\[n\]\]/g, String(i + 1).padStart(2, '0'))).join(''));
  // 3. Les emplacements → les clés de la scène.
  html = html.replace(/\{\{\s*(title|body|cta|figure|label|attribution)\s*\}\}/g, (_m, slot: string) => {
    const key = (slots as unknown as Record<string, string | undefined>)[slot];
    return key ? `{{text.${key}}}` : '';
  });
  // 4. Le média, le logo (le nom de la marque à défaut de logo).
  html = html.replace(/\[\[media\]\]/g, () =>
    !slots.media ? '' : slots.media.kind === 'video' ? `<video src="{{media.${slots.media.id}}}" muted playsinline data-ge-inner class="h-full w-full object-cover"></video>` : `<img src="{{media.${slots.media.id}}}" alt="" data-ge-inner class="h-full w-full object-cover">`
  );
  // Sur un fond de couleur ou profond, le logo pour fond clair se perdrait : sa déclinaison « fond sombre », sinon une
  // pastille claire qui le porte.
  const deepGround = theme.ground === 'brand' || theme.ground === 'deep';
  html = html.replace(/\[\[logo\]\]/g, () =>
    !brand.hasLogo
      ? `<span data-ge-inner class="block whitespace-nowrap font-display text-[7cqmin] font-bold leading-[1] [[t.ink]]">${escapeHtml(brand.name)}</span>`
      : deepGround && brand.hasDarkLogo
        ? '<img src="{{logoDark}}" alt="" data-ge-inner class="h-full w-auto max-w-full object-contain">'
        : deepGround
          ? '<span data-ge-inner class="inline-flex h-full items-center rounded-[1.4cqmin] bg-ground px-[2.2cqmin] py-[1cqmin]"><img src="{{logo}}" alt="" class="h-full w-auto max-w-full object-contain"></span>'
          : '<img src="{{logo}}" alt="" data-ge-inner data-ge-logo class="h-full w-auto max-w-full object-contain">'
  );
  // 5. Les classes du thème, la zone sûre, les variantes de format.
  const classes = themeClasses(theme, vars);
  html = html.replace(/\[\[t\.([a-zA-Z]+)\]\]/g, (_m, k: string) => classes[k] ?? '');
  html = html.replace(/\[\[safe\]\]/g, safeClasses());
  html = html.replace(/\[\[(ls|sq|st|po|tall):([^\]]*(?:\[[^\]]*\][^\]]*)*)\]\]/g, (_m, f: string, list: string) =>
    list
      .split(/\s+/)
      .filter(Boolean)
      .flatMap((cls) => (f === 'tall' ? [variant('st', cls), variant('po', cls)] : [variant(f as 'st', cls)]))
      .join(' ')
  );
  // `st` (story) est aussi la base : ses variantes valent pour la story seule.
  // 6. Une position déplacée par la mise en page remplace celle de la zone sûre (même variante).
  html = dedupePositions(html);
  // 7. L'échelle typographique du thème (titres et chiffres seulement).
  const scale = theme.type?.scale ?? 1;
  if (scale !== 1) html = html.replace(/data-fit="(title|figure)" data-fk="([\d.]+)"/g, (_m, r: string, k: string) => `data-fit="${r}" data-fk="${(Number(k) * scale).toFixed(4)}"`);
  // Le fond animé (si le thème en porte un) : un calque décoratif, derrière tout, jamais lu par les textes.
  const bg = classes.bgLayer ? `<div data-v="bg" aria-hidden="true" class="pointer-events-none absolute inset-0 -z-10 ${classes.bgLayer}"></div>` : '';
  // La CAMÉRA (22/11/2026) : tout le contenu de la scène dans une enveloppe que le directeur de caméra du runtime peut
  // cadrer (gros plan sur ce qui arrive, retour au plan large) ; le cadre extérieur coupe ce qui déborde.
  return `<div class="relative h-full w-full overflow-hidden ${classes.ground ?? 'bg-ground'}"><div data-ge-camera class="absolute inset-0">${bg}${html.replace(/\s{2,}/g, ' ').trim()}</div></div>`;
}

// ── La chorégraphie ──────────────────────────────────────────────────────────────────────────

interface ResolvedStep {
  target?: string;
  from?: Record<string, number | string>;
  to?: Record<string, number | string>;
  duration: number;
  ease: string;
  stagger?: number;
  at?: number;
  counter?: true;
  fx?: string;
  opts?: Record<string, number>;
  pick?: 'first' | 'last' | 'rest';
  /** Les décalages se resserrent d'une unité à l'autre (répétition : le premier installe, les suivants enchaînent). */
  compress?: true;
}

export interface RuntimeRole {
  role: AnimRole;
  sel: string;
  split: 'none' | 'words' | 'chars' | 'lines';
  mask: boolean;
  at: number;
  in: ResolvedStep[];
  hold?: ResolvedStep[];
  holdAt?: number;
  develop?: ResolvedStep[];
  developAt?: number;
  out?: ResolvedStep[];
  outAt?: number;
  /** Les instants (s, depuis le début de la scène) où chaque élément d'une liste entre : quand la voix le dit. */
  cues?: number[];
}

export interface RuntimeCarry {
  role: CarryRole;
  sel: string;
  prevKey: string;
  /** `frame` : un cadre d'image (ses côtés changent, l'image garde ses proportions) ; `uniform` : un chiffre, un logo. */
  mode: 'frame' | 'uniform';
  duration: number;
  ease: string;
  innerFrom?: number;
}

export interface RuntimeScene {
  key: string;
  roles: RuntimeRole[];
  transition?: { prevKey: string; half: number; overlays: TransitionNode['overlays']; out: ResolvedStep[]; in: ResolvedStep[] };
  carry?: RuntimeCarry;
  /**
   * Les temps forts VISUELS de la scène (s, depuis son début) : là où l'action principale se pose (`settle` : le chiffre
   * ou le titre arrivé) et où un trait se dessine (`mark` : soulignement, rature). Le son s'y cale — sur la perception
   * du mouvement, pas sur son départ. Ignoré par le runtime.
   */
  accents?: Array<{ t: number; kind: 'settle' | 'mark' }>;
  /**
   * Le DIRECTEUR DE CAMÉRA (adapté d'explainroo, MIT) : les temps de la scène — quand chaque rôle (ou chaque élément
   * d'une liste) paraît — que le runtime cadre après mesure ; `end` : l'instant où la caméra doit être revenue au plan
   * large ; `max` : le zoom le plus serré permis.
   */
  camera?: { beats: Array<{ role: AnimRole; t: number; item?: number }>; end: number; max: number };
  /** Le composant du registre HyperFrames monté dans la zone `data-ge-prim-host` : ses variables, son départ, sa durée. */
  primitive?: { id: string; vars: Record<string, string | number | boolean>; at: number; duration: number; slot?: { template?: string; selector?: string } };
  /** Le logo (SVG posé dans la page) se dessine trait par trait au lieu d'entrer comme une image. */
  logoDraw?: boolean;
}

type Tokens = Record<string, number | string>;

function resolveValue(v: number | string | undefined, t: Tokens): number | string | undefined {
  if (typeof v !== 'string') return v;
  const m = v.match(/^(-?)\$(\w+)(?:\*([\d.]+))?$/);
  if (!m) return v;
  const base = t[m[2]];
  if (typeof base === 'string') return base;
  if (typeof base !== 'number') return 0;
  const n = base * (m[3] ? Number(m[3]) : 1) * (m[1] ? -1 : 1);
  return Math.round(n * 1000) / 1000;
}

function resolveSteps(steps: TweenStep[] | undefined, t: Tokens): ResolvedStep[] {
  return (steps ?? []).map((s) => {
    const props = (o?: Record<string, number | string>) => (o ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, resolveValue(v, t) as number | string])) : undefined);
    const out: ResolvedStep = { duration: Math.max(0.05, Number(resolveValue(s.duration, t)) || 0.3), ease: String(resolveValue(s.ease ?? 'none', t)) };
    if (s.target) out.target = s.target;
    if (s.from) out.from = props(s.from);
    if (s.to) out.to = props(s.to);
    if (s.stagger !== undefined) out.stagger = Math.max(0, Number(resolveValue(s.stagger, t)) || 0);
    if (s.at !== undefined) out.at = Number(resolveValue(s.at, t)) || 0;
    if (s.counter) out.counter = true;
    if (s.fx) out.fx = s.fx;
    if (s.opts) out.opts = { ...s.opts };
    if (s.pick) out.pick = s.pick;
    return out;
  });
}

/** Un mot ramené à sa forme de comparaison (minuscules, sans accents ni ponctuation) ; vide pour un mot vide. */
const STOP = new Set(['les', 'des', 'une', 'pour', 'dans', 'avec', 'sans', 'sur', 'par', 'est', 'sont', 'vous', 'nous', 'votre', 'vos', 'notre', 'nos', 'qui', 'que', 'quoi', 'mais', 'plus', 'aux', 'ces', 'ses', 'son', 'sa', 'leur', 'the', 'and', 'for', 'with', 'your', 'our', 'you', 'are', 'from', 'that', 'this', 'into', 'not', 'all']);
function wordKey(w: string): string {
  const k = String(w || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]+/gu, '');
  return k.length >= 3 && !STOP.has(k) ? k : '';
}

/**
 * L'instant où la voix dit, pour la première fois après `from`, un mot porteur de ce texte (sa racine : les cinq
 * premières lettres, pour qu'« intrants » réponde à « intrant »). `undefined` : la voix ne le dit pas.
 */
export function cueOf(text: string, spoken: Array<{ key: string; t: number }>, from = 0): number | undefined {
  const stems = new Set(String(text || '').split(/\s+/).map(wordKey).filter(Boolean).map((k) => k.slice(0, 5)));
  if (!stems.size) return undefined;
  return spoken.find((w) => w.t >= from && stems.has(w.key.slice(0, 5)))?.t;
}

/** L'échelle finale de l'image intérieure après une suite de tweens (le dernier `scale` visé sur `inner`). */
function innerScaleAfter(steps: ResolvedStep[] | undefined): number | undefined {
  let last: number | undefined;
  for (const s of steps ?? []) if (s.target === 'inner' && typeof s.to?.scale === 'number') last = s.to.scale;
  return last;
}

/** La durée d'une suite de tweens sur `n` cibles (décalages compris). */
function stepsSpan(steps: ResolvedStep[], n: number): number {
  let prevStart = 0;
  let end = 0;
  for (const s of steps) {
    const at = s.at !== undefined ? prevStart + s.at : end;
    // Un effet répartit lui-même ses unités dans sa durée ; une sélection n'en vise qu'une (ou toutes moins une).
    const units = s.fx ? 1 : s.pick === 'rest' ? n - 1 : s.pick ? 1 : n;
    end = Math.max(end, at + s.duration + (s.stagger ?? 0) * Math.max(0, units - 1));
    prevStart = at;
  }
  return end;
}

/** Les unités animées d'un rôle (mots, lettres, lignes, éléments) : une estimation pour le temps. */
function unitsOf(role: AnimRole, split: string, text: string, items: number): number {
  if (role === 'items') return Math.max(1, items);
  if (split === 'words') return Math.max(1, text.split(/\s+/).filter(Boolean).length);
  if (split === 'chars') return Math.max(1, text.replace(/\s/g, '').length);
  if (split === 'lines') return Math.max(1, Math.ceil(text.length / 22));
  return 1;
}

/** La scène entière : HTML et script (données de la chorégraphie pour le runtime `__ge`), et ce qu'elle mesure. */
export function assembleScene(i: AssembleInput): { html: string; script: string; spec: RuntimeScene; quality: SceneQuality } {
  const layout = (i.cat.nodes.get(i.config.layout) ?? i.cat.nodes.get('builtin.stack')) as LayoutNode;
  const prim = (layout as unknown as PrimitiveNode).kind === 'primitive' ? (layout as unknown as PrimitiveNode) : undefined;
  let html = sceneHtml(layout, i.theme, i.slots, i.brand, { ...(i.vars ?? {}), ...(i.config.vars ?? {}) });
  // Une PRIMITIVE : son source (registre HyperFrames, empreinte vérifiée au chargement) voyage, inerte, dans un
  // <template> de la scène ; l'image de son écran aussi (posée par le code depuis le média de la scène).
  if (prim) {
    html += `<template data-ge-prim="${prim.id}">${prim.primitive.component}</template>`;
    if (prim.primitive.slot && i.slots.media) {
      const m = i.slots.media;
      const media = m.kind === 'video' ? `<video src="{{media.${m.id}}}" muted playsinline style="width:100%;height:100%;object-fit:cover"></video>` : `<img src="{{media.${m.id}}}" alt="" style="width:100%;height:100%;object-fit:cover">`;
      html += `<template data-ge-prim-slot>${media}</template>`;
    }
  }
  const m = i.theme.motion;
  const pace = Math.min(1.25, Math.max(0.8, i.config.params?.pace ?? 1));
  const D = i.scene.duration;
  const textOf = (role: AnimRole): string => {
    const key = role === 'items' ? undefined : (i.slots as unknown as Record<string, string | undefined>)[role];
    return key ? i.texts[key] ?? '' : role === 'items' ? i.slots.items.map((k) => i.texts[k] ?? '').join(' ') : '';
  };
  const present: AnimRole[] = rolesIn(html).filter((r) => r !== 'item');
  // L'élément porté depuis la scène d'avant n'entre pas : il est déjà là (il glisse vers sa place).
  const carried = i.carryIn && present.includes(i.carryIn.role) ? i.carryIn.role : undefined;
  const ordered = ENTRANCE.filter((r) => present.includes(r) && r !== carried);
  // Les éléments d'une liste : ceux marqués un à un (`data-v="item"`), sinon les enfants du bloc de la liste — sans
  // cela, une liste sans marque restait immobile.
  const itemSel = /data-v="item"/.test(html) ? '[data-v="item"]' : '[data-v="items"] > *';
  /** L'animation de chaque rôle ; un compteur ne compte qu'UN nombre (« 30–40 % » se pose sans compter). */
  const animOf = (role: AnimRole): AnimationNode => {
    const counts = (id: string) => (i.cat.nodes.get(id) as AnimationNode).steps.in.some((s) => s.counter);
    let id = animationFor(i.cat, i.theme, i.config, role, textOf(role), i.scene.role);
    if (counts(id) && !isFigure(textOf(role))) id = i.cat.nodes.get('anim.scale-in')?.kind === 'animation' ? 'anim.scale-in' : 'builtin.rise';
    return i.cat.nodes.get(id) as AnimationNode;
  };

  const build = (factor: number) => {
    const tokens: Tokens = { dIn: (m.dIn / pace) * factor, dOut: m.dOut / pace, stagger: (m.stagger / pace) * factor, dist: m.dist, easeOut: m.easeOut, easeIn: m.easeIn, easeMove: m.easeMove, hold: 0 };
    const half = i.transitionIn && i.transitionIn.duration > 0 ? i.transitionIn.duration / 2 : 0;
    // Sous un panneau de transition, les entrées attendent qu'il s'ouvre ; sinon elles accompagnent l'entrée. Quand un
    // élément glisse depuis la scène d'avant, les autres arrivent pendant son mouvement, un peu après son départ.
    let t = half ? half * (i.transitionIn!.overlays.length ? 0.85 : 0.5) : carried ? 0.22 : 0.12;
    const roles: RuntimeRole[] = [];
    for (const role of ordered) {
      const anim = animOf(role);
      const split = ROLE_TARGET[role] === 'text' ? anim.split ?? 'none' : 'none';
      const steps = resolveSteps(anim.steps.in, tokens);
      const units = unitsOf(role, split, textOf(role), i.slots.items.length);
      // Une liste de trois éléments ou plus : les décalages se resserrent d'un élément à l'autre.
      if (role === 'items' && units >= 3) for (const s of steps) if (s.stagger) s.compress = true;
      // Le fond entre tout de suite, sous le panneau de transition s'il y en a un : il ne retarde aucun autre rôle.
      const at = role === 'bg' ? 0 : role === 'media' ? Math.max(0, t - 0.12) : t;
      const entry: RuntimeRole = { role, sel: role === 'items' ? itemSel : `[data-v="${role}"]`, split, mask: Boolean(anim.mask) && split !== 'none', at, in: steps };
      if (anim.steps.out?.length) entry.out = resolveSteps(anim.steps.out, tokens);
      roles.push(entry);
      const span = stepsSpan(steps, units);
      // Le suivant entre quand celui-ci est aux deux tiers de son mouvement principal (chevauchement léger).
      if (role !== 'bg') t = role === 'media' ? t + 0.12 : role === 'rule' || role === 'mark' ? t + Math.min(span, tokens.dIn as number) * 0.3 : t + Math.max(0.12, Math.min(span * 0.62, (tokens.dIn as number) * 0.7));
    }
    // L'élément porté : aucune entrée (il est déjà à l'écran), mais sa tenue et son développement comme les autres.
    if (carried) {
      const anim = animOf(carried);
      roles.unshift({ role: carried, sel: `[data-v="${carried}"]`, split: 'none', mask: false, at: 0, in: [], ...(anim.steps.out?.length ? { out: resolveSteps(anim.steps.out, tokens) } : {}) });
    }
    const ends = roles.map((r) => r.at + stepsSpan(r.in, unitsOf(r.role, r.split, textOf(r.role), i.slots.items.length)));
    return { roles, end: Math.max(0, ...ends), tokens };
  };

  // Le temps de lecture : tout posé, il reste au moins ce qu'il faut pour lire. Sinon les entrées se resserrent.
  const chars = ordered.reduce((n, r) => n + textOf(r).length, 0);
  const read = Math.max(READ_MIN, chars / READ_CPS);
  const exitSpan = i.exitAtEnd ? m.dOut : 0;
  let pass = build(1);
  if (pass.end + read + exitSpan > D) pass = build(Math.max(0.45, Math.min(1, (D - read - exitSpan) / Math.max(0.1, pass.end))));
  const roles = pass.roles;

  // LA VOIX D'ABORD (22/11/2026, leçon d'explainroo et de Hypit : les entrées s'ancrent sur des MOTS, pas sur des
  // secondes). Le titre, le chiffre et le soutien entrent quand la voix dit leur premier mot porteur ; chaque élément
  // d'une liste, quand elle le cite. Jamais plus tôt que prévu, jamais au point de rogner le temps de lecture.
  const spoken = (i.scene.spoken ?? []).map((w) => ({ key: wordKey(w.text), t: w.t })).filter((w) => w.key);
  if (spoken.length) {
    const lead = 0.12;
    // La voix lit le texte en même temps qu'il paraît : il suffit d'une courte tenue après la dernière entrée.
    const latest = D - exitSpan - Math.min(read, 1) - 0.2;
    // Chaque texte entre sur SON mot, indépendamment des autres (un libellé dit avant le titre entre avant lui) ; les
    // éléments décoratifs (filet, marque, fond) gardent leur place.
    let from = 0;
    for (const role of ['figure', 'label', 'title', 'body', 'attribution', 'cta'] as AnimRole[]) {
      const r = roles.find((x) => x.role === role && x.in.length);
      const t = r ? cueOf(textOf(role), spoken) : undefined;
      if (!r || t === undefined) continue;
      from = Math.max(from, t);
      const at = Math.min(t - lead, latest);
      if (at - r.at > 0.05) r.at = Math.round(at * 1000) / 1000;
    }
    const items = roles.find((x) => x.role === 'items' && x.in.length);
    if (items && i.slots.items.length >= 2) {
      let after = Math.max(from, 0);
      const cues: number[] = [];
      for (const key of i.slots.items) {
        const t = cueOf(i.texts[key] ?? '', spoken, after);
        if (t === undefined) break;
        cues.push(Math.round(Math.max(items.at, Math.min(t - lead, latest)) * 1000) / 1000);
        after = t;
      }
      // Tous les éléments cités, dans l'ordre et à des instants distincts : chacun entre à son mot (sinon le décalage
      // resserré garde la main).
      if (cues.length === i.slots.items.length && cues.every((c, k) => !k || c > cues[k - 1] + 0.15)) items.cues = cues;
    }
  }

  // Le temps fort : le titre d'une scène énergique se pose sur le battement suivant (au plus 0,3 s plus tard).
  if (i.scene.beat && i.scene.beat.bpm > 0 && i.scene.energy >= 3) {
    const title = roles.find((r) => r.role === 'title');
    if (title) {
      const period = 60 / i.scene.beat.bpm;
      const k = Math.ceil((title.at - i.scene.beat.first) / period);
      const beat = i.scene.beat.first + k * period;
      const delta = beat - title.at;
      if (delta > 0 && delta <= 0.3) for (const r of roles) if (r.at >= title.at) r.at = Math.round((r.at + delta) * 1000) / 1000;
    }
  }

  // Le mouvement continu : la tenue du média (zoom lent) et une dérive à peine visible du titre.
  const drift = m.drift ?? 0;
  // La traversée : l'élément porté n'appartient qu'à elle tant qu'elle dure (sa tenue, son développement attendent).
  const carryDur = carried ? Math.round(Math.min(0.95, Math.max(0.5, D * 0.2)) * 1000) / 1000 : 0;
  const enteredOf = (r: RuntimeRole) => (r.role === carried ? carryDur : r.cues?.length ? r.cues[r.cues.length - 1] + stepsSpan(r.in, 1) : r.at + stepsSpan(r.in, unitsOf(r.role, r.split, textOf(r.role), i.slots.items.length)));
  // Le DÉVELOPPEMENT : sur son rôle, une fois posé (`entered`) ou une fois la scène posée et en partie lue (`read`) ;
  // il remplace la tenue de ce rôle. Trop peu de temps : la scène n'en reçoit pas (jamais de mouvement écrasé).
  const allIn = Math.max(0, ...roles.filter((r) => r.role !== 'bg').map(enteredOf));
  const freeTime = D - allIn - read - exitSpan;
  const wanted = (Array.isArray(i.develop) ? i.develop : i.develop ? [i.develop] : []).filter((d) => d?.kind === 'develop' && (!d.sceneRoles?.length || d.sceneRoles.includes(i.scene.role as never)));
  let developEnd = 0;
  // Un effet court (soulignement, rature, liste qui s'accomplit) tombe quand la lecture s'achève : il relance la scène
  // au moment où elle se serait figée. Un second effet court vient après le premier.
  let cursor = allIn + read * 0.95;
  const placed: string[] = [];
  const unitsFor = (r: RuntimeRole) => unitsOf(r.role, r.split, textOf(r.role), i.slots.items.length);
  for (const dev of wanted.slice(0, 2)) {
    const devRole = roles.find((r) => r.role === dev.role);
    if (!devRole || devRole.develop) continue;
    let start = dev.start === 'entered' ? enteredOf(devRole) : Math.max(cursor, allIn + 0.3);
    let span = D - start - exitSpan - 0.08;
    // Le même effet déjà joué à l'entrée (un titre souligné qui se soulignerait encore) : pas de développement.
    const repeats = dev.steps.some((s) => s.fx && devRole.in.some((x) => x.fx === s.fx));
    if (span < Math.max(0.6, dev.minHold * 0.6) || repeats) continue;
    let steps = resolveSteps(dev.steps, { ...pass.tokens, hold: Math.round(span * 1000) / 1000 });
    // Un effet court dans une longue tenue : placé au milieu du temps qui reste après la lecture, il coupe l'attente
    // en deux (au lieu de tomber pendant la lecture et de laisser la fin figée).
    if (dev.start !== 'entered') {
      const from = Math.max(start, allIn + read);
      const slack = D - exitSpan - from - stepsSpan(steps, unitsFor(devRole));
      if (slack > 1) {
        start = from + (slack - 1) * 0.5;
        span = D - start - exitSpan - 0.08;
        steps = resolveSteps(dev.steps, { ...pass.tokens, hold: Math.round(span * 1000) / 1000 });
      }
    }
    devRole.develop = steps;
    devRole.developAt = Math.round(start * 1000) / 1000;
    const end = start + stepsSpan(devRole.develop, unitsFor(devRole));
    developEnd = Math.max(developEnd, end);
    if (dev.start !== 'entered') cursor = end + 0.25;
    placed.push(dev.id);
  }
  for (const r of roles) {
    const enteredAt = enteredOf(r);
    const remaining = Math.max(0.5, D - enteredAt - (i.exitAtEnd ? m.dOut : 0));
    // Le développement tient lieu de tenue pour son rôle.
    if (r.develop) {
      if (i.exitAtEnd && r.out?.length && i.carryOut !== r.role) r.outAt = Math.max(enteredAt, Math.round((D - m.dOut - 0.06) * 1000) / 1000);
      else delete r.out;
      continue;
    }
    const holdSteps = animOf(r.role).steps.hold;
    if (holdSteps?.length) {
      r.hold = resolveSteps(holdSteps, { ...pass.tokens, hold: Math.round(remaining * 1000) / 1000 });
      r.holdAt = Math.round(enteredAt * 1000) / 1000;
    } else if (drift > 0 && (r.role === 'title' || r.role === 'media') && !r.in.some((s) => s.from && 'scale' in s.from) && r.split === 'none') {
      // L'image avance lentement (zoom) ; le titre MONTE de quelques pixels (une échelle, même de 1 %, ferait sortir de
      // la zone sûre un titre qui en occupe toute la largeur ; la montée tient dans la marge de respiration).
      r.hold =
        r.role === 'media'
          ? [{ target: 'inner', from: { scale: 1 }, to: { scale: Math.round((1 + drift * 1.6) * 1000) / 1000 }, duration: Math.round(remaining * 1000) / 1000, ease: 'none' }]
          : [{ from: { y: 0 }, to: { y: -Math.round(m.dist * 0.12) }, duration: Math.round(remaining * 1000) / 1000, ease: 'none' }];
      r.holdAt = Math.round(enteredAt * 1000) / 1000;
    }
    // L'élément que la scène suivante reprend ne sort jamais : il glisse vers elle à la coupe.
    if (i.exitAtEnd && r.out?.length && i.carryOut !== r.role) {
      const idx = roles.length - 1 - roles.indexOf(r);
      r.outAt = Math.max(enteredAt, Math.round((D - m.dOut - 0.06 - idx * 0.04) * 1000) / 1000);
    } else delete r.out;
  }

  const spec: RuntimeScene = { key: i.scene.key, roles };
  if (prim) {
    const text = (slot: string) => {
      const key = (i.slots as unknown as Record<string, string | undefined>)[slot];
      return key ? i.texts[key] ?? '' : '';
    };
    const fig = figureParts(text('figure'));
    const vars: Record<string, string | number | boolean> = { ...(prim.primitive.fixed ?? {}) };
    for (const [name, rule] of Object.entries(prim.primitive.bind ?? {})) {
      if (rule.startsWith('const:')) vars[name] = Number.isFinite(Number(rule.slice(6))) && rule.slice(6).trim() !== '' ? Number(rule.slice(6)) : rule.slice(6);
      else if (rule === 'figure.value') vars[name] = fig?.value ?? 0;
      else if (rule === 'figure.prefix') vars[name] = fig?.prefix ?? '';
      else if (rule === 'figure.suffix') vars[name] = fig?.suffix ?? '';
      else if (rule === 'figure.percent') vars[name] = fig?.percent ? fig.value : 0;
      else if (rule === 'brand.name') vars[name] = i.brand.name;
      else vars[name] = text(rule);
    }
    const at = Math.round(Math.max(0.12, i.transitionIn && i.transitionIn.duration > 0 ? i.transitionIn.duration / 2 : 0.12) * 1000) / 1000;
    spec.primitive = { id: prim.id, vars, at, duration: Math.round(Math.max(0.5, D - at - exitSpan) * 1000) / 1000, ...(prim.primitive.slot ? { slot: prim.primitive.slot } : {}) };
  }
  // La traversée remplace la transition : le cut, sans panneau, et l'élément qui glisse (mesuré dans la page).
  if (carried && i.carryIn) {
    spec.carry = {
      role: carried,
      sel: `[data-v="${carried}"]`,
      prevKey: i.carryIn.prevKey,
      mode: carried === 'media' ? 'frame' : 'uniform',
      duration: carryDur,
      ease: m.easeMove,
      ...(i.carryIn.innerFrom && i.carryIn.innerFrom !== 1 ? { innerFrom: i.carryIn.innerFrom } : {}),
    };
  } else if (i.transitionIn && i.transitionIn.duration > 0 && i.prevKey) {
    const half = i.transitionIn.duration / 2;
    const t: Tokens = { half, d: i.transitionIn.duration };
    spec.transition = { prevKey: i.prevKey, half, overlays: i.transitionIn.overlays, out: resolveSteps(i.transitionIn.steps.out, t), in: resolveSteps(i.transitionIn.steps.in, t) };
  }
  // La caméra : une scène assez longue, dont les éléments paraissent à des instants distincts (souvent sur la voix),
  // peut recevoir des gros plans — le runtime vérifie, mesures à l'appui, qu'aucun autre élément n'est coupé.
  if (process.env.VIDEO_CAMERA !== 'off' && D >= 3.6 && !carried) {
    const FOCUS: AnimRole[] = ['figure', 'title', 'label', 'body', 'items', 'media', 'logo', 'cta', 'attribution'];
    const beats: NonNullable<RuntimeScene['camera']>['beats'] = [];
    for (const r of roles) {
      if (!FOCUS.includes(r.role) || !r.in.length) continue;
      if (r.role === 'items' && r.cues?.length) r.cues.forEach((t, item) => beats.push({ role: 'items', t, item }));
      else beats.push({ role: r.role, t: r.at });
    }
    beats.sort((a, b) => a.t - b.t);
    if (beats.length >= 2) spec.camera = { beats, end: Math.round((D - exitSpan - 0.35) * 1000) / 1000, max: i.scene.energy >= 4 ? 1.8 : 1.6 };
  }

  // La signature dessinée : dans une scène de fin, le logo (s'il est un SVG, posé dans la page) se trace puis se remplit.
  if ((i.scene.role === 'signature' || i.scene.role === 'cta') && roles.some((r) => r.role === 'logo' && r.in.length) && process.env.VIDEO_LOGO_DRAW !== 'off') spec.logoDraw = true;

  // Les temps forts visuels : le rôle principal posé (chiffre, sinon titre), les traits qui se dessinent.
  const lead = roles.find((r) => r.role === 'figure' && r.in.length) ?? roles.find((r) => r.role === 'title' && r.in.length);
  const accents: NonNullable<RuntimeScene['accents']> = [];
  if (lead) accents.push({ t: Math.round(enteredOf(lead) * 1000) / 1000, kind: 'settle' });
  for (const r of roles) if (r.develop?.some((s) => s.fx === 'underline' || s.fx === 'strike') && r.developAt !== undefined) accents.push({ t: r.developAt, kind: 'mark' });
  if (accents.length) spec.accents = accents.filter((a) => a.t > 0.05 && a.t < D - 0.1);
  // Le temps mort : ce qui reste une fois tout entré, développé et lu. Les tenues (zoom lent, dérive) n'en
  // retranchent rien — ce sont elles, justement, qui donnaient l'effet d'attente.
  const lastMotion = Math.max(allIn + read, developEnd);
  const quality: SceneQuality = {
    free: Math.round(freeTime * 100) / 100,
    idle: Math.round(Math.max(0, D - lastMotion - exitSpan) * 100) / 100,
    ...(placed.length ? { develop: placed[0], develops: placed } : {}),
    ...(spec.carry ? { carry: spec.carry.role } : {}),
  };
  const json = JSON.stringify(spec).replace(/</g, '\\u003c');
  return { html, script: `__ge.scene(tl, root, D, ${json});`, spec, quality };
}

/** L'échelle finale de l'image d'une scène assemblée (ce que la scène suivante reprend en glissant). */
export function finalInnerScale(spec: RuntimeScene, role: CarryRole): number | undefined {
  const r = spec.roles.find((x) => x.role === role);
  return innerScaleAfter(r?.develop) ?? innerScaleAfter(r?.hold);
}

/** Une scène est-elle faite par le catalogue (son script n'est que des données pour le runtime) ? */
export const isCatalogScript = (script?: string): boolean => Boolean(script && /^__ge\.scene\(tl, root, D, \{/.test(script.trim()));
