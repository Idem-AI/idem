import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { ColorModel } from '../../../dashboard/models/brand-identity.model';

/**
 * Carte de sélection de palette de couleurs dans le fil de conversation.
 * Une fois un choix fait (selectedId), la carte se fige.
 */
@Component({
  selector: 'app-color-options-card',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './color-options-card.html',
  styleUrl: './color-options-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColorOptionsCardComponent {
  readonly options = input.required<ColorModel[]>();
  readonly selectedId = input<string | null>(null);
  readonly disabled = input<boolean>(false);

  readonly picked = output<ColorModel>();

  protected swatches(option: ColorModel): string[] {
    const colors = option.colors;
    if (!colors) return [];
    return [colors.primary, colors.secondary, colors.accent, colors.background, colors.text].filter(
      Boolean,
    );
  }

  /** Dégradé d'aperçu (primaire → secondaire → accent) pour la bande de tête. */
  protected gradient(option: ColorModel): string {
    const c = option.colors;
    if (!c) return 'transparent';
    return `linear-gradient(120deg, ${c.primary} 0%, ${c.secondary} 55%, ${c.accent} 100%)`;
  }

  protected pick(option: ColorModel): void {
    if (this.disabled() || this.selectedId()) return;
    this.picked.emit(option);
  }
}
