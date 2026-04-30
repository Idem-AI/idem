/**
 * ImageSourcingService — smart image pipeline for the Communication feature.
 *
 * Strategy (token-aware):
 *   1. searchStockImage()  → free stock APIs (Pexels first, Unsplash optional).
 *      Cheap, fast. Tried FIRST so we don't burn image-generation tokens.
 *   2. generateAIImage()   → Gemini "image preview" model. Used ONLY if no
 *      stock image matches the brief. Uploaded to MinIO so the URL is stable.
 *   3. analyzeImage()      → Gemini multimodal vision pass. Returns subject /
 *      mood / dominant colors / luminance / composition so the downstream
 *      flyer prompt can produce copy + layout coherent with the picture.
 *
 * The service is fully self-contained: it does not know about flyers or
 * brand identity, only about images. The Communication pipeline orchestrates.
 */
import axios from 'axios';
import { GoogleGenAI } from '@google/genai';
import logger from '../../config/logger';
import { StorageService } from '../storage.service';
import {
  FlyerImageAnalysis,
  FlyerImageAttribution,
  FlyerImageSource,
} from '../../models/communication.model';

export interface SourcedImage {
  /** Public URL of the chosen / generated image (always reachable). */
  url: string;
  source: FlyerImageSource;
  attribution: FlyerImageAttribution;
  analysis: FlyerImageAnalysis;
}

export interface ImageBrief {
  /** Short search query, e.g. "diverse team brainstorming startup office". */
  searchQuery: string;
  /** Generation prompt used if no stock image matches. */
  generationPrompt: string;
  /** Hard skip stock search (e.g. very brand-specific scene). */
  preferGenerated?: boolean;
  /** Aspect ratio target (helps both stock filter + generation). */
  orientation?: 'portrait' | 'landscape' | 'square';
}

const PEXELS_ENDPOINT = 'https://api.pexels.com/v1/search';

export class ImageSourcingService {
  private readonly storage = new StorageService();
  private readonly geminiAI: GoogleGenAI;

