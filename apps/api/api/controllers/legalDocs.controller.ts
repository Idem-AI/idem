import { Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import {
  LegalDocsGenerationRequest,
  LegalDocsService,
} from '../services/LegalDocs/legalDocs.service';
import { PromptService } from '../services/prompt.service';
import { ISectionResult } from '../services/common/generic.service';
import { userService } from '../services/user.service';
import logger from '../config/logger';
import { LegalDocumentType } from '../models/legalDocs.model';

const promptService = new PromptService();
const legalDocsService = new LegalDocsService(promptService);

export const getLegalDocsCatalogController = async (
  _req: CustomRequest,
  res: Response
): Promise<void> => {
  logger.debug('getLegalDocsCatalogController called');
  res.status(200).json({ catalog: legalDocsService.getCatalog() });
};

export const getLegalDocsController = async (req: CustomRequest, res: Response): Promise<void> => {
  const userId = req.user?.uid;
  const { projectId } = req.params;
  try {
    if (!userId) {
      logger.warn('getLegalDocsController: unauthenticated request');
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    logger.info(`getLegalDocsController userId=${userId} projectId=${projectId}`);
    const legalDocs = await legalDocsService.getLegalDocs(userId, projectId as string);
    if (!legalDocs) {
      res.status(200).json({ documents: [] });
      return;
    }
    res.status(200).json(legalDocs);
  } catch (error: any) {
    logger.error(`getLegalDocsController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to retrieve legal docs' });
  }
};

export const getLegalDocsRequirementsController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  try {
    const rawTypes = (req.query.types as string) || '';
    const types = rawTypes
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean) as LegalDocumentType[];
    const required = legalDocsService.getRequiredFieldsFor(types);
    res.status(200).json({ requiredFields: required });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteLegalDocController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const { projectId, documentId } = req.params;
  try {
    if (!userId) {
      logger.warn('deleteLegalDocController: unauthenticated request');
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    logger.info(
      `deleteLegalDocController userId=${userId} projectId=${projectId} documentId=${documentId}`
    );
    const result = await legalDocsService.deleteLegalDoc(
      userId,
      projectId as string,
      documentId as string
    );
    res.status(200).json(result || { documents: [] });
  } catch (error: any) {
    logger.error(`deleteLegalDocController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message });
  }
};

export const clearLegalDocsController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const { projectId } = req.params;
  try {
    if (!userId) {
      logger.warn('clearLegalDocsController: unauthenticated request');
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    logger.info(`clearLegalDocsController userId=${userId} projectId=${projectId}`);
    await legalDocsService.clearLegalDocs(userId, projectId as string);
    res.status(204).send();
  } catch (error: any) {
    logger.error(`clearLegalDocsController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message });
  }
};

export const generateLegalDocsStreamingController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const { projectId } = req.params;

  try {
    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    if (!projectId) {
      res.status(400).json({ message: 'Project ID is required' });
      return;
    }

    // Accept both POST body and GET query (types csv + base64 context JSON)
    let payload: LegalDocsGenerationRequest;
    if (req.method === 'GET') {
      const rawTypes = (req.query.types as string) || '';
      const rawContext = (req.query.context as string) || '';
      const rawReplace = (req.query.replaceExisting as string) || '';
      let context: any = undefined;
      if (rawContext) {
        try {
          context = JSON.parse(Buffer.from(rawContext, 'base64').toString('utf8'));
        } catch {
          res.status(400).json({ message: 'Invalid context encoding (expected base64 JSON)' });
          return;
        }
      }
      payload = {
        types: rawTypes
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean) as LegalDocumentType[],
        context,
        replaceExisting: rawReplace === 'true',
      };
    } else {
      payload = req.body || {};
    }

    if (!Array.isArray(payload.types) || payload.types.length === 0) {
      logger.warn(
        `generateLegalDocsStreamingController: empty types userId=${userId} projectId=${projectId}`
      );
      res.status(400).json({ message: 'At least one document type must be selected' });
      return;
    }
    logger.info(
      `generateLegalDocsStreamingController start userId=${userId} projectId=${projectId} types=[${payload.types.join(',')}] replaceExisting=${!!payload.replaceExisting}`
    );

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const streamCallback = async (stepResult: ISectionResult) => {
      const eventType = stepResult.parsedData?.status || 'progress';
      const message = {
        type: eventType,
        stepName: stepResult.name,
        data: stepResult.data,
        summary: stepResult.summary,
        timestamp: new Date().toISOString(),
        ...(stepResult.parsedData && { parsedData: stepResult.parsedData }),
      };
      res.write(`data: ${JSON.stringify(message)}\n\n`);
      (res as any).flush?.();
    };

    const updatedProject = await legalDocsService.generateLegalDocsWithStreaming(
      userId,
      projectId as string,
      payload,
      streamCallback
    );

    if (!updatedProject) {
      logger.error(
        `generateLegalDocsStreamingController: generation failed projectId=${projectId}`
      );
      res.write(`data: ${JSON.stringify({ error: 'Failed to generate legal documents' })}\n\n`);
      res.end();
      return;
    }

    userService.incrementUsage(userId, Math.max(1, payload.types.length));
    logger.info(
      `generateLegalDocsStreamingController success projectId=${projectId} generated=${payload.types.length}`
    );
    res.write(
      `data: ${JSON.stringify({
        type: 'complete',
        legalDocs: updatedProject.analysisResultModel?.legalDocs,
      })}\n\n`
    );
    res.end();
  } catch (error: any) {
    logger.error(`generateLegalDocsStreamingController error: ${error.message}`, {
      stack: error.stack,
    });
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
};

export const generateLegalDocPdfController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const { projectId, documentId } = req.params;
  try {
    if (!userId) {
      logger.warn('generateLegalDocPdfController: unauthenticated request');
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    logger.info(
      `generateLegalDocPdfController userId=${userId} projectId=${projectId} documentId=${documentId}`
    );
    const pdfPath = await legalDocsService.generateLegalDocPdf(
      userId,
      projectId as string,
      documentId as string
    );
    if (!pdfPath) {
      logger.warn(`generateLegalDocPdfController: document not found documentId=${documentId}`);
      res.status(404).json({ message: 'Document not found' });
      return;
    }
    const fs = require('fs-extra');
    const buffer = await fs.readFile(pdfPath);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="legal-${documentId}.pdf"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (error: any) {
    logger.error(`generateLegalDocPdfController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: 'Error generating legal document PDF', error: error.message });
  }
};
