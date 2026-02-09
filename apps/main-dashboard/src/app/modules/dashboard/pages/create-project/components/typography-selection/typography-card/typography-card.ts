import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TypographyModel } from '../../../../../models/brand-identity.model';
import { TypographyPreview } from '../../../../../../../shared/services/typography.service';

@Component({
  selector: 'app-typography-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './typography-card.html',
  styleUrls: ['./typography-card.css'],
})
export class TypographyCardComponent {
  @Input() typography!: TypographyModel | TypographyPreview;
  @Input() isSelected = false;
  @Output() selected = new EventEmitter<TypographyModel | TypographyPreview>();

  onSelect(): void {
    this.selected.emit(this.typography);
  }
}
