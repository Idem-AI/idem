import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { UiMode } from '../../modules/chat/models/chat.model';

const UI_MODE_STORAGE_KEY = 'idem_ui_mode';

/**
 * Gère le mode d'interface (Chat / Avancé).
 *
 * Le mode Avancé reste le mode par défaut : personne ne bascule en mode Chat
 * sans l'avoir explicitement choisi. La préférence est mémorisée mais ne
 * déclenche jamais de redirection automatique au chargement.
 */
@Injectable({ providedIn: 'root' })
export class UiModeService {
  private readonly router = inject(Router);

  readonly mode = signal<UiMode>(this.readStoredMode());

  private readStoredMode(): UiMode {
    try {
      return localStorage.getItem(UI_MODE_STORAGE_KEY) === 'chat' ? 'chat' : 'advanced';
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

  /** Bascule vers le mode Chat (même projet, même état, juste un autre regard). */
  switchToChat(): void {
    this.setMode('chat');
    this.router.navigate(['/chat']);
  }

  /**
   * Bascule vers le mode Avancé.
   * @param targetRoute route cible (par défaut le dashboard du projet actif)
   */
  switchToAdvanced(targetRoute = '/project/dashboard'): void {
    this.setMode('advanced');
    this.router.navigateByUrl(targetRoute);
  }

  /** "Ouvrir dans l'éditeur" depuis une carte de livrable. */
  openInEditor(editorRoute: string): void {
    this.switchToAdvanced(editorRoute);
  }
}
