import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, model } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { CREATIVITY_LEVELS, CreativityLevel, creativityCost, creativityRank } from '@idem/shared-models';

let nextId = 0;

/**
 * LA JAUGE DE CRÉATIVITÉ — posée avant chaque génération (vidéo, visuel, carte de visite,
 * pitch deck, business plan, identité visuelle).
 *
 * Cinq crans, comme l'effort d'un modèle : Low · Medium · High · Max · Ultra. Plus le cran
 * monte, plus de décisions passent du code (mises en page éprouvées, adaptées à la charte)
 * aux agents IA — jusqu'à Ultra, où l'IA écrit les compositions elles-mêmes. Le coût suit :
 * il vient du modèle partagé avec l'API (`@idem/shared-models`), donc le prix affiché est
 * celui qui sera débité.
 *
 * Accessibilité : un groupe radio (flèches pour changer de cran, un seul arrêt de
 * tabulation), la phrase du cran retenu reliée par `aria-describedby`.
 */
@Component({
  selector: 'app-creativity-gauge',
  imports: [TranslateModule],
  templateUrl: './creativity-gauge.html',
  styleUrl: './creativity-gauge.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class CreativityGaugeComponent {
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  /** Le cran choisi (liaison bidirectionnelle) ; Medium par défaut. */
  readonly value = model<CreativityLevel>('medium');
  /** Prix du livrable au cran Low / Medium (crédits) ; sans lui, la jauge n'affiche pas de prix. */
  readonly baseCost = input<number | null>(null);
  /** Désactivée pendant une génération. */
  readonly disabled = input(false);

  protected readonly levels = CREATIVITY_LEVELS;
  protected readonly uid = `cg-${++nextId}`;

  /** Remplissage de la jauge : 20 % à Low, 100 % à Ultra. */
  protected readonly fill = computed(() => ((creativityRank(this.value()) + 1) / CREATIVITY_LEVELS.length) * 100);
  protected readonly costs = computed(() => {
    const base = this.baseCost();
    return base == null ? null : Object.fromEntries(CREATIVITY_LEVELS.map((l) => [l, creativityCost(base, l)])) as Record<CreativityLevel, number>;
  });

  protected select(level: CreativityLevel): void {
    if (!this.disabled()) this.value.set(level);
  }

  /** Flèches : cran précédent / suivant, le focus suit la sélection (motif radio). */
  protected onKeydown(event: KeyboardEvent): void {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 0;
    const edge = event.key === 'Home' ? 0 : event.key === 'End' ? CREATIVITY_LEVELS.length - 1 : -1;
    if (!step && edge < 0) return;
    event.preventDefault();
    const at = edge >= 0 ? edge : Math.min(CREATIVITY_LEVELS.length - 1, Math.max(0, creativityRank(this.value()) + step));
    this.select(CREATIVITY_LEVELS[at]);
    queueMicrotask(() => this.host.nativeElement.querySelector<HTMLElement>(`[data-level="${CREATIVITY_LEVELS[at]}"]`)?.focus());
  }
}
