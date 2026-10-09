/**
 * LE CRAN ULTRA — l'agent codeur écrit le composant React de chaque scène.
 *
 * Aux crans inférieurs, l'IA choisit dans des menus ; ici elle ÉCRIT la scène : sa
 * composition, ses calques, son mouvement. La qualité ne repose pas sur le prompt mais
 * sur une chaîne de contrôles, et chaque scène a un filet : son rendu « Max ».
 *
 *   1. prompt      fiche de la charte + manifeste du kit (`KIT_MANIFEST`) + la scène
 *   2. lint        analyse de l'arbre syntaxique (acorn) : imports, globaux, boucles,
 *                  propriétés dangereuses, CSS animée, 3D, textes écrits en dur
 *   3. compilation esbuild (TSX → CommonJS), sans aucun accès au système
 *   4. rendu       la page réelle, réseau filtré strictement (+ CSP), plusieurs instants :
 *                  aucune erreur, la scène de l'IA s'affiche, tous ses textes sont là et
 *                  dans le cadre, l'image bouge, le rendu est identique dans les deux sens
 *   5. réparation  une seule : les défauts constatés sont renvoyés à l'agent
 *   6. repli       sinon la scène garde sa composition « Max »
 *
 * Sécurité : le lint garantit un code PUR (déterministe, sans effet de bord) ; la frontière
 * de sécurité, elle, ne dépend pas du lint — page de rendu sans API Node, réseau limité aux
 * origines déjà présentes dans la page (garde réseau + CSP), aperçu dans une iframe isolée.
 */
import crypto from 'crypto';
import type { Page } from 'puppeteer';
import { VideoSceneInstance, VideoStoryboard } from '../../../models/motionVideo.model';
import { CreativeOrchestrator } from '../../creativity/orchestrator';
import { DirectionId } from './video.direction';
import { DIRECTION_PITCH } from './video.agents';
import { SCENES } from './video.scenes';

// ─── Les bibliothèques qu'une scène écrite par l'IA fait charger ─────────────

/** Brique du kit → addon du moteur qu'elle exige (chargé au montage seulement si la scène l'importe). */
export const KIT_ADDONS: Record<string, 'chart' | 'viz' | 'draw' | 'zdog'> = {
  ChartJs: 'chart',
  useViz: 'viz',
  DataArc: 'viz',
  GrowArea: 'viz',
  AfricaMap: 'viz',
  VoronoiField: 'viz',
  Sketch: 'draw',
  Brush: 'draw',
  useNoise: 'draw',
  FlowField: 'draw',
  Flat3D: 'zdog',
};

