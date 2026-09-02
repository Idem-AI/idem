import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { OnboardingSurveyService } from '../../../../shared/services/onboarding-survey.service';
import { UiModeService, MODE_HOME_ROUTE } from '../../../../shared/services/ui-mode.service';
import { ModeIllustrationComponent } from '../../../../shared/components/mode-illustration/mode-illustration';
import { UiMode } from '../../../chat/models/chat.model';
import { SurveyOption, SurveyQuestion } from '../../../../shared/models/onboarding-survey.model';

interface ModeCard {
  mode: UiMode;
  icon: string;
  labelKey: string;
  descriptionKey: string;
}

const MODE_CARDS: readonly ModeCard[] = [
  {
    mode: 'guided',
    icon: 'pi pi-compass',
    labelKey: 'modes.guided.name',
    descriptionKey: 'modes.guided.long',
  },
  {
    mode: 'chat',
    icon: 'pi pi-comments',
    labelKey: 'modes.chat.name',
    descriptionKey: 'modes.chat.long',
  },
  {
    mode: 'advanced',
    icon: 'pi pi-th-large',
    labelKey: 'modes.advanced.name',
    descriptionKey: 'modes.advanced.long',
  },
];

/**
 * Sondage d'accueil affiché une seule fois, juste après l'inscription.
 *
 * Quatre questions, une par écran, répondues en un clic : à la fin, IDEM
 * recommande le mode d'interface le plus adapté — que l'utilisateur reste
 * libre de changer, ici comme plus tard.
 */
@Component({
  selector: 'app-welcome-survey',
  standalone: true,
  imports: [CommonModule, TranslateModule, ModeIllustrationComponent],
  templateUrl: './welcome-survey.html',
  styleUrl: './welcome-survey.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WelcomeSurveyPage {
  private readonly survey = inject(OnboardingSurveyService);
  private readonly uiMode = inject(UiModeService);
  private readonly router = inject(Router);

  protected readonly questions = this.survey.questions;
  protected readonly modeCards = MODE_CARDS;

  /** Index de la question affichée ; `questions.length` = écran de résultat. */
  protected readonly stepIndex = signal(0);
  /** Mode retenu sur l'écran final (initialisé sur la recommandation). */
  protected readonly chosenMode = signal<UiMode | null>(null);

  protected readonly isResultStep = computed(() => this.stepIndex() >= this.questions.length);

  protected readonly currentQuestion = computed<SurveyQuestion | null>(
    () => this.questions[this.stepIndex()] ?? null,
  );

  protected readonly answers = this.survey.answers;

  protected readonly recommendedMode = computed<UiMode>(
    () => this.survey.recommendation()?.mode ?? 'guided',
  );

  protected readonly reasonKey = computed(
    () => this.survey.recommendation()?.reasonKey ?? 'onboarding.survey.reasons.guided',
  );

  protected readonly selectedMode = computed<UiMode>(
    () => this.chosenMode() ?? this.recommendedMode(),
  );

  /** Réponse déjà donnée pour la question affichée (retour arrière). */
  protected readonly currentAnswer = computed<string | undefined>(() => {
    const question = this.currentQuestion();
    return question ? this.answers()[question.id] : undefined;
  });

  // ───────────────────────────────────────────────────────── navigation

  protected selectOption(option: SurveyOption): void {
    const question = this.currentQuestion();
    if (!question) return;

    this.survey.setAnswer(question.id, option.value);

    // Enchaînement immédiat : un clic = une question de plus.
    const next = this.stepIndex() + 1;
    if (next >= this.questions.length) {
      this.survey.complete();
    }
    this.stepIndex.set(next);
  }

  protected goBack(): void {
    if (this.stepIndex() === 0) return;
    this.stepIndex.update((index) => index - 1);
  }

  protected chooseMode(mode: UiMode): void {
    this.chosenMode.set(mode);
  }

  /** Applique le mode retenu et amène l'utilisateur dans son espace. */
  protected start(): void {
    const mode = this.selectedMode();
    this.uiMode.setMode(mode);
    // Pas encore de projet : le mode Avancé démarre depuis la console.
    this.router.navigateByUrl(mode === 'advanced' ? '/console' : MODE_HOME_ROUTE[mode]);
  }

  /** L'utilisateur passe le sondage : on ne le lui reproposera plus. */
  protected skipSurvey(): void {
    this.survey.skip();
    this.router.navigateByUrl('/console');
  }
}
