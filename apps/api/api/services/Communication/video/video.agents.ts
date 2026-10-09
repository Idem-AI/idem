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
import { agentLines, boundedNumber, brandSheet as genericBrandSheet, LETTERS, menuLines, pairs, pickOption } from '../../creativity/agent-io';

// Les lecteurs de réponse sont communs à tous les livrables ; réexportés pour les contrôles.
export { agentLines, pairs, pickOption };

export type AgentName = 'strategist' | 'writer' | 'artDirector' | 'animator' | 'soundDesigner' | 'critic' | (string & {});

export interface AgentRun {
  agent: AgentName;
  /** llm = la réponse du modèle a été (au moins en partie) retenue ; graph = repli du code. */
  source: 'llm' | 'graph';
  tokens: { input: number; output: number };
  ms: number;
  /** Nombre de décisions du modèle retenues après validation. */
  kept?: number;
}

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

/** La charte et sa DA, en 3 à 5 lignes : la même pour tous les agents (cf. creativity/agent-io.ts). */
export function brandSheet({ ctx, palette, fonts, art }: BrandSheetInput): string {
  return genericBrandSheet({ brandName: ctx.brandName, businessType: ctx.businessType, tone: ctx.tone, palette, fonts, art });
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
  /**
   * Le menu du moteur créatif (video.planner.ts) : 3 à 5 MOTIFS déjà jugés pertinents, nouveaux et
   * fidèles à la charte. Présent, il remplace le menu des mises en page : l'agent choisit une façon
   * de servir l'intention de la scène, le code la résout en mise en page et en entrée de titre.
   */
  patterns?: { id: string; pitch: string; layout?: string }[];
  /** L'intention de la scène (ce qu'elle doit faire ressentir). */
  intent?: string;
  /**
   * Cran Max : l'agent règle aussi des paramètres BORNÉS de la scène. `surfaces` est le menu
   * des surfaces admises (celles que la stratégie de couleur de la DA emploie déjà).
   */
  tune?: { surfaces: string[] };
}

/** Paramètres de composition réglés par le directeur artistique au cran Max (tous bornés). */
export interface SceneTuning {
  /** Taille des titres : 0,85 (retenue) à 1,25 (affiche). */
  scale?: number;
  align?: 'left' | 'center';
  surface?: string;
  /** Tempo des entrées de la scène. */
  tempo?: 'calm' | 'normal' | 'lively';
  /** Fond graphique du kit posé sur la scène. */
  decor?: boolean;
}

export interface ArtDirectorChoice {
  layout?: LayoutId;
  /** Motif choisi dans le menu du moteur créatif. */
  pattern?: string;
  /** Index du mot mis en valeur dans le titre. */
  emphasis?: number;
  tuning?: SceneTuning;
}

/** Tempo → multiplicateur du rythme des entrées. */
export const TEMPO_PACE: Record<NonNullable<SceneTuning['tempo']>, number> = { calm: 1.15, normal: 1, lively: 0.88 };

export function buildArtDirectorPrompt(sheet: string, direction: DirectionId, scene: ArtDirectorScene, previous?: string): { system: string; user: string } {
  const system = [
    'You are the art director of a professional motion-design video. You lay out ONE scene, true to the brand charter and its art direction.',
    'Output ONLY these lines:',
    scene.patterns?.length ? 'pattern: the letter of one option from PATTERNS' : 'layout: the letter of one option from LAYOUTS',
    'word: the single most important word of the headline, copied exactly',
    ...(scene.tune
      ? [
          'scale: headline size from 0.85 (restrained) to 1.25 (poster)',
          'align: left | center',
          `surface: one of ${scene.tune.surfaces.join(' | ')}`,
          'tempo: calm | normal | lively',
          'decor: yes | no (graphic background behind this scene)',
        ]
      : []),
    scene.patterns?.length ? 'Pick the option that best serves the INTENT, true to the brand; the first one is recommended.' : 'Prefer a bold, graphic layout over the classic one unless the brand asks for restraint.',
  ].join('\n');
  const user = [
    sheet,
    `MOTION DIRECTION: ${DIRECTION_PITCH[direction]}`,
    `SCENE ${scene.index + 1} of ${scene.count}: ${scene.sceneId}${scene.duration ? `, ${scene.duration.toFixed(1)} s` : ''}${scene.accent ? ' — the big moment of the video' : ''}`,
    `TEXT: ${scene.texts.filter(Boolean).map((t) => `"${t}"`).join(' / ')}`,
    scene.intent ? `INTENT: ${scene.intent}` : '',
    previous ? `PREVIOUS SCENE LAYOUT: ${previous} (do not repeat it)` : '',
    ...(scene.patterns?.length
      ? ['PATTERNS:', ...menuLines(scene.patterns.map((p) => p.id), (id) => scene.patterns!.find((p) => p.id === id)!.pitch)]
      : ['LAYOUTS:', ...menuLines(scene.menu, (id) => (id === 'classic' ? 'the motion direction’s own composition' : LAYOUT_CATALOGUE[id as Exclude<LayoutId, 'classic'>].summary))]),
  ]
    .filter(Boolean)
    .join('\n');
  return { system, user };
}

