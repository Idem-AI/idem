/**
 * NOUVELLE MISE EN PAGE d'un business plan ou d'un pitch deck : les pages sont réécrites par l'auteur du moteur à
 * partir de leur contenu GARDÉ — aucun texte réécrit. Body : `{ creativity?, note? }` (`note` : le souhait de mise en
 * page, « plus aérée »). Un échec (rien à remettre en page, aucune page refaite) répond 4xx/5xx : la facturation
 * contrepasse d'elle-même.
 */
import { Response } from 'express';
import logger from '../config/logger';
import { CustomRequest } from '../interfaces/express.interface';
import { promptService } from '../services/prompt.service';
import { ComposedKind, relayoutStoredDocument } from '../services/graphic/page-editing.service';
import { readDocumentId } from '../services/common/deliverable-documents';

export const relayoutController =
  (kind: ComposedKind) =>
  async (req: CustomRequest, res: Response): Promise<void> => {
    const userId = req.user?.uid;
    const { projectId } = req.params;
    try {
      if (!userId) {
        res.status(401).json({ message: 'User not authenticated' });
        return;
      }
      const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 600) : undefined;
      const report = await relayoutStoredDocument({ promptService, userId, projectId: projectId as string, kind, documentId: readDocumentId(req.query.documentId), creativity: req.body?.creativity, note });
      if (!report) {
        res.status(404).json({ message: 'Document not found' });
        return;
      }
      if (!report.relaid.length) {
        res.status(report.failed.length ? 500 : 409).json({ error: report.failed.length ? 'relayout_failed' : 'nothing_to_relayout', kept: report.kept, failed: report.failed });
        return;
      }
      res.status(200).json(report);
    } catch (error: any) {
      logger.error(`Error in relayoutController(${kind}): ${error.message}`, { stack: error.stack });
      res.status(500).json({ message: error.message || 'Failed to relayout the document' });
    }
  };
