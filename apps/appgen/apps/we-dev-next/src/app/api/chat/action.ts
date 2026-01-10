import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { streamText as _streamText, generateObject } from 'ai';

import type { LanguageModel, ModelMessage } from 'ai';
import { modelConfig } from '../model/config';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

export const MAX_TOKENS = 8000;

export type StreamingOptions = Omit<Parameters<typeof _streamText>[0], 'model'>;
let initOptions = {};
export function getOpenAIModel(baseURL: string, apiKey: string, model: string) {
  const provider = modelConfig.find((item) => item.modelKey === model)?.provider;

  // Default to gemini if provider not found
  if (!provider) {
    console.warn(`Provider not found for model: ${model}, defaulting to gemini`);
    const gemini = createGoogleGenerativeAI({
      apiKey,
      baseURL,
    });
    initOptions = {};
    return gemini(model);
  }

  if (provider === 'gemini') {
    const gemini = createGoogleGenerativeAI({
      apiKey,
      baseURL,
    });
    initOptions = {};
    return gemini(model);
  }
  if (provider === 'deepseek') {
    const deepseek = createDeepSeek({
      apiKey,
      baseURL,
    });
    initOptions = {};
    return deepseek(model);
  }
  if (provider.indexOf('claude') > -1) {
    const openai = createOpenAI({
      apiKey,
      baseURL,
    });
    initOptions = {
      maxTokens: provider.indexOf('claude-3-7-sonnet') > -1 ? 8000 : 4000,
    };
    return openai(model);
  }

  throw new Error(`Provider not found for model: ${model}`);
}

export type Messages = ModelMessage[];

const defaultModel = getOpenAIModel(
  process.env.THIRD_API_URL,
  process.env.THIRD_API_KEY,
  'gemini-3-flash-preview'
) as LanguageModel;

export async function generateObjectFn(messages: Messages) {
  return generateObject({
    model: getOpenAIModel(
      process.env.THIRD_API_URL,
      process.env.THIRD_API_KEY,
      'gemini-3-flash-preview'
    ) as LanguageModel,
    schema: z.object({
      files: z.array(z.string()),
    }),
    messages: messages,
  });
}

export function streamTextFn(messages: Messages, options?: StreamingOptions, modelKey?: string) {
  console.log(`Attempting to use model: ${modelKey}`);
  console.log(`Available models: ${modelConfig.map((m) => m.modelKey).join(', ')}`);

  const modelConf = modelConfig.find((item) => item.modelKey === modelKey);

  if (!modelConf) {
    throw new Error(`Model configuration not found for model: ${modelKey}`);
  }

  const { apiKey = process.env.THIRD_API_KEY, apiUrl = process.env.THIRD_API_URL } = modelConf;
  const model = getOpenAIModel(apiUrl, apiKey, modelKey) as LanguageModel;
  return _streamText({
    model: model || defaultModel,
    messages: messages,
    ...initOptions,
    ...(options && Object.fromEntries(
      Object.entries(options).filter(([key]) => key !== 'prompt')
    )),
  });
}
