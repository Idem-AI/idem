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
    effect(() => {
      const typography = this.typography();
      void this.typographyService.loadGoogleFonts([
        typography.primaryFont,
        typography.secondaryFont,
      ]);
    });
  }

  protected onSelect(): void {
    this.selected.emit(this.typography());
  }
}
