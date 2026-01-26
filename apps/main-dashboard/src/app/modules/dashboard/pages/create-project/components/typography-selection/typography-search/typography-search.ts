import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { TypographyModel } from '../../../../../models/brand-identity.model';

@Component({
  selector: 'app-typography-search',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './typography-search.html',
  styleUrls: ['./typography-search.css'],
})
export class TypographySearchComponent {
  @Input() searchResults: any[] = [];
  @Input() isSearching = false;
  @Output() searchInput = new EventEmitter<string>();
  @Output() fontSelected = new EventEmitter<{ font: any; type: 'primary' | 'secondary' }>();
  @Output() customTypographyCreated = new EventEmitter<TypographyModel>();

  searchQuery = signal('');

  onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchQuery.set(target.value);
    this.searchInput.emit(target.value);
  }

  onFontSelect(font: any, type: 'primary' | 'secondary'): void {
    this.fontSelected.emit({ font, type });
  }

  onCreateCustomTypography(primaryFont: string, secondaryFont: string): void {
    const customTypography: TypographyModel = {
      id: `custom-${Date.now()}`,
      name: `${primaryFont} + ${secondaryFont}`,
      primaryFont,
      secondaryFont,
      description: 'Custom typography combination',
    };
    this.customTypographyCreated.emit(customTypography);
  }
}
