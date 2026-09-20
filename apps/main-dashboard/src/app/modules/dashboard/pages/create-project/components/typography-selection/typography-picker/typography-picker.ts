import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import {
  CatalogFont,
  FontCategory,
  FontSourceId,
  TypographyService,
  fontStack,
} from '../../../../../../../shared/services/typography.service';
import { FontSlot } from '../typography-pair-bar/typography-pair-bar';

interface CategoryTile {
  readonly id: FontCategory | null;
  readonly labelKey: string;
  readonly hintKey: string;
  /** Pile système qui DESSINE la catégorie, sans rien charger. */
  readonly specimen: string;
}

/**
 * Choix d'une police pour un rôle.
 *
 * Deux partis pris, tous deux contre la liste de noms qui précédait :
 *
 *  - les catégories sont MONTRÉES, pas nommées. « Serif » ne veut rien dire à
 *    qui n'a jamais composé de page ; un « Ag » à empattements posé à côté d'un
 *    « Ag » sans empattements se comprend sans explication. Les spécimens sont
 *    des piles système, donc dessinés immédiatement, sans requête ;
 *  - chaque police est présentée avec le NOM DE LA MARQUE composé dedans. On ne
 *    choisit pas « Fraunces », on choisit la façon dont son propre nom est
 *    écrit — et ça, ça se juge d'un coup d'œil.
 */
@Component({
  selector: 'app-typography-picker',
  imports: [TranslateModule],
  templateUrl: './typography-picker.html',
  styleUrls: ['./typography-picker.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TypographyPickerComponent {
  private readonly typographyService = inject(TypographyService);

  readonly slot = input<FontSlot>('primary');
  readonly brandName = input('');
  readonly currentFamily = input('');
  readonly searchResults = input<CatalogFont[]>([]);
  readonly isSearching = input(false);

  readonly searchInput = output<string>();
  readonly categoryChanged = output<FontCategory | null>();
  readonly sourceChanged = output<FontSourceId | null>();
  readonly fontSelected = output<CatalogFont>();
  readonly back = output<void>();
  readonly importRequested = output<void>();

  protected readonly searchQuery = signal('');
  protected readonly activeCategory = signal<FontCategory | null>(null);

  /**
   * Les piles portent `!important` : `styles.css` impose la police de marque à
   * tout le document, et une déclaration importante de feuille bat un style
   * en ligne ordinaire — le spécimen sortirait alors en Vilevile.
   */
  protected readonly categories: readonly CategoryTile[] = [
    {
      id: null,
      labelKey: 'dashboard.typographySelection.categories.all',
      hintKey: 'dashboard.typographySelection.categoryHints.all',
      specimen: 'inherit',
    },
    {
      id: 'sans-serif',
      labelKey: 'dashboard.typographySelection.categories.sansSerif',
      hintKey: 'dashboard.typographySelection.categoryHints.sansSerif',
      specimen: 'Helvetica, Arial, system-ui, sans-serif !important',
    },
    {
      id: 'serif',
      labelKey: 'dashboard.typographySelection.categories.serif',
      hintKey: 'dashboard.typographySelection.categoryHints.serif',
      specimen: 'Georgia, "Times New Roman", serif !important',
    },
    {
      id: 'display',
      labelKey: 'dashboard.typographySelection.categories.display',
      hintKey: 'dashboard.typographySelection.categoryHints.display',
      specimen: 'Impact, "Arial Narrow Bold", Haettenschweiler, sans-serif !important',
    },
    {
      id: 'handwriting',
      labelKey: 'dashboard.typographySelection.categories.handwriting',
      hintKey: 'dashboard.typographySelection.categoryHints.handwriting',
      specimen: '"Snell Roundhand", "Brush Script MT", cursive !important',
    },
    {
      id: 'monospace',
      labelKey: 'dashboard.typographySelection.categories.monospace',
      hintKey: 'dashboard.typographySelection.categoryHints.monospace',
      specimen: 'ui-monospace, Menlo, Consolas, monospace !important',
    },
  ];

  protected readonly sources: ReadonlyArray<{ id: FontSourceId | ''; labelKey: string }> = [
    { id: '', labelKey: 'dashboard.typographySelection.sources.all' },
    { id: 'google', labelKey: 'dashboard.typographySelection.sources.google' },
    { id: 'fontshare', labelKey: 'dashboard.typographySelection.sources.fontshare' },
    { id: 'fontsource', labelKey: 'dashboard.typographySelection.sources.fontsource' },
    { id: 'custom', labelKey: 'dashboard.typographySelection.sources.custom' },
  ];

  constructor() {
    // Chaque vignette est composée dans sa propre police : on les charge depuis
    // la source dont elles viennent, pas depuis Google par défaut.
    effect(() => {
      const fonts = this.searchResults();
      if (fonts.length > 0) {
        void this.typographyService.loadFonts(fonts);
      }
    });
  }

  /** Le nom du projet fait un bien meilleur spécimen qu'un texte inventé. */
  protected sample(): string {
    return this.brandName().trim() || 'Votre marque';
  }

  protected titleKey(): string {
    return this.slot() === 'primary'
      ? 'dashboard.typographySelection.picker.titleHeadings'
      : 'dashboard.typographySelection.picker.titleBody';
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

  protected onSourceChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.sourceChanged.emit((value || null) as FontSourceId | null);
  }

  protected onSelect(font: CatalogFont): void {
    this.fontSelected.emit(font);
  }

  protected stackFor(font: CatalogFont): string {
    return fontStack(font.family, font.category);
  }

  protected sourceLabelKey(font: CatalogFont): string {
    return (
      this.sources.find((source) => source.id === font.source)?.labelKey ??
      'dashboard.typographySelection.sources.google'
    );
  }

  protected isCurrent(font: CatalogFont): boolean {
    return this.currentFamily() === font.family;
  }
}
