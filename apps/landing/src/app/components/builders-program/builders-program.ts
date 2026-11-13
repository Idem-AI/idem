import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BUILDERS_PROGRAM } from '@idem/shared-models/builders/program';
import { environment } from '../../../environments/environment';
import { PageArtComponent } from '../../shared/components/page-art/page-art';

interface Figure {
  value: string;
  label: string;
}

const percent = (rate: number) => Math.round(rate * 100);
const francs = (amount: number) => amount.toLocaleString('fr-FR').replace(/\s/g, ' ');

/**
 * Idem Builders, sur la page d'accueil : la porte d'entrée vers `/builders`.
 *
 * Trois chiffres et deux boutons, pas une deuxième page du programme : le
 * visiteur apprend que le programme existe, ce qu'il rapporte, et où lire la
 * suite. Les chiffres viennent de `BUILDERS_PROGRAM`, la source qui sert aussi
 * à les appliquer — l'accueil ne peut pas annoncer un autre montant.
 */
@Component({
  selector: 'app-builders-program',
  imports: [RouterLink, PageArtComponent],
  templateUrl: './builders-program.html',
  styleUrls: ['../../shared/styles/editorial-page.css', './builders-program.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuildersProgram {
  protected readonly joinUrl = `${environment.services.dashboard.url}/builders`;

  protected readonly figures: Figure[] = [
    {
      value: `${francs(BUILDERS_PROGRAM.welcomeBonusXaf)} F`,
      label: $localize`:@@buildersProgram.figure.welcome:offered in your wallet when you join`,
    },
    {
      value: `+${percent(BUILDERS_PROGRAM.topupBonusRate)} %`,
      label: $localize`:@@buildersProgram.figure.topup:credit on every top-up`,
    },
    {
      value: `-${percent(BUILDERS_PROGRAM.hostingDiscountRate)} %`,
      label: $localize`:@@buildersProgram.figure.hosting:on iDeploy hosting, every day`,
    },
  ];
}
