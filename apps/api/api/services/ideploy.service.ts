import axios, { AxiosInstance } from 'axios';
import logger from '../config/logger';

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

/**
 * Service pour interagir avec l'API iDeploy
 */
class IDeployService {
  private readonly client: AxiosInstance;
  private readonly baseUrl: string;
  private readonly apiToken: string;

  constructor() {
    this.baseUrl = process.env.IDEPLOY_URL || 'http://localhost:8000';
    this.apiToken = process.env.IDEPLOY_API_TOKEN || '';

    if (!this.apiToken) {
      logger.warn('IDEPLOY_API_TOKEN not configured. iDeploy integration will not work.');
    }

    this.client = axios.create({
      baseURL: `${this.baseUrl}/api/v1`,
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        Accept: 'application/json',
      },
      timeout: 10000,
    });

    logger.info('iDeploy service initialized', {
      baseUrl: this.baseUrl,
      hasToken: !!this.apiToken,
    });
  }

  /**
   * Récupère toutes les applications
   */
  async getApplications(): Promise<IDeployApplication[]> {
    try {
      logger.info('Fetching applications from iDeploy');
      const response = await this.client.get<IDeployApplication[]>('/applications');
      logger.info(`Successfully fetched ${response.data.length} applications from iDeploy`);
      return response.data;
    } catch (error: any) {
      logger.error('Error fetching applications from iDeploy:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      return [];
    }
  }

  /**
   * Récupère toutes les bases de données
   */
  async getDatabases(): Promise<IDeployDatabase[]> {
    try {
      logger.info('Fetching databases from iDeploy');
      const response = await this.client.get<IDeployDatabase[]>('/databases');
      logger.info(`Successfully fetched ${response.data.length} databases from iDeploy`);
      return response.data;
    } catch (error: any) {
      logger.error('Error fetching databases from iDeploy:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      return [];
    }
  }

  /**
   * Récupère tous les services Docker
   */
  async getServices(): Promise<IDeployDockerService[]> {
    try {
      logger.info('Fetching services from iDeploy');
      const response = await this.client.get<IDeployDockerService[]>('/services');
      logger.info(`Successfully fetched ${response.data.length} services from iDeploy`);
      return response.data;
    } catch (error: any) {
      logger.error('Error fetching services from iDeploy:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      return [];
    }
  }

  /**
   * Récupère tous les serveurs
   */
  async getServers(): Promise<IDeployServer[]> {
    try {
      logger.info('Fetching servers from iDeploy');
      const response = await this.client.get<IDeployServer[]>('/servers');
      logger.info(`Successfully fetched ${response.data.length} servers from iDeploy`);
      return response.data;
    } catch (error: any) {
      logger.error('Error fetching servers from iDeploy:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      return [];
    }
  }

  /**
   * Récupère tous les projets
   */
  async getProjects(): Promise<IDeployProject[]> {
    try {
      logger.info('Fetching projects from iDeploy');
      const response = await this.client.get<IDeployProject[]>('/projects');
      logger.info(`Successfully fetched ${response.data.length} projects from iDeploy`);
      return response.data;
    } catch (error: any) {
      logger.error('Error fetching projects from iDeploy:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      return [];
    }
  }

  /**
   * Récupère un résumé complet de toutes les ressources iDeploy
   */
  async getSummary(): Promise<IDeploySummary> {
    try {
      logger.info('Fetching complete summary from iDeploy');

      const [applications, databases, services, servers, projects] = await Promise.all([
        this.getApplications(),
        this.getDatabases(),
        this.getServices(),
        this.getServers(),
        this.getProjects(),
      ]);

      const summary: IDeploySummary = {
        applications: applications.sort(
          (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        ),
        databases,
        services,
        servers,
        projects,
        stats: {
          totalApplications: applications.length,
          totalDatabases: databases.length,
          totalServices: services.length,
          totalServers: servers.length,
          totalProjects: projects.length,
          runningApplications: applications.filter((a) =>
            a.status?.toLowerCase().startsWith('running')
          ).length,
        },
      };

      logger.info('Successfully fetched iDeploy summary', {
        totalApplications: summary.stats.totalApplications,
        totalDatabases: summary.stats.totalDatabases,
        totalServices: summary.stats.totalServices,
        totalServers: summary.stats.totalServers,
        totalProjects: summary.stats.totalProjects,
        runningApplications: summary.stats.runningApplications,
      });

      return summary;
    } catch (error: any) {
      logger.error('Error fetching iDeploy summary:', {
        message: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Vérifie la connexion à iDeploy
   */
  async checkConnection(): Promise<boolean> {
    try {
      await this.client.get('/applications');
      return true;
    } catch (error) {
      return false;
    }
  }
}

export const ideployService = new IDeployService();
