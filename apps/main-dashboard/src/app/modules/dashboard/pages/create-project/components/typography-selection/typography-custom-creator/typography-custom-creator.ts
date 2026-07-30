import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import {
  FontCategory,
  GoogleFont,
  fontStack,
} from '../../../../../../../shared/services/typography.service';
import { TypographySearchComponent } from '../typography-search/typography-search';

@Component({
  selector: 'app-typography-custom-creator',
  imports: [TranslateModule, TypographySearchComponent],
  templateUrl: './typography-custom-creator.html',
  styleUrls: ['./typography-custom-creator.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TypographyCustomCreatorComponent {
  readonly selectedPrimaryFont = input('');
  readonly selectedSecondaryFont = input('');
  readonly searchResults = input<GoogleFont[]>([]);
  readonly isSearching = input(false);

  readonly searchInput = output<string>();
  readonly categoryChanged = output<FontCategory | null>();
  readonly fontSelected = output<{ font: GoogleFont; type: 'primary' | 'secondary' }>();

  protected readonly primaryStack = computed(() => fontStack(this.selectedPrimaryFont()));
  protected readonly secondaryStack = computed(() => fontStack(this.selectedSecondaryFont()));

  protected onSearchInput(query: string): void {
    this.searchInput.emit(query);
  }

  protected onCategoryChanged(category: FontCategory | null): void {
    this.categoryChanged.emit(category);
  }

  protected onFontSelected(event: { font: GoogleFont; type: 'primary' | 'secondary' }): void {
    this.fontSelected.emit(event);
  }
}
