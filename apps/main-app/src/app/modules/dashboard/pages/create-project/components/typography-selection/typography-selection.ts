import {
  Component,
  input,
  output,
  signal,
  OnInit,
  OnDestroy,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  TypographyModel,
  ColorModel,
} from '../../../../models/brand-identity.model';
import { ProjectModel } from '../../../../models/project.model';
import { BrandingService } from '../../../../services/ai-agents/branding.service';
import { CarouselComponent } from '../../../../../../shared/components/carousel/carousel.component';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-typography-selection',
  standalone: true,
  imports: [CommonModule, CarouselComponent],
  templateUrl: './typography-selection.html',
  styleUrl: './typography-selection.css',
})
export class TypographySelectionComponent implements OnInit, OnDestroy {
  // Services
  private readonly brandingService = inject(BrandingService);
  private readonly destroy$ = new Subject<void>();

  // Inputs
  readonly project = input.required<ProjectModel>();
  readonly selectedTypography = input<string>();
  readonly typographyOptions = input<TypographyModel[]>([]);

  // Outputs
  readonly typographySelected = output<string>();
  readonly projectUpdate = output<Partial<ProjectModel>>();
  readonly nextStep = output<void>();
  readonly previousStep = output<void>();

  // State management
  protected typographyModels = signal<TypographyModel[]>([]);
  protected selectedTypographyId = signal<string | null>(null);
  protected error = signal<string | null>(null);
  protected isLoading = signal<boolean>(true);

  ngOnInit() {
    // Show skeleton loading for 3 seconds before displaying elements
    setTimeout(() => {
      // Get typography from project data (already generated in color-selection)
      const generatedTypography = this.project().analysisResultModel?.branding?.generatedTypography;
      if (generatedTypography && Array.isArray(generatedTypography) && generatedTypography.length > 0) {
        this.typographyModels.set(generatedTypography);
        console.log('Typography options loaded:', generatedTypography);
      } else {
        console.error('No typography options found in project data:', this.project().analysisResultModel?.branding);
        this.error.set('No typography options available. Please go back to the color selection step.');
      }
      this.isLoading.set(false);
    }, 2000);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected selectTypography(typographyId: string): void {
    this.selectedTypographyId.set(typographyId);
    this.typographySelected.emit(typographyId);
    
    // Find the selected typography and update the project
    const selectedTypography = this.typographyModels().find(typo => typo.id === typographyId);
    if (selectedTypography) {
      this.projectUpdate.emit({
        analysisResultModel: {
          ...this.project().analysisResultModel,
          branding: {
            ...this.project().analysisResultModel?.branding,
            typography: selectedTypography, // Set the selected typography object
            generatedTypography: this.typographyModels()
          }
        }
      });
    }
  }

  protected goToPreviousStep(): void {
    this.previousStep.emit();
  }

  protected onCarouselItemChanged(typography: TypographyModel): void {
    // Auto-select the typography when carousel navigation changes on mobile
    if (typography && typography.id) {
      this.selectTypography(typography.id);
    }
  }

  // Track function for carousel
  protected readonly trackTypography = (index: number, typography: TypographyModel): string => {
    return typography.id || `typography-${index}`;
  };

  // Track function for skeleton loading
  protected readonly trackSkeleton = (index: number, item: number): string => {
    return `skeleton-${index}`;
  };
}
