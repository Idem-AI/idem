/**
 * L'ÉQUIPE D'AGENTS — une vidéo n'est plus une grosse tâche confiée à un seul appel.
 *
 * Un modèle, surtout petit, réussit mal une tâche large (« fais une vidéo ») et bien une
 * tâche étroite (« choisis la mise en page de CETTE scène parmi ces trois »). La vidéo est
 * donc découpée entre des agents spécialisés, chacun avec un prompt court, une seule
 * responsabilité, et des menus que le graphe a déjà filtrés par la direction de motion
 * ET par la DA de la charte (ce que la charte exclut n'est jamais proposé) :
 *
 *   Stratège        video.storyline.ts   objectif, concept, enchaînement, grand moment, rythme
 *   Rédacteur       video.copy.ts        les textes à l'écran
 *   Directeur art.  ici, UNE scène       mise en page (archétype) et mot mis en valeur — en parallèle
 *   Animateur       ici, le film         transition de chaque coupe, entrées de titre, caméra,
 *                                        famille d'entrée, animation du logo
 *   Sound designer  ici                  la piste parmi les candidates, l'intensité des effets
 *   Critique        ici                  relit le film résumé, ≤ 5 corrections (grammaire fermée)
 *
 * Tous reçoivent la même fiche de marque (`brandSheet`) : couleurs, polices, DA (style,
 * intention, mots-clés), à faire / à éviter. Chaque réponse est lue ligne à ligne et
 * validée : une ligne absente, fausse ou inventée est remplacée par le choix du graphe.
 * Un agent qui échoue (modèle indisponible, délai) ne bloque jamais la vidéo.
 */
import { ArtDirectionModel } from '../../../models/art-direction.model';
import { MusicTrack } from '../../../models/motionVideo.model';
import { CopyContext, CopyWriter, estimateTokens } from './video.copy';
import { DirectionId, MotionTransition, TRANSITION_CATALOGUE, WeightedTransition } from './video.direction';
import { LAYOUT_CATALOGUE, LayoutId } from './video.layouts';

export type AgentName = 'strategist' | 'writer' | 'artDirector' | 'animator' | 'soundDesigner' | 'critic';

export interface AgentRun {
  agent: AgentName;
  /** llm = la réponse du modèle a été (au moins en partie) retenue ; graph = repli du code. */
  source: 'llm' | 'graph';
  tokens: { input: number; output: number };
  ms: number;
  /** Nombre de décisions du modèle retenues après validation. */
  kept?: number;
}

const LETTERS = 'abcdefghijklmnop';
const AGENT_TIMEOUT_MS = 25000;

/** Un appel d'agent : délai borné, jamais d'exception (une réponse vide = repli). */
export async function callAgent(writer: CopyWriter | undefined, system: string, user: string): Promise<{ raw: string; tokens: { input: number; output: number }; ms: number }> {
  const started = Date.now();
  if (!writer) return { raw: '', tokens: { input: 0, output: 0 }, ms: 0 };
  let raw = '';
  try {
    raw = await Promise.race([writer(system, user), new Promise<string>((_, reject) => setTimeout(() => reject(new Error('agent_timeout')), AGENT_TIMEOUT_MS))]);
  } catch {
    raw = '';
  }
  return { raw: String(raw || ''), tokens: { input: estimateTokens(system + user), output: estimateTokens(raw || '') }, ms: Date.now() - started };
}

