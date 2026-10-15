/**
 * Les médias de la plateforme, tous servis par OpenRouter : générer une image,
 * lire une image, générer un clip, dire une ligne de voix off.
 *
 * Ni l'image, ni la vision, ni la vidéo, ni la voix n'entrent dans le
 * `PromptService`, bâti autour de la complétion de texte — d'où ce module, seul
 * endroit où vivent ces appels. Plusieurs services en avaient besoin ; les y
 * laisser aurait dupliqué la plomberie HTTP, ses en-têtes et ses replis.
 *
 *   · Image   — `POST /images` (FLUX.2 klein 4B, poids ouverts).
 *   · Vision  — chat multimodal OpenAI (Qwen3.5, Qwen3-VL).
 *   · Vidéo   — `POST /videos`, asynchrone (Seedance 2.0 : dérogation produit,
 *               aucun modèle vidéo ouvert n'existe sur OpenRouter).
 *   · Voix    — `POST /audio/speech` (Kokoro 82M), ou votre serveur
 *               OpenAI-compatible servant Qwen3-TTS / Chatterbox (`IDEM_TTS_URL`).
 *
 * Les modèles viennent de la liste blanche (`openrouter.config.ts`) : un nom hors
 * liste, ou fermé sans dérogation, est ignoré au profit du défaut.
 */

import axios from 'axios';

import logger from '../config/logger';
import { AI_CONFIG } from '../config/ai.config';
import {
  DEFAULT_VIDEO_MODEL,
  KOKORO_VOICES,
  OPENROUTER_BASE_URL,
  SPEECH_MODEL_DEFAULT,
  getOpenRouterApiKey,
  isAllowedOpenRouterModel,
  openRouterHeaders,
  openRouterRouting,
  resolveOpenRouterModel,
} from '../config/openrouter.config';
import { LLMProvider } from '../config/ai.config';
import { getProvider } from '../config/ai-providers.config';
import { describeError } from '../utils/retry';

const IMAGE_TIMEOUT_MS = 120_000;
const VISION_TIMEOUT_MS = 60_000;
const SPEECH_TIMEOUT_MS = 60_000;
const VIDEO_POLL_MS = 10_000;

// ---------------------------------------------------------------------------
// Commun
// ---------------------------------------------------------------------------

/** Un média peut-il être produit ? (clé OpenRouter présente) */
export function isMediaConfigured(): boolean {
  return Boolean(getOpenRouterApiKey());
}

function headers(): Record<string, string> {
  const key = getOpenRouterApiKey();
  if (!key) throw new Error('OPENROUTER_API_KEY is not configured — media calls are unavailable');
  return { Authorization: `Bearer ${key}`, ...openRouterHeaders() };
}

/**
 * Un nom de modèle venu d'un appelant est-il un identifiant OpenRouter ?
 * Ils portent toujours un « éditeur/ » ; un autre nom ne doit jamais leur être envoyé.
 */
const isOpenRouterId = (model?: string): model is string => Boolean(model && model.includes('/'));

/** Le modèle demandé s'il est autorisé, sinon le défaut du rôle. */
function allowedOrDefault(
  requested: string | undefined,
  role: 'image' | 'vision'
): string {
  return isOpenRouterId(requested) && isAllowedOpenRouterModel(requested)
    ? requested
    : resolveOpenRouterModel(role, (message) => logger.warn(`[OPENROUTER] ${message}`));
}

/** Ratios acceptés par les modèles d'image et de vidéo d'OpenRouter. */
const ASPECT_RATIOS: [string, number][] = [
  ['21:9', 21 / 9], ['16:9', 16 / 9], ['3:2', 3 / 2], ['4:3', 4 / 3], ['5:4', 5 / 4], ['1:1', 1],
  ['4:5', 4 / 5], ['3:4', 3 / 4], ['2:3', 2 / 3], ['9:16', 9 / 16],
];

/** « 1344x768 » → le ratio supporté le plus proche (« 16:9 »). */
export function aspectRatioFor(size?: string): string {
  const match = /^(\d+)x(\d+)$/.exec(size ?? '');
  if (!match) return '16:9';
  const ratio = Number(match[1]) / Number(match[2]);
  return ASPECT_RATIOS.reduce((best, current) =>
    Math.abs(current[1] - ratio) < Math.abs(best[1] - ratio) ? current : best
  )[0];
}

