import { Router } from 'express';
import { authenticate } from '../services/auth.service';
import { createHandoffController, getHandoffController } from '../controllers/appgen.controller';

const router = Router();

/**
 * @swagger
 * /appgen/handoff:
 *   post:
 *     summary: Crée un handoff AppGen vers iDeploy
 *     tags: [AppGen]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [files]
 *             properties:
 *               draftId:
 *                 type: string
 *               appName:
 *                 type: string
 *               description:
 *                 type: string
 *               files:
 *                 type: object
 *               metadata:
 *                 type: object
 *               messages:
 *                 type: array
 *     responses:
 *       201:
 *         description: Handoff créé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 handoffId:
 *                   type: string
 *       400:
 *         description: Données invalides
 *       401:
 *         description: Non authentifié
 *       500:
 *         description: Erreur serveur
 */
router.post('/handoff', authenticate, createHandoffController);

/**
 * @swagger
 * /appgen/handoff/{handoffId}:
 *   get:
 *     summary: Récupère un handoff AppGen par son ID
 *     tags: [AppGen]
 *     parameters:
 *       - in: path
 *         name: handoffId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Handoff trouvé
 *       404:
 *         description: Handoff non trouvé ou expiré
 *       500:
 *         description: Erreur serveur
 */
router.get('/handoff/:handoffId', getHandoffController);

export default router;
