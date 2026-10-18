/**
 * LA CHARTE GRAPHIQUE, vue d'iVision.
 *
 * Une marque née d'un site (ou importée d'IDEM) a un PROJET IDEM. Sa charte complète — logo et
 * déclinaisons, couleurs, polices, règles d'usage, en pages — se génère dans IDEM, par la même porte et
 * aux mêmes règles que le dashboard (passerelle `/internal/ivision/projects/:id/branding/generate`) :
 * iVision suit le flux et AFFICHE la charte dans le studio. La retoucher reste le travail d'IDEM
 * (l'interface ouvre sa page de charte).
 *
 * L'avancement d'une génération est gardé en mémoire (étape, pages faites) et son état sur la marque :
 * après un redémarrage, une charte dont les pages existent est prête, sinon la génération est à relancer.
 */
import { collection } from '../config/db';
import logger from '../config/logger';
import { HttpError } from '../middleware/error';
import type { IvisionBrand } from '../models';
import { getBrand } from './brands.service';
import { CharterPages, idem, IdemGatewayError } from './idem.client';

const brands = () => collection<IvisionBrand>('brands');
const now = () => new Date().toISOString();

/** Au-delà, une génération sans nouvelles est considérée comme interrompue (redémarrage, coupure). */
const STALE_MS = 30 * 60_000;

interface CharterJob {
  status: 'running' | 'ready' | 'failed';
  /** Pages terminées pendant cette génération. */
  done: number;
  step?: string;
  error?: string;
  at: number;
}

const jobs = new Map<string, CharterJob>();

export interface CharterView {
  brandId: string;
  projectId?: string;
  status: 'none' | 'running' | 'ready' | 'failed';
  done: number;
  step?: string;
  error?: string;
  /** Les pages (avec `pages=true`, une fois prête). */
  pages?: CharterPages['sections'];
  pdfFormat?: string;
  fonts?: CharterPages['fonts'];
}

async function setState(userId: string, brandId: string, charter: IvisionBrand['charter']): Promise<void> {
  await brands().updateOne({ _id: brandId, userId }, { $set: { charter } });
}

/**
 * Lance la génération. Résout dès qu'IDEM l'a ACCEPTÉE (contrôles et débit passés) ; un refus (402
 * portefeuille, 429 quota) est relayé tel quel, avant tout travail.
 */
export async function startCharter(userId: string, brandId: string, creativity = 'medium'): Promise<CharterView> {
  const brand = await getBrand(userId, brandId);
  if (!brand.idemProjectId) throw new HttpError(400, 'charter_needs_site', 'Ajoutez d’abord le lien de votre site : la charte se crée à partir de votre marque.');
  const current = jobs.get(brandId);
  if (current?.status === 'running' && Date.now() - current.at < STALE_MS) return view(brand, current);

  const job: CharterJob = { status: 'running', done: 0, at: Date.now() };
  let accepted: Awaited<ReturnType<typeof idem.projects.generateCharter>>;
  try {
    accepted = await idem.projects.generateCharter(userId, brand.idemProjectId, creativity, (event) => {
      job.at = Date.now();
      if (event.stepName) job.step = event.stepName;
      if (event.type === 'completed') job.done += 1;
    });
  } catch (error) {
    if (error instanceof IdemGatewayError && (error.status === 402 || error.status === 429)) throw error;
    if (error instanceof IdemGatewayError && error.status === 404) throw new HttpError(404, 'project_not_found', 'Le projet IDEM de cette marque est introuvable.');
    logger.error('charter.start_failed', { event: 'charter.start_failed', brandId, error });
    throw new HttpError(503, 'charter_unavailable', 'La charte ne peut pas être créée pour le moment. Réessayez dans un instant.');
  }
  jobs.set(brandId, job);
  await setState(userId, brandId, { status: 'running', updatedAt: now() });
  logger.info('charter.started', { event: 'charter.started', brandId, projectId: brand.idemProjectId });

  accepted.done
    .then(async () => {
      job.status = 'ready';
      job.at = Date.now();
      await setState(userId, brandId, { status: 'ready', updatedAt: now() });
      logger.info('charter.ready', { event: 'charter.ready', brandId, pages: job.done });
    })
    .catch(async (error: Error) => {
      job.status = 'failed';
      job.error = 'generation_failed';
      job.at = Date.now();
      await setState(userId, brandId, { status: 'failed', updatedAt: now(), error: 'generation_failed' }).catch(() => undefined);
      logger.error('charter.failed', { event: 'charter.failed', brandId, error: error?.message, alert: 'critical' });
    });
  return view(brand, job);
}

/** L'état de la charte d'une marque, et ses pages quand on les demande. */
export async function charterState(userId: string, brandId: string, withPages: boolean): Promise<CharterView> {
  const brand = await getBrand(userId, brandId);
  let job = jobs.get(brandId);
  if (job && job.status === 'running' && Date.now() - job.at > STALE_MS) job = undefined;
  if (job?.status === 'running') return view(brand, job);
  if (!brand.idemProjectId) return { brandId, status: 'none', done: 0 };
  // Prête, échouée, ou générée ailleurs (dans IDEM) : les pages font foi.
  const pages = await idem.projects.branding(userId, brand.idemProjectId).catch((error) => {
    logger.warn('charter.pages_unavailable', { event: 'charter.pages_unavailable', brandId, error });
    return null;
  });
  const has = !!pages?.sections.length;
  const status: CharterView['status'] = has ? 'ready' : job?.status === 'failed' || brand.charter?.status === 'failed' ? 'failed' : 'none';
  return {
    ...view(brand, job),
    status,
    ...(withPages && has ? { pages: pages!.sections, pdfFormat: pages!.pdfFormat, fonts: pages!.fonts } : {}),
  };
}

function view(brand: IvisionBrand, job: CharterJob | undefined): CharterView {
  return {
    brandId: brand._id,
    ...(brand.idemProjectId ? { projectId: brand.idemProjectId } : {}),
    status: job?.status ?? (brand.charter?.status === 'running' ? 'none' : brand.charter?.status ?? 'none'),
    done: job?.done ?? 0,
    ...(job?.step ? { step: job.step } : {}),
    ...(job?.error ? { error: job.error } : {}),
  };
}
