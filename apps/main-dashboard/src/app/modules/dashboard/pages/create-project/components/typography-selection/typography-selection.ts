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
import { PopularTypographyListComponent } from './popular-typography-list/popular-typography-list';
import { ProjectModel } from '../../../../models/project.model';
import { BrandingService } from '../../../../services/ai-agents/branding.service';

// Import new sub-components
import { TypographyTabsComponent, TypographyTab } from './typography-tabs/typography-tabs';
import { TypographyGeneratedListComponent } from './typography-generated-list/typography-generated-list';
import { TypographyCustomCreatorComponent } from './typography-custom-creator/typography-custom-creator';
import { TypographyPreviewPanelComponent } from './typography-preview-panel/typography-preview-panel';

@Component({
  selector: 'app-typography-selection',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    TypographyPreviewComponent,
    PopularTypographyListComponent,
    TypographyTabsComponent,
    TypographyGeneratedListComponent,
    TypographyCustomCreatorComponent,
    TypographyPreviewPanelComponent,
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
  protected popularTypographies = signal<TypographyPreview[]>([]);
  protected customTypographies = signal<TypographyPreview[]>([]);
  protected selectedCustomTypography = signal<TypographyPreview | null>(null);
  protected selectedPrimaryFont = signal('');
  protected selectedSecondaryFont = signal('');
  protected searchResults = signal<GoogleFont[]>([]);
  protected isSearching = signal(false);
  protected searchQuery = signal('');
  protected showCustomSearch = signal(false);
  protected previewText = signal('Your Brand Name');

  // Computed properties
  protected hasGeneratedTypographies = computed(() => this.typographyModels().length > 0);
  protected canCreateCustom = computed(
    () => this.selectedPrimaryFont().length > 0 && this.selectedSecondaryFont().length > 0,
  );
  protected canContinue = computed(() => {
    return (
      this.selectedTypographyId() !== null ||
      this.selectedCustomTypography() !== null ||
      (this.selectedPrimaryFont() && this.selectedSecondaryFont())
    );
  });
  protected currentSelectedTypography = computed(() =>
    this.typographyModels().find((t) => t.id === this.selectedTypographyId()),
  );

  protected customPreviewTypography = computed(() => {
    if (this.selectedCustomTypography()) {
      return {
        id: this.selectedCustomTypography()!.id,
        name: this.selectedCustomTypography()!.name,
        primaryFont: this.selectedCustomTypography()!.primaryFont,
        secondaryFont: this.selectedCustomTypography()!.secondaryFont,
        description: '',
      } as TypographyModel;
    }

    return {
      id: 'preview',
      name: 'Custom Preview',
      primaryFont: this.selectedPrimaryFont(),
      secondaryFont: this.selectedSecondaryFont(),
      description: 'Preview of your custom selection',
    } as TypographyModel;
  });

  // Event handlers for new template
  protected onTabChanged(tab: TypographyTab): void {
    this.activeTab.set(tab);
  }

  protected onTypographySelected(typography: TypographyModel): void {
    this.selectedTypographyId.set(typography.id);
    this.typographySelected.emit(typography);
  }

  protected onPopularTypographySelected(typography: TypographyPreview): void {
    const typographyModel: TypographyModel = {
      id: typography.id,
      name: typography.name,
      primaryFont: typography.primaryFont,
      secondaryFont: typography.secondaryFont,
      description: `Popular typography: ${typography.name}`,
    };
    this.selectedTypographyId.set(typography.id);
    this.typographySelected.emit(typographyModel);
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
    const selectedTypography = this.currentSelectedTypography() || this.customPreviewTypography();
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
      const selectedTypography = this.currentSelectedTypography() || this.customPreviewTypography();
      const projectData: Partial<ProjectModel> = {
        analysisResultModel: {
          ...this.project.analysisResultModel,
          branding: {
            ...this.project.analysisResultModel?.branding,
            typography: selectedTypography,
          },
        },
      };
      this.projectUpdate.emit(projectData);
      this.nextStep.emit();
    }
  }

  protected selectCustomTypography(typography: TypographyPreview): void {
    this.selectedCustomTypography.set(typography);
    this.selectedTypographyId.set(null);
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

  protected createCustomTypography(): void {
    if (!this.canCreateCustom()) return;

    const customTypography: TypographyPreview = {
      id: `custom-${Date.now()}`,
      name: `${this.selectedPrimaryFont()} + ${this.selectedSecondaryFont()}`,
      primaryFont: this.selectedPrimaryFont(),
      secondaryFont: this.selectedSecondaryFont(),
      category: 'custom',
      isLoaded: true,
    };

    const current = this.customTypographies();
    this.customTypographies.set([...current, customTypography]);
    this.selectedCustomTypography.set(customTypography);
    this.selectedPrimaryFont.set('');
    this.selectedSecondaryFont.set('');
  }

  ngOnInit(): void {
    this.initializeTypographies();
    this.setupSearch();
    this.loadPopularTypographies();
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
    }, 2000);
  }

  private loadPopularTypographies(): void {
    const popular = this.typographyService.getPopularTypographies();
    this.popularTypographies.set(popular);
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
