/**
 * Contrôleurs du module Simulation.
 *
 * Volontairement minces: validation des entrées, appel du service, mapping des
 * erreurs vers des codes HTTP. Toute la logique métier vit dans le service.
 */

import { Response } from 'express';
import * as fs from 'fs-extra';

import logger from '../config/logger';
import { CustomRequest } from '../interfaces/express.interface';
import { SimulationOrigin, SimulationTier } from '../models/simulation.model';
import {
  UnusableDocumentError,
  isAcceptedDocument,
} from '../services/Simulation/document-intake';
import { extractDocumentText } from '../services/Simulation/document-text';
import { simulationPdfService } from '../services/Simulation/simulation-pdf.service';
import { LabName, simulationService } from '../services/Simulation/simulation.service';

const UNSUPPORTED_FORMAT_MESSAGE =
  'Format non pris en charge. Importez votre business plan en PDF, Word (.docx) ou Markdown (.md).';

const VALID_TIERS: SimulationTier[] = ['run', 'report', 'pack'];
const VALID_ORIGINS: SimulationOrigin[] = ['idem-project', 'imported-document'];
const VALID_LABS: LabName[] = [
  'redTeam',
  'customers',
  'investors',
  'blackSwan',
  'universes',
  'timeMachine',
  'experiments',
];

/** Contexte commun à toutes les routes: utilisateur authentifié + projet. */
function requireContext(
  req: CustomRequest,
  res: Response
): { userId: string; projectId: string } | null {
  const userId = req.user?.uid;
  const projectId = req.params.projectId as string;

  if (!userId) {
    res.status(401).json({ message: 'User not authenticated' });
    return null;
  }
  if (!projectId) {
    res.status(400).json({ message: 'Project ID is required' });
    return null;
  }
  return { userId, projectId };
}

/**
 * Reconnaît un refus venu du fournisseur de modèle : compte suspendu, quota
 * épuisé, service momentanément indisponible. On s'appuie sur les marqueurs du
 * message et non sur le seul code HTTP, qu'un 403 de nos propres règles
 * porterait aussi.
 */
function isProviderUnavailable(error: any): boolean {
  const raw = `${error?.message ?? ''} ${JSON.stringify(error?.response ?? '')}`;
  return /PERMISSION_DENIED|RESOURCE_EXHAUSTED|UNAVAILABLE|dunning|billing|quota|rate limit|overloaded/i.test(
    raw
  );
}

/** Un service qui ne trouve rien renvoie 404, pas 500. */
function handleError(res: Response, error: any, operation: string): void {
  const message: string = error?.message || 'Unexpected error';

  // Document refusé : c'est un retour attendu, adressé à l'utilisateur, et
  // pas un incident à faire remonter dans les journaux d'erreur.
  if (error instanceof UnusableDocumentError) {
    logger.info(`${operation} rejected the document: ${message}`);
    res.status(422).json({ message });
    return;
  }

  // Le fournisseur d'IA a refusé (facturation, quota, indisponibilité). Ce
  // n'est ni la faute de l'utilisateur ni celle de sa requête : il doit
  // réessayer plus tard, et le détail technique reste dans les journaux plutôt
  // que d'être renvoyé au navigateur.
  if (isProviderUnavailable(error)) {
    logger.error(`${operation}: the AI provider refused the request: ${message}`, {
      stack: error?.stack,
    });
    res.status(503).json({
      message:
        "Le service d'analyse est momentanément indisponible. Réessayez dans quelques minutes — rien ne vous a été facturé.",
    });
    return;
  }

  logger.error(`${operation} failed: ${message}`, { stack: error?.stack });

  if (message.includes('not found')) {
    res.status(404).json({ message });
    return;
  }
  if (message.includes('has not produced') || message.includes('require a completed')) {
    res.status(409).json({ message });
    return;
  }
  res.status(500).json({ message });
}

// =====================================================================
// LECTURE
// =====================================================================

export const listSimulationsController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const context = requireContext(req, res);
  if (!context) return;

  try {
    const simulations = await simulationService.listSimulations(
      context.userId,
      context.projectId
    );
    res.status(200).json(simulations);
  } catch (error: any) {
    handleError(res, error, 'listSimulations');
  }
};

export const getSimulationController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const context = requireContext(req, res);
  if (!context) return;

  try {
    const simulation = await simulationService.getSimulation(
      context.userId,
      context.projectId,
      req.params.simulationId as string
    );
    if (!simulation) {
      res.status(404).json({ message: 'Simulation not found' });
      return;
    }
    res.status(200).json(simulation);
  } catch (error: any) {
    handleError(res, error, 'getSimulation');
  }
};

