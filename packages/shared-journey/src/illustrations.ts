/**
 * Les dessins des cartes, au trait (`currentColor`), un élément de culture africaine choisi pour ce que la
 * destination VEUT DIRE (AGENTS.md § 4) :
 *
 *   faire connaître (communication, vidéo)   le tambour parleur
 *   mettre en ligne, nom de domaine          la pirogue à la proue dressée
 *   construire (site, application)           le mur de banco à torons
 *   charte                                   le pagne tissé déroulé
 *   business plan, présentation              le baobab
 *   documents juridiques                     le bouclier aux lances croisées
 *
 * Écrits ici, jamais reçus d'ailleurs : ils sont insérés tels quels dans la page.
 */
import type { JourneyDestination } from './model';

const svg = (body: string) =>
  `<svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

/** Tambour parleur : corps en sablier, cordes tendues, baguette courbe. */
const drum = svg(
  '<ellipse cx="26" cy="14" rx="12" ry="4"/><ellipse cx="26" cy="50" rx="12" ry="4"/><path d="M14 14c4 8 4 28 0 36M38 14c-4 8-4 28 0 36"/><path d="M17 16l18 32M35 16L17 48M20 15l12 34M32 15L20 49"/><path d="M44 10c8 2 12 8 12 14"/><path d="M50 30c3 0 5 2 5 4"/><path d="M48 36c4 1 7 4 7 7"/>'
);
/** Pirogue : coque effilée, proue dressée, pagaie, ligne d'eau. */
const pirogue = svg(
  '<path d="M6 38c10 6 34 6 46 0l6-12"/><path d="M6 38l-2-8"/><path d="M14 40c8 3 22 3 32 0"/><path d="M30 14l6 26"/><path d="M33 22l-6 4"/><path d="M4 50c6-3 10 3 16 0s10 3 16 0 10 3 16 0 6 3 8 1"/>'
);
/** Mur de banco : façade à pilastres et torons (pieux qui dépassent). */
const banco = svg(
  '<path d="M8 54V24l8-6 8 6v30M24 54V18l8-8 8 8v36M40 54V24l8-6 8 6v30"/><path d="M4 54h56"/><path d="M12 30h-4M20 34h4M28 26h-4M36 30h4M44 34h-4M52 30h4"/><path d="M30 54v-10h4v10"/>'
);
/** Pagne tissé : bandes et motifs en losanges, rouleau déroulé. */
const cloth = svg(
  '<path d="M10 10h36v40H10z"/><path d="M46 10c6 0 8 4 8 8v32c0-4-2-6-8-6"/><path d="M10 22h36M10 38h36"/><path d="M16 16l4 3 4-3 4 3 4-3 4 3 4-3"/><path d="M18 30l4-4 4 4-4 4zM30 30l4-4 4 4-4 4z"/><path d="M16 44l4 3 4-3 4 3 4-3 4 3 4-3"/>'
);
/** Baobab : tronc large, branches en racines levées vers le ciel. */
const baobab = svg(
  '<path d="M24 56c2-10 2-22 0-30M40 56c-2-10-2-22 0-30"/><path d="M24 26c-4-6-10-8-14-6M24 26c-2-8 0-14 4-16M40 26c4-6 10-8 14-6M40 26c2-8 0-14-4-16M32 26V8"/><path d="M8 16c2-3 5-3 6 0M28 8c2-3 6-3 8 0M50 16c2-3 5-3 6 0"/><path d="M16 56h32"/>'
);
/** Bouclier aux lances croisées. */
const shield = svg(
  '<path d="M32 10c8 4 14 4 18 4 0 18-4 30-18 40C18 44 14 32 14 14c4 0 10 0 18-4z"/><path d="M32 18v28"/><path d="M8 56L56 8M56 56L8 8"/><path d="M52 8h4v4M8 52v4h4"/>'
);

const BY_DESTINATION: Record<JourneyDestination, string> = {
  communication: drum,
  video: drum,
  'publish-site': pirogue,
  'publish-app': pirogue,
  domain: pirogue,
  site: banco,
  app: banco,
  charter: cloth,
  'business-plan': baobab,
  'pitch-deck': baobab,
  legal: shield,
};

export function journeyIllustration(destination: JourneyDestination): string {
  return BY_DESTINATION[destination];
}
