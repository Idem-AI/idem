import { NextFunction, Response } from 'express';

import logger from '../config/logger';
import minioConnection from '../config/minio.config';
import { CustomRequest } from '../interfaces/express.interface';
import {
  brandSyncService,
  IdentityInputError,
  IdentityTypographyInput,
  IdentityUpdateRequest,
} from '../services/brand/brandSync.service';
import { BrandPalette, normalizeHex, PaletteRole, PALETTE_ROLES, readPalette } from '../services/brand/brandTokens';
import { projectService } from '../services/project.service';
import {
  IdentityJobKind,
  identityJobsService,
  IdentityJobsService,
} from '../services/brand/identityJobs.service';
import { ProjectModel } from '../models/project.model';

/**
 * Identité visuelle d'un projet : changer le logo, les couleurs ou les polices
 * et propager le changement à tous les supports, sans IA.
 *
 * Le corps de requête est RELU champ par champ plutôt que transmis tel quel :
 * ce qui est accepté ici finit dans chaque page de chaque document.
 */

const FONT_SHEET_HOSTS = [
  'https://fonts.googleapis.com/',
  'https://api.fontshare.com/',
  'https://cdn.jsdelivr.net/',
];

function readPaletteInput(value: unknown): Partial<BrandPalette> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const palette: Partial<BrandPalette> = {};
  for (const role of PALETTE_ROLES) {
    const raw = (value as Record<string, unknown>)[role];
    if (raw === undefined || raw === null || raw === '') continue;
    const hex = normalizeHex(raw);
    if (!hex) throw new IdentityInputError(`Couleur « ${role} » invalide : attendu un hexadécimal (#RRGGBB).`);
    palette[role] = hex;
  }
  return Object.keys(palette).length ? palette : undefined;
}

function readRoles(value: unknown): PaletteRole[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((role): role is PaletteRole => PALETTE_ROLES.includes(role as PaletteRole));
}

