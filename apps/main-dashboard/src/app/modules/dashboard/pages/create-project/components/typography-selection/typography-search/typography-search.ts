import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import {
  CatalogFont,
  FontCategory,
  FontSourceId,
  TypographyService,
  fontStack,
} from '../../../../../../../shared/services/typography.service';

interface CategoryFilter {
  readonly id: FontCategory | null;
  readonly labelKey: string;
}

interface SourceFilter {
  readonly id: FontSourceId | null;
  readonly labelKey: string;
}

@Component({
  selector: 'app-typography-search',
  imports: [TranslateModule],
  templateUrl: './typography-search.html',
  styleUrls: ['./typography-search.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TypographySearchComponent {
  private readonly typographyService = inject(TypographyService);

  readonly searchResults = input<CatalogFont[]>([]);
  readonly isSearching = input(false);
  readonly selectedPrimaryFont = input('');
  readonly selectedSecondaryFont = input('');

  readonly searchInput = output<string>();
  readonly categoryChanged = output<FontCategory | null>();
  readonly sourceChanged = output<FontSourceId | null>();
  readonly fontSelected = output<{ font: CatalogFont; type: 'primary' | 'secondary' }>();

  protected readonly searchQuery = signal('');
  protected readonly activeCategory = signal<FontCategory | null>(null);
  protected readonly activeSource = signal<FontSourceId | null>(null);

  protected readonly categories: readonly CategoryFilter[] = [
    { id: null, labelKey: 'dashboard.typographySelection.categories.all' },
    { id: 'sans-serif', labelKey: 'dashboard.typographySelection.categories.sansSerif' },
    { id: 'serif', labelKey: 'dashboard.typographySelection.categories.serif' },
    { id: 'display', labelKey: 'dashboard.typographySelection.categories.display' },
    { id: 'handwriting', labelKey: 'dashboard.typographySelection.categories.handwriting' },
    { id: 'monospace', labelKey: 'dashboard.typographySelection.categories.monospace' },
  ];

  /**
   * Les fonderies disponibles. Elles sont listées en dur plutôt que chargées
   * depuis `/fonts/sources` : ce sont des libellés, la liste bouge à peu près
   * jamais, et un filtre qui apparaît après coup fait sauter la mise en page.
   */
  protected readonly sources: readonly SourceFilter[] = [
    { id: null, labelKey: 'dashboard.typographySelection.sources.all' },
    { id: 'google', labelKey: 'dashboard.typographySelection.sources.google' },
    { id: 'fontshare', labelKey: 'dashboard.typographySelection.sources.fontshare' },
    { id: 'fontsource', labelKey: 'dashboard.typographySelection.sources.fontsource' },
    { id: 'custom', labelKey: 'dashboard.typographySelection.sources.custom' },
  ];

  constructor() {
    // Each row is rendered in its own typeface — load every visible family from
    // the source it actually comes from, not from Google by default.
    effect(() => {
      const fonts = this.searchResults();
      if (fonts.length > 0) {
        void this.typographyService.loadFonts(fonts);
      }
    });
  }

  protected onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
    this.searchInput.emit(value);
  }

  protected onClearSearch(): void {
    this.searchQuery.set('');
    this.searchInput.emit('');
  }

  protected onCategoryClick(category: FontCategory | null): void {
    if (this.activeCategory() === category) return;
    this.activeCategory.set(category);
    this.categoryChanged.emit(category);
  }

  protected onSourceClick(source: FontSourceId | null): void {
    if (this.activeSource() === source) return;
    this.activeSource.set(source);
    this.sourceChanged.emit(source);
  }

  protected onFontSelect(font: CatalogFont, type: 'primary' | 'secondary'): void {
    this.fontSelected.emit({ font, type });
  }

  protected stackFor(font: CatalogFont): string {
    return fontStack(font.family, font.category);
  }

  protected categoryLabelKey(font: CatalogFont): string {
    const match = this.categories.find((category) => category.id === font.category);
    return match?.labelKey ?? 'dashboard.typographySelection.categories.all';
  }

  protected sourceLabelKey(font: CatalogFont): string {
    const match = this.sources.find((source) => source.id === font.source);
    return match?.labelKey ?? 'dashboard.typographySelection.sources.google';
  }

  protected isPrimary(font: CatalogFont): boolean {
    return this.selectedPrimaryFont() === font.family;
  }

  protected isSecondary(font: CatalogFont): boolean {
    return this.selectedSecondaryFont() === font.family;
  }
}
