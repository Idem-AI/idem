import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import {
  FontCategory,
  GoogleFont,
  TypographyService,
  fontStack,
} from '../../../../../../../shared/services/typography.service';

interface CategoryFilter {
  readonly id: FontCategory | null;
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

  readonly searchResults = input<GoogleFont[]>([]);
  readonly isSearching = input(false);
  readonly selectedPrimaryFont = input('');
  readonly selectedSecondaryFont = input('');

  readonly searchInput = output<string>();
  readonly categoryChanged = output<FontCategory | null>();
  readonly fontSelected = output<{ font: GoogleFont; type: 'primary' | 'secondary' }>();

  protected readonly searchQuery = signal('');
  protected readonly activeCategory = signal<FontCategory | null>(null);

  protected readonly categories: readonly CategoryFilter[] = [
    { id: null, labelKey: 'dashboard.typographySelection.categories.all' },
    { id: 'sans-serif', labelKey: 'dashboard.typographySelection.categories.sansSerif' },
    { id: 'serif', labelKey: 'dashboard.typographySelection.categories.serif' },
    { id: 'display', labelKey: 'dashboard.typographySelection.categories.display' },
    { id: 'handwriting', labelKey: 'dashboard.typographySelection.categories.handwriting' },
    { id: 'monospace', labelKey: 'dashboard.typographySelection.categories.monospace' },
  ];

  constructor() {
    // Each row is rendered in its own typeface — pull every visible family in a
    // single batched Google Fonts request.
    effect(() => {
      const families = this.searchResults().map((font) => font.family);
      if (families.length > 0) {
        void this.typographyService.loadGoogleFonts(families);
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

  protected onFontSelect(font: GoogleFont, type: 'primary' | 'secondary'): void {
    this.fontSelected.emit({ font, type });
  }

  protected stackFor(font: GoogleFont): string {
    return fontStack(font.family, font.category);
  }

  protected categoryLabelKey(font: GoogleFont): string {
    const match = this.categories.find((category) => category.id === font.category);
    return match?.labelKey ?? 'dashboard.typographySelection.categories.all';
  }

  protected isPrimary(font: GoogleFont): boolean {
    return this.selectedPrimaryFont() === font.family;
  }

  protected isSecondary(font: GoogleFont): boolean {
    return this.selectedSecondaryFont() === font.family;
  }
}
