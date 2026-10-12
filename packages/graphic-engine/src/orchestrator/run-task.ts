/**
 * Exécuter UNE tâche confiée à un modèle, avec ses garanties :
 *  · aucune tâche au-dessous de son cran ne part chez le modèle ;
 *  · un modèle absent, lent, muet ou dont la réponse ne se valide pas cède la place à la décision du code
 *    (jamais une erreur pour l'utilisateur) ;
 *  · le budget de la génération est tenu ; chaque appel laisse sa trace (jetons, durée, raison).
 */
import type { CreativityLevel } from '../contracts/common';
import type { AgentCall } from '../host';
import { estimateTokens, TraceRecorder } from '../observability/traces';
import { atLeast, TaskPolicy, TokenBudget } from './policies';

export interface TaskRun<T> {
  policy: TaskPolicy;
  level: CreativityLevel;
  call?: AgentCall;
  budget: TokenBudget;
  recorder: TraceRecorder;
  /** `null` : rien à décider (menu d'un seul choix…). */
  prompt: () => { system: string; user: string } | null;
  /** Lecture ET validation : `undefined` = réponse refusée. */
  parse: (raw: string) => T | undefined;
  fallback: () => T;
}

export async function runTask<T>(run: TaskRun<T>): Promise<{ value: T; source: 'llm' | 'code' }> {
  const started = Date.now();
  const code = (reason: 'level' | 'budget' | 'no-port' | 'nothing-to-decide' | 'invalid' | 'timeout' | 'error', tokens = { input: 0, output: 0 }) => {
    run.recorder.task({ task: run.policy.task, source: 'code', role: run.policy.role, profile: run.policy.profile, inputTokens: tokens.input, outputTokens: tokens.output, ms: Date.now() - started, outcome: reason === 'invalid' ? 'refused' : reason === 'timeout' || reason === 'error' ? 'failed' : 'skipped', reason });
    return { value: run.fallback(), source: 'code' as const };
  };
  if (!atLeast(run.level, run.policy.minLevel)) return code('level');
  if (!run.call) return code('no-port');
  const prompt = run.prompt();
  if (!prompt) return code('nothing-to-decide');
  const input = estimateTokens(prompt.system + prompt.user);
  if (!run.budget.allows(Math.min(run.policy.maxTokens, input + 600))) return code('budget');

  let raw = '';
  try {
    raw = await Promise.race([
      run.call({ role: run.policy.role, profile: run.policy.profile, system: prompt.system, user: prompt.user, validate: (r) => run.parse(r) !== undefined }),
      new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), run.policy.timeoutMs)),
    ]);
  } catch (error) {
    run.budget.consume(input);
    return code((error as Error)?.message === 'timeout' ? 'timeout' : 'error', { input, output: 0 });
  }
  const output = estimateTokens(raw);
  run.budget.consume(input + output);
  const value = raw.trim() ? run.parse(raw) : undefined;
  if (value === undefined) return code('invalid', { input, output });
  run.recorder.task({ task: run.policy.task, source: 'llm', role: run.policy.role, profile: run.policy.profile, inputTokens: input, outputTokens: output, ms: Date.now() - started, outcome: 'accepted' });
  return { value, source: 'llm' };
}

/** Le premier objet JSON d'une réponse (texte autour, balises de code et virgules finales tolérés). */
export function parseJsonObject(raw: string): Record<string, unknown> | undefined {
  const text = raw.replace(/```(?:json)?/gi, '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return undefined;
  const body = text.slice(start, end + 1).replace(/,\s*([}\]])/g, '$1');
  try {
    const value = JSON.parse(body);
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}
