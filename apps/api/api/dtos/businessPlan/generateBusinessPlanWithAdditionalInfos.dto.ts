/**
 * @openapi
 * components:
 *   schemas:
 *     GenerateBusinessPlanWithAdditionalInfosDto:
 *       type: object
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           description: Email de contact de l'entreprise
 *         phone:
 *           type: string
 *           description: Numéro de téléphone de l'entreprise
 *         address:
 *           type: string
 *           description: Adresse de l'entreprise
 *         city:
 *           type: string
 *           description: Ville de l'entreprise
 *         country:
 *           type: string
 *           description: Pays de l'entreprise
 *         zipCode:
 *           type: string
 *           description: Code postal de l'entreprise
 *         teamMembers:
 *           type: string
 *           description: JSON string contenant les informations des membres de l'équipe (sans les images)
 *           example: '[{"name":"John Doe","role":"CEO","email":"john@example.com","bio":"Experienced leader","socialLinks":{"linkedin":"https://linkedin.com/in/johndoe"}}]'
 *       required:
 *         - email
 *         - teamMembers
 */
export interface GenerateBusinessPlanWithAdditionalInfosDto {
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  zipCode?: string;
  teamMembers: string; // JSON string car les fichiers seront séparés
}

/**
 * Interface pour les team members après parsing du JSON
 */
export interface TeamMemberInput {
  name: string;
  role: string;
  email: string;
  bio: string;
  socialLinks?: {
    linkedin?: string;
    github?: string;
    twitter?: string;
  };
}

/**
 * Interface pour la réponse de génération de business plan
 */
export interface GenerateBusinessPlanResponse {
  success: boolean;
  message: string;
  businessPlan?: any;
  uploadedImages?: {
    [memberIndex: number]: {
      fileName: string;
      downloadURL: string;
    };
  };
}
