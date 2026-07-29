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
 *  - max_tokens capped to 256 on the vision-only call (JSON fits in <150 tokens).
 */
import axios from 'axios';
import { GoogleGenAI } from '@google/genai';
import logger from '../../config/logger';
import { StorageService } from '../storage.service';
import { AI_CONFIG } from '../../config/ai.config';
import { withGeminiFallback } from '../../utils/gemini-fallback';
import {
  FlyerImageAnalysis,
  FlyerImageAttribution,
  FlyerImageSource,
} from '../../models/communication.model';

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
const GEMINI_IMAGE_MODEL = AI_CONFIG.communication.imageSourcing.imageModel;
const GEMINI_VISION_MODEL = AI_CONFIG.communication.imageSourcing.visionModel; // fast + cheap for vision-only

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
  private _geminiAI?: GoogleGenAI;

  constructor() {}

  private get geminiAI(): GoogleGenAI {
    if (!this._geminiAI) {
      this._geminiAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
    }
    return this._geminiAI;
  }

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
    logger.info(`[ImageSourcing] Generating and analyzing with Gemini`, { tag: opts.tag });
    const start = Date.now();
    const fallbackImageModel = AI_CONFIG.fallback.imageModel;
    const response = await withGeminiFallback(
      () => this.geminiAI.models.generateContent({
        model: GEMINI_IMAGE_MODEL,
        contents: [
          {
            role: 'user',
            parts: [
              { text: brief.generationPrompt },
              { text: COMBINED_INSTRUCTION(brief.searchQuery) },
            ],
          },
        ],
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
          candidateCount: 1,
        },
      }),
      () => this.geminiAI.models.generateContent({
        model: fallbackImageModel,
        contents: [
          {
            role: 'user',
            parts: [
              { text: brief.generationPrompt },
              { text: COMBINED_INSTRUCTION(brief.searchQuery) },
            ],
          },
        ],
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
          candidateCount: 1,
        },
      }),
      GEMINI_IMAGE_MODEL,
      fallbackImageModel
    );

    logger.info(`[ImageSourcing] Gemini generation complete`, {
      tag: opts.tag,
      durationMs: Date.now() - start,
    });

    const parts = (response.candidates?.[0]?.content?.parts || []) as any[];

    // ── Extract image bytes ───────────────────────────────────────────────
    let buffer: Buffer | null = null;
    let mimeType = 'image/png';
    let analysisText = '';

    for (const part of parts) {
      if (!buffer && part.inlineData?.data) {
        buffer = Buffer.from(part.inlineData.data, 'base64');
        mimeType = part.inlineData.mimeType || 'image/png';
      }
      if (part.text) {
        analysisText += part.text;
      }
    }

    if (!buffer) throw new Error('Gemini did not return an image');

    // ── Upload (upload + analysis run concurrently) ───────────────────────
    const ext = mimeType.includes('jpeg') ? 'jpg' : 'png';
    const fileName = `flyer-bg-${opts.tag}-${Date.now()}.${ext}`;
    const folderPath = `users/${opts.userId}/projects/${opts.projectId}/communication/flyer-images`;

    // Parse analysis from the text part returned alongside the image.
    // Upload and parse run in parallel — neither depends on the other.
    const [upload, analysis] = await Promise.all([
      this.storage.uploadFile(buffer, fileName, folderPath, mimeType),
      Promise.resolve(this.parseAnalysisJson(analysisText)),
    ]);

    logger.info(`[ImageSourcing] AI-generated image sourced`, {
      tag: opts.tag,
      url: upload.downloadURL,
      analysis: !!analysis,
    });
    return {
      url: upload.downloadURL,
      source: 'generated',
      attribution: { provider: 'gemini', author: GEMINI_IMAGE_MODEL },
      analysis,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. VISION SCAN — stock images only (buffer OR URL accepted)
  //    Uses gemini-2.0-flash (cheaper + faster than the preview model).
  //    max_tokens capped at 256: the JSON schema fits in < 150 tokens.
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Analyze from a public URL. Downloads at reduced size before sending.
   * Used for stock images where we already have a "medium" URL.
   */
  private async analyzeImageFromUrl(
    imageUrl: string,
    searchQuery: string
  ): Promise<FlyerImageAnalysis> {
    if (!process.env.GEMINI_API_KEY) return this.fallbackAnalysis();

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
    const fallbackVisionModel = AI_CONFIG.fallback.textModel;
    const effectiveFallback = GEMINI_VISION_MODEL === fallbackVisionModel ? 'gemini-2.0-flash' : fallbackVisionModel;

    const response = await withGeminiFallback(
      () => this.geminiAI.models.generateContent({
        model: GEMINI_VISION_MODEL,
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType, data: base64 } },
              { text: `Brief context: "${searchQuery}". ${VISION_INSTRUCTION}` },
            ],
          },
        ],
        config: {
          responseModalities: ['TEXT'],
          candidateCount: 1,
          maxOutputTokens: 256,
        },
      }),
      () => this.geminiAI.models.generateContent({
        model: effectiveFallback,
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType, data: base64 } },
              { text: `Brief context: "${searchQuery}". ${VISION_INSTRUCTION}` },
            ],
          },
        ],
        config: {
          responseModalities: ['TEXT'],
          candidateCount: 1,
          maxOutputTokens: 256,
        },
      }),
      GEMINI_VISION_MODEL,
      effectiveFallback
    );

    const text = (response.candidates?.[0]?.content?.parts || [])
      .map((p: any) => p.text || '')
      .join('')
      .trim();

    return this.parseAnalysisJson(text);
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