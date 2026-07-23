import crypto from 'crypto';
import { LLMProvider, PromptConfig, PromptService } from '../prompt.service';
import { AI_CONFIG } from '../../config/ai.config';

import { ProjectModel } from '../../models/project.model';
import logger from '../../config/logger';
import { PitchDeckModel } from '../../models/pitchDeck.model';
import { GenericService, IPromptStep, ISectionResult } from '../common/generic.service';
import { SectionModel } from '../../models/section.model';
import { PAGE_FORMATS, PdfService } from '../pdf.service';
import { cacheService } from '../cache.service';

import { SLIDE_COVER_PROMPT } from './prompts/slide-cover.prompt';
import { SLIDE_PROBLEM_PROMPT } from './prompts/slide-problem.prompt';
import { SLIDE_SOLUTION_PROMPT } from './prompts/slide-solution.prompt';
import { SLIDE_MARKET_PROMPT } from './prompts/slide-market.prompt';
import { SLIDE_PRODUCT_PROMPT } from './prompts/slide-product.prompt';
import { SLIDE_BUSINESS_MODEL_PROMPT } from './prompts/slide-business-model.prompt';
import { SLIDE_TRACTION_PROMPT } from './prompts/slide-traction.prompt';
import { SLIDE_COMPETITION_PROMPT } from './prompts/slide-competition.prompt';
import { SLIDE_TEAM_PROMPT } from './prompts/slide-team.prompt';
import { SLIDE_FINANCIALS_PROMPT } from './prompts/slide-financials.prompt';
import { SLIDE_ASK_PROMPT } from './prompts/slide-ask.prompt';
import { imageSourcingService } from '../Communication/imageSourcing.service';

export const PITCH_DECK_SLIDE_ORDER = [
  'Cover',
  'Problem',
  'Solution',
  'Market',
  'Product',
  'Business Model',
  'Traction',
  'Competition',
  'Team',
  'Financials',
  'Ask',
];

export class PitchDeckService extends GenericService {
  private pdfService: PdfService;

  constructor(promptService: PromptService) {
    super(promptService);
    this.pdfService = new PdfService();
    logger.info('PitchDeckService initialized.');
  }

