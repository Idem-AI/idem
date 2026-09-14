import { Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { PitchDeckService } from '../services/PitchDeck/pitchDeck.service';
import { PromptService } from '../services/prompt.service';
import { ISectionResult } from '../services/common/generic.service';
import { userService } from '../services/user.service';
import logger from '../config/logger';
import { getRequestLanguage } from '../utils/request-language';
import { sectionEditingService } from '../services/common/section-editing.service';
import {
  hasSectionContent,
  normalizeDocumentName,
  readDocumentId,
} from '../services/common/deliverable-documents';
import { DEFAULT_PITCH_DECK_TYPE_ID, isKnownPitchDeckType } from '../services/PitchDeck/deck-types';

const promptService = new PromptService();
const pitchDeckService = new PitchDeckService(promptService);

/**
 * Sauvegarde les diapositives éditées (éditeur WYSIWYG). Body: { sections }.
 * `?documentId=` désigne le deck ; sans lui, le deck principal.
 */
export const savePitchDeckSectionsController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const { projectId } = req.params;
  try {
    if (!userId) { res.status(401).json({ message: 'User not authenticated' }); return; }
    if (!projectId) { res.status(400).json({ message: 'Project ID is required' }); return; }
    const { sections } = req.body ?? {};
    if (!Array.isArray(sections)) { res.status(400).json({ message: 'A "sections" array is required' }); return; }

    const updated = await sectionEditingService.saveSections(
      userId,
      projectId as string,
      'pitchDeck',
      sections,
      readDocumentId(req.query.documentId)
    );
    if (!updated) { res.status(404).json({ message: 'Pitch deck not found for the project' }); return; }
    res.status(200).json(updated);
  } catch (error: any) {
    logger.error(`Error in savePitchDeckSectionsController: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to save pitch deck sections' });
  }
};

/**
 * Édition IA d'une diapositive. Body: { instruction }.
 */
export const aiEditPitchDeckSectionController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const { projectId, sectionId } = req.params;
  try {
    if (!userId) { res.status(401).json({ message: 'User not authenticated' }); return; }
    if (!projectId || !sectionId) { res.status(400).json({ message: 'Project ID and section ID are required' }); return; }
    const instruction = (req.body?.instruction ?? '').toString().trim();
    if (!instruction) { res.status(400).json({ message: 'An "instruction" is required' }); return; }

    const result = await sectionEditingService.aiEditSection(
      userId,
      projectId as string,
      'pitchDeck',
      sectionId as string,
      instruction,
      getRequestLanguage(),
      readDocumentId(req.query.documentId)
    );
    if (!result) { res.status(404).json({ message: 'Slide not found or AI edit failed' }); return; }
    res.status(200).json(result);
  } catch (error: any) {
    logger.error(`Error in aiEditPitchDeckSectionController: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to AI-edit pitch deck slide' });
  }
};

/** Types de deck proposés à la création — le même catalogue pour tous. */
export const getPitchDeckTypesController = async (
  _req: CustomRequest,
  res: Response
): Promise<void> => {
  res.status(200).json({ defaultTypeId: DEFAULT_PITCH_DECK_TYPE_ID, types: pitchDeckService.getTypes() });
};

/** Decks du projet, en résumé (sans le HTML des slides). */
export const listPitchDeckDocumentsController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const { projectId } = req.params;
  try {
    if (!userId) { res.status(401).json({ message: 'User not authenticated' }); return; }
    const decks = await pitchDeckService.listDocuments(userId, projectId as string);
    if (!decks) { res.status(404).json({ message: 'Project not found' }); return; }
    res.status(200).json(decks);
  } catch (error: any) {
    logger.error(`listPitchDeckDocumentsController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to list pitch decks' });
  }
};

/** Crée un deck vide. Body: { type, name? }. */
export const createPitchDeckDocumentController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const { projectId } = req.params;
  try {
    if (!userId) { res.status(401).json({ message: 'User not authenticated' }); return; }
    const { type, name } = req.body ?? {};
    if (!isKnownPitchDeckType(type)) {
      res.status(400).json({ message: 'A known pitch deck "type" is required' });
      return;
    }
    const deck = await pitchDeckService.createDocument(
      userId,
      projectId as string,
      type,
      normalizeDocumentName(name)
    );
    if (!deck) { res.status(404).json({ message: 'Project not found' }); return; }
    res.status(201).json(pitchDeckService.toSummary(deck));
  } catch (error: any) {
    logger.error(`createPitchDeckDocumentController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to create pitch deck' });
  }
};

/** Renomme un deck. Body: { name }. */
export const renamePitchDeckDocumentController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const { projectId, documentId } = req.params;
  try {
    if (!userId) { res.status(401).json({ message: 'User not authenticated' }); return; }
    const name = normalizeDocumentName(req.body?.name);
    if (!name) { res.status(400).json({ message: 'A non-empty "name" is required' }); return; }
    const deck = await pitchDeckService.renameDocument(
      userId,
      projectId as string,
      documentId as string,
      name
    );
    if (!deck) { res.status(404).json({ message: 'Pitch deck not found' }); return; }
    res.status(200).json(pitchDeckService.toSummary(deck));
  } catch (error: any) {
    logger.error(`renamePitchDeckDocumentController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to rename pitch deck' });
  }
};

export const deletePitchDeckDocumentController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const { projectId, documentId } = req.params;
  try {
    if (!userId) { res.status(401).json({ message: 'User not authenticated' }); return; }
    const removed = await pitchDeckService.deleteDocument(
      userId,
      projectId as string,
      documentId as string
    );
    if (!removed) { res.status(404).json({ message: 'Pitch deck not found' }); return; }
    res.status(204).send();
  } catch (error: any) {
    logger.error(`deletePitchDeckDocumentController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to delete pitch deck' });
  }
};

export const getPitchDeckController = async (req: CustomRequest, res: Response): Promise<void> => {
  const userId = req.user?.uid;
  const { projectId } = req.params;
  const documentId = readDocumentId(req.query.documentId);
  try {
    if (!userId) {
      logger.warn('getPitchDeckController: unauthenticated request');
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    logger.info(`getPitchDeckController userId=${userId} projectId=${projectId} documentId=${documentId ?? '(primary)'}`);
    const pitchDeck = await pitchDeckService.getPitchDeckByProjectId(userId, projectId as string, documentId);
    if (!pitchDeck) {
      logger.info(`getPitchDeckController: no pitch deck yet projectId=${projectId}`);
      res.status(404).json({ message: 'Pitch deck not found' });
      return;
    }
    res.status(200).json(pitchDeck);
  } catch (error: any) {
    logger.error(`getPitchDeckController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to retrieve pitch deck' });
  }
};

/**
 * Suppression par l'ancienne route (`DELETE /pitchDecks/:projectId`). Un projet
 * garde désormais plusieurs decks : sans `?documentId=`, on ne devine pas
 * lequel effacer.
 */
export const deletePitchDeckController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const { projectId } = req.params;
  const documentId = readDocumentId(req.query.documentId);
  try {
    if (!userId) {
      logger.warn('deletePitchDeckController: unauthenticated request');
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    if (!documentId) {
      res.status(400).json({ message: 'A "documentId" query parameter is required' });
      return;
    }
    logger.info(`deletePitchDeckController userId=${userId} projectId=${projectId} documentId=${documentId}`);
    const removed = await pitchDeckService.deleteDocument(userId, projectId as string, documentId);
    if (!removed) {
      res.status(404).json({ message: 'Pitch deck not found' });
      return;
    }
    res.status(204).send();
  } catch (error: any) {
    logger.error(`deletePitchDeckController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to delete pitch deck' });
  }
};

export const generatePitchDeckStreamingController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const { projectId } = req.params;
  const startedAt = Date.now();

  try {
    if (!userId) {
      logger.warn('generatePitchDeckStreamingController: unauthenticated request');
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    if (!projectId) {
      logger.warn(`generatePitchDeckStreamingController: missing projectId userId=${userId}`);
      res.status(400).json({ message: 'Project ID is required' });
      return;
    }

    // Le deck est résolu AVANT d'ouvrir le flux : un identifiant inconnu est une
    // erreur de requête, pas une génération qui échoue en cours de route.
    const deck = await pitchDeckService.ensureDocument(
      userId,
      projectId as string,
      readDocumentId(req.query.documentId)
    );
    if (!deck) {
      logger.warn(`generatePitchDeckStreamingController: pitch deck not found projectId=${projectId}`);
      res.status(404).json({ message: 'Pitch deck not found' });
      return;
    }

    logger.info(
      `generatePitchDeckStreamingController start userId=${userId} projectId=${projectId} documentId=${deck.id}`
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

    const forceRegenerate = req.query.force === 'true' || req.body.force === true;

    // Sections ciblées à régénérer (ex: ?sections=Financials,Ask)
    const sectionsParam = typeof req.query.sections === 'string' ? req.query.sections : '';
    const targetSections = sectionsParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    // Reprise ou régénération d'un deck déjà entamé : non facturée.
    const isRetry = !forceRegenerate && deck.sections.some(hasSectionContent);

    const updatedDeck = await pitchDeckService.generatePitchDeckWithStreaming(
      userId,
      projectId as string,
      streamCallback,
      forceRegenerate,
      targetSections,
      deck.id
    );

    if (!updatedDeck) {
      logger.error(
        `generatePitchDeckStreamingController: generation failed projectId=${projectId} documentId=${deck.id}`
      );
      res.write(`data: ${JSON.stringify({ error: 'Failed to generate pitch deck' })}\n\n`);
      res.end();
      return;
    }

    if (!isRetry) {
      userService.incrementUsage(userId, 5);
      logger.info(`Charged 5 credits for user ${userId} on Pitch Deck completion.`);
    } else {
      logger.info(`Exempted user ${userId} from credit charge because this is a retry/resume.`);
    }

    logger.info(
      `generatePitchDeckStreamingController success projectId=${projectId} documentId=${deck.id} durationMs=${Date.now() - startedAt}`
    );
    res.write(
      `data: ${JSON.stringify({
        type: 'complete',
        documentId: deck.id,
        pitchDeck: pitchDeckService.toView(updatedDeck),
      })}\n\n`
    );
    res.end();
  } catch (error: any) {
    logger.error(`generatePitchDeckStreamingController error: ${error.message}`, {
      stack: error.stack,
    });
    if (!res.headersSent) {
      res.status(500).json({ message: error.message || 'Failed to generate pitch deck' });
      return;
    }
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
};

export const generatePitchDeckPdfController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const { projectId } = req.params;
  const documentId = readDocumentId(req.query.documentId);
  try {
    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    if (!projectId) {
      res.status(400).json({ message: 'Project ID is required' });
      return;
    }

    logger.info(`generatePitchDeckPdfController userId=${userId} projectId=${projectId} documentId=${documentId ?? '(primary)'}`);
    const pdfPath = await pitchDeckService.generatePitchDeckPdf(userId, projectId as string, documentId);
    if (pdfPath === '') {
      logger.warn(`generatePitchDeckPdfController: no pitch deck for projectId=${projectId}`);
      res.status(404).json({ message: 'No pitch deck found' });
      return;
    }

    const fs = require('fs-extra');
    const pdfBuffer = await fs.readFile(pdfPath);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="pitch-deck-${projectId}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error: any) {
    logger.error(`generatePitchDeckPdfController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: 'Error generating pitch deck PDF', error: error.message });
  }
};
