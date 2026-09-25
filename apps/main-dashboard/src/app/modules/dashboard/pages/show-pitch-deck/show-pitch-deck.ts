import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CookieService } from '../../../../shared/services/cookie.service';
import { PitchDeckService } from '../../services/ai-agents/pitch-deck.service';
import { PitchDeckModel } from '../../models/pitchDeck.model';
import { SSEStepEvent } from '../../../../shared/models/sse-step.model';
import { DocumentPreviewComponent } from '../../components/document-preview/document-preview';
import { BrandingValidationService } from '../../services/branding-validation.service';
import { IncompleteProjectBannerComponent } from '../../components/incomplete-project-banner/incomplete-project-banner';
import {
  analyzeGenerationCompleteness,
  PITCH_DECK_SECTION_NAMES,
} from '../../models/generation-completeness';
import { ProjectService } from '../../services/project.service';
import { ProjectModel } from '@idem/shared-models';
import { pitchDeckTypeLabel } from '../../utils/deliverable-labels';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';

type StepStatus = 'pending' | 'in-progress' | 'completed';

interface GenerationStep {
  name: string;
  status: StepStatus;
}

/** Classes d'une ligne de progression, par statut. */
const STEP_CLASSES: Record<StepStatus, string> = {
  pending: 'border-[var(--glass-border-subtle)] bg-[var(--glass-bg-subtle)]',
  'in-progress': 'border-primary/40 bg-primary/5',
  completed: 'border-primary/20 bg-primary/4',
};

/**
 * Un pitch deck du projet (`/project/pitch-deck/:documentId`) : aperçu,
 * génération et régénération. La liste des decks est une page à part.
 */