/** Les addons qu'importe le code d'une scène (`import { ChartJs, Sketch } from '@idem/kit'`). */
export function addonsOfSceneCode(tsx: string): ('chart' | 'viz' | 'draw' | 'zdog')[] {
  const names = [...(tsx || '').matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]@idem\/kit['"]/g)].flatMap((m) => m[1].split(',').map((n) => n.trim().split(/\s+as\s+/)[0]));
  return [...new Set(names.map((n) => KIT_ADDONS[n]).filter(Boolean))];
}

// ─── Le manifeste du kit (ce que l'agent peut utiliser) ─────────────────────

/**
 * Le manifeste du kit, par sections : tout ce que l'agent codeur peut importer, et les règles du
 * moteur. Tenu à jour avec video-engine/src/kit-api.ts. Le film d'auteur n'envoie à chaque codeur
 * que le cœur et les sections des briques de SON motif (`scopedKitManifest`) ; le lint, lui,
 * accepte toujours tout le kit.
 */
const MANIFEST_CORE = [
  `CONTRACT
- Write ONE React component in TSX: \`export default function Scene() { ... }\`.
- Import only from "@idem/kit" (and React hooks useMemo from "react" if needed). No other import.
- The component is a PURE FUNCTION OF TIME: everything visible is computed from \`useLocalTime()\` (seconds since the scene starts). No state, no effects, no refs, no timers, no randomness (use hash(n) for pseudo-random), no Date, no fetch, no document/window.
- Fill the whole frame (the scene element is position:absolute; inset:0). Absolutely positioned layers are welcome.`,
  `DATA
- const s = useScene(): s.key, s.sceneId, s.slots (THE TEXTS — always read texts from s.slots, never write copy yourself), s.duration (s), s.start, s.icons (array of SVG strings or undefined), s.image (photo URL or undefined), s.motion.anchor, s.accent.
- const { data, u, horizontal, ease, easeIn, back } = useEngine(): u = 1% of the frame's short side in px (size everything in u), horizontal = landscape frame, data.brandName, data.logo.icon / data.logo.onLight / data.logo.onDark (image URLs or undefined), data.direction.pacing.enter (entrance duration s), data.direction.pacing.groupStagger (s), data.format.
- const lt = useLocalTime(); const p = useSceneProgress() (0→1 over the scene, for slow drifts); const beat = useBeatPulse() (1 on each music beat, decays to 0); const exitAt = useExitAt() (local time when elements must leave, or null); const out = useExitFactor() (0→1 during the exit).`,
  `COLOURS & TYPE (brand charter of THIS scene — never hard-code colours)
- CSS variables: var(--bg) background, var(--ink) text, var(--muted) secondary text, var(--hl) brand highlight, var(--hl-ink) text ON --hl, var(--hl-text) highlight colour usable as text on --bg, var(--hl-soft) soft tint, var(--soft) soft panel. Also var(--c-primary), var(--c-secondary), var(--c-accent).
- Fonts: var(--f-display) titles, var(--f-body) text. Use inline style objects (Tailwind classes are NOT available at runtime).
- Safe zone: keep every text inside top var(--st), bottom var(--sb), sides var(--sx). The class "safe" is a ready absolutely-positioned box with those margins (display:flex; flex-direction:column).`,
  `TEXT (always through these — they fit the text to the available width and never overflow)
- <Kinetic text={s.slots.title} technique="maskUp" at={0.2} role="headline" fit={[maxSizeU, minSizeU, maxLines]} exitAt={exitAt} sound="click" style={{...}} />
  techniques: maskUp, lineWipe, blurWords, trackIn, scaleBlur, charCascade, flipChars, scramble, typewriter, springUp, wave, stretch, zoomWords, skewIn, scatter, slideAlternate, stackPush, boxReveal, outlineFill. role "support" for secondary text.
- <Odometer text={s.slots.value} at={0.1} dur={1.2} fit={[maxU, minU, 1]} /> rolls the digits of a number.
- Ready blocks: <Headline text at fit />, <Support text at fit? />, <ActionButton text={s.slots.action} at />, <LabelBlock text at /> (text on a --hl label), <Composition anchor="center-left" gap={3} width="62%">…</Composition> (safe-zone block at an anchor).
- stackLines(text, maxLines) splits a headline into poster lines.`,
  `MOTION
- useEnter(kind, at, durScale?, exitAt?) → style for non-text elements; kinds: rise, scale, pop, wipeRight, clipUp, slideLeft, fade, drop, spring, flip, unfold, skew, iris.
- Pure helpers (import them from "@idem/kit"): progress(t, at, dur) → 0..1, mix(a, b, p), clamp(v, lo?, hi?), ease(p), easeIn(p), back(p), keyframes(t, times[], values[]), springEase(bounce)(p), hash(n) → 0..1. The direction's own curve is useEngine().ease.
- Sound: cue(\`\${s.key}:name\`, s.start + at, kind, gain?) at the exact moment something moves; kinds: whoosh, softwhoosh, pop, click, tick, impact, shimmer, riser.
- <Icon svg={s.icons?.[i]} style={{ width: 9 * u, height: 9 * u, color: 'var(--hl-text)' }} />. <LogoMotion variant="draw" height={20 * u} /> animates the brand logo.`,
];
const MANIFEST_RULES = `RULES (checked by code; a scene that breaks one is rejected)
- Every text of s.slots must be fully on screen and readable before the last 0.6 s of the scene; nothing outside the frame.
- Professional motion design: 2–4 depth layers moving at different speeds, a clear focal point, generous negative space, one accent colour, eased motion (no linear), entrances 0.3–1.2 s, the main text settles early and HOLDS.
- No CSS animations/transitions/@keyframes (time drives everything). No 3D transforms (perspective, rotateX/Y/Z, translateZ). Blur radius never negative: blur(\${Math.max(0, x)}px).
- No while/do loops; for-loops only over arrays or small fixed counts (≤ 60). At most ~40 elements.
- Must work in portrait, square and landscape: size with u and %, branch on \`horizontal\` when needed.`;
const DATA_HEADER = `DATA, CHARTS, DRAWING (all driven by time — pass progress values, never animate on your own)`;
/** Sections facultatives : briques du kit → leur ligne du manifeste. */
const MANIFEST_SECTIONS: { id: string; names: string[]; text: string }[] = [
  { id: 'numbers', names: ['numbersIn', 'slotNumbers', 'percentIn', 'countriesIn', 'ChartJs', 'useViz', 'DataArc', 'GrowArea', 'AfricaMap'], text: `- Numbers come ONLY from the texts: numbersIn(text) → number[] (« 12 000 », « 87 % » → 12000, 87), slotNumbers(s.slots), percentIn(text) → 87 | null. Never write a number yourself: a chart showing a number absent from the texts is rejected.` },
  { id: 'chart', names: ['ChartJs'], text: `- <ChartJs type="bar|line|doughnut|pie|radar|polarArea|bubble|treemap|sankey|matrix" data={{ labels, datasets: [{ data }] }} options={{…}} at={0.2} dur={1.2} grow="rise|sweep|reveal" values /> — Chart.js 4 in brand colours; colours may be written 'var(--hl)'. Wrap it in a sized box (position absolute + width/height).` },
  { id: 'viz', names: ['useViz'], text: `- const viz = useViz(): the visx component library + d3 (viz.shape.{Arc, Pie, AreaClosed, LinePath, Bar, BarRounded…}, viz.scale.{scaleLinear, scaleBand…}, viz.curve.{curveMonotoneX…}, viz.gradient.{LinearGradient, RadialGradient}, viz.pattern.{PatternLines…}, viz.text.Text, viz.hierarchy.{Treemap, Pack…}, viz.d3.interpolate, viz.d3.Delaunay, viz.d3.geo) — draw your own data-art in an <svg viewBox="0 0 100 100">. Null-check viz.` },
  { id: 'bricks', names: ['DataArc', 'GrowArea', 'AfricaMap', 'VoronoiField'], text: `- Ready data bricks: <DataArc value={87} /> (gauge), <GrowArea values={[…]} /> (area that draws itself), <AfricaMap highlightIn={s.slots.title} /> (Africa; only the countries/cities NAMED in the text light up), <VoronoiField cells={24} />.` },
  { id: 'draw', names: ['Sketch', 'Brush', 'FlowField', 'useNoise'], text: `- Hand-made touch: <Sketch draw={{ shape: 'circle'|'ellipse'|'rectangle'|'line'|'arc'|'polygon'|'curve'|'path', … }} p={0..1} color="var(--hl)" roughness={1.2} seed={3} /> (rough.js, viewBox 100×100); <Brush points={[[x,y],…]} p={0..1} size={4} /> (brush stroke); <FlowField seed={5} /> (organic noise lines); const { noise2D, noise3D } = useNoise(seed) for organic motion.` },
  { id: 'flat3d', names: ['Flat3D'], text: `- Flat 3D without WebGL: <Flat3D items={[{ kind: 'box'|'cylinder'|'cone'|'hemisphere'|'ring'|'disc'|'polygon'|'sphere'|'rect'|'line', width, height, depth, diameter, color: 'var(--hl)', shade: 'var(--c-primary)', x, y, z }]} rotate={{ x: -0.4, y: lt * 0.8 }} /> (Zdog, coordinates -50..50).` },
];
const SERVE_LINE = `- Use these tools when they SERVE the idea (a number becomes a chart or a gauge, places become a map, a promise gets a hand-drawn circle, depth comes from flat 3D) — not as decoration everywhere.`;

const optionalBlock = (sections: typeof MANIFEST_SECTIONS) => [DATA_HEADER, ...sections.map((x) => x.text), SERVE_LINE].join('\n');

/** Le manifeste complet (codeur de scènes, plan sans motif reconnu). */
export const KIT_MANIFEST = [...MANIFEST_CORE, optionalBlock(MANIFEST_SECTIONS), MANIFEST_RULES].join('\n\n').trim();

/**
 * Le manifeste restreint d'un plan : le cœur (contrat, données de la scène, couleurs, texte,
 * mouvement, règles) et seulement les sections des briques que son motif appelle. Sans liste,
 * le manifeste complet : un plan n'est jamais privé d'un outil dont il aurait besoin.
 */
export function scopedKitManifest(names: string[] | undefined): string {
  if (!names) return KIT_MANIFEST;
  const wanted = new Set(names);
  const sections = MANIFEST_SECTIONS.filter((x) => x.names.some((n) => wanted.has(n)));
  return [...MANIFEST_CORE, ...(sections.length ? [optionalBlock(sections)] : []), MANIFEST_RULES].join('\n\n').trim();
}

const EXAMPLE = `
import { useScene, useEngine, useLocalTime, useSceneProgress, useBeatPulse, useExitAt, useEnter, Kinetic, progress, mix, cue } from '@idem/kit';

export default function Scene() {
  const s = useScene();
  const { u, horizontal, ease, data } = useEngine();
  const lt = useLocalTime();
  const p = useSceneProgress();
  const beat = useBeatPulse();
  const exitAt = useExitAt();
  const g = data.direction.pacing.groupStagger;
  const bar = ease(progress(lt, 0, 0.6));
  const sub = useEnter('rise', g * 2, 1, exitAt);
  cue(\`\${s.key}:bar\`, s.start, 'whoosh', 0.6);
  return (
    <>
      {/* back layer: a brand block that slides in and drifts */}
      <div style={{ position: 'absolute', left: 0, top: horizontal ? '18%' : '30%', height: horizontal ? '64%' : '34%', width: \`\${bar * 72}%\`, background: 'var(--hl)', transform: \`translateX(\${mix(-1, 1, p)}%)\` }} />
      {/* thin rule that pulses on the beat */}
      <div style={{ position: 'absolute', right: '8%', bottom: '14%', width: 22 * u, height: 0.6 * u, background: 'var(--ink)', transform: \`scaleX(\${1 + beat * 0.15})\`, transformOrigin: 'right' }} />
      <div className="safe" style={{ justifyContent: 'center' }}>
        <div style={{ width: horizontal ? '58%' : '88%', color: 'var(--hl-ink)', padding: \`0 \${3 * u}px\` }}>
          <Kinetic text={s.slots.title || ''} technique={s.motion.headline} at={0.35} role="headline" fit={[horizontal ? 12 : 15, 6, 3]} exitAt={exitAt} sound="click" style={{ color: 'var(--hl-ink)' }} />
        </div>
        {s.slots.sub ? (
          <div style={{ ...sub, marginTop: 3 * u, width: horizontal ? '50%' : '80%' }}>
            <Kinetic text={s.slots.sub} technique="blurWords" at={g * 2} role="support" fit={[5.5, 3.4, 2]} exitAt={exitAt} />
          </div>
        ) : null}
      </div>
    </>
  );
}
`.trim();

export interface CoderScene {
  key: string;
  sceneId: string;
  index: number;
  count: number;
  duration: number;
  slots: Record<string, string>;
  accent?: boolean;
  /** La composition « Max » de la scène (repli) — l'agent fait AUTREMENT, pas pareil. */
  layout?: string;
  hasImage?: boolean;
  hasIcons?: boolean;
  formats: string[];
  neighbours: string[];
}

/** Ce que fait chaque scène, pour l'agent (son rôle dans le récit). */
const SCENE_ROLE: Record<string, string> = {
  hook: 'the opening hook: grab attention in the first second',
  statement: 'one strong sentence',
  stat: 'one big number and its label',
  benefits: 'up to three benefits (b1, b2, b3), each with its icon if provided',
  offer: 'a price offer: price, old price struck, badge, note',
  quote: 'a customer testimonial and its author',
  event: 'an event: title, date, time, place',
  cta: 'the call to action: headline, action button text, contact',
  product: 'the product: name, tagline, price (photo if provided)',
  kinetic: 'punchy animated typography, lines l1–l4 one after the other',
  wordswap: 'a lead phrase whose last word swaps (w1, w2, w3)',
};

/** Scènes que l'agent peut écrire (les plans de médias, la 3D et la signature gardent leur composant). */
export const CODABLE_SCENES = new Set(['hook', 'statement', 'stat', 'benefits', 'offer', 'quote', 'event', 'cta', 'product', 'kinetic', 'wordswap']);

export function buildCoderPrompt(sheet: string, direction: DirectionId, scene: CoderScene): { system: string; user: string } {
  const system = [
    'You are a senior motion designer who codes. You write the React component of ONE scene of a professional brand video, true to the brand charter and its art direction.',
    'Answer with the TSX code only, in a single ```tsx block.',
    KIT_MANIFEST,
    'EXAMPLE (structure only — do NOT copy its layout):',
    '```tsx',
    EXAMPLE,
    '```',
  ].join('\n');
  const slotDefs = SCENES[scene.sceneId]?.slots || [];
  const user = [
    sheet,
    `MOTION DIRECTION: ${DIRECTION_PITCH[direction]}`,
    `SCENE ${scene.index + 1} of ${scene.count}: ${scene.sceneId} — ${SCENE_ROLE[scene.sceneId] || scene.sceneId}; ${scene.duration.toFixed(1)} s${scene.accent ? '; THE BIG MOMENT of the video: make it memorable' : ''}.`,
    `TEXTS (read them from s.slots, show ALL of them): ${slotDefs
      .filter((d) => scene.slots[d.key])
      .map((d) => `s.slots.${d.key} = "${scene.slots[d.key]}"`)
      .join(' · ')}`,
    scene.hasIcons ? 'ICONS: s.icons[i] is the SVG of item i.' : '',
    scene.hasImage ? 'PHOTO: s.image is the product photo URL — show it (an <img> with objectFit cover).' : '',
    `FORMATS: ${scene.formats.join(', ')}.`,
    scene.layout ? `Do something more original than the stock "${scene.layout}" layout.` : '',
    scene.neighbours.length ? `Neighbour scenes: ${scene.neighbours.join(' / ')} — keep the film coherent but do not repeat their composition.` : '',
  ]
    .filter(Boolean)
    .join('\n');
  return { system, user };
}

export function buildRepairPrompt(previous: string, issues: string[]): string {
  return [`Your component was rejected. Fix ALL these problems and answer with the complete corrected TSX in a single \`\`\`tsx block:`, ...issues.slice(0, 8).map((i) => `- ${i}`), '', '```tsx', previous, '```'].join('\n');
}

/** Le code d'une réponse (bloc ```tsx, ou la réponse entière si elle commence par un import). */
export function extractCode(raw: string): string | null {
  const fenced = (raw || '').match(/```(?:tsx|jsx|ts|typescript|javascript|js)?\s*\n([\s\S]*?)```/i);
  const code = (fenced ? fenced[1] : /^\s*(import|export)\b/.test(raw || '') ? raw : '').trim();
  return code.length > 40 ? code : null;
}

// ─── Lint (analyse de l'arbre syntaxique) ───────────────────────────────────

/** Globaux qu'une scène peut lire. Tout autre identifiant libre est refusé. */
const ALLOWED_GLOBALS = new Set(['React', 'Math', 'Number', 'String', 'Array', 'Boolean', 'Object', 'parseInt', 'parseFloat', 'isFinite', 'isNaN', 'Infinity', 'NaN', 'undefined']);
const FORBIDDEN_MEMBERS = new Set(['constructor', '__proto__', 'prototype', '__defineGetter__', '__defineSetter__', '__lookupGetter__', 'caller', 'callee', 'random', 'now', 'innerHTML', 'outerHTML', 'dangerouslySetInnerHTML', 'defineProperty', 'getPrototypeOf', 'setPrototypeOf']);
const FORBIDDEN_HOOKS = new Set(['useState', 'useEffect', 'useLayoutEffect', 'useRef', 'useReducer', 'useCallback', 'useImperativeHandle', 'useInsertionEffect', 'useSyncExternalStore', 'useTransition', 'useDeferredValue', 'useId']);
const ALLOWED_MODULES = new Set(['@idem/kit', 'react']);
/** Les noms exportés par `@idem/kit` (video-engine/src/kit-api.ts#KIT) : tout autre import est une faute. */
export const KIT_NAMES = new Set([
  'useScene', 'useLocalTime', 'useEngine', 'useSceneProgress', 'useExitAt', 'useExitFactor', 'useBeatPulse', 'useCamera', 'contentOf',
  'useEnter', 'useFamilyKind', 'Composition', 'ANCHOR_STYLE',
  'Kinetic', 'Odometer', 'Headline', 'Support', 'ActionButton', 'LabelBlock', 'stackLines', 'useHeadlineSound',
  'Icon', 'LogoMotion', 'cue',
  'clamp', 'mix', 'progress', 'hash', 'keyframes', 'springEase', 'ease', 'easeIn', 'back',
  'numbersIn', 'slotNumbers', 'percentIn', 'countriesIn',
  'ChartJs', 'useViz', 'DataArc', 'GrowArea', 'AfricaMap', 'VoronoiField',
  'Sketch', 'Brush', 'useNoise', 'FlowField', 'Flat3D',
]);
const REACT_NAMES = new Set(['React', 'useMemo', 'Fragment']);
const MAX_SOURCE = 16000;

type AcornNode = { type: string; start: number; end: number; [k: string]: any };

/** Les défauts du code (vide = accepté). Le code est d'abord ramené en JavaScript par esbuild. */
export async function lintSceneCode(tsx: string, slotKeys: string[]): Promise<string[]> {
  const issues: string[] = [];
  if (tsx.length > MAX_SOURCE) issues.push(`the component is too long (${tsx.length} characters, max ${MAX_SOURCE})`);
  if (!/export\s+default\b/.test(tsx)) issues.push('missing `export default function Scene()`');
  if (/@keyframes|\banimation\s*:|\btransition\s*:/i.test(tsx)) issues.push('CSS animations/transitions are forbidden: compute every style from time');
  if (/perspective\s*\(|rotate[XYZ]\s*\(|rotate3d|translateZ|translate3d|matrix3d/.test(tsx)) issues.push('3D transforms are forbidden');
  if (/https?:\/\//i.test(tsx)) issues.push('no URL may be written in the code (use s.image, data.logo)');
  // Les imports sont lus sur la SOURCE : esbuild retire ceux qui ne servent pas avant l'analyse.
  for (const m of tsx.matchAll(/import\s+(?:type\s+)?([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g)) {
    if (!ALLOWED_MODULES.has(m[2])) issues.push(`import from "${m[2]}" is forbidden (only @idem/kit and react)`);
    const names = m[1].replace(/[{}]/g, ' ').split(/[\s,]+/).filter((n) => n && n !== 'as' && n !== '*');
    for (const name of names) if (FORBIDDEN_HOOKS.has(name)) issues.push(`${name} is forbidden: the scene is a pure function of time`);
    // Un nom absent du kit ne se voyait qu'au rendu (« import_kit.back is not a function »).
    if (m[2] === '@idem/kit') {
      const unknown = names.filter((n) => /^[A-Za-z_]\w*$/.test(n) && !KIT_NAMES.has(n));
      const aliased = new Set([...m[1].matchAll(/\bas\s+(\w+)/g)].map((a) => a[1]));
      const missing = unknown.filter((n) => !aliased.has(n));
      if (missing.length) issues.push(`not exported by @idem/kit: ${missing.join(', ')} (available: see the KIT list)`);
    } else if (m[2] === 'react') {
      const bad = names.filter((n) => /^[A-Za-z_]\w*$/.test(n) && !REACT_NAMES.has(n) && !FORBIDDEN_HOOKS.has(n));
      if (bad.length) issues.push(`from react only useMemo and Fragment may be imported (not ${bad.join(', ')})`);
    }
  }
  if (/\brequire\s*\(|\bimport\s*\(/.test(tsx)) issues.push('dynamic imports and require are forbidden');

  const esbuild = require('esbuild');
  let js = '';
  try {
    js = (await esbuild.transform(tsx, { loader: 'tsx', format: 'esm', target: 'es2019', jsx: 'transform', jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment', logLevel: 'silent' })).code;
  } catch (error: any) {
    const first = error?.errors?.[0];
    issues.push(`syntax error: ${first ? `${first.text} (line ${first.location?.line})` : error?.message || 'invalid TSX'}`);
    return issues;
  }

  const acorn = require('acorn');
  const walk = require('acorn-walk');
  let ast: AcornNode;
  try {
    ast = acorn.parse(js, { ecmaVersion: 2020, sourceType: 'module' });
  } catch (error: any) {
    issues.push(`unparsable code: ${error?.message}`);
    return issues;
  }

  // Noms déclarés n'importe où (fonctions, paramètres, variables, imports) : une sur-approximation
  // suffit — un nom libre qui n'est ni déclaré ni autorisé est un global, donc refusé.
  const declared = new Set<string>();
  const declarePattern = (p: AcornNode | null | undefined) => {
    if (!p) return;
    if (p.type === 'Identifier') declared.add(p.name);
    else if (p.type === 'ObjectPattern') p.properties.forEach((q: AcornNode) => declarePattern(q.type === 'RestElement' ? q.argument : q.value));
    else if (p.type === 'ArrayPattern') p.elements.forEach((q: AcornNode | null) => declarePattern(q));
    else if (p.type === 'RestElement') declarePattern(p.argument);
    else if (p.type === 'AssignmentPattern') declarePattern(p.left);
  };
  const usedSlots = new Set<string>();
  const globals = new Set<string>();
  const problems = new Set<string>();
  walk.full(ast, (node: AcornNode) => {
    switch (node.type) {
      case 'ImportDeclaration':
        if (!ALLOWED_MODULES.has(node.source.value)) problems.add(`import from "${node.source.value}" is forbidden (only @idem/kit and react)`);
        node.specifiers.forEach((sp: AcornNode) => {
          declared.add(sp.local.name);
          if (FORBIDDEN_HOOKS.has(sp.imported?.name)) problems.add(`${sp.imported.name} is forbidden: the scene is a pure function of time`);
        });
        break;
      case 'VariableDeclarator':
        declarePattern(node.id);
        break;
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        if (node.id) declared.add(node.id.name);
        node.params.forEach((p: AcornNode) => declarePattern(p));
        break;
      case 'CatchClause':
        declarePattern(node.param);
        break;
      case 'ClassDeclaration':
      case 'ClassExpression':
        problems.add('classes are not allowed');
        break;
      case 'WhileStatement':
      case 'DoWhileStatement':
        problems.add('while/do loops are forbidden');
        break;
      case 'ForStatement': {
        const test = node.test;
        const bound = test?.type === 'BinaryExpression' && ['<', '<='].includes(test.operator) ? test.right : null;
        const ok = bound && ((bound.type === 'Literal' && typeof bound.value === 'number' && bound.value <= 60) || (bound.type === 'MemberExpression' && !bound.computed && bound.property.name === 'length'));
        if (!ok) problems.add('for-loops must be bounded by a small number (≤ 60) or an array length');
        break;
      }
      case 'ForInStatement':
        problems.add('for…in loops are forbidden');
        break;
      case 'NewExpression':
        problems.add('`new` is forbidden');
        break;
      case 'ImportExpression':
      case 'ThisExpression':
      case 'YieldExpression':
      case 'AwaitExpression':
        problems.add(`${node.type.replace('Expression', '').toLowerCase()} is forbidden`);
        break;
      case 'TaggedTemplateExpression':
        problems.add('tagged templates are forbidden');
        break;
      case 'MemberExpression': {
        const name = !node.computed ? node.property.name : node.property.type === 'Literal' ? String(node.property.value) : null;
        if (name && FORBIDDEN_MEMBERS.has(name)) problems.add(`property \`${name}\` is forbidden`);
        if (node.computed && node.property.type === 'Literal' && typeof node.property.value === 'string') problems.add('computed access with a string literal is forbidden (use dot notation)');
        if (node.computed && (node.property.type === 'BinaryExpression' || node.property.type === 'TemplateLiteral' || node.property.type === 'CallExpression')) problems.add('computed access must use a plain index or variable');
        // Les textes lus dans s.slots (contrôle « toutes les cases sont montrées »).
        if (!node.computed && node.object.type === 'MemberExpression' && !node.object.computed && node.object.property.name === 'slots') usedSlots.add(node.property.name);
        break;
      }
      case 'Literal':
        if (typeof node.value === 'string' && node.value.split(/\s+/).length >= 4 && /[a-zà-ÿ]{3,}\s+[a-zà-ÿ]{3,}/i.test(node.value) && !/var\(--|calc\(|translate|scale|\d+%/.test(node.value)) problems.add(`copy written in the code ("${node.value.slice(0, 40)}…"): read texts from s.slots`);
        break;
    }
  });
  // Seconde passe : identifiants libres (ni propriété, ni clé d'objet, ni déclarés).
  walk.ancestor(ast, {
    Identifier(node: AcornNode, ancestors: AcornNode[]) {
      const parent = ancestors[ancestors.length - 2];
      if (!parent) return;
      if (parent.type === 'MemberExpression' && parent.property === node && !parent.computed) return;
      if ((parent.type === 'Property' || parent.type === 'MethodDefinition') && parent.key === node && !parent.computed) return;
      if (parent.type === 'ImportSpecifier' || parent.type === 'ImportDefaultSpecifier' || parent.type === 'ImportNamespaceSpecifier' || parent.type === 'ExportSpecifier') return;
      if (parent.type === 'LabeledStatement' || parent.type === 'BreakStatement' || parent.type === 'ContinueStatement') return;
      if (!declared.has(node.name) && !ALLOWED_GLOBALS.has(node.name)) globals.add(node.name);
    },
  });
  for (const g of globals) problems.add(`\`${g}\` is not available (only @idem/kit, React and Math/Number/String/Array/Object/Boolean)`);
  const missing = slotKeys.filter((k) => !usedSlots.has(k) && !new RegExp(`\\b(contentOf|slots\\s*\\[)`).test(tsx));
  if (missing.length) problems.add(`these texts are never shown: ${missing.map((k) => `s.slots.${k}`).join(', ')}`);
  return [...issues, ...problems];
}

/** TSX → module CommonJS exécuté par le moteur (kit-api.ts#loadCustomScenes), avec cache. */
const compiled = new Map<string, string>();
export async function compileSceneCode(tsx: string): Promise<string> {
  const hash = crypto.createHash('sha1').update(tsx).digest('hex');
  const hit = compiled.get(hash);
  if (hit) return hit;
  const esbuild = require('esbuild');
  const { code } = await esbuild.transform(tsx, { loader: 'tsx', format: 'cjs', target: 'es2019', jsx: 'transform', jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment', logLevel: 'silent' });
  const js = `var React = require("react");\n${code}`;
  if (compiled.size > 200) compiled.clear();
  compiled.set(hash, js);
  return js;
}

// ─── Contrôle de rendu ──────────────────────────────────────────────────────

export interface CheckTarget {
  key: string;
  start: number;
  duration: number;
  texts: string[];
}

/**
 * Les défauts constatés sur la page RENDUE (vide = la scène est acceptée). La page est
 * fournie par l'appelant (navigateur de rendu, réseau filtré strictement).
 */
/** Les nombres d'un texte (« 12 000 », « 87 % », « 1,5 ») — même lecture que le kit (`kit/data.ts#numbersIn`). */
export function numbersOfText(text?: string | null): number[] {
  const out: number[] = [];
  for (const m of String(text || '').matchAll(/[-−]?\d{1,3}(?:[ \u00a0\u202f.,]\d{3})+(?:[.,]\d+)?|[-−]?\d+(?:[.,]\d+)?/g)) {
    const raw = m[0].replace('−', '-').replace(/[ \u00a0\u202f]/g, '').replace(/[.,](?=\d{3}(?:\D|$))/g, '').replace(',', '.');
    const n = Number(raw);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

export async function inspectRenderedScene(page: Page, target: CheckTarget, size: { width: number; height: number }, capture?: { frames: Buffer[] }): Promise<string[]> {
  const issues: string[] = [];
  const sharp = (await import('sharp')).default;
  const times = [target.start + 0.12, target.start + target.duration * 0.45, target.start + Math.max(0.5, target.duration - 0.55)];
  const shoot = async (t: number) => {
    await page.evaluate((x: number) => (window as any).__IDEM_VIDEO__.seek(x), t);
    return Buffer.from(await page.screenshot({ type: 'png' }));
  };
  const forward: Buffer[] = [];
  for (const t of times) forward.push(await shoot(t));
  if (capture) capture.frames = forward.slice();

  // État posé (dernier instant) : erreurs, scène affichée, textes présents et dans le cadre.
  const probe = await page.evaluate(
    (key: string, texts: string[], w: number, h: number) => {
      const errors = (window as any).__IDEM_SCENE_ERRORS__ || {};
      const host = document.querySelector(`[data-custom-scene="${key}"]`);
      const section = host?.closest('section');
      const norm = (v: string) => v.toLowerCase().replace(/\s+/g, ' ').trim();
      const content = norm(section?.textContent || '');
      // Les nombres passent par l'odomètre (colonnes de chiffres) : ils ne se lisent pas tels quels dans le DOM.
      const missing = texts.filter((t) => !/^[\d\s.,%+\-–€$FCA]{1,14}$/i.test(t.trim()) && !content.includes(norm(t)));
      const outside: string[] = [];
      if (section) {
        for (const el of Array.from(section.querySelectorAll<HTMLElement>('*'))) {
          const own = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent || '').trim().length > 1);
          if (!own) continue;
          const visible = (el as any).checkVisibility ? (el as any).checkVisibility({ opacityProperty: true, visibilityProperty: true }) : true;
          if (!visible) continue;
          const r = el.getBoundingClientRect();
          if (r.width > 0 && (r.left < -2 || r.top < -2 || r.right > w + 2 || r.bottom > h + 2)) outside.push((el.textContent || '').trim().slice(0, 30));
        }
      }
      // Les chiffres affichés par les graphiques du kit (ChartJs, DataArc, GrowArea).
      const charted: number[] = [];
      section?.querySelectorAll('[data-chart-values]').forEach((el) => {
        try {
          for (const v of JSON.parse(el.getAttribute('data-chart-values') || '[]')) if (typeof v === 'number') charted.push(v);
        } catch {
          /* attribut illisible : ignoré */
        }
      });
      return { error: errors[key] as string | undefined, shown: !!host, missing, outside: outside.slice(0, 4), charted };
    },
    target.key,
    target.texts,
    size.width,
    size.height
  );
  if (probe.error) issues.push(`runtime error: ${probe.error}`);
  if (!probe.shown && !probe.error) issues.push('the component did not render');
  if (probe.missing.length) issues.push(`texts not visible at the end of the scene: ${probe.missing.map((t) => `"${t.slice(0, 30)}"`).join(', ')}`);
  if (probe.outside.length) issues.push(`text outside the frame: ${probe.outside.map((t) => `"${t}"`).join(', ')}`);
  // Règle des livrables : aucun chiffre inventé. Un graphique ne montre que des nombres des textes
  // (ou le complément à 100 d'un pourcentage : la part restante d'un anneau).
  if (probe.charted.length) {
    const known = target.texts.flatMap((t) => numbersOfText(t));
    const ok = (v: number) => known.some((k) => Math.abs(k - v) < 1e-6 || Math.abs(100 - k - v) < 1e-6);
    const invented = [...new Set(probe.charted.filter((v) => !ok(v)))];
    if (invented.length) issues.push(`the chart shows numbers that are not in the texts (${invented.slice(0, 5).join(', ')}): build data with numbersIn(s.slots.…) only`);
  }

  const raw = (png: Buffer) => sharp(png).raw().toBuffer();
  const diff = async (a: Buffer, b: Buffer, threshold: number) => {
    const [x, y] = await Promise.all([raw(a), raw(b)]);
    let n = 0;
    for (let k = 0; k < x.length; k += 4) if (Math.abs(x[k] - y[k]) > threshold || Math.abs(x[k + 1] - y[k + 1]) > threshold || Math.abs(x[k + 2] - y[k + 2]) > threshold) n++;
    return n / (x.length / 4);
  };
  // Mouvement réel : la scène change entre son début et sa fin.
  if ((await diff(forward[0], forward[forward.length - 1], 24)) < 0.01) issues.push('nothing moves: the first and last frames are the same');
  // Déterminisme : la même image dans l'autre sens.
  let worst = 0;
  for (let i = times.length - 1; i >= 0; i--) worst = Math.max(worst, await diff(forward[i], await shoot(times[i]), 8));
  if (worst > 0.002) issues.push(`the frame depends on the render order (${(worst * 100).toFixed(2)} % of pixels): use only pure functions of time`);
  return issues;
}

// ─── L'enchaînement complet, scène par scène ───────────────────────────────

export interface CodeScenesInput {
  storyboard: VideoStoryboard;
  sheet: string;
  direction: DirectionId;
  formats: string[];
  /** Compose la page d'un storyboard (format principal) — fournie par le service. */
  compose: (storyboard: VideoStoryboard) => Promise<{ html: string; spec: { width: number; height: number } }>;
  /** Ouvre une page de rendu contrôlée (strict) et y exécute `fn`. */
  withPage: <T>(input: { html: string; width: number; height: number; strict?: boolean }, fn: (page: Page) => Promise<T>) => Promise<T>;
  onScene?: (key: string, state: 'running' | 'done', ok?: boolean) => void;
}

export interface CodeScenesResult {
  tried: number;
  coded: number;
  /** Défauts constatés par scène refusée (journal). */
  rejected: Record<string, string[]>;
}

/** Les textes visibles d'une scène (cases déclarées, non vides). */
export function visibleTexts(sceneId: string, slots: Record<string, string>): string[] {
  return (SCENES[sceneId]?.slots || []).map((d) => slots[d.key]).filter((v): v is string => !!v && v.trim().length > 0);
}

/**
 * Écrit, contrôle et retient le composant de chaque scène possible. Une scène refusée garde
 * sa composition (le rendu « Max ») : la vidéo n'est jamais dégradée par le cran Ultra.
 */
export async function codeScenes(input: CodeScenesInput, orchestrator: CreativeOrchestrator): Promise<CodeScenesResult> {
  const { storyboard } = input;
  const result: CodeScenesResult = { tried: 0, coded: 0, rejected: {} };
  // Les contrôles de rendu passent un par un (CPU) ; les appels au modèle, eux, en parallèle.
  let lock: Promise<unknown> = Promise.resolve();
  const exclusive = <T>(job: () => Promise<T>): Promise<T> => {
    const run = lock.then(job, job);
    lock = run.catch(() => undefined);
    return run;
  };
  const targets = storyboard.scenes
    .map((sc, i) => ({ sc, i }))
    .filter(({ sc }) => CODABLE_SCENES.has(sc.sceneId) && !(sc.sceneId === 'product' && sc.video));

  const one = async ({ sc, i }: { sc: VideoSceneInstance; i: number }) => {
    result.tried++;
    input.onScene?.(sc.key, 'running');
    const slotKeys = (SCENES[sc.sceneId]?.slots || []).map((d) => d.key).filter((k) => sc.slots[k]);
    const scene: CoderScene = {
      key: sc.key,
      sceneId: sc.sceneId,
      index: i,
      count: storyboard.scenes.length,
      duration: sc.duration,
      slots: sc.slots,
      accent: !!sc.accent,
      layout: sc.layout,
      hasImage: !!sc.image,
      hasIcons: !!storyboard.kit?.icons?.[sc.key]?.length,
      formats: input.formats,
      neighbours: [storyboard.scenes[i - 1], storyboard.scenes[i + 1]].filter(Boolean).map((n) => `${n!.sceneId}${n!.layout ? ` (${n!.layout})` : ''}`),
    };
    const prompt = buildCoderPrompt(input.sheet, input.direction, scene);
    const ask = (user: string, attempt: number) =>
      orchestrator.run<string | null>({
        role: 'sceneCoder',
        key: `sceneCoder:${i + 1}${attempt ? ':repair' : ''}`,
        minLevel: 'ultra',
        profile: 'coder',
        prompt: () => ({ system: prompt.system, user }),
        parse: (raw) => extractCode(raw) ?? undefined,
        fallback: () => null,
      });

    let tsx = (await ask(prompt.user, 0)).value;
    let issues: string[] = tsx ? await lintSceneCode(tsx, slotKeys) : ['no code returned'];
    let repaired = false;
    const check = async (code: string): Promise<string[]> => {
      try {
        await compileSceneCode(code);
      } catch (error: any) {
        return [`compilation failed: ${error?.errors?.[0]?.text || error?.message}`];
      }
      // La scène seule passe en code : les autres gardent leur composition pendant le contrôle.
      const probe: VideoStoryboard = { ...storyboard, scenes: storyboard.scenes.map((s) => (s.key === sc.key ? { ...s, code: { tsx: code } } : { ...s, code: undefined })) };
      const { html, spec } = await input.compose(probe);
      return exclusive(() =>
        input.withPage({ html, width: spec.width, height: spec.height, strict: true }, (page) =>
          inspectRenderedScene(page, { key: sc.key, start: sc.start, duration: sc.duration, texts: visibleTexts(sc.sceneId, sc.slots) }, spec)
        )
      ).catch((error: any) => [`render check failed: ${error?.message || error}`]);
    };
    if (tsx && !issues.length) issues = await check(tsx);
    if (issues.length && tsx && !repaired) {
      repaired = true;
      const fixed = (await ask(buildRepairPrompt(tsx, issues), 1)).value;
      if (fixed) {
        tsx = fixed;
        issues = await lintSceneCode(tsx, slotKeys);
        if (!issues.length) issues = await check(tsx);
      }
    }
    if (tsx && !issues.length) {
      sc.code = { tsx, agent: 'sceneCoder' };
      result.coded++;
      input.onScene?.(sc.key, 'done', true);
    } else {
      result.rejected[sc.key] = issues;
      input.onScene?.(sc.key, 'done', false);
    }
  };

  // Trois scènes écrites en même temps au plus : le fournisseur ralentit au-delà.
  let next = 0;
  const worker = async () => {
    while (next < targets.length) await one(targets[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(3, targets.length) }, worker));
  return result;
}
