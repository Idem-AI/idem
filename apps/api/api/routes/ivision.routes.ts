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
import { BUSINESS_CREDIT_COSTS } from '../models/billing.model';
import { CREATIVITY_MULTIPLIER } from '../models/creativity.model';
import { chargeForService } from '../middleware/billing.middleware';
import { creditLedgerService } from '../services/billing/credit-ledger.service';
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

const router = Router();
const communicationService = new CommunicationService(new PromptService());

/** Seuls les livrables qu'iVision produit peuvent être facturés par lui. */
const IVISION_ACTIONS = new Set(['motion_video', 'motion_video_rerender', 'flyer', 'revision']);
/** Plafond d'un débit unique : une vidéo Ultra de 60 s en 4 formats premium reste en dessous. */
const MAX_CHARGE = 5000;

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
    const { projectId, element, role, profile, system, user } = req.body || {};
    if (!(['agents', 'coder', 'critic'] satisfies AgentProfile[] as string[]).includes(profile)) {
      res.status(400).json({ error: 'invalid_profile' });
      return;
    }
    const call = runtimeCall({ userId: userIdOf(req) || undefined, projectId: text(projectId, 128) || undefined, element: text(element, 64) || 'ivision' });
    const out = await asUser(req, 'communication', () => call({ role: text(role, 64) || 'agent', profile, system: text(system, 80_000), user: text(user, 80_000) }));
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

/** Un clip d'un plan de vidéo (CogVideoX-3) : l'URL rendue par Z.ai, qu'iVision télécharge. */
router.post(
  '/ai/video',
  route(async (req, res) => {
    const { prompt, image, size, durationSec, quality, tag } = req.body || {};
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
        durationSec: durationSec === 10 ? 10 : 5,
        quality: quality === 'quality' ? 'quality' : 'speed',
        tag: text(tag, 64) || 'ivision',
      })
    );
    res.json(clip);
  })
);

/** Une ligne de voix off (GLM-TTS, repli Gemini TTS) : l'audio en base64. */
router.post(
  '/ai/speech',
  route(async (req, res) => {
    const { text: line, language, provider, voice, style, tag } = req.body || {};
    if (typeof line !== 'string' || !line.trim()) {
      res.status(400).json({ error: 'text_required' });
      return;
    }
    try {
      const speech = await asUser(req, 'communication', () =>
        idemSynthesizeSpeech({
          text: text(line, 1000),
          language: text(language, 5) || 'fr',
          provider: provider === 'glm' ? 'glm' : 'gemini',
          voice: text(voice, 40),
          style: text(style, 60) || undefined,
          tag: text(tag, 64) || 'ivision',
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
    const { action, cost, note, element, projectId } = req.body || {};
    if (!userId || !IVISION_ACTIONS.has(action) || typeof cost !== 'number' || !(cost >= 0) || cost > MAX_CHARGE) {
      res.status(400).json({ error: 'invalid_charge' });
      return;
    }
    const result = await chargeForService(userId, 'business', { action, cost, note: text(note, 120) || undefined }, { feature: 'ivision', element: text(element, 128) || undefined, projectId: text(projectId, 128) || undefined });
    if (result.status === 'refused') {
      res.status(402).json(result.body);
      return;
    }
    res.json(result.status === 'charged' ? { charged: true, cost: result.cost, balance: result.balance, ledgerEntryId: result.ledgerEntryId } : { charged: false, reason: result.reason, cost: 0 });
  })
);

router.post(
  '/billing/refund',
  route(async (req, res) => {
    const userId = userIdOf(req);
    const { cost, action, note } = req.body || {};
    if (!userId || !IVISION_ACTIONS.has(action) || typeof cost !== 'number' || !(cost > 0) || cost > MAX_CHARGE) {
      res.status(400).json({ error: 'invalid_refund' });
      return;
    }
    await creditLedgerService.refundDebit(userId, 'business', Math.round(cost), { action, feature: 'ivision', note: text(note, 160) || 'Génération iVision en échec — crédits restitués' });
    await entitlementsService.invalidate(userId);
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
    const business = entitlements.engines.business;
    res.json({ credits: business.credits, plan: business.productCode, status: business.status });
  })
);

/** Le barème d'IDEM : iVision applique les mêmes prix, calculés par le même code. */
router.get(
  '/billing/prices',
  route(async (_req, res) => {
    res.json({
      motion_video: BUSINESS_CREDIT_COSTS.motion_video,
      revision: BUSINESS_CREDIT_COSTS.revision,
      flyer: BUSINESS_CREDIT_COSTS.flyer,
      ai_visual: BUSINESS_CREDIT_COSTS.ai_visual,
      creativity: CREATIVITY_MULTIPLIER,
    });
  })
);

// ─── Projets IDEM ───────────────────────────────────────────────────────────

/** Ce qu'une charte IDEM apporte au moteur : couleurs, polices, logos, direction artistique. */
function brandKitOf(branding: BrandKit | null | undefined): BrandKit | null {
  if (!branding) return null;
  return { colors: branding.colors ?? null, typography: branding.typography ?? null, logo: branding.logo ?? null, artDirection: branding.artDirection ?? null };
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

export default router;
