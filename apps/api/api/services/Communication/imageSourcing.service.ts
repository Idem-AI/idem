/**
 * ImageSourcingService — optimized image pipeline.
 *
 * Optimizations vs. original:
 *  - generateAIImage + analyzeImage MERGED into one Gemini call (saves one
 *    full round-trip + re-download of the generated image).
 *  - analyzeImage for stock images uses a smaller image size (medium ~1200px)
 *    instead of large2x (~4000px), cutting base64 payload by ~85%.
 *  - analyzeImage accepts raw Buffer directly (no HTTP re-fetch needed when
 *    the bytes are already in memory).
 *  - Pexels: fetch medium URL for analysis, keep large URL for the flyer.
 *  - vision-only call kept lean (small image + short JSON schema); its budget
 *    and its fallback model live in ai.config.ts (`communication.imageSourcing`).
 */
import axios from 'axios';
import logger from '../../config/logger';
import { StorageService } from '../storage.service';
import { AI_CONFIG } from '../../config/ai.config';
import {
  FlyerImageAnalysis,
  FlyerImageAttribution,
  FlyerImageSource,
} from '../../models/communication.model';
import { analyzeImage, generateImage, isGlmConfigured } from '../glm-media.service';

export interface SourcedImage {
  url: string;
  source: FlyerImageSource;
  attribution: FlyerImageAttribution;
  analysis: FlyerImageAnalysis;
}

export interface ImageBrief {
  searchQuery: string;
  generationPrompt: string;
  preferGenerated?: boolean;
  orientation?: 'portrait' | 'landscape' | 'square';
}

// ─── Gemini model names ────────────────────────────────────────────────────
// Modèles ET replis viennent d'ai.config.ts : le repli était auparavant déduit
// de `AI_CONFIG.fallback` (le repli texte global), qui n'a rien à voir avec ce
// que fait ce service.
const IMAGE_SOURCING_CONFIG = AI_CONFIG.communication.imageSourcing;
const GLM_IMAGE_MODEL = IMAGE_SOURCING_CONFIG.imageModel;
const GLM_IMAGE_FALLBACK_MODEL = IMAGE_SOURCING_CONFIG.imageFallbackModel;
const GLM_VISION_MODEL = IMAGE_SOURCING_CONFIG.visionModel;
const GLM_VISION_FALLBACK_MODEL = IMAGE_SOURCING_CONFIG.visionFallbackModel;
const VISION_MAX_OUTPUT_TOKENS = IMAGE_SOURCING_CONFIG.visionMaxOutputTokens;


const PEXELS_ENDPOINT = 'https://api.pexels.com/v1/search';

// ─── Shared vision instruction (kept short → fewer input tokens) ──────────
const VISION_INSTRUCTION = `Return ONLY strict JSON, no prose, no fences:
{"subject":string,"mood":string,"dominantColors":string[],"luminance":"dark"|"light"|"mixed","composition":string,"detectedText":string}
Rules: subject<=80 chars, mood=1-3 adjectives, dominantColors=3-5 hex primary-first, composition<=120 chars.`;

// ─── Combined generation + analysis instruction ───────────────────────────
const COMBINED_INSTRUCTION = (searchQuery: string) =>
  `Generate the image described above.
Then return ONLY this strict JSON on a NEW LINE after the image (no prose, no fences):
{"subject":string,"mood":string,"dominantColors":string[],"luminance":"dark"|"light"|"mixed","composition":string,"detectedText":string}
Rules: subject<=80 chars describing "${searchQuery}", mood=1-3 adjectives, dominantColors=3-5 hex, composition<=120 chars empty-space guide.`;

export class ImageSourcingService {
  private readonly storage = new StorageService();

  constructor() {}


  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC ENTRY POINT
  // ─────────────────────────────────────────────────────────────────────────

