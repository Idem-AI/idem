import logger from '../config/logger';
import { StorageService } from './storage.service';
import sharp from 'sharp';
import { MOCKUP_GENERATION_PROMPT } from './BandIdentity/prompts/mockup-generation.prompt';
import {
  mockupAnalyzerService,
  SelectedMockupSupport,
} from './BandIdentity/mockupAnalyzer.service';
import { MOCKUP_CONFIG } from '../config/mockup.config';
import { AI_CONFIG } from '../config/ai.config';
import { generateImage, isGlmConfigured } from './glm-media.service';

/**
 * Largeur du logo incrusté, en fraction de la largeur de la scène. Assez pour
 * se lire sur un mockup, assez peu pour rester crédible sur le support.
 */
const LOGO_WIDTH_RATIO = 0.22;
import { withGeminiFallback } from '../utils/gemini-fallback';


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
  pdfFormat?: string;
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
  private readonly storageService: StorageService;

  constructor() {
    this.storageService = new StorageService();
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
    projectId: string,
    pdfFormat?: string
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

      // Étape 3: Génération de tous les mockups séquentiellement avec les supports sélectionnés
      // (Pour éviter les erreurs 429 RESOURCE_EXHAUSTED liées aux quotas stricts d'Imagen)
      logger.info(`Generating ${selectedSupports.length} mockups sequentially`, {
        projectId,
        mockupCount: selectedSupports.length,
      });

      const mockups: MockupGenerationResult[] = [];
      for (const selectedSupport of selectedSupports) {
        const mockup = await this.generateMockup(
          {
            logoImageBase64,
            logoMimeType,
            brandColors,
            brandName,
            projectDescription,
            selectedSupport,
            pdfFormat,
          },
          userId,
          projectId,
          `mockup-${selectedSupport.mockupIndex}`
        );
        mockups.push(mockup);
      }

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
      if (!isGlmConfigured()) {
        logger.error(`[MOCKUP][${mockupName}] GLM_API_KEY absente - cannot generate mockup images`, {
          mockupName,
          projectId,
        });
        throw new Error('GLM_API_KEY is not configured. Cannot generate mockup images.');
      }

      console.log(
        `[MOCKUP] ✅ GLM ready — generating scene for mockup ${request.selectedSupport.mockupIndex}`
      );

      // La scène est produite SANS logo, puis le vrai logo y est incrusté.
      //
      // L'API d'image de Z.ai ne prend pas d'image en entrée : lui décrire le
      // logo l'aurait fait en dessiner un approchant — inacceptable sur un
      // livrable de marque. Composer l'image nous-mêmes donne un logo exact au
      // pixel près, ce qu'aucune génération conditionnée ne garantissait.
      const scenePrompt = this.buildScenePrompt(request);

      logger.info(`[MOCKUP][${mockupName}] Generating scene with ${AI_CONFIG.branding.brandMockup.imageModel}`, {
        mockupName,
        mockupIndex: request.selectedSupport.mockupIndex,
        hasLogo: !!request.logoImageBase64,
        projectId,
      });

      const scene = await generateImage(scenePrompt, {
        model: AI_CONFIG.branding.brandMockup.imageModel,
        fallbackModel: AI_CONFIG.fallback.imageModel,
        tag: mockupName,
      });

      let imageBuffer: Buffer = scene.buffer;
      const imageMimeType = scene.mimeType;

      if (request.logoImageBase64) {
        imageBuffer = await this.compositeLogo(
          scene.buffer,
          Buffer.from(request.logoImageBase64, 'base64'),
          mockupName
        );
      }

      console.log(
        `[MOCKUP] ✅ Mockup composed for ${request.selectedSupport.mockupIndex} (${Math.round(imageBuffer.length / 1024)}KB) — now uploading to Firebase Storage bucket...`
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
  /**
   * Décrit la scène du mockup, sans logo.
   *
   * On reprend le prompt dynamique existant — il connaît le support, la marque
   * et les couleurs — et on lui retire le logo pour le remplacer par une zone
   * libre au centre, où l'incrustation viendra se poser.
   */
  private buildScenePrompt(request: MockupGenerationRequest): string {
    const { brandName, brandColors, projectDescription, selectedSupport } = request;

    const base = MOCKUP_GENERATION_PROMPT.buildDynamicPrompt({
      brandName,
      brandColors,
      projectDescription,
      // Le logo n'est pas dessiné par le modèle : il est incrusté ensuite.
      hasLogo: false,
      selectedSupport,
      pdfFormat: request.pdfFormat,
    });

    return [
      base,
      '',
      'CRITICAL: Do NOT draw any logo, wordmark, brand name, letter or symbol on the product.',
      'Leave the CENTER of the product surface visually clean and uncluttered —',
      'flat, evenly lit, free of text, patterns, seams or reflections — so that the real',
      'brand logo can be composited there afterwards. Render only the support, the scene',
      'and the lighting.',
    ].join('\n');
  }

  /**
   * Incruste le logo au centre de la scène.
   *
   * Le logo est ramené à une fraction de la largeur, puis posé au centre — là
   * où le prompt a demandé de laisser la surface libre. `sharp` conserve la
   * transparence du PNG, le logo se pose donc sans cadre.
   */
  private async compositeLogo(
    scene: Buffer,
    logo: Buffer,
    mockupName: string
  ): Promise<Buffer> {
    try {
      const { width, height } = await sharp(scene).metadata();
      if (!width || !height) {
        return scene;
      }

      const logoWidth = Math.round(width * LOGO_WIDTH_RATIO);
      const resizedLogo = await sharp(logo)
        .resize({ width: logoWidth, fit: 'inside', withoutEnlargement: false })
        .png()
        .toBuffer();

      const logoMeta = await sharp(resizedLogo).metadata();
      const left = Math.round((width - (logoMeta.width ?? logoWidth)) / 2);
      const top = Math.round((height - (logoMeta.height ?? logoWidth)) / 2);

      return await sharp(scene)
        .composite([{ input: resizedLogo, left: Math.max(0, left), top: Math.max(0, top) }])
        .png()
        .toBuffer();
    } catch (error: any) {
      // Un mockup sans logo reste exploitable ; pas de mockup du tout, non.
      logger.warn(`[MOCKUP][${mockupName}] Logo compositing failed: ${error?.message}`);
      return scene;
    }
  }

  /**
   * Génère un seul mockup (méthode publique pour usage externe)
   * Flow: SVG→PNG conversion → Gemini image generation → Firebase Storage upload → return URL
   * Gemini décide lui-même la scène de mockup en fonction du contexte du projet
   */

  async urlToBase64(url: string) {
    try {
      const input = (url || '').trim();
      let buffer: Buffer;
      let mimeType: string;

      if (input.startsWith('<svg') || input.startsWith('<?xml')) {
        // Le logo est du SVG inline (markup), pas une URL : pas de fetch
        buffer = Buffer.from(input, 'utf8');
        mimeType = 'image/svg+xml';
      } else if (input.startsWith('data:')) {
        // Data URL : décodage direct
        const match = input.match(/^data:([^;,]+)?(;base64)?,([\s\S]*)$/);
        if (!match) {
          throw new Error('Invalid data URL for logo');
        }
        mimeType = match[1] || 'application/octet-stream';
        buffer = match[2]
          ? Buffer.from(match[3], 'base64')
          : Buffer.from(decodeURIComponent(match[3]), 'utf8');
      } else {
        const response = await fetch(input);

        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.statusText}`);
        }

        mimeType = response.headers.get('content-type') || 'application/octet-stream';
        const arrayBuffer = await response.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
      }

      // ✅ si SVG → conversion PNG (densité élevée pour un rendu net dans les mockups)
      if (mimeType.includes('image/svg') || mimeType.includes('text/xml')) {
        console.log('⚡ SVG detected → converting to PNG...');

        // Un asset servi en image/svg+xml dont le corps n'est pas du markup ferait
        // échouer sharp sur « unsupported image format », sans indiquer la source.
        if (!buffer.toString('utf8', 0, 512).includes('<svg')) {
          throw new Error(
            `Asset served as SVG but body is not SVG markup: ${input.slice(0, 120)}`
          );
        }

        buffer = (await sharp(buffer, { density: 300 })
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