export function parseArtDirector(raw: string, scene: ArtDirectorScene): ArtDirectorChoice {
  const lines = agentLines(raw);
  const out: ArtDirectorChoice = {};
  // Un modèle qui ne répond qu'une lettre : elle vaut pour la mise en page.
  const layoutValue = lines.pattern || lines.motif || lines.layout || lines.mise || lines.option || (/^\W*[a-p]\W*$/i.test(raw.trim()) ? raw.trim() : undefined);
  if (scene.patterns?.length) {
    // Un motif du menu (par lettre ou par identifiant) : le code le résout en mise en page.
    const id = pickOption(layoutValue, scene.patterns.map((p) => p.id));
    const picked = scene.patterns.find((p) => p.id === id);
    if (picked) {
      out.pattern = picked.id;
      if (picked.layout) out.layout = picked.layout as LayoutId;
    }
  } else out.layout = pickOption(layoutValue, scene.menu);
  const word = (lines.word || lines.mot || '').toLowerCase().replace(/[^\p{L}\p{N}%€$'-]/gu, '');
  if (word) {
    const words = (scene.texts[0] || '').split(/\s+/).map((w) => w.toLowerCase().replace(/[^\p{L}\p{N}%€$'-]/gu, ''));
    const at = words.findIndex((w) => w === word);
    if (at >= 0) out.emphasis = at;
  }
  if (scene.tune) {
    const tuning: SceneTuning = {};
    const scale = boundedNumber(lines.scale || lines.size, 0.85, 1.25);
    if (scale != null) tuning.scale = Math.round(scale * 100) / 100;
    const align = (lines.align || lines.alignment || '').toLowerCase();
    if (/^(left|gauche)/.test(align)) tuning.align = 'left';
    else if (/^(center|centre|middle)/.test(align)) tuning.align = 'center';
    const surface = pickOption(lines.surface || lines.color || lines.colour, scene.tune.surfaces);
    if (surface) tuning.surface = surface;
    const tempo = (lines.tempo || lines.pace || '').toLowerCase();
    if (/calm|slow|pos/.test(tempo)) tuning.tempo = 'calm';
    else if (/live|fast|viv|energ/.test(tempo)) tuning.tempo = 'lively';
    else if (/normal|medium/.test(tempo)) tuning.tempo = 'normal';
    const decor = (lines.decor || lines.background || '').toLowerCase();
    if (/^(yes|oui|true|on)/.test(decor)) tuning.decor = true;
    else if (/^(no|non|false|off)/.test(decor)) tuning.decor = false;
    if (Object.keys(tuning).length) out.tuning = tuning;
  }
  return out;
}

/** Les directeurs artistiques, une scène chacun, au plus `concurrency` en même temps. */
export async function runArtDirectors(
  writer: CopyWriter | undefined,
  sheet: string,
  direction: DirectionId,
  scenes: ArtDirectorScene[],
  concurrency = 4,
  /**
   * Cran Max : les scènes à fort enjeu (accroche, grand moment) sont tirées plusieurs fois en
   * parallèle et départagées par le CODE (`score`, plus bas = meilleur) — jamais par un juge IA.
   */
  bestOf?: { samples: (scene: ArtDirectorScene) => number; score: (choice: ArtDirectorChoice, scene: ArtDirectorScene) => number }
): Promise<{ choices: Record<number, ArtDirectorChoice>; run: AgentRun }> {
  const choices: Record<number, ArtDirectorChoice> = {};
  const run: AgentRun = { agent: 'artDirector', source: 'graph', tokens: { input: 0, output: 0 }, ms: 0, kept: 0 };
  const started = Date.now();
  const queue = scenes.filter((s) => (s.patterns?.length || s.menu.length) >= 2);
  let next = 0;
  const worker = async () => {
    while (next < queue.length) {
      const scene = queue[next++];
      const prompt = buildArtDirectorPrompt(sheet, direction, scene);
      const n = writer && bestOf ? Math.max(1, Math.min(3, bestOf.samples(scene))) : 1;
      const results = await Promise.all(Array.from({ length: n }, () => callAgent(writer, prompt.system, prompt.user)));
      const parsed: ArtDirectorChoice[] = [];
      for (const res of results) {
        run.tokens.input += res.tokens.input;
        run.tokens.output += res.tokens.output;
        const c = parseArtDirector(res.raw, scene);
        if (c.layout || c.pattern || c.emphasis != null || c.tuning) parsed.push(c);
      }
      const choice = parsed.length > 1 && bestOf ? parsed.map((c) => ({ c, s: bestOf.score(c, scene) })).sort((a, b) => a.s - b.s)[0].c : parsed[0] || {};
      if (choice.layout || choice.pattern || choice.emphasis != null || choice.tuning) {
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
  /** Cran Max : taille des titres et tempo actuels (le critique peut les corriger). */
  scale?: number;
  tempo?: string;
}

export interface CriticInput {
  sheet: string;
  direction: DirectionId;
  rhythm: string;
  scenes: CriticScene[];
  transitions: string[];
  techniques: string[];
  warnings: string[];
  /** Cran Max : le critique corrige aussi la taille des titres et le tempo. */
  tuning?: boolean;
}

export interface CriticFix {
  index: number;
  field: 'layout' | 'cut' | 'title' | 'scale' | 'tempo';
  value: string;
}

export function buildCriticPrompt(input: CriticInput): { system: string; user: string } {
  const system = [
    'You are the creative director reviewing a motion-design video before delivery: variety of layouts and cuts, rhythm, fidelity to the brand charter and art direction, readability.',
    'Propose at most 5 fixes, one per line, ONLY in these forms:',
    'N.layout=id (id from that scene’s OPTIONS)',
    'N.cut=id (transition into scene N, from CUTS)',
    'N.title=id (title entrance, from TECHNIQUES)',
    ...(input.tuning ? ['N.scale=0.85 to 1.25 (headline size)', 'N.tempo=calm|normal|lively'] : []),
    'If nothing needs fixing, answer: ok',
  ].join('\n');
  const user = [
    input.sheet,
    `MOTION DIRECTION: ${DIRECTION_PITCH[input.direction]} · RHYTHM: ${input.rhythm}`,
    'VIDEO:',
    ...input.scenes.map(
      (s, i) =>
        `${i + 1}. ${s.sceneId} ${s.duration.toFixed(1)}s layout=${s.layout || '-'} cut=${s.transition || '-'} title=${s.technique || '-'}${input.tuning ? ` scale=${s.scale ?? 1} tempo=${s.tempo || 'normal'}` : ''}${s.title ? ` "${s.title.slice(0, 50)}"` : ''}${s.layouts.length ? ` OPTIONS: ${s.layouts.join(', ')}` : ''}`
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
  for (const m of (raw || '').matchAll(/(\d{1,2})\s*\.\s*(layout|cut|transition|title|technique|scale|size|tempo|pace)\s*[=:]\s*([a-zA-Z][a-zA-Z-]*|\d+(?:[.,]\d+)?)/gi)) {
    const index = Number(m[1]) - 1;
    const key = m[2].toLowerCase();
    const field = (/cut|transition/.test(key) ? 'cut' : /title|technique/.test(key) ? 'title' : /scale|size/.test(key) ? 'scale' : /tempo|pace/.test(key) ? 'tempo' : 'layout') as CriticFix['field'];
    const scene = input.scenes[index];
    if (!scene) continue;
    let value = m[3];
    if (field === 'scale') {
      const n = boundedNumber(value, 0.85, 1.25);
      if (n == null) continue;
      value = String(Math.round(n * 100) / 100);
    }
    const ok =
      field === 'layout'
        ? scene.layouts.includes(value)
        : field === 'cut'
          ? index >= 1 && input.transitions.includes(value)
          : field === 'scale' || field === 'tempo'
            ? !!input.tuning && index < input.scenes.length - 1 && (field === 'scale' || ['calm', 'normal', 'lively'].includes(value.toLowerCase()))
            : index < input.scenes.length - 1 && input.techniques.includes(value);
    if (field === 'tempo') value = value.toLowerCase();
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
