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

export interface IDeployDockerService {
  id: number;
  uuid: string;
  name: string;
  status: string;
  environment_id: number;
  created_at: string;
  updated_at: string;
}

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

export interface IDeployProject {
  id: number;
  uuid: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface IDeployEnvironment {
  id: number;
  uuid: string;
  name: string;
}

export interface IDeployProjectCard {
  uuid: string;
  name: string;
  description: string | null;
  total: number;
  active: number;
  inactive: number;
  hasApps: boolean;
  hasDatabases: boolean;
  hasServices: boolean;
  environmentNames: string[];
  lastUpdated: string | null;
}

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
