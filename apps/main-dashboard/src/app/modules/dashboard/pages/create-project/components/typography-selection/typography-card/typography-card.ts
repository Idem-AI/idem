import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output } from '@angular/core';
import { TypographyModel } from '../../../../../models/brand-identity.model';
import {
  TypographyPreview,
  TypographyService,
  fontStack,
} from '../../../../../../../shared/services/typography.service';

@Component({
  selector: 'app-typography-card',
  host: { class: 'block h-full' },
  templateUrl: './typography-card.html',
  styleUrls: ['./typography-card.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TypographyCardComponent {
  private readonly typographyService = inject(TypographyService);

  readonly typography = input.required<TypographyModel | TypographyPreview>();
  readonly isSelected = input(false);
  readonly selected = output<TypographyModel | TypographyPreview>();

  protected readonly primaryStack = computed(() => fontStack(this.typography().primaryFont));
  protected readonly secondaryStack = computed(() => fontStack(this.typography().secondaryFont));

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
