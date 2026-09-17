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

  protected readonly primaryStack = computed(() =>
    fontStack(this.typography()?.primaryFont, this.typography()?.primary?.category),
  );
  protected readonly secondaryStack = computed(() =>
    fontStack(this.typography()?.secondaryFont, this.typography()?.secondary?.category),
  );

  constructor() {
    // Without this the panel silently falls back to the browser's default face:
    // a font is only usable once its stylesheet AND its files have been fetched.
    // `loadTypography` charge chaque famille depuis SA source — une police
    // importée n'existe dans aucun catalogue public.
    effect(() => {
      void this.typographyService.loadTypography(this.typography());
    });
  }
}
