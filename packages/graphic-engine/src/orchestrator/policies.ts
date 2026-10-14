/**
 * LA POLITIQUE D'APPEL : chaque tâche a une stratégie explicite, et le modèle n'est appelé que lorsqu'une
 * décision créative le demande, au cran qui l'admet, dans un budget.
 *
 *   Situation                       Action par défaut
 *   ─────────────────────────────── ──────────────────────────────────────────────────────────────
 *   Données déjà structurées        réutiliser (le ContentModel tel quel, aucun appel)
 *   Composant local disponible      réutiliser le composant (registre, niveau local d'abord)
 *   Règle de composition connue     exécuter le code (moteur de composition)
 *   Décision créative nécessaire    appeler le modèle — composer (High+), régler le repli (Max), réviser sur critique (Max, Ultra)
 *   Documentation inconnue          charger la documentation ciblée (registre, à la demande)
 *   Défaut technique détecté        corriger par le code (mise à l'échelle, composition suivante)
 *   Problème visuel complexe        appeler un modèle seulement si nécessaire (critique, réparation ciblée)
 *
 * Profils du runtime de l'hôte : `agents` (réponse courte — l'hôte la plafonne), `coder` (sortie longue :
 * un arbre JSON y tient sans être tronqué), `critic` (jugement).
 */
import type { CreativityLevel, DocumentType } from '../contracts/common';
import type { AgentProfile } from '../host';
import type { TaskName } from '../observability/traces';

export interface TaskPolicy {
  task: TaskName;
  minLevel: CreativityLevel;
  profile: AgentProfile;
  role: string;
  /** Plafond de jetons (entrée + sortie) d'un appel. */
  maxTokens: number;
  timeoutMs: number;
  vision?: boolean;
}

export const TASK_POLICIES: Record<'pick' | 'pickTune' | 'author' | 'authorRetry' | 'authorRevise' | 'critic' | 'repair', TaskPolicy> = {
  pick: { task: 'creative.pick', minLevel: 'high', profile: 'agents', role: 'graphic.artDirector', maxTokens: 1200, timeoutMs: 25_000 },
  pickTune: { task: 'creative.tune', minLevel: 'max', profile: 'agents', role: 'graphic.artDirector', maxTokens: 1600, timeoutMs: 30_000 },
  author: { task: 'creative.author', minLevel: 'high', profile: 'coder', role: 'graphic.director', maxTokens: 7000, timeoutMs: 120_000 },
  /** Seconde chance de l'auteur (réponse inutilisable, arbre bloquant) : au cran de l'auteur. */
  authorRetry: { task: 'creative.revise', minLevel: 'high', profile: 'coder', role: 'graphic.director', maxTokens: 9000, timeoutMs: 120_000 },
  authorRevise: { task: 'creative.revise', minLevel: 'max', profile: 'coder', role: 'graphic.director', maxTokens: 9000, timeoutMs: 120_000 },
  critic: { task: 'creative.critic', minLevel: 'high', profile: 'critic', role: 'visual.critic', maxTokens: 1400, timeoutMs: 40_000, vision: true },
  repair: { task: 'repair.targeted', minLevel: 'high', profile: 'agents', role: 'generation.repair', maxTokens: 1400, timeoutMs: 25_000 },
};

const ORDER: CreativityLevel[] = ['low', 'medium', 'high', 'max', 'ultra'];
export const atLeast = (level: CreativityLevel, min: CreativityLevel): boolean => ORDER.indexOf(level) >= ORDER.indexOf(min);

/**
 * Le BUDGET d'une génération (jetons), par livrable et par cran : le plan graphique, les réparations, et un
 * plafond global. Atteint, il ne fait rien d'aveugle : la décision revient au code (et la trace le dit).
 */
export function budgetFor(documentType: DocumentType, level: CreativityLevel, sections = 1): number {
  // L'auteur compose dès High (≈ 6 000 jetons par page) ; Max et Ultra paient leurs révisions sur critique.
  const perSection: Record<CreativityLevel, number> = { low: 0, medium: 0, high: 10000, max: 18000, ultra: 28000 };
  const weight = documentType === 'business-plan' || documentType === 'report' ? 0.8 : 1;
  return Math.round(perSection[level] * Math.max(1, sections) * weight);
}

export class TokenBudget {
  private used = 0;

  constructor(readonly limit: number) {}

  get remaining(): number {
    return Math.max(0, this.limit - this.used);
  }

  get exhausted(): boolean {
    return this.used >= this.limit;
  }

  /** Une tâche de ce coût passerait-elle encore ? */
  allows(cost: number): boolean {
    return this.used + cost <= this.limit;
  }

  consume(tokens: number): void {
    this.used += Math.max(0, tokens);
  }

  get spent(): number {
    return this.used;
  }
}
