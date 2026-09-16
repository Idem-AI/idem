// @ts-nocheck
import pool from '../../config/ideploy-pg.config';
import logger from '../../config/logger';
import { billingSyncBacklog } from '../../config/metrics';
import { BillingSyncJob, BillingSyncJobDocument } from '../../schemas/billingSync.schema';

/**
 * Propage vers iDeploy le plan acheté dans IDEM.
 *
 * **Pourquoi une file plutôt qu'une écriture directe.** Voir l'en-tête de
 * `billingSync.schema.ts` : l'encaissement ne doit jamais dépendre de la
 * disponibilité d'une seconde base.
 *
 * **Pourquoi l'e-mail comme clé.** Les deux produits n'ont pas d'identifiant
 * commun : IDEM connaît un `userId` Firebase, iDeploy une équipe PostgreSQL.
 * L'e-mail est le seul lien existant, et c'est déjà celui qu'emploie
 * `ideploy-pg.service.ts` pour lire les ressources d'un utilisateur.
 *
 * **Ce qui arrive quand l'équipe n'existe pas.** Un client peut payer iDeploy
 * avant d'avoir ouvert son espace de déploiement. La tâche réessaie alors
 * pendant plusieurs heures, puis met le travail de côté avec un motif clair
 * plutôt que de boucler indéfiniment — le panel admin peut le rejouer une fois
 * le compte créé.
 */

/** Correspondance entre les produits du catalogue IDEM et les plans iDeploy. */
const IDEPLOY_PLAN_BY_PRODUCT: Record<string, string> = {
  'ideploy-hobby': 'hobby',
  'ideploy-starter': 'starter',
  'ideploy-pro': 'pro',
  'ideploy-scale': 'scale',
};

/**
 * Crédits de déploiement accordés par produit.
 *
 * Le plan Hobby offre cinq déploiements, puis chacun se paie. Ces crédits sont
 * comptés côté iDeploy, là où le déploiement se déclenche.
 */
const DEPLOY_CREDITS_BY_PRODUCT: Record<string, number> = {
  'ideploy-deploy-pack-10': 10,
};

/** Plan appliqué quand l'abonnement s'arrête : le gratuit, jamais une coupure. */
const FREE_PLAN = 'hobby';

const MAX_ATTEMPTS = 8;

export class IDeploySyncService {
  /** Plan iDeploy correspondant à un produit du catalogue, ou null s'il n'en est pas un. */
  planForProduct(productCode: string | undefined | null): string | null {
    if (!productCode) return null;
    return IDEPLOY_PLAN_BY_PRODUCT[productCode] ?? null;
  }

  /** Crédits de déploiement accordés par ce produit, zéro s'il n'en accorde pas. */
  deployCreditsForProduct(productCode: string | undefined | null): number {
    if (!productCode) return 0;
    return DEPLOY_CREDITS_BY_PRODUCT[productCode] ?? 0;
  }

  /**
   * Ajoute des crédits de déploiement sans toucher au plan.
   *
   * Un pack de déploiements s'achète indépendamment de l'abonnement : écrire
   * le plan au passage écraserait celui que le client paie déjà.
   */
  async enqueueDeployCredits(input: {
    userId: string;
    email: string;
    plan: string;
    credits: number;
    reference?: string;
  }): Promise<void> {
    await this.enqueue({
      userId: input.userId,
      email: input.email,
      plan: input.plan,
      deployCredits: input.credits,
      addDeployCredits: true,
      reference: input.reference,
    });
  }

  /**
   * Inscrit une synchronisation à faire.
   *
   * Appelée au paiement, au renouvellement et à l'expiration. Ne lève jamais :
   * une file indisponible ne doit pas faire échouer une livraison déjà payée.
   */
  async enqueue(input: {
    userId: string;
    email: string;
    plan: string;
    deployCredits?: number;
    addDeployCredits?: boolean;
    addons?: string[];
    startedAt?: Date | null;
    expiresAt?: Date | null;
    clearExpiry?: boolean;
    reference?: string;
  }): Promise<void> {
    try {
      await BillingSyncJob.create({
        target: 'ideploy',
        userId: input.userId,
        email: input.email.toLowerCase(),
        payload: {
          plan: input.plan,
          deployCredits: input.deployCredits,
          addDeployCredits: input.addDeployCredits,
          addons: input.addons,
          startedAt: input.startedAt ?? null,
          expiresAt: input.expiresAt ?? null,
          clearExpiry: input.clearExpiry,
        },
        reference: input.reference,
        status: 'pending',
        nextAttemptAt: new Date(),
      });

      logger.info('billing.ideploy_sync_queued', {
        event: 'billing.ideploy_sync_queued',
        userId: input.userId,
        plan: input.plan,
        reference: input.reference,
      });
    } catch (error: any) {
      logger.error(`billing.ideploy_sync_enqueue_failed: ${error.message}`, {
        event: 'billing.ideploy_sync_enqueue_failed',
        userId: input.userId,
        plan: input.plan,
      });
    }
  }

