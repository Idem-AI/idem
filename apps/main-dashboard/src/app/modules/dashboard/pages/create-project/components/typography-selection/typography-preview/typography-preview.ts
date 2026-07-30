import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { TypographyModel } from '../../../../../models/brand-identity.model';
import { TypographyService, fontStack } from '../../../../../../../shared/services/typography.service';

@Component({
  selector: 'app-typography-preview',
  imports: [TranslateModule],
  templateUrl: './typography-preview.html',
  styleUrls: ['./typography-preview.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TypographyPreviewComponent {
  private readonly typographyService = inject(TypographyService);

  readonly typography = input<TypographyModel | null | undefined>(null);
  readonly previewText = input('Your Brand Name');

  protected readonly primaryStack = computed(() => fontStack(this.typography()?.primaryFont));
  protected readonly secondaryStack = computed(() => fontStack(this.typography()?.secondaryFont));

  constructor() {
    // Without this the panel silently falls back to the browser's default face:
    // a font is only usable once its stylesheet AND its files have been fetched.
    effect(() => {
      const typography = this.typography();
      if (!typography) return;
      void this.typographyService.loadGoogleFonts([
        typography.primaryFont,
        typography.secondaryFont,
      ]);
    });
  }
}
