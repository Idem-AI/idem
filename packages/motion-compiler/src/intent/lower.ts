/**
 * LE DÉVELOPPEMENT D'UNE INTENTION — intention de scène → programme du langage de mouvement (le langage d'assemblage),
 * que le compilateur traduit ensuite comme avant. Tout ce qui se calcule est calculé ici :
 *
 *   1. géométrie   le solveur place les éléments dans CHAQUE format (variante choisie) ; chaque nœud reçoit une valeur
 *                  exacte par format (`fmt(story, portrait, carré, paysage)`) ;
 *   2. couleurs    l'encre lisible d'après le fond réel de l'élément (fond de scène, aplat, zone claire ou sombre d'un
 *                  média, bouton) ; une couleur demandée par le modèle n'est gardée que si elle se lit ;
 *   3. mouvement   chaque verbe passe par sa recette (valeurs nommées), puis le solveur temporel pose les départs
 *                  (temps de lecture, chevauchements, musique, voix) ; la piste est marquée `timing: "solved"` ;
 *   4. trajectoires les textes qui se croiseraient en chemin sont retardés, re-routés ou leur course réduite.
 *
 * Le nombre de lignes estimé d'un texte devient son plafond (`lines`) : le navigateur réduit la taille plutôt que
 * d'ajouter une ligne — la pile garde la hauteur que le solveur lui a donnée.
 */
import type { SceneDesign, SeamSpec } from '../design/types';
import { contrastRatio } from '../design/color';
import { readTime } from '../design/motion';
import type { SafeFormat } from '../design/safezones';
import { frameInUnits } from '../design/safezones';
import type { MotionProgram } from '../dsl/types';
import { screenIdOf } from '../dsl/macros';
import { Box, boxH, boxW, cx, cy, Placed, Placement, SolveMedia, solveGeometry, VariantChoice } from '../solver/geometry';
import { solveTiming, TimedBeat } from '../solver/time';
import { findCollisions, resolveCollision, trackOf } from '../solver/trajectory';
import { needsOf, recipe, RecipeTarget } from './recipes';
import type { IntentBeat, IntentElement, SceneIntent } from './types';

const FORMAT_ORDER: SafeFormat[] = ['story', 'portrait', 'square', 'landscape'];

export interface LowerInput {
  intent: SceneIntent;
  texts: Record<string, string>;
  /** Les médias de la scène ; `calmBy` : la zone calme de chaque média par format (préparation des médias). */
  media: (Omit<SolveMedia, 'calm'> & { calmBy?: Partial<Record<SafeFormat, SolveMedia['calm']>> })[];
  formats: SafeFormat[];
  designs: Partial<Record<SafeFormat, SceneDesign>>;
  fonts: { display: string; body: string };
  logoAspect?: number;
  duration: number;
  choice: VariantChoice;
  /** Les temps de la musique et la voix (s, depuis le début de la scène) ; les coutures du film. */
  beats?: number[];
  downbeats?: number[];
  voiceAt?: number;
  seamIn?: SeamSpec | null;
  /** Durée de la sortie de couture (s) : ce qui doit être lu finit avant elle. */
  seamOut?: number;
}

