import logger from '../../config/logger';
import { AI_CONFIG } from '../../config/ai.config';
import { analyzeImage, isMediaConfigured } from '../media.service';
import { convertSvgToPng } from '../logo-import.service';
import { LOGO_ANALYSIS_PROMPT } from './prompts/singleGenerations/logo-analysis.prompt';

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


  async analyzeLogo(svg: string): Promise<LogoAnalysisResult> {
    if (!isMediaConfigured()) {
      throw new Error('OPENROUTER_API_KEY is not configured. Cannot analyse a logo.');
    }

    logger.info(`Logo analysis: rendering SVG (${svg.length} chars) to PNG for vision model`);
    const pngBuffer = await convertSvgToPng(svg, 512, 512);
    const base64Image = pngBuffer.toString('base64');

    // Le modèle lit l'image par le contrat OpenAI. Il n'a pas de `responseSchema`
    // contraignant : la consigne du prompt porte seule le format,
    // et la lecture en aval valide déjà ce qui revient.
    const primaryModel = AI_CONFIG.branding.logoAnalysis.modelName;

    const rawText = (
      await analyzeImage(base64Image, 'image/png', LOGO_ANALYSIS_PROMPT, {
        model: primaryModel,
        maxOutputTokens: AI_CONFIG.branding.logoAnalysis.llmOptions?.maxOutputTokens,
        temperature: AI_CONFIG.branding.logoAnalysis.llmOptions?.temperature,
      })
    ).trim();


    if (!rawText) {
      throw new Error('Logo analysis returned an empty response');
    }

    return this.parseAnalysis(rawText);
  }

  private parseAnalysis(rawText: string): LogoAnalysisResult {
    // Strip markdown fences if the model added them despite instructions
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch (error) {
      // Try to recover the first {...} or [...] block
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch (innerError) {
          logger.error('Logo analysis: failed to parse JSON from recovered block', { rawText: cleaned.slice(0, 500) });
          throw new Error('Failed to parse logo analysis response');
        }
      } else {
        logger.error('Logo analysis: failed to parse JSON response', { rawText: cleaned.slice(0, 500) });
        throw new Error('Failed to parse logo analysis response');
      }
    }

    const validTypes = ['icon', 'name', 'initial'];
    const logoType = validTypes.includes(parsed.logoType) ? parsed.logoType : 'icon';

    if (!parsed.improvementBrief || typeof parsed.improvementBrief !== 'string') {
      throw new Error('Logo analysis response is missing the improvement brief');
    }

    return {
      logoType,
      style: parsed.style || '',
      shapes: parsed.shapes || '',
      colors: Array.isArray(parsed.colors) ? parsed.colors : [],
      typographyStyle: parsed.typographyStyle || '',
      symbolism: parsed.symbolism || '',
      weaknesses: parsed.weaknesses || '',
      improvementBrief: parsed.improvementBrief,
    };
  }
}

export const logoAnalysisService = new LogoAnalysisService();
