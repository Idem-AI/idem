import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ProjectModel } from '@idem/shared-models';
import { FinanceService } from '../../dashboard/services/finance.service';
import { CommunicationService } from '../../dashboard/services/ai-agents/communication.service';
import { DeploymentService } from '../../dashboard/services/deployment.service';
import { ProjectService } from '../../dashboard/services/project.service';
import { CookieService } from '../../../shared/services/cookie.service';
import {
  GUIDED_ALWAYS_ALLOWED_PATHS,
  GuidedBlockedAttempt,
  GuidedExternalState,
  GuidedJourneyState,
  GuidedStep,
  GuidedStepDefinition,
  GuidedStepId,
} from '../models/guided-journey.model';

const STORAGE_PREFIX = 'idem_guided_journey_v1';

const EMPTY_EXTERNAL: GuidedExternalState = {
  hasFinance: false,
  hasCommunication: false,
  hasDeployment: false,
};

/** Le projet contient-il une valeur exploitable pour ce chemin ? */
function hasSections(sections: unknown): boolean {
  if (!Array.isArray(sections) || sections.length === 0) return false;
  return sections.some((s: { data?: unknown; summary?: string }) => !!s?.data || !!s?.summary);
}

/** L'URL demandée tombe-t-elle sous l'un de ces préfixes ? */
function matchesPath(path: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/**
 * Les étapes du parcours, dans l'ordre imposé.
 *
 * L'ordre suit la logique de création d'entreprise : on sait d'abord ce qu'on
 * vend et à qui, on se donne une identité, on écrit le plan, on chiffre, on
 * sécurise juridiquement, on construit sa vitrine, on la met en ligne, puis on
 * va chercher les clients.
 */
export const GUIDED_STEPS: readonly GuidedStepDefinition[] = [
  {
    id: 'project',
    icon: 'pi pi-home',
    // Une fois créé, le projet se relit depuis sa page d'accueil ; tant qu'il
    // n'existe pas, la page du parcours renvoie vers la création.
    route: '/project/dashboard',
    paths: ['/project/dashboard'],
    navLabelKey: 'dashboard.sidebar.projectHome',
    required: true,
    estimatedMinutes: 5,
    isDone: (project) =>
      !!project?.id &&
      !!(project.longDescription ?? project.description)?.trim() &&
      !!project.name?.trim() &&
      !!project.type,
  },
  {
    id: 'branding',
    icon: 'pi pi-palette',
    route: '/project/branding',
    // Le workflow de complétion (logo → couleurs → typographie → variations)
    // est le bon point d'entrée tant que la marque n'existe pas ; la page de
    // génération, elle, produit la charte une fois ces choix faits.
    generateRoute: '/project/complete-branding',
    paths: ['/project/branding', '/project/complete-branding', '/project/business-cards'],
    navLabelKey: 'dashboard.sidebar.branding',
    required: true,
    estimatedMinutes: 10,
    isDone: (project) => {
      const branding = project?.analysisResultModel?.branding;
      if (!branding) return false;
      const hasLogo = !!(branding.logo?.svg || branding.logo?.id);
      const hasColors = !!branding.colors?.colors?.primary;
      const hasTypography = !!branding.typography?.primaryFont;
      return hasLogo && hasColors && hasTypography;
    },
  },
  {
    id: 'businessPlan',
    icon: 'pi pi-calendar',
    route: '/project/business-plan',
    generateRoute: '/project/business-plan/generate',
    paths: ['/project/business-plan'],
    navLabelKey: 'dashboard.sidebar.businessPlan',
    required: true,
    estimatedMinutes: 15,
    isDone: (project) => hasSections(project?.analysisResultModel?.businessPlan?.sections),
  },
  {
    id: 'finance',
    icon: 'pi pi-chart-pie',
    route: '/project/finance',
    paths: ['/project/finance', '/project/simulations'],
    navLabelKey: 'dashboard.sidebar.finance',
    required: false,
    estimatedMinutes: 20,
    isDone: (_project, external) => external.hasFinance,
  },
  {
    id: 'pitchDeck',
    icon: 'pi pi-desktop',
    route: '/project/pitch-deck',
    paths: ['/project/pitch-deck'],
    navLabelKey: 'dashboard.sidebar.pitchDeck',
    required: false,
    estimatedMinutes: 10,
    isDone: (project) => hasSections(project?.analysisResultModel?.pitchDeck?.sections),
  },
  {
    id: 'legalDocs',
    icon: 'pi pi-file-edit',
    route: '/project/legal-docs',
    paths: ['/project/legal-docs'],
    navLabelKey: 'dashboard.sidebar.legalDocs',
    required: false,
    estimatedMinutes: 10,
    isDone: (project) => {
      const documents = project?.analysisResultModel?.legalDocs?.documents;
      return Array.isArray(documents) && documents.some((d: { data?: string }) => !!d?.data);
    },
  },
  {
    id: 'development',
    icon: 'pi pi-code',
    route: '/project/development',
    generateRoute: '/project/development/create',
    paths: ['/project/development', '/project/diagrams', '/project/tests'],
    navLabelKey: 'dashboard.sidebar.development',
    required: false,
    estimatedMinutes: 25,
    isDone: (project) => {
      const configs = project?.analysisResultModel?.development?.configs;
      return !!(configs?.mode || configs?.generationType);
    },
  },
  {
    id: 'deployment',
    icon: 'pi pi-send',
    route: '/project/ideploy',
    generateRoute: '/project/deployments/create',
    paths: ['/project/ideploy', '/project/deployments'],
    navLabelKey: 'dashboard.sidebar.deployment',
    required: false,
    estimatedMinutes: 20,
    isDone: (_project, external) => external.hasDeployment,
  },
  {
    id: 'communication',
    icon: 'pi pi-megaphone',
    route: '/project/communication',
    paths: ['/project/communication'],
    navLabelKey: 'dashboard.sidebar.communication',
    required: false,
    estimatedMinutes: 15,
    isDone: (_project, external) => external.hasCommunication,
  },
];

/**
 * Moteur du mode Assisté.
 *
 * Il ne génère rien lui-même : il calcule l'état d'avancement à partir du
 * projet et renvoie l'utilisateur vers les écrans existants du mode Avancé,
 * une étape à la fois. Tout ce qui n'est pas encore atteignable reste
 * verrouillé — dans la sidebar comme dans la barre d'adresse — c'est la
 * garantie qu'un débutant ne se perd pas.
 */
@Injectable({ providedIn: 'root' })
export class GuidedJourneyService {
  private readonly financeService = inject(FinanceService);
  private readonly communicationService = inject(CommunicationService);
  private readonly deploymentService = inject(DeploymentService);
  private readonly projectService = inject(ProjectService);
  private readonly cookieService = inject(CookieService);

  readonly definitions = GUIDED_STEPS;

  /** Projet courant, alimenté par la page du mode Assisté. */
  readonly project = signal<ProjectModel | null>(null);
  /** Modules vivant derrière leur propre endpoint (finance, communication…). */
  readonly external = signal<GuidedExternalState>({ ...EMPTY_EXTERNAL });
  private readonly journey = signal<GuidedJourneyState>(this.emptyState());

  /** Dernière tentative d'accès refusée, consommée par la modale de blocage. */
  readonly blockedAttempt = signal<GuidedBlockedAttempt | null>(null);

  /** Étapes enrichies de leur statut, dans l'ordre du parcours. */
  readonly steps = computed<GuidedStep[]>(() => {
    const project = this.project();
    const external = this.external();
    const skipped = new Set(this.journey().skipped);

    let currentAssigned = false;

    return this.definitions.map((definition, index) => {
      const done = definition.isDone(project, external);
      const isSkipped = !done && skipped.has(definition.id);

      let status: GuidedStep['status'];
      if (done) {
        status = 'done';
      } else if (isSkipped) {
        status = 'skipped';
      } else if (!currentAssigned) {
        status = 'current';
        currentAssigned = true;
      } else {
        status = 'locked';
      }

      return { ...definition, index, status, unlocked: status !== 'locked' };
    });
  });

  /** L'étape sur laquelle l'utilisateur doit travailler ; `null` si tout est fait. */
  readonly currentStep = computed<GuidedStep | null>(
    () => this.steps().find((step) => step.status === 'current') ?? null,
  );

  readonly completedCount = computed(
    () => this.steps().filter((step) => step.status === 'done').length,
  );

  readonly totalCount = computed(() => this.definitions.length);

  /** Progression en pourcentage (étapes passées comprises, pour ne pas bloquer la barre). */
  readonly progress = computed(() => {
    const steps = this.steps();
    const settled = steps.filter((s) => s.status === 'done' || s.status === 'skipped').length;
    return steps.length === 0 ? 0 : Math.round((settled / steps.length) * 100);
  });

  /** Toutes les étapes obligatoires sont terminées. */
  readonly requiredDone = computed(() =>
    this.steps().every((step) => !step.required || step.status === 'done'),
  );

  readonly isJourneyComplete = computed(() => this.currentStep() === null);

  // ───────────────────────────────────────────────────────── accès

  /**
   * Pages ouvertes : celles des étapes terminées — ce qui est produit reste
   * consultable — et celles de l'étape en cours.
   */
  readonly unlockedPaths = computed<string[]>(() =>
    this.steps()
      .filter((step) => step.status === 'done' || step.status === 'current')
      .flatMap((step) => step.paths),
  );

  /** L'URL demandée est-elle accessible dans l'état actuel du parcours ? */
  isRouteAllowed(url: string): boolean {
    const path = this.normalize(url);
    if (matchesPath(path, GUIDED_ALWAYS_ALLOWED_PATHS)) return true;
    return matchesPath(path, this.unlockedPaths());
  }

  /** Étape qui ouvrira cette page, pour expliquer le refus à l'utilisateur. */
  stepForRoute(url: string): GuidedStep | null {
    const path = this.normalize(url);
    return this.steps().find((step) => matchesPath(path, step.paths)) ?? null;
  }

  /** Signale une tentative refusée : la modale de blocage s'ouvre. */
  reportBlocked(url: string): void {
    this.blockedAttempt.set({ url, at: Date.now() });
  }

  dismissBlocked(): void {
    this.blockedAttempt.set(null);
  }

  private normalize(url: string): string {
    const path = url.split('?')[0].split('#')[0];
    const trimmed = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  }

  // ───────────────────────────────────────────────────────── chargement

  /**
   * Recalcule le parcours pour un projet.
   * Sonde en parallèle les modules externes ; une erreur réseau se traduit
   * simplement par « étape non terminée », jamais par un blocage.
   */
  async load(project: ProjectModel | null): Promise<void> {
    this.project.set(project);
    this.journey.set(this.read(project?.id ?? null));

    if (!project?.id) {
      this.external.set({ ...EMPTY_EXTERNAL });
      return;
    }

    const [hasFinance, hasCommunication, hasDeployment] = await Promise.all([
      this.probeFinance(project.id),
      this.probeCommunication(project.id),
      this.probeDeployment(project.id),
    ]);
    this.external.set({ hasFinance, hasCommunication, hasDeployment });
  }

  /**
   * Charge le parcours depuis le projet actif (cookie partagé avec le mode
   * Avancé). Sans `force`, un projet déjà chargé n'est pas retéléchargé.
   */
  async loadFromCookie(force = false): Promise<void> {
    const projectId = this.cookieService.get('projectId');

    if (!projectId) {
      if (force || this.project()) await this.load(null);
      return;
    }
    if (!force && this.project()?.id === projectId) return;

    try {
      const project = await firstValueFrom(this.projectService.getProjectById(projectId));
      await this.load(project ?? null);
    } catch (error) {
      console.error('GuidedJourney: could not load the active project', error);
      await this.load(null);
    }
  }

  private async probeFinance(projectId: string): Promise<boolean> {
    try {
      const finance = await firstValueFrom(this.financeService.getFinance(projectId));
      return (finance?.products?.length ?? 0) > 0 || !!finance?.meta?.lastAutoFilledAt;
    } catch {
      return false;
    }
  }

  private async probeCommunication(projectId: string): Promise<boolean> {
    try {
      const communication = await firstValueFrom(
        this.communicationService.getCommunication(projectId),
      );
      return !!communication?.strategy || (communication?.publications?.length ?? 0) > 0;
    } catch {
      return false;
    }
  }

  private async probeDeployment(projectId: string): Promise<boolean> {
    try {
      const deployments = await firstValueFrom(
        this.deploymentService.getProjectDeployments(projectId),
      );
      return (deployments?.length ?? 0) > 0;
    } catch {
      return false;
    }
  }

  // ───────────────────────────────────────────────────────── actions

  /** Retrouve une étape par son identifiant. */
  step(id: GuidedStepId): GuidedStep | undefined {
    return this.steps().find((s) => s.id === id);
  }

  /**
   * Passe une étape facultative. Les étapes obligatoires sont ignorées :
   * la contrainte du mode Assisté n'est pas contournable.
   */
  skip(id: GuidedStepId): boolean {
    const definition = this.definitions.find((s) => s.id === id);
    if (!definition || definition.required) return false;
    if (this.journey().skipped.includes(id)) return true;
    this.persist({ ...this.journey(), skipped: [...this.journey().skipped, id] });
    return true;
  }

  /** Reprend une étape passée pour la traiter finalement. */
  unskip(id: GuidedStepId): void {
    this.persist({
      ...this.journey(),
      skipped: this.journey().skipped.filter((s) => s !== id),
    });
  }

  /** Remet le parcours à zéro pour le projet courant (les livrables restent). */
  resetSkipped(): void {
    this.persist({ ...this.journey(), skipped: [] });
  }

  // ───────────────────────────────────────────────────────── persistance

  private emptyState(): GuidedJourneyState {
    return { version: 1, skipped: [], updatedAt: '' };
  }

  private storageKey(projectId: string | null): string {
    return projectId ? `${STORAGE_PREFIX}_${projectId}` : STORAGE_PREFIX;
  }

  private read(projectId: string | null): GuidedJourneyState {
    try {
      const raw = localStorage.getItem(this.storageKey(projectId));
      if (!raw) return this.emptyState();
      const parsed = JSON.parse(raw) as GuidedJourneyState;
      if (parsed?.version !== 1) return this.emptyState();
      return { ...this.emptyState(), ...parsed, skipped: parsed.skipped ?? [] };
    } catch {
      return this.emptyState();
    }
  }

  private persist(state: GuidedJourneyState): void {
    const next = { ...state, updatedAt: new Date().toISOString() };
    this.journey.set(next);
    try {
      localStorage.setItem(this.storageKey(this.project()?.id ?? null), JSON.stringify(next));
    } catch {
      // Stockage indisponible : le parcours reste valable pour la session
    }
  }
}
