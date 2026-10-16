/**
 * LA VALIDATION D'UN PROGRAMME — technique seulement : le programme peut-il être compilé et exécuté ?
 *
 * Erreurs (le programme est refusé, le modèle reçoit la liste exacte) : forme JSON, type de nœud
 * inconnu, identifiant manquant ou en double, cible qui n'existe pas, texte qui n'est pas un texte de
 * la scène, média absent, expression illisible, plus de deux effets sonores.
 * Avertissements (le programme est compilé, la propriété est ignorée, c'est noté dans l'en-tête du
 * code) : propriété inconnue, pas qui commence après la fin de la scène.
 *
 * Jamais de jugement esthétique : aucune règle de mise en page, de couleur ou de rythme.
 */
import { ANIM_PROPS, AnimProp, EASES, MotionNode, MotionProgram, MotionStep, NODE_TYPES, SFX_KINDS } from './types';
import { constValue, exprError, relative } from './expr';

export interface ValidationContext {
  /** Les clés des textes de la scène. */
  texts: string[];
  /** Les textes eux-mêmes (un texte écrit en clair qui en reprend un est remplacé par sa clé). */
  values?: Record<string, string>;
  /** Nombre de médias de la scène (et leur nature). */
  media: ('image' | 'video')[];
  duration: number;
  hasLogo: boolean;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  /** Le programme normalisé (propriétés inconnues retirées). */
  program?: MotionProgram;
}

const COMMON = ['type', 'id', 'x', 'y', 'rotation', 'scale', 'scaleX', 'scaleY', 'opacity', 'z', 'anchor', 'blur', 'skewX', 'shadow'];
const PROPS: Record<string, string[]> = {
  text: ['text', 'font', 'weight', 'size', 'maxSize', 'lines', 'width', 'align', 'color', 'letterSpacing', 'lineHeight', 'upper', 'italic', 'stroke', 'lineWidth', 'split'],
  rect: ['w', 'h', 'radius', 'fill', 'stroke', 'lineWidth', 'dash', 'clip', 'children'],
  circle: ['size', 'fill', 'stroke', 'lineWidth', 'dash', 'start', 'end', 'clip', 'children'],
  line: ['points', 'stroke', 'lineWidth', 'radius', 'arrow', 'dash', 'start', 'end', 'closed', 'fill'],
  path: ['d', 'stroke', 'lineWidth', 'fill', 'start', 'end'],
  polygon: ['sides', 'size', 'radius', 'fill', 'stroke', 'lineWidth'],
  image: ['media', 'w', 'h', 'fit', 'radius', 'zoom', 'panX', 'panY', 'fill'],
  video: ['media', 'w', 'h', 'fit', 'radius', 'zoom', 'panX', 'panY', 'loop', 'fill'],
  logo: ['w', 'on'],
  group: ['children'],
  stack: ['dir', 'gap', 'align', 'justify', 'w', 'h', 'wrap', 'padding', 'fill', 'radius', 'children'],
  repeat: ['count', 'data', 'layout', 'cols', 'w', 'h', 'gap', 'r', 'item'],
};
const LENGTH_KEYS = ['x', 'y', 'w', 'h', 'width', 'radius', 'gap', 'padding', 'r'];
const AXIS: Record<string, 'x' | 'y'> = { x: 'x', w: 'x', width: 'x', panX: 'x', y: 'y', h: 'y', panY: 'y' };
const ANCHORS = ['center', 'left', 'right', 'top', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];
const MAX_NODES = 400;
const MAX_REPEAT = 60;
const ID = /^[A-Za-z_][\w-]{0,40}$/;
const norm = (t: string) => String(t || '').toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();
/** Un littéral accepté dans un nœud texte : un signe sans lettre (flèche, symbole, ponctuation). */
const LITERAL_OK = /^[^\p{L}\p{N}]{1,4}$/u;