  async generatePitchDeckWithStreaming(
    userId: string,
    projectId: string,
    streamCallback?: (sectionResult: ISectionResult) => Promise<void>,
    forceRegenerate = false,
    targetSections: string[] = []
  ): Promise<ProjectModel | null> {
    logger.info(
      `Generating pitch deck with streaming for userId: ${userId}, projectId: ${projectId}, force: ${forceRegenerate}, targetSections: [${targetSections.join(', ')}]`
    );

    const project = await this.getProject(projectId, userId);
    if (!project) return null;

    const projectDescription =
      this.extractProjectDescription(project) +
      '\n' +
      'Additional infos: ' +
      JSON.stringify(project.additionalInfos || {});

    const contentHash = crypto
      .createHash('sha256')
      .update(
        JSON.stringify({
          name: project.name,
          description: project.description,
          branding: project.analysisResultModel?.branding,
          projectDescription,
        })
      )
      .digest('hex')
      .substring(0, 16);

    const cacheKey = cacheService.generateAIKey('pitch-deck', userId, projectId, contentHash);

    // The cached result may be an incomplete deck (it is updated after each step),
    // so only short-circuit on it when nothing needs to be (re)generated.
    const currentSections = project.analysisResultModel?.pitchDeck?.sections || [];
    const skipCacheRead =
      forceRegenerate ||
      targetSections.length > 0 ||
      currentSections.length < PITCH_DECK_SLIDE_ORDER.length;

    if (!skipCacheRead) {
      const cachedResult = await cacheService.get<ProjectModel>(cacheKey, {
        prefix: 'ai',
        ttl: 7200,
      });
      if (cachedResult) {
        logger.info(`Pitch deck cache hit for projectId: ${projectId}`);
        return cachedResult;
      }
    }

    const brandName = project.name || 'Startup';
    const logo = project.analysisResultModel?.branding?.logo;
    const colorsObj = project.analysisResultModel?.branding?.colors?.colors || {
      primary: '#1447e6',
      secondary: '#000060',
      accent: '#22d3ee',
      background: '#ffffff',
      text: '#1f2937',
    };
    const typoModel = project.analysisResultModel?.branding?.typography;
    const primaryFont = typoModel?.primaryFont || 'Inter, sans-serif';
    const secondaryFont = typoModel?.secondaryFont || primaryFont;

    // Helper to format logo SVGs or URLs into valid img src targets
    const formatLogoUrl = (val?: string): string => {
      if (!val) return '';
      const trimmed = val.trim();
      if (!trimmed) return '';
      if (
        trimmed.startsWith('http://') ||
        trimmed.startsWith('https://') ||
        trimmed.startsWith('data:')
      ) {
        return trimmed;
      }
      if (trimmed.startsWith('<svg') || trimmed.includes('<svg')) {
        return `data:image/svg+xml;base64,${Buffer.from(trimmed).toString('base64')}`;
      }
      return trimmed;
    };

    // Build logo URLs block — send all declinations formatted as valid Data URIs or URLs
    const logoLines: string[] = [];
    if (logo?.svg) {
      const formatted = formatLogoUrl(logo.svg);
      if (formatted) logoLines.push(`  Primary (full logo): ${formatted}`);
    }
    if (logo?.iconSvg) {
      const formatted = formatLogoUrl(logo.iconSvg);
      if (formatted) logoLines.push(`  Icon only: ${formatted}`);
    }
    if (logo?.variations?.withText) {
      const wt = logo.variations.withText;
      if (wt.lightBackground) logoLines.push(`  With text (light bg): ${formatLogoUrl(wt.lightBackground)}`);
      if (wt.darkBackground) logoLines.push(`  With text (dark bg): ${formatLogoUrl(wt.darkBackground)}`);
      if (wt.monochrome) logoLines.push(`  With text (mono): ${formatLogoUrl(wt.monochrome)}`);
    }
    if (logo?.variations?.iconOnly) {
      const io = logo.variations.iconOnly;
      if (io.lightBackground) logoLines.push(`  Icon only (light bg): ${formatLogoUrl(io.lightBackground)}`);
      if (io.darkBackground) logoLines.push(`  Icon only (dark bg): ${formatLogoUrl(io.darkBackground)}`);
      if (io.monochrome) logoLines.push(`  Icon only (mono): ${formatLogoUrl(io.monochrome)}`);
    }

    // Flat, explicit brand context — LLM uses bg-[#hex], text-[#hex] directly
    const brandContext = [
      `Brand Name: ${brandName}`,
      `LOGO URLS (use <img src="URL"> — pick the right variant for the slide background):`,
      ...(logoLines.length > 0 ? logoLines : ['  No logo available']),
      `PRIMARY COLOR: ${colorsObj.primary}`,
      `SECONDARY COLOR: ${colorsObj.secondary}`,
      `ACCENT COLOR: ${colorsObj.accent}`,
      `BACKGROUND COLOR: ${colorsObj.background}`,
      `TEXT COLOR: ${colorsObj.text}`,
      `PRIMARY FONT: ${primaryFont}`,
      `SECONDARY FONT: ${secondaryFont}`,
      `Language: fr`,
    ].join('\n');

    const steps: IPromptStep[] = [
      {
        stepName: 'Cover',
        hasDependencies: false,
        promptConstant: `${projectDescription}\n${SLIDE_COVER_PROMPT}\n\nBRAND CONTEXT:\n${brandContext}`,
      },
      {
        stepName: 'Problem',
        hasDependencies: false,
        promptConstant: `${projectDescription}\n${SLIDE_PROBLEM_PROMPT}\n\nBRAND CONTEXT:\n${brandContext}`,
      },
      {
        stepName: 'Solution',
        hasDependencies: false,
        promptConstant: `${projectDescription}\n${SLIDE_SOLUTION_PROMPT}\n\nBRAND CONTEXT:\n${brandContext}`,
      },
      {
        stepName: 'Market',
        hasDependencies: false,
        promptConstant: `${projectDescription}\n${SLIDE_MARKET_PROMPT}\n\nBRAND CONTEXT:\n${brandContext}`,
      },
      {
        stepName: 'Product',
        hasDependencies: false,
        promptConstant: `${projectDescription}\n${SLIDE_PRODUCT_PROMPT}\n\nBRAND CONTEXT:\n${brandContext}`,
      },
      {
        stepName: 'Business Model',
        hasDependencies: false,
        promptConstant: `${projectDescription}\n${SLIDE_BUSINESS_MODEL_PROMPT}\n\nBRAND CONTEXT:\n${brandContext}`,
      },
      {
        stepName: 'Traction',
        hasDependencies: false,
        promptConstant: `${projectDescription}\n${SLIDE_TRACTION_PROMPT}\n\nBRAND CONTEXT:\n${brandContext}`,
      },
      {
        stepName: 'Competition',
        hasDependencies: false,
        promptConstant: `${projectDescription}\n${SLIDE_COMPETITION_PROMPT}\n\nBRAND CONTEXT:\n${brandContext}`,
      },
      {
        stepName: 'Team',
        hasDependencies: false,
        promptConstant: `${projectDescription}\n${SLIDE_TEAM_PROMPT}\n\nBRAND CONTEXT:\n${brandContext}`,
      },
      {
        stepName: 'Financials',
        hasDependencies: false,
        promptConstant: `${projectDescription}\n${SLIDE_FINANCIALS_PROMPT}\n\nBRAND CONTEXT:\n${brandContext}`,
      },
      {
        stepName: 'Ask',
        hasDependencies: false,
        promptConstant: `${projectDescription}\n${SLIDE_ASK_PROMPT}\n\nBRAND CONTEXT:\n${brandContext}`,
      },
    ];

    const promptConfig: PromptConfig = {
      provider: AI_CONFIG.pitchDeck.provider,
      modelName: AI_CONFIG.pitchDeck.modelName,
    };


    // Load existing sections if not forcing regeneration.
    // Sections listed in targetSections are dropped so they get regenerated,
    // while the others are kept as-is (resume semantics).
    const existingSections = forceRegenerate
      ? []
      : targetSections.length > 0
        ? currentSections.filter((s) => !targetSections.includes(s.name))
        : currentSections;

    let sectionResults: SectionModel[] = [...existingSections];

    if (streamCallback) {
      await this.processStepsWithStreaming(
        steps,
        project,
        async (result: ISectionResult) => {
          if (result.data === 'steps_in_progress' || result.data === 'all_steps_completed') {
            await streamCallback(result);
            return;
          }

          let enrichedData = result.data;
          if (typeof enrichedData === 'string' && (enrichedData.includes('<img') || enrichedData.includes('data-image'))) {
            enrichedData = await this.enrichSlideWithImages(
              enrichedData,
              userId,
              projectId,
              result.name
            );
          }

          const section: SectionModel = {
            name: result.name,
            type: result.type,
            data: enrichedData,
            summary: result.summary,
          };
          
          // Add or replace in sections array to avoid duplicates
          const existingIndex = sectionResults.findIndex((s) => s.name === section.name);
          if (existingIndex !== -1) {
            sectionResults[existingIndex] = section;
          } else {
            sectionResults.push(section);
          }

          // Sort sections to match original step order
          const stepOrder = steps.map((s) => s.stepName);
          sectionResults.sort((a, b) => stepOrder.indexOf(a.name) - stepOrder.indexOf(b.name));

          const currentProject = await this.projectRepository.findById(
            projectId,
            `users/${userId}/projects`
          );
          if (!currentProject) throw new Error(`Project not found: ${projectId}`);

          const updated = await this.projectRepository.update(
            projectId,
            {
              ...currentProject,
              analysisResultModel: {
                ...currentProject.analysisResultModel,
                pitchDeck: {
                  sections: sectionResults,
                  generatedAt: new Date(),
                },
              },
            },
            `users/${userId}/projects`
          );

          if (updated) {
            await cacheService.set(cacheKey, updated, { prefix: 'ai', ttl: 7200 });
            await streamCallback({
              ...result,
              data: enrichedData,
            });
          } else {
            throw new Error(`Failed to update project after step: ${result.name}`);
          }
        },
        promptConfig,
        'pitch_deck',
        userId,
        undefined, // finalizationCallback
        existingSections
      );

      // The stored PDF no longer matches the regenerated sections
      await cacheService.delete(cacheService.generateAIKey('pitch-deck-pdf', userId, projectId), {
        prefix: 'pdf',
      });

      return this.projectRepository.findById(projectId, `users/${userId}/projects`);
    }

    const stepResults = await this.processSteps(steps, project, promptConfig);
    sectionResults = await Promise.all(
      stepResults.map(async (r) => {
        let enrichedData = r.data;
        if (typeof enrichedData === 'string' && (enrichedData.includes('<img') || enrichedData.includes('data-image'))) {
          enrichedData = await this.enrichSlideWithImages(
            enrichedData,
            userId,
            projectId,
            r.name
          );
        }
        return {
          name: r.name,
          type: r.type,
          data: enrichedData,
          summary: r.summary,
        };
      })
    );

    const old = await this.projectRepository.findById(projectId, `users/${userId}/projects`);
    if (!old) return null;

    const updated = await this.projectRepository.update(
      projectId,
      {
        ...old,
        analysisResultModel: {
          ...old.analysisResultModel,
          pitchDeck: {
            sections: sectionResults,
            generatedAt: new Date(),
          },
        },
      },
      `users/${userId}/projects`
    );

    if (updated) {
      await cacheService.set(cacheKey, updated, { prefix: 'ai', ttl: 7200 });
      // The stored PDF no longer matches the regenerated sections
      await cacheService.delete(cacheService.generateAIKey('pitch-deck-pdf', userId, projectId), {
        prefix: 'pdf',
      });
    }
    return updated;
  }

