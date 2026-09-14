import { LLMProvider, PromptConfig, PromptService, AIChatMessage } from '../prompt.service';
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
import { AGENT_COVER_PROMPT } from './prompts/agent-cover.prompt';
import { AGENT_COMPANY_SUMMARY_PROMPT } from './prompts/agent-company-summary.prompt';
import { AGENT_OPPORTUNITY_PROMPT } from './prompts/agent-opportunity.prompt';
import { AGENT_TARGET_AUDIENCE_PROMPT } from './prompts/agent-target-audience.prompt';
import { AGENT_PRODUCTS_SERVICES_PROMPT } from './prompts/agent-products-services.prompt';
import { AGENT_MARKETING_SALES_PROMPT } from './prompts/agent-marketing-sales.prompt';
import { AGENT_FINANCIAL_PLAN_PROMPT } from './prompts/agent-financial-plan.prompt';
import { buildFinanceBlocks, buildFinanceNarrative } from '../Finance/finance-blocks';
import { Block } from '../design/sectionContent';
import { AGENT_GOAL_PLANNING_PROMPT } from './prompts/agent-goal-planning.prompt';
import { AGENT_APPENDIX_PROMPT } from './prompts/agent-appendix.prompt';
import { BP_SECTION_EXAMPLE } from './prompts/section-example.prompt';
import {
  composeBrief,
  composeHtmlPrompt,
  readerBlock,
} from './prompts/section-prompt.registry';
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
import { ensureProjectArtDirection } from '../design/artDirection.provider';
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

/**
 * Prompts de composition d'ORIGINE, par section.
 *
 * Ils ne servent plus qu'au repli : quand `IDEM_SECTION_TEMPLATE=off`, la
 * section doit de nouveau produire sa page en HTML, et c'est ce prompt-là qui
 * sait le faire. Les sections apportées par les structures (banque,
 * investisseur, subvention) n'en ont pas — elles retombent sur leur brief de
 * contenu, ce qui est le comportement voulu : mieux vaut une page composée par
 * le gabarit qu'une page composée d'après un prompt écrit pour une autre.
 */
/** Rang d'une section dans un ordre donné ; les inconnues vont en fin. */
const orderIndexIn = (order: readonly string[], name: string): number => {
  const i = order.indexOf(name);
  return i === -1 ? order.length : i;
};

/** PDF d'UN plan : un projet en garde plusieurs, chacun avec son rendu. */
const businessPlanPdfCacheKey = (userId: string, projectId: string, documentId: string): string =>
  cacheService.generateAIKey('business-plan-pdf', userId, projectId, documentId);

