/**
 * @openapi
 * components:
 *   schemas:
 *     PolicyAcceptanceModel:
 *       type: object
 *       properties:
 *         userId:
 *           type: string
 *           description: ID de l'utilisateur
 *         projectId:
 *           type: string
 *           description: ID du projet associé
 *         privacyPolicyAccepted:
 *           type: boolean
 *           description: Acceptation de la politique de confidentialité
 *         termsOfServiceAccepted:
 *           type: boolean
 *           description: Acceptation des conditions d'utilisation
 *         betaPolicyAccepted:
 *           type: boolean
 *           description: Acceptation de la politique beta
 *         marketingAccepted:
 *           type: boolean
 *           description: Acceptation du marketing (optionnel)
 *         acceptedAt:
 *           type: string
 *           format: date-time
 *           description: Date d'acceptation
 *         ipAddress:
 *           type: string
 *           description: Adresse IP lors de l'acceptation
 *         userAgent:
 *           type: string
 *           description: User agent lors de l'acceptation
 *       required:
 *         - userId
 *         - projectId
 *         - privacyPolicyAccepted
 *         - termsOfServiceAccepted
 *         - betaPolicyAccepted
 *         - marketingAccepted
 *         - acceptedAt
 */

export interface PolicyAcceptanceModel {
  userId: string;
  projectId: string;
  privacyPolicyAccepted: boolean;
  termsOfServiceAccepted: boolean;
  betaPolicyAccepted: boolean;
  marketingAccepted: boolean; // Optionnel mais requis dans l'interface (peut être false)
  acceptedAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * DTO pour la finalisation du projet avec acceptation des politiques
 */
export interface FinalizeProjectRequest {
  privacyPolicyAccepted: boolean;
  termsOfServiceAccepted: boolean;
  betaPolicyAccepted: boolean;
  marketingAccepted?: boolean; // Optionnel
}

/**
 * @openapi
 * components:
 *   schemas:
 *     FinalizeProjectResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           description: Indique si la finalisation a réussi
 *         message:
 *           type: string
 *           description: Message de confirmation
 *         projectId:
 *           type: string
 *           description: ID du projet finalisé
 *         acceptedAt:
 *           type: string
 *           format: date-time
 *           description: Date et heure d'acceptation des politiques
 *       required:
 *         - success
 *         - message
 *         - projectId
 *         - acceptedAt
 */

/**
 * Réponse de la finalisation du projet
 */
export interface FinalizeProjectResponse {
  success: boolean;
  message: string;
  projectId: string;
  acceptedAt: Date;
}
