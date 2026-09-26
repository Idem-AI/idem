import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BrandingService } from '../../../../services/ai-agents/branding.service';
import {
  PdfFormatSelectorComponent,
  PdfFormat,
} from '../../components/pdf-format-selector/pdf-format-selector';
import { CookieService } from '../../../../../../shared/services/cookie.service';
import { GenerationService } from '../../../../../../shared/services/generation.service';
import { SSEGenerationState, SSEStep } from '../../../../../../shared/models/sse-step.model';
import { BrandIdentityModel } from '../../../../models/brand-identity.model';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { ProjectService } from '../../../../services/project.service';
import { expectedBrandingSections, StoredBranding } from '../../../../models/branding-charter';
import { BRANDING_PAGE_FORMATS } from '../../../document-editor/adapters/branding-editor.adapter';
import { RenderContext } from '../../../document-editor/models/editor.types';
import { buildTimeline, GenerationPhase, phaseOfPage } from './generation-chapters';
import { GenerationStageIllustrationComponent } from './generation-stage-illustration';
import { LivePagePreviewComponent } from './live-page-preview';

@Component({
  selector: 'app-branding-generation',
  imports: [
    TranslateModule,
    PdfFormatSelectorComponent,
    IdemLoaderComponent,
    GenerationStageIllustrationComponent,
    LivePagePreviewComponent,
  ],
  templateUrl: './branding-generation.html',
  styleUrl: './branding-generation.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrandingGenerationComponent implements OnInit, OnDestroy {
  private readonly brandingService = inject(BrandingService);
  private readonly generationService = inject(GenerationService);
  private readonly cookieService = inject(CookieService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);
  private readonly projectService = inject(ProjectService);
  private readonly destroy$ = new Subject<void>();

  // Outputs
  readonly brandingGenerated = output<BrandIdentityModel>();

  // Signals for reactive state management
  protected readonly projectId = signal<string | null>(null);
  protected readonly pdfFormat = signal<string>('SLIDE_16_9');
  protected readonly isSelectingFormat = signal<boolean>(true);
  protected readonly isPostProcessing = signal<boolean>(false);
  protected readonly postProcessingMessage = signal<string>(
    this.translate.instant('dashboard.brandingGeneration.postProcessing'),
  );
  protected readonly generationState = signal<SSEGenerationState>({
    steps: [],
    stepsInProgress: [],
    completedSteps: [],
    totalSteps: 0,
    completed: false,
    error: null,
    isGenerating: false,
  });

  // Computed properties using the new generation state
  protected readonly isGenerating = computed(() => this.generationState().isGenerating);
  protected readonly generationError = computed(() => this.generationState().error);
  protected readonly completedSteps = computed(() =>
    this.generationState().steps.filter((step) => step.status === 'completed'),
  );
  protected readonly hasCompletedSteps = computed(() =>
    this.generationService.hasCompletedSteps(this.generationState()),
  );
  protected readonly totalSteps = computed(() => this.generationState().totalSteps);
  protected readonly completedCount = computed(() => this.generationState().completedSteps);
  protected readonly progressPercentage = computed(() =>
    this.generationService.calculateProgress(this.generationState()),
  );

  // ── Suivi en direct ────────────────────────────────────────────────────

  /** Pages attendues, dans l'ordre de la charte (ciblées lors d'une régénération). */
  private readonly expectedPages = signal<readonly string[]>([]);
  /** Polices de la marque, pour que l'aperçu en direct soit la vraie page. */
  protected readonly renderContext = signal<RenderContext>({ dark: false });
  private readonly startedAt = signal<number | null>(null);
  private readonly now = signal(Date.now());
  private ticker: ReturnType<typeof setInterval> | null = null;
  /** Page choisie dans le déroulé ; `null` = suivre la dernière page produite. */
  protected readonly pinnedPage = signal<string | null>(null);

  protected readonly pageFormat = computed(
    () => BRANDING_PAGE_FORMATS[this.pdfFormat()] ?? BRANDING_PAGE_FORMATS['SLIDE_16_9'],
  );
  protected readonly isPortrait = computed(() => this.pdfFormat() === 'A4_PORTRAIT');

  protected readonly timeline = computed(() => {
    const state = this.generationState();
    return buildTimeline(this.expectedPages(), state.stepsInProgress, state.completedSteps);
  });

  protected readonly pageCount = computed(() =>
    this.timeline().reduce((total, chapter) => total + chapter.pages.length, 0),
  );
  protected readonly donePages = computed(() =>
    this.timeline().reduce((total, chapter) => total + chapter.done, 0),
  );
  /** Progression sur les pages ATTENDUES : le flux ne compte que celles déjà annoncées. */
  protected readonly progress = computed(() => {
    if (this.isPostProcessing()) return 100;
    const total = this.pageCount();
    return total > 0 ? Math.min(99, Math.round((this.donePages() / total) * 100)) : 0;
  });

  /** Phase montrée par l'illustration : celle de la page en cours. */
  protected readonly phase = computed<GenerationPhase>(() => {
    if (this.isPostProcessing()) return 'finalize';
    const active = this.generationState().stepsInProgress[0];
    if (active) return phaseOfPage(active);
    const next = this.timeline()
      .flatMap((chapter) => chapter.pages)
      .find((page) => page.status !== 'done');
    return next ? phaseOfPage(next.name) : 'finalize';
  });

  /** Pages produites, avec leur contenu, dans l'ordre d'arrivée. */
  private readonly readyPages = computed(() =>
    this.generationState().steps.filter((step) => step.status === 'completed' && step.content),
  );
  /** Page affichée : celle choisie, sinon la dernière arrivée. */
  protected readonly shownPage = computed<SSEStep | null>(() => {
    const ready = this.readyPages();
    const pinned = this.pinnedPage();
    const chosen = pinned ? ready.find((step) => step.name === pinned) : undefined;
    return chosen ?? (ready.length > 0 ? ready[ready.length - 1] : null);
  });
  protected readonly shownIndex = computed(() => {
    const name = this.shownPage()?.name;
    return this.timeline()
      .flatMap((chapter) => chapter.pages)
      .find((page) => page.name === name)?.index;
  });

  protected readonly elapsed = computed(() => {
    const start = this.startedAt();
    return start ? formatDuration(this.now() - start) : '0:00';
  });
  /** Temps restant estimé, dès que trois pages donnent une cadence fiable. */
  protected readonly remaining = computed(() => {
    const start = this.startedAt();
    const done = this.donePages();
    const left = this.pageCount() - done;
    if (!start || done < 3 || left <= 0 || this.isPostProcessing()) return null;
    return Math.max(1, Math.ceil((((this.now() - start) / done) * left) / 60000));
  });

  private isForcingRegeneration = false;
  private targetSections: string[] = [];

  ngOnInit(): void {
    this.projectId.set(this.cookieService.get('projectId'));
    this.isForcingRegeneration = this.route.snapshot.queryParams['force'] === 'true';

    const sectionsParam = this.route.snapshot.queryParams['sections'];
    this.targetSections =
      typeof sectionsParam === 'string' && sectionsParam.length > 0
        ? sectionsParam.split(',').filter(Boolean)
        : [];

    // Régénération ciblée : le format PDF a déjà été choisi lors de la
    // génération initiale, on saute l'écran de sélection et on lance direct.
    if (this.targetSections.length > 0) {
      const formatParam = this.route.snapshot.queryParams['format'];
      if (typeof formatParam === 'string' && formatParam.length > 0) {
        this.pdfFormat.set(formatParam);
      }
      this.isSelectingFormat.set(false);
      this.generateBranding();
      return;
    }

    // Start with format selection screen
    this.isSelectingFormat.set(true);
  }

  /**
   * Pages attendues et polices de la marque, lues sur le projet. Sans elles,
   * le déroulé ne montrerait que les pages déjà annoncées par le flux, et
   * l'aperçu s'afficherait dans une police système.
   */
  private loadProjectContext(): void {
    this.expectedPages.set(this.targetSections.length > 0 ? this.targetSections : expectedBrandingSections(undefined));
    const projectId = this.projectId();
    if (!projectId) return;
    this.projectService
      .getProjectById(projectId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (project) => {
          const branding = project?.analysisResultModel?.branding as
            | (StoredBranding & { typography?: { primaryFont?: string; secondaryFont?: string; url?: string } })
            | undefined;
          if (this.targetSections.length === 0) {
            this.expectedPages.set(expectedBrandingSections(branding));
          }
          this.renderContext.set({
            dark: false,
            primaryFont: branding?.typography?.primaryFont,
            secondaryFont: branding?.typography?.secondaryFont,
            fontUrl: branding?.typography?.url,
          });
        },
      });
  }

  /** Affiche une page produite ; un second clic reprend le suivi en direct. */
  protected showPage(name: string): void {
    this.pinnedPage.update((current) => (current === name ? null : name));
  }

  protected followLive(): void {
    this.pinnedPage.set(null);
  }

  /** Aller à la charte sans attendre la fin de l'enregistrement affichée. */
  protected openCharterNow(): void {
    this.stopTicker();
    // Annule la redirection automatique encore en attente.
    this.isPostProcessing.set(false);
    this.router.navigate(['/project/branding/display']);
  }

  private startTicker(): void {
    this.stopTicker();
    this.startedAt.set(Date.now());
    this.now.set(Date.now());
    this.ticker = setInterval(() => this.now.set(Date.now()), 1000);
  }

  private stopTicker(): void {
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
  }

  ngOnDestroy(): void {
    this.stopTicker();
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Handle format selection and start generation
   */
  protected onFormatSelected(format: PdfFormat): void {
    this.pdfFormat.set(format);
    console.log('PDF format selected:', format);
    this.isSelectingFormat.set(false);
    this.generateBranding();
  }

  /**
   * Generate new branding using SSE for real-time updates
   */
  protected generateBranding(): void {
    if (!this.projectId()) {
      console.error('Project ID not found');
      return;
    }

    // Reset state for new generation
    this.resetGenerationState();
    this.pinnedPage.set(null);
    this.loadProjectContext();
    this.startTicker();
    console.log('Starting branding generation with SSE and format:', this.pdfFormat(), 'force:', this.isForcingRegeneration);

    // Create SSE connection for branding generation with format
    const sseConnection = this.brandingService.createBrandIdentityModel(
      this.projectId()!,
      this.pdfFormat(),
      this.isForcingRegeneration,
      this.targetSections,
    );

    this.generationService
      .startGeneration('branding', sseConnection)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (state: SSEGenerationState) => {
          console.log('Branding generation state updated:', state);
          this.generationState.set(state);

          // Check if generation is completed
          if (state.completed && !state.isGenerating) {
            this.handleGenerationComplete(state);
          }
        },
        error: (err) => {
          this.stopTicker();
          console.error(`Error generating branding for project ID: ${this.projectId()}:`, err);
          this.generationState.update((state) => ({
            ...state,
            error: this.translate.instant('dashboard.brandingGeneration.errors.failed'),
            isGenerating: false,
          }));
        },
        complete: () => {
          console.log('Branding generation completed');
        },
      });
  }

  /**
   * Reset generation state for new generation
   */
  private resetGenerationState(): void {
    this.generationState.set({
      steps: [],
      stepsInProgress: [],
      completedSteps: [],
      totalSteps: 0,
      completed: false,
      error: null,
      isGenerating: true,
    });
  }

  /**
   * Cancel ongoing generation
   */
  protected cancelGeneration(): void {
    this.stopTicker();
    this.generationService.cancelGeneration('branding');
    this.generationState.update((state) => ({
      ...state,
      isGenerating: false,
      error: this.translate.instant('dashboard.brandingGeneration.cancelled'),
    }));
  }

  /**
   * Handle generation completion - add 4 second delay before redirect
   */
  private handleGenerationComplete(state: SSEGenerationState): void {
    console.log('Branding generation completed:', state);

    // Start post-processing phase with loading
    this.isPostProcessing.set(true);
    this.postProcessingMessage.set(this.translate.instant('dashboard.brandingGeneration.saving'));

    this.stopTicker();
    // Wait 4 seconds to allow backend to complete saving
    setTimeout(() => {
      if (!this.isPostProcessing()) return;
      console.log('Post-processing complete, redirecting to branding display');
      this.isPostProcessing.set(false);
      // Redirect to display the generated branding PDF and elements
      this.router.navigate(['/project/branding/display']);
    }, 4000);
  }
}

/** « 1:05 », « 12:40 » : minutes et secondes écoulées. */
function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
