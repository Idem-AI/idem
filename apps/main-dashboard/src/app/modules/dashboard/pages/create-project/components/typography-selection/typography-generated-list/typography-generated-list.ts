import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { TypographyModel } from '../../../../../models/brand-identity.model';
import { TypographyCardComponent } from '../typography-card/typography-card';

@Component({
  selector: 'app-typography-generated-list',
  standalone: true,
  imports: [CommonModule, TranslateModule, TypographyCardComponent],
  templateUrl: './typography-generated-list.html',
  styleUrls: ['./typography-generated-list.css'],
})
export class TypographyGeneratedListComponent implements OnChanges {
  @Input() typographies: TypographyModel[] = [];
  @Input() selectedTypographyId: string | null = null;
  @Input() isLoading = false;
  @Output() typographySelected = new EventEmitter<TypographyModel>();
  @Output() regenerateRequest = new EventEmitter<void>();

  get selectedTypography(): TypographyModel | null {
    return this.selectedTypographyId
      ? this.typographies.find((t) => t.id === this.selectedTypographyId) || null
      : null;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['typographies'] && this.typographies.length > 0 && !this.selectedTypographyId) {
      // Auto-select the first typography if none is selected
      this.onTypographySelected(this.typographies[0]);
    }
  }

  onTypographySelected(typography: TypographyModel | any): void {
    // Handle both TypographyModel and TypographyPreview types
    this.typographySelected.emit(typography);
  }

  onRegenerate(): void {
    this.regenerateRequest.emit();
  }

  trackTypography(index: number, typography: TypographyModel): string {
    return typography.id;
  }
}
