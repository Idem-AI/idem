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
import { describeError, withRetry } from '../utils/retry';

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
  /** Modèle à employer quand GEMINI sert l'image. Repli : le modèle image par défaut. */
  geminiModel?: string;
  /** Fournisseur imposé, au lieu de la bascule globale (`mediaProvider`). */
  provider?: 'glm' | 'gemini';
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
  tag?: string,
  modelOverride?: string
): Promise<GeneratedImage> {
  const model = modelOverride || GEMINI_IMAGE_MODEL;
  const startedAt = Date.now();
  const result: any = await getGoogleGenAIClient().models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    // Sans cette modalité le modèle répond en TEXTE — il décrit l'image au lieu
    // de la produire, et l'appel réussit en ne rendant rien d'utilisable.
    config: { responseModalities: ['IMAGE'] },
  });

  const parts = result?.candidates?.[0]?.content?.parts ?? [];
  const inline = parts.find((part: any) => part?.inlineData?.data)?.inlineData;

  if (!inline?.data) {
    throw new Error(`${model} n'a renvoyé aucune image`);
  }

  logger.info(
    `Image générée par ${model} en ${Date.now() - startedAt} ms${tag ? ` (${tag})` : ''}`
  );

  return {
    buffer: Buffer.from(inline.data, 'base64'),
    mimeType: inline.mimeType ?? 'image/jpeg',
    model,
  };
}

/**
 * L'erreur Gemini dit-elle que le COMPTE ne peut plus payer ?
 *
 * Crédits prépayés épuisés, facturation désactivée, quota du projet atteint :
 * c'est le compte qui refuse, pas un modèle. Essayer le modèle suivant de la
 * chaîne ne servirait à rien — l'appelant doit changer de fournisseur.
 */
export function isGeminiBillingError(error: unknown): boolean {
  const anyError = error as { status?: number; code?: number; message?: string } | undefined;
  const status = anyError?.status ?? anyError?.code;
  if (status === 402) return true;
  const text = `${anyError?.message ?? ''} ${String(error ?? '')}`;
  return /billing|prepay|credits? (are |is )?(depleted|exhausted|insufficient)|insufficient (funds|balance|credit)|payment required|exceeded your current quota|quota exceeded|RESOURCE_EXHAUSTED/i.test(
    text
  );
}

/** Erreur levée quand le compte Gemini ne peut plus payer : l'appelant bascule. */
export class GeminiBillingError extends Error {
  constructor(readonly cause: unknown) {
    super(`Gemini refuse pour raison de facturation : ${describeError(cause)}`);
    this.name = 'GeminiBillingError';
  }
}

/**
 * Génère une image par GEMINI en parcourant une chaîne de modèles, quel que
 * soit le fournisseur média du déploiement.
 *
 * Réservé aux appelants qui ont CHOISI Gemini pour leur rendu (les mises en
 * situation de la charte) : `generateImage` suit la bascule globale, celui-ci
 * non. La saturation est par modèle, d'où la chaîne ; une panne réseau est
 * rejouée sur le même modèle avant de passer au suivant.
 */
