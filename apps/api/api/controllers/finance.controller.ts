import { Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { financeService } from '../services/Finance/finance.service';
import { computeFinance } from '../services/Finance/finance-calculator.service';
import {
  financeAIService,
  FinanceChatIntent,
  FinanceSectionKey as AISectionKey,
} from '../services/Finance/finance-ai.service';
import { financePdfService } from '../services/Finance/finance-pdf.service';
import { userService } from '../services/user.service';
import { projectService } from '../services/project.service';
import { researchTeamService } from '../services/research/research-team.service';
import { ResearchStreamEvent } from '../services/research/research.types';
import { SectionSource } from '../models/section.model';
import { getRequestLanguage } from '../utils/request-language';
import logger from '../config/logger';

/**
 * Récupère le modèle Finance complet (avec snapshot calculé) d'un projet.
 */
export const getFinanceController = async (req: CustomRequest, res: Response): Promise<void> => {
  const userId = req.user?.uid;
  const projectId = req.params.projectId as string;
  try {
    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    if (!projectId) {
      res.status(400).json({ message: 'Project ID is required' });
      return;
    }
    const finance = await financeService.getFinance(userId, projectId);
    if (!finance) {
      res.status(404).json({ message: 'Finance data not found' });
      return;
    }
    res.status(200).json(finance);
  } catch (error: any) {
    logger.error(`getFinanceController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to retrieve finance data' });
  }
};

/**
 * Récupère un résumé synthétique du module finance pour le dashboard / chat.
 */
export const getFinanceSummaryController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const projectId = req.params.projectId as string;
  try {
    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    if (!projectId) {
      res.status(400).json({ message: 'Project ID is required' });
      return;
    }
    const result = await financeService.getSummary(userId, projectId);
    if (!result) {
      res.status(404).json({ message: 'Finance summary not available' });
      return;
    }
    res.status(200).json(result);
  } catch (error: any) {
    logger.error(`getFinanceSummaryController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to retrieve finance summary' });
  }
};

/**
 * Remplace l'intégralité du modèle Finance (utilisé après un auto-fill global IA).
 */
export const replaceFinanceController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const projectId = req.params.projectId as string;
  try {
    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    if (!projectId) {
      res.status(400).json({ message: 'Project ID is required' });
      return;
    }
    const updated = await financeService.replaceFinance(userId, projectId, req.body);
    if (!updated) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }
    res.status(200).json(updated);
  } catch (error: any) {
    logger.error(`replaceFinanceController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to replace finance data' });
  }
};

/**
 * Met à jour une section précise du module Finance.
 * URL: PUT /project/finance/:projectId/section/:section
 */
const ALLOWED_SECTIONS = [
  'products',
  'salesObjectives',
  'revenueParams',
  'variableCharges',
  'fixedCharges',
  'taxesParams',
  'investments',
  'financing',
  'ratiosParams',
] as const;
type AllowedSection = (typeof ALLOWED_SECTIONS)[number];

export const updateFinanceSectionController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const projectId = req.params.projectId as string;
  const section = req.params.section as string;
  try {
    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    if (!projectId || !section) {
      res.status(400).json({ message: 'Project ID and section are required' });
      return;
    }
    if (!ALLOWED_SECTIONS.includes(section as AllowedSection)) {
      res.status(400).json({ message: `Unknown section: ${section}` });
      return;
    }
    const updated = await financeService.updateSection(
      userId,
      projectId,
      section as AllowedSection,
      req.body
    );
    if (!updated) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }
    res.status(200).json(updated);
  } catch (error: any) {
    logger.error(`updateFinanceSectionController error: ${error.message}`, {
      stack: error.stack,
    });
    res.status(500).json({ message: error.message || 'Failed to update finance section' });
  }
};

/**
 * Ajoute des justifications IA (issues d'un auto-fill).
 */
export const appendAISuggestionsController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const projectId = req.params.projectId as string;
  try {
    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    if (!projectId) {
      res.status(400).json({ message: 'Project ID is required' });
      return;
    }
    const suggestions = Array.isArray(req.body) ? req.body : req.body?.suggestions;
    if (!Array.isArray(suggestions)) {
      res.status(400).json({ message: 'Body must be an array of AISuggestion' });
      return;
    }
    const updated = await financeService.appendAISuggestions(userId, projectId, suggestions);
    if (!updated) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }
    res.status(200).json(updated);
  } catch (error: any) {
    logger.error(`appendAISuggestionsController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to append AI suggestions' });
  }
};

/**
 * Force un recalcul de toutes les sorties financières.
 */
export const recomputeFinanceController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const projectId = req.params.projectId as string;
  try {
    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    if (!projectId) {
      res.status(400).json({ message: 'Project ID is required' });
      return;
    }
    const updated = await financeService.recompute(userId, projectId);
    if (!updated) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }
    res.status(200).json(updated);
  } catch (error: any) {
    logger.error(`recomputeFinanceController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to recompute finance data' });
  }
};

/**
 * Simulation à la volée: calcule un FinanceComputed sans persister.
 * Utile pour les aperçus en temps réel côté frontend.
 */
export const simulateFinanceController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  try {
    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    if (!req.body || typeof req.body !== 'object') {
      res.status(400).json({ message: 'Body must be a FinanceModel object' });
      return;
    }
    const computed = computeFinance(req.body);
    res.status(200).json({ computed });
  } catch (error: any) {
    logger.error(`simulateFinanceController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to simulate finance data' });
  }
};

