import pool from '../../config/ideploy-pg.config';
import logger from '../../config/logger';
import {
  METERS,
  METER_ALERT_DAYS,
  METER_OPTIONS,
  METER_SLEEP_GRACE_DAYS,
  MeterOption,
  MeterTier,
  meterDailyXaf,
} from '../../models/offer.model';
import { DeployMeter, DeployMeterDocument } from '../../schemas/offer.schema';
import { User } from '../../schemas/user.schema';
import { transactionalEmailService } from '../email/email.service';
import { meterAsleep, meterLowBalance } from '../email/templates';
import { listApplicationsForEmail } from '../ideploy-pg.service';
import { creditLedgerService } from './credit-ledger.service';
import { entitlementsService } from './entitlements.service';
import { ideploySyncService } from './ideploy-sync.service';
import { walletService } from './wallet.service';

/**
 * iDeploy au compteur : chaque application a un compteur prépayé, débité une fois par jour depuis
 * le portefeuille IDEM — comme un compteur d'électricité prépayé.
 *
 *  - **Veille** (0 F) : le site reste en ligne 7 jours après sa mise en ligne, puis s'endort ;
 *  - **Vitrine** (10 F/j), **Application** (50 F/j), **Application+** (150 F/j), options au jour ;
 *  - **Boutique** (0 F/j) : IDEM se paie par une commission sur les ventes encaissées.
 *
 * Ce qui couvre un jour, dans l'ordre : l'accès bêta, le forfait (Croissance : une Vitrine ;
 * Entreprise : une Application), les jours de Vitrine prépayés (Pack Lancement), puis le
 * portefeuille. Solde épuisé : l'application s'endort — jamais supprimée — et se réveille à la
 * recharge. IDEM écrit l'état voulu dans `idem_app_meters` ; iDeploy arrête ou relance.
 */

const DAY_MS = 86_400_000;
/** Durée de la Veille gratuite après une mise en ligne. */
const VEILLE_TRIAL_DAYS = 7;

const CONSOLE_URL = process.env.IDEM_FRONTEND_URL || 'https://console.idem.africa';
const DEPLOY_URL = process.env.IDEPLOY_FRONTEND_URL || 'https://deploy.idem.africa';

function dayKey(at = new Date()): string {
  return at.toISOString().slice(0, 10);
}

export interface MeterView {
  appUuid: string;
  appName: string;
  appStatus?: string;
  fqdn?: string | null;
  tier: MeterTier;
  options: MeterOption[];
  status: 'active' | 'asleep' | 'archived';
  perDayXaf: number;
  autoRecharge: boolean;
  coveredBy?: string;
  sleepingSince?: Date;
  /** Fin de la Veille gratuite. */
  freeUntil?: Date;
}

export class DeployMeterService {
  /** Les applications de l'utilisateur et leur compteur (créé en Veille s'il n'existe pas). */
  async list(userId: string, email?: string): Promise<{ meters: MeterView[]; walletXaf: number; daysCovered: number | null }> {
    const apps = email ? await listApplicationsForEmail(email).catch(() => []) : [];
    let meters = await DeployMeter.find({ userId }).lean();

    const known = new Set(meters.map((m) => m.appUuid));
    const fresh = apps.filter((app) => !known.has(app.uuid));
    if (fresh.length) {
      for (const app of fresh) {
        await DeployMeter.updateOne(
          { appUuid: app.uuid },
          { $setOnInsert: { userId, appUuid: app.uuid, appName: app.name, tier: 'veille', options: [], status: 'active', autoRecharge: false } },
          { upsert: true }
        );
        await this.writeState(app.uuid, 'active', 'veille');
      }
      // Le plan iDeploy « au compteur » lève la limite d'applications des anciens plans.
      if (email) await ideploySyncService.enqueue({ userId, email, plan: 'metered', expiresAt: null, clearExpiry: true, reference: 'meters' }).catch(() => undefined);
      meters = await DeployMeter.find({ userId }).lean();
    }

    const byUuid = new Map(apps.map((app) => [app.uuid, app]));
    const views = meters.map((meter) => this.view(meter, byUuid.get(meter.appUuid)));
    const walletXaf = await walletService.balance(userId);
    const daily = views.filter((v) => v.status === 'active').reduce((sum, v) => sum + v.perDayXaf, 0);
    return { meters: views, walletXaf, daysCovered: daily > 0 ? Math.floor(walletXaf / daily) : null };
  }

