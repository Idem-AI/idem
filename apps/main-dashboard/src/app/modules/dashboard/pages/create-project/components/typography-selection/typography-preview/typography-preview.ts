import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { TypographyModel } from '../../../../../models/brand-identity.model';
import { TypographyService, fontStack } from '../../../../../../../shared/services/typography.service';

/**
 * L'effet du choix, en situation.
 *
 * Le panneau précédent montrait un titre, un sous-titre et une citation, tous
 * centrés : trois fois la même chose, et rien qui ressemble à un livrable. On
 * montre maintenant la HIÉRARCHIE réelle — surtitre, titre, chapô, texte
 * courant, bouton — puisque c'est précisément ce qu'un appariement typographique
 * est censé produire. Un spécimen par police complète la lecture, avec la
 * fonderie dont elle vient.
 */
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

  protected readonly sourceLabelKeys: Record<string, string> = {
    google: 'dashboard.typographySelection.sources.google',
    fontshare: 'dashboard.typographySelection.sources.fontshare',
    fontsource: 'dashboard.typographySelection.sources.fontsource',
    custom: 'dashboard.typographySelection.sources.custom',
  };

  protected readonly primarySourceKey = computed(
    () => this.sourceLabelKeys[this.typography()?.primary?.source ?? 'google'],
  );
  protected readonly secondarySourceKey = computed(
    () => this.sourceLabelKeys[this.typography()?.secondary?.source ?? 'google'],
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
