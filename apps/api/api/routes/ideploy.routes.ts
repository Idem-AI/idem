import { Router } from 'express';
import { authenticate } from '../services/auth.service';
import {
  getApplicationsController,
  getDatabasesController,
  getServicesController,
  getServersController,
  getProjectsController,
  getSummaryController,
  checkConnectionController,
} from '../controllers/ideploy.controller';

const router = Router();

/**
 * @swagger
 * /api/ideploy/applications:
 *   get:
 *     summary: Récupère toutes les applications iDeploy
 *     tags: [iDeploy]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Liste des applications
 *       401:
 *         description: Non authentifié
 *       500:
 *         description: Erreur serveur
 */
router.get('/applications', authenticate, getApplicationsController);

/**
 * @swagger
 * /api/ideploy/databases:
 *   get:
 *     summary: Récupère toutes les bases de données iDeploy
 *     tags: [iDeploy]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Liste des bases de données
 *       401:
 *         description: Non authentifié
 *       500:
 *         description: Erreur serveur
 */
router.get('/databases', authenticate, getDatabasesController);

/**
 * @swagger
 * /api/ideploy/services:
 *   get:
 *     summary: Récupère tous les services Docker iDeploy
 *     tags: [iDeploy]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Liste des services
 *       401:
 *         description: Non authentifié
 *       500:
 *         description: Erreur serveur
 */
router.get('/services', authenticate, getServicesController);

/**
 * @swagger
 * /api/ideploy/servers:
 *   get:
 *     summary: Récupère tous les serveurs iDeploy
 *     tags: [iDeploy]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Liste des serveurs
 *       401:
 *         description: Non authentifié
 *       500:
 *         description: Erreur serveur
 */
router.get('/servers', authenticate, getServersController);

/**
 * @swagger
 * /api/ideploy/projects:
 *   get:
 *     summary: Récupère tous les projets iDeploy
 *     tags: [iDeploy]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Liste des projets
 *       401:
 *         description: Non authentifié
 *       500:
 *         description: Erreur serveur
 */
router.get('/projects', authenticate, getProjectsController);

/**
 * @swagger
 * /api/ideploy/summary:
 *   get:
 *     summary: Récupère un résumé complet de toutes les ressources iDeploy
 *     tags: [iDeploy]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Résumé complet des ressources
 *       401:
 *         description: Non authentifié
 *       500:
 *         description: Erreur serveur
 */
router.get('/summary', authenticate, getSummaryController);

/**
 * @swagger
 * /api/ideploy/check-connection:
 *   get:
 *     summary: Vérifie la connexion à iDeploy
 *     tags: [iDeploy]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Statut de la connexion
 *       401:
 *         description: Non authentifié
 *       500:
 *         description: Erreur serveur
 */
router.get('/check-connection', authenticate, checkConnectionController);

export default router;
