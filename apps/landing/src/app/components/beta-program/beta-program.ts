import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { PageArtComponent } from '../../shared/components/page-art/page-art';

/** Ce qu'une place dans la bêta donne — et ce qu'elle demande en retour. */
interface Grant {
  label: string;
  body: string;
}

/**
 * Programme bêta premium, sur la page d'accueil.
 *
 * Il vivait sur l'écran de connexion du dashboard, où il détournait
 * l'attention de la seule chose à faire (se connecter). Ici, il est lu par
 * quelqu'un qui découvre IDEM et se demande comment l'essayer à fond.
 * Les avantages décrits sont ceux du programme réel : offres les plus
 * complètes gratuites jusqu'à la fin de la bêta, crédits rechargés chaque
 * mois, places limitées. Aucun compteur inventé.
 */
@Component({
  selector: 'app-beta-program',
  imports: [RouterLink, PageArtComponent],
  templateUrl: './beta-program.html',
  styleUrls: ['../../shared/styles/editorial-page.css', './beta-program.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BetaProgram {
  protected readonly formUrl = environment.betaProgramUrl;

  /**
   * Le troisième point dit la contrepartie plutôt que « places limitées » :
   * la rareté est déjà écrite dans le chapô juste au-dessus, et une section
   * qui répète son propre argument perd le seul point qui manquait.
   */
  protected readonly grants: Grant[] = [
    {
      label: $localize`:@@betaProgram.grants.plans.label:Every plan, unlocked`,
      body: $localize`:@@betaProgram.points.offers:Firm-grade business plan, brand and social media, app and launch, in-depth simulation`,
    },
    {
      label: $localize`:@@betaProgram.grants.credits.label:Credits each month`,
      body: $localize`:@@betaProgram.points.credits:Credits topped up every month until the beta ends`,
    },
    {
      label: $localize`:@@betaProgram.grants.inReturn.label:What we ask in return`,
      body: $localize`:@@betaProgram.grants.inReturn.body:That you tell us what works, what is missing, and what you would drop.`,
    },
  ];
}
