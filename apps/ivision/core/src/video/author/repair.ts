/**
 * L'AUTOCORRECTION DES SCÈNES — bornée, séquentielle, et qui change d'approche.
 *
 * Une scène dont le code ne compile pas ou plante à l'exécution est corrigée AVANT que la vidéo soit
 * montrée, mais jamais au prix d'une boucle : chaque scène passe par au plus trois stratégies, une à
 * la fois (jamais deux générations simultanées pour le même problème), et le film entier a un budget
 * de jetons et de temps. Ce qui n'est pas corrigé à la fin reste signalé (l'utilisateur peut encore
 * demander « Corriger »).
 *
 *   fix      le même modèle reçoit le code et l'erreur, et ne change que ce qui est nécessaire ;
 *   rewrite  autre approche : un modèle d'un cran plus puissant réécrit la scène depuis sa fiche, plus
 *            simplement, en connaissant les erreurs précédentes ;
 *   minimal  dernier recours : le modèle plus puissant écrit la version la plus simple qui marche
 *            (formes, textes, médias ; opacité, position, échelle).
 *
 * Une stratégie n'est jamais rejouée : chaque tentative change d'approche (et d'un cran de modèle à
 * partir de la deuxième). Le journal note les erreurs répétées, pour savoir quelle approche a échoué.
 */
import { CREATIVITY_LEVELS, CreativityLevel } from '../../creativity/levels';

export type RepairStrategy = 'fix' | 'rewrite' | 'minimal';
export const REPAIR_PLAN: readonly RepairStrategy[] = ['fix', 'rewrite', 'minimal'];

export interface RepairLimits {
  /** Tentatives au plus par scène (1 à 3 : les stratégies, dans l'ordre). */
  attemptsPerScene: number;
  /** Jetons (entrée + sortie estimées) au plus pour toutes les corrections d'un film. */
  tokenBudget: number;
  /** Temps au plus (ms) pour toutes les corrections d'un film. */
  maxMs: number;
  /** Scènes corrigées en même temps (une seule tentative à la fois PAR scène). */
  concurrency: number;
}

export function repairLimits(): RepairLimits {
  const num = (name: string, fallback: number, min: number, max: number) => {
    const n = Number(process.env[name]);
    return Number.isFinite(n) && process.env[name] !== '' && process.env[name] !== undefined ? Math.max(min, Math.min(max, n)) : fallback;
  };
  return {
    attemptsPerScene: num('VIDEO_REPAIR_ATTEMPTS', 3, 0, REPAIR_PLAN.length),
    // Relevés le 29/10/2026 (plan qualité) : les jetons ne sont plus la contrainte, on les dépense à vérifier.
    tokenBudget: num('VIDEO_REPAIR_TOKEN_BUDGET', 400_000, 0, 4_000_000),
    maxMs: num('VIDEO_REPAIR_MAX_MS', 600_000, 0, 3_600_000),
    concurrency: num('VIDEO_REPAIR_CONCURRENCY', 3, 1, 8),
  };
}

/** Le modèle d'une stratégie : le cran choisi pour corriger, un cran au-dessus pour changer d'approche. */
export function strategyLevel(strategy: RepairStrategy, level: CreativityLevel): CreativityLevel {
  if (strategy === 'fix') return level;
  return CREATIVITY_LEVELS[Math.min(CREATIVITY_LEVELS.length - 1, CREATIVITY_LEVELS.indexOf(level) + 1)];
}

/** Une erreur ramenée à sa forme (sans numéros de ligne, nombres ni guillemets) : deux fois la même = même problème. */
export function errorSignature(message: string): string {
  return String(message || '')
    .toLowerCase()
    .replace(/ligne \d+:\d+|line \d+:\d+/g, '')
    .replace(/["'`«»].*?["'`«»]/g, '·')
    .replace(/\d+(\.\d+)?/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}

export interface RepairAttempt {
  strategy: RepairStrategy;
  ok: boolean;
  tokens: number;
  error?: string;
}

/** Le registre des corrections d'un film : tentatives, erreurs vues, jetons, temps. */
export class RepairLedger {
  private readonly started = Date.now();
  private tokens = 0;
  readonly attempts = new Map<string, RepairAttempt[]>();
  private readonly seen = new Map<string, Set<string>>();

  constructor(readonly limits: RepairLimits = repairLimits()) {}

  get exhausted(): boolean {
    return this.tokens >= this.limits.tokenBudget || Date.now() - this.started >= this.limits.maxMs;
  }

  get tokensUsed(): number {
    return this.tokens;
  }

  /** L'erreur actuelle d'une scène est notée ; rend vrai si elle avait déjà été vue (même problème, approche inefficace). */
  noteError(key: string, message: string): boolean {
    const sig = errorSignature(message);
    const set = this.seen.get(key) || new Set<string>();
    const repeated = set.has(sig);
    set.add(sig);
    this.seen.set(key, set);
    return repeated;
  }

  /**
   * La prochaine stratégie d'une scène, ou `null` (trois approches essayées, budget ou temps épuisé).
   * Chaque tentative prend la stratégie SUIVANTE : jamais deux fois la même approche pour le même problème.
   */
  nextStrategy(key: string): RepairStrategy | null {
    if (this.exhausted) return null;
    const done = (this.attempts.get(key) || []).length;
    return done < this.limits.attemptsPerScene ? REPAIR_PLAN[done] ?? null : null;
  }

  record(key: string, attempt: RepairAttempt): void {
    this.tokens += attempt.tokens;
    this.attempts.set(key, [...(this.attempts.get(key) || []), attempt]);
  }

  /** Les erreurs déjà rencontrées par une scène (données à l'auteur qui change d'approche). */
  history(key: string): string[] {
    return (this.attempts.get(key) || []).map((a) => a.error).filter((e): e is string => !!e);
  }
}
