import { AccessLevel, ProjectAccess, ProjectSpace, canAccess } from '@idem/shared-models';

/**
 * À quel espace d'un projet appartient une page du tableau de bord.
 *
 *   ProjectSpace  l'espace se règle dans « Équipe » ;
 *   'project'     ouvert à tout membre (accueil du projet) ;
 *   'owner'       réservé au propriétaire (la page Équipe elle-même).
 *
 * Le menu latéral et la garde de route lisent la même table : une entrée
 * masquée est forcément une adresse fermée, et inversement.
 */
export type RouteSpace = ProjectSpace | 'project' | 'owner';

const PREFIXES: Array<[string, RouteSpace]> = [
  ['project/team', 'owner'],
  ['project/dashboard', 'project'],
  ['project/branding', 'branding'],
  ['project/complete-branding', 'branding'],
  ['project/business-cards', 'branding'],
  ['project/business-plan', 'businessPlan'],
  ['project/pitch-deck', 'pitchDeck'],
  ['project/finance', 'finance'],
  ['project/legal-docs', 'legal'],
  ['project/communication', 'communication'],
  ['project/simulations', 'simulation'],
  ['project/advisor', 'advisor'],
  ['project/development', 'website'],
  ['project/diagrams', 'website'],
  ['project/ideploy', 'deployment'],
  ['project/deployments', 'deployment'],
];

/** Pages qui créent ou modifient : il faut l'écriture, pas seulement la lecture. */
const WRITE_PAGES = /(\/edit|\/generate|\/new|complete-branding|select-colors|select-typography|logo-variations)(\/|$)/;

function clean(url: string): string {
  return url.split(/[?#]/)[0].replace(/^\/+/, '').replace(/\/+$/, '');
}

export function routeSpace(url: string): RouteSpace | null {
  const path = clean(url);
  const match = PREFIXES.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`));
  return match ? match[1] : null;
}

export function routeLevel(url: string): AccessLevel {
  return WRITE_PAGES.test(clean(url)) ? 'write' : 'read';
}

/** La page est-elle ouverte à cet accès ? Une page hors projet l'est toujours. */
export function canOpenRoute(access: ProjectAccess | null | undefined, url: string, level = routeLevel(url)): boolean {
  const space = routeSpace(url);
  if (!space) return true;
  if (!access) return false;
  if (access.role === 'owner') return true;
  if (space === 'owner') return false;
  if (space === 'project') return true;
  return canAccess(access, space, level);
}

/** Un membre qui consulte un espace en lecture seule. */
export function isReadOnlyRoute(access: ProjectAccess | null | undefined, url: string): boolean {
  const space = routeSpace(url);
  if (!access || access.role === 'owner' || !space || space === 'owner' || space === 'project') return false;
  return canAccess(access, space, 'read') && !canAccess(access, space, 'write');
}