// ---------------------------------------------------------------------------
// Image
// ---------------------------------------------------------------------------

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
  /**
   * Images de RÉFÉRENCE (https ou data-URI) : le modèle les reprend dans l'image (le logo d'une marque imprimé
   * sur un support). FLUX.2 klein en lit 4, Gemini 14 (`input_references` de l'API Images d'OpenRouter).
   */
  references?: string[];
}

export interface AnalyzeImageOptions {
  model?: string;
  fallbackModel?: string;
  maxOutputTokens?: number;
  temperature?: number;
}

function extractApiErrorMessage(error: any): string {
  const apiMessage = error?.response?.data?.error?.message;
  if (apiMessage) {
    const status = error.response?.status ? `HTTP ${error.response.status}: ` : '';
    return `${status}${apiMessage}`;
  }
  return error?.message || String(error);
}

/**
 * Génère une image et rend ses octets. Bascule sur le modèle de repli si le
 * principal échoue : la saturation est par MODÈLE, rejouer le même ne mènerait à rien.
 */
export async function generateImage(
  prompt: string,
  options: GenerateImageOptions = {}
): Promise<GeneratedImage> {
  const model = allowedOrDefault(options.model, 'image');
  const envFallback = process.env.IDEM_OPENROUTER_IMAGE_FALLBACK_MODEL?.trim();
  const fallback = [options.fallbackModel, envFallback].find(
    (candidate): candidate is string =>
      isOpenRouterId(candidate) && candidate !== model && isAllowedOpenRouterModel(candidate)
  );

  const attempt = async (candidate: string): Promise<GeneratedImage> => {
    const started = Date.now();
    let response;
    try {
      response = await axios.post<{ data?: { b64_json?: string; media_type?: string }[] }>(
        `${OPENROUTER_BASE_URL()}/images`,
        {
          model: candidate,
          prompt,
          n: 1,
          aspect_ratio: aspectRatioFor(options.size),
          output_format: 'png',
          ...(options.references?.length ? { input_references: options.references.slice(0, 4).map((url) => ({ type: 'image_url', image_url: { url } })) } : {}),
          ...openRouterRouting(),
        },
        { headers: headers(), timeout: IMAGE_TIMEOUT_MS }
      );
    } catch (err: any) {
      throw new Error(extractApiErrorMessage(err));
    }

    const entry = response.data?.data?.[0];
    if (!entry?.b64_json) throw new Error(`${candidate} n'a renvoyé aucune image`);

    const buffer = Buffer.from(entry.b64_json, 'base64');
    logger.info(`[OPENROUTER] image generated by ${candidate}`, {
      tag: options.tag,
      durationMs: Date.now() - started,
      bytes: buffer.length,
    });
    return { buffer, mimeType: entry.media_type || 'image/png', model: candidate };
  };

  try {
    return await attempt(model);
  } catch (error: any) {
    if (!fallback) throw error;
    logger.warn(`[OPENROUTER] ${model} failed (${error?.message}) — falling back to ${fallback}`);
    return attempt(fallback);
  }
}

/**
 * Lit une image et rend la réponse texte du modèle. Le raisonnement est coupé —
 * il se décompte du budget de sortie, et sur le petit JSON qu'on attend il le viderait.
 */
export async function analyzeImage(
  base64: string,
  mimeType: string,
  instruction: string,
  options: AnalyzeImageOptions = {}
): Promise<string> {
  const model = allowedOrDefault(options.model, 'vision');
  // Repli : le modèle de lecture de texte (autre taille, autres poids).
  const requestedFallback = isOpenRouterId(options.fallbackModel) && isAllowedOpenRouterModel(options.fallbackModel)
    ? options.fallbackModel
    : undefined;
  const fallback = requestedFallback ?? getProvider(LLMProvider.OPENROUTER).models?.ocr;

  const attempt = async (candidate: string): Promise<string> => {
    let response;
    try {
      response = await axios.post<{ choices?: { message?: { content?: string } }[] }>(
        `${OPENROUTER_BASE_URL()}/chat/completions`,
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
          reasoning: { enabled: false },
          ...openRouterRouting(),
        },
        { headers: headers(), timeout: VISION_TIMEOUT_MS }
      );
    } catch (err: any) {
      throw new Error(extractApiErrorMessage(err));
    }
    return response.data?.choices?.[0]?.message?.content?.trim() ?? '';
  };

  try {
    return await attempt(model);
  } catch (error: any) {
    if (!fallback || fallback === model) throw error;
    logger.warn(`[OPENROUTER] vision failed on ${model} (${error?.message}) — trying ${fallback}`);
    return attempt(fallback);
  }
}

