import { Response } from 'express';

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
