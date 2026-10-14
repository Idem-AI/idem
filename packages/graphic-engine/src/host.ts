/**
 * Les PORTS DE L'HÔTE : ce que le moteur demande à l'application qui l'utilise.
 *
 * Le moteur ne connaît ni fournisseur de modèle, ni base de données, ni facturation. L'API IDEM et l'API
 * iVision le branchent chacune à leur runtime d'agents (étages, escalade, suivi d'usage, crédits) — la
 * signature de `AgentCall` est la même que celle de leur runtime. Sans port branché, le moteur fonctionne
 * entièrement : le code décide, aux crans où un agent aurait décidé.
 */
import { BrowserOptions, configureBrowser } from './quality-engine/browser';

export type AgentProfile = 'agents' | 'critic' | 'coder';

/** Un appel de modèle. `validate` permet au runtime d'escalader d'un étage si la réponse est illisible ; `level` règle les plafonds du rôle. */
export type AgentCall = (request: { role: string; profile: AgentProfile; system: string; user: string; validate?: (raw: string) => boolean; level?: import('./contracts/common').CreativityLevel }) => Promise<string>;

export interface EngineLogger {
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
}

export interface FingerprintScope {
  documentType: string;
  /** Marque, projet ou utilisateur : la portée de la mémoire de diversité. */
  key: string;
}

export interface EngineHost {
  /** L'appel d'agent du runtime de l'hôte, pour un utilisateur et un projet. */
  agentCall?: (ctx: { userId?: string; projectId?: string; element?: string }) => AgentCall | undefined;
  /** Modèle de vision : image (base64) + consigne → texte (critique visuelle des crans High+). */
  analyzeImage?: (base64: string, mimeType: string, instruction: string, options?: { maxOutputTokens?: number; purpose?: string }) => Promise<string>;
  logger?: EngineLogger;
  /** Chaque génération rend sa trace (coûts, décisions, réparations) : à l'hôte de la garder. */
  onTrace?: (trace: import('./observability/traces').GenerationTrace) => void;
  /** Mémoire de diversité entre documents : lire et écrire les empreintes récentes d'une portée. */
  recentFingerprints?: (scope: FingerprintScope) => Promise<string[]>;
  rememberFingerprints?: (scope: FingerprintScope, fingerprints: string[]) => Promise<void>;
  browser?: BrowserOptions;
  /**
   * Les fournisseurs de MÉDIAS, par source (utilisateur, projet, capture, génération, banque) : le moteur
   * les essaie dans l'ordre fixe et pose ce qu'ils trouvent. Sans eux, seules les icônes locales (natives).
   */
  assetProviders?: import('./asset-planner').AssetProviders;
  /** Le registre des ressources du projet, commun aux documents et aux vidéos (réutiliser avant de générer). */
  assetRegistry?: import('./asset-planner').AssetRegistry;
}

const silent: EngineLogger = { info: () => undefined, warn: () => undefined, error: () => undefined };
const host: EngineHost = { logger: silent };

/**
 * Branche un hôte (au démarrage du processus). Idempotent : un port ABSENT garde sa valeur ; un port passé
 * à `undefined` est débranché.
 */
export function configureGraphicEngine(next: Partial<EngineHost>): void {
  Object.assign(host, next);
  if (next.browser) configureBrowser(next.browser);
}

export function engineHost(): EngineHost {
  return host;
}

export const log = (): EngineLogger => host.logger ?? silent;
