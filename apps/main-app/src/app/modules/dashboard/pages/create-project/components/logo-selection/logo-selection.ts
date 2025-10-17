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
import { LogoModel, LogoPreferencesModel } from '../../../../models/logo.model';
import { CarouselComponent } from '../../../../../../shared/components/carousel/carousel.component';
import { LogoPreferences } from '../logo-preferences/logo-preferences';
import { LogoEditorChat } from '../logo-editor-chat/logo-editor-chat';

import { Subject, takeUntil } from 'rxjs';
import { BrandingService } from '../../../../services/ai-agents/branding.service';
import { ProjectModel } from '../../../../models/project.model';

@Component({
  selector: 'app-logo-selection',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SafeHtmlPipe,
    CarouselComponent,
    LogoPreferences,
    LogoEditorChat,
  ],
  templateUrl: './logo-selection.html',
  styleUrl: './logo-selection.css',
})
export class LogoSelectionComponent implements OnInit, OnDestroy {
  // Services
  private readonly brandingService = inject(BrandingService);
  private readonly destroy$ = new Subject<void>();

  // Inputs
  readonly projectId = input<string>();
  readonly logos = input<LogoModel[]>();
  readonly selectedLogo = input<string>();
  readonly project = input<ProjectModel>();

  // Outputs
  readonly logoSelected = output<string>();
  readonly logosGenerated = output<LogoModel[]>();
  readonly projectUpdate = output<ProjectModel>();
  readonly nextStep = output<void>();

  // Internal state
  protected readonly isGenerating = signal(false);
  protected readonly generatedLogos = signal<LogoModel[]>([]);
  protected readonly generationProgress = signal(0);
  protected readonly currentStep = signal('');
  protected readonly estimatedTime = signal('2-3 minutes');
  protected readonly hasStartedGeneration = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly selectedLogoId = signal<string | null>(null);
  protected readonly showPreferences = signal(true);
  protected readonly logoPreferences = signal<LogoPreferencesModel | null>(null);

  // Edit logo state - replaced by chat
  protected readonly showEditorChat = signal(false);

  // Computed properties
  protected readonly shouldShowLoader = computed(() => {
    return this.isGenerating() && this.generatedLogos().length === 0;
  });

  protected readonly shouldShowLogos = computed(() => {
    const inputLogos = this.logos();
    const generatedLogos = this.generatedLogos();
    return (inputLogos && inputLogos.length > 0) || generatedLogos.length > 0;
  });

  protected readonly displayedLogos = computed(() => {
    const inputLogos = this.logos();
    const generatedLogos = this.generatedLogos();
    return inputLogos && inputLogos.length > 0 ? inputLogos : generatedLogos;
  });

  // Computed property for template binding
  protected readonly selectedLogoComputed = computed(() => {
    return this.selectedLogoId();
  });

  protected readonly shouldShowInitialPrompt = computed(() => {
    return false; // Always show preferences first
  });

  protected readonly shouldShowPreferences = computed(() => {
    return this.showPreferences() && !this.logoPreferences();
  });

  protected readonly selectedLogoForEdit = computed(() => {
    const logoId = this.selectedLogoId();
    if (!logoId) return null;
    return this.displayedLogos().find((l) => l.id === logoId) || null;
  });

  // Track function for carousel
  protected readonly trackLogo = (index: number, logo: LogoModel): string => {
    return logo.id || `logo-${index}`;
  };

  // Track function for skeleton loading
  protected readonly trackSkeleton = (index: number, item: number): string => {
    return `skeleton-${index}`;
  };

