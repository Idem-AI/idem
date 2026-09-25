import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../config/logger';
import {
  LegalDocsContext,
  LegalDocsModel,
  LegalDocumentModel,
  LegalDocumentType,
  LegalFormCode,
  LegalRecommendations,
} from '../../models/legalDocs.model';
import { ProjectModel } from '../../models/project.model';
import { SectionModel } from '../../models/section.model';
import { cacheService } from '../cache.service';
import { GenericService, IPromptStep, ISectionResult } from '../common/generic.service';
import { PAGE_FORMATS, PdfService } from '../pdf.service';
import { LLMProvider, PromptConfig, PromptService } from '../prompt.service';
import { AI_CONFIG } from '../../config/ai.config';

import { LEGAL_DOCS_CATALOG, getCatalogEntry, isStatutesType, legacyStatutesForm } from './catalog';
import { LEGAL_FORMS, getLegalForm, normalizeLegalForm } from './legalForms';
import { getLegalDocPrompt } from './prompts';
import { buildRecommendations, prefillContext, recommendLegalForm } from './recommendation';

export interface LegalDocsGenerationRequest {
  types: LegalDocumentType[];
  context?: LegalDocsContext;
  replaceExisting?: boolean;
}

export class LegalDocsService extends GenericService {
  private pdfService: PdfService;

  constructor(promptService: PromptService) {
    super(promptService);
    this.pdfService = new PdfService();
    logger.info('LegalDocsService initialized.');
  }

  getCatalog() {
    return LEGAL_DOCS_CATALOG;
  }

  getLegalForms() {
    return LEGAL_FORMS;
  }

  /**
   * Forme juridique et documents recommandés pour le projet, avec le contexte
   * pré-rempli depuis ses informations.
   */
  async getRecommendations(userId: string, projectId: string): Promise<LegalRecommendations | null> {
    const project = await this.projectRepository.findById(projectId, `users/${userId}/projects`);
    if (!project) {
      logger.warn(`LegalDocsService.getRecommendations: project not found ${projectId}`);
      return null;
    }
    const recommendations = buildRecommendations(project, project.analysisResultModel?.legalDocs?.context);
    logger.info(
      `LegalDocsService.getRecommendations projectId=${projectId} jurisdiction=${recommendations.jurisdiction} form=${recommendations.form.code} chosen=${recommendations.prefill.legalForm || '-'}`
    );
    return recommendations;
  }

  /**
   * Enregistre le contexte (dont la forme juridique retenue) sans rien générer,
   * et renvoie les recommandations recalculées pour cette forme.
   */
  async saveContext(
    userId: string,
    projectId: string,
    context: LegalDocsContext
  ): Promise<LegalRecommendations | null> {
    const project = await this.projectRepository.findById(projectId, `users/${userId}/projects`);
    if (!project) {
      logger.warn(`LegalDocsService.saveContext: project not found ${projectId}`);
      return null;
    }
    const current = project.analysisResultModel?.legalDocs;
    const merged: LegalDocsContext = {
      ...(current?.context || {}),
      ...context,
      legalForm: normalizeLegalForm(context.legalForm) || '',
    };
    await this.projectRepository.update(
      projectId,
      {
        ...project,
        analysisResultModel: {
          ...project.analysisResultModel,
          legalDocs: {
            documents: current?.documents || [],
            context: merged,
            updatedAt: new Date(),
          },
        },
      },
      `users/${userId}/projects`
    );
    logger.info(`LegalDocsService.saveContext projectId=${projectId} legalForm=${merged.legalForm || '-'}`);
    return buildRecommendations(project, merged);
  }

