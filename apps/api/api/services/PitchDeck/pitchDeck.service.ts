import crypto from 'crypto';
import { PromptConfig, PromptService } from '../prompt.service';
import { AI_CONFIG } from '../../config/ai.config';

import logger from '../../config/logger';
import { PitchDeckDocument } from '../../models/pitchDeck.model';
import {
  GenericService,
  IPromptStep,
  ISectionResult,
  withGraph,
} from '../common/generic.service';
import { buildPitchDeckGraph } from '../agents/deliverable-graph';
import { SectionModel } from '../../models/section.model';
import { PdfService, PAGE_FORMATS } from '../pdf.service';
import { cacheService } from '../cache.service';

import { PITCH_DECK_SHARED_RULES } from './prompts/_shared.prompt';
import { composeSlideBrief } from './prompts/slide-briefs.prompt';
import { composeSlideHtmlPrompt, coverKindNote } from './prompts/slide-fallback.prompt';
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
import { ANTI_SLOP_BLOCK, CONTENT_RULES_BLOCK } from '../design/antiSlop.prompt';
import {
  EDITORIAL_RESTRAINT_BLOCK,
  RESTRAINT_SELF_REVIEW_BLOCK,
} from '../design/editorialRestraint.prompt';
import { enforceDesignRules } from '../design/slopLint.service';
import {
  buildDocumentSeed,
  buildSectionSeed,
  describeDocumentSeed,
  describeSectionSeed,
} from '../design/designSeed';
import {
  buildDocumentDesignSystem,
  derivedPalette,
  describeDesignSystem,
} from '../design/documentDesignSystem';
import { LANDSCAPE_SLIDE } from '../design/sectionRenderer';
import { ensureProjectArtDirection } from '../design/artDirection.provider';
import { deliverableDocumentStore } from '../common/deliverable-document.store';
import {
  countCompletedSections,
  DeliverableDocumentSummary,
  documentDesignKey,
  findDocument,
} from '../common/deliverable-documents';
import {
  DEFAULT_PITCH_DECK_TYPE_ID,
  getPitchDeckType,
  PITCH_DECK_TYPES,
  resolvePitchDeckSlides,
} from './deck-types';

/** Ordre des slides du deck investisseur, le deck historique. */
export const PITCH_DECK_SLIDE_ORDER = getPitchDeckType(DEFAULT_PITCH_DECK_TYPE_ID).slides;

/**
 * Prompts de composition écrits à la main pour les onze slides historiques. Ils
 * servent à la couverture (génération libre) et au repli quand le gabarit est
 * coupé ; les autres slides composent leur repli depuis leur brief.
 */
const LEGACY_SLIDE_PROMPTS: Record<string, string> = {
  Cover: SLIDE_COVER_PROMPT,
  Problem: SLIDE_PROBLEM_PROMPT,
  Solution: SLIDE_SOLUTION_PROMPT,
  Market: SLIDE_MARKET_PROMPT,
  Product: SLIDE_PRODUCT_PROMPT,
  'Business Model': SLIDE_BUSINESS_MODEL_PROMPT,
  Traction: SLIDE_TRACTION_PROMPT,
  Competition: SLIDE_COMPETITION_PROMPT,
  Team: SLIDE_TEAM_PROMPT,
  Financials: SLIDE_FINANCIALS_PROMPT,
  Ask: SLIDE_ASK_PROMPT,
};

/** Un deck tel que la page d'affichage le lit : le document, son type et ses slides attendues. */
export interface PitchDeckView extends PitchDeckDocument {
  type: string;
  audience: string;
  expectedSectionNames: string[];
}

/** Type de deck proposé à la création. */
export interface PitchDeckTypeSummary {
  id: string;
  audience: string;
  speakingMinutes: string;
  isDefault: boolean;
  slides: string[];
}

const pdfCacheKey = (userId: string, projectId: string, documentId: string): string =>
  cacheService.generateAIKey('pitch-deck-pdf', userId, projectId, documentId);

export class PitchDeckService extends GenericService {
  private pdfService: PdfService;

  constructor(promptService: PromptService) {
    super(promptService);
    this.pdfService = new PdfService();
    logger.info('PitchDeckService initialized.');
  }

  /* ------------------------------------------------------------------ */
  /* Documents                                                           */
  /* ------------------------------------------------------------------ */

  getTypes(): PitchDeckTypeSummary[] {
    return PITCH_DECK_TYPES.map((type) => ({
      id: type.id,
      audience: type.audience,
      speakingMinutes: type.speakingMinutes,
      isDefault: !!type.isDefault,
      slides: [...type.slides],
    }));
  }

