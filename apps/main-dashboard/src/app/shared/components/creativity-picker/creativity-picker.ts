import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, model, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { CREATIVITY_LEVELS, CreativityLevel, creativityCost, creativityRank } from '@idem/shared-models';

let nextId = 0;

/**
 * LE SÉLECTEUR DE CRÉATIVITÉ — un bouton compact posé à côté du bouton de génération, comme le
 * choix d'effort d'un modèle : « ✦ Créativité · Medium ▾ ».
 *
 * Le menu liste les cinq crans (Low · Medium · High · Max · Ultra), une ligne chacun sur ce que
 * l'IA décide, et leur prix pour ce projet. Le prix vient du modèle partagé avec l'API
 * (`@idem/shared-models`) : le prix affiché est celui qui sera débité.
 *
 * Accessibilité : bouton `aria-haspopup="menu"`, cases `menuitemradio`, flèches pour se déplacer,
 * Échap ou clic extérieur pour fermer, le focus revient au bouton.
 */
@Component({
  selector: 'app-creativity-picker',
  imports: [TranslateModule],
  templateUrl: './creativity-picker.html',
  styleUrl: './creativity-picker.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'creativity-picker',
    '(document:pointerdown)': 'onOutsidePointer($event)',
    '(keydown.escape)': 'close(true)',
  },
})
export class CreativityPickerComponent {
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  /** Le cran choisi (liaison bidirectionnelle) ; Medium par défaut. */
  readonly value = model<CreativityLevel>('medium');
  /** Prix du livrable au cran Low / Medium (crédits) ; sans lui, le menu n'affiche pas de prix. */
  readonly baseCost = input<number | null>(null);
  readonly disabled = input(false);
  /** Le menu s'ouvre vers le bas (défaut) ou vers le haut (bouton en bas d'écran). */
  readonly placement = input<'bottom' | 'top'>('bottom');
  /** Alignement du menu sur le bouton. */
  readonly align = input<'start' | 'end'>('start');
  /** Affiche le prix du cran dans le bouton (quand le bouton de génération ne peut pas le porter). */
  readonly showCost = input(false);

  protected readonly levels = CREATIVITY_LEVELS;
  protected readonly uid = `cp-${++nextId}`;
  protected readonly open = signal(false);
  protected readonly current = computed(() => this.costs()?.[this.value()] ?? null);
  protected readonly costs = computed(() => {
    const base = this.baseCost();
    return base == null ? null : (Object.fromEntries(CREATIVITY_LEVELS.map((l) => [l, creativityCost(base, l)])) as Record<CreativityLevel, number>);
  });

  protected toggle(): void {
    if (this.disabled()) return;
    this.open.set(!this.open());
    if (this.open()) queueMicrotask(() => this.focusItem(creativityRank(this.value())));
  }

  protected select(level: CreativityLevel): void {
    this.value.set(level);
    this.close(true);
  }

  protected close(refocus = false): void {
    if (!this.open()) return;
    this.open.set(false);
    if (refocus) queueMicrotask(() => this.host.nativeElement.querySelector<HTMLElement>('.cp-trigger')?.focus());
  }

  protected onTriggerKey(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!this.open()) this.toggle();
    }
  }

  /** Flèches, Début, Fin : d'un cran à l'autre dans le menu. */
  protected onItemKey(event: KeyboardEvent, index: number): void {
    const last = CREATIVITY_LEVELS.length - 1;
    const to = event.key === 'ArrowDown' ? Math.min(last, index + 1) : event.key === 'ArrowUp' ? Math.max(0, index - 1) : event.key === 'Home' ? 0 : event.key === 'End' ? last : -1;
    if (to < 0) {
      if (event.key === 'Tab') this.close();
      return;
    }
    event.preventDefault();
    this.focusItem(to);
  }

  protected onOutsidePointer(event: PointerEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.close();
  }

  private focusItem(index: number): void {
    this.host.nativeElement.querySelectorAll<HTMLElement>('.cp-item')[index]?.focus();
  }
}
