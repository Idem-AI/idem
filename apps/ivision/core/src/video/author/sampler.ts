/**
 * L'ÉCHANTILLONNAGE ET LE JUGE — chaque scène est écrite plusieurs fois, chaque variante est jugée, la meilleure
 * est gardée (un petit modèle rattrape un grand quand on multiplie les essais et qu'un vérificateur choisit :
 * « Large Language Monkeys », Snell et al.).
 *
 *   budget       selon la difficulté de la scène (3 simple, 6 moyenne, 10 données / interface / texte long), plafonné par
 *                le cran (Low 6, Medium 8, High et Ultra 10 — `VIDEO_SAMPLES_<CRAN>`) ; on s'arrête dès qu'une
 *                variante dépasse le seuil (`GOOD_ENOUGH`) ;
 *   variété      la température (0,4 → 1,0), la scène de référence retrouvée, et à partir de Medium la réécriture par
 *                l'auteur de QUALITÉ (rôle `video.author`) depuis le rapport mesuré de la meilleure ;
 *   variantes    chaque intention → 4 à 12 compositions (choix discrets) résolues par le code et pré-jugées sans rendu ;
 *   contrôle     les meilleures passent le contrôle réel (Motion Canvas, chaque format) : élimination, encombrement,
 *                couleurs, contraste mesurés sur l'image ;
 *   départage    en Ultra, deux finalistes à moins de 0,03 l'un de l'autre sont départagés sur image (questions fermées,
 *                ordre inversé) — jamais seul juge.
 */
import type { CreativityLevel } from '../../creativity/levels';
import type { FilmCallContext } from '../agents';
import { authorIntent, AuthoredIntent, IntentAuthorInput } from './intent.author';
import {
  compileProgram,
  contrastMetric,
  GOOD_ENOUGH,
  judgeWeights,
  linearScore,
  lowerIntent,
  prejudge,
  reportText,
  retrieveReferences,
  validateProgram,
  variantChoices,
} from '../../../../../../packages/motion-compiler/src';
import type { Judgment, LowerInput, MotionProgram, ResolvedIcon, SceneDesign, SceneIntent, VariantChoice } from '../../../../../../packages/motion-compiler/src';

export interface Candidate {
  id: string;
  intent: SceneIntent;
  choice: VariantChoice;
  program: MotionProgram;
  code: string;
  pre: Judgment;
  final?: { score: number; eliminated: boolean; reasons: string[]; features: Record<string, number> };
  thumbnail?: Buffer;
}

export interface ProbeVerdict {
  errors: string[];
  layout: string[];
  minContrast?: number;
  pixels?: Record<string, number>;
  thumbnail?: Buffer;
}

export type Difficulty = 'simple' | 'medium' | 'hard';

export interface SampleSceneInput {
  call: FilmCallContext;
  level: CreativityLevel;
  author: IntentAuthorInput;
  lower: Omit<LowerInput, 'intent' | 'choice'>;
  hasLogo: boolean;
  icons?: (name: string) => ResolvedIcon | null;
  designLead: SceneDesign;
  seamOut: number;
  /** Le contrôle réel d'un lot de variantes (tous les formats) : rend un verdict par identifiant. */
  probe: (candidates: Candidate[]) => Promise<Map<string, ProbeVerdict>>;
  /** Le départage visuel optionnel (Ultra) : « a », « b » ou null (pas d'avis net). */
  tieBreak?: (a: Candidate, b: Candidate) => Promise<'a' | 'b' | null>;
  /** Qui écrit (les contrôles le simulent). */
  writer?: (ctx: FilmCallContext, input: IntentAuthorInput, opts: { role?: 'video.sampler' | 'video.author'; temperature?: number; seed?: number }) => Promise<AuthoredIntent>;
  onProgress?: (e: { authored: number; budget: number; best?: number }) => void;
}

export interface SampleResult {
  best?: Candidate;
  runnerUp?: Candidate;
  authored: number;
  candidates: number;
  probed: number;
  tokens: { input: number; output: number };
  stoppedEarly: boolean;
  failures: string[];
  tieBreak?: boolean;
}

