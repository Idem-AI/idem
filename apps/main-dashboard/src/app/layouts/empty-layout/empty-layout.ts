import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { TopbarComponent } from '../../shared/components/topbar/topbar';

/**
 * Disposition sans barre latérale.
 *
 * Elle sert les écrans qui ne se rattachent pas à un projet — la console, la
 * liste des projets, « Mon compte » — et ceux qui veulent toute la largeur,
 * comme les éditeurs de document.
 *
 * Ce composant portait auparavant sa propre barre de navigation, son menu
 * utilisateur et son chargement de quota, en double de ce que faisait déjà la
 * barre latérale. Tout cela vit maintenant dans `app-topbar` : il ne reste ici
 * qu'un assemblage, ce qu'une disposition doit être.
 *
 * Une route peut demander la barre sobre (`data: { topbar: 'minimal' }`) :
 * à plat, le profil seul à droite, comme l'écran de connexion.
 */
@Component({
  selector: 'app-empty-layout',
  imports: [RouterOutlet, TopbarComponent],
  templateUrl: './empty-layout.html',
  styleUrl: './empty-layout.css',
})
export class EmptyLayout {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** Lu sur la route la plus profonde qui le déclare, comme la disposition. */
  protected readonly minimalTopbar = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => {
        let route = this.route.firstChild;
        let topbar: unknown;
        while (route) {
          topbar = route.snapshot.data?.['topbar'] ?? topbar;
          route = route.firstChild;
        }
        return topbar === 'minimal';
      }),
    ),
    { initialValue: false },
  );
}