// ---------------------------------------------------------------------------
// Vidéo : POST /videos, tâche asynchrone.
// ---------------------------------------------------------------------------

export interface GenerateVideoOptions {
  prompt: string;
  /** Image de départ (image → vidéo), en base64. */
  image?: { base64: string; mimeType: string };
  /** « 1280x720 », « 720x1280 », « 1024x1024 »… */
  size: string;
  /** Veo n'accepte que 4, 6 ou 8 s ; Seedance, 5 ou 10. */
  durationSec: 4 | 5 | 6 | 8 | 10;
  quality?: 'speed' | 'quality';
  tag?: string;
  model?: string;
  timeoutMs?: number;
}

/**
 * Aucun modèle vidéo d'OpenRouter n'a de poids ouverts. Seedance 2.0 (ByteDance)
 * est retenu par DÉROGATION produit (`allowClosed` dans la liste blanche) : fermé,
 * non auto-hébergeable, mais autorisé sans couper `OPENROUTER_OPEN_ONLY`.
 * `IDEM_OPENROUTER_VIDEO_MODEL` choisit une autre variante (`-fast`, `-mini`) ou un
 * candidat de test (Wan, avec `OPENROUTER_OPEN_ONLY=off`).
 */
export function openRouterVideoModel(): string | undefined {
  const model = process.env.IDEM_OPENROUTER_VIDEO_MODEL?.trim() || DEFAULT_VIDEO_MODEL;
  return isAllowedOpenRouterModel(model) ? model : undefined;
}

/**
 * Génère un clip et le rend sous forme d'URL `data:`.
 *
 * Le contenu d'OpenRouter exige la clé dans l'en-tête, alors que le moteur
 * télécharge l'URL sans en-tête : on lui donne donc la vidéo elle-même (axios
 * sait lire une URL `data:`).
 */
export async function generateVideo(
  options: GenerateVideoOptions
): Promise<{ url: string; coverUrl?: string; model: string }> {
  const model =
    (isOpenRouterId(options.model) && isAllowedOpenRouterModel(options.model)
      ? options.model
      : undefined) ?? openRouterVideoModel();
  if (!model) throw new Error('video_model_unavailable');

  const auth = headers();
  const started = Date.now();
  const timeoutMs = options.timeoutMs ?? AI_CONFIG.communication.videoMedia.clipTimeoutMs;
  const resolution = Number(options.size.split('x')[1] ?? 720) >= 1000 ? '1080p' : '720p';

  const submit = await axios.post<{ id?: string; polling_url?: string }>(
    `${OPENROUTER_BASE_URL()}/videos`,
    {
      model,
      prompt: options.prompt.slice(0, 1500),
      resolution,
      aspect_ratio: aspectRatioFor(options.size),
      duration: options.durationSec,
      generate_audio: false,
      ...(options.image
        ? {
            frame_images: [
              {
                type: 'image_url',
                image_url: { url: `data:${options.image.mimeType};base64,${options.image.base64}` },
                frame_type: 'first_frame',
              },
            ],
          }
        : {}),
      ...openRouterRouting(),
    },
    { headers: auth, timeout: 60_000 }
  );
  const pollingUrl = submit.data?.polling_url;
  if (!pollingUrl) throw new Error(`${model} did not return a polling url`);

  for (;;) {
    if (Date.now() - started > timeoutMs) {
      throw new Error(`${model} timed out after ${Math.round(timeoutMs / 1000)} s`);
    }
    await new Promise((resolve) => setTimeout(resolve, VIDEO_POLL_MS));
    const poll = await axios.get<{ status?: string; unsigned_urls?: string[]; error?: string | null }>(
      pollingUrl,
      { headers: auth, timeout: 30_000 }
    );
    if (poll.data?.status === 'failed') throw new Error(`${model} failed: ${poll.data.error ?? 'unknown'}`);
    if (poll.data?.status !== 'completed') continue;

    const contentUrl = poll.data.unsigned_urls?.[0];
    if (!contentUrl) throw new Error(`${model} returned no video`);
    const file = await axios.get<ArrayBuffer>(contentUrl, {
      headers: auth,
      responseType: 'arraybuffer',
      timeout: 120_000,
    });
    logger.info(`[OPENROUTER] clip generated by ${model}`, {
      tag: options.tag,
      durationMs: Date.now() - started,
      size: options.size,
      bytes: file.data.byteLength,
    });
    return { url: `data:video/mp4;base64,${Buffer.from(file.data).toString('base64')}`, model };
  }
}