export async function generateImageWithGeminiChain(
  prompt: string,
  models: readonly string[],
  options: {
    tag?: string;
    aspectRatio?: string;
    /** Images jointes à la consigne (ex. le logo à reproduire), avant le texte. */
    images?: { buffer: Buffer; mimeType: string }[];
  } = {},
): Promise<GeneratedImage> {
  if (models.length === 0) {
    throw new Error('generateImageWithGeminiChain : aucun modèle fourni');
  }

  let lastError: unknown;
  for (const [position, model] of models.entries()) {
    try {
      return await withRetry(
        async () => {
          const startedAt = Date.now();
          const result: any = await getGoogleGenAIClient().models.generateContent({
            model,
            contents: [
              {
                role: 'user',
                parts: [
                  ...(options.images ?? []).map((image) => ({
                    inlineData: { mimeType: image.mimeType, data: image.buffer.toString('base64') },
                  })),
                  { text: prompt },
                ],
              },
            ],
            config: {
              responseModalities: ['IMAGE'],
              ...(options.aspectRatio ? { imageConfig: { aspectRatio: options.aspectRatio } } : {}),
            },
          });

          const parts = result?.candidates?.[0]?.content?.parts ?? [];
          const inline = parts.find((part: any) => part?.inlineData?.data)?.inlineData;
          if (!inline?.data) {
            throw new Error(`${model} n'a renvoyé aucune image`);
          }

          logger.info(
            `Image générée par ${model} en ${Date.now() - startedAt} ms${options.tag ? ` (${options.tag})` : ''}`
          );
          return {
            buffer: Buffer.from(inline.data, 'base64'),
            mimeType: inline.mimeType ?? 'image/png',
            model,
          };
        },
        { label: `gemini/${model}` },
      );
    } catch (error) {
      // Le compte ne paie plus : les autres modèles du même compte refuseront
      // de la même façon. On arrête la chaîne, l'appelant change de fournisseur.
      if (isGeminiBillingError(error)) {
        logger.warn(`[GEMINI] ${model} refusé pour facturation — chaîne interrompue`, { tag: options.tag });
        throw new GeminiBillingError(error);
      }
      lastError = error;
      const next = models[position + 1];
      logger.warn(
        `[GEMINI] ${model} a échoué (${describeError(error)})${next ? ` — repli sur ${next}` : ''}`,
        { tag: options.tag },
      );
    }
  }
  throw lastError;
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
  if ((options.provider ?? mediaProvider()) === 'gemini') {
    return generateImageWithGemini(prompt, options.tag, options.geminiModel);
  }

  const apiKey = requireKey();
  const model = options.model ?? GLM_MODELS.image;
  const fallbackModel = options.fallbackModel ?? GLM_MODELS.imageFallback;
  const attempt = async (candidate: string): Promise<GeneratedImage> => {
    const started = Date.now();
    const response = await axios.post<{ data?: { url?: string; b64_json?: string }[] }>(
      GLM_ENDPOINTS.images,
      { model: candidate, prompt, size: fitSize(candidate, options.size ?? landscapeFor(candidate)) },
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

/**
 * Complétion de TEXTE par GLM, en appel direct — hors du routeur.
 *
 * Réservée aux traitements qui doivent rester chez le fournisseur de la
 * plateforme quel que soit le réglage global (`AI_DEFAULT_PROVIDER`,
 * `AI_OVERRIDES`) : relire des données de projet pour en extraire ce qui peut
 * sortir. Passer par `PromptService.runPrompt` les exposerait à une bascule
 * vers un autre fournisseur, c'est-à-dire exactement à la fuite qu'on évite.
 */
export async function completeTextWithGlm(
  prompt: string,
  options: { model?: string; fallbackModel?: string; maxTokens?: number; temperature?: number } = {},
): Promise<string> {
  const apiKey = requireKey();
  const model = options.model ?? GLM_MODELS.writing;
  const fallbackModel = options.fallbackModel ?? GLM_MODELS.mechanical;
  const attempt = async (candidate: string): Promise<string> => {
    const response = await axios.post<{ choices?: { message?: { content?: string } }[] }>(
      `${GLM_ENDPOINTS.base}/chat/completions`,
      {
        model: candidate,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: options.maxTokens ?? 1200,
        temperature: options.temperature ?? 0.4,
        thinking: { type: 'disabled' },
      },
      { headers: { Authorization: `Bearer ${apiKey}` }, timeout: VISION_TIMEOUT_MS },
    );
    return response.data?.choices?.[0]?.message?.content?.trim() ?? '';
  };
  try {
    return await attempt(model);
  } catch (error: any) {
    if (fallbackModel === model) throw error;
    logger.warn(`[GLM] text failed on ${model} (${error?.message}) — trying ${fallbackModel}`);
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

/**
 * Une taille demandée ramenée aux règles du modèle : côtés de 512 à 2048, multiples de 32
 * (`glm-image`) ou de 16 (`cogview-4`). La même demande vaut ainsi pour le modèle et son repli.
 */
export function fitSize(model: string, size: string): string {
  const m = size.match(/^(\d+)x(\d+)$/);
  if (!m) return landscapeFor(model);
  const step = model.startsWith('glm-image') ? 32 : 16;
  const fit = (n: number) => Math.min(2048, Math.max(512, Math.round(n / step) * step));
  return `${fit(Number(m[1]))}x${fit(Number(m[2]))}`;
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

// ---------------------------------------------------------------------------
// Vidéo : CogVideoX-3 (Z.ai), en tâche asynchrone.
// ---------------------------------------------------------------------------

export interface GenerateVideoOptions {
  prompt: string;
  /** Image de départ (image → vidéo), en base64. */
  image?: { base64: string; mimeType: string };
  /** « 1280x720 », « 720x1280 », « 1024x1024 »… (tailles admises par le modèle). */
  size: string;
  durationSec: 5 | 10;
  quality: 'speed' | 'quality';
  tag?: string;
  model?: string;
  timeoutMs?: number;
}

const VIDEO_SIZES = ['1280x720', '720x1280', '1024x1024', '1920x1080', '1080x1920', '2048x1080', '3840x2160'];
const VIDEO_POLL_MS = 6000;

/**
 * Génère un clip et rend son URL (valable un jour chez Z.ai : l'appelant le télécharge).
 *
 * L'image de départ part en data URI ; si le service la refuse sous cette forme (400), elle
 * repart une fois en base64 brut — la documentation accepte « URL ou base64 » sans préciser.
 */
export async function generateVideo(options: GenerateVideoOptions): Promise<{ url: string; coverUrl?: string; model: string }> {
  const apiKey = requireKey();
  const model = options.model ?? AI_CONFIG.communication.videoMedia.videoModel;
  const size = VIDEO_SIZES.includes(options.size) ? options.size : '1280x720';
  const body = (image?: string) => ({
    model,
    prompt: options.prompt.slice(0, 500),
    ...(image ? { image_url: [image] } : {}),
    quality: options.quality,
    with_audio: false,
    size,
    fps: 30,
    duration: options.durationSec,
  });
  const started = Date.now();
  const submit = async (image?: string) =>
    axios.post<{ id?: string; task_status?: string }>(`${GLM_ENDPOINTS.base}/videos/generations`, body(image), {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 60_000,
    });
  let task;
  try {
    task = await submit(options.image ? `data:${options.image.mimeType};base64,${options.image.base64}` : undefined);
  } catch (error: any) {
    if (!options.image || error?.response?.status !== 400) throw error;
    logger.warn('[GLM] video: data URI refused — retrying with raw base64', { tag: options.tag });
    task = await submit(options.image.base64);
  }
  const id = task.data?.id;
  if (!id) throw new Error(`${model} did not return a task id`);

  const timeout = options.timeoutMs ?? AI_CONFIG.communication.videoMedia.clipTimeoutMs;
  for (;;) {
    if (Date.now() - started > timeout) throw new Error(`${model} timed out after ${Math.round(timeout / 1000)} s`);
    await new Promise((resolve) => setTimeout(resolve, VIDEO_POLL_MS));
    const res = await axios.get<{ task_status?: string; video_result?: { url?: string; cover_image_url?: string }[] }>(`${GLM_ENDPOINTS.base}/async-result/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 30_000,
    });
    const status = res.data?.task_status;
    if (status === 'FAIL') throw new Error(`${model} failed (task ${id})`);
    if (status === 'SUCCESS') {
      const result = res.data?.video_result?.[0];
      if (!result?.url) throw new Error(`${model} returned no video`);
      logger.info(`[GLM] clip generated by ${model}`, { tag: options.tag, durationMs: Date.now() - started, size });
      return { url: result.url, coverUrl: result.cover_image_url, model };
    }
  }
}

// ---------------------------------------------------------------------------
// Voix : GLM-TTS (chinois, anglais), repli Gemini TTS pour les autres langues.
// ---------------------------------------------------------------------------

export interface GenerateSpeechOptions {
  text: string;
  /** Langue courte (« fr », « en », « zh »…). */
  language: string;
  /** Fournisseur voulu par le moteur vidéo : `glm` quand GLM-TTS parle la langue. */
  provider: 'glm' | 'gemini';
  voice: string;
  /** Jeu demandé (« warm and confident »). */
  style?: string;
  tag?: string;
}

export interface GeneratedSpeech {
  buffer: Buffer;
  mimeType: string;
  provider: 'glm' | 'gemini';
  model: string;
  voice: string;
}

/** GLM-TTS est servi par la plateforme chinoise de Zhipu (clé distincte de celle de Z.ai). */
const GLM_TTS_URL = () => process.env.GLM_TTS_URL || 'https://open.bigmodel.cn/api/paas/v4/audio/speech';
const glmTtsKey = () => process.env.GLM_TTS_API_KEY || getGlmApiKey();
const SPEECH_TIMEOUT_MS = 60_000;

/** La voix Gemini par défaut quand la voix demandée vient d'un autre fournisseur. */
const GEMINI_DEFAULT_VOICE = 'Sulafat';
const GEMINI_VOICES = new Set(['Kore', 'Puck', 'Zephyr', 'Charon', 'Fenrir', 'Leda', 'Orus', 'Aoede', 'Callirrhoe', 'Autonoe', 'Enceladus', 'Iapetus', 'Umbriel', 'Algieba', 'Despina', 'Erinome', 'Algenib', 'Rasalgethi', 'Laomedeia', 'Achernar', 'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima', 'Achird', 'Zubenelgenubi', 'Vindemiatrix', 'Sadachbia', 'Sadaltager', 'Sulafat']);
const GLM_VOICES = new Set(['tongtong', 'chuichui', 'xiaochen', 'jam', 'kazi', 'douji', 'luodo']);

async function speechWithGlm(options: GenerateSpeechOptions): Promise<GeneratedSpeech> {
  const key = glmTtsKey();
  if (!key) throw new Error('GLM-TTS key missing');
  const model = AI_CONFIG.communication.videoMedia.ttsModel;
  const voice = GLM_VOICES.has(options.voice) ? options.voice : 'tongtong';
  const response = await axios.post<ArrayBuffer>(
    GLM_TTS_URL(),
    { model, input: options.text.slice(0, 1000), voice, response_format: 'wav', speed: 1, volume: 1 },
    { headers: { Authorization: `Bearer ${key}` }, responseType: 'arraybuffer', timeout: SPEECH_TIMEOUT_MS },
  );
  const buffer = Buffer.from(response.data);
  // Une erreur peut revenir en JSON avec un statut 200 : un WAV commence par « RIFF ».
  if (buffer.length < 64 || buffer.subarray(0, 4).toString('ascii') !== 'RIFF') {
    throw new Error(`${model} returned no audio: ${buffer.subarray(0, 160).toString('utf8')}`);
  }
  return { buffer, mimeType: 'audio/wav', provider: 'glm', model, voice };
}

async function speechWithGemini(options: GenerateSpeechOptions): Promise<GeneratedSpeech> {
  const voice = GEMINI_VOICES.has(options.voice) ? options.voice : GEMINI_DEFAULT_VOICE;
  const models = [AI_CONFIG.communication.videoMedia.ttsFallbackModel, 'gemini-3.1-flash-tts-preview'].filter((m, i, all) => all.indexOf(m) === i);
  let lastError: unknown;
  for (const model of models) {
    try {
      const result: any = await getGoogleGenAIClient().models.generateContent({
        model,
        // La consigne de jeu précède le texte (« Say warm and confident: … ») : le modèle ne la lit pas.
        contents: [{ role: 'user', parts: [{ text: options.style ? `Say ${options.style}: ${options.text}` : options.text }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        },
      });
      const inline = (result?.candidates?.[0]?.content?.parts ?? []).find((part: any) => part?.inlineData?.data)?.inlineData;
      if (!inline?.data) throw new Error(`${model} returned no audio`);
      return { buffer: Buffer.from(inline.data, 'base64'), mimeType: inline.mimeType || 'audio/l16;rate=24000', provider: 'gemini', model, voice };
    } catch (error) {
      if (isGeminiBillingError(error)) throw new GeminiBillingError(error);
      lastError = error;
      logger.warn(`[GEMINI] speech failed on ${model} (${describeError(error)})`, { tag: options.tag });
    }
  }
  throw lastError;
}

/**
 * Dit une ligne de voix off.
 *
 * GLM-TTS quand il parle la langue (et que sa clé existe) ; sinon — ou s'il échoue — Gemini
 * TTS, qui parle français et une centaine de langues. `VIDEO_TTS_FALLBACK=off` coupe le repli :
 * une langue que GLM ne parle pas est alors refusée (`voice_language_unsupported`).
 */
export async function generateSpeech(options: GenerateSpeechOptions): Promise<GeneratedSpeech> {
  const glmSpeaks = AI_CONFIG.communication.videoMedia.ttsLanguages.includes(options.language.slice(0, 2).toLowerCase());
  const fallbackAllowed = process.env.VIDEO_TTS_FALLBACK !== 'off' && isGeminiConfigured();
  if (glmSpeaks && glmTtsKey()) {
    try {
      return await speechWithGlm(options);
    } catch (error) {
      if (!fallbackAllowed) throw error;
      logger.warn(`[GLM] speech failed (${describeError(error)}) — falling back to Gemini TTS`, { tag: options.tag });
    }
  }
  if (!fallbackAllowed) throw new Error(glmSpeaks ? 'voice_unavailable' : 'voice_language_unsupported');
  return speechWithGemini(options);
}
