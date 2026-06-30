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
  StrategyBlock,
  TrendSignal,
} from '../../models/communication.model';
import { cacheService } from '../cache.service';

interface DesignSeed {
  archetype: string;
  colorStrategy: string;
  typographyMood: string;
  layoutTension: string;
  spacingMultiplier: number;
}
import { GenericService } from '../common/generic.service';
import { AIChatMessage, LLMProvider, PromptConfig, PromptService } from '../prompt.service';
import { AI_CONFIG } from '../../config/ai.config';
import { AGENT_COMMUNICATION_STRATEGY_PROMPT } from './prompts/agent-communication-strategy.prompt';
import { AGENT_CONTEXT_EXTRACTION_PROMPT } from './prompts/agent-context-extraction.prompt';
import { AGENT_EDITORIAL_CALENDAR_PROMPT } from './prompts/agent-editorial-calendar.prompt';
import { AGENT_FLYER_GENERATION_PROMPT } from './prompts/agent-flyer-generation.prompt';
import { AGENT_IMAGE_BRIEF_PROMPT } from './prompts/agent-image-brief.prompt';
import { AGENT_TRENDS_SUMMARY_PROMPT } from './prompts/agent-trends-summary.prompt';
import { imageSourcingService, ImageBrief, SourcedImage } from './imageSourcing.service';
import { flyerRenderService } from './flyerRender.service';

export type CommunicationStreamEvent =
  | { type: 'step-start'; step: string }
  | { type: 'step-complete'; step: string; payload: any }
  | { type: 'complete'; payload: CommunicationModel }
  | { type: 'error'; message: string };

