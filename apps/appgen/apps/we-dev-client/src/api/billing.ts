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
 * sont les actes de possession — ils supposent un Project Pass (999 F) ou un
 * abonnement qui l'inclut.
 */

const IDEM_API = process.env.REACT_APP_IDEM_API_BASE_URL || 'http://localhost:3001';
const DASHBOARD = process.env.REACT_APP_IDEM_MAIN_APP_URL || 'http://localhost:4200';

/** Produit qui débloque un projet, tel qu'il figure au catalogue. */
export const PROJECT_PASS_CODE = 'appgen-project-pass';

export interface BillingMe {
  credits: { business: number; appgen: number; ideploy: number };
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

/** Réponse 402 de l'API : ce qui manque, et les offres qui le débloquent. */
export interface PaymentRequired {
  error: 'payment_required' | 'plan_upgrade_required';
  message: string;
  engine?: string;
  action?: string;
  cost?: number;
  balance?: number;
  missing?: number;
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

/** Vrai quand l'API refuse faute de crédits ou de plan. */
export function isPaymentRequired(response: Response): boolean {
  return response.status === 402;
}

/** Lit le détail d'un refus 402, pour afficher autre chose qu'« erreur 402 ». */
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

/** Raccourci : débloquer le projet courant. */
export function openProjectPassCheckout(projectId: string | null): void {
  openCheckout({ productCode: PROJECT_PASS_CODE, projectId, engine: 'appgen' });
}