// ---------------------------------------------------------------------------
// Voix : /audio/speech — OpenRouter (Kokoro), ou un serveur auto-hébergé.
// ---------------------------------------------------------------------------

export interface GenerateSpeechOptions {
  text: string;
  /** Langue courte (« fr », « en »…). */
  language: string;
  tag?: string;
}

export interface GeneratedSpeech {
  buffer: Buffer;
  mimeType: string;
  provider: 'openrouter';
  model: string;
  voice: string;
}

/**
 * Où dire la ligne ?
 *
 * 1. `IDEM_TTS_URL` : VOTRE serveur OpenAI-compatible (`/audio/speech`) servant
 *    Qwen3-TTS ou Chatterbox Multilingual — les deux candidats ouverts, absents
 *    d'OpenRouter. C'est la trajectoire d'auto-hébergement ; `IDEM_TTS_MODEL` est
 *    obligatoire, `IDEM_TTS_VOICE_<LANGUE>` (ex. `IDEM_TTS_VOICE_FR`) ou
 *    `IDEM_TTS_VOICE` choisit la voix, `IDEM_TTS_API_KEY` est facultative.
 * 2. OpenRouter : `IDEM_OPENROUTER_TTS_MODEL` s'il est autorisé, sinon Kokoro 82M
 *    (Apache-2.0, voix française `ff_siwis`).
 *
 * Une langue sans voix lève `voice_language_unsupported` : iVision crée alors la
 * vidéo sans voix plutôt que d'échouer.
 */
export async function generateSpeech(options: GenerateSpeechOptions): Promise<GeneratedSpeech> {
  const lang = options.language.slice(0, 2).toLowerCase();
  const selfHosted = process.env.IDEM_TTS_URL?.trim();

  let base: string;
  let model: string;
  let voice: string | undefined;
  let authHeaders: Record<string, string>;

  if (selfHosted) {
    base = selfHosted.replace(/\/$/, '');
    model = process.env.IDEM_TTS_MODEL?.trim() || '';
    if (!model) throw new Error('IDEM_TTS_MODEL is required with IDEM_TTS_URL');
    voice =
      process.env[`IDEM_TTS_VOICE_${lang.toUpperCase()}`]?.trim() ||
      process.env.IDEM_TTS_VOICE?.trim();
    const key = process.env.IDEM_TTS_API_KEY?.trim();
    authHeaders = key ? { Authorization: `Bearer ${key}` } : {};
  } else {
    base = OPENROUTER_BASE_URL();
    const wanted = process.env.IDEM_OPENROUTER_TTS_MODEL?.trim();
    model = wanted && isAllowedOpenRouterModel(wanted) ? wanted : SPEECH_MODEL_DEFAULT;
    voice =
      model === SPEECH_MODEL_DEFAULT
        ? KOKORO_VOICES[lang]
        : process.env.IDEM_OPENROUTER_TTS_VOICE?.trim();
    authHeaders = headers();
  }

  if (!voice) throw new Error('voice_language_unsupported');

  const started = Date.now();
  try {
    const response = await axios.post<ArrayBuffer>(
      `${base}/audio/speech`,
      { model, input: options.text.slice(0, 1000), voice, response_format: 'mp3' },
      { headers: authHeaders, responseType: 'arraybuffer', timeout: SPEECH_TIMEOUT_MS }
    );
    const buffer = Buffer.from(response.data);
    // Une erreur peut revenir en JSON : l'audio, lui, ne commence pas par « { ».
    if (buffer.length < 256 || buffer[0] === 0x7b) {
      throw new Error(`${model} returned no audio: ${buffer.subarray(0, 160).toString('utf8')}`);
    }
    logger.info(`[OPENROUTER] speech by ${model}`, {
      tag: options.tag,
      durationMs: Date.now() - started,
      bytes: buffer.length,
      selfHosted: Boolean(selfHosted),
    });
    return { buffer, mimeType: 'audio/mpeg', provider: 'openrouter', model, voice };
  } catch (error) {
    logger.warn(`[OPENROUTER] speech failed on ${model} (${describeError(error)})`, { tag: options.tag });
    throw error;
  }
}
