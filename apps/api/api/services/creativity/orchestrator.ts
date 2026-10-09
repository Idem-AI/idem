/**
 * L'ORCHESTRATEUR DES AGENTS CRÉATIFS — commun aux six livrables de la jauge.
 *
 * Un livrable ne confie plus « tout » à un appel : il déclare une suite de TÂCHES
 * étroites (choisir la mise en page de cette scène, la transition de cette coupe, la
 * structure de ce deck…). Pour chacune, il dit :
 *
 *   minLevel   à partir de quel cran l'IA la prend (en dessous, le code décide)
 *   prompt     un prompt court (null = rien à décider, menu trop petit)
 *   parse      la lecture ET la validation de la réponse (undefined = refusée)
 *   fallback   la décision du code (graphe, gabarit, graine) — toujours disponible
 *   samples    au cran le plus haut, plusieurs tirages en parallèle, notés par le code
 *
 * L'orchestrateur garantit, pour toutes les tâches et une seule fois :
 *  - qu'aucune tâche au-dessus du cran ne part chez le modèle ;
 *  - qu'un agent en panne, lent, muet ou inventif cède la place au repli (jamais d'erreur) ;
 *  - qu'une réponse illisible fait monter le modèle d'UN étage (runtime d'agents) ;
 *  - le budget du livrable (coupe-circuit), les traces par agent, la progression (SSE).
 *
 * Les modèles passent par `services/agents/agent-runtime.ts#runAgent` (étages, escalade,
 * suivi d'usage) ; les contrôles remplacent l'appel par une réponse simulée.
 */
import { AI_CONFIG } from '../../config/ai.config';
import { atLeast, CreativityLevel } from '../../models/creativity.model';
import { RunBudget, runAgent } from '../agents/agent-runtime';
import { estimateTokens } from '../agents/run-budget';

export type AgentProfile = 'agents' | 'critic' | 'coder';
export type AgentSource = 'llm' | 'graph';

/** Un appel de modèle. `validate` permet au runtime d'escalader d'un étage si la réponse est illisible. */
export type AgentCall = (request: { role: string; profile: AgentProfile; system: string; user: string; validate?: (raw: string) => boolean }) => Promise<string>;

export interface AgentTask<T> {
  /** Rôle lisible (« artDirector », « animator »…). */
  role: string;
  /** Identifiant de la tâche dans la trace (« artDirector:3 »). */
  key?: string;
  minLevel: CreativityLevel;
  profile?: AgentProfile;
  prompt: () => { system: string; user: string } | null;
  parse: (raw: string) => T | undefined;
  fallback: () => T;
  /** Tirages parallèles à partir de `bestOfFrom` (défaut : max), départagés par `score` (plus bas = meilleur). */
  samples?: number;
  bestOfFrom?: CreativityLevel;
  score?: (value: T) => number;
}

export interface AgentTrace {
  agent: string;
  source: AgentSource;
  tokens: { input: number; output: number };
  ms: number;
  /** Pourquoi le modèle n'a pas été appelé ou pas retenu. */
  reason?: 'level' | 'nothing-to-decide' | 'budget' | 'refused' | 'failed';
  samples?: number;
}

export interface AgentEvent {
  agent: string;
  state: 'running' | 'done';
  source?: AgentSource;
}

export interface OrchestratorOptions {
  level: CreativityLevel;
  call?: AgentCall;
  budget?: RunBudget;
  onEvent?: (event: AgentEvent) => void;
  /** Délai d'un appel (ms) : choix 25 s, écriture de code 120 s. */
  timeoutMs?: Partial<Record<AgentProfile, number>>;
}

const DEFAULT_TIMEOUT: Record<AgentProfile, number> = { agents: 25_000, critic: 30_000, coder: 120_000 };

export class CreativeOrchestrator {
  readonly traces: AgentTrace[] = [];

  constructor(private readonly opts: OrchestratorOptions) {}

  get level(): CreativityLevel {
    return this.opts.level;
  }

  /** L'IA prend-elle les décisions de ce cran ? */
  enabled(min: CreativityLevel): boolean {
    return atLeast(this.opts.level, min);
  }

  /** Tokens estimés de tous les agents (entrée + sortie). */
  get tokens(): { input: number; output: number } {
    return this.traces.reduce((t, r) => ({ input: t.input + r.tokens.input, output: t.output + r.tokens.output }), { input: 0, output: 0 });
  }

