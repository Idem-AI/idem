import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { TypographyModel } from '../../../../../models/brand-identity.model';
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
  @Input() customTypographies: TypographyPreview[] = [];
  @Input() selectedCustomTypography: TypographyPreview | null = null;
  @Input() selectedPrimaryFont = '';
  @Input() selectedSecondaryFont = '';
  @Input() searchResults: GoogleFont[] = [];
  @Input() isSearching = false;
  @Input() canCreateCustom = false;

  @Output() customTypographySelected = new EventEmitter<TypographyPreview>();
  @Output() searchInput = new EventEmitter<string>();
  @Output() fontSelected = new EventEmitter<{ font: GoogleFont; type: 'primary' | 'secondary' }>();
  @Output() customTypographyCreated = new EventEmitter<void>();

  onCustomTypographySelected(typography: TypographyPreview): void {
    this.customTypographySelected.emit(typography);
  }

  onSearchInput(query: string): void {
    this.searchInput.emit(query);
  }

  onFontSelected(event: { font: GoogleFont; type: 'primary' | 'secondary' }): void {
    this.fontSelected.emit(event);
  }

  onCreateCustomTypography(): void {
    this.customTypographyCreated.emit();
  }

  trackCustomTypography(index: number, typography: TypographyPreview): string {
    return typography.id;
  }
}
