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
   * Génère les mockups pour un projet
   */
  async generateProjectMockups(
    logoUrl: string,
    brandColors: { primary: string; secondary: string; accent: string },
    industry: string,
    brandName: string,
    userId: string,
    projectId: string
  ): Promise<{
    businessCard: MockupGenerationResult;
    mockup1: MockupGenerationResult;
    mockup2: MockupGenerationResult;
  }> {
    try {
      logger.info('Starting mockup generation for project', {
        projectId,
        userId,
        industry,
        brandName
      });

      // Configuration des mockups selon l'industrie
      const industryConfig = this.industryMockups[industry.toLowerCase()] || this.industryMockups['default'];

      // Génération des 3 mockups en parallèle
      const [businessCard, mockup1, mockup2] = await Promise.all([
        this.generateMockup({
          templateId: 'business_card_premium',
          logoUrl,
          brandColors,
          mockupType: 'business_card',
          industry,
          brandName
        }, userId, projectId, 'business-card'),

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

      return {
        businessCard: {
          ...businessCard,
          title: 'Carte de Visite',
          description: 'Carte de visite professionnelle avec design optimisé et typographie élégante'
        },
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
      logger.error('Error generating project mockups', {
        error: error.message,
        projectId,
        userId,
        industry
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
    try {
      // Si l'API key n'est pas configurée, retourner un mockup placeholder
      if (!process.env.GEMINI_API_KEY) {
        logger.warn('Gemini API not configured, returning placeholder mockup');
        return this.generatePlaceholderMockup(request, mockupName);
      }

      logger.info('Generating mockup with Gemini 2.5 Flash Image', {
        templateId: request.templateId,
        mockupType: request.mockupType,
        industry: request.industry
      });

      // Créer le prompt pour Gemini basé sur le type de mockup et l'industrie
      const prompt = this.createMockupPrompt(request);

      // Générer l'image avec Gemini 2.5 Flash Image
      const response = await this.geminiAI.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: prompt,
      });

      // Extraire l'image générée
      let imageBuffer: Buffer | null = null;

      if (response.candidates && response.candidates[0] && response.candidates[0].content && response.candidates[0].content.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData && part.inlineData.data) {
            const imageData = part.inlineData.data;
            imageBuffer = Buffer.from(imageData, 'base64');
            break;
          }
        }
      }

      if (!imageBuffer) {
        throw new Error('No image generated by Gemini');
      }

      // Stocker l'image sur Firebase Storage
      const fileName = `${mockupName}-${Date.now()}.png`;
      const folderPath = `users/${userId}/projects/${projectId}/mockups`;

      const uploadResult = await this.storageService.uploadFile(
        imageBuffer,
        fileName,
        folderPath,
        'image/png'
      );

      logger.info('Mockup generated and stored successfully', {
        templateId: request.templateId,
        mockupType: request.mockupType,
        downloadURL: uploadResult.downloadURL
      });

      return {
        mockupUrl: uploadResult.downloadURL,
        templateId: request.templateId,
        mockupType: request.mockupType,
        title: '',
        description: ''
      };

    } catch (error: any) {
      logger.error('Error generating individual mockup', {
        error: error.message,
        templateId: request.templateId,
        mockupType: request.mockupType
      });

      // En cas d'erreur, retourner un placeholder
      return this.generatePlaceholderMockup(request, mockupName);
    }
  }

  /**
   * Crée un prompt spécifique pour générer un mockup avec Gemini
   */
  private createMockupPrompt(request: MockupGenerationRequest): string {
    const { mockupType, brandName, brandColors, industry } = request;

    const basePrompt = `Create a professional, photorealistic mockup image for the brand "${brandName}" in the ${industry} industry.`;

    const colorInfo = `Use these brand colors: primary ${brandColors.primary}, secondary ${brandColors.secondary}, accent ${brandColors.accent}.`;

    let specificPrompt = '';

    switch (mockupType) {
      case 'business_card':
        specificPrompt = `Show an elegant business card mockup with the brand name "${brandName}" prominently displayed. The card should have a professional design suitable for the ${industry} industry, with clean typography and the brand colors integrated tastefully. Show the card on a modern desk setup with soft lighting.`;
        break;

      case 'laptop_screen':
        specificPrompt = `Show a modern laptop screen displaying a professional interface or website for "${brandName}". The screen should show a clean, modern UI design appropriate for the ${industry} industry. Include the brand colors in the interface design. The laptop should be on a clean desk with professional lighting.`;
        break;

      case 'mobile_app':
        specificPrompt = `Show a smartphone displaying a mobile app interface for "${brandName}". The app should have a modern, user-friendly design appropriate for the ${industry} industry. Use the brand colors throughout the interface. Show the phone in a professional setting with good lighting.`;
        break;

      case 'packaging':
        specificPrompt = `Show professional product packaging for "${brandName}" suitable for the ${industry} industry. The packaging should be elegant and modern, incorporating the brand colors effectively. Show the packaging in a clean, well-lit environment that emphasizes the premium quality.`;
        break;

      case 'signage':
        specificPrompt = `Show professional signage for "${brandName}" appropriate for the ${industry} industry. The sign should be modern and elegant, using the brand colors effectively. Show it in a realistic business environment with professional lighting.`;
        break;

      case 'merchandise':
        specificPrompt = `Show premium merchandise (like a shopping bag or branded item) for "${brandName}" suitable for the ${industry} industry. The item should look high-quality and professional, incorporating the brand colors tastefully. Show it in an elegant setting.`;
        break;

      default:
        specificPrompt = `Show a professional branded item for "${brandName}" in the ${industry} industry, incorporating the brand colors in an elegant and modern way.`;
    }

    return `${basePrompt} ${colorInfo} ${specificPrompt} The image should be high-quality, photorealistic, and suitable for professional brand presentation. Ensure excellent lighting, composition, and attention to detail.`;
  }

  /**
   * Génère un mockup placeholder en cas d'erreur ou d'API non configurée
   */
  private generatePlaceholderMockup(
    request: MockupGenerationRequest,
    mockupName: string
  ): MockupGenerationResult {
    // URL d'image placeholder basée sur le type de mockup
    const placeholderUrls = {
      'business_card': 'https://via.placeholder.com/350x200/f3f4f6/6b7280?text=Business+Card+Mockup',
      'laptop_screen': 'https://via.placeholder.com/800x600/f3f4f6/6b7280?text=Laptop+Screen+Mockup',
      'mobile_app': 'https://via.placeholder.com/300x600/f3f4f6/6b7280?text=Mobile+App+Mockup',
      'packaging': 'https://via.placeholder.com/400x400/f3f4f6/6b7280?text=Packaging+Mockup',
      'signage': 'https://via.placeholder.com/600x400/f3f4f6/6b7280?text=Signage+Mockup',
      'merchandise': 'https://via.placeholder.com/400x400/f3f4f6/6b7280?text=Merchandise+Mockup'
    };

    return {
      mockupUrl: placeholderUrls[request.mockupType] || placeholderUrls['packaging'],
      templateId: request.templateId,
      mockupType: request.mockupType,
      title: '',
      description: ''
    };
  }
}

export const geminiMockupService = new GeminiMockupService();
