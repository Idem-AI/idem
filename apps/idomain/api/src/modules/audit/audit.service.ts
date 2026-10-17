/**
 * Le journal des actions sensibles : achat, débit, restitution, modification de zone, changement
 * de prix ou de règle. Il ne remplace pas les journaux techniques (Grafana) : il reste en base,
 * lisible depuis la console, et sert à trancher un litige.
 */
import { Db, query } from '../../config/db';
import logger from '../../config/logger';
import { getTraceContext } from '../../utils/trace.util';

export type ActorKind = 'user' | 'admin' | 'system' | 'service';

export async function audit(
  entry: { actorKind: ActorKind; actorId?: string | null; action: string; targetType?: string; targetId?: string; data?: Record<string, unknown> },
  db?: Db
): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_logs (actor_kind, actor_id, action, target_type, target_id, data, request_id) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [entry.actorKind, entry.actorId ?? null, entry.action, entry.targetType ?? null, entry.targetId ?? null, entry.data ? JSON.stringify(entry.data) : null, getTraceContext()?.requestId ?? null],
      db
    );
  } catch (error) {
    // Dans une transaction, l'échec remonte (tout est annulé) ; hors transaction, l'action a eu lieu : on le dit fort.
    if (db) throw error;
    logger.error('audit.write_failed', { event: 'audit.write_failed', action: entry.action, error });
  }
}
