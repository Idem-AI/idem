/**
 * L'ADRESSE FIXE DU LOGO D'UN PROJET — celle que les sites générés affichent.
 *
 *   GET /brand/<projectId>/logo?t=<jeton>
 *
 * Un site iCode publié ne garde plus une COPIE du logo (fichier déposé, data URI, fichier horodaté du stockage) :
 * il pointe vers cette adresse, qui ne change jamais et sert toujours la marque d'en-tête ACTUELLE du projet
 * (`branding.logo.header`, cf. `SiteImport/brandMark.service.ts`). Changer le logo dans la charte change donc le
 * logo du site en ligne, sans le reconstruire ni le redéployer.
 *
 * Le jeton est un HMAC du projet (même secret que les visuels, `JWT_SECRET`) : sans lui, les logos de tous les
 * projets seraient énumérables, y compris ceux qui n'ont pas de site.
 */
import crypto from 'crypto';
import type { ProjectModel } from '../../models/project.model';
import { RepositoryFactory } from '../../repository/RepositoryFactory';
import { ensureBrandMark } from '../SiteImport/brandMark.service';
import { storageService } from '../storage.service';

export { PROJECT_ID, publicLogoUrl, verifyPublicLogoToken, PUBLIC_LOGO_URL } from './publicLogoUrl';

export interface PublicLogo {
  body: Buffer;
  contentType: string;
  etag: string;
}

const repository = () => RepositoryFactory.getRepository<ProjectModel>();

/**
 * Le logo à servir : la marque d'en-tête actuelle (recalculée si le logo a changé depuis), lue dans le stockage.
 * `null` si le projet n'existe plus ou n'a pas de logo lisible — le site affiche alors son texte de repli.
 */
export async function readPublicLogo(projectId: string): Promise<PublicLogo | null> {
  const project = await repository().findOne({ _id: projectId }, 'projects');
  if (!project?.userId || (project as { isArchived?: boolean }).isArchived) return null;

  const mark = await ensureBrandMark(project.userId, projectId, project);
  if (!mark?.src) return null;

  const objectPath = storageService.objectPathOf(mark.src);
  // La marque d'en-tête est toujours écrite par l'API dans son stockage ; une adresse d'ailleurs (recadrage
  // impossible) n'est pas relayée : l'API ne sert pas de proxy vers un hôte quelconque.
  if (!objectPath) return null;
  const body = await storageService.readObjectBuffer(objectPath, 4 * 1024 * 1024);
  if (!body) return null;

  const head = body.subarray(0, 512).toString('utf8').trimStart();
  const svg = head.startsWith('<svg') || head.startsWith('<?xml') || /\.svg$/i.test(objectPath);
  const etag = `"${crypto.createHash('sha1').update(body).digest('hex').slice(0, 20)}"`;
  return { body, contentType: svg ? 'image/svg+xml' : 'image/png', etag };
}
