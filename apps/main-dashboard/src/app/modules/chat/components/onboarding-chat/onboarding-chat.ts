import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  ViewEncapsulation,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MarkdownModule } from 'ngx-markdown';
import { firstValueFrom } from 'rxjs';
import { ProjectModel } from '@idem/shared-models';

import { ProjectService } from '../../../dashboard/services/project.service';
import { initEmptyObject } from '../../../../utils/init-empty-object';
import { OnboardingAiService } from '../../services/onboarding-ai.service';
import { SuggestionChipsComponent } from '../suggestion-chips/suggestion-chips';
import { RecapCardComponent } from '../recap-card/recap-card';
import {
  ChatChip,
  ChatMessageModel,
  OnboardingPlanQuestion,
  OnboardingPolicyAcceptances,
  OnboardingRecapData,
} from '../../models/chat.model';

/** Données de départ (issues du formulaire Fondations / d'un projet en cours). */
export interface OnboardingFoundations {
  description: string;
  name: string;
  type: string;
  typeLabel: string;
  /** Projet déjà créé en base (sinon le composant le créera à la fin) */
  projectId: string | null;
}

interface PersistedAnswer {
  field: string;
  value: string;
  display: string;
}

interface PersistedState {
  key: string;
  questions: OnboardingPlanQuestion[];
  index: number;
  answers: PersistedAnswer[];
  notes: string[];
  thread: ChatMessageModel[];
  phase: 'asking' | 'recap';
}

const STORAGE_KEY = 'idem_onboarding_chat_v2';
let msgCounter = 0;

/**
 * Espace conversationnel de création de projet, piloté par l'IA.
 *
 * À partir des fondations (description + nom + type), récupère un plan de
 * questions adapté au projet (cible, périmètre, équipe, budget + questions
 * contextuelles), les pose une à une (chips + texte libre analysé par l'IA),
 * puis affiche un récapitulatif et crée/finalise le projet.
 *
 * Réutilisable : create-project (mode chat) et /chat/new.
 */
