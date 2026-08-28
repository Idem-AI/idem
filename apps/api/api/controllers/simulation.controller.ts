/**
 * Contrôleurs du module Simulation.
 *
 * Volontairement minces: validation des entrées, appel du service, mapping des
 * erreurs vers des codes HTTP. Toute la logique métier vit dans le service.
 */

import { Response } from 'express';

import logger from '../config/logger';
import { CustomRequest } from '../interfaces/express.interface';
import { SimulationOrigin, SimulationTier } from '../models/simulation.model';
import { LabName, simulationService } from '../services/Simulation/simulation.service';

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

/** Un service qui ne trouve rien renvoie 404, pas 500. */
function handleError(res: Response, error: any, operation: string): void {
  const message: string = error?.message || 'Unexpected error';
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

  const { name, origin, tier, documentName, answers, previousRunId } = req.body ?? {};

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
    const simulation = await simulationService.getSimulation(
      context.userId,
      context.projectId,
      req.params.simulationId as string
    );
    if (!simulation) {
      res.status(404).json({ message: 'Simulation not found' });
      return;
    }
    if (!simulation.report) {
      res.status(404).json({ message: 'Report has not been generated for this simulation' });
      return;
    }
    res.status(200).json(simulation.report);
  } catch (error: any) {
    handleError(res, error, 'getReport');
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
