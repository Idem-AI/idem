/**
 * Réparation d'un déploiement iDeploy en échec — un agent du runtime IDEM.
 *
 * iDeploy a déjà épuisé le gratuit : son catalogue d'échecs connus et ses
 * rattrapages déterministes (lockfile, tas Node, variables, miroir…). Ce qui
 * arrive ici est la longue traîne, et la méthode est celle du reste de la
 * plateforme :
 *
 *   - un contexte COMPACT, préparé et expurgé côté iDeploy (extrait d'erreur
 *     filtré, plan de build, arborescence, quelques fichiers, NOMS des
 *     variables — jamais leurs valeurs) : quelques milliers de tokens ;
 *   - une sortie JSON contrainte (`jsonMode`) et un contrôle DÉTERMINISTE de sa
 *     forme : un verdict illisible fait escalader d'un cran, une fois ;
 *   - l'étage le plus bas d'abord (`repair` → XS). Le vrai contrôle de la
 *     réparation est la reconstruction réelle côté iDeploy : quand elle échoue,
 *     la deuxième tentative part à l'étage raisonnement, avec ce qui a été
 *     essayé et ce que cela a donné ;
 *   - un budget de run, et un cache par empreinte : le même échec, rencontré
 *     de nouveau, ne repaie pas de tokens.
 */

import crypto from 'crypto';
import { z } from 'zod';
import logger from '../../config/logger';
import { logAIEvent } from '../../utils/ai-trace.util';
import { cacheService } from '../cache.service';
import { createRunBudget, runAgentPrompt } from '../agents/agent-runtime';

/** Réglages qu'une réparation peut changer — ceux de Paramètres › Options de build. */
export const REPAIR_SETTINGS = [
  'install_command',
  'build_command',
  'start_command',
  'base_directory',
  'publish_directory',
  'ports_exposes',
  'dockerfile_location',
  'build_pack',
] as const;

/** Variables de build sans secret qu'une réparation peut poser. */
export const REPAIR_BUILD_VARIABLES = ['NODE_OPTIONS', 'IDEPLOY_BUILDER', 'IDEPLOY_TRIAL'] as const;

const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('set_setting'), key: z.enum(REPAIR_SETTINGS), value: z.string().max(500) }),
  z.object({ type: z.literal('set_build_variable'), key: z.enum(REPAIR_BUILD_VARIABLES), value: z.string().max(200) }),
  z.object({ type: z.literal('ask_user'), variable: z.string().max(100).optional(), question: z.string().min(1).max(400) }),
]);

export const proposalSchema = z.object({
  diagnosis: z.string().min(1).max(600),
  fixable: z.boolean(),
  actions: z.array(actionSchema).max(6),
});

export type RepairProposal = z.infer<typeof proposalSchema>;

export const repairRequestSchema = z.object({
  deploymentUuid: z.string().max(64),
  /** 1 : première tentative ; 2 : la première a été appliquée et a échoué. */
  attempt: z.number().int().min(1).max(2),
  stage: z.enum(['plan', 'build', 'start']),
  failureCode: z.string().max(64).nullable(),
  plan: z.array(z.string().max(600)).max(30),
  settings: z.record(z.string().max(500).nullable()),
  variables: z.array(z.string().max(100)).max(200),
  log: z.string().max(12_000),
  tree: z.array(z.string().max(300)).max(300),
  files: z.array(z.object({ path: z.string().max(300), content: z.string().max(6_000) })).max(10),
  previous: z
    .object({ proposal: proposalSchema, log: z.string().max(6_000) })
    .optional(),
});

export type RepairRequest = z.infer<typeof repairRequestSchema>;

export interface RepairResult {
  proposal: RepairProposal;
  tier: string;
  escalated: boolean;
  cached: boolean;
}

/** Plafond d'une réparation : deux tentatives, une escalade chacune. */
const RUN_BUDGET_TOKENS = 40_000;
/** Une empreinte d'échec garde sa réponse une semaine. */
const CACHE_TTL_SECONDS = 7 * 24 * 3600;

const SYSTEM_PROMPT = `You repair failed deployments on iDeploy, a PaaS that builds Git repositories into containers.
You receive: the build plan iDeploy read from the code, the application's current settings, the names of its variables (never their values), an excerpt of the failing log, the file tree and a few files.

Answer with ONE JSON object, nothing else:
{"diagnosis": "<the cause, in one or two plain sentences for a developer>",
 "fixable": <true if the actions below should make the deployment work>,
 "actions": [
   {"type":"set_setting","key":"<install_command|build_command|start_command|base_directory|publish_directory|ports_exposes|dockerfile_location|build_pack>","value":"<new value>"},
   {"type":"set_build_variable","key":"<NODE_OPTIONS|IDEPLOY_BUILDER|IDEPLOY_TRIAL>","value":"<value>"},
   {"type":"ask_user","variable":"<VARIABLE_NAME, optional>","question":"<what the developer must provide or do>"}
 ]}

Rules:
- The smallest change that fixes the cause. Never several guesses at once.
- Settings only: you cannot edit the code. If the fix is in the code, set "fixable": false and say exactly what to change in "diagnosis".
- Commands run from the Root directory (base_directory, relative to the repository). Use paths and scripts that exist in the tree and files given.
- build_pack is one of nixpacks, static, dockerfile. IDEPLOY_BUILDER=nixpacks bypasses iDeploy's own recipe.
- Secrets (passwords, API keys, tokens) are never yours to invent: ask for them with ask_user, naming the variable.
- A port is a number. A value is one line.
- If a previous attempt is given, it was applied and failed: do not repeat it; use what its log shows.`;

