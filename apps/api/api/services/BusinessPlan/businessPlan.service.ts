import { CreativityLevel, normalizeCreativity } from '../../models/creativity.model';
import { coverContent, GraphicDocument, WRITING_RULES } from '@idem/graphic-engine';
import { PromptConfig, PromptService } from '../prompt.service';
import { AI_CONFIG } from '../../config/ai.config';

import { ProjectModel } from '../../models/project.model';
import logger from '../../config/logger';
import {
  BusinessPlanDocument,
  BusinessPlanModel,
  BusinessPlanPdfQuality,
} from '../../models/businessPlan.model';
import {
  GenericService,
  IPromptStep,
  ISectionResult,
  withGraph,
} from '../common/generic.service';
import { buildBusinessPlanGraph } from '../agents/deliverable-graph';
import { SectionModel } from '../../models/section.model';
import { PdfService, isUnderfilledSection } from '../pdf.service';
import { cacheService, CacheOptions } from '../cache.service';
import { getRequestLanguage, SupportedLanguage } from '../../utils/request-language';
import crypto from 'crypto';
import { buildFinanceBlocks, buildFinanceNarrative } from '../Finance/finance-blocks';
import { BP_SECTION_EXAMPLE } from './prompts/section-example.prompt';
import { composeBrief } from './prompts/section-prompt.registry';
import { buildBusinessPlanSpec } from './businessPlanSpec';
import { BusinessPlanStructure } from '../../models/businessPlanStructure.model';
import {
  BP_RESOURCES_SECTION_NAME,
  BusinessPlanSectionDefinition,
} from './structure/section-catalog';
import {
  buildStructure,
  resolveStructure,
  structureSectionNames,
} from './structure/structure.resolver';
import { BUSINESS_PLAN_PAGINATION } from './businessPlanPdf.options';
import { TeamMember } from '../../models/project.model';
import { storageService } from '../storage.service';
import { CoverBriefService } from '../common/coverBrief.service';
import { coverDateLabel, openGraphicDocument, pageComposition, pageId, renderGraphicPage, withProjectArtDirection } from '../graphic/graphic.service';
import type { BusinessPlanAudience } from './structure/audience.types';

/** Mention de destinataire sur la couverture du plan. */
const BUSINESS_PLAN_AUDIENCE_LABEL: Partial<Record<BusinessPlanAudience, string>> = {
  bank: 'Dossier bancaire',
  investor: 'Dossier investisseurs',
  grant: 'Dossier de subvention',
  internal: 'Document interne',
};
import { researchTeamService } from '../research/research-team.service';
import { ResearchEmit, ResearchedSection } from '../research/research.types';
import { deliverableDocumentStore } from '../common/deliverable-document.store';
import {
  countCompletedSections,
  DeliverableDocumentSummary,
  documentDesignKey,
  findDocument,
  listDocuments,
} from '../common/deliverable-documents';

/**
 * Ordre d'affichage d'un plan : les sections de sa structure, puis la
 * bibliographie.
 *
 * La liste était figée à neuf noms. Elle est maintenant dérivée de la structure
 * choisie sur le projet — modèle bancaire, modèle investisseur, composition
 * libre. `Ressources` reste en DERNIER et doit y figurer : le PDF rejette en
 * fin de document toute section absente de cette liste, et une page construite
 * mais jamais affichée est le pire des deux mondes.
 */
export const businessPlanSectionNames = (
  sections: readonly BusinessPlanSectionDefinition[]
): string[] => [...sections.map((s) => s.name), BP_RESOURCES_SECTION_NAME];

/** Rang d'une section dans un ordre donné ; les inconnues vont en fin. */
const orderIndexIn = (order: readonly string[], name: string): number => {
  const i = order.indexOf(name);
  return i === -1 ? order.length : i;
};

/** PDF d'UN plan : un projet en garde plusieurs, chacun avec son rendu. */
const businessPlanPdfCacheKey = (userId: string, projectId: string, documentId: string): string =>
  cacheService.generateAIKey('business-plan-pdf', userId, projectId, documentId);

export class BusinessPlanService extends GenericService {
  private pdfService: PdfService;

  constructor(promptService: PromptService) {
    super(promptService);
    this.pdfService = new PdfService();
    logger.info('BusinessPlanService initialized.');
  }

