/**
 * ImageSourcingService — optimized image pipeline.
 *
 * Optimizations vs. original:
 *  - the generated image is analysed from its bytes already in memory (no
 *    re-download of the generated image).
 *  - analyzeImage for stock images uses a smaller image size (medium ~1200px)
 *    instead of large2x (~4000px), cutting base64 payload by ~85%.
 *  - analyzeImage accepts raw Buffer directly (no HTTP re-fetch needed when
 *    the bytes are already in memory).
 *  - Pexels: fetch medium URL for analysis, keep large URL for the flyer.
 *  - vision-only call kept lean (small image + short JSON schema); its budget
 *    and its fallback model live in ai.config.ts (`communication.imageSourcing`).
 */
import axios from 'axios';
import logger from '../runtime/logger';
import { coreHost, requirePort } from '../runtime/host';
import {
  FlyerImageAnalysis,
  FlyerImageAttribution,
  FlyerImageSource,
} from './visual.model';

export interface SourcedImage {
  url: string;
  source: FlyerImageSource;
  attribution: FlyerImageAttribution;
  analysis: FlyerImageAnalysis;
}

export interface ImageBrief {
  searchQuery: string;
  generationPrompt: string;
  /**
   * Ce qui ne doit PAS apparaître dans l'image, EN PLUS de l'absence de texte déjà imposée par
   * le service (`NO_TEXT_PREFIX`/`NO_TEXT_SUFFIX`, relues et retentées) sur toute image générée.
   * L'endpoint d'image n'expose pas de champ dédié : la consigne est concaténée au prompt — un
   * simple mot de plus pour un modèle qui n'applique pas de guidage négatif (cf. plus bas).
   */
  negativePrompt?: string;
  preferGenerated?: boolean;
  orientation?: 'portrait' | 'landscape' | 'square';
}

/**
 * Réglages d'un appelant extérieur au module communication — la charte
 * graphique, qui veut ses visuels vite et ne suit donc pas les choix du brief.
 */
export interface ImageSourcingPreferences {
  /** Chercher une photo de banque même quand le brief préfère la génération. */
  preferStock?: boolean;
  imageModel?: string;
  imageFallbackModel?: string;
}

// ─── Modèles ───────────────────────────────────────────────────────────────
// Le moteur partagé ne connaît pas les modèles : l'hôte les choisit selon la finalité
// (`visual-background`, `visual-analysis`). Dans IDEM : `AI_CONFIG.communication.imageSourcing`.


const PEXELS_ENDPOINT = 'https://api.pexels.com/v1/search';

/**
 * Une image GÉNÉRÉE pour un visuel ne porte jamais de texte : le texte du visuel est posé par le
 * compositeur (ajusté au millimètre, contrôlé) — un mot écrit par le modèle d'image est illisible,
 * non traduit et jamais à la bonne taille. En code et non laissé à un appelant : tout appel de
 * génération passant par ce service en bénéficie, qu'il fournisse ou non son propre `negativePrompt`.
 *
 * NE PAS écrire ceci comme un prompt négatif (« avoid: text »…) : le modèle d'image de l'hôte
 * (FLUX) n'applique PAS de guidance négative — une consigne « éviter » est pour lui un mot de plus
 * dans le prompt, pas une exclusion. L'absence de texte se dit donc en POSITIF : en tête (FLUX lit
 * le sujet d'abord) ET répétée en fin de prompt.
 */
const NO_TEXT_PREFIX = 'A pure, textless photograph — no writing of any kind anywhere in the frame: ';
const NO_TEXT_SUFFIX =
  'The whole image is completely free of text: no letters, no words, no numbers, no captions, no headline, no logo, no watermark, no signage, nothing written anywhere, on any surface. Just the photograph itself.';

