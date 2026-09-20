import crypto from 'crypto';
import logger from '../../config/logger';
import { ProjectModel } from '../../models/project.model';
import {
  CommunicationContext,
  CommunicationModel,
  CommunicationPlan,
  CommunicationStrategy,
  ContentChannel,
  ContentIdea,
  EditorialCalendar,
  Flyer,
  FlyerFormat,
  MomentIdea,
  MomentSuggestion,
  PlanBrief,
  PlanStatus,
  Publication,
  PublicationStatus,
  SocialNetwork,
  StrategyBlock,
  StudioConversation,
  TrendSignal,
  VisualIntent,
  VisualOrigin,
} from '../../models/communication.model';
import {
  addDays,
  daysBetween,
  migrateLegacyCommunication,
  weekOfPeriod,
} from './communication.migration';
import { signedVisualImageUrl } from './visualUrl';
import { toContentChannel, toContentChannels } from './channels';
import { getSocialConnector } from '../Connectors/social-providers.config';
import { AssistedShare } from '../Connectors/social-connector.interface';
import { cacheService } from '../cache.service';

import { GenericService } from '../common/generic.service';
import { AIChatMessage, PromptConfig, PromptService } from '../prompt.service';
import { AI_CONFIG, FeatureAIConfig } from '../../config/ai.config';
import { AGENT_COMMUNICATION_STRATEGY_PROMPT } from './prompts/agent-communication-strategy.prompt';
import { AGENT_CONTEXT_EXTRACTION_PROMPT } from './prompts/agent-context-extraction.prompt';
import { AGENT_EDITORIAL_CALENDAR_PROMPT } from './prompts/agent-editorial-calendar.prompt';
import { AGENT_FLYER_GENERATION_PROMPT } from './prompts/agent-flyer-generation.prompt';
import { AGENT_IMAGE_BRIEF_PROMPT } from './prompts/agent-image-brief.prompt';
import { AGENT_TRENDS_SUMMARY_PROMPT } from './prompts/agent-trends-summary.prompt';
import { AGENT_MOMENT_SUGGESTIONS_PROMPT } from './prompts/agent-moment-suggestions.prompt';
import { AGENT_MOMENT_CONTENT_PROMPT } from './prompts/agent-moment-content.prompt';
import { AGENT_OCCASIONS_PROMPT } from './prompts/agent-occasions.prompt';
import { AGENT_PLAN_BRIEF_PROMPT } from './prompts/agent-plan-brief.prompt';
import { AGENT_PLAN_CONTENT_PROMPT } from './prompts/agent-plan-content.prompt';
import { buildFlyerEditPrompt } from './prompts/agent-flyer-edit.prompt';
import {
  imageSourcingService,
  ImageBrief,
  ImageSourcingPreferences,
  SourcedImage,
} from './imageSourcing.service';
import {
  flyerRenderService,
  minLogoWidthFor,
  defaultGridFor,
  LogoDeclensionSet,
  FORMAT_DIMENSIONS,
} from './flyerRender.service';
import { summarizeLogoForPrompt } from '../../utils/logo-context.util';
import { brandFontsHref } from '../../utils/google-fonts.util';
import {
  buildArtDirectionBlock,
  buildImageNegativePrompt,
  buildImageStyleModifier,
} from '../../utils/art-direction.util';
import { ANTI_SLOP_BLOCK } from '../design/antiSlop.prompt';
import { DesignSeed, buildDesignSeed, describeSeed } from '../design/designSeed';
import {
  buildCompositionGrid,
  CompositionGrid,
  describeCompositionGrid,
  describeGridInvariants,
  describeImageNeed,
} from '../design/compositionGrid';
import { VisualAuditReport } from '../design/visualAudit';
import { ensureProjectArtDirection } from '../design/artDirection.provider';
import { enforceDesignRules } from '../design/slopLint.service';
import { sanitizeSectionHtml } from '../../utils/sanitize-section-html';
import { markRevisionAsAI } from '../../utils/revision-context.util';
import { withAiUsage } from '../../utils/ai-usage-context.util';
import { SupportedLanguage } from '../../utils/request-language';

export type CommunicationStreamEvent =
  | { type: 'step-start'; step: string }
  | { type: 'step-complete'; step: string; payload: any }
  | { type: 'complete'; payload: CommunicationModel }
  | { type: 'error'; message: string };

/**
 * Traduit une entrée de `ai.config.ts` en `PromptConfig` complet.
 *
 * Les appels du module ne transmettaient jusqu'ici que `provider` + `modelName`
 * de `communication.default`, en y greffant à la main les seuls `llmOptions`.
 * Deux réglages décidés en config étaient donc perdus en chemin :
 *  - le MODÈLE propre à la feature (la composition d'un visuel tournait sur le
 *    modèle par défaut du module, pas sur celui qu'on croyait avoir choisi) ;
 *  - les `fallbackModels` : un 503 « high demand » de Gemini faisait échouer la
 *    génération sans seconde chance, alors que la chaîne de repli existait.
 *
 * Passer par cette fabrique rend l'oubli impossible : la config est la source
 * unique, l'appelant ne décrit plus que ce qui lui est spécifique.
 */
const promptConfigFor = (
  feature: FeatureAIConfig,
  userId: string,
  extra: Partial<PromptConfig> = {}
): PromptConfig => ({
  provider: feature.provider,
  modelName: feature.modelName,
  fallbackModels: feature.fallbackModels,
  promptType: feature.promptType,
  // Copie défensive : `runPrompt` traverse restrictionsService, qui écrête le
  // budget — sur l'objet partagé, l'écrêtage contaminerait tous les appels
  // suivants du process.
  llmOptions: { ...feature.llmOptions },
  userId,
  ...extra,
});

/**
 * CommunicationService — modular, token-efficient pipeline:
 *   1. extractContext()     cached, tiny JSON
 *   2. getTrendSignals()    cached, 3–5 short signals
 *   3. generateStrategy()   uses (context + trends)
 *   4. generateCalendar()   uses (context + strategy summary)
 *   5. generateFlyer()      ON-DEMAND for a single ContentIdea
 *
 * Intermediate outputs are cached in Redis so the UI can re-render quickly
 * and we never pay for a step twice.
 */
export class CommunicationService extends GenericService {
  private readonly collection = (userId: string) => `users/${userId}/projects`;

  constructor(promptService: PromptService) {
    super(promptService);
    logger.info('CommunicationService initialized.');
  }

  // --------------------------------------------------------------------------
  // Public read / write helpers
  // --------------------------------------------------------------------------

  /**
   * Le paquet complet de communication, lu et MIGRÉ.
   *
   * La migration est appliquée à la lecture plutôt que par un script de bascule :
   * un projet dormant depuis six mois se met à jour tout seul à sa réouverture,
   * et aucune fenêtre de maintenance n'est nécessaire. Elle est idempotente et
   * n'écrit qu'une fois (cf. `communication.migration.ts`).
   */
  async getCommunication(userId: string, projectId: string): Promise<CommunicationModel | null> {
    const project = await this.projectRepository.findById(projectId, this.collection(userId));
    if (!project) return null;
    const raw = (project.analysisResultModel as any)?.communication as CommunicationModel | null;
    if (!raw) return null;

    const { model, changed } = migrateLegacyCommunication(raw);
    if (changed) {
      // La conversion est persistée dès la première lecture : sinon chaque
      // requête la refait, et deux écritures concurrentes partiraient de deux
      // conversions distinctes.
      await this.patchCommunication(userId, projectId, () => model);
    }
    return model;
  }

  /**
   * Le paquet ALLÉGÉ, sans le HTML des visuels.
   *
   * Un visuel porte une page Tailwind complète (5 à 15 ko) ; trente visuels
   * faisaient donc 300 à 450 ko transportés à chaque ouverture du module, pour un
   * écran qui n'affiche que des PNG. Le HTML ne sert qu'à l'éditeur et au rendu,
   * qui le demandent par `getVisual` / `getFlyerImage`.
   */
  async getCommunicationLight(
    userId: string,
    projectId: string
  ): Promise<CommunicationModel | null> {
    const model = await this.getCommunication(userId, projectId);
    if (!model) return null;
    return {
      ...model,
      visuals: (model.visuals || []).map((visual) => ({
        ...this.withSignedUrl(projectId, visual),
        html: '',
      })),
      // Les publications portent une copie de l'URL du visuel : la resigner ici
      // évite qu'une publication ancienne pointe vers une URL désormais refusée.
      publications: (model.publications || []).map((publication) =>
        publication.flyerId
          ? { ...publication, imageUrl: signedVisualImageUrl(projectId, publication.flyerId) }
          : publication
      ),
      // Les champs V1 ne sont plus servis au front : il lit `plans` et `visuals`.
      calendar: undefined,
      moments: undefined,
      flyers: undefined,
      trends: undefined,
      momentSuggestions: undefined,
    };
  }

  /**
   * Écrit la conversation de l'atelier.
   *
   * Exposé pour `StudioService` plutôt que de lui donner accès à
   * `patchCommunication` : l'atelier n'a aucune raison de pouvoir toucher aux
   * périodes ou aux visuels autrement que par les méthodes dédiées.
   */
  async patchStudio(
    userId: string,
    projectId: string,
    studio: StudioConversation
  ): Promise<void> {
    await this.patchCommunication(userId, projectId, (existing) => ({ ...existing, studio }));
  }

  /**
   * Un appel de modèle sur la configuration de l'atelier.
   *
   * L'atelier n'instancie pas son propre `PromptService` : il passe par celui du
   * module, donc par la même chaîne de repli et les mêmes quotas.
   */
  async runStudioPrompt(userId: string, messages: AIChatMessage[]): Promise<string> {
    return this.promptService.runPrompt(
      promptConfigFor(AI_CONFIG.communication.moment, userId),
      messages
    );
  }

  async updateStrategy(
    userId: string,
    projectId: string,
    strategy: CommunicationStrategy
  ): Promise<CommunicationModel | null> {
    return this.patchCommunication(userId, projectId, (existing) => ({
      ...existing,
      strategy: {
        ...strategy,
        updatedAt: new Date(),
      },
    }));
  }

  /**
   * @deprecated Conservé pour l'ancienne route `calendar/:contentId`. Le contenu
   * est cherché dans TOUTES les périodes : la route ne connaît pas l'id de la
   * période, mais le contenu, lui, sait à laquelle il appartient.
   */
  async updateCalendarItem(
    userId: string,
    projectId: string,
    contentId: string,
    updates: Partial<ContentIdea>
  ): Promise<CommunicationModel | null> {
    const located = await this.findContentById(userId, projectId, contentId);
    if (located?.planId) {
      await this.updatePlanItem(userId, projectId, located.planId, contentId, updates);
      return this.getCommunication(userId, projectId);
    }
    logger.warn('[Communication] updateCalendarItem: content not found in any plan', {
      projectId,
      contentId,
    });
    return this.getCommunication(userId, projectId);
  }

  // --------------------------------------------------------------------------
  // 1. Context extraction
  // --------------------------------------------------------------------------

  async extractContext(
    userId: string,
    projectId: string,
    opts: { force?: boolean } = {}
  ): Promise<CommunicationContext> {
    logger.info(`[Communication] Extracting context`, { userId, projectId, force: opts.force });
    const project = await this.getProject(projectId, userId);
    if (!project) {
      logger.error(`[Communication] Project not found during context extraction`, { projectId });
      throw new Error(`Project not found: ${projectId}`);
    }

    const contentHash = this.hashProjectForContext(project);
    const cacheKey = cacheService.generateAIKey(
      'communication-context',
      userId,
      projectId,
      contentHash
    );

    if (!opts.force) {
      const cached = await cacheService.get<CommunicationContext>(cacheKey, {
        prefix: 'ai',
        ttl: 7200,
      });
      if (cached) {
        logger.info(`[Communication] Context cache hit`, { projectId });
        return cached;
      }
    }
    logger.info(`[Communication] Context cache miss, running LLM extraction`, { projectId });

    // Compact input — explicitly avoid sending the full business plan.
    const projectSummary = this.buildProjectSummary(project);

    const messages: AIChatMessage[] = [
      {
        role: 'system',
        content: AGENT_CONTEXT_EXTRACTION_PROMPT,
      },
      {
        role: 'user',
        content: projectSummary,
      },
    ];

    const start = Date.now();
    const raw = await this.promptService.runPrompt(
      promptConfigFor(AI_CONFIG.communication.context, userId),
      messages
    );
    logger.info(`[Communication] Context extraction LLM complete`, {
      projectId,
      durationMs: Date.now() - start,
    });
    const parsed = this.safeJson<Partial<CommunicationContext>>(raw) ?? {};

    const branding = project.analysisResultModel?.branding;
    const colors = branding?.colors?.colors ?? {
      primary: '#144706',
      secondary: '#000066',
      accent: '#f59e0b',
      background: '#ffffff',
      text: '#0f172a',
    };
    const typography = branding?.typography;

    // Build a valid <img src> for the logo: prefer a hosted URL, and when we
    // fall back to inline SVG markup, wrap it into a data-URI so the flyer step
    // always receives a usable src rather than raw markup.
    const logoSrc = (url?: string, svgFallback?: string): string | undefined => {
      const hosted = (url || '').trim();
      if (hosted) return hosted;
      const svg = (svgFallback || '').trim();
      if (!svg) return undefined;
      if (
        svg.startsWith('http://') ||
        svg.startsWith('https://') ||
        svg.startsWith('data:')
      ) {
        return svg;
      }
      if (svg.includes('<svg')) {
        return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
      }
      return svg;
    };

    const context: CommunicationContext = {
      brandName: parsed.brandName || project.name,
      businessType: parsed.businessType || project.type || 'business',
      valueProposition: parsed.valueProposition || project.longDescription || project.description || '',
      targetAudience: parsed.targetAudience || project.targets || '',
      objectives: Array.isArray(parsed.objectives) ? parsed.objectives! : [],
      tone: parsed.tone || 'clear, confident, helpful',
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords! : [],
      // Ramenés vers l'énumération : le modèle répond « Instagram », « LinkedIn »
      // ou « Réseaux sociaux » en texte libre, et ces valeurs traversaient tout
      // le module — d'où une clé de traduction introuvable affichée telle quelle
      // et la même icône pour tous les réseaux.
      channels: toContentChannels(parsed.channels).length
        ? toContentChannels(parsed.channels)
        : ['linkedin', 'instagram'],
      language: parsed.language || 'en',
      branding: {
        primary: (colors as any).primary || '#0ea5e9',
        secondary: (colors as any).secondary || '#1e293b',
        accent: (colors as any).accent,
        background: (colors as any).background,
        text: (colors as any).text,
        primaryFont: typography?.primaryFont,
        secondaryFont: typography?.secondaryFont,
        fontUrl: typography?.url,
        logoSvg: branding?.logo?.svg,
        // Prefer the hosted PNG URLs (assetUrls); fall back to the inline SVG
        // variations for legacy projects created before PNG assets existed.
        // logoSrc() guarantees the flyer step always receives a usable <img src>
        // (URL or data-URI), never raw SVG markup.
        logoUrls: branding?.logo
          ? {
              primary:
                logoSrc(branding.logo.assetUrls?.primary, branding.logo.svg) || branding.logo.svg,
              withText:
                branding.logo.assetUrls?.withText || branding.logo.variations?.withText
                  ? {
                      light: logoSrc(
                        branding.logo.assetUrls?.withText?.lightBackground,
                        branding.logo.variations?.withText?.lightBackground
                      ),
                      dark: logoSrc(
                        branding.logo.assetUrls?.withText?.darkBackground,
                        branding.logo.variations?.withText?.darkBackground
                      ),
                      mono: logoSrc(
                        branding.logo.assetUrls?.withText?.monochrome,
                        branding.logo.variations?.withText?.monochrome
                      ),
                    }
                  : undefined,
              iconOnly:
                branding.logo.assetUrls?.iconOnly || branding.logo.variations?.iconOnly
                  ? {
                      light: logoSrc(
                        branding.logo.assetUrls?.iconOnly?.lightBackground,
                        branding.logo.variations?.iconOnly?.lightBackground
                      ),
                      dark: logoSrc(
                        branding.logo.assetUrls?.iconOnly?.darkBackground,
                        branding.logo.variations?.iconOnly?.darkBackground
                      ),
                      mono: logoSrc(
                        branding.logo.assetUrls?.iconOnly?.monochrome,
                        branding.logo.variations?.iconOnly?.monochrome
                      ),
                    }
                  : undefined,
            }
          : undefined,
      },
      // Recopiée dans le contexte pour que la composition d'un visuel n'ait pas
      // à recharger le projet — et pour que le hash de contexte change quand la
      // direction artistique change, ce qui invalide les visuels devenus
      // incohérents avec la marque.
      // Provisionnée si la charte n'a pas encore été générée : le module est
      // utilisable seul, et un visuel sans parti pris est exactement le défaut
      // qu'on corrige.
      artDirection: await ensureProjectArtDirection(this.promptService, userId, projectId, project),
      extractedAt: new Date(),
    };

    await cacheService.set(cacheKey, context, { prefix: 'ai', ttl: 7200 });

    // Persist on the project so the UI has it offline.
    await this.patchCommunication(userId, projectId, (existing) => ({
      ...existing,
      context,
    }));

    return context;
  }

