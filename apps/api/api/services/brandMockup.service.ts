import { GoogleGenAI, Content, Part } from '@google/genai';
import logger from '../config/logger';
import { StorageService } from './storage.service';
import sharp from 'sharp';
import { MOCKUP_GENERATION_PROMPT } from './BandIdentity/prompts/mockup-generation.prompt';
import {
  mockupAnalyzerService,
  SelectedMockupSupport,
} from './BandIdentity/mockupAnalyzer.service';
import { MOCKUP_CONFIG } from '../config/mockup.config';

export interface MockupGenerationRequest {
  logoImageBase64: string | null;
  logoMimeType: string;
  brandColors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  brandName: string;
  projectDescription: string;
  selectedSupport: SelectedMockupSupport;
}

export interface MockupGenerationResult {
  mockupUrl: string;
  templateId: string;
  mockupType: string;
  supportType: string;
  supportName: string;
  title: string;
  description: string;
  mockupIndex: number;
  priority: 'primary' | 'secondary';
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
   * Génère les mockups pour un projet (nombre configurable via MOCKUP_CONFIG)
   * L'IA analyse le projet et choisit automatiquement les supports adaptés
   */
  async generateProjectMockups(
    logoUrl: string,
    brandColors: { primary: string; secondary: string; accent: string },
    industry: string,
    brandName: string,
    projectDescription: string,
    userId: string,
    projectId: string
  ): Promise<MockupGenerationResult[]> {
    const startTime = Date.now();

    try {
      logger.info('Starting intelligent mockup generation for project', {
        projectId,
        userId,
        industry,
        brandName,
        hasLogoUrl: !!logoUrl,
        brandColors,
        mockupCount: MOCKUP_CONFIG.MOCKUP_COUNT,
        timestamp: new Date().toISOString(),
      });

      // Étape 1: Analyser le projet pour déterminer les supports adaptés
      logger.info('Analyzing project to select appropriate mockup supports', {
        projectId,
        industry,
        mockupCount: MOCKUP_CONFIG.MOCKUP_COUNT,
      });

      const selectedSupports = await mockupAnalyzerService.analyzeMockupSupports(
        industry,
        projectDescription,
        brandName,
        MOCKUP_CONFIG.MOCKUP_COUNT
      );

      logger.info('Mockup supports selected by analyzer', {
        projectId,
        selectedSupports: selectedSupports.map((s) => ({
          index: s.mockupIndex,
          type: s.supportType,
          name: s.supportName,
          priority: s.priority,
        })),
      });

      // Étape 2: Télécharger le logo comme image base64 pour l'envoyer à Gemini
      const convertedLogo = await this.urlToBase64(logoUrl);
      const logoImageBase64 = convertedLogo.base64;
      let logoMimeType = convertedLogo.mimeType;

      // Étape 3: Génération de tous les mockups en parallèle avec les supports sélectionnés
      logger.info(`Generating ${selectedSupports.length} mockups in parallel`, {
        projectId,
        mockupCount: selectedSupports.length,
      });

      const mockupPromises = selectedSupports.map((selectedSupport) =>
        this.generateMockup(
          {
            logoImageBase64,
            logoMimeType,
            brandColors,
            brandName,
            projectDescription,
            selectedSupport,
          },
          userId,
          projectId,
          `mockup-${selectedSupport.mockupIndex}`
        )
      );

      const mockups = await Promise.all(mockupPromises);

      const duration = Date.now() - startTime;

      logger.info('Project mockups generation completed successfully', {
        projectId,
        userId,
        industry,
        mockupCount: mockups.length,
        mockupUrls: mockups.map((m) => m.mockupUrl),
        supportTypes: mockups.map((m) => m.supportType),
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      });

      return mockups;
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
   * Utilise le support sélectionné par l'analyseur pour créer un prompt dynamique
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
        supportType: request.selectedSupport.supportType,
        supportName: request.selectedSupport.supportName,
        brandName: request.brandName,
        hasLogoImage: !!request.logoImageBase64,
        logoBase64Length: request.logoImageBase64?.length || 0,
        mockupIndex: request.selectedSupport.mockupIndex,
        priority: request.selectedSupport.priority,
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
        `[MOCKUP] ✅ GEMINI_API_KEY is configured, proceeding with real image generation for mockup ${request.selectedSupport.mockupIndex}`
      );

      // Construire le contenu multimodal (texte + image du logo)
      const contents = this.buildMultimodalContent(request);

      logger.info(`[MOCKUP][${mockupName}] Multimodal content built for Gemini`, {
        mockupName,
        hasImagePart: !!request.logoImageBase64,
        projectId,
      });

      // Générer l'image avec Gemini
      logger.info(
        `[MOCKUP][${mockupName}] Calling Gemini Image API (gemini-3.1-flash-image-preview)`,
        {
          mockupName,
          model: 'gemini-3.1-flash-image-preview',
          mockupIndex: request.selectedSupport.mockupIndex,
          projectId,
        }
      );

      const response = await this.geminiAI.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
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
        `[MOCKUP] ✅ Gemini image generated for mockup ${request.selectedSupport.mockupIndex} (${Math.round(imageBuffer.length / 1024)}KB) — now uploading to Firebase Storage bucket...`
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
        mockupIndex: request.selectedSupport.mockupIndex,
        bucketUrl: uploadResult.downloadURL,
        fileName: uploadResult.fileName,
        filePath: uploadResult.filePath,
        duration: `${mockupDuration}ms`,
        projectId,
      });
      console.log(
        `[MOCKUP] ✅ Upload SUCCESS for mockup ${request.selectedSupport.mockupIndex} → Bucket URL: ${uploadResult.downloadURL}`
      );

      return {
        mockupUrl: uploadResult.downloadURL,
        templateId: mockupName,
        mockupType: request.selectedSupport.supportType,
        supportType: request.selectedSupport.supportType,
        supportName: request.selectedSupport.supportName,
        title: request.selectedSupport.supportName,
        description: `${request.selectedSupport.supportName} - ${request.selectedSupport.context}`,
        mockupIndex: request.selectedSupport.mockupIndex,
        priority: request.selectedSupport.priority,
      };
    } catch (error: any) {
      const mockupDuration = Date.now() - mockupStartTime;

      logger.error(`[MOCKUP][${mockupName}] ❌ Error generating mockup`, {
        error: error.message,
        stack: error.stack,
        mockupName,
        brandName: request.brandName,
        supportType: request.selectedSupport.supportType,
        duration: `${mockupDuration}ms`,
        projectId,
        userId,
      });

      // Ne PAS retourner de placeholder - propager l'erreur pour que le service appelant sache que la génération a échoué
      console.error(
        `[MOCKUP] ❌ Mockup ${request.selectedSupport.mockupIndex} generation FAILED: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Construit le contenu multimodal (texte + image du logo) pour Gemini
   * Utilise le nouveau système de prompts dynamiques basé sur le support sélectionné
   */
  private buildMultimodalContent(request: MockupGenerationRequest): Content[] {
    const {
      brandName,
      brandColors,
      projectDescription,
      logoImageBase64,
      logoMimeType,
      selectedSupport,
    } = request;

    // Utiliser le nouveau prompt dynamique qui s'adapte au support sélectionné
    const textPrompt = MOCKUP_GENERATION_PROMPT.buildDynamicPrompt({
      brandName,
      brandColors,
      projectDescription,
      hasLogo: !!logoImageBase64,
      selectedSupport,
    });

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
