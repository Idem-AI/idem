import { Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { ideployService } from '../services/ideploy.service';
import logger from '../config/logger';

/**
 * Récupère toutes les applications iDeploy
 */
export const getApplicationsController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;

  logger.info('Fetching iDeploy applications', { userId });

  try {
    const applications = await ideployService.getApplications();

    res.status(200).json({
      success: true,
      data: applications,
    });
  } catch (error: any) {
    logger.error('Error in getApplicationsController:', {
      userId,
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch applications from iDeploy',
      error: error.message,
    });
  }
};

/**
 * Récupère toutes les bases de données iDeploy
 */
export const getDatabasesController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;

  logger.info('Fetching iDeploy databases', { userId });

  try {
    const databases = await ideployService.getDatabases();

    res.status(200).json({
      success: true,
      data: databases,
    });
  } catch (error: any) {
    logger.error('Error in getDatabasesController:', {
      userId,
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch databases from iDeploy',
      error: error.message,
    });
  }
};

/**
 * Récupère tous les services Docker iDeploy
 */
export const getServicesController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;

  logger.info('Fetching iDeploy services', { userId });

  try {
    const services = await ideployService.getServices();

    res.status(200).json({
      success: true,
      data: services,
    });
  } catch (error: any) {
    logger.error('Error in getServicesController:', {
      userId,
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch services from iDeploy',
      error: error.message,
    });
  }
};

/**
 * Récupère tous les serveurs iDeploy
 */
export const getServersController = async (req: CustomRequest, res: Response): Promise<void> => {
  const userId = req.user?.uid;

  logger.info('Fetching iDeploy servers', { userId });

  try {
    const servers = await ideployService.getServers();

    res.status(200).json({
      success: true,
      data: servers,
    });
  } catch (error: any) {
    logger.error('Error in getServersController:', {
      userId,
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch servers from iDeploy',
      error: error.message,
    });
  }
};

/**
 * Récupère tous les projets iDeploy
 */
export const getProjectsController = async (req: CustomRequest, res: Response): Promise<void> => {
  const userId = req.user?.uid;

  logger.info('Fetching iDeploy projects', { userId });

  try {
    const projects = await ideployService.getProjects();

    res.status(200).json({
      success: true,
      data: projects,
    });
  } catch (error: any) {
    logger.error('Error in getProjectsController:', {
      userId,
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch projects from iDeploy',
      error: error.message,
    });
  }
};

/**
 * Récupère un résumé complet de toutes les ressources iDeploy
 */
export const getSummaryController = async (req: CustomRequest, res: Response): Promise<void> => {
  const userId = req.user?.uid;

  logger.info('Fetching iDeploy summary', { userId });

  try {
    const summary = await ideployService.getSummary();

    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    logger.error('Error in getSummaryController:', {
      userId,
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch summary from iDeploy',
      error: error.message,
    });
  }
};

/**
 * Vérifie la connexion à iDeploy
 */
export const checkConnectionController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;

  logger.info('Checking iDeploy connection', { userId });

  try {
    const isConnected = await ideployService.checkConnection();

    res.status(200).json({
      success: true,
      connected: isConnected,
    });
  } catch (error: any) {
    logger.error('Error in checkConnectionController:', {
      userId,
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      message: 'Failed to check iDeploy connection',
      error: error.message,
    });
  }
};
