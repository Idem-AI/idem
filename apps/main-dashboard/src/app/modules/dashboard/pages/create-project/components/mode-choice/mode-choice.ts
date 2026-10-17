import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { ModeIllustrationComponent } from '../../../../../../shared/components/mode-illustration/mode-illustration';
import { OnboardingSurveyService } from '../../../../../../shared/services/onboarding-survey.service';
import { UiMode } from '../../../../../../shared/models/ui-mode.model';

/**
 * Mode d'accompagnement choisi à la création :
 * - `guided` : parcours assisté, étape par étape (débutants)
 * - `form`   : tableau de bord complet
 */
export type CreateMode = 'form' | 'guided';

interface ModeCard {
  mode: CreateMode;
  /** Mode d'interface correspondant, pour l'illustration et la recommandation */
  uiMode: UiMode;
  i18nKey: string;
}

const MODE_CARDS: readonly ModeCard[] = [
  { mode: 'guided', uiMode: 'guided', i18nKey: 'guided' },
  { mode: 'form', uiMode: 'advanced', i18nKey: 'form' },
];

@Component({
  selector: 'app-mode-choice',
  imports: [TranslateModule, ModeIllustrationComponent],
  templateUrl: './mode-choice.html',
  styleUrl: './mode-choice.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModeChoiceComponent implements OnInit {
  private readonly survey = inject(OnboardingSurveyService);

  readonly projectDescription = input<string>('');
  readonly selectMode = output<CreateMode>();

  protected readonly cards = MODE_CARDS;

  /**
   * Mode mis en avant. On privilégie celui que l'utilisateur a retenu à
   * l'inscription — c'est sa préférence explicite — puis la recommandation
   * calculée. Sans profil, on met en avant l'accompagnement le plus fort :
   * le produit s'adresse d'abord à ceux qui ne savent pas par où commencer.
   */
  protected readonly recommendedMode = computed<CreateMode>(() => {
    const preferred = this.survey.selectedMode() ?? this.survey.recommendedMode();
    return preferred === 'advanced' ? 'form' : 'guided';
  });

  /** La mise en avant s'appuie-t-elle sur les réponses de l'utilisateur ? */
  protected readonly isPersonalized = computed(
    () => this.survey.selectedMode() !== null || this.survey.recommendedMode() !== null,
  );

  ngOnInit(): void {
    // La création de projet est accessible sans être connecté : le profil peut
    // ne pas encore avoir été chargé. Un échec (401 hors session) retombe
    // simplement sur la recommandation par défaut.
    void this.survey.load();
  }

  protected onSelect(mode: CreateMode): void {
    this.selectMode.emit(mode);
  }
}