  async sourceImage(
    brief: ImageBrief,
    opts: { userId: string; projectId: string; tag: string }
  ): Promise<SourcedImage> {
    logger.info(`[ImageSourcing] Sourcing image`, { tag: opts.tag, searchQuery: brief.searchQuery });
    // ── Path A: stock image ──────────────────────────────────────────────
    if (!brief.preferGenerated && process.env.PEXELS_API_KEY) {
      try {
        const stockHit = await this.searchPexels(brief);
        if (stockHit) {
          // Analyze using the smaller "medium" URL — no large2x needed here.
          const analysis = await this.analyzeImageFromUrl(
            stockHit.mediumUrl,
            brief.searchQuery
          ).catch(() => this.fallbackAnalysis());

          logger.info(`[ImageSourcing] Stock image found and analyzed`, { tag: opts.tag, url: stockHit.url });
          return {
            url: stockHit.url,           // full-res for the flyer
            source: 'stock',
            attribution: stockHit.attribution,
            analysis,
          };
        }
      } catch (err: any) {
        logger.warn('Pexels search failed, falling back to generation', { error: err.message });
      }
    }

    // ── Path B: generate + analyze in ONE Gemini call ────────────────────
    return this.generateAndAnalyze(brief, opts);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 1. PEXELS STOCK SEARCH
  //    Returns both a full-res URL (flyer) and a medium URL (analysis).
  // ─────────────────────────────────────────────────────────────────────────

  private async searchPexels(brief: ImageBrief): Promise<{
    url: string;
    mediumUrl: string;
    attribution: FlyerImageAttribution;
  } | null> {
    const apiKey = process.env.PEXELS_API_KEY!;
    const orientation =
      brief.orientation === 'portrait' ? 'portrait'
      : brief.orientation === 'landscape' ? 'landscape'
      : 'square';

    const response = await axios.get(PEXELS_ENDPOINT, {
      headers: { Authorization: apiKey },
      params: { query: brief.searchQuery, per_page: 5, orientation },
      timeout: 8000,
    });

    const photos: any[] = response.data?.photos || [];
    if (!photos.length) {
      logger.info(`[ImageSourcing] No stock photos found for query`, { query: brief.searchQuery });
      return null;
    }

    const best = photos[0];
    const url: string = best.src?.large2x || best.src?.large || best.src?.original;
    // "medium" is ~1200px wide — plenty for color/composition analysis, ~85% smaller payload.
    const mediumUrl: string = best.src?.medium || url;
    if (!url) return null;

    logger.info(`[ImageSourcing] Pexels hit`, { author: best.photographer, url });
    return {
      url,
      mediumUrl,
      attribution: {
        provider: 'pexels',
        author: best.photographer,
        sourceUrl: best.url,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. GENERATE + ANALYZE — single Gemini multimodal call
  //    Gemini returns [IMAGE part] + [TEXT part with JSON analysis].
  //    One network round-trip instead of two. No re-download needed.
  // ─────────────────────────────────────────────────────────────────────────

  private async generateAndAnalyze(
    brief: ImageBrief,
    opts: { userId: string; projectId: string; tag: string }
  ): Promise<SourcedImage> {
    logger.info(`[ImageSourcing] Generating with ${GLM_IMAGE_MODEL}`, { tag: opts.tag });
    const start = Date.now();

    // Z.ai sépare ce que Gemini faisait d'un bloc : l'image vient d'un
    // endpoint dédié, l'analyse d'un appel de vision. Deux allers-retours au
    // lieu d'un, mais l'analyse porte alors sur l'image réellement produite.
    const generated = await generateImage(brief.generationPrompt, {
      model: GLM_IMAGE_MODEL,
      fallbackModel: GLM_IMAGE_FALLBACK_MODEL,
      tag: opts.tag,
    });
    const buffer = generated.buffer;
    const mimeType = generated.mimeType;

    logger.info(`[ImageSourcing] Generation complete`, {
      tag: opts.tag,
      durationMs: Date.now() - start,
      bytes: buffer.length,
    });

    const fileName = `flyer-bg-${opts.tag}-${Date.now()}.png`;
    const folderPath = `users/${opts.userId}/projects/${opts.projectId}/communication/flyer-images`;

    // Téléversement et analyse ne dépendent pas l'un de l'autre.
    const [upload, analysis] = await Promise.all([
      this.storage.uploadFile(buffer, fileName, folderPath, mimeType),
      this.analyzeImageFromBase64(buffer.toString('base64'), mimeType, brief.searchQuery),
    ]);

    logger.info(`[ImageSourcing] AI-generated image sourced`, {
      tag: opts.tag,
      url: upload.downloadURL,
      analysis: !!analysis,
    });
    return {
      url: upload.downloadURL,
      source: 'generated',
      attribution: { provider: 'glm', author: generated.model },
      analysis,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. VISION SCAN — stock images only (buffer OR URL accepted)
  //    Modèle et repli viennent de AI_CONFIG.communication.imageSourcing —
  //    ne pas les redire ici, le commentaire dérivait de la configuration.
  //    Budget: visionMaxOutputTokens (le schéma JSON tient en < 150 tokens,
  //    mais le raisonnement est décompté du même budget).
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Analyze from a public URL. Downloads at reduced size before sending.
   * Used for stock images where we already have a "medium" URL.
   */
  private async analyzeImageFromUrl(
    imageUrl: string,
    searchQuery: string
  ): Promise<FlyerImageAnalysis> {
    if (!isGlmConfigured()) return this.fallbackAnalysis();

    const fetched = await axios.get<ArrayBuffer>(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 10000,
    });
    const mimeType = (fetched.headers['content-type'] as string) || 'image/jpeg';
    const base64 = Buffer.from(fetched.data).toString('base64');

    return this.analyzeImageFromBase64(base64, mimeType, searchQuery);
  }

  /**
   * Core vision call. Accepts already-encoded base64 to avoid re-encoding.
   */
  private async analyzeImageFromBase64(
    base64: string,
    mimeType: string,
    searchQuery: string
  ): Promise<FlyerImageAnalysis> {
    if (!isGlmConfigured()) return this.fallbackAnalysis();

    try {
      const raw = await analyzeImage(
        base64,
        mimeType,
        `Brief context: "${searchQuery}". ${VISION_INSTRUCTION}`,
        {
          model: GLM_VISION_MODEL,
          fallbackModel: GLM_VISION_FALLBACK_MODEL,
          maxOutputTokens: VISION_MAX_OUTPUT_TOKENS,
        }
      );
      return this.parseAnalysisJson(raw);
    } catch (error: any) {
      // Une analyse manquée ne doit pas emporter le visuel : on compose alors
      // sur une lecture neutre.
      logger.warn(`[ImageSourcing] Vision unavailable: ${error?.message}`);
      return this.fallbackAnalysis();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Robust JSON extraction: handles leading prose, code fences, and
   * the mixed TEXT+IMAGE response where JSON appears after image metadata.
   */
  private parseAnalysisJson(raw: string): FlyerImageAnalysis {
    // Find the first '{' — the JSON always starts there even with leading text.
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1) {
      logger.warn('analyzeImage: no JSON object found in response', { preview: raw.slice(0, 160) });
      return this.fallbackAnalysis();
    }

    try {
      const parsed = JSON.parse(raw.slice(start, end + 1));
      return {
        subject: parsed.subject || '',
        mood: parsed.mood || '',
        dominantColors: Array.isArray(parsed.dominantColors)
          ? parsed.dominantColors.slice(0, 5)
          : [],
        luminance:
          parsed.luminance === 'dark' || parsed.luminance === 'light'
            ? parsed.luminance
            : 'mixed',
        composition: parsed.composition || '',
        detectedText: parsed.detectedText || '',
      };
    } catch (err) {
      logger.warn('analyzeImage: JSON.parse failed', { preview: raw.slice(start, start + 160) });
      return this.fallbackAnalysis();
    }
  }

  /** Also exported for direct use in tests or one-off analysis. */
  async analyzeImage(imageUrl: string, brief: ImageBrief): Promise<FlyerImageAnalysis> {
    return this.analyzeImageFromUrl(imageUrl, brief.searchQuery);
  }

  private fallbackAnalysis(): FlyerImageAnalysis {
    return {
      subject: '',
      mood: '',
      dominantColors: [],
      luminance: 'mixed',
      composition: '',
      detectedText: '',
    };
  }
}

export const imageSourcingService = new ImageSourcingService();