  /** Change le compteur d'une application (palier, options, recharge automatique). */
  async configure(
    userId: string,
    appUuid: string,
    input: { tier?: MeterTier; options?: MeterOption[]; autoRecharge?: boolean }
  ): Promise<{ ok: true; meter: MeterView } | { ok: false; error: string; message: string; missingXaf?: number }> {
    const meter = await DeployMeter.findOne({ userId, appUuid });
    if (!meter) return { ok: false, error: 'meter_not_found', message: 'Application introuvable.' };

    if (input.tier) {
      if (!(input.tier in METERS)) return { ok: false, error: 'invalid_tier', message: 'Compteur inconnu.' };
      meter.tier = input.tier;
      if (input.tier === 'veille') meter.set('lastChargedDay', undefined);
    }
    if (input.options) meter.options = input.options.filter((option) => option in METER_OPTIONS);
    if (input.autoRecharge !== undefined) meter.autoRecharge = input.autoRecharge;
    await meter.save();

    // Un compteur payant choisi sur une application endormie la réveille, si le jour est couvert.
    if (meter.status !== 'active' && meter.tier !== 'veille') {
      const woke = await this.wake(userId, appUuid);
      if (!woke.ok) return woke;
    } else {
      await this.writeState(appUuid, meter.status, meter.tier);
    }
    return { ok: true, meter: this.view(meter.toObject()) };
  }

  /** Réveille une application : le jour en cours est payé tout de suite. */
  async wake(userId: string, appUuid: string): Promise<{ ok: true; meter: MeterView } | { ok: false; error: string; message: string; missingXaf?: number }> {
    const meter = await DeployMeter.findOne({ userId, appUuid });
    if (!meter) return { ok: false, error: 'meter_not_found', message: 'Application introuvable.' };
    if (meter.tier === 'veille') {
      return { ok: false, error: 'tier_required', message: 'Choisissez un compteur (à partir de 10 F par jour) pour réveiller l’application.' };
    }

    const covered = await this.chargeDay(meter, new Date());
    if (!covered.ok) {
      return { ok: false, error: 'insufficient_balance', message: `Il vous manque ${covered.missingXaf} F pour une journée de compteur.`, missingXaf: covered.missingXaf };
    }
    meter.status = 'active';
    meter.set('sleepingSince', undefined);
    meter.set('alertSentAt', undefined);
    await meter.save();
    await this.writeState(appUuid, 'active', meter.tier);
    return { ok: true, meter: this.view(meter.toObject()) };
  }

  /**
   * Après une recharge : les applications endormies faute de solde (compteur payant) se réveillent
   * d'elles-mêmes, tant que le portefeuille couvre leur journée. Les archivées restent archivées.
   */
  async wakeAfterTopUp(userId: string): Promise<number> {
    const asleep = await DeployMeter.find({ userId, status: 'asleep', tier: { $ne: 'veille' } }).sort({ sleepingSince: -1 }).select('appUuid').lean();
    let woke = 0;
    for (const meter of asleep) {
      const result = await this.wake(userId, meter.appUuid).catch(() => null);
      if (!result?.ok) break;
      woke += 1;
    }
    if (woke) logger.info('meters.woke_after_topup', { event: 'meters.woke_after_topup', userId, woke });
    return woke;
  }

