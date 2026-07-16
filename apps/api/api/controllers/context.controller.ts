import { Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import logger from '../config/logger';
import { contextEngineService } from '../services/context-engine/context-engine.service';
import { versionHistoryService } from '../services/history/version-history.service';
import { isSectionKey, ALL_SECTION_KEYS } from '../services/context-engine/context-registry';

function requireAuth(req: CustomRequest, res: Response): string | null {
  const userId = req.user?.uid;
  if (!userId) {
    res.status(401).json({ message: 'User not authenticated' });
    return null;
  }
  return userId;
}

function parseSection(value: string, res: Response): string | null {
  if (!isSectionKey(value)) {
    res.status(400).json({
      message: `Section inconnue "${value}". Sections valides: ${ALL_SECTION_KEYS.join(', ')}`,
    });
    return null;
  }
  return value;
}

/** GET /project/context/:projectId/map — carte compacte du projet. */
export const getProjectMapController = async (req: CustomRequest, res: Response): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const { projectId } = req.params;
  try {
    const map = await contextEngineService.getProjectMap(userId, projectId as string);
    res.status(200).json(map);
  } catch (error: any) {
    logger.error(`getProjectMapController error: ${error.message}`);
    res.status(error.message?.includes('introuvable') ? 404 : 500).json({ message: error.message });
  }
};

/** GET /project/context/:projectId/section/:section?detail=&path= */
export const getSectionController = async (req: CustomRequest, res: Response): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const { projectId, section } = req.params;
  try {
    const detail = req.query.detail === 'full' ? 'full' : 'summary';
    const path = req.query.path ? String(req.query.path) : undefined;
    const data = await contextEngineService.getSection(
      userId,
      projectId as string,
      section as string,
      detail,
      path
    );
    res.status(200).json(data);
  } catch (error: any) {
    logger.error(`getSectionController error: ${error.message}`);
    res.status(error.message?.includes('inconnue') ? 400 : 500).json({ message: error.message });
  }
};

/** GET /project/context/:projectId/search?q= */
export const searchProjectController = async (req: CustomRequest, res: Response): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const { projectId } = req.params;
  try {
    const matches = await contextEngineService.searchProject(
      userId,
      projectId as string,
      String(req.query.q ?? '')
    );
    res.status(200).json({ query: req.query.q, matches });
  } catch (error: any) {
    logger.error(`searchProjectController error: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
};

/** GET /project/history/:projectId?section=&limit= — git log. */
export const getHistoryLogController = async (req: CustomRequest, res: Response): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const { projectId } = req.params;
  try {
    const sectionParam = req.query.section ? String(req.query.section) : undefined;
    if (sectionParam && !parseSection(sectionParam, res)) return;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const entries = await versionHistoryService.log(projectId as string, {
      section: sectionParam as any,
      limit,
    });
    res.status(200).json({ projectId, entries });
  } catch (error: any) {
    logger.error(`getHistoryLogController error: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
};

/** GET /project/history/:projectId/:section/version/:version — git show. */
export const getVersionController = async (req: CustomRequest, res: Response): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const { projectId, section, version } = req.params;
  try {
    if (!parseSection(section as string, res)) return;
    const versionNumber = Number(version);
    if (!Number.isInteger(versionNumber) || versionNumber < 1) {
      res.status(400).json({ message: `Version invalide "${version}"` });
      return;
    }
    const state = await versionHistoryService.show(
      projectId as string,
      section as any,
      versionNumber
    );
    res.status(200).json({ projectId, section, version: versionNumber, state });
  } catch (error: any) {
    logger.error(`getVersionController error: ${error.message}`);
    res.status(error.message?.includes('Aucun snapshot') ? 404 : 500).json({ message: error.message });
  }
};

/** GET /project/history/:projectId/:section/diff?from=&to= — git diff. */
export const getDiffController = async (req: CustomRequest, res: Response): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const { projectId, section } = req.params;
  try {
    if (!parseSection(section as string, res)) return;
    const from = Number(req.query.from);
    const to = Number(req.query.to);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < 1) {
      res.status(400).json({ message: 'Paramètres "from" et "to" requis (entiers ≥ 1).' });
      return;
    }
    const diff = await versionHistoryService.diff(projectId as string, section as any, from, to);
    res.status(200).json(diff);
  } catch (error: any) {
    logger.error(`getDiffController error: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
};

/** GET /project/history/:projectId/:section/at?date= — état à une date. */
export const getStateAtDateController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const { projectId, section } = req.params;
  try {
    if (!parseSection(section as string, res)) return;
    const date = new Date(String(req.query.date ?? ''));
    if (Number.isNaN(date.getTime())) {
      res.status(400).json({ message: `Date invalide "${req.query.date}" (ISO 8601 attendu).` });
      return;
    }
    const result = await versionHistoryService.stateAt(projectId as string, section as any, date);
    if (!result) {
      res.status(404).json({
        message: `La section "${section}" n'existait pas encore au ${date.toISOString()}.`,
      });
      return;
    }
    res.status(200).json({ projectId, section, date: date.toISOString(), ...result });
  } catch (error: any) {
    logger.error(`getStateAtDateController error: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
};

/** POST /project/history/:projectId/:section/restore { version } — git revert-style. */
export const restoreVersionController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const { projectId, section } = req.params;
  try {
    if (!parseSection(section as string, res)) return;
    const version = Number(req.body?.version);
    if (!Number.isInteger(version) || version < 1) {
      res.status(400).json({ message: 'Corps attendu: { "version": <entier ≥ 1> }' });
      return;
    }
    const result = await contextEngineService.restoreSection(
      userId,
      projectId as string,
      section as string,
      version
    );
    res.status(200).json({
      message: `Section "${result.section}" restaurée à la version ${result.restoredVersion}.`,
      ...result,
    });
  } catch (error: any) {
    logger.error(`restoreVersionController error: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
};
