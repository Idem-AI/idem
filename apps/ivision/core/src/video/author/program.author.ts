/**
 * L'AUTEUR DES SCÈNES — le modèle écrit un PROGRAMME D'ANIMATION (langage de mouvement JSON,
 * `packages/motion-compiler`), le compilateur le traduit en scène Motion Canvas.
 *
 *   1. la fiche de la scène est compilée en prompt (référence du langage, deux exemples, fiche, cadres de
 *      TOUS les formats de la vidéo : un seul programme, responsive) ;
 *   2. un appel de modèle (rôle `video.author`) ;
 *   3. le programme est lu et validé (technique seulement) ; refusé, le modèle reçoit la liste exacte des
 *      erreurs et répond UNE fois de plus ;
 *   4. le compilateur produit le TSX (garanties d'affichage : textes dans leur boîte et dans la zone sûre,
 *      piste qui finit avant la coupe) ; esbuild le vérifie.
 *
 * Aucun choix esthétique, aucune composition de secours : un programme refusé deux fois rend son erreur à la
 * scène, et l'autocorrection bornée du moteur (corriger › réécrire › minimal) peut la reprendre.
 */
import type { CreativityLevel } from '../../creativity/levels';
import type { BrandTokens } from '../../../motion/kit/context';
import type { VideoFormat } from '../contracts/model';
import { callFilmModel, FilmCallContext } from '../agents';
import { compileScene } from '../rendering/compiler';
import { COMPOSITION } from '../rendering/formats';
import { compileProgram, DSL_REFERENCE, formatProgram, parseProgram, pickProgramExamples, programOf, validateProgram } from '../../../../../../packages/motion-compiler/src';
import type { MotionProgram, ProgramExample, ValidationContext } from '../../../../../../packages/motion-compiler/src';
import type { RepairStrategy } from './repair';

export interface AuthorSceneCard {
  key: string;
  index: number;
  count: number;
  duration: number;
  purpose: string;
  visual: string;
  motion: string;
  transition?: string;
  texts: Record<string, string>;
  media: { id: string; kind: 'image' | 'video'; width: number; height: number; note?: string; durationSec?: number }[];
  voice?: { text: string; at: number; duration: number };
  beat?: { bpm: number; first: number };
}

export interface AuthorContext {
  film: { title: string; concept: string; bible: string };
  /** Les formats de la vidéo (le premier est le principal) : le programme doit fonctionner dans chacun. */
  formats: VideoFormat[];
  brand: BrandTokens;
  scene: AuthorSceneCard;
  previous?: { purpose: string; visual: string };
  next?: { purpose: string; visual: string };
  level: CreativityLevel;
  /** Retouche demandée par l'utilisateur, avec le code actuel (son programme est en tête). */
  revise?: { instruction: string; code: string };
  /** Correction (automatique ou demandée) : la stratégie, le code actuel, l'erreur et les erreurs passées. */
  repair?: { strategy: RepairStrategy; code?: string; error: string; history: string[] };
}

export interface AuthoredScene {
  key: string;
  code?: string;
  error?: { stage: 'author' | 'compile'; message: string };
  tokens: { input: number; output: number };
  ms: number;
  attempts: number;
}

/** Ce que l'auteur mesure pour chaque scène (journal, banc d'essai). */
export interface AuthorReport {
  key: string;
  ok: boolean;
  calls: number;
  /** Réponses refusées par la validation puis redemandées. */
  validationRetries: number;
  errors: string[];
  warnings: string[];
  programChars: number;
  codeLines: number;
  repair?: string;
}

/** Qui écrit une scène (le service le reçoit ; les contrôles le simulent). */
export type SceneAuthor = (ctx: FilmCallContext, context: AuthorContext) => Promise<AuthoredScene>;

function exampleBlock(ex: ProgramExample): string {
  return `## ${ex.id}: ${ex.shows}\n(texts: ${ex.texts.map((t) => `$${t}`).join(', ')}${ex.media.length ? `; media: ${ex.media.map((m, i) => `${i} = ${m}`).join(', ')}` : ''})\n\`\`\`json\n${formatProgram(ex.program)}\n\`\`\``;
}

const fmt = (n: number) => String(Math.round(n * 10) / 10);
const ORIENT: Record<VideoFormat, string> = { story: 'vertical', portrait: 'vertical', square: 'square', landscape: 'horizontal' };

/** Le cadre d'un format, dans les unités du langage. */
export function frameLine(format: VideoFormat): string {
  const size = COMPOSITION[format];
  const u = Math.min(size.width, size.height) / 100;
  const extra = format === 'story' ? (size.height * 0.09) / u : 0;
  const W = size.width / u;
  const H = size.height / u;
  const SW = W - 12;
  const SH = H - 2 * (6 + extra);
  return `${format} (${ORIENT[format]}): W=${fmt(W)} H=${fmt(H)}; safe area L=${fmt(-SW / 2)} R=${fmt(SW / 2)} T=${fmt(-SH / 2)} B=${fmt(SH / 2)} (SW=${fmt(SW)} SH=${fmt(SH)})`;
}

