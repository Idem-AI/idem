import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { UiModeService } from '../../../../shared/services/ui-mode.service';
import { Loader } from '../../../../shared/components/loader/loader';
import { GuidedJourneyService } from '../../services/guided-journey.service';
import { GuidedStep } from '../../models/guided-journey.model';

/**
 * Page d'accueil du mode Assisté.
 *
 * Un seul écran, une seule décision : l'étape en cours est dépliée, les
 * précédentes sont repliées avec leur coche, les suivantes restent
 * verrouillées. C'est ce verrouillage qui évite au débutant de se disperser.
 */
@Component({
  selector: 'app-guided-home',
  standalone: true,
  imports: [CommonModule, TranslateModule, Loader],
  templateUrl: './guided-home.html',
  styleUrl: './guided-home.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuidedHomePage implements OnInit {
  protected readonly journey = inject(GuidedJourneyService);
  private readonly uiMode = inject(UiModeService);
  private readonly router = inject(Router);

  protected readonly isLoading = signal(true);
  /** Étape dépliée manuellement (sinon l'étape en cours). */
  protected readonly expandedStepId = signal<string | null>(null);

  protected readonly project = this.journey.project;
  protected readonly steps = this.journey.steps;
  protected readonly progress = this.journey.progress;
  protected readonly completedCount = this.journey.completedCount;
  protected readonly totalCount = this.journey.totalCount;
  protected readonly isComplete = this.journey.isJourneyComplete;

  protected readonly hasProject = computed(() => !!this.project()?.id);

  ngOnInit(): void {
    // Le mode Assisté est le contexte courant dès qu'on ouvre cette page.
    this.uiMode.setMode('guided');
    void this.refresh();
  }

  /** Recharge le projet et recalcule le parcours (au retour d'une étape). */
  protected async refresh(): Promise<void> {
    this.isLoading.set(true);
    try {
      await this.journey.loadFromCookie(true);
    } finally {
      this.isLoading.set(false);
    }
  }

  /** L'étape est-elle dépliée ? (l'étape en cours l'est par défaut) */
  protected isExpanded(step: GuidedStep): boolean {
    const manual = this.expandedStepId();
    if (manual) return manual === step.id;
    return step.status === 'current';
  }

  protected toggleStep(step: GuidedStep): void {
    if (step.status === 'locked') return;
    this.expandedStepId.set(this.isExpanded(step) ? null : step.id);
  }

  /**
   * Ouvre l'étape : la page de génération tant que rien n'existe, la page de
   * consultation une fois le livrable produit.
   */
  protected openStep(step: GuidedStep): void {
    if (step.status === 'locked') return;

    if (step.id === 'project' && !this.hasProject()) {
      this.router.navigateByUrl('/create-project');
      return;
    }

    const target = step.status === 'done' ? step.route : (step.generateRoute ?? step.route);
    this.router.navigateByUrl(target);
  }

  /** Passe une étape facultative (les obligatoires refusent). */
  protected skipStep(step: GuidedStep, event: MouseEvent): void {
    event.stopPropagation();
    if (this.journey.skip(step.id)) {
      this.expandedStepId.set(null);
    }
  }

  /** Reprend une étape précédemment passée. */
  protected resumeStep(step: GuidedStep, event: MouseEvent): void {
    event.stopPropagation();
    this.journey.unskip(step.id);
    this.expandedStepId.set(step.id);
  }

  protected createProject(): void {
    this.router.navigateByUrl('/create-project');
  }

  /** Sortie explicite vers le mode Avancé, sans perdre le projet. */
  protected switchToAdvanced(): void {
    this.uiMode.switchToAdvanced(this.hasProject() ? '/project/dashboard' : '/console');
  }
}
