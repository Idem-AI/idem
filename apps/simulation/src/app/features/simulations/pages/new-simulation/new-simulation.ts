import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

import { ToastService } from '../../../../core/ui/toast.service';
import { DisclaimerNote } from '../../../../shared/components/disclaimer-note/disclaimer-note';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { SimulationGateway, SimulationStore } from '../../data-access';
import {
  KnowledgeItem,
  LinkedProject,
  ProjectUnderstanding,
  SimulationOrigin,
  SimulationPlan,
  SimulationPricing,
  SimulationTier,
} from '../../models';

type Step = 'source' | 'analysis' | 'plan';

const KNOWLEDGE_ORDER: KnowledgeItem['state'][] = ['known', 'researchable', 'uncertain', 'missing'];

/**
 * The three things that must happen before a run is billed: pick the project,
 * agree on what the engine actually knows about it, and confirm the price.
 *
 * Analysis deliberately comes before payment. The user sees the gaps in their
 * own project before spending anything.
 */
@Component({
  selector: 'sim-new-simulation',
  imports: [FormsModule, RouterLink, TranslatePipe, PageHeader, DisclaimerNote],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './new-simulation.html',
})
export class NewSimulation {
  private readonly gateway = inject(SimulationGateway);
  private readonly store = inject(SimulationStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toasts = inject(ToastService);
  private readonly translate = inject(TranslateService);

  protected readonly step = signal<Step>('source');
  protected readonly origin = signal<SimulationOrigin>('idem-project');

  protected readonly projects = signal<readonly LinkedProject[]>([]);
  protected readonly projectsLoading = signal(true);
  protected readonly selectedProjectId = signal<string | null>(null);
  protected readonly selectedFile = signal<File | null>(null);

  protected readonly understanding = signal<ProjectUnderstanding | null>(null);
  protected readonly analysing = signal(false);
  protected readonly answers = signal<Record<string, string>>({});

  protected readonly pricing = signal<SimulationPricing | null>(null);
  protected readonly selectedTier = signal<SimulationTier>('pack');
  protected readonly launching = signal(false);

  protected readonly selectedProject = computed(() =>
    this.projects().find((project) => project.id === this.selectedProjectId()) ?? null,
  );

  protected readonly canAnalyse = computed(() =>
    this.origin() === 'idem-project' ? !!this.selectedProjectId() : !!this.selectedFile(),
  );

  /** Grouped so the four states read as four different kinds of claim. */
  protected readonly knowledgeGroups = computed(() => {
    const items = this.understanding()?.items ?? [];
    return KNOWLEDGE_ORDER.map((state) => ({
      state,
      items: items.filter((item) => item.state === state),
    })).filter((group) => group.items.length > 0);
  });

  /** Declared here rather than inline in the template so both stay typed. */
  protected readonly steps: readonly { id: Step; index: number }[] = [
    { id: 'source', index: 1 },
    { id: 'analysis', index: 2 },
    { id: 'plan', index: 3 },
  ];

  /** Profile rows, skipping whatever the analysis could not fill in. */
  protected readonly profileRows = computed<readonly { labelKey: string; value: string }[]>(() => {
    const profile = this.understanding()?.profile;
    if (!profile) {
      return [];
    }
    const rows: { labelKey: string; value: string | undefined }[] = [
      { labelKey: 'profile.sector', value: profile.sector },
      { labelKey: 'profile.businessModel', value: profile.businessModel },
      { labelKey: 'profile.targetCustomer', value: profile.targetCustomer },
      { labelKey: 'profile.market', value: profile.market },
      { labelKey: 'profile.location', value: `${profile.location}, ${profile.country}` },
      { labelKey: 'profile.pricePoint', value: profile.pricePoint },
      { labelKey: 'profile.plannedFunding', value: profile.plannedFunding },
      { labelKey: 'profile.teamSize', value: profile.teamSize },
    ];
    return rows.filter((row): row is { labelKey: string; value: string } => !!row.value);
  });

  protected readonly openQuestions = computed(() =>
    (this.understanding()?.items ?? []).filter((item) => item.answerable),
  );

  constructor() {
    void this.loadProjects();
  }

  private async loadProjects(): Promise<void> {
    try {
      const projects = await firstValueFrom(this.gateway.listProjects());
      this.projects.set(projects);

      // Arriving from the dashboard's "Simuler mon entreprise" button.
      const preselected = this.route.snapshot.queryParamMap.get('projectId');
      if (preselected && projects.some((project) => project.id === preselected)) {
        this.selectedProjectId.set(preselected);
      }
    } catch {
      this.projects.set([]);
    } finally {
      this.projectsLoading.set(false);
    }
  }

  protected chooseOrigin(origin: SimulationOrigin): void {
    this.origin.set(origin);
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile.set(input.files?.[0] ?? null);
  }

  protected async analyse(): Promise<void> {
    if (!this.canAnalyse()) {
      return;
    }

    this.analysing.set(true);
    this.step.set('analysis');
    try {
      const projectId = this.selectedProjectId();
      const file = this.selectedFile();
      const understanding =
        this.origin() === 'idem-project' && projectId
          ? await firstValueFrom(this.gateway.analyseProject(projectId))
          : await firstValueFrom(this.gateway.analyseDocument(file as File));
      this.understanding.set(understanding);
    } catch (error) {
      this.step.set('source');
      this.toasts.error(
        this.translate.instant('newRun.analysisFailed') as string,
        error instanceof Error ? error.message : undefined,
      );
    } finally {
      this.analysing.set(false);
    }
  }

  protected setAnswer(itemId: string, value: string): void {
    this.answers.update((current) => ({ ...current, [itemId]: value }));
  }

  protected async goToPlan(): Promise<void> {
    this.step.set('plan');
    if (this.pricing()) {
      return;
    }
    try {
      const pricing = await firstValueFrom(this.gateway.getPricing(this.origin()));
      this.pricing.set(pricing);
      this.selectedTier.set(
        pricing.plans.find((plan) => plan.recommended)?.tier ?? pricing.plans[0].tier,
      );
    } catch (error) {
      this.toasts.error(
        this.translate.instant('newRun.pricingFailed') as string,
        error instanceof Error ? error.message : undefined,
      );
    }
  }

  protected async launch(): Promise<void> {
    this.launching.set(true);
    try {
      const simulation = await this.store.create({
        name: this.runName(),
        origin: this.origin(),
        projectId: this.selectedProjectId() ?? undefined,
        documentName: this.selectedFile()?.name,
        tier: this.selectedTier(),
        answers: this.answers(),
      });
      await this.router.navigate(['/simulations', simulation.id]);
    } catch (error) {
      this.toasts.error(
        this.translate.instant('newRun.launchFailed') as string,
        error instanceof Error ? error.message : undefined,
      );
    } finally {
      this.launching.set(false);
    }
  }

  protected back(): void {
    this.step.update((current) => (current === 'plan' ? 'analysis' : 'source'));
  }

  protected planPrice(plan: SimulationPlan): string {
    return `${plan.price.toLocaleString('fr-FR')} ${plan.currency}`;
  }

  protected planListPrice(plan: SimulationPlan): string | null {
    return plan.listPrice ? `${plan.listPrice.toLocaleString('fr-FR')} ${plan.currency}` : null;
  }

  private runName(): string {
    const project = this.selectedProject();
    if (project) {
      return project.name;
    }
    const file = this.selectedFile();
    return file ? file.name.replace(/\.[^.]+$/, '') : (this.translate.instant('newRun.title') as string);
  }
}
