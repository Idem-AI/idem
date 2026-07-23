import {
  GoogleGenAI,
  createPartFromUri,
  Content,
  File,
  FunctionDeclaration,
  FunctionCallingConfigMode,
  Part,
  GroundingMetadata,
} from '@google/genai';
import dotenv from 'dotenv';
import * as fs from 'fs-extra';
import logger from '../config/logger';
import restrictionsService from './restrictions.service';
import OpenAI from 'openai';
import { userService } from './user.service';
dotenv.config();

import { LLMProvider, LLMOptions, AI_CONFIG } from '../config/ai.config';
import { withGeminiFallback } from '../utils/gemini-fallback';
import { getRequestLanguage } from '../utils/request-language';
import { logAIEvent, previewValue } from '../utils/ai-trace.util';
export { LLMProvider, LLMOptions };


export interface PromptConfig {
  provider: LLMProvider;
  modelName: string;
  llmOptions?: LLMOptions;
  contextFilePaths?: string[];
  file?: {
    localPath: string;
    mimeType?: string;
  };
  userId?: string;
  promptType?: string;
  skipQuotaCheck?: boolean;
  /**
   * User UI language ('en' | 'fr'). When set, a language directive is injected so
   * the model generates content in the requested language. Resolved from the
   * request (query `lang` / body `language` / Accept-Language header) upstream.
   */
  language?: string;
  /**
   * Nom d'un cache de contexte Gemini (caches.create). Quand fourni, le préfixe
   * mis en cache est réutilisé côté serveur — on n'envoie alors QUE la partie
   * variable dans les messages (économie d'input tokens).
   */
  cachedContent?: string;
}

export interface AIChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface PromptRequest {
  provider: LLMProvider;
  modelName: string;
  messages: AIChatMessage[];
  llmOptions?: LLMOptions;
  contextFilePaths?: string[];
  file?: {
    localPath: string;
    mimeType?: string;
  };
  userId?: string;
  promptType?: string;
  skipQuotaCheck?: boolean;
  language?: string;
  cachedContent?: string;
}

export interface AIResponse {
  content: string;
  summary: string;
}

/** Une source brute issue des groundingMetadata Gemini (URL toujours réelle). */
export interface GroundedSourceRaw {
  /** Index dans groundingChunks — sert d'ancre pour les supports. */
  index: number;
  title: string;
  url: string;
  domain?: string;
}

/** Segment de texte appuyé par une ou plusieurs sources (citation inline). */
export interface GroundedSupport {
  text: string;
  sourceIndexes: number[];
}

/** Résultat d'un appel fondé (grounding Google Search). */
export interface GroundedResult {
  /** Texte produit par le modèle, appuyé sur les résultats de recherche. */
  text: string;
  /** Requêtes réellement exécutées par le moteur de recherche. */
  queries: string[];
  /** Sources réelles retournées par le grounding. */
  sources: GroundedSourceRaw[];
  /** Association segments de texte → sources (pour matérialiser les citations). */
  supports: GroundedSupport[];
}

export class PromptService {
  private _genAIClient?: GoogleGenAI;
  private _openaiClient?: OpenAI;

  constructor() {
    logger.info('Initializing PromptService...');
  }

