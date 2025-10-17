import { DeploymentModel } from "../../models/deployment.model";

export interface UpdateDeploymentDto {
  name?: string;
  description?: string;
  environment?: DeploymentModel['environment'];
  gitRepository?: {
    provider: 'github' | 'gitlab' | 'bitbucket' | 'azure-repos';
    url: string;
    branch: string;
    accessToken?: string;
    webhookId?: string;
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
  chatMessages?: {
    sender: 'user' | 'ai';
    text: string;
  }[];
}
