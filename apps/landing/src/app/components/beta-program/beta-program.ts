import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';

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
  imports: [RouterLink],
  templateUrl: './beta-program.html',
  styleUrl: './beta-program.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BetaProgram {
  protected readonly formUrl = environment.betaProgramUrl;
}
