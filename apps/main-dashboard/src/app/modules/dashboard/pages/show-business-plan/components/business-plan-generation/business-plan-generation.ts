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
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { SkeletonModule } from 'primeng/skeleton';
import { BusinessPlanService } from '../../../../services/ai-agents/business-plan.service';
import { CookieService } from '../../../../../../shared/services/cookie.service';
import { GenerationService } from '../../../../../../shared/services/generation.service';
import {
  SSEGenerationState,
  SSEConnectionConfig,
} from '../../../../../../shared/models/sse-step.model';
import { BusinessPlanModel } from '../../../../models/businessPlan.model';
import { ProjectModel } from '../../../../models/project.model';
import { AdditionalInfoFormComponent } from '../additional-info-form/additional-info-form';
import { environment } from '../../../../../../../environments/environment';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-business-plan-generation',
  standalone: true,
  imports: [DatePipe, SkeletonModule, AdditionalInfoFormComponent, TranslateModule],
  templateUrl: './business-plan-generation.html',
  styleUrl: './business-plan-generation.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BusinessPlanGenerationComponent implements OnInit, OnDestroy {
  private readonly businessPlanService = inject(BusinessPlanService);
  private readonly generationService = inject(GenerationService);
  private readonly cookieService = inject(CookieService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly destroy$ = new Subject<void>();

  // Outputs
  readonly businessPlanGenerated = output<BusinessPlanModel>();

  // Signals for reactive state management
  protected readonly projectId = signal<string | null>(null);
  protected readonly showAdditionalInfoForm = signal<boolean>(true);
  protected readonly additionalInfos = signal<any>(null);
  protected readonly isSavingAdditionalInfo = signal<boolean>(false);
  protected readonly additionalInfoError = signal<string | null>(null);
  protected readonly isPostProcessing = signal<boolean>(false);
  protected readonly postProcessingMessage = signal<string>(
    this.translate.instant('dashboard.businessPlanGeneration.postProcessing'),
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
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Handle additional info form submission
   */
  protected onAdditionalInfoSubmitted(additionalInfos: ProjectModel['additionalInfos']): void {
    console.log('Additional info form submitted:', additionalInfos);
    this.additionalInfos.set(additionalInfos);
    this.isSavingAdditionalInfo.set(true);
    this.additionalInfoError.set(null);
    this.showAdditionalInfoForm.set(false);

    // Add a small delay to ensure the loader is visible before starting the request
    setTimeout(() => {
      this.generateBusinessPlanWithAdditionalInfo(additionalInfos);
    }, 100);
  }

  /**
   * Handle additional info form cancellation
   */
  protected onAdditionalInfoCancelled(): void {
    this.showAdditionalInfoForm.set(false);
    this.generateBusinessPlanWithoutAdditionalInfo();
  }

  /**
   * Generate new business plan using SSE for real-time updates (without additional info)
   */
  protected generateBusinessPlanWithoutAdditionalInfo(): void {
    if (!this.projectId()) {
      console.error('Project ID not found');
      return;
    }

    // Reset state for new generation
    this.resetGenerationState();
    console.log('Starting business plan generation with SSE (no additional info)...');

    // Create SSE connection for business plan generation
    const sseConnection = this.businessPlanService.createBusinessplanItem(this.projectId()!);

    this.startGenerationProcess(sseConnection);
  }

  /**
   * Generate new business plan with additional information
   */
  protected generateBusinessPlanWithAdditionalInfo(
    additionalInfos: ProjectModel['additionalInfos'],
  ): void {
    if (!this.projectId()) {
      console.error('Project ID not found');
      this.isSavingAdditionalInfo.set(false);
      this.additionalInfoError.set(
        this.translate.instant('dashboard.businessPlanGeneration.errors.projectIdNotFound'),
      );
      return;
    }

    // Reset state for new generation
    this.resetGenerationState();
    console.log('Starting business plan generation with SSE (with additional info)...');

    // Create SSE connection for business plan generation with additional info
    const sseConnection = this.businessPlanService.createBusinessplanItem(
      this.projectId()!,
      additionalInfos,
    );

    // Use the generation service to handle the SSE connection properly
    this.generationService
      .startGeneration('business-plan', sseConnection)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (state: SSEGenerationState) => {
          console.log('Business plan generation state updated:', state);

          // On first event, mark additional info as saved with minimum display time
          if (this.isSavingAdditionalInfo()) {
            console.log('First SSE event received, additional info saved successfully');
            // Ensure loader is visible for at least 1.5 seconds for better UX
            setTimeout(() => {
              this.isSavingAdditionalInfo.set(false);
              this.additionalInfoError.set(null);
            }, 1500);
          }

          this.generationState.set(state);

          // Check if generation is completed
          if (state.completed && state.steps.length > 0) {
            this.emitBusinessPlanData(state.steps);
            this.handleGenerationComplete(state);
          }
        },
        error: (err) => {
          console.error(`Error generating business plan for project ID: ${this.projectId()}:`, err);
          this.isSavingAdditionalInfo.set(false);
          this.additionalInfoError.set(
            this.translate.instant('dashboard.businessPlanGeneration.errors.saveAdditionalInfo'),
          );
          this.showAdditionalInfoForm.set(true); // Show form again on error
          this.generationState.update((state) => ({
            ...state,
            error: this.translate.instant('dashboard.businessPlanGeneration.errors.failed'),
            isGenerating: false,
          }));
        },
        complete: () => {
          console.log('Business plan generation completed');
        },
      });
  }

  /**
   * Start the generation process with SSE connection
   */
  private startGenerationProcess(sseConnection: any): void {
    this.generationService
      .startGeneration('business-plan', sseConnection)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (state: SSEGenerationState) => {
          console.log('Business plan generation state updated:', state);
          this.generationState.set(state);

          // Check if generation is completed
          if (state.completed && state.steps.length > 0) {
            this.emitBusinessPlanData(state.steps);
            this.handleGenerationComplete(state);
          }
        },
        error: (err) => {
          console.error(`Error generating business plan for project ID: ${this.projectId()}:`, err);
          this.generationState.update((state) => ({
            ...state,
            error: this.translate.instant('dashboard.businessPlanGeneration.errors.failed'),
            isGenerating: false,
          }));
        },
        complete: () => {
          console.log('Business plan generation completed');
        },
      });
  }

  /**
   * Legacy method for backward compatibility
   */
  protected generateBusinessPlan(): void {
    this.generateBusinessPlanWithoutAdditionalInfo();
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
      isGenerating: false,
    });
  }

  /**
   * Emit business plan data when generation is completed
   */
  private emitBusinessPlanData(steps: any[]): void {
    const combinedContent = this.combineStepsContent(steps);

    const businessPlan: BusinessPlanModel = {
      sections: steps.map((step) => ({
        id: `section-${step.stepName}`,
        name: step.stepName,
        type: 'generated',
        data: step.content || step.summary || '',
        summary: step.summary || '',
      })),
    };

    this.businessPlanGenerated.emit(businessPlan);
  }

  /**
   * Combine all step contents into a single business plan content
   */
  private combineStepsContent(steps: any[]): string {
    return steps
      .filter((step) => step.content && step.content !== 'step_started')
      .map((step) => `## ${step.stepName}\n\n${step.content}`)
      .join('\n\n---\n\n');
  }

  /**
   * Cancel ongoing generation
   */
  protected cancelGeneration(): void {
    this.generationService.cancelGeneration('business-plan');
    this.generationState.update((state) => ({
      ...state,
      isGenerating: false,
      error: this.translate.instant('dashboard.businessPlanGeneration.cancelled'),
    }));
  }

  /**
   * Handle generation completion - add 4 second delay before redirect
   */
  private handleGenerationComplete(state: SSEGenerationState): void {
    console.log('Business plan generation completed:', state);

    // Start post-processing phase with loading
    this.isPostProcessing.set(true);
    this.postProcessingMessage.set(
      this.translate.instant('dashboard.businessPlanGeneration.saving'),
    );

    // Wait 4 seconds to allow backend to complete saving
    setTimeout(() => {
      console.log('Post-processing complete, redirecting to business plan display');
      this.isPostProcessing.set(false);
      this.router.navigate(['/project/business-plan']);
    }, 4000);
  }
}
