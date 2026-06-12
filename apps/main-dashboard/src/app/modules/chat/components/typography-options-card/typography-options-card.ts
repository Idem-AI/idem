import { ChangeDetectionStrategy, Component, OnInit, inject, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { TypographyModel } from '../../../dashboard/models/brand-identity.model';
import { TypographyService } from '../../../../shared/services/typography.service';

/**
 * Carte de sélection de typographie dans le fil de conversation.
 * Charge les Google Fonts proposées pour un aperçu réel des polices.
 */
@Component({
  selector: 'app-typography-options-card',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './typography-options-card.html',
  styleUrl: './typography-options-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TypographyOptionsCardComponent implements OnInit {
  private readonly typographyService = inject(TypographyService);

  readonly options = input.required<TypographyModel[]>();
  readonly selectedId = input<string | null>(null);
  readonly disabled = input<boolean>(false);

  readonly picked = output<TypographyModel>();

  ngOnInit(): void {
    // Charge les polices pour l'aperçu (best effort, sans bloquer)
    for (const option of this.options()) {
      for (const font of [option.primaryFont, option.secondaryFont]) {
        if (font) {
          this.typographyService.loadGoogleFont(font).catch(() => undefined);
        }
      }
    }
  }

  protected pick(option: TypographyModel): void {
    if (this.disabled() || this.selectedId()) return;
    this.picked.emit(option);
  }
}
