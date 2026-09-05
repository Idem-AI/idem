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
import axios from 'axios';
import OpenAI from 'openai';
import { userService } from './user.service';
dotenv.config();

import {
  LLMProvider,
  LLMOptions,
  AI_CONFIG,
  GLM_MODELS,
  MAX_TEMPERATURE_FOR_THINKING,
  MIN_TOKENS_FOR_THINKING,
  TEXT_FALLBACK_MODELS,
  reconcileThinkingBudget,
} from '../config/ai.config';
import {
  GLM_ENDPOINTS,
  buildGeminiThinkingConfig,
  canSuppressThinking,
  getGlmApiKey,
  getProvider,
  providerSupports,
  resolveGlobalOverride,
} from '../config/ai-providers.config';
import { applyAiOverride } from '../config/ai-overrides.config';
import { describeGeminiBackend, getGoogleGenAIClient } from '../config/google-genai.client';
import { withGeminiFallback } from '../utils/gemini-fallback';
import { describeError, isTransientNetworkError, sleep, withRetry } from '../utils/retry';
import { getRequestLanguage } from '../utils/request-language';
import { logAIEvent, previewValue } from '../utils/ai-trace.util';
import {
  UsageSink,
  estimateUsage,
  extractGeminiUsage,
  extractOpenAIUsage,
  joinMessagesForEstimate,
} from '../utils/ai-usage-extract.util';
import { aiUsageService } from './ai-usage.service';
export { LLMProvider, LLMOptions };

/**
 * Pause entre deux modèles de la chaîne de repli, quand l'échec précédent était
 * une panne réseau. Basculer de modèle ne répare pas une connexion absente: il
 * faut aussi laisser passer quelques instants.
 */
const INTER_MODEL_DELAY_MS = 1000;

/**
 * Résout le couple (fournisseur, modèle) réellement appelé.
 *
 * Trois niveaux, du plus général au plus précis, et le plus précis l'emporte :
 *   1. ce que la feature déclare      (`ai.config.ts`)
 *   2. `AI_DEFAULT_PROVIDER`          — bascule globale, traduite par RÔLE
 *   3. `AI_OVERRIDES`                 — surcharge ciblée, par `promptType`
 *
 * Regroupé ici pour que les quatre points d'entrée du service (prompt, outils,
 * flux, recherche fondée) appliquent exactement la même règle. Une divergence
 * entre eux se manifesterait par une génération qui part sur un fournisseur
 * différent des autres, sans que rien ne le dise.
 */
function resolveRouting<T extends PromptConfig>(request: T): T {
  const switched = resolveGlobalOverride(request);
  const { config, applied } = applyAiOverride(switched, request.promptType);

  if (applied) {
    logger.info(`Aiguillage: surcharge "${applied}" (promptType=${request.promptType ?? '—'})`);
  } else if (switched.provider !== request.provider || switched.modelName !== request.modelName) {
    logger.info(
      `Aiguillage: bascule globale ${request.provider}/${request.modelName} → ` +
        `${switched.provider}/${switched.modelName}`
    );
  }

  return config as T;
}

/**
 * Le mode JSON doit-il être demandé au fournisseur pour cet appel ?
 *
 * Deux garde-fous, tous deux nécessaires :
 *
 *  - `LLM_JSON_MODE=off` coupe la fonctionnalité entière sans redéploiement.
 *    Le contrat `response_format` est standard côté OpenAI mais son support
 *    varie d'un modèle à l'autre chez les passerelles compatibles ; un
 *    interrupteur évite d'avoir à repasser sur quarante configurations si un
 *    modèle le refuse.
 *
 *  - le mot « json » doit apparaître dans le prompt. C'est une exigence de
 *    l'API OpenAI (« messages must contain the word 'json' »), reprise par la
 *    plupart des implémentations compatibles : sans elle, la requête est
 *    rejetée. Comme tous nos prompts JSON le mentionnent déjà, la condition est
 *    silencieuse en pratique — mais elle empêche une feature mal étiquetée de
 *    faire échouer sa génération.
 */
function jsonModeFor(
  llmOptions: LLMOptions,
  messages: { content?: unknown }[]
): boolean {
  if (!llmOptions.jsonMode) return false;
  if ((process.env.LLM_JSON_MODE ?? '').toLowerCase() === 'off') return false;
  return messages.some(
    (message) => typeof message.content === 'string' && /json/i.test(message.content)
  );
}

/**
 * Incrémente le quota SANS bloquer la réponse.
 *
 * C'est un compteur, pas une transaction: l'appel modèle a déjà réussi et son
 * résultat est prêt à partir. L'attendre ajoutait une écriture base au chemin
 * critique de chaque génération — sept fois dans ce fichier — pour une valeur
 * que personne ne relit dans la milliseconde. L'échec reste journalisé.
 */
function incrementUsageInBackground(userId: string): void {
  void userService
    .incrementUsage(userId, 1)
    .catch((quotaError) =>
      logger.error(`Failed to increment quota for user ${userId}:`, quotaError)
    );
}

/**
 * Choisit un modèle de repli valide et différent du primaire.
 *
 * Le second repli était historiquement `gemini-2.0-flash` en dur — un modèle
 * que Vertex ne sert plus (404 « Publisher model ... was not found »). Dès que
 * le primaire valait `AI_CONFIG.fallback.textModel`, tout échec basculait donc
 * sur un modèle inexistant: le repli était perdant par construction.
 *
 * Le repli vient désormais du FOURNISSEUR appelé, pas d'une constante globale:
 * cette fonction ne sert que la branche Gemini, et lui proposer la chaîne
 * `TEXT_FALLBACK_MODELS` (devenue 100 % GLM) reproduisait exactement le défaut
 * qu'elle prétendait corriger — un nom de modèle que le backend ne sert pas.
 */
function pickFallbackModel(
  provider: LLMProvider,
  modelName: string,
  fallbackModels?: string[]
): string {
  const providerDefaults = getProvider(provider).defaultFallbackModels ?? [];
  const chain = [...(fallbackModels ?? []), ...providerDefaults];
  return chain.find((candidate) => candidate && candidate !== modelName) ?? modelName;
}

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
  fallbackModels?: string[];
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
  /** Exempte cet appel du plafond global MAX_OUTPUT_TOKENS. */
  bypassOutputTokenCap?: boolean;
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
  fallbackModels?: string[];
  language?: string;
  cachedContent?: string;
  /** Exempte cet appel du plafond global MAX_OUTPUT_TOKENS. */
  bypassOutputTokenCap?: boolean;
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

