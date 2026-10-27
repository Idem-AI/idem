/**
 * Ce que la refonte demande à l'API IDEM, au nom de l'utilisateur (sa session relayée, comme pour la
 * facturation et les médias) : lire le site et en faire (ou compléter) un projet, relire ce projet, et
 * générer sa charte. Ce serveur n'a ni navigateur, ni stockage, ni portefeuille.
 */
import { ProjectModel } from '../../types/project.js';
import { traceHeaders } from '../../utils/trace.js';
import type { SiteInventory } from './inventory.js';

const base = () => (process.env.IDEM_API_URL || 'http://localhost:3001').replace(/\/+$/, '');

/** Une réponse de refus de l'API, avec son statut (403 accord, 429 quota, 402 portefeuille…). */
export class IdemApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: Record<string, unknown>
  ) {
    super(message);
  }
}

export interface SiteContent {
  url: string;
  title: string;
  description?: string;
  language: string;
  headings: string[];
  paragraphs: string[];
  voice: { brandName?: string; businessType?: string; valueProposition?: string; tone?: string; keywords?: string[]; language?: string };
  styleEvidence: string;
  pages: string[];
  images: string[];
  logo: boolean;
  /** Le relevé complet (toutes les pages et sections, fichiers recopiés chez nous). */
  inventory: SiteInventory;
  /** Les couleurs du site vont-elles avec son logo ? */
  brandCheck?: { coherent: boolean; sitePrimary: string; logoColors: string[]; distance: number };
  palettes?: { site?: string; logo?: string };
}

export interface SiteImportResult {
  projectId: string;
  reused: boolean;
  name: string;
  siteUrl: string;
  logo: boolean;
  fonts: { display: string; body: string; copied: string[] };
  warnings: string[];
  content?: SiteContent;
}

export type SiteImportStep = 'open' | 'colors' | 'fonts' | 'logo' | 'content' | 'voice' | 'art' | 'done' | 'project' | 'logo-variations' | 'typography' | 'art-direction' | 'patterns' | 'pages' | 'assets';

async function request<T>(path: string, credentials: Record<string, string>, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 20_000);
  const outer = init.signal;
  const abort = () => controller.abort();
  outer?.addEventListener('abort', abort, { once: true });
  try {
    const response = await fetch(`${base()}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...credentials, ...traceHeaders(), ...((init.headers as Record<string, string>) ?? {}) },
      signal: controller.signal,
    });
    const text = await response.text();
    let body: Record<string, unknown> | undefined;
    try {
      body = text ? (JSON.parse(text) as Record<string, unknown>) : undefined;
    } catch {
      body = undefined;
    }
    if (!response.ok) throw new IdemApiError(String(body?.message || body?.error || response.statusText), response.status, body);
    return body as T;
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener('abort', abort);
  }
}

/**
 * Lit le site et en fait le projet (ou complète le projet ouvert). L'avancement est relu toutes les deux
 * secondes et rendu étape par étape ; la promesse se résout avec le résultat.
 */
export async function importSite(options: {
  url: string;
  credentials: Record<string, string>;
  projectId?: string;
  consent?: boolean;
  signal: AbortSignal;
  onStep: (step: SiteImportStep) => void;
}): Promise<SiteImportResult> {
  const started = await request<{ jobId: string }>('/appgen/site-import', options.credentials, {
    method: 'POST',
    body: JSON.stringify({ url: options.url, ...(options.projectId ? { projectId: options.projectId } : {}), ...(options.consent ? { consent: { privacy: true, terms: true, beta: true } } : {}) }),
    signal: options.signal,
  });
  let last: SiteImportStep | null = null;
  // Lecture de la marque + relevé de toutes les pages + recopie des fichiers : plusieurs minutes au pire.
  const deadline = Date.now() + 12 * 60_000;
  while (Date.now() < deadline) {
    if (options.signal.aborted) throw new IdemApiError('aborted', 499);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const job = await request<{ status: string; step: SiteImportStep; result?: SiteImportResult; error?: { code: string; message: string } }>(
      `/appgen/site-import/${encodeURIComponent(started.jobId)}`,
      options.credentials,
      { signal: options.signal }
    ).catch((error) => {
      // Une relecture manquée (réseau) n'arrête pas le suivi ; une session perdue, si.
      if (error instanceof IdemApiError && (error.status === 401 || error.status === 404)) throw error;
      return null;
    });
    if (!job) continue;
    if (job.step !== last) {
      last = job.step;
      options.onStep(job.step);
    }
    if (job.status === 'done' && job.result) return job.result;
    if (job.status === 'failed') throw new IdemApiError(job.error?.message || 'import_failed', 502, { error: job.error?.code });
  }
  throw new IdemApiError('timeout', 504);
}

/** Le contenu d'une refonte déjà relevée (reprise après une question). */
export function fetchSiteContent(projectId: string, credentials: Record<string, string>, signal: AbortSignal): Promise<SiteContent> {
  return request<SiteContent>(`/appgen/site-import/project/${encodeURIComponent(projectId)}/content`, credentials, { signal, timeoutMs: 30_000 });
}

/** La palette retenue : celle du site (par défaut) ou celle tirée du logo. */
export function chooseSitePalette(projectId: string, source: 'site' | 'logo', credentials: Record<string, string>, signal: AbortSignal): Promise<{ chosen: string | null }> {
  return request(`/appgen/site-import/project/${encodeURIComponent(projectId)}/palette`, credentials, { method: 'POST', body: JSON.stringify({ source }), signal });
}

/** Le projet tel que l'atelier le charge (même route que le client). */
export function fetchProject(projectId: string, credentials: Record<string, string>, signal: AbortSignal): Promise<ProjectModel> {
  return request<ProjectModel>(`/projects/${encodeURIComponent(projectId)}`, credentials, { signal });
}

/**
 * Génère le document de la charte dans IDEM (même route, même prix que le dashboard) et suit son flux. Se
 * résout à la fin ; un refus (402 portefeuille, 429 quota, 403 accord) est levé avant tout travail.
 */
export async function generateCharter(options: {
  projectId: string;
  credentials: Record<string, string>;
  creativity?: string;
  signal: AbortSignal;
  onStep: (name: string) => void;
}): Promise<void> {
  const query = options.creativity ? `?creativity=${encodeURIComponent(options.creativity)}` : '';
  const response = await fetch(`${base()}/project/brandings/generate/${encodeURIComponent(options.projectId)}${query}`, {
    headers: { ...options.credentials, ...traceHeaders(), Accept: 'text/event-stream' },
    signal: options.signal,
  });
  if (!response.ok || !response.body) {
    const body = (await response.json().catch(() => undefined)) as Record<string, unknown> | undefined;
    throw new IdemApiError(String(body?.message || body?.error || response.statusText), response.status, body);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let failed: string | null = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let cut: number;
    while ((cut = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);
      const data = block
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .join('');
      if (!data) continue;
      try {
        const event = JSON.parse(data) as { type?: string; stepName?: string; error?: string };
        if (event.error) failed = String(event.error).slice(0, 200);
        if (event.stepName && event.type !== 'completed') options.onStep(event.stepName);
      } catch {
        /* une ligne illisible n'arrête pas le suivi */
      }
    }
  }
  if (failed) throw new IdemApiError(failed, 502);
}