  async getPitchDeckByProjectId(userId: string, projectId: string): Promise<PitchDeckModel | null> {
    logger.debug(
      `PitchDeckService.getPitchDeckByProjectId userId=${userId} projectId=${projectId}`
    );
    const project = await this.projectRepository.findById(projectId, `users/${userId}/projects`);
    if (!project) {
      logger.warn(`PitchDeckService.getPitchDeckByProjectId: project not found ${projectId}`);
      return null;
    }
    const deck = project.analysisResultModel?.pitchDeck || null;
    logger.info(
      `PitchDeckService.getPitchDeckByProjectId: ${deck ? (deck.sections?.length ?? 0) : 0} sections projectId=${projectId}`
    );
    return deck;
  }

  async deletePitchDeck(userId: string, projectId: string): Promise<void> {
    logger.info(`PitchDeckService.deletePitchDeck userId=${userId} projectId=${projectId}`);
    const project = await this.projectRepository.findById(projectId, `users/${userId}/projects`);
    if (!project) {
      logger.warn(`PitchDeckService.deletePitchDeck: project not found ${projectId}`);
      return;
    }
    project.analysisResultModel.pitchDeck = undefined;
    await this.projectRepository.update(projectId, project, `users/${userId}/projects`);
    logger.info(`PitchDeckService.deletePitchDeck: deleted projectId=${projectId}`);
  }

