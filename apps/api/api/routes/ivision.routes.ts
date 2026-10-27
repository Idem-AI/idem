/**
 * PASSERELLE INTERNE D'iVISION — `/internal/ivision/*`.
 *
 * iVision (`apps/ivision/api`) exécute le même moteur créatif qu'IDEM (`apps/ivision/core`) ;
 * il n'a pourtant ni fournisseurs de modèles, ni portefeuille, ni projets à lui. Il les
 * emprunte ici, au nom de l'utilisateur dont il a vérifié la session :
 *
 *   ai/*        les modèles d'IDEM, aux mêmes configurations (`AI_CONFIG`), avec le même runtime
 *               d'agents et le même suivi d'usage : une vidéo coûte la même chose aux deux ;
 *   billing/*   le portefeuille business de l'utilisateur, aux mêmes règles que `requireCredits`
 *               (mode d'application, refus 402 avec offres, restitution) ;
 *   projects/*  les chartes des projets IDEM de l'utilisateur, pour les importer dans iVision.
 *
 * Accès : l'en-tête `x-ivision-key` (= `IVISION_SERVICE_KEY`). Clé DÉDIÉE, distincte de
 * `INTERNAL_API_KEY` : elle n'ouvre que ces routes, jamais l'administration.
 */
import { NextFunction, Request, Response, Router } from 'express';
import logger from '../config/logger';
import { CREATIVITY_MULTIPLIER } from '../models/creativity.model';
import { COMMUNICATION_PRICES, DELIVERABLES, EDIT_PRICE_XAF, PASSES } from '../models/offer.model';
import { chargeForService } from '../middleware/billing.middleware';
import { walletService } from '../services/billing/wallet.service';
import { sendQuotaRefusal } from '../middleware/usage-quota.middleware';
import { quotaGroupOf } from '../models/usage-quota.model';
import { usageQuotaService } from '../services/billing/usage-quota.service';
import { entitlementsService } from '../services/billing/entitlements.service';
import { CommunicationService } from '../services/Communication/communication.service';
import { AgentProfile, runtimeCall } from '../services/creativity/orchestrator';
import { idemAnalyzeImage, idemGenerateImage, idemGenerateVideo, idemSynthesizeSpeech } from '../services/ivision/host';
import { PromptService } from '../services/prompt.service';
import { projectService } from '../services/project.service';
import { runWithAiUsageContext } from '../utils/ai-usage-context.util';
import { setTraceUserId } from '../utils/trace.util';
import { safeEqual } from '../utils/safe-equal.util';
import type { BrandKit } from '../../../ivision/core/src/brand/brand-kit';
import { recordConsent, SiteConsent, siteImportJobs } from '../services/SiteImport/siteProject.service';
import { chargeBrandSession } from './branding.routes';
import { generateBrandingStreamingController } from '../controllers/branding.controller';
import { CustomRequest } from '../interfaces/express.interface';
import { isDestination, isJourneyEvent, journeyService } from '../services/journey/journey.service';
import { JOURNEY_RULES } from '../../../../packages/shared-journey/src';

const router = Router();
const communicationService = new CommunicationService(new PromptService());

/**
 * Les actions qu'iVision peut déclarer. La CRÉATION (`motion_video`, `flyer`, `revision`) est
 * gratuite — signée « Créé avec iVision » — et ne prend qu'une place de quota ; l'EXPORT HD sans
 * signature (`export_visual`, `export_video`) et le plan filmé par l'IA (`ai_clip`) se paient
 * depuis le portefeuille, plafonnés au forfait Créateur.
 */
const IVISION_ACTIONS = new Set(['motion_video', 'motion_video_rerender', 'flyer', 'revision', 'export_visual', 'export_video', 'ai_clip']);
/** Actions dont le prix vient de la requête (un export vidéo dépend du périmètre). */
const PRICED_ACTIONS = new Set(['export_video']);
/** Plafond d'un débit unique : une vidéo de 3 min en 4 formats premium reste en dessous. */
const MAX_CHARGE = 15000;

