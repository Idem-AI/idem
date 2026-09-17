import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import {
  CatalogFont,
  FontCategory,
  FontSourceId,
  fontStack,
} from '../../../../../../../shared/services/typography.service';
import { TypographySearchComponent } from '../typography-search/typography-search';
import { TypographyFontImportComponent } from '../typography-font-import/typography-font-import';

/** Deux façons d'obtenir une police : la chercher, ou apporter la sienne. */
type CreatorPanel = 'catalog' | 'import';

@Component({
  selector: 'app-typography-custom-creator',
  imports: [TranslateModule, TypographySearchComponent, TypographyFontImportComponent],
  templateUrl: './typography-custom-creator.html',
  styleUrls: ['./typography-custom-creator.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TypographyCustomCreatorComponent {
  readonly selectedPrimaryFont = input('');
  readonly selectedSecondaryFont = input('');
  readonly selectedPrimaryCategory = input<string | undefined>(undefined);
  readonly selectedSecondaryCategory = input<string | undefined>(undefined);
  readonly searchResults = input<CatalogFont[]>([]);
  readonly isSearching = input(false);

  readonly searchInput = output<string>();
  readonly categoryChanged = output<FontCategory | null>();
  readonly sourceChanged = output<FontSourceId | null>();
  readonly fontSelected = output<{ font: CatalogFont; type: 'primary' | 'secondary' }>();

  protected readonly panel = signal<CreatorPanel>('catalog');

  protected readonly primaryStack = computed(() =>
    fontStack(this.selectedPrimaryFont(), this.selectedPrimaryCategory()),
  );
  protected readonly secondaryStack = computed(() =>
    fontStack(this.selectedSecondaryFont(), this.selectedSecondaryCategory()),
  );

  protected onPanelClick(panel: CreatorPanel): void {
    this.panel.set(panel);
  }

  protected onSearchInput(query: string): void {
    this.searchInput.emit(query);
  }

  protected onCategoryChanged(category: FontCategory | null): void {
    this.categoryChanged.emit(category);
  }

  protected onSourceChanged(source: FontSourceId | null): void {
    this.sourceChanged.emit(source);
  }

  protected onFontSelected(event: { font: CatalogFont; type: 'primary' | 'secondary' }): void {
    this.fontSelected.emit(event);
  }
}
