/**
 * LES PORTS DE L'HÔTE — ce que le moteur partagé demande à l'application qui l'exécute.
 *
 * Le core (`apps/ivision/core`) contient toute la logique créative : graphe, motifs,
 * planificateur, agents, film d'auteur, moteur React, rendu. Il ne connaît ni MongoDB, ni
 * MinIO, ni les fournisseurs de modèles, ni la facturation : deux hôtes l'exécutent, chacun
 * avec ses branchements :
 *
 *   API IDEM    apps/api/api/services/ivision/host.ts      (projets IDEM, crédits, MinIO)
 *   API iVision apps/ivision/api/src/core-host.ts          (marques scannées, mêmes crédits)
 *
 * Un port non branché a un repli sûr (journal sur la console, URL locale) ou lève une
 * erreur claire quand l'appel est indispensable (stockage, génération d'image).
 */
import type { AgentCall } from '../creativity/orchestrator';
import { CoreLogger, setCoreLogger } from './logger';

export interface StoredFile {
  fileName?: string;
  filePath?: string;
  downloadURL: string;
}

/** Stockage d'objets (MinIO/S3 chez les deux hôtes). */
export interface CoreStorage {
  uploadFile(content: Buffer | string, fileName: string, folder: string, contentType?: string): Promise<StoredFile>;
}

export interface GeneratedImageLike {
  buffer: Buffer;
  mimeType: string;
  model: string;
}

export type VisionPurpose = 'visual-analysis' | 'shot-critic' | 'reference' | 'site';
export interface VisionOptions {
  maxOutputTokens?: number;
  temperature?: number;
  purpose?: VisionPurpose;
}

export type ImagePurpose = 'video-still' | 'visual-background';
export interface ImageOptions {
  /** Taille demandée (« 1024x1024 ») ; absente : celle du modèle. */
  size?: string;
  tag: string;
  purpose?: ImagePurpose;
  /** Modèle imposé par l'appelant (la charte graphique d'IDEM), sinon celui de l'hôte. */
  model?: string;
  fallbackModel?: string;
}

export interface CoreHost {
  /** URL publique de l'API qui sert les médias et les sons du moteur. */
  apiBaseUrl: () => string;
  /** URL publique d'un effet sonore de la sonothèque (route servie par l'hôte). */
  sfxUrl: (publicName: string) => string;
  storage?: CoreStorage;
  /**
   * Modèle de vision : image (base64) + consigne → texte. `purpose` dit à l'hôte quel modèle
   * prendre (analyse d'une photo de visuel, critique d'un plan, lecture d'un modèle, d'un site).
   */
  analyzeImage?: (base64: string, mimeType: string, instruction: string, options?: VisionOptions) => Promise<string>;
  /** Génération d'une image (photo d'illustration, jamais de texte). */
  generateImage?: (prompt: string, options: ImageOptions) => Promise<GeneratedImageLike>;
  /** Client Google GenAI (clips Veo). */
  googleGenAI?: () => any;
  /** Appel d'agent créatif (runtime d'agents de l'hôte : étages, escalade, suivi d'usage). */
  agentCall?: (ctx: { userId?: string; projectId?: string; element?: string }) => AgentCall | undefined;
  /** Restitue des crédits (export en échec après la réponse HTTP). */
  refundCredits?: (userId: string, cost: number, meta: { action: string; note: string }) => Promise<void>;
}

const host: CoreHost = {
  apiBaseUrl: () => (process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3001}`).replace(/\/+$/, ''),
  sfxUrl: (name) => `${host.apiBaseUrl()}/project/communication/sfx/${name}`,
};

/** Branche un hôte (au démarrage du processus, avant toute création). */
export function configureCore(next: Partial<CoreHost> & { logger?: CoreLogger }): void {
  const { logger, ...ports } = next;
  if (logger) setCoreLogger(logger);
  Object.assign(host, Object.fromEntries(Object.entries(ports).filter(([, v]) => v !== undefined)));
}

export function coreHost(): CoreHost {
  return host;
}

/** Un port indispensable : son absence est une erreur de configuration de l'hôte, dite clairement. */
export function requirePort<K extends keyof CoreHost>(name: K): NonNullable<CoreHost[K]> {
  const port = host[name];
  if (!port) throw new Error(`ivision-core: port « ${String(name)} » non branché par l'hôte (configureCore)`);
  return port as NonNullable<CoreHost[K]>;
}