function requireIvisionKey(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.IVISION_SERVICE_KEY;
  const provided = req.headers['x-ivision-key'];
  if (!expected) {
    logger.error('ivision.gateway_unconfigured', { event: 'ivision.gateway_unconfigured' });
    res.status(503).json({ error: 'gateway_unconfigured' });
    return;
  }
  if (typeof provided !== 'string' || !safeEqual(provided, expected)) {
    logger.warn('ivision.gateway_denied', { event: 'ivision.gateway_denied', path: req.path, ip: req.ip });
    res.status(403).json({ error: 'forbidden' });
    return;
  }
  next();
}

const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');
const userIdOf = (req: Request): string => text((req.body as Record<string, unknown> | undefined)?.userId ?? req.query.userId, 128);

/**
 * L'accord donné dans iVision (confidentialité, conditions d'utilisation, programme bêta), avec l'adresse IP
 * et le navigateur de l'utilisateur relayés par iVision : la même trace qu'un projet créé dans IDEM.
 */
function consentOf(req: Request): SiteConsent | undefined {
  const c = (req.body as { consent?: Record<string, unknown> } | undefined)?.consent;
  if (!c || c.privacy !== true || c.terms !== true || c.beta !== true) return undefined;
  return { privacyPolicyAccepted: true, termsOfServiceAccepted: true, betaPolicyAccepted: true, ipAddress: text(c.ipAddress, 64) || undefined, userAgent: text(c.userAgent, 400) || undefined };
}

/** Chaque appel de modèle est rattaché à l'utilisateur d'iVision : quotas et suivi d'usage d'IDEM. */
function asUser<T>(req: Request, feature: string, fn: () => Promise<T>): Promise<T> {
  const userId = userIdOf(req);
  if (userId) setTraceUserId(userId);
  return runWithAiUsageContext({ userId: userId || undefined, feature, operation: 'generate', source: `ivision ${req.method} ${req.path}` }, fn);
}

const route =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response): void => {
    fn(req, res).catch((error: Error) => {
      logger.error('ivision.gateway_failed', { event: 'ivision.gateway_failed', path: req.path, error });
      if (!res.headersSent) res.status(error.message === 'billing_unavailable' ? 503 : 502).json({ error: error.message === 'billing_unavailable' ? 'billing_unavailable' : 'upstream_failed', message: error.message });
    });
  };

router.use(requireIvisionKey);

// ─── Modèles ────────────────────────────────────────────────────────────────

/** Copie et agents de la vidéo, à l'étage choisi par la jauge de créativité. */
router.post(
  '/ai/text',
  route(async (req, res) => {
    const { system, user, tier, kind } = req.body || {};
    const level = tier === 'reasoning' || tier === 'writing' ? tier : 'mechanical';
    const out = await asUser(req, 'communication', () => communicationService.runVideoTieredPrompt(userIdOf(req), text(system, 60_000), text(user, 60_000), level, kind === 'agents' ? 'agents' : 'copy'));
    res.json({ text: out });
  })
);

/** Un agent créatif du runtime d'IDEM (codeur des plans Ultra, critique, directeur…). */
router.post(
  '/ai/agent',
  route(async (req, res) => {
    const { projectId, element, role, profile, system, user, level } = req.body || {};
    if (!(['agents', 'coder', 'critic'] satisfies AgentProfile[] as string[]).includes(profile)) {
      res.status(400).json({ error: 'invalid_profile' });
      return;
    }
    const call = runtimeCall({ userId: userIdOf(req) || undefined, projectId: text(projectId, 128) || undefined, element: text(element, 64) || 'ivision' });
    const out = await asUser(req, 'communication', () => call({ role: text(role, 64) || 'agent', profile, system: text(system, 80_000), user: text(user, 80_000), ...(['low', 'medium', 'high', 'ultra'].includes(level) ? { level } : level === 'max' ? { level: 'high' } : {}) }));
    res.json({ text: out });
  })
);

