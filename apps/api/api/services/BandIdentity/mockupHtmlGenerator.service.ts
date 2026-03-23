import { GoogleGenerativeAI } from '@google/generative-ai';
import logger from '../../config/logger';
import { MOCKUP_HTML_GENERATION_PROMPT } from './prompts/mockup-html-generation.prompt';

/**
 * Service pour générer le HTML d'affichage des mockups via Gemini AI
 * Génère un HTML professionnel et adapté au projet
 */
export class MockupHtmlGeneratorService {
  private geminiAI: GoogleGenerativeAI;
  private readonly MODEL_NAME = 'gemini-3.1-flash-lite-preview';

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }
    this.geminiAI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Génère le HTML d'affichage des mockups via Gemini AI
   * NOUVEAU : Génère une page séparée pour chaque mockup
   * Retourne un tableau de pages HTML (une par mockup)
   */
  async generateMockupHtml(params: {
    projectName: string;
    projectDescription: string;
    industry: string;
    brandColors: {
      primary: string;
      secondary: string;
      accent: string;
    };
    mockups: Array<{
      url: string;
      title: string;
      description: string;
      supportType: string;
      priority: 'primary' | 'secondary';
    }>;
    logoUrl?: string;
    projectId?: string;
    userId?: string;
    typography?: {
      primaryFont?: string;
      secondaryFont?: string;
    };
  }): Promise<string[]> {
    const startTime = Date.now();
    const { projectId, userId, projectName, industry, mockups } = params;

    try {
      logger.info('[MOCKUP-HTML] Starting AI-generated HTML generation (one page per mockup)', {
        projectId,
        userId,
        projectName,
        industry,
        mockupCount: mockups.length,
        model: this.MODEL_NAME,
        strategy: 'separate-pages',
      });

      // Générer une page HTML pour chaque mockup
      const htmlPages: string[] = [];

      for (let i = 0; i < mockups.length; i++) {
        const mockup = mockups[i];
        const mockupStartTime = Date.now();

        logger.info(
          `[MOCKUP-HTML] Generating page ${i + 1}/${mockups.length} for mockup: ${mockup.title}`,
          {
            projectId,
            mockupIndex: i + 1,
            mockupTitle: mockup.title,
          }
        );

        // Construire le prompt pour ce mockup spécifique
        const prompt = MOCKUP_HTML_GENERATION_PROMPT.buildSingleMockupPrompt({
          ...params,
          mockup,
          mockupIndex: i + 1,
          totalMockups: mockups.length,
          typography: params.typography,
        });

        // Appeler Gemini pour générer le HTML de cette page
        const model = this.geminiAI.getGenerativeModel({
          model: this.MODEL_NAME,
          systemInstruction: MOCKUP_HTML_GENERATION_PROMPT.systemPrompt,
        });

        const result = await model.generateContent(prompt);
        const response = result.response;
        let generatedHtml = response.text();

        // Nettoyer le HTML
        generatedHtml = this.cleanGeneratedHtml(generatedHtml);

        // Valider le HTML généré
        const isValid = this.validateSingleMockupHtml(generatedHtml, mockup);
        if (!isValid) {
          logger.warn(`[MOCKUP-HTML] Page ${i + 1} validation failed, using fallback`, {
            projectId,
            mockupIndex: i + 1,
          });
          // Utiliser le fallback pour cette page
          generatedHtml = this.generateSingleMockupFallback({
            ...params,
            mockup,
            mockupIndex: i + 1,
          });
        }

        htmlPages.push(generatedHtml);

        logger.info(`[MOCKUP-HTML] ✅ Page ${i + 1}/${mockups.length} generated`, {
          projectId,
          mockupIndex: i + 1,
          htmlLength: generatedHtml.length,
          duration: `${Date.now() - mockupStartTime}ms`,
        });
      }

      logger.info('[MOCKUP-HTML] ✅ All HTML pages generated successfully', {
        projectId,
        userId,
        totalPages: htmlPages.length,
        totalDuration: `${Date.now() - startTime}ms`,
      });

      return htmlPages;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error('[MOCKUP-HTML] ❌ Error generating HTML with AI', {
        error: error.message,
        stack: error.stack,
        projectId,
        userId,
        duration: `${duration}ms`,
      });

      // En cas d'erreur, retourner des pages de fallback pour chaque mockup
      logger.info('[MOCKUP-HTML] Using fallback HTML pages due to error', { projectId });
      return mockups.map((mockup, index) =>
        this.generateSingleMockupFallback({
          ...params,
          mockup,
          mockupIndex: index + 1,
        })
      );
    }
  }

  /**
   * Nettoie le HTML généré (enlève les markdown code blocks)
   */
  private cleanGeneratedHtml(html: string): string {
    // Enlever les markdown code blocks si présents
    html = html.replace(/```html\n?/g, '');
    html = html.replace(/```\n?/g, '');
    html = html.trim();
    return html;
  }

  /**
   * Valide le HTML généré pour un seul mockup
   */
  private validateSingleMockupHtml(html: string, mockup: { url: string; title: string }): boolean {
    // Vérifications basiques
    if (!html || html.length < 100) {
      logger.warn('[MOCKUP-HTML] HTML too short', { length: html.length });
      return false;
    }

    // Vérifier que le HTML contient les dimensions A4
    if (!html.includes('210mm') || !html.includes('297mm')) {
      logger.warn('[MOCKUP-HTML] HTML missing A4 dimensions');
      return false;
    }

    // Vérifier que le HTML contient l'URL du mockup
    if (!html.includes(mockup.url)) {
      logger.warn('[MOCKUP-HTML] HTML missing mockup URL', { mockupUrl: mockup.url });
      return false;
    }

    // Vérifier que le HTML est bien formé
    if (!html.trim().startsWith('<') || !html.trim().endsWith('>')) {
      logger.warn('[MOCKUP-HTML] HTML not properly formed');
      return false;
    }

    return true;
  }

  /**
   * Génère un HTML de fallback pour un seul mockup
   */
  private generateSingleMockupFallback(params: {
    projectName: string;
    projectDescription: string;
    industry: string;
    brandColors: {
      primary: string;
      secondary: string;
      accent: string;
    };
    mockup: {
      url: string;
      title: string;
      description: string;
      supportType: string;
      priority: 'primary' | 'secondary';
    };
    mockupIndex: number;
  }): string {
    const { projectName, brandColors, mockup, mockupIndex } = params;

    // Convertir les couleurs hex en rgba pour le dégradé
    const hexToRgba = (hex: string, alpha: number): string => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const primaryRgba = hexToRgba(brandColors.primary, 0.9);
    const secondaryRgba = hexToRgba(brandColors.secondary, 0.7);

    // Design full-page avec couleurs de marque
    return `<div style="width:100%;height:100%;margin:0;padding:0;box-sizing:border-box;position:relative;overflow:hidden;">
  <!-- Image mockup en pleine page -->
  <img src="${mockup.url}" alt="${mockup.title}" style="width:100%;height:100%;object-fit:cover;display:block;" />

  <!-- Overlay avec couleurs de marque -->
  <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(to top, ${primaryRgba} 0%, ${secondaryRgba} 50%, transparent 100%);padding:20mm 12mm 8mm 12mm;">
    <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;text-shadow:0 2px 4px rgba(0,0,0,0.3);font-family:Inter,system-ui,sans-serif;">${mockup.title}</h1>
    <p style="margin:6px 0 0 0;font-size:14px;color:#ffffff;font-weight:400;opacity:0.95;font-family:Inter,system-ui,sans-serif;">${mockup.description}</p>
    <div style="margin-top:12px;display:flex;align-items:center;justify-content:space-between;">
      <p style="margin:0;font-size:14px;color:#ffffff;font-weight:500;opacity:0.9;font-family:Inter,system-ui,sans-serif;">${projectName}</p>
      <p style="margin:0;font-size:12px;color:#ffffff;font-weight:500;opacity:0.7;font-family:Inter,system-ui,sans-serif;">${mockupIndex}/3</p>
    </div>
  </div>
</div>`;
  }
}

// Export singleton
export const mockupHtmlGeneratorService = new MockupHtmlGeneratorService();