  async generateBusinessPlanWithStreaming(
    userId: string,
    projectId: string,
    streamCallback?: (sectionResult: ISectionResult) => Promise<void>,
    forceRegenerate = false,
    targetSections: string[] = [],
    documentId?: string,
    /** La jauge de créativité (profils du moteur graphique, @idem/graphic-engine) ; Medium par défaut. */
    creativity?: CreativityLevel
  ): Promise<BusinessPlanDocument | null> {
    logger.info(
      `Generating business plan with streaming for userId: ${userId}, projectId: ${projectId}, documentId: ${documentId ?? '(primary)'}, force: ${forceRegenerate}, targetSections: [${targetSections.join(', ')}]`
    );

    // Generate cache key based on project content
    const project = await this.getProject(projectId, userId);
    if (!project) {
      return null;
    }

    const plan = findDocument(project.analysisResultModel, 'businessPlan', documentId);
    if (!plan) {
      logger.warn(`No business plan ${documentId ?? '(primary)'} in project ${projectId}`);
      return null;
    }
    // Graine de composition propre au plan : deux plans du projet ne sortent
    // pas page pour page avec la même disposition.
    const designKey = documentDesignKey('businessplan', projectId, plan.id);

    // STRUCTURE DU PLAN — modèle bancaire, modèle investisseur, composition
    // libre. Elle décide des sections produites, de leur ordre et de leurs
    // briefs. Absente (plans d'avant la fonctionnalité), elle retombe sur le
    // modèle par défaut, qui est la structure historique en neuf sections.
    const { sections: planSections, audience: planAudience } = resolveStructure(plan.structure);
    const sectionNames = businessPlanSectionNames(planSections);

    const projectDescription =
      this.extractProjectDescription(project) +
      '\n' +
      'Additional infos: ' +
      JSON.stringify(project.additionalInfos);
    const contentHash = crypto
      .createHash('sha256')
      .update(
        JSON.stringify({
          name: project.name,
          description: project.longDescription || project.description,
          branding: project.analysisResultModel?.branding,
          projectDescription,
          // Sans la structure dans l'empreinte, changer de modèle de plan
          // servirait le plan précédent depuis le cache.
          structure: planSections.map((section) => section.key),
        })
      )
      .digest('hex')
      .substring(0, 16);

    // Une clé PAR PLAN : deux plans du même projet ne se servent pas l'un l'autre.
    const cacheKey = cacheService.generateAIKey('business-plan', userId, projectId, `${plan.id}:${contentHash}`);

    // The cached result may be an incomplete plan (it is updated after each step),
    // so only short-circuit on it when nothing needs to be (re)generated.
    const currentSections = plan.sections || [];
    const skipCacheRead =
      forceRegenerate ||
      targetSections.length > 0 ||
      currentSections.length < planSections.length;

    if (!skipCacheRead) {
      const cachedResult = await cacheService.get<BusinessPlanDocument>(cacheKey, {
        prefix: 'ai',
        ttl: 7200, // 2 hours
      });

      if (cachedResult?.id === plan.id) {
        logger.info(`Business plan cache hit for projectId: ${projectId}`);
        return cachedResult;
      }
    }

    logger.info(`Business plan cache miss, generating new content for projectId: ${projectId}`);

    // La langue de la requête (celle de l'interface), et non un « fr » codé en dur.
    const language = getRequestLanguage() === 'fr' ? 'French' : 'English';

    // La direction artistique est provisionnée si la charte n'a pas encore été générée : le business
    // plan peut être le premier livrable produit, et ses pages ont besoin d'un style.
    const graphicProject = await withProjectArtDirection(this.promptService, userId, projectId, project);

    // Le contexte financier vient d'un point unique. Les tableaux sont POSÉS par le service ; ce résumé
    // ne sert qu'à ce que les autres sections ne contredisent pas le module Finance.
    const financeContext = buildFinanceNarrative(
      project.analysisResultModel?.finance,
      project.additionalInfos?.country
    );

    try {
      // Les dépendances entre sections vivent dans le catalogue (`requires`) et sont assemblées par
      // `buildBusinessPlanGraph` (services/agents/deliverable-graph.ts).
      //
      // PRÉFIXE STABLE — identique à toutes les sections, émis UNE fois en tête de chaque appel : c'est
      // la seule disposition qui rende un cache de préfixe possible. Il ne porte que ce qui sert à
      // ÉCRIRE : la composition est celle du moteur graphique, et une consigne inerte n'est pas neutre —
      // elle prend la place de celles qui comptent.
      const stablePrefix = this.writerPrefix(projectDescription, project, language);

      // LE DOCUMENT GRAPHIQUE (@idem/graphic-engine) : la charte du projet, le plan des pages — chacune
      // reçoit d'avance une composition distincte de ses voisines —, la jauge de créativité. La clé du
      // plan sème les tirages : deux plans du même projet ne sortent pas page pour page identiques.
      const level = normalizeCreativity(creativity);
      const total = planSections.length;
      const graphic = await this.openPlanDocument(graphicProject, planSections, designKey, level, userId);
      await this.saveDesignLevel(userId, projectId, plan.id, level);
      logger.info(`[BP] Créativité ${level} : ${total} page(s) composées par le moteur graphique`);

      // Les étapes viennent de la STRUCTURE : le plan peut porter neuf sections ou dix-sept, dans
      // l'ordre qu'une banque impose.
      const steps: IPromptStep[] = planSections.map((section, index) => {
        const position = { index: index + 1, total };
        // La couverture est dessinée par le moteur : le modèle n'en écrit que les mots, une fois par
        // projet, partagés avec la charte et le deck.
        if (section.freeform) {
          return {
            stepName: section.name,
            promptConstant: '',
            execute: () => this.renderCover(graphic, section, userId, projectId, project, planAudience, position),
          };
        }
        // Contexte de CETTE section dans CE document : son destinataire, son rang, ses voisines. Sans
        // lui, chaque section recommence par présenter l'entreprise et le plan se répète.
        const brief =
          composeBrief(section.key, {
            audience: planAudience,
            position: index + 1,
            total,
            previous: planSections[index - 1]?.name,
            next: planSections[index + 1]?.name,
            financeContext: section.financeContext ? financeContext : undefined,
          }) ?? '';
        return {
          promptConstant: brief,
          stepName: section.name,
          stablePrefix,
          template: {
            deliverable: 'business-plan',
            sectionId: pageId(section.name),
            volume: section.volume,
            contentBrief: brief,
            // Les tableaux financiers viennent du module Finance, pas du modèle : un chiffre recopié
            // dans un contexte de plusieurs milliers de mots est un chiffre altéré.
            prependBlocks: section.financeBlocks
              ? buildFinanceBlocks(project.analysisResultModel?.finance, project.additionalInfos?.country)
              : undefined,
            render: (content) => renderGraphicPage(graphic, content, position),
          },
        };
      });

      // La grille déterministe attrape troncatures, balises déséquilibrées et gabarits non remplis
      // avant que la section n'atteigne le PDF. La devise vient du module Finance quand il existe.
      const sectionQuality = {
        format: 'html' as const,
        minChars: 400,
        currency: project.analysisResultModel?.finance?.meta?.currency,
      };

      // Le graphe pose les dépendances, `withGraph` y ajoute les réglages IA de chaque section.
      const configuredSteps = withGraph(
        AI_CONFIG.businessPlan,
        steps,
        buildBusinessPlanGraph(planSections),
        sectionQuality,
        stablePrefix
      );

      const promptConfig: PromptConfig = {
        provider: AI_CONFIG.businessPlan.provider,
        modelName: AI_CONFIG.businessPlan.modelName,
        llmOptions: AI_CONFIG.businessPlan.llmOptions,
        // Était omis : la chaîne de repli déclarée dans ai.config.ts n'atteignait
        // jamais runPrompt, donc une saturation du modèle perdait la section.
        fallbackModels: AI_CONFIG.businessPlan.fallbackModels,
      };

      // Load existing sections if not forcing regeneration.
      // Sections listed in targetSections are dropped so they get regenerated,
      // while the others are kept as-is (resume semantics).
      // Les sections qui ne sont PLUS dans la structure sont abandonnées :
      // sinon un changement de modèle laisserait deux sommaires superposés
      // dans le même document (cf. le chemin « équipe de recherche »).
      const inStructure = new Set(sectionNames);
      const keptSections = currentSections.filter((s) => inStructure.has(s.name));
      const existingSections = forceRegenerate
        ? []
        : targetSections.length > 0
          ? keptSections.filter((s) => !targetSections.includes(s.name))
          : keptSections;

      // Initialize sections array with existing sections to collect results
      let sectionResults: SectionModel[] = [...existingSections];

      // Process steps one by one with streaming if callback provided
      if (streamCallback) {
        await this.processStepsWithStreaming(
          configuredSteps,
          project,
          async (result: ISectionResult) => {
            logger.info(`Received streamed result for step: ${result.name}`);

            // Skip progress and completion events - handle only actual step results
            if (
              result.data === 'steps_in_progress' ||
              result.data === 'all_steps_completed' ||
              // L'aperçu au fil de l'eau est relayé, jamais enregistré comme section.
              result.name === 'section_delta'
            ) {
              await streamCallback(result);
              return;
            }

            // La page vient du moteur graphique : palette, polices, contrastes et logo y sont garantis
            // par construction — il n'y a plus de HTML de modèle à redresser.
            const sectionHtml = result.data;

            // Convert result to section model
            const composition = pageComposition(graphic, result.name);
            const section: SectionModel = {
              name: result.name,
              type: result.type,
              data: sectionHtml,
              summary: result.summary,
              ...(composition ? { composition } : {}),
            };

            // Add or replace in sections array to avoid duplicates
            const existingIndex = sectionResults.findIndex((s) => s.name === section.name);
            if (existingIndex !== -1) {
              sectionResults[existingIndex] = section;
            } else {
              sectionResults.push(section);
            }

            // Ordre du document = ordre de la structure. Il venait de `steps`,
            // qui ne connaît pas la bibliographie : celle-ci remontait alors en
            // tête du plan (indexOf === -1).
            sectionResults.sort(
              (a, b) => orderIndexIn(sectionNames, a.name) - orderIndexIn(sectionNames, b.name)
            );

            // Persisté après chaque étape, dans CE plan : structure, nom et
            // qualité PDF sont conservés par le store.
            const updatedPlan = await deliverableDocumentStore.update(
              userId,
              projectId,
              'businessPlan',
              plan.id,
              (current) => ({ ...current, sections: sectionResults })
            );

            if (updatedPlan) {
              logger.info(
                `Successfully updated business plan ${plan.id} with step: ${result.name} - projectId: ${projectId}`
              );

              // Update cache with latest plan state
              await cacheService.set(cacheKey, updatedPlan, {
                prefix: 'ai',
                ttl: 7200, // 2 hours
              });

              // Only send to frontend after successful database update
              await streamCallback(result);
            } else {
              logger.error(
                `Failed to update business plan ${plan.id} after step: ${result.name} - projectId: ${projectId}`
              );
              throw new Error(`Failed to update business plan after step: ${result.name}`);
            }
          },
          promptConfig,
          'business_plan',
          userId,
          undefined, // finalizationCallback
          existingSections
        );

        // Les empreintes des pages rejoignent la mémoire de la marque : le prochain document ne les répète pas.
        await graphic.remember();

        // The stored PDF no longer matches the regenerated sections
        await cacheService.delete(businessPlanPdfCacheKey(userId, projectId, plan.id), { prefix: 'pdf' });

        return deliverableDocumentStore.find(userId, projectId, 'businessPlan', plan.id);
      } else {
        // Fallback to non-streaming processing
        const stepResults = await this.processSteps(configuredSteps, project, promptConfig);
        await graphic.remember();
        sectionResults = stepResults.map((result) => {
          const composition = pageComposition(graphic, result.name);
          return { name: result.name, type: result.type, data: result.data, summary: result.summary, ...(composition ? { composition } : {}) };
        });

        const updatedPlan = await deliverableDocumentStore.update(
          userId,
          projectId,
          'businessPlan',
          plan.id,
          (current) => ({ ...current, sections: sectionResults })
        );

        if (updatedPlan) {
          logger.info(`Successfully updated business plan ${plan.id} of project ${projectId}`);

          // Cache the result for future requests
          await cacheService.set(cacheKey, updatedPlan, {
            prefix: 'ai',
            ttl: 7200, // 2 hours
          });

          // The stored PDF no longer matches the regenerated sections
          await cacheService.delete(businessPlanPdfCacheKey(userId, projectId, plan.id), { prefix: 'pdf' });
        }
        return updatedPlan;
      }
    } catch (error) {
      logger.error(`Error generating business plan for projectId ${projectId}:`, error);
      throw error;
    } finally {
      logger.info(`Completed business plan generation for projectId ${projectId}`);
    }
  }

