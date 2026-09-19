import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CommunicationService } from '../../../../services/ai-agents/communication.service';
import { ContentChannel, MomentSuggestion } from '../../../../models/communication.model';
import {
  PLANNABLE_CHANNELS,
  PeriodPreset,
  channelIcon,
  daysBetweenIso,
  expectedItemCount,
  formatRange,
  lastDayOfMonth,
  presetRange,
} from '../../communication-ui';

/** Ce que le parent reçoit pour créer puis générer la période. */
export interface PlanWizardResult {
  name: string;
  objective: string;
  start: string;
  end: string;
  kind: 'regular' | 'campaign';
  postsPerWeek: number;
  channels: ContentChannel[];
}

/** Objectifs proposés d'un clic — ils remplissent le champ, sans l'enfermer. */
const OBJECTIVE_HINTS = ['known', 'sell', 'loyal', 'hire'] as const;

/**
 * Création d'un planning, en trois questions.
 *
 * Le formulaire précédent posait sept champs d'un bloc, dont « nature de la
 * période » et « cadence » — du vocabulaire d'agence devant quelqu'un qui veut
 * seulement organiser son mois. Ici, une question par écran, chacune formulée
 * comme on la poserait à l'oral :
 *
 *   1. Quand ?           → trois raccourcis, les dates seulement si on y tient
 *   2. Pour obtenir quoi ? → une phrase, avec des exemples cliquables
 *   3. Où et combien ?   → des logos de réseaux, une fréquence en mots
 *
 * Puis un récapitulatif qui dit ce qu'on va recevoir ET ce que ça coûte, avant
 * de payer. Rien n'est demandé qu'un calcul puisse déduire : le nombre de
 * publications vient des dates et de la fréquence, le nom vient du mois.
 */
