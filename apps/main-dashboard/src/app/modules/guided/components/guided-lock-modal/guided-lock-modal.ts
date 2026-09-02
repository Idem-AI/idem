import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { UiModeService } from '../../../../shared/services/ui-mode.service';
import { GuidedJourneyService } from '../../services/guided-journey.service';

/**
 * Modale affichée quand l'utilisateur tente d'ouvrir une page verrouillée par
 * le parcours (lien externe, adresse tapée à la main, historique).
 *
 * Elle explique pourquoi c'est fermé, dit quelle étape l'ouvrira, et propose
 * d'aller directement à l'étape en cours. On peut aussi quitter le mode
 * Assisté : rien n'est un piège.
 */
@Component({
  selector: 'app-guided-lock-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './guided-lock-modal.html',
  styleUrl: './guided-lock-modal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuidedLockModalComponent {
  private readonly journey = inject(GuidedJourneyService);
  private readonly uiMode = inject(UiModeService);
  private readonly router = inject(Router);

  protected readonly attempt = this.journey.blockedAttempt;
  protected readonly currentStep = this.journey.currentStep;

  /** Étape qui ouvrira la page demandée (peut être inconnue : lien hors parcours). */
  protected readonly blockedStep = computed(() => {
    const attempt = this.attempt();
    return attempt ? this.journey.stepForRoute(attempt.url) : null;
  });

  protected close(): void {
    this.journey.dismissBlocked();
  }

  /** Emmène l'utilisateur sur la page de l'étape qu'il doit traiter. */
  protected goToCurrentStep(): void {
    const step = this.currentStep();
    this.journey.dismissBlocked();
    if (!step) {
      this.router.navigateByUrl('/guided');
      return;
    }
    this.router.navigateByUrl(
      step.status === 'done' ? step.route : (step.generateRoute ?? step.route),
    );
  }

  /** Sortie de secours : le mode Avancé n'a aucun verrou. */
  protected switchToAdvanced(): void {
    const attempt = this.attempt();
    this.journey.dismissBlocked();
    this.uiMode.switchToAdvanced(attempt?.url ?? '/project/dashboard');
  }
}
