/**
 * L'orchestrateur des agents créatifs vit dans le moteur partagé (apps/ivision/core) : IDEM et
 * iVision exécutent le même. Ce module le réexporte et ajoute l'appel propre à IDEM : le runtime
 * d'agents (étages, escalade, suivi d'usage).
 */
import { roleConfig, roleOf } from '../../config/creative-roles';
import { RunBudget, runAgent } from '../agents/agent-runtime';
import type { AgentCall, AgentCallOptions } from '../../../../ivision/core/src/creativity/orchestrator';
import type { LLMOptions } from '../../config/ai.config';

export * from '../../../../ivision/core/src/creativity/orchestrator';

/**
 * Les réglages d'un appel du moteur vidéo, traduits pour OpenRouter (plan qualité, 29/10/2026) :
 *
 *   sortie structurée  `response_format: json_schema` STRICT et `provider.require_parameters` : seuls les points d'accès
 *                      qui l'appliquent sont atteints (l'application varie selon le fournisseur : le validateur reste) ;
 *   réparation         plugin `response-healing` : il répare la SYNTAXE d'une réponse non diffusée (pas le schéma) ;
 *   précision          `provider.quantizations` bf16 et fp8 (`IDEM_OPENROUTER_QUANTIZATIONS`, « off » pour couper) :
 *                      un même identifiant regroupe des fournisseurs de int4 à bf16 ;
 *   banc               `IDEM_OPENROUTER_PROVIDER_ORDER` / `_ONLY` figent les fournisseurs pendant les mesures ;
 *   raisonnement       coupé pour l'échantillonnage (`thinking: disabled`, traduit en `reasoning`), demandé sinon ;
 *                      un modèle qui ne sait pas le couper le garde (`canSuppressThinking`).
 */
function mergeOptions(base: LLMOptions | undefined, extra: LLMOptions): LLMOptions {
  return { ...(base || {}), ...extra, ...(base?.extraBody || extra.extraBody ? { extraBody: { ...(base?.extraBody || {}), ...(extra.extraBody || {}) } } : {}) };
}

export function openRouterCallOptions(options?: AgentCallOptions): LLMOptions {
  if (!options) return {};
  const list = (name: string) => (process.env[name] || '').split(',').map((s) => s.trim()).filter(Boolean);
  const quant = (process.env.IDEM_OPENROUTER_QUANTIZATIONS ?? 'bf16,fp8').trim();
  const provider: Record<string, unknown> = {
    ...(options.schema ? { require_parameters: true } : {}),
    ...(quant && quant !== 'off' ? { quantizations: quant.split(',').map((q) => q.trim()).filter(Boolean) } : {}),
    ...(list('IDEM_OPENROUTER_PROVIDER_ORDER').length ? { order: list('IDEM_OPENROUTER_PROVIDER_ORDER'), allow_fallbacks: false } : {}),
    ...(list('IDEM_OPENROUTER_PROVIDER_ONLY').length ? { only: list('IDEM_OPENROUTER_PROVIDER_ONLY') } : {}),
  };
  const extraBody: Record<string, unknown> = {
    ...(Object.keys(provider).length ? { provider } : {}),
    ...(options.schema ? { response_format: { type: 'json_schema', json_schema: { name: options.schema.name, strict: true, schema: options.schema.schema } } } : {}),
    ...(options.schema && (process.env.IDEM_OPENROUTER_RESPONSE_HEALING ?? 'on') !== 'off' ? { plugins: [{ id: 'response-healing' }] } : {}),
    ...(options.reasoning === false ? { thinking: { type: 'disabled' } } : options.reasoning === true ? { thinking: { type: 'enabled' } } : {}),
    ...(options.seed !== undefined ? { seed: options.seed } : {}),
  };
  return { ...(options.temperature !== undefined ? { temperature: options.temperature } : {}), ...(Object.keys(extraBody).length ? { extraBody } : {}), ...(options.reasoning === false ? { thinkingBudget: 0 } : {}) };
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
  return async ({ role, profile, system, user, validate, level, options }) => {
    // Le RÔLE logique choisit le modèle (profil par défaut, modèle ou point d'accès configurés —
    // `config/creative-roles.ts`) et son plafond au cran : aucun nom de modèle n'est écrit par un moteur.
    const feature = roleConfig(role, profile, level);
    const res = await runAgent(
      {
        role: `creative.${roleOf(role)}`,
        task: profile === 'coder' ? 'creative' : profile === 'critic' ? 'verify' : 'classify',
        baseConfig: feature,
        llmOptions: mergeOptions(feature.llmOptions, openRouterCallOptions(options)),
        systemPrompt: system,
        promptType: feature.promptType,
        validate: validate ? (text) => ({ ok: validate(text), reason: 'réponse illisible ou hors menu' }) : undefined,
      },
      { messages: [{ role: 'user', content: user }], userId: ctx.userId, projectId: ctx.projectId, element: ctx.element, language: ctx.language, budget: ctx.budget }
    );
    return res.text;
  };
}