/**
 * Auto-fill IA pour une section précise.
 * URL: POST /project/finance/:projectId/ai-fill/:section
 */
export const aiFillSectionController = async (req: CustomRequest, res: Response): Promise<void> => {
  const userId = req.user?.uid;
  const projectId = req.params.projectId as string;
  const section = req.params.section as string;
  const ALLOWED: AISectionKey[] = [
    'products',
    'salesObjectives',
    'revenueParams',
    'variableCharges',
    'fixedCharges',
    'taxesParams',
    'investments',
    'financing',
  ];
  try {
    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    if (!projectId || !section) {
      res.status(400).json({ message: 'Project ID and section are required' });
      return;
    }
    if (!ALLOWED.includes(section as AISectionKey)) {
      res.status(400).json({ message: `Unsupported section for AI fill: ${section}` });
      return;
    }
    logger.info(
      `aiFillSectionController userId=${userId} projectId=${projectId} section=${section}`
    );
    const result = await financeAIService.autoFillSection(
      userId,
      projectId,
      section as AISectionKey
    );
    userService.incrementUsage(userId, 1);
    res.status(200).json(result);
  } catch (error: any) {
    logger.error(`aiFillSectionController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'AI auto-fill failed' });
  }
};

/**
 * Auto-fill IA global — remplit toutes les sections cohérentes ensemble.
 * URL: POST /project/finance/:projectId/ai-fill-all
 */
export const aiFillAllController = async (req: CustomRequest, res: Response): Promise<void> => {
  const userId = req.user?.uid;
  const projectId = req.params.projectId as string;
  try {
    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    if (!projectId) {
      res.status(400).json({ message: 'Project ID is required' });
      return;
    }
    logger.info(`aiFillAllController userId=${userId} projectId=${projectId}`);
    const result = await financeAIService.autoFillAll(userId, projectId);
    userService.incrementUsage(userId, 3);
    res.status(200).json(result);
  } catch (error: any) {
    logger.error(`aiFillAllController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'AI global auto-fill failed' });
  }
};

/**
 * Auto-fill IA global SOURCÉ, en streaming (SSE): une équipe d'agents recherche
 * d'abord des benchmarks marché réels (grounding web), puis cale les prévisions
 * financières dessus. Chaque micro-action est diffusée en temps réel pour la
 * salle de contrôle, et les sources sont rattachées aux suggestions.
 * URL: GET /project/finance/:projectId/ai-fill-stream
 */