  // --------------------------------------------------------------------------
  // 2. Trend signals (cached first — periodic jobs / APIs go here later)
  // --------------------------------------------------------------------------

  async getTrendSignals(
    userId: string,
    projectId: string,
    context: CommunicationContext
  ): Promise<TrendSignal[]> {
    logger.info(`[Communication] Getting trend signals`, { userId, projectId });
    const bucket = this.trendBucketKey(context);
    const cached = await cacheService.get<TrendSignal[]>(bucket, {
      prefix: 'trends',
      ttl: 60 * 60 * 24, // 24h
    });
    if (cached && cached.length > 0) {
      logger.info(`[Communication] Trends cache hit`, { bucket });
      return cached;
    }
    logger.info(`[Communication] Trends cache miss, running LLM summary`, { bucket });

    const messages: AIChatMessage[] = [
      { role: 'system', content: AGENT_TRENDS_SUMMARY_PROMPT },
      {
        role: 'user',
        content: JSON.stringify({
          businessType: context.businessType,
          keywords: context.keywords,
          channels: context.channels,
        }),
      },
    ];

    const raw = await this.promptService.runPrompt(
      promptConfigFor(AI_CONFIG.communication.trends, userId),
      messages
    );
    const parsed = this.safeJson<{ signals: Partial<TrendSignal>[] }>(raw);
    const signals: TrendSignal[] = (parsed?.signals || [])
      .filter((s) => s && s.label)
      .slice(0, 5)
      .map((s, idx) => ({
        id: s.id || `trend-${idx + 1}`,
        label: s.label!,
        description: s.description,
        relevance: typeof s.relevance === 'number' ? s.relevance : 0.5,
        source: s.source,
        capturedAt: new Date(),
      }));

    await cacheService.set(bucket, signals, { prefix: 'trends', ttl: 60 * 60 * 24 });
    return signals;
  }

  // --------------------------------------------------------------------------
  // 3. Strategy
  // --------------------------------------------------------------------------

  async generateStrategy(
    userId: string,
    projectId: string,
    opts: { force?: boolean; streamCallback?: (e: CommunicationStreamEvent) => Promise<void> } = {}
  ): Promise<CommunicationStrategy> {
    logger.info(`[Communication] Generating strategy`, { userId, projectId, force: opts.force });
    const stream = opts.streamCallback;
    await stream?.({ type: 'step-start', step: 'context' });
    const context = await this.extractContext(userId, projectId);
    await stream?.({ type: 'step-complete', step: 'context', payload: context });

    await stream?.({ type: 'step-start', step: 'trends' });
    const trends = await this.getTrendSignals(userId, projectId, context);
    await stream?.({ type: 'step-complete', step: 'trends', payload: trends });

    const cacheKey = cacheService.generateAIKey(
      'communication-strategy',
      userId,
      projectId,
      this.shortHash({ context, trendIds: trends.map((t) => t.id) })
    );
    if (!opts.force) {
      const cached = await cacheService.get<CommunicationStrategy>(cacheKey, {
        prefix: 'ai',
        ttl: 7200,
      });
      if (cached) {
        await stream?.({ type: 'step-complete', step: 'strategy', payload: cached });
        return cached;
      }
    }

    await stream?.({ type: 'step-start', step: 'strategy' });
    const messages: AIChatMessage[] = [
      { role: 'system', content: AGENT_COMMUNICATION_STRATEGY_PROMPT },
      {
        role: 'user',
        content:
          'CONTEXT:\n' +
          JSON.stringify(context) +
          '\n\nTRENDS:\n' +
          JSON.stringify(trends.map((t) => ({ label: t.label, description: t.description }))),
      },
    ];
    const raw = await this.promptService.runPrompt(
      promptConfigFor(AI_CONFIG.communication.strategy, userId),
      messages
    );
    const parsed = this.safeJson<{ summary: string; blocks: StrategyBlock[] }>(raw);

    const strategy: CommunicationStrategy = {
      summary: parsed?.summary || '',
      blocks: Array.isArray(parsed?.blocks)
        ? parsed!.blocks.map((b, idx) => ({
            id: b.id || `block-${idx + 1}`,
            kind: (b.kind as StrategyBlock['kind']) || 'custom',
            title: b.title || 'Block',
            body: b.body || '',
          }))
        : [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await cacheService.set(cacheKey, strategy, { prefix: 'ai', ttl: 7200 });
    await this.patchCommunication(userId, projectId, (existing) => ({
      ...existing,
      strategy,
      trends,
    }));
    await stream?.({ type: 'step-complete', step: 'strategy', payload: strategy });
    return strategy;
  }

  // --------------------------------------------------------------------------
  // 4. Calendrier éditorial — DÉPRÉCIÉ, délégué aux périodes
  // --------------------------------------------------------------------------

  /**
   * @deprecated Conservé pour l'ancienne route `generate-calendar`. Il DÉLÈGUE
   * désormais aux périodes et renvoie une vue `EditorialCalendar` du plan créé.
   *
   * Écrire encore `communication.calendar` serait un piège : la migration ne se
   * rejoue pas (le schéma est marqué à jour), donc ce calendrier resterait
   * invisible pour toujours à côté des périodes. Un seul chemin de données.
   */
  async generateCalendar(
    userId: string,
    projectId: string,
    opts: {
      force?: boolean;
      rhythm?: 'weekly' | 'biweekly' | 'monthly';
      horizonWeeks?: number;
      streamCallback?: (e: CommunicationStreamEvent) => Promise<void>;
    } = {}
  ): Promise<EditorialCalendar> {
    const horizonWeeks = Math.min(12, Math.max(1, opts.horizonWeeks || 4));
    const rhythm = opts.rhythm || 'weekly';
    const postsPerWeek = rhythm === 'monthly' ? 1 : rhythm === 'biweekly' ? 2 : 3;
    const start = new Date().toISOString().slice(0, 10);
    const end = addDays(start, horizonWeeks * 7 - 1);

    logger.info('[Communication] generateCalendar delegating to a plan', {
      projectId,
      start,
      end,
      postsPerWeek,
    });

    // Réutiliser le plan créé par un appel précédent de cette même route, plutôt
    // que d'en empiler un par clic sur « Régénérer ».
    const existingPlans = await this.listPlans(userId, projectId);
    const legacyPlan = existingPlans.find((plan) => plan.id.startsWith('plan-legacy-route-'));

    const plan =
      legacyPlan && !opts.force
        ? legacyPlan
        : legacyPlan
          ? ((await this.updatePlan(userId, projectId, legacyPlan.id, { start, end, postsPerWeek })) ??
            legacyPlan)
          : await this.createLegacyRoutePlan(userId, projectId, start, end, postsPerWeek);

    const generated = await this.generatePlan(userId, projectId, plan.id, {
      streamCallback: opts.streamCallback,
    });

    const calendar: EditorialCalendar = {
      rhythm,
      horizonWeeks,
      items: generated.items,
      createdAt: generated.createdAt,
      updatedAt: generated.updatedAt,
    };
    await opts.streamCallback?.({ type: 'step-complete', step: 'calendar', payload: calendar });
    return calendar;
  }

  /** Période créée par l'ancienne route, reconnaissable à son id. */
  private async createLegacyRoutePlan(
    userId: string,
    projectId: string,
    start: string,
    end: string,
    postsPerWeek: number
  ): Promise<CommunicationPlan> {
    const plan = await this.createPlan(userId, projectId, {
      name: this.defaultPlanName(start, end),
      start,
      end,
      postsPerWeek,
    });
    const renamed: CommunicationPlan = { ...plan, id: `plan-legacy-route-${plan.id}` };
    await this.patchCommunication(userId, projectId, (existing) => ({
      ...existing,
      plans: (existing.plans || []).map((item) => (item.id === plan.id ? renamed : item)),
    }));
    return renamed;
  }

  // --------------------------------------------------------------------------
  // 4bis. PÉRIODES — le cœur de la V2
  //
  // Une période porte des DATES RÉELLES et s'ajoute aux autres. Deux
  // conséquences directes sur le code :
  //  - le prompt de contenus reçoit `[start, end]`, plus « aujourd'hui + N
  //    semaines » : planifier décembre en novembre devient possible ;
  //  - régénérer une période ne touche que la sienne, donc plus aucun visuel
  //    ne perd son contenu propriétaire.
  // --------------------------------------------------------------------------

  async listPlans(userId: string, projectId: string): Promise<CommunicationPlan[]> {
    const model = await this.getCommunication(userId, projectId);
    return this.sortPlans(model?.plans || []);
  }

  async getPlan(
    userId: string,
    projectId: string,
    planId: string
  ): Promise<CommunicationPlan | null> {
    const model = await this.getCommunication(userId, projectId);
    return model?.plans?.find((plan) => plan.id === planId) ?? null;
  }

  /**
   * Crée une période VIDE. Aucun appel IA, aucun crédit : l'utilisateur décrit
   * sa fenêtre, voit les occasions qui y tombent, puis décide de générer.
   *
   * Séparer la création de la génération évite de facturer un plan dont les dates
   * étaient fausses — le cas le plus courant du premier essai.
   */
  async createPlan(
    userId: string,
    projectId: string,
    input: {
      name: string;
      objective?: string;
      start: string;
      end: string;
      kind?: CommunicationPlan['kind'];
      postsPerWeek?: number;
      channels?: ContentChannel[];
    }
  ): Promise<CommunicationPlan> {
    const period = this.normalisePeriod(input.start, input.end);
    // Le contexte n'est lu QUE si l'appelant n'a pas choisi ses canaux : créer une
    // période doit être instantané et gratuit, et `extractContext` est un appel de
    // modèle quand son cache est froid.
    const channels = input.channels?.length
      ? this.normaliseChannels(input.channels, undefined)
      : this.normaliseChannels(undefined, await this.extractContext(userId, projectId));

    const plan: CommunicationPlan = {
      id: `plan-${Date.now().toString(36)}-${crypto.randomInt(1e6).toString(36)}`,
      name: (input.name || '').trim() || this.defaultPlanName(period.start, period.end),
      objective: (input.objective || '').trim(),
      period,
      kind: input.kind === 'campaign' ? 'campaign' : 'regular',
      postsPerWeek: Math.min(7, Math.max(1, Math.round(input.postsPerWeek || 3))),
      channels,
      items: [],
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.patchCommunication(userId, projectId, (existing) => ({
      ...existing,
      plans: [...(existing.plans || []), plan],
    }));
    logger.info('[Communication] Plan created', { projectId, planId: plan.id, period });
    return plan;
  }

  /**
   * Génère le brief PUIS les contenus d'une période, en deux appels.
   *
   * Deux appels et non un : le brief décide de l'angle et des thèmes, les
   * contenus l'exécutent. Tout demander d'un coup produisait des contenus qui
   * ne servaient aucun thème — le modèle inventait l'angle en écrivant la
   * première idée, puis l'oubliait.
   */
  async generatePlan(
    userId: string,
    projectId: string,
    planId: string,
    opts: { streamCallback?: (e: CommunicationStreamEvent) => Promise<void> } = {}
  ): Promise<CommunicationPlan> {
    const stream = opts.streamCallback;
    const existingPlan = await this.getPlan(userId, projectId, planId);
    if (!existingPlan) throw new Error(`Plan not found: ${planId}`);

    await stream?.({ type: 'step-start', step: 'context' });
    const context = await this.extractContext(userId, projectId);
    await stream?.({ type: 'step-complete', step: 'context', payload: context });

    // ── Occasions de la fenêtre : elles ancrent le plan dans le calendrier réel
    await stream?.({ type: 'step-start', step: 'occasions' });
    const occasions = await this.getOccasions(
      userId,
      projectId,
      existingPlan.period.start,
      existingPlan.period.end
    );
    await stream?.({ type: 'step-complete', step: 'occasions', payload: occasions });

    // ── Le brief de la période, dérivé de la boussole
    await stream?.({ type: 'step-start', step: 'brief' });
    const brief = await this.generatePlanBrief(userId, projectId, existingPlan, context, occasions);
    await stream?.({ type: 'step-complete', step: 'brief', payload: brief });

    // ── Les contenus datés, qui exécutent le brief
    await stream?.({ type: 'step-start', step: 'content' });
    const items = await this.generatePlanContent(userId, existingPlan, context, brief);
    await stream?.({ type: 'step-complete', step: 'content', payload: items });

    const generated: CommunicationPlan = {
      ...existingPlan,
      brief,
      // Les contenus déjà porteurs d'un visuel SURVIVENT à une régénération :
      // l'utilisateur les a payés, et c'est exactement ce que la V1 perdait.
      items: [...existingPlan.items.filter((item) => (item.flyerIds?.length ?? 0) > 0), ...items],
      status: existingPlan.status === 'draft' ? 'active' : existingPlan.status,
      generatedAt: new Date(),
      updatedAt: new Date(),
    };

    await this.patchCommunication(userId, projectId, (existing) => ({
      ...existing,
      plans: (existing.plans || []).map((plan) => (plan.id === planId ? generated : plan)),
    }));

    logger.info('[Communication] Plan generated', {
      projectId,
      planId,
      items: generated.items.length,
    });
    return generated;
  }

  async updatePlan(
    userId: string,
    projectId: string,
    planId: string,
    patch: {
      name?: string;
      objective?: string;
      start?: string;
      end?: string;
      postsPerWeek?: number;
      channels?: ContentChannel[];
      status?: PlanStatus;
      brief?: PlanBrief;
    }
  ): Promise<CommunicationPlan | null> {
    let updated: CommunicationPlan | null = null;
    await this.patchCommunication(userId, projectId, (existing) => {
      const plans = (existing.plans || []).map((plan) => {
        if (plan.id !== planId) return plan;
        const period =
          patch.start || patch.end
            ? this.normalisePeriod(patch.start || plan.period.start, patch.end || plan.period.end)
            : plan.period;
        updated = {
          ...plan,
          name: patch.name?.trim() || plan.name,
          objective: patch.objective !== undefined ? patch.objective : plan.objective,
          period,
          postsPerWeek:
            patch.postsPerWeek !== undefined
              ? Math.min(7, Math.max(1, Math.round(patch.postsPerWeek)))
              : plan.postsPerWeek,
          channels: patch.channels?.length ? patch.channels : plan.channels,
          status: patch.status || plan.status,
          brief: patch.brief || plan.brief,
          // Les rangs de semaine suivent la nouvelle borne de départ : sans ce
          // recalcul, décaler une période désordonnait tout son affichage.
          items: plan.items.map((item) => ({
            ...item,
            week: weekOfPeriod(period.start, (item.scheduledFor || period.start).slice(0, 10)),
          })),
          updatedAt: new Date(),
        };
        return updated;
      });
      return { ...existing, plans };
    });
    return updated;
  }

  /**
   * Archive une période. Jamais de suppression dure : les visuels déjà produits
   * y sont rattachés, et c'est précisément en effaçant un calendrier que la V1
   * les rendait inatteignables.
   */
  async archivePlan(userId: string, projectId: string, planId: string): Promise<boolean> {
    const updated = await this.updatePlan(userId, projectId, planId, { status: 'archived' });
    return !!updated;
  }

  async updatePlanItem(
    userId: string,
    projectId: string,
    planId: string,
    itemId: string,
    updates: Partial<ContentIdea>
  ): Promise<CommunicationPlan | null> {
    let updated: CommunicationPlan | null = null;
    await this.patchCommunication(userId, projectId, (existing) => {
      const plans = (existing.plans || []).map((plan) => {
        if (plan.id !== planId) return plan;
        const items = plan.items.map((item) => {
          if (item.id !== itemId) return item;
          const scheduledFor = updates.scheduledFor
            ? this.clampToPeriod(updates.scheduledFor, plan.period)
            : item.scheduledFor;
          return {
            ...item,
            ...updates,
            id: item.id,
            planId: plan.id,
            scheduledFor,
            week: weekOfPeriod(plan.period.start, scheduledFor),
          };
        });
        updated = { ...plan, items, updatedAt: new Date() };
        return updated;
      });
      return { ...existing, plans };
    });
    return updated;
  }

  /** Ajoute un contenu à la main dans une période (sans IA). */
  async addPlanItem(
    userId: string,
    projectId: string,
    planId: string,
    input: Partial<ContentIdea> & { title: string }
  ): Promise<ContentIdea | null> {
    const plan = await this.getPlan(userId, projectId, planId);
    if (!plan) return null;

    const scheduledFor = this.clampToPeriod(
      input.scheduledFor || new Date().toISOString().slice(0, 10),
      plan.period
    );
    const item: ContentIdea = {
      id: `content-${Date.now().toString(36)}-${crypto.randomInt(1e6).toString(36)}`,
      title: input.title.trim(),
      hook: input.hook || '',
      description: input.description || '',
      format: input.format || 'post',
      channel: toContentChannel(input.channel) || plan.channels[0] || 'linkedin',
      scheduledFor,
      week: weekOfPeriod(plan.period.start, scheduledFor),
      hashtags: Array.isArray(input.hashtags) ? input.hashtags.slice(0, 6) : [],
      callToAction: input.callToAction || '',
      intent: input.intent,
      status: 'idea',
      flyerIds: [],
      planId,
      occasion: input.occasion,
      occasionDate: input.occasionDate,
      caption: input.caption,
    };

    await this.patchCommunication(userId, projectId, (existing) => ({
      ...existing,
      plans: (existing.plans || []).map((p) =>
        p.id === planId ? { ...p, items: [...p.items, item], updatedAt: new Date() } : p
      ),
    }));
    return item;
  }

  async removePlanItem(
    userId: string,
    projectId: string,
    planId: string,
    itemId: string
  ): Promise<boolean> {
    let removed = false;
    await this.patchCommunication(userId, projectId, (existing) => ({
      ...existing,
      plans: (existing.plans || []).map((plan) => {
        if (plan.id !== planId) return plan;
        const items = plan.items.filter((item) => {
          const keep = item.id !== itemId;
          if (!keep) removed = true;
          return keep;
        });
        return { ...plan, items, updatedAt: new Date() };
      }),
    }));
    return removed;
  }

  /**
   * Occasions qui tombent dans une fenêtre de dates.
   *
   * Mis en cache par fenêtre ET par secteur : le calendrier national d'un pays
   * ne dépend pas du projet, et deux périodes qui se recouvrent ne doivent pas
   * payer deux fois la même liste.
   */
  async getOccasions(
    userId: string,
    projectId: string,
    from: string,
    to: string,
    opts: { force?: boolean } = {}
  ): Promise<MomentSuggestion[]> {
    const context = await this.extractContext(userId, projectId);
    const project = await this.getProject(projectId, userId);
    const country = (project as any)?.additionalInfos?.country || '';
    const window = this.normalisePeriod(from, to);

    const cacheKey = cacheService.generateAIKey(
      'communication-occasions',
      'shared',
      country || 'unknown',
      this.shortHash({
        businessType: context.businessType,
        start: window.start,
        end: window.end,
      })
    );
    if (!opts.force) {
      const cached = await cacheService.get<MomentSuggestion[]>(cacheKey, {
        prefix: 'ai',
        ttl: 60 * 60 * 24 * 7,
      });
      if (cached) return cached;
    }

    const systemPrompt = this.applyPlaceholders(AGENT_OCCASIONS_PROMPT, {
      WINDOW_START: window.start,
      WINDOW_END: window.end,
      TODAY: new Date().toISOString().slice(0, 10),
      COUNTRY: country || 'unspecified',
    });

    const raw = await this.promptService.runPrompt(
      promptConfigFor(AI_CONFIG.communication.occasions, userId),
      [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: JSON.stringify({
            businessType: context.businessType,
            keywords: context.keywords,
            tone: context.tone,
            targetAudience: context.targetAudience,
            language: context.language,
          }),
        },
      ]
    );

    const parsed = this.safeJson<{ suggestions: Partial<MomentSuggestion>[] }>(raw);
    const suggestions: MomentSuggestion[] = (parsed?.suggestions || [])
      .filter((item) => item && item.occasion)
      // Le filtre de fenêtre est REFAIT en code : une date hors période rendrait
      // le contenu inutilisable, et c'est exactement le genre de contrainte qu'on
      // ne laisse pas au modèle.
      .filter((item) => !item.date || (item.date >= window.start && item.date <= window.end))
      .slice(0, 8)
      .map((item, index) => ({
        id: item.id || `occasion-${index + 1}`,
        occasion: item.occasion!,
        date: item.date,
        intent: (item.intent as VisualIntent) || 'celebration',
        angle: item.angle || '',
        why: item.why,
        emoji: item.emoji,
      }))
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    await cacheService.set(cacheKey, suggestions, { prefix: 'ai', ttl: 60 * 60 * 24 * 7 });
    await this.patchCommunication(userId, projectId, (existing) => ({
      ...existing,
      occasionSuggestions: suggestions,
    }));
    return suggestions;
  }

  // ---- Internes aux périodes ----------------------------------------------

  /** Nombre de contenus attendus : la cadence × la durée, jamais demandé à l'utilisateur. */
  private expectedItemCount(plan: CommunicationPlan): number {
    const days = daysBetween(plan.period.start, plan.period.end);
    const count = Math.round((days / 7) * plan.postsPerWeek);
    // Plafond à 40 : au-delà, la sortie JSON dépasse le budget de tokens et
    // revient tronquée — donc perdue en entier.
    return Math.min(40, Math.max(1, count));
  }

  private async generatePlanBrief(
    userId: string,
    projectId: string,
    plan: CommunicationPlan,
    context: CommunicationContext,
    occasions: MomentSuggestion[]
  ): Promise<PlanBrief> {
    const days = daysBetween(plan.period.start, plan.period.end);
    const systemPrompt = this.applyPlaceholders(AGENT_PLAN_BRIEF_PROMPT, {
      PLAN_NAME: plan.name,
      PERIOD_START: plan.period.start,
      PERIOD_END: plan.period.end,
      PERIOD_WEEKS: String(Math.max(1, Math.ceil(days / 7))),
      PERIOD_DAYS: String(days),
      PLAN_KIND: plan.kind,
      PLAN_OBJECTIVE: plan.objective || '(not stated — infer it from the brand compass)',
      PLAN_CHANNELS: plan.channels.join(', '),
      PERIOD_OCCASIONS:
        occasions.map((o) => `${o.date || '?'} — ${o.occasion}`).join(' · ') || '(none)',
    });

    const compass = await this.compassForPrompt(userId, projectId);
    const raw = await this.promptService.runPrompt(
      promptConfigFor(AI_CONFIG.communication.planBrief, userId),
      [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content:
            'CONTEXT:\n' +
            JSON.stringify({
              brandName: context.brandName,
              businessType: context.businessType,
              valueProposition: context.valueProposition,
              targetAudience: context.targetAudience,
              tone: context.tone,
              keywords: context.keywords,
              language: context.language,
            }) +
            '\n\nBRAND COMPASS:\n' +
            compass,
        },
      ]
    );

    const parsed = this.safeJson<Partial<PlanBrief>>(raw) ?? {};
    return {
      angle: parsed.angle || '',
      keyMessage: parsed.keyMessage || '',
      themes: Array.isArray(parsed.themes)
        ? parsed.themes
            .filter((theme) => theme && theme.label)
            .slice(0, 4)
            .map((theme) => ({ label: theme.label, why: theme.why || '' }))
        : [],
      successSignals: Array.isArray(parsed.successSignals)
        ? parsed.successSignals.filter(Boolean).slice(0, 3)
        : [],
      occasions: occasions
        .filter((occasion) => occasion.date)
        .map((occasion) => ({ label: occasion.occasion, date: occasion.date! })),
    };
  }

  private async generatePlanContent(
    userId: string,
    plan: CommunicationPlan,
    context: CommunicationContext,
    brief: PlanBrief
  ): Promise<ContentIdea[]> {
    const itemCount = this.expectedItemCount(plan);
    const channelEnum = plan.channels.map((channel) => `"${channel}"`).join(' | ');

    const systemPrompt = this.applyPlaceholders(AGENT_PLAN_CONTENT_PROMPT, {
      ITEM_COUNT: String(itemCount),
      PERIOD_START: plan.period.start,
      PERIOD_END: plan.period.end,
      POSTS_PER_WEEK: String(plan.postsPerWeek),
      CHANNEL_ENUM: channelEnum || '"linkedin"',
      PERIOD_OCCASIONS:
        (brief.occasions || []).map((o) => `${o.date} — ${o.label}`).join(' · ') || '(none)',
      PLAN_BRIEF: JSON.stringify(brief, null, 2),
    });

    const raw = await this.promptService.runPrompt(
      promptConfigFor(AI_CONFIG.communication.planContent, userId),
      [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content:
            'CONTEXT:\n' +
            JSON.stringify({
              brandName: context.brandName,
              businessType: context.businessType,
              valueProposition: context.valueProposition,
              targetAudience: context.targetAudience,
              tone: context.tone,
              keywords: context.keywords,
              language: context.language,
            }) +
            '\n\nOBJECTIVE:\n' +
            plan.objective,
        },
      ]
    );

    const parsed = this.safeJson<{ items: Partial<ContentIdea>[] }>(raw);
    const items = Array.isArray(parsed?.items) ? parsed!.items : [];
    return items
      .filter((item) => item && item.title)
      .slice(0, itemCount)
      .map((item, index) => this.normalisePlanItem(item, index, plan, itemCount));
  }