  ngOnInit(): void {
    const hasNoLogos = !this.logos() || this.logos()?.length === 0;

    // Don't auto-start, wait for preferences
    if (hasNoLogos && !this.hasStartedGeneration()) {
      this.showPreferences.set(true);
    } else if (this.logos() && this.logos()!.length > 0) {
      this.showPreferences.set(false);
      this.generatedLogos.set(this.logos()!);

      // Try to extract preferences from existing logos
      const firstLogo = this.logos()![0];
      if (firstLogo.type) {
        this.logoPreferences.set({
          type: firstLogo.type,
          useAIGeneration: !firstLogo.customDescription,
          customDescription: firstLogo.customDescription,
        });
      }
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected selectLogo(logoId: string): void {
    // Update selected logo state
    this.selectedLogoId.set(logoId);
    this.logoSelected.emit(logoId);

    // Find the selected logo and update the project
    const selectedLogo = this.displayedLogos().find((logo) => logo.id === logoId);
    if (selectedLogo) {
      const currentProject = this.project();
      const currentBranding = currentProject?.analysisResultModel?.branding;

      // Ensure all required BrandIdentityModel properties are present
      const updatedBranding = {
        id: currentBranding?.id,
        createdAt: currentBranding?.createdAt,
        updatedAt: currentBranding?.updatedAt,
        logo: selectedLogo,
        generatedLogos: this.displayedLogos(),
        colors: currentBranding?.colors!,
        generatedColors: currentBranding?.generatedColors || [],
        typography: currentBranding?.typography!,
        generatedTypography: currentBranding?.generatedTypography || [],
        sections: currentBranding?.sections || [],
        pdfBlob: currentBranding?.pdfBlob,
      };

      this.projectUpdate.emit({
        ...currentProject,
        analysisResultModel: {
          ...currentProject?.analysisResultModel,
          branding: updatedBranding,
        },
      } as ProjectModel);
    }
  }

  protected goToNextStep(): void {
    this.nextStep.emit();
  }

  protected onPreferencesSelected(preferences: LogoPreferencesModel): void {
    console.log('Logo preferences selected:', preferences);
    this.logoPreferences.set(preferences);
    this.showPreferences.set(false);
    this.startLogoGeneration();
  }

  protected startLogoGeneration(): void {
    if (this.isGenerating() || this.hasStartedGeneration()) {
      return;
    }

    const preferences = this.logoPreferences();
    if (!preferences) {
      console.error('Logo preferences not set');
      return;
    }

    this.hasStartedGeneration.set(true);
    this.isGenerating.set(true);
    this.currentStep.set('Initializing logo generation...');
    this.generationProgress.set(0);

    this.simulateProgress();

    const project = this.project();
    const selectedColor = project?.analysisResultModel?.branding?.colors;
    const selectedTypography = project?.analysisResultModel?.branding?.typography;

    if (!selectedColor || !selectedTypography) {
      this.error.set('Color and typography must be selected before generating logos.');
      this.isGenerating.set(false);
      return;
    }

    this.brandingService
      .generateLogosWithPreferences(
        this.projectId()!,
        selectedColor,
        selectedTypography,
        preferences
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('Logos generated successfully:', response.logos);

          const logosWithUniqueIds = response.logos.map((logo: LogoModel, index: number) => ({
            ...logo,
            id: logo.id || `logo-${Date.now()}-${index}`,
            type: preferences.type,
            customDescription: preferences.customDescription,
          }));

          console.log('Logos with unique IDs:', logosWithUniqueIds);

          this.generatedLogos.set(logosWithUniqueIds);
          this.logosGenerated.emit(logosWithUniqueIds);

          this.isGenerating.set(false);
          this.generationProgress.set(100);
          this.currentStep.set('Generation completed!');
        },
        error: (error) => {
          console.error('Error in logo generation:', error);
          this.error.set('Failed to generate logos. Please try again.');
          this.isGenerating.set(false);
        },
      });
  }

  // Méthode supprimée car dupliquée

  private simulateProgress(): void {
    const steps = [
      { progress: 10, step: 'Analyzing color palette and typography...' },
      { progress: 25, step: 'Generating design concepts...' },
      { progress: 45, step: 'Creating logo variations...' },
      { progress: 65, step: 'Refining designs...' },
      { progress: 80, step: 'Optimizing SVG graphics...' },
      { progress: 95, step: 'Finalizing logos...' },
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
    }, 15000); // Update every 15 seconds
  }

  protected onCarouselItemChanged(logo: LogoModel): void {
    // Auto-select the logo when carousel navigation changes on mobile
    if (logo && logo.id) {
      this.selectLogo(logo.id);
    }
  }

  protected retryGeneration(): void {
    this.error.set(null);
    this.hasStartedGeneration.set(false);
    this.generatedLogos.set([]);
    this.generationProgress.set(0);
    // Don't reset preferences - keep them for retry
    // this.logoPreferences.set(null);

    // If preferences exist, restart generation immediately
    if (this.logoPreferences()) {
      this.startLogoGeneration();
    } else {
      // Show preferences form again
      this.showPreferences.set(true);
    }
  }

  protected openEditorChat(): void {
    if (!this.selectedLogoId()) {
      return;
    }
    this.showEditorChat.set(true);
  }

  protected closeEditorChat(): void {
    this.showEditorChat.set(false);
  }

  protected onLogoSelectedFromChat(logo: LogoModel): void {
    const logoId = this.selectedLogoId();
    if (!logoId) {
      this.closeEditorChat();
      return;
    }

    // Keep the same ID so the logo stays selected
    const updatedLogo: LogoModel = {
      ...logo,
      id: logoId, // Keep the original ID
    };

    // Update the logo in the list - replace the old one with the new one
    const updatedLogos = this.generatedLogos().map((l) => (l.id === logoId ? updatedLogo : l));
    this.generatedLogos.set(updatedLogos);

    // Emit the updated logos to parent component
    this.logosGenerated.emit(updatedLogos);

    // Update the project with the new logo
    const currentProject = this.project();
    if (currentProject) {
      const currentBranding = currentProject.analysisResultModel?.branding;

      const updatedBranding = {
        ...currentBranding,
        logo: updatedLogo, // Set the edited logo as the selected one
        generatedLogos: updatedLogos,
      };

      this.projectUpdate.emit({
        ...currentProject,
        analysisResultModel: {
          ...currentProject.analysisResultModel,
          branding: updatedBranding,
        },
      } as ProjectModel);
    }

    this.closeEditorChat();
  }

  protected regenerateAllLogos(): void {
    const preferences = this.logoPreferences();
    console.log('🔄 Regenerate clicked. Current preferences:', preferences);

    if (!preferences) {
      console.error('❌ No preferences found. Showing error message.');
      this.error.set('Logo preferences not found. Please restart the generation process.');
      return;
    }

    console.log('✅ Preferences found. Starting regeneration...');

    // Reset state
    this.error.set(null);
    this.generatedLogos.set([]);
    this.generationProgress.set(0);
    this.selectedLogoId.set(null);
    this.hasStartedGeneration.set(false);

    // Restart generation with same preferences
    this.startLogoGeneration();
  }
}
