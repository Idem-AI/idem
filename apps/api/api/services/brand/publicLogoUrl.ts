/**
 * L'adresse fixe du logo d'un projet (servie par `routes/brandLogo.routes.ts`, voir `publicLogo.service.ts`).
 * À part du service pour que la marque d'en-tête (`SiteImport/brandMark.service.ts`) puisse la porter sans
 * import circulaire.
 */
import crypto from 'crypto';
import logger from '../../config/logger';
import { apiBaseUrl } from '../Communication/visualUrl';

const SIGNING_SECRET = (() => {
  const secret = process.env.JWT_SECRET || process.env.API_SIGNING_SECRET;
  if (secret) return secret;
  logger.warn('brand.public_logo.no_secret', {
    event: 'brand.public_logo.no_secret',
    message: "Aucun JWT_SECRET : l'adresse fixe des logos change à chaque redémarrage.",
  });
  return crypto.randomBytes(32).toString('hex');
})();

export const PROJECT_ID = /^[\w.-]{1,128}$/;

export function publicLogoToken(projectId: string): string {
  return crypto.createHmac('sha256', SIGNING_SECRET).update(`brand-logo:${projectId}`).digest('hex').slice(0, 16);
}

export function verifyPublicLogoToken(projectId: string, token: unknown): boolean {
  if (typeof token !== 'string' || !token) return false;
  const given = Buffer.from(token);
  const want = Buffer.from(publicLogoToken(projectId));
  return given.length === want.length && crypto.timingSafeEqual(given, want);
}

/** L'adresse fixe du logo d'un projet : la même pour toute la vie du projet. */
export function publicLogoUrl(projectId: string): string {
  return `${apiBaseUrl().replace(/\/+$/, '')}/brand/${encodeURIComponent(projectId)}/logo?t=${publicLogoToken(projectId)}`;
}

/** Une adresse produite par `publicLogoUrl` (quel que soit l'hôte : local, préproduction, production). */
export const PUBLIC_LOGO_URL = /https?:\/\/[^\s"'`)]+\/brand\/[\w.%-]+\/logo\?t=[0-9a-f]{16}/;
