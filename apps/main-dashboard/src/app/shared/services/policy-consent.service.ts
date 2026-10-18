import { Injectable, signal } from '@angular/core';

/**
 * L'accord des politiques, comme état partagé (même principe que le paywall) : quand l'API refuse une
 * génération parce que le projet n'a pas encore son accord (`POLICY_ACCEPTANCE_REQUIRED` — projet créé
 * depuis iVision avant que l'accord y soit demandé), l'intercepteur dépose le projet ici et l'hôte, monté
 * une fois à la racine, demande l'accord sans quitter la page.
 */
@Injectable({ providedIn: 'root' })
export class PolicyConsentService {
  /** Le projet à finaliser ; `null` quand rien n'est affiché. */
  readonly pending = signal<string | null>(null);

  open(projectId: string): void {
    this.pending.set(projectId);
  }

  close(): void {
    this.pending.set(null);
  }
}
