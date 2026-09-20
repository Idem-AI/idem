/**
 * Réglages de facturation modifiables sans redéploiement.
 *
 * La frontière avec la configuration d'environnement est nette :
 *  - une **variable d'environnement** porte ce qui relève de l'infrastructure
 *    et des secrets (jeton pawaPay, environnement bac à sable ou production) ;
 *  - ces **réglages en base** portent ce qui relève d'une décision commerciale
 *    prise en cours de route : la date de fin de la bêta, le moment où le
 *    barème devient bloquant, le montant du crédit de bienvenue.
 *
 * Le second groupe se règle depuis le panel admin, parce qu'il change à des
 * moments qui n'ont rien à voir avec un déploiement.
 */

/**
 * Degré d'application du barème en crédits.
 *
 * Le mode `log` existe pour une raison précise : brancher d'un coup le débit
 * sur une base d'utilisateurs habitués à 50 générations par jour bloquerait des
 * comptes en production sans qu'on ait la moindre mesure préalable. En `log`,
 * chaque refus qui AURAIT eu lieu est journalisé et compté, sans rien bloquer.
 * On lit les chiffres, on ajuste, puis on passe en `enforce`.
 */
export type BillingEnforcementMode = 'off' | 'log' | 'enforce';

export interface BetaSettings {
  enabled: boolean;
  /** Fin de la gratuité premium ; `null` = pas de date arrêtée. */
  endsAt: Date | null;
  /** Produits offerts aux bêta-testeurs, le haut de gamme de chaque moteur. */
  planCodes: string[];
  /** Crédits rechargés chaque mois — ce qui borne le coût IA du programme. */
  monthlyCredits: { business: number; appgen: number };
  /** La Simulation Approfondie et son rapport sont-ils inclus ? */
  simulationIncluded: boolean;
  /** Invitation automatique quand un e-mail de la liste crée son compte. */
  autoInviteOnSignup: boolean;
}

export interface WelcomeCreditSettings {
  enabled: boolean;
  business: number;
  appgen: number;
  /** Durée de validité, alignée sur le report de crédits standard. */
  validityMonths: number;
  /** Date de la campagne d'octroi ; empêche de la rejouer par inadvertance. */
  grantedAt?: Date | null;
}

export interface BillingSettingsModel {
  /** Document unique. */
  key: 'global';
  /** Interrupteur d'arrêt : coupe l'encaissement sans redéployer. */
  paymentsEnabled: boolean;
  enforcement: BillingEnforcementMode;
  beta: BetaSettings;
  welcomeCredit: WelcomeCreditSettings;
  /** Jours d'accès maintenu après une échéance impayée. */
  graceDays: number;
  /** Jours avant échéance où l'on relance (0 = le jour même). */
  reminderDays: number[];
  /** Pays ouverts au paiement ; vide = tous les pays pris en charge. */
  enabledCountries: string[];
  updatedAt?: Date;
  updatedBy?: string;
}

/**
 * Valeurs de départ, conformes aux décisions prises avec l'équipe :
 * bêta haut de gamme plafonnée, 3 jours de grâce, crédit de bienvenue de
 * 50 + 50 valable 2 mois.
 *
 * `paymentsEnabled` est vrai mais l'encaissement reste inerte tant que
 * `PAWAPAY_API_TOKEN` n'est pas fourni : le client refuse de partir sans jeton.
 * `enforcement` démarre en `log` — on mesure avant de bloquer.
 */
export const DEFAULT_BILLING_SETTINGS: BillingSettingsModel = {
  key: 'global',
  paymentsEnabled: true,
  enforcement: 'log',
  beta: {
    enabled: true,
    endsAt: null,
    planCodes: ['business-cabinet', 'social-pro', 'appgen-studio', 'ideploy-scale'],
    monthlyCredits: { business: 1500, appgen: 1500 },
    simulationIncluded: true,
    autoInviteOnSignup: true,
  },
  welcomeCredit: {
    enabled: true,
    business: 50,
    appgen: 50,
    validityMonths: 2,
    grantedAt: null,
  },
  graceDays: 3,
  reminderDays: [3, 0],
  enabledCountries: [],
};