  private get genAIClient(): GoogleGenAI {
    if (!this._genAIClient) {
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        logger.error('GEMINI_API_KEY is not set in environment variables.');
        throw new Error('GEMINI_API_KEY is not set in environment variables.');
      }
      this._genAIClient = new GoogleGenAI({ apiKey: geminiApiKey });
      logger.info('GoogleGenAI client initialized successfully lazily.');
    }
    return this._genAIClient;
  }

  private get openaiClient(): OpenAI | undefined {
    if (!this._openaiClient) {
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (openaiApiKey) {
        this._openaiClient = new OpenAI({ apiKey: openaiApiKey });
        logger.info('OpenAI client initialized successfully lazily.');
      }
    }
    return this._openaiClient;
  }

  private toGeminiMessages(messages: AIChatMessage[]): Content[] {
    return messages.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));
  }

  private async _runGeminiPrompt(
    modelName: string,
    messages: AIChatMessage[],
    llmOptions: LLMOptions,
    fileInput?: { localPath: string; mimeType?: string },
    cachedContent?: string
  ): Promise<string> {
    const geminiContent: Content[] = this.toGeminiMessages(messages);

    if (fileInput && fileInput.localPath) {
      if (geminiContent.length === 0) {
        geminiContent.push({ role: 'user', parts: [] });
      }

      try {
        // Ensure file is not empty before uploading as a potential workaround/diagnostic
        const fileStats = await fs.stat(fileInput.localPath);
        if (fileStats.size === 0) {
          logger.warn(
            `File ${fileInput.localPath} is empty. Writing a placeholder to avoid potential upload issues.`
          );
          await fs.writeFile(fileInput.localPath, '[Initial empty context]', 'utf-8');
        }

        logger.info(
          `Uploading file: ${fileInput.localPath}, MimeType (intended, if SDK infers): ${fileInput.mimeType}`
        );
        // Simplifying files.upload call to match user's example: only 'file' path.
        // The SDK should infer mimeType, or it might be available on the response.
        const uploadedFile: File = await this.genAIClient.files.upload({
          file: fileInput.localPath,
        });

        // We need mimeType for createPartFromUri. Check if it's on the response.
        // If fileInput.mimeType was provided by the user, and SDK doesn't allow setting it during upload,
        // we might prefer the user-provided one if available and SDK's is generic.
        // For now, let's prioritize SDK's detected mimeType if present on uploadedFile.
        const effectiveMimeType = uploadedFile.mimeType || fileInput.mimeType;

        if (!uploadedFile || !uploadedFile.uri || !effectiveMimeType) {
          logger.error(
            'File upload response did not contain expected file details (uri or an effective mimeType).'
          );
          throw new Error(
            'File upload response did not contain expected file details (uri or an effective mimeType).'
          );
        }
        logger.info(
          `File uploaded successfully: URI ${uploadedFile.uri}, MimeType (from SDK): ${uploadedFile.mimeType}`
        );

        const filePart = createPartFromUri(uploadedFile.uri, effectiveMimeType);

        const lastMessageTurn = geminiContent[geminiContent.length - 1];
        if (!lastMessageTurn.parts) {
          lastMessageTurn.parts = [];
        }
        lastMessageTurn.parts.push(filePart);

        // run prompt
        const fallbackModel = AI_CONFIG.fallback.textModel;
        const secondaryFallback = 'gemini-1.5-flash';
        const effectiveFallbackModel = modelName === fallbackModel ? secondaryFallback : fallbackModel;

        const result = await withGeminiFallback(
          () => this.genAIClient.models.generateContent({
            model: modelName,
            contents: geminiContent,
          }),
          () => this.genAIClient.models.generateContent({
            model: effectiveFallbackModel,
            contents: geminiContent,
          }),
          modelName,
          effectiveFallbackModel
        );
        // Safely access the text content
        const firstCandidate = result.candidates?.[0];
        const firstPart = firstCandidate?.content?.parts?.[0];
        const textContent = firstPart?.text;

        if (typeof textContent === 'string') {
          return textContent;
        } else {
          let detailedError = 'Invalid response structure from Gemini API: ';
          if (!result.candidates || result.candidates.length === 0) {
            detailedError += 'No candidates array or empty candidates array.';
          } else if (!firstCandidate) {
            detailedError +=
              'First candidate is undefined (candidates array might be sparse or malformed, or was empty).';
          } else if (!firstCandidate.content) {
            detailedError += "First candidate is missing 'content' property.";
          } else if (!firstCandidate.content.parts || firstCandidate.content.parts.length === 0) {
            detailedError +=
              "First candidate's content is missing 'parts' array or 'parts' array is empty.";
          } else if (!firstPart) {
            detailedError +=
              "First part of first candidate's content is undefined (parts array might be sparse or malformed, or was empty).";
          } else if (typeof firstPart.text !== 'string') {
            detailedError += "First part's 'text' property is missing or not a string.";
          } else {
            detailedError += 'textContent was not a string for an unknown reason after checks.';
          }
          logger.error(
            'Gemini API Error: ' +
              detailedError +
              ' Full response for debugging: ' +
              JSON.stringify(result, null, 2)
          );
          logger.error('Invalid or empty response structure from Gemini API. ' + detailedError);
          throw new Error('Invalid or empty response structure from Gemini API. ' + detailedError);
        }
      } catch (uploadError) {
        logger.error('Error uploading file to Gemini:', uploadError);
        const errorMessage = `Failed to upload file: ${
          fileInput.localPath
        }. Error: ${(uploadError as Error).message || uploadError}`;
        logger.error(errorMessage);
        throw new Error(errorMessage);
      }
    }

    // IMPORTANT: dans @google/genai 1.x, ces paramètres DOIVENT être sous `config`
    // (au top-level ils sont ignorés silencieusement). On y branche aussi le
    // cache de contexte explicite quand il est fourni.
    const config = {
      ...(llmOptions.maxOutputTokens && { maxOutputTokens: llmOptions.maxOutputTokens }),
      ...(llmOptions.temperature !== undefined && { temperature: llmOptions.temperature }),
      ...(llmOptions.topP && { topP: llmOptions.topP }),
      ...(llmOptions.topK && { topK: llmOptions.topK }),
      ...(cachedContent && { cachedContent }),
    };

    const fallbackModel = AI_CONFIG.fallback.textModel;
    const secondaryFallback = 'gemini-1.5-flash';
    const effectiveFallbackModel = modelName === fallbackModel ? secondaryFallback : fallbackModel;

    const result = await withGeminiFallback(
      () => this.genAIClient.models.generateContent({ model: modelName, contents: geminiContent, config }),
      () =>
        this.genAIClient.models.generateContent({
          model: effectiveFallbackModel,
          contents: geminiContent,
          // Le cache est lié au modèle principal: on ne le réutilise pas sur le repli.
          config: { ...config, ...(cachedContent ? { cachedContent: undefined } : {}) },
        }),
      modelName,
      effectiveFallbackModel
    );
    const response = result.text;
    if (!response) {
      logger.error('Failed to generate response from Gemini API.');
      const runPromptErrorMessage = `Failed to run prompt: ${JSON.stringify(result, null, 2)}`;
      logger.error(runPromptErrorMessage);
      throw new Error(runPromptErrorMessage);
    }
    return response;
  }

  private async _runChatGPTPrompt(
    modelName: string,
    messages: AIChatMessage[],
    llmOptions: LLMOptions,
    fileInput?: { localPath: string; mimeType?: string }
  ): Promise<string> {
    const client = this.openaiClient;
    if (!client) {
      const error = new Error(
        'OpenAI client is not initialized. Please set OPENAI_API_KEY environment variable.'
      );
      logger.error(error.message);
      throw error;
    }

    try {
      // Convert our internal message format to OpenAI's format
      const openaiMessages = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const generationParams = {
        ...(llmOptions.maxOutputTokens && {
          max_tokens: llmOptions.maxOutputTokens,
        }),
        ...(llmOptions.temperature !== undefined && {
          temperature: llmOptions.temperature,
        }),
        ...(llmOptions.topP !== undefined && { top_p: llmOptions.topP }),
        // OpenAI doesn't have a topK parameter
      };

      // Handle file uploads if needed
      if (fileInput && fileInput.localPath) {
        logger.info(`Processing file input for ChatGPT: ${fileInput.localPath}`);

        try {
          // Read the file content
          const fileContent = await fs.readFile(fileInput.localPath, 'utf-8');

          // Instead of uploading the file directly, we'll add its contents to the prompt
          // Add context as system message at the beginning
          openaiMessages.unshift({
            role: 'system',
            content: `File content for context: ${fileContent}`,
          });

          logger.info('File content added to ChatGPT prompt');
        } catch (fileError) {
          logger.error(`Error reading file for ChatGPT: ${fileInput.localPath}`, fileError);
          throw new Error(
            `Failed to read file for ChatGPT: ${(fileError as Error).message || fileError}`
          );
        }
      }

      // Create chat completion
      const response = await client.chat.completions.create({
        model: modelName,
        messages: openaiMessages,
        ...generationParams,
      });

      if (!response.choices || response.choices.length === 0) {
        logger.error('ChatGPT API returned no choices');
        throw new Error('ChatGPT API returned no choices');
      }

      const textContent = response.choices[0].message.content;

      if (!textContent) {
        logger.error('ChatGPT API returned empty text content');
        throw new Error('ChatGPT API returned empty text content');
      }

      return textContent;
    } catch (error) {
      const errorMessage = `Error with ChatGPT API: ${(error as Error).message || error}`;
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  private async _runDeepSeekPrompt(
    modelName: string,
    messages: AIChatMessage[],
    llmOptions: LLMOptions,
    fileInput?: { localPath: string; mimeType?: string }
  ): Promise<string> {
    // DeepSeek is accessed through the OpenAI API compatibility layer
    if (!this.openaiClient) {
      const error = new Error(
        'OpenAI client is not initialized. Please set OPENAI_API_KEY environment variable.'
      );
      logger.error(error.message);
      throw error;
    }

    try {
      // Convert our internal message format to OpenAI's format
      const openaiMessages = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const generationParams = {
        ...(llmOptions.maxOutputTokens && {
          max_tokens: llmOptions.maxOutputTokens,
        }),
        ...(llmOptions.temperature !== undefined && {
          temperature: llmOptions.temperature,
        }),
        ...(llmOptions.topP !== undefined && { top_p: llmOptions.topP }),
        // DeepSeek may support additional parameters, but we'll stick to the OpenAI compatibility
      };

      // Handle file uploads if needed
      if (fileInput && fileInput.localPath) {
        logger.info(`Processing file input for DeepSeek: ${fileInput.localPath}`);

        try {
          // Read the file content
          const fileContent = await fs.readFile(fileInput.localPath, 'utf-8');

          // Add file content to the prompt
          openaiMessages.unshift({
            role: 'system',
            content: `File content for context: ${fileContent}`,
          });

          logger.info('File content added to DeepSeek prompt');
        } catch (fileError) {
          logger.error(`Error reading file for DeepSeek: ${fileInput.localPath}`, fileError);
          throw new Error(
            `Failed to read file for DeepSeek: ${(fileError as Error).message || fileError}`
          );
        }
      }

      // Make API call with the DeepSeek base URL if provided, otherwise use the default OpenAI URL
      const deepSeekBaseUrl = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com';
      const customClient = new OpenAI({
        apiKey: process.env.OPENROUTER_API_KEY || '',
        baseURL: deepSeekBaseUrl,
      });

      // Create chat completion
      const response = await customClient.chat.completions.create({
        model: modelName,
        messages: openaiMessages,
        ...generationParams,
      });

      if (!response.choices || response.choices.length === 0) {
        logger.error('DeepSeek API returned no choices');
        throw new Error('DeepSeek API returned no choices');
      }

      const textContent = response.choices[0].message.content;

      if (!textContent) {
        logger.error('DeepSeek API returned empty text content');
        throw new Error('DeepSeek API returned empty text content');
      }

      return textContent;
    } catch (error) {
      const errorMessage = `Error with DeepSeek API: ${(error as Error).message || error}`;
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  /**
   * Build a strong directive that forces the model to answer in the user's language.
   * Returns an empty string when no (or an unknown) language is provided, leaving
   * existing behavior unchanged.
   */
  private buildLanguageDirective(language?: string): string {
    if (!language) {
      return '';
    }
    const normalized = language.toLowerCase();
    const label = normalized.startsWith('fr')
      ? 'French (Français)'
      : normalized.startsWith('en')
        ? 'English'
        : null;
    if (!label) {
      return '';
    }
    return `RESPONSE LANGUAGE (CRITICAL): You MUST write ALL generated content — every section, title, sentence, label and value — in ${label}. Do not mix languages. This instruction overrides any language implied by the examples or prompts below.`;
  }

  public async runPrompt(request: PromptConfig, messages: AIChatMessage[]): Promise<string> {
    logger.info(
      `Running prompt for provider: ${request.provider}, model: ${
        request.modelName
      }, file attached: ${!!request.file}, userId: ${request.userId}`
    );
    const {
      provider,
      modelName,
      llmOptions = {},
      file,
      userId,
      promptType,
      skipQuotaCheck = false,
      language,
    } = request;

    if (!messages || messages.length === 0) {
      logger.error('Messages array cannot be empty.');
      throw new Error('Messages array cannot be empty.');
    }

    // Quota checking for authenticated users (skip for system/internal calls)
    if (userId && !skipQuotaCheck) {
      logger.info(`Checking quota for user: ${userId}`);
      const quotaCheck = await userService.checkQuota(userId);

      if (!quotaCheck.allowed) {
        logger.warn(`Quota exceeded for user ${userId}: ${quotaCheck.message}`);
        throw new Error(quotaCheck.message || 'Quota exceeded');
      }

      logger.info(
        `Quota check passed for user ${userId}. Remaining: daily=${quotaCheck.remainingDaily}, weekly=${quotaCheck.remainingWeekly}`
      );
    }

    // Restrictions validation
    if (promptType) {
      // Validate and adjust prompt parameters
      const paramValidation = restrictionsService.validatePromptParams(promptType, {
        llmOptions,
        ...request,
      });
      if (!paramValidation.allowed) {
        logger.warn(`Prompt parameters not allowed: ${paramValidation.message}`);
        throw new Error(paramValidation.message || 'Parameters not allowed');
      }

      // Apply adjusted parameters if any
      if (paramValidation.adjustedParams) {
        Object.assign(request, paramValidation.adjustedParams);
        logger.info(`Applied parameter adjustments for ${promptType}`);
      }
    }

    // Apply prompt modifications if needed
    let modifiedMessages = messages;
    if (messages.length > 0) {
      modifiedMessages = messages.map((msg) => {
        if (msg.role === 'user' || msg.role === 'system') {
          return {
            ...msg,
            content: restrictionsService.applyPromptModifications(msg.content),
          };
        }
        return msg;
      });
      logger.info('Applied prompt modifications');
    }

    // Force the output language. This is the single choke point for every AI
    // feature/provider, so one directive here guarantees generated content is in
    // the user's language (prevents wrong-language output). An explicit
    // config.language wins; otherwise fall back to the request-scoped language.
    const effectiveLanguage = language ?? getRequestLanguage();
    const languageDirective = this.buildLanguageDirective(effectiveLanguage);
    if (languageDirective && modifiedMessages.length > 0) {
      // Append to the LAST message rather than inserting a new system message:
      // this keeps message roles/adjacency intact (Gemini rejects consecutive
      // same-role turns) and benefits from recency for stronger adherence.
      const lastIdx = modifiedMessages.length - 1;
      const last = modifiedMessages[lastIdx];
      modifiedMessages = [
        ...modifiedMessages.slice(0, lastIdx),
        { ...last, content: `${last.content}\n\n${languageDirective}` },
      ];
      logger.info(`Injected language directive (language=${effectiveLanguage}).`);
    }

    try {
      let result: string;
      switch (provider) {
        case LLMProvider.GEMINI:
          result = await this._runGeminiPrompt(
            modelName,
            modifiedMessages,
            llmOptions,
            file,
            request.cachedContent
          );
          break;
        case LLMProvider.CHATGPT:
          result = await this._runChatGPTPrompt(modelName, modifiedMessages, llmOptions, file);
          break;
        case LLMProvider.DEEPSEEK:
          result = await this._runDeepSeekPrompt(modelName, modifiedMessages, llmOptions, file);
          break;
        default:
          const unsupportedProviderError = new Error(`Unsupported LLM provider: ${provider}`);
          logger.error(
            `Unsupported LLM provider encountered in runPrompt: ${unsupportedProviderError.message}`,
            { provider, stack: unsupportedProviderError.stack }
          );
          throw unsupportedProviderError;
      }

      // Increment quota after successful API call
      if (userId && !skipQuotaCheck) {
        try {
          await userService.incrementUsage(userId, 1);
          logger.info(`Incremented quota usage for user ${userId}`);
        } catch (quotaError) {
          logger.error(`Failed to increment quota for user ${userId}:`, quotaError);
          // Don't throw here as the API call was successful
        }
      }

      return result;
    } catch (error: any) {
      logger.error(
        `Error in runPrompt for provider ${provider}, model ${modelName}: ${error.message}`,
        { stack: error.stack, details: error }
      );
      throw error;
    }
  }

  /**
   * Boucle agentique avec function calling Gemini: le modèle peut appeler des
   * outils (Context Engine, historique de versions…) et recevoir leurs
   * résultats sur plusieurs tours, jusqu'à produire sa réponse finale.
   *
   * Passe par les mêmes garde-fous que runPrompt (quota, langue) — un seul
   * incrément de quota par appel, quel que soit le nombre de tours d'outils.
   */
  public async runPromptWithTools(
    request: PromptConfig,
    messages: AIChatMessage[],
    tools: FunctionDeclaration[],
    executeTool: (name: string, args: Record<string, unknown>) => Promise<unknown>,
    options: { maxToolTurns?: number } = {}
  ): Promise<string> {
    const { provider, modelName, llmOptions = {}, userId, skipQuotaCheck = false, language } = request;

    if (provider !== LLMProvider.GEMINI) {
      throw new Error(`runPromptWithTools ne supporte que Gemini (reçu: ${provider}).`);
    }
    if (!messages || messages.length === 0) {
      throw new Error('Messages array cannot be empty.');
    }

    if (userId && !skipQuotaCheck) {
      const quotaCheck = await userService.checkQuota(userId);
      if (!quotaCheck.allowed) {
        logger.warn(`Quota exceeded for user ${userId}: ${quotaCheck.message}`);
        throw new Error(quotaCheck.message || 'Quota exceeded');
      }
    }

    // Directive de langue: même choke point que runPrompt.
    const effectiveLanguage = language ?? getRequestLanguage();
    const languageDirective = this.buildLanguageDirective(effectiveLanguage);

    const systemParts = messages.filter((m) => m.role === 'system').map((m) => m.content);
    if (languageDirective) {
      systemParts.push(languageDirective);
    }
    const conversation = messages.filter((m) => m.role !== 'system');

    const contents: Content[] = conversation.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    const generationParams = {
      ...(llmOptions.maxOutputTokens && { maxOutputTokens: llmOptions.maxOutputTokens }),
      ...(llmOptions.temperature && { temperature: llmOptions.temperature }),
      ...(llmOptions.topP && { topP: llmOptions.topP }),
      ...(llmOptions.topK && { topK: llmOptions.topK }),
    };

    const config = {
      ...generationParams,
      ...(systemParts.length > 0 && { systemInstruction: systemParts.join('\n\n') }),
      tools: [{ functionDeclarations: tools }],
      toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
    };

    const fallbackModel = AI_CONFIG.fallback.textModel;
    const effectiveFallbackModel = modelName === fallbackModel ? 'gemini-1.5-flash' : fallbackModel;
    const maxToolTurns = options.maxToolTurns ?? 8;

    const loopStartedAt = Date.now();
    logAIEvent('ai.agentic_loop_start', {
      modelName,
      promptType: request.promptType,
      toolCount: tools.length,
      maxToolTurns,
    });

    let finalText = '';
    let turnsUsed = 0;
    for (let turn = 0; turn <= maxToolTurns; turn++) {
      turnsUsed = turn + 1;
      const result = await withGeminiFallback(
        () => this.genAIClient.models.generateContent({ model: modelName, contents, config }),
        () =>
          this.genAIClient.models.generateContent({
            model: effectiveFallbackModel,
            contents,
            config,
          }),
        modelName,
        effectiveFallbackModel
      );

      const functionCalls = result.functionCalls ?? [];
      if (functionCalls.length === 0) {
        finalText = result.text ?? '';
        logAIEvent('ai.agentic_turn', {
          turn: turn + 1,
          decision: 'final_answer',
          finalTextLength: finalText.length,
        });
        break;
      }

      const modelContent = result.candidates?.[0]?.content;
      if (modelContent) {
        contents.push(modelContent);
      }

      logAIEvent('ai.agentic_turn', {
        turn: turn + 1,
        decision: 'tool_calls',
        tools: functionCalls.map((c) => ({ name: c.name, args: previewValue(c.args) })),
      });
      logger.info(
        `runPromptWithTools turn=${turn + 1} tools=[${functionCalls.map((c) => c.name).join(', ')}]`
      );

      const responseParts: Part[] = [];
      for (const call of functionCalls) {
        const toolName = call.name ?? '';
        let output: unknown;
        try {
          output = await executeTool(toolName, (call.args ?? {}) as Record<string, unknown>);
        } catch (error: any) {
          output = { error: error.message || String(error) };
        }
        responseParts.push({
          functionResponse: { name: toolName, response: { result: output ?? null } },
        });
      }
      contents.push({ role: 'user', parts: responseParts });

      if (turn === maxToolTurns) {
        logger.warn('runPromptWithTools: max tool turns reached, forcing final answer');
        logAIEvent('ai.agentic_turn', { turn: turn + 1, decision: 'max_turns_forced' });
        const finalResult = await this.genAIClient.models.generateContent({
          model: modelName,
          contents,
          config: { ...config, toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.NONE } } },
        });
        finalText = finalResult.text ?? '';
      }
    }

    logAIEvent('ai.agentic_loop_end', {
      modelName,
      turnsUsed,
      finalTextLength: finalText.length,
      durationMs: Date.now() - loopStartedAt,
    });

    if (userId && !skipQuotaCheck) {
      try {
        await userService.incrementUsage(userId, 1);
      } catch (quotaError) {
        logger.error(`Failed to increment quota for user ${userId}:`, quotaError);
      }
    }

    return finalText;
  }

  /**
   * Appel FONDÉ (grounded) via le Google Search de Gemini: le modèle interroge
   * le web et renvoie une réponse appuyée sur de vraies sources. On extrait des
   * `groundingMetadata` les URLs réelles, les requêtes exécutées et la carte
   * segments→sources. C'est le socle anti-invention: aucune donnée n'est acceptée
   * si elle ne provient pas de ces résultats.
   *
   * Note: l'outil googleSearch est incompatible avec le function-calling dans un
   * même appel — cette méthode ne fait donc PAS d'outils applicatifs. La phase de
   * rédaction/vérification se fait via runPrompt à partir des sources collectées.
   */
  public async runGroundedResearch(
    request: PromptConfig,
    messages: AIChatMessage[]
  ): Promise<GroundedResult> {
    const { modelName, llmOptions = {}, userId, skipQuotaCheck = false, language } = request;

    if (!messages || messages.length === 0) {
      throw new Error('Messages array cannot be empty.');
    }

    if (userId && !skipQuotaCheck) {
      const quotaCheck = await userService.checkQuota(userId);
      if (!quotaCheck.allowed) {
        logger.warn(`Quota exceeded for user ${userId}: ${quotaCheck.message}`);
        throw new Error(quotaCheck.message || 'Quota exceeded');
      }
    }

    const effectiveLanguage = language ?? getRequestLanguage();
    const languageDirective = this.buildLanguageDirective(effectiveLanguage);

    const systemParts = messages.filter((m) => m.role === 'system').map((m) => m.content);
    if (languageDirective) {
      systemParts.push(languageDirective);
    }
    const conversation = messages.filter((m) => m.role !== 'system');
    const contents: Content[] = conversation.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    const generationParams = {
      ...(llmOptions.maxOutputTokens && { maxOutputTokens: llmOptions.maxOutputTokens }),
      ...(llmOptions.temperature !== undefined && { temperature: llmOptions.temperature }),
      ...(llmOptions.topP && { topP: llmOptions.topP }),
    };

    const config = {
      ...generationParams,
      ...(systemParts.length > 0 && { systemInstruction: systemParts.join('\n\n') }),
      // Grounding natif Google Search — renvoie de vraies sources.
      tools: [{ googleSearch: {} }],
    };

    // Le modèle de repli doit lui aussi supporter googleSearch (gemini-2.5-flash).
    const fallbackModel = AI_CONFIG.fallback.textModel;
    const effectiveFallbackModel = modelName === fallbackModel ? modelName : fallbackModel;

    const startedAt = Date.now();
    logAIEvent('ai.grounded_research_start', {
      modelName,
      promptType: request.promptType,
    });

    const result = await withGeminiFallback(
      () => this.genAIClient.models.generateContent({ model: modelName, contents, config }),
      () =>
        this.genAIClient.models.generateContent({
          model: effectiveFallbackModel,
          contents,
          config,
        }),
      modelName,
      effectiveFallbackModel
    );

    const candidate = result.candidates?.[0];
    const text = result.text ?? candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    const grounding: GroundingMetadata | undefined = candidate?.groundingMetadata;
    const parsed = this.extractGrounding(grounding);

    logAIEvent('ai.grounded_research_end', {
      modelName,
      durationMs: Date.now() - startedAt,
      textLength: text.length,
      sourceCount: parsed.sources.length,
      queryCount: parsed.queries.length,
    });

    if (userId && !skipQuotaCheck) {
      try {
        await userService.incrementUsage(userId, 1);
      } catch (quotaError) {
        logger.error(`Failed to increment quota for user ${userId}:`, quotaError);
      }
    }

    return { text, ...parsed };
  }

  /**
   * Crée un cache de contexte Gemini (contenu partagé réutilisé sur plusieurs
   * appels). Best-effort: renvoie null si le caching échoue (contenu trop court,
   * modèle non supporté…), auquel cas l'appelant retombe sur l'envoi inline.
   */
  public async createContextCache(
    modelName: string,
    contextText: string,
    ttlSeconds = 7200
  ): Promise<string | null> {
    try {
      const cache = await this.genAIClient.caches.create({
        model: modelName,
        config: {
          contents: [{ role: 'user', parts: [{ text: contextText }] }],
          ttl: `${ttlSeconds}s`,
          displayName: 'idem-shared-context',
        },
      });
      logAIEvent('ai.context_cache_created', {
        modelName,
        cacheName: cache.name,
        contextChars: contextText.length,
      });
      return cache.name ?? null;
    } catch (error: any) {
      // Cause fréquente: contexte sous le minimum de tokens du modèle → on ignore.
      logger.warn(`Context cache disabled (create failed): ${error.message || error}`);
      return null;
    }
  }

  /** Supprime un cache de contexte (best-effort, en fin de run). */
  public async deleteContextCache(name: string): Promise<void> {
    try {
      await this.genAIClient.caches.delete({ name });
    } catch (error: any) {
      logger.warn(`Context cache delete failed: ${error.message || error}`);
    }
  }

  /**
   * Variante streaming de runPrompt (Gemini uniquement): diffuse le texte au fil
   * de l'eau via `onDelta(textCumulé)` et renvoie le texte complet. Améliore la
   * latence PERÇUE (le contenu s'affiche pendant la génération). Applique les
   * mêmes garde-fous que runPrompt (quota, directive de langue, config sous
   * `config`, cache de contexte).
   */
  public async runPromptStream(
    request: PromptConfig,
    messages: AIChatMessage[],
    onDelta: (cumulativeText: string) => void
  ): Promise<string> {
    const {
      provider,
      modelName,
      llmOptions = {},
      userId,
      skipQuotaCheck = false,
      language,
      cachedContent,
    } = request;

    if (provider !== LLMProvider.GEMINI) {
      // Repli simple: pas de streaming pour les autres fournisseurs.
      const text = await this.runPrompt(request, messages);
      onDelta(text);
      return text;
    }
    if (!messages || messages.length === 0) {
      throw new Error('Messages array cannot be empty.');
    }

    if (userId && !skipQuotaCheck) {
      const quotaCheck = await userService.checkQuota(userId);
      if (!quotaCheck.allowed) {
        throw new Error(quotaCheck.message || 'Quota exceeded');
      }
    }

    const effectiveLanguage = language ?? getRequestLanguage();
    const languageDirective = this.buildLanguageDirective(effectiveLanguage);

    const systemParts = messages.filter((m) => m.role === 'system').map((m) => m.content);
    if (languageDirective) systemParts.push(languageDirective);
    const conversation = messages.filter((m) => m.role !== 'system');
    const contents: Content[] = conversation.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    const config = {
      ...(llmOptions.maxOutputTokens && { maxOutputTokens: llmOptions.maxOutputTokens }),
      ...(llmOptions.temperature !== undefined && { temperature: llmOptions.temperature }),
      ...(llmOptions.topP && { topP: llmOptions.topP }),
      ...(systemParts.length > 0 && { systemInstruction: systemParts.join('\n\n') }),
      ...(cachedContent && { cachedContent }),
    };

    let full = '';
    try {
      const stream = await this.genAIClient.models.generateContentStream({
        model: modelName,
        contents,
        config,
      });
      for await (const chunk of stream) {
        const delta = chunk.text ?? '';
        if (delta) {
          full += delta;
          onDelta(full);
        }
      }
    } catch (error: any) {
      logger.warn(`runPromptStream failed, falling back to non-streaming: ${error.message}`);
      full = await this.runPrompt(request, messages);
      onDelta(full);
    }

    if (userId && !skipQuotaCheck) {
      try {
        await userService.incrementUsage(userId, 1);
      } catch (quotaError) {
        logger.error(`Failed to increment quota for user ${userId}:`, quotaError);
      }
    }

    return full;
  }

  /** Extrait sources réelles, requêtes et supports depuis les groundingMetadata. */
  private extractGrounding(grounding?: GroundingMetadata): Omit<GroundedResult, 'text'> {
    const queries: string[] = Array.isArray(grounding?.webSearchQueries)
      ? grounding!.webSearchQueries.filter((q): q is string => typeof q === 'string' && q.length > 0)
      : [];

    const sources: GroundedSourceRaw[] = [];
    const chunks = grounding?.groundingChunks ?? [];
    chunks.forEach((chunk, index) => {
      const web = chunk.web;
      if (web?.uri) {
        let domain = web.domain;
        if (!domain) {
          try {
            domain = new URL(web.uri).hostname.replace(/^www\./, '');
          } catch {
            domain = undefined;
          }
        }
        sources.push({
          index,
          title: web.title?.trim() || domain || web.uri,
          url: web.uri,
          domain,
        });
      }
    });

    const supports: GroundedSupport[] = (grounding?.groundingSupports ?? [])
      .map((s) => ({
        text: s.segment?.text?.trim() || '',
        sourceIndexes: (s.groundingChunkIndices ?? []).filter((i): i is number =>
          typeof i === 'number'
        ),
      }))
      .filter((s) => s.text.length > 0 && s.sourceIndexes.length > 0);

    return { queries, sources, supports };
  }

  public getCleanAIText(response: any): string {
    logger.debug('Attempting to clean AI text response.');
    if (typeof response === 'string') {
      return this.stripModelFormatting(response);
    }

    if (response && typeof response.text === 'function') {
      try {
        return this.stripModelFormatting(response.text());
      } catch (e: any) {
        logger.warn(
          `Failed to extract text using response.text(). Trying older structure. Error: ${e.message}`,
          { stack: e.stack, responseDetails: typeof response }
        );
      }
    }

    const raw = response?.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return this.stripModelFormatting(raw);
  }

  /**
   * Retire les artefacts de formatage laissés par les modèles :
   *  - clôtures de bloc de code ouvrantes (```lang) et fermantes ;
   *  - préfixe de langage nu en tête ("html" / "markdown"), qui sinon s'affiche
   *    en texte brut au-dessus des sections (y compris dans le PDF).
   * Sans effet sur du JSON (qui commence par { ou [).
   */
  private stripModelFormatting(text: string): string {
    if (typeof text !== 'string') return text;
    return text
      .replace(/^```[a-zA-Z]*\s*/, '')
      .replace(/```\s*$/g, '')
      .replace(/^(?:html|markdown)\b[ \t]*\r?\n?/i, '')
      .trim();
  }
}

export const promptService = new PromptService();
