/**
 * L'orchestrateur des agents créatifs vit dans le moteur partagé (apps/ivision/core) : IDEM et
 * iVision exécutent le même. Ce module le réexporte et ajoute l'appel propre à IDEM : le runtime
 * d'agents (étages, escalade, suivi d'usage).
 */
import { AI_CONFIG } from '../../config/ai.config';
import { RunBudget, runAgent } from '../agents/agent-runtime';
import type { AgentCall } from '../../../../ivision/core/src/creativity/orchestrator';

export * from '../../../../ivision/core/src/creativity/orchestrator';

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
