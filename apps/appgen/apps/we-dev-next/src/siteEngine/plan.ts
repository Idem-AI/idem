/**
 * LE PLAN D'UNE GÉNÉRATION — la liste des choses à faire, écrite dans le projet avant la première section et cochée
 * au fur et à mesure (`idem.plan.json`). Si la génération s'interrompt (page actualisée, connexion coupée), le site
 * garde ce qui était fait et le plan dit ce qui reste : « continue » (ou `/continue`) reprend là, sans refaire ni
 * refacturer ce qui existe.
 *
 *   idem.plan.json       les étapes et leur état (à faire, fait, en échec) — petit, réécrit à chaque étape
 *   idem.manifest.json   ce que la reprise doit retrouver sans rappeler l'architecte ni le directeur artistique :
 *                        le manifeste, le style des visuels, le thème
 *
 * Le plan est écrit par le code, jamais par un modèle : une case cochée veut dire que le fichier est écrit.
 */
import type { MediaStyle } from './media/mediaDirector.js';
import type { SiteManifest } from './manifest.js';
import type { SiteStream } from './stream.js';
import type { RedesignFocus } from './redesign/brief.js';

export const PLAN_PATH = 'idem.plan.json';
export const MANIFEST_PATH = 'idem.manifest.json';

export type StepStatus = 'pending' | 'done' | 'failed';

export interface PlanStep {
  id: string;
  label: string;
  status: StepStatus;
  /** Le fichier que l'étape écrit (composants). */
  path?: string;
}

export interface SitePlan {
  version: 1;
  kind: 'site-engine';
  status: 'running' | 'done';
  request: string;
  language: string;
  languages: string[];
  /** Une refonte : de quoi retrouver le contenu de l'ancien site (relevé déjà stocké dans le projet). */
  redesign?: { projectId: string; url: string; choice: 'identity' | 'direct'; focus: RedesignFocus };
  startedAt: string;
  updatedAt: string;
  steps: PlanStep[];
}

/** Ce que la reprise relit au lieu de le redemander aux modèles. */
export interface SavedDesign {
  manifest: SiteManifest;
  mediaStyle: MediaStyle;
  themeSummary: string;
}

export function readPlan(files: Record<string, string> | undefined): SitePlan | null {
  try {
    const plan = JSON.parse(files?.[PLAN_PATH] ?? '');
    return plan && plan.kind === 'site-engine' && Array.isArray(plan.steps) ? (plan as SitePlan) : null;
  } catch {
    return null;
  }
}

export function readSavedDesign(files: Record<string, string> | undefined): SavedDesign | null {
  try {
    const saved = JSON.parse(files?.[MANIFEST_PATH] ?? '');
    return saved?.manifest?.pages?.length ? (saved as SavedDesign) : null;
  } catch {
    return null;
  }
}

/** Une génération partie et pas terminée. */
export const isIncomplete = (plan: SitePlan | null): plan is SitePlan => !!plan && plan.status !== 'done' && plan.steps.some((step) => step.status !== 'done');

/** Ce qui reste, en clair (pour la conversation). */
export function remaining(plan: SitePlan): PlanStep[] {
  return plan.steps.filter((step) => step.status !== 'done');
}

/** Le plan, coché à chaque étape et réécrit dans le projet. */
export class PlanTracker {
  constructor(
    private readonly stream: SiteStream,
    readonly plan: SitePlan
  ) {}

  static create(stream: SiteStream, init: Omit<SitePlan, 'version' | 'kind' | 'status' | 'startedAt' | 'updatedAt'>): PlanTracker {
    const now = new Date().toISOString();
    const tracker = new PlanTracker(stream, { version: 1, kind: 'site-engine', status: 'running', startedAt: now, updatedAt: now, ...init });
    tracker.write();
    return tracker;
  }

  /** Reprend un plan existant : ses étapes faites restent cochées. */
  static resume(stream: SiteStream, plan: SitePlan): PlanTracker {
    return new PlanTracker(stream, { ...plan, status: 'running' });
  }

  status(id: string): StepStatus | undefined {
    return this.plan.steps.find((step) => step.id === id)?.status;
  }

  done(id: string): boolean {
    return this.status(id) === 'done';
  }

  /** Ajoute les étapes qui manquent (le manifeste les fait connaître après coup), sans toucher aux autres. */
  add(steps: Omit<PlanStep, 'status'>[]): void {
    for (const step of steps) if (!this.plan.steps.some((s) => s.id === step.id)) this.plan.steps.push({ ...step, status: 'pending' });
    this.write();
  }

  mark(id: string, status: StepStatus): void {
    const step = this.plan.steps.find((s) => s.id === id);
    if (!step || step.status === status) return;
    step.status = status;
    this.write();
  }

  finish(): void {
    this.plan.status = 'done';
    this.write();
  }

  private write(): void {
    this.plan.updatedAt = new Date().toISOString();
    this.stream.file(PLAN_PATH, `${JSON.stringify(this.plan, null, 2)}\n`);
  }
}