/** Le prompt : la référence du langage, deux exemples, puis la fiche de la scène. */
export function buildProgramPrompt(c: AuthorContext): { system: string; user: string } {
  const s = c.scene;
  const formats = c.formats.length ? c.formats : (['story'] as VideoFormat[]);
  const examples = pickProgramExamples(`${s.purpose} ${s.visual} ${s.motion} ${s.transition || ''}`, s.media.map((x) => x.kind), s.index === s.count - 1);
  const system = [
    'You are a senior motion designer. You design ONE scene of a short film as a compact animation program in the IDEM Motion Language (JSON). A compiler turns it into the final animation exactly as written.',
    'Make it look designed and alive: deliberate composition, clear hierarchy, real motion design (staggered entrances, easing, overlaps, a strong moment, camera moves) — not a slide with text fading in. Every text must be readable: fully inside the frame, never on top of another text, held still long enough to be read.',
    '',
    DSL_REFERENCE,
    '',
    '# Examples of correct programs (techniques to learn from — do NOT copy their layout)',
    ...examples.map(exampleBlock),
  ].join('\n');

  const logo = c.brand.logo ? 'available (use a "logo" node)' : 'none (no logo node)';
  const multi = formats.length > 1;
  const lines = [
    `FILM: ${c.film.title || '(untitled)'} — ${c.film.concept}`,
    c.film.bible ? `BIBLE: ${c.film.bible}` : '',
    multi
      ? `FRAMES — this SAME program is rendered in ${formats.length} formats; it must look right in each (positions as fractions of SW/SH/W/H, pick(vertical, horizontal) where the layout must differ, stacks with "dir": "auto"):\n${formats.map((f) => `- ${frameLine(f)}`).join('\n')}`
      : `FRAME: ${frameLine(formats[0])}`,
    `SCENE ${s.index + 1} of ${s.count} — duration D=${s.duration.toFixed(2)} s`,
    `BRAND: ${c.brand.name || '(no brand on screen)'} — primary ${c.brand.colors.primary}, secondary ${c.brand.colors.secondary}, accent ${c.brand.colors.accent}, background ${c.brand.colors.background}, text ${c.brand.colors.text}; fonts display "${c.brand.fonts.display}", body "${c.brand.fonts.body}"; logo ${logo}`,
    c.previous ? `PREVIOUS SCENE: ${c.previous.purpose} — ${c.previous.visual}`.slice(0, 400) : 'PREVIOUS SCENE: none (this scene opens the film)',
    c.next ? `NEXT SCENE: ${c.next.purpose} — ${c.next.visual}`.slice(0, 400) : 'NEXT SCENE: none (this scene closes the film)',
    '',
    'THIS SCENE',
    `purpose: ${s.purpose}`,
    `visual: ${s.visual}`,
    `motion: ${s.motion}`,
    s.transition ? `transition: ${s.transition}` : '',
    `texts (exact, use "$KEY"): ${Object.keys(s.texts).length ? Object.entries(s.texts).map(([k, v]) => `$${k} = "${v}"`).join(' · ') : 'none'}`,
    `media: ${s.media.length ? s.media.map((x, i) => `${i} = ${x.kind}${x.width ? ` ${x.width}×${x.height}` : ''}${x.durationSec ? ` ${x.durationSec.toFixed(1)}s` : ''}${x.note ? ` — ${x.note.slice(0, 160)}` : ''}`).join(' · ') : 'none'}`,
    s.voice ? `voice-over: "${s.voice.text}" — V=${s.voice.at.toFixed(2)} s, lasts ${s.voice.duration.toFixed(2)} s (sync key moments with "at": "V+…")` : '',
    s.beat ? `music: ${Math.round(s.beat.bpm)} bpm, first beat at ${s.beat.first.toFixed(2)} s (a beat every ${(60 / s.beat.bpm).toFixed(3)} s)` : '',
  ];
  if (c.revise) {
    const current = programOf(c.revise.code);
    lines.push('', current ? `CURRENT PROGRAM OF THIS SCENE:\n\`\`\`json\n${formatProgram(current)}\n\`\`\`` : 'The current scene was written before the animation language existed: write a program that keeps its idea.', `THE CLIENT ASKS: ${c.revise.instruction}`, 'Rewrite the whole program to do what the client asks. Keep what the request does not concern.');
  }
  if (c.repair) {
    const current = programOf(c.repair.code);
    const history = c.repair.history.length ? `\nProblems already met on this scene: ${c.repair.history.slice(-3).join(' | ').slice(0, 600)}` : '';
    if (c.repair.strategy === 'fix' && current) lines.push('', `CURRENT PROGRAM OF THIS SCENE:\n\`\`\`json\n${formatProgram(current)}\n\`\`\``, `PROBLEM: ${c.repair.error.slice(0, 900)}${history}`, 'Fix ONLY what causes the problem (move, resize or re-time the elements involved) and answer with the whole corrected program.');
    else if (c.repair.strategy === 'fix') lines.push('', `YOUR PREVIOUS PROGRAM WAS REJECTED: ${c.repair.error.slice(0, 900)}${history}`, 'Write the program again for this scene, keeping its idea and avoiding exactly these errors.');
    else if (c.repair.strategy === 'minimal') lines.push('', `PREVIOUS ATTEMPTS FAILED: ${c.repair.error.slice(0, 600)}${history}`, 'Write the SIMPLEST program that works: texts grouped in ONE stack, a few rect and image nodes; steps on opacity, y and scale only.');
    else lines.push('', `THE PREVIOUS PROGRAM HAD A PROBLEM: ${c.repair.error.slice(0, 600)}${history}`, 'Write a NEW, simpler program for this scene from the brief above, avoiding what failed.');
  }
  return { system, user: lines.filter((l) => l !== '').join('\n') };
}

