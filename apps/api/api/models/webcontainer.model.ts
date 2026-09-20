export interface WebContainerModel {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  status: 'creating' | 'active' | 'stopped' | 'error';
  createdAt: string;
  updatedAt: string;
  metadata?: {
    workdirName: string;
    ports?: number[];
    files?: string[];
    fileContents?: Record<string, string>;
    url?: string;
    githubUrl?: string;
    lastPushedAt?: string;
  };
  userId: string;
}
