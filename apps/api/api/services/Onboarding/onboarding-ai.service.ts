/**
 * OnboardingAIService — couche IA de la création de projet conversationnelle.
 *
 * Stateless : aucune persistance de conversation (contrairement à l'Advisor).
 * Réutilise PromptService.runPrompt + le pattern parseJSON de FinanceAIService.
 *
 *  - generateQuestions: produit un plan de questions adapté au projet décrit
 *    (4 questions cœur + 2-3 questions contextuelles).
 *  - parseAnswer: mappe une réponse en texte libre vers un code d'option.
 */

import logger from '../../config/logger';
import { AIChatMessage, LLMProvider, PromptConfig, PromptService } from '../prompt.service';
import {
  ONBOARDING_PARSE_PROMPT,
  ONBOARDING_QUESTIONS_PROMPT,
} from './prompts/onboarding.prompt';

export interface OnboardingChip {
  label: string;
  value: string;
}

export interface OnboardingQuestion {
  id: string;
  field: string;
  kind: 'choice' | 'open';
  optional: boolean;
  prompt: string;
  chips?: OnboardingChip[];
}

export interface GenerateQuestionsInput {
  description: string;
  name?: string;
  type?: string;
  language?: string;
  knownAnswers?: Record<string, unknown>;
}

export interface ParseAnswerInput {
  field: string;
  question: string;
  answerText: string;
  options?: OnboardingChip[];
  language?: string;
}

export interface ParseAnswerResult {
  value: string | null;
  display: string;
}

const DEFAULT_PROMPT_CONFIG: PromptConfig = {
  provider: LLMProvider.GEMINI,
  modelName: 'gemini-3-flash-preview',
  promptType: 'onboarding',
  llmOptions: {
    temperature: 0.5,
    maxOutputTokens: 2048,
  },
};

/** Garde-fou : plan minimal si l'IA échoue (les champs cœur restent garantis). */
const FALLBACK_QUESTIONS: OnboardingQuestion[] = [
  {
    id: 'targets',
    field: 'targets',
    kind: 'choice',
    optional: false,
    prompt: 'Qui est votre public cible principal ?',
    chips: [
      { label: 'Entreprises', value: 'business' },
      { label: 'Étudiants', value: 'students' },
      { label: 'Grand public', value: 'general-public' },
      { label: 'Administrations', value: 'government' },
      { label: 'Professionnels de santé', value: 'healthcare' },
    ],
  },
  {
    id: 'scope',
    field: 'scope',
    kind: 'choice',
    optional: true,
    prompt: 'Quelle est la portée géographique visée ?',
    chips: [
      { label: 'Locale', value: 'local' },
      { label: 'Départementale', value: 'departmental' },
      { label: 'Régionale', value: 'regional' },
      { label: 'Nationale', value: 'national' },
      { label: 'Internationale', value: 'international' },
    ],
  },
  {
    id: 'teamSize',
    field: 'teamSize',
    kind: 'choice',
    optional: true,
    prompt: 'Combien de personnes composent votre équipe ?',
    chips: [
      { label: 'Solo', value: '1' },
      { label: '2 à 5', value: '2-5' },
      { label: '6 à 10', value: '6-10' },
      { label: 'Plus de 10', value: '10+' },
    ],
  },
  {
    id: 'budget',
    field: 'budgetIntervals',
    kind: 'choice',
    optional: true,
    prompt: 'Quelle est votre fourchette de budget ?',
    chips: [
      { label: 'Moins de 5 000 €', value: 'lt-5k' },
      { label: '5 000 € à 20 000 €', value: '5k-20k' },
      { label: '20 000 € à 50 000 €', value: '20k-50k' },
      { label: 'Plus de 50 000 €', value: 'gt-50k' },
    ],
  },
];

const ALLOWED_CORE = new Map<string, { field: string; values: string[] }>([
  ['targets', { field: 'targets', values: ['business', 'students', 'general-public', 'government', 'healthcare'] }],
  ['scope', { field: 'scope', values: ['local', 'departmental', 'regional', 'national', 'international'] }],
  ['teamSize', { field: 'teamSize', values: ['1', '2-5', '6-10', '10+'] }],
  ['budget', { field: 'budgetIntervals', values: ['lt-5k', '5k-20k', '20k-50k', 'gt-50k'] }],
]);

export class OnboardingAIService {
  constructor(private readonly promptService: PromptService) {}

