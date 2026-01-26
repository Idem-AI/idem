import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  signal,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TypographyModel } from '../../../../models/brand-identity.model';
import {
  TypographyService,
  TypographyPreview,
  GoogleFont,
} from '../../../../../../shared/services/typography.service';
import { ProjectService } from '../../../../services/project.service';
import { debounceTime, distinctUntilChanged, switchMap, takeUntil } from 'rxjs/operators';
import { Subject, of } from 'rxjs';
import { TypographyPreviewComponent } from './typography-preview/typography-preview';
import { ProjectModel } from '../../../../models/project.model';
import { BrandingService } from '../../../../services/ai-agents/branding.service';

// Import new sub-components
import { TypographyTabsComponent, TypographyTab } from './typography-tabs/typography-tabs';
import { TypographyGeneratedListComponent } from './typography-generated-list/typography-generated-list';
import { TypographyCustomCreatorComponent } from './typography-custom-creator/typography-custom-creator';

@Component({
  selector: 'app-typography-selection',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    TypographyPreviewComponent,
    TypographyTabsComponent,
    TypographyGeneratedListComponent,
    TypographyCustomCreatorComponent,
  ],
  templateUrl: './typography-selection.html',
  styleUrls: ['./typography-selection.css'],
})
export class TypographySelectionComponent implements OnInit, OnDestroy {
  // Services
  private readonly brandingService = inject(BrandingService);
  private readonly typographyService = inject(TypographyService);
  private readonly destroy$ = new Subject<void>();
  private readonly translate = inject(TranslateService);
  private readonly searchSubject = new Subject<string>();

  // Inputs
  @Input() project: ProjectModel = {} as ProjectModel;

  // Outputs
  @Output() readonly typographySelected = new EventEmitter<TypographyModel>();
  @Output() readonly projectUpdate = new EventEmitter<Partial<ProjectModel>>();
  @Output() readonly nextStep = new EventEmitter<void>();
  @Output() readonly previousStep = new EventEmitter<void>();

  // Signals
  protected activeTab = signal<TypographyTab>('generated');
  protected isLoading = signal(true);
  protected hasError = signal(false);
  protected isGenerating = signal(false);
  protected typographyModels = signal<TypographyModel[]>([]);
  protected selectedTypographyId = signal<string | null>(null);

  // Custom Selection Signals
  protected selectedPrimaryFont = signal('');
  protected selectedSecondaryFont = signal('');

  // Search Signals
  protected searchResults = signal<GoogleFont[]>([]);
  protected isSearching = signal(false);
  protected searchQuery = signal('');
  protected showCustomSearch = signal(false);
  protected previewText = signal('Your Brand Name');

  // Computed properties
  protected hasGeneratedTypographies = computed(() => this.typographyModels().length > 0);

  protected canContinue = computed(() => {
    if (this.activeTab() === 'generated') {
      return this.selectedTypographyId() !== null;
    }
    // For custom tab, we need both fonts selected
    return this.selectedPrimaryFont().length > 0 && this.selectedSecondaryFont().length > 0;
  });

  protected currentSelectedTypography = computed(() => {
    if (this.activeTab() === 'generated') {
      return this.typographyModels().find(
        (t: TypographyModel) => t.id === this.selectedTypographyId(),
      );
    }

    // For custom tab, return a live preview object
    if (this.selectedPrimaryFont() || this.selectedSecondaryFont()) {
      return {
        id: 'custom-preview',
        name: 'Custom Selection',
        primaryFont: this.selectedPrimaryFont() || 'Inter', // Fallback for preview
        secondaryFont: this.selectedSecondaryFont() || 'Inter', // Fallback for preview
        description: 'Your custom font combination',
      } as TypographyModel;
    }

    return null;
  });

  // Event handlers for new template
  protected onTabChanged(tab: TypographyTab): void {
    this.activeTab.set(tab);
    // If switching to generated, ensure something is selected if possible
    if (tab === 'generated' && !this.selectedTypographyId() && this.typographyModels().length > 0) {
      this.selectedTypographyId.set(this.typographyModels()[0].id);
    }
  }

  protected onTypographySelected(typography: TypographyModel): void {
    this.selectedTypographyId.set(typography.id);
    this.typographySelected.emit(typography);
  }

  protected onRegenerateTypographies(): void {
    this.regenerateTypographies();
  }

  protected retry(): void {
    this.hasError.set(false);
    this.isLoading.set(true);
    this.initializeTypographies();
  }

