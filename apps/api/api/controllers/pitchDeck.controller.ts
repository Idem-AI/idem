import { Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { PitchDeckService } from '../services/PitchDeck/pitchDeck.service';
import { PromptService } from '../services/prompt.service';
import { ISectionResult } from '../services/common/generic.service';
import { userService } from '../services/user.service';
import logger from '../config/logger';

const promptService = new PromptService();
const pitchDeckService = new PitchDeckService(promptService);

export const getPitchDeckController = async (req: CustomRequest, res: Response): Promise<void> => {
  const userId = req.user?.uid;
  const { projectId } = req.params;
  try {
    if (!userId) {
      logger.warn('getPitchDeckController: unauthenticated request');
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    logger.info(`getPitchDeckController userId=${userId} projectId=${projectId}`);
    const pitchDeck = await pitchDeckService.getPitchDeckByProjectId(userId, projectId as string);
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

export const deletePitchDeckController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const { projectId } = req.params;
  try {
    if (!userId) {
      logger.warn('deletePitchDeckController: unauthenticated request');
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    logger.info(`deletePitchDeckController userId=${userId} projectId=${projectId}`);
    await pitchDeckService.deletePitchDeck(userId, projectId as string);
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
    logger.info(
      `generatePitchDeckStreamingController start userId=${userId} projectId=${projectId}`
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

    const updatedProject = await pitchDeckService.generatePitchDeckWithStreaming(
      userId,
      projectId as string,
      streamCallback
    );

    if (!updatedProject) {
      logger.error(
        `generatePitchDeckStreamingController: generation failed projectId=${projectId}`
      );
      res.write(`data: ${JSON.stringify({ error: 'Failed to generate pitch deck' })}\n\n`);
      res.end();
      return;
    }

    userService.incrementUsage(userId, 5);
    logger.info(
      `generatePitchDeckStreamingController success projectId=${projectId} durationMs=${Date.now() - startedAt}`
    );
    res.write(
      `data: ${JSON.stringify({
        type: 'complete',
        pitchDeck: updatedProject.analysisResultModel?.pitchDeck,
      })}\n\n`
    );
    res.end();
  } catch (error: any) {
    logger.error(`generatePitchDeckStreamingController error: ${error.message}`, {
      stack: error.stack,
    });
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
  try {
    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    if (!projectId) {
      res.status(400).json({ message: 'Project ID is required' });
      return;
    }

    logger.info(`generatePitchDeckPdfController userId=${userId} projectId=${projectId}`);
    const pdfPath = await pitchDeckService.generatePitchDeckPdf(userId, projectId as string);
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
