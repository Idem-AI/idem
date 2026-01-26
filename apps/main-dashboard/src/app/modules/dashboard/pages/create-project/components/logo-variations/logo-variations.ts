import {
  Component,
  input,
  output,
  signal,
  computed,
  OnInit,
  OnDestroy,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SafeHtmlPipe } from '../../../projects-list/safehtml.pipe';
import { LogoModel, LogoVariations } from '../../../../models/logo.model';
import { ProjectModel } from '../../../../models/project.model';
import { CarouselComponent } from '../../../../../../shared/components/carousel/carousel.component';

import { Subject, takeUntil } from 'rxjs';
import { BrandingService } from '../../../../services/ai-agents/branding.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

interface DisplayVariation {
  id: string;
  background: 'lightBackground' | 'darkBackground' | 'monochrome';
  label: string;
  svgContent: string;
  description: string;
  backgroundColor: string;
}

@Component({
  selector: 'app-logo-variations',
  standalone: true,
  imports: [CommonModule, FormsModule, SafeHtmlPipe, CarouselComponent, TranslateModule],
  templateUrl: './logo-variations.html',
  styleUrl: './logo-variations.css',
})
export class LogoVariationsComponent implements OnInit, OnDestroy {
  // Services
  private readonly brandingService = inject(BrandingService);
  private readonly destroy$ = new Subject<void>();
  private readonly translate = inject(TranslateService);

  // Inputs
  readonly selectedLogo = input.required<LogoModel>();
  readonly project = input.required<ProjectModel>();

  // Outputs
  readonly variationsGenerated = output<LogoVariations>();
  readonly projectUpdate = output<ProjectModel>();
  readonly nextStep = output<void>();

  // Internal state
  protected readonly isGenerating = signal(false);
  protected readonly generatedVariations = signal<DisplayVariation[]>([]);
  protected readonly generationProgress = signal(0);
  protected readonly currentStep = signal('');
  protected readonly estimatedTime = signal('1-2 minutes');
  protected readonly hasStartedGeneration = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly isCompleted = signal(false);

  // Computed properties
  protected readonly shouldShowLoader = computed(() => {
    return this.isGenerating() && this.generatedVariations().length === 0;
  });

  protected readonly shouldShowVariations = computed(() => {
    return this.generatedVariations().length > 0 && !this.isCompleted();
  });

  protected readonly shouldShowSuccess = computed(() => {
    return this.isCompleted() && this.generatedVariations().length > 0;
  });

  protected readonly shouldShowInitialPrompt = computed(() => {
    return !this.shouldShowLoader() && !this.shouldShowVariations() && !this.hasStartedGeneration();
  });

  protected readonly canProceed = computed(() => {
    return this.isCompleted();
  });

  // Track function for carousel
  protected readonly trackVariation = (index: number, variation: DisplayVariation): string => {
    return variation.id;
  };

  // Track function for skeleton loading
  protected readonly trackSkeleton = (index: number, item: number): string => {
    return `skeleton-${index}`;
  };