  /**
   * Generates a 16:9 landscape slide PDF from the stored sections.
   */
  async generatePitchDeckPdf(userId: string, projectId: string): Promise<string> {
    logger.info(`PitchDeckService.generatePitchDeckPdf userId=${userId} projectId=${projectId}`);
    const startedAt = Date.now();
    const project = await this.projectRepository.findById(projectId, `users/${userId}/projects`);
    if (!project) {
      logger.warn(`PitchDeckService.generatePitchDeckPdf: project not found ${projectId}`);
      throw new Error(`Project not found with ID: ${projectId}`);
    }

    const pitchDeck = project.analysisResultModel?.pitchDeck;
    if (!pitchDeck || !pitchDeck.sections || pitchDeck.sections.length === 0) {
      logger.warn(
        `PitchDeckService.generatePitchDeckPdf: no sections available for projectId=${projectId}`
      );
      return '';
    }

    const cacheKey = cacheService.generateAIKey('pitch-deck-pdf', userId, projectId);
    const cached = await cacheService.get<string>(cacheKey, { prefix: 'pdf', ttl: 3600 });
    if (cached) {
      logger.info(
        `PitchDeckService.generatePitchDeckPdf cache hit projectId=${projectId} path=${cached}`
      );
      return cached;
    }

    try {
      const pdfPath = await this.pdfService.generatePdf({
        title: 'Pitch Deck',
        projectName: project.name || 'Project',
        projectDescription: project.description || '',
        sections: pitchDeck.sections,
        sectionDisplayOrder: PITCH_DECK_SLIDE_ORDER,
        pageFormat: PAGE_FORMATS.SLIDE_16_9,
        footerText: 'Confidential — Generated by Idem',
      });

      await cacheService.set(cacheKey, pdfPath, { prefix: 'pdf', ttl: 3600 });
      logger.info(
        `PitchDeckService.generatePitchDeckPdf success projectId=${projectId} path=${pdfPath} durationMs=${Date.now() - startedAt}`
      );
      return pdfPath;
    } catch (err: any) {
      logger.error(
        `PitchDeckService.generatePitchDeckPdf error projectId=${projectId}: ${err?.message}`,
        { stack: err?.stack }
      );
      throw err;
    }
  }

