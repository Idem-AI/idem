import logger from '../../config/logger';
import { RepositoryFactory } from '../../repository/RepositoryFactory';
import { IRepository } from '../../repository/IRepository';
import { ProjectModel } from '../../models/project.model';
import { SectionModel } from '../../models/section.model';
import { cacheService } from '../cache.service';
import { contextEngineService } from '../context-engine/context-engine.service';
import { markRevisionAsAI } from '../../utils/revision-context.util';
import { promptService, PromptConfig, AIChatMessage } from '../prompt.service';
import { AI_CONFIG } from '../../config/ai.config';
import { SupportedLanguage } from '../../utils/request-language';
import { sanitizeSectionHtml } from '../../utils/sanitize-section-html';
import { withAiUsage } from '../../utils/ai-usage-context.util';
import {
  buildSectionEditPrompt,
  EDIT_FORMAT_RULES,
} from './section-edit.prompt';
import { findDocument, isDeliverableKind, withDocument } from './deliverable-documents';

/**
 * Clé du document dans `analysisResultModel` (business plan, pitch deck, charte).
 */
export type DocumentKey = 'businessPlan' | 'pitchDeck' | 'branding' | 'businessCard';

/** Règles de format disponibles pour une réécriture IA (documents + documents juridiques). */
export type EditFormatKey = keyof typeof EDIT_FORMAT_RULES;

/** Clés de cache PDF à invalider après modification, par type de document. */
const PDF_CACHE_KEY: Record<DocumentKey, string> = {
  businessPlan: 'business-plan-pdf',
  pitchDeck: 'pitch-deck-pdf',
  branding: 'branding-pdf',
  // Les cartes de visite sont rendues à la demande (pas de PDF pré-calculé) ;
  // la clé existe pour garder la table exhaustive.
  businessCard: 'business-card-pdf',
};

/**
 * Service RÉUTILISABLE d'édition de sections, partagé par les 3 documents. Il
 * factorise :
 *  - la sauvegarde des sections éditées (WYSIWYG) en préservant les champs
 *    frères du document (ex: branding.colors/typography/logo) ;
 *  - l'édition IA d'une section avec injection du contexte projet (Context
 *    Engine), traçabilité `ai` (Chronicle) et invalidation du cache PDF.
 *
 * Chaque contenu HTML est assaini (préfixes markdown, fences, bloc Sources).
 */
export class SectionEditingService {
  private readonly projectRepository: IRepository<ProjectModel> =
    RepositoryFactory.getRepository<ProjectModel>();

  private analysisPath(userId: string): string {
    return `users/${userId}/projects`;
  }

  /**
   * Oublie le PDF du document. Business plans et pitch decks ont un PDF PAR
   * document : leur clé porte l'identifiant du document.
   */
  private async invalidatePdfCache(
    userId: string,
    projectId: string,
    key: DocumentKey,
    documentId?: string
  ): Promise<void> {
    await cacheService.delete(
      cacheService.generateAIKey(PDF_CACHE_KEY[key], userId, projectId, documentId),
      { prefix: 'pdf' }
    );
  }

  /**
   * Sauvegarde l'ensemble des sections éditées d'un document. Pour un business
   * plan ou un pitch deck, `documentId` désigne le document (le principal sans lui).
   */
  async saveSections(
    userId: string,
    projectId: string,
    key: DocumentKey,
    sections: SectionModel[],
    documentId?: string
  ): Promise<Record<string, unknown> | null> {
    const project = await this.projectRepository.findById(projectId, this.analysisPath(userId));
    if (!project) {
      logger.warn(`Project ${projectId} not found on saveSections(${key}).`);
      return null;
    }
    const analysis = (project.analysisResultModel ?? {}) as Record<string, any>;
    const cleaned = sections.map((s) => ({
      ...s,
      data: typeof s.data === 'string' ? sanitizeSectionHtml(s.data) : s.data,
    }));

    if (isDeliverableKind(key)) {
      const document = findDocument(analysis, key, documentId);
      if (!document) {
        logger.warn(`No ${key} document ${documentId ?? '(primary)'} in project ${projectId} on saveSections.`);
        return null;
      }
      const updatedDocument = { ...document, sections: cleaned, updatedAt: new Date() };
      await this.projectRepository.update(
        projectId,
        { analysisResultModel: withDocument(analysis, key, updatedDocument) } as Partial<ProjectModel>,
        this.analysisPath(userId)
      );
      await this.invalidatePdfCache(userId, projectId, key, document.id);
      logger.info(
        `Saved ${cleaned.length} edited ${key} sections for project ${projectId} (document ${document.id}).`
      );
      return updatedDocument as unknown as Record<string, unknown>;
    }

    const existing = (analysis[key] ?? {}) as Record<string, unknown>;
    const updatedBucket = { ...existing, sections: cleaned };

    await this.projectRepository.update(
      projectId,
      { analysisResultModel: { ...analysis, [key]: updatedBucket } } as Partial<ProjectModel>,
      this.analysisPath(userId)
    );
    await this.invalidatePdfCache(userId, projectId, key);
    logger.info(`Saved ${cleaned.length} edited ${key} sections for project ${projectId}.`);
    return updatedBucket;
  }

