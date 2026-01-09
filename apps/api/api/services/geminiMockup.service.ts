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
   * Génère un mockup individuel avec Gemini  Image
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

      // Générer l'image avec Gemini
      logger.info('🤖 Calling Gemini Image API', {
        mockupName,
        model: 'gemini-3-pro-image-preview',
        projectId
      });

      const response = await this.geminiAI.models.generateContent({
        model: 'gemini-3-pro-image-preview',
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

    // Prompt de base optimisé pour l'intégration du logo
    const basePrompt = `Créez une image de mockup professionnelle et photoréaliste pour la marque "${brandName}" dans l'industrie ${industry}. Le mockup DOIT inclure le logo de la marque de manière proéminente et intégrée professionnellement dans le design.`;

    const colorInfo = `Utilisez ces couleurs exactes de la marque: primaire ${brandColors.primary}, secondaire ${brandColors.secondary}, accent ${brandColors.accent}. Le logo doit être clairement visible et bien intégré avec ces couleurs.`;

    const logoIntegration = `CRITIQUE: Le logo de la marque doit être affiché de manière proéminente et intégré professionnellement dans le mockup. Le logo doit être clairement lisible, correctement dimensionné, et positionné selon les standards de design professionnel pour l'industrie ${industry}. Assurez-vous que le logo apparaît naturellement dans le contexte du mockup.`;

    let specificPrompt = '';

    switch (mockupType) {
      case 'business_card':
        specificPrompt = `Créez un mockup de carte de visite élégante avec le logo "${brandName}" affiché de manière proéminente sur le devant. La carte doit avoir un design professionnel adapté à l'industrie ${industry}, avec une typographie propre et les couleurs de la marque intégrées avec goût. Le logo doit être le point focal du design de la carte. Montrez la carte sur un bureau moderne avec un éclairage doux et professionnel. La carte doit paraître premium et appropriée à l'industrie.`;
        break;

      case 'laptop_screen':
        specificPrompt = `Montrez un écran d'ordinateur portable moderne affichant une interface professionnelle ou un site web pour "${brandName}" avec le logo mis en avant dans l'en-tête ou la zone principale. L'écran doit montrer un design UI propre et moderne approprié à l'industrie ${industry}. Le logo doit être clairement visible et bien intégré dans le design de l'interface. Incluez les couleurs de la marque dans toute l'interface. L'ordinateur portable doit être sur un bureau propre avec un éclairage professionnel.`;
        break;

      case 'mobile_app':
        specificPrompt = `Montrez un smartphone affichant une interface d'application mobile pour "${brandName}" avec le logo affiché de manière proéminente dans l'en-tête de l'app ou l'écran de démarrage. L'app doit avoir un design moderne et convivial approprié à l'industrie ${industry}. Le logo doit être clairement visible et les couleurs de la marque doivent être utilisées dans toute l'interface. Montrez le téléphone dans un environnement professionnel avec un bon éclairage.`;
        break;

      case 'packaging':
        specificPrompt = `Montrez un packaging de produit professionnel pour "${brandName}" avec le logo mis en avant sur le panneau avant. Le packaging doit être élégant et moderne, adapté à l'industrie ${industry}. Le logo doit être l'élément visuel principal, clairement lisible et bien positionné. Incorporez les couleurs de la marque efficacement dans tout le design du packaging. Montrez le packaging dans un environnement propre et bien éclairé qui met l'accent sur la qualité premium.`;
        break;

      case 'signage':
        specificPrompt = `Montrez une signalétique professionnelle pour "${brandName}" avec le logo comme élément central. Le panneau doit être moderne et élégant, approprié à l'industrie ${industry}. Le logo doit être clairement visible, correctement dimensionné, et le point focal principal de la signalétique. Utilisez les couleurs de la marque efficacement dans le design du panneau. Montrez-le dans un environnement d'affaires réaliste avec un éclairage professionnel.`;
        break;

      case 'merchandise':
        specificPrompt = `Montrez du merchandising premium (comme un sac shopping, t-shirt, ou article de marque) pour "${brandName}" avec le logo affiché de manière proéminente. L'article doit paraître de haute qualité et professionnel, adapté à l'industrie ${industry}. Le logo doit être clairement visible et bien intégré dans le design du merchandising. Incorporez les couleurs de la marque avec goût. Montrez-le dans un environnement élégant et professionnel.`;
        break;

      default:
        specificPrompt = `Montrez un article de marque professionnel pour "${brandName}" dans l'industrie ${industry} avec le logo mis en avant. Le logo doit être clairement visible et les couleurs de la marque doivent être incorporées de manière élégante et moderne.`;
    }

    const qualityRequirements = `L'image finale doit être de haute qualité, photoréaliste, et adaptée à une présentation de marque professionnelle. Assurez-vous d'un excellent éclairage, d'une composition soignée, et d'une attention aux détails. Le logo doit être net, clair, et intégré professionnellement dans le design global. Le mockup doit donner l'impression que la marque est établie et crédible.`;

    const contextualPlacement = `Le logo doit être placé de manière contextuelle et naturelle selon le type de mockup: sur l'écran pour les interfaces, sur la surface visible pour les packaging, intégré harmonieusement dans les cartes de visite, etc. Évitez les placements artificiels ou forcés du logo.`;

    return `${basePrompt} ${colorInfo} ${logoIntegration} ${specificPrompt} ${qualityRequirements} ${contextualPlacement}`;
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