  /**
   * Génère le business plan via l'ÉQUIPE D'AGENTS DE RECHERCHE:
   * chercheurs (grounding web) → rédacteur (citations [sN]) → vérificateur
   * (anti-invention). Les micro-actions sont diffusées en temps réel via `emit`
   * (salle de contrôle), et chaque section est persistée dès qu'elle est prête.
   */
  async generateBusinessPlanWithResearchTeam(
    userId: string,
    projectId: string,
    emit: ResearchEmit,
    forceRegenerate = false,
    targetSections: string[] = [],
    documentId?: string,
    /** La jauge de créativité (famille, pages dirigées, composition libre au cran Ultra). */
    creativity?: CreativityLevel
  ): Promise<BusinessPlanDocument | null> {
    logger.info(
      `Generating business plan with RESEARCH TEAM for userId: ${userId}, projectId: ${projectId}, documentId: ${documentId ?? '(primary)'}, force: ${forceRegenerate}, targets: [${targetSections.join(', ')}]`
    );

    const project = await this.getProject(projectId, userId);
    if (!project) return null;

    const plan = findDocument(project.analysisResultModel, 'businessPlan', documentId);
    if (!plan) {
      logger.warn(`No business plan ${documentId ?? '(primary)'} in project ${projectId}`);
      return null;
    }
    const designKey = documentDesignKey('businessplan', projectId, plan.id);

    const projectDescription =
      this.extractProjectDescription(project) +
      '\n' +
      'Additional infos: ' +
      JSON.stringify(project.additionalInfos);

    const language = getRequestLanguage() === 'fr' ? 'French' : 'English';
    const brandContext = this.brandFacts(project, language);

    const financeContext = this.buildFinanceContext(project);
    const currency = project.analysisResultModel?.finance?.meta?.currency;
    const country = project.additionalInfos?.country || '';

    const cacheKey = cacheService.generateAIKey(
      'business-plan',
      userId,
      projectId,
      // Un plan = une clé. Une structure différente est un document différent :
      // l'omettre ferait écrire deux plans sous la même clé de cache.
      `${plan.id}:${crypto
        .createHash('sha256')
        .update(
          JSON.stringify({
            projectDescription,
            structure: plan.structure?.sectionKeys ?? [],
          })
        )
        .digest('hex')
        .substring(0, 16)}`
    );

    // STRUCTURE DU PLAN — c'est elle qui décide des sections produites et de
    // leur ordre. Un plan sans structure retombe sur le modèle par défaut, qui
    // est la structure historique en neuf sections : un plan déjà généré reste
    // donc régénérable à l'identique.
    const { sections: planSections, audience: planAudience } = resolveStructure(plan.structure);
    const orderedNames = businessPlanSectionNames(planSections);
    const inStructure = new Set(orderedNames);

    // Résumé/reprise: quelles sections conserver telles quelles.
    //
    // Celles qui ne sont PLUS dans la structure sont abandonnées. Sans ce
    // filtre, changer de modèle après une première génération laisserait les
    // anciennes sections dans le document : elles ne seraient pas régénérées,
    // le PDF les rejetterait en fin de document faute de rang, et le plan
    // porterait deux sommaires superposés.
    const currentSections = plan.sections || [];
    const keptSections = currentSections.filter((s) => inStructure.has(s.name));
    const existingSections: SectionModel[] = forceRegenerate
      ? []
      : targetSections.length > 0
        ? keptSections.filter((s) => !targetSections.includes(s.name))
        : keptSections;
    const existingNames = new Set(existingSections.map((s) => s.name));

    const fullSpec = buildBusinessPlanSpec(planSections, {
      audience: planAudience,
      projectDescription,
      financeContext,
      country,
    });
    // LE DOCUMENT GRAPHIQUE : le même que dans le chemin standard — même charte, même plan, même graine.
    // Les sections issues de la recherche sont des sections du document, pas des pages à part.
    const level = normalizeCreativity(creativity);
    const graphicProject = await withProjectArtDirection(this.promptService, userId, projectId, project);
    const graphic = await this.openPlanDocument(graphicProject, planSections, designKey, level, userId, true);
    await this.saveDesignLevel(userId, projectId, plan.id, level);
    const total = orderedNames.length;

    // La couverture est dessinée par le moteur, comme dans le chemin standard : même page, mêmes mots.
    for (const section of fullSpec) {
      if (!section.freeform) continue;
      const definition = planSections.find((p) => p.name === section.name);
      section.compose = () =>
        this.renderCover(graphic, definition ?? { name: section.name }, userId, projectId, project, planAudience, {
          index: orderIndexIn(orderedNames, section.name) + 1,
          total,
        });
    }

    // À (re)générer: celles qui ne sont pas conservées (ou celles ciblées).
    const sectionsToGenerate = fullSpec.filter((s) =>
      targetSections.length > 0 ? targetSections.includes(s.name) : !existingNames.has(s.name)
    );

    if (sectionsToGenerate.length === 0) {
      logger.info(`Nothing to generate for business plan ${plan.id} of project ${projectId} (all sections present).`);
      return plan;
    }

    const sectionResults: SectionModel[] = [...existingSections];
    const orderIndex = (name: string) => orderIndexIn(orderedNames, name);

    const persistSection = async (rs: ResearchedSection): Promise<void> => {
      const section: SectionModel = {
        name: rs.name,
        // Le rédacteur produit désormais du HTML/Tailwind (pages A4, graphes,
        // citations), rendu tel quel par l'éditeur et le PDF.
        type: 'text/html',
        data: rs.data,
        summary: rs.summary,
        sources: rs.sources?.map((s) => ({
          id: s.id,
          title: s.title,
          url: s.url,
          domain: s.domain,
        })),
        verification: rs.verdict
          ? {
              passed: rs.verdict.passed,
              citedClaims: rs.verdict.citedClaims,
              uncitedClaims: rs.verdict.uncitedClaims,
            }
          : undefined,
        // La recherche voyage avec la section : une régénération la relit au lieu de refaire des appels web.
        ...(rs.research ? { research: rs.research } : {}),
        ...(() => {
          const composition = pageComposition(graphic, rs.name, rs.name === BP_RESOURCES_SECTION_NAME ? 'resources' : pageId(rs.name));
          return composition ? { composition } : {};
        })(),
        updatedAt: new Date(),
      };

      const idx = sectionResults.findIndex((s) => s.name === section.name);
      if (idx !== -1) sectionResults[idx] = section;
      else sectionResults.push(section);
      sectionResults.sort((a, b) => orderIndex(a.name) - orderIndex(b.name));

      // Écrit dans CE plan : structure, nom et qualité PDF sont conservés.
      const updated = await deliverableDocumentStore.update(
        userId,
        projectId,
        'businessPlan',
        plan.id,
        (current) => ({ ...current, sections: sectionResults })
      );
      if (!updated) throw new Error(`Business plan ${plan.id} not found in project ${projectId}`);
      await cacheService.set(cacheKey, updated, { prefix: 'ai', ttl: 7200 });
    };

    await researchTeamService.runResearchTeam(
      sectionsToGenerate,
      {
        projectContext: projectDescription,
        // Identité stable pour le cache des recherches : une régénération du même projet doit
        // RÉUTILISER les faits déjà collectés.
        projectId,
        // Bibliographie rassemblée en fin de document, construite par le code sans appel de modèle.
        resourcesSectionName: BP_RESOURCES_SECTION_NAME,
        brandContext,
        language,
        userId,
        currency,
        // Les recherches déjà faites pour CE plan (même en régénération complète, qui vide les sections) :
        // régénérer change la forme, pas les données — et n'interroge pas le web une seconde fois.
        storedResearch: Object.fromEntries(
          currentSections.filter((s) => s.research?.digest).map((s) => [s.name, s.research!])
        ),
        // Chaque page est composée DANS le document du plan, à son rang.
        renderPage: (name, section, _index) =>
          renderGraphicPage(
            graphic,
            { ...section, id: name === BP_RESOURCES_SECTION_NAME ? 'resources' : pageId(name) },
            { index: orderIndex(name) + 1, total }
          ),
      },
      emit,
      persistSection
    );
    await graphic.remember();

    // Le PDF stocké ne correspond plus aux sections régénérées.
    await cacheService.delete(businessPlanPdfCacheKey(userId, projectId, plan.id), { prefix: 'pdf' });

    return deliverableDocumentStore.find(userId, projectId, 'businessPlan', plan.id);
  }