  constructor() {
    this.geminiAI = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || '',
    });
  }

  /**
   * Source an image for a given brief. Tries stock first, falls back to AI gen,
   * then runs a vision scan on whatever was chosen.
   */
  async sourceImage(
    brief: ImageBrief,
    opts: { userId: string; projectId: string; tag: string }
  ): Promise<SourcedImage> {
    const { userId, projectId, tag } = opts;

    let stockHit: { url: string; attribution: FlyerImageAttribution } | null = null;
    if (!brief.preferGenerated && process.env.PEXELS_API_KEY) {
      try {
        stockHit = await this.searchPexels(brief);
      } catch (error: any) {
        logger.warn('Pexels search failed, will try generation fallback', {
          error: error.message,
        });
      }
    }

    let url: string;
    let source: FlyerImageSource;
    let attribution: FlyerImageAttribution;

    if (stockHit) {
      url = stockHit.url;
      source = 'stock';
      attribution = stockHit.attribution;
      logger.info('ImageSourcing: using stock image', { tag, url });
    } else {
      const generated = await this.generateAIImage(brief, { userId, projectId, tag });
      url = generated.url;
      source = 'generated';
      attribution = generated.attribution;
      logger.info('ImageSourcing: using AI-generated image', { tag, url });
    }

    const analysis = await this.analyzeImage(url, brief).catch((err) => {
      logger.warn('Image analysis failed, returning neutral analysis', {
        error: err?.message,
      });
      return this.fallbackAnalysis();
    });

    return { url, source, attribution, analysis };
  }

  // --------------------------------------------------------------------------
  // 1. Stock search (Pexels)
  // --------------------------------------------------------------------------

  private async searchPexels(
    brief: ImageBrief
  ): Promise<{ url: string; attribution: FlyerImageAttribution } | null> {
    const apiKey = process.env.PEXELS_API_KEY;
    if (!apiKey) return null;

    const orientationParam =
      brief.orientation === 'portrait'
        ? 'portrait'
        : brief.orientation === 'landscape'
        ? 'landscape'
        : 'square';

    const response = await axios.get(PEXELS_ENDPOINT, {
      headers: { Authorization: apiKey },
      params: {
        query: brief.searchQuery,
        per_page: 5,
        orientation: orientationParam,
      },
      timeout: 8000,
    });

    const photos: any[] = response.data?.photos || [];
    if (photos.length === 0) {
      logger.info('Pexels: no photos for query', { query: brief.searchQuery });
      return null;
    }

    // Take the first relevant — pexels orders by relevance.
    const best = photos[0];
    const url: string =
      best.src?.large2x || best.src?.large || best.src?.original || best.src?.medium;
    if (!url) return null;

    return {
      url,
      attribution: {
        provider: 'pexels',
        author: best.photographer,
        sourceUrl: best.url,
      },
    };
  }

  // --------------------------------------------------------------------------
  // 2. AI generation (Gemini image preview)
  // --------------------------------------------------------------------------

  private async generateAIImage(
    brief: ImageBrief,
    opts: { userId: string; projectId: string; tag: string }
  ): Promise<{ url: string; attribution: FlyerImageAttribution }> {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Cannot generate image: GEMINI_API_KEY not configured');
    }

    const response = await this.geminiAI.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: [
        {
          role: 'user',
          parts: [{ text: brief.generationPrompt }],
        },
      ],
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
        candidateCount: 1,
      },
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    let buffer: Buffer | null = null;
    let mimeType = 'image/png';
    for (const part of parts as any[]) {
      if (part.inlineData?.data) {
        buffer = Buffer.from(part.inlineData.data, 'base64');
        mimeType = part.inlineData.mimeType || 'image/png';
        break;
      }
    }
    if (!buffer) {
      throw new Error('Gemini did not return an image for the generation prompt');
    }

    const ext = mimeType.includes('jpeg') ? 'jpg' : 'png';
    const fileName = `flyer-bg-${opts.tag}-${Date.now()}.${ext}`;
    const folderPath = `users/${opts.userId}/projects/${opts.projectId}/communication/flyer-images`;
    const upload = await this.storage.uploadFile(buffer, fileName, folderPath, mimeType);

    return {
      url: upload.downloadURL,
      attribution: {
        provider: 'gemini',
        author: 'gemini-3.1-flash-image-preview',
      },
    };
  }

  // --------------------------------------------------------------------------
  // 3. Vision scan
  // --------------------------------------------------------------------------

  /**
   * Quick multimodal analysis. Asks Gemini to return strict JSON describing
   * the picture so we can keep the marketing copy + layout coherent.
   */
  async analyzeImage(imageUrl: string, brief: ImageBrief): Promise<FlyerImageAnalysis> {
    if (!process.env.GEMINI_API_KEY) {
      return this.fallbackAnalysis();
    }

    // Fetch as base64 — Gemini expects inline data for arbitrary URLs.
    const fetched = await axios.get<ArrayBuffer>(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 10000,
    });
    const mimeType = fetched.headers['content-type'] || 'image/jpeg';
    const base64 = Buffer.from(fetched.data).toString('base64');

    const instruction = `You are a vision analyst for a marketing design tool.
Analyze the attached image. Return ONLY strict JSON, no prose, matching:
{
  "subject": string,            // main subject in <= 80 chars
  "mood": string,               // 1-3 adjectives (e.g. "calm, premium")
  "dominantColors": string[],   // 3-5 hex colors, primary first
  "luminance": "dark"|"light"|"mixed",
  "composition": string,        // <= 120 chars: where the subject is, where empty space is
  "detectedText": string        // any visible text inside the image (or "")
}
The image was sourced for this brief: "${brief.searchQuery}".`;

    const response = await this.geminiAI.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: base64 } },
            { text: instruction },
          ],
        },
      ],
      config: {
        responseModalities: ['TEXT'],
        candidateCount: 1,
      },
    });

    const text = response.candidates?.[0]?.content?.parts
      ?.map((p: any) => p.text || '')
      .join('')
      .trim();
    if (!text) return this.fallbackAnalysis();

    const cleaned = text
      .replace(/^```(json)?\s*/i, '')
      .replace(/```$/g, '')
      .trim();
    try {
      const parsed = JSON.parse(cleaned);
      return {
        subject: parsed.subject || '',
        mood: parsed.mood || '',
        dominantColors: Array.isArray(parsed.dominantColors)
          ? parsed.dominantColors.slice(0, 5)
          : [],
        luminance:
          parsed.luminance === 'dark' || parsed.luminance === 'light' ? parsed.luminance : 'mixed',
        composition: parsed.composition || '',
        detectedText: parsed.detectedText || '',
      };
    } catch (err) {
      logger.warn('analyzeImage: failed to parse vision JSON', { preview: cleaned.slice(0, 160) });
      return this.fallbackAnalysis();
    }
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