  /** Remet le plan gratuit : fin d'abonnement, grâce dépassée, remboursement. */
  async enqueueDowngrade(userId: string, email: string, reference?: string): Promise<void> {
    await this.enqueue({
      userId,
      email,
      plan: FREE_PLAN,
      // Les crédits de déploiement déjà achetés ne s'évaporent pas avec
      // l'abonnement : ils ont été payés à part.
      clearExpiry: true,
      reference,
    });
  }

  /**
   * Traite les synchronisations dues.
   *
   * Chaque travail est réservé par une mise à jour conditionnelle : deux
   * instances de l'API qui tournent en parallèle ne peuvent pas appliquer le
   * même changement deux fois.
   */
  async run(limit = 20): Promise<{ processed: number; failed: number; backlog: number }> {
    let processed = 0;
    let failed = 0;

    for (let index = 0; index < limit; index += 1) {
      const job = await BillingSyncJob.findOneAndUpdate(
        { status: 'pending', nextAttemptAt: { $lte: new Date() } },
        { $set: { status: 'processing' }, $inc: { attempts: 1 } },
        { sort: { nextAttemptAt: 1 }, new: true }
      );

      if (!job) break;

      const applied = await this.apply(job);
      if (applied) processed += 1;
      else failed += 1;
    }

    const backlog = await BillingSyncJob.countDocuments({ status: 'pending' });
    const abandoned = await BillingSyncJob.countDocuments({ status: 'failed' });

    // Publié à chaque passage, y compris quand rien n'a bougé : une jauge qui
    // cesse d'être écrite garde sa dernière valeur et ment sur l'état réel.
    billingSyncBacklog.set({ state: 'pending', service: 'idem-api' }, backlog);
    billingSyncBacklog.set({ state: 'failed', service: 'idem-api' }, abandoned);

    if (processed || failed) {
      logger.info('billing.ideploy_sync_run', {
        event: 'billing.ideploy_sync_run',
        processed,
        failed,
        backlog,
      });
    }

    return { processed, failed, backlog };
  }

