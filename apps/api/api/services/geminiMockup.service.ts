import { GoogleGenAI } from '@google/genai';
import logger from '../config/logger';
import { StorageService } from './storage.service';

export interface MockupGenerationRequest {
  templateId: string;
  logoUrl: string;
  brandColors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  mockupType: 'business_card' | 'laptop_screen' | 'mobile_app' | 'packaging' | 'signage' | 'merchandise';
  industry: string;
  brandName: string;
}

export interface MockupGenerationResult {
  mockupUrl: string;
  templateId: string;
  mockupType: string;
  title: string;
  description: string;
}

export interface IndustryMockupConfig {
  mockup1: {
    templateId: string;
    mockupType: string;
    title: string;
    description: string;
  };
  mockup2: {
    templateId: string;
    mockupType: string;
    title: string;
    description: string;
  };
}

export class GeminiMockupService {
  private readonly geminiAI: GoogleGenAI;
  private readonly storageService: StorageService;

  // Configuration des mockups par industrie
  private readonly industryMockups: Record<string, IndustryMockupConfig> = {
    'tech': {
      mockup1: {
        templateId: 'laptop_screen_modern',
        mockupType: 'laptop_screen',
        title: 'Interface Application',
        description: 'Présentation de l\'interface utilisateur sur écran d\'ordinateur portable moderne'
      },
      mockup2: {
        templateId: 'mobile_app_interface',
        mockupType: 'mobile_app',
        title: 'Application Mobile',
        description: 'Design de l\'application mobile avec interface utilisateur optimisée'
      }
    },
    'healthcare': {
      mockup1: {
        templateId: 'medical_packaging',
        mockupType: 'packaging',
        title: 'Packaging Médical',
        description: 'Emballage médical professionnel avec branding sécurisé et confiant'
      },
      mockup2: {
        templateId: 'clinic_signage',
        mockupType: 'signage',
        title: 'Signalétique Clinique',
        description: 'Signalétique professionnelle pour environnement médical'
      }
    },
    'finance': {
      mockup1: {
        templateId: 'corporate_letterhead',
        mockupType: 'packaging',
        title: 'Papier à En-tête',
        description: 'Papier à en-tête corporatif avec design professionnel et élégant'
      },
      mockup2: {
        templateId: 'office_signage_professional',
        mockupType: 'signage',
        title: 'Signalétique Bureau',
        description: 'Signalétique de bureau professionnelle pour environnement financier'
      }
    },
    'creative': {
      mockup1: {
        templateId: 'portfolio_presentation',
        mockupType: 'packaging',
        title: 'Présentation Portfolio',
        description: 'Présentation créative de portfolio avec design artistique'
      },
      mockup2: {
        templateId: 'studio_signage_creative',
        mockupType: 'signage',
        title: 'Signalétique Studio',
        description: 'Signalétique créative pour studio artistique ou agence'
      }
    },
    'food': {
      mockup1: {
        templateId: 'menu_design_elegant',
        mockupType: 'packaging',
        title: 'Design Menu',
        description: 'Menu élégant avec présentation gastronomique professionnelle'
      },
      mockup2: {
        templateId: 'restaurant_signage',
        mockupType: 'signage',
        title: 'Signalétique Restaurant',
        description: 'Signalétique restaurant avec ambiance chaleureuse et appétissante'
      }
    },
    'retail': {
      mockup1: {
        templateId: 'product_packaging',
        mockupType: 'packaging',
        title: 'Packaging Produit',
        description: 'Emballage produit attractif avec design commercial optimisé'
      },
      mockup2: {
        templateId: 'shopping_bag_premium',
        mockupType: 'merchandise',
        title: 'Sac Shopping Premium',
        description: 'Sac shopping haut de gamme avec branding élégant'
      }
    },
    'default': {
      mockup1: {
        templateId: 'laptop_screen_modern',
        mockupType: 'laptop_screen',
        title: 'Présentation Écran',
        description: 'Présentation professionnelle sur écran d\'ordinateur'
      },
      mockup2: {
        templateId: 'product_packaging',
        mockupType: 'packaging',
        title: 'Packaging Générique',
        description: 'Emballage professionnel avec branding cohérent'
      }
    }
  };

