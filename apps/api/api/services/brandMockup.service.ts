import { GoogleGenAI, Content, Part } from '@google/genai';
import logger from '../config/logger';
import { StorageService } from './storage.service';
import sharp from 'sharp';
export interface MockupGenerationRequest {
  logoImageBase64: string | null;
  logoMimeType: string;
  brandColors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  industry: string;
  brandName: string;
  projectDescription: string;
  mockupIndex: number;
}

export interface MockupGenerationResult {
  mockupUrl: string;
  templateId: string;
  mockupType: string;
  title: string;
  description: string;
}

export class GeminiMockupService {
  private readonly geminiAI: GoogleGenAI;
  private readonly storageService: StorageService;

  constructor() {
    this.geminiAI = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || '',
    });
    this.storageService = new StorageService();

    if (!process.env.GEMINI_API_KEY) {
      logger.warn('GEMINI_API_KEY not configured, mockup generation will use placeholders');
    }
  }
  /**
   * Génère les mockups pour un projet (seulement 2 mockups)
   */
  async generateProjectMockups(
    logoUrl: string,
    brandColors: { primary: string; secondary: string; accent: string },
    industry: string,
    brandName: string,
    projectDescription: string,
    userId: string,
    projectId: string
  ): Promise<{
    mockup1: MockupGenerationResult;
    mockup2: MockupGenerationResult;
  }> {
    const startTime = Date.now();

    try {
      logger.info('Starting mockup generation for project', {
        projectId,
        userId,
        industry,
        brandName,
        hasLogoUrl: !!logoUrl,
        brandColors,
        timestamp: new Date().toISOString(),
      });

      // Télécharger le logo comme image base64 pour l'envoyer à Gemini
      const convertedLogo = await this.urlToBase64(logoUrl);
      const logoImageBase64 = convertedLogo.base64;
      let logoMimeType = convertedLogo.mimeType;

      // Génération des 2 mockups en parallèle — Gemini décide la scène
      const [mockup1, mockup2] = await Promise.all([
        this.generateMockup(
          {
            logoImageBase64,
            logoMimeType,
            brandColors,
            industry,
            brandName,
            projectDescription,
            mockupIndex: 1,
          },
          userId,
          projectId,
          'mockup-1'
        ),
        this.generateMockup(
          {
            logoImageBase64,
            logoMimeType,
            brandColors,
            industry,
            brandName,
            projectDescription,
            mockupIndex: 2,
          },
          userId,
          projectId,
          'mockup-2'
        ),
      ]);

      const duration = Date.now() - startTime;

      logger.info('Project mockups generation completed successfully', {
        projectId,
        userId,
        industry,
        mockup1Url: mockup1.mockupUrl,
        mockup2Url: mockup2.mockupUrl,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      });

      return { mockup1, mockup2 };
    } catch (error: any) {
      const duration = Date.now() - startTime;

      logger.error('Error generating project mockups', {
        error: error.message,
        stack: error.stack,
        projectId,
        userId,
        industry,
        brandName,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      });

      throw new Error(`Failed to generate mockups: ${error.message}`);
    }
  }

  /**
   * Génère un mockup individuel avec Gemini Image en envoyant le logo comme image
   */
  private async generateMockup(
    request: MockupGenerationRequest,
    userId: string,
    projectId: string,
    mockupName: string
  ): Promise<MockupGenerationResult> {
    const mockupStartTime = Date.now();

    try {
      logger.info(`[MOCKUP][${mockupName}] Starting individual mockup generation`, {
        mockupName,
        industry: request.industry,
        brandName: request.brandName,
        hasLogoImage: !!request.logoImageBase64,
        logoBase64Length: request.logoImageBase64?.length || 0,
        mockupIndex: request.mockupIndex,
        projectId,
        userId,
      });

      // Vérifier que l'API key Gemini est configurée
      if (!process.env.GEMINI_API_KEY) {
        logger.error(
          `[MOCKUP][${mockupName}] GEMINI_API_KEY is NOT configured - cannot generate mockup images`,
          {
            mockupName,
            projectId,
          }
        );
        console.error(`[MOCKUP] ❌ GEMINI_API_KEY is not set! Cannot generate mockup images.`);
        throw new Error('GEMINI_API_KEY is not configured. Cannot generate mockup images.');
      }

      console.log(
        `[MOCKUP] ✅ GEMINI_API_KEY is configured, proceeding with real image generation for mockup ${request.mockupIndex}`
      );

      // Construire le contenu multimodal (texte + image du logo)
      const contents = this.buildMultimodalContent(request);

      logger.info(`[MOCKUP][${mockupName}] Multimodal content built for Gemini`, {
        mockupName,
        hasImagePart: !!request.logoImageBase64,
        projectId,
      });

      // Générer l'image avec Gemini
      logger.info(`[MOCKUP][${mockupName}] Calling Gemini Image API (gemini-3-pro-image-preview)`, {
        mockupName,
        model: 'gemini-3-pro-image-preview',
        projectId,
      });

      const response = await this.geminiAI.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: contents,
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
        },
      });

      logger.info(`[MOCKUP][${mockupName}] Gemini API response received`, {
        mockupName,
        hasCandidates: !!(response.candidates && response.candidates.length > 0),
        candidatesCount: response.candidates?.length || 0,
        projectId,
      });

      // Extraire l'image générée
      let imageBuffer: Buffer | null = null;
      let imageMimeType = 'image/png';

      if (
        response.candidates &&
        response.candidates[0] &&
        response.candidates[0].content &&
        response.candidates[0].content.parts
      ) {
        logger.info(`[MOCKUP][${mockupName}] Gemini response parts analysis`, {
          mockupName,
          partsCount: response.candidates[0].content.parts.length,
          partTypes: response.candidates[0].content.parts.map((p: any) => ({
            hasText: !!p.text,
            hasInlineData: !!p.inlineData,
            mimeType: p.inlineData?.mimeType || 'none',
            dataLength: p.inlineData?.data?.length || 0,
          })),
          projectId,
        });

        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData && part.inlineData.data) {
            const imageData = part.inlineData.data;
            imageBuffer = Buffer.from(imageData, 'base64');
            imageMimeType = part.inlineData.mimeType || 'image/png';

            logger.info(`[MOCKUP][${mockupName}] Image data extracted from Gemini response`, {
              mockupName,
              imageSize: imageBuffer.length,
              imageSizeKB: `${Math.round(imageBuffer.length / 1024)}KB`,
              imageMimeType,
              projectId,
            });
            break;
          }
        }
      } else {
        logger.error(
          `[MOCKUP][${mockupName}] Gemini response structure unexpected - NO IMAGE DATA`,
          {
            mockupName,
            hasCandidates: !!response.candidates,
            candidatesLength: response.candidates?.length,
            hasContent: !!response.candidates?.[0]?.content,
            hasParts: !!response.candidates?.[0]?.content?.parts,
            finishReason: response.candidates?.[0]?.finishReason,
            projectId,
          }
        );
      }

      if (!imageBuffer) {
        throw new Error('No image generated by Gemini - response did not contain image data');
      }

      console.log(
        `[MOCKUP] ✅ Gemini image generated for mockup ${request.mockupIndex} (${Math.round(imageBuffer.length / 1024)}KB) — now uploading to Firebase Storage bucket...`
      );

      // Déterminer l'extension du fichier selon le mime type
      const fileExtension =
        imageMimeType.includes('jpeg') || imageMimeType.includes('jpg') ? 'jpg' : 'png';
      const fileName = `${mockupName}-${Date.now()}.${fileExtension}`;
      const folderPath = `projects/${projectId}/Mockups`;

      logger.info(`[MOCKUP][${mockupName}] Uploading mockup image to Firebase Storage...`, {
        mockupName,
        fileName,
        folderPath,
        imageSizeKB: `${Math.round(imageBuffer.length / 1024)}KB`,
        imageMimeType,
        projectId,
      });

      const uploadResult = await this.storageService.uploadFile(
        imageBuffer,
        fileName,
        folderPath,
        imageMimeType
      );

      const mockupDuration = Date.now() - mockupStartTime;

      logger.info(`[MOCKUP][${mockupName}] ✅ Upload SUCCESS - Mockup stored on bucket`, {
        mockupName,
        mockupIndex: request.mockupIndex,
        bucketUrl: uploadResult.downloadURL,
        fileName: uploadResult.fileName,
        filePath: uploadResult.filePath,
        duration: `${mockupDuration}ms`,
        projectId,
      });
      console.log(
        `[MOCKUP] ✅ Upload SUCCESS for mockup ${request.mockupIndex} → Bucket URL: ${uploadResult.downloadURL}`
      );

      return {
        mockupUrl: uploadResult.downloadURL,
        templateId: mockupName,
        mockupType: request.industry,
        title: '',
        description: '',
      };
    } catch (error: any) {
      const mockupDuration = Date.now() - mockupStartTime;

      logger.error(`[MOCKUP][${mockupName}] ❌ Error generating mockup`, {
        error: error.message,
        stack: error.stack,
        mockupName,
        brandName: request.brandName,
        industry: request.industry,
        duration: `${mockupDuration}ms`,
        projectId,
        userId,
      });

      // Ne PAS retourner de placeholder - propager l'erreur pour que le service appelant sache que la génération a échoué
      console.error(
        `[MOCKUP] ❌ Mockup ${request.mockupIndex} generation FAILED: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Construit le contenu multimodal (texte + image du logo) pour Gemini
   * Gemini décide lui-même la meilleure scène de mockup en fonction du contexte du projet
   */
  private buildMultimodalContent(request: MockupGenerationRequest): Content[] {
    const {
      brandName,
      brandColors,
      industry,
      projectDescription,
      logoImageBase64,
      logoMimeType,
      mockupIndex,
    } = request;

    const logoInstruction = logoImageBase64
      ? `LOGO IMAGE PROVIDED: I have attached the EXACT logo of this brand as a PNG image. You MUST:
  1. Look carefully at the attached logo image — study its shape, colors, typography, and design.
  2. REPRODUCE THIS EXACT LOGO in the mockup scene. Do NOT create a different logo or text.
  3. The logo must appear EXACTLY as provided — same shapes, same colors, same proportions.
  4. Place the logo prominently and naturally within the scene.
  5. If the logo contains text, reproduce that EXACT text — do NOT change or translate it.`
      : `No logo image was provided. Display the brand name "${brandName}" in a clean, professional typographic style using the brand colors.`;

    const textPrompt = `You are an elite commercial photographer and brand designer. Create a STUNNING, PHOTOREALISTIC mockup photograph.

THE BRAND:
- Name: "${brandName}"
- Industry: ${industry}
- Colors: Primary ${brandColors.primary}, Secondary ${brandColors.secondary}, Accent ${brandColors.accent}
- Project description: ${projectDescription}

${logoInstruction}

YOUR TASK:
Based on the brand's industry and project description, choose the MOST RELEVANT and IMPACTFUL real-world scene to showcase this brand's logo.
This is mockup #${mockupIndex} — ${mockupIndex === 1 ? 'choose the PRIMARY brand application (the most iconic for this industry)' : 'choose a DIFFERENT, COMPLEMENTARY brand application (secondary but still impactful)'}.

Examples of what to choose depending on industry:
- Delivery/Logistics: branded van, shipping box, uniform
- Restaurant/Food: menu card, storefront sign, takeaway packaging
- Tech/SaaS: laptop screen with UI, mobile app, conference badge
- Health/Medical: clinic facade, medical packaging, staff badge
- E-commerce/Retail: shopping bag, storefront, product packaging
- Finance: corporate reception, premium business card, office signage
- Education: school entrance, tablet with e-learning platform
- Real Estate: property sign, agency office
- Beauty: cosmetic packaging, salon interior
- Construction: site banner, branded hard hat
- Sport/Fitness: gym entrance, branded sportswear
- Travel: hotel entrance, branded luggage tag

Do NOT always default to business card + laptop. Pick something SPECIFIC to this brand's industry.

PHOTOGRAPHY REQUIREMENTS:
- This must look like a REAL PHOTOGRAPH taken by a professional photographer — NOT a digital illustration or 3D render.
- Professional studio or on-location lighting with natural shadows and reflections.
- Shallow depth of field where appropriate for artistic effect.
- Rich textures: paper grain, fabric weave, metal sheen, glass reflections.
- The brand colors (${brandColors.primary}, ${brandColors.secondary}, ${brandColors.accent}) should be visible in the scene.
- The logo/brand identity must be the HERO of the image — clearly visible and beautifully integrated.
- Cinematic composition with the rule of thirds.

STYLE: High-end commercial photography, like a brand portfolio shot for Behance or Dribbble.

Generate ONLY the image, no text response.`;

    const parts: Part[] = [];

    // Ajouter l'image du logo si disponible
    if (logoImageBase64) {
      parts.push({
        inlineData: {
          mimeType: logoMimeType,
          data: logoImageBase64,
        },
      });
    }

    // Ajouter le texte du prompt
    parts.push({ text: textPrompt });

    return [
      {
        role: 'user',
        parts: parts,
      },
    ];
  }

  /**
   * Génère un seul mockup (méthode publique pour usage externe)
   * Flow: SVG→PNG conversion → Gemini image generation → Firebase Storage upload → return URL
   * Gemini décide lui-même la scène de mockup en fonction du contexte du projet
   */

  async urlToBase64(url: string) {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`);
      }

      let mimeType = response.headers.get('content-type') || 'application/octet-stream';

      const arrayBuffer = await response.arrayBuffer();
      let buffer: Buffer = Buffer.from(arrayBuffer);

      // ✅ si SVG → conversion PNG
      if (mimeType.includes('image/svg')) {
        console.log('⚡ SVG detected → converting to PNG...');

        buffer = (await sharp(buffer)
          .png({
            compressionLevel: 9,
            quality: 100,
          })
          .toBuffer()) as Buffer;

        mimeType = 'image/png';
      }

      const base64 = buffer.toString('base64');

      const sizeInBytes = Buffer.byteLength(base64, 'utf8');
      const sizeInKB = (sizeInBytes / 1024).toFixed(2);

      console.log('✅ Image ready');
      console.log('MimeType:', mimeType);
      console.log('Base64 size:', sizeInBytes, 'bytes');
      console.log('Base64 size:', sizeInKB, 'KB');

      return {
        base64,
        mimeType,
      };
    } catch (error) {
      console.error('Error converting URL to base64:', error);
      throw error;
    }
  }
}

export const geminiMockupService = new GeminiMockupService();
