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

  const availableProviders = ['gemini', 'google', 'deepseek', 'claude', 'openai'];
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

export function streamTextFn(messages: Messages, options?: StreamingOptions, modelKey?: string) {
  console.log('\n🤖 === STREAM TEXT FUNCTION ===');
  console.log(`Attempting to use model: ${modelKey}`);
  console.log(`Available models: ${modelConfig.map((m) => m.modelKey).join(', ')}`);
  console.log(`Messages count: ${messages.length}`);

  console.log('\n📋 ALL MESSAGES DETAILS:');
  messages.forEach((msg, index) => {
    console.log(`\n  Message ${index + 1}/${messages.length}:`);
    console.log(`    Role: ${msg.role}`);
    console.log(`    Content length: ${msg.content?.length || 0}`);
    console.log(`    Has attachments: ${!!msg.experimental_attachments}`);
    if (msg.content && msg.content.length > 0) {
      console.log(`    Content preview (first 200 chars): ${msg.content.substring(0, 200)}...`);
    } else {
      console.log(`    ⚠️  CONTENT IS EMPTY!`);
    }
  });

  if (messages.length > 0) {
    const lastMessage = messages[messages.length - 1];
    console.log('\n📝 LAST MESSAGE TO AI (DETAILED):');
    console.log(`  Role: ${lastMessage.role}`);
    console.log(`  Content length: ${lastMessage.content?.length || 0}`);

    if (!lastMessage.content || lastMessage.content.trim().length === 0) {
      console.log('\n❌ CRITICAL WARNING: Last message content is EMPTY!');
      console.log('❌ This will cause Gemini to return a generic response!');
    } else {
      console.log('\n✅ Last message content is NOT empty');
      console.log('\n' + '='.repeat(100));
      console.log('===== FINAL PROMPT SENT TO GEMINI =====');
      console.log('='.repeat(100));
      console.log(lastMessage.content);
      console.log('='.repeat(100));
      console.log('===== END FINAL PROMPT =====');
      console.log('='.repeat(100) + '\n');
    }
  }

  const modelConf = modelConfig.find((item) => item.modelKey === modelKey);

  if (!modelConf) {
    console.log('\n❌ ERROR: Model configuration not found!');
    throw new Error(`Model configuration not found for model: ${modelKey}`);
  }

  console.log('\n🔧 MODEL CONFIGURATION:');
  console.log(`  Model key: ${modelKey}`);
  console.log(`  Provider: ${modelConf.provider}`);
  console.log(`  API URL: ${modelConf.apiUrl || process.env.THIRD_API_URL}`);
  console.log(`  Has API Key: ${!!(modelConf.apiKey || process.env.THIRD_API_KEY)}`);

  const { apiKey = process.env.THIRD_API_KEY, apiUrl = process.env.THIRD_API_URL } = modelConf;
  const model = getOpenAIModel(apiUrl || '', apiKey || '', modelKey || '') as LanguageModel;

  let systemInstruction = '';
  const newMessages = messages.map((item, index) => {
    if (item.role === 'assistant') {
      delete item.parts;
    }
    return item;
  });

  if (modelConf.provider === 'gemini' || modelConf.provider === 'google') {
    const lastMessage = newMessages[newMessages.length - 1];
    if (lastMessage && lastMessage.role === 'user' && lastMessage.content) {
      const projectContextIndex = lastMessage.content.indexOf('PROJECT CONTEXT AND REQUIREMENTS:');

      if (projectContextIndex > 0) {
        console.log('\n🔄 SEPARATING SYSTEM PROMPT FROM USER MESSAGE FOR GEMINI');

        systemInstruction = lastMessage.content.substring(0, projectContextIndex).trim();

        const userMessage = lastMessage.content.substring(projectContextIndex).trim();

        console.log('\n📋 SYSTEM INSTRUCTION LENGTH:', systemInstruction.length, 'characters');
        console.log('📋 USER MESSAGE LENGTH:', userMessage.length, 'characters');

        newMessages[newMessages.length - 1] = {
          ...lastMessage,
          content: userMessage,
        };

        console.log('\n' + '='.repeat(100));
        console.log('===== SYSTEM INSTRUCTION (sent to Gemini systemInstruction) =====');
        console.log('='.repeat(100));
        console.log(systemInstruction.substring(0, 1000) + '\n... (truncated for display)');
        console.log('='.repeat(100));
        console.log('\n' + '='.repeat(100));
        console.log('===== USER MESSAGE (sent to Gemini messages) =====');
        console.log('='.repeat(100));
        console.log('\n📏 USER MESSAGE LENGTH:', userMessage.length, 'characters');
        console.log('\n📄 FULL USER MESSAGE (NOT TRUNCATED):');
        console.log(userMessage);
        console.log('\n' + '='.repeat(100));
        console.log('===== END FINAL PROMPT =====');
        console.log('='.repeat(100) + '\n');
      } else {
        console.log('\n⚠️  No PROJECT CONTEXT marker found, sending as-is');
        console.log('\n' + '='.repeat(100));
        console.log('===== FINAL PROMPT SENT TO GEMINI =====');
        console.log('='.repeat(100));
        console.log(lastMessage.content);
        console.log('='.repeat(100));
        console.log('===== END FINAL PROMPT =====');
        console.log('='.repeat(100) + '\n');
      }
    }
  } else {
    const lastMessage = newMessages[newMessages.length - 1];
    if (lastMessage && lastMessage.content) {
      console.log('\n' + '='.repeat(100));
      console.log('===== FINAL PROMPT SENT TO AI =====');
      console.log('='.repeat(100));
      console.log(lastMessage.content);
      console.log('='.repeat(100));
      console.log('===== END FINAL PROMPT =====');
      console.log('='.repeat(100) + '\n');
    }
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

  console.log('\n🚀 CALLING STREAMTEXT:');
  console.log(`  Model: ${modelKey}`);
  console.log(`  Provider: ${modelConf.provider}`);
  console.log(`  Messages after cleanup: ${newMessages.length}`);
  console.log(`  Has system instruction: ${!!systemInstruction}`);
  console.log(`  Has tools: ${!!options?.tools}`);
  console.log(`  Generation config: ${JSON.stringify(generationConfig)}`);
  console.log('🤖 === END STREAM TEXT FUNCTION ===\n');

  const streamConfig: any = {
    model: model || defaultModel,
    messages: convertToCoreMessages(newMessages),
    ...generationConfig,
    ...initOptions,
    ...options,
  };

  if (systemInstruction && (modelConf.provider === 'gemini' || modelConf.provider === 'google')) {
    console.log('✅ Adding systemInstruction to Gemini config');
    streamConfig.system = systemInstruction;
  }

  return streamText(streamConfig);
}
