/**
 * LE CONTRAT D'UN OUTIL — ce qu'un agent créatif peut demander au code.
 *
 * Un outil est une CAPACITÉ : l'agent (ou l'orchestrateur, en mode piloté par le code) choisit de l'appeler, le code
 * répond par des faits mesurés. Aucun outil n'écrit une page ni ne choisit une mise en page. Une entrée est validée
 * (Zod) ; une panne rend la réponse neutre de l'outil (`fallback`) et la raison — jamais d'exception chez l'appelant.
 */
import type { ZodType } from 'zod';

export interface ToolContext {
  /** Délai maximal d'un appel (ms). */
  timeoutMs?: number;
}

export interface DesignTool<I, O> {
  name: string;
  /** Ce que fait l'outil, lu par un agent qui sait appeler des outils. */
  description: string;
  schema: ZodType<I>;
  run(input: I, ctx: ToolContext): Promise<O>;
  /** La réponse neutre quand l'outil est indisponible (dépendance absente, délai). */
  fallback?: O;
}

export interface ToolResult<O> {
  ok: boolean;
  value?: O;
  /** Pourquoi l'outil n'a pas répondu (entrée refusée, panne, délai). */
  error?: string;
  ms: number;
}

/** Appelle un outil : entrée validée, délai borné, repli neutre en cas de panne. */
export async function runTool<I, O>(tool: DesignTool<I, O>, input: unknown, ctx: ToolContext = {}): Promise<ToolResult<O>> {
  const started = Date.now();
  const parsed = tool.schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: `entrée refusée : ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join(', ').slice(0, 300)}`, ms: 0, ...(tool.fallback !== undefined ? { value: tool.fallback } : {}) };
  let timer: NodeJS.Timeout | undefined;
  try {
    const value = await Promise.race([
      tool.run(parsed.data, ctx),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), ctx.timeoutMs ?? 15_000);
      }),
    ]);
    return { ok: true, value, ms: Date.now() - started };
  } catch (error) {
    return { ok: false, error: String((error as Error)?.message ?? error).slice(0, 300), ms: Date.now() - started, ...(tool.fallback !== undefined ? { value: tool.fallback } : {}) };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Le hasard du code : déterministe (une graine), pour qu'un même rendu se refasse à l'identique. */
export function seededRandom(seed: string | number): () => number {
  let h = typeof seed === 'number' ? seed >>> 0 : hashString(seed);
  return () => {
    h = (h + 0x6d2b79f5) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
