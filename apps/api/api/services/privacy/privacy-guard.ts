/**
 * IDEM Privacy Guard — le dernier contrôle avant qu'une requête de modèle ne quitte IDEM.
 *
 * Chaque corps de requête envoyé à un fournisseur de modèles (chat, outils, flux,
 * recherche web, image, vidéo, voix) passe par `guardModelRequest` juste avant
 * l'envoi. Le garde :
 *   1. vérifie que le sous-traitant est inscrit au registre et accepte le niveau
 *      de la donnée (`config/data-governance.ts`) ;
 *   2. vérifie que la finalité déclarée autorise ce niveau sans consentement ;
 *   3. pose la politique de transmission du fournisseur. Pour OpenRouter :
 *      `provider.data_collection = 'deny'` TOUJOURS, fusionné en profondeur.
 *
 * Pourquoi en profondeur : jusqu'au 18/11/2026, la politique vivait dans le
 * `extraBody` du fournisseur et était étalée à plat avec celui de l'appel ; dès
 * qu'un appelant posait son propre `provider` (l'orchestrateur créatif le fait à
 * chaque appel pour les quantifications), `data_collection: 'deny'` disparaissait
 * et les projets partaient vers des hébergeurs qui conservent les requêtes.
 *
 * Le garde ne lit ni ne journalise le contenu : la décision se fonde sur les
 * métadonnées déclarées (niveau, finalité), jamais sur le texte du prompt.
 */
import {
  type Classification,
  type Purpose,
  PROCESSORS,
  processorAccepts,
  purposeAllows,
} from '../../config/data-governance';

export type ModelProcessor = 'openrouter' | 'idem_selfhosted';

export interface TransmissionContext {
  /** Niveau de la donnée la plus sensible du corps. Défaut : L2 (contenu de projet). */
  classification?: Classification;
  /** Défaut : SERVICE_DELIVERY — un appel de service n'est jamais réutilisé pour autre chose. */
  purpose?: Purpose;
}

export class PrivacyGuardError extends Error {
  readonly status = 451;
  readonly code = 'privacy_guard_refused';
  constructor(message: string) {
    super(message);
    this.name = 'PrivacyGuardError';
  }
}

/** Zéro conservation stricte (sous-ensemble des hébergeurs) : opt-in, réduit la résilience. */
function zeroRetentionRequired(): boolean {
  return (process.env.OPENROUTER_ZDR ?? 'off').toLowerCase() === 'on';
}

/** La politique imposée à OpenRouter, quels que soient les réglages de l'appelant. */
export function openRouterTransmissionPolicy(): Record<string, unknown> {
  return { data_collection: 'deny', ...(zeroRetentionRequired() ? { zdr: true } : {}) };
}

/**
 * Applique la politique au corps (sans le muter) ou refuse l'envoi.
 * À appeler sur le corps FINAL, après toutes les fusions de réglages.
 */
export function guardModelRequest<T extends Record<string, any>>(
  processor: ModelProcessor,
  body: T,
  context: TransmissionContext = {}
): T {
  const classification = context.classification ?? 'L2';
  const purpose = context.purpose ?? 'SERVICE_DELIVERY';

  if (!PROCESSORS[processor]) {
    throw new PrivacyGuardError(`Sous-traitant « ${processor} » absent du registre de gouvernance`);
  }
  if (!processorAccepts(processor, classification)) {
    throw new PrivacyGuardError(`${processor} n'est pas autorisé à recevoir des données ${classification}`);
  }
  if (!purposeAllows(purpose, classification)) {
    throw new PrivacyGuardError(`La finalité ${purpose} n'autorise pas des données ${classification} sans consentement`);
  }

  if (processor !== 'openrouter') return body;
  const callerProvider = body.provider && typeof body.provider === 'object' ? body.provider : {};
  // La politique passe EN DERNIER : un appelant ne peut pas la relâcher.
  return { ...body, provider: { ...callerProvider, ...openRouterTransmissionPolicy() } };
}