  /**
   * Range un contenu produit par le modèle dans la période.
   *
   * Tout ce qui est calculable est calculé ICI : la date est ramenée dans la
   * fenêtre, le rang de semaine en découle, le canal est ramené à ceux que
   * l'utilisateur a retenus. Une date hors période rendrait le contenu
   * inutilisable, et une contrainte arithmétique n'a rien à faire dans un prompt.
   */
  private normalisePlanItem(
    raw: Partial<ContentIdea> & { theme?: string },
    index: number,
    plan: CommunicationPlan,
    total: number
  ): ContentIdea {
    // Date de repli : étalée sur la période, pour que N contenus sans date
    // exploitable ne s'empilent pas tous le premier jour.
    const days = daysBetween(plan.period.start, plan.period.end);
    const fallbackDate = addDays(
      plan.period.start,
      Math.min(days - 1, Math.floor((index * days) / Math.max(1, total)))
    );
    const scheduledFor = this.clampToPeriod(raw.scheduledFor || fallbackDate, plan.period);
    // Le canal du modèle est normalisé PUIS confronté à ceux que l'utilisateur a
    // retenus : proposer un contenu pour un réseau qu'il n'a pas coché n'a pas de
    // sens, et une valeur hors énumération casse l'affichage.
    const proposed = toContentChannel(raw.channel);
    const channel =
      proposed && plan.channels.includes(proposed) ? proposed : plan.channels[0] || 'linkedin';

    return {
      id: raw.id || `content-${plan.id}-${index + 1}`,
      title: (raw.title || 'Untitled content').slice(0, 120),
      hook: raw.hook || '',
      description: raw.description || '',
      format: (raw.format as ContentIdea['format']) || 'post',
      channel,
      scheduledFor,
      week: weekOfPeriod(plan.period.start, scheduledFor),
      hashtags: Array.isArray(raw.hashtags) ? raw.hashtags.slice(0, 6) : [],
      // Vide plutôt que « Learn more » : le défaut anglais de la V1 se
      // retrouvait dans des légendes françaises, et le modèle le prenait pour
      // une consigne de composition.
      callToAction: raw.callToAction || '',
      intent: raw.intent,
      status: 'idea',
      flyerIds: [],
      planId: plan.id,
      occasion: raw.occasion,
      occasionDate: raw.occasion ? scheduledFor : undefined,
      caption: raw.caption,
    };
  }

  /** Deux dates ISO valides, dans l'ordre, bornées à un an de fenêtre. */
  private normalisePeriod(start: string, end: string): { start: string; end: string } {
    const iso = (value: string, fallback: string): string => {
      const candidate = (value || '').slice(0, 10);
      return /^\d{4}-\d{2}-\d{2}$/.test(candidate) && Number.isFinite(Date.parse(candidate))
        ? candidate
        : fallback;
    };
    const todayIso = new Date().toISOString().slice(0, 10);
    let first = iso(start, todayIso);
    let last = iso(end, addDays(first, 27));
    if (last < first) [first, last] = [last, first];
    // Un an de plafond : au-delà, la génération n'a plus de sens éditorial et le
    // nombre de contenus explose.
    if (daysBetween(first, last) > 366) last = addDays(first, 365);
    return { start: first, end: last };
  }

  private clampToPeriod(date: string, period: { start: string; end: string }): string {
    const candidate = (date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return period.start;
    if (candidate < period.start) return period.start;
    if (candidate > period.end) return period.end;
    return candidate;
  }

  private normaliseChannels(
    channels: ContentChannel[] | undefined,
    context: CommunicationContext | undefined
  ): ContentChannel[] {
    // Normalisé même quand l'appelant est le front : un projet ancien peut lui
    // avoir servi des canaux non conformes, qu'il renverrait tels quels.
    const cleaned = toContentChannels(channels);
    if (cleaned.length) return cleaned.slice(0, 6);
    const fromContext = toContentChannels(context?.channels);
    return fromContext.length ? fromContext.slice(0, 3) : ['linkedin'];
  }

  /** « Novembre 2026 » ou « 3 nov. → 18 déc. » selon que la période colle à un mois. */
  private defaultPlanName(start: string, end: string): string {
    const startDate = new Date(`${start}T00:00:00Z`);
    const endDate = new Date(`${end}T00:00:00Z`);
    const sameMonth =
      startDate.getUTCFullYear() === endDate.getUTCFullYear() &&
      startDate.getUTCMonth() === endDate.getUTCMonth();
    if (sameMonth) {
      return startDate.toLocaleDateString('fr-FR', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      });
    }
    const short = (date: Date) =>
      date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
    return `${short(startDate)} → ${short(endDate)}`;
  }

  /** Périodes actives d'abord, puis par date de début décroissante. */
  private sortPlans(plans: CommunicationPlan[]): CommunicationPlan[] {
    const rank: Record<PlanStatus, number> = { active: 0, draft: 1, done: 2, archived: 3 };
    return [...plans].sort(
      (a, b) => rank[a.status] - rank[b.status] || b.period.start.localeCompare(a.period.start)
    );
  }

  /**
   * La période « Occasions », créée à la demande et étendue si besoin.
   *
   * Les contenus d'occasion ne suivent pas une cadence : ils tombent quand le
   * calendrier le veut. Ils ont donc leur propre période, élastique, plutôt
   * qu'une place forcée dans un plan mensuel.
   */
  private async ensureOccasionsPlan(
    userId: string,
    projectId: string,
    date: string
  ): Promise<CommunicationPlan> {
    const plans = await this.listPlans(userId, projectId);
    const existing = plans.find((plan) => plan.id.startsWith('plan-occasions'));

    if (existing) {
      // La période s'étire pour accueillir une date hors de ses bornes, au lieu
      // de ramener le contenu à l'intérieur — une fête ne se déplace pas.
      const start = date < existing.period.start ? date : existing.period.start;
      const end = date > existing.period.end ? date : existing.period.end;
      if (start !== existing.period.start || end !== existing.period.end) {
        return (await this.updatePlan(userId, projectId, existing.id, { start, end })) ?? existing;
      }
      return existing;
    }

    const created = await this.createPlan(userId, projectId, {
      name: 'Occasions',
      objective: '',
      start: date,
      end: date,
      kind: 'campaign',
      postsPerWeek: 1,
    });
    const renamed: CommunicationPlan = { ...created, id: 'plan-occasions', status: 'active' };
    await this.patchCommunication(userId, projectId, (model) => ({
      ...model,
      plans: (model.plans || []).map((plan) => (plan.id === created.id ? renamed : plan)),
    }));
    return renamed;
  }