function readFont(value: unknown, userId: string): IdentityTypographyInput['primary'] {
  if (!value || typeof value !== 'object') return undefined;
  const font = value as Record<string, unknown>;
  const family = typeof font.family === 'string' ? font.family.trim() : '';
  if (!family) return undefined;
  if (family.length > 80 || /[<>"';{}]/.test(family)) {
    throw new IdentityInputError('Nom de police invalide.');
  }

  const cssUrl = typeof font.cssUrl === 'string' ? font.cssUrl.trim() : undefined;
  const ownSheet = minioConnection.getPublicUrl(`users/${userId}/`);
  if (cssUrl && !FONT_SHEET_HOSTS.some((host) => cssUrl.startsWith(host)) && !cssUrl.startsWith(ownSheet)) {
    throw new IdentityInputError(`La feuille de la police « ${family} » ne vient pas d’une source reconnue.`);
  }

  const source = ['google', 'fontshare', 'fontsource', 'custom'].includes(font.source as string)
    ? (font.source as 'google' | 'fontshare' | 'fontsource' | 'custom')
    : 'google';

  return {
    family,
    source,
    ...(cssUrl ? { cssUrl } : {}),
    ...(typeof font.category === 'string' ? { category: font.category.slice(0, 40) } : {}),
    ...(Array.isArray(font.weights)
      ? { weights: font.weights.filter((w): w is number => Number.isInteger(w) && w >= 100 && w <= 1000) }
      : {}),
    ...(typeof font.customFontId === 'string' ? { customFontId: font.customFontId.slice(0, 80) } : {}),
  };
}

function readRequest(body: any, userId: string): IdentityUpdateRequest {
  const request: IdentityUpdateRequest = {};

  if (body?.logo && typeof body.logo === 'object') {
    const logo = body.logo;
    request.logo = {
      ...(typeof logo.generatedLogoId === 'string' ? { generatedLogoId: logo.generatedLogoId } : {}),
      ...(typeof logo.svg === 'string' ? { svg: logo.svg } : {}),
      ...(typeof logo.iconSvg === 'string' ? { iconSvg: logo.iconSvg } : {}),
      ...(logo.variations && typeof logo.variations === 'object' ? { variations: logo.variations } : {}),
      ...(typeof logo.name === 'string' ? { name: logo.name } : {}),
      ...(typeof logo.concept === 'string' ? { concept: logo.concept } : {}),
      ...(Array.isArray(logo.colors) ? { colors: logo.colors } : {}),
    };
  }

  const colors = readPaletteInput(body?.colors);
  if (colors) request.colors = colors;
  const keep = readRoles(body?.keepColors);
  if (keep?.length) request.keepColors = keep;
  if (body?.colorsFromLogo === true) request.colorsFromLogo = true;

  if (body?.typography && typeof body.typography === 'object') {
    const primary = readFont(body.typography.primary, userId);
    const secondary = readFont(body.typography.secondary, userId);
    if (primary || secondary) request.typography = { primary, secondary };
  }

  if (body?.adaptLogo === true) request.adaptLogo = true;
  request.dryRun = body?.dryRun === true;
  return request;
}

/**
 * PUT /brandings/:projectId/identity
 *
 * Applique la nouvelle identité et la propage. `dryRun: true` rend le même
 * rapport sans rien écrire — c'est l'aperçu « voici ce qui va changer ».
 */
export const updateIdentityController = async (req: CustomRequest, res: Response): Promise<void> => {
  const userId = req.user?.uid;
  const projectId = req.params.projectId as string;
  if (!userId) {
    res.status(401).json({ message: 'User not authenticated' });
    return;
  }

  try {
    const request = readRequest(req.body, userId);
    const report = await brandSyncService.updateIdentity(userId, projectId, request);
    if (!report) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }
    res.status(200).json(report);
  } catch (error: any) {
    if (error instanceof IdentityInputError) {
      res.status(400).json({ message: error.message });
      return;
    }
    logger.error(`updateIdentityController ${projectId} : ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: 'Error updating brand identity' });
  }
};

/**
 * POST /brandings/:projectId/identity/palette
 *
 * Harmonise une palette sans rien écrire. Pur calcul : l'aperçu du sélecteur
 * de couleurs peut l'appeler à chaque changement.
 */
export const previewPaletteController = async (req: CustomRequest, res: Response): Promise<void> => {
  const userId = req.user?.uid;
  const projectId = req.params.projectId as string;
  if (!userId) {
    res.status(401).json({ message: 'User not authenticated' });
    return;
  }

  try {
    const project = await projectService.getUserProjectById(userId, projectId);
    if (!project) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }
    const changes = readPaletteInput(req.body?.colors) ?? {};
    const keep = readRoles(req.body?.keepColors);
    const current = readPalette(project.analysisResultModel?.branding);
    res.status(200).json(brandSyncService.previewPalette(current, changes, keep));
  } catch (error: any) {
    if (error instanceof IdentityInputError) {
      res.status(400).json({ message: error.message });
      return;
    }
    logger.error(`previewPaletteController ${projectId} : ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: 'Error harmonizing palette' });
  }
};

// ─── Régénérations en tâche de fond ─────────────────────────────────────────

const JOB_KINDS: IdentityJobKind[] = ['logos', 'colors', 'typography'];

function readJobKind(req: CustomRequest): IdentityJobKind | null {
  const kind = req.params.kind as IdentityJobKind;
  return JOB_KINDS.includes(kind) ? kind : null;
}

/**
 * À placer AVANT `requireCredits` : une tâche déjà en cours, ou un projet
 * introuvable, ne doivent rien coûter.
 */
