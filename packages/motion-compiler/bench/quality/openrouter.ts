/**
 * L'APPEL DIRECT À OPENROUTER DES BANCS (qualité, professeur) — les MÊMES réglages que la production
 * (`apps/api/api/services/creativity/orchestrator.ts#openRouterCallOptions`) : modèle du rôle au cran (échelles et
 * replis d'IDEM), sortie structurée stricte et `require_parameters`, `response-healing`, précision bf16/fp8,
 * raisonnement coupé pour l'échantillonnage. Pour des mesures reproductibles, les fournisseurs sont FIGÉS
 * (`--providers` ou `IDEM_OPENROUTER_PROVIDER_ORDER`) et le fournisseur qui a servi est journalisé.
 *
 * Chaque appel rend sa consommation EXACTE (jetons, coût en dollars d'OpenRouter).
 */
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import type { AgentCall } from '../../../../apps/ivision/core/src/creativity/orchestrator';
import { roleConfig } from '../../../../apps/api/api/config/creative-roles';

export interface Usage {
  calls: number;
  input: number;
  output: number;
  cost: number;
  ms: number;
  providers: Record<string, number>;
}
export const zeroUsage = (): Usage => ({ calls: 0, input: 0, output: 0, cost: 0, ms: 0, providers: {} });

export function apiKey(): string {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
  for (const f of ['../../../../apps/api/.env.secret', '../../../../apps/api/.env']) {
    const p = path.join(__dirname, f);
    if (!fs.existsSync(p)) continue;
    const m = fs.readFileSync(p, 'utf8').match(/^OPENROUTER_API_KEY=(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  throw new Error('OPENROUTER_API_KEY introuvable');
}

const list = (v?: string) => (v || '').split(',').map((s) => s.trim()).filter(Boolean);

/** Un AgentCall qui parle directement à OpenRouter, avec les réglages de production et un compteur. */
export function openRouterCall(usage: Usage, opts: { providers?: string[] } = {}): AgentCall {
  const key = apiKey();
  const order = opts.providers?.length ? opts.providers : list(process.env.IDEM_OPENROUTER_PROVIDER_ORDER);
  return async ({ role, profile, system, user, level, options }) => {
    const cfg = roleConfig(role, profile, level);
    const models = [cfg.modelName, ...(cfg.fallbackModels || [])].filter(Boolean) as string[];
    const started = Date.now();
    const quant = (process.env.IDEM_OPENROUTER_QUANTIZATIONS ?? 'bf16,fp8').trim();
    const body: Record<string, unknown> = {
      model: models[0],
      ...(models.length > 1 ? { models } : {}),
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      max_tokens: cfg.llmOptions?.maxOutputTokens || 8000,
      ...(options?.temperature !== undefined ? { temperature: options.temperature } : { temperature: 0.7 }),
      ...(options?.seed !== undefined ? { seed: options.seed } : {}),
      reasoning: { enabled: options?.reasoning === true },
      usage: { include: true },
      provider: {
        ...(options?.schema ? { require_parameters: true } : {}),
        ...(quant && quant !== 'off' ? { quantizations: list(quant) } : {}),
        ...(order.length ? { order, allow_fallbacks: false } : {}),
      },
      ...(options?.schema ? { response_format: { type: 'json_schema', json_schema: { name: options.schema.name, strict: true, schema: options.schema.schema } }, plugins: [{ id: 'response-healing' }] } : {}),
    };
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { data } = await axios.post('https://openrouter.ai/api/v1/chat/completions', body, { headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, timeout: 300_000 });
        usage.calls++;
        usage.input += Number(data?.usage?.prompt_tokens || 0);
        usage.output += Number(data?.usage?.completion_tokens || 0);
        usage.cost += Number(data?.usage?.cost || 0);
        usage.ms += Date.now() - started;
        if (data?.provider) usage.providers[data.provider] = (usage.providers[data.provider] || 0) + 1;
        return String(data?.choices?.[0]?.message?.content || '');
      } catch (error) {
        const status = (error as { response?: { status?: number } }).response?.status;
        if (status === 402 || status === 403 || status === 401) throw new Error(`openrouter_${status}`);
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
    return '';
  };
}
