import crypto from 'crypto';
import logger from '../../config/logger';
import { ProjectModel } from '../../models/project.model';
import {
  CommunicationContext,
  CommunicationModel,
  CommunicationStrategy,
  ContentIdea,
  EditorialCalendar,
  Flyer,
  FlyerFormat,
  MomentIdea,
  MomentSuggestion,
  Publication,
  PublicationStatus,
  SocialNetwork,
  StrategyBlock,
  TrendSignal,
  VisualIntent,
} from '../../models/communication.model';
import { getSocialConnector } from '../Connectors/social-providers.config';
import { AssistedShare } from '../Connectors/social-connector.interface';
import { cacheService } from '../cache.service';

interface DesignSeed {
  archetype: string;
  colorStrategy: string;
  typographyMood: string;
  layoutTension: string;
  spacingMultiplier: number;
}
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
import { imageSourcingService, ImageBrief, SourcedImage } from './imageSourcing.service';
import { flyerRenderService, minLogoWidthFor } from './flyerRender.service';

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

  async getCommunication(userId: string, projectId: string): Promise<CommunicationModel | null> {
    const project = await this.projectRepository.findById(projectId, this.collection(userId));
    if (!project) return null;
    return (project.analysisResultModel as any)?.communication ?? null;
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

  async updateCalendarItem(
    userId: string,
    projectId: string,
    contentId: string,
    updates: Partial<ContentIdea>
  ): Promise<CommunicationModel | null> {
    return this.patchCommunication(userId, projectId, (existing) => {
      if (!existing.calendar) return existing;
      const items = existing.calendar.items.map((item) =>
        item.id === contentId ? { ...item, ...updates, id: item.id } : item
      );
      return {
        ...existing,
        calendar: {
          ...existing.calendar,
          items,
          updatedAt: new Date(),
        },
      };
    });
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
      valueProposition: parsed.valueProposition || project.description || '',
      targetAudience: parsed.targetAudience || project.targets || '',
      objectives: Array.isArray(parsed.objectives) ? parsed.objectives! : [],
      tone: parsed.tone || 'clear, confident, helpful',
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords! : [],
      channels: Array.isArray(parsed.channels) ? parsed.channels! : ['linkedin', 'instagram'],
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
  // 4. Editorial calendar
  // --------------------------------------------------------------------------

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
    logger.info(`[Communication] Generating calendar`, { userId, projectId, force: opts.force });
    const stream = opts.streamCallback;
    const rhythm = opts.rhythm || 'weekly';
    const horizonWeeks = opts.horizonWeeks || 4;

    await stream?.({ type: 'step-start', step: 'context' });
    const context = await this.extractContext(userId, projectId);
    await stream?.({ type: 'step-complete', step: 'context', payload: context });

    // Use strategy summary if available to keep the token bill low.
    const existing = await this.getCommunication(userId, projectId);
    const strategySummary = existing?.strategy?.summary || '';
    const strategyChannels =
      existing?.strategy?.blocks?.find((b) => b.kind === 'channels')?.body || '';

    const cacheKey = cacheService.generateAIKey(
      'communication-calendar',
      userId,
      projectId,
      this.shortHash({ context, rhythm, horizonWeeks, strategySummary })
    );
    if (!opts.force) {
      const cached = await cacheService.get<EditorialCalendar>(cacheKey, {
        prefix: 'ai',
        ttl: 7200,
      });
      if (cached) {
        await stream?.({ type: 'step-complete', step: 'calendar', payload: cached });
        return cached;
      }
    }

    await stream?.({ type: 'step-start', step: 'calendar' });
    const startDate = new Date().toISOString().slice(0, 10);
    const systemPrompt = AGENT_EDITORIAL_CALENDAR_PROMPT.replace(/\{\{rhythm\}\}/g, rhythm)
      .replace(/\{\{horizonWeeks\}\}/g, String(horizonWeeks))
      .replace(/\{\{startDate\}\}/g, startDate);

    const messages: AIChatMessage[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content:
          'CONTEXT:\n' +
          JSON.stringify(context) +
          '\n\nSTRATEGY SUMMARY:\n' +
          strategySummary +
          '\n\nCHANNELS BLOCK:\n' +
          strategyChannels,
      },
    ];
    const raw = await this.promptService.runPrompt(
      promptConfigFor(AI_CONFIG.communication.calendar, userId),
      messages
    );
    const parsed = this.safeJson<EditorialCalendar>(raw);

    const calendar: EditorialCalendar = {
      rhythm: (parsed?.rhythm as EditorialCalendar['rhythm']) || rhythm,
      horizonWeeks: parsed?.horizonWeeks || horizonWeeks,
      items: Array.isArray(parsed?.items)
        ? parsed!.items.map((item, idx) => this.normaliseContentIdea(item, idx))
        : [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await cacheService.set(cacheKey, calendar, { prefix: 'ai', ttl: 7200 });
    await this.patchCommunication(userId, projectId, (existing) => ({
      ...existing,
      calendar,
    }));
    await stream?.({ type: 'step-complete', step: 'calendar', payload: calendar });
    return calendar;
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
    // A visual can be requested for a calendar item OR a one-off moment — both are
    // ContentIdea, so the whole composition pipeline is shared.
    const content =
      communication?.calendar?.items.find((i) => i.id === contentId) ||
      communication?.moments?.find((m) => m.id === contentId);
    if (!content) {
      logger.error(`[Communication] Content idea not found`, { contentId });
      throw new Error(`Content idea not found: ${contentId}`);
    }
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

    // ---- Step 5a: image brief (tiny LLM call) -------------------------------
    const brief = await this.buildImageBrief(userId, content, context, format);

    // ---- Step 5b: source the image (stock first, generate fallback) + scan -
    const flyerId = `flyer-${contentId}-${format}-${Date.now().toString(36)}`;
    let sourced: SourcedImage | null = null;
    try {
      sourced = await imageSourcingService.sourceImage(brief, {
        userId,
        projectId,
        tag: flyerId,
      });
    } catch (err: any) {
      logger.warn('Flyer image sourcing failed, falling back to text-only flyer', {
        error: err?.message,
      });
    }

    // ---- Step 5c: composition (copy + HTML coherent with the image) --------
    const seed = this.generateDesignSeed();
    const intent = this.inferVisualIntent(content);
    // Un SEUL passage de substitution, piloté par une table exhaustive : les
    // remplacements en cascade laissaient passer des marqueurs non résolus
    // ({{DESIGN_SEED.archetype}}, {{IMAGE_DOMINANT_COLORS}}…) que le modèle
    // recevait littéralement — au mieux du bruit, au pire une consigne illisible
    // là où on croyait lui donner la charte.
    const systemPrompt = this.applyPlaceholders(
      AGENT_FLYER_GENERATION_PROMPT,
      this.buildFlyerPlaceholders(context, seed, intent, format, sourced)
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
      promptConfigFor(AI_CONFIG.communication.flyer, userId, {
        // Budget délibéré (cf. ai.config.ts) : le raisonnement de direction
        // artistique est décompté de maxOutputTokens, et un HTML tronqué ne
        // produit aucun visuel. Le plafond global reste actif ailleurs.
        bypassOutputTokenCap: true,
      }),
      messages
    );
    const parsed = this.safeJson<Partial<Flyer>>(raw) ?? {};

    let html =
      typeof parsed.html === 'string'
        ? this.enforceBrandTypography(this.stripCtaButtons(parsed.html), context)
        : this.fallbackFlyerHtml(content, context, format, sourced?.url);

    // Note: We no longer need the post-processing regex replace for {{IMAGE_URL}} 
    // because we correctly populate the system prompt now. The AI will see 
    // the real URL. We keep the logic clean and rely on the prompt quality.

    // Return the URL to our on-the-fly render endpoint.
    const port = process.env.PORT || '3001';
    const apiUrl = process.env.API_URL || `http://localhost:${port}`;
    const renderedUrl = `${apiUrl}/project/communication/${projectId}/flyer/${flyerId}/image`;

    // Aucun CTA sur le visuel, quelle que soit l'intention. L'ancienne règle
    // « CTA si promotion/recrutement » laissait passer un bouton sur une part
    // des visuels ; or un post social n'est pas une landing page, et le bouton
    // dessiné dans une image n'est même pas cliquable. L'appel à l'action vit
    // dans la LÉGENDE (`content.callToAction`, publiée avec le post).
    const flyer: Flyer = {
      id: flyerId,
      contentId,
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

    // Persist the flyer AND link its id on the owning ContentIdea, whether it
    // lives in the calendar or in the moments list.
    await this.patchCommunication(userId, projectId, (existing) => {
      const nextFlyers = [...(existing.flyers || []), flyer];
      const linkFlyer = <T extends ContentIdea>(it: T): T =>
        it.id === contentId ? { ...it, flyerIds: [...(it.flyerIds || []), flyer.id] } : it;
      const nextCalendar = existing.calendar
        ? {
            ...existing.calendar,
            items: existing.calendar.items.map(linkFlyer),
            updatedAt: new Date(),
          }
        : existing.calendar;
      const nextMoments = existing.moments ? existing.moments.map(linkFlyer) : existing.moments;
      return { ...existing, flyers: nextFlyers, calendar: nextCalendar, moments: nextMoments };
    });

    return flyer;
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
  // 5bis. Moments — timely, one-off, occasion-driven content
  // --------------------------------------------------------------------------

  /**
   * Suggest a short list of upcoming occasions relevant to the brand (national
   * holidays of the project country, awareness days, hiring, anniversary, promos).
   * Cached per project + month so we never pay for it twice in a billing cycle.
   */
  async getMomentSuggestions(
    userId: string,
    projectId: string,
    opts: { force?: boolean } = {}
  ): Promise<MomentSuggestion[]> {
    const context = await this.extractContext(userId, projectId);
    const project = await this.getProject(projectId, userId);
    const country = (project as any)?.additionalInfos?.country || '';
    const today = new Date().toISOString().slice(0, 10);

    const cacheKey = cacheService.generateAIKey(
      'communication-moment-suggestions',
      userId,
      projectId,
      this.shortHash({ businessType: context.businessType, country, month: today.slice(0, 7) })
    );
    if (!opts.force) {
      const cached = await cacheService.get<MomentSuggestion[]>(cacheKey, { prefix: 'ai', ttl: 7200 });
      if (cached && cached.length) return cached;
    }

    const messages: AIChatMessage[] = [
      { role: 'system', content: AGENT_MOMENT_SUGGESTIONS_PROMPT },
      {
        role: 'user',
        content: JSON.stringify({
          businessType: context.businessType,
          keywords: context.keywords,
          tone: context.tone,
          targetAudience: context.targetAudience,
          country,
          today,
        }),
      },
    ];
    const raw = await this.promptService.runPrompt(
      promptConfigFor(AI_CONFIG.communication.momentSuggestions, userId),
      messages
    );
    const parsed = this.safeJson<{ suggestions: Partial<MomentSuggestion>[] }>(raw);
    const suggestions: MomentSuggestion[] = (parsed?.suggestions || [])
      .filter((s) => s && s.occasion)
      .slice(0, 8)
      .map((s, idx) => ({
        id: s.id || `moment-sugg-${idx + 1}`,
        occasion: s.occasion!,
        date: s.date,
        intent: (s.intent as VisualIntent) || 'awareness',
        angle: s.angle || '',
        why: s.why,
        emoji: s.emoji,
      }));

    await cacheService.set(cacheKey, suggestions, { prefix: 'ai', ttl: 7200 });
    await this.patchCommunication(userId, projectId, (existing) => ({
      ...existing,
      momentSuggestions: suggestions,
    }));
    return suggestions;
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
    const channel = input.channel || (context.channels?.[0] as ContentIdea['channel']) || 'linkedin';

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

    await this.patchCommunication(userId, projectId, (existing) => ({
      ...existing,
      moments: [...(existing.moments || []), moment],
    }));
    return moment;
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
    const content =
      communication?.calendar?.items.find((i) => i.id === input.contentId) ||
      communication?.moments?.find((m) => m.id === input.contentId);
    if (!content) {
      throw new Error(`Content not found: ${input.contentId}`);
    }

    const connector = getSocialConnector(input.network);
    const { caption, hashtags } = this.buildPublishCaption(content);
    const flyer = input.flyerId
      ? communication?.flyers?.find((f) => f.id === input.flyerId)
      : communication?.flyers?.filter((f) => f.contentId === content.id).slice(-1)[0];
    const imageUrl = flyer?.imageUrl;

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
    const apply = <T extends ContentIdea>(items?: T[]): T[] | undefined =>
      items?.map((it) => (it.id === contentId ? { ...it, status } : it));
    return {
      ...model,
      calendar: model.calendar
        ? { ...model.calendar, items: apply(model.calendar.items) || model.calendar.items }
        : model.calendar,
      moments: apply(model.moments),
    };
  }

  // --------------------------------------------------------------------------
  // 6. Get Flyer Image (On-the-fly rendering + cache)
  // --------------------------------------------------------------------------

  async getFlyerImage(projectId: string, flyerId: string): Promise<Buffer> {
    const cacheKey = cacheService.generateAIKey('flyer-img', 'public', projectId, flyerId);
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
    const flyer = communication?.flyers?.find((f: any) => f.id === flyerId);
    if (!flyer || !flyer.html) {
      const availableFlyers = communication?.flyers?.map((f: any) => f.id) || [];
      logger.error(`Flyer not found or missing HTML: ${flyerId}`, { availableFlyers, flyerId, projectId });
      throw new Error(`Flyer not found or missing HTML: ${flyerId}`);
    }

    const branding = (project.analysisResultModel as any)?.branding;
    const typography = branding?.typography;

    // Le logo réellement placé par le modèle d'abord, puis toutes les
    // déclinaisons connues : `logoUsed` peut manquer sur un visuel ancien ou
    // pointer une déclinaison que le rendu doit quand même reconnaître.
    const logoUrls = [
      flyer.logoUsed,
      ...this.collectStringValues(branding?.logo?.assetUrls),
    ].filter((url): url is string => typeof url === 'string' && url.trim().length > 0);

    const buffer = await flyerRenderService.renderFlyerToPng(
      flyer.html,
      flyer.format,
      typography,
      logoUrls
    );
    await cacheService.set(cacheKey, buffer.toString('base64'), { prefix: 'flyer', ttl: 86400 });

    return buffer;
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
    const existing = (analysis.communication as CommunicationModel) || {};
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
      `Description: ${project.description}`,
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
          description: project.description,
          type: project.type,
          scope: project.scope,
          targets: project.targets,
          colors: project.analysisResultModel?.branding?.colors?.colors,
          typo: project.analysisResultModel?.branding?.typography,
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
    sourced: SourcedImage | null
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
      BRAND_PRIMARY_FONT: branding.primaryFont || 'Montserrat',
      BRAND_SECONDARY_FONT: branding.secondaryFont || branding.primaryFont || 'Montserrat',
      BRAND_FONT_URL:
        branding.fontUrl ||
        'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&display=swap',

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
    format: FlyerFormat
  ): Promise<ImageBrief> {
    const orientation: 'portrait' | 'landscape' | 'square' =
      format === 'banner' ? 'landscape' : format === 'square' ? 'square' : 'portrait';

    try {
      const messages: AIChatMessage[] = [
        { role: 'system', content: AGENT_IMAGE_BRIEF_PROMPT },
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
        preferGenerated: !!parsed.preferGenerated,
        orientation: (parsed.orientation as ImageBrief['orientation']) || orientation,
      };
    } catch (err: any) {
      logger.warn('buildImageBrief failed, using heuristic brief', { error: err?.message });
      return {
        searchQuery: this.fallbackSearchQuery(content, context),
        generationPrompt: this.fallbackGenerationPrompt(content, context),
        orientation,
      };
    }
  }

  private fallbackSearchQuery(content: ContentIdea, context: CommunicationContext): string {
    const base = [content.title, ...(context.keywords || []).slice(0, 2)].filter(Boolean).join(' ');
    return base.replace(/[^a-zA-Z0-9 ]+/g, '').slice(0, 60) || context.businessType || 'business';
  }

  private fallbackGenerationPrompt(content: ContentIdea, context: CommunicationContext): string {
    return (
      `Photorealistic editorial photograph for a ${context.businessType} brand. ` +
      `Subject relates to: ${content.title}. ` +
      `Mood: ${context.tone}. Soft natural lighting, clean composition with negative ` +
      `space for overlay text. No on-image typography, no logos, no watermarks.`
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
   * Generates a deterministic design "seed" that forces archetype diversity.
   */
  private generateDesignSeed(): DesignSeed {
    const archetypes = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
    const colorStrategies = [
      'MONOCHROME_ACCENT', // One dominant color + one vivid accent only
      'SPLIT_COMPLEMENTARY', // Brand color + its two split-complementary image tones
      'DUOTONE', // Two colors only: brand primary + near-black or near-white
      'IMAGE_EXTRACTED', // Pull 2 dominant colors FROM the image analysis
      'INVERSE', // Invert expected luminance logic (dark on light image, etc.)
      'BRAND_FULL', // Use full brand palette including secondary/accent
    ];
    const typographyMoods = [
      'CONDENSED_TOWER', // Very tall narrow letters, stacked vertically
      'WIDE_WHISPER', // Ultra-wide tracking on a small word, massive presence
      'WEIGHT_CLASH', // Extra-bold headline + ultra-thin subheadline
      'SINGLE_LETTER_ANCHOR', // One giant letter (drop cap style) as visual anchor
      'ALL_LOWERCASE_INTIMATE', // Deliberate lowercase for warmth/intimacy
      'ROTATED_AXIS', // Key word rotated 90° or -15° to break the grid
      'OUTLINE_FILLED_MIX', // Some words outlined, some filled
      'STAGGERED_INDENT', // Each line indented progressively (staircase effect)
    ];
    const layoutTensions = [
      'TEXT_ESCAPES_BOUNDS', // Headline partially bleeds outside the container
      'DIAGONAL_FLOW', // Main axis is 30–45° diagonal, not horizontal/vertical
      'RULE_HEAVY', // Thick horizontal/vertical rules divide the space
      'NEGATIVE_SPACE_HERO', // 60%+ of canvas is intentionally empty
      'CORNER_ANCHOR', // All key elements pinned to one corner, rest is empty
      'FULL_BLEED_EDGE', // Image or color block touches ALL four edges
      'FRAME_WITHIN_FRAME', // Thin inset border creates inner frame
      'COLLAGE_LAYER', // 3+ layered elements at varying opacities
    ];

    // Use a CSPRNG so two visuals generated within the same second still differ
    // (the old Date.now()-based pick produced near-identical seeds in bursts).
    const pick = <T>(arr: T[]): T => arr[crypto.randomInt(arr.length)];

    return {
      archetype: pick(archetypes),
      colorStrategy: pick(colorStrategies),
      typographyMood: pick(typographyMoods),
      layoutTension: pick(layoutTensions),
      // Extra entropy: random odd number for spacing/sizing decisions
      spacingMultiplier: crypto.randomInt(5) * 2 + 3, // 3,5,7,9,11
    };
  }
}