  protected goBack(): void {
    this.previousStep.emit();
  }

  protected saveAsDraft(): void {
    const selectedTypography = this.currentSelectedTypography();
    if (!selectedTypography) return;

    const draftData: Partial<ProjectModel> = {
      analysisResultModel: {
        ...this.project.analysisResultModel,
        branding: {
          ...this.project.analysisResultModel?.branding,
          typography: selectedTypography,
        },
      },
    };
    this.projectUpdate.emit(draftData);
  }

  protected continueToNext(): void {
    if (this.canContinue()) {
      const selectedTypography = this.currentSelectedTypography();
      if (!selectedTypography) return;

      // For custom typography, add it to the generatedTypography list so it can be found in project-summary
      let updatedGeneratedTypography =
        this.project.analysisResultModel?.branding?.generatedTypography || [];

      if (this.activeTab() === 'custom' && selectedTypography.id === 'custom-preview') {
        // Create a proper custom typography with unique ID
        const customTypography: TypographyModel = {
          ...selectedTypography,
          id: `custom-${Date.now()}`, // Unique ID for custom typography
        };

        // Add custom typography to the list if not already present
        const existingCustomIndex = updatedGeneratedTypography.findIndex((t) =>
          t.id.startsWith('custom-'),
        );
        if (existingCustomIndex >= 0) {
          updatedGeneratedTypography[existingCustomIndex] = customTypography;
        } else {
          updatedGeneratedTypography = [...updatedGeneratedTypography, customTypography];
        }

        selectedTypography.id = customTypography.id; // Update the selected typography ID
      }

      const projectData: Partial<ProjectModel> = {
        analysisResultModel: {
          ...this.project.analysisResultModel,
          branding: {
            ...this.project.analysisResultModel?.branding,
            typography: selectedTypography,
            generatedTypography: updatedGeneratedTypography,
          },
        },
      };
      this.projectUpdate.emit(projectData);
      this.nextStep.emit();
    }
  }

  protected onSearchInput(query: string): void {
    this.searchQuery.set(query);
    this.searchSubject.next(query);
  }

  protected selectFont(event: { font: GoogleFont; type: 'primary' | 'secondary' }): void {
    const { font, type } = event;
    if (type === 'primary') {
      this.selectedPrimaryFont.set(font.family);
    } else {
      this.selectedSecondaryFont.set(font.family);
    }
    this.typographyService.loadGoogleFont(font.family);
  }

  ngOnInit(): void {
    this.initializeTypographies();
    this.setupSearch();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeTypographies(): void {
    setTimeout(() => {
      const generatedTypography = this.project.analysisResultModel?.branding?.generatedTypography;

      if (generatedTypography && generatedTypography.length > 0) {
        this.typographyModels.set(generatedTypography);
        this.isLoading.set(false);
      } else {
        this.regenerateTypographies();
      }
    }, 2000);
  }

  private regenerateTypographies(): void {
    this.isGenerating.set(true);

    // For now, simulate typography generation since the service method doesn't exist
    setTimeout(() => {
      const mockTypographies: TypographyModel[] = [
        {
          id: 'generated-1',
          name: 'Modern Sans',
          primaryFont: 'Inter',
          secondaryFont: 'Source Sans Pro',
          description: 'Clean and modern typography for professional brands',
        },
        {
          id: 'generated-2',
          name: 'Classic Serif',
          primaryFont: 'Playfair Display',
          secondaryFont: 'Lora',
          description: 'Elegant serif combination for sophisticated brands',
        },
        {
          id: 'generated-3',
          name: 'Tech Forward',
          primaryFont: 'JetBrains Mono',
          secondaryFont: 'Roboto',
          description: 'Technical and precise typography for tech companies',
        },
      ];

      this.typographyModels.set(mockTypographies);
      this.isGenerating.set(false);
      // Auto-select first item
      if (mockTypographies.length > 0) {
        this.selectedTypographyId.set(mockTypographies[0].id);
      }
    }, 2000);
  }

  private setupSearch(): void {
    this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((query) => {
          if (!query || query.length < 2) {
            return of([]);
          }
          this.isSearching.set(true);
          return this.typographyService.searchGoogleFonts(query);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (results) => {
          this.searchResults.set(results);
          this.isSearching.set(false);
        },
        error: (error) => {
          console.error('Search error:', error);
          this.isSearching.set(false);
        },
      });
  }
}
