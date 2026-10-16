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

/** The proposal, or null when the platform cannot answer (never fails the deployment further). */
export async function requestRepair(body: RepairRequestBody): Promise<RepairProposal | null> {
  try {
    const { data } = await axios.post(`${IDEM_API_URL}/internal/ideploy/repair`, body, {
      headers: { 'x-api-key': process.env.INTERNAL_API_KEY as string },
      timeout: 120_000,
    });
    return (data?.data?.proposal as RepairProposal) ?? null;
  } catch (error: any) {
    logger.warn('AI repair unavailable', { deploymentUuid: body.deploymentUuid, error: error?.response?.data?.message ?? error?.message });
    return null;
  }
}
