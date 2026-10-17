/**
 * The repair agent lives in the IDEM API, with the platform's model routing,
 * budgets, cache and cost tracking: iDeploy only sends a compact context and
 * reads back a proposal.
 */
import axios from 'axios';
import logger from '../config/logger';
import { RepairProposal } from './proposal';

const IDEM_API_URL = process.env.IDEM_API_URL || 'http://localhost:3001';

export interface RepairRequestBody {
  deploymentUuid: string;
  attempt: number;
  stage: 'plan' | 'build' | 'start';
  failureCode: string | null;
  plan: string[];
  settings: Record<string, string | null>;
  variables: string[];
  log: string;
  tree: string[];
  files: { path: string; content: string }[];
  previous?: { proposal: RepairProposal; log: string };
}

/**
 * On when the API key shared with IDEM is set, unless IDEPLOY_AI_REPAIR=off
 * on the server. An application opts out with the variable IDEPLOY_AI_REPAIR=off,
 * or keeps the diagnosis without changes with IDEPLOY_AI_REPAIR=diagnose.
 */
export function repairAvailable(): boolean {
  return Boolean(process.env.INTERNAL_API_KEY) && process.env.IDEPLOY_AI_REPAIR !== 'off';
}

/** Why the repair service did not answer, said so the operator can fix it. */
export function unavailableReason(status: number | undefined, message: string | undefined): string {
  if (status === 401 || status === 403) {
    return "the IDEM API refused iDeploy's key: INTERNAL_API_KEY must hold the same value in the ideploy-api and api secrets";
  }
  if (status === 404) return 'the IDEM API has no repair route (not deployed yet)';
  if (status === 400) return `the request was refused (${message ?? 'invalid'})`;
  if (status) return `the IDEM API answered ${status}${message ? ` (${message})` : ''}`;
  return message ?? 'no answer';
}

/** The proposal, or why there is none (never fails the deployment further). */
export async function requestRepair(body: RepairRequestBody): Promise<{ proposal: RepairProposal | null; reason: string | null }> {
  try {
    const { data } = await axios.post(`${IDEM_API_URL}/internal/ideploy/repair`, body, {
      headers: { 'x-api-key': process.env.INTERNAL_API_KEY as string },
      timeout: 120_000,
    });
    const proposal = (data?.data?.proposal as RepairProposal) ?? null;
    return { proposal, reason: proposal ? null : 'empty answer' };
  } catch (error: any) {
    const reason = unavailableReason(error?.response?.status, error?.response?.data?.message ?? (error?.code === 'ECONNABORTED' ? 'no answer within 120 s' : error?.message));
    logger.warn('AI repair unavailable', { event: 'deployment.repair_unavailable', deploymentUuid: body.deploymentUuid, reason });
    return { proposal: null, reason };
  }
}
