/**
 * Un appel de modèle du moteur graphique : un rôle (le cran choisit le modèle chez l'hôte), un délai, une trace.
 */
import type { CreativityLevel } from '../contracts/common';
import type { AgentCall, AgentProfile } from '../host';
import { estimateTokens, TaskName, TraceRecorder } from '../observability/traces';

export interface ModelRun {
  raw: string;
  ok: boolean;
  failure?: string;
  tokens: number;
}

export async function callModel(o: {
  call: AgentCall;
  recorder: TraceRecorder;
  task: TaskName;
  role: string;
  profile: AgentProfile;
  level: CreativityLevel;
  system: string;
  user: string;
  timeoutMs: number;
  validate: (raw: string) => boolean;
}): Promise<ModelRun> {
  const started = Date.now();
  const input = estimateTokens(o.system + o.user);
  let raw = '';
  let failure: string | undefined;
  let timer: NodeJS.Timeout | undefined;
  try {
    raw = await Promise.race([
      o.call({ role: o.role, profile: o.profile, system: o.system, user: o.user, validate: o.validate, level: o.level }),
      new Promise<string>((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), o.timeoutMs);
      }),
    ]);
  } catch (error) {
    failure = (error as Error)?.message === 'timeout' ? 'timeout' : String((error as Error)?.message ?? error).slice(0, 200);
  } finally {
    if (timer) clearTimeout(timer);
  }
  const output = estimateTokens(raw);
  const ok = !failure && o.validate(raw);
  if (!ok && !failure) failure = raw.trim() ? 'unusable answer' : 'empty answer';
  o.recorder.task({ task: o.task, source: 'llm', role: o.role, profile: o.profile, inputTokens: input, outputTokens: output, ms: Date.now() - started, outcome: ok ? 'accepted' : failure === 'timeout' ? 'failed' : 'refused', ...(ok ? {} : { reason: failure === 'timeout' ? 'timeout' : failure === 'unusable answer' || failure === 'empty answer' ? 'invalid' : 'error' }) });
  return { raw, ok, failure, tokens: input + output };
}
