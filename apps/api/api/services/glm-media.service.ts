/**
 * Les deux capacités GLM qui ne passent pas par le contrat OpenAI : générer une
 * image, et lire une image.
 *
 * Z.ai sert la génération d'image sur son propre endpoint (`/images/generations`)
 * et la vision par le chat multimodal. Ni l'un ni l'autre n'entre dans le
 * `PromptService`, bâti autour de la complétion de texte — d'où ce module, seul
 * endroit où vivent ces appels. Quatre services en avaient besoin ; les y
 * laisser aurait dupliqué quatre fois la même plomberie HTTP, ses en-têtes et
 * ses replis.
 */

import axios from 'axios';

import {
  GLM_ENDPOINTS,
  buildGeminiThinkingConfig,
  getGlmApiKey,
  isGeminiConfigured,
} from '../config/ai-providers.config';
import { getGoogleGenAIClient } from '../config/google-genai.client';
import { AI_CONFIG, GLM_MODELS } from '../config/ai.config';
import logger from '../config/logger';

export interface GeneratedImage {
  buffer: Buffer;
  mimeType: string;
  /** Modèle qui a réellement produit l'image (principal ou repli). */
  model: string;
}

export interface GenerateImageOptions {
  /** Format demandé, ex. `1344x768`. Défaut : paysage. */
  size?: string;
  model?: string;
  fallbackModel?: string;
  /** Étiquette de journalisation, pour retrouver l'appel dans les traces. */
  tag?: string;
}

export interface AnalyzeImageOptions {
  model?: string;
  fallbackModel?: string;
  maxOutputTokens?: number;
  temperature?: number;
}

/**
 * Un fournisseur d'image ou de vision est-il disponible ?
 *
 * Le nom historique (`isGlmConfigured`) est conservé : une quinzaine
 * d'appelants l'utilisent comme garde, et le renommer masquerait le vrai
 * changement — ce n'est plus « GLM est-il là », c'est « quelqu'un peut-il
 * produire une image ».
 *
 * Sans cette extension, une bascule vers Gemini supprimait silencieusement les
 * mises en situation de la charte et les visuels de communication : les pages
 * étaient simplement absentes, sans que rien n'explique pourquoi.
 */
export function isGlmConfigured(): boolean {
  return Boolean(getGlmApiKey()) || isGeminiMediaAvailable();
}

/** Gemini sert-il l'image et la vision sur ce déploiement ? */
export function isGeminiMediaAvailable(): boolean {
  return isGeminiConfigured();
}

/**
 * Quel fournisseur sert le média ?
 *
 * ⚠️ LA BASCULE GLOBALE VAUT AUSSI POUR L'IMAGE.
 *
 * Se contenter de « GLM si sa clé existe » a un défaut mesuré : une clé PRÉSENTE
 * n'est pas une clé qui a des crédits. Après une bascule du texte vers Gemini,
 * l'image restait sur GLM, recevait un 429 à chaque appel, et les mises en
 * situation de la charte disparaissaient du document — silencieusement, puisque
 * l'appelant traite l'échec comme « pas d'image, page omise ».
 *
 * `AI_DEFAULT_PROVIDER` décide donc ici comme ailleurs : texte, image et vision
 * changent de fournisseur ensemble. Une surcharge ciblée reste possible par
 * `IDEM_MEDIA_PROVIDER` pour le cas inverse — garder l'image sur GLM alors que
 * le texte a basculé.
 */
export function mediaProvider(): 'glm' | 'gemini' {
  const forced = (process.env.IDEM_MEDIA_PROVIDER ?? '').toUpperCase();
  if (forced === 'GEMINI' && isGeminiConfigured()) return 'gemini';
  if (forced === 'GLM' && getGlmApiKey()) return 'glm';

  const globalProvider = (process.env.AI_DEFAULT_PROVIDER ?? '').toUpperCase();
  if (globalProvider === 'GEMINI' && isGeminiConfigured()) return 'gemini';
  if (globalProvider === 'GLM' && getGlmApiKey()) return 'glm';

  return getGlmApiKey() ? 'glm' : 'gemini';
}

