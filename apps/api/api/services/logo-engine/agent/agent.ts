/**
 * L'AGENT CRÉATIF — la méthode change avec le cran de la jauge, la qualité reste dans le code.
 *
 *   low     le planificateur seul (aucun token) : exploration + propositions les plus distinctes
 *   medium  + le sélecteur : l'IA choisit parmi 9 candidats déjà construits et mesurés
 *   high    + le directeur : trois directions (catégorie, générateur, idée) ; le code les construit
 *   ultra   + l'auteur : l'IA écrit le Logo IR de chaque direction (2 brouillons, +1 si aucun ne passe),
 *             le jury départage (sauf brouillon dominant), le critique REGARDE le rendu et répond par
 *             un patch ciblé (jamais un nouveau dessin), dessin libre autorisé ; avec un modèle
 *             vectoriel (OmniSVG, servi par idem-ml), chaque direction reçoit aussi des symboles
 *             DESSINÉS par ce modèle, convertis en Logo IR et départagés avec les brouillons de l'auteur
 *
 * Originalité (`planner/originality.ts`) : le directeur nomme les clichés du métier, le code les
 * bannit à tous les étages. Vitesse : toutes les directions sont dessinées EN PARALLÈLE, les
 * critiques aussi — la chaîne d'appels successifs passe de ~13 latences de modèle à ~5.
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
import { rankScore } from '../validate/perception';
import type { LogoFingerprint } from '../validate/fingerprint';
import { renderPng } from '../raster/rasterizer';
import { briefWeights, inkPalette, traitsOf } from '../planner/brief';
import type { CharterPalette, LogoKind } from '../planner/brief';
import { buildPool, docForDirection, hashSeed, searchDirection, selectDistinct } from '../planner/planner';
import type { PlanInput, PlannedLogo } from '../planner/planner';
import type { BuildOptions } from '../render/build';
import { assembleAuthored, authorTask, CRITIC_INSTRUCTION, critiqueScore, directionMenu, directionsTask, juryTask, parseCritique, selectorTask } from './tasks';
import type { AuthoredLogo, Direction, DirectionsVerdict } from './tasks';
import { generatorsOf, literalGenerators, originalityOf } from '../planner/originality';
import { getGenerator } from '../render/generators';
import { defaultKernel } from '../kernel/paper.kernel';
import type { VectorModel } from '../vector/client';
import { importVectorSymbol } from '../vector/import';
import { symbolPrompt, VECTOR_CANDIDATES, VECTOR_TYPES, vectorDoc } from '../vector/drafts';

/** Largeur du tirage du planificateur par cran. */
export const EXPLORATION: Record<CreativityLevel, number> = { low: 0.15, medium: 0.35, high: 0.5, ultra: 0.8 };

/** Brouillons écrits par l'IA par direction, au plus (somme des vagues). */
export const DRAFTS: Record<CreativityLevel, number> = { low: 0, medium: 0, high: 0, ultra: 3 };

/**
 * Les vagues de brouillons : la 1re part toujours, la 2de seulement si aucun brouillon de la 1re ne
 * passe les mesures (qualité + bonnes pratiques + pas de cliché). Un bon premier jet n'en paie pas
 * un troisième : −1/3 de jetons d'auteur dans le cas courant, la même qualité retenue.
 */
export const DRAFT_WAVES: Record<CreativityLevel, number[]> = { low: [], medium: [], high: [], ultra: [2, 1] };

/** Écart de note mesurée au-delà duquel le jury n'est pas consulté : le meilleur brouillon domine. */
export const JURY_DOMINANCE = 12;

/** Appels d'auteur simultanés (toutes directions confondues). */
export const AUTHOR_CONCURRENCY = 6;

export interface AgentDeps {
  /** L'appel de modèle de l'hôte (runtime d'agents d'IDEM). Absent : le planificateur décide de tout. */
  call?: AgentCall;
  /** Le modèle de vision (Ultra) : une image PNG + une consigne → du texte. */
  vision?: (png: Buffer, instruction: string) => Promise<string>;
  budget?: RunBudgetLike;
  /** Le modèle vectoriel (OmniSVG via idem-ml), Ultra seulement. Absent ou en panne : rien ne change. */
  vector?: VectorModel;
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
  /** Les clichés écartés pour cette marque (générateurs bannis, images interdites aux auteurs). */
  originality?: { cliches: string[]; avoid: string[] };
}

const toPlanned = (logo: ProducedLogo, type: ConceptType, recipe: string): PlannedLogo => ({ ...logo, type, recipe, novelty: 1 });