/** Une composition de visuel (prompt système + charge utile), au modèle de la fonction IDEM. */
router.post(
  '/ai/prompt',
  route(async (req, res) => {
    const { feature, messages } = req.body || {};
    if (feature !== 'flyer' && feature !== 'imageBrief') {
      res.status(400).json({ error: 'invalid_feature' });
      return;
    }
    const list = (Array.isArray(messages) ? messages : []).slice(0, 12).map((m: { role?: string; content?: string }) => ({ role: m.role === 'system' ? 'system' : m.role === 'assistant' ? 'assistant' : 'user', content: text(m.content, 120_000) }));
    const out = await asUser(req, 'communication', () => communicationService.runVisualPrompt(userIdOf(req), feature, list));
    res.json({ text: out });
  })
);

router.post(
  '/ai/vision',
  route(async (req, res) => {
    const { base64, mimeType, instruction, options } = req.body || {};
    if (typeof base64 !== 'string' || !/^image\/(png|jpeg|webp)$/.test(String(mimeType))) {
      res.status(400).json({ error: 'invalid_image' });
      return;
    }
    const purpose = ['visual-analysis', 'shot-critic', 'reference', 'site', 'media-check'].includes(options?.purpose) ? options.purpose : undefined;
    const out = await asUser(req, 'communication', () =>
      idemAnalyzeImage(base64, mimeType, text(instruction, 20_000), {
        ...(typeof options?.maxOutputTokens === 'number' ? { maxOutputTokens: Math.min(4000, options.maxOutputTokens) } : {}),
        ...(typeof options?.temperature === 'number' ? { temperature: options.temperature } : {}),
        ...(purpose ? { purpose } : {}),
      })
    );
    res.json({ text: out });
  })
);

router.post(
  '/ai/image',
  route(async (req, res) => {
    const { prompt, size, tag, purpose, model, fallbackModel } = req.body || {};
    const image = await asUser(req, 'communication', () =>
      idemGenerateImage(text(prompt, 4000), {
        tag: text(tag, 64) || 'ivision',
        ...(typeof size === 'string' ? { size: text(size, 16) } : {}),
        purpose: purpose === 'visual-background' ? 'visual-background' : 'video-still',
        ...(typeof model === 'string' ? { model: text(model, 80) } : {}),
        ...(typeof fallbackModel === 'string' ? { fallbackModel: text(fallbackModel, 80) } : {}),
      })
    );
    res.json({ base64: image.buffer.toString('base64'), mimeType: image.mimeType, model: image.model });
  })
);

/** Un clip d'un plan de vidéo (Veo / Seedance, OpenRouter) : l'URL rendue (`data:`), qu'iVision télécharge. */
router.post(
  '/ai/video',
  route(async (req, res) => {
    const { prompt, image, size, durationSec, quality, tag, model } = req.body || {};
    if (typeof prompt !== 'string' || !prompt.trim()) {
      res.status(400).json({ error: 'prompt_required' });
      return;
    }
    const start = image && typeof image.base64 === 'string' && /^image\/(png|jpeg)$/.test(String(image.mimeType)) ? { base64: image.base64, mimeType: image.mimeType } : undefined;
    const clip = await asUser(req, 'communication', () =>
      idemGenerateVideo({
        prompt: text(prompt, 600),
        image: start,
        size: text(size, 16) || '1280x720',
        // Veo : 4, 6 ou 8 s (les anciennes demandes de 5 ou 10 s sont ramenées au plus proche).
        durationSec: Number(durationSec) <= 4.5 ? 4 : Number(durationSec) <= 6.5 ? 6 : 8,
        quality: quality === 'quality' ? 'quality' : 'speed',
        tag: text(tag, 64) || 'ivision',
        ...(typeof model === 'string' ? { model: text(model, 80) } : {}),
      })
    );
    res.json(clip);
  })
);

