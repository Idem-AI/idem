/**
 * UN PROJET IDEM POUR UNE APPLICATION iDEPLOY — `/journey/app-project/*`, appelé par iDeploy web.
 *
 * Une application mise en ligne sur iDeploy sans passer par iCode n'a pas de projet IDEM : rien pour gérer sa
 * communication, sa charte, son business plan. iDeploy le propose ; l'utilisateur accepte les politiques d'IDEM
 * (jamais cochées d'avance) ; l'API lit le site EN LIGNE comme iCode et iVision le font (`createProjectFromSite` :
 * fiche, cible, chiffres affichés, logo, couleurs, polices, direction artistique du catalogue la plus proche) et
 * relie l'application au projet. La boucle IDEM prend ensuite le relais (faire connaître le site, son nom…).
 *
 *   GET  /journey/app-project?appUuid=     l'état : projet relié, sinon de quoi le proposer
 *   POST /journey/app-project              { appUuid, consent?, projectId? } → lecture du site en tâche de fond
 *   GET  /journey/app-project/jobs/:jobId  l'avancement
 *
 * L'adresse lue n'est JAMAIS celle envoyée par le navigateur : c'est celle qu'iDeploy connaît pour une
 * application de l'utilisateur (lecture de la base iDeploy). Gratuit, comme les autres lectures de site, borné
 * par le quota « Aides IA ».
 */
import { Response, Router } from 'express';
import logger from '../config/logger';
import { CustomRequest } from '../interfaces/express.interface';
import { sendQuotaRefusal } from '../middleware/usage-quota.middleware';
import { authenticate } from '../services/auth.service';
import { usageQuotaService } from '../services/billing/usage-quota.service';
import { CommunicationService } from '../services/Communication/communication.service';
import { listApplicationsForEmail } from '../services/ideploy-pg.service';
import { idemAnalyzeImage } from '../services/ivision/host';
import { journeyService } from '../services/journey/journey.service';
import { policyAcceptanceService } from '../services/policyAcceptance.service';
import { projectService } from '../services/project.service';
import { PromptService } from '../services/prompt.service';
import { SiteConsent, siteImportJobs } from '../services/SiteImport/siteProject.service';
import { runWithAiUsageContext } from '../utils/ai-usage-context.util';

export const appProjectRoutes = Router();

const communicationService = new CommunicationService(new PromptService());
const UUID = /^[\w-]{1,64}$/;
const PROJECT_ID = /^[\w.-]{1,128}$/;

interface OwnedApp {
  uuid: string;
  name: string;
  running: boolean;
  /** L'adresse publique (https), si l'application en a une. */
  url: string | null;
}

/** La première adresse de l'application (`fqdn` peut en tenir plusieurs, séparées par des virgules). */
export function publicUrlOf(fqdn: string | null | undefined): string | null {
  const first = String(fqdn ?? '')
    .split(',')[0]
    .trim();
  if (!first) return null;
  const withScheme = /^https?:\/\//i.test(first) ? first : `https://${first}`;
  try {
    const url = new URL(withScheme);
    return /^https?:$/.test(url.protocol) && url.hostname.includes('.') ? url.toString() : null;
  } catch {
    return null;
  }
}

/** L'application, si elle appartient bien à l'utilisateur (équipe iDeploy de son e-mail). */
async function ownedApp(email: string | undefined, appUuid: string): Promise<OwnedApp | null> {
  if (!email || !UUID.test(appUuid)) return null;
  const apps = await listApplicationsForEmail(email);
  const app = apps.find((a) => a.uuid === appUuid);
  if (!app) return null;
  return { uuid: app.uuid, name: app.name, running: String(app.status ?? '').toLowerCase().startsWith('running'), url: publicUrlOf(app.fqdn) };
}

/** Ce que la carte montre d'un projet relié : son nom, son logo, sa couleur, sa direction artistique. */
async function projectCard(userId: string, projectId: string) {
  const project = await projectService.getUserProjectById(userId, projectId).catch(() => null);
  if (!project) return null;
  const branding = (project.analysisResultModel?.branding ?? {}) as Record<string, any>;
  const direction = branding.artDirection as { styleId?: string; styleName?: string; siteMatch?: { level: string; siteStyle: string } } | undefined;
  return {
    id: projectId,
    name: project.name,
    description: project.description,
    logoSvg: typeof branding.logo?.svg === 'string' && branding.logo.svg.length < 200_000 ? branding.logo.svg : null,
    primaryColor: branding.colors?.colors?.primary ?? null,
    fonts: { display: branding.typography?.primaryFont ?? null, body: branding.typography?.secondaryFont ?? null },
    artDirection: direction?.styleId ? { styleId: direction.styleId, styleName: direction.styleName ?? direction.styleId, ...(direction.siteMatch ? { siteMatch: direction.siteMatch } : {}) } : null,
    keyFigures: (project.keyFigures ?? []).slice(0, 4),
    charter: Array.isArray(branding.sections) && branding.sections.some((section: any) => !!section?.data),
  };
}

