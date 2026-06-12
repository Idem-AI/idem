import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { ProjectModel } from '@idem/shared-models';
import { ProjectService } from '../../dashboard/services/project.service';
import { initEmptyObject } from '../../../utils/init-empty-object';
import {
  ChatChip,
  ChatMessageModel,
  OnboardingAnswers,
  OnboardingPolicyAcceptances,
  OnboardingRecapData,
  OnboardingState,
  OnboardingStepId,
} from '../models/chat.model';

const STORAGE_KEY = 'idem_chat_onboarding';

const STEP_ORDER: OnboardingStepId[] = [
  'description',
  'name',
  'type',
  'targets',
  'scope',
  'teamSize',
  'budget',
  'recap',
];

interface StepDefinition {
  id: OnboardingStepId;
  /** Champ de réponse correspondant dans OnboardingAnswers */
  field?: keyof OnboardingAnswers;
  optional?: boolean;
  /** Codes d'options proposées en chips (labels i18n chat.onboarding.options.<id>.<code>) */
  optionCodes?: string[];
}

const STEP_DEFINITIONS: Record<OnboardingStepId, StepDefinition> = {
  description: { id: 'description', field: 'description' },
  name: { id: 'name', field: 'name' },
  type: {
    id: 'type',
    field: 'type',
    optionCodes: ['enterprise', 'web', 'mobile', 'iot', 'desktop', 'api', 'ai', 'blockchain'],
  },
  targets: {
    id: 'targets',
    field: 'targets',
    optional: true,
    optionCodes: ['business', 'students', 'general-public', 'government', 'healthcare'],
  },
  scope: {
    id: 'scope',
    field: 'scope',
    optional: true,
    optionCodes: ['local', 'departmental', 'regional', 'national', 'international'],
  },
  teamSize: {
    id: 'teamSize',
    field: 'teamSize',
    optional: true,
    optionCodes: ['1', '2-5', '6-10', '10+'],
  },
  budget: {
    id: 'budget',
    field: 'budgetIntervals',
    optional: true,
    optionCodes: ['lt-5k', '5k-20k', '20k-50k', 'gt-50k'],
  },
  recap: { id: 'recap' },
};

let messageCounter = 0;
function nextMessageId(): string {
  messageCounter += 1;
  return `onb-${Date.now()}-${messageCounter}`;
}

/**
 * Onboarding conversationnel : machine à états scriptée qui pose les questions
 * clés une par une, sauvegarde la progression à chaque étape (reprise possible)
 * et crée le projet via les API existantes après confirmation du récapitulatif.
 */
@Injectable({ providedIn: 'root' })
export class ChatOnboardingService {
  private readonly projectService = inject(ProjectService);
  private readonly translate = inject(TranslateService);

  hasDraft(): boolean {
    return this.load() !== null;
  }

