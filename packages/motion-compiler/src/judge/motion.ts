/**
 * LE JUGE — ÉTAGE 3 : LE MOUVEMENT, mesuré sur la piste (sans rendu) — ÉTAGE 4 : L'INTENTION, des assertions vérifiées.
 *
 * Mouvement (0 → 1, 1 = bon) :
 *   courbes       part des déplacements et changements d'échelle qui ont une courbe (pas de linéaire hors ambiance) ;
 *   simultanés    jamais plus de mouvements principaux en même temps que l'énergie n'en permet ;
 *   chevauchement le suivant part quand le précédent est fait à 30–50 % (ni file, ni bloc) ;
 *   trajectoires  aucun texte n'en croise un autre en chemin ;
 *   tremblement   aucune boucle d'attente (respirer, flotter, pulser) sur un texte, aucun geste trop bref ;
 *   titre posé    un titre arrivé ne bouge plus (« a landed title is dead still ») ;
 *   variété       des entrées différentes dans la scène (pas tout en « monter et apparaître ») ;
 *   musique       part des départs calés sur un temps (± 120 ms), quand la musique est connue ;
 *   signature     part des pas aux courbes du système de design (la personnalité du film).
 *
 * Intention : à la manière de MoVer (SIGGRAPH 2025), des prédicats tirés de l'intention — « a avant b », « le titre
 * apparaît tôt », « la photo entre par la droite », « les puces l'une après l'autre », « chaque texte reste lisible ».
 */
import { EASE_TOKENS } from '../dsl/types';
import type { MotionStep } from '../dsl/types';
import { BEAT_TOLERANCE, OVERLAP } from '../design/motion';
import type { LowerResult } from '../intent/lower';
import type { SceneIntent } from '../intent/types';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const POSITIONAL = ['x', 'y', 'scale', 'scaleX', 'scaleY', 'w', 'h', 'zoom'];

interface Step {
  at: number;
  dur: number;
  ease: string;
  targets: string[];
  props: string[];
  ambient: boolean;
  repeat: boolean;
  entrance: boolean;
  exit: boolean;
}

function steps(timeline: MotionStep[], duration: number): Step[] {
  return timeline
    .filter((s) => s.target)
    .map((s) => {
      const props = [...new Set([...Object.keys(s.from || {}), ...Object.keys(s.to || {})])];
      const dur = typeof s.dur === 'number' ? s.dur : s.dur === 'D' ? duration : 0.5;
      const at = typeof s.at === 'number' ? s.at : 0;
      const hidden = (v: unknown) => typeof v === 'number' && v <= 0.05;
      return {
        at,
        dur,
        ease: String(s.ease || 'outCubic'),
        targets: (Array.isArray(s.target) ? s.target : [s.target!]).map((t) => t.split('.')[0]),
        props,
        ambient: !!s.repeat || dur >= duration * 0.7,
        repeat: !!s.repeat,
        entrance: !!s.from && (hidden(s.from.opacity) || hidden(s.from.scale) || 'x' in s.from || 'y' in s.from || 'blur' in s.from),
        exit: !!s.to && (hidden(s.to.opacity) || hidden(s.to.scale)),
      };
    });
}

export interface MotionContext {
  duration: number;
  maxSimultaneous: number;
  /** Identifiants des textes (pour le tremblement et le titre posé) et de l'élément principal. */
  textIds: string[];
  mainId?: string;
  /** Les décors (traits, barres, points) : leurs gestes accompagnent, ils ne comptent pas parmi les mouvements principaux. */
  accentIds?: string[];
  beats?: number[];
  /** Collisions de trajectoires relevées par le développement. */
  collisions?: number;
}

