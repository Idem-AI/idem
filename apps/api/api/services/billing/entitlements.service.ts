import logger from '../../config/logger';
import RedisConnection from '../../config/redis.config';
import { BILLING_ENGINES, BillingEngine } from '../../models/billing.model';
import {
  AppgenLimits,
  BusinessLimits,
  FREE_PLAN_CODES,
  IdeployLimits,
  limitsForPlan,
} from '../../models/plan-limits.model';
import { billingService } from '../billing.service';
import { creditLedgerService } from './credit-ledger.service';

/**
 * Ce à quoi un utilisateur a droit, à l'instant présent.
 *
 * Une seule question, posée des dizaines de fois par minute : cet utilisateur
 * peut-il faire cette action ? La réponse combine quatre sources — abonnement
 * du moteur concerné, solde de crédits, passes en cours, accès bêta — et
 * chacune vit dans une collection différente. Les rassembler à chaque contrôle
 * coûterait quatre requêtes sur le chemin critique d'une génération.
 *
 * D'où un cache court, partagé entre instances via Redis. Soixante secondes :
 * assez pour absorber une rafale de générations, assez peu pour qu'un achat se
 * voie presque tout de suite — et l'achat invalide explicitement le cache, donc
 * l'attente réelle est nulle dans le cas qui compte.
 *
 * Si Redis est indisponible, on recalcule à chaque appel : plus lent, jamais
 * faux. Un cache en panne ne doit pas bloquer la plateforme.
 */

const CACHE_TTL_SECONDS = 60;
const CACHE_PREFIX = 'idem:entitlements:';

export interface EngineEntitlement {
  engine: BillingEngine;
  /** Produit souscrit, ou le plan gratuit du moteur. */
  productCode: string;
  status: 'free' | 'active' | 'trialing' | 'past_due';
  /** Vrai pour un accès offert (bêta premium) : il a une date de fin. */
  complimentary: boolean;
  credits: number;
  currentPeriodEnd?: Date;
  /** Tolérance en cours après une échéance impayée. */
  graceEndsAt?: Date;
}

export interface Entitlements {
  userId: string;
  engines: Record<BillingEngine, EngineEntitlement>;
  business: BusinessLimits;
  appgen: AppgenLimits;
  ideploy: IdeployLimits;
  /** Projets AppGen débloqués par un Pass. */
  unlockedProjects: string[];
  /** Passes à durée limitée encore valides, par moteur. */
  activePasses: { productCode: string; engine: BillingEngine | null; expiresAt?: Date }[];
  beta: { active: boolean; endsAt?: Date | null };
  resolvedAt: string;
}

export class EntitlementsService {
  /** Droits complets d'un utilisateur, depuis le cache si possible. */
  async resolve(userId: string): Promise<Entitlements> {
    const cached = await this.readCache(userId);
    if (cached) return cached;

    const entitlements = await this.compute(userId);
    await this.writeCache(userId, entitlements);
    return entitlements;
  }