/** Modèle image de Gemini. `flash-lite` est le plus rapide (~3,5 s mesurés). */
const GEMINI_IMAGE_MODEL = process.env.IDEM_GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-lite-image';
/** Modèle de vision — le modèle de rédaction lit les images nativement. */
const GEMINI_VISION_MODEL = process.env.IDEM_GEMINI_VISION_MODEL || 'gemini-3.6-flash';

/** Génération d'image par Gemini : l'image arrive en `inlineData`. */
async function generateImageWithGemini(
  prompt: string,
  tag?: string
): Promise<GeneratedImage> {
  const startedAt = Date.now();
  const result: any = await getGoogleGenAIClient().models.generateContent({
    model: GEMINI_IMAGE_MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    // Sans cette modalité le modèle répond en TEXTE — il décrit l'image au lieu
    // de la produire, et l'appel réussit en ne rendant rien d'utilisable.
    config: { responseModalities: ['IMAGE'] },
  });

  const parts = result?.candidates?.[0]?.content?.parts ?? [];
  const inline = parts.find((part: any) => part?.inlineData?.data)?.inlineData;

  if (!inline?.data) {
    throw new Error(`${GEMINI_IMAGE_MODEL} n'a renvoyé aucune image`);
  }

  logger.info(
    `Image générée par ${GEMINI_IMAGE_MODEL} en ${Date.now() - startedAt} ms${tag ? ` (${tag})` : ''}`
  );

  return {
    buffer: Buffer.from(inline.data, 'base64'),
    mimeType: inline.mimeType ?? 'image/jpeg',
    model: GEMINI_IMAGE_MODEL,
  };
}

/** Lecture d'image par Gemini : le modèle accepte l'image en entrée nativement. */
async function analyzeImageWithGemini(
  base64: string,
  mimeType: string,
  instruction: string,
  options: AnalyzeImageOptions
): Promise<string> {
  const result: any = await getGoogleGenAIClient().models.generateContent({
    model: GEMINI_VISION_MODEL,
    contents: [
      {
        role: 'user',
        parts: [{ inlineData: { mimeType, data: base64 } }, { text: instruction }],
      },
    ],
    config: {
      maxOutputTokens: options.maxOutputTokens ?? 1500,
      temperature: options.temperature ?? 0.2,
      // Le raisonnement se décompte du budget : sur une lecture d'image à
      // 1 500 tokens, il suffit à vider la réponse.
      ...buildGeminiThinkingConfig(GEMINI_VISION_MODEL, 0),
    },
  });

  const text = result?.text ?? '';
  if (!text.trim()) {
    throw new Error(`${GEMINI_VISION_MODEL} n'a renvoyé aucune analyse`);
  }
  return text;
}

/**
 * Génère une image et rend ses octets.
 *
 * Bascule sur le modèle de repli si le principal échoue : la saturation est par
 * MODÈLE, rejouer le même ne mènerait à rien.
 */
export async function generateImage(
  prompt: string,
  options: GenerateImageOptions = {},
): Promise<GeneratedImage> {
  if (mediaProvider() === 'gemini') {
    return generateImageWithGemini(prompt, options.tag);
  }

  const apiKey = requireKey();
  const model = options.model ?? GLM_MODELS.image;
  const fallbackModel = options.fallbackModel ?? GLM_MODELS.imageFallback;
  const attempt = async (candidate: string): Promise<GeneratedImage> => {
    const started = Date.now();
    const response = await axios.post<{ data?: { url?: string; b64_json?: string }[] }>(
      GLM_ENDPOINTS.images,
      { model: candidate, prompt, size: options.size ?? landscapeFor(candidate) },
      { headers: { Authorization: `Bearer ${apiKey}` }, timeout: IMAGE_TIMEOUT_MS },
    );

    const entry = response.data?.data?.[0];
    const buffer = entry?.b64_json
      ? Buffer.from(entry.b64_json, 'base64')
      : entry?.url
        ? await download(entry.url)
        : null;

    if (!buffer) {
      throw new Error(`${candidate} did not return an image`);
    }

    logger.info(`[GLM] image generated by ${candidate}`, {
      tag: options.tag,
      durationMs: Date.now() - started,
      bytes: buffer.length,
    });
    return { buffer, mimeType: 'image/png', model: candidate };
  };

  try {
    return await attempt(model);
  } catch (error: any) {
    if (fallbackModel === model) {
      throw error;
    }
    logger.warn(`[GLM] ${model} failed (${error?.message}) — falling back to ${fallbackModel}`);
    return attempt(fallbackModel);
  }
}

