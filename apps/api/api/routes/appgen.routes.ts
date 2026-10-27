import { Router } from 'express';
import { authenticate } from '../services/auth.service';
import { requireProjectAccess } from '../middleware/billing.middleware';
import { createHandoffController, getHandoffController } from '../controllers/appgen.controller';
import { CustomRequest } from '../interfaces/express.interface';
import logger from '../config/logger';
import { sendQuotaRefusal } from '../middleware/usage-quota.middleware';
import { usageQuotaService } from '../services/billing/usage-quota.service';
import { CommunicationService } from '../services/Communication/communication.service';
import { idemAnalyzeImage } from '../services/ivision/host';
import { PromptService } from '../services/prompt.service';
import { SiteConsent, siteImportJobs } from '../services/SiteImport/siteProject.service';
import { runWithAiUsageContext } from '../utils/ai-usage-context.util';

const router = Router();
const communicationService = new CommunicationService(new PromptService());

/**
 * @swagger
 * /appgen/handoff:
 *   post:
 *     summary: Crée un handoff AppGen vers iDeploy
 *     tags: [AppGen]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [files]
 *             properties:
 *               draftId:
 *                 type: string
 *               appName:
 *                 type: string
 *               description:
 *                 type: string
 *               files:
 *                 type: object
 *               metadata:
 *                 type: object
 *               messages:
 *                 type: array
 *     responses:
 *       201:
 *         description: Handoff créé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 handoffId:
 *                   type: string
 *       400:
 *         description: Données invalides
 *       401:
 *         description: Non authentifié
 *       500:
 *         description: Erreur serveur
 */
// Déployer, c'est posséder : le projet doit avoir été débloqué (Project Pass
// ou abonnement iCode qui l'inclut). Le contrôle est ici et non dans
// l'interface AppGen, qui ne peut rien garantir.
router.post('/handoff', authenticate, requireProjectAccess(), createHandoffController);

/**
 * @swagger
 * /appgen/handoff/{handoffId}:
 *   get:
 *     summary: Récupère un handoff AppGen par son ID
 *     tags: [AppGen]
 *     parameters:
 *       - in: path
 *         name: handoffId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Handoff trouvé
 *       404:
 *         description: Handoff non trouvé ou expiré
 *       500:
 *         description: Erreur serveur
 */
router.get('/handoff/:handoffId', getHandoffController);

/**
 * LA REFONTE D'UN SITE DEMANDÉE DANS iCODE — « refais mon site https://… ».
 *
 * Le serveur d'iCode n'a ni navigateur, ni modèle de vision, ni stockage : il demande ici la lecture du site,
 * au nom de l'utilisateur (sa session relayée). Même moteur que l'import d'iVision (`createProjectFromSite`) :
 * couleurs, polices, logo et déclinaisons, direction artistique, et en plus les textes et les photos du site
 * (`withContent`), recopiées chez nous. Le site est rattaché au projet ouvert dans iCode, sinon un projet IDEM
 * est créé — avec l'accord de l'utilisateur, coché dans iCode, jamais présumé.
 *
 * Gratuit pour l'utilisateur (comme le scan d'iVision), borné par le quota « Aides IA ».
 */
router.post('/site-import', authenticate, async (req: CustomRequest, res) => {
  const userId = req.user?.uid;
  if (!userId) {
    res.status(401).json({ error: 'authentication_required' });
    return;
  }
  const body = (req.body ?? {}) as Record<string, any>;
  const url = typeof body.url === 'string' ? body.url.trim().slice(0, 2000) : '';
  const into = typeof body.projectId === 'string' && /^[\w.-]{1,128}$/.test(body.projectId) ? body.projectId : undefined;
  if (!url) {
    res.status(400).json({ error: 'invalid_input' });
    return;
  }
  const c = body.consent;
  const consent: SiteConsent | undefined =
    c && c.privacy === true && c.terms === true && c.beta === true
      ? { privacyPolicyAccepted: true, termsOfServiceAccepted: true, betaPolicyAccepted: true, ipAddress: req.ip, userAgent: String(req.headers['user-agent'] || '').slice(0, 400) || undefined }
      : undefined;
  // Un projet ne naît pas sans l'accord de son propriétaire.
  if (!into && !consent) {
    res.status(403).json({ error: 'consent_required', message: 'Acceptez d’abord la politique de confidentialité, les conditions d’utilisation et les conditions du programme bêta.' });
    return;
  }
  try {
    const quota = await usageQuotaService.reserve(userId, 'assist');
    if (!quota.allowed) {
      sendQuotaRefusal(res, quota.refusal);
      return;
    }
    const job = await runWithAiUsageContext({ userId, feature: 'branding', operation: 'generate', source: 'appgen POST /appgen/site-import' }, () =>
      siteImportJobs.start(
        userId,
        url,
        {
          text: (system, user, tier) => communicationService.runVideoTieredPrompt(userId, system, user, tier, 'copy'),
          vision: (base64, mimeType, instruction) => idemAnalyzeImage(base64, mimeType, instruction, { maxOutputTokens: 1400, temperature: 0.2, purpose: 'site' }),
        },
        consent,
        { into, withContent: true }
      )
    );
    res.status(202).json({ jobId: job.id, status: job.status, step: job.step });
  } catch (error: any) {
    logger.error('appgen.site_import_failed', { event: 'appgen.site_import_failed', userId, error: error?.message });
    res.status(502).json({ error: 'upstream_failed' });
  }
});

router.get('/site-import/:jobId', authenticate, async (req: CustomRequest, res) => {
  const userId = req.user?.uid;
  if (!userId) {
    res.status(401).json({ error: 'authentication_required' });
    return;
  }
  const job = await siteImportJobs.get(userId, String(req.params.jobId));
  if (!job) {
    res.status(404).json({ error: 'job_not_found' });
    return;
  }
  res.json({ jobId: job.id, status: job.status, step: job.step, ...(job.result ? { result: job.result } : {}), ...(job.error ? { error: job.error } : {}) });
});

export default router;
