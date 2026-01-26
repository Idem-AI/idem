import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TypographyModel } from '../../../../../models/brand-identity.model';
import { TypographyPreview } from '../../../../../../../shared/services/typography.service';
import { TypographyCardComponent } from '../typography-card/typography-card';

@Component({
  selector: 'app-popular-typography-list',
  standalone: true,
  imports: [CommonModule, TypographyCardComponent],
  templateUrl: './popular-typography-list.html',
  styleUrls: ['./popular-typography-list.css'],
})
export class PopularTypographyListComponent {
  @Input() typographies: TypographyPreview[] = [];
  @Input() selectedTypographyId: string | null = null;
  @Output() typographySelected = new EventEmitter<TypographyPreview>();

  onTypographySelected(typography: TypographyModel | TypographyPreview): void {
    // Convert TypographyModel to TypographyPreview if needed
    if ('category' in typography && 'isLoaded' in typography) {
      // It's already a TypographyPreview
      this.typographySelected.emit(typography as TypographyPreview);
    } else {
      // It's a TypographyModel, convert to TypographyPreview
      const typographyPreview: TypographyPreview = {
        id: typography.id,
        name: typography.name,
        primaryFont: typography.primaryFont,
        secondaryFont: typography.secondaryFont,
        category: 'popular',
        isLoaded: true,
      };
      this.typographySelected.emit(typographyPreview);
    }
  }

  trackTypography(index: number, typography: TypographyPreview): string {
    return typography.id;
  }
}
