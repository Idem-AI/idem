import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { streamText, generateObject, LanguageModel, convertToCoreMessages } from 'ai';
import { z } from 'zod';
import {
  allModelConfigs,
  getDefaultModelKey,
  resolveModelCredentials,
} from '../config/modelConfig.js';
import { Messages, ToolInfo } from '../types/project.js';

/**
 * Le catalogue COMPLET, repli compris. `modelConfig` est la liste publique
 * (filtrée) servie à l'interface : chercher dedans ferait échouer la résolution
 * du modèle de repli, qui n'y figure volontairement pas.
 */
function findModelConfig(modelKey: string) {
  return allModelConfigs.find((item) => item.modelKey === modelKey);
}

export function getOpenAIModel(baseURL: string, apiKey: string, model: string): LanguageModel {
  const provider = findModelConfig(model)?.provider;

  if (provider === 'gemini' || provider === 'google') {
    const gemini = createGoogleGenerativeAI({
      apiKey,
      baseURL,
    });
    return gemini(model) as LanguageModel;
  }

  if (provider === 'deepseek') {
    const deepseek = createDeepSeek({
      apiKey,
      baseURL,
    });
    return deepseek(model) as LanguageModel;
  }

  if (provider && provider.indexOf('claude') > -1) {
    const openai = createOpenAI({
      apiKey,
      baseURL,
    });
    return openai(model) as LanguageModel;
  }

  if (provider === 'openai') {
    const openai = createOpenAI({
      apiKey,
      baseURL,
    });
    return openai(model) as LanguageModel;
  }

  // GLM (Z.ai) — endpoint OpenAI-compatible, donc le même client. Le
  // raisonnement est coupé : il se décompte du budget de sortie, et sur une
  // génération de code longue il le mangerait avant le code lui-même. Laissé
  // actif, Z.ai n'émet que des deltas `reasoning_content`, un champ hors norme
  // OpenAI que le SDK ne mappe pas en texte : le flux reste ouvert sans jamais
  // rien produire, et l'interface tourne indéfiniment sans erreur.
  //
  // `thinking` ne passe pas par `providerOptions` : le provider OpenAI du SDK
  // ne recopie qu'une liste fermée de champs (max_completion_tokens, store,
  // metadata, prediction, reasoning_effort) et jette tout le reste en silence.
  // On l'injecte donc dans le corps via un `fetch` intermédiaire.
  if (provider === 'glm') {
    const glm = createOpenAI({
      apiKey,
      baseURL,
      fetch: async (input, init) => {
        if (typeof init?.body === 'string') {
          try {
            const body = JSON.parse(init.body);
            body.thinking = { type: 'disabled' };
            init = { ...init, body: JSON.stringify(body) };
          } catch {
            // Corps non-JSON : rien à injecter, on relaie tel quel.
          }
        }
        return fetch(input, init);
      },
    });
    return glm(model) as LanguageModel;
  }

  const availableProviders = ['gemini', 'google', 'deepseek', 'claude', 'openai', 'glm'];
  throw new Error(
    `Provider "${provider}" not found for model: ${model}. Available providers: ${availableProviders.join(', ')}. Please check your AI_MODELS_CONFIG.`
  );
}


/**
 * Sélectionne les fichiers qu'une demande concerne réellement.
 *
 * On envoie l'ARBRE et la DEMANDE, jamais la conversation : la version
 * précédente recopiait tout l'historique — c'est-à-dire précisément le contexte
 * qu'elle devait réduire — et le prompt était de surcroît rédigé en chinois,
 * hérité du dépôt amont, dans une langue qui n'est ni celle du produit, ni celle
 * de l'utilisateur, ni celle du reste du prompt.
 */
export async function selectRelevantFiles(
  filesPath: string[],
  request: string
): Promise<string[]> {
  const modelKey = getDefaultModelKey();
  const { apiKey, apiUrl } = resolveModelCredentials(modelKey);

  const { object } = await generateObject({
    model: getOpenAIModel(apiUrl, apiKey, modelKey),
    schema: z.object({
      files: z
        .array(z.string())
        .describe('Paths that must be read or modified to satisfy the request'),
    }),
    messages: [
      {
        role: 'user',
        content: [
          'Project file tree:',
          filesPath.join('\n'),
          '',
          'User request:',
          // Une demande très longue n'aide pas au tri : ses premiers milliers de
          // caractères portent l'intention, le reste est du détail d'exécution.
          request.slice(0, 4000),
          '',
          'Return ONLY the paths needed to satisfy this request. Do not return the whole tree.',
        ].join('\n'),
      },
    ],
  });

  return object.files;
}

export interface StreamingOptions {
  tools?: Record<string, any>;
  toolCallStreaming?: boolean;
  /**
   * Nombre de tours d'outils autorisés avant que le modèle doive conclure.
   * Sans cela le SDK s'arrête au premier appel d'outil et rend un message vide :
   * le mode Plan a besoin d'enchaîner « lister → chercher → lire » avant de
   * pouvoir répondre.
   */
  maxSteps?: number;
  onError?: (error: any) => void;
  onFinish?: (response: any) => Promise<void>;
}

/**
 * Verbose prompt dumps are useful while debugging and enormous in production
 * (a full builder prompt is tens of kilobytes per request). Opt in explicitly.
 */
const DEBUG_PROMPTS = process.env.DEBUG_PROMPTS === 'true';

export function streamTextFn(messages: Messages, options?: StreamingOptions, modelKey?: string) {
  const modelConf = findModelConfig(modelKey ?? '');

  if (!modelConf) {
    throw new Error(`Model configuration not found for model: ${modelKey}`);
  }

  // Les identifiants sont lus ici, pas à l'import du catalogue : `dotenv` ne
  // s'exécute qu'après la phase d'import de server.ts. Un modèle sans clé
  // échoue en nommant sa variable plutôt qu'en empruntant celle d'un autre
  // fournisseur.
  const { apiKey, apiUrl } = resolveModelCredentials(modelConf.modelKey);
  const model = getOpenAIModel(apiUrl, apiKey, modelKey || '') as LanguageModel;

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
    model,
    messages: convertToCoreMessages(newMessages),
    maxRetries: Number.isFinite(maxRetries) ? maxRetries : 1,
    ...generationConfig,
    ...options,
  };

  // Every provider we target accepts a top-level `system`; the SDK maps it to
  // Gemini's `systemInstruction` and to an OpenAI system message.
  if (systemInstruction) {
    streamConfig.system = systemInstruction;
  }

  return streamText(streamConfig);
}