  toSummary(deck: PitchDeckDocument): DeliverableDocumentSummary {
    const type = getPitchDeckType(deck.type);
    return {
      id: deck.id,
      name: deck.name ?? null,
      variant: type.id,
      audience: type.audience,
      expectedSectionNames: [...type.slides],
      completedSectionCount: countCompletedSections(type.slides, deck.sections),
      createdAt: deck.createdAt,
      updatedAt: deck.updatedAt ?? deck.generatedAt,
    };
  }

  toView(deck: PitchDeckDocument): PitchDeckView {
    const type = getPitchDeckType(deck.type);
    return {
      ...deck,
      type: type.id,
      audience: type.audience,
      expectedSectionNames: [...type.slides],
    };
  }

  /** Decks du projet ; `null` quand le projet est introuvable. */
  async listDocuments(userId: string, projectId: string): Promise<DeliverableDocumentSummary[] | null> {
    const decks = await deliverableDocumentStore.list(userId, projectId, 'pitchDeck');
    return decks ? decks.map((deck) => this.toSummary(deck)) : null;
  }

  /** Crée un deck vide du type demandé ; la génération vient ensuite. */
  async createDocument(
    userId: string,
    projectId: string,
    typeId: string,
    name?: string
  ): Promise<PitchDeckDocument | null> {
    return deliverableDocumentStore.create(userId, projectId, 'pitchDeck', {
      type: getPitchDeckType(typeId).id,
      ...(name ? { name } : {}),
      sections: [],
    });
  }

  async renameDocument(
    userId: string,
    projectId: string,
    documentId: string,
    name: string
  ): Promise<PitchDeckDocument | null> {
    return deliverableDocumentStore.update(
      userId,
      projectId,
      'pitchDeck',
      documentId,
      (deck) => ({ ...deck, name }),
      // Renommer n'est pas modifier le contenu : le deck garde sa place dans la liste.
      { touch: false }
    );
  }

  async deleteDocument(userId: string, projectId: string, documentId: string): Promise<boolean> {
    const removed = await deliverableDocumentStore.remove(userId, projectId, 'pitchDeck', documentId);
    if (removed) {
      await cacheService.delete(pdfCacheKey(userId, projectId, documentId), { prefix: 'pdf' });
    }
    return removed;
  }

  /**
   * Deck visé par une génération. Sans identifiant (assistant, anciens appels) :
   * le deck principal, et un deck investisseur pour un projet qui n'en a aucun.
   * Un identifiant inconnu rend `null` — on ne génère pas dans un autre deck
   * que celui demandé.
   */
  async ensureDocument(
    userId: string,
    projectId: string,
    documentId?: string
  ): Promise<PitchDeckDocument | null> {
    if (documentId) return deliverableDocumentStore.find(userId, projectId, 'pitchDeck', documentId);
    const primary = await deliverableDocumentStore.find(userId, projectId, 'pitchDeck');
    return primary ?? this.createDocument(userId, projectId, DEFAULT_PITCH_DECK_TYPE_ID);
  }

  async getPitchDeckByProjectId(
    userId: string,
    projectId: string,
    documentId?: string
  ): Promise<PitchDeckView | null> {
    logger.debug(
      `PitchDeckService.getPitchDeckByProjectId userId=${userId} projectId=${projectId} documentId=${documentId ?? '(primary)'}`
    );
    const deck = await deliverableDocumentStore.find(userId, projectId, 'pitchDeck', documentId);
    if (!deck) return null;
    logger.info(
      `PitchDeckService.getPitchDeckByProjectId: ${deck.sections?.length ?? 0} sections projectId=${projectId} documentId=${deck.id}`
    );
    return this.toView(deck);
  }

  /* ------------------------------------------------------------------ */
  /* Génération                                                          */
  /* ------------------------------------------------------------------ */

