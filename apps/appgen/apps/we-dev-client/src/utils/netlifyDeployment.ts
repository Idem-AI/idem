import {
  getAppDeployment,
  saveAppDeployment,
  type AppDeployment,
} from '@/api/persistence/db';

const STORAGE_PREFIX = 'appgen:netlify:';

/**
 * Key used for the local cache. A generation linked to an idem project is keyed
 * by projectId; a standalone draft falls back to its draft id.
 */
const storageKey = (scopeId: string) => `${STORAGE_PREFIX}${scopeId}`;

function readLocal(scopeId: string): AppDeployment | null {
  try {
    const raw = localStorage.getItem(storageKey(scopeId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppDeployment;
    return parsed?.siteId ? parsed : null;
  } catch {
    return null;
  }
}

function writeLocal(scopeId: string, deployment: AppDeployment): void {
  try {
    localStorage.setItem(storageKey(scopeId), JSON.stringify(deployment));
  } catch (error) {
    console.warn('Unable to cache the Netlify deployment locally:', error);
  }
}

/**
 * Returns the Netlify site previously deployed for this generation, so the next
 * deploy updates that site instead of creating a new one.
 * Reads the API first (source of truth, shared with the dashboard) and falls
 * back to the local cache for anonymous drafts or when the API is unreachable.
 */
export async function loadDeployment(
  projectId: string | null,
  draftId?: string | null
): Promise<AppDeployment | null> {
  if (projectId) {
    const remote = await getAppDeployment(projectId);
    if (remote?.siteId) {
      writeLocal(projectId, remote);
      return remote;
    }
    const local = readLocal(projectId);
    if (local) return local;
  }

  return draftId ? readLocal(draftId) : null;
}

/**
 * Persists the deployed site: locally always, and on the idem API when the
 * generation is attached to a project (so the dashboard can show the link).
 */
export async function persistDeployment(
  projectId: string | null,
  draftId: string | null | undefined,
  deployment: AppDeployment
): Promise<void> {
  if (draftId) writeLocal(draftId, deployment);
  if (projectId) {
    writeLocal(projectId, deployment);
    await saveAppDeployment(projectId, deployment);
  }
}

export type { AppDeployment };
