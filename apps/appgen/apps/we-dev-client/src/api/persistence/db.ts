import type { ProjectModel } from './models/project.model';
import type { UserModel } from './userModel';

/**
 * Define the base URL for your API.
 * It's recommended to use an environment variable for this.
 */
const API_BASE_URL = process.env.REACT_APP_IDEM_API_BASE_URL || 'http://localhost:3001';

export async function getCurrentUser(): Promise<UserModel | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/profile`, {
      credentials: 'include',
    });

    if (!response.ok) {
      if (response.status === 401) {
        console.warn('User not authenticated');
        return null;
      }

      console.error('Error fetching current user:', response.statusText);

      return null;
    }

    const user = (await response.json()) as UserModel;
    console.log(user);

    return user;
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
}

async function checkAuth(): Promise<void> {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return Promise.reject(new Error('User not authenticated'));
  }

  return Promise.resolve();
}

export async function getProjectById(projectId: string): Promise<ProjectModel | null> {
  try {
    await checkAuth();

    const response = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      console.warn('Project not found:', projectId);
      return null;
    }

    const project = (await response.json()) as ProjectModel;
    console.log(project);

    return project;
  } catch (error) {
    console.error('Error fetching project:', error);
    throw error;
  }
}

export async function getUserProjects(): Promise<ProjectModel[] | null> {
  try {
    await checkAuth();

    const response = await fetch(`${API_BASE_URL}/projects`, {
      credentials: 'include',
    });

    if (!response.ok) {
      console.error('Error getting projects from API:', response.statusText);
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as ProjectModel[];
  } catch (error) {
    console.error('Error getting projects:', error);
    throw error;
  }
}

// Generation services
export async function getProjectGeneration(projectId: string): Promise<any | null> {
  try {
    await checkAuth();

    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/generation`, {
      credentials: 'include',
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null; // No generation exists
      }
      console.error('Error getting project generation:', response.statusText);
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting project generation:', error);
    throw error;
  }
}

export async function saveProjectGeneration(projectId: string, generationData: any): Promise<void> {
  try {
    await checkAuth();

    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/generation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(generationData),
    });

    if (!response.ok) {
      console.error('Error saving project generation:', response.statusText);
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error saving project generation:', error);
    throw error;
  }
}

export async function sendZipToBackend(projectId: string, zipFile: Blob): Promise<void> {
  try {
    await checkAuth();

    const formData = new FormData();
    formData.append('zip', zipFile, `${projectId}-generation.zip`);

    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/zip`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    if (!response.ok) {
      console.error('Error sending zip to backend:', response.statusText);
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error sending zip to backend:', error);
    throw error;
  }
}

export async function sendToGitHub(projectId: string, githubData: any): Promise<void> {
  try {
    await checkAuth();

    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/github`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(githubData),
    });

    if (!response.ok) {
      console.error('Error sending to GitHub:', response.statusText);
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error sending to GitHub:', error);
    throw error;
  }
}

// Fonction pour récupérer le code existant depuis Firebase Storage
export async function getProjectCodeFromFirebase(
  projectId: string
): Promise<Record<string, string> | null> {
  try {
    await checkAuth();

    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/code`, {
      credentials: 'include',
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Aucun code n'existe pour ce projet
      }
      console.error('Error getting project code:', response.statusText);
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const codeData = await response.json();
    return codeData.files || null;
  } catch (error) {
    console.error('Error getting project code from Firebase:', error);
    return null;
  }
}

// Incremental code storage — the workspace lives in the bucket, addressed by a
// content-hash manifest so an update only pushes the files that changed.

export async function getProjectCodeManifest(
  projectId: string
): Promise<Record<string, string>> {
  try {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/code/manifest`, {
      credentials: 'include',
    });

    if (!response.ok) return {};

    const data = (await response.json()) as { files?: Record<string, string> };
    return data.files || {};
  } catch (error) {
    console.error('Error getting project code manifest:', error);
    return {};
  }
}

export async function syncProjectCode(
  projectId: string,
  payload: {
    upserts: Record<string, string>;
    deletions: string[];
    manifest: Record<string, string>;
  }
): Promise<{ written: number; deleted: number; total: number } | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/code`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error('Error syncing project code:', response.statusText);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error syncing project code:', error);
    return null;
  }
}

// Chat session — the conversation is kept in the database so the user can
// reopen it from any machine.
export interface ProjectChatSession {
  sessionId: string;
  title?: string;
  messages: Array<{ id: string; role: string; content: string }>;
  messageCount?: number;
  startedAt?: string;
  lastMessageAt?: string;
}

export async function getProjectChatSession(
  projectId: string
): Promise<ProjectChatSession | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/chat-session`, {
      credentials: 'include',
    });

    if (!response.ok) return null;

    return (await response.json()) as ProjectChatSession;
  } catch (error) {
    console.error('Error getting project chat session:', error);
    return null;
  }
}

export async function saveProjectChatSession(
  projectId: string,
  session: ProjectChatSession
): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/chat-session`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(session),
    });

    if (!response.ok) {
      console.error('Error saving project chat session:', response.statusText);
    }
  } catch (error) {
    console.error('Error saving project chat session:', error);
  }
}

// Quick deployment (Netlify) tracking — lets a redeploy update the same site
export interface AppDeployment {
  provider?: string;
  siteId: string;
  siteName?: string | null;
  url: string;
  adminUrl?: string | null;
  deployId?: string | null;
  firstDeployedAt?: string;
  lastDeployedAt?: string;
}

export async function getAppDeployment(projectId: string): Promise<AppDeployment | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/app-deployment`, {
      credentials: 'include',
    });

    if (!response.ok) {
      // 404 simply means the project has never been deployed yet.
      return null;
    }

    return (await response.json()) as AppDeployment;
  } catch (error) {
    console.error('Error getting app deployment:', error);
    return null;
  }
}

export async function saveAppDeployment(
  projectId: string,
  deployment: AppDeployment
): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/app-deployment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(deployment),
    });

    if (!response.ok) {
      console.error('Error saving app deployment:', response.statusText);
    }
  } catch (error) {
    console.error('Error saving app deployment:', error);
  }
}