  /** Le document graphique du plan : une page par section de la structure (et la bibliographie). */
  private openPlanDocument(
    project: ProjectModel,
    planSections: ReadonlyArray<BusinessPlanSectionDefinition>,
    designKey: string,
    level: CreativityLevel,
    userId: string,
    withResources = false
  ): Promise<GraphicDocument> {
    return openGraphicDocument({
      project,
      documentType: 'business-plan',
      format: 'a4-portrait',
      seed: designKey,
      creativity: level,
      sections: [
        ...planSections.map((section) => ({ id: pageId(section.name), role: section.freeform ? ('cover' as const) : undefined })),
        ...(withResources ? [{ id: 'resources', role: 'appendix' as const }] : []),
      ],
      documentLabel: 'Business plan',
      userId,
    });
  }

  /** Le cran de la jauge, enregistré avec le plan : la mise à jour du plan financier le reprend. */
  private async saveDesignLevel(userId: string, projectId: string, documentId: string, level: CreativityLevel): Promise<void> {
    await deliverableDocumentStore
      .update(userId, projectId, 'businessPlan', documentId, (current) => ({ ...current, design: { level, pages: {} } }), { touch: false })
      .catch((error: any) => logger.warn('[BP] Cran de créativité non enregistré', { error: error?.message }));
  }