/** Au-delà de deux essais, le temps perdu dépasse le bénéfice : on garde le moins mauvais. */
const MAX_GENERATION_ATTEMPTS = 2;

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
  constructor() {}


  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC ENTRY POINT
  // ─────────────────────────────────────────────────────────────────────────

  async sourceImage(
    brief: ImageBrief,
    opts: { userId: string; projectId: string; tag: string } & ImageSourcingPreferences
  ): Promise<SourcedImage> {
    logger.info(`[ImageSourcing] Sourcing image`, { tag: opts.tag, searchQuery: brief.searchQuery });
    // ── Path A: stock image ──────────────────────────────────────────────
    if ((opts.preferStock || !brief.preferGenerated) && process.env.PEXELS_API_KEY) {
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

    // ── Path B: generate, then analyze the produced image ─────────────────
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
  // 2. GENERATE + ANALYZE — the image endpoint, then a vision call on the
  //    bytes already in memory. No re-download needed.
  // ─────────────────────────────────────────────────────────────────────────

  private async generateAndAnalyze(
    brief: ImageBrief,
    opts: { userId: string; projectId: string; tag: string } & ImageSourcingPreferences
  ): Promise<SourcedImage> {
    logger.info(`[ImageSourcing] Generating`, { tag: opts.tag, model: opts.imageModel || 'host default' });
    const start = Date.now();

    // L'absence de texte n'est jamais laissée au bon vouloir de l'appelant NI du modèle
    // (NO_TEXT_PREFIX/SUFFIX) — et comme le prompt seul ne suffit pas toujours à l'obtenir, la
    // vision qui suit (déjà appelée pour l'analyse) RELIT l'image produite (`detectedText`) et
    // un second essai est tenté si elle en voit, comme le fait déjà `brandMockup.service.ts`
    // pour ses scènes. Les éventuelles autres consignes de l'appelant restent, elles, de simples
    // mots dans le prompt (le modèle n'applique pas de guidage négatif) — un geste en plus, pas
    // une garantie.
    const extra = (brief.negativePrompt || '').trim();
    const prompt = `${NO_TEXT_PREFIX}${brief.generationPrompt}\n\n${NO_TEXT_SUFFIX}${extra ? ` Also: no ${extra}.` : ''}`;

    let buffer!: Buffer;
    let mimeType = 'image/png';
    let model = '';
    let analysis: FlyerImageAnalysis = this.fallbackAnalysis();
    for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
      const generated = await requirePort('generateImage')(prompt, {
        tag: `${opts.tag}#${attempt}`,
        purpose: 'visual-background',
        ...(opts.imageModel ? { model: opts.imageModel } : {}),
        ...(opts.imageFallbackModel ? { fallbackModel: opts.imageFallbackModel } : {}),
      });
      buffer = generated.buffer;
      mimeType = generated.mimeType;
      model = generated.model;
      analysis = await this.analyzeImageFromBase64(buffer.toString('base64'), mimeType, brief.searchQuery);
      if (!analysis.detectedText) break;
      logger.warn(`[ImageSourcing] generated image carries text (${attempt}/${MAX_GENERATION_ATTEMPTS})`, {
        tag: opts.tag,
        detectedText: analysis.detectedText.slice(0, 120),
        keeping: attempt >= MAX_GENERATION_ATTEMPTS,
      });
    }

    logger.info(`[ImageSourcing] Generation complete`, {
      tag: opts.tag,
      durationMs: Date.now() - start,
      bytes: buffer.length,
    });

    const fileName = `flyer-bg-${opts.tag}-${Date.now()}.png`;
    const folderPath = `users/${opts.userId}/projects/${opts.projectId}/communication/flyer-images`;
    const upload = await requirePort('storage').uploadFile(buffer, fileName, folderPath, mimeType);

    logger.info(`[ImageSourcing] AI-generated image sourced`, {
      tag: opts.tag,
      url: upload.downloadURL,
      analysis: !!analysis,
    });
    return {
      url: upload.downloadURL,
      source: 'generated',
      attribution: { provider: 'openrouter', author: model },
      analysis,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. VISION SCAN — stock images only (buffer OR URL accepted)
  //    Modèle et repli : choisis par l'hôte pour la finalité `visual-analysis`
  //    (IDEM : AI_CONFIG.communication.imageSourcing).
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
    if (!coreHost().analyzeImage) return this.fallbackAnalysis();

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
    if (!coreHost().analyzeImage) return this.fallbackAnalysis();

    try {
      const raw = await requirePort('analyzeImage')(base64, mimeType, `Brief context: "${searchQuery}". ${VISION_INSTRUCTION}`, { purpose: 'visual-analysis' });
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