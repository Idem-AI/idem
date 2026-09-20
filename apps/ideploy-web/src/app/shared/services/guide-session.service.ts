import { Injectable, signal } from '@angular/core';
import { GuideStepRole } from '../data/architecture-templates';

/**
 * Carries what one step of an architecture guide actually produced into the
 * next one, so "deploy your backend" can be handed the database this guide
 * just created instead of asking the operator to go copy a connection
 * string by hand — see `architecture-templates.ts`'s module doc for why
 * this exists and how narrow the auto-fill it enables deliberately is.
 *
 * Session-scoped (`sessionStorage`, not a server-side record): this is
 * orientation for one visit through the guide, not a resource the platform
 * itself needs to remember — the database and the apps it links are real,
 * independently-existing resources on their own pages the moment they're
 * created; this is only the thread connecting them while the guide is open.
 */
export interface GuideLinkedDatabase {
  uuid: string;
  type: string;
  name: string;
  /** Internal connection string (`postgres://…@host:port/db`) — what a co-located app should actually use, not the public one. */
  connectionUrl: string | null;
}

export interface GuideLinkedApp {
  uuid: string;
  name: string;
  /** The app's own reachable URL, once deployed — what a later `frontend` step's API-URL variable gets filled with. */
  publicUrl: string | null;
  role?: GuideStepRole;
}

interface GuideState {
  architectureId: string;
  workspaceUuid: string | null;
  workspaceName: string | null;
  database: GuideLinkedDatabase | null;
  /** A 3-tier/monolith/api+db step can add a Redis cache alongside the primary database — tracked separately so `REDIS_URL` never links to the SQL database or vice-versa. */
  cache: GuideLinkedDatabase | null;
  /** Every `import-app` step's deploy, in the order they completed — used both to find "the backend" (role-filtered) and, role-agnostic, to know how many `import-app` steps are genuinely done. */
  apps: GuideLinkedApp[];
}

const STORAGE_KEY = 'ideploy_guide_session';

@Injectable({ providedIn: 'root' })
export class GuideSessionService {
  private readonly state = signal<GuideState | null>(this.load());

  private load(): GuideState | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as GuideState) : null;
    } catch {
      return null;
    }
  }

  private persist(next: GuideState | null): void {
    this.state.set(next);
    try {
      if (next) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* private browsing / storage disabled — session just won't survive navigation */
    }
  }

  /** Only a session actually started for this exact architecture counts — a leftover session from a different guide names nothing this one created. */
  private active(architectureId: string): GuideState | null {
    const s = this.state();
    return s && s.architectureId === architectureId ? s : null;
  }

  /** Whether any session — finished or not — exists for this architecture, so a caller can decide whether to resume it or discard it first. */
  hasSession(architectureId: string): boolean {
    return this.active(architectureId) !== null;
  }

  database(architectureId: string): GuideLinkedDatabase | null {
    return this.active(architectureId)?.database ?? null;
  }

  cache(architectureId: string): GuideLinkedDatabase | null {
    return this.active(architectureId)?.cache ?? null;
  }

  workspace(architectureId: string): { uuid: string; name: string } | null {
    const s = this.active(architectureId);
    return s?.workspaceUuid ? { uuid: s.workspaceUuid, name: s.workspaceName ?? '' } : null;
  }

  /** The most recently deployed `backend`-role app — what a `frontend` step's API-URL variable is filled with. */
  latestBackend(architectureId: string): GuideLinkedApp | null {
    const apps = (this.active(architectureId)?.apps ?? []).filter((a) => a.role === 'backend');
    return apps.length > 0 ? apps[apps.length - 1] : null;
  }

  /** How many `import-app` steps (any role) have genuinely completed — used to mark the Nth such step done, in order. */
  appCount(architectureId: string): number {
    return this.active(architectureId)?.apps.length ?? 0;
  }

  /** The app linked by the Nth `import-app` step (0-based, document order) — for a step's own done-card, not for auto-fill. */
  appAt(architectureId: string, index: number): GuideLinkedApp | null {
    return this.active(architectureId)?.apps[index] ?? null;
  }

  /** Starts a fresh session, or does nothing if one for this same architecture is already in progress — a step already linked stays linked on a back-navigation. */
  start(architectureId: string, workspaceUuid: string | null): void {
    if (this.active(architectureId)) return;
    this.persist({ architectureId, workspaceUuid, workspaceName: null, database: null, cache: null, apps: [] });
  }

  setWorkspace(architectureId: string, uuid: string, name: string): void {
    const current = this.active(architectureId);
    if (!current) return;
    this.persist({ ...current, workspaceUuid: uuid, workspaceName: name });
  }

  linkDatabase(architectureId: string, db: GuideLinkedDatabase): void {
    const current = this.active(architectureId);
    if (!current) return;
    this.persist({ ...current, database: db });
  }

  linkCache(architectureId: string, db: GuideLinkedDatabase): void {
    const current = this.active(architectureId);
    if (!current) return;
    this.persist({ ...current, cache: db });
  }

  linkApp(architectureId: string, app: GuideLinkedApp): void {
    const current = this.active(architectureId);
    if (!current) return;
    this.persist({ ...current, apps: [...current.apps, app] });
  }

  clear(): void {
    this.persist(null);
  }
}