const BY_DIFFICULTY: Record<Difficulty, number> = { simple: 3, medium: 6, hard: 10 };
const BY_LEVEL: Record<CreativityLevel, number> = { low: 6, medium: 8, high: 10, ultra: 10 };

/** La difficulté d'une scène : données, interface, texte long ou nombreux éléments = difficile. */
export function difficultyOf(card: IntentAuthorInput['scene']): Difficulty {
  const chars = Object.values(card.texts).join(' ').length;
  const n = Object.keys(card.texts).length;
  if (card.role === 'data' || card.media.some((m) => m.screen) || chars > 90 || n >= 4 || card.media.length >= 3) return 'hard';
  if (card.media.length || n >= 2) return 'medium';
  return 'simple';
}

/** Le nombre d'essais d'une scène à un cran. */
export function samplesFor(level: CreativityLevel, difficulty: Difficulty): number {
  const env = Number(process.env[`VIDEO_SAMPLES_${level.toUpperCase()}`]);
  const cap = Number.isFinite(env) && env > 0 ? Math.min(20, env) : BY_LEVEL[level];
  return Math.max(1, Math.min(cap, BY_DIFFICULTY[difficulty]));
}

/** La température de l'essai k sur n (0,4 → 1,0). */
export const temperatureOf = (k: number, n: number) => Math.round((0.4 + (0.6 * k) / Math.max(1, n - 1)) * 100) / 100;

