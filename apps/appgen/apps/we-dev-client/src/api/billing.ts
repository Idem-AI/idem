/**
 * Facturation, côté AppGen.
 *
 * AppGen ne réimplémente pas de parcours de paiement : il interroge l'API IDEM
 * pour savoir ce que l'utilisateur a le droit de faire, et renvoie vers la page
 * de paiement du dashboard quand il faut débloquer quelque chose. Une seule
 * interface de paiement existe dans tout IDEM, donc une seule à maintenir et à
 * auditer.
 *
 * Le modèle économique d'iCode tient en une phrase : **générer est gratuit,
 * posséder se paie**. Télécharger le code, l'envoyer sur GitHub ou le déployer
 * sont les actes de possession — ils supposent le Pass Projet (1 000 F, payé depuis le
 * portefeuille IDEM, 30 modifications incluses), un Pack Lancement ou la bêta.
 */

const IDEM_API = process.env.REACT_APP_IDEM_API_BASE_URL || 'http://localhost:3001';
const DASHBOARD = process.env.REACT_APP_IDEM_MAIN_APP_URL || 'http://localhost:4200';

/** Produit qui débloque un projet, tel qu'il figure au catalogue. */
export const PROJECT_PASS_CODE = 'appgen-project-pass';

export interface BillingMe {
  credits: { business: number; appgen: number; ideploy: number };
  /** Le portefeuille IDEM (en francs) et les modifications iCode incluses restantes. */
  offer?: { walletXaf: number; modifications: number; projectPassVouchers: number };
  walletXaf?: number;
  subscriptions: {
    engine: string;
    productCode: string;
    status: string;
    complimentary: boolean;
    currentPeriodEnd?: string;
  }[];
  beta: { windowOpen: boolean; endsAt?: string | null };
  enforcement: 'off' | 'log' | 'enforce';
}

/**
 * Refus de l'API : 402 (ce qui manque, et les offres qui le débloquent) ou 429
 * (quota d'usage atteint : groupe, fenêtre, date de renouvellement, offre supérieure).
 */
export interface PaymentRequired {
  error: 'payment_required' | 'plan_upgrade_required' | 'quota_exceeded';
  message: string;
  /** Quota : la fenêtre atteinte et la date à laquelle elle se renouvelle. */
  window?: 'day' | 'week' | 'month';
  resetsAt?: string;
  engine?: string;
  action?: string;
  cost?: number;
  balance?: number;
  missing?: number;
  /** Modèle au portefeuille : prix, solde, manque et recharge suggérée, en francs. */
  priceXaf?: number;
  balanceXaf?: number;
  missingXaf?: number;
  topupXaf?: number;
  projectId?: string;
  suggestions?: { productCode: string; name: string; priceXaf: number; credits: number }[];
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * Droits de l'utilisateur : crédits par moteur, abonnements, statut bêta.
 *
 * Renvoie `null` plutôt que de lever : l'atelier de génération doit rester
 * utilisable même si la facturation est momentanément indisponible. Le serveur
 * reste seul juge au moment d'agir.
 */
export async function fetchBillingMe(): Promise<BillingMe | null> {
  try {
    const response = await fetch(`${IDEM_API}/billing/me`, {
      headers: authHeaders(),
      credentials: 'include',
    });

    if (!response.ok) return null;
    return (await response.json()) as BillingMe;
  } catch {
    return null;
  }
}

/** Ce projet est-il débloqué (Project Pass acheté, ou plan qui l'inclut) ? */
export async function fetchProjectAccess(projectId: string): Promise<boolean | null> {
  try {
    const response = await fetch(
      `${IDEM_API}/billing/access/appgen/${encodeURIComponent(projectId)}`,
      { headers: authHeaders(), credentials: 'include' }
    );

    if (!response.ok) return null;
    const payload = (await response.json()) as { unlocked?: boolean };
    return Boolean(payload.unlocked);
  } catch {
    return null;
  }
}

/** Vrai quand l'API refuse faute de crédits, de plan ou de quota d'usage. */
export function isPaymentRequired(response: Response): boolean {
  return response.status === 402 || response.status === 429;
}

/** Lit le détail d'un refus 402 ou 429, pour afficher autre chose qu'« erreur 402 ». */
export async function readPaymentRequired(response: Response): Promise<PaymentRequired | null> {
  try {
    return (await response.json()) as PaymentRequired;
  } catch {
    return null;
  }
}

/**
 * Envoie l'utilisateur payer, puis le ramène ici.
 *
 * `returnUrl` est l'adresse courante : après paiement, il revient exactement là
 * où il en était, avec `?payment=<référence>&status=completed` — de quoi
 * reprendre l'action qu'il tentait.
 */
export function openCheckout(options: {
  productCode: string;
  projectId?: string | null;
  engine?: string;
  returnUrl?: string;
}): void {
  const params = new URLSearchParams({
    product: options.productCode,
    app: 'appgen',
    returnUrl: options.returnUrl ?? window.location.href,
  });

  if (options.projectId) params.set('projectId', options.projectId);
  if (options.engine) params.set('engine', options.engine);

  window.location.href = `${DASHBOARD}/billing/checkout?${params.toString()}`;
}

/**
 * Recharge le portefeuille dans le dashboard (mobile money), puis — une fois l'argent
 * encaissé — fait l'achat `then` depuis le portefeuille, et ramène ici.
 */
export function openTopUp(options: { amountXaf: number; then?: Record<string, unknown>; returnUrl?: string }): void {
  const params = new URLSearchParams({
    product: 'wallet-topup',
    amount: String(options.amountXaf),
    app: 'appgen',
    returnUrl: options.returnUrl ?? window.location.href,
  });
  if (options.then) params.set('then', JSON.stringify(options.then));
  window.location.href = `${DASHBOARD}/billing/checkout?${params.toString()}`;
}

/**
 * Le Pass Projet depuis le portefeuille : un Pass prépayé (Pack Lancement) s'il y en a un, sinon
 * 1 000 F. Solde insuffisant : la recharge exacte, puis l'achat, puis retour ici.
 */
export async function buyProjectPass(projectId: string): Promise<{ ok: true; message: string } | { ok: false; message: string; redirected?: boolean }> {
  try {
    const response = await fetch(`${IDEM_API}/billing/offers/buy`, {
      method: 'POST',
      headers: authHeaders(),
      credentials: 'include',
      body: JSON.stringify({ kind: 'icode_project_pass', projectId }),
    });
    const body = (await response.json().catch(() => ({}))) as PaymentRequired & { ok?: boolean };
    if (response.ok) return { ok: true, message: body.message };
    if (response.status === 402) {
      openTopUp({ amountXaf: body.topupXaf ?? body.missingXaf ?? 1000, then: { kind: 'icode_project_pass', projectId } });
      return { ok: false, message: body.message, redirected: true };
    }
    return { ok: false, message: body.message };
  } catch {
    return { ok: false, message: '' };
  }
}

/** Raccourci historique : débloquer le projet courant (achat depuis le portefeuille). */
export function openProjectPassCheckout(projectId: string | null): void {
  if (projectId) void buyProjectPass(projectId);
}