@Component({
  selector: 'app-plan-wizard',
  imports: [FormsModule, TranslateModule],
  templateUrl: './plan-wizard.html',
  styleUrl: './plan-wizard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanWizard {
  private readonly communication = inject(CommunicationService);
  private readonly translate = inject(TranslateService);

  readonly projectId = input.required<string>();
  /** Réseaux déjà priorisés pour cette marque — présélectionnés. */
  readonly suggestedChannels = input<ContentChannel[]>([]);

  readonly submitted = output<PlanWizardResult>();
  readonly cancelled = output<void>();

  protected readonly channelIcon = channelIcon;
  protected readonly channels = PLANNABLE_CHANNELS;
  protected readonly objectiveHints = OBJECTIVE_HINTS;
  protected readonly presets: PeriodPreset[] = ['thisMonth', 'nextMonth', 'twoWeeks', 'custom'];

  /** 1 → quand · 2 → pourquoi · 3 → où et combien · 4 → récapitulatif. */
  protected readonly step = signal(1);
  protected readonly totalSteps = 4;

  /**
   * Le mois prochain par défaut : c'est la demande la plus fréquente, et
   * précisément celle que l'ancien module ne savait pas satisfaire (il ne savait
   * partir que d'aujourd'hui).
   */
  private static readonly DEFAULT = presetRange('nextMonth');

  protected readonly preset = signal<PeriodPreset>('nextMonth');
  protected readonly start = signal(PlanWizard.DEFAULT.start);
  protected readonly end = signal(PlanWizard.DEFAULT.end);
  protected readonly objective = signal('');
  protected readonly frequency = signal(3);

  /**
   * Réseaux cochés, amorcés par ceux de la marque.
   *
   * `linkedSignal` et non un `signal` rempli au constructeur : une entrée signal
   * n'est PAS encore renseignée quand le constructeur s'exécute, si bien qu'une
   * présélection faite là aurait toujours lu un tableau vide. Ici la valeur suit
   * l'entrée tout en restant modifiable par les clics.
   */
  protected readonly picked = linkedSignal<ContentChannel[]>(() => {
    const suggested = this.suggestedChannels();
    return suggested.length ? suggested.slice(0, 3) : ['instagram', 'facebook'];
  });

  protected readonly occasions = signal<MomentSuggestion[]>([]);
  protected readonly isLoadingOccasions = signal(false);

  /** Fréquences proposées, dites en mots plutôt qu'en nombre par semaine. */
  protected readonly frequencies = [1, 3, 5, 7];

  protected readonly range = computed(() =>
    formatRange(this.start(), this.end(), this.translate.currentLang),
  );
  protected readonly days = computed(() =>
    this.start() && this.end() ? daysBetweenIso(this.start(), this.end()) : 0,
  );
  protected readonly itemCount = computed(() =>
    this.start() && this.end() ? expectedItemCount(this.start(), this.end(), this.frequency()) : 0,
  );

  protected readonly canAdvance = computed(() => {
    switch (this.step()) {
      case 1:
        return !!this.start() && !!this.end() && this.end() >= this.start();
      case 3:
        return this.picked().length > 0;
      default:
        // L'objectif reste facultatif : l'exiger bloquerait quelqu'un qui veut
        // simplement « publier régulièrement », ce qui est un objectif valable.
        return true;
    }
  });

  // ── Navigation ───────────────────────────────────────────────────────────

  protected next(): void {
    if (!this.canAdvance()) return;
    const next = Math.min(this.totalSteps, this.step() + 1);
    this.step.set(next);
    // Les occasions ne sont demandées qu'au récapitulatif : c'est là qu'elles
    // servent, et les dates ne bougent plus.
    if (next === this.totalSteps) this.loadOccasions();
  }

  protected back(): void {
    this.step.set(Math.max(1, this.step() - 1));
  }

  protected cancel(): void {
    this.cancelled.emit();
  }

  // ── Étape 1 : quand ──────────────────────────────────────────────────────

  protected choosePreset(preset: PeriodPreset): void {
    this.preset.set(preset);
    const range = presetRange(preset);
    this.start.set(range.start);
    this.end.set(range.end);
  }

  protected setStart(value: string): void {
    this.preset.set('custom');
    this.start.set(value);
    if (this.end() && this.end() < value) this.end.set(lastDayOfMonth(value));
  }

  protected setEnd(value: string): void {
    this.preset.set('custom');
    this.end.set(value);
  }

  // ── Étape 2 : pourquoi ───────────────────────────────────────────────────

  protected useHint(hint: string): void {
    this.objective.set(
      this.translate.instant(
        `dashboard.showCommunication.wizard.objectives.${hint}.text`,
      ) as string,
    );
  }

  // ── Étape 3 : où et combien ──────────────────────────────────────────────

  protected toggleChannel(channel: ContentChannel): void {
    this.picked.update((list) =>
      list.includes(channel) ? list.filter((item) => item !== channel) : [...list, channel],
    );
  }

  protected isPicked(channel: ContentChannel): boolean {
    return this.picked().includes(channel);
  }

  protected setFrequency(value: number): void {
    this.frequency.set(value);
  }

  // ── Étape 4 : récapitulatif ──────────────────────────────────────────────

  private loadOccasions(): void {
    if (!this.start() || !this.end()) return;
    this.isLoadingOccasions.set(true);
    this.communication.getOccasions(this.projectId(), this.start(), this.end()).subscribe({
      next: (occasions) => {
        this.occasions.set(occasions);
        this.isLoadingOccasions.set(false);
      },
      // Silencieux : les occasions sont une aide, pas une condition.
      error: () => this.isLoadingOccasions.set(false),
    });
  }

  protected submit(): void {
    this.submitted.emit({
      // Le nom se déduit des dates. Le demander était un champ de plus pour un
      // renseignement que personne n'a envie de fournir.
      name: '',
      objective: this.objective().trim(),
      start: this.start(),
      end: this.end(),
      // Deux semaines ou moins ⇒ temps fort ; au-delà ⇒ rythme de croisière. La
      // question ne se pose plus à l'utilisateur, elle se déduit de la durée.
      kind: this.days() <= 16 ? 'campaign' : 'regular',
      postsPerWeek: this.frequency(),
      channels: this.picked(),
    });
  }
}
