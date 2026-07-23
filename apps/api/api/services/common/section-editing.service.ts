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
import {
  buildSectionEditPrompt,
  EDIT_FORMAT_RULES,
} from './section-edit.prompt';

/**
 * Clé du document dans `analysisResultModel` (business plan, pitch deck, charte).
 */
export type DocumentKey = 'businessPlan' | 'pitchDeck' | 'branding';

/** Clés de cache PDF à invalider après modification, par type de document. */
const PDF_CACHE_KEY: Record<DocumentKey, string> = {
  businessPlan: 'business-plan-pdf',
  pitchDeck: 'pitch-deck-pdf',
  branding: 'branding-pdf',
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

  private async invalidatePdfCache(userId: string, projectId: string, key: DocumentKey): Promise<void> {
    await cacheService.delete(cacheService.generateAIKey(PDF_CACHE_KEY[key], userId, projectId), {
      prefix: 'pdf',
    });
  }

  /** Sauvegarde l'ensemble des sections éditées d'un document. */
  async saveSections(
    userId: string,
    projectId: string,
    key: DocumentKey,
    sections: SectionModel[]
  ): Promise<Record<string, unknown> | null> {
    const project = await this.projectRepository.findById(projectId, this.analysisPath(userId));
    if (!project) {
      logger.warn(`Project ${projectId} not found on saveSections(${key}).`);
      return null;
    }
    const analysis = (project.analysisResultModel ?? {}) as Record<string, any>;
    const existing = (analysis[key] ?? {}) as Record<string, unknown>;
    const cleaned = sections.map((s) => ({
      ...s,
      data: typeof s.data === 'string' ? sanitizeSectionHtml(s.data) : s.data,
    }));
    const updatedBucket = { ...existing, sections: cleaned };

    await this.projectRepository.update(
      projectId,
      { analysisResultModel: { ...analysis, [key]: updatedBucket } },
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
    language?: SupportedLanguage
  ): Promise<{ section: SectionModel; bucket: Record<string, unknown> } | null> {
    const project = await this.projectRepository.findById(projectId, this.analysisPath(userId));
    if (!project) return null;
    const analysis = (project.analysisResultModel ?? {}) as Record<string, any>;
    const bucket = analysis[key] as { sections?: SectionModel[] } | undefined;
    const sections = bucket?.sections ?? [];
    const index = sections.findIndex((s) => s.id === sectionId || s.name === sectionId);
    if (index < 0 || !bucket) {
      logger.warn(`Section "${sectionId}" not found in ${key} for project ${projectId}.`);
      return null;
    }
    const target = sections[index];

    // Contexte projet compact (carte des sections via le Context Engine).
    let projectContext = '';
    try {
      const map = await contextEngineService.getProjectMap(userId, projectId);
      const existing = map.sections
        .filter((s) => s.exists)
        .map((s) => `- ${s.section}: ${s.description}${s.lastChangeSummary ? ` (last change: ${s.lastChangeSummary})` : ''}`)
        .join('\n');
      projectContext = `Project "${map.name}" (type: ${map.type}).\nDescription: ${project.description || 'N/A'}\nAvailable sections:\n${existing}`;
    } catch (err: any) {
      logger.warn(`Context Engine unavailable for aiEditSection(${key}): ${err.message}`);
      projectContext = `Project "${project.name}". Description: ${project.description || 'N/A'}`;
    }

    const branding = analysis.branding as { colors?: unknown; typography?: unknown } | undefined;
    const prompt = buildSectionEditPrompt({
      instruction,
      sectionName: target.name,
      currentHtml: typeof target.data === 'string' ? target.data : JSON.stringify(target.data),
      projectContext,
      brandColorsJson: JSON.stringify(branding?.colors ?? {}),
      typographyJson: JSON.stringify(branding?.typography ?? {}),
      formatRules: EDIT_FORMAT_RULES[key],
    });

    const promptConfig: PromptConfig = {
      provider: AI_CONFIG.default.provider,
      modelName: AI_CONFIG.default.modelName,
      userId,
      promptType: `${key}-section-edit`,
      language,
    };
    const messages: AIChatMessage[] = [{ role: 'user', content: prompt }];

    const response = await promptService.runPrompt(promptConfig, messages);
    const newHtml = sanitizeSectionHtml(promptService.getCleanAIText(response));
    if (!newHtml) {
      logger.warn(`AI edit returned empty HTML for ${key}/${sectionId}.`);
      return null;
    }

    const updatedSection: SectionModel = { ...target, data: newHtml, updatedAt: new Date() };
    const updatedSections = [...sections];
    updatedSections[index] = updatedSection;
    const updatedBucket = { ...bucket, sections: updatedSections };

    markRevisionAsAI(`Édition IA – ${target.name}: ${instruction}`.slice(0, 280));
    await this.projectRepository.update(
      projectId,
      { analysisResultModel: { ...analysis, [key]: updatedBucket } },
      this.analysisPath(userId)
    );
    await this.invalidatePdfCache(userId, projectId, key);

    logger.info(`AI-edited ${key} section "${target.name}" for project ${projectId}.`);
    return { section: updatedSection, bucket: updatedBucket };
  }
}

export const sectionEditingService = new SectionEditingService();