/** Ce que chaque type de nœud sait animer (le reste est refusé). */
const ANIMATABLE: Record<string, AnimProp[]> = {
  text: ['fill', 'size', 'letterSpacing', 'stroke', 'lineWidth'],
  rect: ['w', 'h', 'radius', 'fill', 'stroke', 'lineWidth', 'start', 'end'],
  circle: ['size', 'fill', 'stroke', 'lineWidth', 'start', 'end'],
  line: ['stroke', 'lineWidth', 'start', 'end', 'fill'],
  path: ['stroke', 'lineWidth', 'start', 'end', 'fill'],
  polygon: ['size', 'fill', 'stroke', 'lineWidth', 'radius'],
  image: ['w', 'h', 'radius', 'zoom', 'panX', 'panY'],
  video: ['w', 'h', 'radius', 'zoom', 'panX', 'panY'],
  logo: [],
  group: [],
  stack: ['w', 'h', 'fill', 'radius'],
  repeat: [],
};
const TRANSFORM: AnimProp[] = ['x', 'y', 'rotation', 'scale', 'scaleX', 'scaleY', 'opacity', 'skewX', 'blur'];

export interface NodeInfo {
  type: MotionNode['type'];
  /** Nœud posé par une pile (x, y ignorés). */
  inStack: boolean;
  /** Morceaux (split, repeat) : leur nombre (inconnu = -1, découpe faite à l'exécution). */
  parts?: number;
  /** Type des morceaux (repeat : type de l'item ; split : texte). */
  partType?: MotionNode['type'];
}

