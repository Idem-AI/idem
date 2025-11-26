export interface GitRepositoryDto {
  provider: 'github' | 'gitlab' | 'bitbucket' | 'azure-repos';
  url: string;
  branch: string;
  accessToken?: string;
  webhookId?: string;
}

export interface UpdateGitRepositoryDto {
  url?: string;
  branch?: string;
  accessToken?: string;
}