/** Un résultat brut de l'endpoint `/web_search` de Z.ai. */
interface GlmSearchResult {
  title: string;
  link: string;
  content: string;
  media?: string;
  publish_date?: string;
}

/** Résultat d'un appel fondé (recherche web du fournisseur). */
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
  /** Clients OpenAI-compatible mis en cache par fournisseur (GLM, OpenAI, DeepSeek…). */
  private _openaiClients = new Map<LLMProvider, OpenAI>();

  constructor() {
    logger.info('Initializing PromptService...');
  }

  private get genAIClient(): GoogleGenAI {
    if (!this._genAIClient) {
      // Backend (Vertex AI ou AI Studio) résolu par la fabrique partagée.
      this._genAIClient = getGoogleGenAIClient();
    }
    return this._genAIClient;
  }

  /**
   * Client OpenAI-compatible pour un fournisseur donné (GLM, OpenAI, DeepSeek,
   * futur modèle maison…). La clé, l'URL de base et les en-têtes proviennent du
   * registre `AI_PROVIDERS`. Les clients sont mis en cache par fournisseur.
   */
  private getOpenAICompatibleClient(provider: LLMProvider): OpenAI {
    const cached = this._openaiClients.get(provider);
    if (cached) {
      return cached;
    }

    const def = getProvider(provider);
    const apiKey = process.env[def.apiKeyEnv];
    if (!apiKey) {
      const message = `${def.apiKeyEnv} is not set — cannot use provider ${provider}.`;
      logger.error(message);
      throw new Error(message);
    }

    const client = new OpenAI({
      apiKey,
      ...(def.baseUrl ? { baseURL: def.baseUrl } : {}),
      ...(def.defaultHeaders ? { defaultHeaders: def.defaultHeaders } : {}),
      // Le réessai est géré UNE seule fois, par `withRetry`, qui sait distinguer
      // le transitoire réseau (à rejouer) de la saturation (à basculer de
      // modèle). Le défaut du SDK (2 réessais) s'empilait par-dessus, et
      // par-dessus la chaîne de repli : jusqu'à 3 modèles × 3 tentatives × 3
      // réessais SDK = 27 appels fournisseur pour une seule génération, tous
      // facturés dès qu'ils atteignaient le modèle.
      maxRetries: 0,
      // Le défaut du SDK est de 10 MINUTES. Une génération bloquée retenait donc
      // son créneau de concurrence dix minutes avant de basculer. 180 s couvrent
      // largement la plus lourde des générations (48 000 tokens de sortie).
      timeout: Number(process.env.LLM_TIMEOUT_MS ?? 180_000),
    });
    this._openaiClients.set(provider, client);
    logger.info(
      `OpenAI-compatible client initialized for provider=${provider} (baseURL=${def.baseUrl ?? 'default'}).`
    );
    return client;
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
    cachedContent?: string,
    /**
     * Collecteur d'usage : rempli avec les compteurs de tokens réellement
     * renvoyés par l'API. Passer par un collecteur évite de changer le type de
     * retour de cet exécuteur (et donc de toucher tous ses appelants) tout en
     * remontant l'information dont runPrompt a besoin pour journaliser.
     */
    usageSink?: UsageSink
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
        //
        // Aucun repli imbriqué ici. `runPrompt` — seul appelant de cette
        // méthode — parcourt déjà `fallbackModels` en rejouant chaque modèle
        // sur panne réseau. Un second repli à cet étage doublait le nombre
        // d'appels et court-circuitait la chaîne déclarée en configuration.
        const result = await this.genAIClient.models.generateContent({
          model: modelName,
          contents: geminiContent,
        });
        // Relevé de consommation avant tout retour/erreur : l'appel a été
        // facturé par Google même si la réponse est inexploitable.
        if (usageSink) {
          usageSink.usage = extractGeminiUsage(result);
          usageSink.modelUsed = modelName;
        }

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
    //
    // La config est construite PAR MODÈLE et non une fois pour toutes: le
    // pilotage du raisonnement dépend de la famille du modèle, et un repli
    // n'est pas forcément de la même famille que le modèle principal.
    const buildConfig = (model: string) => ({
      ...(llmOptions.maxOutputTokens && { maxOutputTokens: llmOptions.maxOutputTokens }),
      ...(llmOptions.temperature !== undefined && { temperature: llmOptions.temperature }),
      ...(llmOptions.topP && { topP: llmOptions.topP }),
      ...(llmOptions.topK && { topK: llmOptions.topK }),
      ...buildGeminiThinkingConfig(model, llmOptions.thinkingBudget),
      // Sortie JSON contrainte — équivalent Gemini de `response_format` côté
      // OpenAI. Sans cette ligne, `jsonMode` n'aurait d'effet que sur un
      // fournisseur, et la garantie de format dépendrait de qui sert le modèle :
      // exactement ce que le dispositif cherche à supprimer.
      ...(llmOptions.jsonMode ? { responseMimeType: 'application/json' } : {}),
      ...(cachedContent && { cachedContent }),
    });

    if (
      llmOptions.thinkingBudget === 0 &&
      !canSuppressThinking(modelName)
    ) {
      logger.warn(
        `Raisonnement NON coupé pour "${modelName}" : ce modèle n'expose aucun réglage connu. ` +
          `Les tokens de réflexion se décompteront de maxOutputTokens ` +
          `(${llmOptions.maxOutputTokens ?? 'défaut'}) — une réponse vide est possible sur un budget serré.`
      );
    }

    // Un seul appel, un seul modèle: la résilience (réessai réseau puis bascule
    // de modèle) est portée une fois pour toutes par `runPrompt`.
    const config = buildConfig(modelName);
    const result = await this.genAIClient.models.generateContent({
      model: modelName,
      contents: geminiContent,
      config,
    });
    if (usageSink) {
      usageSink.usage = extractGeminiUsage(result);
      usageSink.modelUsed = modelName;
    }

    // Surface truncation explicitly. gemini-3 "thinking" models count reasoning
    // tokens against maxOutputTokens; when the budget is too small the answer is
    // cut mid-string and downstream JSON/SVG parsing fails with cryptic errors
    // ("no usable SVG"). Logging finishReason here makes the real cause visible.
    const finishReason = result.candidates?.[0]?.finishReason;
    if (finishReason === 'MAX_TOKENS') {
      logger.warn(
        `Gemini response truncated (finishReason=MAX_TOKENS) for model ${modelName}: output hit ` +
          `maxOutputTokens=${config.maxOutputTokens ?? 'default'}. Increase maxOutputTokens for this ` +
          `feature in ai.config.ts — the partial output will likely break JSON/SVG parsing.`
      );
    }

    const response = result.text;
    if (!response) {
      logger.error('Failed to generate response from Gemini API.');
      const runPromptErrorMessage = `Failed to run prompt: ${JSON.stringify(result, null, 2)}`;
      logger.error(runPromptErrorMessage);
      throw new Error(runPromptErrorMessage);
    }
    return response;
  }

  /**
   * Convertit un schéma d'outil Gemini (@google/genai `Schema`, `type` en
   * MAJUSCULES) en JSON Schema OpenAI (`type` en minuscules). Récursif sur
   * `properties` et `items` ; conserve `enum`/`description`/`required`.
   */
  private geminiSchemaToJsonSchema(schema: any): Record<string, unknown> {
    if (!schema || typeof schema !== 'object') {
      return {};
    }
    const out: Record<string, unknown> = {};
    if (schema.type) out.type = String(schema.type).toLowerCase();
    if (schema.description) out.description = schema.description;
    if (Array.isArray(schema.enum)) out.enum = schema.enum;
    if (schema.properties && typeof schema.properties === 'object') {
      const props: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(schema.properties)) {
        props[key] = this.geminiSchemaToJsonSchema(value);
      }
      out.properties = props;
    }
    if (Array.isArray(schema.required)) out.required = schema.required;
    if (schema.items) out.items = this.geminiSchemaToJsonSchema(schema.items);
    return out;
  }

  /** Traduit des FunctionDeclaration Gemini en `tools` OpenAI (function-calling). */
  private toOpenAITools(
    tools: FunctionDeclaration[]
  ): OpenAI.Chat.Completions.ChatCompletionTool[] {
    return tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name ?? '',
        ...(t.description ? { description: t.description } : {}),
        parameters: this.geminiSchemaToJsonSchema(
          t.parameters ?? { type: 'OBJECT', properties: {} }
        ),
      },
    }));
  }

  /**
   * Détecte une enveloppe d'erreur renvoyée en HTTP 200 par un gateway
   * openai-compatible (ex: Z.ai/GLM: `{code, msg, success:false}`) et lève une
   * erreur lisible. Sans quoi le SDK OpenAI présente un objet sans `choices` et
   * on perd la cause réelle (mauvaise URL, solde insuffisant, modèle inconnu…).
   */
  private assertNoErrorEnvelope(provider: LLMProvider, response: any): void {
    if (
      response &&
      typeof response === 'object' &&
      !Array.isArray(response.choices) &&
      (response.success === false || response.code !== undefined || response.msg)
    ) {
      const detail = response.msg || response.error || JSON.stringify(response).slice(0, 300);
      logger.error(`${provider} API error envelope (HTTP 200): ${JSON.stringify(response).slice(0, 500)}`);
      throw new Error(`${provider} API error: ${detail}`);
    }
  }

  /**
   * Adaptateur générique pour TOUT fournisseur `openai-compatible` du registre
   * (GLM, OpenAI, DeepSeek, futur modèle maison). Remplace les anciennes méthodes
   * dédiées ChatGPT/DeepSeek : la seule différence entre fournisseurs (clé, URL,
   * en-têtes, modèle de repli) est portée par `AI_PROVIDERS`.
   */
  private async _runOpenAICompatiblePrompt(
    provider: LLMProvider,
    modelName: string,
    messages: AIChatMessage[],
    llmOptions: LLMOptions,
    fileInput?: { localPath: string; mimeType?: string },
    /** Voir _runGeminiPrompt : collecteur des compteurs de tokens réels. */
    usageSink?: UsageSink
  ): Promise<string> {
    const client = this.getOpenAICompatibleClient(provider);
    const def = getProvider(provider);

    try {
      const openaiMessages = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })) as OpenAI.Chat.Completions.ChatCompletionMessageParam[];

      const generationParams = {
        ...(llmOptions.maxOutputTokens && { max_tokens: llmOptions.maxOutputTokens }),
        ...(llmOptions.temperature !== undefined && { temperature: llmOptions.temperature }),
        ...(llmOptions.topP !== undefined && { top_p: llmOptions.topP }),
        // Pas de topK dans l'API OpenAI.
        ...(jsonModeFor(llmOptions, openaiMessages)
          ? { response_format: { type: 'json_object' as const } }
          : {}),
      };

      // Le SDK n'upload pas de fichier ici : on injecte son contenu comme contexte
      // système (comportement historique des chemins ChatGPT/DeepSeek).
      if (fileInput && fileInput.localPath) {
        logger.info(`Processing file input for ${provider}: ${fileInput.localPath}`);
        try {
          const fileContent = await fs.readFile(fileInput.localPath, 'utf-8');
          openaiMessages.unshift({
            role: 'system',
            content: `File content for context: ${fileContent}`,
          });
        } catch (fileError) {
          logger.error(`Error reading file for ${provider}: ${fileInput.localPath}`, fileError);
          throw new Error(
            `Failed to read file for ${provider}: ${(fileError as Error).message || fileError}`
          );
        }
      }

      const thinkingRequested =
        ((llmOptions.extraBody as any) ?? (def.extraBody as any))?.thinking?.type === 'enabled';

      const doCreate = (model: string, forceNoThinking = false) =>
        client.chat.completions.create({
          model,
          messages: openaiMessages,
          ...generationParams,
          // Défaut du provider, puis surcharge éventuelle par-feature (ex: réactiver
          // le raisonnement GLM sur la génération de logo). La feature l'emporte.
          ...(def.extraBody ?? {}),
          ...(llmOptions.extraBody ?? {}),
          ...(forceNoThinking ? { thinking: { type: 'disabled' } } : {}),
        } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming);

      /** Réponse vide alors que le budget a été épuisé — signature du raisonnement qui déborde. */
      const starvedByThinking = (candidate: any): boolean =>
        !candidate?.choices?.[0]?.message?.content &&
        candidate?.choices?.[0]?.finish_reason === 'length';

      // Repli optionnel propre au fournisseur (ex: glm-5.2 → glm-4.6).
      let response;
      let usedModel = modelName;
      try {
        response = await doCreate(modelName);
      } catch (primaryError: any) {
        if (def.fallbackModel && def.fallbackModel !== modelName) {
          logger.warn(
            `${provider} model "${modelName}" failed (${primaryError.message || primaryError}). Retrying with "${def.fallbackModel}"...`
          );
          usedModel = def.fallbackModel;
          response = await doCreate(def.fallbackModel);
        } else {
          throw primaryError;
        }
      }

      // Auto-réparation : le modèle a raisonné jusqu'à épuiser l'enveloppe et n'a
      // rien écrit. Changer de MODÈLE ne sert à rien — le repli hérite du même
      // réglage et échoue à l'identique, ce qu'on a observé en production. Ce
      // qu'il faut retirer, c'est le raisonnement, sur le même modèle.
      //
      // Le cas survient même avec un budget confortable : sur un modèle
      // « thinking », une température haute rend la réflexion elle-même diffuse,
      // et elle consomme 24 000 tokens sans converger. Le budget minimal ne
      // suffit donc pas à s'en prémunir, il faut ce rattrapage.
      if (thinkingRequested && starvedByThinking(response)) {
        logger.warn(
          `${provider}/${usedModel} : raisonnement épuisé sans réponse (finish_reason=length). ` +
            `Nouvelle tentative sur le même modèle, raisonnement désactivé.`
        );
        response = await doCreate(usedModel, true);
      }

      // Relevé de consommation avant les contrôles de validité : une enveloppe
      // d'erreur ou une réponse vide a tout de même été facturée.
      if (usageSink) {
        usageSink.usage = extractOpenAIUsage(response);
        usageSink.modelUsed = (response as any)?.model || modelName;
      }

      // Certains gateways openai-compatible (ex: Z.ai/GLM) renvoient un HTTP 200
      // dont le corps est en réalité une enveloppe d'erreur ({code, msg, success:
      // false}) SANS `choices`. On la détecte pour remonter un message exploitable
      // au lieu d'un opaque "no choices".
      this.assertNoErrorEnvelope(provider, response);

      if (!response.choices || response.choices.length === 0) {
        const raw = JSON.stringify(response).slice(0, 500);
        logger.error(`${provider} API returned no choices. Raw response: ${raw}`);
        throw new Error(`${provider} API returned no choices. Raw: ${raw}`);
      }

      const textContent = response.choices[0].message.content;
      if (!textContent) {
        // finish_reason='length' ⇒ budget épuisé (souvent par le raisonnement d'un
        // modèle "thinking"): augmenter maxOutputTokens ou désactiver le thinking.
        const finishReason = response.choices[0].finish_reason;
        logger.error(
          `${provider} API returned empty text content (finish_reason=${finishReason}).`
        );
        throw new Error(
          `${provider} API returned empty text content (finish_reason=${finishReason})`
        );
      }

      return textContent;
    } catch (error) {
      const errorMessage = `Error with ${provider} API: ${(error as Error).message || error}`;
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  /**
   * Boucle agentique (function-calling) pour un fournisseur `openai-compatible`
   * qui supporte les outils (ex: GLM). Miroir de la boucle Gemile de
   * runPromptWithTools, au format OpenAI (`tool_calls` / messages `role:'tool'`).
   */
  private async _runOpenAICompatibleTools(
    provider: LLMProvider,
    modelName: string,
    messages: AIChatMessage[],
    llmOptions: LLMOptions,
    tools: FunctionDeclaration[],
    executeTool: (name: string, args: Record<string, unknown>) => Promise<unknown>,
    maxToolTurns: number
  ): Promise<string> {
    const client = this.getOpenAICompatibleClient(provider);
    const def = getProvider(provider);
    const openaiTools = this.toOpenAITools(tools);

    const conversation: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = messages.map(
      (msg) => ({ role: msg.role, content: msg.content })
    ) as OpenAI.Chat.Completions.ChatCompletionMessageParam[];

    const generationParams = {
      ...(llmOptions.maxOutputTokens && { max_tokens: llmOptions.maxOutputTokens }),
      ...(llmOptions.temperature !== undefined && { temperature: llmOptions.temperature }),
      ...(llmOptions.topP !== undefined && { top_p: llmOptions.topP }),
    };

    let finalText = '';
    for (let turn = 0; turn <= maxToolTurns; turn++) {
      const forceFinal = turn === maxToolTurns;
      const response = await client.chat.completions.create({
        model: modelName,
        messages: conversation,
        ...generationParams,
        ...(def.extraBody ?? {}),
        ...(llmOptions.extraBody ?? {}),
        tools: openaiTools,
        tool_choice: forceFinal ? 'none' : 'auto',
      } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming);

      this.assertNoErrorEnvelope(provider, response);
      const choice = response.choices?.[0]?.message;
      const toolCalls = choice?.tool_calls ?? [];

      if (!choice || toolCalls.length === 0 || forceFinal) {
        finalText = choice?.content ?? '';
        logAIEvent('ai.agentic_turn', {
          turn: turn + 1,
          decision: forceFinal && toolCalls.length > 0 ? 'max_turns_forced' : 'final_answer',
          finalTextLength: finalText.length,
        });
        break;
      }

      // Rejoue le tour: message assistant avec ses tool_calls, puis une réponse
      // par outil.
      conversation.push(choice);
      logAIEvent('ai.agentic_turn', {
        turn: turn + 1,
        decision: 'tool_calls',
        tools: toolCalls.map((c) => ({
          name: c.function?.name,
          args: previewValue(c.function?.arguments),
        })),
      });

      for (const call of toolCalls) {
        const toolName = call.function?.name ?? '';
        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = call.function?.arguments ? JSON.parse(call.function.arguments) : {};
        } catch {
          parsedArgs = {};
        }
        let output: unknown;
        try {
          output = await executeTool(toolName, parsedArgs);
        } catch (error: any) {
          output = { error: error.message || String(error) };
        }
        conversation.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(output ?? null),
        });
      }
    }

    return finalText;
  }

  /**
   * Streaming pour un fournisseur `openai-compatible` (ex: GLM) : diffuse le texte
   * cumulé via `onDelta` et renvoie le texte complet.
   */
  private async _streamOpenAICompatible(
    provider: LLMProvider,
    modelName: string,
    messages: AIChatMessage[],
    llmOptions: LLMOptions,
    onDelta: (cumulativeText: string) => void
  ): Promise<string> {
    const client = this.getOpenAICompatibleClient(provider);
    const def = getProvider(provider);
    const openaiMessages = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    })) as OpenAI.Chat.Completions.ChatCompletionMessageParam[];

    const generationParams = {
      ...(llmOptions.maxOutputTokens && { max_tokens: llmOptions.maxOutputTokens }),
      ...(llmOptions.temperature !== undefined && { temperature: llmOptions.temperature }),
      ...(llmOptions.topP !== undefined && { top_p: llmOptions.topP }),
    };

    const stream = await client.chat.completions.create({
      model: modelName,
      messages: openaiMessages,
      ...generationParams,
      ...(def.extraBody ?? {}),
      ...(llmOptions.extraBody ?? {}),
      stream: true,
    } as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming);

    let full = '';
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content ?? '';
      if (delta) {
        full += delta;
        onDelta(full);
      }
    }
    return full;
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

  /**
   * Journalise la consommation de chaque tentative de modèle d'un appel.
   *
   * Deux règles :
   *  - une tentative sans métadonnées d'usage est estimée par longueur de texte
   *    plutôt qu'ignorée (une consommation invisible fausse tous les totaux) ;
   *  - toute erreur d'écriture est avalée par `aiUsageService.record` :
   *    l'observabilité ne doit jamais faire échouer une génération.
   */
  private async recordUsageAttempts(params: {
    attempts: { model: string; sink: UsageSink; startedAt: number }[];
    provider: LLMProvider;
    promptType?: string;
    userId?: string;
    messages: AIChatMessage[];
    resultText?: string;
    error?: any;
  }): Promise<void> {
    const { attempts, provider, promptType, userId, messages, resultText, error } = params;
    if (attempts.length === 0) return;

    const promptText = joinMessagesForEstimate(messages);

    for (let i = 0; i < attempts.length; i++) {
      const attempt = attempts[i];
      const isLast = i === attempts.length - 1;
      // Seule la dernière tentative peut avoir produit le résultat final ; les
      // précédentes ont nécessairement échoué (la boucle sort au succès).
      const succeeded = isLast && !error && resultText !== undefined;

      const usage =
        attempt.sink.usage ?? estimateUsage(promptText, succeeded ? (resultText ?? '') : '');

      await aiUsageService.record({
        provider,
        modelName: attempt.sink.modelUsed ?? attempt.model,
        usage,
        status: succeeded ? 'success' : 'error',
        errorMessage: succeeded ? undefined : (error?.message ?? 'Model attempt failed'),
        durationMs: Date.now() - attempt.startedAt,
        promptType,
        userId,
      });
    }
  }

  public async runPrompt(request: PromptConfig, messages: AIChatMessage[]): Promise<string> {
    logger.info(
      `Running prompt for provider: ${request.provider}, model: ${
        request.modelName
      }, file attached: ${!!request.file}, userId: ${request.userId}`
    );
    // Interrupteur global optionnel (AI_DEFAULT_PROVIDER / AI_DEFAULT_MODEL) :
    // permet de faire tourner idem entièrement sur un autre fournisseur sans
    // toucher aux configs par fonctionnalité. Sans variable d'env → no-op.
    const { provider, modelName } = resolveRouting(request);
    const {
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
      // Où poser la directive ? Deux contraintes, et un ordre de priorité.
      //
      // On n'insère JAMAIS un message système supplémentaire : cela casserait
      // l'adjacence des rôles (Gemini refuse deux tours de même rôle) — d'où la
      // concaténation dans un message existant.
      //
      // Quand le premier message est un message système (c'est le cas de toutes
      // les générations par sections depuis l'introduction du préfixe stable),
      // la directive va à la FIN DE CE PREMIER BLOC. Elle reste ainsi devant le
      // contenu variable — donc lue tard par rapport aux consignes de la
      // feature — tout en laissant le début du prompt strictement identique
      // d'une section à l'autre : la concaténer au dernier message rendait au
      // contraire la fin du prompt différente à chaque appel.
      //
      // Sans message système en tête, on retombe sur le comportement d'origine.
      const headIsSystem = modifiedMessages[0]?.role === 'system';
      const targetIdx = headIsSystem ? 0 : modifiedMessages.length - 1;
      const target = modifiedMessages[targetIdx];
      modifiedMessages = modifiedMessages.map((message, index) =>
        index === targetIdx
          ? { ...target, content: `${target.content}\n\n${languageDirective}` }
          : message
      );
      logger.info(
        `Injected language directive (language=${effectiveLanguage}, position=${headIsSystem ? 'system-head' : 'last-message'}).`
      );
    }

    const kind = getProvider(provider).kind;

    // Raisonnement et budget de sortie doivent être cohérents, sinon la réponse
    // revient vide sans erreur (cf. reconcileThinkingBudget). Arbitré ICI, au
    // seul point de passage : une quinzaine de services recopient des
    // `llmOptions` depuis ai.config.ts en réduisant le budget pour leur propre
    // usage, sans savoir que la feature a activé la réflexion.
    const reconciled = reconcileThinkingBudget(llmOptions);
    if (reconciled.downgraded) {
      logger.warn(
        `Raisonnement désactivé pour ce${promptType ? ` '${promptType}'` : 't appel'} : ` +
          `budget de ${llmOptions.maxOutputTokens} tokens insuffisant (minimum ${MIN_TOKENS_FOR_THINKING}). ` +
          `La réflexion aurait consommé toute l'enveloppe et renvoyé une réponse vide.`
      );
    }
    if (reconciled.temperatureClamped !== undefined) {
      logger.warn(
        `Température écrêtée de ${reconciled.temperatureClamped} à ${MAX_TEMPERATURE_FOR_THINKING} ` +
          `pour ce${promptType ? ` '${promptType}'` : 't appel'} : le raisonnement est actif, et ` +
          `au-delà de ce seuil la réflexion cesse de converger — elle épuise l'enveloppe et ` +
          `renvoie une réponse vide.`
      );
    }
    const effectiveLlmOptions = reconciled.options;

    // Filet de sécurité: une chaîne de repli absente est presque toujours un
    // OUBLI, pas une décision. Une quinzaine de services recopient
    // `provider`/`modelName`/`llmOptions` depuis ai.config.ts en laissant
    // `fallbackModels` derrière eux — la feature déclarait bien un repli, il
    // n'arrivait simplement jamais jusqu'ici (`fallbacks=0` dans les logs) et
    // le moindre incident réseau faisait échouer la génération sans seconde
    // chance. Le défaut est appliqué ICI, au seul point de passage, plutôt
    // qu'ajouté à chaque appelant — où le prochain l'oublierait à son tour.
    //
    // Le défaut vient du FOURNISSEUR (`defaultFallbackModels`), jamais d'une
    // famille de modèles: proposer une chaîne Google à Z.ai — ou l'inverse —
    // ne produit que des 404 en cascade. Le garde-fou précédent testait
    // `kind === 'gemini'` et appliquait `TEXT_FALLBACK_MODELS`, devenue
    // entre-temps 100 % GLM: il servait des noms GLM à Vertex et laissait GLM
    // sans repli. Cf. ai-providers.config.ts.
    // Une bascule de fournisseur invalide les replis DÉCLARÉS : ils nomment des
    // modèles de l'ancien fournisseur, que le nouveau ne connaît pas. Les
    // envoyer quand même produirait une cascade de 404 à l'endroit précis où le
    // filet devait servir.
    const providerSwitched = provider !== request.provider;
    const declaredFallbacks = providerSwitched ? [] : (request.fallbackModels ?? []);
    const effectiveFallbacks =
      declaredFallbacks.length > 0
        ? declaredFallbacks
        : (getProvider(provider).defaultFallbackModels ?? []);

    // Doublons écartés : la chaîne de repli commence souvent par le modèle
    // primaire de la feature — on rejouerait alors celui qui vient d'échouer
    // avant d'en essayer un autre.
    const modelsToTry = [...new Set([modelName, ...effectiveFallbacks])];

    let result: string | undefined;
    let lastError: any;
    // Un relevé par modèle essayé : un repli après échec a consommé des tokens
    // sur les DEUX modèles, et les deux doivent apparaître dans le journal.
    const attempts: { model: string; sink: UsageSink; startedAt: number }[] = [];

    /** Un appel, un modèle. Le choix de l'adaptateur ne dépend que du fournisseur. */
    const callModel = async (model: string, sink: UsageSink): Promise<string> => {
      switch (kind) {
        case 'gemini':
          return this._runGeminiPrompt(
            model,
            modifiedMessages,
            effectiveLlmOptions,
            file,
            request.cachedContent,
            sink
          );
        case 'openai-compatible':
          return this._runOpenAICompatiblePrompt(
            provider,
            model,
            modifiedMessages,
            effectiveLlmOptions,
            file,
            sink
          );
        default:
          const unsupportedProviderError = new Error(`Unsupported provider kind: ${kind}`);
          logger.error(
            `Unsupported provider kind encountered in runPrompt: ${unsupportedProviderError.message}`,
            { provider, kind, stack: unsupportedProviderError.stack }
          );
          throw unsupportedProviderError;
      }
    };

    for (let i = 0; i < modelsToTry.length; i++) {
      const currentModel = modelsToTry[i];

      // La panne précédente était réseau : changer de modèle n'y répond pas,
      // c'est la connexion qui manquait. On laisse un instant s'écouler avant
      // de repartir, sinon toute la chaîne s'épuise dans la même seconde.
      if (i > 0 && isTransientNetworkError(lastError)) {
        await sleep(INTER_MODEL_DELAY_MS);
      }

      const sink: UsageSink = {};
      const attemptStartedAt = Date.now();
      attempts.push({ model: currentModel, sink, startedAt: attemptStartedAt });
      try {
        // Chaque modèle a droit à plusieurs essais AVANT qu'on ne bascule : un
        // `fetch failed` est temporel, et le modèle suivant échouerait pareil
        // s'il partait sur la même connexion défaillante. Seul le transitoire
        // réseau est rejoué — une saturation (429/503) bascule immédiatement.
        result = await withRetry(() => callModel(currentModel, sink), {
          label: `${provider}/${currentModel}`,
        });

        lastError = undefined;
        break; // Success, exit retry loop
      } catch (error: any) {
        lastError = error;
        if (i < modelsToTry.length - 1) {
          logger.warn(
            `Model ${currentModel} failed, falling back to ${modelsToTry[i + 1]}... Error: ${describeError(error)}`
          );
        } else {
          logger.error(
            `Error in runPrompt for provider ${provider}, model ${currentModel} (exhausted fallbacks): ${describeError(error)}`,
            { stack: error.stack, details: error }
          );
        }
      }
    }

    // Journalisation de la consommation, y compris pour les tentatives en échec :
    // un modèle qui répond puis échoue au parsing a bien été facturé, et le
    // masquer sous-estimerait le coût réel de la plateforme.
    // Journalisation de la consommation, tentatives en échec comprises : un
    // modèle qui répond puis échoue au parsing a bien été facturé.
    //
    // HORS du chemin critique. `record` écrit trois fois en base (événement,
    // agrégat quotidien, compteur de tokens) et avalait déjà ses propres
    // erreurs — mais attendues ici, ces écritures ajoutaient 50 à 300 ms à
    // CHAQUE appel modèle, soit plusieurs secondes sur un projet complet.
    // L'observabilité ne doit ni faire échouer une génération, ni la ralentir.
    void this.recordUsageAttempts({
      attempts,
      provider,
      promptType,
      userId,
      messages: modifiedMessages,
      resultText: result,
      error: lastError,
    }).catch((error) => logger.warn(`Relevé d'usage perdu: ${describeError(error)}`));

    if (lastError) {
      throw lastError;
    }

    if (result === undefined) {
      throw new Error('Unexpected empty result after trying all models.');
    }

    // Increment quota after successful API call
    if (userId && !skipQuotaCheck) {
      incrementUsageInBackground(userId);
    }

    return result;
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
    const { provider, modelName } = resolveRouting(request);
    const { llmOptions = {}, userId, skipQuotaCheck = false, language } = request;

    if (!messages || messages.length === 0) {
      throw new Error('Messages array cannot be empty.');
    }

    // Garde-fou par capacité : un fournisseur openai-compatible sans support des
    // outils ne peut pas exécuter la boucle agentique (l'appelant — ex: Advisor —
    // retombe alors sur runPrompt).
    const providerKind = getProvider(provider).kind;
    if (providerKind !== 'gemini' && !providerSupports(provider, 'tools')) {
      throw new Error(
        `runPromptWithTools: le fournisseur ${provider} ne supporte pas le function-calling.`
      );
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
    const maxToolTurns = options.maxToolTurns ?? 8;

    // Branche openai-compatible (ex: GLM) : boucle d'outils au format OpenAI.
    if (providerKind === 'openai-compatible') {
      const toolMessages: AIChatMessage[] = languageDirective
        ? [...messages, { role: 'system', content: languageDirective }]
        : messages;
      const loopStartedAt = Date.now();
      logAIEvent('ai.agentic_loop_start', {
        provider,
        modelName,
        promptType: request.promptType,
        toolCount: tools.length,
        maxToolTurns,
      });
      const text = await this._runOpenAICompatibleTools(
        provider,
        modelName,
        toolMessages,
        llmOptions,
        tools,
        executeTool,
        maxToolTurns
      );
      logAIEvent('ai.agentic_loop_end', {
        provider,
        modelName,
        finalTextLength: text.length,
        durationMs: Date.now() - loopStartedAt,
      });
      if (userId && !skipQuotaCheck) {
        incrementUsageInBackground(userId);
      }
      return text;
    }

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

    const effectiveFallbackModel = pickFallbackModel(provider, modelName, request.fallbackModels);

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
      incrementUsageInBackground(userId);
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
    // Même interrupteur global que les autres points d'entrée : sans lui, une
    // bascule de fournisseur laissait la recherche fondée sur l'ancien — donc
    // sur un endpoint dont la clé n'est plus configurée.
    const { provider, modelName: overriddenModel } = resolveRouting(request);
    const { llmOptions = {}, userId, skipQuotaCheck = false, language } = request;
    request = { ...request, provider, modelName: overriddenModel };

    if (!messages || messages.length === 0) {
      throw new Error('Messages array cannot be empty.');
    }

    // Chaque fournisseur fonde ses réponses à sa façon : Google par un outil
    // intégré au modèle, Z.ai par un endpoint de recherche distinct. Les deux
    // rendent le même contrat — du texte et de vraies sources.
    const groundingSupported = providerSupports(provider, 'grounding');
    const modelName = groundingSupported ? overriddenModel : AI_CONFIG.default.modelName;
    if (!groundingSupported) {
      logger.warn(
        `runGroundedResearch: le fournisseur ${provider} ne fonde pas ses réponses — repli sur ${modelName}.`
      );
    }

    if (provider === LLMProvider.GLM) {
      return this.runGlmGroundedResearch({ ...request, modelName }, messages);
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
      incrementUsageInBackground(userId);
    }

    return { text, ...parsed };
  }

  /**
   * Recherche fondée via Z.ai — deux temps, là où Gemini n'en fait qu'un.
   *
   * L'endpoint `/web_search` interroge le web et rend des résultats déjà mis
   * en forme pour un modèle ; on les passe ensuite en contexte à la génération,
   * en imposant la citation par `[sN]`. C'est ce marquage qui permet de
   * reconstituer l'association segments → sources que Google livre, lui, dans
   * ses `groundingMetadata`.
   *
   * Aucune donnée n'est acceptée hors de ces résultats : c'est le même socle
   * anti-invention, obtenu autrement.
   */
  private async runGlmGroundedResearch(
    request: PromptConfig,
    messages: AIChatMessage[]
  ): Promise<GroundedResult> {
    const { modelName, llmOptions = {}, userId, skipQuotaCheck = false, language } = request;
    const startedAt = Date.now();

    // Le message de recherche est un brief entier — contexte projet, consignes,
    // liste de points. L'envoyer tel quel à un moteur de recherche donnerait de
    // mauvais résultats, et l'afficher à l'utilisateur lui montrerait nos
    // instructions internes. On en tire donc de vraies requêtes courtes.
    const brief = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const queries = buildSearchQueries(brief);
    logAIEvent('ai.grounded_research_start', {
      modelName,
      promptType: request.promptType,
      queryCount: queries.length,
    });

    // Une recherche par point à couvrir, en parallèle : c'est ce que faisait le
    // grounding de Google, et ce que la qualité des résultats demande.
    const batches = await Promise.all(queries.map((q) => this.searchWeb(q, SEARCH_RESULTS_PER_QUERY)));
    const results = dedupeByLink(batches.flat());

    if (results.length === 0) {
      // Sans source, une réponse « fondée » n'en serait pas une : mieux vaut
      // rendre un résultat vide que du texte inventé qui en aurait l'air.
      logger.warn('runGlmGroundedResearch: la recherche web n\'a rien renvoyé.');
      return { text: '', queries, sources: [], supports: [] };
    }

    const sources: GroundedSourceRaw[] = results.map((result, index) => ({
      index,
      title: result.title,
      url: result.link,
      domain: safeDomain(result.link),
    }));

    const dossier = sources
      .map(
        (source, index) =>
          `[s${index}] ${source.title} — ${source.url}\n${results[index].content}`
      )
      .join('\n\n');

    const grounded: AIChatMessage[] = [
      ...messages.filter((m) => m.role === 'system'),
      {
        role: 'system',
        content:
          'You answer ONLY from the search results below. ' +
          'State no figure, no fact and no date that is not in them. ' +
          'Every claim taken from a source carries its reference in brackets, ' +
          'as [s0], [s1]… matching the numbered results.' +
          `\n\n--- SEARCH RESULTS ---\n${dossier}`,
      },
      ...messages.filter((m) => m.role !== 'system'),
    ];

    const text = await this.runPrompt(
      {
        ...request,
        provider: LLMProvider.GLM,
        modelName,
        llmOptions,
        language,
        userId,
        // Le quota est décompté une fois, à la fin, comme le fait la voie Gemini.
        skipQuotaCheck: true,
      },
      grounded
    );

    const supports = extractCitationSupports(text, sources.length);

    logAIEvent('ai.grounded_research_end', {
      modelName,
      durationMs: Date.now() - startedAt,
      textLength: text.length,
      sourceCount: sources.length,
      queryCount: queries.length,
    });

    if (userId && !skipQuotaCheck) {
      incrementUsageInBackground(userId);
    }

    return { text, queries, sources, supports };
  }

  /**
   * Appelle l'endpoint de recherche de Z.ai. Hors contrat OpenAI : c'est une
   * requête HTTP à part, avec son propre corps.
   */
  private async searchWeb(query: string, count = 10): Promise<GlmSearchResult[]> {
    const apiKey = getGlmApiKey();
    if (!apiKey || !query.trim()) {
      return [];
    }

    try {
      const response = await axios.post<{ search_result?: GlmSearchResult[] }>(
        GLM_ENDPOINTS.webSearch,
        {
          search_engine: GLM_MODELS.searchEngine,
          search_query: query.slice(0, 1000),
          count,
        },
        {
          headers: { Authorization: `Bearer ${apiKey}` },
          timeout: 30_000,
        }
      );

      const results = (response.data?.search_result ?? []).filter(
        (result) => result?.link && result?.content
      );
      logger.info(`Z.ai web search returned ${results.length} results for "${query.slice(0, 60)}"`);
      return results;
    } catch (error: any) {
      logger.error(`Z.ai web search failed: ${error?.message}`, { status: error?.response?.status });
      return [];
    }
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
    // Le backend Gemini actif ne sert pas toujours le cache de contexte :
    // l'endpoint Vertex `global` ne le propose pas. Sans ce garde-fou chaque
    // appel tenterait un `caches.create` voué à l'échec, avalé par le catch plus
    // bas — un aller-retour perdu par génération, pour une cause invisible.
    if (!providerSupports(LLMProvider.GEMINI, 'contextCache')) {
      logger.debug(`Context cache unavailable on this backend — ${describeGeminiBackend()}.`);
      return null;
    }

    // Le cache de contexte est une notion Gemini : le demander pour un modèle
    // d'un autre fournisseur envoie un nom inconnu à Google, qui répond par une
    // erreur avalée plus bas. Un aller-retour perdu à chaque génération, sans
    // trace lisible.
    if (!modelName.startsWith('gemini')) {
      logger.debug(`Context cache skipped: ${modelName} is not a Gemini model.`);
      return null;
    }

    // Le cache de contexte serveur est une fonctionnalité Gemini. Pour tout autre
    // modèle (ex: glm-5.2) on n'essaie même pas : l'appelant retombe sur l'inline.
    if (!modelName.startsWith('gemini')) {
      logger.debug(`Context cache skipped: model "${modelName}" is not a Gemini model.`);
      return null;
    }
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
    const { provider, modelName } = resolveRouting(request);
    const {
      llmOptions = {},
      userId,
      skipQuotaCheck = false,
      language,
      cachedContent,
    } = request;

    if (!messages || messages.length === 0) {
      throw new Error('Messages array cannot be empty.');
    }

    const providerKind = getProvider(provider).kind;

    if (userId && !skipQuotaCheck) {
      const quotaCheck = await userService.checkQuota(userId);
      if (!quotaCheck.allowed) {
        throw new Error(quotaCheck.message || 'Quota exceeded');
      }
    }

    const effectiveLanguage = language ?? getRequestLanguage();
    const languageDirective = this.buildLanguageDirective(effectiveLanguage);

    // Fournisseur openai-compatible (ex: GLM) : vrai flux via le SDK OpenAI si la
    // capacité est déclarée, sinon repli non-streamé. Le repli passe par runPrompt
    // qui gère lui-même le quota ; le flux réussi incrémente ici (une seule fois).
    if (providerKind === 'openai-compatible') {
      if (providerSupports(provider, 'streaming')) {
        const streamMessages: AIChatMessage[] = languageDirective
          ? [...messages, { role: 'system', content: languageDirective }]
          : messages;
        try {
          const full = await this._streamOpenAICompatible(
            provider,
            modelName,
            streamMessages,
            llmOptions,
            onDelta
          );
          if (userId && !skipQuotaCheck) {
            incrementUsageInBackground(userId);
          }
          return full;
        } catch (error: any) {
          logger.warn(
            `runPromptStream (${provider}) failed, falling back to non-streaming: ${error.message}`
          );
        }
      }
      const text = await this.runPrompt(request, messages);
      onDelta(text);
      return text;
    }

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
      incrementUsageInBackground(userId);
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

/** Domaine d'une URL, ou `undefined` si elle est malformée. */
function safeDomain(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

/**
 * Reconstitue l'association segments → sources à partir des marqueurs `[sN]`
 * laissés par le modèle.
 *
 * Google livre cette carte dans ses métadonnées ; avec une recherche externe il
 * faut la relire dans le texte. Chaque phrase portant au moins une référence
 * devient un support, débarrassé de ses marqueurs.
 */
function extractCitationSupports(text: string, sourceCount: number): GroundedSupport[] {
  if (!text || sourceCount === 0) {
    return [];
  }

  const supports: GroundedSupport[] = [];
  // Découpe à la phrase : c'est l'unité que porte une citation.
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    const indexes = [...sentence.matchAll(/\[s(\d+)\]/g)]
      .map((match) => Number.parseInt(match[1], 10))
      .filter((index) => Number.isInteger(index) && index >= 0 && index < sourceCount);

    if (indexes.length === 0) {
      continue;
    }

    const cleaned = sentence.replace(/\s*\[s\d+\]/g, '').trim();
    if (cleaned) {
      supports.push({ text: cleaned, sourceIndexes: [...new Set(indexes)] });
    }
  }

  return supports;
}

/**
 * Résultats demandés par requête. Descendu de 5 à 4 : le dossier envoyé au
 * modèle rétrécit d'autant, et c'est lui qui pèse sur la latence de la
 * synthèse — pas la recherche elle-même, qui tient en trois secondes.
 */
const SEARCH_RESULTS_PER_QUERY = 4;

/**
 * Requêtes par section. Descendu de 4 à 3 : au-delà, les résultats se
 * recoupent et l'on paie une recherche de plus pour la même information.
 */
const MAX_SEARCH_QUERIES = 3;

/**
 * Tire de vraies requêtes de recherche d'un brief de recherche.
 *
 * Le brief mêle contexte projet, consignes internes et liste de points à
 * couvrir. Un moteur de recherche n'en fait rien de bon, et l'utilisateur qui
 * verrait passer « N'invente rien » dans l'interface se demanderait à qui on
 * parle. On ne garde donc que les points à couvrir, un par requête, ancrés sur
 * le pays quand le brief le mentionne.
 */
export function buildSearchQueries(brief: string): string[] {
  const mission = /DONNÉES À TROUVER[^:]*:\s*([\s\S]*?)(?:\n\s*\n|$)/i.exec(brief)?.[1] ?? '';
  const country = /Pays:\s*([^\n]+)/i.exec(brief)?.[1]?.trim();

  const points = mission
    .split('\n')
    .map((line) => line.replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter((line) => line.length > 8);

  const queries = points.slice(0, MAX_SEARCH_QUERIES).map((point) => {
    const base = point.replace(/\s+/g, ' ').slice(0, 180);
    // Le pays n'est ajouté que s'il manque : une requête qui le répète perd en
    // précision.
    return country && !base.toLowerCase().includes(country.toLowerCase())
      ? `${base} ${country}`
      : base;
  });

  if (queries.length > 0) {
    return queries;
  }

  // Brief sans liste de points : on retombe sur sa première phrase utile.
  const fallback = brief
    .replace(/CONTEXTE PROJET:|DONNÉES À TROUVER[^:]*:/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
  return fallback ? [fallback] : [];
}

/** Une même page trouvée par deux requêtes ne compte qu'une fois. */
function dedupeByLink<T extends { link: string }>(results: T[]): T[] {
  const seen = new Set<string>();
  return results.filter((result) => {
    if (seen.has(result.link)) return false;
    seen.add(result.link);
    return true;
  });
}
