import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
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
 * Sondage d'accueil : quatre questions, une par écran, répondues en un clic.
 *
 * Il est obligatoire — pour les nouvelles inscriptions comme pour les comptes
 * antérieurs à la fonctionnalité — parce que c'est lui qui détermine
 * l'interface proposée. Les réponses partent sur le compte, pas dans le
 * navigateur : elles suivent l'utilisateur d'un appareil à l'autre.
 */
@Component({
  selector: 'app-welcome-survey',
  standalone: true,
  imports: [CommonModule, TranslateModule, ModeIllustrationComponent],
  templateUrl: './welcome-survey.html',
  styleUrl: './welcome-survey.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WelcomeSurveyPage implements OnInit {
  private readonly survey = inject(OnboardingSurveyService);
  private readonly uiMode = inject(UiModeService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly questions = this.survey.questions;
  protected readonly modeCards = MODE_CARDS;

  /** Index de la question affichée ; `questions.length` = écran de résultat. */
  protected readonly stepIndex = signal(0);
  /** Mode retenu sur l'écran final (initialisé sur la recommandation). */
  protected readonly chosenMode = signal<UiMode | null>(null);

  protected readonly isSaving = this.survey.isSaving;
  protected readonly saveError = this.survey.saveError;
  protected readonly answers = this.survey.answers;

  /** Page d'où l'utilisateur a été redirigé, à rejoindre une fois le sondage passé. */
  private returnUrl: string | null = null;

  protected readonly isResultStep = computed(() => this.stepIndex() >= this.questions.length);

  protected readonly currentQuestion = computed<SurveyQuestion | null>(
    () => this.questions[this.stepIndex()] ?? null,
  );

  protected readonly progressPercent = computed(() =>
    Math.round((this.stepIndex() / this.questions.length) * 100),
  );

  protected readonly recommendedMode = computed<UiMode>(
    () => this.survey.recommendedMode() ?? 'guided',
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

  ngOnInit(): void {
    this.returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
  }

  // ───────────────────────────────────────────────────────── navigation

  protected selectOption(option: SurveyOption): void {
    const question = this.currentQuestion();
    if (!question) return;

    this.survey.setAnswer(question.id, option.value);
    // Enchaînement immédiat : un clic = une question de plus.
    this.stepIndex.set(this.stepIndex() + 1);
  }

  protected goBack(): void {
    if (this.stepIndex() === 0) return;
    this.stepIndex.update((index) => index - 1);
  }

  protected chooseMode(mode: UiMode): void {
    this.chosenMode.set(mode);
  }

  /**
   * Enregistre le profil sur le compte puis ouvre l'espace de travail.
   * En cas d'échec, on reste sur l'écran : le message d'erreur invite à
   * réessayer plutôt que de laisser croire que c'est enregistré.
   */
  protected async start(): Promise<void> {
    const mode = this.selectedMode();
    const saved = await this.survey.complete(mode);
    if (!saved) return;

    this.uiMode.setMode(mode);
    // Pas encore de projet : le mode Avancé démarre depuis la console.
    const destination = mode === 'advanced' ? '/console' : MODE_HOME_ROUTE[mode];
    this.router.navigateByUrl(this.returnUrl ?? destination);
  }
}
