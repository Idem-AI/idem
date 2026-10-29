/**
 * Où mène chaque destination. Le projet voyage dans l'adresse (`?projectId=`) : le dashboard l'adopte avant
 * le routage (`adoptIncomingProject`), iCode l'ouvre directement. On arrive donc sur la bonne page, avec le
 * bon projet déjà sélectionné, sans rien choisir.
 *
 * `from` dit d'où l'on vient : la page d'arrivée peut s'en servir (message d'accueil) et le suivi le compte.
 */
import type { IdemApp, JourneyDestination } from './model';

/** Les adresses des applications, telles que l'hôte les connaît (variables d'environnement). */
export interface JourneyUrls {
  dashboard: string;
  icode: string;
}

const PATHS: Record<JourneyDestination, { app: keyof JourneyUrls; path: string; query?: Record<string, string> }> = {
  communication: { app: 'dashboard', path: '/project/communication' },
  video: { app: 'dashboard', path: '/project/communication', query: { screen: 'videos' } },
  charter: { app: 'dashboard', path: '/project/branding' },
  'business-plan': { app: 'dashboard', path: '/project/business-plan' },
  'pitch-deck': { app: 'dashboard', path: '/project/pitch-deck' },
  legal: { app: 'dashboard', path: '/project/legal-docs' },
  'publish-site': { app: 'dashboard', path: '/project/ideploy' },
  'publish-app': { app: 'dashboard', path: '/project/ideploy', query: { product: 'app' } },
  domain: { app: 'dashboard', path: '/project/ideploy', query: { tab: 'domain' } },
  site: { app: 'icode', path: '/', query: { product: 'site' } },
  app: { app: 'icode', path: '/', query: { product: 'app' } },
};

/** L'application qui accueille la destination. */
export function destinationApp(destination: JourneyDestination): IdemApp {
  return PATHS[destination].app === 'icode' ? 'icode' : 'dashboard';
}

export function journeyLink(destination: JourneyDestination, options: { urls: JourneyUrls; projectId?: string; from: IdemApp }): string {
  const target = PATHS[destination];
  const base = options.urls[target.app].replace(/\/+$/, '');
  const params = new URLSearchParams();
  if (options.projectId) params.set('projectId', options.projectId);
  for (const [key, value] of Object.entries(target.query ?? {})) params.set(key, value);
  params.set('from', options.from);
  return `${base}${target.path}?${params.toString()}`;
}
