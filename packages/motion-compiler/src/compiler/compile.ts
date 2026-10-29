/**
 * LE COMPILATEUR — un programme du langage de mouvement → une scène Motion Canvas (TSX), déterministe.
 *
 * Le code produit respecte exactement le contrat d'une scène du moteur (`export default function*
 * (view, ctx)`, trois modules) : il entre dans le harnais, le contrôle, l'aperçu et le rendu existants
 * sans rien changer. Il est fait de trois parties lisibles :
 *
 *   1. l'ARBRE des nœuds, en JSX explicite (unités converties, textes lus dans `ctx.texts`, médias
 *      dans `ctx.media`, couleurs dans `ctx.brand`) ;
 *   2. la PISTE : chaque pas devient une tâche lancée à son instant (`yield delay(at, …)`), le fil
 *      principal reste vivant jusqu'à la fin de la scène (un fil parent qui se termine coupe ses enfants) ;
 *   3. un petit MOTEUR DE PISTE embarqué (quelques fonctions) qui relie une propriété du langage au signal
 *      Motion Canvas du nœud, convertit les unités et gère les valeurs relatives.
 *
 * Le compilateur ne décide RIEN de l'apparence : il traduit. Les seules valeurs qu'il pose seul sont des
 * défauts documentés (taille d'un texte, couleur d'une forme sans remplissage…), identiques partout.
 * Le programme source est gardé en tête du fichier (`@idem-motion-program`) : retoucher une scène, c'est
 * retoucher son programme.
 */
import type { AnimProp, Fill, MotionNode, MotionProgram, MotionStep, RepeatNode, TextNode, TypeLevel } from '../dsl/types';
import { DUR_TOKENS, EASE_TOKENS, STAGGER_TOKENS, TYPE_LEVELS } from '../dsl/types';
import { Axis, exprCode, ExprScope, relative } from '../dsl/expr';

/**
 * 0.3.0 — les valeurs NOMMÉES du système de design (`ctx.design` : niveaux, durées, courbes, décalages, rôles de
 * couleur), les lignes équilibrées (Knuth-Plass), le recadrage sur le sujet, le temps de lecture garanti dans la piste
 * mise à l'échelle, la piste RÉSOLUE (`timing: "solved"`, écrite par le solveur) respectée telle quelle, les coutures
 * entre scènes jouées sur une enveloppe, les sons de transition planifiés par le film.
 */
export const COMPILER_VERSION = '0.3.0';
export const PROGRAM_MARK = '@idem-motion-program';

const EASE_CODE: Record<string, string> = {
  linear: 'linear', in: 'easeInCubic', out: 'easeOutCubic', inOut: 'easeInOutCubic', inCubic: 'easeInCubic', outCubic: 'easeOutCubic',
  inOutCubic: 'easeInOutCubic', outQuart: 'easeOutQuart', outExpo: 'easeOutExpo', inOutExpo: 'easeInOutExpo', outBack: 'easeOutBack',
  inOutBack: 'easeInOutBack', outElastic: 'easeOutElastic', outBounce: 'easeOutBounce', inOutSine: 'easeInOutSine',
};
const ANCHOR: Record<string, [number, number]> = {
  center: [0, 0], left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1], 'top-left': [-1, -1], 'top-right': [1, -1], 'bottom-left': [-1, 1], 'bottom-right': [1, 1],
};

interface Target {
  /** Expression qui rend la liste des poignées `{ n, i?, t }` à l'exécution. */
  handles: string;
  type: MotionNode['type'];
}

/** Ce que la compilation a besoin de savoir pendant la descente dans l'arbre. */
class Emitter {
  refs: string[] = [];
  pre: string[] = [];
  post: string[] = [];
  targets = new Map<string, Target>();
  /** Les nœuds dont le flou est animé (ils reçoivent un filtre dès leur création). */
  blurred = new Set<string>();
  /** Textes animés par un effet : count | type. */
  effects = new Map<string, 'count' | 'type' | 'point'>();
  /** Les clés de texte que porte chaque nœud nommé (temps de lecture des pas qui le révèlent). */
  textKeys = new Map<string, string[]>();
  counter = 0;
  uid(prefix: string): string {
    return `${prefix}${++this.counter}`;
  }
}

const L = (v: unknown, scope: ExprScope = {}, axis: Axis = 'u') => `(${exprCode(v, 'length', scope, axis)}) * U`;
/** Un instant ou une durée : expression, temps de la musique (`beat:2`, `bar:1`) ou durée nommée (`medium`). */
const T = (v: unknown) => {
  const m = typeof v === 'string' ? /^(beat|bar):(\d+(?:\.\d+)?)$/.exec(v) : null;
  if (m) return `beatAt(ctx, ${m[1] === 'bar' ? Number(m[2]) * 4 : Number(m[2])})`;
  if (isDurToken(v)) return `designDur(ctx, '${v}')`;
  return `(${exprCode(v, 'time')})`;
};
const safeId = (id: string) => id.replace(/-/g, '_');
const num = (n: number) => String(Math.round(n * 1000) / 1000);

/** Les rôles de couleur du système de design (noms acceptés → nom du rôle). */
const DESIGN_ROLES: Record<string, string> = {
  ground: 'ground', surface: 'surface', surfacestrong: 'surfaceStrong', 'surface-strong': 'surfaceStrong', inkmuted: 'inkMuted', 'ink-muted': 'inkMuted', line: 'line',
  onprimary: 'onPrimary', onsecondary: 'onSecondary', onaccent: 'onAccent', highlight: 'highlight', onhighlight: 'onHighlight', 'on-highlight': 'onHighlight', neutral: 'neutral', onneutral: 'onNeutral', 'on-neutral': 'onNeutral',
};