  /**
   * Enrich slide HTML by resolving image placeholders (using Pexels stock search with Gemini fallback)
   */
  private async enrichSlideWithImages(
    html: string,
    userId: string,
    projectId: string,
    slideName: string
  ): Promise<string> {
    if (!html || typeof html !== 'string') return html;

    const imgTagRegex = /<img\b([^>]*?)>/gi;
    const matches = [...html.matchAll(imgTagRegex)];

    if (matches.length === 0) return html;

    let enrichedHtml = html;

    for (const match of matches) {
      const fullTag = match[0];
      const attrsStr = match[1];

      // Explicitly protect logos and data URIs from being replaced by stock photos
      const isLogo =
        /alt=["'][^"']*logo[^"']*["']/i.test(attrsStr) ||
        /class=["'][^"']*logo[^"']*["']/i.test(attrsStr) ||
        /src=["'][^"']*logo[^"']*["']/i.test(attrsStr);

      const hasExplicitQuery = /data-image-query=["']/i.test(attrsStr);
      const hasExplicitPrompt = /data-image-prompt=["']/i.test(attrsStr);
      const isPlaceholder =
        /src=["'][^"']*placehold\.co[^"']*["']/i.test(attrsStr) ||
        /src=["'][^"']*placeholder[^"']*["']/i.test(attrsStr);

      if (isLogo || (!hasExplicitQuery && !hasExplicitPrompt && !isPlaceholder)) {
        continue;
      }

      if (/src=["']data:image\//i.test(attrsStr) && !hasExplicitQuery && !hasExplicitPrompt) {
        continue;
      }

      const queryMatch = attrsStr.match(/data-image-query=["']([^"']+)["']/i);
      const promptMatch = attrsStr.match(/data-image-prompt=["']([^"']+)["']/i);

      const searchQuery = queryMatch
        ? queryMatch[1]
        : `${slideName} startup visual`;

      const generationPrompt = promptMatch
        ? promptMatch[1]
        : `High resolution professional visual depicting ${searchQuery} for pitch deck slide ${slideName}`;

      try {
        const sourced = await imageSourcingService.sourceImage(
          {
            searchQuery,
            generationPrompt,
            orientation: 'landscape',
          },
          {
            userId,
            projectId,
            tag: `pitchdeck-${slideName.toLowerCase().replace(/\s+/g, '-')}`,
          }
        );

        if (sourced && sourced.url) {
          let newTag = fullTag;
          if (/src=["'][^"']*["']/i.test(newTag)) {
            newTag = newTag.replace(/src=["'][^"']*["']/i, `src="${sourced.url}"`);
          } else {
            newTag = newTag.replace(/<img/i, `<img src="${sourced.url}"`);
          }
          enrichedHtml = enrichedHtml.replace(fullTag, newTag);
        }
      } catch (err: any) {
        logger.warn(
          `Failed to source image for pitch deck slide ${slideName}: ${err.message}`
        );
      }
    }

    return enrichedHtml;
  }
}
