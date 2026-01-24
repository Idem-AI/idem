/**
 * GitHub Integration DTOs
 */

export interface GitHubOAuthRequest {
  code: string;
  state?: string;
}

export interface GitHubOAuthResponse {
  success: boolean;
  message: string;
  user?: {
    username: string;
    avatarUrl: string;
    email: string;
  };
}

export interface PushToGitHubRequest {
  repositoryName: string;
  description?: string;
  isPrivate?: boolean;
  files?: Record<string, string>; // Optional override files
  commitMessage?: string;
}

export interface PushToGitHubResponse {
  success: boolean;
  message: string;
  repositoryUrl?: string;
  repositoryName?: string;
  owner?: string;
  pushedFiles?: string[];
}

export interface GitHubRepositoryInfo {
  name: string;
  fullName: string;
  description: string;
  private: boolean;
  htmlUrl: string;
  cloneUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface GitHubUserInfo {
  username: string;
  email: string;
  name: string;
  avatarUrl: string;
  publicRepos: number;
  followers: number;
  following: number;
}
