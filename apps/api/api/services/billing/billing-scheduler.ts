import logger from '../../config/logger';
import { billingJobRunsTotal } from '../../config/metrics';
import RedisConnection from '../../config/redis.config';
import { paymentReconcilerService } from '../payments/payment-reconciler.service';
import { betaService } from './beta.service';
import { creditLedgerService } from './credit-ledger.service';
import { ideploySyncService } from './ideploy-sync.service';
import { subscriptionRenewalService } from './subscription-renewal.service';

/**
 * Tâches planifiées de la facturation.
 *
 * Deux contraintes dictent la forme :
 *
 *  1. **Plusieurs instances de l'API tournent en parallèle.** Sans garde-fou,
 *     chacune relancerait la réconciliation — donc des appels pawaPay en
 *     double, et pire, des livraisons concurrentes. Un verrou Redis
 *     (`SET NX PX`) fait qu'une seule instance travaille par créneau.
 *
 *  2. **Une panne de Redis ne doit pas tout arrêter.** Si le verrou est
 *     inaccessible, la tâche s'exécute quand même : la réconciliation est
 *     idempotente (relire un statut, retenter une livraison déjà verrouillée
 *     en base), donc un doublon occasionnel est sans danger, alors qu'une
 *     réconciliation à l'arrêt laisse des clients débités sans contrepartie.
 *
 * `setInterval` plutôt qu'un ordonnanceur externe : c'est l'idiome déjà employé
 * dans cette base (`anomaly-detection.service.ts`, `pdf.service.ts`), et ces
 * tâches n'ont pas besoin d'expressions cron.
 */

export interface ScheduledJob {
  name: string;
  intervalMs: number;
  /** Durée du verrou : plus longue qu'une exécution normale, plus courte que l'intervalle. */
  lockTtlMs: number;
  run: () => Promise<unknown>;
}

const timers: NodeJS.Timeout[] = [];
let started = false;

/**
 * Exécute `fn` si le verrou est obtenu.
 *
 * Le verrou n'est pas relâché à la fin : il expire. Un verrou relâché trop tôt
 * par une instance lente laisserait une seconde instance démarrer pendant que
 * la première finit.
 */
async function withLock(name: string, ttlMs: number, fn: () => Promise<unknown>): Promise<boolean> {
  const key = `billing:lock:${name}`;

  try {
    const redis = RedisConnection.getInstance();
    const acquired = await redis.set(key, String(Date.now()), 'PX', ttlMs, 'NX');

    if (!acquired) return false;
  } catch (error: any) {
    logger.warn(`billing.lock_unavailable: ${error.message}`, {
      event: 'billing.lock_unavailable',
      job: name,
    });
    // On continue sans verrou : voir l'en-tête de fichier.
  }

  await fn();
  return true;
}

async function runJob(job: ScheduledJob): Promise<void> {
  const startedAt = Date.now();

  try {
    const executed = await withLock(job.name, job.lockTtlMs, job.run);

    if (!executed) {
      billingJobRunsTotal.inc({ job: job.name, result: 'skipped', service: 'idem-api' });
      return;
    }

    billingJobRunsTotal.inc({ job: job.name, result: 'success', service: 'idem-api' });
  } catch (error: any) {
    billingJobRunsTotal.inc({ job: job.name, result: 'error', service: 'idem-api' });
    logger.error(`billing.job_failed: ${error.message}`, {
      event: 'billing.job_failed',
      job: job.name,
      durationMs: Date.now() - startedAt,
      stack: error.stack,
    });
  }
}

/** Tâches enregistrées. Les phases suivantes en ajoutent (renouvellements, bêta). */
export const BILLING_JOBS: ScheduledJob[] = [
  {
    name: 'payment-reconciler',
    intervalMs: 60_000,
    lockTtlMs: 55_000,
    run: () => paymentReconcilerService.run(),
  },
  {
    // Chaque heure suffit : une échéance se compte en jours, et la tâche
    // n'envoie qu'un rappel par jour et par abonnement.
    name: 'subscription-renewal',
    intervalMs: 3600_000,
    lockTtlMs: 600_000,
    run: () => subscriptionRenewalService.run(),
  },
  {
    // Le report des crédits est annoncé à deux mois : la péremption est donc
    // une promesse commerciale à tenir, pas un détail technique. Une fois par
    // jour, par lots — un retard de quelques heures n'a aucune conséquence.
    name: 'credit-expiry',
    intervalMs: 24 * 3600_000,
    lockTtlMs: 600_000,
    run: () => creditLedgerService.expireDueGrants(),
  },
  {
    // Bêta premium : recharge mensuelle des crédits, avertissement à J-7,
    // clôture du programme à la date décidée dans le panel admin.
    name: 'beta-program',
    intervalMs: 3600_000,
    lockTtlMs: 600_000,
    run: () => betaService.run(),
  },
  {
    // iDeploy vit dans une autre base : le plan payé y est propagé par une
    // file qui réessaie. Une minute, comme la réconciliation — un client qui
    // vient de payer son hébergement ne doit pas attendre son plan.
    name: 'ideploy-sync',
    intervalMs: 60_000,
    lockTtlMs: 55_000,
    run: () => ideploySyncService.run(),
  },
];

/**
 * Démarre les tâches.
 *
 * Chaque tâche est décalée d'un délai aléatoire avant son premier passage :
 * au redémarrage simultané de plusieurs instances, elles ne se disputent pas
 * le verrou à la même milliseconde.
 */
export function startBillingScheduler(jobs: ScheduledJob[] = BILLING_JOBS): void {
  if (started) return;
  started = true;

  for (const job of jobs) {
    const timer = setInterval(() => void runJob(job), job.intervalMs);
    // Ne retient pas le processus à l'arrêt.
    timer.unref();
    timers.push(timer);

    setTimeout(() => void runJob(job), Math.floor(Math.random() * 10_000)).unref();
  }

  logger.info('billing.scheduler_started', {
    event: 'billing.scheduler_started',
    jobs: jobs.map((job) => job.name),
  });
}

export function stopBillingScheduler(): void {
  for (const timer of timers) clearInterval(timer);
  timers.length = 0;
  started = false;
}
