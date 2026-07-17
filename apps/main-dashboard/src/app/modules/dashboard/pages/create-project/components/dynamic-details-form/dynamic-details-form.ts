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

  // État du plan IA
  protected readonly pending = signal(true);
  protected readonly loadError = signal(false);
  protected readonly questions = signal<OnboardingPlanQuestion[]>([]);

  /** Nombre de lignes de squelette affichées pendant le chargement du plan. */
  protected readonly skeletonRows = [0, 1, 2, 3];

  // Réponses : champs d'identité fixes + réponses aux questions (clé = id)
  protected readonly name = signal('');
  protected readonly type = signal('');
  protected readonly answers = signal<Record<string, string>>({});

  /** Champs requis : nom + type + cible principale (targets). */
  protected readonly formValid = computed(() => {
    const targets = this.questions().find((q) => q.field === 'targets');
    const targetsAnswered = targets ? !!this.answers()[targets.id] : true;
    return this.name().trim().length > 0 && !!this.type() && targetsAnswered;
  });

  ngOnInit(): void {
    const p = this.project();
    this.name.set(p?.name?.trim() ?? '');
    this.type.set(this.coerceType(p?.type));
    void this.loadPlan();
  }

  private coerceType(type: unknown): string {
    if (!type) return '';
    if (typeof type === 'string') return type;
    // Données héritées : le type pouvait être stocké comme objet { name, code }.
    const t = type as { code?: string };
    return t?.code ?? '';
  }

  protected async loadPlan(): Promise<void> {
    this.pending.set(true);
    this.loadError.set(false);
    const p = this.project();
    const lang = this.translate.currentLang === 'en' ? 'en' : 'fr';
    try {
      const questions = await this.planService.getPlan({
        description: p?.description ?? '',
        name: this.name() || undefined,
        type: this.type() || undefined,
        language: lang,
      });
      this.questions.set(questions);
      this.prefillFromProject(questions);
    } catch {
      this.loadError.set(true);
    } finally {
      this.pending.set(false);
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
    for (const q of questions) {
      if (q.field === 'targets' && p?.targets) known[q.id] = p.targets;
      if (q.field === 'scope' && p?.scope) known[q.id] = p.scope;
      if (q.field === 'teamSize' && p?.teamSize) known[q.id] = p.teamSize;
      if (q.field === 'budgetIntervals' && p?.budgetIntervals) known[q.id] = p.budgetIntervals;
      if (q.field === 'constraints' && constraints.length) {
        const prefix = `${q.prompt.trim()}: `;
        const match = constraints.find((c) => c.startsWith(prefix));
        if (match) known[q.id] = match.slice(prefix.length);
      }
    }
    if (Object.keys(known).length) {
      this.answers.update((a) => ({ ...a, ...known }));
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

  protected answerValue(question: OnboardingPlanQuestion): string {
    return this.answers()[question.id] ?? '';
  }

  protected isChoice(question: OnboardingPlanQuestion): boolean {
    return question.kind === 'choice';
  }

  /** Recalcule les champs projet et les remonte au parent. */
  private emitUpdate(): void {
    const resolved: OnboardingResolvedAnswer[] = this.questions().map((q) => {
      const value = this.answers()[q.id] ?? '';
      const display =
        q.kind === 'choice'
          ? (q.chips?.find((c) => c.value === value)?.label ?? value)
          : value;
      return { field: q.field, value, display, prompt: q.prompt };
    });

    const fields = this.planService.buildProjectFieldsFromAnswers(resolved);
    // Nom + type : champs fixes du formulaire, toujours reflétés (même vides)
    fields.name = this.name().trim();
    fields.type = (this.type() || '') as ProjectModel['type'];
    this.projectUpdate.emit(fields);
  }
}
