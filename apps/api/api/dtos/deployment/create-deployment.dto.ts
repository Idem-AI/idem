import { DeploymentModel } from "../../models/deployment.model";

export interface CreateDeploymentDto {
  name: string;
  projectId: string;
  environment: DeploymentModel['environment'];
  description?: string;
  gitRepository?: {
    provider: 'github' | 'gitlab' | 'bitbucket' | 'azure-repos';
    url: string;
    branch: string;
  };
  environmentVariables?: {
    key: string;
    value: string;
    isSecret: boolean;
  }[];
  architectureComponents?: {
    instanceId: string;
    type: string;
    configuration?: { [key: string]: any };
  }[];
  mode?: 'beginner' | 'assistant' | 'template' | 'expert';
  architectureTemplate?: string;
}