class IdeployRepairService {
  async propose(request: RepairRequest): Promise<RepairResult> {
    // L'empreinte ignore l'identifiant du déploiement : deux déploiements qui
    // échouent pareil sur le même code partagent la réponse.
    const { deploymentUuid, ...fingerprinted } = request;
    const key = crypto.createHash('sha256').update(JSON.stringify(fingerprinted)).digest('hex');
    const cached = await cacheService.get<RepairResult>(key, { prefix: 'ideploy-repair' });
    if (cached) {
      logAIEvent('ideploy.repair', { deploymentUuid, attempt: request.attempt, cached: true, fixable: cached.proposal.fixable });
      return { ...cached, cached: true };
    }

    const budget = createRunBudget(`ideploy-repair:${deploymentUuid}`, RUN_BUDGET_TOKENS);
    const result = await runAgentPrompt(
      {
        role: 'ideploy-repair',
        // Première tentative : l'étage de la tâche (XS), escalade si la
        // réponse est illisible. Seconde : la reconstruction a démenti la
        // première, on part au raisonnement.
        task: 'repair',
        ...(request.attempt > 1 ? { tier: 'S' as const } : {}),
        systemPrompt: SYSTEM_PROMPT,
        promptType: 'ideploy-repair',
        llmOptions: { temperature: 0.1, maxOutputTokens: 1200, jsonMode: true },
        validate: (text) => {
          const parsed = parseProposal(text);
          return parsed.ok ? { ok: true } : { ok: false, reason: parsed.reason };
        },
      },
      renderRequest(request),
      { element: 'iDeploy repair', budget, skipQuotaCheck: true }
    );

    const parsed = parseProposal(result.text);
    if (!parsed.ok) {
      logger.warn(`iDeploy repair: unreadable proposal after ${result.attempts} attempt(s): ${parsed.reason}`);
      throw new Error(`Unreadable repair proposal: ${parsed.reason}`);
    }

    const output: RepairResult = { proposal: parsed.proposal, tier: result.tier, escalated: result.escalated, cached: false };
    await cacheService.set(key, output, { prefix: 'ideploy-repair', ttl: CACHE_TTL_SECONDS });
    logAIEvent('ideploy.repair', {
      deploymentUuid,
      attempt: request.attempt,
      stage: request.stage,
      failureCode: request.failureCode,
      tier: result.tier,
      escalated: result.escalated,
      estimatedTokens: result.estimatedTokens,
      fixable: parsed.proposal.fixable,
      actions: parsed.proposal.actions.map((a) => (a.type === 'ask_user' ? 'ask_user' : `${a.type}:${a.key}`)),
    });
    return output;
  }
}

/** La réponse du modèle, lue et contrôlée — sans exception, pour servir aussi de `validate`. */
export function parseProposal(text: string): { ok: true; proposal: RepairProposal } | { ok: false; reason: string } {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return { ok: false, reason: 'no JSON object' };
  let json: unknown;
  try {
    json = JSON.parse(text.slice(start, end + 1));
  } catch (error: any) {
    return { ok: false, reason: `invalid JSON: ${error?.message ?? 'parse error'}` };
  }
  const result = proposalSchema.safeParse(json);
  if (!result.success) return { ok: false, reason: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
  if (result.data.fixable && !result.data.actions.some((a) => a.type !== 'ask_user')) {
    return { ok: false, reason: 'fixable without a setting to change' };
  }
  return { ok: true, proposal: result.data };
}

/** Le contexte, rendu compact : sections titrées, rien de décoratif. */
export function renderRequest(request: RepairRequest): string {
  const settings = Object.entries(request.settings)
    .map(([k, v]) => `${k}: ${v === null || v === '' ? '(empty)' : v}`)
    .join('\n');
  const parts = [
    `STAGE: ${request.stage}${request.failureCode ? ` (${request.failureCode})` : ''}`,
    `BUILD PLAN:\n${request.plan.join('\n') || '(none)'}`,
    `SETTINGS:\n${settings}`,
    `VARIABLES (names): ${request.variables.join(', ') || '(none)'}`,
    `LOG EXCERPT:\n${request.log}`,
    `FILE TREE:\n${request.tree.join('\n')}`,
    ...request.files.map((f) => `FILE ${f.path}:\n${f.content}`),
  ];
  if (request.previous) {
    parts.push(
      `PREVIOUS ATTEMPT (applied, failed):\n${JSON.stringify(request.previous.proposal.actions)}\nITS LOG:\n${request.previous.log}`
    );
  }
  return parts.join('\n\n');
}

export const ideployRepairService = new IdeployRepairService();