/** Une ligne de voix off (Kokoro, ou votre serveur Qwen3-TTS / Chatterbox) : l'audio en base64. */
router.post(
  '/ai/speech',
  route(async (req, res) => {
    const { text: line, language, tag, persona, gender } = req.body || {};
    if (typeof line !== 'string' || !line.trim()) {
      res.status(400).json({ error: 'text_required' });
      return;
    }
    try {
      const speech = await asUser(req, 'communication', () =>
        idemSynthesizeSpeech({
          text: text(line, 1000),
          language: text(language, 5) || 'fr',
          tag: text(tag, 64) || 'ivision',
          ...(typeof persona === 'string' ? { persona: text(persona, 24) } : {}),
          ...(gender === 'female' || gender === 'male' ? { gender } : {}),
        })
      );
      res.json({ base64: speech.buffer.toString('base64'), mimeType: speech.mimeType, provider: speech.provider, model: speech.model, voice: speech.voice });
    } catch (error) {
      // Une langue refusée n'est pas une panne : iVision crée la vidéo sans voix.
      const message = (error as Error).message;
      if (/voice_language_unsupported|voice_unavailable/.test(message)) {
        res.status(422).json({ error: message, message });
        return;
      }
      throw error;
    }
  })
);

// ─── Crédits ────────────────────────────────────────────────────────────────

router.post(
  '/billing/charge',
  route(async (req, res) => {
    const userId = userIdOf(req);
    const { action, cost, note, element, projectId, quantity } = req.body || {};
    if (!userId || !IVISION_ACTIONS.has(action) || typeof cost !== 'number' || !(cost >= 0) || cost > MAX_CHARGE) {
      res.status(400).json({ error: 'invalid_charge' });
      return;
    }
    const result = await chargeForService(
      userId,
      'business',
      {
        action,
        cost,
        note: text(note, 120) || undefined,
        // Le prix d'un export vidéo suit son périmètre (calculé par le même code des deux côtés) ;
        // les autres prix sont ceux de la table d'IDEM, jamais ceux de l'appelant.
        ...(PRICED_ACTIONS.has(action) ? { priceXaf: Math.round(cost) } : {}),
        ...(typeof quantity === 'number' ? { quantity } : {}),
      },
      { feature: 'ivision', element: text(element, 128) || undefined, projectId: text(projectId, 128) || undefined }
    );
    if (result.status === 'refused') {
      res.status(402).json(result.body);
      return;
    }
    if (result.status === 'quota_exceeded') {
      sendQuotaRefusal(res, result.body);
      return;
    }
    // `quotaReserved` : iVision le rend avec `/billing/refund` si la génération échoue.
    const quotaReserved = Boolean(result.reservation);
    res.json(
      result.status === 'charged'
        ? { charged: true, cost: result.cost, balance: result.balance, ledgerEntryId: result.ledgerEntryId, quotaReserved }
        : { charged: false, reason: result.reason, cost: 0, quotaReserved }
    );
  })
);

router.post(
  '/billing/refund',
  route(async (req, res) => {
    const userId = userIdOf(req);
    const { cost, action, note, releaseQuota } = req.body || {};
    if (!userId || !IVISION_ACTIONS.has(action) || typeof cost !== 'number' || !(cost >= 0) || cost > MAX_CHARGE) {
      res.status(400).json({ error: 'invalid_refund' });
      return;
    }
    // La place prise dans le quota par `/billing/charge` est rendue avec l'échec.
    if (releaseQuota === true) await usageQuotaService.releaseCurrent(userId, quotaGroupOf('business', action));
    if (cost > 0) {
      await walletService.refund(userId, Math.round(cost), { action, feature: 'ivision', note: text(note, 160) || 'Export iVision en échec — montant restitué' });
      await entitlementsService.invalidate(userId);
    }
    res.json({ ok: true });
  })
);