  ngOnInit(): void {
    // Auto-start generation when component loads
    console.log(this.project().analysisResultModel.branding.logo.variations);
    if (this.selectedLogo() && !this.project().analysisResultModel.branding.logo.variations) {
      this.startVariationGeneration();
    } else {
      this.variationsGenerated.emit(this.project().analysisResultModel.branding.logo.variations!);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected startVariationGeneration(): void {
    if (this.isGenerating() || this.hasStartedGeneration()) {
      return;
    }

    this.hasStartedGeneration.set(true);
    this.isGenerating.set(true);
    this.currentStep.set(this.translate.instant('dashboard.logoVariations.progress.initializing'));
    this.generationProgress.set(0);
    this.error.set(null);

    // Simulate progress updates
    this.simulateProgress();

    // Generate logo variations using the selected logo and project
    this.brandingService
      .generateLogoVariations(this.selectedLogo(), this.project())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('Logo variations generated successfully:', response);

          // Transform the response into DisplayVariation objects (simplified to 3 variations)
          const variations: DisplayVariation[] = [];

          // Use withText variations as primary (since logos are now complete)
          if (response.variations.withText) {
            const withText = response.variations.withText;

            if (withText.lightBackground) {
              variations.push({
                id: 'lightBackground',
                background: 'lightBackground',
                label: this.translate.instant('dashboard.logoVariations.labels.lightBackground'),
                svgContent: withText.lightBackground,
                description: this.translate.instant(
                  'dashboard.logoVariations.descriptions.lightBackground',
                ),
                backgroundColor: '#ffffff',
              });
            }

            if (withText.darkBackground) {
              variations.push({
                id: 'darkBackground',
                background: 'darkBackground',
                label: this.translate.instant('dashboard.logoVariations.labels.darkBackground'),
                svgContent: withText.darkBackground,
                description: this.translate.instant(
                  'dashboard.logoVariations.descriptions.darkBackground',
                ),
                backgroundColor: '#1f2937',
              });
            }

            if (withText.monochrome) {
              variations.push({
                id: 'monochrome',
                background: 'monochrome',
                label: this.translate.instant('dashboard.logoVariations.labels.monochrome'),
                svgContent: withText.monochrome,
                description: this.translate.instant(
                  'dashboard.logoVariations.descriptions.monochrome',
                ),
                backgroundColor: '#f3f4f6',
              });
            }
          }

          // Update state with generated variations
          this.generatedVariations.set(variations);
          this.variationsGenerated.emit(response.variations);

          // Update generation state
          this.isGenerating.set(false);
          this.generationProgress.set(100);
          this.currentStep.set(
            this.translate.instant('dashboard.logoVariations.progress.completed'),
          );

          // Auto-accept all variations and update project immediately
          this.autoAcceptVariations(response.variations);
        },
        error: (error) => {
          console.error('Error in logo variation generation:', error);
          this.error.set(
            this.translate.instant('dashboard.logoVariations.errors.generationFailed'),
          );
          this.isGenerating.set(false);
        },
      });
  }

  // Simplified: return all variations since we only have 3 now
  protected getAllVariations(): DisplayVariation[] {
    return this.generatedVariations();
  }

  /**
   * Auto-accept all generated variations and update project
   */
  private autoAcceptVariations(variations: LogoVariations): void {
    const currentProject = this.project();
    const currentBranding = currentProject?.analysisResultModel?.branding;

    // Update the logo with all variations
    const updatedLogo: LogoModel = {
      ...this.selectedLogo(),
      variations: variations,
    };

    const updatedBranding = {
      ...currentBranding,
      logo: updatedLogo,
    };

    // Update project immediately
    this.projectUpdate.emit({
      ...currentProject,
      analysisResultModel: {
        ...currentProject?.analysisResultModel,
        branding: updatedBranding,
      },
    } as ProjectModel);

    // Mark as completed and show success state briefly
    this.isCompleted.set(true);

    // Auto-advance to next step after a brief delay to show success
    setTimeout(() => {
      this.nextStep.emit();
    }, 2000); // 2 second delay to show the success state
  }

  private simulateProgress(): void {
    const steps = [
      {
        progress: 15,
        step: this.translate.instant('dashboard.logoVariations.progress.analyzing'),
      },
      {
        progress: 35,
        step: this.translate.instant('dashboard.logoVariations.progress.generatingLight'),
      },
      {
        progress: 55,
        step: this.translate.instant('dashboard.logoVariations.progress.generatingDark'),
      },
      {
        progress: 75,
        step: this.translate.instant('dashboard.logoVariations.progress.generatingMonochrome'),
      },
      {
        progress: 90,
        step: this.translate.instant('dashboard.logoVariations.progress.optimizing'),
      },
      {
        progress: 95,
        step: this.translate.instant('dashboard.logoVariations.progress.finalizing'),
      },
    ];

    let currentStepIndex = 0;
    const interval = setInterval(() => {
      if (currentStepIndex < steps.length && this.isGenerating()) {
        const currentStepData = steps[currentStepIndex];
        this.generationProgress.set(currentStepData.progress);
        this.currentStep.set(currentStepData.step);
        currentStepIndex++;
      } else {
        clearInterval(interval);
      }
    }, 8000); // Update every 8 seconds
  }

  /**
   * Method to retry variation generation in case of failure
   */
  protected retryGeneration(): void {
    // Reset error state
    this.error.set(null);
    this.hasStartedGeneration.set(false);
    this.generatedVariations.set([]);
    this.generationProgress.set(0);
    this.isCompleted.set(false);

    // Restart generation
    this.startVariationGeneration();
  }
}
