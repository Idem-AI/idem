import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
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
 */
@Component({
  selector: 'app-empty-layout',
  imports: [RouterOutlet, TopbarComponent],
  templateUrl: './empty-layout.html',
  styleUrl: './empty-layout.css',
})
export class EmptyLayout {}
