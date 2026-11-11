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
 */
import type { AnimationNode, AnimRole, LayoutNode, LoadedVideoCatalog, SceneConfig, ThemeNode, TransitionNode, TweenStep } from './types';
import { ROLE_TARGET } from './types';
import { animationFor, isFigure, rolesIn, SceneSlots } from './graph';

/** L'ordre d'entrée des rôles. */
const ENTRANCE: AnimRole[] = ['media', 'mark', 'kicker', 'figure', 'title', 'rule', 'label', 'body', 'attribution', 'items', 'cta', 'logo'];
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
  scene: { key: string; duration: number; energy: number; beat?: { bpm: number; first: number } };
  brand: { name: string; hasLogo: boolean; hasDarkLogo?: boolean };
  /** La transition par laquelle la scène entre, et la scène d'avant. */
  transitionIn?: TransitionNode;
  prevKey?: string;
  /** Les éléments sortent avant la fin (une coupe suit, dans un film posé). */
  exitAtEnd?: boolean;
  vars?: Record<string, string>;
}

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
  html = html.replace(/\{\{\s*(title|body|kicker|cta|figure|label|attribution)\s*\}\}/g, (_m, slot: string) => {
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
          : '<img src="{{logo}}" alt="" data-ge-inner class="h-full w-auto max-w-full object-contain">'
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
  return `<div class="relative h-full w-full overflow-hidden ${classes.ground ?? 'bg-ground'}">${html.replace(/\s{2,}/g, ' ').trim()}</div>`;
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
  out?: ResolvedStep[];
  outAt?: number;
}

export interface RuntimeScene {
  key: string;
  roles: RuntimeRole[];
  transition?: { prevKey: string; half: number; overlays: TransitionNode['overlays']; out: ResolvedStep[]; in: ResolvedStep[] };
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
    if (s.at !== undefined) out.at = s.at;
    if (s.counter) out.counter = true;
    return out;
  });
}

/** La durée d'une suite de tweens sur `n` cibles (décalages compris). */
function stepsSpan(steps: ResolvedStep[], n: number): number {
  let prevStart = 0;
  let end = 0;
  for (const s of steps) {
    const at = s.at !== undefined ? prevStart + s.at : end;
    end = Math.max(end, at + s.duration + (s.stagger ?? 0) * Math.max(0, n - 1));
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

/** La scène entière : HTML et script (données de la chorégraphie pour le runtime `__ge`). */
export function assembleScene(i: AssembleInput): { html: string; script: string; spec: RuntimeScene } {
  const layout = (i.cat.nodes.get(i.config.layout) ?? i.cat.nodes.get('builtin.stack')) as LayoutNode;
  const html = sceneHtml(layout, i.theme, i.slots, i.brand, { ...(i.vars ?? {}), ...(i.config.vars ?? {}) });
  const m = i.theme.motion;
  const pace = Math.min(1.25, Math.max(0.8, i.config.params?.pace ?? 1));
  const D = i.scene.duration;
  const textOf = (role: AnimRole): string => {
    const key = role === 'items' ? undefined : (i.slots as unknown as Record<string, string | undefined>)[role];
    return key ? i.texts[key] ?? '' : role === 'items' ? i.slots.items.map((k) => i.texts[k] ?? '').join(' ') : '';
  };
  const present: AnimRole[] = rolesIn(html).filter((r) => r !== 'item');
  const ordered = ENTRANCE.filter((r) => present.includes(r));
  /** L'animation de chaque rôle ; un compteur ne compte qu'UN nombre (« 30–40 % » se pose sans compter). */
  const animOf = (role: AnimRole): AnimationNode => {
    const counts = (id: string) => (i.cat.nodes.get(id) as AnimationNode).steps.in.some((s) => s.counter);
    let id = animationFor(i.cat, i.theme, i.config, role, textOf(role));
    if (counts(id) && !isFigure(textOf(role))) id = i.cat.nodes.get('anim.scale-in')?.kind === 'animation' ? 'anim.scale-in' : 'builtin.rise';
    return i.cat.nodes.get(id) as AnimationNode;
  };

  const build = (factor: number) => {
    const tokens: Tokens = { dIn: (m.dIn / pace) * factor, dOut: m.dOut / pace, stagger: (m.stagger / pace) * factor, dist: m.dist, easeOut: m.easeOut, easeIn: m.easeIn, easeMove: m.easeMove, hold: 0 };
    const half = i.transitionIn && i.transitionIn.duration > 0 ? i.transitionIn.duration / 2 : 0;
    // Sous un panneau de transition, les entrées attendent qu'il s'ouvre ; sinon elles accompagnent l'entrée.
    let t = half ? half * (i.transitionIn!.overlays.length ? 0.85 : 0.5) : 0.12;
    const roles: RuntimeRole[] = [];
    for (const role of ordered) {
      const anim = animOf(role);
      const split = ROLE_TARGET[role] === 'text' ? anim.split ?? 'none' : 'none';
      const steps = resolveSteps(anim.steps.in, tokens);
      const units = unitsOf(role, split, textOf(role), i.slots.items.length);
      const at = role === 'media' ? Math.max(0, t - 0.12) : t;
      const entry: RuntimeRole = { role, sel: role === 'items' ? '[data-v="item"]' : `[data-v="${role}"]`, split, mask: Boolean(anim.mask) && split !== 'none', at, in: steps };
      if (anim.steps.out?.length) entry.out = resolveSteps(anim.steps.out, tokens);
      roles.push(entry);
      const span = stepsSpan(steps, units);
      // Le suivant entre quand celui-ci est aux deux tiers de son mouvement principal (chevauchement léger).
      t = role === 'media' ? t + 0.12 : role === 'rule' || role === 'mark' ? t + Math.min(span, tokens.dIn as number) * 0.3 : t + Math.max(0.12, Math.min(span * 0.62, (tokens.dIn as number) * 0.7));
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
  for (const r of roles) {
    const enteredAt = r.at + stepsSpan(r.in, unitsOf(r.role, r.split, textOf(r.role), i.slots.items.length));
    const remaining = Math.max(0.5, D - enteredAt - (i.exitAtEnd ? m.dOut : 0));
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
    if (i.exitAtEnd && r.out?.length) {
      const idx = roles.length - 1 - roles.indexOf(r);
      r.outAt = Math.max(enteredAt, Math.round((D - m.dOut - 0.06 - idx * 0.04) * 1000) / 1000);
    } else delete r.out;
  }

  const spec: RuntimeScene = { key: i.scene.key, roles };
  if (i.transitionIn && i.transitionIn.duration > 0 && i.prevKey) {
    const half = i.transitionIn.duration / 2;
    const t: Tokens = { half, d: i.transitionIn.duration };
    spec.transition = { prevKey: i.prevKey, half, overlays: i.transitionIn.overlays, out: resolveSteps(i.transitionIn.steps.out, t), in: resolveSteps(i.transitionIn.steps.in, t) };
  }
  const json = JSON.stringify(spec).replace(/</g, '\\u003c');
  return { html, script: `__ge.scene(tl, root, D, ${json});`, spec };
}

/** Une scène est-elle faite par le catalogue (son script n'est que des données pour le runtime) ? */
export const isCatalogScript = (script?: string): boolean => Boolean(script && /^__ge\.scene\(tl, root, D, \{/.test(script.trim()));