  load(): OnboardingState | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as OnboardingState;
      if (parsed?.version !== 1 || !STEP_ORDER.includes(parsed.stepId)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  start(): OnboardingState {
    const state: OnboardingState = {
      version: 1,
      stepId: 'description',
      answers: {},
      updatedAt: new Date().toISOString(),
    };
    this.save(state);
    return state;
  }

  save(state: OnboardingState): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }));
    } catch {
      // Stockage indisponible : l'onboarding continue sans reprise possible
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  /** Chips de réponse pour l'étape courante. */
  chipsFor(stepId: OnboardingStepId): ChatChip[] {
    const definition = STEP_DEFINITIONS[stepId];
    const chips: ChatChip[] = (definition.optionCodes ?? []).map((code) => ({
      labelKey: `chat.onboarding.options.${stepId}.${code}`,
      action: 'answer',
      payload: code,
    }));
    if (definition.optional) {
      chips.push({ labelKey: 'chat.onboarding.actions.skip', icon: 'pi pi-forward', action: 'skip' });
    }
    return chips;
  }

  /** Message assistant posant la question de l'étape donnée. */
  questionMessage(state: OnboardingState): ChatMessageModel {
    if (state.stepId === 'recap') {
      return {
        id: nextMessageId(),
        role: 'assistant',
        content: this.translate.instant('chat.onboarding.questions.recap'),
        createdAt: new Date().toISOString(),
        recap: this.buildRecap(state.answers),
      };
    }
    return {
      id: nextMessageId(),
      role: 'assistant',
      content: this.translate.instant(`chat.onboarding.questions.${state.stepId}`),
      createdAt: new Date().toISOString(),
      chips: this.chipsFor(state.stepId),
    };
  }

  /** Reconstruit le fil complet depuis l'état persisté (reprise). */
  buildThread(state: OnboardingState, resumed: boolean): ChatMessageModel[] {
    const messages: ChatMessageModel[] = [
      {
        id: nextMessageId(),
        role: 'assistant',
        content: this.translate.instant(resumed ? 'chat.onboarding.resume' : 'chat.onboarding.welcome'),
        createdAt: new Date().toISOString(),
      },
    ];

    for (const stepId of STEP_ORDER) {
      if (stepId === state.stepId) break;
      const definition = STEP_DEFINITIONS[stepId];
      if (!definition.field) continue;
      const answer = state.answers[definition.field];
      messages.push({
        id: nextMessageId(),
        role: 'assistant',
        content: this.translate.instant(`chat.onboarding.questions.${stepId}`),
        createdAt: new Date().toISOString(),
      });
      messages.push({
        id: nextMessageId(),
        role: 'user',
        content: this.displayAnswer(stepId, answer),
        createdAt: new Date().toISOString(),
      });
    }

    messages.push(this.questionMessage(state));
    return messages;
  }

  /** Libellé affiché pour une réponse (résout les codes d'options en labels). */
  displayAnswer(stepId: OnboardingStepId, answer: string | undefined): string {
    if (!answer) {
      return this.translate.instant('chat.onboarding.actions.skipped');
    }
    const definition = STEP_DEFINITIONS[stepId];
    if (definition.optionCodes?.includes(answer)) {
      return this.translate.instant(`chat.onboarding.options.${stepId}.${answer}`);
    }
    return answer;
  }

  /**
   * Enregistre une réponse (texte libre, chip ou passage) et avance d'une étape.
   * Retourne les messages assistant à ajouter au fil, ou une erreur de validation.
   */
  submitAnswer(
    state: OnboardingState,
    rawValue: string,
    viaSkip = false,
  ): { state: OnboardingState; messages: ChatMessageModel[]; error?: string } {
    const definition = STEP_DEFINITIONS[state.stepId];
    if (!definition.field) {
      return { state, messages: [] };
    }

    const value = viaSkip ? '' : rawValue.trim();

    if (!viaSkip) {
      if (state.stepId === 'description' && value.length < 10) {
        return {
          state,
          messages: [],
          error: this.translate.instant('chat.onboarding.errors.descriptionTooShort'),
        };
      }
      if (state.stepId === 'name' && value.length === 0) {
        return {
          state,
          messages: [],
          error: this.translate.instant('chat.onboarding.errors.nameRequired'),
        };
      }
    }

    const answers: OnboardingAnswers = { ...state.answers, [definition.field]: value };
    const currentIndex = STEP_ORDER.indexOf(state.stepId);
    const nextStepId = STEP_ORDER[Math.min(currentIndex + 1, STEP_ORDER.length - 1)];
    const nextState: OnboardingState = {
      ...state,
      stepId: nextStepId,
      answers,
      updatedAt: new Date().toISOString(),
    };
    this.save(nextState);

    return { state: nextState, messages: [this.questionMessage(nextState)] };
  }

  buildRecap(answers: OnboardingAnswers): OnboardingRecapData {
    const optionKey = (stepId: OnboardingStepId, value: string | undefined): string | undefined => {
      if (!value) return undefined;
      const codes = STEP_DEFINITIONS[stepId].optionCodes ?? [];
      return codes.includes(value) ? `chat.onboarding.options.${stepId}.${value}` : value;
    };
    return {
      name: answers.name ?? '',
      description: answers.description ?? '',
      typeKey: optionKey('type', answers.type) ?? answers.type ?? '',
      targetsKey: optionKey('targets', answers.targets),
      scopeKey: optionKey('scope', answers.scope),
      teamSizeKey: optionKey('teamSize', answers.teamSize),
      budgetKey: optionKey('budget', answers.budgetIntervals),
    };
  }

  /** Crée le projet via les API existantes puis nettoie le brouillon. */
  async createProject(
    answers: OnboardingAnswers,
    acceptances: OnboardingPolicyAcceptances,
  ): Promise<string> {
    const project = initEmptyObject<ProjectModel>();
    project.name = answers.name ?? '';
    project.description = answers.description ?? '';
    project.type = (answers.type ?? 'web') as ProjectModel['type'];
    project.targets = answers.targets ?? '';
    project.scope = answers.scope ?? '';
    project.teamSize = answers.teamSize ?? '';
    project.budgetIntervals = answers.budgetIntervals ?? '';
    project.constraints = [];
    project.selectedPhases = [];

    const projectId = await firstValueFrom(this.projectService.createProject(project));
    if (!projectId) {
      throw new Error('Project creation returned no id');
    }

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
      // La finalisation des politiques ne doit pas bloquer la création
      console.warn('Chat onboarding: finalize failed', error);
    }

    this.clear();
    return projectId;
  }
}
