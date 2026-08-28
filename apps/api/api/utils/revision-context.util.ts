import { AsyncLocalStorage } from 'async_hooks';
import { NextFunction, Request, Response } from 'express';

/**
 * Who (and what) is behind a project write. Seeded per request by the
 * revision-context middleware, refined by AI services when they persist
 * generated content. Read by the versioning hook in MongooseRepository so every
 * revision records its author (human vs AI) and its origin — the "git blame"
 * of project data.
 */
export type RevisionAuthorType = 'user' | 'ai' | 'system';

export interface RevisionContext {
  authorType: RevisionAuthorType;
  /** Feature/route at the origin of the write, e.g. "POST /project/branding/generate". */
  source: string;
  /** Optional human message describing the change (like a commit message). */
  note?: string;
  /**
   * When true, the versioning hook must NOT schedule a Coherence Guard audit
   * for this write. Set explicitly by code that is ITSELF the result of
   * applying a coherence proposal (e.g. CoherenceService.applyProposal before
   * calling financeAIService.autoFillAll) — an explicit flag rather than
   * matching the request path against a naming convention, so it stays
   * correct regardless of which route ends up performing the write.
   */
  suppressCoherenceTrigger?: boolean;
}

const storage = new AsyncLocalStorage<RevisionContext>();

export function runWithRevisionContext<T>(context: RevisionContext, fn: () => T): T {
  return storage.run(context, fn);
}

/** Current request's revision context, or undefined outside a request. */
export function getRevisionContext(): RevisionContext | undefined {
  return storage.getStore();
}

/**
 * Mark subsequent project writes in this request as AI-authored (called by
 * generation services right before persisting model output).
 */
export function markRevisionAsAI(note?: string): void {
  const store = storage.getStore();
  if (store) {
    store.authorType = 'ai';
    if (note) store.note = note;
  }
}

/** Attach a human-readable note (commit message) to the next project write. */
export function setRevisionNote(note: string): void {
  const store = storage.getStore();
  if (store) store.note = note;
}

/** Prevent subsequent project writes in this async context from re-triggering a Coherence Guard audit. */
export function suppressCoherenceTrigger(): void {
  const store = storage.getStore();
  if (store) store.suppressCoherenceTrigger = true;
}

/** Routes whose writes are AI-generated content by construction. */
const AI_WRITE_PATTERN = /generate|autofill|regenerat|refine|import|analysis|mockup/i;

/**
 * Express middleware seeding the revision context for the whole request. The
 * author defaults to 'user' (all writes flow through authenticated user
 * requests); generation endpoints are pre-flagged as 'ai', and services can
 * override at any time via markRevisionAsAI().
 */
export function revisionContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const path = (req.originalUrl || req.url || '').split('?')[0];
  const context: RevisionContext = {
    authorType: AI_WRITE_PATTERN.test(path) ? 'ai' : 'user',
    source: `${req.method} ${path}`,
  };
  runWithRevisionContext(context, () => next());
}
