import { Router } from "express";
import {
  finalizeProjectController,
  checkPolicyStatusController,
  getUserPolicyAcceptancesController,
} from "../controllers/policy.controller";
import { authenticate } from "../services/auth.service";

const router = Router();

/**
 * @openapi
 * /project/finalize/{projectId}:
 *   post:
 *     summary: Finalise un projet en acceptant les politiques
 *     description: Enregistre l'acceptation des politiques de confidentialité, conditions d'utilisation, politique beta et marketing (optionnel)
 *     tags: [Policy]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du projet à finaliser
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - privacyPolicyAccepted
 *               - termsOfServiceAccepted
 *               - betaPolicyAccepted
 *             properties:
 *               privacyPolicyAccepted:
 *                 type: boolean
 *                 description: Acceptation de la politique de confidentialité
 *               termsOfServiceAccepted:
 *                 type: boolean
 *                 description: Acceptation des conditions d'utilisation
 *               betaPolicyAccepted:
 *                 type: boolean
 *                 description: Acceptation de la politique beta
 *               marketingAccepted:
 *                 type: boolean
 *                 description: Acceptation du marketing (optionnel)
 *                 default: false
 *     responses:
 *       200:
 *         description: Projet finalisé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FinalizeProjectResponse'
 *       400:
 *         description: Données d'acceptation invalides
 *       401:
 *         description: Non authentifié
 *       409:
 *         description: Projet déjà finalisé
 *       500:
 *         description: Erreur serveur
 */
router.post("/finalize/:projectId", authenticate, finalizeProjectController);

/**
 * @openapi
 * /project/{projectId}/policy-status:
 *   get:
 *     summary: Vérifie le statut d'acceptation des politiques
 *     description: Retourne si l'utilisateur a accepté les politiques pour ce projet
 *     tags: [Policy]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du projet
 *     responses:
 *       200:
 *         description: Statut des politiques
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 projectId:
 *                   type: string
 *                 isFinalized:
 *                   type: boolean
 *                 acceptance:
 *                   $ref: '#/components/schemas/PolicyAcceptanceModel'
 *       401:
 *         description: Non authentifié
 *       500:
 *         description: Erreur serveur
 */
router.get(
  "/project/:projectId/policy-status",
  authenticate,
  checkPolicyStatusController
);

/**
 * @openapi
 * /policy/acceptances:
 *   get:
 *     summary: Récupère toutes les acceptations de politiques de l'utilisateur
 *     description: Retourne la liste de toutes les acceptations de politiques pour l'utilisateur connecté
 *     tags: [Policy]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des acceptations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userId:
 *                   type: string
 *                 acceptances:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PolicyAcceptanceModel'
 *                 count:
 *                   type: number
 *       401:
 *         description: Non authentifié
 *       500:
 *         description: Erreur serveur
 */
router.get(
  "/policy/acceptances",
  authenticate,
  getUserPolicyAcceptancesController
);

export default router;
