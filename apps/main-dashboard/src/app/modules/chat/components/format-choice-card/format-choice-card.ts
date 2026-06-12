import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

export type ChartePdfFormat = 'A4_PORTRAIT' | 'SLIDE_16_9';

/**
 * Choix du format de la charte graphique (portrait A4 / paysage 16:9)
 * directement dans le fil. Le composer est bloqué tant qu'aucun format
 * n'est choisi — un clic suffit.
 */
@Component({
  selector: 'app-format-choice-card',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './format-choice-card.html',
  styleUrl: './format-choice-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormatChoiceCardComponent {
  /** Format choisi ('cancelled' si abandonné) — fige la carte */
  readonly selected = input<string | null>(null);
  readonly disabled = input<boolean>(false);

  readonly picked = output<ChartePdfFormat>();
  readonly cancelled = output<void>();

  protected pick(format: ChartePdfFormat): void {
    if (this.disabled() || this.selected()) return;
    this.picked.emit(format);
  }

  protected cancel(): void {
    if (this.disabled() || this.selected()) return;
    this.cancelled.emit();
  }
}
