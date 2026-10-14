import { normalizeCreativity, CreativityLevel } from '../../models/creativity.model';
import { coverContent, sectionHtml, TEXT_BUDGETS, WRITING_RULES } from '@idem/graphic-engine';
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

import { composeSlideBrief, SLIDE_VISUAL_PLANS } from './prompts/slide-briefs.prompt';
import { condenseSlide } from './slide-condense';
import { CoverBriefService } from '../common/coverBrief.service';
import { composeGraphicPage, coverDateLabel, GenerationJournal, openGraphicDocument, pageId, withProjectArtDirection } from '../graphic/graphic.service';
import type { PitchDeckAudience } from './deck-types';

/** Mention de destinataire sur la couverture du deck. */
const DECK_AUDIENCE_LABEL: Record<PitchDeckAudience, string> = {
  investor: 'Présentation investisseurs',
  bank: 'Présentation bancaire',
  customer: 'Présentation commerciale',
  partner: 'Présentation partenaires',
  jury: 'Présentation au jury',
};
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
    documentId?: string,
    /** La jauge de créativité (profils du moteur graphique, @idem/graphic-engine) ; Medium par défaut. */
    creativity?: CreativityLevel
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

    // La direction artistique est provisionnée si la charte n'a pas encore été générée : le deck peut
    // être le premier livrable produit, et ses slides ont besoin d'un style.
    const graphicProject = await withProjectArtDirection(this.promptService, userId, projectId, project);

    // LE DOCUMENT GRAPHIQUE du deck (@idem/graphic-engine) : la charte, le plan des slides — chacune reçoit
    // d'avance une composition distincte de ses voisines —, la jauge de créativité. La clé est propre au
    // deck : deux decks du projet ne se ressemblent pas slide pour slide.
    const designKey = documentDesignKey('pitchdeck', projectId, deck.id);
    const level: CreativityLevel = normalizeCreativity(creativity);
    // High, Max, Ultra : le rédacteur choisit la stratégie visuelle de ses slides et la correction ciblée s'applique.
    const creativeLevel = level === 'high' || level === 'max' || level === 'ultra';
    // Le journal de la génération : chaque slide y verse sa trace ; l'enregistrement est gardé avec le deck.
    const journal = new GenerationJournal('pitch-deck', level);
    const total = deckSlides.length;
    const graphic = await openGraphicDocument({
      project: graphicProject,
      documentType: 'pitch-deck',
      format: 'slide-16x9',
      seed: designKey,
      creativity: level,
      sections: deckSlides.map((definition) => ({ id: pageId(definition.name), role: definition.freeform ? ('cover' as const) : undefined })),
      documentLabel: 'Pitch deck',
      userId,
    });
    // Le cran retenu, enregistré avec le deck.
    await deliverableDocumentStore
      .update(userId, projectId, 'pitchDeck', deck.id, (current) => ({ ...current, design: { level, pages: {} } }), { touch: false })
      .catch((error: any) => logger.warn('[DECK] Cran de créativité non enregistré', { error: error?.message }));
    logger.info(`[DECK] Créativité ${level} : ${total} slide(s) composées par le moteur graphique`);

    // PRÉFIXE STABLE — identique à toutes les slides, émis UNE fois en tête : le projet, les faits de
    // marque et les règles d'écriture. La composition est celle du moteur.
    const stablePrefix = [projectDescription, `BRAND FACTS:\nBrand: ${brandName}`, WRITING_RULES].join('\n\n');

    const renderPage = async (content: Parameters<typeof composeGraphicPage>[1], position: { index: number; total: number }) => sectionHtml(journal.page(await composeGraphicPage(graphic, content, position)));
    /** L'enregistrement de la génération, gardé avec le deck (décisions, médias, réparations, replis, constats). */
    const keepRecord = () =>
      deliverableDocumentStore
        .update(userId, projectId, 'pitchDeck', deck.id, (current) => ({ ...current, design: { ...(current.design ?? { level, pages: {} }), record: journal.finish() } }), { touch: false })
        .catch((error: any) => logger.warn('[DECK] Enregistrement de génération non gardé', { error: error?.message }));

    const steps: IPromptStep[] = deckSlides.map((definition, index) => {
      const position = { index: index + 1, total };
      // La couverture est dessinée par le moteur : le modèle n'en écrit que les mots, une fois par
      // projet, partagés avec la charte et le business plan.
      if (definition.freeform) {
        return {
          stepName: definition.name,
          promptConstant: '',
          execute: async () => {
            const brief = await new CoverBriefService(this.promptService).resolve(userId, projectId, project);
            return renderPage(
              coverContent({
                id: pageId(definition.name),
                brandName,
                documentLabel: 'Pitch deck',
                kicker: brief.kicker,
                promise: brief.promise,
                detail: DECK_AUDIENCE_LABEL[deckType.audience],
                dateLabel: coverDateLabel(),
              }),
              position
            );
          },
        };
      }
      // Le brief ne porte QUE le contenu, lu par le destinataire du deck. Une slide est une toile fixe :
      // le volume est bas (3 à 4 blocs), et le moteur mesure, resserre et répare avant de rendre.
      const brief = composeSlideBrief(definition.name, deckType.audience) ?? `Write the "${definition.name}" slide of this pitch deck: one idea, one to three blocks.`;
      // L'INTENTION de la slide : comment elle démontre son message et ce qu'elle peut porter de texte. Aux
      // crans Low et Medium, le code décide de la stratégie ; à partir de High, le rédacteur peut en proposer
      // une autre de la liste — il décide quoi montrer, le moteur le construit, le vérifie et le répare.
      const plan = SLIDE_VISUAL_PLANS[definition.name];
      const intent = plan
        ? { visualStrategy: plan.strategy, textBudget: TEXT_BUDGETS[plan.budget], ...(creativeLevel ? { allowStrategies: [plan.strategy, ...plan.alternatives] } : {}) }
        : undefined;
      return {
        stepName: definition.name,
        promptConstant: brief,
        stablePrefix,
        template: {
          deliverable: 'pitch-deck',
          sectionId: pageId(definition.name),
          // Une slide porte une idée : un à trois blocs, jamais plus.
          volume: '1 to 3',
          contentBrief: brief,
          ...(intent ? { intent } : {}),
          render: async (content) => {
            const out = journal.page(await composeGraphicPage(graphic, content, position));
            // Trop de texte pour son rôle (à tous les crans) : la slide repart UNE fois chez le rédacteur, avec le
            // constat chiffré — `condenseSlide` mesure lui-même le dépassement (au-delà de 1,1× le budget).
            if (intent) {
              const condensed = await condenseSlide(content, { userId, projectId, slideName: definition.name, intent });
              if (condensed) {
                journal.note(`${definition.name} : slide trop textuelle réécrite plus légère par le rédacteur`);
                return sectionHtml(journal.page(await composeGraphicPage(graphic, condensed, position)));
              }
            }
            return sectionHtml(out);
          },
        },
      };
    });

    // Chaque slide reçoit son propre budget de tokens et sa température (AI_CONFIG.pitchDeck.sections).
    // Les dépendances entre slides viennent du catalogue (`deck-types.ts`) — notamment `Ask` ←
    // `Financials`, pour que le montant demandé découle des projections affichées plus tôt.
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
      fallbackModels: AI_CONFIG.pitchDeck.fallbackModels,
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

          const section: SectionModel = {
            name: result.name,
            type: result.type,
            data: result.data,
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
          await streamCallback(result);
        },
        promptConfig,
        'pitch_deck',
        userId,
        undefined, // finalizationCallback
        existingSections
      );

      // Les empreintes des slides rejoignent la mémoire de la marque : le prochain document ne les répète pas.
      await graphic.remember();
      await keepRecord();

      // The stored PDF no longer matches the regenerated sections
      await cacheService.delete(pdfCacheKey(userId, projectId, deck.id), { prefix: 'pdf' });

      return deliverableDocumentStore.find(userId, projectId, 'pitchDeck', deck.id);
    }

    const stepResults = await this.processSteps(configuredSteps, project, promptConfig);
    await graphic.remember();
    await keepRecord();
    sectionResults = stepResults.map((r) => ({ name: r.name, type: r.type, data: r.data, summary: r.summary }));

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
}