router.get(
  '/billing/balance',
  route(async (req, res) => {
    const userId = userIdOf(req);
    if (!userId) {
      res.status(400).json({ error: 'user_required' });
      return;
    }
    const entitlements = await entitlementsService.resolve(userId);
    const offer = entitlements.offer;
    // `credits` reste lu par les anciens écrans : c'est désormais le solde en francs.
    res.json({ credits: offer.walletXaf, walletXaf: offer.walletXaf, createur: offer.createur, plan: offer.createur ? 'createur' : null, status: 'active' });
  })
);

/**
 * Les prix d'IDEM, en francs : iVision chiffre l'export d'une vidéo par le même code
 * (`motion_video` = vidéo de référence, `revision` = nouvel export minimal).
 */
router.get(
  '/billing/prices',
  route(async (_req, res) => {
    res.json({
      motion_video: COMMUNICATION_PRICES.motion_video,
      revision: COMMUNICATION_PRICES.motion_video_rerender,
      flyer: COMMUNICATION_PRICES.flyer,
      ai_visual: COMMUNICATION_PRICES.ai_visual,
      export_visual: COMMUNICATION_PRICES.flyer,
      export_video: COMMUNICATION_PRICES.motion_video,
      ai_clip: COMMUNICATION_PRICES.ai_clip,
      edit: EDIT_PRICE_XAF,
      // La charte complète (livrable « Logo + charte graphique ») : esquisse gratuite, version finale à ce prix.
      charter: DELIVERABLES.logo_brand.priceXaf,
      createur: { monthlyXaf: PASSES.createur.monthlyXaf, annualXaf: PASSES.createur.annualXaf },
      currency: 'XAF',
      creativity: CREATIVITY_MULTIPLIER,
    });
  })
);

// ─── Projets IDEM ───────────────────────────────────────────────────────────

/** Ce qu'une charte IDEM apporte au moteur : couleurs, polices, logos, direction artistique. */
function brandKitOf(branding: BrandKit | null | undefined): BrandKit | null {
  if (!branding) return null;
  return { colors: branding.colors ?? null, typography: branding.typography ?? null, logo: branding.logo ?? null, artDirection: branding.artDirection ?? null, patterns: branding.patterns ?? null };
}

router.get(
  '/projects',
  route(async (req, res) => {
    const userId = userIdOf(req);
    if (!userId) {
      res.status(400).json({ error: 'user_required' });
      return;
    }
    const projects = await projectService.getAllUserProjects(userId);
    res.json({
      projects: projects.map((p) => {
        const palette: Partial<Record<string, string>> | undefined = (p.analysisResultModel?.branding as BrandKit | undefined)?.colors?.colors ?? undefined;
        return { id: p.id, name: p.name, hasBrand: !!(palette && Object.keys(palette).length), primary: palette?.primary, updatedAt: p.updatedAt };
      }),
    });
  })
);

router.get(
  '/projects/:projectId/brand',
  route(async (req, res) => {
    const userId = userIdOf(req);
    const project = userId ? await projectService.getUserProjectById(userId, String(req.params.projectId)) : null;
    if (!project) {
      res.status(404).json({ error: 'project_not_found' });
      return;
    }
    const analysis = project.analysisResultModel;
    const context: Record<string, unknown> = { ...(analysis?.communication?.context || {}) };
    res.json({
      name: (context.brandName as string) || project.name,
      branding: brandKitOf(analysis?.branding),
      voice: {
        brandName: (context.brandName as string) || project.name,
        businessType: (context.businessType as string) || project.type,
        tone: context.tone,
        valueProposition: (context.valueProposition as string) || project.description || undefined,
        keywords: context.keywords,
        language: (context.language as string) || 'fr',
      },
      // Les photos des visuels déjà faits : payées, à la charte, réutilisables.
      photos: (analysis?.communication?.visuals || []).map((v) => v.backgroundImageUrl).filter((u): u is string => !!u).slice(0, 24),
    });
  })
);

/**
 * Un PROJET IDEM depuis le site de l'utilisateur (lien collé dans iVision) : projet, logo et déclinaisons,
 * palettes, typographie (fichiers du site recopiés s'ils ne sont dans aucun catalogue public), direction
 * artistique, motifs. Lancé en tâche de fond ; iVision suit l'avancement.
 */