export function validationContext(c: AuthorContext): ValidationContext {
  return { texts: Object.keys(c.scene.texts), values: c.scene.texts, media: c.scene.media.map((m) => m.kind), duration: c.scene.duration, hasLogo: !!c.brand.logo };
}

/** Crée l'auteur (le service en a un par défaut ; le banc d'essai y branche son relevé). */
export function createProgramAuthor(opts: { onReport?: (report: AuthorReport) => void } = {}): SceneAuthor {
  return async (ctx: FilmCallContext, context: AuthorContext): Promise<AuthoredScene> => {
    const { system, user } = buildProgramPrompt(context);
    const vctx = validationContext(context);
    const tokens = { input: 0, output: 0 };
    let ms = 0;
    let calls = 0;
    let retries = 0;
    let lastErrors: string[] = [];
    let program: MotionProgram | undefined;
    let warnings: string[] = [];
    let raw = '';
    let failure = '';
    // Deux appels au plus : la réponse, puis — si elle est refusée — la même demande avec les erreurs exactes.
    for (let attempt = 0; attempt < 2 && !program; attempt++) {
      const prompt = attempt === 0 ? user : `${user}\n\nYOUR PREVIOUS ANSWER:\n${raw.slice(0, 6000)}\n\nIT WAS REJECTED:\n- ${lastErrors.join('\n- ')}\nAnswer again with the whole corrected program (one \`\`\`json block).`;
      if (attempt > 0) retries++;
      const run = await callFilmModel(ctx, 'video.author', system, prompt, (r) => !parseProgram(r).error);
      calls++;
      tokens.input += run.tokens.input;
      tokens.output += run.tokens.output;
      ms += run.ms;
      if (!run.raw.trim()) {
        failure = run.failure || 'empty_answer';
        lastErrors = [`aucune réponse (${failure})`];
        if (run.failure === 'no_model') break;
        continue;
      }
      raw = run.raw;
      const parsed = parseProgram(raw);
      if (parsed.error) {
        lastErrors = [parsed.error];
        continue;
      }
      const v = validateProgram(parsed.program, vctx);
      if (!v.ok) {
        lastErrors = v.errors;
        continue;
      }
      program = v.program;
      warnings = v.warnings;
    }
    const report = (r: Partial<AuthorReport>) => opts.onReport?.({ key: context.scene.key, ok: false, calls, validationRetries: retries, errors: lastErrors, warnings, programChars: 0, codeLines: 0, ...(context.repair ? { repair: context.repair.strategy } : {}), ...r });
    if (!program) {
      report({});
      const message = !raw ? failure || 'empty_answer' : `programme refusé : ${lastErrors.join(' ; ')}`.slice(0, 1200);
      return { key: context.scene.key, error: { stage: raw ? 'compile' : 'author', message }, tokens, ms, attempts: calls };
    }
    let compiled: { code: string; lines: number };
    try {
      compiled = compileProgram(program, { warnings });
    } catch (error) {
      report({ errors: [`compilateur : ${(error as Error).message}`] });
      return { key: context.scene.key, error: { stage: 'compile', message: `compilateur : ${(error as Error).message}` }, tokens, ms, attempts: calls };
    }
    const check = await compileScene(compiled.code);
    report({ ok: check.ok, programChars: JSON.stringify(program).length, codeLines: compiled.lines, ...(check.ok ? {} : { errors: [`compilateur : ${check.error}`] }) });
    return { key: context.scene.key, code: compiled.code, ...(check.ok ? {} : { error: { stage: 'compile' as const, message: `compilateur : ${check.error}` } }), tokens, ms, attempts: calls };
  };
}

/** L'auteur du moteur. */
export const authorScene: SceneAuthor = createProgramAuthor();

/** Plusieurs scènes, `concurrency` à la fois (l'ordre des résultats suit celui des fiches). */
export async function authorScenes(ctx: FilmCallContext, contexts: AuthorContext[], concurrency = 4, onDone?: (scene: AuthoredScene, done: number) => void, author: SceneAuthor = authorScene): Promise<AuthoredScene[]> {
  const out = new Array<AuthoredScene>(contexts.length);
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < contexts.length) {
      const i = next++;
      out[i] = await author(ctx, contexts[i]);
      onDone?.(out[i], ++done);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, contexts.length) }, worker));
  return out;
}
