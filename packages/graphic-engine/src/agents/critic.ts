/**
 * Le CRITIQUE VISUEL (crans High et au-delà) : un modèle de vision REGARDE la page rendue.
 *
 * Une note globale ne veut rien dire (un modèle de vision note trop large) : six critères notés de 1 à 5,
 * et le plus faible compte double. La critique COMPARE des rendus — elle ne déclenche jamais le repli sur
 * un gabarit pour une note moyenne (un gabarit, mieux fini parce que codé, gagnerait toujours) : elle
 * départage des candidats que le moteur a tous su rendre.
 */
import type { AgentCall } from '../host';
import { parseJsonObject } from '../orchestrator/run-task';

export const CRITERIA = ['hierarchy', 'alignment', 'legibility', 'brand', 'balance', 'fit'] as const;
export type Criterion = (typeof CRITERIA)[number];

export interface Critique {
  scores: Record<Criterion, number>;
  /** Moyenne où le critère le plus faible compte double, 1..5. */
  score: number;
  weakest: Criterion;
}

export const CRITIC_INSTRUCTION = `You are a senior graphic designer reviewing ONE page. Rate it 1 (poor) to 5 (excellent) on: hierarchy (one clear entry point, decisive size steps), alignment (a visible grid, consistent margins), legibility (contrast, sizes, nothing cut or crowded), brand (colours and type used with intent, no decoration without a role), balance (white space distributed, no empty half, no cramped corner), fit (the layout serves this content). Answer with JSON only: {"hierarchy":n,"alignment":n,"legibility":n,"brand":n,"balance":n,"fit":n}.`;

export function parseCritique(raw: string): Critique | undefined {
  const o = parseJsonObject(raw);
  if (!o) return undefined;
  const scores = {} as Record<Criterion, number>;
  for (const c of CRITERIA) {
    const v = Number(o[c]);
    if (!Number.isFinite(v) || v < 1 || v > 5) return undefined;
    scores[c] = v;
  }
  const weakest = CRITERIA.reduce((w, c) => (scores[c] < scores[w] ? c : w), CRITERIA[0]);
  const score = (CRITERIA.reduce((s, c) => s + scores[c], 0) + scores[weakest]) / (CRITERIA.length + 1);
  return { scores, score: Math.round(score * 100) / 100, weakest };
}

/** Un `AgentCall` qui passe par le port de vision de l'hôte (l'image voyage en base64 dans `user`). */
export function visionCall(analyze: (base64: string, mime: string, instruction: string, options?: { maxOutputTokens?: number; purpose?: string }) => Promise<string>, png: Buffer): AgentCall {
  return ({ system }) => analyze(png.toString('base64'), 'image/png', system, { maxOutputTokens: 300, purpose: 'visual-analysis' });
}