  /** La boussole, condensée pour un prompt : résumé + blocs utiles, jamais tout. */
  private async compassForPrompt(userId: string, projectId: string): Promise<string> {
    const model = await this.getCommunication(userId, projectId);
    const strategy = model?.strategy;
    if (!strategy) {
      return '(no brand compass yet — derive the line from the brand context alone)';
    }
    const keep = ['positioning', 'pillars', 'messaging', 'channels', 'tone'];
    const blocks = (strategy.blocks || [])
      .filter((block) => keep.includes(block.kind))
      .map((block) => `## ${block.title}\n${block.body}`)
      .join('\n\n');
    return [strategy.summary, blocks].filter(Boolean).join('\n\n');
  }

  // --------------------------------------------------------------------------
  // 5. On-demand flyer generation
  // --------------------------------------------------------------------------

  async generateFlyer(
    userId: string,
    projectId: string,
    contentId: string,
    opts: { format?: FlyerFormat; force?: boolean } = {}
  ): Promise<Flyer> {
    const format = opts.format || 'square';
    logger.info(`[Communication] Generating flyer`, { userId, projectId, contentId, format });
    const communication = await this.getCommunication(userId, projectId);
    // Un visuel se demande pour N'IMPORTE QUEL contenu, de n'importe quelle
    // période : toutes portent des `ContentIdea`, donc tout le pipeline de
    // composition est partagé.
    const located = this.findContent(communication, contentId);
    if (!located) {
      logger.error(`[Communication] Content idea not found`, { contentId });
      throw new Error(`Content idea not found: ${contentId}`);
    }
    const { content, planId } = located;
    const context = communication?.context ?? (await this.extractContext(userId, projectId));

    const cacheKey = cacheService.generateAIKey(
      'communication-flyer',
      userId,
      projectId,
      this.shortHash({ contentId, format, content, brand: context.branding })
    );
    if (!opts.force) {
      const cached = await cacheService.get<Flyer>(cacheKey, { prefix: 'ai', ttl: 7200 });
      if (cached) return cached;
    }

    const flyerId = `flyer-${contentId}-${format}-${Date.now().toString(36)}`;
    const { html, parsed, sourced, intent, png, audit } = await this.composeFlyer(
      userId,
      projectId,
      content,
      context,
      format,
      flyerId,
      `flyer:${projectId}:${contentId}:${format}`
    );

    // Note: We no longer need the post-processing regex replace for {{IMAGE_URL}} 
    // because we correctly populate the system prompt now. The AI will see 
    // the real URL. We keep the logic clean and rely on the prompt quality.

    // URL de rendu SIGNÉE : l'endpoint ne peut pas être authentifié (une balise
    // <img> ne porte pas d'en-tête), mais son chemin ne doit pas être devinable.
    const renderedUrl = signedVisualImageUrl(projectId, flyerId);

    // Aucun CTA sur le visuel, quelle que soit l'intention. L'ancienne règle
    // « CTA si promotion/recrutement » laissait passer un bouton sur une part
    // des visuels ; or un post social n'est pas une landing page, et le bouton
    // dessiné dans une image n'est même pas cliquable. L'appel à l'action vit
    // dans la LÉGENDE (`content.callToAction`, publiée avec le post).
    const flyer: Flyer = {
      id: flyerId,
      contentId,
      planId,
      origin: content.occasion ? 'occasion' : 'plan',
      brief: content.title,
      format,
      intent,
      logoUsed: (parsed as Partial<Flyer>).logoUsed,
      concept: parsed.concept || '',
      layoutNotes: parsed.layoutNotes || '',
      marketingText: {
        headline: parsed.marketingText?.headline || content.title,
        subheadline: parsed.marketingText?.subheadline,
        body: parsed.marketingText?.body || content.description,
      },
      html,
      imageUrl: renderedUrl,
      backgroundImageUrl: sourced?.url,
      imageSource: sourced?.source,
      imageAnalysis: sourced?.analysis,
      imageAttribution: sourced?.attribution,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await cacheService.set(cacheKey, flyer, { prefix: 'ai', ttl: 7200 });
    // Le PNG a déjà été produit pour contrôler la composition : on le sert au
    // lieu de le jeter. L'endpoint image devient instantané au premier
    // affichage, et l'utilisateur voit exactement l'image qui a été mesurée.
    await cacheService.set(this.flyerImageCacheKey(projectId, flyerId), png.toString('base64'), {
      prefix: 'flyer',
      ttl: 86400,
    });
    if (audit.blocking) {
      logger.warn(`[Communication] Visuel livré avec des défauts de composition non réparables`, {
        flyerId,
        score: audit.score,
        defauts: audit.findings.filter((f) => !f.repaired).map((f) => f.rule),
      });
    }

    await this.persistVisual(userId, projectId, flyer);
    return flyer;
  }

  /**
   * Compose un visuel : brief d'image, image (banque ou génération), puis
   * composition HTML à la charte et passes déterministes.
   *
   * Extrait de `generateFlyer` pour servir aussi la charte graphique, qui montre
   * des publications composées par CE pipeline — les visuels qu'on promet dans
   * la charte doivent être ceux que le module communication produira ensuite.
   * Aucune écriture ici : l'appelant décide de ce qu'il persiste.
   */
  private async composeFlyer(
    userId: string,
    projectId: string,
    content: ContentIdea,
    context: CommunicationContext,
    format: FlyerFormat,
    tag: string,
    seedKey: string,
    /** Réglages de sourcing d'un appelant hors module (la charte graphique). */
    sourcing?: ImageSourcingPreferences,
    /**
     * Composition 100 % typographique, sans photo.
     *
     * Ce n'est pas une dégradation : un prix, une date ou une phrase forte se
     * portent mieux sans image — et le prompt de composition sait déjà traiter ce
     * cas (`IMAGE_URL` reçoit alors une consigne explicite). L'atelier l'expose à
     * l'utilisateur (« sans photo »), et cela économise au passage l'appel de
     * brief d'image ET l'appel de sourcing.
     */
    skipImage?: boolean
  ): Promise<{
    html: string;
    parsed: Partial<Flyer>;
    sourced: SourcedImage | null;
    intent: VisualIntent;
    /** Visuel photographié après contrôle de composition. */
    png: Buffer;
    audit: VisualAuditReport;
  }> {
    // ---- Step 5a: grille de composition -------------------------------------
    // La graine est tirée AVANT le brief d'image : c'est elle qui décide de
    // l'axe de la césure 62/38, donc de la zone que la photo doit laisser libre.
    // Tant qu'elle était tirée après, on demandait une image « avec de l'espace
    // pour le texte » sans savoir de quel côté, et le brief ne servait à rien.
    const seed = this.generateDesignSeed(context, seedKey);
    const dims = FORMAT_DIMENSIONS[format] || FORMAT_DIMENSIONS.square;
    const grid = buildCompositionGrid(
      { width: dims.width, height: dims.height, print: format === 'a4' },
      seed,
      {
        primary: context.branding.primary,
        secondary: context.branding.secondary,
        accent: context.branding.accent,
        background: context.branding.background,
        text: context.branding.text,
      }
    );

    // ---- Step 5b/5c: image brief puis sourcing — sautés si « sans photo » ---
    let sourced: SourcedImage | null = null;
    if (!skipImage) {
      const brief = await this.buildImageBrief(userId, content, context, format, grid);
      try {
        sourced = await imageSourcingService.sourceImage(brief, {
          userId,
          projectId,
          tag,
          ...sourcing,
        });
      } catch (err: any) {
        logger.warn('Flyer image sourcing failed, falling back to text-only flyer', {
          error: err?.message,
        });
      }
    }

    // ---- Step 5d: composition (copy + HTML coherent with the image) --------
    const intent = this.inferVisualIntent(content);
    // Un SEUL passage de substitution, piloté par une table exhaustive : les
    // remplacements en cascade laissaient passer des marqueurs non résolus
    // ({{DESIGN_SEED.archetype}}, {{IMAGE_DOMINANT_COLORS}}…) que le modèle
    // recevait littéralement — au mieux du bruit, au pire une consigne illisible
    // là où on croyait lui donner la charte.
    const systemPrompt = this.applyPlaceholders(
      AGENT_FLYER_GENERATION_PROMPT,
      this.buildFlyerPlaceholders(context, seed, intent, format, sourced, grid)
    );

    // Strip the heavy inline SVG markup before sending branding to the LLM: it
    // bloats the payload and tempts the model into pasting raw SVG. The resolved
    // logoUrls remain available (both in the prompt and here).
    const { logoSvg, ...brandingForLlm } = context.branding;

    const userPayload: Record<string, unknown> = {
      BRAND: {
        name: context.brandName,
        tone: context.tone,
        branding: brandingForLlm, // Detailed branding including logoUrls (no raw SVG)
        colors: brandingForLlm, // Legacy path for color placeholders
      },
      VISUAL_INTENT: intent,
      DESIGN_SEED: seed,
      CONTENT_IDEA: {
        title: content.title,
        hook: content.hook,
        description: content.description,
        format: content.format,
        channel: content.channel,
        intent,
        // `callToAction` n'est VOLONTAIREMENT pas transmis : c'est le texte de la
        // légende du post, pas un élément du visuel. Tant qu'on l'envoyait ici,
        // le modèle le prenait pour une consigne de composition et dessinait un
        // bouton sur chaque visuel — d'autant plus que la valeur par défaut du
        // calendrier est « Learn more ». Le visuel ne porte aucun CTA.
        hashtags: content.hashtags,
      },
      FORMAT: format,
    };
    if (sourced) {
      userPayload.IMAGE_URL = sourced.url;
      userPayload.IMAGE_SUBJECT = sourced.analysis.subject;
      userPayload.IMAGE_MOOD = sourced.analysis.mood;
      userPayload.IMAGE_DOMINANT_COLORS = sourced.analysis.dominantColors;
      userPayload.IMAGE_LUMINANCE = sourced.analysis.luminance;
      userPayload.IMAGE_COMPOSITION = sourced.analysis.composition;
      userPayload.IMAGE_DETECTED_TEXT = sourced.analysis.detectedText;
    }

    const messages: AIChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify(userPayload, null, 2) },
    ];

    const raw = await this.promptService.runPrompt(
      promptConfigFor(AI_CONFIG.communication.flyer, userId),
      messages
    );
    // Le balisage voyage désormais dans un bloc <html>, pas dans une chaîne
    // JSON : une page de Tailwind porte des centaines de guillemets doubles, et
    // c'est leur échappement qui perdait la génération entière. Les métadonnées
    // (concept, texte marketing) restent en JSON — elles n'ont pas ce problème.
    const parsed = this.parseFlyerResponse(raw);

    let html =
      typeof parsed.html === 'string' && parsed.html.trim().length > 0
        ? this.enforceBrandTypography(this.stripCtaButtons(parsed.html), context)
        : this.fallbackFlyerHtml(content, context, format, sourced?.url);
    html = this.ensureLogoPresence(html, context, format);
    html = this.applyDesignLint(
      html,
      context,
      `visuel/${format}`,
      sourced?.analysis.dominantColors || []
    );

    // ---- Step 5e: contrôle de composition MESURÉ ---------------------------
    // Le visuel est monté dans un navigateur, mesuré et réparé (zone de
    // sécurité, texte rogné, alignement, hiérarchie, contraste réel sur les
    // pixels rendus, fond perdu), puis photographié. Ce que les passes
    // précédentes ne peuvent pas voir — elles lisent une chaîne, pas une page —
    // est attrapé ici, et le balisage renvoyé est celui qui a produit l'image.
    const rendered = await flyerRenderService.renderFlyer(
      html,
      format,
      {
        url: context.branding.fontUrl,
        primaryFont: context.branding.primaryFont,
        secondaryFont: context.branding.secondaryFont,
      },
      this.logoDeclensions(context, parsed.logoUsed),
      {
        grid,
        palette: {
          primary: context.branding.primary,
          secondary: context.branding.secondary,
          accent: context.branding.accent,
          background: context.branding.background,
          text: context.branding.text,
        },
        label: `visuel/${format}`,
      }
    );

