/**
 * Generic SSE Step Event interface that can be used for all AI generation features
 */
export interface SSEStepEvent {
  type: 'progress' | 'completed';
  stepName: string;
  data: string;
  summary: string;
  timestamp: string;
  parsedData: {
    status: 'progress' | 'completed';
    stepsInProgress?: string[];
    completedSteps?: string[];
    stepName?: string;
  };
}

/**
 * Generic SSE Step interface
 */
export interface SSEStep {
  name: string;
  status: 'pending' | 'in-progress' | 'completed';
  content?: string;
  timestamp?: string;
  summary?: string;
}

/**
 * Generic SSE Generation State interface
 */
export interface SSEGenerationState {
  isGenerating: boolean;
  steps: SSEStep[];
  stepsInProgress: string[];
  completedSteps: string[];
  totalSteps: number;
  completed: boolean;
  error: string | null;
  /** État "salle de contrôle" de l'équipe d'agents (mode recherche sourcée). */
  research?: ResearchConsoleState;
}

// ---------------------------------------------------------------------------
// Équipe d'agents de recherche — miroir du contrat backend research.types.ts
// ---------------------------------------------------------------------------

export type AgentRole = 'orchestrator' | 'researcher' | 'writer' | 'verifier';

export type AgentStatus =
  | 'queued'
  | 'planning'
  | 'searching'
  | 'reading'
  | 'writing'
  | 'verifying'
  | 'done'
  | 'error';

/** Une source web réelle citée (URL toujours réelle, issue du grounding). */
export interface ResearchSourceItem {
  id: string;
  title: string;
  url: string;
  domain?: string;
}

export interface VerificationVerdict {
  passed: boolean;
  citedClaims: number;
  uncitedClaims: number;
  issues?: { claim: string; reason: string; severity: 'info' | 'warning' | 'critical' }[];
}

/** Un agent tel que suivi par la salle de contrôle. */
export interface ConsoleAgent {
  agentId: string;
  role: AgentRole;
  section?: string;
  status: AgentStatus;
  message?: string;
  /** Compteurs pour la carte d'agent. */
  queryCount: number;
  sourceCount: number;
  lastUpdate: string;
}

/** Une entrée du flux d'activité chronologique. */
export interface ConsoleActivity {
  ts: string;
  role: AgentRole;
  agentId: string;
  section?: string;
  kind: 'agent_status' | 'search_query' | 'source_found' | 'finding' | 'section_drafted' | 'verification' | 'note';
  /** Texte déjà lisible pour l'affichage. */
  text: string;
  /** Source associée (kind = source_found). */
  source?: ResearchSourceItem;
}

/** Résultat d'une section produite par l'équipe (contenu + sources + verdict). */
export interface ConsoleSection {
  name: string;
  wordCount?: number;
  sourceCount?: number;
  verdict?: VerificationVerdict;
}

/** État complet de la salle de contrôle, dérivé du flux d'événements. */
export interface ResearchConsoleState {
  active: boolean;
  /** Agents suivis, indexés par agentId (ordre d'apparition). */
  agents: ConsoleAgent[];
  /** Flux d'activité (le plus récent en dernier), plafonné. */
  activities: ConsoleActivity[];
  /** Requêtes de recherche exécutées (dédupliquées, récentes en dernier). */
  queries: string[];
  /** Sources réelles collectées (dédupliquées par URL). */
  sources: ResearchSourceItem[];
  /** Sections finalisées avec leur verdict. */
  sections: ConsoleSection[];
  /** Aperçu du texte de la section en cours de rédaction (streaming). */
  draft?: { section: string; preview: string };
}

// ---------------------------------------------------------------------------
// Enveloppes d'événements reçues sur le canal SSE (mode recherche)
// ---------------------------------------------------------------------------

export interface AgentEventEnvelope {
  type: 'agent_event';
  timestamp: string;
  agentEvent: {
    ts: string;
    runId: string;
    agentId: string;
    role: AgentRole;
    section?: string;
    kind: ConsoleActivity['kind'];
    status?: AgentStatus;
    message?: string;
    query?: string;
    source?: ResearchSourceItem;
    finding?: { claim: string; sourceIds: string[] };
    wordCount?: number;
    sourceCount?: number;
    verdict?: VerificationVerdict;
  };
}

export interface SectionCompletedEnvelope {
  type: 'section_completed';
  timestamp: string;
  section: {
    name: string;
    data: string;
    summary: string;
    sources: ResearchSourceItem[];
    verdict?: VerificationVerdict;
  };
}

/**
 * SSE Connection Configuration
 */
export interface SSEConnectionConfig {
  url: string;
  keepAlive?: boolean;
  reconnectionDelay?: number;
  maxRetries?: number;
}

/**
 * SSE Event types
 */
export type SSEEventType =
  | 'progress'
  | 'completed'
  | 'completion'
  | 'steps_list'
  | 'started'
  | 'error';

/**
 * SSE Service Event Types
 */
export type SSEServiceEventType =
  | 'diagram'
  | 'branding'
  | 'logo'
  | 'logo-variations'
  | 'business-plan'
  | 'pitch-deck'
  | 'legal-docs'
  | 'finance-fill';
