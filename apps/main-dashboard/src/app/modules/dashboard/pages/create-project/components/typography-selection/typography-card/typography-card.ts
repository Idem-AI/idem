import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { TypographyModel } from '../../../../../models/brand-identity.model';
import { TypographyService, fontStack } from '../../../../../../../shared/services/typography.service';

/**
 * Une allure typographique, montrée comme une PAGE en miniature.
 *
 * La carte précédente affichait « Aa Aa » et deux noms de familles. Ça ne dit
 * rien à qui ne connaît pas les polices — c'est-à-dire à la plupart des gens
 * qui créent leur marque ici. On dessine donc le résultat : le nom du projet
 * composé dans la police de titre, un vrai bloc de texte dans la police de
 * texte, à la bonne échelle relative. Le contraste entre les deux se JUGE au
 * lieu de se déduire.
 */
@Component({
  selector: 'app-typography-card',
  imports: [TranslateModule],
  host: { class: 'block h-full' },
  templateUrl: './typography-card.html',
  styleUrls: ['./typography-card.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TypographyCardComponent {
  private readonly typographyService = inject(TypographyService);

  readonly typography = input.required<TypographyModel>();
  readonly brandName = input('');
  readonly isSelected = input(false);
  readonly selected = output<TypographyModel>();

  protected readonly primaryStack = computed(() =>
    fontStack(this.typography().primaryFont, this.typography().primary?.category)
  );
  protected readonly secondaryStack = computed(() =>
    fontStack(this.typography().secondaryFont, this.typography().secondary?.category)
  );

  /** Le nom du projet fait un bien meilleur spécimen qu'un texte inventé. */
  protected readonly sample = computed(() => this.brandName().trim() || 'Votre marque');

  /** L'agent explique son appariement : c'est ce qui donne du sens à la carte. */
  protected readonly rationale = computed(
    () => this.typography().rationale || this.typography().description || ''
  );

  constructor() {
    // Chaque famille est chargée depuis sa propre source : l'agent en propose
    // désormais qui ne sont pas chez Google.
    effect(() => {
      void this.typographyService.loadTypography(this.typography());
    });
  }

  protected onSelect(): void {
    this.selected.emit(this.typography());
  }
}