/** Lignes `clé: valeur` d'une réponse, quelle qu'en soit la forme (puces, gras, JSON, majuscules). */
export function agentLines(raw: string): Record<string, string> {
  let text = (raw || '').replace(/```[a-z]*\n?/gi, '').trim();
  if (/^\{/.test(text)) {
    try {
      const data = JSON.parse(text);
      text = Object.entries(data)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : typeof v === 'object' && v ? Object.entries(v as Record<string, unknown>).map(([a, b]) => `${a}=${b}`).join(', ') : v}`)
        .join('\n');
    } catch {
      /* lignes telles quelles */
    }
  }
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^[\s*_#>-]*([a-zA-Zéè]+)[*_\s]*[:=]\s*(.+)$/);
    if (m) out[m[1].toLowerCase()] = m[2].trim().replace(/^["'*`]+|["'*`.]+$/g, '');
  }
  return out;
}

/** Une option désignée par sa lettre (« b », « b) », « B - ») ou par son identifiant. */
export function pickOption<T extends string>(value: string | undefined, options: readonly T[]): T | undefined {
  if (!value) return undefined;
  const v = value.trim();
  const letter = v.match(/^([a-p])(?:\W|$)/i);
  if (letter) {
    const i = LETTERS.indexOf(letter[1].toLowerCase());
    if (i >= 0 && i < options.length) return options[i];
  }
  const id = v.toLowerCase().replace(/[^a-z0-9-]/g, '');
  return options.find((o) => o.toLowerCase() === id) || options.find((o) => id.includes(o.toLowerCase()));
}

/** Paires « n=valeur » (« 2=b, 3=split », « 2: b », « scene 2 → b »). */
export function pairs(value: string | undefined): [number, string][] {
  if (!value) return [];
  return [...value.matchAll(/(\d{1,2})\s*[=:→>-]+\s*([a-zA-Z][a-zA-Z-]*)/g)].map((m) => [Number(m[1]), m[2]] as [number, string]);
}

const menuLines = (ids: readonly string[], describe: (id: string) => string) => ids.map((id, i) => `${LETTERS[i]}) ${id} — ${describe(id)}`);

// ─── La fiche de marque, commune à tous les agents ──────────────────────────

/** Ce que chaque direction de motion veut dire (quelques mots pour les agents). */
export const DIRECTION_PITCH: Record<DirectionId, string> = {
  editorial: 'editorial: magazine elegance, serif-like rhythm, calm reveals',
  swiss: 'swiss: grid, flush-left type, hard cuts, color blocks',
  brutal: 'brutal: raw, huge type, hard cuts, high contrast',
  kinetic: 'kinetic: energetic typography, bounces, fast cuts',
  cinematic: 'cinematic: slow, filmic, soft dissolves, big silences',
  collage: 'collage: playful paper cut-outs, stickers, tilted cards',
  precision: 'precision: clean tech, measured motion, crisp lines',
  drenched: 'drenched: one bold brand color everywhere, graphic shapes',
};

export interface BrandSheetInput {
  ctx: CopyContext;
  palette: Record<string, string>;
  fonts: { display: string; body: string };
  art?: Partial<ArtDirectionModel> | null;
}

/** La charte et sa DA, en 3 à 5 lignes : la même pour tous les agents. */
export function brandSheet({ ctx, palette, fonts, art }: BrandSheetInput): string {
  const colors = ['primary', 'secondary', 'accent', 'background']
    .filter((k) => palette[k])
    .map((k) => `${k} ${palette[k]}`)
    .join(', ');
  const lines = [
    `BRAND: ${ctx.brandName}${ctx.businessType ? ` — ${ctx.businessType}` : ''}${ctx.tone ? ` · tone: ${ctx.tone}` : ''}`,
    `CHARTER: colors ${colors}; fonts ${fonts.display} (titles) / ${fonts.body} (text)`,
  ];
  if (art) {
    const da = [art.styleName || art.styleId, art.tagline, (art.keywords || []).slice(0, 5).join(', ')].filter(Boolean).join(' · ');
    if (da) lines.push(`ART DIRECTION: ${da}`.slice(0, 260));
    if (art.dos?.length) lines.push(`DO: ${art.dos.slice(0, 3).join('; ')}`.slice(0, 220));
    if (art.donts?.length) lines.push(`AVOID: ${art.donts.slice(0, 3).join('; ')}`.slice(0, 220));
  }
  return lines.join('\n');
}

// ─── Directeur artistique : une scène à la fois ─────────────────────────────

export interface ArtDirectorScene {
  index: number;
  count: number;
  sceneId: string;
  duration?: number;
  /** Les textes de la scène (titre d'abord). */
  texts: string[];
  /** Le grand moment du film ? */
  accent?: boolean;
  menu: LayoutId[];
}

export interface ArtDirectorChoice {
  layout?: LayoutId;
  /** Index du mot mis en valeur dans le titre. */
  emphasis?: number;
}

export function buildArtDirectorPrompt(sheet: string, direction: DirectionId, scene: ArtDirectorScene, previous?: string): { system: string; user: string } {
  const system = [
    'You are the art director of a professional motion-design video. You lay out ONE scene, true to the brand charter and its art direction.',
    'Output ONLY these two lines:',
    'layout: the letter of one option from LAYOUTS',
    'word: the single most important word of the headline, copied exactly',
    'Prefer a bold, graphic layout over the classic one unless the brand asks for restraint.',
  ].join('\n');
  const user = [
    sheet,
    `MOTION DIRECTION: ${DIRECTION_PITCH[direction]}`,
    `SCENE ${scene.index + 1} of ${scene.count}: ${scene.sceneId}${scene.duration ? `, ${scene.duration.toFixed(1)} s` : ''}${scene.accent ? ' — the big moment of the video' : ''}`,
    `TEXT: ${scene.texts.filter(Boolean).map((t) => `"${t}"`).join(' / ')}`,
    previous ? `PREVIOUS SCENE LAYOUT: ${previous} (do not repeat it)` : '',
    'LAYOUTS:',
    ...menuLines(scene.menu, (id) => (id === 'classic' ? 'the motion direction’s own composition' : LAYOUT_CATALOGUE[id as Exclude<LayoutId, 'classic'>].summary)),
  ]
    .filter(Boolean)
    .join('\n');
  return { system, user };
}

export function parseArtDirector(raw: string, scene: ArtDirectorScene): ArtDirectorChoice {
  const lines = agentLines(raw);
  const out: ArtDirectorChoice = {};
  // Un modèle qui ne répond qu'une lettre : elle vaut pour la mise en page.
  const layoutValue = lines.layout || lines.mise || lines.option || (/^\W*[a-p]\W*$/i.test(raw.trim()) ? raw.trim() : undefined);
  out.layout = pickOption(layoutValue, scene.menu);
  const word = (lines.word || lines.mot || '').toLowerCase().replace(/[^\p{L}\p{N}%€$'-]/gu, '');
  if (word) {
    const words = (scene.texts[0] || '').split(/\s+/).map((w) => w.toLowerCase().replace(/[^\p{L}\p{N}%€$'-]/gu, ''));
    const at = words.findIndex((w) => w === word);
    if (at >= 0) out.emphasis = at;
  }
  return out;
}

/** Les directeurs artistiques, une scène chacun, au plus `concurrency` en même temps. */
export async function runArtDirectors(
  writer: CopyWriter | undefined,
  sheet: string,
  direction: DirectionId,
  scenes: ArtDirectorScene[],
  concurrency = 4
): Promise<{ choices: Record<number, ArtDirectorChoice>; run: AgentRun }> {
  const choices: Record<number, ArtDirectorChoice> = {};
  const run: AgentRun = { agent: 'artDirector', source: 'graph', tokens: { input: 0, output: 0 }, ms: 0, kept: 0 };
  const started = Date.now();
  const queue = scenes.filter((s) => s.menu.length >= 2);
  let next = 0;
  const worker = async () => {
    while (next < queue.length) {
      const scene = queue[next++];
      const prompt = buildArtDirectorPrompt(sheet, direction, scene);
      const res = await callAgent(writer, prompt.system, prompt.user);
      run.tokens.input += res.tokens.input;
      run.tokens.output += res.tokens.output;
      const choice = parseArtDirector(res.raw, scene);
      if (choice.layout || choice.emphasis != null) {
        choices[scene.index] = choice;
        run.kept = (run.kept || 0) + 1;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
  run.ms = Date.now() - started;
  if (run.kept) run.source = 'llm';
  return { choices, run };
}

// ─── Animateur : le mouvement du film ───────────────────────────────────────

export interface AnimatorInput {
  sheet: string;
  direction: DirectionId;
  rhythm: string;
  scenes: { sceneId: string; layout?: string; duration: number; title?: string }[];
  transitions: WeightedTransition[];
  techniques: string[];
  cameras: string[];
  entrances: string[];
  logos: string[];
}

export interface AnimatorChoice {
  /** Index de scène (0-based) → transition qui l'ouvre. */
  cuts: Record<number, MotionTransition>;
  /** Index de scène → entrée du titre. */
  titles: Record<number, string>;
  camera?: string;
  entrance?: string;
  logo?: string;
}

export function buildAnimatorPrompt(input: AnimatorInput): { system: string; user: string } {
  const ids = input.transitions.map((t) => t.id);
  const system = [
    'You are the animator of a professional motion-design video. Decide how it moves, ONLY from the menus. Output ONLY these lines:',
    `cuts: for scenes 2 to ${input.scenes.length}, "scene number=letter" from TRANSITIONS (e.g. 2=a, 3=c); never the same letter twice in a row; vary them`,
    'titles: up to 3 pairs "scene number=technique" from TECHNIQUES',
    input.cameras.length ? `camera: one of ${input.cameras.join(' | ')}` : '',
    input.entrances.length ? `entrance: one of ${input.entrances.join(' | ')}` : '',
    input.logos.length ? `logo: one of ${input.logos.join(' | ')}` : '',
    'Match the rhythm and the brand art direction: refined brands get soft or graphic cuts, energetic brands sharp ones. Put the strongest cut before the big moment.',
  ]
    .filter(Boolean)
    .join('\n');
  const user = [
    input.sheet,
    `MOTION DIRECTION: ${DIRECTION_PITCH[input.direction]} · RHYTHM: ${input.rhythm}`,
    'SCENES:',
    ...input.scenes.map((s, i) => `${i + 1}. ${s.sceneId}${s.layout && s.layout !== 'classic' ? ` (${s.layout})` : ''}, ${s.duration.toFixed(1)} s${s.title ? `: "${s.title.slice(0, 60)}"` : ''}`),
    'TRANSITIONS:',
    ...menuLines(ids, (id) => TRANSITION_CATALOGUE[id as MotionTransition].summary),
    `TECHNIQUES: ${input.techniques.join(', ')}`,
  ].join('\n');
  return { system, user };
}

export function parseAnimator(raw: string, input: AnimatorInput): AnimatorChoice {
  const lines = agentLines(raw);
  const ids = input.transitions.map((t) => t.id);
  const out: AnimatorChoice = { cuts: {}, titles: {} };
  for (const [n, v] of pairs(lines.cuts || lines.transitions || lines.cut)) {
    const i = n - 1;
    const id = pickOption(v, ids);
    if (id && i >= 1 && i < input.scenes.length) out.cuts[i] = id;
  }
  for (const [n, v] of pairs(lines.titles || lines.moves || lines.title)) {
    const i = n - 1;
    const tech = input.techniques.find((t) => t.toLowerCase() === v.toLowerCase());
    if (tech && i >= 0 && i < input.scenes.length - 1 && Object.keys(out.titles).length < 3) out.titles[i] = tech;
  }
  out.camera = pickOption(lines.camera, input.cameras);
  out.entrance = pickOption(lines.entrance || lines.entree, input.entrances);
  out.logo = pickOption(lines.logo, input.logos);
  return out;
}

export async function runAnimator(writer: CopyWriter | undefined, input: AnimatorInput): Promise<{ choice: AnimatorChoice; run: AgentRun }> {
  const prompt = buildAnimatorPrompt(input);
  const res = await callAgent(writer, prompt.system, prompt.user);
  const choice = parseAnimator(res.raw, input);
  const kept = Object.keys(choice.cuts).length + Object.keys(choice.titles).length + [choice.camera, choice.entrance, choice.logo].filter(Boolean).length;
  return { choice, run: { agent: 'animator', source: kept ? 'llm' : 'graph', tokens: res.tokens, ms: res.ms, kept } };
}

// ─── Sound designer ─────────────────────────────────────────────────────────

export interface SoundInput {
  sheet: string;
  request: string;
  rhythm: string;
  mood: string;
  durationSec: number;
  tracks: Pick<MusicTrack, 'id' | 'title' | 'artist' | 'moods' | 'bpm' | 'durationSec'>[];
}

export interface SoundChoice {
  trackId?: string;
  intensity?: 'subtle' | 'normal' | 'punchy';
}

export function buildSoundPrompt(input: SoundInput): { system: string; user: string } {
  const system = [
    'You are the sound designer of a professional brand video. Choose the music and the strength of the sound effects. Output ONLY:',
    'track: the letter of one track from TRACKS',
    'sfx: subtle | normal | punchy',
    'The music must fit the brand tone, the request and the rhythm; never a sad, ironic or comic track for a brand.',
  ].join('\n');
  const user = [
    input.sheet,
    `REQUEST: ${input.request.slice(0, 300)}`,
    `RHYTHM: ${input.rhythm} · MOOD: ${input.mood} · ${input.durationSec} s`,
    'TRACKS:',
    ...input.tracks.map((t, i) => `${LETTERS[i]}) "${t.title}"${t.artist ? ` — ${t.artist}` : ''}${t.moods?.length ? ` · ${t.moods.slice(0, 5).join(', ')}` : ''}${t.bpm ? ` · ${Math.round(t.bpm)} bpm` : ''}`),
  ].join('\n');
  return { system, user };
}

export function parseSound(raw: string, input: SoundInput): SoundChoice {
  const lines = agentLines(raw);
  const out: SoundChoice = {};
  const ids = input.tracks.map((t) => t.id);
  const letter = pickOption(lines.track || lines.music || lines.piste, ids.map((_, i) => LETTERS[i]));
  if (letter) out.trackId = ids[LETTERS.indexOf(letter)];
  const fx = (lines.sfx || lines.effects || '').toLowerCase();
  if (/subtle|discret|light|soft/.test(fx)) out.intensity = 'subtle';
  else if (/punch|strong|appuy|bold/.test(fx)) out.intensity = 'punchy';
  else if (/normal|medium|balanced/.test(fx)) out.intensity = 'normal';
  return out;
}

export async function runSoundDesigner(writer: CopyWriter | undefined, input: SoundInput): Promise<{ choice: SoundChoice; run: AgentRun }> {
  if (!input.tracks.length) return { choice: {}, run: { agent: 'soundDesigner', source: 'graph', tokens: { input: 0, output: 0 }, ms: 0, kept: 0 } };
  const prompt = buildSoundPrompt(input);
  const res = await callAgent(writer, prompt.system, prompt.user);
  const choice = parseSound(res.raw, input);
  const kept = [choice.trackId, choice.intensity].filter(Boolean).length;
  return { choice, run: { agent: 'soundDesigner', source: kept ? 'llm' : 'graph', tokens: res.tokens, ms: res.ms, kept } };
}

// ─── Critique ───────────────────────────────────────────────────────────────

export interface CriticScene {
  sceneId: string;
  duration: number;
  layout?: string;
  transition?: string;
  technique?: string;
  title?: string;
  /** Mises en page possibles pour cette scène (menu du graphe). */
  layouts: string[];
}

export interface CriticInput {
  sheet: string;
  direction: DirectionId;
  rhythm: string;
  scenes: CriticScene[];
  transitions: string[];
  techniques: string[];
  warnings: string[];
}

export interface CriticFix {
  index: number;
  field: 'layout' | 'cut' | 'title';
  value: string;
}

export function buildCriticPrompt(input: CriticInput): { system: string; user: string } {
  const system = [
    'You are the creative director reviewing a motion-design video before delivery: variety of layouts and cuts, rhythm, fidelity to the brand charter and art direction, readability.',
    'Propose at most 5 fixes, one per line, ONLY in these forms:',
    'N.layout=id (id from that scene’s OPTIONS)',
    'N.cut=id (transition into scene N, from CUTS)',
    'N.title=id (title entrance, from TECHNIQUES)',
    'If nothing needs fixing, answer: ok',
  ].join('\n');
  const user = [
    input.sheet,
    `MOTION DIRECTION: ${DIRECTION_PITCH[input.direction]} · RHYTHM: ${input.rhythm}`,
    'VIDEO:',
    ...input.scenes.map(
      (s, i) =>
        `${i + 1}. ${s.sceneId} ${s.duration.toFixed(1)}s layout=${s.layout || '-'} cut=${s.transition || '-'} title=${s.technique || '-'}${s.title ? ` "${s.title.slice(0, 50)}"` : ''}${s.layouts.length ? ` OPTIONS: ${s.layouts.join(', ')}` : ''}`
    ),
    `CUTS: ${input.transitions.join(', ')}`,
    `TECHNIQUES: ${input.techniques.join(', ')}`,
    input.warnings.length ? `QA WARNINGS: ${input.warnings.slice(0, 4).join('; ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  return { system, user };
}

export function parseCritic(raw: string, input: CriticInput): CriticFix[] {
  const fixes: CriticFix[] = [];
  for (const m of (raw || '').matchAll(/(\d{1,2})\s*\.\s*(layout|cut|transition|title|technique)\s*[=:]\s*([a-zA-Z][a-zA-Z-]*)/gi)) {
    const index = Number(m[1]) - 1;
    const field = (/cut|transition/i.test(m[2]) ? 'cut' : /title|technique/i.test(m[2]) ? 'title' : 'layout') as CriticFix['field'];
    const scene = input.scenes[index];
    if (!scene) continue;
    const value = m[3];
    const ok =
      field === 'layout'
        ? scene.layouts.includes(value)
        : field === 'cut'
          ? index >= 1 && input.transitions.includes(value)
          : index < input.scenes.length - 1 && input.techniques.includes(value);
    if (ok && !fixes.some((f) => f.index === index && f.field === field)) fixes.push({ index, field, value });
    if (fixes.length >= 5) break;
  }
  return fixes;
}

export async function runCritic(writer: CopyWriter | undefined, input: CriticInput): Promise<{ fixes: CriticFix[]; run: AgentRun }> {
  const prompt = buildCriticPrompt(input);
  const res = await callAgent(writer, prompt.system, prompt.user);
  const fixes = parseCritic(res.raw, input);
  return { fixes, run: { agent: 'critic', source: res.raw.trim() ? 'llm' : 'graph', tokens: res.tokens, ms: res.ms, kept: fixes.length } };
}