router.post(
  '/projects/from-site',
  route(async (req, res) => {
    const userId = userIdOf(req);
    const url = text(req.body?.url, 2000);
    if (!userId || !url) {
      res.status(400).json({ error: 'invalid_input' });
      return;
    }
    // Gratuit pour l'utilisateur, pas pour la plateforme : borné par le quota « Aides IA ».
    const quota = await usageQuotaService.reserve(userId, 'assist');
    if (!quota.allowed) {
      sendQuotaRefusal(res, quota.refusal);
      return;
    }
    const job = await asUser(req, 'branding', () =>
      siteImportJobs.start(
        userId,
        url,
        {
          text: (system, user, tier) => communicationService.runVideoTieredPrompt(userId, system, user, tier, 'copy'),
          vision: (base64, mimeType, instruction) => idemAnalyzeImage(base64, mimeType, instruction, { maxOutputTokens: 1400, temperature: 0.2, purpose: 'site' }),
        },
        consentOf(req)
      )
    );
    res.status(202).json({ jobId: job.id, status: job.status, step: job.step });
  })
);

router.get(
  '/projects/from-site/:jobId',
  route(async (req, res) => {
    const job = await siteImportJobs.get(userIdOf(req), String(req.params.jobId));
    if (!job) {
      res.status(404).json({ error: 'job_not_found' });
      return;
    }
    res.json({ jobId: job.id, status: job.status, step: job.step, ...(job.result ? { result: job.result } : {}), ...(job.error ? { error: job.error } : {}) });
  })
);

// ─── Charte graphique d'un projet ───────────────────────────────────────────

/**
 * L'utilisateur d'iVision devient celui de la requête, pour un projet qui est bien à lui : les contrôles
 * d'IDEM (`requireCredits`, propriété du livrable, quotas) s'appliquent ensuite tels quels.
 */
function asProjectOwner(req: Request, res: Response, next: NextFunction): void {
  const userId = userIdOf(req);
  const projectId = String(req.params.projectId || '');
  if (!userId || !projectId) {
    res.status(400).json({ error: 'invalid_input' });
    return;
  }
  projectService
    .getUserProjectById(userId, projectId)
    .then((project) => {
      if (!project) {
        res.status(404).json({ error: 'project_not_found' });
        return;
      }
      // Comme dans IDEM : pas de génération sur un projet dont les politiques n'ont pas été acceptées.
      if (!project.policyAcceptance) {
        res.status(403).json({ error: 'consent_required', message: 'Acceptez d’abord la politique de confidentialité, les conditions d’utilisation et les conditions du programme bêta.' });
        return;
      }
      (req as CustomRequest).user = { uid: userId };
      setTraceUserId(userId);
      runWithAiUsageContext({ userId, projectId, feature: 'branding', operation: 'generate', source: `ivision ${req.method} ${req.path}` }, () => next());
    })
    .catch((error: Error) => {
      logger.error('ivision.gateway_failed', { event: 'ivision.gateway_failed', path: req.path, error });
      if (!res.headersSent) res.status(502).json({ error: 'upstream_failed' });
    });
}

/**
 * La CHARTE GRAPHIQUE d'un projet, générée depuis iVision : la même porte que le dashboard
 * (`/project/brandings/generate/:projectId`) — même débit (`chargeBrandSession` : esquisse tant que le
 * livrable n'est pas débloqué), même générateur, même flux d'étapes (SSE). iVision suit le flux et
 * affiche la charte sans quitter le studio.
 */
router.post('/projects/:projectId/branding/generate', asProjectOwner, chargeBrandSession, generateBrandingStreamingController);