  /**
   * La couverture : des mots écrits une fois par projet (partagés avec la charte et le deck), une page
   * composée par le moteur. Composée en HTML par un modèle, elle coûtait autrefois 18 000 jetons.
   */
  private async renderCover(
    graphic: GraphicDocument,
    section: Pick<BusinessPlanSectionDefinition, 'name'>,
    userId: string,
    projectId: string,
    project: ProjectModel,
    audience: BusinessPlanAudience | string | undefined,
    position: { index: number; total: number }
  ): Promise<string> {
    const brief = await new CoverBriefService(this.promptService).resolve(userId, projectId, project);
    return renderGraphicPage(
      graphic,
      coverContent({
        id: pageId(section.name),
        brandName: project.name || 'Marque',
        documentLabel: 'Business plan',
        kicker: brief.kicker,
        promise: brief.promise,
        detail: BUSINESS_PLAN_AUDIENCE_LABEL[audience as BusinessPlanAudience],
        dateLabel: coverDateLabel(),
      }),
      position
    );
  }

  /**
   * Le PRÉFIXE des rédacteurs : le projet, les faits de marque, les règles d'écriture et l'exemple
   * canonique — ce qui sert à ÉCRIRE, rien de plus. La composition est celle du moteur graphique.
   */
  private writerPrefix(projectDescription: string, project: ProjectModel, language: string): string {
    return [projectDescription, `BRAND FACTS:\n${this.brandFacts(project, language)}`, WRITING_RULES, BP_SECTION_EXAMPLE].join('\n\n');
  }

  /** Les faits de marque transmis aux rédacteurs. */
  private brandFacts(project: ProjectModel, language: string): string {
    return `Brand: ${project.name || 'Startup'}\nLanguage: ${language}`;
  }

  /** Contexte financier réel (module Finance) pour les agents — point unique. */
  private buildFinanceContext(project: ProjectModel): string {
    return buildFinanceNarrative(
      project.analysisResultModel?.finance,
      project.additionalInfos?.country
    );
  }

  /** Plan désigné, ou le plan principal sans identifiant. */
  async getBusinessPlansByProjectId(
    userId: string,
    projectId: string,
    documentId?: string
  ): Promise<BusinessPlanDocument | null> {
    logger.info(
      `Fetching business plan ${documentId ?? '(primary)'} for projectId: ${projectId}, userId: ${userId}`
    );
    return deliverableDocumentStore.find(userId, projectId, 'businessPlan', documentId);
  }

  toSummary(plan: BusinessPlanDocument): DeliverableDocumentSummary {
    const { structure, sections, audience } = resolveStructure(plan.structure);
    const expectedSectionNames = structureSectionNames(sections);
    return {
      id: plan.id,
      name: plan.name ?? null,
      variant: structure.templateId,
      audience,
      expectedSectionNames,
      completedSectionCount: countCompletedSections(expectedSectionNames, plan.sections),
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };
  }

  /** Plans du projet, en résumé ; `null` quand le projet est introuvable. */
  async listDocuments(userId: string, projectId: string): Promise<DeliverableDocumentSummary[] | null> {
    const plans = await deliverableDocumentStore.list(userId, projectId, 'businessPlan');
    return plans ? plans.map((plan) => this.toSummary(plan)) : null;
  }

  /**
   * Crée un plan vide sur une structure déjà validée (`buildStructure`) ; la
   * génération vient ensuite. `null` quand le projet est introuvable.
   */
  async createDocument(
    userId: string,
    projectId: string,
    structure: BusinessPlanStructure,
    name?: string
  ): Promise<BusinessPlanDocument | null> {
    return deliverableDocumentStore.create(userId, projectId, 'businessPlan', {
      structure,
      sections: [],
      ...(name ? { name } : {}),
    });
  }

  async renameDocument(
    userId: string,
    projectId: string,
    documentId: string,
    name: string
  ): Promise<BusinessPlanDocument | null> {
    return deliverableDocumentStore.update(
      userId,
      projectId,
      'businessPlan',
      documentId,
      (plan) => ({ ...plan, name }),
      // Renommer n'est pas modifier le contenu : le plan garde sa place dans la liste.
      { touch: false }
    );
  }

  async deleteDocument(userId: string, projectId: string, documentId: string): Promise<boolean> {
    const removed = await deliverableDocumentStore.remove(userId, projectId, 'businessPlan', documentId);
    if (removed) {
      await cacheService.delete(businessPlanPdfCacheKey(userId, projectId, documentId), {
        prefix: 'pdf',
      });
    }
    return removed;
  }

  /**
   * Plan visé par une génération. Sans identifiant (assistant, anciens appels) :
   * le plan principal, et un plan au modèle par défaut pour un projet qui n'en a
   * aucun. Un identifiant inconnu rend `null` — on n'écrit pas dans un autre
   * plan que celui demandé.
   */
  async ensureDocument(
    userId: string,
    projectId: string,
    documentId?: string
  ): Promise<BusinessPlanDocument | null> {
    if (documentId) {
      return deliverableDocumentStore.find(userId, projectId, 'businessPlan', documentId);
    }
    const primary = await deliverableDocumentStore.find(userId, projectId, 'businessPlan');
    return (
      primary ??
      deliverableDocumentStore.create(userId, projectId, 'businessPlan', {
        structure: resolveStructure(undefined).structure,
        sections: [],
      })
    );
  }

