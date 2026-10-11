/**
 * L'AGENT CRÉATIF — la méthode change avec le cran de la jauge, la qualité reste dans le code.
 *
 *   low     le planificateur seul (aucun token) : exploration + propositions les plus distinctes
 *   medium  + le sélecteur : l'IA choisit parmi 9 candidats déjà construits et mesurés
 *   high    + le directeur : trois directions (catégorie, générateur, idée) ; le code les construit
 *   max     + l'auteur : l'IA écrit le Logo IR de chaque direction (2 brouillons), le jury départage
 *   ultra   + le critique : il REGARDE le rendu et répond par un patch ciblé (jamais un nouveau
 *             dessin), 3 brouillons, dessin libre autorisé
 *
 * À chaque étage, si le modèle est absent, muet, lent ou inventif, la décision du planificateur
 * prend sa place : l'agent ne fait jamais moins bien que le code seul. Chaque logo, quelle que
 * soit son origine, repasse par le même pipeline qualité (`pipeline.ts`) : on ne montre jamais un
 * brouillon que les mesures refusent.
 */
import { CreativeOrchestrator } from '../../creativity/orchestrator';
import type { AgentCall, AgentTrace, RunBudgetLike } from '../../creativity/orchestrator';
import { atLeast } from '../../../models/creativity.model';
import type { CreativityLevel } from '../../../models/creativity.model';
import { parseLogoDocument } from '../ir/logo.schema';
import type { ConceptType, LogoDocument } from '../ir/logo.schema';
import { applyPatch } from '../ir/patch';
import { produceLogo } from '../pipeline';
import type { ProducedLogo } from '../pipeline';
import { assessLogo } from '../validate/assess';
import { LOGO_SIMILARITY, nearest } from '../validate/fingerprint';
import type { LogoFingerprint } from '../validate/fingerprint';
import { renderPng } from '../raster/rasterizer';
import { briefWeights, inkPalette, traitsOf } from '../planner/brief';
import type { CharterPalette, LogoKind } from '../planner/brief';
import { buildPool, docForDirection, hashSeed, selectDistinct } from '../planner/planner';
import type { PlanInput, PlannedLogo } from '../planner/planner';
import type { BuildOptions } from '../render/build';
import { assembleAuthored, authorTask, CRITIC_INSTRUCTION, critiqueScore, directionMenu, directionsTask, juryTask, parseCritique, selectorTask } from './tasks';
import type { AuthoredLogo, Direction } from './tasks';

/** Largeur du tirage du planificateur par cran. */
export const EXPLORATION: Record<CreativityLevel, number> = { low: 0.15, medium: 0.35, high: 0.5, max: 0.65, ultra: 0.8 };

/** Brouillons écrits par l'IA par direction. */
export const DRAFTS: Record<CreativityLevel, number> = { low: 0, medium: 0, high: 0, max: 2, ultra: 3 };

export interface AgentDeps {
  /** L'appel de modèle de l'hôte (runtime d'agents d'IDEM). Absent : le planificateur décide de tout. */
  call?: AgentCall;
  /** Le modèle de vision (Ultra) : une image PNG + une consigne → du texte. */
  vision?: (png: Buffer, instruction: string) => Promise<string>;
  budget?: RunBudgetLike;
  /** Étapes réelles, pour la progression (SSE). */
  onStage?: (stage: AgentStage, detail?: string) => void;
}

export type AgentStage = 'pool' | 'selector' | 'directions' | 'drafting' | 'jury' | 'critique' | 'finalizing';

export interface AgentInput extends PlanInput {
  level: CreativityLevel;
  /** La fiche marque (charte + direction artistique), la même pour tous les agents. */
  sheet: string;
  /** Souhait du client, en texte libre. */
  wish?: string;
}

export interface AgentResult {
  logos: PlannedLogo[];
  /** Ce que l'IA a réellement décidé, par étape (pour le détail affiché à l'utilisateur). */
  decisions: { stage: string; source: 'llm' | 'code'; detail?: string }[];
  traces: AgentTrace[];
  /** Tokens estimés (entrée + sortie) de tous les agents, vision comprise. */
  tokens: { input: number; output: number };
  stats: { pool: number; ms: number; level: CreativityLevel };
}

const toPlanned = (logo: ProducedLogo, type: ConceptType, recipe: string): PlannedLogo => ({ ...logo, type, recipe, novelty: 1 });

/** Une direction de repli, à partir d'un candidat du planificateur (génère le même logo). */
const directionOf = (c: PlannedLogo): Direction => {
  const first = c.doc.layers.find((l) => l.kind === 'generator');
  return { type: c.type, generator: first && first.kind === 'generator' ? first.generator : undefined, idea: c.doc.concept.rationale };
};