  /**
   * Rend une demande de génération cohérente, d'où qu'elle vienne (page, chat) :
   * - les anciens types `statuts_sarl` / `statuts_sas` deviennent `statuts` ;
   * - la forme juridique vient de la demande, sinon du contexte enregistré,
   *   sinon de la recommandation ;
   * - le contexte manquant est complété depuis le projet.
   */
  private normalizeRequest(
    project: ProjectModel,
    request: LegalDocsGenerationRequest
  ): { types: LegalDocumentType[]; context: LegalDocsContext; legalForm: LegalFormCode } {
    const saved = project.analysisResultModel?.legalDocs?.context;
    const legacyForm = request.types.map(legacyStatutesForm).find(Boolean);
    const provided = request.context || {};
    const prefill = prefillContext(project, saved);
    const context: LegalDocsContext = { ...prefill };
    for (const [key, value] of Object.entries(provided)) {
      const empty = value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
      if (!empty) (context as Record<string, unknown>)[key] = value;
    }
    const legalForm =
      normalizeLegalForm(provided.legalForm) ||
      legacyForm ||
      normalizeLegalForm(saved?.legalForm) ||
      recommendLegalForm(project, context.country).code;
    context.legalForm = legalForm;

    const types = Array.from(
      new Set(request.types.map((t) => (isStatutesType(t) ? 'statuts' : t)))
    ) as LegalDocumentType[];
    // Une entreprise individuelle n'a pas de statuts : on ne les rédige pas.
    const withoutStatutes = getLegalForm(legalForm)?.hasStatutes === false;
    return {
      types: withoutStatutes ? types.filter((t) => t !== 'statuts') : types,
      context,
      legalForm,
    };
  }

  /** Nom affiché d'un document ; les statuts portent leur forme (« Statuts SAS »). */
  private documentName(type: LegalDocumentType, legalForm: LegalFormCode): string {
    const entry = getCatalogEntry(type);
    if (type === 'statuts') {
      const form = getLegalForm(legalForm);
      return form ? `Statuts ${form.acronym}` : entry?.nameFr || type;
    }
    return entry?.nameFr || type;
  }

  /**
   * Fusionne un document dans la liste : il remplace celui de même type, et de
   * nouveaux statuts remplacent aussi les anciens (`statuts_sarl`, `statuts_sas`)
   * — une société n'a qu'un jeu de statuts.
   */
  private mergeDocument(existing: LegalDocumentModel[], doc: LegalDocumentModel): LegalDocumentModel[] {
    const sameSlot = (d: LegalDocumentModel) =>
      d.type === doc.type || (isStatutesType(doc.type) && isStatutesType(d.type));
    return [...existing.filter((d) => !sameSlot(d)), doc];
  }

  /**
   * Returns the aggregated list of required fields for the given selection.
   */
  getRequiredFieldsFor(types: LegalDocumentType[]): string[] {
    const required = new Set<string>();
    for (const t of types) {
      const entry = getCatalogEntry(t);
      if (!entry) continue;
      entry.requiredFields.forEach((f) => required.add(f));
    }
    return Array.from(required);
  }

  async getLegalDocs(userId: string, projectId: string): Promise<LegalDocsModel | null> {
    logger.debug(`LegalDocsService.getLegalDocs userId=${userId} projectId=${projectId}`);
    const project = await this.projectRepository.findById(projectId, `users/${userId}/projects`);
    if (!project) {
      logger.warn(`LegalDocsService.getLegalDocs: project not found ${projectId}`);
      return null;
    }
    const legalDocs = project.analysisResultModel?.legalDocs || null;
    logger.info(
      `LegalDocsService.getLegalDocs: ${legalDocs?.documents.length ?? 0} documents projectId=${projectId}`
    );
    return legalDocs;
  }

  async deleteLegalDoc(
    userId: string,
    projectId: string,
    documentId: string
  ): Promise<LegalDocsModel | null> {
    logger.info(
      `LegalDocsService.deleteLegalDoc userId=${userId} projectId=${projectId} documentId=${documentId}`
    );
    const project = await this.projectRepository.findById(projectId, `users/${userId}/projects`);
    if (!project || !project.analysisResultModel?.legalDocs) {
      logger.warn(`LegalDocsService.deleteLegalDoc: project or legalDocs not found ${projectId}`);
      return null;
    }

    const legalDocs = project.analysisResultModel.legalDocs;
    const beforeCount = legalDocs.documents.length;
    legalDocs.documents = legalDocs.documents.filter((d) => d.id !== documentId);
    legalDocs.updatedAt = new Date();
    logger.info(
      `LegalDocsService.deleteLegalDoc: ${beforeCount - legalDocs.documents.length} removed, ${legalDocs.documents.length} remaining`
    );

    const updated = await this.projectRepository.update(
      projectId,
      {
        ...project,
        analysisResultModel: {
          ...project.analysisResultModel,
          legalDocs,
        },
      },
      `users/${userId}/projects`
    );

    return updated?.analysisResultModel?.legalDocs || null;
  }

