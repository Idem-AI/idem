import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { UiMode } from '../../modules/chat/models/chat.model';

const UI_MODE_STORAGE_KEY = 'idem_ui_mode';

/** Route d'accueil de chaque mode (utilisée par le sélecteur de mode). */
export const MODE_HOME_ROUTE: Record<UiMode, string> = {
  advanced: '/project/dashboard',
  chat: '/chat',
  guided: '/guided',
};

/**
 * Gère le mode d'interface (Assisté / Chat / Avancé).
 *
 * Le mode Avancé reste le mode par défaut : personne ne bascule dans un autre
 * mode sans l'avoir explicitement choisi. La préférence est mémorisée mais ne
 * déclenche jamais de redirection automatique au chargement.
 */
@Injectable({ providedIn: 'root' })
export class UiModeService {
  private readonly router = inject(Router);

  readonly mode = signal<UiMode>(this.readStoredMode());

  private readStoredMode(): UiMode {
    try {
      const stored = localStorage.getItem(UI_MODE_STORAGE_KEY);
      return stored === 'chat' || stored === 'guided' ? stored : 'advanced';
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

  /** Bascule vers le mode Chat. */
  switchToChat(): void {
    this.switchTo('chat');
  }

  /** Bascule vers le mode Assisté (parcours guidé). */
  switchToGuided(): void {
    this.switchTo('guided');
  }

  /**
   * Bascule vers le mode Avancé.
   * @param targetRoute route cible (par défaut le dashboard du projet actif)
   */
  switchToAdvanced(targetRoute = MODE_HOME_ROUTE.advanced): void {
    this.switchTo('advanced', targetRoute);
  }

  /**
   * "Ouvrir dans l'éditeur" depuis une carte de livrable.
   * Depuis le mode Assisté on n'abandonne pas le parcours : on ouvre la page
   * en gardant le mode courant, seul le mode Chat repasse en Avancé.
   */
  openInEditor(editorRoute: string): void {
    if (this.mode() === 'guided') {
      this.router.navigateByUrl(editorRoute);
      return;
    }
    this.switchToAdvanced(editorRoute);
  }
}
