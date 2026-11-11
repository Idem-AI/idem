/**
 * Le MODÈLE SIMULÉ des contrôles qui rendent de vraies pages sans appeler de modèle (moteur graphique 2.7, catalogue
 * seul) : le directeur rend un langage et un plan courts, le choix dans le catalogue prend le premier candidat
 * (`{"pick":"A"}`) — le code assemble ensuite la page comme en production. Déterministe.
 */
import { AgentCall, configureGraphicEngine } from '@idem/graphic-engine';

export const fakeAuthorCall: AgentCall = async ({ role, user }) => {
  if (role === 'graphic.director')
    return /PAGES:/.test(user)
      ? `IDEA: Calm editorial grid, figures first.\n${[...user.matchAll(/^(\d+)\. /gm)].map((m) => `PAGE ${m[1]}: title band, then the content in reading order`).join('\n')}`
      : 'LANGUAGE:\n- A brand-primary rule under every title, ink text on the ground, generous margins, logo bottom-left.';
  if (role === 'graphic.explore') return 'TRACK 1: Market stage — the stall is a stage, the trader the hero of each page.\nTRACK 2: One big number — one huge figure per page, the rest whispers.';
  // Le choix dans le catalogue : le premier candidat (plusieurs demandés : les premiers, dans l'ordre).
  const many = user.match(/(\d+) different picks/);
  if (many) return JSON.stringify({ picks: Array.from({ length: Number(many[1]) }, (_, i) => ({ pick: String.fromCharCode(65 + i) })) });
  return '{"pick":"A"}';
};

/** Branche le modèle simulé sur le moteur graphique (à appeler avant toute page). */
export function useFakeGraphicAuthor(): void {
  configureGraphicEngine({
    agentCall: () => fakeAuthorCall,
    // Une page que le catalogue n'a pas pu composer est DITE dans les contrôles (les compositions écartées et pourquoi).
    logger: { info: () => undefined, warn: (message, meta) => (/catalog/.test(message) ? console.warn(`  ! ${message} ${JSON.stringify(meta).slice(0, 1200)}`) : undefined), error: () => undefined },
  });
}