  async clearLegalDocs(userId: string, projectId: string): Promise<void> {
    logger.info(`LegalDocsService.clearLegalDocs userId=${userId} projectId=${projectId}`);
    const project = await this.projectRepository.findById(projectId, `users/${userId}/projects`);
    if (!project) {
      logger.warn(`LegalDocsService.clearLegalDocs: project not found ${projectId}`);
      return;
    }
    project.analysisResultModel.legalDocs = undefined;
    await this.projectRepository.update(projectId, project, `users/${userId}/projects`);
    logger.info(`LegalDocsService.clearLegalDocs: cleared projectId=${projectId}`);
  }

  /**
   * Generates the selected legal documents with SSE streaming, one step per doc.
   */
  async generateLegalDocsWithStreaming(
    userId: string,
    projectId: string,
    request: LegalDocsGenerationRequest,
    streamCallback?: (sectionResult: ISectionResult) => Promise<void>
  ): Promise<ProjectModel | null> {
    logger.info(
      `Generating legal docs for userId: ${userId}, projectId: ${projectId}, types: ${request.types.join(
        ', '
      )}`
    );

    const project = await this.getProject(projectId, userId);
    if (!project) return null;

    const normalized = this.normalizeRequest(project, request);
    if (normalized.types.length === 0) {
      logger.warn(`LegalDocsService.generate: nothing to generate after normalization projectId=${projectId}`);
      return project;
    }
    request = { ...request, types: normalized.types, context: normalized.context };
    const legalForm = normalized.legalForm;
    const form = getLegalForm(legalForm);

    const contextBlock = JSON.stringify(
      {
        project: {
          name: project.name,
          description: project.longDescription || project.description,
          type: project.type,
          scope: project.scope,
          targets: project.targets,
        },
        providedContext: request.context || {},
        legalForm: form
          ? { code: form.code, acronym: form.acronym, name: form.nameFr, nameEn: form.nameEn }
          : legalForm,
        brandName: project.name,
        language: form?.jurisdictions.includes('common_law') ? 'en' : 'fr',
      },
      null,
      2
    );

    const contentHash = crypto
      .createHash('sha256')
      .update(JSON.stringify({ types: request.types, contextBlock }))
      .digest('hex')
      .substring(0, 16);
    const cacheKey = cacheService.generateAIKey('legal-docs', userId, projectId, contentHash);

    const steps: IPromptStep[] = request.types.map((type) => ({
      stepName: type,
      hasDependencies: false,
      promptConstant: `${getLegalDocPrompt(type, legalForm)}\n\n${contextBlock}`,
    }));

    const promptConfig: PromptConfig = {
      provider: AI_CONFIG.legalDocs.provider,
      modelName: AI_CONFIG.legalDocs.modelName,
    };

    const now = new Date();
    const generated: LegalDocumentModel[] = [];

    if (streamCallback) {
      await this.processStepsWithStreaming(
        steps,
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
          const type = result.name as LegalDocumentType;
          const doc: LegalDocumentModel = {
            id: uuidv4(),
            type,
            name: this.documentName(type, legalForm),
            data: result.data,
            summary: result.summary,
            generatedAt: now,
            ...(type === 'statuts' ? { legalForm } : {}),
          };
          generated.push(doc);

          const current = await this.projectRepository.findById(
            projectId,
            `users/${userId}/projects`
          );
          if (!current) throw new Error(`Project not found: ${projectId}`);

          const existing = request.replaceExisting
            ? []
            : current.analysisResultModel?.legalDocs?.documents || [];
          const merged = this.mergeDocument(existing, doc);

          const updatedLegalDocs: LegalDocsModel = {
            context: request.context,
            documents: merged,
            updatedAt: now,
          };

          const updated = await this.projectRepository.update(
            projectId,
            {
              ...current,
              analysisResultModel: {
                ...current.analysisResultModel,
                legalDocs: updatedLegalDocs,
              },
            },
            `users/${userId}/projects`
          );

          if (updated) {
            await cacheService.set(cacheKey, updated, { prefix: 'ai', ttl: 7200 });
            await streamCallback({
              ...result,
              parsedData: { ...result.parsedData, documentId: doc.id, documentType: doc.type },
            });
          } else {
            throw new Error(`Failed to persist legal document ${doc.type}`);
          }
        },
        promptConfig,
        'legal_docs',
        userId
      );

      return this.projectRepository.findById(projectId, `users/${userId}/projects`);
    }

