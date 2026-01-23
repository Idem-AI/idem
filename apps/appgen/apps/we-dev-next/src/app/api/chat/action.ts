import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { streamText as _streamText, convertToCoreMessages, generateObject } from 'ai';

import type { LanguageModel, Message } from 'ai';
import { modelConfig, getDefaultModelKey } from '../model/config';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

export const MAX_TOKENS = 59000;

export type StreamingOptions = Omit<Parameters<typeof _streamText>[0], 'model'>;
let initOptions = {};
export function getOpenAIModel(baseURL: string, apiKey: string, model: string) {
  const provider = modelConfig.find((item) => item.modelKey === model)?.provider;
  if (provider === 'gemini' || provider === 'google') {
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
      maxTokens: provider.indexOf('claude-3-7-sonnet') > -1 ? 128000 : 8192,
    };
    return openai(model);
  }
  if (provider === 'openai') {
    const openai = createOpenAI({
      apiKey,
      baseURL,
    });
    initOptions = {};
    return openai(model);
  }

  const availableProviders = ['gemini', 'google', 'deepseek', 'claude', 'openai'];
  throw new Error(
    `Provider "${provider}" not found for model: ${model}. Available providers: ${availableProviders.join(', ')}. Please check your AI_MODELS_CONFIG.`
  );
}

export type Messages = Message[];

const defaultModel = getOpenAIModel(
  process.env.THIRD_API_URL,
  process.env.THIRD_API_KEY,
  getDefaultModelKey()
) as LanguageModel;

export async function generateObjectFn(messages: Messages) {
  return generateObject({
    model: getOpenAIModel(
      process.env.THIRD_API_URL,
      process.env.THIRD_API_KEY,
      getDefaultModelKey()
    ) as LanguageModel,
    schema: z.object({
      files: z.array(z.string()),
    }),
    messages: convertToCoreMessages(messages),
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
  const newMessages = messages.map((item) => {
    if (item.role === 'assistant') {
      delete item.parts;
    }
    return item;
  });
  return _streamText({
    model: model || defaultModel,
    messages: convertToCoreMessages(newMessages),
    ...initOptions,
    ...options,
  });
}