export const aiFillAllStreamController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const projectId = req.params.projectId as string;

  if (!userId) {
    res.status(401).json({ message: 'User not authenticated' });
    return;
  }
  if (!projectId) {
    res.status(400).json({ message: 'Project ID is required' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const writeSSE = (payload: unknown) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
    (res as any).flush?.();
  };

  try {
    const project = await projectService.getUserProjectById(userId, projectId);
    if (!project) {
      writeSSE({ type: 'error', message: 'Project not found', timestamp: new Date().toISOString() });
      res.end();
      return;
    }

    const currency = project.analysisResultModel?.finance?.meta?.currency || 'FCFA';
    const products = (project.analysisResultModel?.finance?.products || [])
      .map((p: any) => p.name)
      .filter(Boolean)
      .join(', ');
    const projectContext = [
      `Nom: ${project.name || '—'}`,
      `Description: ${project.description || '—'}`,
      `Type: ${project.type || '—'}`,
      `Cible: ${project.targets || '—'}`,
      `Pays: ${project.additionalInfos?.country || '—'}`,
      `Devise: ${currency}`,
      products ? `Produits: ${products}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const language = getRequestLanguage() === 'fr' ? 'French' : 'English';
    const spec = financeAIService.buildMarketResearchSpec(project);

    const emit = async (event: ResearchStreamEvent) => writeSSE(event);

    // Phase 1: recherche marché sourcée (sans persistance de sections markdown).
    const researched = await researchTeamService.runResearchTeam(
      spec,
      { projectContext, language, userId, currency },
      emit
    );

    // Agrège le digest + dédoublonne les sources par URL.
    const marketDigest = researched
      .map((s) => `## ${s.name}\n${s.data}`)
      .join('\n\n');
    const sourceMap = new Map<string, SectionSource>();
    for (const section of researched) {
      for (const src of section.sources || []) {
        if (!sourceMap.has(src.url)) sourceMap.set(src.url, src);
      }
    }
    const allSources = Array.from(sourceMap.values());

    // Phase 2: application des benchmarks aux prévisions financières.
    writeSSE({
      type: 'agent_event',
      timestamp: new Date().toISOString(),
      agentEvent: {
        ts: new Date().toISOString(),
        runId: 'finance-fill',
        agentId: 'writer:finance',
        role: 'writer',
        kind: 'agent_status',
        status: 'writing',
        message: 'Application des benchmarks sourcés aux prévisions financières',
      },
    });

    const result = await financeAIService.autoFillAll(
      userId,
      projectId,
      marketDigest,
      allSources
    );
    userService.incrementUsage(userId, 3);

    writeSSE({ type: 'complete', finance: result.finance, sources: allSources });
    writeSSE({ type: 'completed', stepName: 'completion', data: 'all_steps_completed' });
    res.end();
  } catch (error: any) {
    logger.error(`aiFillAllStreamController error: ${error.message}`, { stack: error.stack });
    writeSSE({ type: 'error', message: error.message || 'AI sourced auto-fill failed', timestamp: new Date().toISOString() });
    res.end();
  }
};

/**
 * Parse une intention finance depuis un message utilisateur (sans appliquer).
 * URL: POST /project/finance/:projectId/chat/parse  body: { message }
 */
export const parseChatIntentController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const projectId = req.params.projectId as string;
  const { message } = req.body || {};
  try {
    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    if (!projectId || !message || typeof message !== 'string') {
      res.status(400).json({ message: 'Project ID and message are required' });
      return;
    }
    logger.info(`parseChatIntentController userId=${userId} projectId=${projectId}`);
    const intent = await financeAIService.parseChatIntent(userId, projectId, message);
    res.status(200).json(intent);
  } catch (error: any) {
    logger.error(`parseChatIntentController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to parse chat intent' });
  }
};

/**
 * Applique une intention de modification précédemment confirmée.
 * URL: POST /project/finance/:projectId/chat/apply  body: FinanceChatIntent
 */
export const applyChatIntentController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const projectId = req.params.projectId as string;
  try {
    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    if (!projectId) {
      res.status(400).json({ message: 'Project ID is required' });
      return;
    }
    const intent = req.body as FinanceChatIntent;
    if (!intent || !intent.isFinanceIntent || !intent.kind) {
      res.status(400).json({ message: 'Invalid intent payload' });
      return;
    }
    logger.info(
      `applyChatIntentController userId=${userId} projectId=${projectId} kind=${intent.kind}`
    );
    const updated = await financeAIService.applyChatIntent(userId, projectId, intent);
    if (!updated) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }
    res.status(200).json(updated);
  } catch (error: any) {
    logger.error(`applyChatIntentController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to apply chat intent' });
  }
};

/**
 * Génère et télécharge un rapport financier PDF complet.
 * URL: GET /project/finance/:projectId/pdf
 */
export const generateFinancePdfController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const projectId = req.params.projectId as string;
  try {
    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    if (!projectId) {
      res.status(400).json({ message: 'Project ID is required' });
      return;
    }
    logger.info(`generateFinancePdfController userId=${userId} projectId=${projectId}`);
    const pdfPath = await financePdfService.generateFinancePdf(userId, projectId);
    const fs = require('fs-extra');
    const buffer = await fs.readFile(pdfPath);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="rapport-financier-${projectId}.pdf"`
    );
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
    userService.incrementUsage(userId, 2);
  } catch (error: any) {
    logger.error(`generateFinancePdfController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({
      message: error.message || 'Failed to generate finance PDF',
    });
  }
};

/**
 * Supprime totalement les données financières d'un projet.
 */
export const deleteFinanceController = async (req: CustomRequest, res: Response): Promise<void> => {
  const userId = req.user?.uid;
  const projectId = req.params.projectId as string;
  try {
    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    if (!projectId) {
      res.status(400).json({ message: 'Project ID is required' });
      return;
    }
    const ok = await financeService.deleteFinance(userId, projectId);
    if (!ok) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }
    res.status(204).send();
  } catch (error: any) {
    logger.error(`deleteFinanceController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to delete finance data' });
  }
};
