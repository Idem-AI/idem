import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { TypographyModel } from '../../../../../models/brand-identity.model';
import { TypographyCardComponent } from '../typography-card/typography-card';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';

/**
 * La galerie d'allures : la surface principale de l'écran.
 *
 * C'est le chemin court, et il doit suffire : un clic sur une miniature pose
 * les DEUX polices. Tout le reste de l'écran — choisir famille par famille,
 * importer la sienne — n'existe que pour ceux qui veulent aller plus loin.
 */
@Component({
  selector: 'app-typography-gallery',
  imports: [TranslateModule, TypographyCardComponent, IdemLoaderComponent],
  templateUrl: './typography-gallery.html',
  styleUrls: ['./typography-gallery.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TypographyGalleryComponent {
  readonly typographies = input<TypographyModel[]>([]);
  readonly selectedTypographyId = input<string | null>(null);
  readonly brandName = input('');
  readonly isLoading = input(false);

  readonly typographySelected = output<TypographyModel>();
  readonly regenerateRequest = output<void>();

  protected onSelect(typography: TypographyModel): void {
    this.typographySelected.emit(typography);
  }

  protected onRegenerate(): void {
    this.regenerateRequest.emit();
  }
}
