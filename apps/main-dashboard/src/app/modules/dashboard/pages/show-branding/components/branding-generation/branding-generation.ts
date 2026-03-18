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
import { DatePipe } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { SkeletonModule } from 'primeng/skeleton';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BrandingService } from '../../../../services/ai-agents/branding.service';
import {
  PdfFormatSelectorComponent,
  PdfFormat,
} from '../../components/pdf-format-selector/pdf-format-selector';
import { CookieService } from '../../../../../../shared/services/cookie.service';
import { GenerationService } from '../../../../../../shared/services/generation.service';
import { SSEGenerationState } from '../../../../../../shared/models/sse-step.model';
import { BrandIdentityModel } from '../../../../models/brand-identity.model';

@Component({
  selector: 'app-branding-generation',
  standalone: true,
  imports: [DatePipe, SkeletonModule, TranslateModule, PdfFormatSelectorComponent],
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

  ngOnInit(): void {
    this.projectId.set(this.cookieService.get('projectId'));
    // Start with format selection screen
    this.isSelectingFormat.set(true);
  }

  ngOnDestroy(): void {
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
    console.log('Starting branding generation with SSE and format:', this.pdfFormat());

    // Create SSE connection for branding generation with format
    const sseConnection = this.brandingService.createBrandIdentityModel(
      this.projectId()!,
      this.pdfFormat(),
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

    // Wait 4 seconds to allow backend to complete saving
    setTimeout(() => {
      console.log('Post-processing complete, redirecting to branding display');
      this.isPostProcessing.set(false);
      this.router.navigate(['/project/branding/display']);
    }, 4000);
  }
}