  async generatePitchDeckWithStreaming(
    userId: string,
    projectId: string,
    streamCallback?: (sectionResult: ISectionResult) => Promise<void>,
    forceRegenerate = false,
    targetSections: string[] = [],
    documentId?: string
  ): Promise<PitchDeckDocument | null> {
    logger.info(
      `Generating pitch deck with streaming for userId: ${userId}, projectId: ${projectId}, documentId: ${documentId ?? '(primary)'}, force: ${forceRegenerate}, targetSections: [${targetSections.join(', ')}]`
    );

    const project = await this.getProject(projectId, userId);
    if (!project) return null;

    const deck = findDocument(project.analysisResultModel, 'pitchDeck', documentId);
    if (!deck) {
      logger.warn(`No pitch deck ${documentId ?? '(primary)'} in project ${projectId}`);
      return null;
    }

    // Le TYPE décide des slides produites, de leur ordre et du lecteur de chaque
    // brief. Un deck d'avant les types retombe sur le deck investisseur, qui est
    // le deck historique en onze slides.
    const { type: deckType, slides: deckSlides } = resolvePitchDeckSlides(deck.type);
    const slideOrder = deckSlides.map((slide) => slide.name);

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
          description: project.longDescription || project.description,
          branding: project.analysisResultModel?.branding,
          projectDescription,
          deckType: deckType.id,
        })
      )
      .digest('hex')
      .substring(0, 16);

    // Une clé PAR DECK : deux decks du même projet ne se servent pas l'un l'autre.
    const cacheKey = cacheService.generateAIKey('pitch-deck', userId, projectId, `${deck.id}:${contentHash}`);

    // The cached result may be an incomplete deck (it is updated after each step),
    // so only short-circuit on it when nothing needs to be (re)generated.
    const currentSections = deck.sections || [];
    const skipCacheRead =
      forceRegenerate ||
      targetSections.length > 0 ||
      currentSections.length < slideOrder.length;

    if (!skipCacheRead) {
      const cachedResult = await cacheService.get<PitchDeckDocument>(cacheKey, {
        prefix: 'ai',
        ttl: 7200,
      });
      if (cachedResult?.id === deck.id) {
        logger.info(`Pitch deck cache hit for projectId: ${projectId}, documentId: ${deck.id}`);
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
    // INVARIANTS du deck : couleur, typographie, rythme, accent graphique.
    // L'archétype de composition est tiré PAR SLIDE (cf. `buildSectionSeed`) :
    // onze slides qui partagent leur archétype sont onze fois la même slide.
    // La clé est propre au deck : deux decks du projet ne se ressemblent pas
    // slide pour slide.
    const designKey = documentDesignKey('pitchdeck', projectId, deck.id);
    const deckSeed = buildDocumentSeed(artDirection?.styleId, designKey);

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
          'on the cover slide (large, as the signature) and in the SAME corner of every other slide (small, h-8 to h-10, always in the same place)',
        size: 'cover: 25 to 40% of the width; running slides: h-8 to h-10 tall',
      }),
      buildArtDirectionBlock(artDirection, { medium: 'slide' }),
      artDirection
        ? `<composition_invariants>\n${describeDocumentSeed(deckSeed)}\n</composition_invariants>`
        : '',
      ANTI_SLOP_BLOCK,
      EDITORIAL_RESTRAINT_BLOCK,
      RESTRAINT_SELF_REVIEW_BLOCK,
    ]
      .filter(Boolean)
      .join('\n');

    const knownLogoUrls = collectLogoUrls(logo);

    // PRÉFIXE STABLE — identique à toutes les slides, émis UNE fois en tête. Il
    // portait auparavant la fin de chaque `promptConstant`, derrière la partie
    // variable : le contexte de marque ET les 1 888 tokens de règles partagées
    // étaient repayés à chaque slide, sans qu'aucun début de prompt se répète.
    const stablePrefix = [
      projectDescription,
      `BRAND CONTEXT:\n${brandContext}`,
      // Les règles communes aux slides vivaient AU MILIEU de chacun des prompts
      // (1 888 tokens par slide) : ni mutualisables, ni cacheables.
      PITCH_DECK_SHARED_RULES,
    ].join('\n\n');

    // Préfixe du MODE GABARIT : sans les règles de composition, que le rendu
    // applique désormais. Cf. le commentaire équivalent du business plan.
    const templatedPrefix = [
      projectDescription,
      `BRAND FACTS:\nBrand: ${brandName}`,
      CONTENT_RULES_BLOCK,
    ].join('\n\n');

    // DESIGN SYSTEM du deck : calculé une fois, partagé par toutes les slides.
    const designSystem = buildDocumentDesignSystem(
      project.analysisResultModel?.branding,
      artDirection,
      deckSeed
    );
    logger.info(`[DECK] Design system: ${describeDesignSystem(designSystem)}`);

    const renderOptions = { logoUrl: knownLogoUrls[0], brandName: project.name };

    // Un archétype de composition par slide, tiré sans répétition dans l'espace
    // autorisé par le style. Les invariants restent dans le préfixe ci-dessus.
    const usedArchetypes = new Set<string>();
    let slideIndex = 0;

    const seedFor = (stepName: string) =>
      buildSectionSeed(artDirection?.styleId, designKey, stepName, usedArchetypes);

    /** Prompt HTML de repli : écrit à la main pour les slides historiques, composé sinon. */
    const htmlPromptFor = (stepName: string): string =>
      LEGACY_SLIDE_PROMPTS[stepName] ?? composeSlideHtmlPrompt(stepName, deckType.audience);

    /**
     * Slide RENDU PAR GABARIT.
     *
     * ⚠️ Le deck est en `multiPage: false` : un slide = EXACTEMENT une page, et
     * ce qui dépasse est ROGNÉ, pas paginé. Le volume est donc bas (3 à 5 blocs)
     * et le rendu resserre son échelle — un débordement ici n'est pas
     * rattrapable en aval, contrairement au business plan.
     */
    const slide = (stepName: string): IPromptStep => {
      slideIndex += 1;
      const fallbackPrompt = htmlPromptFor(stepName);
      return {
        stepName,
        // Prompt d'origine : le repli quand le gabarit est coupé.
        promptConstant: fallbackPrompt,
        stablePrefix: templatedPrefix,
        template: {
          // Sous gabarit, le brief ne porte QUE le contenu, lu par le
          // destinataire du deck : la mise en page est au rendu.
          contentBrief: composeSlideBrief(stepName, deckType.audience) ?? fallbackPrompt,
          designSystem,
          seed: seedFor(stepName),
          volume: '3 to 4',
          render: {
            ...renderOptions,
            index: slideIndex,
            page: LANDSCAPE_SLIDE,
            multiPage: false,
          },
        },
      };
    };

    /** Slide en génération LIBRE : la couverture, où la composition EST le livrable. */
    const freeformSlide = (stepName: string): IPromptStep => {
      slideIndex += 1;
      return {
        stepName,
        promptConstant: [
          htmlPromptFor(stepName),
          coverKindNote(deckType.audience),
          `<composition_for_this_slide>\n${describeSectionSeed(seedFor(stepName))}\n</composition_for_this_slide>`,
        ]
          .filter(Boolean)
          .join('\n\n'),
      };
    };

    const steps: IPromptStep[] = deckSlides.map((definition) =>
      definition.freeform ? freeformSlide(definition.name) : slide(definition.name)
    );

    // Chaque slide reçoit son propre budget de tokens et sa température
    // (voir AI_CONFIG.pitchDeck.sections) ; la config de la feature sert de
    // base pour celles qui n'en redéfinissent pas. Les dépendances entre slides
    // viennent du catalogue (`deck-types.ts`), filtrées sur les slides du type —
    // notamment `Ask` ← `Financials`, pour que le montant demandé découle des
    // projections affichées deux slides plus tôt.
    const slideQuality = {
      format: 'html' as const,
      minChars: 300,
      currency: project.analysisResultModel?.finance?.meta?.currency,
    };

    const configuredSteps = withGraph(
      AI_CONFIG.pitchDeck,
      steps,
      buildPitchDeckGraph(deckSlides),
      slideQuality,
      stablePrefix
    );

    const promptConfig: PromptConfig = {
      provider: AI_CONFIG.pitchDeck.provider,
      modelName: AI_CONFIG.pitchDeck.modelName,
      llmOptions: AI_CONFIG.pitchDeck.llmOptions,
      // Était omis : la chaîne de repli n'atteignait jamais runPrompt.
      fallbackModels: AI_CONFIG.pitchDeck.fallbackModels,
    };

    /**
     * Images sourcées puis passe déterministe anti-générique : couleurs hors
     * charte, polices écrites en dur, titres en dégradé et images sans alt sont
     * corrigés sans appel au modèle. Le reste (logo absent, mise en page
     * générique) est journalisé — sur onze diapositives, il en reste toujours
     * une qui déroge à la consigne du prompt.
     */
    const polishSlide = async (name: string, data: string): Promise<string> => {
      let html = data;
      if (typeof html === 'string' && (html.includes('<img') || html.includes('data-image'))) {
        html = await this.enrichSlideWithImages(html, userId, projectId, name, knownLogoUrls);
      }
      if (typeof html === 'string' && html) {
        html = enforceDesignRules(html, {
          palette: colorsObj,
          // Les teintes des rampes DÉRIVENT de la charte : sans cette
          // déclaration, le linter prendrait le design system calculé pour
          // une palette inventée.
          extraAllowedColors: derivedPalette(designSystem),
          fonts: [primaryFont, secondaryFont].filter(Boolean),
          expectedLogoUrls: knownLogoUrls,
          styleId: artDirection?.styleId,
          label: `deck/${name}`,
        }).html;
      }
      return html;
    };

    // Load existing sections if not forcing regeneration.
    // Sections listed in targetSections are dropped so they get regenerated,
    // while the others are kept as-is (resume semantics). Slides that are not
    // part of this deck type are left out.
    const inDeck = new Set(slideOrder);
    const keptSections = currentSections.filter((s) => inDeck.has(s.name));
    const existingSections = forceRegenerate
      ? []
      : targetSections.length > 0
        ? keptSections.filter((s) => !targetSections.includes(s.name))
        : keptSections;

    let sectionResults: SectionModel[] = [...existingSections];

    const persist = async (): Promise<PitchDeckDocument | null> => {
      const saved = await deliverableDocumentStore.update(userId, projectId, 'pitchDeck', deck.id, (current) => ({
        ...current,
        sections: sectionResults,
        generatedAt: new Date(),
      }));
      if (saved) await cacheService.set(cacheKey, saved, { prefix: 'ai', ttl: 7200 });
      return saved;
    };

    if (streamCallback) {
      await this.processStepsWithStreaming(
        configuredSteps,
        project,
        async (result: ISectionResult) => {
          if (
            result.data === 'steps_in_progress' ||
            result.data === 'all_steps_completed' ||
            // L'aperçu au fil de l'eau est relayé, jamais enregistré comme section.
            result.name === 'section_delta'
          ) {
            await streamCallback(result);
            return;
          }

          const enrichedData = await polishSlide(result.name, result.data);

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

          // Sort sections to match the deck order
          sectionResults.sort((a, b) => slideOrder.indexOf(a.name) - slideOrder.indexOf(b.name));

          if (!(await persist())) {
            throw new Error(`Failed to update pitch deck ${deck.id} after step: ${result.name}`);
          }
          await streamCallback({
            ...result,
            data: enrichedData,
          });
        },
        promptConfig,
        'pitch_deck',
        userId,
        undefined, // finalizationCallback
        existingSections
      );

      // The stored PDF no longer matches the regenerated sections
      await cacheService.delete(pdfCacheKey(userId, projectId, deck.id), { prefix: 'pdf' });

      return deliverableDocumentStore.find(userId, projectId, 'pitchDeck', deck.id);
    }

    const stepResults = await this.processSteps(configuredSteps, project, promptConfig);
    sectionResults = await Promise.all(
      // Même passe que dans la branche streamée : les deux chemins produisent le
      // même document, ils doivent subir les mêmes contrôles.
      stepResults.map(async (r) => ({
        name: r.name,
        type: r.type,
        data: await polishSlide(r.name, r.data),
        summary: r.summary,
      }))
    );

    const updated = await persist();
    if (updated) {
      // The stored PDF no longer matches the regenerated sections
      await cacheService.delete(pdfCacheKey(userId, projectId, deck.id), { prefix: 'pdf' });
    }
    return updated;
  }

  /**
   * Generates a 16:9 landscape slide PDF from the stored sections.
   */
  async generatePitchDeckPdf(userId: string, projectId: string, documentId?: string): Promise<string> {
    logger.info(
      `PitchDeckService.generatePitchDeckPdf userId=${userId} projectId=${projectId} documentId=${documentId ?? '(primary)'}`
    );
    const startedAt = Date.now();
    const project = await this.projectRepository.findById(projectId, `users/${userId}/projects`);
    if (!project) {
      logger.warn(`PitchDeckService.generatePitchDeckPdf: project not found ${projectId}`);
      throw new Error(`Project not found with ID: ${projectId}`);
    }

    const pitchDeck = findDocument(project.analysisResultModel, 'pitchDeck', documentId);
    if (!pitchDeck || !pitchDeck.sections || pitchDeck.sections.length === 0) {
      logger.warn(
        `PitchDeckService.generatePitchDeckPdf: no sections available for projectId=${projectId}`
      );
      return '';
    }

    const cacheKey = pdfCacheKey(userId, projectId, pitchDeck.id);
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
        projectDescription: project.longDescription || project.description || '',
        sections: pitchDeck.sections,
        sectionDisplayOrder: getPitchDeckType(pitchDeck.type).slides,
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