  constructor() {
    this.geminiAI = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || ''
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
    userId: string,
    projectId: string
  ): Promise<{
    mockup1: MockupGenerationResult;
    mockup2: MockupGenerationResult;
  }> {
    const startTime = Date.now();

    try {
      logger.info('🎨 Starting mockup generation for project', {
        projectId,
        userId,
        industry,
        brandName,
        logoUrl,
        brandColors,
        timestamp: new Date().toISOString()
      });

      // Configuration des mockups selon l'industrie
      const industryConfig = this.industryMockups[industry.toLowerCase()] || this.industryMockups['default'];

      logger.info('📋 Industry configuration selected', {
        industry: industry.toLowerCase(),
        mockup1Type: industryConfig.mockup1.mockupType,
        mockup2Type: industryConfig.mockup2.mockupType,
        projectId
      });

      // Génération des 2 mockups en parallèle
      const [mockup1, mockup2] = await Promise.all([
        this.generateMockup({
          templateId: industryConfig.mockup1.templateId,
          logoUrl,
          brandColors,
          mockupType: industryConfig.mockup1.mockupType as any,
          industry,
          brandName
        }, userId, projectId, 'mockup-1'),

        this.generateMockup({
          templateId: industryConfig.mockup2.templateId,
          logoUrl,
          brandColors,
          mockupType: industryConfig.mockup2.mockupType as any,
          industry,
          brandName
        }, userId, projectId, 'mockup-2')
      ]);

      const duration = Date.now() - startTime;

      logger.info('✅ Project mockups generation completed successfully', {
        projectId,
        userId,
        industry,
        mockup1Url: mockup1.mockupUrl,
        mockup2Url: mockup2.mockupUrl,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      });

      return {
        mockup1: {
          ...mockup1,
          title: industryConfig.mockup1.title,
          description: industryConfig.mockup1.description
        },
        mockup2: {
          ...mockup2,
          title: industryConfig.mockup2.title,
          description: industryConfig.mockup2.description
        }
      };

    } catch (error: any) {
      const duration = Date.now() - startTime;

      logger.error('❌ Error generating project mockups', {
        error: error.message,
        stack: error.stack,
        projectId,
        userId,
        industry,
        brandName,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      });

      throw new Error(`Failed to generate mockups: ${error.message}`);
    }
  }

  /**
   * Génère un mockup individuel avec Gemini 2.5 Flash Image
   */
  private async generateMockup(
    request: MockupGenerationRequest,
    userId: string,
    projectId: string,
    mockupName: string
  ): Promise<MockupGenerationResult> {
    const mockupStartTime = Date.now();

    try {
      logger.info('🖼️ Starting individual mockup generation', {
        mockupName,
        templateId: request.templateId,
        mockupType: request.mockupType,
        industry: request.industry,
        brandName: request.brandName,
        logoUrl: request.logoUrl,
        projectId,
        userId,
        timestamp: new Date().toISOString()
      });

      // Si l'API key n'est pas configurée, retourner un mockup placeholder
      if (!process.env.GEMINI_API_KEY) {
        logger.warn('⚠️ Gemini API not configured, returning placeholder mockup', {
          mockupName,
          projectId
        });
        return this.generatePlaceholderMockup(request, mockupName);
      }

      // Créer le prompt pour Gemini basé sur le type de mockup et l'industrie
      const prompt = this.createMockupPrompt(request);

      logger.info('📝 Mockup prompt created', {
        mockupName,
        promptLength: prompt.length,
        mockupType: request.mockupType,
        projectId
      });

      // Générer l'image avec Gemini 2.5 Flash Image
      logger.info('🤖 Calling Gemini 2.5 Flash Image API', {
        mockupName,
        model: 'gemini-3-pro-preview-image',
        projectId
      });

      const response = await this.geminiAI.models.generateContent({
        model: 'gemini-3-pro-preview-image',
        contents: prompt,
      });

      logger.info('📡 Gemini API response received', {
        mockupName,
        hasCandidates: !!(response.candidates && response.candidates.length > 0),
        candidatesCount: response.candidates?.length || 0,
        projectId
      });

      // Extraire l'image générée
      let imageBuffer: Buffer | null = null;

      if (response.candidates && response.candidates[0] && response.candidates[0].content && response.candidates[0].content.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData && part.inlineData.data) {
            const imageData = part.inlineData.data;
            imageBuffer = Buffer.from(imageData, 'base64');

            logger.info('🎯 Image data extracted from Gemini response', {
              mockupName,
              imageSize: imageBuffer.length,
              projectId
            });
            break;
          }
        }
      }

