import { Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { getIDeploySummaryForUser, checkIDeployPgConnection } from '../services/ideploy-pg.service';
import logger from '../config/logger';

export const getApplicationsController = async (req: CustomRequest, res: Response): Promise<void> => {
  const email = req.user?.email;
  if (!email) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }
  try {
    const summary = await getIDeploySummaryForUser(email);
    res.status(200).json({ success: true, data: summary.applications });
  } catch (error: any) {
    logger.error('getApplicationsController error', { email, message: error.message });
    res.status(500).json({ success: false, message: 'Failed to fetch applications' });
  }
};

export const getDatabasesController = async (req: CustomRequest, res: Response): Promise<void> => {
  const email = req.user?.email;
  if (!email) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }
  try {
    const summary = await getIDeploySummaryForUser(email);
    res.status(200).json({ success: true, data: summary.databases });
  } catch (error: any) {
    logger.error('getDatabasesController error', { email, message: error.message });
    res.status(500).json({ success: false, message: 'Failed to fetch databases' });
  }
};

export const getServicesController = async (req: CustomRequest, res: Response): Promise<void> => {
  const email = req.user?.email;
  if (!email) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }
  try {
    const summary = await getIDeploySummaryForUser(email);
    res.status(200).json({ success: true, data: summary.services });
  } catch (error: any) {
    logger.error('getServicesController error', { email, message: error.message });
    res.status(500).json({ success: false, message: 'Failed to fetch services' });
  }
};

export const getServersController = async (req: CustomRequest, res: Response): Promise<void> => {
  const email = req.user?.email;
  if (!email) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }
  try {
    const summary = await getIDeploySummaryForUser(email);
    res.status(200).json({ success: true, data: summary.servers });
  } catch (error: any) {
    logger.error('getServersController error', { email, message: error.message });
    res.status(500).json({ success: false, message: 'Failed to fetch servers' });
  }
};

export const getProjectsController = async (req: CustomRequest, res: Response): Promise<void> => {
  const email = req.user?.email;
  if (!email) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }
  try {
    const summary = await getIDeploySummaryForUser(email);
    res.status(200).json({ success: true, data: summary.projects });
  } catch (error: any) {
    logger.error('getProjectsController error', { email, message: error.message });
    res.status(500).json({ success: false, message: 'Failed to fetch projects' });
  }
};

export const getSummaryController = async (req: CustomRequest, res: Response): Promise<void> => {
  const email = req.user?.email;
  if (!email) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }
  try {
    logger.info('Fetching iDeploy summary', { email });
    const summary = await getIDeploySummaryForUser(email);
    res.status(200).json({ success: true, data: summary });
  } catch (error: any) {
    logger.error('getSummaryController error', { email, message: error.message });
    res.status(500).json({ success: false, message: 'Failed to fetch iDeploy summary' });
  }
};

export const checkConnectionController = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const isConnected = await checkIDeployPgConnection();
    res.status(200).json({ success: true, connected: isConnected });
  } catch (error: any) {
    logger.error('checkConnectionController error', { message: error.message });
    res.status(500).json({ success: false, message: 'Failed to check iDeploy connection' });
  }
};