  async generateQuestions(
    userId: string,
    input: GenerateQuestionsInput,
  ): Promise<OnboardingQuestion[]> {
    const language = input.language === 'en' ? 'English' : 'French';
    const messages: AIChatMessage[] = [
      { role: 'system', content: ONBOARDING_QUESTIONS_PROMPT },
      {
        role: 'system',
        content: [
          `ANSWER LANGUAGE: ${language}`,
          `PROJECT NAME: ${input.name || '—'}`,
          `PROJECT TYPE: ${input.type || '—'}`,
          `KNOWN ANSWERS: ${JSON.stringify(input.knownAnswers || {})}`,
        ].join('\n'),
      },
      { role: 'user', content: `PROJECT DESCRIPTION:\n${input.description || '—'}` },
    ];

    try {
      const raw = await this.promptService.runPrompt(
        { ...DEFAULT_PROMPT_CONFIG, userId },
        messages,
      );
      const parsed = this.parseJSON(raw);
      const questions = this.sanitizeQuestions(parsed?.questions);
      return questions.length > 0 ? questions : FALLBACK_QUESTIONS;
    } catch (err: any) {
      logger.error(`OnboardingAI.generateQuestions failed: ${err?.message}`);
      return FALLBACK_QUESTIONS;
    }
  }

  async parseAnswer(userId: string, input: ParseAnswerInput): Promise<ParseAnswerResult> {
    const language = input.language === 'en' ? 'English' : 'French';
    const messages: AIChatMessage[] = [
      { role: 'system', content: ONBOARDING_PARSE_PROMPT },
      {
        role: 'system',
        content: [
          `ANSWER LANGUAGE: ${language}`,
          `QUESTION: ${input.question}`,
          `ALLOWED OPTIONS: ${JSON.stringify(input.options || [])}`,
        ].join('\n'),
      },
      { role: 'user', content: input.answerText || '' },
    ];

    try {
      const raw = await this.promptService.runPrompt(
        { ...DEFAULT_PROMPT_CONFIG, userId, llmOptions: { temperature: 0.1, maxOutputTokens: 256 } },
        messages,
      );
      const parsed = this.parseJSON(raw);
      const allowed = (input.options || []).map((o) => o.value);
      const value =
        typeof parsed?.value === 'string' && allowed.includes(parsed.value) ? parsed.value : null;
      const display =
        typeof parsed?.display === 'string' && parsed.display.trim()
          ? parsed.display.trim()
          : input.answerText.trim();
      return { value, display };
    } catch (err: any) {
      logger.error(`OnboardingAI.parseAnswer failed: ${err?.message}`);
      return { value: null, display: input.answerText.trim() };
    }
  }

  // -------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------

  /** Valide/normalise les questions renvoyées par l'IA contre le contrat attendu. */
  private sanitizeQuestions(raw: unknown): OnboardingQuestion[] {
    if (!Array.isArray(raw)) return [];
    const out: OnboardingQuestion[] = [];
    let ctxCount = 0;

    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const q = item as Record<string, unknown>;
      const id = String(q['id'] || '').trim();
      const prompt = String(q['prompt'] || '').trim();
      if (!id || !prompt) continue;

      const core = ALLOWED_CORE.get(id);
      if (core) {
        const chips = Array.isArray(q['chips'])
          ? (q['chips'] as unknown[])
              .map((c) => {
                const chip = c as Record<string, unknown>;
                return {
                  label: String(chip?.['label'] || '').trim(),
                  value: String(chip?.['value'] || '').trim(),
                };
              })
              .filter((c) => c.label && core.values.includes(c.value))
          : [];
        out.push({
          id,
          field: core.field,
          kind: 'choice',
          optional: id !== 'targets',
          prompt,
          chips: chips.length > 0 ? chips : undefined,
        });
      } else if (ctxCount < 3) {
        // Question contextuelle (texte libre) → enrichit les contraintes
        ctxCount += 1;
        out.push({
          id: `ctx_${ctxCount}`,
          field: 'constraints',
          kind: 'open',
          optional: true,
          prompt,
        });
      }
    }

    // Garantit la présence + l'ordre des champs cœur même si l'IA en oublie
    const byId = new Map(out.filter((q) => ALLOWED_CORE.has(q.id)).map((q) => [q.id, q]));
    const ordered: OnboardingQuestion[] = [];
    for (const coreId of ['targets', 'scope', 'teamSize', 'budget']) {
      ordered.push(byId.get(coreId) || FALLBACK_QUESTIONS.find((q) => q.id === coreId)!);
    }
    ordered.push(...out.filter((q) => q.kind === 'open'));
    return ordered;
  }

  private parseJSON(raw: string): any {
    const cleaned = this.promptService.getCleanAIText(raw).trim();
    const stripped = cleaned
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    try {
      return JSON.parse(stripped);
    } catch {
      const match = stripped.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch {
          /* fall through */
        }
      }
      throw new Error('Invalid JSON returned by LLM');
    }
  }
}
