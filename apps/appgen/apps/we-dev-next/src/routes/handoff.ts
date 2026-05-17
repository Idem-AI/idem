import { Router, Request, Response } from 'express';

interface HandoffPayload {
  source: 'appgen';
  target: 'ideploy' | 'dashboard';
  draftId: string;
  appName: string;
  description: string;
  files: Record<string, string>;
  metadata: Record<string, unknown>;
  messages: Array<{ role: string; content: string; timestamp: string }>;
  generatedAt: string;
  expiresAt?: string;
}

const router = Router();

const handoffStore = new Map<string, { payload: HandoffPayload; expiresAt: Date }>();

// Cleanup expired entries every 5 minutes
setInterval(
  () => {
    const now = new Date();
    for (const [id, entry] of handoffStore.entries()) {
      if (entry.expiresAt < now) {
        handoffStore.delete(id);
      }
    }
  },
  5 * 60 * 1000
);

/**
 * POST /api/handoff
 * Store AppGen generation context for transfer to iDeploy or main-dashboard.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const payload = req.body;

    if (!payload || !payload.source || payload.source !== 'appgen') {
      return res.status(400).json({ success: false, message: 'Invalid handoff payload' });
    }

    const handoffId = `hof_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const expiresAt = payload.expiresAt
      ? new Date(payload.expiresAt)
      : new Date(Date.now() + 15 * 60 * 1000);

    handoffStore.set(handoffId, { payload, expiresAt });

    console.log(
      `[Handoff] Stored handoff ${handoffId} for target: ${payload.target}, expires: ${expiresAt.toISOString()}`
    );

    return res.json({
      success: true,
      handoffId,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Handoff] Error storing handoff:', error);
    return res.status(500).json({ success: false, message: msg });
  }
});

/**
 * GET /api/handoff/:id
 * Retrieve AppGen generation context by handoff ID (one-time read).
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const entry = handoffStore.get(id);

    if (!entry) {
      return res.status(404).json({ success: false, message: 'Handoff not found or expired' });
    }

    if (entry.expiresAt < new Date()) {
      handoffStore.delete(id);
      return res.status(410).json({ success: false, message: 'Handoff expired' });
    }

    // One-time read: delete after retrieval
    handoffStore.delete(id);

    console.log(`[Handoff] Retrieved and consumed handoff ${id}`);

    return res.json({
      success: true,
      payload: entry.payload,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Handoff] Error retrieving handoff:', error);
    return res.status(500).json({ success: false, message: msg });
  }
});

export default router;
