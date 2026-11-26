/**
 * LE SITE D'ORIGINE D'UN PROJET REFAIT — où le retrouver pour le relire (`/rescan`, agents qui lisent la demande).
 */
import type { ProjectModel } from '../../types/project.js';
import { readPlan } from '../plan.js';
import { findSiteUrl } from './intent.js';

/**
 * Le site d'origine du projet ouvert et ce projet : la marque du projet (`branding.siteSource`), sinon le plan de la
 * génération rangé dans les fichiers du site (`.idem/plan.json`) — un site refait n'a pas toujours son projet joint
 * aux tours suivants.
 */
export function rescanSource(projectData?: ProjectModel, siteFiles?: Record<string, string>): { url: string; projectId: string } | null {
  const fromBrand = (projectData?.analysisResultModel?.branding as { siteSource?: { url?: string } } | undefined)?.siteSource?.url;
  const plan = readPlan(siteFiles)?.redesign;
  const url = findSiteUrl(fromBrand || plan?.url || '')?.url;
  const projectId = projectData?.id || plan?.projectId;
  return url && projectId ? { url, projectId } : null;
}

/** L'adresse du site d'origine, s'il y en a une (dite à l'agent qui lit la demande). */
export function siteSourceOf(projectData?: ProjectModel, siteFiles?: Record<string, string>): string | undefined {
  return rescanSource(projectData, siteFiles)?.url;
}

