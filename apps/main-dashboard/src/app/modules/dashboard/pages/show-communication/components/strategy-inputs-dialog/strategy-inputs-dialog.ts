import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  input,
  output,
  viewChild,
} from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { STRATEGY_INPUT_KEYS, StrategyInputKey } from '../../../../models/communication.model';

/**
 * Dit pourquoi la façon de communiquer ne peut pas encore s'écrire.
 *
 * Elle se DÉDUIT de deux livrables : le business plan dit ce qui est vendu et à
 * qui, les prévisions financières donnent les prix et les moyens. Sans eux, le
 * modèle produirait un texte plausible et creux — un positionnement inventé,
 * des campagnes que le projet ne peut pas payer. Et comme tout le module en
 * dérive ensuite (chaque planning y prend son angle, chaque visuel son ton),
 * une boussole fausse fait dévier tout ce qui la suit, à chaque fois payé.
 *
 * D'où l'absence de « continuer quand même » ici, contrairement à
 * l'avertissement du simulateur : là-bas le moteur peut estimer et le dire ;
 * ici il n'y a rien à déduire. Le bouton principal mène donc au livrable
 * manquant, et reçoit le focus — la touche Entrée y va.
 */
@Component({
  selector: 'app-strategy-inputs-dialog',
  imports: [TranslateModule],
  templateUrl: './strategy-inputs-dialog.html',
  styleUrl: './strategy-inputs-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closed.emit()' },
})
export class StrategyInputsDialog {
  /** Les livrables manquants, dans l'ordre de production. */
  readonly missing = input.required<readonly StrategyInputKey[]>();

  /** Partir produire le premier livrable manquant. */
  readonly generate = output<StrategyInputKey>();

  readonly closed = output<void>();

  private readonly primaryButton =
    viewChild.required<ElementRef<HTMLButtonElement>>('primaryButton');

  protected readonly rows = computed(() =>
    STRATEGY_INPUT_KEYS.map((key) => ({ key, present: !this.missing().includes(key) })),
  );

  /**
   * Le livrable par lequel commencer : le premier manquant dans l'ordre de
   * production. Les prévisions financières s'appuient sur le business plan —
   * commencer par elles serait à refaire.
   */
  protected readonly firstMissing = computed<StrategyInputKey | null>(
    () => this.rows().find((row) => !row.present)?.key ?? null,
  );

  protected start(): void {
    const target = this.firstMissing();
    if (target) this.generate.emit(target);
  }

  constructor() {
    afterNextRender(() => this.primaryButton().nativeElement.focus());
  }
}