export function motionMetrics(timeline: MotionStep[], ctx: MotionContext): Record<string, number> {
  const all = steps(timeline, ctx.duration);
  const accents = new Set(ctx.accentIds || []);
  const main = all.filter((s) => !s.ambient && !s.exit && !s.targets.every((t) => accents.has(t)) && s.props.some((p) => POSITIONAL.includes(p) || p === 'opacity' || p === 'blur'));
  const out: Record<string, number> = {};
  const positional = main.filter((s) => s.props.some((p) => POSITIONAL.includes(p)));
  out.eased = positional.length ? positional.filter((s) => s.ease !== 'linear').length / positional.length : 1;
  // Simultanés : au pire instant.
  let worst = 0;
  for (const s of main) worst = Math.max(worst, main.filter((o) => o.at < s.at + 1e-3 && o.at + o.dur > s.at + 1e-3).length);
  out.simultaneity = worst <= ctx.maxSimultaneous ? 1 : clamp01(1 - (worst - ctx.maxSimultaneous) * 0.35);
  // Chevauchement entre entrées successives.
  const entries = main.filter((s) => s.entrance).sort((a, b) => a.at - b.at);
  const ratios: number[] = [];
  for (let i = 1; i < entries.length; i++) {
    const p = entries[i - 1];
    if (p.dur <= 0.05) continue;
    ratios.push((entries[i].at - p.at) / p.dur);
  }
  out.overlap = ratios.length ? ratios.reduce((a, r) => a + (r >= OVERLAP.min - 0.05 && r <= 1.2 ? 1 : r < OVERLAP.min ? clamp01(r / OVERLAP.min) : clamp01(1 - (r - 1.2) / 2)), 0) / ratios.length : 1;
  out.trajectories = 1 / (1 + (ctx.collisions || 0));
  // Tremblement : boucle sur un texte, geste de moins de 80 ms qui déplace.
  const wobble = all.filter((s) => s.repeat && s.targets.some((t) => ctx.textIds.includes(t))).length + all.filter((s) => s.dur < 0.08 && s.props.some((p) => p === 'x' || p === 'y')).length;
  out.jitter = clamp01(1 - wobble * 0.4);
  // Titre posé : après son entrée, le principal ne bouge plus (hors sortie, couleur, effet).
  if (ctx.mainId) {
    const mine = all.filter((s) => s.targets.includes(ctx.mainId!) && !s.ambient);
    const landed = Math.min(...mine.filter((s) => s.entrance).map((s) => s.at + s.dur), Infinity);
    const moving = mine.filter((s) => s.at > landed + 0.05 && !s.exit && s.props.some((p) => POSITIONAL.includes(p)) && s.dur > 0.3).length;
    out.heldTitle = moving ? clamp01(1 - moving * 0.5) : 1;
  } else out.heldTitle = 1;
  // Variété des entrées : des couples (propriétés, courbe) différents quand il y a plusieurs entrées.
  const kinds = new Set(entries.map((s) => `${s.props.sort().join('+')}|${s.ease}`));
  out.variety = entries.length <= 2 ? 1 : clamp01(kinds.size / Math.min(3, entries.length));
  // Musique : départs sur un temps.
  if (ctx.beats?.length && entries.length) out.onBeat = entries.filter((s) => ctx.beats!.some((b) => Math.abs(b - s.at) <= BEAT_TOLERANCE)).length / entries.length;
  else out.onBeat = 1;
  // Signature : les courbes du système de design (nommées).
  out.signature = all.length ? all.filter((s) => (EASE_TOKENS as string[]).includes(s.ease) || s.ease === 'linear').length / all.length : 1;
  return out;
}

export interface Assertion {
  name: string;
  ok: boolean;
}

/** Les prédicats de l'intention (MoVer) : l'ordre, l'apparition, la direction, la cascade, la lecture, le cadre. */
export function intentAssertions(intent: SceneIntent, lowered: Pick<LowerResult, 'reveals' | 'placements' | 'program'>, ctx: { duration: number; seamOut?: number }): Assertion[] {
  const out: Assertion[] = [];
  const startOf = (id: string) => lowered.reveals.find((r) => r.id === id)?.start;
  for (const b of intent.beats) {
    const id = b.target.split('.')[0];
    if (b.after) {
      const a = startOf(b.after.split('.')[0]);
      const s = startOf(id);
      if (a !== undefined && s !== undefined) out.push({ name: `${b.after} avant ${id}`, ok: s >= a - 1e-3 });
    }
    if (b.from && (b.verb === 'slide-in' || b.verb === 'rise')) {
      const step = (lowered.program.timeline as MotionStep[]).find((st) => (Array.isArray(st.target) ? st.target : [st.target]).some((t) => String(t).split('.')[0] === id) && st.from && ('x' in st.from || 'y' in st.from));
      const v = String(step?.from?.x ?? step?.from?.y ?? '');
      const expect = b.from === 'right' || b.from === 'bottom' ? '+=' : '-=';
      if (step) out.push({ name: `${id} entre par ${b.from}`, ok: v.startsWith(expect) });
    }
    if (b.verb === 'cascade' || b.verb === 'stack') {
      const step = (lowered.program.timeline as MotionStep[]).find((st) => Array.isArray(st.target) && st.target.length > 1 && st.target.some((t) => String(t).startsWith(`${id}-`)));
      if (step) out.push({ name: `${id} : l’un après l’autre`, ok: typeof step.stagger === 'number' && step.stagger > 0 });
    }
  }
  const main = intent.elements.find((e) => e.rank === 1);
  if (main) {
    const s = startOf(main.id);
    out.push({ name: `${main.id} apparaît tôt`, ok: s === undefined || s <= ctx.duration * 0.4 });
  }
  const latest = ctx.duration - (ctx.seamOut ?? 0) + 0.01;
  for (const r of lowered.reveals) if (r.read > 0) out.push({ name: `${r.id} reste lisible`, ok: r.end + r.read <= latest });
  for (const p of lowered.placements) {
    const F = p.frame;
    const outside = p.elements.filter((e) => e.layer >= 10 && (e.box.x0 < F.L - 0.6 || e.box.x1 > F.R + 0.6 || e.box.y0 < F.T - 0.6 || e.box.y1 > F.B + 0.6));
    out.push({ name: `textes dans le cadre (${p.format})`, ok: !outside.length });
  }
  return out;
}