const DEFAULT_PROMPT_CONFIG: PromptConfig = {
  provider: AI_CONFIG.communication.default.provider,
  modelName: AI_CONFIG.communication.default.modelName,
};

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
      { ...DEFAULT_PROMPT_CONFIG, userId, promptType: 'communication_context' },
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
        logoUrls: branding?.logo
          ? {
              primary: branding.logo.svg,
              withText: branding.logo.variations?.withText
                ? {
                    light: branding.logo.variations.withText.lightBackground,
                    dark: branding.logo.variations.withText.darkBackground,
                    mono: branding.logo.variations.withText.monochrome,
                  }
                : undefined,
              iconOnly: branding.logo.variations?.iconOnly
                ? {
                    light: branding.logo.variations.iconOnly.lightBackground,
                    dark: branding.logo.variations.iconOnly.darkBackground,
                    mono: branding.logo.variations.iconOnly.monochrome,
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
      {
        ...DEFAULT_PROMPT_CONFIG,
        userId,
        promptType: AI_CONFIG.communication.trends.promptType,
        llmOptions: { ...AI_CONFIG.communication.trends.llmOptions },
      },
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
      { ...DEFAULT_PROMPT_CONFIG, userId, promptType: 'communication_strategy' },
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
      { ...DEFAULT_PROMPT_CONFIG, userId, promptType: 'communication_calendar' },
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
    const calendar = communication?.calendar;
    const content = calendar?.items.find((i) => i.id === contentId);
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
    let systemPrompt = AGENT_FLYER_GENERATION_PROMPT.replace(/\{\{format\}\}/g, format).replace(
      /\{\{DESIGN_SEED\}\}/g,
      JSON.stringify(seed, null, 2)
    );

    // Inject brand colors and fonts into the system prompt
    systemPrompt = systemPrompt
      .replace(/\{\{BRAND\.colors\.primary\}\}/g, context.branding.primary)
      .replace(/\{\{BRAND\.colors\.text\}\}/g, context.branding.text || '#000000')
      .replace(/\{\{BRAND\.branding\.fontUrl\}\}/g, context.branding.fontUrl || 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&display=swap')
      .replace(/\{\{BRAND\.branding\.primaryFont\}\}/g, context.branding.primaryFont || 'Montserrat')
      .replace(/\{\{BRAND\.branding\.secondaryFont\}\}/g, context.branding.secondaryFont || 'Montserrat');

    const userPayload: Record<string, unknown> = {
      BRAND: {
        name: context.brandName,
        tone: context.tone,
        branding: context.branding, // Detailed branding including logoUrls
        colors: context.branding, // Legacy path for color placeholders
      },
      DESIGN_SEED: seed,
      CONTENT_IDEA: {
        title: content.title,
        hook: content.hook,
        description: content.description,
        format: content.format,
        channel: content.channel,
        callToAction: content.callToAction,
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

      // Also inject image metadata into the system prompt for better AI context
      systemPrompt = systemPrompt
        .replace(/\{\{IMAGE_URL\}\}/g, sourced.url)
        .replace(/\{\{IMAGE_LUMINANCE\}\}/g, sourced.analysis.luminance)
        .replace(/\{\{IMAGE_COMPOSITION\}\}/g, sourced.analysis.composition || 'balanced');
    }

    const messages: AIChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify(userPayload, null, 2) },
    ];

    const raw = await this.promptService.runPrompt(
      {
        ...DEFAULT_PROMPT_CONFIG,
        userId,
        promptType: AI_CONFIG.communication.flyer.promptType,
        llmOptions: { ...AI_CONFIG.communication.flyer.llmOptions },
      },
      messages
    );
    const parsed = this.safeJson<Partial<Flyer>>(raw) ?? {};

    let html =
      typeof parsed.html === 'string'
        ? parsed.html
        : this.fallbackFlyerHtml(content, context, format, sourced?.url);
    
    // Note: We no longer need the post-processing regex replace for {{IMAGE_URL}} 
    // because we correctly populate the system prompt now. The AI will see 
    // the real URL. We keep the logic clean and rely on the prompt quality.

    // Return the URL to our on-the-fly render endpoint.
    const port = process.env.PORT || '3001';
    const apiUrl = process.env.API_URL || `http://localhost:${port}`;
    const renderedUrl = `${apiUrl}/project/communication/${projectId}/flyer/${flyerId}/image`;

    const flyer: Flyer = {
      id: flyerId,
      contentId,
      format,
      concept: parsed.concept || '',
      layoutNotes: parsed.layoutNotes || '',
      marketingText: {
        headline: parsed.marketingText?.headline || content.title,
        subheadline: parsed.marketingText?.subheadline,
        body: parsed.marketingText?.body || content.description,
        cta: parsed.marketingText?.cta || content.callToAction,
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

    // Persist the flyer AND link its id on the ContentIdea.
    await this.patchCommunication(userId, projectId, (existing) => {
      const nextFlyers = [...(existing.flyers || []), flyer];
      const nextCalendar = existing.calendar
        ? {
            ...existing.calendar,
            items: existing.calendar.items.map((it) =>
              it.id === contentId ? { ...it, flyerIds: [...(it.flyerIds || []), flyer.id] } : it
            ),
            updatedAt: new Date(),
          }
        : existing.calendar;
      return { ...existing, flyers: nextFlyers, calendar: nextCalendar };
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

    const buffer = await flyerRenderService.renderFlyerToPng(flyer.html, flyer.format, typography);
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
        })
      )
      .digest('hex')
      .substring(0, 16);
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
    return `<div class="${size} relative overflow-hidden flex flex-col justify-between p-16 bg-[${secondary}] text-[${text}]">${bgImage}<div class="relative text-xs uppercase tracking-[0.3em] opacity-70">${context.brandName}</div><div class="relative flex-1 flex flex-col justify-end gap-6"><div class="text-6xl font-black leading-[1.05] max-w-[80%]">${this.escapeHtml(content.title)}</div><div class="text-lg max-w-[75%] opacity-90">${this.escapeHtml(content.description)}</div></div><div class="relative flex items-center justify-between"><div class="bg-[${primary}] text-[${secondary}] font-bold px-6 py-3 rounded-full">${this.escapeHtml(content.callToAction)}</div><div class="text-xs opacity-60">${content.channel} · ${content.format}</div></div></div>`;
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
        {
          ...DEFAULT_PROMPT_CONFIG,
          userId,
          promptType: 'communication_image_brief',
          llmOptions: { maxOutputTokens: 400 },
        },
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

    // Rotate based on timestamp bucket (changes every generation)
    const now = Date.now();
    const pick = <T>(arr: T[]): T => arr[Math.floor((now / 1000 + Math.random() * 100) % arr.length)];

    return {
      archetype: pick(archetypes),
      colorStrategy: pick(colorStrategies),
      typographyMood: pick(typographyMoods),
      layoutTension: pick(layoutTensions),
      // Extra entropy: random odd number for spacing/sizing decisions
      spacingMultiplier: (Math.floor(Math.random() * 5) + 1) * 2 + 1, // 3,5,7,9,11
    };
  }
}
