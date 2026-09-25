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
import { BrandFont, TypographyModel } from '../../../../models/brand-identity.model';
import {
  CatalogFont,
  FontCategory,
  FontSourceId,
  TypographyService,
} from '../../../../../../shared/services/typography.service';
import { debounceTime, distinctUntilChanged, switchMap, takeUntil } from 'rxjs/operators';
import { Subject, of } from 'rxjs';
import { TypographyPreviewComponent } from './typography-preview/typography-preview';
import { ProjectModel } from '@idem/shared-models';

import { FontSlot, TypographyPairBarComponent } from './typography-pair-bar/typography-pair-bar';
import { TypographyGalleryComponent } from './typography-gallery/typography-gallery';
import { TypographyPickerComponent } from './typography-picker/typography-picker';
import { TypographyFontImportComponent } from './typography-font-import/typography-font-import';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';

/** Ce que le panneau central montre. Une seule chose à la fois. */
type TypographyView = 'gallery' | 'picker' | 'import';

interface SearchRequest {
  readonly query: string;
  readonly category: FontCategory | null;
  /** Fonderie demandée ; `null` = toutes. */
  readonly source: FontSourceId | null;
}

/**
 * Choix de la typographie de la marque.
 *
 * L'écran se choisit EN REGARDANT, pas en lisant :
 *
 *  - la galerie d'allures est la surface principale. Chaque carte est la page
 *    de marque en miniature, composée avec le nom du projet : un clic pose les
 *    deux polices, et c'est le chemin que prendra la plupart des gens ;
 *  - la paire retenue est rappelée en haut, écrite dans ses propres polices —
 *    on voit ce qu'on a, pas le nom de ce qu'on a ;
 *  - « Changer » ouvre le choix de CETTE police-là. Il n'y a donc aucun
 *    emplacement « actif » implicite à deviner, et jamais plus d'une chose à
 *    l'écran : la galerie, ou le choix d'une police, ou l'import.
 *
 * La PAIRE est l'unique source de vérité. Une allure ne fait que la remplir
 * d'un coup : l'étape reste donc valide quelle que soit la vue ouverte.
 */
