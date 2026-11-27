import { Injectable, Injector, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { CurrentProjectService } from './current-project.service';
import { NotificationService } from './notification.service';

/**
 * L'accord des politiques, comme état partagé (même principe que le paywall) : quand l'API refuse une
 * génération parce que le projet n'a pas encore son accord (`POLICY_ACCEPTANCE_REQUIRED` — projet créé
 * depuis iVision avant que l'accord y soit demandé), l'intercepteur dépose le projet ici et l'hôte, monté
 * une fois à la racine, demande l'accord sans quitter la page.
 *
 * L'accord engage le propriétaire du projet : un membre de son équipe ne peut pas le donner à sa place.
 * Pour lui, pas de fenêtre d'accord, un message qui dit qui doit le faire.
 *
 * Les services sont lus à l'ouverture, jamais à l'injection : ce service est injecté par un intercepteur
 * HTTP, et `CurrentProjectService` passe lui-même par `HttpClient` (dépendance circulaire sinon).
 */
@Injectable({ providedIn: 'root' })
export class PolicyConsentService {
  private readonly injector = inject(Injector);

  /** Le projet à finaliser ; `null` quand rien n'est affiché. */
  readonly pending = signal<string | null>(null);

  open(projectId: string): void {
    const project = this.injector.get(CurrentProjectService).projects().find((p) => p.id === projectId);
    if (project?.access?.role === 'member') {
      const translate = this.injector.get(TranslateService);
      this.injector.get(NotificationService).showInfo({
        title: translate.instant('team.policyOwner.title'),
        message: translate.instant('team.policyOwner.body', { owner: project.access.ownerName ?? '' }),
      });
      return;
    }
    this.pending.set(projectId);
  }

  close(): void {
    this.pending.set(null);
  }
}