export function colorCode(value: string, bg = 'BG'): string {
  const v = value.trim();
  const [base, op] = v.split('/');
  let code: string;
  const role = DESIGN_ROLES[base] || DESIGN_ROLES[base.toLowerCase()];
  if (/^#/.test(base)) code = JSON.stringify(base);
  else if (base === 'ink') code = `readableOn(${bg}, KI)`;
  else if (base === 'muted' || base === 'gray' || base === 'grey') code = op === undefined ? `MUTED(${bg})` : `readableOn(${bg}, KI)`;
  else if (base === 'white') code = `'#ffffff'`;
  else if (base === 'black') code = `'#111418'`;
  else if (base === 'transparent') return `'rgba(0, 0, 0, 0)'`;
  else if (base === 'on-surface') code = `readableOn(DC('surface'), KI)`;
  else if (role) code = `DC('${role}')`;
  else if (base.startsWith('on-')) code = `ON('${base.slice(3)}')`;
  else code = `K.${base}`;
  return op !== undefined ? `alpha(${code}, ${num(Math.min(100, Number(op)) / 100)})` : code;
}

const isLevel = (v: unknown): v is TypeLevel => typeof v === 'string' && (TYPE_LEVELS as string[]).includes(v);
const isDurToken = (v: unknown) => typeof v === 'string' && (DUR_TOKENS as string[]).includes(v);
const isStaggerToken = (v: unknown) => typeof v === 'string' && (STAGGER_TOKENS as string[]).includes(v);
const isEaseToken = (v: unknown) => typeof v === 'string' && (EASE_TOKENS as string[]).includes(v);

function fillCode(fill: Fill | undefined, w: string, h: string, fallback?: string): string | undefined {
  if (fill === undefined) return fallback;
  if (typeof fill === 'string') return colorCode(fill);
  return `GR(${colorCode(fill.from)}, ${colorCode(fill.to)}, ${num(fill.angle ?? 0)}, ${w}, ${h})`;
}

function hasMedia(n: MotionNode): boolean {
  if (n.type === 'image' || n.type === 'video' || n.type === 'logo') return true;
  const kids = (n as { children?: MotionNode[] }).children;
  return !!kids?.some(hasMedia) || (n.type === 'repeat' && hasMedia(n.item));
}

function hasText(n: MotionNode): boolean {
  if (n.type === 'text') return true;
  const kids = (n as { children?: MotionNode[] }).children;
  return !!kids?.some(hasText);
}

/** Les propriétés communes d'un nœud (position, transformation, ombre, flou). */
function common(n: MotionNode, scope: ExprScope, e: Emitter, key: string | undefined, inStack: boolean, offset?: { x: string; y: string }, skipPosition = false): string[] {
  const out: string[] = [];
  if (!inStack && !skipPosition) {
    const x = n.x !== undefined ? L(n.x, scope, 'x') : '0';
    const y = n.y !== undefined ? L(n.y, scope, 'y') : '0';
    const ox = offset ? `${offset.x} + ${x}` : x;
    const oy = offset ? `${offset.y} + ${y}` : y;
    if (ox !== '0') out.push(`x={${ox}}`);
    if (oy !== '0') out.push(`y={${oy}}`);
  }
  if (n.rotation !== undefined) out.push(`rotation={${num(n.rotation)}}`);
  if (n.scaleX !== undefined || n.scaleY !== undefined) out.push(`scale={[${num(n.scaleX ?? n.scale ?? 1)}, ${num(n.scaleY ?? n.scale ?? 1)}]}`);
  else if (n.scale !== undefined) out.push(`scale={${num(n.scale)}}`);
  if (n.opacity !== undefined) out.push(`opacity={${num(n.opacity)}}`);
  if (n.z !== undefined) out.push(`zIndex={${num(n.z)}}`);
  if (n.skewX !== undefined) out.push(`skewX={${num(n.skewX)}}`);
  if (n.blur !== undefined || (key && e.blurred.has(key))) out.push(`filters={[blur(${num(n.blur ?? 0)} * U)]}`);
  if (n.shadow) {
    out.push(`shadowColor={${colorCode(n.shadow.color ?? 'black/35')}}`, `shadowBlur={${num(n.shadow.blur ?? 3)} * U}`);
    if (n.shadow.x || n.shadow.y) out.push(`shadowOffset={[${num(n.shadow.x ?? 0)} * U, ${num(n.shadow.y ?? 1)} * U]}`);
  }
  return out;
}

function anchorProps(n: MotionNode): string[] {
  const a = n.anchor && ANCHOR[n.anchor];
  if (!a || (a[0] === 0 && a[1] === 0)) return [];
  return [...(a[0] ? [`offsetX={${a[0]}}`] : []), ...(a[1] ? [`offsetY={${a[1]}}`] : [])];
}

function strokeProps(n: { stroke?: string; lineWidth?: number; dash?: number[] }, unit = ' * U'): string[] {
  const out: string[] = [];
  if (n.stroke) out.push(`stroke={${colorCode(n.stroke)}}`, `lineWidth={${num(n.lineWidth ?? 0.4)}${unit}}`);
  else if (n.lineWidth !== undefined) out.push(`lineWidth={${num(n.lineWidth)}${unit}}`);
  if (n.dash?.length) out.push(`lineDash={[${n.dash.map((d) => `${num(d)}${unit}`).join(', ')}]}`);
  return out;
}

interface Place {
  scope: ExprScope;
  inStack: boolean;
  /** Nœud posé directement dans la scène (ni groupe, ni pile, ni répétition) : sa position est en coordonnées de l'image. */
  top?: boolean;
  offset?: { x: string; y: string };
  /** Copie d'une répétition : ses références vont dans les listes de la répétition. */
  part?: { list: string; inner: string; type: MotionNode['type'] };
}

/** Un nœud → JSX (et ses déclarations). */
function nodeJsx(n: MotionNode, e: Emitter, place: Place): string {
  const { scope, inStack, part } = place;
  const key = part ? undefined : n.id ? safeId(n.id) : undefined;
  // Une pile posée dans la scène a toujours une référence : le compilateur la garde dans le cadre (KEEP).
  const ref = key ? `r_${key}` : part ? e.uid('rr') : place.top && n.type === 'stack' ? e.uid('rs') : undefined;
  const props = common(n, scope, e, key, inStack, place.offset, n.type === 'text' && !!place.top && !inStack);
  const register = (tsType: string, inner?: { name: string; tsType: string }) => {
    if (!ref) return;
    e.refs.push(`const ${ref} = createRef<${tsType}>();`);
    if (inner) e.refs.push(`const ${inner.name} = createRef<${inner.tsType}>();`);
    if (part) e.post.push(`${part.list}.push({ n: ${ref}(), ${inner ? `i: ${inner.name}(), ` : ''}t: '${n.type}' });`);
    else if (key) e.targets.set(n.id!, { handles: `[{ n: ${ref}(), ${inner ? `i: ${inner.name}(), ` : ''}t: '${n.type}'${place.top && n.type === 'stack' && !hasMedia(n) ? ', top: true' : ''} }]`, type: n.type });
  };
  const refAttr = ref ? [`ref={${ref}}`] : [];
  const kids = (children: MotionNode[] | undefined, stack: boolean) => (children || []).map((c) => nodeJsx(c, e, { scope, inStack: stack })).join('\n');

  switch (n.type) {
    case 'text':
      return textJsx(n, e, place, key, ref, props);
    case 'rect': {
      register('Rect');
      const w = n.w !== undefined ? L(n.w, scope, 'x') : '20 * U';
      const h = n.h !== undefined ? L(n.h, scope, 'y') : '20 * U';
      const fill = fillCode(n.fill, w, h, n.stroke ? undefined : 'K.primary');
      const attrs = [...refAttr, ...props, ...anchorProps(n), `width={${w}}`, `height={${h}}`, ...(n.radius !== undefined ? [`radius={${L(n.radius, scope)}}`] : []), ...(fill ? [`fill={${fill}}`] : []), ...strokeProps(n), ...(n.clip ? ['clip'] : [])];
      return n.children?.length ? `<Rect ${attrs.join(' ')}>\n${kids(n.children, false)}\n</Rect>` : `<Rect ${attrs.join(' ')} />`;
    }
    case 'circle': {
      register('Circle');
      const s = n.size !== undefined ? L(n.size, scope) : '20 * U';
      const fill = fillCode(n.fill, s, s, n.stroke ? undefined : 'K.primary');
      const attrs = [...refAttr, ...props, ...anchorProps(n), `size={${s}}`, ...(fill ? [`fill={${fill}}`] : []), ...strokeProps(n), ...(n.start !== undefined ? [`start={${num(n.start)}}`] : []), ...(n.end !== undefined ? [`end={${num(n.end)}}`] : []), ...(n.clip ? ['clip'] : [])];
      return n.children?.length ? `<Circle ${attrs.join(' ')}>\n${kids(n.children, false)}\n</Circle>` : `<Circle ${attrs.join(' ')} />`;
    }
    case 'line': {
      register('Line');
      const pts = n.points.map(([x, y]) => `[${L(x, scope, 'x')}, ${L(y, scope, 'y')}]`).join(', ');
      const fill = n.fill !== undefined ? fillCode(n.fill, '40 * U', '40 * U') : undefined;
      const attrs = [...refAttr, ...props, `points={[${pts}]}`, `stroke={${colorCode(n.stroke ?? 'ink')}}`, `lineWidth={${num(n.lineWidth ?? 0.5)} * U}`, `lineCap={'round'}`, `lineJoin={'round'}`, ...(n.radius ? [`radius={${num(n.radius)} * U}`] : []), ...(n.arrow ? ['endArrow', `arrowSize={${num((n.lineWidth ?? 0.5) * 3.2)} * U}`] : []), ...(n.dash?.length ? [`lineDash={[${n.dash.map((d) => `${num(d)} * U`).join(', ')}]}`] : []), ...(n.start !== undefined ? [`start={${num(n.start)}}`] : []), ...(n.end !== undefined ? [`end={${num(n.end)}}`] : []), ...(n.closed ? ['closed'] : []), ...(fill ? [`fill={${fill}}`] : [])];
      return `<Line ${attrs.join(' ')} />`;
    }
    case 'path': {
      const inner = ref ? `${ref}_in` : undefined;
      register('Node', inner ? { name: inner, tsType: 'Path' } : undefined);
      const fill = n.fill !== undefined ? fillCode(n.fill, '40', '40') : undefined;
      // Le tracé est écrit en u : il est mis à l'échelle U, son épaisseur reste donc en u.
      const pathAttrs = [...(inner ? [`ref={${inner}}`] : []), `data={${JSON.stringify(n.d)}}`, `scale={U}`, ...(n.stroke || !fill ? [`stroke={${colorCode(n.stroke ?? 'ink')}}`, `lineWidth={${num(n.lineWidth ?? 0.5)}}`] : []), `lineCap={'round'}`, `lineJoin={'round'}`, ...(fill ? [`fill={${fill}}`] : []), ...(n.start !== undefined ? [`start={${num(n.start)}}`] : []), ...(n.end !== undefined ? [`end={${num(n.end)}}`] : [])];
      return `<Node ${[...refAttr, ...props].join(' ')}>\n<Path ${pathAttrs.join(' ')} />\n</Node>`;
    }
    case 'polygon': {
      register('Polygon');
      const s = n.size !== undefined ? L(n.size, scope) : '20 * U';
      const fill = fillCode(n.fill, s, s, n.stroke ? undefined : 'K.primary');
      return `<Polygon ${[...refAttr, ...props, `sides={${Math.round(n.sides)}}`, `size={${s}}`, ...(n.radius ? [`radius={${num(n.radius)} * U}`] : []), ...(fill ? [`fill={${fill}}`] : []), ...strokeProps(n)].join(' ')} />`;
    }
    case 'image':
    case 'video': {
      const inner = ref ? `${ref}_in` : e.uid('mi');
      register('Rect', ref ? { name: inner, tsType: n.type === 'video' ? 'Video' : 'Img' } : undefined);
      if (!ref) e.refs.push(`const ${inner} = createRef<${n.type === 'video' ? 'Video' : 'Img'}>();`);
      const w = n.w !== undefined ? L(n.w, scope, 'x') : 'W * U';
      const h = n.h !== undefined ? L(n.h, scope, 'y') : 'H * U';
      const m = e.uid('m');
      const fit = e.uid('fit');
      e.pre.push(`const ${m} = ctx.media[${n.media}];`, `const ${fit} = ${m} ? fitMedia(${m}, ${w}, ${h}, '${n.fit ?? 'cover'}') : { width: ${w}, height: ${h}, x: 0, y: 0 };`);
      // Un clip commence à son extrait sans coupe ni image figée (trié sur le serveur).
      if (n.type === 'video') e.post.push(`if (${m}?.startAt) ${inner}()?.seek(${m}.startAt);`, `${inner}()?.play();`);
      // Effet « point » : le média s'agrandit VERS son point d'intérêt (le clic d'une démo produit, sinon le sujet),
      // qui vient au centre du cadre — sans jamais découvrir un bord vide.
      if (n.id && e.effects.get(n.id) === 'point') {
        e.post.push(
          `const PZ_${safeId(n.id)} = (z: number, d: number, ease: any) => { const i = ${inner}(); if (!i || !${m}) return waitFor(0); const p = ${m}.point || ${m}.focus || { x: 0.5, y: 0.5 }; const bx = Math.max(0, (z * ${fit}.width - (${w})) / 2), by = Math.max(0, (z * ${fit}.height - (${h})) / 2); const tx = Math.min(bx, Math.max(-bx, -z * (p.x - 0.5) * ${fit}.width)), ty = Math.min(by, Math.max(-by, -z * (p.y - 0.5) * ${fit}.height)); return all(i.scale(z, d, ease), i.position([tx, ty], d, ease)); };`
        );
      }
      const tag = n.type === 'video' ? 'Video' : 'Img';
      // Le recadrage garde le sujet (point d'intérêt du format) ; un décalage demandé s'y ajoute.
      const innerAttrs = [`ref={${inner}}`, `src={${m}.url}`, `width={${fit}.width}`, `height={${fit}.height}`, ...(n.zoom !== undefined ? [`scale={${num(n.zoom)}}`] : []), `x={${fit}.x${n.panX ? ` + ${num(n.panX)} * U` : ''}}`, `y={${fit}.y${n.panY ? ` + ${num(n.panY)} * U` : ''}}`, ...(n.type === 'video' ? [`loop={${n.loop !== false}}`] : [])];
      const fill = fillCode(n.fill, w, h);
      const attrs = [...refAttr, ...props, ...anchorProps(n), `width={${w}}`, `height={${h}}`, ...(n.radius !== undefined ? [`radius={${L(n.radius, scope)}}`] : []), ...(fill ? [`fill={${fill}}`] : []), 'clip'];
      return `<Rect ${attrs.join(' ')}>\n{${m} && <${tag} ${innerAttrs.join(' ')} />}\n</Rect>`;
    }
    case 'logo': {
      const inner = ref ? `${ref}_in` : undefined;
      register('Node', inner ? { name: inner, tsType: 'Img' } : undefined);
      const w = n.w !== undefined ? L(n.w, scope) : '24 * U';
      const src = e.uid('logo');
      const on = colorCode(n.on ?? 'background');
      e.pre.push(`const ${src} = LOGO(${on});`);
      // Largeur seule : la hauteur suit le ratio NATUREL de l'image. Imposée d'après le SVG de la marque, elle
      // aplatissait la version « avec texte » (PNG d'un autre ratio) affichée à sa place.
      return `<Node ${[...refAttr, ...props].join(' ')}>\n{${src} && <Img ${[...(inner ? [`ref={${inner}}`] : []), `src={${src}}`, `width={${w}}`, ...anchorProps(n)].join(' ')} />}\n</Node>`;
    }
    case 'group': {
      register('Node');
      return `<Node ${[...refAttr, ...props].join(' ')}>\n${kids(n.children, false)}\n</Node>`;
    }
    case 'stack': {
      const boxed = n.fill !== undefined || n.radius !== undefined;
      register(boxed ? 'Rect' : 'Layout');
      const w = n.w !== undefined ? L(n.w, scope, 'x') : undefined;
      const h = n.h !== undefined ? L(n.h, scope, 'y') : undefined;
      const justify = n.justify === 'space-between' ? 'space-between' : n.justify === 'end' ? 'end' : n.justify === 'center' ? 'center' : 'start';
      const fill = boxed ? fillCode(n.fill, w ?? '40 * U', h ?? '20 * U') : undefined;
      const attrs = [...refAttr, ...props, ...anchorProps(n), 'layout', n.dir === 'auto' ? `direction={TALL ? 'column' : 'row'}` : `direction={'${n.dir ?? 'column'}'}`, `gap={${n.gap !== undefined ? L(n.gap, scope) : '2 * U'}}`, `alignItems={'${n.align ?? 'center'}'}`, `justifyContent={'${justify}'}`, ...(w ? [`width={${w}}`] : []), ...(h ? [`height={${h}}`] : []), ...(n.wrap ? [`wrap={'wrap'}`] : []), ...(n.padding !== undefined ? [`padding={${L(n.padding, scope)}}`] : []), ...(fill ? [`fill={${fill}}`] : []), ...(n.radius !== undefined ? [`radius={${L(n.radius, scope)}}`] : [])];
      const tag = boxed ? 'Rect' : 'Layout';
      // Mesurer une pile qui contient une image (logo, photo) lirait la taille de l'image avant son chargement (Motion
      // Canvas le signale en erreur) : ces piles-là sont laissées au contrôle d'affichage.
      if (place.top && ref && !hasMedia(n)) e.post.unshift(`KEEP(${ref}());`);
      return `<${tag} ${attrs.join(' ')}>\n${kids(n.children, true)}\n</${tag}>`;
    }
    case 'repeat':
      return repeatJsx(n, e, place, key, ref, props);
    case 'icon':
    case 'device':
      // Des macros : la validation les développe en nœuds simples (tracé, groupe) avant la compilation.
      throw new Error(`nœud « ${n.type} » non développé : passez le programme par validateProgram`);
  }
}

function repeatJsx(n: RepeatNode, e: Emitter, place: Place, key: string | undefined, ref: string | undefined, props: string[]): string {
  const data = n.data;
  const total = data ? data.length : Math.max(1, Math.floor(n.count ?? 1));
  const list = key ? `P_${key}` : e.uid('P');
  e.refs.push(`const ${list}: any[] = [];`);
  if (ref) {
    e.refs.push(`const ${ref} = createRef<Node>();`);
    if (key) {
      e.targets.set(n.id!, { handles: `[{ n: ${ref}(), t: 'repeat' }]`, type: 'repeat' });
      e.targets.set(`${n.id}.*`, { handles: list, type: n.item.type });
    }
  }
  const layout = n.layout ?? 'free';
  const gap = n.gap !== undefined ? exprCode(n.gap, 'length', place.scope) : '2';
  const cols = Math.max(1, Math.floor(n.cols ?? Math.ceil(Math.sqrt(total))));
  const rows = Math.ceil(total / cols);
  const w = n.w !== undefined ? exprCode(n.w, 'length', place.scope, 'x') : layout === 'column' ? '0' : 'SW';
  const h = n.h !== undefined ? exprCode(n.h, 'length', place.scope, 'y') : layout === 'row' ? '0' : layout === 'grid' ? 'SH * 0.5' : 'SH';
  const r = n.r !== undefined ? exprCode(n.r, 'length', place.scope) : '20';
  const items: string[] = [];
  for (let k = 0; k < total; k++) {
    const scope: ExprScope = { i: k, n: total, ...(data ? { v: data[k] } : {}) };
    let ox = '0';
    let oy = '0';
    if (layout === 'grid') {
      const col = k % cols;
      const row = Math.floor(k / cols);
      ox = `(-(${w}) / 2 + ((${w}) - (${gap}) * ${cols - 1}) / ${cols} * ${col + 0.5} + (${gap}) * ${col}) * U`;
      oy = `(-(${h}) / 2 + ((${h}) - (${gap}) * ${rows - 1}) / ${rows} * ${row + 0.5} + (${gap}) * ${row}) * U`;
    } else if (layout === 'row') ox = `(-(${w}) / 2 + (${w}) * ${num((k + 0.5) / total)}) * U`;
    else if (layout === 'column') oy = `(-(${h}) / 2 + (${h}) * ${num((k + 0.5) / total)}) * U`;
    else if (layout === 'circle') {
      const a = ((-90 + (360 * k) / total) * Math.PI) / 180;
      ox = `(${r}) * ${num(Math.cos(a))} * U`;
      oy = `(${r}) * ${num(Math.sin(a))} * U`;
    }
    const item = JSON.parse(JSON.stringify(n.item)) as MotionNode;
    delete item.id;
    if (key && [...e.blurred].some((b) => b.startsWith(`${key}.`)) && item.blur === undefined) item.blur = 0;
    items.push(nodeJsx(item, e, { scope, inStack: false, offset: { x: ox, y: oy }, part: { list, inner: '', type: n.item.type } }));
  }
  return `<Node ${[...(ref ? [`ref={${ref}}`] : []), ...props].join(' ')}>\n${items.join('\n')}\n</Node>`;
}

function textJsx(n: TextNode, e: Emitter, place: Place, key: string | undefined, ref: string | undefined, props: string[]): string {
  const { scope, part } = place;
  const v = e.uid('tx');
  const raw = n.text.startsWith('$') ? `(ctx.texts[${JSON.stringify(n.text.slice(1))}] || '')` : JSON.stringify(n.text);
  // Un NIVEAU du film (« title », « body »…) : taille, graisse, police, interlettrage et casse viennent du système.
  const level = isLevel(n.size) ? n.size : undefined;
  const heading = level === 'display' || level === 'title' || level === 'subtitle';
  const upper = n.upper !== undefined ? String(!!n.upper) : level === 'display' || level === 'title' ? '!!(DS && DS.uppercaseTitles)' : 'false';
  e.pre.push(`const ${v} = ${upper === 'false' ? raw : upper === 'true' ? `${raw}.toUpperCase()` : `(${upper} ? ${raw}.toUpperCase() : ${raw})`};`);
  const fontKind = n.font ?? (level ? (heading ? 'display' : 'body') : 'display');
  const font = `ctx.brand.fonts.${fontKind}`;
  const weight = n.weight ?? (level ? `designWeight(ctx, '${level}')` : fontKind === 'display' ? 700 : 400);
  const width = n.width !== undefined ? L(n.width, scope, 'x') : '0';
  const lh = n.lineHeight ?? (heading ? 1.08 : 1.18);
  const a = ANCHOR[n.anchor ?? 'center'];
  const align = n.align ?? (a[0] < 0 ? 'left' : a[0] > 0 ? 'right' : 'center');
  const ls = n.letterSpacing ? `${num(n.letterSpacing)} * U` : level ? `(DS ? DS.tracking.${heading ? 'title' : 'body'} : 0) * U` : '0';
  const mode = place.inStack ? 'stack' : place.top ? 'top' : 'nested';
  // LA GARANTIE D'AFFICHAGE : le texte tient dans sa boîte et (posé dans la scène) dans la zone sûre — la taille
  // demandée est un plafond, le compilateur ne la réduit que si le texte serait coupé.
  const tb = e.uid('tb');
  const fit = n.size === 'fit';
  const size = fit ? '0' : level ? `designSize(ctx, '${level}') * U` : n.size !== undefined ? L(n.size, scope) : '6 * U';
  const x = mode === 'top' ? (n.x !== undefined ? L(n.x, scope, 'x') : '0') : '0';
  const y = mode === 'top' ? (n.y !== undefined ? L(n.y, scope, 'y') : '0') : '0';
  e.pre.push(`const ${tb} = FIT(${v}, { size: ${size}, fit: ${fit}, max: ${num(n.maxSize ?? 12)} * U, lines: ${n.lines ? Math.max(1, Math.floor(n.lines)) : 0}, font: ${font}, weight: ${weight}, ls: ${ls}, lh: ${num(lh)}, width: ${width}, x: ${x}, y: ${y}, ax: ${a[0]}, ay: ${a[1]}, mode: '${mode}' });`);
  const position = mode === 'top' ? [`x={${tb}.x}`, `y={${tb}.y}`] : [];
  const fill = fillCode(n.color, `${tb}.width`, `${tb}.size * 2`, 'readableOn(BG, K.text)');
  const style = [`fontFamily={${font}}`, `fontWeight={${weight}}`, `fontSize={${tb}.size}`, `lineHeight={${tb}.size * ${num(lh)}}`, `fill={${fill}}`, ...(ls !== '0' ? [`letterSpacing={${ls}}`] : []), ...(n.italic ? [`fontStyle={'italic'}`] : []), ...(n.stroke ? [`stroke={${colorCode(n.stroke)}}`, `lineWidth={${num(n.lineWidth ?? 0.2)} * U}`, `strokeFirst`] : [])];

  if (n.split && key) {
    // Découpé : chaque mot (ou lettre) est un nœud posé à l'exécution (mesure réelle de la police, boîte garantie).
    const sp = `SP_${key}`;
    const list = `P_${key}`;
    e.pre.push(`const ${sp} = SPLIT(${v}, '${n.split}', ${tb}.size, ${font}, ${weight}, ${tb}.lines > 1 ? ${tb}.width : 0, '${align}', ${num(lh)}, ${ls}, ${a[0]}, ${a[1]});`);
    e.refs.push(`const ${ref} = createRef<Node>();`, `const ${list}r = createRefArray<Txt>();`, `const ${list}: any[] = [];`);
    e.post.push(`${list}.push(...${list}r.map((n: any) => ({ n, t: 'text' })));`);
    e.targets.set(n.id!, { handles: `[{ n: ${ref}(), t: 'group' }]`, type: 'group' });
    e.targets.set(`${n.id}.*`, { handles: list, type: 'text' });
    const blur = [...e.blurred].some((b) => b.startsWith(`${key}.`)) ? [`filters={[blur(0)]}`] : [];
    return `<Node ref={${ref}} key={'idem-split-${key}-' + ctx.key} ${[...position, ...props].join(' ')}>\n{${sp}.map((p: any) => <Txt ref={${list}r} text={p.s} x={p.x} y={p.y} ${[...style, ...blur].join(' ')} />)}\n</Node>`;
  }

  // Un texte entier (éventuellement animé par un effet : nombre qui défile, écriture).
  const effect = key ? e.effects.get(n.id!) : undefined;
  let textAttr = `text={${v}}`;
  // Le texte posé est celui des LIGNES ÉQUILIBRÉES (coupures choisies, jamais un mot orphelin).
  textAttr = `text={${tb}.text}`;
  if (effect === 'count') {
    e.refs.push(`const C_${key} = NUM(${v});`, `const S_${key} = createSignal(0);`);
    textAttr = `text={() => C_${key} ? C_${key}.pre + C_${key}.fmt(S_${key}()) + C_${key}.suf : ${tb}.text}`;
  } else if (effect === 'type') {
    e.refs.push(`const S_${key} = createSignal(0);`);
    textAttr = `text={() => ${tb}.text.slice(0, Math.round(S_${key}() * ${tb}.text.length))}`;
  }
  if (ref) {
    e.refs.push(`const ${ref} = createRef<Txt>();`);
    if (part) e.post.push(`${part.list}.push({ n: ${ref}(), t: 'text' });`);
    else if (key) e.targets.set(n.id!, { handles: `[{ n: ${ref}(), t: 'text'${mode === 'top' ? ', top: true' : ''} }]`, type: 'text' });
  }
  const attrs = [...(ref ? [`ref={${ref}}`] : []), textAttr, ...position, ...props, ...anchorProps(n), ...style, `width={${tb}.width}`, 'textWrap', `textAlign={'${align}'}`];
  return `<Txt ${attrs.join(' ')} />`;
}

// ─── La piste ────────────────────────────────────────────────────────────────

const COLOR_PROPS = new Set<AnimProp>(['fill', 'stroke']);

const PROP_AXIS: Partial<Record<AnimProp, Axis>> = { x: 'x', w: 'x', panX: 'x', y: 'y', h: 'y', panY: 'y' };

function valueCode(prop: AnimProp, value: unknown): string {
  if (COLOR_PROPS.has(prop)) return colorCode(String(value));
  const rel = relative(value);
  const axis = PROP_AXIS[prop] || 'u';
  if (rel) return `{ r: ${rel.sign < 0 ? '-' : ''}(${exprCode(rel.expr, 'length', {}, axis)}) }`;
  return `(${exprCode(value, 'length', {}, axis)})`;
}

function propsObject(values: Partial<Record<AnimProp, unknown>> | undefined): string {
  if (!values) return '{}';
  return `{ ${Object.entries(values).map(([p, v]) => `${p}: ${valueCode(p as AnimProp, v)}`).join(', ')} }`;
}

function targetHandles(step: MotionStep, e: Emitter): string {
  const list = Array.isArray(step.target) ? step.target : step.target ? [step.target] : [];
  const parts = list.map((t) => {
    if (t === 'world') return `[{ n: r_world(), t: 'group' }]`;
    const m = /^([A-Za-z_][\w-]*)(?:\.(\*|\d+))?$/.exec(t)!;
    if (m[2] === undefined) return e.targets.get(m[1])!.handles;
    const all = e.targets.get(`${m[1]}.*`)!.handles;
    return m[2] === '*' ? all : `${all}.slice(${m[2]}, ${Number(m[2]) + 1})`;
  });
  return parts.length === 1 ? parts[0] : `[${parts.map((p) => `...${p}`).join(', ')}]`;
}

/** Le nombre de cibles d'un pas (pour la durée de son décalage). */
function stepCount(step: MotionStep, e: Emitter): string {
  if (!step.target) return '1';
  if (step.effect) return String(Array.isArray(step.target) ? step.target.length : 1);
  return `(${targetHandles(step, e)}).length`;
}

/**
 * Un pas → une tâche lancée à son instant. Les instants, durées et décalages passent par la table TL :
 * la piste entière est mise à l'échelle (TS) pour finir avant la coupe en laissant le temps de lire.
 */
function stepCode(step: MotionStep, k: number, e: Emitter): string {
  const at = `AT(${k})`;
  if (step.sfx && !step.target) return `yield delay(${at}, (function* () { ctx.sfx('${step.sfx}'); })());`;
  const sfx = step.sfx ? `ctx.sfx('${step.sfx}'); ` : '';
  const dur = `DUR(${k})`;
  const ease = isEaseToken(step.ease) ? `designEase(ctx, '${step.ease}')` : EASE_CODE[step.ease ?? (step.repeat ? 'inOutSine' : 'outCubic')];
  const stagger = `TL[${k}][2] * TS`;
  const order = step.order ?? 'forward';
  if (step.effect) {
    const ids = (Array.isArray(step.target) ? step.target : [step.target!]).map((t) => safeId(t));
    const zoom = typeof step.to?.zoom === 'number' ? Math.min(2.6, Math.max(1.1, step.to.zoom)) : 1.7;
    const anims = ids.map((id) => (step.effect === 'count' ? `C_${id} ? S_${id}(C_${id}.value, ${dur}, ${ease}) : waitFor(0)` : step.effect === 'point' ? `PZ_${id}(${zoom}, ${dur}, ${ease})` : `S_${id}(1, ${dur}, ${step.ease ? ease : 'linear'})`));
    return `yield delay(${at}, (function* () { ${sfx}yield* sequence(${stagger}, ${anims.join(', ')}); })());`;
  }
  const handles = targetHandles(step, e);
  const from = propsObject(step.from);
  const to = propsObject(step.to);
  if (step.repeat) {
    return `yield delay(${at}, (function* () { ${sfx}const hs = ORDER(${handles}, '${order}'); yield* all(...hs.map((h: any, k: number) => delay(k * ${stagger}, REPEAT(h, ${from}, ${to}, TL[${k}][1], ${ease}, '${step.repeat}')))); })());`;
  }
  return `yield delay(${at}, (function* () { ${sfx}const hs = ORDER(${handles}, '${order}'); yield* sequence(${stagger}, ...hs.map((h: any) => STEP(h, ${from}, ${to}, ${dur}, ${ease}))); })());`;
}

/**
 * Les sorties FINALES : un pas qui fait disparaître (opacité ou échelle vers 0) et après lequel rien n'entre. Elles
 * restent calées sur la fin de la scène quand la piste est mise à l'échelle.
 */
export function finalExits(timeline: MotionStep[]): Set<number> {
  const out = new Set<number>();
  const zero = (v: unknown) => typeof v === 'number' && v <= 0.05;
  const isExit = (s: MotionStep) => !!s.target && !s.repeat && !!s.to && (zero(s.to.opacity) || zero(s.to.scale));
  timeline.forEach((s, k) => {
    if (!isExit(s)) return;
    // Une sortie écrite par rapport à la fin (« D-0.5 ») est finale par intention.
    if (typeof s.at === 'string') {
      if (/\bD\b/.test(s.at)) out.add(k);
      return;
    }
    if (typeof s.at !== 'number') return;
    const later = timeline.some((o, j) => j !== k && o.target && !o.repeat && !isExit(o) && typeof o.at === 'number' && (o.at as number) > (s.at as number) + 1e-6);
    if (!later) out.add(k);
  });
  return out;
}

/**
 * Deux pas qui animent la MÊME propriété de la MÊME cible en même temps se battraient (saccade) : le second
 * commence quand le premier finit. Seulement pour des instants et durées en nombres (les expressions restent).
 */
export function untangle(timeline: MotionStep[]): { timeline: MotionStep[]; notes: string[] } {
  const notes: string[] = [];
  const out = timeline.map((s) => ({ ...s }));
  const order = out.map((s, k) => ({ s, k })).filter((x) => typeof x.s.at === 'number' && x.s.target && !x.s.repeat).sort((a, b) => (a.s.at as number) - (b.s.at as number));
  const busy = new Map<string, number>();
  for (const { s, k } of order) {
    const targets = Array.isArray(s.target) ? s.target : [s.target!];
    const props = [...new Set([...Object.keys(s.from || {}), ...Object.keys(s.to || {}), ...(s.effect ? [`effect:${s.effect}`] : [])])];
    const dur = typeof s.dur === 'number' ? s.dur : s.dur === undefined ? 0.6 : null;
    let at = s.at as number;
    for (const t of targets) for (const p of props) at = Math.max(at, busy.get(`${t}|${p}`) ?? at);
    if (at > (s.at as number) + 1e-6) {
      notes.push(`timeline[${k}] : commence à ${Math.round(at * 100) / 100} s (la même propriété était encore animée)`);
      s.at = Math.round(at * 1000) / 1000;
    }
    if (dur === null) continue;
    const stag = (typeof s.stagger === 'number' ? s.stagger : s.stagger ? 0.08 : 0) * (targets.some((t) => /\.\*$/.test(t)) ? 4 : Math.max(0, targets.length - 1));
    for (const t of targets) for (const p of props) busy.set(`${t}|${p}`, at + dur + stag);
  }
  return { timeline: out, notes };
}

/** Le moteur de piste embarqué dans chaque scène compilée (identique partout). */
const RUNTIME = `
  // ── Moteur de piste (@idem/motion-compiler) : relie une propriété du langage au signal du nœud ──
  const UNIT = new Set(['x', 'y', 'w', 'h', 'size', 'radius', 'lineWidth', 'blur', 'panX', 'panY', 'letterSpacing']);
  const SIG = (h: any, p: string): any => {
    const n = h.n, i = h.i;
    switch (p) {
      case 'blur': return n.filters.blur;
      // Motion Canvas n'a pas de signal scaleX / skewX : ce sont les composantes des vecteurs scale et skew.
      case 'scaleX': return n.scale.x;
      case 'scaleY': return n.scale.y;
      case 'skewX': return n.skew.x;
      case 'w': return n.width;
      case 'h': return n.height;
      case 'size': return h.t === 'text' ? n.fontSize : n.size;
      case 'zoom': return i ? i.scale : null;
      case 'panX': return i ? i.x : null;
      case 'panY': return i ? i.y : null;
      case 'start': case 'end': case 'stroke': case 'fill': case 'lineWidth': return h.t === 'path' ? (i ? i[p] : null) : n[p];
      default: return n[p];
    }
  };
  const F = (h: any, p: string) => (h.t === 'path' && p === 'lineWidth' ? 1 : UNIT.has(p) ? U : 1);
  const GET = (h: any, p: string): any => {
    const s = SIG(h, p);
    if (!s) return 0;
    const v = s();
    return v && typeof v === 'object' && 'x' in v ? v.x : v;
  };
  const BASE = new Map<any, any>();
  const base = (h: any, p: string) => {
    let m = BASE.get(h.n);
    if (!m) BASE.set(h.n, (m = {}));
    if (!(p in m)) m[p] = GET(h, p);
    return m[p];
  };
  const VAL = (h: any, p: string, v: any, from: boolean) => (v && typeof v === 'object' && 'r' in v ? (from ? base(h, p) : GET(h, p)) + v.r * F(h, p) : typeof v === 'number' ? v * F(h, p) : v);
  const SET = (h: any, vals: any, from = true) => { for (const p in vals) { const s = SIG(h, p); if (s) s(VAL(h, p, vals[p], from)); } };
  const TW = (h: any, p: string, v: any, d: number, e: any) => { const s = SIG(h, p); return s ? s(v, d, e) : waitFor(0); };
  const INSIDE = (h: any, goal: any) => {
    try {
      const n = h.n, size = n.computedSize ? n.computedSize() : { x: n.width(), y: n.height() }, w = size.x, hh = size.y, off = n.offset();
      if ('x' in goal && w <= A.width) goal.x = Math.min(A.right - ((1 - off.x) / 2) * w, Math.max(A.left + ((1 + off.x) / 2) * w, goal.x));
      if ('y' in goal && hh <= A.height) goal.y = Math.min(A.bottom - ((1 - off.y) / 2) * hh, Math.max(A.top + ((1 + off.y) / 2) * hh, goal.y));
    } catch {
      // taille pas encore connue : la position demandée est gardée
    }
  };
  const RESTORE = (h: any, p: string) => {
    const b = base(h, p);
    return ['opacity', 'scale', 'scaleX', 'scaleY'].includes(p) && typeof b === 'number' && Math.abs(b) <= 0.05 ? 1 : b;
  };
  const STEP = (h: any, from: any, to: any, d: number, e: any) => (function* () {
    SET(h, from);
    const goal: any = {};
    for (const p in to) goal[p] = VAL(h, p, to[p], false);
    // Une propriété donnée dans « from » et absente de « to » revient à sa valeur déclarée — sauf un nœud déclaré
    // caché (opacité ou échelle nulle) : il apparaît (sinon il resterait invisible pour toujours).
    for (const p in from) if (!(p in goal)) goal[p] = RESTORE(h, p);
    // Un texte posé dans la scène s'arrête toujours dans la zone sûre (il peut ENTRER depuis l'extérieur).
    if (h.top && ('x' in goal || 'y' in goal)) INSIDE(h, goal);
    if (!(d > 0)) {
      for (const p in goal) { const s = SIG(h, p); if (s) s(goal[p]); }
      return;
    }
    yield* all(...Object.keys(goal).map((p) => TW(h, p, goal[p], d, e)));
  })();
  const REPEAT = (h: any, from: any, to: any, d: number, e: any, mode: string) => (function* () {
    SET(h, from);
    // Une boucle sans propriété animable ou sans durée tournerait sur une seule image (le rendu se figerait).
    if (!(d >= 0.05) || !Object.keys(to).some((p) => SIG(h, p))) return;
    const start: any = {};
    for (const p in to) start[p] = GET(h, p);
    const there = () => all(...Object.keys(to).map((p) => TW(h, p, VAL(h, p, to[p], false), d, e)));
    const back = (t: number) => all(...Object.keys(to).map((p) => TW(h, p, start[p], t, e)));
    yield* loop(() => (mode === 'yoyo' ? chain(there(), back(d)) : chain(there(), back(0))));
  })();
  const ORDER = (hs: any[], o: string) => {
    if (o === 'reverse') return [...hs].reverse();
    if (o === 'center') { const c = (hs.length - 1) / 2; return [...hs].map((h, k) => ({ h, k })).sort((a, b) => Math.abs(a.k - c) - Math.abs(b.k - c)).map((x) => x.h); }
    return hs;
  };
  const PREP = (hs: any[], props: string[]) => { for (const h of hs) for (const p of props) base(h, p); };`;

const HELPERS = `
  const GR = (a: string, b: string, deg: number, w: number, h: number) => {
    const r = (deg * Math.PI) / 180, len = (Math.abs(w * Math.cos(r)) + Math.abs(h * Math.sin(r))) / 2;
    return new Gradient({ type: 'linear', from: [-Math.cos(r) * len, -Math.sin(r) * len], to: [Math.cos(r) * len, Math.sin(r) * len], stops: [{ offset: 0, color: a }, { offset: 1, color: b }] });
  };
  const LG = ctx.brand.logo;
  const LOGO = (on: string) => (LG ? (contrast('#ffffff', on) > contrast('#111418', on) ? LG.dark || LG.light : LG.light || LG.dark) : undefined);
  const LINES = (text: string, size: number, font: string, weight: number, ls: number, maxW: number) => {
    const space = measureText(' ', size, font, weight, ls);
    let n = 1, lw = 0;
    for (const w of text.split(/\\s+/).filter(Boolean)) {
      const ww = measureText(w, size, font, weight, ls);
      if (lw > 0 && lw + space + ww > maxW) { n++; lw = ww; } else lw += (lw > 0 ? space : 0) + ww;
    }
    return n;
  };
  // La boîte d'un texte : taille (plafond = celle demandée), largeur, nombre de lignes, position ramenée dans la zone sûre.
  const FIT = (text: string, o: any) => {
    const SWp = A.width;
    let maxW: number;
    if (o.width > 0) maxW = Math.min(o.width, SWp);
    else if (o.mode === 'top') {
      const avail = o.ax < 0 ? A.right - o.x : o.ax > 0 ? o.x - A.left : 2 * Math.min(o.x - A.left, A.right - o.x);
      maxW = Math.min(SWp, Math.max(SWp * 0.5, avail));
    } else maxW = SWp;
    const lines = o.lines > 0 ? o.lines : 3;
    const minSize = Math.max(12, 2.4 * U);
    const fitTo = (max: number, l: number) => fitFontSize(text, { maxWidth: maxW, max, min: minSize, lines: l, fontFamily: o.font, fontWeight: o.weight, letterSpacing: o.ls });
    let size = o.fit ? fitTo(o.max, o.lines > 0 ? o.lines : 2) : o.size;
    const one = measureText(text, size, o.font, o.weight, o.ls);
    let width: number, n: number;
    let shown = text;
    if (one <= maxW) {
      width = o.width > 0 ? maxW : Math.min(maxW, one * 1.03 + 2);
      n = 1;
    } else {
      size = Math.max(minSize, Math.min(size, fitTo(size, lines)));
      // Des lignes ÉQUILIBRÉES (Knuth-Plass), sans mot orphelin : la boîte garde la largeur demandée.
      const measure = (s: string) => measureText(s, size, o.font, o.weight, o.ls);
      const rows = balanceLines(text, maxW, measure);
      if (rows.length > 1 && rows.every((r) => measure(r) <= maxW + 1)) shown = rows.join('\\n');
      width = maxW;
      n = rows.length > 1 ? rows.length : LINES(text, size, o.font, o.weight, o.ls, maxW);
    }
    const h = n * size * o.lh;
    let x = o.x, y = o.y;
    if (o.mode === 'top') {
      const left = x - ((1 + o.ax) / 2) * width, right = x + ((1 - o.ax) / 2) * width;
      if (left < A.left) x += A.left - left; else if (right > A.right) x -= right - A.right;
      const top = y - ((1 + o.ay) / 2) * h, bottom = y + ((1 - o.ay) / 2) * h;
      if (h <= A.height) { if (top < A.top) y += A.top - top; else if (bottom > A.bottom) y -= bottom - A.bottom; }
    }
    return { size, width, x, y, lines: n, text: shown };
  };
  // Un conteneur posé dans la scène (pile) : mesuré après sa mise en page, réduit s'il dépasse la zone sûre, ramené dedans.
  const KEEP = (n: any) => {
    if (!n) return;
    const size = n.computedSize ? n.computedSize() : n.size();
    let w = size.x, h = size.y;
    if (!(w > 0 && h > 0)) return;
    const k = Math.min(1, A.width / w, A.height / h);
    if (k < 1) { n.scale(n.scale().scale(k)); w *= k; h *= k; }
    const off = n.offset();
    let x = n.x(), y = n.y();
    const left = x - ((1 + off.x) / 2) * w, right = x + ((1 - off.x) / 2) * w;
    if (left < A.left) x += A.left - left; else if (right > A.right) x -= right - A.right;
    const top = y - ((1 + off.y) / 2) * h, bottom = y + ((1 - off.y) / 2) * h;
    if (top < A.top) y += A.top - top; else if (bottom > A.bottom) y -= bottom - A.bottom;
    n.x(x);
    n.y(y);
  };
  const SPLIT = (text: string, mode: string, size: number, font: string, weight: number, width: number, align: string, lh: number, ls: number, ax: number, ay: number) => {
    const space = measureText(' ', size, font, weight, ls);
    const words = text.split(/\\s+/).filter(Boolean);
    // Les mêmes lignes équilibrées que le texte entier : découper ne change pas la coupure.
    const rows = width > 0 ? balanceLines(words.join(' '), width, (s: string) => measureText(s, size, font, weight, ls)) : [words.join(' ')];
    const lines: { w: string[]; width: number }[] = rows.map((r: string) => ({ w: r.split(' ').filter(Boolean), width: measureText(r, size, font, weight, ls) }));
    void space;
    const boxW = width > 0 ? width : Math.max(0, ...lines.map((l) => l.width));
    const boxH = lines.length * size * lh;
    const out: { s: string; x: number; y: number }[] = [];
    lines.forEach((l, k) => {
      let x = align === 'left' ? -boxW / 2 : align === 'right' ? boxW / 2 - l.width : -l.width / 2;
      const y = -boxH / 2 + size * lh * (k + 0.5);
      for (const w of l.w) {
        const ww = measureText(w, size, font, weight, ls);
        if (mode === 'chars') {
          let cx = x;
          for (const ch of Array.from(w)) { const cw = measureText(ch, size, font, weight, ls); out.push({ s: ch, x: cx + cw / 2, y }); cx += cw + ls; }
        } else out.push({ s: w, x: x + ww / 2, y });
        x += ww + space;
      }
    });
    return out.map((p) => ({ s: p.s, x: p.x - (ax * boxW) / 2, y: p.y - (ay * boxH) / 2 }));
  };
  const NUM = (s: string) => {
    const m = /\\d[\\d\\s\\u00a0\\u202f.,]*\\d|\\d/.exec(s);
    if (!m) return null;
    const raw = m[0];
    const dec = /[.,]\\d{1,2}$/.test(raw) && !/[.,]\\d{3}$/.test(raw) ? raw[raw.length - (raw.match(/[.,](\\d+)$/)![1].length + 1)] : '';
    const digits = dec ? raw.slice(0, raw.lastIndexOf(dec)) : raw;
    const decimals = dec ? raw.length - raw.lastIndexOf(dec) - 1 : 0;
    const group = (digits.match(/[^\\d]/) || [''])[0];
    const value = Number(digits.replace(/[^\\d]/g, '') + (dec ? '.' + raw.slice(raw.lastIndexOf(dec) + 1) : ''));
    const fmt = (v: number) => {
      const fixed = v.toFixed(decimals);
      const [int, frac] = fixed.split('.');
      const grouped = group ? int.replace(/\\B(?=(\\d{3})+(?!\\d))/g, group) : int;
      return frac ? grouped + dec + frac : grouped;
    };
    return { pre: s.slice(0, m.index), suf: s.slice(m.index + raw.length), value, fmt };
  };`;

export interface CompiledScene {
  code: string;
  /** Lignes de TSX produites (mesure). */
  lines: number;
}

/** Compile un programme VALIDÉ (voir `validateProgram`) en scène Motion Canvas. */
export function compileProgram(program: MotionProgram, opts: { warnings?: string[] } = {}): CompiledScene {
  const e = new Emitter();
  // Avant l'arbre : les effets (texte entier) et les flous animés, qui changent la forme des nœuds.
  for (const s of program.timeline) {
    const list = Array.isArray(s.target) ? s.target : s.target ? [s.target] : [];
    if (s.effect) list.forEach((t) => e.effects.set(t, s.effect!));
    if ((s.to && 'blur' in s.to) || (s.from && 'blur' in s.from)) list.forEach((t) => e.blurred.add(safeId(t)));
  }
  // Les textes portés par chaque nœud nommé (lui ou ses enfants) : un pas qui le révèle doit laisser le temps de les lire.
  const collect = (n: MotionNode): string[] => {
    const own = n.type === 'text' && n.text.startsWith('$') ? [n.text.slice(1)] : [];
    const kids = (n as { children?: MotionNode[] }).children || [];
    const item = n.type === 'repeat' ? [n.item] : [];
    const all = [...own, ...[...kids, ...item].flatMap(collect)];
    if (n.id && all.length) e.textKeys.set(n.id, [...new Set(all)]);
    return all;
  };
  program.nodes.forEach(collect);
  const bgFill = program.bg;
  const bgColor = bgFill === undefined ? 'K.background' : typeof bgFill === 'string' ? colorCode(bgFill, 'K.background') : colorCode(bgFill.from, 'K.background');
  const tree = program.nodes.map((n) => nodeJsx(n, e, { scope: {}, inStack: false, top: true })).join('\n');
  const { timeline, notes: untangled } = untangle(program.timeline);

  // Les états de départ : le « from » du PREMIER pas de chaque cible s'applique dès le début de la scène.
  const sorted = [...timeline].map((s, k) => ({ s, k })).sort((a, b) => (typeof a.s.at === 'number' && typeof b.s.at === 'number' ? a.s.at - b.s.at : a.k - b.k));
  const seen = new Set<string>();
  const initial: string[] = [];
  const prep: string[] = [];
  for (const { s } of sorted) {
    if (!s.target) continue;
    const handles = targetHandles(s, e);
    const props = [...new Set([...Object.keys(s.from || {}), ...Object.keys(s.to || {})])];
    if (props.length) prep.push(`PREP(${handles}, ${JSON.stringify(props)});`);
    const key = JSON.stringify(s.target);
    if (s.from && !seen.has(key)) initial.push(`for (const h of ${handles}) SET(h, ${propsObject(s.from)});`);
    seen.add(key);
  }
  const enter = program.enter && program.enter.type !== 'none' ? program.enter : undefined;
  const enterDur = num(enter?.dur ?? 0.6);
  const dir = { left: 'Left', right: 'Right', up: 'Top', down: 'Bottom' }[enter?.dir ?? 'left'];
  // Une couture planifiée (ctx.seamIn) remplace l'entrée propre au programme : la scène arrive en plein mouvement.
  const enterConst = !enter ? 'const E = 0;' : `const E = ctx.index > 0 && !ctx.seamIn ? ${enterDur} : 0;`;
  const enterCode = !enter ? '' : `if (ctx.index > 0 && !ctx.seamIn) yield* ${enter.type === 'fade' ? `fadeTransition(${enterDur})` : enter.type === 'slide' ? `slideTransition(Direction.${dir}, ${enterDur})` : `zoomInTransition(new BBox(-ctx.width / 6, -ctx.height / 6, ctx.width / 3, ctx.height / 3), ${enterDur})`};`;
  // La table des temps : [instant, durée, décalage, nombre de cibles, nature, lecture] de chaque pas (nature : 0 entrée,
  // 1 boucle, 2 sortie finale ; lecture : le temps qu'il faut pour lire les textes que le pas révèle).
  const exits = finalExits(timeline);
  const firstOf = new Set<string>();
  const table = timeline.map((s, k) => {
    const ids = (Array.isArray(s.target) ? s.target : s.target ? [s.target] : []).map((t) => t.split('.')[0]);
    const keys = [...new Set(ids.flatMap((id) => e.textKeys.get(id) || []))];
    const hidden = (v: unknown) => typeof v === 'number' && v <= 0.05;
    const reveals = keys.length && !s.repeat && !exits.has(k) && (s.effect === 'type' || hidden(s.from?.opacity) || hidden(s.from?.scale) || hidden(s.from?.scaleX) || hidden(s.from?.scaleY) || ids.some((id) => !firstOf.has(id)));
    ids.forEach((id) => firstOf.add(id));
    const stagger = isStaggerToken(s.stagger) ? `designStagger(ctx, '${s.stagger}')` : num(Number(s.stagger ?? 0));
    return `[${T(s.at ?? 0)}, ${s.sfx && !s.target ? '0' : T(s.dur ?? 0.6)}, ${stagger}, ${s.sfx && !s.target ? '1' : stepCount(s, e)}, ${s.repeat ? 1 : exits.has(k) ? 2 : 0}, ${reveals ? `RT(${JSON.stringify(keys)})` : '0'}]`;
  });
  const solved = program.timing === 'solved';
  const timing = `const TL: number[][] = [${table.join(', ')}];
  // Une piste RÉSOLUE (solveur temporel du compilateur 0.3) est déjà juste : elle n'est pas remise à l'échelle.
  const SOLVED = ${solved};
  // Un pas « d'ambiance » (lent, jusqu'à la fin : travelling, rotation continue) n'entre pas dans le calcul et garde sa durée.
  const AMB = (s: number[]) => s[4] === 1 || (s[1] >= D * 0.5 && s[0] + s[1] >= D * 0.8);
  const END = (s: number[]) => s[0] + s[1] + s[2] * Math.max(0, s[3] - 1);
  const REVEAL = Math.max(0.01, ...TL.filter((s) => !AMB(s) && s[4] !== 2).map(END));
  // Ce qui se révèle doit avoir fini avant la coupe, avec un temps pour lire (jusqu'à 1,6 s, 30 % de la scène)…
  const AVAIL = Math.max(0.4, D - E - Math.min(1.6, D * 0.3));
  // … et chaque texte révélé reste à l'écran au moins son TEMPS DE LECTURE (17 signes/s, 5/6 s au moins) avant la coupe.
  const READ = Math.min(1, ...TL.filter((s) => s[5] > 0 && !AMB(s) && s[4] !== 2).map((s) => Math.max(0.35, (D - E - s[5]) / Math.max(0.01, END(s)))));
  const TS = SOLVED ? 1 : Math.min(1, AVAIL / REVEAL, READ);
  // Une sortie finale dure 0,8 s au plus : une fin trop longue laisse un écran vide.
  const DUR = (k: number) => (SOLVED ? TL[k][1] : TL[k][4] === 2 ? Math.min(0.8, TL[k][1]) : AMB(TL[k]) ? Math.max(0.05, D - E - TL[k][0] * TS) : TL[k][1] * TS);
  // Une sortie FINALE (ce qui disparaît à la fin, rien n'entre après) reste calée sur la fin de la scène : la mise à
  // l'échelle ne l'avance jamais au milieu (la scène finirait vide).
  const AT = (k: number) => (SOLVED ? TL[k][0] : TL[k][4] === 2 ? Math.max(REVEAL * TS, D - E - Math.min(0.8, TL[k][1]) - TL[k][2] * Math.max(0, TL[k][3] - 1) - 0.04) : TL[k][0] * TS);`;
  const allWarnings = [...(opts.warnings || []), ...untangled];
  // Le son de la transition : chaque scène (sauf la première) entre avec un effet — franc pour un glissement ou un
  // zoom, doux pour un fondu ou une coupe — sauf si le programme en pose déjà un dans ses premiers instants.
  const opensWithSfx = timeline.some((st) => st.sfx && typeof st.at === 'number' && st.at <= 0.3);
  // Le passage d'une scène à l'autre : un souffle doux, glissé sous la musique et la voix (≈ −12 dB).
  // Un whoosh franc à chaque changement de scène sonnait « effet de démo » et couvrait la voix.
  // Quand le film planifie ses sons de transition (une transition sur deux, variés : `design/film.ts`), la scène n'en
  // pose plus d'office.
  const transitionSfx = opensWithSfx ? '' : `if (ctx.index > 0 && !ctx.planned) ctx.sfx('softwhoosh', 0.45);`;

  const header = `/* ${PROGRAM_MARK} v${COMPILER_VERSION}\n${JSON.stringify(program).replace(/\*\//g, '*\\/')}\n*/`;
  const notes = allWarnings.length ? `\n// Avertissements de compilation :\n${allWarnings.map((w) => `//   - ${w.replace(/\n/g, ' ')}`).join('\n')}` : '';
  const code = `${header}
// Scène compilée par @idem/motion-compiler ${COMPILER_VERSION} : modifier le programme ci-dessus, pas ce code.${notes}
import { blur, Circle, Gradient, Img, Layout, Line, Node, Path, Polygon, Rect, Txt, Video, View2D } from '@motion-canvas/2d';
import { all, BBox, chain, createRef, createRefArray, createSignal, delay, Direction, easeInCubic, easeInOutBack, easeInOutCubic, easeInOutExpo, easeInOutSine, easeOutBack, easeOutBounce, easeOutCubic, easeOutElastic, easeOutExpo, easeOutQuart, fadeTransition, linear, loop, sequence, slideTransition, waitFor, zoomInTransition } from '@motion-canvas/core';
import { alpha, balanceLines, beatAt, contrast, designDur, designEase, designSize, designStagger, designWeight, fitFontSize, fitMedia, measureText, readableOn, readTime, safeArea, SceneContext, seamIn, seamOut, seamOutDuration } from '@idem/motion';

export default function* (view: View2D, ctx: SceneContext) {
  const U = ctx.unit;
  const A = safeArea(ctx);
  const W = ctx.width / U, H = ctx.height / U, L = A.left / U, R = A.right / U, T = A.top / U, B = A.bottom / U, SW = A.width / U, SH = A.height / U;
  const D = ctx.duration, V = ctx.voice ? Math.min(ctx.voice.at, D) : 0, VE = ctx.voice ? Math.min(ctx.voice.at + ctx.voice.duration, D) : 0; // la phrase peut finir dans la scène suivante
  // Le système de design du film (absent sur les vidéos d'avant : la marque seule).
  const DS = ctx.design;
  const K = DS ? { ...ctx.brand.colors, primary: DS.colors.primary, secondary: DS.colors.secondary, accent: DS.colors.accent, background: DS.colors.ground, text: DS.colors.ink } : ctx.brand.colors;
  const KI = DS ? DS.colors.ink : K.text;
  const DC = (role: string): string => (DS && DS.colors[role]) || DFLT[role] || K.primary;
  const DFLT: Record<string, string> = { ground: K.background, surface: alpha(K.primary, 0.06), surfaceStrong: alpha(K.primary, 0.12), inkMuted: alpha(K.text, 0.7), line: alpha(K.text, 0.22), highlight: alpha(K.accent, 0.35), neutral: alpha(K.text, 0.75), onPrimary: readableOn(K.primary), onSecondary: readableOn(K.secondary), onAccent: readableOn(K.accent), onHighlight: K.text, onNeutral: readableOn(K.text) };
  const ON = (base: string): string => { const role = 'on' + base.charAt(0).toUpperCase() + base.slice(1); const c = DS && DS.colors[role]; const under = (K as Record<string, string>)[base] || K.primary; return c && contrast(c, under) >= 3 ? c : readableOn(under); };
  const BG = ${bgColor};
  const MUTED = (bg: string): string => (DS && contrast(DS.colors.inkMuted, bg) >= 4.5 ? DS.colors.inkMuted : alpha(readableOn(bg, KI), 0.62));
  const RT = (keys: string[]): number => Math.max(0, ...keys.map((k) => readTime(ctx.texts[k] || '')));
  const FMT = ctx.format;
  const TALL = ctx.height > ctx.width * 1.15, SQUARE = !TALL && ctx.width <= ctx.height * 1.15;
  void [W, H, L, R, T, B, SW, SH, D, V, VE, TALL, SQUARE, FMT, DC, ON, MUTED, RT, Circle, Layout, Line, Path, Polygon, Rect, Video, Img, createRefArray, createSignal, beatAt, designDur, designEase, designSize, designStagger, designWeight];${HELPERS}${RUNTIME}

  ${e.pre.join('\n  ')}
  ${e.refs.join('\n  ')}
  const r_world = createRef<Node>();
  // L'enveloppe des coutures : la sortie vers la scène suivante et l'entrée depuis la précédente la font bouger
  // (le fond, lui, ne coupe jamais).
  const r_seam = createRef<Node>();
  view.fill(BG);
  view.add(
    <>
      ${bgFill !== undefined && typeof bgFill === 'object' ? `<Rect width={ctx.width} height={ctx.height} fill={${fillCode(bgFill, 'ctx.width', 'ctx.height')}} />` : ''}
      <Node ref={r_seam} filters={[blur(0)]}>
      <Node ref={r_world}${e.blurred.has('world') ? ' filters={[blur(0)]}' : ''}>
${tree}
      </Node>
      </Node>
    </>
  );
  ${e.post.join('\n  ')}
  ${prep.join('\n  ')}
  ${initial.join('\n  ')}
  ${enterConst}
  ${timing}
  ${transitionSfx}
  ${enterCode}
  const SZ = { width: ctx.width, height: ctx.height, unit: U };
  if (ctx.seamIn) yield seamIn(r_seam(), ctx.seamIn, SZ);
  if (ctx.seamOut && seamOutDuration(ctx.seamOut) > 0) yield delay(Math.max(0, D - seamOutDuration(ctx.seamOut)), seamOut(r_seam(), view, ctx.seamOut, SZ));
  ${timeline.map((s, k) => stepCode(s, k, e)).join('\n  ')}
  yield* waitFor(ctx.duration);
}
`;
  return { code, lines: code.split('\n').length };
}

/** Le programme gardé en tête d'une scène compilée (retouche, correction), ou null. */
export function programOf(code: string | undefined): MotionProgram | null {
  const m = String(code || '').match(new RegExp(`/\\* ${PROGRAM_MARK}[^\\n]*\\n([\\s\\S]*?)\\n\\*/`));
  if (!m) return null;
  try {
    return JSON.parse(m[1].replace(/\*\\\//g, '*/')) as MotionProgram;
  } catch {
    return null;
  }
}