export const deleteSimulationController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const context = requireContext(req, res);
  if (!context) return;

  try {
    const deleted = await simulationService.deleteSimulation(
      context.userId,
      context.projectId,
      req.params.simulationId as string
    );
    if (!deleted) {
      res.status(404).json({ message: 'Simulation not found' });
      return;
    }
    res.status(204).send();
  } catch (error: any) {
    handleError(res, error, 'deleteSimulation');
  }
};

// =====================================================================
// PRÉ-VOL
// =====================================================================

/**
 * Lecture du projet avant facturation. C'est ce que l'utilisateur voit à
 * l'étape « ce que le moteur sait », avant de confirmer le prix.
 */
/**
 * Lit un business plan importé, sans projet.
 *
 * Un plan importé ne se rattache à aucun projet existant : celui-ci ne sera
 * créé qu'au lancement, à partir de ce que cette lecture aura livré.
 */
export const analyseImportedDocumentController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  if (!userId) {
    res.status(401).json({ message: 'User not authenticated' });
    return;
  }

  const uploaded = (req as any).file as
    | { originalname: string; mimetype: string; buffer: Buffer }
    | undefined;
  const documentText: string | undefined = req.body?.documentText;

  // Multer écarte silencieusement un format non géré : sans ce garde-fou, la
  // requête continuerait sans document et l'utilisateur ne saurait pas pourquoi.
  if (!uploaded && !documentText) {
    res.status(415).json({ message: UNSUPPORTED_FORMAT_MESSAGE });
    return;
  }

  if (uploaded && !isAcceptedDocument(uploaded.originalname, uploaded.mimetype)) {
    res.status(415).json({ message: UNSUPPORTED_FORMAT_MESSAGE });
    return;
  }

  try {
    const documentName = uploaded?.originalname || req.body?.documentName || 'business-plan';
    // PDF et DOCX passent par un extracteur ; le Markdown est déjà du texte.
    const text = uploaded
      ? await extractDocumentText(uploaded.buffer, uploaded.originalname, uploaded.mimetype)
      : (documentText as string);

    const understanding = await simulationService.analyseDocument(userId, text, documentName);
    res.status(200).json(understanding);
  } catch (error: any) {
    handleError(res, error, 'analyseImportedDocument');
  }
};

/**
 * Crée le projet IDEM décrit par le business plan importé, puis lance la
 * simulation dessus.
 */
export const createSimulationFromDocumentController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  if (!userId) {
    res.status(401).json({ message: 'User not authenticated' });
    return;
  }

  const { name, tier, documentName, answers, understanding } = req.body ?? {};

  if (!VALID_TIERS.includes(tier)) {
    res.status(400).json({ message: `tier must be one of: ${VALID_TIERS.join(', ')}` });
    return;
  }
  if (!understanding?.profile) {
    res.status(400).json({ message: 'understanding is required to create the project' });
    return;
  }

  try {
    const simulation = await simulationService.createSimulationFromDocument(userId, {
      name,
      tier,
      documentName,
      answers,
      understanding,
      // Validé et horodaté par `requireSimulationConsent` : le corps de la
      // requête n'est jamais repris tel quel.
      consent: req.simulationConsent,
    });
    res.status(202).json(simulation);
  } catch (error: any) {
    handleError(res, error, 'createSimulationFromDocument');
  }
};

export const analyseProjectController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const context = requireContext(req, res);
  if (!context) return;

  try {
    // Un business plan importé arrive soit en fichier, soit en texte brut.
    const uploaded = (req as any).file as { originalname: string; buffer: Buffer } | undefined;
    const documentText: string | undefined = req.body?.documentText;

    if (uploaded) {
      const understanding = await simulationService.analyseDocument(
        context.userId,
        uploaded.buffer.toString('utf8'),
        uploaded.originalname
      );
      res.status(200).json(understanding);
      return;
    }

    if (documentText) {
      const understanding = await simulationService.analyseDocument(
        context.userId,
        documentText,
        req.body?.documentName || 'business-plan'
      );
      res.status(200).json(understanding);
      return;
    }

    const understanding = await simulationService.analyseProject(
      context.userId,
      context.projectId
    );
    res.status(200).json(understanding);
  } catch (error: any) {
    handleError(res, error, 'analyseProject');
  }
};

