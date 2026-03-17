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
    const { projectName, mockup, mockupIndex } = params;

    // Design minimaliste : juste l'image, très grande, centrée
    const mockupCard = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
      <img src="${mockup.url}" alt="${mockup.title}" style="max-width:95%;max-height:95%;object-fit:contain;display:block;box-shadow:0 2px 16px rgba(0,0,0,0.08);" />
    </div>`;

    return `<div style="width:100%;height:100%;background:#FAFAFA;padding:0;box-sizing:border-box;font-family:'Inter',system-ui,-apple-system,sans-serif;display:flex;flex-direction:column;">
  <!-- En-tête minimaliste (10%) -->
  <div style="padding:20mm 20mm 10mm 20mm;">
    <h1 style="margin:0;font-size:24px;font-weight:600;color:#1a1a1a;letter-spacing:-0.3px;">${mockup.title}</h1>
    <p style="margin:6px 0 0 0;font-size:13px;color:#666;font-weight:400;">${projectName}</p>
  </div>

  <!-- Image hero (85%) -->
  <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:0 20mm;">
    ${mockupCard}
  </div>

  <!-- Footer minimal (5%) -->
  <div style="padding:10mm 20mm 15mm 20mm;text-align:center;">
    <p style="margin:0;font-size:11px;color:#999;font-weight:400;">${mockupIndex}/3</p>
  </div>
</div>`;
  }
}

// Export singleton
export const mockupHtmlGeneratorService = new MockupHtmlGeneratorService();