/** L'accord des politiques pour un projet déjà créé (depuis iVision, avant que l'accord y soit demandé). */
router.post(
  '/projects/:projectId/consent',
  route(async (req, res) => {
    const userId = userIdOf(req);
    const projectId = String(req.params.projectId);
    const project = userId ? await projectService.getUserProjectById(userId, projectId) : null;
    if (!project) {
      res.status(404).json({ error: 'project_not_found' });
      return;
    }
    const consent = consentOf(req);
    if (!consent) {
      res.status(400).json({ error: 'consent_required' });
      return;
    }
    res.json({ accepted: await recordConsent(userId, projectId, consent) });
  })
);

/** Les pages de la charte d'un projet (HTML des sections), pour l'aperçu dans iVision. */
router.get(
  '/projects/:projectId/branding',
  route(async (req, res) => {
    const userId = userIdOf(req);
    const project = userId ? await projectService.getUserProjectById(userId, String(req.params.projectId)) : null;
    if (!project) {
      res.status(404).json({ error: 'project_not_found' });
      return;
    }
    const branding = project.analysisResultModel?.branding as (BrandKit & { sections?: { id?: string; name: string; type?: string; data?: unknown }[]; pdfFormat?: string; typography?: { primaryFont?: string; secondaryFont?: string; url?: string } }) | undefined;
    const sections = (branding?.sections || []).filter((s) => typeof s.data === 'string' && (s.data as string).trim()).map((s) => ({ id: s.id || s.name, name: s.name, type: s.type || '', html: s.data as string }));
    res.json({
      name: project.name,
      // Sans accord des politiques, les générations d'IDEM refusent ce projet : iVision le demande d'abord.
      policiesAccepted: !!project.policyAcceptance,
      pdfFormat: branding?.pdfFormat || 'SLIDE_16_9',
      fonts: { primaryFont: branding?.typography?.primaryFont, secondaryFont: branding?.typography?.secondaryFont, fontUrl: branding?.typography?.url },
      sections,
    });
  })
);

// ─── La boucle IDEM ─────────────────────────────────────────────────────────

/**
 * Ce qu'iVision voit faire (une vidéo, un visuel, une marque lue sur un site) rejoint la boucle d'IDEM, et
 * iVision reçoit l'étape suivante à proposer (créer le site, la charte…). Le projet doit être à l'utilisateur.
 */
async function journeyProject(userId: string, value: unknown): Promise<string | undefined> {
  const projectId = text(value, 128);
  if (!projectId || !/^[\w.-]+$/.test(projectId)) return undefined;
  return (await projectService.getUserProjectById(userId, projectId).catch(() => null)) ? projectId : undefined;
}

router.post(
  '/journey/events',
  route(async (req, res) => {
    const userId = userIdOf(req);
    const { type, place } = req.body || {};
    if (!userId || !isJourneyEvent(type)) {
      res.status(400).json({ error: 'invalid_input' });
      return;
    }
    const projectId = await journeyProject(userId, req.body?.projectId);
    const recommendations = await journeyService.record(userId, { type, app: 'ivision', projectId, place: isDestination(place) ? place : undefined });
    res.json({ recommendations });
  })
);

router.get(
  '/journey/next',
  route(async (req, res) => {
    const userId = userIdOf(req);
    if (!userId) {
      res.status(400).json({ error: 'invalid_input' });
      return;
    }
    const projectId = await journeyProject(userId, req.query.projectId);
    res.json({ recommendations: projectId ? await journeyService.next(userId, { app: 'ivision', projectId, place: isDestination(req.query.place) ? req.query.place : undefined }) : [] });
  })
);

const RULE_IDS = new Set(JOURNEY_RULES.map((rule) => rule.id));

router.post(
  '/journey/feedback',
  route(async (req, res) => {
    const userId = userIdOf(req);
    const { id, action } = req.body || {};
    if (!userId || typeof id !== 'string' || !RULE_IDS.has(id) || !['shown', 'clicked', 'dismissed'].includes(action)) {
      res.status(400).json({ error: 'invalid_input' });
      return;
    }
    await journeyService.feedback(userId, id, action);
    res.status(204).end();
  })
);

export default router;
