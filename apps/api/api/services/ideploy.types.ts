/**
 * Formes des données iDeploy.
 *
 * Le client HTTP qui les récupérait a été remplacé par `ideploy-pg.service.ts`,
 * qui lit directement la base d'iDeploy : il ne reste ici que les types, que
 * ce service et les contrôleurs partagent.
 */

/**
 * Interface pour les applications iDeploy
 */
export interface IDeployApplication {
  id: number;
  uuid: string;
  name: string;
  status: string;
  fqdn: string | null;
  git_repository: string | null;
  git_branch: string | null;
  build_pack: string;
  environment_id: number;
  last_online_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Interface pour les bases de données iDeploy
 */
export interface IDeployDatabase {
  id: number;
  uuid: string;
  name: string;
  status: string;
  type: string;
  environment_id: number;
  created_at: string;
  updated_at: string;
}

/**
 * Interface pour les services Docker iDeploy
 */
export interface IDeployDockerService {
  id: number;
  uuid: string;
  name: string;
  status: string;
  environment_id: number;
  created_at: string;
  updated_at: string;
}

/**
 * Interface pour les serveurs iDeploy
 */
export interface IDeployServer {
  id: number;
  uuid: string;
  name: string;
  ip: string;
  is_reachable: boolean;
  is_usable: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Interface pour les projets iDeploy
 */
export interface IDeployProject {
  id: number;
  uuid: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Interface pour le résumé iDeploy
 */
export interface IDeploySummary {
  applications: IDeployApplication[];
  databases: IDeployDatabase[];
  services: IDeployDockerService[];
  servers: IDeployServer[];
  projects: IDeployProject[];
  stats: {
    totalApplications: number;
    totalDatabases: number;
    totalServices: number;
    totalServers: number;
    totalProjects: number;
    runningApplications: number;
  };
}