const handle =
  (fn: (req: CustomRequest, res: Response, userId: string) => Promise<void>) =>
  async (req: CustomRequest, res: Response): Promise<void> => {
    const userId = req.user?.uid;
    if (!userId) {
      res.status(401).json({ error: 'authentication_required' });
      return;
    }
    try {
      await fn(req, res, userId);
    } catch (error: any) {
      logger.error('app_project.route_failed', { event: 'app_project.route_failed', path: req.path, userId, error: error?.message });
      if (!res.headersSent) res.status(502).json({ error: 'upstream_failed' });
    }
  };

appProjectRoutes.get(
  '/',
  authenticate,
  handle(async (req, res, userId) => {
    const appUuid = String(req.query.appUuid ?? '');
    const app = await ownedApp(req.user?.email, appUuid).catch(() => null);
    if (!app) {
      // Base iDeploy injoignable ou application d'un autre : rien à proposer, l'écran reste tel quel.
      res.status(200).json({ app: null, project: null, projects: [] });
      return;
    }
    const linked = await journeyService.projectOfApp(userId, appUuid);
    const project = linked ? await projectCard(userId, linked.projectId) : null;
    // Sans projet relié : les projets de l'utilisateur, pour relier l'application à l'un d'eux plutôt qu'en créer un.
    const projects = project
      ? []
      : (await projectService.getAllUserProjects(userId).catch(() => []))
          .filter((p) => p.id && !p.isArchived && !p.archived)
          .slice(0, 20)
          .map((p) => ({ id: p.id as string, name: p.name }));
    res.status(200).json({ app, project, projects });
  })
);

appProjectRoutes.post(
  '/',
  authenticate,
  handle(async (req, res, userId) => {
    const body = (req.body ?? {}) as Record<string, any>;
    const appUuid = typeof body.appUuid === 'string' ? body.appUuid : '';
    const into = typeof body.projectId === 'string' && PROJECT_ID.test(body.projectId) ? body.projectId : undefined;
    const app = await ownedApp(req.user?.email, appUuid).catch(() => null);
    if (!app) {
      res.status(404).json({ error: 'app_not_found' });
      return;
    }
    if (!app.url) {
      res.status(409).json({ error: 'no_public_url', message: 'Cette application n’a pas encore d’adresse publique.' });
      return;
    }
    if (into && !(await projectService.getUserProjectById(userId, into).catch(() => null))) {
      res.status(404).json({ error: 'project_not_found' });
      return;
    }
    const c = body.consent;
    const consent: SiteConsent | undefined =
      c && c.privacy === true && c.terms === true && c.beta === true
        ? { privacyPolicyAccepted: true, termsOfServiceAccepted: true, betaPolicyAccepted: true, ipAddress: req.ip, userAgent: String(req.headers['user-agent'] || '').slice(0, 400) || undefined }
        : undefined;
    // Un projet ne naît pas sans l'accord de son propriétaire ; un projet existant l'a déjà, ou le reçoit maintenant.
    const accepted = into ? await policyAcceptanceService.isPolicyAccepted(userId, into).catch(() => false) : false;
    if (!consent && !accepted) {
      res.status(403).json({ error: 'consent_required', message: 'Acceptez d’abord la politique de confidentialité, les conditions d’utilisation et les conditions du programme bêta.' });
      return;
    }
    const quota = await usageQuotaService.reserve(userId, 'assist');
    if (!quota.allowed) {
      sendQuotaRefusal(res, quota.refusal);
      return;
    }
    const url = app.url;
    const job = await runWithAiUsageContext({ userId, feature: 'branding', operation: 'generate', source: 'journey POST /journey/app-project' }, () =>
      siteImportJobs.start(
        userId,
        url,
        {
          text: (system, user, tier) => communicationService.runVideoTieredPrompt(userId, system, user, tier, 'copy'),
          vision: (base64, mimeType, instruction) => idemAnalyzeImage(base64, mimeType, instruction, { maxOutputTokens: 1400, temperature: 0.2, purpose: 'site' }),
        },
        consent,
        { into },
        async (result) => {
          await journeyService.linkApp(userId, appUuid, { projectId: result.projectId, product: 'site', url, appName: app.name });
          // La boucle voit la marque lue ET le site en ligne : « Faites connaître votre site » vient tout de suite.
          journeyService.signal(userId, 'brand.imported', result.projectId, 'ideploy');
          journeyService.signal(userId, 'site.published', result.projectId, 'ideploy');
        }
      )
    );
    logger.info('app_project.started', { event: 'app_project.started', userId, appUuid, into: !!into, host: new URL(url).hostname });
    res.status(202).json({ jobId: job.id, status: job.status, step: job.step });
  })
);

appProjectRoutes.get(
  '/jobs/:jobId',
  authenticate,
  handle(async (req, res, userId) => {
    const job = await siteImportJobs.get(userId, String(req.params.jobId));
    if (!job) {
      res.status(404).json({ error: 'job_not_found' });
      return;
    }
    const project = job.status === 'done' && job.result ? await projectCard(userId, job.result.projectId) : null;
    res.json({
      jobId: job.id,
      status: job.status,
      step: job.step,
      ...(job.result ? { result: { projectId: job.result.projectId, reused: job.result.reused, name: job.result.name, warnings: job.result.warnings, artDirection: job.result.artDirection ?? null, keyFigures: job.result.keyFigures ?? [] } } : {}),
      ...(project ? { project } : {}),
      ...(job.error ? { error: job.error } : {}),
    });
  })
);