@Component({
  selector: 'app-typography-selection',
  imports: [
    TranslateModule,
    TypographyPreviewComponent,
    TypographyPairBarComponent,
    TypographyGalleryComponent,
    TypographyPickerComponent,
    TypographyFontImportComponent, IdemLoaderComponent],
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
  protected readonly view = signal<TypographyView>('gallery');
  /** La police que le choix en cours va remplacer. */
  protected readonly pickerSlot = signal<FontSlot>('primary');
  protected readonly isLoading = signal(true);
  protected readonly hasError = signal(false);
  protected readonly isGenerating = signal(false);
  protected readonly typographyModels = signal<TypographyModel[]>([]);

  protected readonly selectedPrimary = signal<BrandFont | null>(null);
  protected readonly selectedSecondary = signal<BrandFont | null>(null);

  // Search Signals
  protected readonly searchResults = signal<CatalogFont[]>([]);
  protected readonly isSearching = signal(false);
  protected readonly searchQuery = signal('');
  protected readonly searchCategory = signal<FontCategory | null>(null);
  protected readonly searchSource = signal<FontSourceId | null>(null);
  protected readonly previewText = signal('Your Brand Name');

  // Computed properties
  protected readonly hasGeneratedTypographies = computed(() => this.typographyModels().length > 0);

  /** L'étape est franchissable dès que les deux emplacements sont remplis. */
  protected readonly canContinue = computed(
    () => !!this.selectedPrimary() && !!this.selectedSecondary()
  );

  /**
   * La suggestion qui correspond exactement à la paire en cours, s'il y en a
   * une : c'est ce qui coche la carte, même après un passage par le catalogue.
   */
  protected readonly matchingSuggestionId = computed(() => {
    const primary = this.selectedPrimary()?.family;
    const secondary = this.selectedSecondary()?.family;
    if (!primary || !secondary) return null;
    return (
      this.typographyModels().find(
        (typography) =>
          typography.primaryFont === primary && typography.secondaryFont === secondary
      )?.id ?? null
    );
  });

  /** La paire, sous la forme attendue par l'aperçu et par la sauvegarde. */
  protected readonly currentSelectedTypography = computed<TypographyModel | null>(() => {
    const primary = this.selectedPrimary();
    const secondary = this.selectedSecondary();
    if (!primary && !secondary) return null;

    const suggestion = this.typographyModels().find(
      (typography) => typography.id === this.matchingSuggestionId()
    );

    return {
      id: suggestion?.id ?? 'custom-preview',
      name: suggestion?.name ?? 'Custom Selection',
      description: suggestion?.description,
      primaryFont: primary?.family ?? '',
      secondaryFont: secondary?.family ?? '',
      ...(primary ? { primary } : {}),
      ...(secondary ? { secondary } : {}),
      // La feuille de la police de titre : c'est elle qui portera la marque
      // dans les livrables, et c'est ce qui part en base à la place du lien
      // Google quand la police vient d'ailleurs.
      url: primary?.cssUrl ?? secondary?.cssUrl ?? suggestion?.url,
    };
  });

  constructor() {
    // Les cartes de suggestion se dessinent dans leur propre typographie :
    // chaque famille est chargée depuis SA source, l'agent en propose désormais
    // qui ne sont pas chez Google.
    effect(() => {
      for (const typography of this.typographyModels()) {
        void this.typographyService.loadTypography(typography);
      }
    });
  }

  // ─── Navigation : une seule chose à l'écran à la fois ───────────────────────

  /** « Changer » sur un emplacement ouvre le choix de CETTE police. */
  protected onChangeRequested(slot: FontSlot): void {
    this.pickerSlot.set(slot);
    this.view.set('picker');
    this.ensureCatalogLoaded();
  }

  protected onBackToGallery(): void {
    this.view.set('gallery');
  }

  protected onImportRequested(): void {
    this.view.set('import');
  }

  protected onBackToPicker(): void {
    this.view.set('picker');
  }

  /** La police de l'emplacement en cours de modification. */
  protected currentPickerFamily(): string {
    const font = this.pickerSlot() === 'primary' ? this.selectedPrimary() : this.selectedSecondary();
    return font?.family ?? '';
  }

  // ─── Remplissage de la paire ────────────────────────────────────────────────

  /** Une suggestion remplit les DEUX emplacements : c'est tout son intérêt. */
  protected onTypographySelected(typography: TypographyModel): void {
    this.selectedPrimary.set(brandFontOf(typography, 'primary'));
    this.selectedSecondary.set(brandFontOf(typography, 'secondary'));
    void this.typographyService.loadTypography(typography);
    this.typographySelected.emit(typography);
    this.notifySelectionChange();
  }

  /**
   * Une police choisie remplace celle de l'emplacement en cours.
   *
   * On RESTE dans le choix : le rappel du haut et l'aperçu de droite changent
   * aussitôt, ce qui permet d'en essayer plusieurs à la suite. Renvoyer à la
   * galerie à chaque clic ferait trois gestes par essai.
   */
  protected onFontChosen(font: CatalogFont): void {
    const brandFont: BrandFont = {
      family: font.family,
      source: font.source,
      cssUrl: font.cssUrl,
      category: font.category,
      weights: font.weights,
      ...(font.source === 'custom' ? { customFontId: font.sourceId } : {}),
    };

    if (this.pickerSlot() === 'primary') this.selectedPrimary.set(brandFont);
    else this.selectedSecondary.set(brandFont);

    void this.typographyService.loadFonts([brandFont]);
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

  // ─── Recherche ──────────────────────────────────────────────────────────────

  protected onSearchInput(query: string): void {
    this.searchQuery.set(query);
    this.searchSubject.next({
      query,
      category: this.searchCategory(),
      source: this.searchSource(),
    });
  }

  protected onCategoryChanged(category: FontCategory | null): void {
    this.searchCategory.set(category);
    this.searchSubject.next({ query: this.searchQuery(), category, source: this.searchSource() });
  }

  protected onSourceChanged(source: FontSourceId | null): void {
    this.searchSource.set(source);
    this.searchSubject.next({
      query: this.searchQuery(),
      category: this.searchCategory(),
      source,
    });
  }

  // ─── Sauvegarde ─────────────────────────────────────────────────────────────

  /**
   * Prépare l'écriture du projet à la demande du parent.
   *
   * La paire choisie est aussi ajoutée à la liste des propositions quand elle
   * n'en vient pas, pour que le récapitulatif du projet puisse la retrouver.
   */
  public prepareTypographyData(): Partial<ProjectModel> | null {
    const selected = this.currentSelectedTypography();
    if (!selected || !selected.primaryFont || !selected.secondaryFont) return null;

    const existing = this.project.analysisResultModel?.branding?.generatedTypography || [];

    // Une paire composée à la main n'a pas d'identité propre : on lui en donne
    // une et on la range auprès des propositions, faute de quoi le
    // récapitulatif du projet ne saurait pas la retrouver. Une seule à la fois :
    // la précédente est remplacée, pas empilée.
    const isCustom = selected.id === 'custom-preview';
    const typography: TypographyModel = isCustom
      ? { ...selected, id: `custom-${Date.now()}` }
      : selected;

    const customIndex = existing.findIndex((t: TypographyModel) => t.id.startsWith('custom-'));
    const generatedTypography = !isCustom
      ? existing
      : customIndex >= 0
        ? existing.map((t: TypographyModel, index: number) =>
            index === customIndex ? typography : t
          )
        : [...existing, typography];

    return {
      analysisResultModel: {
        ...this.project.analysisResultModel,
        branding: {
          ...this.project.analysisResultModel?.branding,
          typography,
          generatedTypography,
        },
      },
    };
  }

  // Notify parent about selection state changes
  private notifySelectionChange(): void {
    this.typographySelectionChanged.emit(this.canContinue());
  }

  ngOnInit(): void {
    const brandName = this.project?.name?.trim();
    if (brandName) {
      this.previewText.set(brandName);
    }
    this.initializeTypographies();
    this.restoreSelection();
    this.setupSearch();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Shows popular families as soon as the browse tab opens, so the panel is
   * browsable before anything is typed. Deferred until then: the catalog is a
   * ~36 kB download nobody needs while staying on the suggestions tab.
   */
  private ensureCatalogLoaded(): void {
    if (this.catalogRequested) return;
    this.catalogRequested = true;
    this.isSearching.set(true);
    this.searchSubject.next({ query: '', category: null, source: null });
  }

  private initializeTypographies(): void {
    const generatedTypography = this.project.analysisResultModel?.branding?.generatedTypography;

    if (generatedTypography && generatedTypography.length > 0) {
      this.typographyModels.set(generatedTypography);
      this.isLoading.set(false);
    } else {
      this.isLoading.set(false);
      this.regenerateTypographies();
    }
  }

  /**
   * Remet en place la paire déjà enregistrée.
   *
   * Sans cela, l'utilisateur qui revient sur l'étape retrouve un écran vide
   * alors que son choix est bien en base — et depuis qu'il peut importer sa
   * propre police, ce vide ressemble à un import perdu.
   */
  private restoreSelection(): void {
    const typography = this.project.analysisResultModel?.branding?.typography;
    if (!typography?.primaryFont && !typography?.secondaryFont) {
      this.autoSelectFirstSuggestion();
      return;
    }

    this.selectedPrimary.set(brandFontOf(typography, 'primary'));
    this.selectedSecondary.set(brandFontOf(typography, 'secondary'));
    void this.typographyService.loadTypography(typography);
    this.notifySelectionChange();
  }

  /** Une proposition posée d'entrée vaut mieux qu'un écran sans réponse. */
  private autoSelectFirstSuggestion(): void {
    const first = this.typographyModels()[0];
    if (first) this.onTypographySelected(first);
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
      if (!this.canContinue()) this.autoSelectFirstSuggestion();
    }, 2000);
  }

  private setupSearch(): void {
    this.searchSubject
      .pipe(
        debounceTime(250),
        distinctUntilChanged(
          (previous, current) =>
            previous.query === current.query &&
            previous.category === current.category &&
            previous.source === current.source,
        ),
        switchMap(({ query, category, source }) => {
          // A single character matches almost everything: wait for a real term,
          // but keep browsing by category available with an empty query.
          if (query.trim().length === 1) {
            return of([]);
          }
          this.isSearching.set(true);
          return this.typographyService.searchFonts(query, category, source ? [source] : null);
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

/**
 * La police d'un rôle, descripteur compris quand la donnée le porte.
 *
 * Les typographies enregistrées avant l'ouverture aux autres fonderies n'ont
 * qu'un nom de famille : on les traite comme des polices Google, ce qui était
 * la seule possibilité à l'époque où elles ont été écrites.
 */
function brandFontOf(typography: Partial<TypographyModel>, slot: FontSlot): BrandFont | null {
  const descriptor = slot === 'primary' ? typography.primary : typography.secondary;
  if (descriptor?.family) return descriptor;

  const family = (slot === 'primary' ? typography.primaryFont : typography.secondaryFont)?.trim();
  return family ? { family, source: 'google' } : null;
}