  /**
   * Le passage quotidien : chaque compteur actif est couvert pour la journée, ou s'endort. Les
   * applications endormies depuis plus de 30 jours sont archivées.
   */
  async runDaily(now = new Date()): Promise<{ charged: number; slept: number; archived: number }> {
    const today = dayKey(now);
    let charged = 0;
    let slept = 0;

    const due = await DeployMeter.find({ status: 'active', $or: [{ lastChargedDay: { $exists: false } }, { lastChargedDay: { $ne: today } }] }).limit(5000);
    for (const meter of due) {
      try {
        if (meter.tier === 'veille') {
          const freeUntil = new Date(meter.createdAt.getTime() + VEILLE_TRIAL_DAYS * DAY_MS);
          // La bêta et un abonnement iDeploy d'avant le portefeuille gardent l'application allumée.
          if (now > freeUntil && (await this.keptAwake(meter))) {
            meter.lastChargedDay = today;
            meter.lastCoveredBy = 'pass';
            await meter.save();
            continue;
          }
          if (now > freeUntil) {
            await this.sleep(meter, 'trial');
            slept += 1;
          }
          continue;
        }
        const result = await this.chargeDay(meter, now);
        if (result.ok) {
          charged += 1;
          await this.alertIfLow(meter);
        } else {
          await this.sleep(meter, 'balance');
          slept += 1;
        }
      } catch (error: any) {
        logger.error(`meters.daily_failed: ${error.message}`, { event: 'meters.daily_failed', appUuid: meter.appUuid });
      }
    }

    const archiveBefore = new Date(now.getTime() - METER_SLEEP_GRACE_DAYS * DAY_MS);
    const stale = await DeployMeter.find({ status: 'asleep', sleepingSince: { $lte: archiveBefore } });
    for (const meter of stale) {
      meter.status = 'archived';
      await meter.save();
      await this.writeState(meter.appUuid, 'archived', meter.tier);
    }

    if (charged || slept || stale.length) logger.info('meters.daily', { event: 'meters.daily', charged, slept, archived: stale.length });
    return { charged, slept, archived: stale.length };
  }

  // ── Interne ───────────────────────────────────────────────────────────────

  /** Bêta, ou abonnement iDeploy payé avant la bascule (jusqu'à son échéance) : rien n'est dû. */
  private async keptAwake(meter: DeployMeterDocument): Promise<boolean> {
    const entitlements = await entitlementsService.resolve(meter.userId);
    if (entitlements.beta.active) return true;
    const legacy = entitlements.engines.ideploy;
    return Boolean(legacy && !legacy.complimentary && legacy.status !== 'free' && !legacy.productCode.endsWith('-free') && legacy.productCode !== 'ideploy-hobby');
  }


  /** Couvre une journée de compteur : bêta, forfait, jours prépayés, puis portefeuille. */
  private async chargeDay(meter: DeployMeterDocument, now: Date): Promise<{ ok: true } | { ok: false; missingXaf: number }> {
    const today = dayKey(now);
    const price = meterDailyXaf(meter.tier, meter.options);
    const optionsXaf = meterDailyXaf('veille', meter.options);
    const entitlements = await entitlementsService.resolve(meter.userId);

    const done = async (by: DeployMeterDocument['lastCoveredBy']) => {
      meter.lastChargedDay = today;
      meter.lastCoveredBy = by;
      await meter.save();
      return { ok: true as const };
    };

    if (price === 0) return done('free');
    if (await this.keptAwake(meter)) return done('pass');

    // Le forfait couvre le palier (les options restent à payer).
    let due = price;
    let tierCoveredBy: 'pass' | 'prepaid' | null = null;
    if (await this.coveredByPass(meter, entitlements)) {
      due = optionsXaf;
      tierCoveredBy = 'pass';
    }

    // Les jours de Vitrine prépayés couvrent une Vitrine.
    if (!tierCoveredBy && meter.tier === 'vitrine') {
      const prepaid = await creditLedgerService.debit(meter.userId, 'vitrine_days', 1, { action: 'meter_vitrine', element: meter.appUuid, note: `Vitrine ${meter.appName ?? meter.appUuid} — jour prépayé` });
      if (prepaid.allowed) {
        due = optionsXaf;
        tierCoveredBy = 'prepaid';
      }
    }

    if (due === 0) return done(tierCoveredBy ?? 'pass');

    const spend = await walletService.spend(meter.userId, {
      priceXaf: due,
      label: `Compteur ${METERS[meter.tier].label} — ${meter.appName ?? meter.appUuid} (${today})`,
      action: 'meter_day',
      element: meter.appUuid,
      feature: 'ideploy',
    });
    if (!spend.allowed) return { ok: false, missingXaf: spend.missingXaf };
    await entitlementsService.invalidate(meter.userId);
    return done('wallet');
  }

  /** Croissance couvre une Vitrine, Entreprise une Application (la plus ancienne de chaque palier). */
  private async coveredByPass(meter: DeployMeterDocument, entitlements: Awaited<ReturnType<typeof entitlementsService.resolve>>): Promise<boolean> {
    const passes = entitlements.offer.passes;
    const tiers: MeterTier[] = [];
    if (passes.entreprise) tiers.push('application', 'vitrine');
    else if (passes.croissance) tiers.push('vitrine');
    if (!tiers.includes(meter.tier)) return false;
    const first = await DeployMeter.findOne({ userId: meter.userId, tier: meter.tier, status: 'active' }).sort({ createdAt: 1 }).select('appUuid').lean();
    return first?.appUuid === meter.appUuid;
  }

