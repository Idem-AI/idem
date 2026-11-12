/**
 * L'ENREGISTREMENT D'UNE GÉNÉRATION — le même pour un document (deck, business plan, charte, visuel) et pour
 * une vidéo : on doit pouvoir dire POURQUOI un résultat a été accepté, réparé ou remplacé.
 *
 *   décisions   chaque tâche : qui l'a tranchée (le code ou un modèle), le rôle, le modèle résolu quand
 *               l'hôte le connaît, les jetons, la durée, l'issue ;
 *   médias      la provenance de chaque média (`assetId ← source (fournisseur)` ou `assetId ✗`) ;
 *   réparations ce que le code ou un agent a corrigé ;
 *   replis      ce qui n'a pas pu se faire comme prévu, DIT (média introuvable, page gardée réécrite…) ;
 *   constats    séparés : `blocking` (la page ou le film ne s'affiche pas) et `advisory` (CSS natif retiré,
 *               contenu non placé) — aucun jugement esthétique.
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
  /**
   * LA TENUE DE CHAQUE NŒUD DU CATALOGUE sur cette génération : combien de pages il a servies, combien ont demandé
   * une réparation, combien ont porté un constat bloquant. C'est la matière du classement par l'usage réel —
   * le moteur ne décide rien ici, il MESURE ; l'hôte agrège et en tire les poids.
   */
  templates: Array<{ id: string; uses: number; repairs: number; blocking: number }>;
  tokens: { input: number; output: number };
  ms: number;
}

/** Les codes de réparation qui sont des REPLIS (le plan n'a pas tenu) plutôt que des retouches. */
const FALLBACK_REPAIRS = new Set(['asset_fallback', 'replay_failed']);

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
    templates: templatePerformance(o.traces, o.issues ?? []),
    tokens: decisions.reduce((s, d) => ({ input: s.input + d.tokens.input, output: s.output + d.tokens.output }), { input: 0, output: 0 }),
    ms: o.traces.reduce((s, t) => s + t.ms, 0),
  };
}

/**
 * La tenue des nœuds employés : une page réparée ou bloquée compte pour TOUS les nœuds qui l'ont composée — le code
 * ne sait pas lequel a fauté, et c'est l'accumulation sur beaucoup de générations qui désigne le coupable.
 */
export function templatePerformance(
  traces: GenerationTrace[],
  issues: Array<{ scope: string; code: string; severity: 'blocking' | 'advisory'; message?: string }>
): GenerationRecord['templates'] {
  const blockingScopes = new Set(issues.filter((i) => i.severity === 'blocking').map((i) => i.scope));
  const by = new Map<string, { uses: number; repairs: number; blocking: number }>();
  for (const t of traces) {
    const repaired = t.repairs.length > 0 ? 1 : 0;
    const blocked = t.sectionId && blockingScopes.has(t.sectionId) ? 1 : 0;
    for (const id of new Set(t.nodes ?? [])) {
      const e = by.get(id) ?? { uses: 0, repairs: 0, blocking: 0 };
      e.uses += 1;
      e.repairs += repaired;
      e.blocking += blocked;
      by.set(id, e);
    }
  }
  return [...by.entries()].map(([id, e]) => ({ id, ...e })).sort((a, b) => b.uses - a.uses);
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
    ms: r.ms,
  };
}