  /**
   * Structure retenue pour un plan.
   *
   * Rend TOUJOURS une structure exécutable : un plan qui n'a jamais choisi
   * reçoit le modèle par défaut, ce qui permet à l'UI d'afficher une sélection
   * cohérente sans traiter le cas « aucune structure ». `null` quand le projet,
   * ou le plan désigné, est introuvable.
   */
  async getStructure(
    userId: string,
    projectId: string,
    documentId?: string
  ): Promise<BusinessPlanStructure | null> {
    const project = await deliverableDocumentStore.loadProject(userId, projectId);
    if (!project) return null;
    const plan = findDocument(project.analysisResultModel, 'businessPlan', documentId);
    if (documentId && !plan) return null;
    return resolveStructure(plan?.structure).structure;
  }

  /**
   * Enregistre la structure choisie pour un plan, avant sa génération.
   *
   * Elle est validée contre le catalogue (`buildStructure`) : une clé inconnue
   * est écartée, une liste trop courte est refusée. Ce qui est persisté est
   * donc toujours générable — l'alternative, valider au moment de la
   * génération, ferait échouer un run déjà facturé.
   *
   * Sans `documentId`, la structure s'applique au plan principal ; un projet
   * sans plan en reçoit un.
   *
   * @returns La structure normalisée, ou `null` si le projet ou le plan est
   *          introuvable, ou si le choix ne donne aucune structure valide.
   */
  async saveStructure(
    userId: string,
    projectId: string,
    templateId: string | undefined,
    sectionKeys?: readonly string[] | null,
    documentId?: string
  ): Promise<BusinessPlanStructure | null> {
    const structure = buildStructure(templateId, sectionKeys);
    if (!structure) {
      logger.warn(
        `Invalid business plan structure rejected - projectId: ${projectId}, templateId: ${templateId}`
      );
      return null;
    }

    const plan = await this.ensureDocument(userId, projectId, documentId);
    if (!plan) {
      logger.warn(`Business plan ${documentId ?? '(primary)'} not found in project ${projectId} when saving its structure.`);
      return null;
    }

    // Les sections déjà générées sont conservées : changer de structure ne doit
    // pas effacer un plan, seulement ce qu'il faut (re)produire.
    const updated = await deliverableDocumentStore.update(
      userId,
      projectId,
      'businessPlan',
      plan.id,
      (current) => ({ ...current, structure })
    );
    if (!updated) return null;

    // Le PDF stocké ne correspond plus à l'ordre des sections.
    await cacheService.delete(businessPlanPdfCacheKey(userId, projectId, plan.id), { prefix: 'pdf' });

    logger.info(
      `Business plan structure saved for project ${projectId}, plan ${plan.id}: ${structure.templateId} (${structure.sectionKeys.length} sections)`
    );
    return structure;
  }

  async updateBusinessPlan(
    userId: string,
    itemId: string,
    data: Partial<Omit<ProjectModel, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>>
  ): Promise<BusinessPlanModel | null> {
    logger.info(`Attempting to update business plan for itemId: ${itemId}, userId: ${userId}`);
    try {
      const project = await this.projectRepository.findById(itemId, `users/${userId}/projects`);
      if (!project) {
        logger.warn(
          `Project not found with ID: ${itemId} for user: ${userId} when attempting to update business plan.`
        );
        return null;
      }

      const updatedProject = await this.projectRepository.update(itemId, data, userId);
      if (!updatedProject) {
        logger.warn(`Failed to update project or extract business plan for itemId: ${itemId}`);
        return null;
      }
      logger.info(`Successfully updated business plan for itemId: ${itemId}`);
      return findDocument(updatedProject.analysisResultModel, 'businessPlan');
    } catch (error: any) {
      logger.error(`Error updating business plan for itemId ${itemId}: ${error.message}`, {
        stack: error.stack,
        userId,
      });
      throw error; // Or return null depending on desired error handling
    }
  }

  /**
   * Génère un PDF à partir des sections de business plan d'un projet
   * @param userId - ID de l'utilisateur
   * @param projectId - ID du projet
   * @returns Chemin vers le fichier PDF temporaire généré
   */
  async generateBusinessPlanPdf(
    userId: string,
    projectId: string,
    documentId?: string
  ): Promise<string> {
    logger.info(
      `Generating PDF for business plan sections - projectId: ${projectId}, userId: ${userId}`
    );
    // Récupérer le projet et ses données de business plan
    const project = await this.projectRepository.findById(projectId, `users/${userId}/projects`);

    if (!project) {
      logger.warn(
        `Project not found with ID: ${projectId} for user: ${userId} when generating business plan PDF.`
      );
      throw new Error(`Project not found with ID: ${projectId}`);
    }

    const businessPlan = findDocument(project.analysisResultModel, 'businessPlan', documentId);
    if (!businessPlan || !businessPlan.sections || businessPlan.sections.length === 0) {
      logger.warn(`No business plan sections found for project ${projectId} when generating PDF.`);
      return '';
    }

    // L'ordre d'affichage suit la STRUCTURE du plan : une banque qui numérote
    // ses rubriques attend exactement sa numérotation. Toute section absente de
    // cette liste est rejetée en fin de document par le paginateur.
    const { sections: pdfSections } = resolveStructure(businessPlan.structure);

    // Generate cache key for PDF — one per plan
    const pdfCacheKey = businessPlanPdfCacheKey(userId, projectId, businessPlan.id);

    // Check if PDF is already cached
    const cachedPdfPath = await cacheService.get<string>(pdfCacheKey, {
      prefix: 'pdf',
      ttl: 3600, // 1 hour
    });

    if (cachedPdfPath) {
      logger.info(`Business plan PDF cache hit for projectId: ${projectId}`);
      return cachedPdfPath;
    }

    logger.info(`Business plan PDF cache miss, generating new PDF for projectId: ${projectId}`);

    // Capturer le rapport de pagination pour détecter les pages sous-remplies.
    let capturedPaginationReport: import('../pdf/flow-pagination.runtime').FlowPaginationReport | null = null;
    let capturedQualityReport: import('../pdf/pdfQualityGate').PdfQualityGateReport | null = null;

    // Utiliser le PdfService pour générer le PDF
    const pdfPath = await this.pdfService.generatePdf({
      title: 'Business Plan',
      projectName: project.name || 'Projet Sans Nom',
      projectDescription: project.longDescription || project.description || '',
      sections: businessPlan.sections,
      // IMPORTANT: doit correspondre EXACTEMENT aux noms de sections générés
      // (avec les "&"), sinon les sections non reconnues sont rejetées en fin de
      // document. On réutilise donc la liste canonique.
      sectionDisplayOrder: businessPlanSectionNames(pdfSections),
      footerText: 'Generated by Idem',
      // Sans elle, le moteur PDF charge et impose ses polices de repli (Archivo,
      // IBM Plex Sans) : tout le plan sortait hors charte, alors que l'éditeur,
      // qui la reçoit, affichait les bonnes familles.
      typography: project.analysisResultModel?.branding?.typography,
      // Le business plan est un document flexible : une section peut s'étendre sur
      // PLUSIEURS pages A4 (contenu détaillé, graphes, sources), sans qu'un bloc
      // soit coupé entre deux pages. Sans ceci, chaque section est rognée à 1 page.
      multiPage: true,
      // Écarts bornés, pages vides et grands blancs corrigés à la composition.
      // Réglages partagés avec `npm run check:bpquality`.
      pagination: BUSINESS_PLAN_PAGINATION,
      // Le PDF imprimé est relu page par page avant d'être renvoyé.
      qualityGate: true,
      onQualityReport: (report) => {
        capturedQualityReport = report;
      },
      // La couverture est une composition pleine page : elle est rendue telle
      // quelle, jamais redécoupée ni étirée par le paginateur.
      // Les pages à hauteur fixe viennent du catalogue : une composition pleine
      // page est rendue telle quelle, jamais redécoupée ni étirée.
      fixedPageSections: pdfSections.filter((section) => section.fixedPage).map((s) => s.name),
      onPaginationReport: (report) => {
        capturedPaginationReport = report;
      },
    });

    // Persister la qualité PDF (sections sous-remplies) sur le projet.
    await this.persistPdfQuality(
      userId,
      projectId,
      businessPlan.id,
      capturedPaginationReport,
      capturedQualityReport
    );

    // Cache the PDF path for future requests
    await cacheService.set(pdfCacheKey, pdfPath, {
      prefix: 'pdf',
      ttl: 3600, // 1 hour
    });
    logger.info(`Business plan PDF cached for projectId: ${projectId}`);

    return pdfPath;
  }

