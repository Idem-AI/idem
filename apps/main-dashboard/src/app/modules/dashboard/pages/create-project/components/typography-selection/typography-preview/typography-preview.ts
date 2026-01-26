import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { TypographyModel } from '../../../../../models/brand-identity.model';

@Component({
  selector: 'app-typography-preview',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './typography-preview.html',
  styleUrls: ['./typography-preview.css'],
})
export class TypographyPreviewComponent {
  @Input() typography: TypographyModel | null | undefined = null;
  @Input() previewText = signal('Your Brand Name');
}
