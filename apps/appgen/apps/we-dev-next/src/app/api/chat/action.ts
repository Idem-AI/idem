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
  console.log(`[StreamTextFn] Attempting to use model: ${modelKey}`);
  console.log(`[StreamTextFn] Available models: ${modelConfig.map((m) => m.modelKey).join(', ')}`);
  console.log(`[StreamTextFn] Model config loaded: ${JSON.stringify(modelConfig, null, 2)}`);

  const modelConf = modelConfig.find((item) => item.modelKey === modelKey);

  if (!modelConf) {
    console.error(`[StreamTextFn] Model configuration not found for model: ${modelKey}`);
    console.error(`[StreamTextFn] Available model keys: ${modelConfig.map((m) => m.modelKey)}`);
    throw new Error(
      `Model configuration not found for model: ${modelKey}. Available models: ${modelConfig.map((m) => m.modelKey).join(', ')}`
    );
  }

  console.log(`[StreamTextFn] Found model config:`, modelConf);

  const { apiKey = process.env.THIRD_API_KEY, apiUrl = process.env.THIRD_API_URL } = modelConf;

  console.log(`[StreamTextFn] Using API URL: ${apiUrl}`);
  console.log(`[StreamTextFn] API Key present: ${!!apiKey}`);

  try {
    const model = getOpenAIModel(apiUrl, apiKey, modelKey) as LanguageModel;
    console.log(`[StreamTextFn] Model created successfully for provider: ${modelConf.provider}`);

    const newMessages = messages.map((item) => {
      if (item.role === 'assistant') {
        delete item.parts;
      }
      return item;
    });

    console.log(`[StreamTextFn] Processing ${newMessages.length} messages`);
    console.log(`[StreamTextFn] Message types: ${newMessages.map((m) => m.role).join(', ')}`);

    return _streamText({
      model: model || defaultModel,
      messages: convertToCoreMessages(newMessages),
      ...initOptions,
      ...options,
    });
  } catch (error) {
    console.error(`[StreamTextFn] Error creating model or streaming:`, error);
    throw error;
  }
}