    return {
      html: rendered.html ? sanitizeSectionHtml(rendered.html) : html,
      parsed,
      sourced,
      intent,
      png: rendered.png,
      audit: rendered.audit,
    };
  }

  /**
   * Table des déclinaisons de logo attendue par le rendu.
   *
   * Le rendu doit pouvoir RECONNAÎTRE le logo posé par le modèle (pour le
   * remonter au seuil de lisibilité) et le REMPLACER par la bonne polarité si
   * le contraste mesuré sous lui est insuffisant : il lui faut donc l'URL
   * utilisée ET toutes les déclinaisons disponibles.
   */
  private logoDeclensions(context: CommunicationContext, used?: unknown): LogoDeclensionSet {
    const logos = context.branding.logoUrls;
    return {
      used: typeof used === 'string' ? used : undefined,
      primary: logos?.primary,
      withText: logos?.withText
        ? {
            lightBackground: logos.withText.light,
            darkBackground: logos.withText.dark,
            monochrome: logos.withText.mono,
          }
        : undefined,
      iconOnly: logos?.iconOnly
        ? {
            lightBackground: logos.iconOnly.light,
            darkBackground: logos.iconOnly.dark,
            monochrome: logos.iconOnly.mono,
          }
        : undefined,
    };
  }

  /**
   * Compose et REND un visuel sans l'inscrire au calendrier du projet.
   *
   * C'est ce que la charte graphique pose dans ses mockups de publications :
   * le même pipeline que les visuels du module communication, sans laisser de
   * visuel orphelin dans ce module.
   */
  async renderStandaloneVisual(
    userId: string,
    projectId: string,
    content: ContentIdea,
    format: FlyerFormat,
    sourcing?: ImageSourcingPreferences
  ): Promise<{ png: Buffer; headline: string }> {
    const context = await this.extractContext(userId, projectId);
    // Le compositeur rend déjà le visuel pour le CONTRÔLER : le photographier
    // une seconde fois ici coûterait un lancement de page pour un résultat
    // identique — et ce serait le rendu non contrôlé qui partirait dans la charte.
    const { png, parsed } = await this.composeFlyer(
      userId,
      projectId,
      content,
      context,
      format,
      `brandbook-${content.id}-${format}`,
      `brandbook:${projectId}:${content.id}:${format}`,
      sourcing
    );
    return { png, headline: parsed.marketingText?.headline || content.title };
  }

  async regenerateFlyer(
    userId: string,
    projectId: string,
    contentId: string,
    format: FlyerFormat
  ): Promise<Flyer> {
    return this.generateFlyer(userId, projectId, contentId, { format, force: true });
  }

  // --------------------------------------------------------------------------
  // 5ter. L'ATELIER — un visuel depuis une simple phrase
  //
  // La V1 exigeait un `ContentIdea` déjà inscrit au calendrier pour composer un
  // visuel : il fallait donc une stratégie (40 crédits) puis un calendrier (15)
  // avant le premier visuel (2). Ici le brief EST la demande, et la composition
  // passe par le MÊME `composeFlyer` — donc la même charte, la même graine de
  // design, le même lint. Le branding est respecté par construction.
  // --------------------------------------------------------------------------

  /**
   * Compose, rend et PERSISTE un visuel depuis un brief en langage naturel.
   *
   * Le `ContentIdea` fabriqué ici est éphémère : il ne sert qu'à parler le
   * langage de `composeFlyer`, il n'est inscrit dans aucune période. C'est ce qui
   * permet à l'atelier de produire sans rien planifier — et `schedule_visual`
   * l'inscrit plus tard, si l'utilisateur le décide.
   */
  async createVisualFromBrief(
    userId: string,
    projectId: string,
    input: {
      brief: string;
      format?: FlyerFormat;
      intent?: VisualIntent;
      withPhoto?: boolean;
      origin?: VisualOrigin;
      /** Rattachement optionnel, quand le visuel naît déjà planifié. */
      contentId?: string;
      planId?: string;
      /** Différencie les tirages d'un même brief (variantes). */
      variantIndex?: number;
    }
  ): Promise<Flyer> {
    const brief = (input.brief || '').trim();
    if (!brief) throw new Error('A brief is required to create a visual');

    const format = input.format || 'square';
    const context = await this.extractContext(userId, projectId);
    const visualId = `visual-${Date.now().toString(36)}-${crypto.randomInt(1e6).toString(36)}`;
    const content = this.syntheticContent(visualId, brief, input.intent, format);

    const { html, parsed, sourced, intent, png, audit } = await this.composeFlyer(
      userId,
      projectId,
      content,
      context,
      format,
      visualId,
      // La graine inclut l'index de variante : sans lui, trois variantes du même
      // brief retomberaient sur la même composition, et l'utilisateur paierait
      // trois fois le même visuel.
      `studio:${projectId}:${this.shortHash(brief)}:${format}:${input.variantIndex ?? 0}`,
      undefined,
      input.withPhoto === false
    );

    const visual: Flyer = {
      id: visualId,
      contentId: input.contentId,
      planId: input.planId,
      origin: input.origin || 'studio',
      brief,
      format,
      intent,
      logoUsed: (parsed as Partial<Flyer>).logoUsed,
      concept: parsed.concept || '',
      layoutNotes: parsed.layoutNotes || '',
      marketingText: {
        headline: parsed.marketingText?.headline || brief.slice(0, 80),
        subheadline: parsed.marketingText?.subheadline,
        body: parsed.marketingText?.body || '',
      },
      html,
      imageUrl: signedVisualImageUrl(projectId, visualId),
      backgroundImageUrl: sourced?.url,
      imageSource: sourced?.source,
      imageAnalysis: sourced?.analysis,
      imageAttribution: sourced?.attribution,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Le PNG a déjà été produit pour contrôler la composition : le mettre en
    // cache évite un second lancement de page au premier affichage.
    await cacheService.set(this.flyerImageCacheKey(projectId, visualId), png.toString('base64'), {
      prefix: 'flyer',
      ttl: 86400,
    });
    if (audit.blocking) {
      logger.warn('[Communication] Visuel d\'atelier livré avec des défauts non réparables', {
        visualId,
        score: audit.score,
      });
    }

    await this.persistVisual(userId, projectId, visual);
    return visual;
  }

  /**
   * Plusieurs tirages du MÊME brief, pour que l'utilisateur choisisse.
   *
   * Menés en parallèle : trois compositions séquentielles, c'est trois minutes
   * d'attente. Les échecs partiels sont tolérés — deux variantes valent mieux
   * qu'une erreur.
   */
  async createVisualVariants(
    userId: string,
    projectId: string,
    input: {
      brief: string;
      format?: FlyerFormat;
      intent?: VisualIntent;
      withPhoto?: boolean;
      count?: number;
    }
  ): Promise<Flyer[]> {
    const count = Math.min(3, Math.max(1, input.count || 3));
    const results = await Promise.allSettled(
      Array.from({ length: count }, (_unused, index) =>
        this.createVisualFromBrief(userId, projectId, { ...input, variantIndex: index })
      )
    );

    const visuals = results
      .filter(
        (result): result is PromiseFulfilledResult<Flyer> => result.status === 'fulfilled'
      )
      .map((result) => result.value);

    if (!visuals.length) {
      const reason = results.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
      throw new Error(reason?.reason?.message || 'Visual generation failed');
    }

    // Les variantes se connaissent entre elles : l'interface peut les présenter
    // comme un lot, et une retouche sait qu'il existe des sœurs.
    const ids = visuals.map((visual) => visual.id);
    await this.patchCommunication(userId, projectId, (existing) => ({
      ...existing,
      visuals: (existing.visuals || []).map((visual) =>
        ids.includes(visual.id)
          ? { ...visual, siblingIds: ids.filter((id) => id !== visual.id) }
          : visual
      ),
    }));

    return visuals.map((visual) => ({
      ...visual,
      siblingIds: ids.filter((id) => id !== visual.id),
    }));
  }

  /**
   * Décline un visuel existant dans d'autres formats.
   *
   * Le brief et l'intention sont repris du visuel d'origine : ce n'est pas une
   * nouvelle création, c'est la même idée recomposée pour une autre surface. La
   * graine change avec le format (une story n'est pas un carré rogné).
   */
  async declinateVisual(
    userId: string,
    projectId: string,
    visualId: string,
    formats: FlyerFormat[]
  ): Promise<Flyer[]> {
    const source = await this.getVisual(userId, projectId, visualId);
    if (!source) throw new Error(`Visual not found: ${visualId}`);

    const wanted = Array.from(new Set(formats)).filter((format) => format !== source.format);
    if (!wanted.length) return [];

    const brief =
      source.brief ||
      [source.marketingText?.headline, source.marketingText?.body].filter(Boolean).join(' — ') ||
      source.concept;

    const results = await Promise.allSettled(
      wanted.map((format) =>
        this.createVisualFromBrief(userId, projectId, {
          brief,
          format,
          intent: source.intent,
          withPhoto: !!source.backgroundImageUrl,
          origin: source.origin || 'studio',
          contentId: source.contentId,
          planId: source.planId,
        })
      )
    );

    const created = results
      .filter((result): result is PromiseFulfilledResult<Flyer> => result.status === 'fulfilled')
      .map((result) => result.value);

    if (created.length) {
      const family = [visualId, ...created.map((visual) => visual.id)];
      await this.patchCommunication(userId, projectId, (existing) => ({
        ...existing,
        visuals: (existing.visuals || []).map((visual) =>
          family.includes(visual.id)
            ? { ...visual, siblingIds: family.filter((id) => id !== visual.id) }
            : visual
        ),
      }));
    }
    return created;
  }

  /**
   * La bibliothèque : tous les visuels, SANS leur HTML.
   *
   * Le HTML (5 à 15 ko par visuel) n'a rien à faire dans une liste qui n'affiche
   * que des vignettes — c'est lui qui faisait peser 400 ko l'ouverture du module.
   */
  async listVisuals(
    userId: string,
    projectId: string,
    filters: { planId?: string; format?: FlyerFormat; origin?: VisualOrigin } = {}
  ): Promise<Flyer[]> {
    const model = await this.getCommunication(userId, projectId);
    return this.visualsOf(model)
      .filter((visual) => !filters.planId || visual.planId === filters.planId)
      .filter((visual) => !filters.format || visual.format === filters.format)
      .filter((visual) => !filters.origin || (visual.origin || 'plan') === filters.origin)
      .map((visual) => ({ ...this.withSignedUrl(projectId, visual), html: '' }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /** Un visuel, HTML compris — pour l'éditeur et le rendu. */
  async getVisual(userId: string, projectId: string, visualId: string): Promise<Flyer | null> {
    const model = await this.getCommunication(userId, projectId);
    const visual = this.visualsOf(model).find((item) => item.id === visualId);
    return visual ? this.withSignedUrl(projectId, visual) : null;
  }

  /**
   * Supprime un visuel, définitivement.
   *
   * C'est la seule suppression dure du module, et elle est assumée : un visuel
   * raté encombre la bibliothèque, et on ne « range » pas une image — on la jette.
   * Les périodes, elles, s'archivent, parce qu'elles portent l'historique.
   *
   * Le lien est défait dans les DEUX sens : sans cela, le contenu propriétaire
   * garderait un `flyerIds` pointant vers un visuel disparu, et son aperçu
   * resterait cassé.
   */
  async deleteVisual(userId: string, projectId: string, visualId: string): Promise<boolean> {
    let removed = false;

    await this.patchCommunication(userId, projectId, (existing) => {
      const library = existing.visuals || existing.flyers || [];
      const visuals = library.filter((visual) => {
        const keep = visual.id !== visualId;
        if (!keep) removed = true;
        return keep;
      });

      const unlink = (ids: string[] | undefined) =>
        ids?.length ? ids.filter((id) => id !== visualId) : ids;

      return {
        ...existing,
        visuals,
        plans: (existing.plans || []).map((plan) => ({
          ...plan,
          items: plan.items.map((item) =>
            item.flyerIds?.includes(visualId)
              ? { ...item, flyerIds: unlink(item.flyerIds) }
              : item
          ),
        })),
        // Une publication préparée à partir de ce visuel perd son image, mais garde
        // sa légende : elle reste publiable à la main.
        publications: (existing.publications || []).map((publication) =>
          publication.flyerId === visualId
            ? { ...publication, flyerId: undefined, imageUrl: undefined }
            : publication
        ),
      };
    });

    if (removed) {
      await this.patchCommunication(userId, projectId, (existing) => ({
        ...existing,
        visuals: (existing.visuals || []).map((visual) =>
          visual.siblingIds?.includes(visualId)
            ? { ...visual, siblingIds: visual.siblingIds.filter((id) => id !== visualId) }
            : visual
        ),
      }));
      await this.invalidateFlyerImage(projectId, visualId);
      logger.info('[Communication] Visual deleted', { projectId, visualId });
    }
    return removed;
  }

  /**
   * Inscrit un visuel au calendrier d'une période.
   *
   * Un visuel d'atelier n'a pas de contenu propriétaire : on en crée un à ce
   * moment-là, porteur de la légende déjà écrite. C'est le pont entre « je
   * fabrique » et « je planifie ».
   */
  async scheduleVisual(
    userId: string,
    projectId: string,
    input: {
      visualId: string;
      planId: string;
      date: string;
      channel?: ContentChannel;
      caption?: string;
    }
  ): Promise<ContentIdea | null> {
    const visual = await this.getVisual(userId, projectId, input.visualId);
    if (!visual) throw new Error(`Visual not found: ${input.visualId}`);
    const plan = await this.getPlan(userId, projectId, input.planId);
    if (!plan) throw new Error(`Plan not found: ${input.planId}`);

    // Déjà rattaché à un contenu : on ne duplique pas, on déplace la date.
    if (visual.contentId) {
      const located = await this.findContentById(userId, projectId, visual.contentId);
      // `planId` peut manquer sur un contenu V1 lu hors période : on le laisse
      // alors suivre le chemin normal, qui lui en crée une.
      if (located?.planId) {
        const updated = await this.updatePlanItem(
          userId,
          projectId,
          located.planId,
          visual.contentId,
          { scheduledFor: input.date, status: 'scheduled' }
        );
        return updated?.items.find((item) => item.id === visual.contentId) ?? null;
      }
    }

    const item = await this.addPlanItem(userId, projectId, input.planId, {
      title: visual.marketingText?.headline || visual.brief || 'Visuel',
      hook: visual.marketingText?.subheadline || '',
      description: visual.marketingText?.body || '',
      format: 'post',
      channel: toContentChannel(input.channel) || plan.channels[0] || 'linkedin',
      scheduledFor: input.date,
      intent: visual.intent,
      caption: input.caption,
    });
    if (!item) return null;

    // Le lien est posé dans les DEUX sens : le contenu connaît son visuel, le
    // visuel connaît son contenu. Sans cela, la bibliothèque et le calendrier
    // racontent deux histoires différentes.
    await this.patchCommunication(userId, projectId, (existing) => ({
      ...existing,
      plans: (existing.plans || []).map((p) =>
        p.id === input.planId
          ? {
              ...p,
              items: p.items.map((it) =>
                it.id === item.id ? { ...it, flyerIds: [visual.id] } : it
              ),
              updatedAt: new Date(),
            }
          : p
      ),
      visuals: (existing.visuals || []).map((v) =>
        v.id === visual.id
          ? { ...v, contentId: item.id, planId: input.planId, origin: 'plan', updatedAt: new Date() }
          : v
      ),
    }));

    return { ...item, flyerIds: [visual.id] };
  }

  // ---- Internes aux visuels ------------------------------------------------

  /**
   * Réécrit l'URL de rendu d'un visuel avec sa signature.
   *
   * Appliqué sur TOUTES les lectures : les visuels produits avant la signature
   * portent en base une URL sans jeton, et c'est ainsi qu'ils continuent de
   * s'afficher sans migration de données.
   */
  private withSignedUrl(projectId: string, visual: Flyer): Flyer {
    return { ...visual, imageUrl: signedVisualImageUrl(projectId, visual.id) };
  }

  /** Les visuels du projet, quelle que soit la version du schéma. */
  private visualsOf(model: CommunicationModel | null | undefined): Flyer[] {
    return model?.visuals || model?.flyers || [];
  }

  /** Un contenu, cherché dans toutes les périodes (puis dans les champs V1). */
  private findContent(
    model: CommunicationModel | null | undefined,
    contentId: string
  ): { content: ContentIdea; planId?: string } | null {
    for (const plan of model?.plans || []) {
      const content = plan.items.find((item) => item.id === contentId);
      if (content) return { content, planId: plan.id };
    }
    // Repli V1 : un projet lu juste avant sa migration, ou une route dépréciée.
    const legacy =
      model?.calendar?.items.find((item) => item.id === contentId) ||
      model?.moments?.find((moment) => moment.id === contentId);
    return legacy ? { content: legacy } : null;
  }

  private async findContentById(
    userId: string,
    projectId: string,
    contentId: string
  ): Promise<{ content: ContentIdea; planId?: string } | null> {
    const model = await this.getCommunication(userId, projectId);
    return this.findContent(model, contentId);
  }

  /**
   * Écrit un visuel dans la bibliothèque et le rattache à son contenu.
   *
   * Un seul point d'écriture pour les trois origines (période, atelier, occasion) :
   * c'est ce qui garantit qu'aucun visuel ne se retrouve orphelin — le défaut qui
   * rendait les visuels de la V1 inatteignables dès que le calendrier changeait.
   */
  private async persistVisual(userId: string, projectId: string, visual: Flyer): Promise<void> {
    await this.patchCommunication(userId, projectId, (existing) => {
      const visuals = [...(existing.visuals || existing.flyers || []), visual];
      const plans = visual.contentId
        ? (existing.plans || []).map((plan) => ({
            ...plan,
            items: plan.items.map((item) =>
              item.id === visual.contentId
                ? { ...item, flyerIds: Array.from(new Set([...(item.flyerIds || []), visual.id])) }
                : item
            ),
          }))
        : existing.plans;
      return { ...existing, visuals, plans };
    });
  }

  /**
   * Le `ContentIdea` éphémère d'un visuel d'atelier.
   *
   * Il n'est jamais persisté : il ne sert qu'à faire parler le brief de
   * l'utilisateur dans le langage de `composeFlyer`. L'intention est déduite du
   * texte quand l'atelier ne l'a pas décidée.
   */
  private syntheticContent(
    id: string,
    brief: string,
    intent: VisualIntent | undefined,
    format: FlyerFormat
  ): ContentIdea {
    return {
      id,
      title: brief.slice(0, 120),
      hook: '',
      description: brief,
      format: format === 'story' ? 'story' : 'post',
      channel: 'instagram',
      scheduledFor: new Date().toISOString().slice(0, 10),
      week: 0,
      hashtags: [],
      // Volontairement vide : le CTA vit dans la légende, jamais sur le visuel.
      callToAction: '',
      intent: intent || this.inferVisualIntent({ title: brief, description: brief }),
      status: 'idea',
      flyerIds: [],
    };
  }

  // --------------------------------------------------------------------------
  // 5bis. Moments — timely, one-off, occasion-driven content
  // --------------------------------------------------------------------------

  /**
   * Suggest a short list of upcoming occasions relevant to the brand (national
   * holidays of the project country, awareness days, hiring, anniversary, promos).
   * Cached per project + month so we never pay for it twice in a billing cycle.
   */
  /**
   * @deprecated Conservé pour l'ancienne route `moments/suggestions`. Délègue à
   * `getOccasions` sur une fenêtre de 8 semaines — l'ancien comportement, mais
   * par le chemin qui sait aussi répondre pour une période à venir.
   */
  async getMomentSuggestions(
    userId: string,
    projectId: string,
    opts: { force?: boolean } = {}
  ): Promise<MomentSuggestion[]> {
    const from = new Date().toISOString().slice(0, 10);
    return this.getOccasions(userId, projectId, from, addDays(from, 56), opts);
  }

  /**
   * Turn an occasion (from a suggestion or a free-form request) into a stored
   * MomentIdea with a ready-to-publish caption. The visual is generated later,
   * on demand, through the shared generateFlyer() pipeline (a moment IS a
   * ContentIdea, so it reuses everything).
   */
  async createMoment(
    userId: string,
    projectId: string,
    input: {
      occasion: string;
      occasionDate?: string;
      message?: string;
      intent?: VisualIntent;
      channel?: ContentIdea['channel'];
      source?: 'suggestion' | 'custom';
    }
  ): Promise<MomentIdea> {
    if (!input.occasion || !input.occasion.trim()) {
      throw new Error('An occasion is required to create a moment');
    }
    const context = await this.extractContext(userId, projectId);
    const intent =
      input.intent || this.inferVisualIntent({ title: input.occasion, description: input.message });
    const channel =
      toContentChannel(input.channel) || toContentChannels(context.channels)[0] || 'linkedin';

    const systemPrompt = AGENT_MOMENT_CONTENT_PROMPT.replace(
      /\{\{LANGUAGE\}\}/g,
      context.language || 'fr'
    );
    const messages: AIChatMessage[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: JSON.stringify({
          BRAND: {
            name: context.brandName,
            businessType: context.businessType,
            tone: context.tone,
            keywords: context.keywords,
            targetAudience: context.targetAudience,
            language: context.language,
          },
          OCCASION: { label: input.occasion, date: input.occasionDate },
          MESSAGE: input.message || '',
          INTENT: intent,
          CHANNEL: channel,
        }),
      },
    ];
    const raw = await this.promptService.runPrompt(
      promptConfigFor(AI_CONFIG.communication.moment, userId),
      messages
    );
    const parsed =
      this.safeJson<{
        title: string;
        hook: string;
        description: string;
        caption: string;
        hashtags: string[];
        callToAction: string;
      }>(raw) ?? ({} as Record<string, never>);

    const moment: MomentIdea = {
      id: `moment-${Date.now().toString(36)}-${crypto.randomInt(1e6).toString(36)}`,
      title: parsed.title || input.occasion,
      hook: parsed.hook || '',
      description: parsed.description || input.message || '',
      caption: parsed.caption || '',
      format: 'post',
      channel,
      scheduledFor: input.occasionDate || new Date().toISOString().slice(0, 10),
      week: 0,
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.slice(0, 6) : [],
      callToAction: parsed.callToAction || '',
      intent,
      status: 'idea',
      flyerIds: [],
      occasion: input.occasion,
      occasionDate: input.occasionDate,
      source: input.source || 'custom',
    };

    // Un « moment » n'est plus un type à part : c'est un contenu porteur d'une
    // occasion, rangé dans une période dédiée. Sans cela il vivrait hors de
    // toute période et resterait invisible dans la nouvelle interface.
    const plan = await this.ensureOccasionsPlan(userId, projectId, moment.scheduledFor);
    const item = await this.addPlanItem(userId, projectId, plan.id, {
      ...moment,
      title: moment.title,
    });
    return { ...moment, ...(item || {}), occasion: moment.occasion, source: moment.source };
  }

  // --------------------------------------------------------------------------
  // 5ter. Publishing (assisted — no OAuth in phase 1)
  // --------------------------------------------------------------------------

  /**
   * Prepare an assisted publication for a content/moment on a given network:
   * builds the caption, resolves the visual, produces a deep link to the network
   * composer, and stores a Publication in the queue. Returns the record plus the
   * assisted-share payload the UI needs (deep link + caption + image).
   */
  async preparePublication(
    userId: string,
    projectId: string,
    input: { contentId: string; network: SocialNetwork; flyerId?: string; scheduledFor?: string }
  ): Promise<{ publication: Publication; share: AssistedShare }> {
    const communication = await this.getCommunication(userId, projectId);
    const located = this.findContent(communication, input.contentId);
    if (!located) {
      throw new Error(`Content not found: ${input.contentId}`);
    }
    const { content } = located;

    const connector = getSocialConnector(input.network);
    const { caption, hashtags } = this.buildPublishCaption(content);
    const library = this.visualsOf(communication);
    const flyer = input.flyerId
      ? library.find((visual) => visual.id === input.flyerId)
      : library.filter((visual) => visual.contentId === content.id).slice(-1)[0];
    // Signée à la volée : une publication préparée avant la mise en place des
    // jetons porte encore une URL non signée, que le réseau social ne pourrait
    // plus charger.
    const imageUrl = flyer ? signedVisualImageUrl(projectId, flyer.id) : undefined;

    const share = connector.buildAssistedShare({ caption, hashtags, imageUrl });

    const publication: Publication = {
      id: `pub-${Date.now().toString(36)}-${crypto.randomInt(1e6).toString(36)}`,
      contentId: content.id,
      network: input.network,
      status: input.scheduledFor ? 'scheduled' : 'draft',
      caption,
      hashtags,
      imageUrl,
      flyerId: flyer?.id,
      shareUrl: share.shareUrl,
      scheduledFor: input.scheduledFor,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.patchCommunication(userId, projectId, (existing) => {
      const withPub = { ...existing, publications: [...(existing.publications || []), publication] };
      return input.scheduledFor
        ? this.reflectContentStatus(withPub, content.id, 'scheduled')
        : withPub;
    });

    return { publication, share };
  }

  /** Update a queued publication (schedule, mark published, set external url). */
  async updatePublication(
    userId: string,
    projectId: string,
    publicationId: string,
    patch: { status?: PublicationStatus; externalUrl?: string; scheduledFor?: string }
  ): Promise<Publication | null> {
    let updated: Publication | null = null;
    await this.patchCommunication(userId, projectId, (existing) => {
      const publications = (existing.publications || []).map((p) => {
        if (p.id !== publicationId) return p;
        updated = {
          ...p,
          ...patch,
          publishedAt:
            patch.status === 'published'
              ? p.publishedAt || new Date().toISOString()
              : p.publishedAt,
          updatedAt: new Date(),
        };
        return updated;
      });
      let next: CommunicationModel = { ...existing, publications };
      if (updated) {
        next = this.reflectContentStatus(next, updated.contentId, this.contentStatusFor(updated.status));
      }
      return next;
    });
    return updated;
  }

  /** Compose the caption to publish for a content idea or moment. */
  private buildPublishCaption(content: ContentIdea): { caption: string; hashtags: string[] } {
    const hashtags = Array.isArray(content.hashtags) ? content.hashtags : [];
    const momentCaption = (content as MomentIdea).caption;
    let base =
      momentCaption && momentCaption.trim()
        ? momentCaption.trim()
        : [content.hook, content.description].filter(Boolean).join('\n\n');
    const tagLine = hashtags.map((t) => `#${String(t).replace(/^#/, '')}`).join(' ');
    if (tagLine && !base.includes('#')) {
      base = `${base}\n\n${tagLine}`;
    }
    return { caption: base, hashtags };
  }

  private contentStatusFor(status: PublicationStatus): ContentIdea['status'] {
    if (status === 'published') return 'published';
    if (status === 'scheduled') return 'scheduled';
    return 'approved';
  }

  /** Reflect a publication status onto the owning content (calendar or moment). */
  private reflectContentStatus(
    model: CommunicationModel,
    contentId: string,
    status: ContentIdea['status']
  ): CommunicationModel {
    return {
      ...model,
      plans: (model.plans || []).map((plan) => ({
        ...plan,
        items: plan.items.map((item) => (item.id === contentId ? { ...item, status } : item)),
      })),
    };
  }

  // --------------------------------------------------------------------------
  // 6. Get Flyer Image (On-the-fly rendering + cache)
  // --------------------------------------------------------------------------

  /**
   * Clé du PNG rendu. `v2` : le rendu corrige désormais la déclinaison du logo
   * par mesure du contraste. Sans changer la clé, les PNG déjà en cache (24 h)
   * resteraient servis avec l'ancien logo illisible.
   */
  private flyerImageCacheKey(projectId: string, flyerId: string): string {
    return cacheService.generateAIKey('flyer-img', 'public', projectId, `${flyerId}:v2`);
  }

  /**
   * Oublie le PNG rendu d'un visuel. À appeler après TOUTE modification de son
   * HTML : `imageUrl` ne change jamais (c'est l'URL de l'endpoint de rendu), donc
   * sans cette invalidation l'utilisateur continuerait de voir l'ancienne image
   * pendant 24 h, ses retouches apparemment perdues.
   */
  private async invalidateFlyerImage(projectId: string, flyerId: string): Promise<void> {
    await cacheService.delete(this.flyerImageCacheKey(projectId, flyerId), { prefix: 'flyer' });
  }

  async getFlyerImage(projectId: string, flyerId: string): Promise<Buffer> {
    const cacheKey = this.flyerImageCacheKey(projectId, flyerId);
    const cachedBase64 = await cacheService.get<string>(cacheKey, { prefix: 'flyer', ttl: 86400 });
    if (cachedBase64) {
      return Buffer.from(cachedBase64, 'base64');
    }

    // Use findOne instead of findById to bypass the repository cache.
    // The cache key used by findById('projects') is disjoint from the cache
    // invalidated during patchCommunication('users/userId/projects').
    const project = await this.projectRepository.findOne({ _id: projectId }, 'projects');
    if (!project) throw new Error(`Project not found: ${projectId}`);
    
    const communication = (project.analysisResultModel as any)?.communication;
    const library: any[] = communication?.visuals || communication?.flyers || [];
    const flyer = library.find((f: any) => f.id === flyerId);
    if (!flyer || !flyer.html) {
      const availableFlyers = library.map((f: any) => f.id);
      logger.error(`Flyer not found or missing HTML: ${flyerId}`, { availableFlyers, flyerId, projectId });
      throw new Error(`Flyer not found or missing HTML: ${flyerId}`);
    }

    const branding = (project.analysisResultModel as any)?.branding;
    const typography = branding?.typography;

    // Le logo réellement placé par le modèle, plus la table des déclinaisons :
    // le rendu doit pouvoir RECONNAÎTRE le logo (mise à l'échelle) et le
    // REMPLACER par la bonne polarité si le contraste mesuré est insuffisant.
    const logoSummary = summarizeLogoForPrompt(branding?.logo);
    const logos: LogoDeclensionSet = {
      used: typeof flyer.logoUsed === 'string' ? flyer.logoUsed : undefined,
      primary: logoSummary?.urls.primary,
      icon: logoSummary?.urls.icon,
      withText: logoSummary?.urls.withText,
      iconOnly: logoSummary?.urls.iconOnly,
    };

    // Pas de graine ici — elle n'est pas persistée : le contrôle mesure alors
    // sur la grille neutre du format (mêmes marges, mêmes colonnes). En
    // pratique le balisage stocké a déjà été contrôlé à la composition, et
    // cette passe ne rattrape que les retouches faites depuis dans l'éditeur.
    const buffer = await flyerRenderService.renderFlyerToPng(
      flyer.html,
      flyer.format,
      typography,
      logos,
      {
        // `colors.colors` et non `colors` : la charte est imbriquée d'un cran
        // de plus qu'il n'y paraît. Le rapport financier a longtemps lu
        // `colors.primary`, n'a donc jamais rien trouvé, et tous les projets
        // sortaient avec la palette par défaut d'IDEM sans que personne ne le
        // voie (cf. checkSectionRenderer, contrôle 6).
        palette: {
          primary: branding?.colors?.colors?.primary,
          secondary: branding?.colors?.colors?.secondary,
          accent: branding?.colors?.colors?.accent,
          background: branding?.colors?.colors?.background,
          text: branding?.colors?.colors?.text,
        },
        label: `visuel/${flyer.format}`,
      }
    );
    await cacheService.set(cacheKey, buffer.toString('base64'), { prefix: 'flyer', ttl: 86400 });

    return buffer;
  }

  // --------------------------------------------------------------------------
  // 7. Flyer editing (WYSIWYG editor + AI retouch)
  //
  // Même logique que les trois documents (business plan, pitch deck, charte) :
  // le HTML est la source de vérité, l'éditeur le renvoie tel quel, et l'IA
  // retouche la même chaîne. La seule différence tient au support : un visuel
  // n'est pas une section de `analysisResultModel`, il vit dans
  // `communication.flyers[]` et son rendu est un PNG produit à la demande — d'où
  // l'invalidation du cache image à chaque écriture, en lieu et place du cache
  // PDF invalidé par `SectionEditingService`.
  // --------------------------------------------------------------------------

  /** Un visuel du projet, par son id. */
  async getFlyer(userId: string, projectId: string, flyerId: string): Promise<Flyer | null> {
    const communication = await this.getCommunication(userId, projectId);
    const found = this.visualsOf(communication).find((visual) => visual.id === flyerId);
    return found ? this.withSignedUrl(projectId, found) : null;
  }

  /** Sauvegarde le HTML retouché à la main dans l'éditeur WYSIWYG. */
  async updateFlyerHtml(
    userId: string,
    projectId: string,
    flyerId: string,
    html: string
  ): Promise<Flyer | null> {
    const cleaned = sanitizeSectionHtml(html);
    if (!cleaned) {
      logger.warn(`[Communication] Refusing to save an empty HTML for flyer ${flyerId}`);
      return null;
    }

    const existingFlyer = await this.getFlyer(userId, projectId, flyerId);
    if (!existingFlyer) {
      logger.warn(`[Communication] Flyer ${flyerId} not found on updateFlyerHtml`);
      return null;
    }

    const patched = await this.patchCommunication(userId, projectId, (existing) => ({
      ...existing,
      visuals: (existing.visuals || existing.flyers || []).map((visual) =>
        visual.id === flyerId ? { ...visual, html: cleaned, updatedAt: new Date() } : visual
      ),
    }));
    const updated = this.visualsOf(patched).find((visual) => visual.id === flyerId) ?? null;
    if (!updated) {
      logger.warn(`[Communication] Failed to persist flyer ${flyerId}`);
      return null;
    }

    await this.invalidateFlyerImage(projectId, flyerId);
    logger.info(`[Communication] Flyer ${flyerId} updated from the editor`, { projectId });
    return updated;
  }

  /** Retouche IA d'un visuel : renvoie le visuel modifié, déjà persisté. */
  async aiEditFlyer(
    userId: string,
    projectId: string,
    flyerId: string,
    instruction: string,
    language?: SupportedLanguage
  ): Promise<Flyer | null> {
    const communication = await this.getCommunication(userId, projectId);
    const flyer = this.visualsOf(communication).find((visual) => visual.id === flyerId);
    if (!flyer?.html) {
      logger.warn(`[Communication] Flyer ${flyerId} not found (or without HTML) on aiEditFlyer`);
      return null;
    }

    const context = communication?.context ?? (await this.extractContext(userId, projectId));
    const dims = FORMAT_DIMENSIONS[flyer.format] || FORMAT_DIMENSIONS.square;
    // Le SVG brut du logo alourdit la charge utile et invite le modèle à le
    // recopier dans le HTML : seules les URLs de déclinaisons lui servent.
    const { logoSvg, logoUrls, ...brandForPrompt } = context.branding;

    const prompt = buildFlyerEditPrompt({
      instruction,
      currentHtml: flyer.html,
      format: flyer.format,
      width: dims.width,
      height: dims.height,
      minLogoWidth: minLogoWidthFor(flyer.format),
      brandName: context.brandName,
      brandJson: JSON.stringify(brandForPrompt),
      logoUrlsJson: JSON.stringify(logoUrls ?? {}),
      intent: flyer.intent,
      imageContext: flyer.imageAnalysis
        ? `${flyer.imageAnalysis.subject} (${flyer.imageAnalysis.mood}, ${flyer.imageAnalysis.luminance})`
        : undefined,
      artDirectionBlock: buildArtDirectionBlock(context.artDirection, { medium: 'poster' }),
      // Grille neutre du format : la graine du visuel n'est pas persistée, mais
      // la marge, les colonnes et l'échelle typographique ne dépendent que du
      // format — c'est tout ce dont une retouche a besoin pour tomber juste.
      gridBlock: describeGridInvariants(
        defaultGridFor(flyer.format, {
          primary: context.branding.primary,
          secondary: context.branding.secondary,
          accent: context.branding.accent,
          background: context.branding.background,
          text: context.branding.text,
        })
      ),
    });

    const raw = await withAiUsage(
      { userId, projectId, feature: 'communication', element: flyerId, operation: 'edit' },
      () =>
        this.promptService.runPrompt(
          promptConfigFor(AI_CONFIG.communication.flyer, userId, {
            language,
          }),
          [{ role: 'user', content: prompt }]
        )
    );

    // La sortie est du HTML brut (pas de JSON) : un visuel entier transporté
    // dans une chaîne JSON se perd tout entier sur une seule guillemet mal
    // échappée, et l'édition n'a rien d'autre à renvoyer que le HTML.
    const edited = sanitizeSectionHtml(
      this.applyDesignLint(
        this.ensureLogoPresence(
          this.enforceBrandTypography(
            this.stripCtaButtons(this.promptService.getCleanAIText(raw)),
            context
          ),
          context,
          flyer.format
        ),
        context,
        `visuel-edite/${flyer.format}`,
        flyer.imageAnalysis?.dominantColors || []
      )
    );
    if (!edited || !edited.startsWith('<')) {
      logger.warn(`[Communication] AI edit returned no usable HTML for flyer ${flyerId}`);
      return null;
    }

    markRevisionAsAI(`Édition IA – visuel ${flyerId}: ${instruction}`.slice(0, 280));
    const updated = await this.updateFlyerHtml(userId, projectId, flyerId, edited);
    if (updated) {
      logger.info(`[Communication] Flyer ${flyerId} AI-edited`, { projectId, instruction });
    }
    return updated;
  }

  // --------------------------------------------------------------------------
  // Internals
  // --------------------------------------------------------------------------

  private async patchCommunication(
    userId: string,
    projectId: string,
    patcher: (existing: CommunicationModel) => CommunicationModel
  ): Promise<CommunicationModel | null> {
    const project = await this.projectRepository.findById(projectId, this.collection(userId), { bypassCache: true });
    if (!project) {
      logger.error(`patchCommunication: Project ${projectId} not found for user ${userId}`);
      return null;
    }

    const analysis = (project.analysisResultModel as any) || {};
    // Migrer AVANT de patcher : sans cela un patch V2 écrirait ses `plans` à
    // côté d'un `calendar` V1 jamais converti, et les deux se contrediraient.
    const { model: existing } = migrateLegacyCommunication(
      (analysis.communication as CommunicationModel) || {}
    );
    const patched = patcher(existing);

    logger.info(`patchCommunication: updating project ${projectId} with new communication data (flyers count: ${patched.flyers?.length || 0})`);

    const updatedProject = await this.projectRepository.update(
      projectId,
      {
        ...project,
        analysisResultModel: {
          ...analysis,
          communication: patched,
        },
      },
      this.collection(userId)
    );

    if (!updatedProject) {
      logger.error(`patchCommunication: Failed to update project ${projectId} in database`);
    } else {
      logger.info(`patchCommunication: Successfully updated project ${projectId} in database`);
    }

    return updatedProject ? patched : null;
  }

  private buildProjectSummary(project: ProjectModel): string {
    // Intentionally SMALL — we do not send the full business plan.
    const parts = [
      `Project Name: ${project.name}`,
      `Description: ${project.longDescription || project.description}`,
      `Type: ${project.type}`,
      `Scope: ${project.scope}`,
      `Targets: ${project.targets}`,
    ];
    const branding = project.analysisResultModel?.branding;
    if (branding) {
      const primaryColors = branding.colors?.colors;
      parts.push(`Brand Colors: ${primaryColors ? JSON.stringify(primaryColors) : 'unspecified'}`);
      const primaryTypography = branding.typography;
      if (primaryTypography) {
        parts.push(
          `Typography: ${primaryTypography.primaryFont || ''} / ${
            primaryTypography.secondaryFont || ''
          }`
        );
      }
    }
    return parts.join('\n');
  }

  private hashProjectForContext(project: ProjectModel): string {
    const logo = project.analysisResultModel?.branding?.logo as any;
    // Fingerprint the logo declensions so that generating logos AFTER the first
    // context extraction invalidates the cache and re-runs extraction — otherwise
    // context.branding.logoUrls stays empty and visuals never receive the logo.
    const logoFingerprint = logo
      ? {
          primary: logo.assetUrls?.primary,
          icon: logo.assetUrls?.icon,
          withText: logo.assetUrls?.withText,
          iconOnly: logo.assetUrls?.iconOnly,
          hasVariations: !!logo.variations,
          svgLen: (logo.svg || '').length,
        }
      : null;
    return crypto
      .createHash('sha256')
      .update(
        JSON.stringify({
          name: project.name,
          description: project.longDescription || project.description,
          type: project.type,
          scope: project.scope,
          targets: project.targets,
          colors: project.analysisResultModel?.branding?.colors?.colors,
          typo: project.analysisResultModel?.branding?.typography,
          // Changer de direction artistique doit invalider le contexte : sans
          // cela, les visuels continuaient d'être composés sur l'ancien parti
          // pris pendant deux heures.
          artDirection: project.analysisResultModel?.branding?.artDirection?.styleId,
          logo: logoFingerprint,
        })
      )
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Infer the communication purpose of a content idea so the visual composer
   * knows which TONE to hold (atmospheric, factual, celebratory…). It no longer
   * arbitrates a CTA: no visual carries one. Heuristic + multilingual keyword
   * scan, defaulting to 'awareness'.
   */
  private inferVisualIntent(content: {
    intent?: VisualIntent;
    title?: string;
    hook?: string;
    description?: string;
    callToAction?: string;
  }): VisualIntent {
    if (content.intent) return content.intent;
    const haystack = [content.title, content.hook, content.description, content.callToAction]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const has = (words: string[]) => words.some((w) => haystack.includes(w));
    if (has(['recrut', 'hiring', 'we\'re hiring', 'join our', 'join the team', 'postul', 'emploi', 'nous recrutons', 'career', 'carrière', 'offre d\'emploi']))
      return 'recruitment';
    if (has(['promo', 'sale', 'discount', 'offre', 'réduction', 'deal', 'shop now', 'buy', 'order now', 'commande', 'soldes', '% off', '-50', 'code promo']))
      return 'promotion';
    if (has(['launch', 'lance', 'nouveau', 'new ', 'introducing', 'annonce', 'announce', 'disponible', 'now available', 'sortie']))
      return 'announcement';
    if (has(['fête', 'célèbr', 'celebrat', 'anniversa', 'happy ', 'joyeux', 'congrat', 'félicit', 'merci', 'thank you', 'holiday']))
      return 'celebration';
    return 'awareness';
  }

  /**
   * Table de substitution du prompt de composition.
   *
   * Elle porte la CHARTE (hex exacts, familles typographiques, déclinaisons de
   * logo réelles) : ce sont des valeurs, pas des chemins symboliques — le modèle
   * ne doit jamais avoir à deviner une couleur ni à inventer une URL. Toute
   * valeur manquante reçoit un repli explicite plutôt que de laisser un trou.
   */
  private buildFlyerPlaceholders(
    context: CommunicationContext,
    seed: DesignSeed,
    intent: VisualIntent,
    format: FlyerFormat,
    sourced: SourcedImage | null,
    grid: CompositionGrid
  ): Record<string, string> {
    const branding = context.branding;
    const logos = branding.logoUrls;
    const primaryLogo = logos?.primary || '';
    const pickLogo = (url?: string) => (url && url.trim()) || primaryLogo || '(no logo available)';

    return {
      BRAND_NAME: context.brandName,
      BRAND_PRIMARY: branding.primary,
      BRAND_SECONDARY: branding.secondary,
      // Sans accent défini, renvoyer la primaire plutôt qu'un vide : le modèle
      // comblerait un trou de palette par une couleur de son cru.
      BRAND_ACCENT: branding.accent || branding.primary,
      BRAND_BACKGROUND: branding.background || '#ffffff',
      BRAND_TEXT: branding.text || '#0f172a',
      BRAND_PRIMARY_FONT: branding.primaryFont || 'Archivo',
      BRAND_SECONDARY_FONT: branding.secondaryFont || branding.primaryFont || 'IBM Plex Sans',
      // `branding.fontUrl` vient de `typography.url`, qui est un slug : le
      // transmettre tel quel faisait recopier au modèle un <link> mort, et le
      // visuel sortait dans la police système. On construit l'URL réelle.
      BRAND_FONT_URL: brandFontsHref(
        { url: branding.fontUrl, primaryFont: branding.primaryFont, secondaryFont: branding.secondaryFont },
        'https://fonts.googleapis.com/css2?family=Archivo:wght@100..900&display=swap'
      ),

      LOGO_PRIMARY: primaryLogo || '(no logo available)',
      LOGO_WITHTEXT_LIGHT: pickLogo(logos?.withText?.light),
      LOGO_WITHTEXT_DARK: pickLogo(logos?.withText?.dark),
      LOGO_WITHTEXT_MONO: pickLogo(logos?.withText?.mono),
      LOGO_ICON_LIGHT: pickLogo(logos?.iconOnly?.light),
      LOGO_ICON_DARK: pickLogo(logos?.iconOnly?.dark),
      LOGO_ICON_MONO: pickLogo(logos?.iconOnly?.mono),
      // Même seuil que celui appliqué à la mesure au moment du rendu : le
      // modèle est prévenu de la règle qui sera de toute façon imposée.
      LOGO_MIN_WIDTH: String(minLogoWidthFor(format)),

      format,
      VISUAL_INTENT: intent,

      // La direction artistique et la graine sont DÉVELOPPÉES en consignes.
      // Transmettre {"archetype":"D"} revenait à ne rien transmettre : le
      // modèle ignore ce que « D » recouvre, et composait au jugé.
      ART_DIRECTION:
        buildArtDirectionBlock(context.artDirection, { medium: 'poster' }) ||
        '(no art direction defined for this brand — compose from the charter alone)',
      SEED_DIRECTIVES: describeSeed(seed),
      // Le squelette de la composition, en pixels. C'est la seule partie du
      // prompt qui soit VÉRIFIABLE au pixel près après coup : chacun de ces
      // nombres a son contrôle dans `visualAudit.ts`.
      COMPOSITION_GRID: describeCompositionGrid(grid),
      ANTI_SLOP: ANTI_SLOP_BLOCK,
      // Traitement d'image de la marque, à appliquer à la photo de fond.
      AD_IMAGE_TREATMENT:
        buildImageStyleModifier(context.artDirection) ||
        'no mandated treatment — stay consistent with the charter',

      DESIGN_SEED: JSON.stringify(seed, null, 2),
      'DESIGN_SEED.archetype': seed.archetype,
      'DESIGN_SEED.colorStrategy': seed.colorStrategy,
      'DESIGN_SEED.typographyMood': seed.typographyMood,
      'DESIGN_SEED.layoutTension': seed.layoutTension,
      'DESIGN_SEED.spacingMultiplier': String(seed.spacingMultiplier),

      IMAGE_URL: sourced?.url || '(no image — build a purely typographic composition)',
      IMAGE_DOMINANT_COLORS: sourced?.analysis.dominantColors?.join(', ') || 'unknown',
      IMAGE_LUMINANCE: sourced?.analysis.luminance || 'mixed',
      IMAGE_COMPOSITION: sourced?.analysis.composition || 'balanced',
      IMAGE_DETECTED_TEXT: sourced?.analysis.detectedText || 'none',
    };
  }

  /**
   * Substitue les `{{MARQUEURS}}` d'un prompt en un seul passage.
   *
   * Un marqueur absent de la table est laissé tel quel ET signalé : un `{{…}}`
   * qui atteint le modèle est un réglage qu'on croyait transmis et qui ne l'est
   * pas — le genre de bug qui ne casse rien et dégrade tout.
   */
  private applyPlaceholders(template: string, values: Record<string, string>): string {
    const missing = new Set<string>();
    const rendered = template.replace(/\{\{([A-Za-z0-9_.]+)\}\}/g, (match, key: string) => {
      if (key in values) return values[key];
      missing.add(key);
      return match;
    });
    if (missing.size) {
      logger.warn('[Communication] Unresolved placeholders in the flyer prompt', {
        placeholders: [...missing],
      });
    }
    return rendered;
  }

  /**
   * Aplatit une arborescence d'URLs (les déclinaisons de logo sont imbriquées
   * par usage puis par fond) en une simple liste de chaînes.
   */
  private collectStringValues(source: unknown): string[] {
    if (typeof source === 'string') return [source];
    if (!source || typeof source !== 'object') return [];
    return Object.values(source as Record<string, unknown>).flatMap((value) =>
      this.collectStringValues(value)
    );
  }

  private shortHash(data: unknown): string {
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex').substring(0, 16);
  }

  private trendBucketKey(context: CommunicationContext): string {
    // Cache trends per industry bucket, not per project, so multiple users
    // in the same vertical share the signal cache.
    const bucket = (context.businessType || 'generic')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 48);
    return `signals:${bucket}`;
  }

  /**
   * Lit la réponse du compositeur de visuel : un bloc <meta> JSON et un bloc
   * <html> brut.
   *
   * Le repli sur l'ancien contrat (tout en JSON, balisage échappé) est
   * volontaire et durable : les réponses en cache ont été produites sous
   * l'ancien format, et un modèle de repli peut très bien répondre à l'ancienne.
   * Aucune des deux formes ne doit perdre un visuel.
   */
  private parseFlyerResponse(raw: string): Partial<Flyer> {
    const htmlBlock = raw.match(/<html>([\s\S]*?)<\/html>/i);
    const metaBlock = raw.match(/<meta>([\s\S]*?)<\/meta>/i);

    if (htmlBlock) {
      const meta = metaBlock ? (this.safeJson<Partial<Flyer>>(metaBlock[1]) ?? {}) : {};
      return { ...meta, html: htmlBlock[1].trim() };
    }

    // Ancien contrat : tout dans un objet JSON.
    return this.safeJson<Partial<Flyer>>(raw) ?? {};
  }

  private safeJson<T>(raw: string): T | null {
    if (!raw) return null;
    const cleaned = raw
      .replace(/^```(json)?\s*/i, '')
      .replace(/```$/g, '')
      .trim();
    try {
      return JSON.parse(cleaned) as T;
    } catch (err) {
      // Try to recover the first {...} or [...] block.
      const match = cleaned.match(/[\[{][\s\S]*[\]}]/);
      if (match) {
        try {
          return JSON.parse(match[0]) as T;
        } catch {
          /* ignore */
        }
      }
      logger.warn('CommunicationService: failed to parse JSON output', {
        preview: cleaned.slice(0, 200),
      });
      return null;
    }
  }

  private normaliseContentIdea(raw: Partial<ContentIdea>, index: number): ContentIdea {
    const id = raw.id || `content-${index + 1}`;
    return {
      id,
      title: raw.title || 'Untitled content',
      hook: raw.hook || '',
      description: raw.description || '',
      format: (raw.format as ContentIdea['format']) || 'post',
      channel: (raw.channel as ContentIdea['channel']) || 'linkedin',
      scheduledFor:
        raw.scheduledFor ||
        new Date(Date.now() + index * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      week: typeof raw.week === 'number' ? raw.week : Math.floor(index / 3) + 1,
      hashtags: Array.isArray(raw.hashtags) ? raw.hashtags!.slice(0, 6) : [],
      callToAction: raw.callToAction || 'Learn more',
      status: (raw.status as ContentIdea['status']) || 'idea',
      flyerIds: Array.isArray(raw.flyerIds) ? raw.flyerIds : [],
    };
  }

  private fallbackFlyerHtml(
    content: ContentIdea,
    context: CommunicationContext,
    format: FlyerFormat,
    imageUrl?: string
  ): string {
    const size =
      format === 'story'
        ? 'w-[1080px] h-[1920px]'
        : format === 'banner'
          ? 'w-[1200px] h-[630px]'
          : format === 'post'
            ? 'w-[1200px] h-[1500px]'
            : format === 'a4'
              ? 'w-[1240px] h-[1754px]'
              : 'w-[1080px] h-[1080px]';
    const primary = context.branding.primary || '#0ea5e9';
    const secondary = context.branding.secondary || '#0f172a';
    const text = context.branding.text || '#ffffff';
    const bgImage = imageUrl
      ? `<img src="${imageUrl}" class="absolute inset-0 w-full h-full object-cover" /><div class="absolute inset-0 bg-gradient-to-t from-[${secondary}]/90 via-[${secondary}]/40 to-transparent"></div>`
      : '';
    // Pied de page : signature de marque typographique, jamais un bouton — ce
    // repli servait auparavant une pastille contenant le callToAction, ce qui
    // reproduisait dans le fallback le défaut qu'on corrige côté modèle.
    return `<div class="${size} relative overflow-hidden flex flex-col justify-between p-16 bg-[${secondary}] text-[${text}]">${bgImage}<div class="relative text-xs uppercase tracking-[0.3em] opacity-70">${context.brandName}</div><div class="relative flex-1 flex flex-col justify-end gap-6"><div class="text-6xl font-black leading-[1.05] max-w-[80%]">${this.escapeHtml(content.title)}</div><div class="text-lg max-w-[75%] opacity-90">${this.escapeHtml(content.description)}</div></div><div class="relative flex items-end justify-between border-t border-[${text}]/25 pt-6"><div class="text-xs uppercase tracking-[0.35em] opacity-80">${this.escapeHtml(context.brandName)}</div><div class="h-[4px] w-28 bg-[${primary}]"></div></div></div>`;
  }

  /**
   * Ramène la typographie du visuel dans la charte.
   *
   * Le harnais de rendu lie `font-primary`/`font-secondary` aux polices de la
   * marque, mais rien n'empêchait le modèle d'écrire `font-['Anton']` ou un
   * `font-family` en style inline — et d'ajouter le <link> Google Fonts qui va
   * avec. Le visuel sortait alors typographié dans une police que la marque
   * n'utilise nulle part ailleurs.
   *
   * On réécrit donc les familles arbitraires vers les classes de la charte
   * (`font-primary` par défaut : une police choisie à la main sert quasi
   * toujours un titre) et on retire les imports de polices étrangères, devenus
   * inutiles — celui de la marque est injecté par le rendu, pas par le modèle.
   *
   * Les COULEURS ne sont volontairement pas normalisées ici : remplacer un hex
   * hors palette demanderait de deviner l'intention (accent ? traitement de la
   * photo ? dégradé ?), et une substitution mécanique abîmerait la composition
   * plus sûrement qu'une teinte approximative. C'est la charte du prompt qui
   * les tient.
   */
  private enforceBrandTypography(html: string, context: CommunicationContext): string {
    if (!html) return html;

    // L'identité d'une URL Google Fonts est dans sa QUERY (`family=…`), pas dans
    // son chemin : comparer les chemins revient à trouver toutes ces URLs
    // identiques, et à laisser passer les polices étrangères.
    const familiesOf = (url: string): string[] =>
      [...url.replace(/&amp;/g, '&').matchAll(/family=([^&:]+)/gi)].map((m) =>
        decodeURIComponent(m[1]).replace(/\+/g, ' ').trim().toLowerCase()
      );
    const brandFamilies = new Set(familiesOf(context.branding.fontUrl || ''));

    // Le `font-family` inline est traité DANS l'attribut style, pour ne pas
    // s'arrêter au premier guillemet d'une famille citée (`'Bebas Neue'`).
    const rewriteStyleAttributes = (input: string, quote: '"' | "'"): string => {
      const pattern = new RegExp(`style\\s*=\\s*${quote}([^${quote}]*)${quote}`, 'gi');
      return input.replace(pattern, (match, body: string) => {
        if (!/font-family/i.test(body)) return match;
        const fixed = body.replace(/font-family\s*:[^;]*/gi, 'font-family: var(--font-primary)');
        return `style=${quote}${fixed}${quote}`;
      });
    };

    let normalised = html
      // font-['Anton'] / font-["Anton"] → police d'affichage de la marque.
      .replace(/\bfont-\[(?:'[^']*'|"[^"]*")\]/g, 'font-primary')
      // Familles génériques de Tailwind : hors charte elles aussi.
      .replace(/\bfont-(?:sans|serif|mono)\b/g, 'font-secondary');
    normalised = rewriteStyleAttributes(normalised, '"');
    normalised = rewriteStyleAttributes(normalised, "'");
    // Imports de polices tierces ajoutés par le modèle. Celui de la marque est
    // injecté par le harnais de rendu : rien n'est perdu à les retirer.
    normalised = normalised.replace(
      /<link\b[^>]*href\s*=\s*["']([^"']*fonts\.googleapis\.com[^"']*)["'][^>]*>/gi,
      (tag, href: string) => {
        const families = familiesOf(String(href));
        const isBrand = families.length > 0 && families.every((f) => brandFamilies.has(f));
        return isBrand ? tag : '';
      }
    );

    if (normalised !== html) {
      logger.info('[Communication] Typographie du visuel réalignée sur la charte');
    }
    return normalised;
  }

  /**
   * Filet déterministe contre le bouton d'appel à l'action.
   *
   * Le prompt l'interdit et la légende n'est plus transmise au compositeur,
   * mais une consigne textuelle ne garantit rien : le visuel part à
   * l'impression ou en publication sans relecture, il faut donc une règle qui
   * ne dépende pas du bon vouloir du modèle.
   *
   * Portée assumée : on ne supprime que ce qui EST un bouton par nature
   * (`<button>`, `role="button"`). Une pastille construite en <div>/<span>
   * n'est pas identifiable sans moteur de rendu — il faudrait comparer les
   * styles calculés — et reste couverte par le seul prompt.
   */
  /**
   * Toutes les URLs de déclinaisons connues pour la marque, dédoublonnées.
   */
  private knownLogoUrls(context: CommunicationContext): string[] {
    const logos = context.branding.logoUrls;
    if (!logos) return [];
    const raw = [
      logos.primary,
      logos.withText?.light,
      logos.withText?.dark,
      logos.withText?.mono,
      logos.iconOnly?.light,
      logos.iconOnly?.dark,
      logos.iconOnly?.mono,
    ].filter((u): u is string => typeof u === 'string' && u.trim().length > 0);
    return [...new Set(raw)];
  }

  /**
   * Garantit qu'un logo RÉEL figure dans le HTML du visuel.
   *
   * Le prompt l'exige déjà, et le rendu sait ensuite corriger sa taille et sa
   * polarité — mais uniquement s'il y a quelque chose à corriger. Deux échecs
   * silencieux restaient possibles : le modèle omet le logo, ou il écrit une
   * URL inventée (un chemin symbolique du type « BRAND.logoUrls.primary », ou
   * une URL plausible qui n'existe pas). Dans les deux cas le visuel sortait
   * sans signature, et aucune mesure au rendu ne pouvait le rattraper.
   *
   * On corrige donc en amont, sur la chaîne HTML — qui est aussi ce que
   * l'éditeur WYSIWYG affichera.
   */
  private ensureLogoPresence(
    html: string,
    context: CommunicationContext,
    format: FlyerFormat
  ): string {
    const urls = this.knownLogoUrls(context);
    if (!urls.length || !html) return html;

    const stripQuery = (value: string) => value.split('?')[0];
    const known = urls.map(stripQuery);
    if (known.some((url) => html.includes(url))) return html;

    // Déclinaison par défaut : la version « avec texte » sur fond clair, ou le
    // logo primaire. La polarité définitive est arbitrée au rendu, par mesure
    // du contraste réel sous le logo.
    const fallbackUrl =
      context.branding.logoUrls?.withText?.light || context.branding.logoUrls?.primary || urls[0];
    const minWidth = minLogoWidthFor(format);
    const brand = this.escapeHtml(context.brandName || 'la marque');

    // 1. Une balise <img> se présente comme le logo mais pointe ailleurs :
    //    c'est l'URL inventée. On la corrige plutôt que d'ajouter un doublon.
    const looksLikeLogo = /<img\b[^>]*(?:alt=["'][^"']*logo|class=["'][^"']*logo|src=["'][^"']*logo)[^>]*>/i;
    const match = html.match(looksLikeLogo);
    if (match) {
      const repaired = match[0].replace(/src=["'][^"']*["']/i, `src="${fallbackUrl}"`);
      logger.warn('[Communication] URL de logo invalide remplacée par une déclinaison réelle', {
        format,
      });
      return html.replace(match[0], repaired);
    }

    // 2. Aucun logo du tout : on en pose un, dans un angle, à la taille
    //    minimale lisible. Une signature imparfaitement placée vaut mieux qu'un
    //    visuel de marque anonyme — et l'utilisateur peut la déplacer dans
    //    l'éditeur.
    const badge = `<img src="${fallbackUrl}" alt="logo ${brand}" class="absolute" style="left:5%;bottom:5%;width:${minWidth}px;height:auto;opacity:1;" />`;
    const lastClose = html.lastIndexOf('</div>');
    logger.warn('[Communication] Aucun logo dans le visuel généré : signature ajoutée', {
      format,
      minWidth,
    });
    return lastClose === -1
      ? `${html}${badge}`
      : `${html.slice(0, lastClose)}${badge}${html.slice(lastClose)}`;
  }

  /**
   * Passe déterministe anti-générique sur le HTML d'un visuel.
   *
   * Corrige ce qui a une bonne réponse unique (couleur hors charte, police
   * écrite en dur, titre en dégradé, image sans alt), journalise le reste. Ne
   * recompose jamais : la mise en page reste celle que le modèle a produite.
   */
  private applyDesignLint(
    html: string,
    context: CommunicationContext,
    label: string,
    /**
     * Teintes dominantes de la photo. Elles sont LÉGITIMES sur un visuel (elles
     * pilotent le duotone, le voile, le filtre) : sans cette liste, la
     * correction les ramènerait à la couleur de charte la plus proche et
     * détruirait les stratégies IMAGE_EXTRACTED et SPLIT_COMPLEMENTARY.
     */
    imageColors: string[] = []
  ): string {
    if (!html) return html;
    const options = {
      palette: {
        primary: context.branding.primary,
        secondary: context.branding.secondary,
        accent: context.branding.accent,
        background: context.branding.background,
        text: context.branding.text,
      },
      fonts: [context.branding.primaryFont, context.branding.secondaryFont].filter(
        (f): f is string => !!f
      ),
      extraAllowedColors: imageColors,
      expectedLogoUrls: this.knownLogoUrls(context),
      styleId: context.artDirection?.styleId,
      label,
    };
    // Réparation déterministe (deux passes) PUIS constat de ce qui résiste.
    // Le verdict du linter était auparavant calculé puis jeté.
    return enforceDesignRules(html, options).html;
  }

  private stripCtaButtons(html: string): string {
    if (!html) return html;
    const cleaned = html
      // Un <button> ne peut pas en contenir un autre : le non-greedy est sûr.
      .replace(/<button\b[^>]*>[\s\S]*?<\/button>/gi, '')
      // Idem pour <a> (imbrication interdite en HTML).
      .replace(/<a\b[^>]*\brole\s*=\s*["']button["'][^>]*>[\s\S]*?<\/a>/gi, '');
    if (cleaned !== html) {
      logger.warn(
        '[Communication] CTA button removed from the generated visual — the model ignored the no-button rule'
      );
    }
    return cleaned;
  }

  /**
   * Tiny LLM call to decide what to search / generate. Returns sensible
   * defaults if parsing fails so the pipeline never blocks on this step.
   */
  private async buildImageBrief(
    userId: string,
    content: ContentIdea,
    context: CommunicationContext,
    format: FlyerFormat,
    /**
     * Grille du visuel. Elle dit OÙ le texte va tomber : sans elle, le brief
     * demandait « une image avec de l'espace pour le texte » sans savoir de
     * quel côté, et la photo revenait avec son sujet précisément là où le
     * titre devait se poser.
     */
    grid?: CompositionGrid
  ): Promise<ImageBrief> {
    const orientation: 'portrait' | 'landscape' | 'square' =
      format === 'banner' ? 'landscape' : format === 'square' ? 'square' : 'portrait';

    try {
      // Le brief d'image décide de 70 % de la surface du visuel : il doit
      // connaître la direction artistique, sans quoi il ramène la photo de
      // banque d'images par défaut, étrangère au reste de la marque.
      const imageryDirection = context.artDirection
        ? [
            `Medium: ${context.artDirection.imagery?.medium || 'photography'}`,
            `Brand subjects: ${context.artDirection.imagery?.subjects || ''}`,
            `Treatment: ${context.artDirection.imagery?.treatment || ''}`,
            `Lighting: ${context.artDirection.imagery?.lighting || ''}`,
            `Framing: ${context.artDirection.imagery?.framing || ''}`,
            `Render modifier (English, reuse it in generationPrompt): ${buildImageStyleModifier(context.artDirection)}`,
          ]
            .filter((line) => line.split(':').slice(1).join(':').trim())
            .join('\n')
        : 'No art direction defined: pick a restrained image, consistent with the charter, and avoid generic illustration imagery.';

      const messages: AIChatMessage[] = [
        {
          role: 'system',
          content: AGENT_IMAGE_BRIEF_PROMPT.replace('{{AD_IMAGERY}}', imageryDirection).replace(
            '{{COMPOSITION_NEED}}',
            grid ? describeImageNeed(grid) : 'The text may land anywhere: keep one calm, uncluttered zone.'
          ),
        },
        {
          role: 'user',
          content: JSON.stringify({
            BRAND: {
              businessType: context.businessType,
              tone: context.tone,
              keywords: context.keywords,
            },
            CONTENT: {
              title: content.title,
              hook: content.hook,
              description: content.description,
              format: content.format,
            },
            FORMAT: format,
          }),
        },
      ];
      const raw = await this.promptService.runPrompt(
        promptConfigFor(AI_CONFIG.communication.imageBrief, userId),
        messages
      );
      const parsed = this.safeJson<Partial<ImageBrief>>(raw) ?? {};
      return {
        searchQuery:
          (parsed.searchQuery && parsed.searchQuery.trim()) ||
          this.fallbackSearchQuery(content, context),
        generationPrompt:
          (parsed.generationPrompt && parsed.generationPrompt.trim()) ||
          this.fallbackGenerationPrompt(content, context),
        // Prompt négatif : celui décidé par l'agent, complété par celui du style
        // retenu. Les deux visent la même chose — écarter les tics de rendu qui
        // signent une image générée.
        negativePrompt: [
          (parsed as any).negativePrompt,
          buildImageNegativePrompt(context.artDirection),
        ]
          .filter(Boolean)
          .join(', '),
        preferGenerated: !!parsed.preferGenerated,
        orientation: (parsed.orientation as ImageBrief['orientation']) || orientation,
      };
    } catch (err: any) {
      logger.warn('buildImageBrief failed, using heuristic brief', { error: err?.message });
      return {
        searchQuery: this.fallbackSearchQuery(content, context),
        generationPrompt: this.fallbackGenerationPrompt(content, context),
        negativePrompt: buildImageNegativePrompt(context.artDirection),
        orientation,
      };
    }
  }

  private fallbackSearchQuery(content: ContentIdea, context: CommunicationContext): string {
    const base = [content.title, ...(context.keywords || []).slice(0, 2)].filter(Boolean).join(' ');
    return base.replace(/[^a-zA-Z0-9 ]+/g, '').slice(0, 60) || context.businessType || 'business';
  }

  /**
   * Repli quand l'agent de brief échoue.
   *
   * Il porte le style de la marque plutôt qu'un « photorealistic editorial »
   * générique : un repli qui ignore la direction artistique produit exactement
   * l'image que le module cherche à éviter, et il sert justement dans les cas
   * dégradés, où personne ne repasse derrière.
   */
  private fallbackGenerationPrompt(content: ContentIdea, context: CommunicationContext): string {
    const style = buildImageStyleModifier(context.artDirection);
    return (
      `Photograph for a ${context.businessType} brand. ` +
      `Subject relates to: ${content.title}. ` +
      `Mood: ${context.tone}. ` +
      (style ? `Render: ${style}. ` : 'Soft natural lighting, restrained color grading. ') +
      `Clean composition with generous negative space in the upper third for overlay text. ` +
      `No on-image typography, no logos, no watermarks, no staged corporate stock scene.`
    );
  }

  private escapeHtml(raw: string): string {
    return (raw || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Graine de composition d'un visuel.
   *
   * Le tirage était libre : deux visuels de la même marque pouvaient sortir en
   * « néon sur fond noir » puis en « luxe minimal », sans parenté. Il est
   * désormais borné par le style de la direction artistique (cf.
   * design/designSeed.ts) — la variété d'un post à l'autre reste entière, mais
   * à l'intérieur de l'univers de la marque.
   *
   * La clé d'entropie est l'IDENTITÉ DU VISUEL, pas l'horloge : deux visuels
   * d'une même marque diffèrent bien entre eux (clés différentes), mais LE MÊME
   * visuel regénéré retrouve sa composition.
   *
   * Sans clé, le tirage était aléatoire à chaque appel — donc non reproductible.
   * Le cache Redis (`generateAIKey`) n'inclut pas la graine : la version servie
   * pouvait donc ne plus correspondre à celle qui avait été composée, et un
   * simple rafraîchissement changeait la mise en page sous les yeux de
   * l'utilisateur.
   */
  private generateDesignSeed(
    context: CommunicationContext,
    entropyKey?: string
  ): DesignSeed {
    return buildDesignSeed(context.artDirection?.styleId, entropyKey);
  }
}