  /**
   * Met à jour les informations additionnelles d'un projet avec upload des images des team members
   * @param userId - ID de l'utilisateur
   * @param projectId - ID du projet
   * @param additionalInfos - Informations additionnelles de l'entreprise
   * @param teamMemberImages - Images des team members uploadées
   * @returns Projet mis à jour avec les informations additionnelles
   */
  async setAdditionalInfos(
    userId: string,
    projectId: string,
    additionalInfos: {
      email: string;
      phone?: string;
      address?: string;
      city?: string;
      country?: string;
      zipCode?: string;
      teamMembers: TeamMember[];
    },
    teamMemberImages?: Express.Multer.File[]
  ): Promise<{
    project: ProjectModel | null;
    uploadedImages?: { [memberIndex: number]: any };
  }> {
    logger.info(`Setting additional infos for userId: ${userId}, projectId: ${projectId}`, {
      additionalInfos: {
        email: additionalInfos.email,
        teamMembersCount: additionalInfos.teamMembers.length,
        hasImages: !!teamMemberImages && teamMemberImages.length > 0,
      },
    });

    // Upload team member images if provided
    let uploadedImages: { [memberIndex: number]: any } = {};
    if (teamMemberImages && teamMemberImages.length > 0) {
      try {
        uploadedImages = await storageService.uploadTeamMemberImages(
          teamMemberImages,
          userId,
          projectId
        );
        logger.info(`Uploaded ${Object.keys(uploadedImages).length} team member images`);
      } catch (error: any) {
        logger.error(`Error uploading team member images: ${error.message}`, {
          stack: error.stack,
        });
        // Continue without images rather than fail completely
      }
    }

    // Update team members with uploaded image URLs
    const updatedTeamMembers = additionalInfos.teamMembers.map((member, index) => ({
      ...member,
      pictureUrl: uploadedImages[index]?.downloadURL || member.pictureUrl,
    }));

    // Get current project to update with additional infos
    const project = await this.getProject(projectId, userId);
    if (!project) {
      logger.warn(`Project not found: ${projectId} for user: ${userId}`);
      return { project: null };
    }

    // Update project with additional informations only
    const updatedProject = {
      ...project,
      additionalInfos: {
        email: additionalInfos.email,
        phone: additionalInfos.phone || '',
        address: additionalInfos.address || '',
        city: additionalInfos.city || '',
        country: additionalInfos.country || '',
        zipCode: additionalInfos.zipCode || '',
        teamMembers: updatedTeamMembers,
      },
      updatedAt: new Date(), // Update timestamp
    };

    // Save updated project with additional infos
    const savedProject = await this.projectRepository.update(
      projectId,
      updatedProject,
      `users/${userId}/projects`
    );

    if (!savedProject) {
      logger.error(`Failed to update project with additional infos: ${projectId}`);
      return { project: null };
    }

    logger.info(`Additional infos updated successfully for project: ${projectId}`);

    return {
      project: savedProject,
      uploadedImages: Object.keys(uploadedImages).length > 0 ? uploadedImages : undefined,
    };
  }

  /**
   * Retourne la qualité PDF du dernier rendu d'un plan (sections sous-remplies).
   * Lit directement le champ `pdfQuality` persisté sur le plan.
   */
  async getPdfQuality(
    userId: string,
    projectId: string,
    documentId?: string
  ): Promise<BusinessPlanPdfQuality | null> {
    const plan = await deliverableDocumentStore.find(userId, projectId, 'businessPlan', documentId);
    return plan?.pdfQuality ?? null;
  }

