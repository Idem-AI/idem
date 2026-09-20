import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { UiModeService } from '../../../../shared/services/ui-mode.service';
import { GuidedJourneyService } from '../../services/guided-journey.service';

/**
 * Fil d'Ariane du mode Assisté, affiché au-dessus des pages du mode Avancé.
 *
 * Quand le parcours envoie l'utilisateur travailler sur une page existante
 * (branding, business plan…), cette barre garde le contexte visible et offre
 * le chemin du retour : on ne se perd pas dans le dashboard.
 */
@Component({
  selector: 'app-guided-step-bar',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './guided-step-bar.html',
  styleUrl: './guided-step-bar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuidedStepBarComponent implements OnInit {
  private readonly uiMode = inject(UiModeService);
  private readonly journey = inject(GuidedJourneyService);
  private readonly router = inject(Router);

  /** N'apparaît que dans le mode Assisté, et seulement si un parcours existe. */
  protected readonly isVisible = computed(
    () => this.uiMode.mode() === 'guided' && !!this.journey.project()?.id,
  );

  protected readonly currentStep = this.journey.currentStep;
  protected readonly progress = this.journey.progress;
  protected readonly totalCount = this.journey.totalCount;

  ngOnInit(): void {
    // La barre peut être le premier écran chargé (rechargement de page en
    // pleine étape) : on s'assure que le parcours connaît le projet actif.
    if (this.uiMode.mode() === 'guided') {
      void this.journey.loadFromCookie();
    }
  }

  protected backToJourney(): void {
    this.router.navigateByUrl('/guided');
  }
}