export const getPricingController = async (req: CustomRequest, res: Response): Promise<void> => {
  const userId = req.user?.uid;
  if (!userId) {
    res.status(401).json({ message: 'User not authenticated' });
    return;
  }

  const originParam = (req.query.origin as string) || 'idem-project';
  const origin: SimulationOrigin = VALID_ORIGINS.includes(originParam as SimulationOrigin)
    ? (originParam as SimulationOrigin)
    : 'idem-project';

  res.status(200).json(simulationService.getPricing(origin));
};

// =====================================================================
// EXÉCUTION
// =====================================================================

/**
 * Démarre une simulation. Répond immédiatement en 202: le pipeline enchaîne
 * six appels LLM en arrière-plan, le client suit l'avancement en interrogeant
 * la simulation créée.
 */
export const createSimulationController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const context = requireContext(req, res);
  if (!context) return;

  const { name, origin, tier, documentName, answers, previousRunId, understanding } =
    req.body ?? {};

  if (!VALID_TIERS.includes(tier)) {
    res.status(400).json({ message: `tier must be one of: ${VALID_TIERS.join(', ')}` });
    return;
  }
  if (origin && !VALID_ORIGINS.includes(origin)) {
    res.status(400).json({ message: `origin must be one of: ${VALID_ORIGINS.join(', ')}` });
    return;
  }

  try {
    const simulation = await simulationService.createSimulation(
      context.userId,
      context.projectId,
      {
        name,
        origin: origin ?? 'idem-project',
        tier,
        documentName,
        answers,
        previousRunId,
        // La lecture que l'utilisateur a validée à l'écran. Sans elle, le
        // pipeline relisait le projet une seconde fois : un appel de plus,
        // pour une lecture qui pouvait différer de celle qui était affichée.
        understanding: understanding?.profile ? understanding : undefined,
        consent: req.simulationConsent,
      }
    );
    res.status(202).json(simulation);
  } catch (error: any) {
    handleError(res, error, 'createSimulation');
  }
};

export const generateReportController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const context = requireContext(req, res);
  if (!context) return;

  try {
    const report = await simulationService.generateReport(
      context.userId,
      context.projectId,
      req.params.simulationId as string
    );
    res.status(200).json(report);
  } catch (error: any) {
    handleError(res, error, 'generateReport');
  }
};

export const getReportController = async (req: CustomRequest, res: Response): Promise<void> => {
  const context = requireContext(req, res);
  if (!context) return;

  try {
    // Produit le rapport s'il manque alors que le forfait l'inclut : l'écran
    // de rapport n'en redemande pas la génération quand `hasReport` est vrai.
    const report = await simulationService.ensureReport(
      context.userId,
      context.projectId,
      req.params.simulationId as string
    );
    if (!report) {
      res.status(404).json({ message: 'Report has not been generated for this simulation' });
      return;
    }
    res.status(200).json(report);
  } catch (error: any) {
    handleError(res, error, 'getReport');
  }
};

/**
 * Rend le rapport en PDF, composé côté serveur à partir du template IDEM.
 * L'impression navigateur ne donnait ni la même mise en page ni les mêmes
 * couleurs d'un poste à l'autre.
 */
export const downloadReportPdfController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const context = requireContext(req, res);
  if (!context) return;

  try {
    const { filePath, fileName } = await simulationPdfService.generateReportPdf(
      context.userId,
      context.projectId,
      req.params.simulationId as string
    );

    const buffer = await fs.readFile(filePath);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    // Le nom de fichier est lu par le navigateur du client, pas par le nôtre.
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.send(buffer);
  } catch (error: any) {
    handleError(res, error, 'downloadReportPdf');
  }
};

// =====================================================================
// LABORATOIRES
// =====================================================================

/**
 * Exécute une analyse complémentaire (Red Team, clients simulés,
 * investisseurs, cygnes noirs, univers parallèles, Time Machine, expériences).
 */
export const runLabController = async (req: CustomRequest, res: Response): Promise<void> => {
  const context = requireContext(req, res);
  if (!context) return;

  const lab = req.params.lab as LabName;
  if (!VALID_LABS.includes(lab)) {
    res.status(400).json({ message: `lab must be one of: ${VALID_LABS.join(', ')}` });
    return;
  }

  try {
    const simulation = await simulationService.runLab(
      context.userId,
      context.projectId,
      req.params.simulationId as string,
      lab
    );
    res.status(200).json(simulation);
  } catch (error: any) {
    handleError(res, error, `runLab:${lab}`);
  }
};
