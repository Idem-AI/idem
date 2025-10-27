import { ProjectTeam } from '../auth/project-team.model';

/**
 * Type de projet
 */
export type ProjectType = 'web' | 'mobile' | 'iot' | 'desktop';

/**
 * Membre d'équipe dans le projet (legacy)
 */
export interface TeamMember {
  name: string;
  role: string;
  email: string;
  bio: string;
  pictureUrl?: string;
  socialLinks?: {
    linkedin?: string;
    github?: string;
    twitter?: string;
  };
}

/**
 * Informations additionnelles du projet
 */
export interface ProjectAdditionalInfos {
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  zipCode: string;
  teamMembers: TeamMember[];
}

/**
 * Acceptation des politiques du projet
 */
export interface ProjectPolicyAcceptance {
  privacyPolicyAccepted: boolean;
  termsOfServiceAccepted: boolean;
  betaPolicyAccepted: boolean;
  marketingAccepted: boolean;
  acceptedAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Modèle de projet avec système d'autorisation
 */
export interface ProjectModel {
  id?: string;
  name: string;
  description: string;
  type: ProjectType;
  constraints: string[];
  teamSize: string;
  scope: string;
  budgetIntervals?: string;
  targets: string;

  // Propriétaire et équipes
  userId: string; // Propriétaire du projet
  teams: ProjectTeam[]; // Équipes associées avec leurs rôles

  // Phases et analyse
  selectedPhases: string[];
  analysisResultModel?: any; // À typer selon votre modèle

  // Déploiements et chat
  deployments?: any[]; // À typer selon votre modèle
  activeChatMessages?: any[]; // À typer selon votre modèle

  // Politiques et infos
  policyAcceptance?: ProjectPolicyAcceptance;
  additionalInfos?: ProjectAdditionalInfos;

  // Métadonnées
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

/**
 * DTO pour créer un projet
 */
export interface CreateProjectDTO {
  name: string;
  description: string;
  type: ProjectType;
  constraints: string[];
  teamSize: string;
  scope: string;
  budgetIntervals?: string;
  targets: string;
  selectedPhases: string[];
}

/**
 * DTO pour mettre à jour un projet
 */
export interface UpdateProjectDTO {
  name?: string;
  description?: string;
  type?: ProjectType;
  constraints?: string[];
  teamSize?: string;
  scope?: string;
  budgetIntervals?: string;
  targets?: string;
  selectedPhases?: string[];
  additionalInfos?: Partial<ProjectAdditionalInfos>;
}