export const guardIdentityJob = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userId = req.user?.uid;
  const projectId = req.params.projectId as string;
  const kind = readJobKind(req);
  if (!userId) {
    res.status(401).json({ message: 'User not authenticated' });
    return;
  }
  if (!kind) {
    res.status(400).json({ message: 'Type de régénération inconnu.' });
    return;
  }
  const project = await projectService.getUserProjectById(userId, projectId);
  if (!project) {
    res.status(404).json({ message: 'Project not found' });
    return;
  }
  const branding = project.analysisResultModel?.branding;
  if (kind === 'logos' && (!branding?.colors?.colors?.primary || !branding?.typography?.primaryFont)) {
    res.status(409).json({ message: 'La palette et les polices doivent exister avant de générer des logos.' });
    return;
  }
  if (identityJobsService.isRunning(userId, projectId, kind)) {
    res.status(409).json({ message: 'Une régénération est déjà en cours.', code: 'job_running' });
    return;
  }
  (req as CustomRequest & { identityProject?: ProjectModel }).identityProject = project;
  next();
};

/**
 * POST /brandings/:projectId/identity/jobs/:kind
 *
 * Démarre la régénération et répond aussitôt (202) : elle continue même si le
 * panneau est fermé ou la page rechargée.
 */
export const startIdentityJobController = async (req: CustomRequest, res: Response): Promise<void> => {
  const userId = req.user!.uid;
  const projectId = req.params.projectId as string;
  const kind = readJobKind(req)!;
  const project = (req as CustomRequest & { identityProject?: ProjectModel }).identityProject!;

  try {
    if (kind !== 'logos') {
      const job = identityJobsService.startProposals(userId, projectId, kind, project, req.billing);
      res.status(202).json(job);
      return;
    }

    const body = req.body ?? {};
    const type = IdentityJobsService.isLogoType(body.preferences?.type) ? body.preferences.type : undefined;
    const customDescription =
      typeof body.preferences?.customDescription === 'string'
        ? body.preferences.customDescription.trim().slice(0, 1200)
        : undefined;

    // « Améliorer » : le logo actuel de la marque, ou un logo que l'utilisateur
    // vient d'importer — déposé dans SON espace par `/logo-import/import`.
    let improveSvg: string | undefined;
    if (body.improve === 'current') {
      improveSvg = project.analysisResultModel?.branding?.logo?.svg;
      if (!improveSvg) throw new IdentityInputError('Ce projet n’a pas encore de logo à améliorer.');
    } else if (typeof body.improve?.svg === 'string') {
      const own = minioConnection.getPublicUrl(`users/${userId}/`);
      if (!body.improve.svg.startsWith(own) || body.improve.svg.includes('..')) {
        throw new IdentityInputError('Le logo à améliorer doit d’abord être importé.');
      }
      improveSvg = body.improve.svg;
    }

    const job = identityJobsService.startLogos(
      userId,
      projectId,
      { preferences: { type, customDescription }, improveSvg },
      req.billing
    );
    res.status(202).json(job);
  } catch (error: any) {
    // Réponse en erreur ⇒ le middleware de crédits contrepasse de lui-même.
    if (error instanceof IdentityInputError) {
      res.status(400).json({ message: error.message });
      return;
    }
    logger.error(`startIdentityJobController ${projectId}/${kind} : ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: 'Impossible de lancer la régénération.' });
  }
};

/** GET /brandings/:projectId/identity/jobs — l'état des régénérations. */
export const identityJobsStatusController = async (req: CustomRequest, res: Response): Promise<void> => {
  const userId = req.user?.uid;
  if (!userId) {
    res.status(401).json({ message: 'User not authenticated' });
    return;
  }
  res.status(200).json(identityJobsService.status(userId, req.params.projectId as string));
};

/** POST /brandings/:projectId/identity/jobs/:kind/cancel — le seul arrêt. */
export const cancelIdentityJobController = async (req: CustomRequest, res: Response): Promise<void> => {
  const userId = req.user?.uid;
  const kind = readJobKind(req);
  if (!userId) {
    res.status(401).json({ message: 'User not authenticated' });
    return;
  }
  if (!kind) {
    res.status(400).json({ message: 'Type de régénération inconnu.' });
    return;
  }
  const cancelled = identityJobsService.cancel(userId, req.params.projectId as string, kind);
  res.status(200).json({ cancelled });
};