      if (!imageBuffer) {
        throw new Error('No image generated by Gemini - response did not contain image data');
      }

      // Stocker l'image sur Firebase Storage dans le dossier Mockups du projet
      const fileName = `${mockupName}-${Date.now()}.png`;
      const folderPath = `projects/${projectId}/Mockups`;

      logger.info('☁️ Uploading mockup to Firebase Storage', {
        mockupName,
        fileName,
        folderPath,
        imageSize: imageBuffer.length,
        projectId
      });

      const uploadResult = await this.storageService.uploadFile(
        imageBuffer,
        fileName,
        folderPath,
        'image/png'
      );

      const mockupDuration = Date.now() - mockupStartTime;

      logger.info('✅ Mockup generated and stored successfully', {
        mockupName,
        templateId: request.templateId,
        mockupType: request.mockupType,
        downloadURL: uploadResult.downloadURL,
        fileName,
        duration: `${mockupDuration}ms`,
        projectId,
        timestamp: new Date().toISOString()
      });

      return {
        mockupUrl: uploadResult.downloadURL,
        templateId: request.templateId,
        mockupType: request.mockupType,
        title: '',
        description: ''
      };

    } catch (error: any) {
      const mockupDuration = Date.now() - mockupStartTime;

      logger.error('❌ Error generating individual mockup', {
        error: error.message,
        stack: error.stack,
        mockupName,
        templateId: request.templateId,
        mockupType: request.mockupType,
        brandName: request.brandName,
        industry: request.industry,
        duration: `${mockupDuration}ms`,
        projectId,
        userId,
        timestamp: new Date().toISOString()
      });

      // En cas d'erreur, retourner un placeholder
      logger.info('🔄 Fallback to placeholder mockup', {
        mockupName,
        projectId
      });

      return this.generatePlaceholderMockup(request, mockupName);
    }
  }

  /**
   * Crée un prompt spécifique pour générer un mockup avec Gemini incluant le logo
   */
  private createMockupPrompt(request: MockupGenerationRequest): string {
    const { mockupType, brandName, brandColors, industry, logoUrl } = request;

    // Prompt de base avec intégration du logo
    const basePrompt = `Create a professional, photorealistic mockup image for the brand "${brandName}" in the ${industry} industry. The mockup MUST include the brand logo prominently and professionally integrated into the design.`;

    const colorInfo = `Use these exact brand colors: primary ${brandColors.primary}, secondary ${brandColors.secondary}, accent ${brandColors.accent}. The logo should be clearly visible and well-integrated with these colors.`;

    const logoIntegration = `IMPORTANT: The brand logo must be prominently displayed and professionally integrated into the mockup. The logo should be clearly readable, properly sized, and positioned according to professional design standards for the ${industry} industry.`;

    let specificPrompt = '';

    switch (mockupType) {
      case 'business_card':
        specificPrompt = `Create an elegant business card mockup featuring the "${brandName}" logo prominently on the front. The card should have a professional design suitable for the ${industry} industry, with clean typography and the brand colors integrated tastefully. The logo should be the focal point of the card design. Show the card on a modern desk setup with soft, professional lighting. The card should look premium and industry-appropriate.`;
        break;

      case 'laptop_screen':
        specificPrompt = `Show a modern laptop screen displaying a professional interface or website for "${brandName}" with the logo prominently featured in the header or main area. The screen should show a clean, modern UI design appropriate for the ${industry} industry. The logo should be clearly visible and well-integrated into the interface design. Include the brand colors throughout the interface. The laptop should be on a clean desk with professional lighting.`;
        break;

      case 'mobile_app':
        specificPrompt = `Show a smartphone displaying a mobile app interface for "${brandName}" with the logo prominently displayed in the app header or splash screen. The app should have a modern, user-friendly design appropriate for the ${industry} industry. The logo should be clearly visible and the brand colors should be used throughout the interface. Show the phone in a professional setting with good lighting.`;
        break;

      case 'packaging':
        specificPrompt = `Show professional product packaging for "${brandName}" with the logo prominently featured on the front panel. The packaging should be elegant and modern, suitable for the ${industry} industry. The logo should be the main visual element, clearly readable and well-positioned. Incorporate the brand colors effectively throughout the packaging design. Show the packaging in a clean, well-lit environment that emphasizes premium quality.`;
        break;

      case 'signage':
        specificPrompt = `Show professional signage for "${brandName}" with the logo as the central element. The sign should be modern and elegant, appropriate for the ${industry} industry. The logo should be clearly visible, properly sized, and the main focal point of the signage. Use the brand colors effectively in the sign design. Show it in a realistic business environment with professional lighting.`;
        break;

      case 'merchandise':
        specificPrompt = `Show premium merchandise (like a shopping bag, t-shirt, or branded item) for "${brandName}" with the logo prominently displayed. The item should look high-quality and professional, suitable for the ${industry} industry. The logo should be clearly visible and well-integrated into the merchandise design. Incorporate the brand colors tastefully. Show it in an elegant, professional setting.`;
        break;

      default:
        specificPrompt = `Show a professional branded item for "${brandName}" in the ${industry} industry with the logo prominently featured. The logo should be clearly visible and the brand colors should be incorporated in an elegant and modern way.`;
    }

    const qualityRequirements = `The final image should be high-quality, photorealistic, and suitable for professional brand presentation. Ensure excellent lighting, composition, and attention to detail. The logo must be sharp, clear, and professionally integrated into the overall design.`;

    return `${basePrompt} ${colorInfo} ${logoIntegration} ${specificPrompt} ${qualityRequirements}`;
  }

  /**
   * Génère un mockup placeholder en cas d'erreur ou d'API non configurée
   */
  private generatePlaceholderMockup(
    request: MockupGenerationRequest,
    mockupName: string
  ): MockupGenerationResult {
    logger.info('🎭 Generating placeholder mockup', {
      mockupName,
      mockupType: request.mockupType,
      brandName: request.brandName,
      industry: request.industry,
      templateId: request.templateId,
      timestamp: new Date().toISOString()
    });

    // URL d'image placeholder basée sur le type de mockup avec les couleurs de la marque
    const primaryColor = request.brandColors.primary.replace('#', '');
    const secondaryColor = request.brandColors.secondary.replace('#', '');

    const placeholderUrls = {
      'business_card': `https://via.placeholder.com/350x200/${primaryColor}/${secondaryColor}?text=${encodeURIComponent(request.brandName + ' Business Card')}`,
      'laptop_screen': `https://via.placeholder.com/800x600/${primaryColor}/${secondaryColor}?text=${encodeURIComponent(request.brandName + ' Interface')}`,
      'mobile_app': `https://via.placeholder.com/300x600/${primaryColor}/${secondaryColor}?text=${encodeURIComponent(request.brandName + ' App')}`,
      'packaging': `https://via.placeholder.com/400x400/${primaryColor}/${secondaryColor}?text=${encodeURIComponent(request.brandName + ' Package')}`,
      'signage': `https://via.placeholder.com/600x400/${primaryColor}/${secondaryColor}?text=${encodeURIComponent(request.brandName + ' Sign')}`,
      'merchandise': `https://via.placeholder.com/400x400/${primaryColor}/${secondaryColor}?text=${encodeURIComponent(request.brandName + ' Merch')}`
    };

    const placeholderUrl = placeholderUrls[request.mockupType] || placeholderUrls['packaging'];

    logger.info('✅ Placeholder mockup generated', {
      mockupName,
      mockupType: request.mockupType,
      placeholderUrl,
      brandColors: request.brandColors,
      timestamp: new Date().toISOString()
    });

    return {
      mockupUrl: placeholderUrl,
      templateId: request.templateId,
      mockupType: request.mockupType,
      title: '',
      description: ''
    };
  }

  /**
   * Génère un seul mockup (méthode publique pour usage externe)
   */
  async generateSingleMockup(
    logoUrl: string,
    brandColors: { primary: string; secondary: string; accent: string },
    industry: string,
    brandName: string,
    mockupType: string,
    userId: string,
    projectId: string,
    mockupIndex: number
  ): Promise<MockupGenerationResult | null> {
    try {
      const request: MockupGenerationRequest = {
        templateId: `${mockupType}_${mockupIndex}`,
        logoUrl,
        brandColors,
        mockupType: mockupType as any,
        industry,
        brandName
      };

      return await this.generateMockup(request, userId, projectId, `mockup-${mockupIndex}`);
    } catch (error) {
      logger.error('Error generating single mockup:', error);
      return null;
    }
  }
}

export const geminiMockupService = new GeminiMockupService();
