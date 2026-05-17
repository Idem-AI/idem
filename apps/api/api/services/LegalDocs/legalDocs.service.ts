import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../config/logger';
import {
  LegalDocsContext,
  LegalDocsModel,
  LegalDocumentModel,
  LegalDocumentType,
} from '../../models/legalDocs.model';
import { ProjectModel } from '../../models/project.model';
import { SectionModel } from '../../models/section.model';
import { cacheService } from '../cache.service';
import { GenericService, IPromptStep, ISectionResult } from '../common/generic.service';
import { PAGE_FORMATS, PdfService } from '../pdf.service';
import { LLMProvider, PromptConfig, PromptService } from '../prompt.service';
import { LEGAL_DOCS_CATALOG, getCatalogEntry } from './catalog';
import { getLegalDocPrompt } from './prompts';

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

    const contextBlock = JSON.stringify(
      {
        project: {
          name: project.name,
          description: project.description,
          type: project.type,
          scope: project.scope,
          targets: project.targets,
        },
        providedContext: request.context || {},
        brandName: project.name,
        language:
          request.context?.country &&
          /south africa|nigeria|ghana|kenya|rwanda/i.test(request.context.country)
            ? 'en'
            : 'fr',
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
      promptConstant: `${getLegalDocPrompt(type)}\n\n${contextBlock}`,
    }));

    const promptConfig: PromptConfig = {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3-flash-preview',
    };

    const now = new Date();
    const generated: LegalDocumentModel[] = [];

    if (streamCallback) {
      await this.processStepsWithStreaming(
        steps,
        project,
        async (result: ISectionResult) => {
          if (result.data === 'steps_in_progress' || result.data === 'all_steps_completed') {
            await streamCallback(result);
            return;
          }
          const entry = getCatalogEntry(result.name as LegalDocumentType);
          const doc: LegalDocumentModel = {
            id: uuidv4(),
            type: result.name as LegalDocumentType,
            name: entry?.nameFr || result.name,
            data: result.data,
            summary: result.summary,
            generatedAt: now,
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
          // Avoid duplicates on same type when replaceExisting not set: replace if same type
          const merged = existing.filter((d) => d.type !== doc.type);
          merged.push(doc);

          const updatedLegalDocs: LegalDocsModel = {
            context: request.context || current.analysisResultModel?.legalDocs?.context,
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
      const entry = getCatalogEntry(r.name as LegalDocumentType);
      generated.push({
        id: uuidv4(),
        type: r.name as LegalDocumentType,
        name: entry?.nameFr || r.name,
        data: r.data,
        summary: r.summary,
        generatedAt: now,
      });
    }

    const current = await this.projectRepository.findById(projectId, `users/${userId}/projects`);
    if (!current) return null;
    const existing = request.replaceExisting
      ? []
      : current.analysisResultModel?.legalDocs?.documents || [];
    const merged = existing.filter((d) => !generated.find((g) => g.type === d.type));
    merged.push(...generated);

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
        projectDescription: project.description || '',
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