  /**
   * Recalcule sans passer par le cache.
   *
   * Utilisé juste après une écriture de facturation, quand lire une valeur
   * vieille d'une seconde donnerait à l'utilisateur l'impression que son
   * paiement n'a servi à rien.
   */
  async compute(userId: string): Promise<Entitlements> {
    const [subscriptions, balances, passes] = await Promise.all([
      billingService.getActiveSubscriptions(userId),
      creditLedgerService.getAllBalances(userId),
      billingService.getActivePasses(userId),
    ]);

    const byEngine = new Map(subscriptions.map((subscription) => [subscription.engine, subscription]));

    const engines = Object.fromEntries(
      BILLING_ENGINES.map((engine) => {
        const subscription = byEngine.get(engine);

        const entitlement: EngineEntitlement = {
          engine,
          productCode: subscription?.productCode ?? FREE_PLAN_CODES[engine],
          status: subscription
            ? (subscription.status as 'active' | 'trialing' | 'past_due')
            : 'free',
          // Un abonnement `beta` est un cadeau, pas une vente : le distinguer
          // permet à l'interface d'afficher la date de fin plutôt qu'un
          // renouvellement.
          complimentary: subscription?.provider === 'beta',
          credits: balances[engine] ?? 0,
          currentPeriodEnd: subscription?.currentPeriodEnd,
          graceEndsAt: subscription?.graceEndsAt,
        };

        return [engine, entitlement];
      })
    ) as Record<BillingEngine, EngineEntitlement>;

    const betaSubscription = subscriptions.find((subscription) => subscription.provider === 'beta');

    return {
      userId,
      engines,
      business: limitsForPlan('business', engines.business.productCode),
      appgen: limitsForPlan('appgen', engines.appgen.productCode),
      ideploy: limitsForPlan('ideploy', engines.ideploy.productCode),
      unlockedProjects: passes
        .filter((pass) => pass.kind === 'project_pass' && pass.projectId)
        .map((pass) => pass.projectId!),
      activePasses: passes
        .filter((pass) => pass.kind === 'day_pass')
        .map((pass) => ({
          productCode: pass.productCode,
          engine: pass.engine,
          expiresAt: pass.expiresAt,
        })),
      beta: {
        active: Boolean(betaSubscription),
        endsAt: betaSubscription?.currentPeriodEnd ?? null,
      },
      resolvedAt: new Date().toISOString(),
    };
  }

  /**
   * Invalide le cache d'un utilisateur. À appeler après tout mouvement de
   * facturation : souscription, achat, octroi ou débit de crédits.
   */
  async invalidate(userId: string): Promise<void> {
    try {
      await RedisConnection.getInstance().del(`${CACHE_PREFIX}${userId}`);
    } catch {
      // Sans Redis il n'y a pas de cache à invalider.
    }
  }

  // ============================================
  // ACCÈS AUX DROITS
  // ============================================

  /** Vrai si un projet AppGen est débloqué (Pass acheté ou plan qui l'inclut). */
  async hasProjectAccess(userId: string, projectId: string): Promise<boolean> {
    const entitlements = await this.resolve(userId);

    if (entitlements.appgen.projectPassIncluded) return true;
    return entitlements.unlockedProjects.includes(projectId);
  }

  /** Solde d'un moteur, lu depuis les droits (donc mis en cache). */
  async creditsOf(userId: string, engine: BillingEngine): Promise<number> {
    const entitlements = await this.resolve(userId);
    return entitlements.engines[engine].credits;
  }

  // ============================================
  // CACHE
  // ============================================

  private async readCache(userId: string): Promise<Entitlements | null> {
    try {
      const raw = await RedisConnection.getInstance().get(`${CACHE_PREFIX}${userId}`);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as Entitlements;

      // JSON ne restitue pas les dates : sans cette reconstruction, une
      // comparaison de fin de période comparerait une chaîne à une date et
      // prolongerait silencieusement un abonnement échu.
      for (const engine of BILLING_ENGINES) {
        const entitlement = parsed.engines?.[engine];
        if (entitlement?.currentPeriodEnd) {
          entitlement.currentPeriodEnd = new Date(entitlement.currentPeriodEnd);
        }
        if (entitlement?.graceEndsAt) {
          entitlement.graceEndsAt = new Date(entitlement.graceEndsAt);
        }
      }

      return parsed;
    } catch {
      return null;
    }
  }

  private async writeCache(userId: string, entitlements: Entitlements): Promise<void> {
    try {
      await RedisConnection.getInstance().set(
        `${CACHE_PREFIX}${userId}`,
        JSON.stringify(entitlements),
        'EX',
        CACHE_TTL_SECONDS
      );
    } catch (error: any) {
      // Une seule ligne, en debug : Redis indisponible se voit déjà ailleurs,
      // et cette fonction est appelée très souvent.
      logger.debug(`billing.entitlements_cache_write_failed: ${error.message}`);
    }
  }
}

export const entitlementsService = new EntitlementsService();
export default entitlementsService;