export async function designLogos(input: AgentInput, build: BuildOptions, deps: AgentDeps = {}): Promise<AgentResult> {
  const started = Date.now();
  const level = input.level;
  const count = input.count ?? 3;
  const kind: LogoKind = (['icon', 'name', 'initial'] as const).includes(input.kind as LogoKind) ? (input.kind as LogoKind) : 'icon';
  const stage = (s: AgentStage, detail?: string) => deps.onStage?.(s, detail);
  const orchestrator = new CreativeOrchestrator({ level, call: deps.call, budget: deps.budget });
  const decisions: AgentResult['decisions'] = [];
  const decide = (name: string, source: 'llm' | 'graph', detail?: string) => decisions.push({ stage: name, source: source === 'llm' ? 'llm' : 'code', detail });
  let visionTokens = { input: 0, output: 0 };

  const planInput: PlanInput = { ...input, kind, explore: EXPLORATION[level] };
  const palette = 'ink' in input.palette ? input.palette : inkPalette(input.palette as CharterPalette);
  const weights = briefWeights(input.brief);
  const avoid: LogoFingerprint[] = input.avoid ?? [];

  // ── 1. Le planificateur : toujours, sans token ──
  stage('pool');
  const { pool } = await buildPool(planInput, build, level === 'low' || level === 'medium' ? 18 : 12);
  let chosen = selectDistinct(pool, count, avoid);
  decide('planner', 'graph', `${pool.length} candidats construits et mesurés`);

  // ── 2. Medium : le sélecteur choisit parmi 9 candidats ──
  if (level === 'medium' && pool.length > count) {
    stage('selector');
    const shortlist = selectDistinct(pool, Math.min(9, pool.length), avoid);
    const fallbackPicks = chosen.map((c) => Math.max(0, shortlist.indexOf(c)));
    const verdict = await orchestrator.run(selectorTask(input.sheet, shortlist, count, () => fallbackPicks));
    if (verdict.source === 'llm') {
      chosen = verdict.value.map((i) => shortlist[i]);
      decide('selector', 'llm', chosen.map((c) => c.recipe).join(' · '));
    } else decide('selector', 'graph');
  }

  // ── 3. High+ : le directeur, puis la construction de chaque direction ──
  if (atLeast(level, 'high')) {
    stage('directions');
    const menu = directionMenu(kind, weights);
    const fallbackDirections = () => chosen.map(directionOf);
    const verdict = await orchestrator.run(directionsTask(input.sheet, menu, count, input.wish, () => fallbackDirections()));
    const directions = verdict.value ?? fallbackDirections();
    decide('directions', verdict.source, directions.map((d) => `${d.type}${d.generator ? `/${d.generator}` : d.variant ? `/${d.variant}` : ''}`).join(' · '));

    stage('drafting');
    const results: PlannedLogo[] = [];
    const draftCount = DRAFTS[level];
    for (let i = 0; i < directions.length; i++) {
      const direction = directions[i];
      const drafts: PlannedLogo[] = [];
      // Le brouillon du planificateur pour cette direction : toujours là, c'est le repli.
      const planned = docForDirection(planInput, direction, String(i));
      if (planned) {
        const made = await produceLogo(planned.doc, build, { skipVariants: true });
        if (made.ok && made.logo) drafts.push(toPlanned(made.logo, direction.type, planned.recipe));
      }
      // Max+ : l'IA écrit le Logo IR (plusieurs brouillons en parallèle).
      if (draftCount > 0 && deps.call) {
        const ctx = { sheet: input.sheet, brief: input.brief, direction, withName: input.withName ?? kind !== 'initial', allowFreePaths: level === 'ultra' };
        const tasks = Array.from({ length: draftCount }, (_, d) =>
          authorTask(
            ctx,
            palette,
            hashSeed(`${input.seed}#author#${i}#${d}`),
            `logoAuthor:${i + 1}.${d + 1}`,
            (assembled) => parseLogoDocument(assembled.doc).ok,
            () => null
          )
        );
        const authored = await orchestrator.all<AuthoredLogo | null>(tasks);
        let llmDrafts = 0;
        for (const result of authored) {
          if (!result.value) continue;
          const made = await produceLogo(result.value.doc, { ...build, allowFreePaths: level === 'ultra' }, { skipVariants: true });
          if (made.ok && made.logo) {
            drafts.push(toPlanned(made.logo, direction.type, `author:${direction.generator ?? direction.variant ?? direction.type}`));
            llmDrafts++;
          }
        }
        if (llmDrafts) decide('author', 'llm', `direction ${i + 1} : ${llmDrafts} brouillon(s) écrit(s) par l'IA`);
        else decide('author', 'graph', `direction ${i + 1} : brouillon du planificateur`);
      }
      if (!drafts.length) continue;
      // Les brouillons qui passent les mesures d'abord ; le jury départage, le code garde la main.
      const sound = drafts.filter((d) => d.report.accepted);
      const field = sound.length ? sound : drafts;
      if (field.length > 1) {
        stage('jury');
        const vote = await orchestrator.run(juryTask(input.sheet, field, i));
        decide('jury', vote.source, `direction ${i + 1} : ${field[vote.value]?.recipe}`);
        results.push(field[vote.value] ?? field[0]);
      } else results.push(field[0]);
    }
    if (results.length) {
      // Une direction qui n'a rien donné est remplacée par le meilleur candidat restant du planificateur.
      const rest = selectDistinct(
        pool.filter((p) => !results.some((r) => nearest(p.fingerprint!, [r.fingerprint!]) < LOGO_SIMILARITY.tooClose)),
        count - results.length,
        [...avoid, ...results.map((r) => r.fingerprint!)]
      );
      chosen = [...results, ...rest].slice(0, count);
    }
  }

  // ── 4. Ultra : le critique regarde le rendu et répond par un patch ──
  if (level === 'ultra' && deps.vision) {
    stage('critique');
    for (let i = 0; i < chosen.length; i++) {
      let current = chosen[i];
      for (let round = 0; round < 2; round++) {
        const png = await renderPng(current.rendered.svg, 560, '#ffffff').catch(() => null);
        if (!png) break;
        const small = await renderPng(current.rendered.svg, Math.round(48 * Math.min(4, current.rendered.width / current.rendered.height)), '#ffffff').catch(() => null);
        const layerSummary = JSON.stringify(current.doc.layers.map((l) => ({ id: l.id, kind: l.kind, ...(l.kind === 'generator' ? { generator: l.generator, params: l.params } : {}) }))).slice(0, 900);
        const text = `${CRITIC_INSTRUCTION}\nLAYERS: ${layerSummary}\nPALETTE ROLES: ink ${current.doc.palette.ink}${current.doc.palette.accent ? `, accent ${current.doc.palette.accent}` : ''}`;
        let raw = '';
        try {
          raw = await deps.vision(small ? await sideBySide(png, small) : png, text);
        } catch {
          break;
        }
        visionTokens = { input: visionTokens.input + Math.ceil(text.length / 4) + 900, output: visionTokens.output + Math.ceil(raw.length / 4) };
        const critique = parseCritique(raw, current.doc);
        if (!critique) break;
        decide('critic', 'llm', `${critiqueScore(critique.scores).toFixed(1)}/5 ${critique.verdict}${critique.note ? ` — ${critique.note}` : ''}`);
        if (critique.verdict === 'pass' || !critique.patch.length) break;
        const patched = applyPatch(current.doc as LogoDocument, critique.patch);
        if (!patched.ok || !patched.doc) break;
        const made = await produceLogo(patched.doc, { ...build, allowFreePaths: true }, { skipVariants: true });
        // Un patch ne doit jamais aggraver ce que les mesures constatent.
        if (!made.ok || !made.logo || made.logo.report.score < current.report.score - 2) break;
        current = { ...toPlanned(made.logo, current.type, current.recipe), novelty: current.novelty };
      }
      chosen[i] = current;
    }
  }

  // ── 5. Finition : variantes validées, empreintes, nouveauté ──
  stage('finalizing');
  const finals: PlannedLogo[] = [];
  for (const logo of chosen) {
    const report = await assessLogo(logo.session, logo.rendered);
    const novelty = Math.round(nearest(logo.fingerprint!, [...avoid, ...finals.map((f) => f.fingerprint!)]) * 100) / 100;
    finals.push({ ...logo, report, novelty });
  }

  const tokens = orchestrator.tokens;
  return {
    logos: finals,
    decisions,
    traces: orchestrator.traces,
    tokens: { input: tokens.input + visionTokens.input, output: tokens.output + visionTokens.output },
    stats: { pool: pool.length, ms: Date.now() - started, level },
  };
}

/** Le rendu principal et le rendu à petite taille côte à côte : une seule image pour le modèle de vision. */
async function sideBySide(big: Buffer, small: Buffer): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  const bigMeta = await sharp(big).metadata();
  const smallMeta = await sharp(small).metadata();
  const height = bigMeta.height ?? 560;
  const smallScaled = await sharp(small).resize({ height: Math.min(smallMeta.height ?? 48, 96), kernel: 'nearest' }).toBuffer();
  const sm = await sharp(smallScaled).metadata();
  const width = (bigMeta.width ?? 560) + (sm.width ?? 96) + 32;
  return sharp({ create: { width, height, channels: 3, background: '#ffffff' } })
    .composite([
      { input: big, left: 0, top: 0 },
      { input: smallScaled, left: (bigMeta.width ?? 560) + 16, top: Math.round((height - (sm.height ?? 48)) / 2) },
    ])
    .png()
    .toBuffer();
}

export { assembleAuthored, inkPalette, traitsOf };