  /** Édition IA d'une section : renvoie la section modifiée + le document à jour. */
  async aiEditSection(
    userId: string,
    projectId: string,
    key: DocumentKey,
    sectionId: string,
    instruction: string,
    language?: SupportedLanguage,
    documentId?: string
  ): Promise<{ section: SectionModel; bucket: Record<string, unknown> } | null> {
    const project = await this.projectRepository.findById(projectId, this.analysisPath(userId));
    if (!project) return null;
    const analysis = (project.analysisResultModel ?? {}) as Record<string, any>;
    // Business plan et pitch deck : le document désigné parmi ceux du projet.
    const deliverable = isDeliverableKind(key) ? findDocument(analysis, key, documentId) : null;
    const bucket = (isDeliverableKind(key) ? deliverable : analysis[key]) as
      | { sections?: SectionModel[] }
      | null
      | undefined;
    const sections = bucket?.sections ?? [];
    const index = sections.findIndex((s) => s.id === sectionId || s.name === sectionId);
    if (index < 0 || !bucket) {
      logger.warn(`Section "${sectionId}" not found in ${key} for project ${projectId}.`);
      return null;
    }
    const target = sections[index];

    const newHtml = await this.rewriteHtml({
      userId,
      project,
      projectId,
      formatKey: key,
      element: sectionId,
      sectionName: target.name,
      currentHtml: typeof target.data === 'string' ? target.data : JSON.stringify(target.data),
      instruction,
      language,
    });
    if (!newHtml) return null;

    const updatedSection: SectionModel = { ...target, data: newHtml, updatedAt: new Date() };
    const updatedSections = [...sections];
    updatedSections[index] = updatedSection;

    if (isDeliverableKind(key) && deliverable) {
      const updatedDocument = { ...deliverable, sections: updatedSections, updatedAt: new Date() };
      await this.projectRepository.update(
        projectId,
        { analysisResultModel: withDocument(analysis, key, updatedDocument) } as Partial<ProjectModel>,
        this.analysisPath(userId)
      );
      await this.invalidatePdfCache(userId, projectId, key, deliverable.id);
      logger.info(`AI-edited ${key} section "${target.name}" for project ${projectId} (document ${deliverable.id}).`);
      return { section: updatedSection, bucket: updatedDocument as unknown as Record<string, unknown> };
    }

    const updatedBucket = { ...bucket, sections: updatedSections };
    await this.projectRepository.update(
      projectId,
      { analysisResultModel: { ...analysis, [key]: updatedBucket } } as Partial<ProjectModel>,
      this.analysisPath(userId)
    );
    await this.invalidatePdfCache(userId, projectId, key);

    logger.info(`AI-edited ${key} section "${target.name}" for project ${projectId}.`);
    return { section: updatedSection, bucket: updatedBucket };
  }

  /**
   * Réécrit un HTML de document selon une consigne, par l'IA : contexte projet
   * (Context Engine), charte, règles de format du document, coût imputé à
   * l'élément, traçabilité `ai`. Ne persiste rien : l'appelant enregistre.
   * Renvoie `null` si l'IA ne rend rien d'exploitable.
   */
  async rewriteHtml(input: {
    userId: string;
    project: ProjectModel;
    projectId: string;
    formatKey: EditFormatKey;
    /** Élément retouché, pour l'imputation du coût (id de section ou de document) */
    element: string;
    sectionName: string;
    currentHtml: string;
    instruction: string;
    language?: SupportedLanguage;
  }): Promise<string | null> {
    const { userId, project, projectId, formatKey, element, sectionName, currentHtml, instruction, language } =
      input;
    const analysis = (project.analysisResultModel ?? {}) as Record<string, any>;

    // Contexte projet compact (carte des sections via le Context Engine).
    let projectContext = '';
    try {
      const map = await contextEngineService.getProjectMap(userId, projectId);
      const existing = map.sections
        .filter((s) => s.exists)
        .map((s) => `- ${s.section}: ${s.description}${s.lastChangeSummary ? ` (last change: ${s.lastChangeSummary})` : ''}`)
        .join('\n');
      projectContext = `Project "${map.name}" (type: ${map.type}).\nDescription: ${project.longDescription || project.description || 'N/A'}\nAvailable sections:\n${existing}`;
    } catch (err: any) {
      logger.warn(`Context Engine unavailable for rewriteHtml(${formatKey}): ${err.message}`);
      projectContext = `Project "${project.name}". Description: ${project.longDescription || project.description || 'N/A'}`;
    }

    const branding = analysis.branding as { colors?: unknown; typography?: unknown } | undefined;
    const prompt = buildSectionEditPrompt({
      instruction,
      sectionName,
      currentHtml,
      projectContext,
      brandColorsJson: JSON.stringify(branding?.colors ?? {}),
      typographyJson: JSON.stringify(branding?.typography ?? {}),
      formatRules: EDIT_FORMAT_RULES[formatKey],
    });

    const promptConfig: PromptConfig = {
      provider: AI_CONFIG.default.provider,
      modelName: AI_CONFIG.default.modelName,
      userId,
      promptType: `${formatKey}-section-edit`,
      language,
    };
    const messages: AIChatMessage[] = [{ role: 'user', content: prompt }];

    // `formatKey` est le document (branding, businessPlan…) et `element` la
    // partie réellement retouchée : le coût d'une édition IA est ainsi imputé
    // à l'élément précis, et non au projet en bloc.
    const response = await withAiUsage(
      { userId, projectId, feature: formatKey, element, operation: 'edit' },
      () => promptService.runPrompt(promptConfig, messages)
    );
    const newHtml = sanitizeSectionHtml(promptService.getCleanAIText(response));
    if (!newHtml) {
      logger.warn(`AI edit returned empty HTML for ${formatKey}/${element}.`);
      return null;
    }
    markRevisionAsAI(`Édition IA – ${sectionName}: ${instruction}`.slice(0, 280));
    return newHtml;
  }
}

export const sectionEditingService = new SectionEditingService();
