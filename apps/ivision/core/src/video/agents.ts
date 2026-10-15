/**
 * LES APPELS DE MODÈLES DE LA VIDÉO — un seul chemin, borné, mesuré.
 *
 * Les agents du film (directeur, planificateur, auteur, retoucheur) déclarent un RÔLE logique ;
 * l'hôte choisit le modèle (`agentCall` : IDEM `config/creative-roles.ts`, iVision par la passerelle).
 * Un appel en panne, trop long ou vide rend une réponse vide et la raison : l'appelant le DIT
 * (erreur explicite), il ne la remplace jamais par une composition toute faite.
 */
import { coreHost } from '../runtime/host';
import type { AgentCall } from '../creativity/orchestrator';
import { atLeast, CreativityLevel } from '../creativity/levels';
import { CopyWriter, estimateTokens } from './request/facts';

/** Les rôles du film (modèle et plafond de sortie décidés par l'hôte). */
export type FilmRole = 'video.concept' | 'video.planner' | 'video.author' | 'video.reviser';

export interface ModelRun {
  raw: string;
  tokens: { input: number; output: number };
  ms: number;
  /** Pourquoi la réponse est vide (panne, délai, aucun modèle branché). */
  failure?: string;
}

export interface FilmCallContext {
  userId?: string;
  projectId?: string;
  level: CreativityLevel;
  /** Appel imposé (contrôles, réponses simulées) : remplace celui de l'hôte. */
  call?: AgentCall;
}

const TIMEOUTS: Record<FilmRole, number> = {
  'video.concept': 90_000,
  'video.planner': 120_000,
  'video.author': 180_000,
  'video.reviser': 60_000,
};

/** Un appel de modèle pour le film : jamais d'exception, une réponse (éventuellement vide) et sa raison. */
export async function callFilmModel(ctx: FilmCallContext, role: FilmRole, system: string, user: string, validate?: (raw: string) => boolean): Promise<ModelRun> {
  const started = Date.now();
  const call = ctx.call || coreHost().agentCall?.({ userId: ctx.userId, projectId: ctx.projectId, element: 'video' });
  const tokensIn = estimateTokens(system + user);
  if (!call) return { raw: '', tokens: { input: 0, output: 0 }, ms: 0, failure: 'no_model' };
  try {
    const raw = await Promise.race([
      call({ role, profile: role === 'video.author' || role === 'video.concept' ? 'coder' : 'agents', system, user, level: ctx.level, ...(validate ? { validate } : {}) }),
      new Promise<string>((_, reject) => setTimeout(() => reject(new Error('model_timeout')), TIMEOUTS[role])),
    ]);
    const text = String(raw || '');
    return { raw: text, tokens: { input: tokensIn, output: estimateTokens(text) }, ms: Date.now() - started, ...(text.trim() ? {} : { failure: 'empty_answer' }) };
  } catch (error) {
    return { raw: '', tokens: { input: tokensIn, output: 0 }, ms: Date.now() - started, failure: String((error as Error)?.message || error).slice(0, 200) };
  }
}

// ─── Ancien chemin par étage (montage, retouches écrites, lecture de la demande) ─────────────

export type VideoModelTier = 'mechanical' | 'writing' | 'reasoning';

/** L'étage du modèle selon le cran : la rédaction dès Medium, les décisions dès High. */
export function tierFor(level: CreativityLevel, role: 'copy' | 'strategist' | 'agents'): VideoModelTier {
  if (level === 'low') return 'mechanical';
  if (role === 'strategist') return atLeast(level, 'high') ? 'reasoning' : 'writing';
  if (role === 'agents') return atLeast(level, 'high') ? 'writing' : 'mechanical';
  return 'writing';
}

/** Une décision d'agent mesurée (voix, médias). */
export interface AgentRun {
  agent: string;
  source: 'llm' | 'graph';
  tokens: { input: number; output: number };
  ms: number;
  kept?: number;
}

const AGENT_TIMEOUT_MS = 25000;

/** Un appel court par un rédacteur simple (system, user → texte) ; vide en cas de panne. */
export async function callAgent(writer: CopyWriter | undefined, system: string, user: string): Promise<{ raw: string; tokens: { input: number; output: number }; ms: number }> {
  const started = Date.now();
  if (!writer) return { raw: '', tokens: { input: 0, output: 0 }, ms: 0 };
  let raw = '';
  try {
    raw = await Promise.race([writer(system, user), new Promise<string>((_, reject) => setTimeout(() => reject(new Error('agent_timeout')), AGENT_TIMEOUT_MS))]);
  } catch {
    raw = '';
  }
  return { raw: String(raw || ''), tokens: { input: estimateTokens(system + user), output: estimateTokens(raw || '') }, ms: Date.now() - started };
}
