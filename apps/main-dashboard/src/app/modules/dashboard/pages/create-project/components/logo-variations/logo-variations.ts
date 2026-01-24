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
  type: 'withText' | 'iconOnly';
  background: 'lightBackground' | 'darkBackground' | 'monochrome';
  label: string;
  svgContent: string;
  description: string;
  backgroundColor: string;
  category: string;
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
  protected readonly selectedVariations = signal<string[]>([]);

  // Computed properties
  protected readonly shouldShowLoader = computed(() => {
    return this.isGenerating() && this.generatedVariations().length === 0;
  });

  protected readonly shouldShowVariations = computed(() => {
    return this.generatedVariations().length > 0;
  });

  protected readonly shouldShowInitialPrompt = computed(() => {
    return !this.shouldShowLoader() && !this.shouldShowVariations() && !this.hasStartedGeneration();
  });

  protected readonly canProceed = computed(() => {
    return this.selectedVariations().length > 0;
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

          // Transform the response into DisplayVariation objects
          const variations: DisplayVariation[] = [];

          // Process withText variations
          if (response.variations.withText) {
            const withText = response.variations.withText;

            if (withText.lightBackground) {
              variations.push({
                id: 'withText-lightBackground',
                type: 'withText',
                background: 'lightBackground',
                label: this.translate.instant('dashboard.logoVariations.labels.withTextLight'),
                svgContent: withText.lightBackground,
                description: this.translate.instant(
                  'dashboard.logoVariations.descriptions.withTextLight',
                ),
                backgroundColor: '#ffffff',
                category: this.translate.instant('dashboard.logoVariations.categories.withText'),
              });
            }

            if (withText.darkBackground) {
              variations.push({
                id: 'withText-darkBackground',
                type: 'withText',
                background: 'darkBackground',
                label: this.translate.instant('dashboard.logoVariations.labels.withTextDark'),
                svgContent: withText.darkBackground,
                description: this.translate.instant(
                  'dashboard.logoVariations.descriptions.withTextDark',
                ),
                backgroundColor: '#1f2937',
                category: this.translate.instant('dashboard.logoVariations.categories.withText'),
              });
            }

            if (withText.monochrome) {
              variations.push({
                id: 'withText-monochrome',
                type: 'withText',
                background: 'monochrome',
                label: this.translate.instant('dashboard.logoVariations.labels.withTextMonochrome'),
                svgContent: withText.monochrome,
                description: this.translate.instant(
                  'dashboard.logoVariations.descriptions.withTextMonochrome',
                ),
                backgroundColor: '#f3f4f6',
                category: this.translate.instant('dashboard.logoVariations.categories.withText'),
              });
            }
          }

          // Process iconOnly variations
          if (response.variations.iconOnly) {
            const iconOnly = response.variations.iconOnly;

            if (iconOnly.lightBackground) {
              variations.push({
                id: 'iconOnly-lightBackground',
                type: 'iconOnly',
                background: 'lightBackground',
                label: this.translate.instant('dashboard.logoVariations.labels.iconOnlyLight'),
                svgContent: iconOnly.lightBackground,
                description: this.translate.instant(
                  'dashboard.logoVariations.descriptions.iconOnlyLight',
                ),
                backgroundColor: '#ffffff',
                category: this.translate.instant('dashboard.logoVariations.categories.iconOnly'),
              });
            }

            if (iconOnly.darkBackground) {
              variations.push({
                id: 'iconOnly-darkBackground',
                type: 'iconOnly',
                background: 'darkBackground',
                label: this.translate.instant('dashboard.logoVariations.labels.iconOnlyDark'),
                svgContent: iconOnly.darkBackground,
                description: this.translate.instant(
                  'dashboard.logoVariations.descriptions.iconOnlyDark',
                ),
                backgroundColor: '#1f2937',
                category: this.translate.instant('dashboard.logoVariations.categories.iconOnly'),
              });
            }

            if (iconOnly.monochrome) {
              variations.push({
                id: 'iconOnly-monochrome',
                type: 'iconOnly',
                background: 'monochrome',
                label: this.translate.instant('dashboard.logoVariations.labels.iconOnlyMonochrome'),
                svgContent: iconOnly.monochrome,
                description: this.translate.instant(
                  'dashboard.logoVariations.descriptions.iconOnlyMonochrome',
                ),
                backgroundColor: '#f3f4f6',
                category: this.translate.instant('dashboard.logoVariations.categories.iconOnly'),
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

          // Auto-select all variations by default
          this.selectedVariations.set(variations.map((v) => v.id));
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

  protected toggleVariationSelection(variationType: string): void {
    const currentSelections = this.selectedVariations();

    if (currentSelections.includes(variationType)) {
      // Remove from selection
      this.selectedVariations.set(currentSelections.filter((type) => type !== variationType));
    } else {
      // Add to selection
      this.selectedVariations.set([...currentSelections, variationType]);
    }
  }

  protected isVariationSelected(variationType: string): boolean {
    return this.selectedVariations().includes(variationType);
  }

  protected getVariationsByCategory(category: string): DisplayVariation[] {
    const categoryMap: { [key: string]: 'withText' | 'iconOnly' } = {
      [this.translate.instant('dashboard.logoVariations.categories.withText')]: 'withText',
      [this.translate.instant('dashboard.logoVariations.categories.iconOnly')]: 'iconOnly',
    };
    const mappedCategory = categoryMap[category];
    return this.generatedVariations().filter((v) => v.type === mappedCategory);
  }

  protected hasVariationsForCategory(category: string): boolean {
    return this.getVariationsByCategory(category).length > 0;
  }

  protected goToNextStep(): void {
    if (!this.canProceed()) {
      return;
    }

    // Update project with selected logo variations
    const selectedVariations = this.generatedVariations().filter((variation) =>
      this.selectedVariations().includes(variation.id),
    );

    const currentProject = this.project();
    const currentBranding = currentProject?.analysisResultModel?.branding;

    // Build the variations object from selected variations
    const withTextVariations = {
      lightBackground: selectedVariations.find(
        (v) => v.type === 'withText' && v.background === 'lightBackground',
      )?.svgContent,
      darkBackground: selectedVariations.find(
        (v) => v.type === 'withText' && v.background === 'darkBackground',
      )?.svgContent,
      monochrome: selectedVariations.find(
        (v) => v.type === 'withText' && v.background === 'monochrome',
      )?.svgContent,
    };

    const iconOnlyVariations = {
      lightBackground: selectedVariations.find(
        (v) => v.type === 'iconOnly' && v.background === 'lightBackground',
      )?.svgContent,
      darkBackground: selectedVariations.find(
        (v) => v.type === 'iconOnly' && v.background === 'darkBackground',
      )?.svgContent,
      monochrome: selectedVariations.find(
        (v) => v.type === 'iconOnly' && v.background === 'monochrome',
      )?.svgContent,
    };

    // Update the logo with variations
    const updatedLogo: LogoModel = {
      ...this.selectedLogo(),
      variations: {
        withText: withTextVariations,
        iconOnly: iconOnlyVariations,
      },
    };

    const updatedBranding = {
      ...currentBranding,
      logo: updatedLogo,
    };

    this.projectUpdate.emit({
      ...currentProject,
      analysisResultModel: {
        ...currentProject?.analysisResultModel,
        branding: updatedBranding,
      },
    } as ProjectModel);

    this.nextStep.emit();
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
    this.selectedVariations.set([]);

    // Restart generation
    this.startVariationGeneration();
  }
}
