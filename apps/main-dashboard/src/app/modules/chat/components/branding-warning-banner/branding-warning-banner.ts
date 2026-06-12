import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

/**
 * Bandeau d'avertissement affiché dans le chat tant que l'identité de marque
 * du projet actif est incomplète. Le bouton lance la complétion
 * conversationnelle directement dans le fil.
 */
@Component({
  selector: 'app-branding-warning-banner',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './branding-warning-banner.html',
  styleUrl: './branding-warning-banner.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrandingWarningBannerComponent {
  private readonly translate = inject(TranslateService);

  /** Éléments manquants : 'logo' | 'colors' | 'typography' */
  readonly missing = input.required<Array<'logo' | 'colors' | 'typography'>>();
  readonly busy = input<boolean>(false);

  readonly completeRequested = output<void>();

  /** « Logo, Couleurs, Typographie » selon la langue courante */
  protected readonly missingLabels = computed(() =>
    this.missing()
      .map((part) => this.translate.instant(`chat.card.brandingSections.${part}`))
      .join(' · '),
  );
}