  /** Une tâche : la décision du modèle si elle est valide, sinon celle du code. */
  async run<T>(task: AgentTask<T>): Promise<{ value: T; source: AgentSource }> {
    const agent = task.key || task.role;
    const started = Date.now();
    const graph = (reason: AgentTrace['reason'], tokens = { input: 0, output: 0 }, samples?: number) => {
      this.traces.push({ agent, source: 'graph', tokens, ms: Date.now() - started, reason, ...(samples ? { samples } : {}) });
      return { value: task.fallback(), source: 'graph' as const };
    };
    if (!this.enabled(task.minLevel) || !this.opts.call) return graph('level');
    const prompt = task.prompt();
    if (!prompt) return graph('nothing-to-decide');
    if (this.opts.budget?.exhausted) return graph('budget');

    this.opts.onEvent?.({ agent, state: 'running' });
    const profile = task.profile || 'agents';
    const n = task.score && task.samples && task.samples > 1 && this.enabled(task.bestOfFrom || 'max') ? Math.min(4, task.samples) : 1;
    const timeout = this.opts.timeoutMs?.[profile] ?? DEFAULT_TIMEOUT[profile];
    const one = async (): Promise<string> => {
      try {
        return await Promise.race([
          this.opts.call!({ role: task.role, profile, system: prompt.system, user: prompt.user, validate: (raw) => task.parse(raw) !== undefined }),
          new Promise<string>((_, reject) => setTimeout(() => reject(new Error('agent_timeout')), timeout)),
        ]);
      } catch {
        return '';
      }
    };
    const raws = await Promise.all(Array.from({ length: n }, one));
    const inTokens = estimateTokens(prompt.system + prompt.user) * n;
    const outTokens = raws.reduce((s, r) => s + estimateTokens(r), 0);
    this.opts.budget?.consume(inTokens + outTokens);
    const tokens = { input: inTokens, output: outTokens };

    const candidates = raws.map((r) => (r.trim() ? task.parse(r) : undefined)).filter((v): v is T => v !== undefined);
    if (!candidates.length) {
      this.opts.onEvent?.({ agent, state: 'done', source: 'graph' });
      return graph(raws.some((r) => r.trim()) ? 'refused' : 'failed', tokens, n > 1 ? n : undefined);
    }
    const value = n > 1 && task.score ? candidates.map((c) => ({ c, s: task.score!(c) })).sort((a, b) => a.s - b.s)[0].c : candidates[0];
    this.traces.push({ agent, source: 'llm', tokens, ms: Date.now() - started, ...(n > 1 ? { samples: n } : {}) });
    this.opts.onEvent?.({ agent, state: 'done', source: 'llm' });
    return { value, source: 'llm' };
  }

  /** Plusieurs tâches indépendantes, au plus `concurrency` à la fois (l'ordre des résultats suit celui des tâches). */
  async all<T>(tasks: AgentTask<T>[], concurrency = 4): Promise<{ value: T; source: AgentSource }[]> {
    const out = new Array<{ value: T; source: AgentSource }>(tasks.length);
    let next = 0;
    const worker = async () => {
      while (next < tasks.length) {
        const i = next++;
        out[i] = await this.run(tasks[i]);
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
    return out;
  }
}

/**
 * L'appel par défaut : le runtime d'agents. Les choix partent à l'étage le plus bas
 * (`classify`), la relecture à l'étage de contrôle (`verify`), l'écriture de code à
 * l'étage créatif ; une réponse illisible fait monter d'un étage, une seule fois.
 *
 * Le livrable a déjà été payé en crédits avant la génération : ses agents ne repassent
 * pas le contrôle de quota appel par appel (un livrable ne doit pas s'arrêter au milieu).
 */
export function runtimeCall(ctx: { userId?: string; projectId?: string; element?: string; language?: string; budget?: RunBudget }): AgentCall {
  return async ({ role, profile, system, user, validate }) => {
    const feature = AI_CONFIG.creative[profile];
    const res = await runAgent(
      {
        role: `creative.${role}`,
        task: profile === 'coder' ? 'creative' : profile === 'critic' ? 'verify' : 'classify',
        baseConfig: feature,
        llmOptions: feature.llmOptions,
        systemPrompt: system,
        promptType: feature.promptType,
        validate: validate ? (text) => ({ ok: validate(text), reason: 'réponse illisible ou hors menu' }) : undefined,
      },
      { messages: [{ role: 'user', content: user }], userId: ctx.userId, projectId: ctx.projectId, element: ctx.element, language: ctx.language, budget: ctx.budget, skipQuotaCheck: true }
    );
    return res.text;
  };
}

/** Adapte un rédacteur simple (system, user → texte) en appel d'agent — contrôles, modules existants. */
export function writerCall(writer: ((system: string, user: string) => Promise<string>) | undefined): AgentCall | undefined {
  return writer ? ({ system, user }) => writer(system, user) : undefined;
}
