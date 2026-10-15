/**
 * Les TRACES : chaque génération peut être retracée et son coût mesuré.
 *
 * Pour chaque tâche : son type, qui l'a tranchée (le code ou un modèle), le rôle et le profil du modèle,
 * les jetons d'entrée et de sortie, la durée, le résultat, et pourquoi un modèle n'a pas été appelé
 * (cran, budget, rien à décider). Les traces d'une génération sont rattachées à un identifiant : le coût
 * d'un DOCUMENT se calcule, pas seulement celui d'un agent.
 */
import type { CreativityLevel, DocumentType, FormatId } from '../contracts/common';
import type { Repair } from '../contracts/render-result';
import { COMPONENT_LIBRARY_VERSION, ENGINE_VERSION } from '../version';

/** direct : la bible du document ; author : une page ; revise : une retouche écrite ; repair : une page qui ne s'affichait pas ; render : assainir, compiler, afficher. */
export type TaskName = 'direct' | 'author' | 'revise' | 'repair' | 'render' | 'asset.resolve';

export interface TaskTrace {
  task: TaskName;
  source: 'code' | 'llm';
  role?: string;
  profile?: string;
  inputTokens: number;
  outputTokens: number;
  ms: number;
  outcome: 'accepted' | 'refused' | 'failed' | 'skipped';
  /** Pourquoi le modèle n'a pas été appelé ou pas retenu. */
  reason?: 'level' | 'budget' | 'no-port' | 'nothing-to-decide' | 'invalid' | 'timeout' | 'error';
}

export interface GenerationTrace {
  generationId: string;
  documentType: DocumentType;
  format: FormatId;
  level: CreativityLevel;
  sectionId?: string;
  pattern?: string;
  tasks: TaskTrace[];
  repairs: Repair[];
  attempts: number;
  ms: number;
  engine: string;
  components: string;
  /** Les médias de la page : `assetId ← source (fournisseur)`, ou `assetId ✗` quand aucun n'a été trouvé. */
  assets?: string[];
}

/** ≈ 4 signes par jeton : l'estimation des runtimes de l'hôte, gardée pour comparer. */
export const estimateTokens = (text: string): number => Math.ceil((text || '').length / 4);

export class TraceRecorder {
  readonly tasks: TaskTrace[] = [];
  readonly repairs: Repair[] = [];
  attempts = 0;
  private readonly started = Date.now();

  constructor(private readonly base: Omit<GenerationTrace, 'tasks' | 'repairs' | 'attempts' | 'ms' | 'engine' | 'components'>) {}

  task(t: TaskTrace): void {
    this.tasks.push(t);
  }

  repair(r: Repair): void {
    this.repairs.push(r);
  }

  usage(): { agentCalls: number; inputTokens: number; outputTokens: number; ms: number } {
    const llm = this.tasks.filter((t) => t.source === 'llm');
    return { agentCalls: llm.length, inputTokens: llm.reduce((s, t) => s + t.inputTokens, 0), outputTokens: llm.reduce((s, t) => s + t.outputTokens, 0), ms: Date.now() - this.started };
  }

  finish(extra: Partial<GenerationTrace> = {}): GenerationTrace {
    return { ...this.base, ...extra, tasks: this.tasks, repairs: this.repairs, attempts: this.attempts, ms: Date.now() - this.started, engine: ENGINE_VERSION, components: COMPONENT_LIBRARY_VERSION };
  }
}

/** Agrégats d'un ensemble de traces (benchmarks, journaux) : coût par document accepté, réparations, tâches. */
export function summarize(traces: GenerationTrace[]): { generations: number; agentCalls: number; inputTokens: number; outputTokens: number; repairs: number; meanMs: number; byTask: Record<string, { llm: number; code: number; tokens: number }> } {
  const byTask: Record<string, { llm: number; code: number; tokens: number }> = {};
  let agentCalls = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let repairs = 0;
  let ms = 0;
  for (const t of traces) {
    repairs += t.repairs.length;
    ms += t.ms;
    for (const task of t.tasks) {
      const row = (byTask[task.task] ||= { llm: 0, code: 0, tokens: 0 });
      if (task.source === 'llm') {
        row.llm += 1;
        agentCalls += 1;
      } else row.code += 1;
      row.tokens += task.inputTokens + task.outputTokens;
      inputTokens += task.inputTokens;
      outputTokens += task.outputTokens;
    }
  }
  return { generations: traces.length, agentCalls, inputTokens, outputTokens, repairs, meanMs: traces.length ? Math.round(ms / traces.length) : 0, byTask };
}