  private async sleep(meter: DeployMeterDocument, reason: 'balance' | 'trial'): Promise<void> {
    meter.status = 'asleep';
    meter.sleepingSince = new Date();
    await meter.save();
    await this.writeState(meter.appUuid, 'asleep', meter.tier);
    await this.notify(meter.userId, (firstName) =>
      meterAsleep({ firstName, appName: meter.appName ?? 'Votre application', reason, wakeUrl: `${DEPLOY_URL}/applications/${meter.appUuid}` }),
      'meter_asleep',
      meter.appUuid
    );
  }

  /** Alerte quand le portefeuille ne couvre plus que quelques jours de compteurs. */
  private async alertIfLow(meter: DeployMeterDocument): Promise<void> {
    if (meter.alertSentAt && Date.now() - meter.alertSentAt.getTime() < METER_ALERT_DAYS * DAY_MS) return;
    const actives = await DeployMeter.find({ userId: meter.userId, status: 'active' }).lean();
    const daily = actives.reduce((sum, m) => sum + meterDailyXaf(m.tier, m.options), 0);
    if (daily <= 0) return;
    const walletXaf = await walletService.balance(meter.userId);
    const daysLeft = Math.floor(walletXaf / daily);
    if (daysLeft > METER_ALERT_DAYS) return;

    meter.alertSentAt = new Date();
    await meter.save();
    await this.notify(meter.userId, (firstName) =>
      meterLowBalance({ firstName, appName: meter.appName ?? 'Votre application', perDayXaf: daily, walletXaf, daysLeft, topupUrl: `${CONSOLE_URL}/account/wallet` }),
      'meter_low_balance',
      meter.appUuid
    );
  }

  private async notify(userId: string, render: (firstName?: string) => { subject: string; html: string; text: string }, template: string, relatedId: string): Promise<void> {
    try {
      const user = await User.findOne({ uid: userId }).select('email displayName').lean();
      if (!user?.email) return;
      const firstName = (user as { displayName?: string }).displayName?.split(' ')[0];
      const email = render(firstName);
      await transactionalEmailService.send({ to: user.email, ...email, template, relatedId, relatedType: 'meter', userId });
    } catch (error: any) {
      logger.warn(`meters.notify_failed: ${error.message}`, { event: 'meters.notify_failed', userId });
    }
  }

  /** État voulu, lu par iDeploy (`idem_app_meters`). */
  private async writeState(appUuid: string, status: 'active' | 'asleep' | 'archived', tier: MeterTier): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO idem_app_meters (application_uuid, status, tier, updated_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (application_uuid) DO UPDATE SET status = EXCLUDED.status, tier = EXCLUDED.tier, updated_at = now()`,
        [appUuid, status, tier]
      );
    } catch (error: any) {
      logger.error(`meters.state_write_failed: ${error.message}`, { event: 'meters.state_write_failed', appUuid, status });
    }
  }

  private view(meter: { appUuid: string; appName?: string; tier: MeterTier; options: MeterOption[]; status: MeterView['status']; autoRecharge: boolean; lastCoveredBy?: string; sleepingSince?: Date; createdAt?: Date }, app?: { name: string; status: string; fqdn: string | null }): MeterView {
    return {
      appUuid: meter.appUuid,
      appName: app?.name ?? meter.appName ?? meter.appUuid,
      appStatus: app?.status,
      fqdn: app?.fqdn,
      tier: meter.tier,
      options: meter.options ?? [],
      status: meter.status,
      perDayXaf: meterDailyXaf(meter.tier, meter.options ?? []),
      autoRecharge: meter.autoRecharge,
      coveredBy: meter.lastCoveredBy,
      sleepingSince: meter.sleepingSince,
      freeUntil: meter.tier === 'veille' && meter.createdAt ? new Date(new Date(meter.createdAt).getTime() + VEILLE_TRIAL_DAYS * DAY_MS) : undefined,
    };
  }
}

export const deployMeterService = new DeployMeterService();
export default deployMeterService;
