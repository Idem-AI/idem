/**
 * What a pipeline does with what the scans find.
 *
 * The scans used to stop every deployment on a hard-coded threshold: a
 * critical vulnerability in a base image or a failed quality gate meant nothing
 * was ever deployed, with no way for the owner of the application to decide
 * otherwise. The policy now belongs to the application (`pipeline_configs.config`),
 * and what it does not block is still recorded and shown.
 */
export type TrivyFailOn = 'NONE' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface PipelineGates {
  /** Lowest severity that stops the pipeline; `NONE` only reports. */
  trivy_fail_on: TrivyFailOn;
  /** `enforce`: a failed SonarQube quality gate stops the pipeline. */
  quality_gate: 'enforce' | 'report';
  /** `block`: a secret committed in the code stops the pipeline. */
  secrets: 'block' | 'report';
}

const TRIVY_LEVELS: TrivyFailOn[] = ['NONE', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

/**
 * Report-only for vulnerabilities and the quality gate; committed secrets
 * still stop the pipeline. `PIPELINE_TRIVY_FAIL_ON` lets an operator set the
 * platform-wide default for applications that did not choose.
 */
export function defaultGates(env: NodeJS.ProcessEnv = process.env): PipelineGates {
  const fromEnv = (env.PIPELINE_TRIVY_FAIL_ON || '').toUpperCase() as TrivyFailOn;
  return {
    trivy_fail_on: TRIVY_LEVELS.includes(fromEnv) ? fromEnv : 'NONE',
    quality_gate: 'report',
    secrets: 'block',
  };
}

/** The application's saved policy over the defaults; unknown values fall back. */
export function resolveGates(config: unknown, env: NodeJS.ProcessEnv = process.env): PipelineGates {
  const base = defaultGates(env);
  const saved = ((config as { gates?: Partial<PipelineGates> } | null)?.gates ?? {}) as Partial<PipelineGates>;
  return {
    trivy_fail_on: TRIVY_LEVELS.includes(saved.trivy_fail_on as TrivyFailOn) ? (saved.trivy_fail_on as TrivyFailOn) : base.trivy_fail_on,
    quality_gate: saved.quality_gate === 'enforce' || saved.quality_gate === 'report' ? saved.quality_gate : base.quality_gate,
    secrets: saved.secrets === 'block' || saved.secrets === 'report' ? saved.secrets : base.secrets,
  };
}

/** Validates a policy sent by a client; throws on an unknown value. */
export function parseGates(input: unknown): Partial<PipelineGates> {
  const g = (input ?? {}) as Record<string, unknown>;
  const out: Partial<PipelineGates> = {};
  if (g.trivy_fail_on !== undefined) {
    if (!TRIVY_LEVELS.includes(g.trivy_fail_on as TrivyFailOn)) throw new Error(`trivy_fail_on must be one of ${TRIVY_LEVELS.join(', ')}`);
    out.trivy_fail_on = g.trivy_fail_on as TrivyFailOn;
  }
  if (g.quality_gate !== undefined) {
    if (g.quality_gate !== 'enforce' && g.quality_gate !== 'report') throw new Error('quality_gate must be enforce or report');
    out.quality_gate = g.quality_gate;
  }
  if (g.secrets !== undefined) {
    if (g.secrets !== 'block' && g.secrets !== 'report') throw new Error('secrets must be block or report');
    out.secrets = g.secrets;
  }
  return out;
}
