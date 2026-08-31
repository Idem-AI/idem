import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { streamText, generateObject, LanguageModel, convertToCoreMessages } from 'ai';
import { z } from 'zod';
import { modelConfig, getDefaultModelKey } from '../config/modelConfig.js';
import { Messages, ToolInfo } from '../types/project.js';

let initOptions = {};

export function getOpenAIModel(baseURL: string, apiKey: string, model: string): LanguageModel {
  const provider = modelConfig.find((item) => item.modelKey === model)?.provider;

  if (provider === 'gemini' || provider === 'google') {
    const gemini = createGoogleGenerativeAI({
      apiKey,
      baseURL,
    });
    initOptions = {};
    return gemini(model) as LanguageModel;
  }

  if (provider === 'deepseek') {
    const deepseek = createDeepSeek({
      apiKey,
      baseURL,
    });
    initOptions = {};
    return deepseek(model) as LanguageModel;
  }

  if (provider && provider.indexOf('claude') > -1) {
    const openai = createOpenAI({
      apiKey,
      baseURL,
    });
    initOptions = {
      maxTokens: provider.indexOf('claude-3-7-sonnet') > -1 ? 128000 : 8192,
    };
    return openai(model) as LanguageModel;
  }

  if (provider === 'openai') {
    const openai = createOpenAI({
      apiKey,
      baseURL,
    });
    initOptions = {};
    return openai(model) as LanguageModel;
  }

  // GLM (Z.ai) — endpoint OpenAI-compatible, donc le même client. Le
  // raisonnement est coupé : il se décompte du budget de sortie, et sur une
  // génération de code longue il le mangerait avant le code lui-même.
  if (provider === 'glm') {
    const glm = createOpenAI({
      apiKey,
      baseURL,
    });
    initOptions = { providerOptions: { openai: { thinking: { type: 'disabled' } } } };
    return glm(model) as LanguageModel;
  }

  const availableProviders = ['gemini', 'google', 'deepseek', 'claude', 'openai', 'glm'];
  throw new Error(
    `Provider "${provider}" not found for model: ${model}. Available providers: ${availableProviders.join(', ')}. Please check your AI_MODELS_CONFIG.`
  );
}

const defaultModel = getOpenAIModel(
  process.env.THIRD_API_URL || '',
  process.env.THIRD_API_KEY || '',
  getDefaultModelKey()
) as LanguageModel;

export async function generateObjectFn(messages: Messages) {
  return generateObject({
    model: getOpenAIModel(
      process.env.THIRD_API_URL || '',
      process.env.THIRD_API_KEY || '',
      getDefaultModelKey()
    ) as LanguageModel,
    schema: z.object({
      files: z.array(z.string()),
    }),
    messages: convertToCoreMessages(messages),
  });
}

export interface StreamingOptions {
  tools?: Record<string, any>;
  toolCallStreaming?: boolean;
  onError?: (error: any) => void;
  onFinish?: (response: any) => Promise<void>;
}

/**
 * Verbose prompt dumps are useful while debugging and enormous in production
 * (a full builder prompt is tens of kilobytes per request). Opt in explicitly.
 */
const DEBUG_PROMPTS = process.env.DEBUG_PROMPTS === 'true';

export function streamTextFn(messages: Messages, options?: StreamingOptions, modelKey?: string) {
  const modelConf = modelConfig.find((item) => item.modelKey === modelKey);

  if (!modelConf) {
    throw new Error(`Model configuration not found for model: ${modelKey}`);
  }

  const { apiKey = process.env.THIRD_API_KEY, apiUrl = process.env.THIRD_API_URL } = modelConf;
  const model = getOpenAIModel(apiUrl || '', apiKey || '', modelKey || '') as LanguageModel;

  // Every provider takes the system prompt out of band, so pull `system` roles
  // out of the message list rather than leaving them in the conversation. The
  // system text is also the cacheable prefix: keeping it in one place, in a
  // stable order, is what makes implicit caching hit.
  const systemInstruction = messages
    .filter((item) => item.role === 'system')
    .map((item) => item.content)
    .join('\n\n')
    .trim();

  const newMessages = messages
    .filter((item) => item.role !== 'system')
    .map((item) => {
      if (item.role === 'assistant') {
        delete item.parts;
      }
      return item;
    });

  const lastMessage = newMessages[newMessages.length - 1];

  if (!lastMessage?.content?.trim()) {
    console.warn('[ai] last message is empty — the model will answer generically');
  }

  console.log(
    `[ai] ${modelKey} (${modelConf.provider}) · ${newMessages.length} messages · system ${systemInstruction.length} chars · last message ${lastMessage?.content?.length ?? 0} chars`
  );

  if (DEBUG_PROMPTS) {
    console.log('----- SYSTEM -----\n' + systemInstruction);
    console.log('----- LAST MESSAGE -----\n' + (lastMessage?.content ?? ''));
  }

  // Ajouter les paramètres de génération depuis modelConfig
  const generationConfig: any = {};
  if (modelConf.temperature !== undefined) {
    generationConfig.temperature = modelConf.temperature;
  }
  if (modelConf.topP !== undefined) {
    generationConfig.topP = modelConf.topP;
  }
  if (modelConf.maxOutputTokens !== undefined) {
    generationConfig.maxTokens = modelConf.maxOutputTokens;
  }

  // Retrying the same saturated model rarely helps within a few seconds, while
  // switching model does (see createResilientStream). Keep one quick retry for
  // one-off blips and let the fallback chain handle real outages.
  const maxRetries = Number(process.env.AI_MAX_RETRIES ?? 1);

  const streamConfig: any = {
    model: model || defaultModel,
    messages: convertToCoreMessages(newMessages),
    maxRetries: Number.isFinite(maxRetries) ? maxRetries : 1,
    ...generationConfig,
    ...initOptions,
    ...options,
  };

  // Every provider we target accepts a top-level `system`; the SDK maps it to
  // Gemini's `systemInstruction` and to an OpenAI system message.
  if (systemInstruction) {
    streamConfig.system = systemInstruction;
  }

  return streamText(streamConfig);
}
