/**
 * SimulationPdfService — produit le rapport de simulation en PDF, côté serveur.
 *
 * Le rapport est l'artefact que l'on transmet : à un associé, à une banque, à
 * un investisseur. Il ne peut donc pas dépendre de l'impression navigateur, qui
 * change de rendu d'un poste à l'autre et emporte les couleurs de l'écran.
 *
 * Ce service ne compose rien : il va chercher la simulation et son rapport,
 * puis délègue à `simulation-report.document`. La composition vit à part pour
 * qu'on puisse rendre le document sans dépendre de la base — voir l'en-tête de
 * ce module.
 */

import logger from '../../config/logger';
import { SimulationModel } from '../../models/simulation.model';
import { renderReportDocument } from './simulation-report.document';
import { simulationService } from './simulation.service';

export class SimulationPdfService {
  /** Génère le PDF et renvoie le chemin du fichier produit. */
  async generateReportPdf(
    userId: string,
    projectId: string,
    simulationId: string,
  ): Promise<{ filePath: string; fileName: string }> {
    logger.info(
      `SimulationPdfService.generateReportPdf userId=${userId} projectId=${projectId} simulationId=${simulationId}`,
    );

    const simulation = await simulationService.getSimulation(userId, projectId, simulationId);
    if (!simulation) {
      throw new Error(`Simulation not found: ${simulationId}`);
    }

    // Le rapport est composé à la demande s'il manque alors que le forfait
    // l'inclut : sans cela une simulation payée dont la génération enchaînée
    // n'a pas abouti n'avait plus aucun moyen de livrer son document.
    const report = await simulationService.ensureReport(userId, projectId, simulationId);
    if (!report) {
      throw new Error('This simulation has not produced a report yet');
    }

    const filePath = await renderReportDocument(simulation, report);
    return { filePath, fileName: buildFileName(simulation) };
  }
}

/** Nom de fichier lisible et sans surprise une fois téléchargé. */
function buildFileName(simulation: SimulationModel): string {
  const slug = (simulation.report?.profile.name || simulation.name || 'simulation')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  const date = new Date().toISOString().slice(0, 10);
  return `rapport-simulation-${slug || 'projet'}-${date}.pdf`;
}

export const simulationPdfService = new SimulationPdfService();
