import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import {
  TypographyPreview,
  GoogleFont,
} from '../../../../../../../shared/services/typography.service';
import { TypographySearchComponent } from '../typography-search/typography-search';

@Component({
  selector: 'app-typography-custom-creator',
  standalone: true,
  imports: [CommonModule, TranslateModule, TypographySearchComponent],
  templateUrl: './typography-custom-creator.html',
  styleUrls: ['./typography-custom-creator.css'],
})
export class TypographyCustomCreatorComponent {
  @Input() selectedPrimaryFont = '';
  @Input() selectedSecondaryFont = '';
  @Input() searchResults: GoogleFont[] = [];
  @Input() isSearching = false;

  @Output() searchInput = new EventEmitter<string>();
  @Output() fontSelected = new EventEmitter<{ font: GoogleFont; type: 'primary' | 'secondary' }>();

  onSearchInput(query: string): void {
    this.searchInput.emit(query);
  }

  onFontSelected(event: { font: GoogleFont; type: 'primary' | 'secondary' }): void {
    this.fontSelected.emit(event);
  }
}
