import logger from '../../config/logger';
import { AI_CONFIG } from '../../config/ai.config';
import { analyzeImage, isMediaConfigured } from '../media.service';
import { cacheService } from '../cache.service';
import { observeLogo } from '../logo-engine/improve/improve';

/**
 * Structured result of the vision analysis of an imported logo.
 * logoType + improvementBrief map directly onto LogoPreferences
 * (type / customDescription) consumed by the existing generation pipeline.
 */
export interface LogoAnalysisResult {
  logoType: 'icon' | 'name' | 'initial';
  style: string;
  shapes: string;
  colors: string[];
  typographyStyle: string;
  symbolism: string;
  weaknesses: string;
  improvementBrief: string;
}

/**
 * Analyzes a user-imported logo with a multimodal model and produces a
 * redesign brief for the "improve my logo" flow.
 */
export class LogoAnalysisService {
  /**
   * L'observateur décrit le logo (vision) ; le brief d'amélioration est composé par le code
   * depuis cette description (conserver / corriger), sans second appel au modèle.
   */
  async analyzeLogo(svg: string): Promise<LogoAnalysisResult> {
    if (!isMediaConfigured()) {
      throw new Error('OPENROUTER_API_KEY is not configured. Cannot analyse a logo.');
    }
    logger.info(`Logo analysis: observing SVG (${svg.length} chars)`);
    const { reading } = await observeLogo(
      svg,
      (png, instruction) =>
        analyzeImage(png.toString('base64'), 'image/png', instruction, {
          model: AI_CONFIG.branding.logoAnalysis.modelName,
          maxOutputTokens: Math.max(1800, AI_CONFIG.branding.logoAnalysis.llmOptions?.maxOutputTokens ?? 0),
          temperature: 0,
        }),
      { get: (k) => cacheService.get(k, { prefix: 'logoreading' }), set: (k, v) => cacheService.set(k, v, { prefix: 'logoreading', ttl: 24 * 3600 }).then(() => undefined) }
    );
    return {
      logoType: reading.kind,
      style: reading.summary.split(/(?<=\.)\s/)[0] ?? '',
      shapes: reading.elements.map((e) => `${e.description} (${e.geometry})`).join('; '),
      colors: reading.palette.map((p) => p.hex),
      typographyStyle: reading.typography,
      symbolism: reading.symbolism,
      weaknesses: reading.weaknesses.join('; '),
      improvementBrief: `KEEP: ${reading.keep.join('; ')}. FIX: ${reading.fix.join('; ')}.`,
    };
  }
}

export const logoAnalysisService = new LogoAnalysisService();
