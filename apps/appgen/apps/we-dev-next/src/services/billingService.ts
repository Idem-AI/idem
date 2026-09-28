/**
 * Facturation des générations AppGen.
 *
 * Le moteur de génération vit ici, mais **le barème vit dans l'API IDEM**. Ce
 * service ne décide donc rien : il demande l'autorisation avec le jeton de
 * l'utilisateur, et relaie le refus tel quel.
 *
 * Deux raisons à ce détour plutôt qu'un contrôle local :
 *
 *  - un barème dupliqué finit toujours par diverger de son original, et c'est
 *    l'argent des clients qui en paie l'écart ;
 *  - le débit doit être **atomique** avec le solde, ce que seul le service qui
 *    tient le compteur peut garantir.
 *
 * Principe de dégradation : fermé par défaut. Sans identité, si l'API de
 * facturation est injoignable ou répond une erreur, la génération est refusée
 * avec un message invitant à réessayer — jamais offerte.
 */

const IDEM_API_URL = process.env.IDEM_API_URL || 'http://localhost:3001';

/** Délai court : ce contrôle précède une génération, il ne doit pas la retarder. */
const TIMEOUT_MS = 8_000;

export type BillableAction = 'initial_generation' | 'message' | 'build' | 'premium';

export interface ConsumeResult {
  allowed: boolean;
  /** Corps du refus, à renvoyer tel quel au client (message, offres, solde). */
  refusal?: Record<string, unknown>;
  cost?: number;
  balance?: number;
}

/**
 * Demande l'autorisation de générer.
 *
 * `authorization` est l'en-tête reçu du client, relayé sans modification :
 * l'API IDEM authentifie l'utilisateur lui-même, ce serveur n'a aucun secret
 * à porter.
 */
export async function consumeGeneration(options: {
  /** Preuves d'identité de l'appelant (cookie de session et/ou Bearer). */
  credentials: Record<string, string>;
  action: BillableAction;
  projectId?: string;
}): Promise<ConsumeResult> {
  // Fermé par défaut : sans identité, pas de génération. L'ancien « autorisé »
  // rendait AppGen gratuit pour quiconque omettait l'en-tête.
  if (!options.credentials.Authorization && !options.credentials.Cookie) {
    return { allowed: false, refusal: unavailable('authentication_required', 'Connectez-vous à IDEM.') };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${IDEM_API_URL}/billing/consume`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.credentials,
      },
      body: JSON.stringify({
        engine: 'appgen',
        action: options.action,
        projectId: options.projectId,
      }),
      signal: controller.signal,
    });

    if (response.status === 402) {
      const refusal = (await response.json()) as Record<string, unknown>;
      return { allowed: false, refusal };
    }

    if (response.status === 401 || response.status === 403) {
      return { allowed: false, refusal: unavailable('authentication_required', 'Session expirée : reconnectez-vous.') };
    }

    if (!response.ok) {
      // Une erreur du moteur de facturation ne doit pas devenir une génération
      // gratuite : on refuse et on invite à réessayer.
      console.warn(`[billing] /billing/consume a répondu ${response.status} — génération refusée`);
      return { allowed: false, refusal: unavailable('billing_unavailable', 'Facturation momentanément indisponible, réessayez.') };
    }

    const payload = (await response.json()) as { allowed?: boolean; cost?: number; balance?: number };
    if (payload.allowed === false) {
      return { allowed: false, refusal: payload as Record<string, unknown> };
    }
    return { allowed: true, cost: payload.cost, balance: payload.balance };
  } catch (error) {
    console.warn(
      `[billing] API de facturation injoignable (${(error as Error).message}) — génération refusée`
    );
    return { allowed: false, refusal: unavailable('billing_unavailable', 'Facturation momentanément indisponible, réessayez.') };
  } finally {
    clearTimeout(timeout);
  }
}

function unavailable(error: string, message: string): Record<string, unknown> {
  return { error, message };
}

/**
 * Quelle action facturer pour cette requête.
 *
 * Le modèle iCode distingue la **génération initiale** (gratuite, plafonnée
 * par jour) des **modifications** (au barème). On les reconnaît au nombre de
 * messages : une conversation qui commence ne contient que la demande de
 * l'utilisateur.
 */
export function resolveBillableAction(
  messageCount: number,
  mode: 'chat' | 'builder'
): BillableAction {
  if (mode === 'builder' && messageCount <= 1) return 'initial_generation';
  // Le mode conversation ne construit pas : il vaut un message.
  return mode === 'chat' ? 'message' : 'build';
}
