/**
 * L'ENREGISTREMENT D'UNE GÉNÉRATION — le même pour un document (deck, business plan, charte, visuel) et pour
 * une vidéo : on doit pouvoir dire POURQUOI un résultat a été accepté, réparé ou remplacé.
 *
 *   décisions   chaque tâche : qui l'a tranchée (le code ou un modèle), le rôle, le modèle résolu quand
 *               l'hôte le connaît, les jetons, la durée, l'issue ;
 *   médias      la provenance de chaque média (`assetId ← source (fournisseur)` ou `assetId ✗`) ;
 *   réparations ce que le code ou un agent a corrigé ;
 *   replis      ce qui n'a pas pu se faire comme prévu, DIT (arbre d'auteur remplacé, stratégie déclassée…) ;
 *   constats    séparés : `blocking` (la page ou le film est faux) et `advisory` (perfectible : jugement
 *               artistique, texte trop chargé) — le jugement n'est jamais bloquant au-dessus de Medium.
 */
import type { CreativityLevel } from '../contracts/common';
import type { GenerationTrace } from './traces';

export interface GenerationDecision {
  /** La tâche (`creative.author`, `shotCoder:3`, `asset.resolve`…). */
  task: string;
  source: 'code' | 'llm';
  role?: string;
  /** Le modèle résolu pour ce rôle, quand l'hôte le connaît. */
  model?: string;
  tokens: { input: number; output: number };
  ms: number;
  outcome: string;
  /** La page, le plan ou la scène concernés. */
  scope?: string;
}

export interface GenerationRecord {
  v: 1;
  deliverable: string;
  level: CreativityLevel;
  createdAt: string;
  decisions: GenerationDecision[];
  assets: string[];
  repairs: Array<{ code: string; detail: string; by: 'code' | 'agent'; scope?: string }>;
  fallbacks: string[];
  issues: { blocking: string[]; advisory: string[] };
  tokens: { input: number; output: number };
  ms: number;
  /** Note de qualité moyenne mesurée (0-100), quand le moteur en donne. */
  quality?: number;
}

/** Les codes de réparation qui sont des REPLIS (le plan n'a pas tenu) plutôt que des retouches. */
const FALLBACK_REPAIRS = new Set(['author_fallback', 'asset_fallback', 'next_candidate']);

/**
 * L'enregistrement d'un document à partir des traces de ses pages (`GenerationTrace`), et des constats de
 * leurs rendus. `modelOf` traduit un rôle en modèle (l'hôte sait lequel il a configuré).
 */
export function recordFromTraces(o: {
  deliverable: string;
  level: CreativityLevel;
  traces: GenerationTrace[];
  issues?: Array<{ scope: string; code: string; severity: 'blocking' | 'advisory'; message?: string }>;
  fallbacks?: string[];
  modelOf?: (role: string) => string | undefined;
}): GenerationRecord {
  const decisions: GenerationDecision[] = o.traces.flatMap((t) =>
    t.tasks.map((task) => ({
      task: task.task,
      source: task.source,
      ...(task.role ? { role: task.role } : {}),
      ...(task.source === 'llm' && task.role && o.modelOf?.(task.role) ? { model: o.modelOf(task.role) } : {}),
      tokens: { input: task.inputTokens, output: task.outputTokens },
      ms: task.ms,
      outcome: task.reason ? `${task.outcome} (${task.reason})` : task.outcome,
      ...(t.sectionId ? { scope: t.sectionId } : {}),
    }))
  );
  const repairs = o.traces.flatMap((t) => t.repairs.map((r) => ({ ...r, ...(t.sectionId ? { scope: t.sectionId } : {}) })));
  const qualities = o.traces.map((t) => t.quality).filter((q): q is number => typeof q === 'number');
  const issue = (sev: 'blocking' | 'advisory') => (o.issues ?? []).filter((i) => i.severity === sev).map((i) => `${i.scope}: ${i.code}${i.message ? ` — ${i.message.slice(0, 160)}` : ''}`);
  return {
    v: 1,
    deliverable: o.deliverable,
    level: o.level,
    createdAt: new Date().toISOString(),
    decisions,
    assets: o.traces.flatMap((t) => (t.assets ?? []).map((a) => (t.sectionId ? `${t.sectionId}/${a}` : a))),
    repairs,
    fallbacks: [...repairs.filter((r) => FALLBACK_REPAIRS.has(r.code)).map((r) => `${r.scope ?? ''}: ${r.detail}`), ...(o.fallbacks ?? [])],
    issues: { blocking: issue('blocking'), advisory: issue('advisory') },
    tokens: decisions.reduce((s, d) => ({ input: s.input + d.tokens.input, output: s.output + d.tokens.output }), { input: 0, output: 0 }),
    ms: o.traces.reduce((s, t) => s + t.ms, 0),
    ...(qualities.length ? { quality: Math.round(qualities.reduce((a, b) => a + b, 0) / qualities.length) } : {}),
  };
}

/** Un résumé d'une ligne, pour les journaux (Grafana) : coût, part décidée par l'IA, replis, constats. */
export function recordSummary(r: GenerationRecord): Record<string, unknown> {
  const llm = r.decisions.filter((d) => d.source === 'llm');
  return {
    event: 'generation.record',
    deliverable: r.deliverable,
    creativity: r.level,
    agentCalls: llm.length,
    codeDecisions: r.decisions.length - llm.length,
    inputTokens: r.tokens.input,
    outputTokens: r.tokens.output,
    assets: r.assets.length,
    assetsMissing: r.assets.filter((a) => a.endsWith('✗')).length,
    repairs: r.repairs.length,
    fallbacks: r.fallbacks.length,
    blocking: r.issues.blocking.length,
    advisory: r.issues.advisory.length,
    quality: r.quality,
    ms: r.ms,
  };
}