@Component({
  selector: 'app-onboarding-chat',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    MarkdownModule,
    SuggestionChipsComponent,
    RecapCardComponent,
  ],
  templateUrl: './onboarding-chat.html',
  styleUrls: ['./onboarding-chat.css', '../../../dashboard/pages/advisor/advisor-markdown.css'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingChatComponent implements OnInit, AfterViewChecked {
  private readonly aiService = inject(OnboardingAiService);
  private readonly projectService = inject(ProjectService);
  private readonly translate = inject(TranslateService);

  /** Fondations du projet (obligatoires pour démarrer le plan IA) */
  readonly foundations = input.required<OnboardingFoundations>();
  /** Affiche un bouton « passer au formulaire » dans l'en-tête du composer */
  readonly showFormSwitch = input<boolean>(true);

  readonly created = output<string>();
  readonly switchToForm = output<void>();

  @ViewChild('scrollAnchor') private scrollAnchor?: ElementRef<HTMLDivElement>;

  protected readonly messages = signal<ChatMessageModel[]>([]);
  protected readonly draft = signal('');
  protected readonly pending = signal(false);
  protected readonly isCreating = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly phase = signal<'asking' | 'recap'>('asking');

  private questions: OnboardingPlanQuestion[] = [];
  private index = 0;
  private answers: PersistedAnswer[] = [];
  private notes: string[] = [];

  protected readonly lastMessageId = computed(() => {
    const m = this.messages();
    return m.length ? m[m.length - 1].id : null;
  });

  private get storageKey(): string {
    return this.foundations().projectId || 'new';
  }

  // ─────────────────────────────────────────────── Lifecycle

  ngOnInit(): void {
    if (this.restore()) return;
    void this.startFlow();
  }

  ngAfterViewChecked(): void {
    this.scrollAnchor?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  // ─────────────────────────────────────────────── Démarrage / plan IA

  private async startFlow(): Promise<void> {
    this.appendAssistant(
      this.translate.instant('chat.onboarding.aiWelcome', { name: this.foundations().name }),
    );
    this.pending.set(true);
    try {
      const lang = this.translate.currentLang === 'en' ? 'en' : 'fr';
      const res = await firstValueFrom(
        this.aiService.generateQuestions({
          description: this.foundations().description,
          name: this.foundations().name,
          type: this.foundations().type,
          language: lang,
        }),
      );
      this.questions = res?.questions ?? [];
      this.index = 0;
      this.pending.set(false);
      if (this.questions.length === 0) {
        this.goToRecap();
      } else {
        this.askCurrent();
      }
    } catch (error) {
      console.error('Onboarding: plan generation failed', error);
      this.pending.set(false);
      this.errorMessage.set(this.translate.instant('chat.onboarding.errors.planFailed'));
      // Sans plan, on propose directement le récap (champs cœur vides)
      this.goToRecap();
    }
  }

  private currentQuestion(): OnboardingPlanQuestion | null {
    return this.index < this.questions.length ? this.questions[this.index] : null;
  }

  private askCurrent(): void {
    const q = this.currentQuestion();
    if (!q) {
      this.goToRecap();
      return;
    }
    const chips: ChatChip[] = (q.chips ?? []).map((c) => ({
      label: c.label,
      action: 'answer',
      payload: c.value,
    }));
    if (q.optional) {
      chips.push({ labelKey: 'chat.onboarding.actions.skip', icon: 'pi pi-forward', action: 'skip' });
    }
    this.appendAssistant(q.prompt, chips.length ? chips : undefined);
    this.persist();
  }

  // ─────────────────────────────────────────────── Saisie utilisateur

  protected updateDraft(value: string): void {
    this.draft.set(value);
  }

  protected handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  protected send(): void {
    const text = this.draft().trim();
    if (!text || this.pending() || this.isCreating() || this.phase() !== 'asking') return;
    this.draft.set('');
    this.errorMessage.set(null);
    this.appendUser(text);
    void this.handleAnswer(text, false);
  }

  protected onChipSelected(chip: ChatChip): void {
    if (this.pending() || this.isCreating() || this.phase() !== 'asking') return;
    if (chip.action === 'skip') {
      this.appendUser(this.translate.instant('chat.onboarding.actions.skipped'));
      this.recordAnswer('', '');
      this.advance();
      return;
    }
    if (chip.action === 'answer') {
      const label = chip.label ?? chip.payload ?? '';
      this.appendUser(label);
      this.recordAnswer(chip.payload ?? '', label);
      this.advance();
    }
  }

  private async handleAnswer(text: string, viaSkip: boolean): Promise<void> {
    const q = this.currentQuestion();
    if (!q) return;

    if (q.kind === 'open') {
      // Question contextuelle : on garde le texte tel quel (enrichit constraints)
      this.recordAnswer(text, text);
      this.advance();
      return;
    }

    // Question à choix répondue en texte libre → analyse IA
    this.pending.set(true);
    try {
      const lang = this.translate.currentLang === 'en' ? 'en' : 'fr';
      const res = await firstValueFrom(
        this.aiService.parseAnswer({
          field: q.field,
          question: q.prompt,
          answerText: text,
          options: q.chips ?? [],
          language: lang,
        }),
      );
      this.pending.set(false);
      this.recordAnswer(res?.value ?? '', res?.display || text);
      this.advance();
    } catch (error) {
      console.error('Onboarding: answer parse failed', error);
      this.pending.set(false);
      // On accepte le texte brut pour ne pas bloquer l'utilisateur
      this.recordAnswer('', text);
      this.advance();
    }
  }

  private recordAnswer(value: string, display: string): void {
    const q = this.currentQuestion();
    if (!q) return;
    if (q.field === 'constraints') {
      if (value.trim()) this.notes.push(value.trim());
    } else {
      // Remplace toute réponse précédente pour ce champ
      this.answers = this.answers.filter((a) => a.field !== q.field);
      if (value) this.answers.push({ field: q.field, value, display });
    }
  }

  private advance(): void {
    this.index += 1;
    this.persist();
    if (this.index >= this.questions.length) {
      this.goToRecap();
    } else {
      // Petit délai pour un rythme naturel
      this.pending.set(true);
      setTimeout(() => {
        this.pending.set(false);
        this.askCurrent();
      }, 350);
    }
  }

  // ─────────────────────────────────────────────── Récap & création

  private goToRecap(): void {
    this.phase.set('recap');
    const recap = this.buildRecap();
    this.messages.update((m) => [
      ...m,
      {
        id: this.nextId(),
        role: 'assistant',
        content: this.translate.instant('chat.onboarding.questions.recap'),
        createdAt: new Date().toISOString(),
        recap,
      },
    ]);
    this.persist();
  }

  private answerDisplay(field: string): string | undefined {
    return this.answers.find((a) => a.field === field)?.display || undefined;
  }

  private buildRecap(): OnboardingRecapData {
    return {
      name: this.foundations().name,
      description: this.foundations().description,
      typeKey: this.foundations().typeLabel || this.foundations().type,
      targetsKey: this.answerDisplay('targets'),
      scopeKey: this.answerDisplay('scope'),
      teamSizeKey: this.answerDisplay('teamSize'),
      budgetKey: this.answerDisplay('budgetIntervals'),
    };
  }

  private answerValue(field: string): string {
    return this.answers.find((a) => a.field === field)?.value || '';
  }

  protected async onRecapConfirmed(acceptances: OnboardingPolicyAcceptances): Promise<void> {
    if (this.isCreating()) return;
    this.isCreating.set(true);
    try {
      const projectId = await this.persistProject(acceptances);
      this.clearPersisted();
      this.created.emit(projectId);
    } catch (error) {
      console.error('Onboarding: project creation failed', error);
      this.isCreating.set(false);
      this.appendAssistant(this.translate.instant('chat.onboarding.errors.createFailed'));
    }
  }

  protected onRecapRestart(): void {
    this.clearPersisted();
    this.messages.set([]);
    this.questions = [];
    this.index = 0;
    this.answers = [];
    this.notes = [];
    this.phase.set('asking');
    void this.startFlow();
  }

  /** Crée (ou met à jour si déjà créé) puis finalise le projet. */
  private async persistProject(acceptances: OnboardingPolicyAcceptances): Promise<string> {
    const f = this.foundations();
    const fields: Partial<ProjectModel> = {
      targets: this.answerValue('targets'),
      scope: this.answerValue('scope'),
      teamSize: this.answerValue('teamSize'),
      budgetIntervals: this.answerValue('budgetIntervals'),
      constraints: this.notes.slice(),
    };

    let projectId = f.projectId;
    if (projectId) {
      await firstValueFrom(this.projectService.updateProject(projectId, fields));
    } else {
      const project = initEmptyObject<ProjectModel>();
      project.name = f.name;
      project.description = f.description;
      project.type = (f.type || 'web') as ProjectModel['type'];
      project.targets = fields.targets ?? '';
      project.scope = fields.scope ?? '';
      project.teamSize = fields.teamSize ?? '';
      project.budgetIntervals = fields.budgetIntervals ?? '';
      project.constraints = fields.constraints ?? [];
      project.selectedPhases = [];
      projectId = await firstValueFrom(this.projectService.createProject(project));
    }
    if (!projectId) throw new Error('No project id after creation');

    try {
      await firstValueFrom(
        this.projectService.finalizeProjectCreation(projectId, {
          privacyPolicyAccepted: acceptances.privacy,
          termsOfServiceAccepted: acceptances.terms,
          betaPolicyAccepted: acceptances.beta,
          marketingAccepted: acceptances.marketing,
        }),
      );
    } catch (error) {
      console.warn('Onboarding: finalize failed (non-blocking)', error);
    }
    return projectId;
  }

  // ─────────────────────────────────────────────── Messages helpers

  private nextId(): string {
    msgCounter += 1;
    return `onb-${Date.now()}-${msgCounter}`;
  }

  private appendAssistant(content: string, chips?: ChatChip[]): void {
    this.messages.update((m) => [
      ...m,
      { id: this.nextId(), role: 'assistant', content, createdAt: new Date().toISOString(), chips },
    ]);
  }

  private appendUser(content: string): void {
    this.messages.update((m) => [
      ...m,
      { id: this.nextId(), role: 'user', content, createdAt: new Date().toISOString() },
    ]);
  }

  // ─────────────────────────────────────────────── Persistance (reprise)

  private persist(): void {
    try {
      const state: PersistedState = {
        key: this.storageKey,
        questions: this.questions,
        index: this.index,
        answers: this.answers,
        notes: this.notes,
        thread: this.messages(),
        phase: this.phase(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // stockage indisponible : pas de reprise, sans bloquer
    }
  }

  private restore(): boolean {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const state = JSON.parse(raw) as PersistedState;
      if (state.key !== this.storageKey || !Array.isArray(state.thread) || state.thread.length === 0) {
        return false;
      }
      this.questions = state.questions ?? [];
      this.index = state.index ?? 0;
      this.answers = state.answers ?? [];
      this.notes = state.notes ?? [];
      this.phase.set(state.phase ?? 'asking');
      this.messages.set(state.thread);
      return true;
    } catch {
      return false;
    }
  }

  private clearPersisted(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}