const LEGACY_SECTION_PROMPTS: Record<string, string> = {
  'Cover Page': AGENT_COVER_PROMPT,
  'Company Summary': AGENT_COMPANY_SUMMARY_PROMPT,
  Opportunity: AGENT_OPPORTUNITY_PROMPT,
  'Target Audience': AGENT_TARGET_AUDIENCE_PROMPT,
  'Products & Services': AGENT_PRODUCTS_SERVICES_PROMPT,
  'Marketing & Sales': AGENT_MARKETING_SALES_PROMPT,
  'Financial Plan': AGENT_FINANCIAL_PLAN_PROMPT,
  'Goal Planning': AGENT_GOAL_PLANNING_PROMPT,
  Appendix: AGENT_APPENDIX_PROMPT,
};

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
    documentId?: string
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

    // Extract branding information
    // Use the user's request language instead of a hard-coded 'fr' so the plan is
    // generated in the language selected in the UI (falls back to 'en').
    const language = getRequestLanguage() === 'fr' ? 'French' : 'English';

    // Create brand context for all agents
    const brandContext = await this.buildBrandContext(userId, projectId, project, language, designKey);
    const lintContext = this.buildLintContext(project);

    // Le contexte financier vient d'un point unique : ce texte servait, dans
    // trois copies légèrement divergentes, à faire recopier des chiffres au
    // modèle. Les tableaux sont maintenant POSÉS par le service ; ce résumé ne
    // sert plus qu'à ce que les autres sections ne contredisent pas le module.
    const financeContext = buildFinanceNarrative(
      project.analysisResultModel?.finance,
      project.additionalInfos?.country
    );

    try {
      // Les dépendances entre sections ne sont PLUS déclarées ici : elles vivent
      // dans le catalogue (`requires`) et sont assemblées par
      // `buildBusinessPlanGraph` (services/agents/deliverable-graph.ts), filtrées
      // sur les sections réellement retenues, validées (cycles, noms inconnus) et
      // documentées avec leur coût en latence.
      // PRÉFIXE STABLE — identique aux neuf sections, émis UNE fois en tête de
      // chaque appel. Il portait auparavant la FIN de chaque `promptConstant`,
      // derrière la partie variable : ~3 400 tokens repayés neuf fois, et aucun
      // début de prompt jamais répété — donc aucun cache de préfixe possible.
      const stablePrefix = [
        projectDescription,
        `BRAND CONTEXT:\n${brandContext}`,
        BP_SECTION_EXAMPLE,
      ].join('\n\n');

      // PRÉFIXE DU MODE GABARIT — plus court, et c'est le point.
      //
      // Le préfixe complet porte ~3 000 tokens de règles de COMPOSITION (fiche
      // de style, invariants de mise en page, anti-générique, retenue
      // éditoriale). Pour une section rendue par gabarit, elles sont inertes :
      // le code compose. Les laisser coûterait des tokens, mais surtout de
      // l'attention — un petit modèle honore une dizaine de contraintes, et
      // celles qui comptent ici sont celles qui portent sur le TEXTE.
      //
      // Les deux préfixes restent stables chacun de leur côté : le cache de
      // préfixe s'accroche donc aux deux familles, et la plus grosse (8
      // sections) est désormais la plus courte.
      const templatedPrefix = [
        projectDescription,
        `BRAND FACTS:\nBrand: ${project.name ?? ''}\nLanguage: ${language}`,
        CONTENT_RULES_BLOCK,
        BP_SECTION_EXAMPLE,
      ].join('\n\n');

      // Chaque section reçoit sa PROPRE graine de composition, tirée sans
      // répétition dans l'espace autorisé par le style. C'est ce qui empêche
      // neuf pages de partager le même archétype sans pour autant les rendre
      // étrangères les unes aux autres : les invariants (couleur, typographie,
      // rythme) restent dans le préfixe stable ci-dessus.
      const artDirection = project.analysisResultModel?.branding?.artDirection;
      const documentSeed = buildDocumentSeed(artDirection?.styleId, designKey);

      // DESIGN SYSTEM CALCULÉ pour ce document : rampes, encres contrastées,
      // échelle typographique, rayon, rythme. Une fois par livrable — les neuf
      // pages le partagent, ce qui est très exactement ce qui en fait un
      // document.
      const designSystem = buildDocumentDesignSystem(
        project.analysisResultModel?.branding,
        artDirection,
        documentSeed
      );
      logger.info(`[BP] Design system: ${describeDesignSystem(designSystem)}`);

      const logoUrls = collectLogoUrls(project.analysisResultModel?.branding?.logo);
      const renderOptions = { logoUrl: logoUrls[0], brandName: project.name };

      const usedArchetypes = new Set<string>();
      let sectionIndex = 0;

      /**
       * Une section RENDUE PAR GABARIT : le modèle produit du contenu, le code
       * produit la page. Sa graine lui donne son archétype de mise en page,
       * distinct de celui de ses voisines.
       *
       * @param contentBrief Consigne de CONTENU composée pour ce document
       *   (destinataire, rang, voisines). C'est elle qui part sous gabarit.
       * @param htmlPrompt Prompt COMPLET, avec les règles de composition. Il
       *   n'est utilisé qu'en repli `IDEM_SECTION_TEMPLATE=off`, quand la
       *   section doit de nouveau produire sa page en HTML.
       */
      const templated = (
        contentBrief: string,
        htmlPrompt: string,
        stepName: string,
        volume: string,
        prependBlocks?: Block[]
      ): IPromptStep => {
        sectionIndex += 1;
        return {
          promptConstant: htmlPrompt,
          stepName,
          stablePrefix: templatedPrefix,
          template: {
            // Sous gabarit, seule la consigne de CONTENU part. Le prompt HTML
            // consacre les trois quarts de son volume à une composition que le
            // rendu produit désormais : une consigne inerte n'est pas neutre,
            // elle prend la place de celles qui comptent.
            contentBrief,
            designSystem,
            seed: buildSectionSeed(
              artDirection?.styleId,
              designKey,
              stepName,
              usedArchetypes
            ),
            volume,
            render: { ...renderOptions, index: sectionIndex },
            // Les tableaux financiers viennent du module Finance, pas du
            // modèle : un chiffre recopié dans un contexte de plusieurs
            // milliers de mots est un chiffre altéré, et c'est le défaut qu'un
            // lecteur de plan repère en premier.
            prependBlocks,
          },
        };
      };

      /**
       * Une section en génération LIBRE : le modèle compose lui-même.
       *
       * Réservée aux pages dont la composition EST le livrable. La couverture
       * est la première page qu'un investisseur ouvre : c'est le seul endroit du
       * plan où l'on préfère le plafond de qualité au plancher.
       */
      const freeform = (prompt: string, stepName: string): IPromptStep => {
        sectionIndex += 1;
        const seed = buildSectionSeed(
          artDirection?.styleId,
          designKey,
          stepName,
          usedArchetypes
        );
        return {
          promptConstant: `${prompt}\n\n<composition_for_this_page>\n${describeSectionSeed(seed)}\n</composition_for_this_page>`,
          stepName,
        };
      };

      // Les étapes viennent de la STRUCTURE, pas d'une liste écrite ici : le
      // plan peut porter neuf sections ou dix-sept, dans l'ordre qu'une banque
      // impose. Le prompt d'origine (`agent-*`) sert de repli quand le gabarit
      // est coupé ; les sections introduites avec les structures n'en ont pas,
      // et retombent alors sur leur brief de contenu — ce qui est exactement ce
      // que le repli doit faire.
      const steps: IPromptStep[] = planSections.map((section, index) => {
        // Contexte de composition de CETTE section dans CE document : son
        // destinataire, son rang, ses voisines. Sans lui, chaque section
        // recommence par présenter l'entreprise et le plan se répète.
        const promptCtx = {
          audience: planAudience,
          position: index + 1,
          total: planSections.length,
          previous: planSections[index - 1]?.name,
          next: planSections[index + 1]?.name,
          financeContext: section.financeContext ? financeContext : undefined,
        };

        if (section.freeform) {
          const cover = LEGACY_SECTION_PROMPTS[section.name] ?? '';
          return freeform(`${readerBlock(planAudience)}\n\n${cover}`, section.name);
        }

        // Le prompt HTML de repli : celui écrit à la main quand la section en a
        // un (les neuf historiques, éprouvés page par page), sinon celui
        // composé — qui porte les mêmes règles de page et de marque.
        const htmlPrompt =
          LEGACY_SECTION_PROMPTS[section.name] ??
          composeHtmlPrompt(section.key, promptCtx) ??
          '';

        return templated(
          composeBrief(section.key, promptCtx) ?? '',
          section.financeContext ? `${htmlPrompt}${financeContext}` : htmlPrompt,
          section.name,
          section.volume,
          section.financeBlocks
            ? buildFinanceBlocks(
                project.analysisResultModel?.finance,
                project.additionalInfos?.country
              )
            : undefined
        );
      });

      // Chaque section produit une page HTML : la grille déterministe attrape
      // troncatures, balises déséquilibrées et gabarits non remplis avant que la
      // section n'atteigne le PDF. La devise vient du module Finance quand il
      // existe — c'est la dérive la plus fréquente sur un projet en XAF.
      const sectionQuality = {
        format: 'html' as const,
        minChars: 400,
        currency: project.analysisResultModel?.finance?.meta?.currency,
      };

      // Le graphe pose les dépendances, `withGraph` y ajoute les réglages IA de
      // chaque section (budget de tokens, température, étage de modèle).
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

            // Passe déterministe anti-générique : couleurs hors charte, polices
            // écrites en dur, titres en dégradé et images sans alt sont corrigés
            // sans appel au modèle. Le reste est journalisé — sur neuf sections,
            // il en reste toujours une qui déroge à la consigne du prompt.
            let sectionHtml = result.data;
            if (typeof sectionHtml === 'string' && sectionHtml) {
              const options = {
                palette: lintContext.palette,
                // Les teintes des rampes DÉRIVENT de la charte : sans cette
                // déclaration, le linter prendrait le design system calculé pour
                // une palette inventée et « corrigerait » ses propres nuances.
                extraAllowedColors: derivedPalette(designSystem),
                fonts: lintContext.fonts,
                expectedLogoUrls: result.name === 'Cover Page' ? lintContext.logoUrls : [],
                styleId: lintContext.styleId,
                label: `business-plan/${result.name}`,
              };
              // Réparation déterministe PUIS constat de ce qui résiste. Le verdict
              // du linter était auparavant calculé puis jeté : les 20 règles de
              // charte étaient détectées, journalisées, et jamais appliquées.
              sectionHtml = enforceDesignRules(sectionHtml, options).html;
            }

            // Convert result to section model
            const section: SectionModel = {
              name: result.name,
              type: result.type,
              data: sectionHtml,
              summary: result.summary,
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

        // The stored PDF no longer matches the regenerated sections
        await cacheService.delete(businessPlanPdfCacheKey(userId, projectId, plan.id), { prefix: 'pdf' });

        return deliverableDocumentStore.find(userId, projectId, 'businessPlan', plan.id);
      } else {
        // Fallback to non-streaming processing
        const stepResults = await this.processSteps(configuredSteps, project, promptConfig);
        sectionResults = stepResults.map((result) => ({
          name: result.name,
          type: result.type,
          data: result.data,
          summary: result.summary,
        }));

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
    documentId?: string
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
    const brandContext = await this.buildBrandContext(userId, projectId, project, language, designKey);

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

    // Le moteur de recherche reçoit la CHARTE du projet : ses sections sont des
    // sections du document, pas des pages à part. Sans ces champs elles
    // retomberaient sur un design system par défaut et le plan aurait deux
    // identités visuelles — ce qu'il avait.
    const researchArtDirection = project.analysisResultModel?.branding?.artDirection;
    await researchTeamService.runResearchTeam(
      sectionsToGenerate,
      {
        projectContext: projectDescription,
        // Identité stable pour le cache des recherches : une régénération du
        // même projet doit RÉUTILISER les faits déjà collectés.
        projectId,
        // Bibliographie rassemblée en fin de document plutôt qu'en pied de
        // chaque section — construite par le code, sans appel de modèle.
        resourcesSectionName: BP_RESOURCES_SECTION_NAME,
        brandContext,
        language,
        userId,
        currency,
        charter: project.analysisResultModel?.branding,
        artDirection: researchArtDirection,
        // Propre au plan : deux plans du projet ne tirent pas les mêmes
        // archétypes page pour page.
        documentKey: designKey,
        // Partagé par tout le run : deux sections voisines ne peuvent pas tirer
        // le même archétype.
        usedArchetypes: new Set<string>(),
        logoUrl: collectLogoUrls(project.analysisResultModel?.branding?.logo)[0],
        brandName: project.name,
      },
      emit,
      persistSection
    );

    // Le PDF stocké ne correspond plus aux sections régénérées.
    await cacheService.delete(businessPlanPdfCacheKey(userId, projectId, plan.id), { prefix: 'pdf' });

    return deliverableDocumentStore.find(userId, projectId, 'businessPlan', plan.id);
  }


  /**
   * Contexte de marque transmis à CHAQUE agent du plan.
   *
   * Il portait auparavant une ligne « Logo URL: … » et rien d'autre : la donnée
   * était là, la CONSIGNE de l'afficher manquait, et aucun agent ne posait le
   * logo. Il porte désormais les déclinaisons prêtes à l'emploi, l'obligation de
   * les utiliser, et la direction artistique de la marque — sans quoi chaque
   * section réinventait sa propre mise en page.
   */
  private async buildBrandContext(
    userId: string,
    projectId: string,
    project: ProjectModel,
    language: string,
    /** Clé de graine du document (`documentDesignKey`). */
    designKey: string
  ): Promise<string> {
    const branding = project.analysisResultModel?.branding;
    const brandName = project.name || 'Startup';
    const brandColors = branding?.colors || { primary: '#007bff', secondary: '#6c757d' };
    const typography = branding?.typography || { primary: 'Arial, sans-serif' };

    // Provisionnée si la charte n'a pas encore été générée : le business plan
    // peut être le premier livrable produit, et il doit alors faire naître le
    // parti pris visuel plutôt que de s'en passer.
    const artDirection = await ensureProjectArtDirection(
      this.promptService,
      userId,
      projectId,
      project
    );
    // INVARIANTS du document seulement : stratégie de couleur, humeur
    // typographique, rythme spatial, accent graphique. L'archétype de mise en
    // page, la tension et la densité sont tirés PAR SECTION (cf.
    // `buildSectionSeed`) — une graine unique pour neuf pages ne laissait que
    // deux issues : neuf pages identiques, ou un document incohérent.
    const documentSeed = buildDocumentSeed(artDirection?.styleId, designKey);

    return [
      `Brand: ${brandName}`,
      `Brand Colors: ${JSON.stringify(brandColors)}`,
      `Typography: ${JSON.stringify(typography)}`,
      `Language: ${language}`,
      buildLogoBlock(branding?.logo, {
        placement:
          'on the cover page (large, as the signature) and in the header or footer of every section page (small, discreet, always in the same place)',
        size: 'cover: 40 to 70mm wide; running pages: 12 to 18mm tall',
      }),
      buildArtDirectionBlock(artDirection, { medium: 'document' }),
      artDirection
        ? `<composition_invariants>\n${describeDocumentSeed(documentSeed)}\n</composition_invariants>`
        : '',
      ANTI_SLOP_BLOCK,
      EDITORIAL_RESTRAINT_BLOCK,
      RESTRAINT_SELF_REVIEW_BLOCK,
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  /**
   * Réglages du contrôle anti-générique pour ce projet.
   *
   * Le logo n'est attendu que sur la couverture : l'exiger sur les neuf
   * sections produirait une alerte à chaque page, et un linter qui crie tout le
   * temps est un linter qu'on n'écoute plus.
   */
  private buildLintContext(project: ProjectModel): {
    palette: any;
    fonts: string[];
    logoUrls: string[];
    styleId?: string;
  } {
    const branding = project.analysisResultModel?.branding;
    return {
      palette: branding?.colors?.colors,
      fonts: [branding?.typography?.primaryFont, branding?.typography?.secondaryFont].filter(
        (f): f is string => !!f
      ),
      logoUrls: collectLogoUrls(branding?.logo),
      styleId: branding?.artDirection?.styleId,
    };
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
      skipQuotaCheck: true,
    };

    // Un plan après l'autre : en parallèle, chaque enregistrement du module
    // Finance déclencherait autant d'appels simultanés que de plans.
    for (const plan of plans) {
      const brandContext = await this.buildBrandContext(
        userId,
        projectId,
        project,
        language,
        documentDesignKey('businessplan', projectId, plan.id)
      );

      // La section est recomposée avec le destinataire du plan : un plan bancaire
      // et un plan d'amorçage ne rouvrent pas la même page financière.
      const { sections: syncSections, audience: syncAudience } = resolveStructure(plan.structure);
      const syncIndex = syncSections.findIndex((section) => section.name === 'Financial Plan');
      const syncPrompt =
        composeHtmlPrompt('financial-plan', {
          audience: syncAudience,
          position: syncIndex === -1 ? 1 : syncIndex + 1,
          total: syncSections.length || 1,
          previous: syncIndex > 0 ? syncSections[syncIndex - 1]?.name : undefined,
          next: syncIndex === -1 ? undefined : syncSections[syncIndex + 1]?.name,
        }) ?? AGENT_FINANCIAL_PLAN_PROMPT;

      const step: IPromptStep = {
        promptConstant: `${projectDescription}\n${syncPrompt}\n\nBRAND CONTEXT:\n${brandContext}${financeContext}`,
        stepName: 'Financial Plan',
        hasDependencies: false,
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
