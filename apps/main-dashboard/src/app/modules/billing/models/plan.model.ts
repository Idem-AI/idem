import { BillingEngine, BillingProduct, EngineSubscription } from './billing.model';

/**
 * L'offre d'un moteur, vue par son abonné.
 *
 * Le modèle de facturation tient trois compteurs séparés — iBusiness, iCode,
 * iDeploy — chacun avec son échelle d'offres et ses crédits. C'est exact, mais
 * ce n'est pas ce qu'on doit montrer : l'utilisateur ne se demande pas « quel
 * est l'état de mes trois abonnements », il se demande « où j'en suis, et
 * qu'est-ce qui est au-dessus ».
 *
 * Cette vue répond à cette question-là, et une seule fois : la barre latérale,
 * l'aperçu du compte et la page des offres la lisent toutes les trois. Deux
 * calculs séparés de « suis-je au plan maximum ? » auraient fini par ne pas
 * dire la même chose sur deux écrans voisins.
 */
export interface EnginePlanView {
  engine: BillingEngine;

  /** Nom commercial du moteur : iBusiness, iCode, iDeploy. */
  engineLabel: string;

  /**
   * Échelle complète des abonnements du moteur, du gratuit au plus complet.
   * C'est elle qui donne un sens à « supérieur » et « inférieur ».
   */
  ladder: BillingProduct[];

  /** Offre en cours. L'offre gratuite quand rien n'est souscrit. */
  current: BillingProduct | null;

  /** Nom à afficher, y compris quand le catalogue ne connaît plus le produit. */
  currentName: string;

  /** Rang dans l'échelle ; `-1` si le produit souscrit n'y figure plus. */
  currentIndex: number;

  /** L'abonnement réel, `null` sur l'offre gratuite. */
  subscription: EngineSubscription | null;

  /**
   * Échelon immédiatement supérieur, `null` au sommet de l'échelle.
   * C'est l'unique cible du bouton « Passer à » : proposer trois montées
   * d'un coup, c'est reposer la question du choix au lieu d'y répondre.
   */
  next: BillingProduct | null;

  /** Vrai quand il n'y a plus rien au-dessus : le bouton cède la place à une mention. */
  isTopTier: boolean;

  /** Solde du compteur de ce moteur. */
  credits: number;

  /**
   * Ce qui appelle une action, en un mot.
   *
   *  - `free` : offre gratuite, rien à régler ;
   *  - `active` : abonnement qui se renouvelle ;
   *  - `ending` : résilié, actif jusqu'à la fin de la période payée ;
   *  - `past_due` : échéance impayée, accès en sursis — le seul état urgent ;
   *  - `complimentary` : accès offert (bêta premium), avec une date de fin ;
   *  - `trialing` : période d'essai.
   */
  state: 'free' | 'active' | 'ending' | 'past_due' | 'complimentary' | 'trialing';

  /** Date de la prochaine échéance, de fin d'accès, ou de fin de tolérance. */
  boundaryDate?: string;
}

/** Ordre d'affichage des moteurs : du plus utilisé au plus spécialisé. */
export const BILLING_ENGINES: BillingEngine[] = ['business', 'appgen', 'ideploy'];

/** Noms commerciaux. Le code technique n'apparaît jamais à l'écran. */
export const ENGINE_LABELS: Record<BillingEngine, string> = {
  business: 'iBusiness',
  appgen: 'iCode',
  ideploy: 'iDeploy',
};

/**
 * Construit la vue d'un moteur.
 *
 * Deux cas méritent leur ligne. Un abonnement dont le produit a disparu du
 * catalogue — plan retiré de la vente — garde son nom via le code produit et
 * sort de l'échelle (`currentIndex = -1`) : on ne lui propose pas de « monter »
 * vers un échelon dont on ne sait plus s'il est au-dessus. Et un accès offert
 * n'a pas d'échelon supérieur à vendre : il a une date de fin, pas un
 * renouvellement.
 */
export function buildEnginePlanView(
  engine: BillingEngine,
  products: BillingProduct[],
  subscriptions: EngineSubscription[],
  credits: number,
): EnginePlanView {
  const ladder = products
    .filter((product) => product.kind === 'subscription' && product.engine === engine)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const subscription = subscriptions.find((entry) => entry.engine === engine) ?? null;

  // Sans abonnement, l'offre en cours est le premier échelon gratuit — c'est
  // bien une offre, pas une absence d'offre, et elle doit se lire comme telle.
  const freeTier = ladder.find((product) => product.priceXaf === 0) ?? null;

  const current = subscription
    ? (ladder.find((product) => product.code === subscription.productCode) ?? null)
    : freeTier;

  const currentIndex = current ? ladder.findIndex((product) => product.code === current.code) : -1;

  const state = resolveState(subscription);

  // Un accès offert ne se monte pas : on ne vend pas un échelon au-dessus de
  // quelque chose qui n'a pas été acheté.
  const next =
    state === 'complimentary' || currentIndex < 0
      ? null
      : (ladder[currentIndex + 1] ?? null);

  return {
    engine,
    engineLabel: ENGINE_LABELS[engine],
    ladder,
    current,
    currentName: current?.name ?? subscription?.productCode ?? '—',
    currentIndex,
    subscription,
    next,
    isTopTier: next === null && currentIndex >= 0 && state !== 'complimentary',
    credits,
    state,
    boundaryDate: subscription?.graceEndsAt ?? subscription?.currentPeriodEnd,
  };
}

function resolveState(subscription: EngineSubscription | null): EnginePlanView['state'] {
  if (!subscription) return 'free';
  if (subscription.complimentary) return 'complimentary';
  if (subscription.status === 'past_due') return 'past_due';
  if (subscription.status === 'trialing') return 'trialing';
  if (subscription.cancelAtPeriodEnd) return 'ending';
  return 'active';
}
