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
import { AI_CONFIG } from '../../config/ai.config';
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
  provider: AI_CONFIG.onboarding.default.provider,
  modelName: AI_CONFIG.onboarding.default.modelName,
  promptType: AI_CONFIG.onboarding.default.promptType,
  llmOptions: {
    ...AI_CONFIG.onboarding.default.llmOptions,
  },
};

const MIN_CONTEXTUAL = 3;
const MAX_CONTEXTUAL = 5;

/**
 * Garde-fou : questions contextuelles simples si l'IA échoue.
 * (Les champs cœur — devise, cible, portée, équipe — sont gérés côté client.)
 */
const FALLBACK_QUESTIONS_FR: OnboardingQuestion[] = [
  {
    id: 'ctx_1',
    field: 'constraints',
    kind: 'open',
    optional: true,
    prompt: 'Quel est le principal problème que votre projet résout ?',
  },
  {
    id: 'ctx_2',
    field: 'constraints',
    kind: 'open',
    optional: true,
    prompt: "Qu'est-ce qui distingue votre projet de l'existant ?",
  },
  {
    id: 'ctx_3',
    field: 'constraints',
    kind: 'open',
    optional: true,
    prompt: 'À quoi ressemblerait le succès dans un an ?',
  },
];

const FALLBACK_QUESTIONS_EN: OnboardingQuestion[] = [
  {
    id: 'ctx_1',
    field: 'constraints',
    kind: 'open',
    optional: true,
    prompt: 'What is the main problem your project solves?',
  },
  {
    id: 'ctx_2',
    field: 'constraints',
    kind: 'open',
    optional: true,
    prompt: 'What sets your project apart from existing solutions?',
  },
  {
    id: 'ctx_3',
    field: 'constraints',
    kind: 'open',
    optional: true,
    prompt: 'What would success look like in one year?',
  },
];

function getFallbackQuestions(language?: string): OnboardingQuestion[] {
  const isEn = language?.toLowerCase().startsWith('en');
  return isEn ? FALLBACK_QUESTIONS_EN : FALLBACK_QUESTIONS_FR;
}

export class OnboardingAIService {
  constructor(private readonly promptService: PromptService) {}

  async generateQuestions(
    userId: string,
    input: GenerateQuestionsInput,
  ): Promise<OnboardingQuestion[]> {
    const language = input.language === 'en' ? 'English' : 'French';
    const fallbacks = getFallbackQuestions(input.language);
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
      const questions = this.sanitizeQuestions(parsed?.questions, input.language);
      return questions.length > 0 ? questions : fallbacks;
    } catch (err: any) {
      logger.error(`OnboardingAI.generateQuestions failed: ${err?.message}`);
      return fallbacks;
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
        { ...DEFAULT_PROMPT_CONFIG, userId, llmOptions: { ...AI_CONFIG.onboarding.parseAnswer.llmOptions } },
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

  /**
   * Valide/normalise les questions contextuelles renvoyées par l'IA.
   * Uniquement des questions ouvertes (field "constraints"), bornées à [3, 5].
   * Les champs cœur (devise, cible, portée, équipe) sont gérés côté client.
   */
  private sanitizeQuestions(raw: unknown, language?: string): OnboardingQuestion[] {
    if (!Array.isArray(raw)) return [];
    const out: OnboardingQuestion[] = [];
    const fallbacks = getFallbackQuestions(language);

    for (const item of raw) {
      if (out.length >= MAX_CONTEXTUAL) break;
      if (!item || typeof item !== 'object') continue;
      const q = item as Record<string, unknown>;
      const prompt = String(q['prompt'] || '').trim();
      if (!prompt) continue;
      out.push({
        id: `ctx_${out.length + 1}`,
        field: 'constraints',
        kind: 'open',
        optional: true,
        prompt,
      });
    }

    if (out.length < MIN_CONTEXTUAL) {
      for (const fb of fallbacks) {
        if (out.length >= MIN_CONTEXTUAL) break;
        if (!out.some((q) => q.prompt === fb.prompt)) {
          out.push({ ...fb, id: `ctx_${out.length + 1}` });
        }
      }
    }

    return out;
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
