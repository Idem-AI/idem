import { GoogleGenAI, Type } from '@google/genai';
import logger from '../../config/logger';
import { AI_CONFIG } from '../../config/ai.config';
import { withGeminiFallback } from '../../utils/gemini-fallback';
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
 * Strict JSON schema for LogoAnalysisResult to enforce valid structure from Gemini.
 */
const logoAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    logoType: {
      type: Type.STRING,
      enum: ['icon', 'name', 'initial'],
      description: 'The type classification of the logo. "icon" for symbol/pictorial mark, "name" for full brand name wordmark, "initial" for stylized monogram.',
    },
    style: {
      type: Type.STRING,
      description: 'Overall visual style of the logo in a few words.',
    },
    shapes: {
      type: Type.STRING,
      description: 'Geometric description of the shapes and layout of the mark.',
    },
    colors: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING,
      },
      description: 'The estimated colors present in the logo as 6-digit hex values.',
    },
    typographyStyle: {
      type: Type.STRING,
      description: 'Typography style details (e.g. serif, sans-serif, weight) or "none".',
    },
    symbolism: {
      type: Type.STRING,
      description: 'What the logo mark evokes or represents.',
    },
    weaknesses: {
      type: Type.STRING,
      description: 'Flaws and weaknesses in the current design (alignment, kerning, colors, etc.).',
    },
    improvementBrief: {
      type: Type.STRING,
      description: 'Concrete design instructions to recreate and improve this logo. Must be 60-120 words.',
    },
  },
  required: [
    'logoType',
    'style',
    'shapes',
    'colors',
    'typographyStyle',
    'symbolism',
    'weaknesses',
    'improvementBrief',
  ],
};

/**
 * Analyzes a user-imported logo with a multimodal model and produces a
 * redesign brief for the "improve my logo" flow.
 */
export class LogoAnalysisService {
  private _geminiAI?: GoogleGenAI;

  private get geminiAI(): GoogleGenAI {
    if (!this._geminiAI) {
      this._geminiAI = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY || '',
      });
    }
    return this._geminiAI;
  }

  async analyzeLogo(svg: string): Promise<LogoAnalysisResult> {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured. Cannot analyze logo.');
    }

    logger.info(`Logo analysis: rendering SVG (${svg.length} chars) to PNG for vision model`);
    const pngBuffer = await convertSvgToPng(svg, 512, 512);
    const base64Image = pngBuffer.toString('base64');

    const contents = [
      {
        role: 'user',
        parts: [
          { text: LOGO_ANALYSIS_PROMPT },
          { inlineData: { mimeType: 'image/png', data: base64Image } },
        ],
      },
    ];

    const primaryModel = AI_CONFIG.branding.logoAnalysis.modelName;
    const fallbackModel = AI_CONFIG.fallback.textModel;

    const response = await withGeminiFallback(
      () =>
        this.geminiAI.models.generateContent({
          model: primaryModel,
          contents,
          config: {
            temperature: AI_CONFIG.branding.logoAnalysis.llmOptions?.temperature,
            maxOutputTokens: AI_CONFIG.branding.logoAnalysis.llmOptions?.maxOutputTokens,
            responseMimeType: 'application/json',
            responseSchema: logoAnalysisSchema,
          },
        }),
      () =>
        this.geminiAI.models.generateContent({
          model: fallbackModel,
          contents,
          config: {
            temperature: AI_CONFIG.branding.logoAnalysis.llmOptions?.temperature,
            maxOutputTokens: AI_CONFIG.branding.logoAnalysis.llmOptions?.maxOutputTokens,
            responseMimeType: 'application/json',
            responseSchema: logoAnalysisSchema,
          },
        }),
      primaryModel,
      fallbackModel
    );

    const rawText = response.text?.trim() || '';

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
