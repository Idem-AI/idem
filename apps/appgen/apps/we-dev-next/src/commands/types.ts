import type { Response } from 'express';
import type { Messages, ProjectModel } from '../types/project.js';

/** Ce qu'un déroulé sait de la requête. */
export interface CommandContext {
  messages: Messages;
  /** Le dernier message écrit par l'utilisateur. */
  text: string;
  projectData?: ProjectModel;
  fr: boolean;
  model: string;
  userId: string | null;
  credentials: Record<string, string>;
  creativity?: string;
}

/** Une réponse prête à partir : un flux, ou un refus HTTP. */
export interface Responder {
  pipeDataStreamToResponse(res: Response): Promise<void>;
}

/** Le projet a-t-il le document de sa charte ? */
export function hasCharter(projectData?: ProjectModel): boolean {
  const sections = (projectData?.analysisResultModel?.branding as { sections?: { data?: string }[] } | undefined)?.sections;
  return Array.isArray(sections) && sections.some((section) => !!section?.data);
}

/** Le projet a-t-il sa marque (logo, couleurs, polices) ? */
export function hasBrand(projectData?: ProjectModel): boolean {
  const branding = (projectData?.analysisResultModel?.branding ?? {}) as { logo?: { svg?: string }; colors?: { colors?: { primary?: string } } };
  return !!(branding.logo?.svg || branding.colors?.colors?.primary);
}

/** Un refus de facturation relayé tel quel, avec le statut que l'atelier sait lire (402, 429…). */
export function refusal(body: Record<string, unknown> | undefined): Responder {
  const reason = (body as { error?: string } | undefined)?.error;
  const status = reason === 'authentication_required' ? 401 : reason === 'billing_unavailable' ? 503 : reason === 'quota_exceeded' ? 429 : 402;
  return {
    async pipeDataStreamToResponse(res: Response) {
      res.status(status).json(body ?? {});
    },
  };
}
