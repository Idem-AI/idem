import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { UiMode } from '../models/ui-mode.model';

const UI_MODE_STORAGE_KEY = 'idem_ui_mode';

/** Route d'accueil de chaque mode (utilisée par le sélecteur de mode). */
export const MODE_HOME_ROUTE: Record<UiMode, string> = {
  advanced: '/project/dashboard',
  guided: '/guided',
};

/**
 * Gère le mode d'interface (Assisté / Tableau de bord).
 *
 * Le tableau de bord reste le mode par défaut : personne ne bascule dans
 * l'autre mode sans l'avoir explicitement choisi. La préférence est mémorisée
 * mais ne déclenche jamais de redirection automatique au chargement.
 */
@Injectable({ providedIn: 'root' })
export class UiModeService {
  private readonly router = inject(Router);

  readonly mode = signal<UiMode>(this.readStoredMode());

  private readStoredMode(): UiMode {
    try {
      // Toute autre valeur (dont l'ancien mode retiré) retombe sur le tableau de bord.
      return localStorage.getItem(UI_MODE_STORAGE_KEY) === 'guided' ? 'guided' : 'advanced';
    } catch {
      return 'advanced';
    }
  }

  setMode(mode: UiMode): void {
    this.mode.set(mode);
    try {
      localStorage.setItem(UI_MODE_STORAGE_KEY, mode);
    } catch {
      // Stockage indisponible : le mode reste valable pour la session en cours
    }
  }

  /**
   * Bascule vers un mode et navigue vers sa page d'accueil.
   * Même projet, même état : seul le regard change.
   *
   * @param mode mode cible
   * @param targetRoute route cible explicite (sinon page d'accueil du mode)
   */
  switchTo(mode: UiMode, targetRoute?: string): void {
    this.setMode(mode);
    this.router.navigateByUrl(targetRoute ?? MODE_HOME_ROUTE[mode]);
  }

  /** Bascule vers le mode Assisté (parcours guidé). */
  switchToGuided(): void {
    this.switchTo('guided');
  }

  /**
   * Bascule vers le tableau de bord.
   * @param targetRoute route cible (par défaut le dashboard du projet actif)
   */
  switchToAdvanced(targetRoute = MODE_HOME_ROUTE.advanced): void {
    this.switchTo('advanced', targetRoute);
  }

  /**
   * Fin d'une génération ou d'un workflow.
   *
   * En mode Assisté on ramène au parcours : l'utilisateur voit son étape se
   * cocher et découvre la suivante, au lieu d'être laissé sur une page de
   * résultat sans savoir quoi faire ensuite. Le tableau de bord garde sa
   * destination habituelle.
   */
  completeStep(defaultRoute: string): void {
    this.router.navigateByUrl(this.mode() === 'guided' ? MODE_HOME_ROUTE.guided : defaultRoute);
  }
}
