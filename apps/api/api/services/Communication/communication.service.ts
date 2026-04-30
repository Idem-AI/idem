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
import { GenericService } from '../common/generic.service';
import { AIChatMessage, LLMProvider, PromptConfig, PromptService } from '../prompt.service';
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
  provider: LLMProvider.GEMINI,
  modelName: 'gemini-3-flash-preview',
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
    const project = await this.getProject(projectId, userId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

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
        logger.info(`CommunicationContext cache hit for projectId=${projectId}`);
        return cached;
      }
    }

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

    const raw = await this.promptService.runPrompt(
      { ...DEFAULT_PROMPT_CONFIG, userId, promptType: 'communication_context' },
      messages
    );
    const parsed = this.safeJson<Partial<CommunicationContext>>(raw) ?? {};

    const branding = project.analysisResultModel?.branding;
    const colors = branding?.colors?.colors ?? {
      primary: '#0ea5e9',
      secondary: '#1e293b',
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
        logoSvg: branding?.logo?.svg,
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
    const bucket = this.trendBucketKey(context);
    const cached = await cacheService.get<TrendSignal[]>(bucket, {
      prefix: 'trends',
      ttl: 60 * 60 * 24, // 24h
    });
    if (cached && cached.length > 0) return cached;

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
        promptType: 'communication_trends',
        llmOptions: { maxOutputTokens: 800 },
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
    const communication = await this.getCommunication(userId, projectId);
    const calendar = communication?.calendar;
    const content = calendar?.items.find((i) => i.id === contentId);
    if (!content) {
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
    const systemPrompt = AGENT_FLYER_GENERATION_PROMPT.replace(/\{\{format\}\}/g, format);
    const userPayload: Record<string, unknown> = {
      BRAND: {
        name: context.brandName,
        tone: context.tone,
        colors: context.branding,
      },
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
    }

    const messages: AIChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify(userPayload, null, 2) },
    ];

    const raw = await this.promptService.runPrompt(
      {
        ...DEFAULT_PROMPT_CONFIG,
        userId,
        promptType: 'communication_flyer',
        llmOptions: { maxOutputTokens: 2000 },
      },
      messages
    );
    const parsed = this.safeJson<Partial<Flyer>>(raw) ?? {};

    let html =
      typeof parsed.html === 'string'
        ? parsed.html
        : this.fallbackFlyerHtml(content, context, format, sourced?.url);
    // Substitute the IMAGE_URL placeholder if the model echoed it literally.
    if (sourced?.url) {
      html = html.replace(/\{\{IMAGE_URL\}\}/g, sourced.url);
    }

    // ---- Step 5d: render flyer HTML to PNG ---------------------------------
    let renderedUrl: string | undefined;
    try {
      const rendered = await flyerRenderService.renderFlyerToPng(html, format, {
        userId,
        projectId,
        flyerId,
      });
      renderedUrl = rendered.url;
    } catch (err: any) {
      logger.warn('Flyer PNG render failed, returning HTML-only flyer', {
        error: err?.message,
      });
    }

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
  // Internals
  // --------------------------------------------------------------------------

  private async patchCommunication(
    userId: string,
    projectId: string,
    patcher: (existing: CommunicationModel) => CommunicationModel
  ): Promise<CommunicationModel | null> {
    const project = await this.projectRepository.findById(projectId, this.collection(userId));
    if (!project) return null;

    const analysis = project.analysisResultModel as any;
    const existing: CommunicationModel = analysis?.communication ?? {};
    const patched: CommunicationModel = {
      ...patcher(existing),
      updatedAt: new Date(),
      createdAt: existing.createdAt || new Date(),
    };

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
    if (!updatedProject) return null;
    return patched;
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
}