  /**
   * Les synchronisations, de la plus récente à la plus ancienne.
   *
   * Sert l'écran d'administration : un plan payé qui n'arrive jamais dans
   * iDeploy doit se voir, sinon le client est le seul à s'en apercevoir.
   */
  async list(
    filter: { status?: string; userId?: string; limit?: number } = {}
  ): Promise<BillingSyncJobDocument[]> {
    const query: Record<string, unknown> = { target: 'ideploy' };
    if (filter.status) query.status = filter.status;
    if (filter.userId) query.userId = filter.userId;

    return BillingSyncJob.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(filter.limit ?? 50, 200))
      .lean() as unknown as Promise<BillingSyncJobDocument[]>;
  }

  /** Nombre de synchronisations en attente : la mesure du retard de la file. */
  async backlog(): Promise<{ pending: number; failed: number }> {
    const [pending, failed] = await Promise.all([
      BillingSyncJob.countDocuments({ status: 'pending' }),
      BillingSyncJob.countDocuments({ status: 'failed' }),
    ]);

    return { pending, failed };
  }

  /**
   * Remet un travail abandonné dans la file.
   *
   * Le cas courant : le client a payé iDeploy avant d'avoir créé son espace de
   * déploiement. Une fois le compte ouvert, un administrateur rejoue le
   * travail au lieu de refaire le paiement.
   */
  async retry(jobId: string): Promise<boolean> {
    const result = await BillingSyncJob.updateOne(
      { _id: jobId, status: { $in: ['failed', 'processing'] } },
      {
        $set: {
          status: 'pending',
          attempts: 0,
          nextAttemptAt: new Date(),
          lastError: undefined,
          failureReason: undefined,
        },
      }
    );

    return result.modifiedCount > 0;
  }

  /** Applique un travail réservé. Rend vrai si le plan est bien écrit dans iDeploy. */
  private async apply(job: BillingSyncJobDocument): Promise<boolean> {
    try {
      const teamId = await this.findTeamId(job.email);

      if (!teamId) {
        await this.reschedule(job, 'team_not_found', "Aucune équipe iDeploy pour cet e-mail");
        return false;
      }

      await pool.query(
        `UPDATE teams
            SET idem_subscription_plan = $1,
                -- Un pack de déploiements s'ajoute au solde ; un changement de
                -- plan le remplace. Confondre les deux effacerait des crédits
                -- payés, ou en offrirait qui ne l'ont pas été.
                idem_deploy_credits = CASE
                  WHEN $2::int IS NULL THEN idem_deploy_credits
                  WHEN $3::boolean THEN COALESCE(idem_deploy_credits, 0) + $2::int
                  ELSE $2::int
                END,
                idem_addons = COALESCE($4::json, idem_addons),
                idem_subscription_started_at = COALESCE($5::timestamp, idem_subscription_started_at),
                idem_subscription_expires_at = CASE
                  WHEN $6::boolean THEN NULL
                  ELSE COALESCE($7::timestamp, idem_subscription_expires_at)
                END,
                updated_at = NOW()
          WHERE id = $8`,
        [
          job.payload.plan,
          job.payload.deployCredits ?? null,
          job.payload.addDeployCredits ?? false,
          job.payload.addons ? JSON.stringify(job.payload.addons) : null,
          job.payload.startedAt ?? null,
          job.payload.clearExpiry ?? false,
          job.payload.expiresAt ?? null,
          teamId,
        ]
      );

      await BillingSyncJob.updateOne(
        { _id: job._id },
        { $set: { status: 'done', completedAt: new Date(), lastError: undefined } }
      );

      logger.info('billing.ideploy_sync_applied', {
        event: 'billing.ideploy_sync_applied',
        userId: job.userId,
        plan: job.payload.plan,
        teamId,
        reference: job.reference,
        attempts: job.attempts,
      });

      return true;
    } catch (error: any) {
      await this.reschedule(job, 'write_failed', error.message);
      return false;
    }
  }

  private async findTeamId(email: string): Promise<number | null> {
    // Même résolution que la lecture des ressources iDeploy : l'équipe
    // personnelle d'abord, à défaut la première dont l'utilisateur est membre.
    const result = await pool.query<{ id: number }>(
      `SELECT t.id
         FROM teams t
         JOIN team_user tu ON tu.team_id = t.id
         JOIN users u      ON u.id = tu.user_id
        WHERE LOWER(u.email) = $1
        ORDER BY t.personal_team DESC
        LIMIT 1`,
      [email.toLowerCase()]
    );

    return result.rows[0]?.id ?? null;
  }

  /**
   * Replanifie, ou abandonne après plusieurs heures d'échecs.
   *
   * Le délai croît avec les tentatives : inutile de marteler une base
   * indisponible, et un compte iDeploy qui n'existe pas encore sera peut-être
   * créé d'ici la prochaine tentative.
   */
  private async reschedule(
    job: BillingSyncJobDocument,
    reason: string,
    message: string
  ): Promise<void> {
    const exhausted = job.attempts >= MAX_ATTEMPTS;
    const delayMs = Math.min(6 * 3600_000, 2 ** job.attempts * 60_000);

    await BillingSyncJob.updateOne(
      { _id: job._id },
      {
        $set: {
          status: exhausted ? 'failed' : 'pending',
          lastError: message,
          failureReason: reason,
          nextAttemptAt: new Date(Date.now() + delayMs),
        },
      }
    );

    const level = exhausted ? 'error' : 'warn';
    logger[level](`billing.ideploy_sync_${exhausted ? 'abandoned' : 'retry'}: ${message}`, {
      event: `billing.ideploy_sync_${exhausted ? 'abandoned' : 'retry'}`,
      userId: job.userId,
      plan: job.payload.plan,
      reason,
      attempts: job.attempts,
      reference: job.reference,
    });
  }
}

export const ideploySyncService = new IDeploySyncService();