/**
 * Lit une image et rend la réponse texte du modèle.
 *
 * GLM suit ici le contrat OpenAI : une partie `image_url` portant une data URI,
 * à côté de la consigne. Le raisonnement est coupé — il se décompte du budget
 * de sortie, et sur le petit JSON qu'on attend il le viderait.
 */
export async function analyzeImage(
  base64: string,
  mimeType: string,
  instruction: string,
  options: AnalyzeImageOptions = {},
): Promise<string> {
  if (mediaProvider() === 'gemini') {
    return analyzeImageWithGemini(base64, mimeType, instruction, options);
  }

  const apiKey = requireKey();
  const model = options.model ?? GLM_MODELS.vision;
  const fallbackModel = options.fallbackModel ?? VISION_FALLBACK_MODEL;

  const attempt = async (candidate: string): Promise<string> => {
    const response = await axios.post<{ choices?: { message?: { content?: string } }[] }>(
      `${GLM_ENDPOINTS.base}/chat/completions`,
      {
        model: candidate,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
              { type: 'text', text: instruction },
            ],
          },
        ],
        max_tokens: options.maxOutputTokens ?? 1500,
        temperature: options.temperature ?? 0.1,
        thinking: { type: 'disabled' },
      },
      { headers: { Authorization: `Bearer ${apiKey}` }, timeout: VISION_TIMEOUT_MS },
    );
    return response.data?.choices?.[0]?.message?.content?.trim() ?? '';
  };

  try {
    return await attempt(model);
  } catch (error: any) {
    if (fallbackModel === model) {
      throw error;
    }
    logger.warn(`[GLM] vision failed on ${model} (${error?.message}) — trying ${fallbackModel}`);
    return attempt(fallbackModel);
  }
}

// ---------------------------------------------------------------------------

/**
 * Les deux modèles n'acceptent pas les mêmes dimensions : `glm-image` veut des
 * côtés de 1024 à 2048 divisibles par 32, `cogview-4` de 512 à 2048 divisibles
 * par 16. Un format valide pour l'un est refusé par l'autre — d'où une taille
 * par modèle, et non une constante unique.
 */
const LANDSCAPE_SIZE: Record<string, string> = {
  'glm-image': '1728x960',
  'cogview-4-250304': '1344x768',
};

/** Format retenu quand l'appelant n'en impose pas, pour le modèle visé. */
function landscapeFor(model: string): string {
  return LANDSCAPE_SIZE[model] ?? '1344x768';
}
const IMAGE_TIMEOUT_MS = 120_000;
const VISION_TIMEOUT_MS = 60_000;

/** Repli vision : le modèle gratuit de la même famille. */
const VISION_FALLBACK_MODEL =
  AI_CONFIG.communication.imageSourcing.visionFallbackModel ?? 'glm-4.6v-flash';

function requireKey(): string {
  const apiKey = getGlmApiKey();
  if (!apiKey) {
    throw new Error('GLM_API_KEY is not configured — GLM media calls are unavailable');
  }
  return apiKey;
}

async function download(url: string): Promise<Buffer> {
  const file = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    timeout: IMAGE_TIMEOUT_MS,
  });
  return Buffer.from(file.data);
}