@Component({
  selector: 'app-show-pitch-deck',
  imports: [TranslateModule, DocumentPreviewComponent, IncompleteProjectBannerComponent, IdemLoaderComponent],
  templateUrl: './show-pitch-deck.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowPitchDeck implements OnInit {
  private readonly pitchDeckService = inject(PitchDeckService);
  private readonly cookieService = inject(CookieService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly brandingValidation = inject(BrandingValidationService);
  private readonly projectService = inject(ProjectService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly stepClasses = STEP_CLASSES;

  /** Deck affiché, désigné par l'URL. */
  protected readonly documentId = signal<string | null>(
    this.route.snapshot.paramMap.get('documentId'),
  );
  protected readonly projectId = signal<string | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly pitchDeck = signal<PitchDeckModel | null>(null);
  /** Le deck désigné n'existe pas (supprimé, lien d'un autre projet). */
  protected readonly notFound = signal(false);
  protected readonly isGenerating = signal(false);
  protected readonly steps = signal<GenerationStep[]>([]);
  protected readonly errorMessage = signal<string | null>(null);

  // Branding validation
  protected readonly isBrandingComplete = signal<boolean>(false);
  protected readonly brandingMissingElements = signal<string[]>([]);
  protected readonly project = signal<ProjectModel | null>(null);

  /**
   * La page est ouverte juste après la création du deck (`?generate=true`) :
   * la génération démarre d'elle-même, une seule fois.
   */
  private autoStart = this.route.snapshot.queryParamMap.get('generate') === 'true';

  /** Slides attendues : celles du type du deck (levée, banque, commercial…). */
  protected readonly expectedSlides = computed<readonly string[]>(() => {
    const expected = this.pitchDeck()?.expectedSectionNames;
    return expected?.length ? expected : PITCH_DECK_SECTION_NAMES;
  });

  protected readonly completedCount = computed(
    () => this.steps().filter((s) => s.status === 'completed').length,
  );

  protected readonly completeness = computed(() =>
    analyzeGenerationCompleteness(this.expectedSlides(), this.pitchDeck()?.sections),
  );

  protected readonly typeLabel = computed(() =>
    pitchDeckTypeLabel(this.translate, this.pitchDeck()?.type),
  );

  protected readonly heading = computed(() => this.pitchDeck()?.name || this.typeLabel());

  ngOnInit(): void {
    const pid = this.cookieService.get('projectId');
    this.projectId.set(pid);
    if (!pid) {
      this.isLoading.set(false);
      return;
    }
    this.checkBrandingCompletion(pid);
  }

  /**
   * Check if project branding is complete before loading content
   */
  private checkBrandingCompletion(projectId: string): void {
    this.projectService.getProjectById(projectId).subscribe({
      next: (project) => {
        this.project.set(project);
        const { isComplete, missingElements } =
          this.brandingValidation.checkBrandingCompletion(project);

        this.isBrandingComplete.set(isComplete);
        this.brandingMissingElements.set(missingElements);

        // Only load pitch deck if branding is complete
        if (isComplete) {
          this.loadPitchDeck(projectId);
        } else {
          this.isLoading.set(false);
        }
      },
      error: (error) => {
        console.error('Error checking branding completion:', error);
        this.isLoading.set(false);
        this.errorMessage.set(this.translate.instant('dashboard.showPitchDeck.errors.load'));
      },
    });
  }

  /**
   * Charge le deck. Le PDF n'est plus récupéré ici : l'aperçu rend les sections
   * directement et ne demande le PDF qu'au téléchargement.
   */
  private loadPitchDeck(projectId: string): void {
    const documentId = this.documentId();
    if (!documentId) {
      this.notFound.set(true);
      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);
    this.pitchDeckService
      .getPitchDeck(projectId, documentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (deck) => {
          this.pitchDeck.set(deck);
          this.notFound.set(false);
          this.isLoading.set(false);
          this.startIfJustCreated(deck);
        },
        error: (error: { status?: number }) => {
          this.pitchDeck.set(null);
          this.notFound.set(error?.status === 404);
          if (error?.status !== 404) {
            this.errorMessage.set(this.translate.instant('dashboard.showPitchDeck.errors.load'));
          }
          this.isLoading.set(false);
        },
      });
  }

  private startIfJustCreated(deck: PitchDeckModel): void {
    if (!this.autoStart) return;
    this.autoStart = false;
    // Retiré de l'URL : recharger la page ne relance pas une génération facturée.
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { generate: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    if (deck.sections.length === 0) this.startGeneration();
  }

  protected startGeneration(force = false, sections: string[] = []): void {
    const pid = this.projectId();
    const documentId = this.documentId();
    if (!pid || !documentId) return;
    this.errorMessage.set(null);
    this.isGenerating.set(true);

    // Les slides conservées par une reprise ou une régénération ciblée sont déjà
    // faites : la progression part d'elles plutôt que de zéro.
    const done = new Set(
      force
        ? []
        : (this.pitchDeck()?.sections ?? [])
            .filter((section) => typeof section.data === 'string' && section.data.trim() !== '')
            .map((section) => section.name)
            .filter((name) => !sections.includes(name)),
    );
    this.steps.set(
      this.expectedSlides().map((name) => ({
        name,
        status: done.has(name) ? ('completed' as const) : ('pending' as const),
      })),
    );

    this.pitchDeckService
      .generatePitchDeck(pid, force, sections, documentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (event: SSEStepEvent) => this.handleSseEvent(event),
        error: (err) => {
          console.error('Pitch deck generation error:', err);
          this.errorMessage.set(
            this.translate.instant('dashboard.showPitchDeck.errors.generation'),
          );
          this.isGenerating.set(false);
        },
        complete: () => {
          this.isGenerating.set(false);
          this.loadPitchDeck(pid);
        },
      });
  }

  private handleSseEvent(event: SSEStepEvent): void {
    if (!event) return;
    const status = event.parsedData?.status;
    if (status === 'progress') {
      const inProgress = event.parsedData?.stepsInProgress || [];
      const completed = event.parsedData?.completedSteps || [];
      this.steps.update((current) =>
        current.map((s) => ({
          ...s,
          status: completed.includes(s.name)
            ? 'completed'
            : inProgress.includes(s.name)
              ? 'in-progress'
              : s.status === 'completed'
                ? 'completed'
                : 'pending',
        })),
      );
    } else if (status === 'completed' && event.parsedData?.stepName) {
      const stepName = event.parsedData.stepName;
      this.steps.update((current) =>
        current.map((s) => (s.name === stepName ? { ...s, status: 'completed' } : s)),
      );
    }
  }

  protected cancelGeneration(): void {
    this.pitchDeckService.cancelGeneration();
    this.isGenerating.set(false);
  }

  /**
   * Régénère une seule diapositive (nom canonique backend), en conservant les autres.
   */
  protected regenerateSection(sectionName: string): void {
    this.startGeneration(false, [sectionName]);
  }

  protected goToList(): void {
    this.router.navigate(['/project/pitch-deck']);
  }
}
