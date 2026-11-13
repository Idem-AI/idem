/**
 * LE COÛT PAR RÉSULTAT ACCEPTÉ — la mesure qui manquait.
 *
 * `GenerationRecord` dit déjà tout d'une génération : chaque décision (code ou modèle, rôle, modèle résolu,
 * jetons, durée, issue), les réparations, les replis, les constats, et la tenue de chaque nœud du catalogue.
 * Ce qui manquait, c'est de les AGRÉGER : un modèle bon marché qui rate trois fois coûte plus cher qu'un modèle
 * plus cher qui réussit du premier coup, et seule l'agrégation le dit.
 *
 * Rien ici n'appelle un modèle : on lit des enregistrements déjà écrits.
 *
 *   résultat accepté   une génération livrée sans constat bloquant
 *   premier jet        livrée sans réparation NI constat bloquant
 *   coût               le prix réel des modèles employés (`config/ai-pricing.config`), jamais une estimation de jetons
 */
import type { GenerationRecord } from '@idem/graphic-engine';
import { computeCost } from '../../config/ai-pricing.config';

export interface GenerationMetrics {
  /** Le lot mesuré. */
  generations: number;
  accepted: number;
  firstPass: number;
  /** Part des générations livrées sans constat bloquant. */
  acceptanceRate: number;
  /** Part livrée du premier jet (ni réparation ni constat bloquant). */
  firstPassRate: number;
  agentCallsPerGeneration: number;
  codeDecisionsPerGeneration: number;
  tokens: { input: number; output: number };
  /** Coût total et coût RAPPORTÉ AU RÉSULTAT ACCEPTÉ : la seule mesure qui compare deux moteurs. */
  costUsd: number;
  costPerAcceptedUsd: number;
  /** Durées en millisecondes : la médiane et le 95e centile, jamais la moyenne (une génération ratée l'écrase). */
  msMedian: number;
  msP95: number;
  repairsPerGeneration: number;
  blockingPerGeneration: number;
}

const rate = (n: number, total: number): number => (total ? Math.round((n / total) * 1000) / 1000 : 0);
const per = (n: number, total: number): number => (total ? Math.round((n / total) * 100) / 100 : 0);

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
}

/** Le coût réel d'une génération : chaque décision d'un modèle, au prix de CE modèle. */
export function costOf(record: GenerationRecord): number {
  let usd = 0;
  for (const d of record.decisions) {
    if (d.source !== 'llm' || !d.model) continue;
    usd += computeCost({ modelName: d.model, inputTokens: d.tokens.input, outputTokens: d.tokens.output }).totalCostUsd;
  }
  return Math.round(usd * 1e6) / 1e6;
}

const isAccepted = (r: GenerationRecord): boolean => r.issues.blocking.length === 0;
const isFirstPass = (r: GenerationRecord): boolean => isAccepted(r) && r.repairs.length === 0;

/** Les mesures d'un lot d'enregistrements. Un lot vide rend des zéros, jamais une division par zéro. */
export function metricsOf(records: GenerationRecord[]): GenerationMetrics {
  const n = records.length;
  const accepted = records.filter(isAccepted).length;
  const firstPass = records.filter(isFirstPass).length;
  const llm = records.reduce((s, r) => s + r.decisions.filter((d) => d.source === 'llm').length, 0);
  const code = records.reduce((s, r) => s + r.decisions.filter((d) => d.source === 'code').length, 0);
  const input = records.reduce((s, r) => s + r.tokens.input, 0);
  const output = records.reduce((s, r) => s + r.tokens.output, 0);
  const costUsd = Math.round(records.reduce((s, r) => s + costOf(r), 0) * 1e6) / 1e6;
  const durations = records.map((r) => r.ms);
  return {
    generations: n,
    accepted,
    firstPass,
    acceptanceRate: rate(accepted, n),
    firstPassRate: rate(firstPass, n),
    agentCallsPerGeneration: per(llm, n),
    codeDecisionsPerGeneration: per(code, n),
    tokens: { input, output },
    costUsd,
    // Ce qu'on compare entre deux moteurs : ce que coûte un résultat qu'on peut livrer.
    costPerAcceptedUsd: accepted ? Math.round((costUsd / accepted) * 1e6) / 1e6 : 0,
    msMedian: percentile(durations, 0.5),
    msP95: percentile(durations, 0.95),
    repairsPerGeneration: per(records.reduce((s, r) => s + r.repairs.length, 0), n),
    blockingPerGeneration: per(records.reduce((s, r) => s + r.issues.blocking.length, 0), n),
  };
}

/** Les mesures lot par lot : par livrable, par cran, ou par ce qu'on veut comparer. */
export function metricsBy<K extends string>(records: GenerationRecord[], key: (r: GenerationRecord) => K): Record<K, GenerationMetrics> {
  const groups = new Map<K, GenerationRecord[]>();
  for (const r of records) {
    const k = key(r);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  return Object.fromEntries([...groups.entries()].map(([k, list]) => [k, metricsOf(list)])) as Record<K, GenerationMetrics>;
}

/**
 * La comparaison AVANT / APRÈS d'un changement de moteur, sur les mêmes entrées.
 * `better` ne juge que ce qui compte : moins cher par résultat accepté, ET pas moins de résultats acceptés.
 */
export interface Comparison {
  before: GenerationMetrics;
  after: GenerationMetrics;
  deltas: { costPerAcceptedUsd: number; acceptanceRate: number; firstPassRate: number; agentCallsPerGeneration: number; msMedian: number };
  better: boolean;
}

export function compare(before: GenerationRecord[], after: GenerationRecord[]): Comparison {
  const a = metricsOf(before);
  const b = metricsOf(after);
  const d = {
    costPerAcceptedUsd: Math.round((b.costPerAcceptedUsd - a.costPerAcceptedUsd) * 1e6) / 1e6,
    acceptanceRate: Math.round((b.acceptanceRate - a.acceptanceRate) * 1000) / 1000,
    firstPassRate: Math.round((b.firstPassRate - a.firstPassRate) * 1000) / 1000,
    agentCallsPerGeneration: Math.round((b.agentCallsPerGeneration - a.agentCallsPerGeneration) * 100) / 100,
    msMedian: b.msMedian - a.msMedian,
  };
  return { before: a, after: b, deltas: d, better: d.costPerAcceptedUsd <= 0 && d.acceptanceRate >= 0 };
}

/** Une ligne par lot, lisible dans un journal ou collée dans un rapport. */
export function metricsTable(byKey: Record<string, GenerationMetrics>): string {
  const rows = Object.entries(byKey).sort(([, a], [, b]) => b.generations - a.generations);
  const head = ['lot', 'gén.', 'acceptées', 'premier jet', 'appels/gén.', 'jetons in', 'jetons out', 'coût $', '$ / acceptée', 'ms médian', 'ms p95'];
  const lines = rows.map(([k, m]) =>
    [k, m.generations, `${Math.round(m.acceptanceRate * 100)} %`, `${Math.round(m.firstPassRate * 100)} %`, m.agentCallsPerGeneration, m.tokens.input, m.tokens.output, m.costUsd, m.costPerAcceptedUsd, m.msMedian, m.msP95].join('\t')
  );
  return [head.join('\t'), ...lines].join('\n');
}
