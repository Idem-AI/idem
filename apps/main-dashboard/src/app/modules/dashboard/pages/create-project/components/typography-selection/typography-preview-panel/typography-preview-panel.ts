import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { TypographyModel } from '../../../../../models/brand-identity.model';

@Component({
  selector: 'app-typography-preview-panel',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './typography-preview-panel.html',
  styleUrls: ['./typography-preview-panel.css'],
})
export class TypographyPreviewPanelComponent {
  @Input() typography: TypographyModel | null = null;
  @Input() previewText = signal('Your Brand Name');
  @Input() selectedPrimaryFont = '';
  @Input() selectedSecondaryFont = '';

  get primaryFont(): string {
    return this.typography?.primaryFont || this.selectedPrimaryFont || 'inherit';
  }

  get secondaryFont(): string {
    return this.typography?.secondaryFont || this.selectedSecondaryFont || 'inherit';
  }
}