/** Lit la réponse d'un modèle : le JSON du programme (bloc ```json, ou premier objet), tolérant aux virgules finales et commentaires. */
export function parseProgram(raw: string): { program?: unknown; error?: string } {
  const text = String(raw || '');
  const block = text.match(/```(?:json|jsonc|json5)?\s*\n([\s\S]*?)```/i);
  let body = block ? block[1] : text;
  const first = body.indexOf('{');
  const last = body.lastIndexOf('}');
  if (first < 0 || last <= first) return { error: 'aucun objet JSON dans la réponse' };
  body = body.slice(first, last + 1);
  const attempts = [body, body.replace(/\/\/[^\n"]*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/,(\s*[}\]])/g, '$1')];
  for (const candidate of attempts) {
    try {
      return { program: JSON.parse(candidate) };
    } catch (error) {
      if (candidate === attempts[attempts.length - 1]) return { error: `JSON illisible : ${(error as Error).message.slice(0, 160)}` };
    }
  }
  return { error: 'JSON illisible' };
}

export function validateProgram(input: unknown, ctx: ValidationContext): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, errors: ['le programme doit être un objet { bg, enter, nodes, timeline }'], warnings };
  const p = JSON.parse(JSON.stringify(input)) as Record<string, unknown>;
  for (const k of Object.keys(p)) if (!['bg', 'enter', 'nodes', 'timeline'].includes(k)) {
    warnings.push(`clé inconnue « ${k} » ignorée`);
    delete p[k];
  }
  if (!Array.isArray(p.nodes)) errors.push('« nodes » doit être une liste');
  if (p.timeline === undefined) p.timeline = [];
  if (!Array.isArray(p.timeline)) errors.push('« timeline » doit être une liste');
  if (p.bg !== undefined) checkFill(p.bg, 'bg', errors);
  if (p.enter !== undefined) {
    const e = p.enter as Record<string, unknown>;
    if (!e || typeof e !== 'object' || !['fade', 'slide', 'zoom', 'none'].includes(String(e.type))) errors.push('enter.type : fade | slide | zoom | none');
    else if (e.dir !== undefined && !['left', 'right', 'up', 'down'].includes(String(e.dir))) errors.push('enter.dir : left | right | up | down');
  }
  if (errors.length) return { ok: false, errors, warnings };

  const info = new Map<string, NodeInfo>();
  const dropped = new Set<string>();
  let count = 0;
  const walk = (raw: unknown, where: string, inStack: boolean, scope: { i?: number; n?: number; v?: number }, inRepeat: boolean) => {
    if (++count > MAX_NODES) {
      if (count === MAX_NODES + 1) errors.push(`trop de nœuds (plus de ${MAX_NODES})`);
      return;
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return void errors.push(`${where} : un nœud doit être un objet`);
    const n = raw as Record<string, unknown>;
    const type = String(n.type);
    if (!NODE_TYPES.includes(type as MotionNode['type'])) return void errors.push(`${where} : type inconnu « ${n.type} » (${NODE_TYPES.join(', ')})`);
    const label = n.id ? `${where} (${n.id})` : where;
    for (const k of Object.keys(n)) if (!COMMON.includes(k) && !PROPS[type].includes(k)) {
      warnings.push(`${label} : propriété « ${k} » inconnue pour ${type}, ignorée`);
      delete n[k];
    }
    if (n.id !== undefined) {
      if (typeof n.id !== 'string' || !ID.test(n.id) || n.id === 'world') errors.push(`${label} : id invalide (lettres, chiffres, _ ou -, pas « world »)`);
      else if (inRepeat) warnings.push(`${label} : l'id d'un item de répétition est ignoré (ciblez « idDeLaRépétition.* » ou « .2 »)`);
      else if (info.has(n.id)) errors.push(`${label} : id en double`);
    }
    for (const k of LENGTH_KEYS) if (n[k] !== undefined && n[k] !== 'fit') {
      const e = exprError(n[k], 'length', scope, AXIS[k] || 'u');
      if (e) errors.push(`${label}.${k} : ${e}`);
    }
    if (n.size !== undefined && n.size !== 'fit') {
      const e = exprError(n.size, 'length', scope);
      if (e) errors.push(`${label}.size : ${e}`);
    }
    if (n.anchor !== undefined && !ANCHORS.includes(String(n.anchor))) errors.push(`${label}.anchor : ${ANCHORS.join(' | ')}`);
    for (const k of ['rotation', 'scale', 'scaleX', 'scaleY', 'opacity', 'z', 'blur', 'skewX', 'weight', 'maxSize', 'lines', 'letterSpacing', 'lineHeight', 'lineWidth', 'start', 'end', 'zoom', 'panX', 'panY', 'sides', 'cols', 'count']) {
      if (n[k] === undefined || (typeof n[k] === 'number' && Number.isFinite(n[k] as number))) continue;
      // Un calcul constant (« 0.4*2 ») devient sa valeur ; le reste est ignoré (et dit) : jamais un refus.
      const value = constValue(n[k], scope);
      if (value !== null && Number.isFinite(value)) n[k] = value;
      else {
        warnings.push(`${label}.${k} : un nombre est attendu, « ${n[k]} » ignoré`);
        delete n[k];
      }
    }
    for (const k of ['fill', 'color']) if (n[k] !== undefined) checkFill(n[k], `${label}.${k}`, errors);
    if (n.stroke !== undefined) checkColor(n.stroke, `${label}.stroke`, errors);
    if (n.on !== undefined) checkColor(n.on, `${label}.on`, errors);
    if (n.shadow !== undefined) {
      const s = n.shadow as Record<string, unknown>;
      if (!s || typeof s !== 'object') errors.push(`${label}.shadow : { color, blur, x, y }`);
      else if (s.color !== undefined) checkColor(s.color, `${label}.shadow.color`, errors);
    }
    if (n.dash !== undefined && (!Array.isArray(n.dash) || !(n.dash as unknown[]).every((d) => typeof d === 'number'))) errors.push(`${label}.dash : une liste de nombres`);

    let parts: number | undefined;
    let partType: MotionNode['type'] | undefined;
    switch (type) {
      case 'text': {
        const t = n.text;
        if (typeof t !== 'string' || !t.trim()) errors.push(`${label}.text : « $clé » d'un texte de la scène`);
        else if (t.startsWith('$')) {
          if (!ctx.texts.includes(t.slice(1))) errors.push(`${label}.text : « ${t} » n'existe pas (textes de la scène : ${ctx.texts.map((k) => `$${k}`).join(', ') || 'aucun'})`);
        } else if (ctx.values && Object.values(ctx.values).some((v) => norm(v) === norm(t))) {
          // Le texte de la scène écrit en clair (au lieu de sa clé) : remplacé par sa clé, et c'est dit.
          const key = Object.entries(ctx.values).find(([, v]) => norm(v) === norm(t))![0];
          warnings.push(`${label}.text : texte écrit en clair, remplacé par « $${key} »`);
          n.text = `$${key}`;
        } else if (!LITERAL_OK.test(t.trim()) && inRepeat) errors.push(`${label}.text : un texte s'écrit « $clé » (textes : ${ctx.texts.map((k) => `$${k}`).join(', ') || 'aucun'})`);
        else if (!LITERAL_OK.test(t.trim())) {
          // Un texte qui n'est pas un texte de la scène n'est jamais affiché (rien d'inventé) : le nœud est retiré, et c'est dit.
          warnings.push(`${label}.text : « ${t.slice(0, 40)} » n'est pas un texte de la scène (${ctx.texts.map((k) => `$${k}`).join(', ') || 'aucun'}) : nœud retiré`);
          n._drop = true;
          if (typeof n.id === 'string') dropped.add(n.id);
          return;
        }
        // Un espacement très négatif écrase les lettres les unes sur les autres : borné (le resserrement léger reste possible).
    if (typeof n.letterSpacing === 'number' && n.letterSpacing < -0.3) {
      warnings.push(`${label}.letterSpacing : ${n.letterSpacing} écraserait les lettres, ramené à -0.3`);
      n.letterSpacing = -0.3;
    }
    if (n.size === 'fit' && n.width === undefined) errors.push(`${label} : size "fit" demande une largeur (width)`);
        if (n.font !== undefined && !['display', 'body'].includes(String(n.font))) errors.push(`${label}.font : display | body`);
        if (n.align !== undefined && !['left', 'center', 'right'].includes(String(n.align))) errors.push(`${label}.align : left | center | right`);
        if (n.split !== undefined) {
          if (!['words', 'chars'].includes(String(n.split))) errors.push(`${label}.split : words | chars`);
          else if (inStack) errors.push(`${label} : un texte découpé (split) ne peut pas être dans une pile (stack)`);
          else {
            parts = -1;
            partType = 'text';
          }
        }
        break;
      }
      case 'line':
        if (!Array.isArray(n.points) || (n.points as unknown[]).length < 2) errors.push(`${label}.points : au moins deux points [x, y]`);
        else (n.points as unknown[]).forEach((pt, k) => {
          if (!Array.isArray(pt) || pt.length !== 2) return void errors.push(`${label}.points[${k}] : [x, y]`);
          for (const c of pt) {
            const e = exprError(c, 'length', scope, pt.indexOf(c) === 0 ? 'x' : 'y');
            if (e) errors.push(`${label}.points[${k}] : ${e}`);
          }
        });
        break;
      case 'path':
        if (typeof n.d !== 'string' || !/^\s*[Mm]/.test(n.d) || /[^MmLlHhVvCcSsQqTtAaZz\d\s.,eE+-]/.test(n.d)) errors.push(`${label}.d : données de tracé SVG (commencent par M ; seulement M L H V C S Q T A Z et des nombres)`);
        break;
      case 'polygon':
        if (typeof n.sides !== 'number' || n.sides < 3 || n.sides > 24) errors.push(`${label}.sides : 3 à 24`);
        break;
      case 'image':
      case 'video': {
        const m = n.media;
        if (typeof m !== 'number' || !Number.isInteger(m) || m < 0 || m >= ctx.media.length) errors.push(`${label}.media : rang d'un média de la scène (${ctx.media.length ? `0 à ${ctx.media.length - 1}` : 'cette scène n\'a aucun média'})`);
        else if (ctx.media[m] !== type) errors.push(`${label} : le média ${m} est ${ctx.media[m] === 'video' ? 'un clip (type video)' : 'une image (type image)'}`);
        if (n.fit !== undefined && !['cover', 'contain'].includes(String(n.fit))) errors.push(`${label}.fit : cover | contain`);
        break;
      }
      case 'logo':
        if (!ctx.hasLogo) errors.push(`${label} : la marque n'a pas de logo (n'utilisez pas de nœud logo)`);
        break;
      case 'stack':
        if (n.dir !== undefined && !['row', 'column', 'auto'].includes(String(n.dir))) errors.push(`${label}.dir : row | column | auto`);
        if (n.align !== undefined && !['start', 'center', 'end'].includes(String(n.align))) errors.push(`${label}.align : start | center | end`);
        if (n.justify !== undefined && !['start', 'center', 'end', 'space-between'].includes(String(n.justify))) errors.push(`${label}.justify : start | center | end | space-between`);
        break;
      case 'repeat': {
        const data = n.data;
        if (data !== undefined && (!Array.isArray(data) || !(data as unknown[]).every((d) => typeof d === 'number' && Number.isFinite(d)))) errors.push(`${label}.data : une liste de nombres`);
        const total = Array.isArray(data) ? data.length : typeof n.count === 'number' ? Math.floor(n.count) : 0;
        if (total < 1 || total > MAX_REPEAT) errors.push(`${label} : count (ou data) entre 1 et ${MAX_REPEAT}`);
        if (n.layout !== undefined && !['grid', 'row', 'column', 'circle', 'free'].includes(String(n.layout))) errors.push(`${label}.layout : grid | row | column | circle | free`);
        if (!n.item || typeof n.item !== 'object') errors.push(`${label}.item : le nœud à répéter`);
        else if (total >= 1 && total <= MAX_REPEAT) {
          // L'item est vérifié avec la première et la dernière copie (les expressions lisent i, n, v).
          const sample = (k: number) => ({ i: k, n: total, v: Array.isArray(data) ? (data as number[])[k] : 0 });
          walk(n.item, `${label}.item`, false, sample(0), true);
          if (total > 1) {
            const before = errors.length;
            walk(JSON.parse(JSON.stringify(n.item)), `${label}.item`, false, sample(total - 1), true);
            errors.splice(before, errors.length - before, ...new Set(errors.slice(before)));
          }
          parts = total;
          partType = (n.item as { type: MotionNode['type'] }).type;
        }
        break;
      }
    }
    // Un texte découpé est un groupe (ses morceaux sont des textes) : sa couleur ou sa taille s'animent sur « id.* ».
    const kind = (type === 'text' && parts !== undefined ? 'group' : type) as MotionNode['type'];
    if (typeof n.id === 'string' && ID.test(n.id) && !inRepeat && !info.has(n.id)) info.set(n.id, { type: kind, inStack, ...(parts !== undefined ? { parts, partType } : {}) });
    if (Array.isArray(n.children)) (n.children as unknown[]).forEach((c, k) => walk(c, `${label}.children[${k}]`, type === 'stack', scope, inRepeat));
    else if (n.children !== undefined) errors.push(`${label}.children : une liste de nœuds`);
    if (['group', 'stack'].includes(type) && !Array.isArray(n.children)) errors.push(`${label}.children : une liste de nœuds`);
  };
  (p.nodes as unknown[]).forEach((n, k) => walk(n, `nodes[${k}]`, false, {}, false));

  let sfx = 0;
  (p.timeline as unknown[]).forEach((raw, k) => {
    const where = `timeline[${k}]`;
    if (!raw || typeof raw !== 'object') return void errors.push(`${where} : un pas doit être un objet`);
    const s = raw as Record<string, unknown>;
    for (const key of Object.keys(s)) if (!['at', 'target', 'dur', 'ease', 'from', 'to', 'stagger', 'order', 'repeat', 'effect', 'sfx'].includes(key)) {
      warnings.push(`${where} : clé « ${key} » inconnue, ignorée`);
      delete s[key];
    }
    if (s.at === undefined) s.at = 0;
    const atErr = exprError(s.at, 'time');
    if (atErr) errors.push(`${where}.at : ${atErr}`);
    else {
      const at = typeof s.at === 'number' ? s.at : null;
      if (at !== null && (at < 0 || at >= ctx.duration)) warnings.push(`${where} : at=${at} hors de la scène (0 à ${ctx.duration.toFixed(2)} s)`);
    }
    if (s.dur !== undefined) {
      const e = exprError(s.dur, 'time');
      if (e) errors.push(`${where}.dur : ${e}`);
      else if (typeof s.dur === 'number' && (s.dur < 0 || s.dur > 60)) errors.push(`${where}.dur : secondes (0 à 60)`);
    }
    if (s.stagger !== undefined && (typeof s.stagger !== 'number' || s.stagger < 0 || s.stagger > 5)) errors.push(`${where}.stagger : secondes (0 à 5)`);
    if (typeof s.ease === 'string') s.ease = normalizeEase(s.ease);
    if (s.ease !== undefined && !EASES.includes(s.ease as never)) {
      warnings.push(`${where}.ease : courbe « ${s.ease} » inconnue, outCubic utilisée`);
      delete s.ease;
    }
    if (s.order !== undefined && !['forward', 'reverse', 'center'].includes(String(s.order))) errors.push(`${where}.order : forward | reverse | center`);
    if (s.repeat !== undefined && !['loop', 'yoyo'].includes(String(s.repeat))) errors.push(`${where}.repeat : loop | yoyo`);
    if (s.sfx !== undefined) {
      // Un effet sonore n'est jamais une raison de refuser un programme : alias reconnus, le reste ignoré (et dit).
      const kind = normalizeSfx(String(s.sfx));
      if (!kind) {
        warnings.push(`${where} : effet sonore « ${s.sfx} » inconnu, ignoré (${SFX_KINDS.join(', ')})`);
        delete s.sfx;
      } else if (++sfx > 2) {
        warnings.push(`${where} : plus de deux effets sonores, « ${s.sfx} » ignoré`);
        delete s.sfx;
      } else s.sfx = kind;
      if (s.target === undefined) {
        if (s.sfx === undefined) s._drop = true;
        return;
      }
    }
    if (s.target === undefined) return void errors.push(`${where} : « target » manquant (ou « sfx » seul)`);
    const targets = Array.isArray(s.target) ? s.target : [s.target];
    const resolved: { id: string; info: NodeInfo | null; part: boolean }[] = [];
    for (const t of targets) {
      if (typeof t !== 'string') {
        errors.push(`${where}.target : un nom de nœud`);
        continue;
      }
      if (t === 'world') {
        resolved.push({ id: t, info: null, part: false });
        continue;
      }
      const m = /^([A-Za-z_][\w-]*)(?:\.(\*|\d+))?$/.exec(t);
      const node = m ? info.get(m[1]) : undefined;
      if (m && !node && dropped.has(m[1])) continue;
      if (!m || !node) {
        errors.push(`${where}.target : « ${t} » n'existe pas (ids : ${[...info.keys()].slice(0, 30).join(', ') || 'aucun'}${[...info.keys()].length > 30 ? '…' : ''})`);
        continue;
      }
      if (m[2] !== undefined) {
        if (node.parts === undefined) {
          errors.push(`${where}.target : « ${t} » — seuls un texte découpé (split) ou une répétition ont des morceaux`);
          continue;
        }
        if (m[2] !== '*' && node.parts >= 0 && Number(m[2]) >= node.parts) {
          errors.push(`${where}.target : « ${t} » — ${m[1]} n'a que ${node.parts} morceaux (0 à ${node.parts - 1})`);
          continue;
        }
        resolved.push({ id: t, info: { type: node.partType!, inStack: false }, part: true });
      } else resolved.push({ id: t, info: node, part: false });
    }
    if (s.effect !== undefined) {
      if (!['count', 'type'].includes(String(s.effect))) errors.push(`${where}.effect : count | type`);
      else for (const r of resolved) if (r.info && (r.info.type !== 'text' || r.part || r.info.parts !== undefined)) errors.push(`${where} : l'effet « ${s.effect} » s'applique à un texte entier (non découpé) — « ${r.id} » ne l'est pas`);
    }
    for (const key of ['from', 'to'] as const) {
      const values = s[key];
      if (values === undefined) continue;
      if (!values || typeof values !== 'object' || Array.isArray(values)) {
        errors.push(`${where}.${key} : un objet { propriété: valeur }`);
        continue;
      }
      for (const [prop, value] of Object.entries(values as Record<string, unknown>)) {
        // Une propriété sans effet est ignorée (et dite) : elle ne vaut jamais un refus du programme.
        if (!ANIM_PROPS.includes(prop as AnimProp)) {
          warnings.push(`${where}.${key}.${prop} : propriété non animable, ignorée`);
          delete (values as Record<string, unknown>)[prop];
          continue;
        }
        const useless = resolved.filter((r) => {
          const allowed = r.id === 'world' ? ['x', 'y', 'rotation', 'scale', 'opacity', 'blur'] : [...TRANSFORM, ...ANIMATABLE[r.info!.type]];
          return !allowed.includes(prop) || (r.info?.inStack && (prop === 'x' || prop === 'y'));
        });
        if (useless.length) warnings.push(`${where} : « ${prop} » n'a pas d'effet sur ${useless.map((r) => `« ${r.id} »${r.info?.inStack ? ' (posé par une pile)' : ''}`).join(', ')}, ignoré`);
        if (resolved.length && useless.length === resolved.length) {
          delete (values as Record<string, unknown>)[prop];
          continue;
        }
        if (prop === 'fill' || prop === 'stroke') {
          checkColor(value, `${where}.${key}.${prop}`, errors);
          continue;
        }
        const rel = relative(value);
        const e = exprError(rel ? rel.expr : value, 'length', {}, AXIS[prop] || 'u');
        if (e) errors.push(`${where}.${key}.${prop} : ${e}`);
        else if (!['x', 'y', 'w', 'h', 'size', 'radius', 'panX', 'panY'].includes(prop) && !rel && constValue(value) === null) errors.push(`${where}.${key}.${prop} : un nombre est attendu`);
      }
    }
    if (s.to === undefined && s.effect === undefined && s.from === undefined) errors.push(`${where} : « to » (ou « effect ») manquant`);
    if (s.to === undefined && s.from !== undefined) s.to = {};
  });

  p.timeline = (p.timeline as Record<string, unknown>[]).filter((s) => !s || !s._drop);
  if (!errors.length) {
    const used = new Set<string>();
    const twice = new Set<string>();
    const scan = (n: unknown) => {
      if (!n || typeof n !== 'object') return;
      const o = n as Record<string, unknown>;
      if (o.type === 'text' && typeof o.text === 'string' && o.text.startsWith('$')) {
        if (used.has(o.text.slice(1))) {
          twice.add(o.text.slice(1));
          o._drop = true;
          if (typeof o.id === 'string') dropped.add(o.id);
        }
        used.add(o.text.slice(1));
      }
      if (Array.isArray(o.children)) o.children.forEach(scan);
      if (o.item) scan(o.item);
    };
    (p.nodes as unknown[]).forEach(scan);
    // Le même texte affiché par deux nœuds se lit deux fois à l'écran (doublon, écho involontaire).
    for (const k of twice) warnings.push(`« $${k} » était affiché par deux nœuds texte : le second est retiré`);
        const missing = ctx.texts.filter((k) => !used.has(k));
    if (missing.length) warnings.push(`textes de la scène non affichés : ${missing.map((k) => `$${k}`).join(', ')}`);
  }
  // Les médias de la scène sont le choix du storyboard : un programme qui n'en montre aucun reçoit le premier (une
  // vidéo de préférence) en fond plein cadre, avec un lent travelling — et c'est dit.
  if (!errors.length && ctx.media.length && !/"type":"(image|video)"/.test(JSON.stringify(p.nodes))) {
    const index = Math.max(0, ctx.media.indexOf('video'));
    const kind = ctx.media[index];
    (p.nodes as unknown[]).unshift({ id: '__media', type: kind, media: index, w: 'W', h: 'H', fit: 'cover', zoom: 1.08 });
    (p.timeline as unknown[]).push({ at: 0, target: '__media', dur: 'D', ease: 'linear', to: { zoom: 1 } });
    warnings.push(`aucun média de la scène n'était montré : le média ${index} (${kind}) est posé en fond plein cadre`);
  }
  // Les nœuds retirés (texte inventé, doublon) disparaissent, et les pas qui ne visaient qu'eux avec.
  if (!errors.length && dropped.size + JSON.stringify(p.nodes).split('"_drop":true').length > 1) {
    const strip = (list: unknown[]): unknown[] =>
      list
        .filter((n) => !(n && typeof n === 'object' && (n as Record<string, unknown>)._drop))
        .map((n) => {
          const o = n as Record<string, unknown>;
          if (o && Array.isArray(o.children)) o.children = strip(o.children);
          return o;
        });
    p.nodes = strip(p.nodes as unknown[]);
    p.timeline = (p.timeline as Record<string, unknown>[])
      .map((st) => {
        if (!st.target) return st;
        const list = (Array.isArray(st.target) ? st.target : [st.target]).filter((t) => !dropped.has(String(t).split('.')[0]));
        if (!list.length) return null;
        return { ...st, target: Array.isArray(st.target) ? list : list[0] };
      })
      .filter(Boolean);
  }
  return { ok: !errors.length, errors: [...new Set(errors)].slice(0, 25), warnings: [...new Set(warnings)].slice(0, 25), ...(errors.length ? {} : { program: p as unknown as MotionProgram }) };
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const TOKEN = /^(primary|secondary|accent|background|text|ink|muted|gray|grey|white|black|transparent|on-(primary|secondary|accent|background|text))(\/\d{1,3})?$/;

/** Les noms de courbes que les modèles écrivent d'instinct (easeOutCubic, ease-out, EaseInOut…) → ceux du langage. */
export function normalizeEase(raw: string): string {
  const k = raw.replace(/[\s_-]/g, '').replace(/^ease/i, '').toLowerCase();
  const table: Record<string, string> = { '': 'inOut', linear: 'linear', in: 'in', out: 'out', inout: 'inOut', incubic: 'inCubic', outcubic: 'outCubic', inoutcubic: 'inOutCubic', outquart: 'outQuart', inquart: 'inCubic', inoutquart: 'inOutCubic', outexpo: 'outExpo', inoutexpo: 'inOutExpo', inexpo: 'inCubic', outback: 'outBack', inoutback: 'inOutBack', inback: 'inCubic', outelastic: 'outElastic', outbounce: 'outBounce', inoutsine: 'inOutSine', outsine: 'out', insine: 'in', outquad: 'out', inquad: 'in', inoutquad: 'inOut', outquint: 'outQuart', outcirc: 'outCubic', spring: 'outBack', bounce: 'outBounce', elastic: 'outElastic' };
  return table[k] ?? raw;
}

/** Les noms d'effets sonores que les modèles écrivent d'instinct → ceux de la sonothèque, ou null. */
export function normalizeSfx(raw: string): string | null {
  const k = raw.toLowerCase().replace(/[\s_-]/g, '');
  if ((SFX_KINDS as string[]).includes(k)) return k;
  const table: Record<string, string> = { swoosh: 'whoosh', swish: 'whoosh', woosh: 'whoosh', whooshsoft: 'softwhoosh', soft: 'softwhoosh', air: 'softwhoosh', ding: 'shimmer', chime: 'shimmer', bling: 'shimmer', sparkle: 'shimmer', magic: 'shimmer', boom: 'impact', hit: 'impact', thud: 'impact', bass: 'impact', drop: 'impact', tap: 'click', type: 'click', typing: 'click', keyboard: 'click', blip: 'pop', bubble: 'pop', plop: 'pop', rise: 'riser', build: 'riser', buildup: 'riser', uplifter: 'riser', tic: 'tick', clock: 'tick', ticktock: 'tick' };
  return table[k] ?? null;
}

export function checkColor(value: unknown, where: string, errors: string[]): void {
  if (typeof value !== 'string') return void errors.push(`${where} : une couleur (primary, secondary, accent, background, text, ink, on-primary…, #hex, « primary/40 »)`);
  const v = value.trim();
  if (HEX.test(v) || TOKEN.test(v) || /^#([0-9a-f]{6})\/\d{1,3}$/i.test(v)) return;
  errors.push(`${where} : couleur inconnue « ${value} » (primary, secondary, accent, background, text, ink, on-primary…, #hex, « primary/40 »)`);
}

function checkFill(value: unknown, where: string, errors: string[]): void {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const g = value as Record<string, unknown>;
    checkColor(g.from, `${where}.from`, errors);
    checkColor(g.to, `${where}.to`, errors);
    if (g.angle !== undefined && typeof g.angle !== 'number') errors.push(`${where}.angle : degrés`);
    return;
  }
  checkColor(value, where, errors);
}

export type { MotionStep };
