/**
 * Journal de consommation IA — un événement par appel de modèle.
 *
 * Chaque génération de la plateforme (section de projet, variante de logo,
 * régénération, édition ciblée, appgen…) produit un document. C'est la source
 * de vérité pour répondre à « qui a consommé quoi, sur quel projet, sur quel
 * élément, et combien ça a coûté », y compris pour les variantes proposées puis
 * abandonnées par l'utilisateur.
 */

/** Nature de l'opération, pour distinguer un premier jet d'une reprise. */
export type AiUsageOperation =
  /** Première génération d'une section / d'un élément. */
  | 'generate'
  /** Relance complète d'un élément déjà généré. */
  | 'regenerate'
  /** Édition ciblée assistée par IA (section-editing). */
  | 'edit'
  /** Une proposition parmi plusieurs, dont l'utilisateur ne retiendra qu'une. */
  | 'variant'
  /** Analyse / interprétation sans production de contenu persisté. */
  | 'analysis'
  /** Échange conversationnel (advisor, chat projet). */
  | 'chat'
  /** Génération d'application via appgen. */
  | 'appgen'
  /** Origine non déterminée. */
  | 'other';

/** Statut de l'appel : les échecs sont journalisés, ils consomment aussi des tokens. */
export type AiUsageStatus = 'success' | 'error';

export interface AiUsageEventModel {
  id?: string;

  // --- Qui / quoi -----------------------------------------------------------
  /** uid de l'utilisateur à l'origine de l'appel ; absent pour un appel système. */
  userId?: string;
  /** Projet concerné, quand l'appel s'inscrit dans un projet. */
  projectId?: string;
  /**
   * Fonctionnalité de haut niveau : `branding`, `businessPlan`, `design`,
   * `landing`, `development`, `communication`, `finance`, `pitchDeck`,
   * `legalDocs`, `advisor`, `onboarding`, `deployment`, `appgen`, `coherence`…
   * Aligné sur les clés de `analysisResultModel` quand c'est pertinent, pour
   * pouvoir croiser coût et contenu produit.
   */
  feature: string;
  /**
   * Élément précis à l'intérieur de la fonctionnalité : `logo`, `typography`,
   * `colors`, `sections`, `businessCard`, `mockup`, ou un nom d'étape de
   * génération. C'est le niveau que le panel admin affiche « par élément de
   * projet ».
   */
  element?: string;
  operation: AiUsageOperation;

  // --- Variantes ------------------------------------------------------------
  /**
   * Nombre de propositions demandées dans le même geste utilisateur (4 logos,
   * 3 palettes…). `1` pour une génération simple.
   */
  variantCount?: number;
  /** Rang de la variante produite par cet appel (0-based), si applicable. */
  variantIndex?: number;
  /**
   * Groupe logique reliant les variantes d'un même geste utilisateur, pour
   * pouvoir additionner le coût réel d'un « choix de logo » (toutes les
   * propositions, pas seulement celle retenue).
   */
  batchId?: string;

  // --- Modèle ---------------------------------------------------------------
  provider: string;
  modelName: string;
  /** Vrai si le tarif appliqué est le tarif par défaut (modèle hors table). */
  pricingEstimated?: boolean;

  // --- Consommation ---------------------------------------------------------
  inputTokens: number;
  outputTokens: number;
  /** Tokens d'entrée servis depuis le cache de contexte (facturés moins cher). */
  cachedInputTokens?: number;
  totalTokens: number;
  /**
   * Vrai quand le fournisseur n'a pas renvoyé de métadonnées d'usage et que les
   * tokens sont estimés à partir de la longueur du texte. Le panel admin le
   * signale : un total mêlant mesures et estimations ne doit pas passer pour
   * une facture.
   */
  tokensEstimated?: boolean;
  estimatedCostUsd: number;

  // --- Contexte d'exécution -------------------------------------------------
  status: AiUsageStatus;
  errorMessage?: string;
  durationMs?: number;
  /** `promptType` déclaré par l'appelant (restrictions, quotas). */
  promptType?: string;
  /** requestId de corrélation (voir utils/trace.util.ts). */
  requestId?: string;
  /** Route à l'origine de l'appel, ex. `POST /project/brandings/generate`. */
  source?: string;

  /** Jour `YYYY-MM-DD` (UTC) — dénormalisé pour les agrégations par période. */
  day: string;

  createdAt?: Date;
  updatedAt?: Date;
}

/** Métadonnées d'usage renvoyées par un fournisseur, normalisées. */
export interface ProviderTokenUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  /** Vrai si les valeurs sont estimées faute de métadonnées fournisseur. */
  estimated?: boolean;
}
