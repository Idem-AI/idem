/**
 * LA LECTURE D'UNE INTENTION — technique et tolérante, comme celle des programmes :
 *
 *   refusé       forme illisible, aucun élément ;
 *   corrigé      `null` retirés (sorties structurées), énumérations ramenées à une valeur connue, identifiants
 *                dédoublonnés, niveaux déduits du rang, relations et verbes visant un élément absent retirés ;
 *   garanti      chaque texte de la scène est montré (un texte oublié est ajouté au rang 3), chaque média de la scène
 *                apparaît (le premier en fond si aucun n'est placé), un seul élément de rang 1, un verbe d'entrée pour
 *                chaque élément qui n'en a pas.
 *
 * Rien d'inventé : un texte qui n'est pas un texte de la scène n'est jamais affiché.
 */
import { TYPE_LEVELS, TypeLevel } from '../dsl/types';
import { roleOf } from '../design/film';
import { clampEnergy } from '../design/motion';
import { BACKGROUNDS, BackgroundRole, ELEMENT_KINDS, IntentBeat, IntentElement, LAYOUT_KINDS, LayoutKind, RELATIONS, Relation, SceneIntent, SHAPE_KINDS, VERBS } from './types';

export interface IntentContext {
  texts: Record<string, string>;
  media: ('image' | 'video')[];
  hasLogo: boolean;
  /** Le catalogue d'icônes connaît-il ce nom ? */
  iconExists?: (name: string) => boolean;
}

export interface IntentValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
  intent?: SceneIntent;
}

const ID = /^[A-Za-z_][\w-]{0,30}$/;

/** Lit la réponse d'un modèle : un objet JSON (bloc ```json, ou premier objet). */
export function parseIntent(raw: string): { intent?: unknown; error?: string } {
  const text = String(raw || '');
  const block = text.match(/```(?:json)?\s*\n([\s\S]*?)```/i);
  let body = block ? block[1] : text;
  const first = body.indexOf('{');
  const last = body.lastIndexOf('}');
  if (first < 0 || last <= first) return { error: 'aucun objet JSON dans la réponse' };
  body = body.slice(first, last + 1);
  for (const candidate of [body, body.replace(/,(\s*[}\]])/g, '$1')]) {
    try {
      return { intent: JSON.parse(candidate) };
    } catch {
      // essai suivant
    }
  }
  return { error: 'JSON illisible' };
}

const pick = <T extends string>(v: unknown, list: readonly T[]): T | undefined => (typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : undefined);

/** Le niveau d'un texte d'après son rang et sa nature. */
export function levelFor(rank: number, kind: string): TypeLevel {
  // Un bouton se lit comme un texte (un appel à l'action minuscule ne sert à rien) ; une pastille comme une légende.
  if (kind === 'button') return 'body';
  if (kind === 'chip') return 'caption';
  return rank === 1 ? 'title' : rank === 2 ? 'subtitle' : 'body';
}

