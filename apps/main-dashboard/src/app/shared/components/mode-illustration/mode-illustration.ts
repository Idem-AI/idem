import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiMode } from '../../../modules/chat/models/chat.model';

/**
 * Illustrations SVG des trois modes d'interface.
 *
 * Dessinées en `currentColor` et en classes de thème : elles suivent le mode
 * clair/sombre et la couleur primaire du produit, contrairement aux captures
 * PNG qu'elles remplacent.
 */
@Component({
  selector: 'app-mode-illustration',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mode-illustration.html',
  styleUrl: './mode-illustration.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModeIllustrationComponent {
  readonly mode = input.required<UiMode>();
}