  /**
   * Construit le résumé de qualité PDF à partir du rapport de pagination et
   * le persiste sur le projet (champ `businessPlan.pdfQuality`).
   *
   * Le seuil de 0.60 est cohérent avec le warn journalisé par `pdf.service.ts`
   * (f < 0.6). Les sections dont TOUTES les pages sont bien remplies, ou les
   * pages « fixées » (Cover Page), ne sont pas incluses.
   */
  private async persistPdfQuality(
    userId: string,
    projectId: string,
    documentId: string,
    report: import('../pdf/flow-pagination.runtime').FlowPaginationReport | null,
    printed: import('../pdf/pdfQualityGate').PdfQualityGateReport | null = null
  ): Promise<void> {
    if (!report) return;

    const underFilled = report.sections
      // Une section posée tout entière sur la page de la précédente n'a pas de
      // page à elle : il n'y a rien à mesurer.
      .filter((s) => s.fills.length > 0 && isUnderfilledSection(s))
      .map((s) => ({
        sectionName: s.name,
        worstFill: Math.min(...s.fills),
        pages: s.pages,
      }));

    const pdfQuality: BusinessPlanPdfQuality = {
      generatedAt: new Date(),
      underFilledSections: underFilled,
      removedPages: (report.removedPages ?? 0) + (printed?.removedPages.length ?? 0),
      continuedSections: report.sections.filter((s) => s.continued).map((s) => s.name),
      pagesWithHoles: (printed?.holes ?? []).map((hole) => ({
        page: hole.page,
        sectionName: hole.section,
        blank: hole.blank,
      })),
      printCheck: printed?.measured ?? false,
    };

    try {
      // Le rendu n'est pas une modification du contenu : la date du plan reste.
      const saved = await deliverableDocumentStore.update(
        userId,
        projectId,
        'businessPlan',
        documentId,
        (plan) => ({ ...plan, pdfQuality }),
        { touch: false }
      );
      if (!saved) return;

      if (underFilled.length > 0) {
        logger.info(
          `PDF quality persisted for project ${projectId}: ${underFilled.length} under-filled section(s): ` +
            underFilled.map((s) => `${s.sectionName} (${Math.round(s.worstFill * 100)}%)`).join(', ')
        );
      } else {
        logger.info(`PDF quality persisted for project ${projectId}: all pages well-filled.`);
      }
      logger.info(
        `PDF quality for project ${projectId}: ${pdfQuality.removedPages} page(s) retirée(s), ` +
          `${pdfQuality.continuedSections?.length ?? 0} section(s) enchaînée(s), ` +
          `${pdfQuality.pagesWithHoles?.length ?? 0} page(s) avec un blanc ≥ 35 %` +
          (pdfQuality.printCheck ? '' : ' — contrôle du PDF imprimé non effectué')
      );
    } catch (err: any) {
      logger.warn(`Could not persist PDF quality for project ${projectId}: ${err.message}`);
    }
  }

  /**
   * Met à jour la section Financial Plan de CHAQUE business plan du projet qui
   * en porte une, suite à une mise à jour des données financières du projet.
   *
   * Tous les plans, pas seulement le dernier : un dossier bancaire remis avec
   * les chiffres d'avant la mise à jour contredirait le module Finance, et
   * c'est la contradiction qu'un analyste crédit relève en premier.
   */
  async updateFinancialPlanSection(userId: string, projectId: string, requestLanguage?: SupportedLanguage): Promise<void> {
    logger.info(`Updating Financial Plan sections of Business Plans for project ${projectId}`);
    const project = await this.getProject(projectId, userId);
    const plans = listDocuments(project?.analysisResultModel, 'businessPlan').filter((plan) =>
      (plan.sections || []).some((section) => section.name === 'Financial Plan')
    );
    if (!project || plans.length === 0) {
      logger.info(`No business plan with a Financial Plan section to sync for project ${projectId}`);
      return;
    }

    const projectDescription =
      this.extractProjectDescription(project) +
      '\n' +
      'Additional infos: ' +
      JSON.stringify(project.additionalInfos);

    const language = (requestLanguage || getRequestLanguage()) === 'fr' ? 'French' : 'English';

    const financeContext = buildFinanceNarrative(
      project.analysisResultModel?.finance,
      project.additionalInfos?.country
    );

    const promptConfig: PromptConfig = {
      provider: AI_CONFIG.businessPlan.provider,
      modelName: AI_CONFIG.businessPlan.modelName,
    };

    // La direction artistique et le préfixe des rédacteurs : les mêmes pour tous les plans du projet.
    const graphicProject = await withProjectArtDirection(this.promptService, userId, projectId, project);
    const stablePrefix = this.writerPrefix(projectDescription, project, language);

    // Un plan après l'autre : en parallèle, chaque enregistrement du module
    // Finance déclencherait autant d'appels simultanés que de plans.
    for (const plan of plans) {
      // La section est recomposée avec le destinataire du plan : un plan bancaire
      // et un plan d'amorçage ne rouvrent pas la même page financière.
      const { sections: syncSections, audience: syncAudience } = resolveStructure(plan.structure);
      const syncIndex = syncSections.findIndex((section) => section.name === 'Financial Plan');
      const definition = syncIndex === -1 ? undefined : syncSections[syncIndex];
      const brief =
        composeBrief(definition?.key ?? 'financial-plan', {
          audience: syncAudience,
          position: syncIndex === -1 ? 1 : syncIndex + 1,
          total: syncSections.length || 1,
          previous: syncIndex > 0 ? syncSections[syncIndex - 1]?.name : undefined,
          next: syncIndex === -1 ? undefined : syncSections[syncIndex + 1]?.name,
          financeContext,
        }) ?? '';

      // La page est composée DANS le document du plan (même graine, même cran) : elle remplace la
      // précédente sans détonner parmi ses voisines.
      const graphic = await this.openPlanDocument(
        graphicProject,
        syncSections,
        documentDesignKey('businessplan', projectId, plan.id),
        normalizeCreativity(plan.design?.level),
        userId
      );
      const position = { index: syncIndex === -1 ? 1 : syncIndex + 1, total: syncSections.length || 1 };
      const step: IPromptStep = {
        promptConstant: brief,
        stepName: 'Financial Plan',
        hasDependencies: false,
        stablePrefix,
        template: {
          deliverable: 'business-plan',
          sectionId: pageId('Financial Plan'),
          volume: definition?.volume ?? '6 to 8',
          contentBrief: brief,
          prependBlocks: buildFinanceBlocks(project.analysisResultModel?.finance, project.additionalInfos?.country),
          render: (content) => renderGraphicPage(graphic, content, position),
        },
      };

      try {
        const content = await this.runStepAndAppend(step, project, {
          userId,
          promptType: 'Financial Plan Auto-Update',
          promptConfig,
        });

        const updated = await deliverableDocumentStore.update(
          userId,
          projectId,
          'businessPlan',
          plan.id,
          (current) => ({
            ...current,
            sections: (current.sections || []).map((section) =>
              section.name === 'Financial Plan'
                ? {
                    ...section,
                    data: content,
                    summary: `Financial Plan for Project ${project.id} (Updated from Finance module)`,
                    ...(pageComposition(graphic, 'Financial Plan') ? { composition: pageComposition(graphic, 'Financial Plan') } : { composition: undefined }),
                    updatedAt: new Date(),
                  }
                : section
            ),
          })
        );
        if (!updated) continue;

        await cacheService.delete(businessPlanPdfCacheKey(userId, projectId, plan.id), { prefix: 'pdf' });

        logger.info(
          `Successfully auto-updated Financial Plan section of business plan ${plan.id} for project ${projectId}`
        );
      } catch (err: any) {
        logger.error(
          `Failed to auto-update Financial Plan section of business plan ${plan.id}: ${err.message}`,
          { stack: err.stack }
        );
      }
    }
  }
}
