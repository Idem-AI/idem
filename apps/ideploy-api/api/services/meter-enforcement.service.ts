/**
 * Applique l'état voulu des compteurs IDEM (`idem_app_meters`).
 *
 * IDEM tient le portefeuille et débite chaque jour le compteur d'une application ; c'est lui qui
 * décide qu'une application s'endort (solde épuisé) ou se réveille (recharge). iDeploy, qui
 * possède les serveurs, exécute : arrêt (`compose down`) ou relance (`compose up -d`). Une
 * application endormie n'est jamais supprimée — ses données et son code restent en place.
 */
import pool from '../config/db.config';
import logger from '../config/logger';
import { lifecycleAction } from './application.service';

interface PendingMeter {
  application_uuid: string;
  status: 'active' | 'asleep' | 'archived';
  team_id: number | null;
}

/** Nombre maximal d'applications traitées par balayage : une file, pas une rafale. */
const BATCH = 20;

export async function applyPendingMeters(): Promise<number> {
  let rows: PendingMeter[] = [];
  try {
    ({ rows } = (await pool.query(
      `SELECT m.application_uuid, m.status, p.team_id
         FROM idem_app_meters m
         LEFT JOIN applications a ON a.uuid = m.application_uuid AND a.deleted_at IS NULL
         LEFT JOIN environments e ON e.id = a.environment_id
         LEFT JOIN projects p ON p.id = e.project_id
        WHERE m.applied_status IS DISTINCT FROM m.status
        ORDER BY m.updated_at
        LIMIT $1`,
      [BATCH]
    )) as unknown as { rows: PendingMeter[] });
  } catch (err) {
    // Table absente (migration pas encore passée) : rien à faire.
    logger.debug('meters.sweep_skipped', { message: (err as Error).message });
    return 0;
  }

  let applied = 0;
  for (const meter of rows) {
    if (!meter.team_id) {
      await pool.query(`UPDATE idem_app_meters SET applied_status = status, applied_at = now(), last_error = 'application introuvable' WHERE application_uuid = $1`, [meter.application_uuid]);
      continue;
    }
    const action = meter.status === 'active' ? 'start' : 'stop';
    try {
      const result = await lifecycleAction(Number(meter.team_id), meter.application_uuid, action);
      await pool.query(
        `UPDATE idem_app_meters SET applied_status = $2, applied_at = now(), last_error = $3 WHERE application_uuid = $1`,
        [meter.application_uuid, result.success ? meter.status : null, result.success ? null : result.output.slice(0, 2000)]
      );
      if (result.success) applied += 1;
      logger.info('meters.applied', { event: 'meters.applied', application: meter.application_uuid, status: meter.status, success: result.success });
    } catch (err) {
      await pool.query(`UPDATE idem_app_meters SET last_error = $2 WHERE application_uuid = $1`, [meter.application_uuid, (err as Error).message.slice(0, 2000)]);
      logger.warn('meters.apply_failed', { event: 'meters.apply_failed', application: meter.application_uuid, message: (err as Error).message });
    }
  }
  return applied;
}
