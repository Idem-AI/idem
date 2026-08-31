import crypto from 'crypto';
import { LLMProvider, PromptConfig, PromptService } from '../prompt.service';
import { AI_CONFIG } from '../../config/ai.config';

import { ProjectModel } from '../../models/project.model';
import logger from '../../config/logger';
import { PitchDeckModel } from '../../models/pitchDeck.model';
import {
  GenericService,
  IPromptStep,
  ISectionResult,
  withGraph,
} from '../common/generic.service';
import { PITCH_DECK_GRAPH } from '../agents/deliverable-graph';
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
import { buildLogoBlock, collectLogoUrls } from '../../utils/brand-context.util';
import { buildArtDirectionBlock } from '../../utils/art-direction.util';
import { ANTI_SLOP_BLOCK } from '../design/antiSlop.prompt';
import { lintHtml, repairHtml } from '../design/slopLint.service';
import { buildDesignSeed, describeSeed } from '../design/designSeed';
import { ensureProjectArtDirection } from '../design/artDirection.provider';

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

    // Le bloc logo est désormais construit par l'utilitaire partagé avec le
    // business plan et le site : mêmes déclinaisons, mêmes règles de choix selon
    // le fond, et surtout la CONSIGNE de le poser sur la diapositive — la table
    // d'URLs seule ne suffisait pas à le faire apparaître.
    // Provisionnée si la charte n'a pas encore été générée : le deck peut être
    // le premier livrable produit, et il doit alors faire naître le parti pris
    // visuel plutôt que de s'en passer.
    const artDirection = await ensureProjectArtDirection(
      this.promptService,
      userId,
      projectId,
      project
    );
    // Graine déterministe : deux decks de projets différents ne se ressemblent
    // pas, mais les onze diapositives d'un même deck partagent leur grammaire.
    const deckSeed = buildDesignSeed(artDirection?.styleId, `pitchdeck:${projectId}`);

    // Flat, explicit brand context — LLM uses bg-[#hex], text-[#hex] directly
    const brandContext = [
      `Brand Name: ${brandName}`,
      `PRIMARY COLOR: ${colorsObj.primary}`,
      `SECONDARY COLOR: ${colorsObj.secondary}`,
      `ACCENT COLOR: ${colorsObj.accent}`,
      `BACKGROUND COLOR: ${colorsObj.background}`,
      `TEXT COLOR: ${colorsObj.text}`,
      `PRIMARY FONT: ${primaryFont}`,
      `SECONDARY FONT: ${secondaryFont}`,
      `Language: fr`,
      '',
      buildLogoBlock(logo, {
        placement:
          "sur la diapositive de couverture (grand, comme signature) et dans le même angle de CHAQUE autre diapositive (petit, h-8 à h-10, toujours à la même place)",
        size: 'couverture : 25 à 40% de la largeur ; diapositives courantes : hauteur h-8 à h-10',
      }),
      buildArtDirectionBlock(artDirection, { medium: 'slide' }),
      artDirection
        ? `<composition_seed>\nToutes les diapositives de ce deck partagent cette graine de composition.\n${describeSeed(deckSeed)}\n</composition_seed>`
        : '',
      ANTI_SLOP_BLOCK,
    ]
      .filter(Boolean)
      .join('\n');

    const knownLogoUrls = collectLogoUrls(logo);

    const steps: IPromptStep[] = [
      {
        stepName: 'Cover',
        promptConstant: `${projectDescription}\n${SLIDE_COVER_PROMPT}\n\nBRAND CONTEXT:\n${brandContext}`,
      },
      {
        stepName: 'Problem',
        promptConstant: `${projectDescription}\n${SLIDE_PROBLEM_PROMPT}\n\nBRAND CONTEXT:\n${brandContext}`,
      },
      {
        stepName: 'Solution',
        promptConstant: `${projectDescription}\n${SLIDE_SOLUTION_PROMPT}\n\nBRAND CONTEXT:\n${brandContext}`,
      },
      {
        stepName: 'Market',
        promptConstant: `${projectDescription}\n${SLIDE_MARKET_PROMPT}\n\nBRAND CONTEXT:\n${brandContext}`,
      },
      {
        stepName: 'Product',
        promptConstant: `${projectDescription}\n${SLIDE_PRODUCT_PROMPT}\n\nBRAND CONTEXT:\n${brandContext}`,
      },
      {
        stepName: 'Business Model',
        promptConstant: `${projectDescription}\n${SLIDE_BUSINESS_MODEL_PROMPT}\n\nBRAND CONTEXT:\n${brandContext}`,
      },
      {
        stepName: 'Traction',
        promptConstant: `${projectDescription}\n${SLIDE_TRACTION_PROMPT}\n\nBRAND CONTEXT:\n${brandContext}`,
      },
      {
        stepName: 'Competition',
        promptConstant: `${projectDescription}\n${SLIDE_COMPETITION_PROMPT}\n\nBRAND CONTEXT:\n${brandContext}`,
      },
      {
        stepName: 'Team',
        promptConstant: `${projectDescription}\n${SLIDE_TEAM_PROMPT}\n\nBRAND CONTEXT:\n${brandContext}`,
      },
      {
        stepName: 'Financials',
        promptConstant: `${projectDescription}\n${SLIDE_FINANCIALS_PROMPT}\n\nBRAND CONTEXT:\n${brandContext}`,
      },
      {
        stepName: 'Ask',
        promptConstant: `${projectDescription}\n${SLIDE_ASK_PROMPT}\n\nBRAND CONTEXT:\n${brandContext}`,
      },
    ];

    // Chaque slide reçoit son propre budget de tokens et sa température
    // (voir AI_CONFIG.pitchDeck.sections) ; la config de la feature sert de
    // base pour ceux qui n'en redéfinissent pas. Les dépendances entre slides
    // vivent dans PITCH_DECK_GRAPH — notamment `Ask` ← `Financials`, pour que le
    // montant demandé découle des projections affichées deux slides plus tôt.
    const slideQuality = {
      format: 'html' as const,
      minChars: 300,
      currency: project.analysisResultModel?.finance?.meta?.currency,
    };

    const configuredSteps = withGraph(AI_CONFIG.pitchDeck, steps, PITCH_DECK_GRAPH, slideQuality);

    const promptConfig: PromptConfig = {
      provider: AI_CONFIG.pitchDeck.provider,
      modelName: AI_CONFIG.pitchDeck.modelName,
      llmOptions: AI_CONFIG.pitchDeck.llmOptions,
      // Était omis : la chaîne de repli n'atteignait jamais runPrompt.
      fallbackModels: AI_CONFIG.pitchDeck.fallbackModels,
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
        configuredSteps,
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
              result.name,
              knownLogoUrls
            );
          }

          // Passe déterministe anti-générique : couleurs hors charte, polices
          // écrites en dur, titres en dégradé et images sans alt sont corrigés
          // sans appel au modèle. Le reste (logo absent, mise en page
          // générique) est journalisé — sur onze diapositives, il en reste
          // toujours une qui déroge à la consigne du prompt.
          if (typeof enrichedData === 'string' && enrichedData) {
            const lintOptions = {
              palette: colorsObj,
              fonts: [primaryFont, secondaryFont].filter(Boolean),
              expectedLogoUrls: knownLogoUrls,
              styleId: artDirection?.styleId,
              label: `deck/${result.name}`,
            };
            enrichedData = repairHtml(enrichedData, lintOptions).html;
            lintHtml(enrichedData, lintOptions);
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

    const stepResults = await this.processSteps(configuredSteps, project, promptConfig);
    sectionResults = await Promise.all(
      stepResults.map(async (r) => {
        let enrichedData = r.data;
        if (typeof enrichedData === 'string' && (enrichedData.includes('<img') || enrichedData.includes('data-image'))) {
          enrichedData = await this.enrichSlideWithImages(
            enrichedData,
            userId,
            projectId,
            r.name,
            knownLogoUrls
          );
        }
        // Même passe déterministe que dans la branche streamée : les deux
        // chemins produisent le même document, ils doivent subir les mêmes
        // contrôles.
        if (typeof enrichedData === 'string' && enrichedData) {
          const lintOptions = {
            palette: colorsObj,
            fonts: [primaryFont, secondaryFont].filter(Boolean),
            expectedLogoUrls: knownLogoUrls,
            styleId: artDirection?.styleId,
            label: `deck/${r.name}`,
          };
          enrichedData = repairHtml(enrichedData, lintOptions).html;
          lintHtml(enrichedData, lintOptions);
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
    slideName: string,
    /** URLs réelles des déclinaisons du logo : elles ne doivent jamais être remplacées. */
    knownLogoUrls: string[] = []
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
      // Le logo ne doit JAMAIS être remplacé par une photo de banque d'images.
      // Le test portait sur la présence du mot « logo » dans les attributs, ce
      // qui dépendait du bon vouloir du modèle ; on compare aussi aux URLs
      // réelles des déclinaisons, qui, elles, ne mentent pas.
      const isLogo =
        /alt=["'][^"']*logo[^"']*["']/i.test(attrsStr) ||
        /class=["'][^"']*logo[^"']*["']/i.test(attrsStr) ||
        /src=["'][^"']*logo[^"']*["']/i.test(attrsStr) ||
        knownLogoUrls.some((url: string) => attrsStr.includes(url.split('?')[0]));

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