export function validateIntent(input: unknown, ctx: IntentContext): IntentValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, errors: ['l’intention doit être un objet { layout, elements, beats }'], warnings };
  const raw = input as Record<string, unknown>;
  const textKeys = Object.keys(ctx.texts);
  const keyOf = (v: unknown): string | undefined => {
    if (typeof v !== 'string') return undefined;
    const k = v.startsWith('$') ? v.slice(1) : v;
    return textKeys.includes(k) ? k : undefined;
  };

  let layout = pick<LayoutKind>(raw.layout, LAYOUT_KINDS);
  if (!layout) {
    warnings.push(`composition « ${String(raw.layout)} » inconnue : hero`);
    layout = 'hero';
  }
  const background = pick<BackgroundRole>(raw.background, BACKGROUNDS);
  const elements: IntentElement[] = [];
  const ids = new Set<string>();
  const usedTexts = new Set<string>();
  const usedMedia = new Set<number>();
  for (const [k, e] of (Array.isArray(raw.elements) ? raw.elements : []).entries()) {
    if (!e || typeof e !== 'object') continue;
    const o = e as Record<string, unknown>;
    const kind = pick(o.kind, ELEMENT_KINDS);
    if (!kind) {
      warnings.push(`élément ${k} : nature « ${String(o.kind)} » inconnue, retiré`);
      continue;
    }
    let id = typeof o.id === 'string' && ID.test(o.id) && o.id !== 'world' ? o.id : `${kind}${k + 1}`;
    while (ids.has(id)) id = `${id}x`;
    const rank = ([1, 2, 3].includes(Number(o.rank)) ? Number(o.rank) : 2) as 1 | 2 | 3;
    const el: IntentElement = { id, kind, rank };
    if (kind === 'text' || kind === 'chip' || kind === 'button') {
      const key = keyOf(o.text);
      if (!key) {
        warnings.push(`${id} : « ${String(o.text).slice(0, 40)} » n’est pas un texte de la scène, élément retiré`);
        continue;
      }
      if (usedTexts.has(key)) {
        warnings.push(`${id} : « $${key} » est déjà montré, élément retiré (un texte s’affiche une fois)`);
        continue;
      }
      usedTexts.add(key);
      el.text = `$${key}`;
    }
    if (kind === 'list') {
      const items = (Array.isArray(o.items) ? o.items : []).map(keyOf).filter((x): x is string => !!x && !usedTexts.has(x));
      if (!items.length) {
        warnings.push(`${id} : liste sans puce de la scène, retirée`);
        continue;
      }
      items.forEach((x) => usedTexts.add(x));
      el.items = items.map((x) => `$${x}`);
    }
    if (kind === 'image' || kind === 'video' || kind === 'device') {
      const m = Number(o.media);
      if (!Number.isInteger(m) || m < 0 || m >= ctx.media.length) {
        warnings.push(`${id} : média ${String(o.media)} absent de la scène, élément retiré`);
        continue;
      }
      el.media = m;
      if (kind !== 'device' && ctx.media[m] !== kind) el.kind = ctx.media[m];
      usedMedia.add(m);
      const crop = pick(o.crop, ['subject', 'fill', 'fit'] as const);
      if (crop) el.crop = crop;
      if (kind === 'device') el.device = pick(o.device, ['phone', 'laptop', 'browser'] as const) || 'phone';
    }
    if (kind === 'logo' && !ctx.hasLogo) {
      warnings.push(`${id} : la marque n’a pas de logo, élément retiré`);
      continue;
    }
    if (kind === 'icon') {
      const name = typeof o.icon === 'string' ? o.icon.trim().toLowerCase() : '';
      if (!name || (ctx.iconExists && !ctx.iconExists(name))) {
        warnings.push(`${id} : icône « ${name} » inconnue du catalogue, retirée`);
        continue;
      }
      el.icon = name;
    }
    if (kind === 'shape') el.shape = pick(o.shape, SHAPE_KINDS) || 'bar';
    const level = pick<TypeLevel>(o.level, TYPE_LEVELS);
    if (el.text || el.items) el.level = level || levelFor(rank, kind);
    if (typeof o.color === 'string' && o.color.trim()) el.color = o.color.trim();
    if (Number.isInteger(o.emphasis) && el.text) el.emphasis = Math.max(0, Number(o.emphasis));
    ids.add(id);
    elements.push(el);
  }

  // Rien d'oublié : chaque texte de la scène est montré, chaque média apparaît.
  for (const key of textKeys) {
    if (usedTexts.has(key) || !String(ctx.texts[key] || '').trim()) continue;
    let id = `t-${key}`.slice(0, 30).replace(/[^\w-]/g, '');
    while (ids.has(id)) id = `${id}x`;
    ids.add(id);
    elements.push({ id, kind: 'text', text: `$${key}`, rank: 3, level: 'body' });
    warnings.push(`le texte $${key} n’était pas placé : ajouté (rang 3)`);
  }
  ctx.media.forEach((kind, m) => {
    if (usedMedia.has(m)) return;
    let id = `media${m}`;
    while (ids.has(id)) id = `${id}x`;
    ids.add(id);
    elements.push({ id, kind, media: m, rank: elements.some((e) => e.rank === 1) ? 2 : 1, crop: 'subject' });
    warnings.push(`le média ${m} n’était pas placé : ajouté`);
  });
  if (!elements.length) return { ok: false, errors: [...errors, 'aucun élément utilisable'], warnings };

  // Un seul élément principal.
  const firsts = elements.filter((e) => e.rank === 1);
  if (!firsts.length) {
    const lead = elements.find((e) => e.text) || elements[0];
    lead.rank = 1;
    if (lead.text) lead.level = lead.level === 'body' || lead.level === 'subtitle' ? 'title' : lead.level;
  } else firsts.slice(1).forEach((e) => (e.rank = 2));

  const known = (t: string) => t === 'world' || ids.has(t.split('.')[0]);
  const relations: [string, Relation, string][] = [];
  for (const r of Array.isArray(raw.relations) ? raw.relations : []) {
    const a = Array.isArray(r) ? r[0] : (r as Record<string, unknown>)?.a;
    const rel = pick<Relation>(Array.isArray(r) ? r[1] : (r as Record<string, unknown>)?.rel, RELATIONS);
    const b = Array.isArray(r) ? r[2] : (r as Record<string, unknown>)?.b;
    if (typeof a === 'string' && typeof b === 'string' && rel && ids.has(a) && ids.has(b) && a !== b) relations.push([a, rel, b]);
  }

  const beats: IntentBeat[] = [];
  for (const b of Array.isArray(raw.beats) ? raw.beats : []) {
    if (!b || typeof b !== 'object') continue;
    const o = b as Record<string, unknown>;
    const verb = pick(o.verb, VERBS);
    const target = typeof o.target === 'string' ? o.target.trim() : '';
    if (!verb || !known(target)) {
      warnings.push(`mouvement « ${String(o.verb)} » sur « ${target} » ignoré (verbe ou élément inconnu)`);
      continue;
    }
    const beat: IntentBeat = { verb, target };
    const style = pick(o.style, ['words', 'letters', 'line', 'items'] as const);
    const from = pick(o.from, ['left', 'right', 'top', 'bottom', 'center'] as const);
    const intensity = pick(o.intensity, ['soft', 'normal', 'strong'] as const);
    const sync = pick(o.sync, ['downbeat', 'beat', 'voice', 'none'] as const);
    if (style) beat.style = style;
    if (from) beat.from = from;
    if (intensity) beat.intensity = intensity;
    if (sync && sync !== 'none') beat.sync = sync;
    if (typeof o.after === 'string' && known(o.after)) beat.after = o.after;
    if (typeof o.with === 'string' && known(o.with)) beat.with = o.with;
    beats.push(beat);
  }
  // Chaque élément visible a son entrée : sans verbe, il se révèle dans l'ordre des rangs.
  const entered = new Set(beats.filter((b) => b.verb !== 'exit' && b.verb !== 'zoom' && b.verb !== 'push' && b.verb !== 'focus' && b.verb !== 'highlight').map((b) => b.target.split('.')[0]));
  for (const e of [...elements].sort((a, b) => a.rank - b.rank)) {
    if (entered.has(e.id)) continue;
    const verb = e.kind === 'list' ? 'cascade' : e.kind === 'image' || e.kind === 'video' ? 'wipe' : e.kind === 'shape' ? 'draw' : e.kind === 'logo' || e.kind === 'icon' || e.kind === 'button' || e.kind === 'chip' ? 'pop' : e.rank === 1 ? 'reveal' : 'rise';
    beats.push({ verb, target: e.kind === 'list' ? `${e.id}.*` : e.id, ...(verb === 'reveal' ? { style: 'words' as const } : {}) });
  }

  const intent: SceneIntent = {
    layout,
    elements,
    beats,
    ...(background ? { background } : {}),
    ...(relations.length ? { relations } : {}),
    ...(roleOf(raw.role) ? { role: roleOf(raw.role) } : {}),
    ...(raw.energy !== undefined && raw.energy !== null ? { energy: clampEnergy(raw.energy) } : {}),
  };
  const cam = raw.camera as Record<string, unknown> | null | undefined;
  const move = pick(cam?.move, ['none', 'push', 'pull', 'pan'] as const);
  if (move && move !== 'none') intent.camera = { move, ...(typeof cam?.target === 'string' && ids.has(cam.target) ? { target: cam.target } : {}) };
  return { ok: true, errors, warnings, intent };
}
