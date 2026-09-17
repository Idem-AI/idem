import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { BrandFont } from '../../../../../models/brand-identity.model';
import { fontStack } from '../../../../../../../shared/services/typography.service';

/** Les deux rôles typographiques d'une marque. */
export type FontSlot = 'primary' | 'secondary';

/**
 * La paire retenue — titres et texte — montrée telle qu'elle s'écrit.
 *
 * Chaque emplacement affiche le NOM DE LA MARQUE composé dans sa police, pas un
 * « Aa » ni une étiquette : c'est la seule façon de voir ce qu'on a choisi. Le
 * petit pictogramme dit le rôle sans mot — une ligne épaisse pour les titres,
 * des lignes égales pour le texte.
 *
 * « Changer » ouvre le choix de CETTE police-là. Il n'y a donc plus
 * d'emplacement « actif » implicite : on désigne ce qu'on modifie au moment où
 * on le modifie.
 */
@Component({
  selector: 'app-typography-pair-bar',
  imports: [TranslateModule],
  templateUrl: './typography-pair-bar.html',
  styleUrls: ['./typography-pair-bar.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TypographyPairBarComponent {
  readonly primary = input<BrandFont | null>(null);
  readonly secondary = input<BrandFont | null>(null);
  readonly brandName = input('');
  /** L'emplacement en cours de modification, s'il y en a un. */
  readonly editingSlot = input<FontSlot | null>(null);

  readonly changeRequested = output<FontSlot>();

  protected readonly primaryStack = computed(() =>
    fontStack(this.primary()?.family, this.primary()?.category)
  );
  protected readonly secondaryStack = computed(() =>
    fontStack(this.secondary()?.family, this.secondary()?.category)
  );

  protected readonly sample = computed(() => this.brandName().trim() || 'Votre marque');

  protected readonly sourceLabelKeys: Record<string, string> = {
    google: 'dashboard.typographySelection.sources.google',
    fontshare: 'dashboard.typographySelection.sources.fontshare',
    fontsource: 'dashboard.typographySelection.sources.fontsource',
    custom: 'dashboard.typographySelection.sources.custom',
  };

  protected sourceLabelKey(font: BrandFont | null): string {
    return this.sourceLabelKeys[font?.source ?? 'google'];
  }

  protected onChange(slot: FontSlot): void {
    this.changeRequested.emit(slot);
  }
}
