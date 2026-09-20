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
 * Principe de dégradation : si l'API de facturation est injoignable, on
 * autorise. Empêcher de générer parce qu'un service auxiliaire est tombé
 * coûterait plus cher que quelques générations non facturées.
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
  authorization?: string;
  action: BillableAction;
  projectId?: string;
}): Promise<ConsumeResult> {
  // Sans jeton, l'utilisateur n'est pas identifiable : la facturation ne peut
  // pas s'appliquer, et c'est à l'API IDEM de refuser les actions sensibles.
  if (!options.authorization) return { allowed: true };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${IDEM_API_URL}/billing/consume`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: options.authorization,
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

    if (!response.ok) {
      // 4xx/5xx inattendu : on n'empêche pas de travailler pour autant.
      console.warn(`[billing] /billing/consume a répondu ${response.status} — génération autorisée`);
      return { allowed: true };
    }

    const payload = (await response.json()) as { cost?: number; balance?: number };
    return { allowed: true, cost: payload.cost, balance: payload.balance };
  } catch (error) {
    console.warn(
      `[billing] API de facturation injoignable (${(error as Error).message}) — génération autorisée`
    );
    return { allowed: true };
  } finally {
    clearTimeout(timeout);
  }
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