export interface LowerResult {
  program: MotionProgram;
  placements: Placement[];
  warnings: string[];
  feasible: boolean;
  collisions: number;
  /** Les éléments révélés, avec leur départ et la fin de leur révélation (le juge vérifie les assertions). */
  reveals: { id: string; start: number; end: number; read: number; verb: string; from?: string }[];
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Une valeur par format : un nombre quand elle est la même partout, sinon `fmt(story, portrait, carré, paysage)`. */
function perFormat(values: Partial<Record<SafeFormat, number>>, round = r1): number | string {
  const known = FORMAT_ORDER.map((f) => values[f]).filter((v): v is number => v !== undefined);
  const fill = known.length ? known[0] : 0;
  const all = FORMAT_ORDER.map((f) => round(values[f] ?? fill));
  return all.every((v) => v === all[0]) ? all[0] : `fmt(${all.join(', ')})`;
}

const BG_TOKEN: Record<string, string> = { ground: 'ground', surface: 'surface', primary: 'primary', secondary: 'secondary', accent: 'accent', media: 'ground' };
const ON_BG: Record<string, string> = { ground: 'ink', surface: 'ink', primary: 'onPrimary', secondary: 'onSecondary', accent: 'onAccent', media: 'ink' };

export function lowerIntent(input: LowerInput): LowerResult {
  const { intent } = input;
  const warnings: string[] = [];
  const formats = input.formats.length ? input.formats : (['story'] as SafeFormat[]);
  const lead = formats[0];
  const design = input.designs[lead]!;
  const bgRole = intent.background || 'ground';
  const bgHex = (design.colors as unknown as Record<string, string>)[bgRole === 'media' ? 'ground' : bgRole] || design.colors.ground;
  const roleHex = (role: string) => (design.colors as unknown as Record<string, string>)[role] || (role === 'white' ? '#ffffff' : role === 'black' ? '#111418' : undefined);

  // 1. La géométrie, format par format.
  const placements = formats.map((format) =>
    solveGeometry({
      intent,
      texts: input.texts,
      media: input.media.map((m) => ({ kind: m.kind, width: m.width, height: m.height, ...(m.calmBy?.[format] ? { calm: m.calmBy[format] } : {}) })),
      design: input.designs[format] || design,
      fonts: input.fonts,
      logoAspect: input.logoAspect,
      format,
      choice: input.choice,
    })
  );
  placements.forEach((p) => p.notes.forEach((n) => warnings.push(`[${p.format}] ${n}`)));
  const feasible = placements.every((p) => p.feasible);
  const placedIn = (id: string) => Object.fromEntries(placements.map((p) => [p.format, p.elements.find((e) => e.id === id)])) as Partial<Record<SafeFormat, Placed>>;
  const byId = new Map(intent.elements.map((e) => [e.id, e]));
  const ids = [...new Set(placements.flatMap((p) => p.elements.map((e) => e.id)))];
  const layerOf = (id: string) => Math.min(...placements.map((p) => p.elements.find((e) => e.id === id)?.layer ?? 99));

  // Les besoins des nœuds (découpe, ancre) d'après les verbes qui les visent.
  const needs = new Map<string, ReturnType<typeof needsOf>>();
  const targetInfo = (id: string): RecipeTarget => {
    const el = byId.get(id);
    const p = Object.values(placedIn(id)).find(Boolean);
    const node: RecipeTarget['node'] = id === 'world' ? 'world' : !el ? (p?.kind === 'item' ? 'text' : 'group') : el.kind === 'text' || el.kind === 'chip' || el.kind === 'button' ? 'text' : el.kind === 'image' || el.kind === 'video' || el.kind === 'device' ? 'media' : el.kind === 'shape' ? (el.shape === 'ring' || el.shape === 'arc' ? 'shape-line' : 'shape-fill') : el.kind === 'logo' ? 'logo' : el.kind === 'icon' ? 'icon' : 'group';
    const items = el?.kind === 'list' ? (el.items || []).map((_, k) => `${id}-${k}`) : undefined;
    const text = el?.text ? String(input.texts[el.text.slice(1)] || '') : '';
    return { node, ...(items ? { parts: items } : {}), ...(el?.kind === 'device' ? { screen: screenIdOf(id) } : {}), chars: text.length, ...(el?.emphasis !== undefined ? { emphasis: el.emphasis } : {}), tall: lead === 'story' || lead === 'portrait' };
  };
  for (const b of intent.beats) {
    const id = b.target.split('.')[0];
    const n = needsOf(b, targetInfo(id));
    if (Object.keys(n).length) needs.set(id, { ...(needs.get(id) || {}), ...n });
  }

  // 2. Les nœuds.
  const nodes: Record<string, unknown>[] = [];
  const textColor = (p: Placed | undefined, el: IntentElement | undefined): string => {
    const on = p?.on || 'ground';
    let base = on === 'plate' ? 'ink' : on === 'media-light' ? '#111418' : on === 'media-dark' ? 'white' : on === 'button' ? 'onPrimary' : on === 'chip' ? 'onHighlight' : ON_BG[bgRole] || 'ink';
    if (base === 'ink' && on === 'ground' && bgRole === 'ground' && (p?.rank ?? 2) === 3) base = 'inkMuted';
    // Une couleur demandée par le modèle : gardée si elle se lit sur le fond réel (3:1 pour un titre, 4,5:1 sinon).
    if (el?.color && on === 'ground') {
      const hex = roleHex(el.color);
      const min = p?.level === 'display' || p?.level === 'title' ? 3 : 4.5;
      if (hex && contrastRatio(hex, bgHex) >= min) base = el.color;
      else warnings.push(`${el.id} : couleur « ${el.color} » illisible sur le fond, encre gardée`);
    }
    return base;
  };
  const xy = (id: string, mode: 'center' | 'left' = 'center') => {
    const pl = placedIn(id);
    const val = (f: (b: Box) => number) => perFormat(Object.fromEntries(FORMAT_ORDER.map((fmt) => [fmt, pl[fmt] ? f(pl[fmt]!.box) : undefined])) as Partial<Record<SafeFormat, number>>);
    return { x: mode === 'left' ? val((b) => b.x0) : val(cx), y: val(cy), w: val(boxW), h: val(boxH) };
  };

  // Les aplats (plein cadre sans zone calme) : derrière les textes qu'ils portent.
  const plateFormats = placements.filter((p) => p.plates.length);
  if (plateFormats.length) {
    const val = (f: (b: Box) => number) => perFormat(Object.fromEntries(FORMAT_ORDER.map((fmt) => {
      const p = placements.find((x) => x.format === fmt);
      return [fmt, p ? (p.plates[0] ? f(p.plates[0].box) : 0) : undefined];
    })) as Partial<Record<SafeFormat, number>>);
    nodes.push({ id: 'plate', type: 'rect', x: val(cx), y: val(cy), w: val(boxW), h: val(boxH), radius: r2(design.radius * 2), fill: 'surface/94', z: 5 });
  }

  const sorted = ids.sort((a, b) => layerOf(a) - layerOf(b));
  for (const id of sorted) {
    const pl = placedIn(id);
    const any = Object.values(pl).find(Boolean)!;
    const el = byId.get(id);
    const need = needs.get(id) || {};
    const pos = xy(id, any.align === 'left' ? 'left' : 'center');
    if (any.kind === 'bullet') {
      nodes.push({ id, type: 'circle', x: xy(id).x, y: pos.y, size: pos.w, fill: 'accent', z: any.layer });
      continue;
    }
    if (any.kind === 'item' || any.kind === 'text' || any.kind === 'chip' || any.kind === 'button') {
      const key = any.kind === 'item' ? any.textKey! : el!.text!.slice(1);
      const level = any.level || 'body';
      const heading = level === 'display' || level === 'title' || level === 'subtitle';
      const size = perFormat(Object.fromEntries(FORMAT_ORDER.map((f) => [f, pl[f]?.size])) as Partial<Record<SafeFormat, number>>, r2);
      const lines = Math.max(1, ...Object.values(pl).map((p) => p?.lines?.length || 1));
      const weight = level === 'display' ? design.weights.display : level === 'title' ? design.weights.title : level === 'subtitle' ? design.weights.subtitle : design.weights.body;
      const text: Record<string, unknown> = {
        type: 'text',
        text: `$${key}`,
        font: heading ? 'display' : 'body',
        weight,
        size,
        lines,
        width: pos.w,
        align: any.align === 'center' ? 'center' : 'left',
        ...(heading ? { lineHeight: 1.08 } : { lineHeight: 1.18 }),
        ...(heading && design.uppercaseTitles && (level === 'display' || level === 'title') ? { upper: true } : {}),
        ...(design.tracking[heading ? 'title' : 'body'] ? { letterSpacing: design.tracking[heading ? 'title' : 'body'] } : {}),
        color: textColor(any, el),
        ...(need.split ? { split: need.split } : {}),
      };
      if (any.kind === 'button' || any.kind === 'chip') {
        // Un bouton ou une pastille : une pile avec son fond, le texte dedans (la pile garde son contenu).
        nodes.push({ id, type: 'stack', dir: 'row', x: xy(id).x, y: pos.y, padding: perFormat(Object.fromEntries(FORMAT_ORDER.map((f) => [f, pl[f]?.size ? pl[f]!.size! * 0.7 : undefined])) as Partial<Record<SafeFormat, number>>), radius: 99, fill: any.kind === 'button' ? 'primary' : 'highlight', z: any.layer, children: [{ ...text, id: `${id}__t`, width: undefined, lines: 1 }] });
        continue;
      }
      nodes.push({ id, ...text, x: pos.x, y: pos.y, anchor: any.align === 'left' ? 'left' : 'center', z: any.layer });
      continue;
    }
    if (any.kind === 'image' || any.kind === 'video') {
      const anchor = need.anchor;
      const box = (f: SafeFormat) => pl[f]?.box;
      // Un cadre qui s'ouvre depuis un bord : l'ancre est ce bord, la position aussi.
      const ax = (b: Box) => (anchor === 'left' ? b.x0 : anchor === 'right' ? b.x1 : cx(b));
      const ay = (b: Box) => (anchor === 'top' ? b.y0 : anchor === 'bottom' ? b.y1 : cy(b));
      const val = (f: (b: Box) => number) => perFormat(Object.fromEntries(FORMAT_ORDER.map((fmt) => [fmt, box(fmt) ? f(box(fmt)!) : undefined])) as Partial<Record<SafeFormat, number>>);
      nodes.push({ id, type: any.kind, media: el!.media, x: val(ax), y: val(ay), w: pos.w, h: pos.h, fit: el?.crop === 'fit' ? 'contain' : 'cover', ...(any.bleed ? {} : { radius: r2(design.radius * 2.4) }), ...(anchor ? { anchor } : {}), z: any.layer });
      continue;
    }
    if (any.kind === 'device') {
      nodes.push({ id, type: 'device', kind: el?.device || 'phone', media: el!.media, x: xy(id).x, y: pos.y, w: pos.w, z: any.layer });
      continue;
    }
    if (any.kind === 'logo') {
      nodes.push({ id, type: 'logo', x: xy(id).x, y: pos.y, w: pos.w, on: bgRole === 'media' ? 'ground' : bgRole, z: any.layer });
      continue;
    }
    if (any.kind === 'icon') {
      // Les tracés d'une icône sont mis à l'échelle une fois (validation) : la taille du format principal.
      nodes.push({ id, type: 'icon', name: el?.icon, x: xy(id).x, y: pos.y, size: r1(boxW((pl[lead] || any).box)), color: bgRole === 'ground' || bgRole === 'surface' ? 'primary' : ON_BG[bgRole], z: any.layer });
      continue;
    }
    if (any.kind === 'shape') {
      const accentOk = contrastRatio(design.colors.accent, bgHex) >= 1.6;
      const stroke = accentOk ? 'accent' : 'primary';
      const c = xy(id);
      // Présent dans certains formats seulement : une taille nulle ailleurs (rien ne s'affiche).
      const zero = (v: number | string, f: (b: Box) => number) => (FORMAT_ORDER.every((fmt) => pl[fmt]) ? v : perFormat(Object.fromEntries(FORMAT_ORDER.map((fmt) => [fmt, pl[fmt] ? f(pl[fmt]!.box) : 0])) as Partial<Record<SafeFormat, number>>));
      const w = zero(c.w, boxW);
      const h = zero(c.h, boxH);
      switch (el?.shape) {
        case 'ring':
          nodes.push({ id, type: 'circle', x: c.x, y: c.y, size: w, fill: 'transparent', stroke, lineWidth: r2(design.stroke * 2), z: any.layer });
          break;
        case 'arc':
          nodes.push({ id, type: 'circle', x: c.x, y: c.y, size: w, fill: 'transparent', stroke, lineWidth: r2(design.stroke * 2), start: 0.08, end: 0.72, z: any.layer });
          break;
        case 'circle':
          nodes.push({ id, type: 'circle', x: c.x, y: c.y, size: w, fill: 'highlight', z: any.layer });
          break;
        case 'block':
          nodes.push({ id, type: 'rect', x: c.x, y: c.y, w, h, radius: r2(design.radius * 2.4), fill: `${stroke}/25`, z: any.layer });
          break;
        case 'pill':
          nodes.push({ id, type: 'rect', x: c.x, y: c.y, w, h, radius: 99, fill: 'surface', z: any.layer });
          break;
        case 'dots':
          nodes.push({ id, type: 'repeat', count: 16, layout: 'grid', cols: 4, w, h, x: c.x, y: c.y, item: { type: 'circle', size: 0.9, fill: 'line' } });
          break;
        default:
          nodes.push({ id, type: 'rect', x: c.x, y: c.y, w, h, radius: r2(Math.min(design.radius, 0.6)), fill: stroke, ...(need.anchor ? { anchor: need.anchor } : {}), z: any.layer });
      }
    }
  }
  // Les ancres posées sur une barre qui pousse depuis un bord : la position suit l'ancre.
  for (const n of nodes) {
    const need = needs.get(String(n.id || ''));
    if (n.type !== 'rect' || !need?.anchor || n.id === 'plate') continue;
    const pl = placedIn(String(n.id));
    const val = (f: (b: Box) => number) => perFormat(Object.fromEntries(FORMAT_ORDER.map((fmt) => [fmt, pl[fmt] ? f(pl[fmt]!.box) : undefined])) as Partial<Record<SafeFormat, number>>);
    if (need.anchor === 'left') n.x = val((b) => b.x0);
    if (need.anchor === 'right') n.x = val((b) => b.x1);
    if (need.anchor === 'top') n.y = val((b) => b.y0);
    if (need.anchor === 'bottom') n.y = val((b) => b.y1);
  }

  // 3. Le mouvement : recettes, puis le solveur temporel.
  const durations = design.durations as unknown as Record<string, number>;
  const staggers = design.stagger as unknown as Record<string, number>;
  const sec = (v: unknown, fallback = 0.5) => (typeof v === 'number' ? v : typeof v === 'string' && durations[v] !== undefined ? durations[v] : fallback);
  const stg = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' ? staggers[v] ?? 0.08 : 0);
  const countOf = (t: string | string[]) => (Array.isArray(t) ? t.length : /\.\*$/.test(t) ? Math.max(1, String(input.texts[(byId.get(t.split('.')[0])?.text || '').slice(1)] || '').split(/\s+/).filter(Boolean).length) : 1);
  const accentFill = contrastRatio(design.colors.accent, bgHex) >= 3 ? 'accent' : contrastRatio(design.colors.primary, bgHex) >= 3 ? 'primary' : null;

  interface Planned {
    beat: IntentBeat;
    moves: ReturnType<typeof recipe>;
    span: number;
    read: number;
    ambient: boolean;
  }
  const planned: Planned[] = intent.beats.map((beat) => {
    const id = beat.target.split('.')[0];
    let moves = recipe(beat, targetInfo(id), id);
    if (beat.verb === 'highlight' && !accentFill) {
      warnings.push(`${id} : l’accent ne se lit pas sur ce fond, mise en valeur sans couleur`);
      moves = moves.filter((m) => !m.to || !('fill' in m.to));
    } else if (beat.verb === 'highlight') moves = moves.map((m) => (m.to && 'fill' in m.to ? { ...m, to: { ...m.to, fill: accentFill! } } : m));
    // Un élément absent (retiré par le solveur) n'est pas animé.
    moves = moves.filter((m) => (Array.isArray(m.target) ? m.target : [m.target]).every((t) => t === 'world' || ids.includes(t.split('.')[0]) || nodes.some((n) => n.id === t.split('.')[0] || (n.type === 'device' && screenIdOf(String(n.id)) === t))));
    const ambient = moves.length > 0 && moves.every((m) => m.kind === 'ambient');
    const span = Math.max(0, ...moves.filter((m) => m.kind !== 'ambient').map((m) => (m.offset || 0) + sec(m.dur) + stg(m.stagger) * Math.max(0, countOf(m.target) - 1)));
    const el = byId.get(id);
    const reveals = moves.some((m) => m.kind === 'entrance' || m.effect === 'type');
    const read = !reveals ? 0 : el?.kind === 'list' ? (el.items || []).reduce((a, k) => a + readTime(String(input.texts[k.slice(1)] || '')), 0) : el?.text ? readTime(String(input.texts[el.text.slice(1)] || '')) : 0;
    return { beat, moves, span, read, ambient };
  });
  const indexOfTarget = (id?: string) => (id ? planned.findIndex((p) => p.beat.target.split('.')[0] === id && !p.ambient) : -1);
  const main = planned.filter((p) => !p.ambient);
  const climaxIdx = planned.findIndex((p, i) => i > 0 && !p.ambient && (p.beat.intensity === 'strong' || p.beat.verb === 'count'));
  const seamOut = input.seamOut ?? 0;
  const timed: TimedBeat[] = planned.map((p, i) => ({
    span: p.span,
    read: p.read,
    ambient: p.ambient,
    ...(i === climaxIdx && main.length > 1 ? { climax: true } : {}),
    ...(p.beat.sync === 'downbeat' || p.beat.sync === 'beat' || p.beat.sync === 'voice' ? { sync: p.beat.sync } : {}),
    ...(indexOfTarget(p.beat.after) >= 0 && indexOfTarget(p.beat.after) !== i ? { after: indexOfTarget(p.beat.after) } : {}),
    ...(indexOfTarget(p.beat.with) >= 0 && indexOfTarget(p.beat.with) !== i ? { with: indexOfTarget(p.beat.with) } : {}),
  }));
  const zSeam = input.seamIn && (input.seamIn.kind === 'zoom-through' || input.seamIn.kind === 'inverse-zoom');
  const earliest = input.seamIn && input.seamIn.kind !== 'cut' ? 0.05 : 0;
  const latest = Math.max(0.5, input.duration - seamOut - 0.12);
  const time = solveTiming(timed, { duration: input.duration, earliest, latest, beats: input.beats, downbeats: input.downbeats, voiceAt: input.voiceAt, maxSimultaneous: design.maxSimultaneous });
  time.notes.forEach((n) => warnings.push(n));

  const timeline: Record<string, unknown>[] = [];
  const reveals: LowerResult['reveals'] = [];
  planned.forEach((p, i) => {
    const start = time.starts[i] ?? 0;
    for (const m of p.moves) {
      let at = Math.round((start + (m.offset || 0) * time.squeeze) * 1000) / 1000;
      // Loi du signe en Z : sous une couture en zoom, rien ne grandit depuis petit dans la fenêtre de la couture.
      if (zSeam && at < 0.5 && m.from && typeof m.from.scale === 'number' && m.from.scale < 1) at = 0.5;
      const dur = m.dur === 'D' ? Math.max(0.05, input.duration - at) : Math.round(sec(m.dur) * (m.kind === 'ambient' ? 1 : time.squeeze) * 1000) / 1000;
      const step: Record<string, unknown> = { at, target: m.target, dur, ease: m.ease };
      if (m.from) step.from = { ...m.from };
      if (m.to) step.to = { ...m.to };
      if (m.stagger !== undefined) step.stagger = Math.round(stg(m.stagger) * time.squeeze * 1000) / 1000;
      if (m.effect) step.effect = m.effect;
      timeline.push(step);
    }
    if (p.moves.some((m) => m.kind === 'entrance')) {
      const id = p.beat.target.split('.')[0];
      reveals.push({ id, start, end: start + p.span * time.squeeze, read: p.read, verb: p.beat.verb, ...(p.beat.from ? { from: p.beat.from } : {}) });
    }
  });
  // La caméra : une intention, jamais une respiration.
  if (intent.camera?.move === 'push') timeline.push({ at: 0, target: 'world', dur: input.duration, ease: 'move', from: { scale: 1 }, to: { scale: 1.05 } });
  if (intent.camera?.move === 'pull') timeline.push({ at: 0, target: 'world', dur: input.duration, ease: 'move', from: { scale: 1.06 }, to: { scale: 1 } });
  if (intent.camera?.move === 'pan') timeline.push({ at: 0, target: 'world', dur: input.duration, ease: 'move', to: { x: '-=W*0.03' } });

  // 4. Les trajectoires, dans chaque format.
  let collisions = 0;
  for (const p of placements) {
    const F = frameInUnits(p.format);
    for (let round = 0; round < 4; round++) {
      const boxes = new Map(p.elements.filter((e) => e.layer >= 10).map((e) => [e.id, e.box]));
      const found = findCollisions(boxes, trackOf(timeline as never, F.W, F.H), p.format);
      if (!found.length) break;
      collisions += found.length;
      for (const c of found.slice(0, 2)) {
        const fix = resolveCollision(c, timeline as never, latest, (id) => planned.find((x) => x.beat.target.split('.')[0] === id)?.read || 0);
        if (fix) warnings.push(`[${p.format}] ${fix}`);
      }
    }
  }
  for (const s of timeline) delete (s as { _flipped?: boolean })._flipped;

  const bg = BG_TOKEN[bgRole] || 'ground';
  return {
    program: { bg, nodes: nodes as never, timeline: timeline as never, timing: 'solved' },
    placements,
    warnings,
    feasible: feasible && time.feasible,
    collisions,
    reveals,
  };
}
