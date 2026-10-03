import { ProjectModel } from '../types/project.js';

/**
 * Ce que la génération construit. Un projet IDEM peut avoir un site vitrine et
 * une application ; l'application est web ou mobile. Le tableau de bord ouvre
 * iCode avec `?product=site|app` et `?platform=web|mobile`, que le client
 * renvoie à chaque message.
 *
 * - `site`       : site vitrine (Vite + React, une page qui présente l'activité)
 * - `web-app`    : application web (Vite + React, comptes, écrans de travail)
 * - `mobile-app` : application mobile (Vite + React mise en page pour le
 *                  téléphone, installable en PWA, emballée par Capacitor pour
 *                  Android et iOS)
 */
export type BuildTarget = 'site' | 'web-app' | 'mobile-app';

export function resolveBuildTarget(
  product: unknown,
  platform: unknown,
  projectData?: ProjectModel
): BuildTarget {
  const configs = projectData?.analysisResultModel?.development?.configs as
    | { landingPageConfig?: string; appPlatform?: string }
    | undefined;
  const mobile = (platform ?? configs?.appPlatform) === 'mobile';

  if (product === 'site') return 'site';
  if (product === 'app') return mobile ? 'mobile-app' : 'web-app';

  // Sans produit dans l'adresse (liens d'avant les deux produits) : la
  // configuration du projet décide, comme avant.
  if (configs?.landingPageConfig === 'ONLY_LANDING') return 'site';
  return mobile ? 'mobile-app' : 'web-app';
}
