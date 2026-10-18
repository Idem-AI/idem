import { PageFormat } from '@idem/shared-document-editor/angular';
import { environment } from '../../environments/environment';

/**
 * Formats de page de la charte — ceux d'IDEM (`BRANDING_PAGE_FORMATS` du dashboard, `PAGE_FORMATS` de
 * l'API) : l'aperçu d'iVision montre la même page que le PDF.
 */
export const CHARTER_PAGES: Record<string, PageFormat> = {
  SLIDE_16_9: { width: '297mm', height: '167mm' },
  A4_PORTRAIT: { width: '210mm', height: '297mm' },
  A4_LANDSCAPE: { width: '297mm', height: '210mm' },
};

export const charterPage = (format?: string): PageFormat => CHARTER_PAGES[format || ''] ?? CHARTER_PAGES['SLIDE_16_9'];

const dashboard = environment.services.dashboard.url;
const withProject = (path: string, projectId: string) => `${dashboard}${path}?projectId=${encodeURIComponent(projectId)}`;

/** Les pages d'IDEM où continuer : le projet, sa charte (affichage, puis « Modifier » sur place). */
export const idemLinks = {
  project: (projectId: string) => withProject('/project/dashboard', projectId),
  charter: (projectId: string) => withProject('/project/branding/display', projectId),
};
