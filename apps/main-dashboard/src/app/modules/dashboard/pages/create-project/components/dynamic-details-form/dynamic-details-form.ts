import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { FloatLabel } from 'primeng/floatlabel';
import { Select } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { SkeletonModule } from 'primeng/skeleton';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ProjectModel } from '@idem/shared-models';

import { SelectElement } from '../../datas';
import { OnboardingPlanQuestion } from '../../../../../chat/models/chat.model';
import {
  OnboardingPlanService,
  OnboardingResolvedAnswer,
} from '../../../../../chat/services/onboarding-plan.service';

/**
 * Étape « détails » du mode formulaire, pilotée par l'IA.
 *
 * Contrairement à l'ancien formulaire statique, cette étape :
 *  - demande toujours le nom + le type du projet (champs fixes) ;
 *  - récupère un plan de questions adapté au projet (même endpoint que le
 *    mode chat) et rend chaque question comme un input (select / texte) ;
 *  - remonte toutes les réponses au parent via `projectUpdate`, y compris
 *    les réponses contextuelles formatées dans `constraints[]`.
 */
@Component({
  selector: 'app-dynamic-details-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    InputTextModule,
    FloatLabel,
    Select,
    TextareaModule,
    SkeletonModule,
    TranslateModule,
  ],
  templateUrl: './dynamic-details-form.html',
  styleUrl: './dynamic-details-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DynamicDetailsFormComponent implements OnInit {
  private readonly planService = inject(OnboardingPlanService);
  private readonly translate = inject(TranslateService);

  readonly project = input.required<ProjectModel>();
  readonly groupedProjectTypes = input.required<SelectElement[]>();

  readonly projectUpdate = output<Partial<ProjectModel>>();

  // Questions cœur (fixes, immédiates) et contextuelles (IA, chargées à part)
  protected readonly coreQuestions = signal<OnboardingPlanQuestion[]>([]);
  protected readonly contextualQuestions = signal<OnboardingPlanQuestion[]>([]);
  protected readonly contextualPending = signal(true);
  protected readonly contextualError = signal(false);

  /** Toutes les questions (cœur + contextuelles) pour la validation/émission. */
  protected readonly questions = computed(() => [
    ...this.coreQuestions(),
    ...this.contextualQuestions(),
  ]);

  /** Nombre de lignes de squelette affichées pendant le chargement contextuel. */
  protected readonly skeletonRows = [0, 1, 2];

  // Réponses : champs d'identité fixes + réponses aux questions (clé = id)
  protected readonly name = signal('');
  protected readonly type = signal('');
  protected readonly answers = signal<Record<string, string>>({});
  /** Saisie libre associée à une option « Autre » (clé = id de question). */
  protected readonly customText = signal<Record<string, string>>({});

  /** Champs requis : nom + type + cible + devise (renseignée, texte libre si « Autre »). */
  protected readonly formValid = computed(() => {
    const answers = this.answers();
    const targets = this.questions().find((q) => q.field === 'targets');
    const targetsAnswered = targets ? !!answers[targets.id] : true;
    const currency = this.questions().find((q) => q.field === 'currency');
    const currencyAnswered = currency
      ? !!answers[currency.id] &&
        (answers[currency.id] !== 'other' || !!this.customText()[currency.id]?.trim())
      : true;
    return (
      this.name().trim().length > 0 && !!this.type() && targetsAnswered && currencyAnswered
    );
  });

  private lang(): 'fr' | 'en' {
    // Défaut anglais : tout ce qui n'est pas « fr » (dont undefined) → 'en'.
    return (this.translate.currentLang || 'en') === 'fr' ? 'fr' : 'en';
  }

  ngOnInit(): void {
    const p = this.project();
    this.name.set(p?.name?.trim() ?? '');
    this.type.set(this.coerceType(p?.type));

    // Questions cœur : immédiates, sans attendre l'IA.
    const core = this.planService.buildFixedCoreQuestions(this.lang());
    this.coreQuestions.set(core);
    this.prefillFromProject(core);

    // Questions contextuelles : chargées en arrière-plan (loader dédié).
    void this.loadContextual();
  }

  private coerceType(type: unknown): string {
    if (!type) return '';
    if (typeof type === 'string') return type;
    // Données héritées : le type pouvait être stocké comme objet { name, code }.
    const t = type as { code?: string };
    return t?.code ?? '';
  }

  protected async loadContextual(): Promise<void> {
    this.contextualPending.set(true);
    this.contextualError.set(false);
    const p = this.project();
    try {
      const questions = await this.planService.getContextualQuestions({
        description: p?.description ?? '',
        name: this.name() || undefined,
        type: this.type() || undefined,
        language: this.lang(),
      });
      this.contextualQuestions.set(questions);
      this.prefillFromProject(questions);
    } catch {
      this.contextualError.set(true);
    } finally {
      this.contextualPending.set(false);
    }
  }

  /**
   * Pré-remplit les réponses depuis un projet en cours (retour arrière) :
   * champs cœur + réponses contextuelles reconstruites depuis les chaînes
   * « Question: Réponse » stockées dans `constraints[]`.
   */
  private prefillFromProject(questions: OnboardingPlanQuestion[]): void {
    const p = this.project();
    const known: Record<string, string> = {};
    const constraints = p?.constraints ?? [];
    const customs: Record<string, string> = {};
    for (const q of questions) {
      if (q.field === 'targets' && p?.targets) known[q.id] = p.targets;
      if (q.field === 'scope' && p?.scope) known[q.id] = p.scope;
      if (q.field === 'teamSize' && p?.teamSize) known[q.id] = p.teamSize;
      if (q.field === 'budgetIntervals' && p?.budgetIntervals) known[q.id] = p.budgetIntervals;
      if (q.field === 'currency' && p?.currency) {
        const match = q.chips?.find((c) => c.value === p.currency);
        if (match) {
          known[q.id] = match.value;
        } else {
          // Devise personnalisée → option « Autre » + texte pré-rempli.
          known[q.id] = 'other';
          customs[q.id] = p.currency;
        }
      }
      if (q.field === 'constraints' && constraints.length) {
        const prefix = `${q.prompt.trim()}: `;
        const match = constraints.find((c) => c.startsWith(prefix));
        if (match) known[q.id] = match.slice(prefix.length);
      }
    }
    if (Object.keys(known).length) {
      this.answers.update((a) => ({ ...a, ...known }));
    }
    if (Object.keys(customs).length) {
      this.customText.update((c) => ({ ...c, ...customs }));
    }
  }

  // ─────────────────────────────────────────────── Saisie

  protected onNameChange(value: string): void {
    this.name.set(value ?? '');
    this.emitUpdate();
  }

  protected onTypeChange(value: string): void {
    this.type.set(value ?? '');
    this.emitUpdate();
  }

  protected onAnswerChange(question: OnboardingPlanQuestion, value: string): void {
    this.answers.update((a) => ({ ...a, [question.id]: value ?? '' }));
    this.emitUpdate();
  }

  protected onCustomTextChange(question: OnboardingPlanQuestion, value: string): void {
    this.customText.update((c) => ({ ...c, [question.id]: value ?? '' }));
    this.emitUpdate();
  }

  protected answerValue(question: OnboardingPlanQuestion): string {
    return this.answers()[question.id] ?? '';
  }

  protected customValue(question: OnboardingPlanQuestion): string {
    return this.customText()[question.id] ?? '';
  }

  protected isChoice(question: OnboardingPlanQuestion): boolean {
    return question.kind === 'choice';
  }

  /** Vrai quand l'option « Autre » est sélectionnée pour cette question. */
  protected isOther(question: OnboardingPlanQuestion): boolean {
    return this.answers()[question.id] === 'other';
  }

  /** Recalcule les champs projet et les remonte au parent. */
  private emitUpdate(): void {
    const resolved: OnboardingResolvedAnswer[] = this.questions().map((q) => {
      const value = this.answers()[q.id] ?? '';
      if (q.kind === 'choice') {
        // « Autre » : le texte libre devient le libellé exploité (ex. devise).
        if (value === 'other') {
          return { field: q.field, value, display: (this.customText()[q.id] ?? '').trim(), prompt: q.prompt };
        }
        const display = q.chips?.find((c) => c.value === value)?.label ?? value;
        return { field: q.field, value, display, prompt: q.prompt };
      }
      return { field: q.field, value, display: value, prompt: q.prompt };
    });

    const fields = this.planService.buildProjectFieldsFromAnswers(resolved);
    // Nom + type : champs fixes du formulaire, toujours reflétés (même vides)
    fields.name = this.name().trim();
    fields.type = (this.type() || '') as ProjectModel['type'];
    this.projectUpdate.emit(fields);
  }
}
