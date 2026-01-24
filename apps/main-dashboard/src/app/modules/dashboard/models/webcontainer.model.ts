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
  selectedOptions: {
    stack: string;
    seoEnabled: boolean;
    contactFormEnabled: boolean;
    analyticsEnabled: boolean;
    i18nEnabled: boolean;
    performanceOptimized: boolean;
  };
}

export interface CreateWebContainerRequest {
  projectId: string;
  name: string;
  description?: string;
  metadata?: {
    workdirName: string;
    ports?: number[];
    files?: string[];
    fileContents?: Record<string, string>;
    url?: string;
  };
}

export interface UpdateWebContainerRequest {
  status?: 'creating' | 'active' | 'stopped' | 'error';
  metadata?: {
    workdirName?: string;
    ports?: number[];
    files?: string[];
    fileContents?: Record<string, string>;
    url?: string;
    githubUrl?: string;
    lastPushedAt?: string;
  };
}