export async function sampleScene(input: SampleSceneInput): Promise<SampleResult> {
  const write = input.writer || ((ctx, a, o) => authorIntent(ctx, a, o));
  const weights = judgeWeights();
  const difficulty = difficultyOf(input.author.scene);
  const budget = samplesFor(input.level, difficulty);
  const refs = retrieveReferences({ text: `${input.author.scene.role || ''} ${input.author.scene.purpose} ${input.author.scene.visual}`, role: input.author.scene.role, texts: Object.keys(input.author.scene.texts).length, media: input.author.scene.media.map((m) => m.kind) }, 3);
  const pool: Candidate[] = [];
  const tokens = { input: 0, output: 0 };
  const failures: string[] = [];
  let authored = 0;
  let probed = 0;
  let serial = 0;

  /** Une intention → ses variantes compilées et pré-jugées (les deux meilleures sont gardées). */
  const expand = (intent: SceneIntent): Candidate[] => {
    const out: Candidate[] = [];
    for (const choice of variantChoices(intent)) {
      try {
        const lowered = lowerIntent({ ...input.lower, intent, choice });
        const v = validateProgram(lowered.program, { texts: Object.keys(input.lower.texts), values: input.lower.texts, media: input.lower.media.map((m) => m.kind), duration: input.lower.duration, hasLogo: input.hasLogo, ...(input.icons ? { icons: input.icons } : {}) });
        if (!v.ok) continue;
        const code = compileProgram(v.program!, { warnings: v.warnings }).code;
        const pre = prejudge(intent, lowered, { duration: input.lower.duration, design: input.designLead, ...(input.lower.beats ? { beats: input.lower.beats } : {}), seamOut: input.seamOut });
        out.push({ id: `${input.author.scene.key}__c${++serial}`, intent, choice, program: v.program!, code, pre });
      } catch (error) {
        failures.push(`variante : ${(error as Error).message}`.slice(0, 160));
      }
    }
    return out.sort((a, b) => b.pre.score - a.pre.score).slice(0, 2);
  };

  /** Le contrôle réel des meilleures variantes pas encore contrôlées. */
  const probeTop = async (k: number) => {
    const todo = pool.filter((c) => !c.final && !c.pre.eliminated).sort((a, b) => b.pre.score - a.pre.score).slice(0, k);
    if (!todo.length) return;
    const verdicts = await input.probe(todo).catch((error) => {
      failures.push(`contrôle : ${(error as Error).message}`.slice(0, 160));
      return new Map<string, ProbeVerdict>();
    });
    probed += todo.length;
    for (const c of todo) {
      const v = verdicts.get(c.id);
      if (!v) continue;
      const features = { ...c.pre.features, ...(v.pixels || {}), contrast: contrastMetric(v.minContrast) };
      const reasons = [...v.errors, ...v.layout];
      c.final = { score: reasons.length ? 0 : Math.round(Math.max(0, Math.min(1, linearScore(features, weights))) * 1000) / 1000, eliminated: reasons.length > 0, reasons, features };
      if (v.thumbnail) c.thumbnail = v.thumbnail;
    }
  };
  const best = () => pool.filter((c) => c.final && !c.final.eliminated).sort((a, b) => b.final!.score - a.final!.score)[0];

  const attempt = async (k: number, opts: { role?: 'video.sampler' | 'video.author'; repair?: { intent?: SceneIntent; report: string } } = {}) => {
    const reference = refs.length ? refs[k % refs.length] : undefined;
    const a = await write(input.call, { ...input.author, ...(reference ? { reference } : {}), ...(opts.repair ? { repair: opts.repair } : {}) }, { role: opts.role || 'video.sampler', temperature: opts.repair ? 0.5 : temperatureOf(k, budget), seed: (input.author.scene.index + 1) * 1000 + k });
    authored++;
    tokens.input += a.tokens.input;
    tokens.output += a.tokens.output;
    if (!a.intent) {
      failures.push(`essai ${k + 1} : ${a.error || 'aucune intention'}`);
      return;
    }
    pool.push(...expand(a.intent));
  };

  let stoppedEarly = false;
  for (let k = 0; k < budget; ) {
    const wave = Math.min(3, budget - k);
    await Promise.all(Array.from({ length: wave }, (_, i) => attempt(k + i)));
    k += wave;
    await probeTop(3);
    input.onProgress?.({ authored, budget, best: best()?.final?.score });
    if ((best()?.final?.score ?? 0) >= GOOD_ENOUGH) {
      stoppedEarly = k < budget;
      break;
    }
  }

  // Sous le seuil (Medium et plus) : l'auteur de qualité réécrit la meilleure depuis le rapport MESURÉ.
  const rewrites = input.level === 'low' ? 0 : input.level === 'medium' ? 1 : 2;
  for (let r = 0; r < rewrites && (best()?.final?.score ?? 0) < GOOD_ENOUGH; r++) {
    const top = best() || pool.sort((a, b) => b.pre.score - a.pre.score)[0];
    const report = top ? reportText({ ...top.pre, reasons: top.final?.reasons || top.pre.reasons }) : 'no usable intention yet';
    await attempt(budget + r, { role: 'video.author', repair: { ...(top ? { intent: top.intent } : {}), report: report || 'raise the overall quality: hierarchy, variety of entrances, breathing room' } });
    await probeTop(2);
  }

  const ranked = pool.filter((c) => c.final && !c.final.eliminated).sort((a, b) => b.final!.score - a.final!.score);
  let chosen = ranked[0];
  let tieBreak = false;
  if (input.tieBreak && ranked.length > 1 && Math.abs(ranked[0].final!.score - ranked[1].final!.score) < 0.03) {
    const verdict = await input.tieBreak(ranked[0], ranked[1]).catch(() => null);
    if (verdict === 'b') chosen = ranked[1];
    tieBreak = verdict !== null;
  }
  // Rien n'a passé le contrôle réel : la meilleure du pré-jugement (la correction bornée du moteur la reprendra).
  if (!chosen) chosen = pool.sort((a, b) => b.pre.score - a.pre.score)[0];
  const runnerUp = ranked.find((c) => c !== chosen && c.intent !== chosen?.intent) || ranked.find((c) => c !== chosen);
  return { ...(chosen ? { best: chosen } : {}), ...(runnerUp ? { runnerUp } : {}), authored, candidates: pool.length, probed, tokens, stoppedEarly, failures, ...(tieBreak ? { tieBreak } : {}) };
}