    // Non-streaming fallback
    const results = await this.processSteps(steps, project, promptConfig);
    for (const r of results) {
      const type = r.name as LegalDocumentType;
      generated.push({
        id: uuidv4(),
        type,
        name: this.documentName(type, legalForm),
        data: r.data,
        summary: r.summary,
        generatedAt: now,
        ...(type === 'statuts' ? { legalForm } : {}),
      });
    }

    const current = await this.projectRepository.findById(projectId, `users/${userId}/projects`);
    if (!current) return null;
    const existing = request.replaceExisting
      ? []
      : current.analysisResultModel?.legalDocs?.documents || [];
    const merged = generated.reduce((docs, doc) => this.mergeDocument(docs, doc), existing);

    const updated = await this.projectRepository.update(
      projectId,
      {
        ...current,
        analysisResultModel: {
          ...current.analysisResultModel,
          legalDocs: { context: request.context, documents: merged, updatedAt: now },
        },
      },
      `users/${userId}/projects`
    );

    if (updated) await cacheService.set(cacheKey, updated, { prefix: 'ai', ttl: 7200 });
    return updated;
  }

  /**
   * Generates a PDF for a single legal document (A4 portrait).
   */
  async generateLegalDocPdf(
    userId: string,
    projectId: string,
    documentId: string
  ): Promise<string> {
    logger.info(
      `LegalDocsService.generateLegalDocPdf userId=${userId} projectId=${projectId} documentId=${documentId}`
    );
    const startedAt = Date.now();
    const project = await this.projectRepository.findById(projectId, `users/${userId}/projects`);
    if (!project) {
      logger.warn(`LegalDocsService.generateLegalDocPdf: project not found ${projectId}`);
      throw new Error(`Project not found: ${projectId}`);
    }

    const doc = project.analysisResultModel?.legalDocs?.documents.find((d) => d.id === documentId);
    if (!doc) {
      logger.warn(
        `LegalDocsService.generateLegalDocPdf: document not found documentId=${documentId}`
      );
      return '';
    }

    const cacheKey = cacheService.generateAIKey('legal-doc-pdf', userId, projectId, documentId);
    const cached = await cacheService.get<string>(cacheKey, { prefix: 'pdf', ttl: 3600 });
    if (cached) {
      logger.info(
        `LegalDocsService.generateLegalDocPdf cache hit documentId=${documentId} path=${cached}`
      );
      return cached;
    }

    const section: SectionModel = {
      name: doc.name,
      type: 'legal_document',
      data: doc.data,
      summary: doc.summary,
    };

    try {
      const pdfPath = await this.pdfService.generatePdf({
        title: doc.name,
        projectName: project.name || 'Project',
        projectDescription: project.longDescription || project.description || '',
        sections: [section],
        pageFormat: PAGE_FORMATS.A4_PORTRAIT,
        footerText: `Document juridique — ${doc.name}`,
      });

      await cacheService.set(cacheKey, pdfPath, { prefix: 'pdf', ttl: 3600 });
      logger.info(
        `LegalDocsService.generateLegalDocPdf success documentId=${documentId} path=${pdfPath} durationMs=${Date.now() - startedAt}`
      );
      return pdfPath;
    } catch (err: any) {
      logger.error(
        `LegalDocsService.generateLegalDocPdf error documentId=${documentId}: ${err?.message}`,
        { stack: err?.stack }
      );
      throw err;
    }
  }
}