/** Une direction de repli, à partir d'un candidat du planificateur (génère le même logo). */
const directionOf = (c: PlannedLogo): Direction => {
  const first = c.doc.layers.find((l) => l.kind === 'generator');
  const motif = /^abstract:group-([a-z]+)-/.exec(c.recipe)?.[1];
  return { type: c.type, generator: first && first.kind === 'generator' ? first.generator : undefined, ...(motif ? { variant: `sym-${motif}` } : {}), idea: c.doc.concept.rationale };
};

const usesCliche = (doc: { layers: unknown }, banned: Set<string>) => banned.size > 0 && generatorsOf(doc.layers).some((g) => banned.has(g));

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
  const crowd: LogoFingerprint[] = input.crowd ?? [];
  // Les clichés : ceux que l'hôte connaît déjà, sinon l'estimation par le secteur ; le directeur complète.
  let banned = new Set<string>(input.cliches ?? literalGenerators(input.brief));
  let avoidWords: string[] = [];

  // ── 1. Le planificateur : toujours, sans token ──
  stage('pool');
  const { pool } = await buildPool(planInput, build, level === 'low' || level === 'medium' ? 18 : 12);
  let chosen = selectDistinct(pool, count, avoid, crowd);
  decide('planner', 'graph', `${pool.length} candidats construits et mesurés`);

  // ── 2. Medium : le sélecteur choisit parmi 9 candidats ──
  if (level === 'medium' && pool.length > count) {
    stage('selector');
    const shortlist = selectDistinct(pool, Math.min(9, pool.length), avoid, crowd);
    const fallbackPicks = chosen.map((c) => Math.max(0, shortlist.indexOf(c)));
    const verdict = await orchestrator.run(selectorTask(input.sheet, shortlist, count, () => fallbackPicks));
    if (verdict.source === 'llm') {
      chosen = verdict.value.map((i) => shortlist[i]);
      decide('selector', 'llm', chosen.map((c) => c.recipe).join(' · '));
    } else decide('selector', 'graph');
  }

  // ── 3. High+ : le directeur (clichés + directions), puis toutes les directions EN PARALLÈLE ──
  if (atLeast(level, 'high')) {
    stage('directions');
    const originality = originalityOf(input.brief, { cliches: banned, usage: input.usage });
    const menu = directionMenu(kind, weights, originality);
    const fallbackVerdict = (): DirectionsVerdict => ({ directions: chosen.map(directionOf), cliches: { ids: [...banned], words: [] } });
    const useVector = level === 'ultra' && !!deps.vector && kind !== 'name' && kind !== 'initial';
    const verdict = await orchestrator.run(directionsTask(input.sheet, menu, count, input.wish, fallbackVerdict, banned, { drawing: useVector }));
    const { directions: given, cliches } = verdict.value ?? fallbackVerdict();
    // Un directeur qui n'a donné que 1 ou 2 directions valides : le planificateur complète, sans doublon.
    const directions = [...given];
    for (const d of chosen.map(directionOf)) {
      if (directions.length >= count) break;
      if (!directions.some((x) => x.type === d.type && (x.generator ?? x.variant) === (d.generator ?? d.variant))) directions.push(d);
    }
    banned = new Set([...banned, ...cliches.ids]);
    avoidWords = [...new Set([...cliches.words, ...[...banned].map((id) => getGenerator(id)?.label ?? id)])].slice(0, 10);
    decide('directions', verdict.source, directions.map((d) => `${d.type}${d.generator ? `/${d.generator}` : d.variant ? `/${d.variant}` : ''}${d.source ? ` ←${d.source}` : ''}`).join(' · '));
    decide('cliches', verdict.source === 'llm' && cliches.words.length + cliches.ids.length ? 'llm' : 'graph', `écartés : ${avoidWords.join(', ') || 'aucun'}`);

    stage('drafting');
    const directedInput: PlanInput = { ...planInput, cliches: [...banned] };
    const waves = DRAFT_WAVES[level];
    const allowFreePaths = level === 'ultra';

    // Le modèle vectoriel dessine TOUTES les directions en une demande, en parallèle des auteurs.
    const vectorWanted = useVector ? directions.map((d, i) => ({ d, i })).filter(({ d }) => VECTOR_TYPES.includes(d.type)) : [];
    const vectorStarted = Date.now();
    const vectorBatch = vectorWanted.length
      ? deps.vector!
          .textToSvg(
            vectorWanted.map(({ d, i }) => ({ id: `d${i}`, text: symbolPrompt({ type: d.type, idea: d.idea, drawing: d.drawing, palette }) })),
            { candidates: VECTOR_CANDIDATES, seed: hashSeed(`${input.seed}#vector`) }
          )
          .catch(() => new Map<string, { svg: string; paths: number }[]>())
      : null;
    const vectorDrafts = new Map<number, Promise<PlannedLogo[]>>();
    const vectorDraftsFor = (direction: Direction, i: number, base: Record<string, unknown> | null): Promise<PlannedLogo[]> => {
      if (!vectorBatch || !VECTOR_TYPES.includes(direction.type)) return Promise.resolve([]);
      if (!vectorDrafts.has(i)) {
        vectorDrafts.set(
          i,
          (async () => {
            const candidates = (await vectorBatch).get(`d${i}`) ?? [];
            const made: PlannedLogo[] = [];
            const refused: string[] = [];
            for (const [k, candidate] of candidates.entries()) {
              const imported = importVectorSymbol(candidate.svg, palette, defaultKernel(), { idPrefix: 'v' });
              if (!imported.ok) {
                refused.push(imported.reason);
                continue;
              }
              const doc = vectorDoc(base, imported, { brief: input.brief as unknown as Record<string, unknown>, palette, type: direction.type, idea: direction.idea, withName: input.withName ?? kind !== 'initial', seed: hashSeed(`${input.seed}#vector#${i}#${k}`), brandName: input.brief.brandName });
              const produced = await produceLogo(doc, { ...build, allowFreePaths: true }, { skipVariants: true });
              if (produced.ok && produced.logo) made.push(toPlanned(produced.logo, direction.type, `omnisvg:${direction.type}`));
              else refused.push('quality');
            }
            if (candidates.length) decide('vector', 'llm', `direction ${i + 1} : OmniSVG ${made.length}/${candidates.length} symbole(s) retenu(s) en ${Date.now() - vectorStarted} ms${refused.length ? ` (écartés : ${refused.join(', ')})` : ''}`);
            else decide('vector', 'graph', `direction ${i + 1} : OmniSVG n'a rien rendu (absent, occupé ou hors délai)`);
            return made;
          })().catch(() => [])
        );
      }
      return vectorDrafts.get(i)!;
    };

    const draftDirection = async (direction: Direction, i: number): Promise<PlannedLogo | null> => {
      const drafts: PlannedLogo[] = [];
      // La meilleure forme que le code trouve pour cette direction (plusieurs constructions mesurées et affinées) : toujours là, c'est le repli.
      const searched = await searchDirection(directedInput, direction, String(i), build);
      const planned = searched ? { doc: searched.doc as unknown as Record<string, unknown>, recipe: searched.recipe } : docForDirection(directedInput, direction, String(i));
      if (searched) drafts.push(searched);
      // Les symboles du modèle vectoriel pour cette direction (lancés plus haut, attendus au besoin).
      const vectorTask = vectorDraftsFor(direction, i, (planned?.doc as Record<string, unknown> | undefined) ?? null);
      let vectorTaken = false;
      const takeVector = async () => {
        if (vectorTaken) return 0;
        vectorTaken = true;
        const list = await vectorTask;
        drafts.push(...list);
        return list.filter((l) => l.report.accepted).length;
      };
      // Ultra : l'IA écrit le Logo IR, par vagues (la 2de seulement si la 1re n'a rien donné de bon).
      if (waves.length && deps.call) {
        const ctx = { sheet: input.sheet, brief: input.brief, direction, withName: input.withName ?? kind !== 'initial', allowFreePaths, avoid: avoidWords };
        let written = 0;
        let llmDrafts = 0;
        let refusedCliche = 0;
        for (const size of waves) {
          const tasks = Array.from({ length: size }, (_, k) => {
            const d = written + k;
            return authorTask(
              ctx,
              palette,
              hashSeed(`${input.seed}#author#${i}#${d}`),
              `logoAuthor:${i + 1}.${d + 1}`,
              (assembled) => parseLogoDocument(assembled.doc).ok,
              () => null
            );
          });
          written += size;
          const authored = await orchestrator.all<AuthoredLogo | null>(tasks, AUTHOR_CONCURRENCY);
          let good = 0;
          for (const result of authored) {
            if (!result.value) continue;
            if (usesCliche(result.value.doc as { layers: unknown }, banned)) {
              refusedCliche++;
              continue;
            }
            const made = await produceLogo(result.value.doc, { ...build, allowFreePaths }, { skipVariants: true });
            if (made.ok && made.logo) {
              drafts.push(toPlanned(made.logo, direction.type, `author:${direction.generator ?? direction.variant ?? direction.type}`));
              llmDrafts++;
              if (made.logo.report.accepted) good++;
            }
          }
          if (good) break;
          // Avant une 2de vague d'auteur : si le modèle vectoriel a déjà un bon symbole, pas de jetons de plus.
          if (vectorBatch && (await takeVector())) break;
        }
        if (llmDrafts) decide('author', 'llm', `direction ${i + 1} : ${llmDrafts} brouillon(s) écrit(s) par l'IA sur ${written}${refusedCliche ? `, ${refusedCliche} cliché(s) refusé(s)` : ''}`);
        else decide('author', 'graph', `direction ${i + 1} : brouillon du planificateur${refusedCliche ? ` (${refusedCliche} cliché(s) refusé(s))` : ''}`);
      }
      await takeVector();
      if (!drafts.length) return null;
      // Les brouillons qui passent les mesures d'abord ; le jury départage, le code garde la main.
      const sound = drafts.filter((d) => d.report.accepted);
      const field = (sound.length ? sound : drafts).sort((a, b) => rankScore(b.report) - rankScore(a.report));
      if (field.length === 1) return field[0];
      if (rankScore(field[0].report) - rankScore(field[1].report) >= JURY_DOMINANCE) {
        decide('jury', 'graph', `direction ${i + 1} : ${field[0].recipe} domine (${rankScore(field[0].report)} contre ${rankScore(field[1].report)})`);
        return field[0];
      }
      stage('jury');
      const vote = await orchestrator.run(juryTask(input.sheet, field, i));
      decide('jury', vote.source, `direction ${i + 1} : ${field[vote.value]?.recipe}`);
      return field[vote.value] ?? field[0];
    };

    const results = (await Promise.all(directions.map((d, i) => draftDirection(d, i)))).filter((r): r is PlannedLogo => !!r);
    if (results.length) {
      // Une direction qui n'a rien donné est remplacée par le meilleur candidat restant du planificateur (hors clichés).
      const rest = selectDistinct(
        pool.filter((p) => !usesCliche(p.doc, banned) && !results.some((r) => nearest(p.fingerprint!, [r.fingerprint!]) < LOGO_SIMILARITY.tooClose)),
        count - results.length,
        [...avoid, ...results.map((r) => r.fingerprint!)],
        crowd
      );
      chosen = [...results, ...rest].slice(0, count);
    }
  }

  // ── 4. Ultra : le critique regarde chaque rendu (en parallèle) et répond par un patch ──
  if (level === 'ultra' && deps.vision) {
    stage('critique');
    const clicheLine = avoidWords.length ? `\nCLICHÉS OF THIS BUSINESS: ${avoidWords.join(', ')} — if the symbol reads as one of them, distinctiveness=1.` : '';
    const critiqueOne = async (start: PlannedLogo): Promise<PlannedLogo> => {
      let current = start;
      for (let round = 0; round < 2; round++) {
        const png = await renderPng(current.rendered.svg, 560, '#ffffff').catch(() => null);
        if (!png) break;
        const small = await renderPng(current.rendered.svg, Math.round(48 * Math.min(4, current.rendered.width / current.rendered.height)), '#ffffff').catch(() => null);
        const layerSummary = JSON.stringify(current.doc.layers.map((l) => ({ id: l.id, kind: l.kind, ...(l.kind === 'generator' ? { generator: l.generator, params: l.params } : {}) }))).slice(0, 900);
        const text = `${CRITIC_INSTRUCTION}${clicheLine}\nLAYERS: ${layerSummary}\nPALETTE ROLES: ink ${current.doc.palette.ink}${current.doc.palette.accent ? `, accent ${current.doc.palette.accent}` : ''}`;
        let raw = '';
        try {
          raw = await deps.vision!(small ? await sideBySide(png, small) : png, text);
        } catch {
          break;
        }
        visionTokens = { input: visionTokens.input + Math.ceil(text.length / 4) + 900, output: visionTokens.output + Math.ceil(raw.length / 4) };
        const critique = parseCritique(raw, current.doc);
        if (!critique) break;
        decide('critic', 'llm', `${critiqueScore(critique.scores).toFixed(1)}/5 ${critique.verdict}${critique.note ? ` — ${critique.note}` : ''}`);
        // Un patch ne remplace jamais le symbole par un cliché.
        const patch = critique.patch.filter((op) => !(op.op === 'generator' && banned.has((op as { generator?: string }).generator ?? '')));
        if (critique.verdict === 'pass' || !patch.length) break;
        const patched = applyPatch(current.doc as LogoDocument, patch);
        if (!patched.ok || !patched.doc) break;
        const made = await produceLogo(patched.doc, { ...build, allowFreePaths: true }, { skipVariants: true });
        // Un patch ne doit jamais aggraver ce que les mesures constatent.
        if (!made.ok || !made.logo || made.logo.report.score < current.report.score - 2) break;
        current = { ...toPlanned(made.logo, current.type, current.recipe), novelty: current.novelty };
      }
      return current;
    };
    chosen = await Promise.all(chosen.map(critiqueOne));
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
    originality: { cliches: [...banned], avoid: avoidWords },
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
