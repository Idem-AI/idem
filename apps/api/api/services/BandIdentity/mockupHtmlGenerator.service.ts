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
    const { projectName, industry, brandColors, mockup, mockupIndex } = params;
    const { primary, secondary, accent } = brandColors;

    // Fonction helper pour convertir hex en rgba
    const hexToRgba = (hex: string, alpha: number): string => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${alpha})`;
    };

    // Construire la carte du mockup (pleine page)
    const mockupCard = `<div style="width:100%;height:100%;position:relative;overflow:hidden;border-radius:16px;box-shadow:0 12px 48px ${hexToRgba(primary, 0.2)},0 4px 12px rgba(0,0,0,0.1);">
      <img src="${mockup.url}" alt="${mockup.title}" style="width:100%;height:100%;object-fit:cover;display:block;" />
      <div style="position:absolute;bottom:0;left:0;right:0;padding:24px 28px;background:linear-gradient(transparent,rgba(0,0,0,0.85));">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
          <div style="width:10px;height:10px;border-radius:50%;background:${primary};box-shadow:0 2px 8px ${hexToRgba(primary, 0.5)};"></div>
          <div style="font-size:16px;font-weight:700;color:white;text-shadow:0 2px 6px rgba(0,0,0,0.7);">${mockup.title}</div>
        </div>
        <div style="font-size:12px;color:rgba(255,255,255,0.95);line-height:1.6;padding-left:22px;">${mockup.description}</div>
      </div>
    </div>`;

    return `<div style="width:210mm;height:297mm;overflow:hidden;position:relative;background:linear-gradient(135deg,#0f1419 0%,#1a1f2e 100%);padding:0;box-sizing:border-box;font-family:'Inter','Helvetica Neue',Arial,sans-serif;display:flex;flex-direction:column;">
  <div style="position:absolute;top:0;right:0;width:50%;height:250px;background:linear-gradient(135deg,${hexToRgba(primary, 0.08)},${hexToRgba(accent, 0.03)});border-bottom-left-radius:150px;"></div>
  <div style="position:absolute;bottom:0;left:0;width:40%;height:120px;background:linear-gradient(45deg,${hexToRgba(accent, 0.05)},transparent);border-top-right-radius:100px;"></div>
  <div style="position:relative;z-index:1;padding:12mm 14mm 10mm 14mm;display:flex;flex-direction:column;height:100%;gap:20px;">
    <div style="display:flex;align-items:flex-end;justify-content:space-between;">
      <div>
        <div style="display:inline-block;padding:4px 12px;background:${primary};color:white;border-radius:6px;font-size:8px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;margin-bottom:10px;">MOCKUP ${mockupIndex}</div>
        <h2 style="margin:0;font-size:28px;font-weight:900;color:white;letter-spacing:-0.5px;line-height:1.1;">${mockup.title}</h2>
        <p style="margin:6px 0 0 0;font-size:11px;color:rgba(255,255,255,0.7);font-weight:400;">${projectName} • ${industry}</p>
      </div>
      <div style="display:flex;gap:6px;align-items:center;">
        <div style="width:24px;height:24px;border-radius:50%;background:${primary};box-shadow:0 2px 8px ${hexToRgba(primary, 0.4)};"></div>
        <div style="width:24px;height:24px;border-radius:50%;background:${secondary};box-shadow:0 2px 8px ${hexToRgba(secondary, 0.4)};"></div>
        <div style="width:24px;height:24px;border-radius:50%;background:${accent};box-shadow:0 2px 8px ${hexToRgba(accent, 0.4)};"></div>
      </div>
    </div>
    <div style="width:60px;height:4px;background:linear-gradient(90deg,${primary},${accent});border-radius:2px;"></div>
    <div style="flex:1;display:flex;flex-direction:column;min-height:0;">
      ${mockupCard}
    </div>
    <div style="display:flex;gap:14px;padding-top:10px;">
      <div style="flex:1;padding:12px 16px;background:${hexToRgba(primary, 0.12)};border-radius:10px;border-left:3px solid ${primary};">
        <div style="font-size:10px;font-weight:700;color:${primary};margin-bottom:4px;">Cohérence</div>
        <div style="font-size:9px;color:rgba(255,255,255,0.8);line-height:1.5;">Le logo maintient son impact sur tous les supports.</div>
      </div>
      <div style="flex:1;padding:12px 16px;background:${hexToRgba(accent, 0.12)};border-radius:10px;border-left:3px solid ${accent};">
        <div style="font-size:10px;font-weight:700;color:${accent};margin-bottom:4px;">Professionnalisme</div>
        <div style="font-size:9px;color:rgba(255,255,255,0.8);line-height:1.5;">Applications adaptées au contexte professionnel.</div>
      </div>
    </div>
  </div>
</div>`;
  }
}

// Export singleton
export const mockupHtmlGeneratorService = new MockupHtmlGeneratorService();
