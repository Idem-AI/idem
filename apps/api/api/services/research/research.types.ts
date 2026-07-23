/**
 * Contrat partagé du "moteur d'équipe de recherche" (research team).
 *
 * Une équipe = un orchestrateur + plusieurs agents spécialisés (chercheurs,
 * rédacteur, vérificateur). Elle produit des livrables (sections de business
 * plan, hypothèses financières…) fondés EXCLUSIVEMENT sur des données réelles
 * récupérées via le grounding Google Search de Gemini. Chaque donnée chiffrée
 * doit porter au moins une source (URL réelle). Aucune statistique inventée.
 *
 * Tous les événements ci-dessous sont diffusés en temps réel (SSE) pour que
 * l'utilisateur voie, à chaque instant, quel agent fait quoi.
 */

/** Rôle d'un agent dans l'équipe. */
export type AgentRole =
  | 'orchestrator'
  | 'researcher'
  | 'writer'
  | 'verifier';

/** État courant d'un agent (pilote l'animation dans l'UI). */
export type AgentStatus =
  | 'queued'
  | 'planning'
  | 'searching'
  | 'reading'
  | 'writing'
  | 'verifying'
  | 'done'
  | 'error';

/**
 * Une source réelle citée, issue des `groundingMetadata` de Gemini.
 * `url` est TOUJOURS une URL renvoyée par le moteur (jamais fabriquée).
 */
export interface ResearchSource {
  /** Identifiant stable dans le livrable (ex: "s1"), sert d'ancre de citation [s1]. */
  id: string;
  title: string;
  url: string;
  domain?: string;
  /** Extrait de texte du livrable que cette source appuie (si disponible). */
  snippet?: string;
  retrievedAt: string;
}

/** Un fait sourcé extrait de la recherche. */
export interface ResearchFinding {
  /** Affirmation factuelle (ex: "Le marché X pesait 4,2 Md$ en 2024"). */
  claim: string;
  /** La donnée chiffrée si présente (ex: "4,2 Md$"). */
  value?: string;
  /** Références vers les sources qui appuient ce fait. */
  sourceIds: string[];
}

/** Résultat d'une passe de recherche pour un brief donné. */
export interface ResearchResult {
  brief: string;
  /** Requêtes réellement exécutées par le moteur (webSearchQueries). */
  queries: string[];
  sources: ResearchSource[];
  findings: ResearchFinding[];
  /** Synthèse fondée produite par l'agent chercheur (avec citations [sN]). */
  narrative: string;
}

/** Problème relevé par l'agent vérificateur. */
export interface VerificationIssue {
  /** Extrait fautif (ex: une statistique non sourcée). */
  claim: string;
  reason: string;
  severity: 'info' | 'warning' | 'critical';
}

/** Verdict de vérification d'une section. */
export interface VerificationVerdict {
  passed: boolean;
  citedClaims: number;
  uncitedClaims: number;
  issues: VerificationIssue[];
}

/** Résultat final d'une section produite par l'équipe. */
export interface ResearchedSection {
  name: string;
  /** Contenu markdown, avec citations inline [sN] et une liste de sources. */
  data: string;
  summary: string;
  sources: ResearchSource[];
  verdict?: VerificationVerdict;
}

/**
 * Spécification d'une section à produire, fournie par le module appelant
 * (business plan, finance…). L'orchestrateur reste agnostique du livrable.
 */
export interface DeliverableSection {
  /** Nom canonique (aligné sur les noms de sections existants). */
  name: string;
  /** Instructions de rédaction spécifiques à cette section. */
  instructions: string;
  /** Si true, l'équipe lance une phase de recherche web sourcée. */
  needsResearch: boolean;
  /**
   * Briefs de recherche explicites (sinon l'orchestrateur les dérive du nom +
   * des instructions + du contexte projet).
   */
  researchBriefs?: string[];
}

// ---------------------------------------------------------------------------
// Événements temps réel (SSE)
// ---------------------------------------------------------------------------

/** Champs communs à tout événement d'agent. */
export interface AgentEventBase {
  ts: string;
  /** Identifiant du run complet (une génération = un runId). */
  runId: string;
  /** Identifiant unique de l'instance d'agent (ex: "researcher:Opportunity"). */
  agentId: string;
  role: AgentRole;
  /** Section concernée (si applicable). */
  section?: string;
}

/** Charge utile d'un événement (sans les champs communs de AgentEventBase). */
export type AgentEventPayload =
  | {
      kind: 'agent_status';
      status: AgentStatus;
      /** Message court, déjà lisible (ex: "Recherche de la taille du marché"). */
      message?: string;
    }
  | { kind: 'search_query'; query: string }
  | { kind: 'source_found'; source: ResearchSource }
  | { kind: 'finding'; finding: ResearchFinding }
  | { kind: 'section_drafted'; section: string; wordCount: number; sourceCount: number }
  | { kind: 'verification'; section: string; verdict: VerificationVerdict }
  | { kind: 'note'; message: string };

export type AgentEvent = AgentEventBase & AgentEventPayload;

/**
 * Enveloppe unifiée diffusée sur le canal SSE. Le champ `type` distingue:
 *  - 'agent_event'      : activité granulaire d'un agent (pour la salle de contrôle).
 *  - 'section_completed': une section est finalisée et persistée.
 *  - 'run_completed'    : toute l'équipe a terminé.
 *  - 'error'            : erreur fatale.
 *
 * Les modules existants continuent d'émettre 'progress'/'completed'/'complete'
 * en parallèle — ce contrat les complète, il ne les remplace pas.
 */
export type ResearchStreamEvent =
  | { type: 'agent_event'; agentEvent: AgentEvent; timestamp: string }
  | {
      type: 'section_completed';
      section: ResearchedSection;
      timestamp: string;
    }
  /** Texte de section en cours de rédaction (streaming, aperçu tronqué). */
  | { type: 'writer_delta'; section: string; preview: string; timestamp: string }
  | { type: 'run_completed'; sectionCount: number; timestamp: string }
  | { type: 'error'; message: string; timestamp: string };

/** Callback d'émission fourni par le contrôleur SSE à l'orchestrateur. */
export type ResearchEmit = (event: ResearchStreamEvent) => Promise<void> | void;
