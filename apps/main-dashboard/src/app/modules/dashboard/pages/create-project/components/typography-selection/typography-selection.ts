import {
  ChangeDetectionStrategy,
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  effect,
  signal,
  computed,
  inject,
} from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { TypographyModel } from '../../../../models/brand-identity.model';
import {
  FontCategory,
  GoogleFont,
  TypographyService,
} from '../../../../../../shared/services/typography.service';
import { debounceTime, distinctUntilChanged, switchMap, takeUntil } from 'rxjs/operators';
import { Subject, of } from 'rxjs';
import { TypographyPreviewComponent } from './typography-preview/typography-preview';
import { ProjectModel } from '@idem/shared-models';

// Import new sub-components
import { TypographyTabsComponent, TypographyTab } from './typography-tabs/typography-tabs';
import { TypographyGeneratedListComponent } from './typography-generated-list/typography-generated-list';
import { TypographyCustomCreatorComponent } from './typography-custom-creator/typography-custom-creator';

interface SearchRequest {
  readonly query: string;
  readonly category: FontCategory | null;
}

@Component({
  selector: 'app-typography-selection',
  imports: [
    TranslateModule,
    TypographyPreviewComponent,
    TypographyTabsComponent,
    TypographyGeneratedListComponent,
    TypographyCustomCreatorComponent,
  ],
  templateUrl: './typography-selection.html',
  styleUrls: ['./typography-selection.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TypographySelectionComponent implements OnInit, OnDestroy {
  // Services
  private readonly typographyService = inject(TypographyService);
  private readonly destroy$ = new Subject<void>();
  private readonly searchSubject = new Subject<SearchRequest>();
  private catalogRequested = false;

  // Inputs
  @Input() project: ProjectModel = {} as ProjectModel;

  // Outputs
  @Output() readonly typographySelected = new EventEmitter<TypographyModel>();
  @Output() readonly projectUpdate = new EventEmitter<Partial<ProjectModel>>();
  @Output() readonly typographySelectionChanged = new EventEmitter<boolean>();

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
  protected searchCategory = signal<FontCategory | null>(null);
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
      return (
        this.typographyModels().find(
          (t: TypographyModel) => t.id === this.selectedTypographyId(),
        ) ?? null
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

  constructor() {
    // Fetch every family shown in the list up-front so the cards and the preview
    // render with the real typeface instead of the browser default.
    effect(() => {
      const families = this.typographyModels().flatMap((typography) => [
        typography.primaryFont,
        typography.secondaryFont,
      ]);
      if (families.length > 0) {
        void this.typographyService.loadGoogleFonts(families);
      }
    });
  }

  // Event handlers for new template
  protected onTabChanged(tab: TypographyTab): void {
    this.activeTab.set(tab);
    // If switching to generated, ensure something is selected if possible
    if (tab === 'generated' && !this.selectedTypographyId() && this.typographyModels().length > 0) {
      this.selectedTypographyId.set(this.typographyModels()[0].id);
    }
    if (tab === 'custom') {
      this.ensureCatalogLoaded();
    }
    this.notifySelectionChange();
  }

  protected onTypographySelected(typography: TypographyModel): void {
    this.selectedTypographyId.set(typography.id);
    this.typographySelected.emit(typography);
    this.notifySelectionChange();
  }

  protected onRegenerateTypographies(): void {
    this.regenerateTypographies();
  }

  protected retry(): void {
    this.hasError.set(false);
    this.isLoading.set(true);
    this.initializeTypographies();
  }

  // Method to prepare and emit project data when parent requests it
  public prepareTypographyData(): Partial<ProjectModel> | null {
    const selectedTypography = this.currentSelectedTypography();
    if (!selectedTypography) return null;

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
      const existingCustomIndex = updatedGeneratedTypography.findIndex((t: TypographyModel) =>
        t.id.startsWith('custom-'),
      );
      if (existingCustomIndex >= 0) {
        updatedGeneratedTypography[existingCustomIndex] = customTypography;
      } else {
        updatedGeneratedTypography = [...updatedGeneratedTypography, customTypography];
      }

      selectedTypography.id = customTypography.id; // Update the selected typography ID
    }

    return {
      analysisResultModel: {
        ...this.project.analysisResultModel,
        branding: {
          ...this.project.analysisResultModel?.branding,
          typography: selectedTypography,
          generatedTypography: updatedGeneratedTypography,
        },
      },
    };
  }

  // Notify parent about selection state changes
  private notifySelectionChange(): void {
    this.typographySelectionChanged.emit(this.canContinue());
  }

  protected onSearchInput(query: string): void {
    this.searchQuery.set(query);
    this.searchSubject.next({ query, category: this.searchCategory() });
  }

  protected onCategoryChanged(category: FontCategory | null): void {
    this.searchCategory.set(category);
    this.searchSubject.next({ query: this.searchQuery(), category });
  }

  protected selectFont(event: { font: GoogleFont; type: 'primary' | 'secondary' }): void {
    const { font, type } = event;
    if (type === 'primary') {
      this.selectedPrimaryFont.set(font.family);
    } else {
      this.selectedSecondaryFont.set(font.family);
    }
    void this.typographyService.loadGoogleFont(font.family);
    this.notifySelectionChange();
  }

  ngOnInit(): void {
    const brandName = this.project?.name?.trim();
    if (brandName) {
      this.previewText.set(brandName);
    }
    this.initializeTypographies();
    this.setupSearch();
  }

  /**
   * Shows popular families as soon as the custom tab opens, so the panel is
   * browsable before anything is typed. Deferred until then: the catalog is a
   * ~36 kB download nobody needs while staying on the generated tab.
   */
  private ensureCatalogLoaded(): void {
    if (this.catalogRequested) return;
    this.catalogRequested = true;
    this.isSearching.set(true);
    this.searchSubject.next({ query: '', category: null });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeTypographies(): void {
    const generatedTypography = this.project.analysisResultModel?.branding?.generatedTypography;

    if (generatedTypography && generatedTypography.length > 0) {
      this.typographyModels.set(generatedTypography);
      this.isLoading.set(false);
      // Auto-select first typography if none selected
      if (!this.selectedTypographyId()) {
        this.selectedTypographyId.set(generatedTypography[0].id);
        this.notifySelectionChange();
      }
    } else {
      this.isLoading.set(false);
      this.regenerateTypographies();
    }
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
          secondaryFont: 'Source Sans 3',
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
        this.notifySelectionChange();
      }
    }, 2000);
  }

  private setupSearch(): void {
    this.searchSubject
      .pipe(
        debounceTime(250),
        distinctUntilChanged(
          (previous, current) =>
            previous.query === current.query && previous.category === current.category,
        ),
        switchMap(({ query, category }) => {
          // A single character matches almost everything: wait for a real term,
          // but keep browsing by category available with an empty query.
          if (query.trim().length === 1) {
            return of([]);
          }
          this.isSearching.set(true);
          return this.typographyService.searchGoogleFonts(query, category);
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
          this.searchResults.set([]);
          this.isSearching.set(false);
        },
      });
  }
}
