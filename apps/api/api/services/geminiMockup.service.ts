import { GoogleGenAI, Content, Part } from '@google/genai';
import sharp from 'sharp';
import logger from '../config/logger';
import { StorageService } from './storage.service';

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
  sceneDescription: string;
  mockupTitle: string;
}

export interface MockupGenerationResult {
  mockupUrl: string;
  templateId: string;
  mockupType: string;
  title: string;
  description: string;
}

export interface IndustryMockupScene {
  scene: string;
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
   * Télécharge une image depuis une URL et la convertit en base64
   */
  private async downloadImageAsBase64(
    imageUrl: string
  ): Promise<{ base64: string; mimeType: string } | null> {
    try {
      logger.info('Downloading logo image for mockup generation', {
        imageUrl: imageUrl.substring(0, 100),
      });
      const response = await fetch(imageUrl);
      if (!response.ok) {
        logger.error('Failed to download logo image', { status: response.status });
        return null;
      }
      const contentType = response.headers.get('content-type') || 'image/png';
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const mimeType = contentType.split(';')[0].trim();
      logger.info('Logo image downloaded successfully', { size: buffer.length, mimeType });
      return { base64: buffer.toString('base64'), mimeType };
    } catch (error: any) {
      logger.error('Error downloading logo image', { error: error.message });
      return null;
    }
  }

  /**
   * Convertit un SVG string en PNG base64 via sharp pour que Gemini puisse le voir comme une image raster
   */
  private async svgToPngBase64(
    svgContent: string
  ): Promise<{ base64: string; mimeType: string } | null> {
    try {
      const svgBuffer = Buffer.from(svgContent, 'utf-8');
      const pngBuffer = await sharp(svgBuffer)
        .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
        .png()
        .toBuffer();

      logger.info('[MOCKUP] SVG converted to PNG via sharp', {
        svgSize: svgBuffer.length,
        pngSize: pngBuffer.length,
        pngSizeKB: `${Math.round(pngBuffer.length / 1024)}KB`,
      });

      return {
        base64: pngBuffer.toString('base64'),
        mimeType: 'image/png',
      };
    } catch (error: any) {
      logger.error('[MOCKUP] Failed to convert SVG to PNG with sharp', {
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Génère des scènes de mockup contextuelles basées sur la description du projet
   */
  getContextualMockupScenes(
    industry: string,
    projectDescription: string,
    brandName: string
  ): IndustryMockupScene[] {
    const lowerDesc = projectDescription.toLowerCase();
    const lowerIndustry = industry.toLowerCase();
    const scenes: IndustryMockupScene[] = [];

    // Livraison / Logistique
    if (
      lowerDesc.includes('livraison') ||
      lowerDesc.includes('delivery') ||
      lowerDesc.includes('logisti') ||
      lowerDesc.includes('transport') ||
      lowerDesc.includes('colis') ||
      lowerDesc.includes('shipping')
    ) {
      scenes.push(
        {
          scene: `A professional delivery van driving through a modern city street, with the "${brandName}" logo prominently displayed on the side of the vehicle. The van is clean and branded with the company colors. Photorealistic, professional photography, daylight.`,
          title: 'Véhicule de Livraison',
          description: `Camion de livraison ${brandName} avec le logo intégré, en contexte urbain professionnel`,
        },
        {
          scene: `A branded cardboard shipping box with the "${brandName}" logo printed on it, sitting on a doorstep with a delivery person's hand placing it. Professional product photography, warm lighting. The box looks premium and well-designed.`,
          title: 'Packaging de Livraison',
          description: `Colis de livraison ${brandName} avec branding professionnel`,
        }
      );
    }
    // Restaurant / Alimentation
    else if (
      lowerDesc.includes('restaurant') ||
      lowerDesc.includes('food') ||
      lowerDesc.includes('cuisine') ||
      lowerDesc.includes('chef') ||
      lowerDesc.includes('menu') ||
      lowerIndustry.includes('food')
    ) {
      scenes.push(
        {
          scene: `An elegant restaurant interior with the "${brandName}" logo displayed on the wall behind the reception area. Beautiful ambient lighting, modern interior design, tables set with fine dining arrangements. Photorealistic.`,
          title: 'Intérieur Restaurant',
          description: `Intérieur du restaurant ${brandName} avec signalétique de marque élégante`,
        },
        {
          scene: `A beautifully designed restaurant menu on a wooden table, with the "${brandName}" logo at the top. The menu has elegant typography and the brand colors are subtly integrated. A plate of gourmet food is partially visible. Professional food photography.`,
          title: 'Menu & Gastronomie',
          description: `Menu élégant ${brandName} avec présentation gastronomique`,
        }
      );
    }
    // Santé / Médical
    else if (
      lowerDesc.includes('santé') ||
      lowerDesc.includes('health') ||
      lowerDesc.includes('médic') ||
      lowerDesc.includes('medic') ||
      lowerDesc.includes('clinic') ||
      lowerDesc.includes('pharma') ||
      lowerIndustry.includes('health')
    ) {
      scenes.push(
        {
          scene: `A modern medical clinic building exterior with the "${brandName}" logo on the facade signage. Clean, professional architecture with glass and white surfaces. Green plants around. Photorealistic, bright daylight.`,
          title: 'Façade Clinique',
          description: `Façade de la clinique ${brandName} avec signalétique professionnelle`,
        },
        {
          scene: `Professional medical packaging (medicine box or health product) with the "${brandName}" logo prominently displayed. Clean white and brand-colored design, pharmaceutical-grade appearance. Studio photography on white background.`,
          title: 'Packaging Médical',
          description: `Packaging médical ${brandName} avec design professionnel et fiable`,
        }
      );
    }
    // E-commerce / Boutique
    else if (
      lowerDesc.includes('e-commerce') ||
      lowerDesc.includes('boutique') ||
      lowerDesc.includes('shop') ||
      lowerDesc.includes('magasin') ||
      lowerDesc.includes('vente') ||
      lowerIndustry.includes('retail')
    ) {
      scenes.push(
        {
          scene: `A premium branded shopping bag with the "${brandName}" logo, placed on a marble surface next to a stylish storefront. The bag is high-quality paper with elegant handles. Professional retail photography.`,
          title: 'Sac Shopping Premium',
          description: `Sac shopping ${brandName} avec branding haut de gamme`,
        },
        {
          scene: `A modern storefront with a large illuminated sign displaying the "${brandName}" logo. Glass windows showing products inside. Evening lighting with warm glow. Urban setting. Photorealistic.`,
          title: 'Vitrine Boutique',
          description: `Vitrine de la boutique ${brandName} avec enseigne lumineuse`,
        }
      );
    }
    // Tech / Application / SaaS
    else if (
      lowerDesc.includes('app') ||
      lowerDesc.includes('saas') ||
      lowerDesc.includes('platform') ||
      lowerDesc.includes('software') ||
      lowerDesc.includes('tech') ||
      lowerIndustry.includes('tech')
    ) {
      scenes.push(
        {
          scene: `A modern MacBook Pro on a clean desk displaying a professional web application interface for "${brandName}". The logo is visible in the top-left header. The UI uses the brand colors with a clean, modern design. Soft office lighting. Photorealistic.`,
          title: 'Interface Web',
          description: `Interface web ${brandName} sur ordinateur portable, design moderne et professionnel`,
        },
        {
          scene: `A latest-generation smartphone held in hand, displaying the "${brandName}" mobile app splash screen with the logo centered. Modern UI design with brand colors. Blurred office background. Professional product photography.`,
          title: 'Application Mobile',
          description: `Application mobile ${brandName} avec écran d'accueil brandé`,
        }
      );
    }
    // Finance / Banque
    else if (
      lowerDesc.includes('financ') ||
      lowerDesc.includes('banque') ||
      lowerDesc.includes('bank') ||
      lowerDesc.includes('invest') ||
      lowerDesc.includes('assurance') ||
      lowerIndustry.includes('finance')
    ) {
      scenes.push(
        {
          scene: `An elegant corporate office reception area with the "${brandName}" logo displayed as a large backlit sign on the wall behind the reception desk. Premium materials (marble, wood, glass). Professional corporate photography.`,
          title: 'Réception Corporate',
          description: `Réception du bureau ${brandName} avec signalétique premium`,
        },
        {
          scene: `A premium business card and corporate letterhead set for "${brandName}" on a dark marble desk. The logo is embossed on the card. Gold or silver foil details. Professional studio photography with dramatic lighting.`,
          title: 'Papeterie Corporate',
          description: `Papeterie d'entreprise ${brandName} avec finitions premium`,
        }
      );
    }
    // Éducation
    else if (
      lowerDesc.includes('éducation') ||
      lowerDesc.includes('education') ||
      lowerDesc.includes('formation') ||
      lowerDesc.includes('école') ||
      lowerDesc.includes('school') ||
      lowerDesc.includes('learn') ||
      lowerIndustry.includes('education')
    ) {
      scenes.push(
        {
          scene: `A modern school or training center building with the "${brandName}" logo on the entrance. Students walking in. Bright, welcoming architecture. Photorealistic, daylight.`,
          title: 'Centre de Formation',
          description: `Centre de formation ${brandName} avec branding visible`,
        },
        {
          scene: `A tablet displaying an e-learning platform interface for "${brandName}" with the logo in the header. The screen shows course content with brand colors. Books and a notebook nearby. Professional photography.`,
          title: 'Plateforme E-learning',
          description: `Plateforme d'apprentissage ${brandName} sur tablette`,
        }
      );
    }
    // Immobilier
    else if (
      lowerDesc.includes('immobili') ||
      lowerDesc.includes('real estate') ||
      lowerDesc.includes('property') ||
      lowerDesc.includes('logement') ||
      lowerDesc.includes('maison')
    ) {
      scenes.push(
        {
          scene: `A "For Sale" sign in front of a beautiful modern house, with the "${brandName}" real estate logo prominently displayed on the sign. Professional real estate photography, blue sky, green lawn.`,
          title: 'Panneau Immobilier',
          description: `Panneau immobilier ${brandName} devant une propriété`,
        },
        {
          scene: `A modern real estate office with the "${brandName}" logo on the glass door and wall. Inside, a professional agent at a desk with property listings visible. Clean, trustworthy atmosphere. Photorealistic.`,
          title: 'Agence Immobilière',
          description: `Agence immobilière ${brandName} avec branding professionnel`,
        }
      );
    }
    // Sport / Fitness
    else if (
      lowerDesc.includes('sport') ||
      lowerDesc.includes('fitness') ||
      lowerDesc.includes('gym') ||
      lowerDesc.includes('entraîn') ||
      lowerDesc.includes('train') ||
      lowerIndustry.includes('sport')
    ) {
      scenes.push(
        {
          scene: `A modern gym/fitness center entrance with the "${brandName}" logo as a large illuminated sign above the door. Energetic atmosphere, glass facade showing equipment inside. Evening lighting. Photorealistic.`,
          title: 'Centre Fitness',
          description: `Centre fitness ${brandName} avec enseigne lumineuse`,
        },
        {
          scene: `Branded sportswear (t-shirt and water bottle) with the "${brandName}" logo, placed on a gym bench. The t-shirt is high-quality athletic wear in brand colors. Professional product photography.`,
          title: 'Équipement Sportif',
          description: `Équipement sportif brandé ${brandName}`,
        }
      );
    }
    // Voyage / Tourisme
    else if (
      lowerDesc.includes('voyage') ||
      lowerDesc.includes('travel') ||
      lowerDesc.includes('tourism') ||
      lowerDesc.includes('hôtel') ||
      lowerDesc.includes('hotel') ||
      lowerIndustry.includes('travel')
    ) {
      scenes.push(
        {
          scene: `A luxury hotel entrance with the "${brandName}" logo on an elegant sign. Beautiful architecture, doorman, elegant entrance. Golden hour lighting. Photorealistic.`,
          title: 'Entrée Hôtel',
          description: `Entrée de l'hôtel ${brandName} avec signalétique élégante`,
        },
        {
          scene: `A branded travel luggage tag and passport holder with the "${brandName}" logo, placed on a world map with a camera and sunglasses. Travel lifestyle photography, warm tones.`,
          title: 'Accessoires Voyage',
          description: `Accessoires de voyage brandés ${brandName}`,
        }
      );
    }
    // Beauté / Cosmétique
    else if (
      lowerDesc.includes('beauté') ||
      lowerDesc.includes('beauty') ||
      lowerDesc.includes('cosmét') ||
      lowerDesc.includes('cosmet') ||
      lowerDesc.includes('skin') ||
      lowerDesc.includes('salon')
    ) {
      scenes.push(
        {
          scene: `Luxury cosmetic product packaging (cream jar and box) with the "${brandName}" logo elegantly printed. Minimalist design with brand colors. Marble surface, soft lighting, flower petals. Professional beauty product photography.`,
          title: 'Packaging Cosmétique',
          description: `Packaging cosmétique luxueux ${brandName}`,
        },
        {
          scene: `A modern beauty salon interior with the "${brandName}" logo on the wall in elegant lettering. Mirrors, styling chairs, soft ambient lighting. Clean and luxurious atmosphere. Photorealistic.`,
          title: 'Salon de Beauté',
          description: `Intérieur du salon ${brandName} avec branding élégant`,
        }
      );
    }
    // Construction / BTP
    else if (
      lowerDesc.includes('construct') ||
      lowerDesc.includes('bâtiment') ||
      lowerDesc.includes('building') ||
      lowerDesc.includes('btp') ||
      lowerDesc.includes('architect')
    ) {
      scenes.push(
        {
          scene: `A construction site with a large banner displaying the "${brandName}" logo on the scaffolding. Workers with branded hard hats. Professional construction photography, blue sky.`,
          title: 'Chantier de Construction',
          description: `Chantier ${brandName} avec branding visible sur site`,
        },
        {
          scene: `A branded hard hat and safety vest with the "${brandName}" logo, placed on architectural blueprints on a desk. Professional photography with construction tools nearby.`,
          title: 'Équipement de Chantier',
          description: `Équipement de sécurité brandé ${brandName}`,
        }
      );
    }

    // Fallback: scènes génériques mais professionnelles
    if (scenes.length === 0) {
      scenes.push(
        {
          scene: `A modern office building lobby with the "${brandName}" logo displayed as a large, elegant backlit sign on the main wall. Premium materials, professional corporate atmosphere. Photorealistic photography with soft lighting.`,
          title: 'Signalétique Corporate',
          description: `Signalétique ${brandName} dans un environnement corporate premium`,
        },
        {
          scene: `A premium business card and branded stationery set (envelope, letterhead, pen) for "${brandName}" arranged on a dark wooden desk. The logo is prominently displayed on each item. Professional studio photography with dramatic lighting.`,
          title: 'Papeterie de Marque',
          description: `Set de papeterie professionnelle ${brandName}`,
        }
      );
    }

    return scenes;
  }

  /**
   * Génère les mockups pour un projet (seulement 2 mockups)
   */
  async generateProjectMockups(
    logoUrl: string,
    logoSvgContent: string | null,
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
        hasLogoSvg: !!logoSvgContent,
        brandColors,
        timestamp: new Date().toISOString(),
      });

      // Télécharger le logo comme image base64 pour l'envoyer à Gemini
      let logoImageBase64: string | null = null;
      let logoMimeType = 'image/png';

      // Priorité 1: SVG content → convertir en PNG via sharp
      if (logoSvgContent && logoSvgContent.includes('<svg')) {
        const pngData = await this.svgToPngBase64(logoSvgContent);
        if (pngData) {
          logoImageBase64 = pngData.base64;
          logoMimeType = pngData.mimeType;
          logger.info('[MOCKUP] Logo SVG converted to PNG for Gemini', { projectId });
        } else {
          logger.warn('[MOCKUP] SVG to PNG conversion failed, will try URL fallback', {
            projectId,
          });
        }
      }
      // Priorité 2: Télécharger depuis l'URL
      if (!logoImageBase64 && logoUrl) {
        const downloaded = await this.downloadImageAsBase64(logoUrl);
        if (downloaded) {
          logoImageBase64 = downloaded.base64;
          logoMimeType = downloaded.mimeType;
          logger.info('Logo downloaded from URL for mockup generation', { projectId });
        }
      }

      if (!logoImageBase64) {
        logger.warn(
          'No logo image available for mockup generation, proceeding with text-only prompt',
          { projectId }
        );
      }

      // Générer des scènes contextuelles basées sur le projet
      const scenes = this.getContextualMockupScenes(industry, projectDescription, brandName);

      logger.info('Contextual mockup scenes generated', {
        industry,
        scenesCount: scenes.length,
        scene1Title: scenes[0]?.title,
        scene2Title: scenes[1]?.title,
        projectId,
      });

      // Génération des 2 mockups en parallèle
      const [mockup1, mockup2] = await Promise.all([
        this.generateMockup(
          {
            logoImageBase64,
            logoMimeType,
            brandColors,
            industry,
            brandName,
            projectDescription,
            sceneDescription: scenes[0].scene,
            mockupTitle: scenes[0].title,
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
            sceneDescription: scenes[1].scene,
            mockupTitle: scenes[1].title,
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

      return {
        mockup1: {
          ...mockup1,
          title: scenes[0].title,
          description: scenes[0].description,
        },
        mockup2: {
          ...mockup2,
          title: scenes[1].title,
          description: scenes[1].description,
        },
      };
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
        mockupTitle: request.mockupTitle,
        projectId,
        userId,
      });

      // Si l'API key n'est pas configurée, retourner un mockup placeholder
      if (!process.env.GEMINI_API_KEY) {
        logger.warn(
          `[MOCKUP][${mockupName}] Gemini API key not configured, returning placeholder`,
          {
            mockupName,
            projectId,
          }
        );
        return this.generatePlaceholderMockup(request, mockupName);
      }

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
        mockupTitle: request.mockupTitle,
        bucketUrl: uploadResult.downloadURL,
        fileName: uploadResult.fileName,
        filePath: uploadResult.filePath,
        duration: `${mockupDuration}ms`,
        projectId,
      });

      return {
        mockupUrl: uploadResult.downloadURL,
        templateId: mockupName,
        mockupType: request.industry,
        title: request.mockupTitle,
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

      // En cas d'erreur, retourner un placeholder
      logger.warn(`[MOCKUP][${mockupName}] Falling back to placeholder mockup`, {
        mockupName,
        projectId,
      });

      return this.generatePlaceholderMockup(request, mockupName);
    }
  }

  /**
   * Construit le contenu multimodal (texte + image du logo) pour Gemini
   */
  private buildMultimodalContent(request: MockupGenerationRequest): Content[] {
    const { brandName, brandColors, industry, sceneDescription, logoImageBase64, logoMimeType } =
      request;

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

${logoInstruction}

SCENE TO PHOTOGRAPH:
${sceneDescription}

PHOTOGRAPHY REQUIREMENTS:
- This must look like a REAL PHOTOGRAPH taken by a professional photographer — NOT a digital illustration or 3D render.
- Professional studio or on-location lighting with natural shadows and reflections.
- Shallow depth of field where appropriate for artistic effect.
- Rich textures: paper grain, fabric weave, metal sheen, glass reflections.
- The brand colors (${brandColors.primary}, ${brandColors.secondary}, ${brandColors.accent}) should be visible in the scene through the product/environment.
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
   * Génère un mockup placeholder en cas d'erreur ou d'API non configurée
   */
  private generatePlaceholderMockup(
    request: MockupGenerationRequest,
    mockupName: string
  ): MockupGenerationResult {
    logger.info('Generating placeholder mockup', {
      mockupName,
      brandName: request.brandName,
      industry: request.industry,
      timestamp: new Date().toISOString(),
    });

    const primaryColor = request.brandColors.primary.replace('#', '');
    const secondaryColor = request.brandColors.secondary.replace('#', '');
    const placeholderUrl = `https://via.placeholder.com/800x600/${primaryColor}/${secondaryColor}?text=${encodeURIComponent(request.brandName + ' - ' + request.mockupTitle)}`;

    logger.info('Placeholder mockup generated', {
      mockupName,
      placeholderUrl,
      timestamp: new Date().toISOString(),
    });

    return {
      mockupUrl: placeholderUrl,
      templateId: mockupName,
      mockupType: request.industry,
      title: request.mockupTitle,
      description: '',
    };
  }

  /**
   * Génère un seul mockup (méthode publique pour usage externe)
   */
  async generateSingleMockup(
    logoUrl: string,
    logoSvgContent: string | null,
    brandColors: { primary: string; secondary: string; accent: string },
    industry: string,
    brandName: string,
    projectDescription: string,
    sceneDescription: string,
    mockupTitle: string,
    userId: string,
    projectId: string,
    mockupIndex: number
  ): Promise<MockupGenerationResult | null> {
    try {
      // Préparer le logo en base64
      let logoImageBase64: string | null = null;
      let logoMimeType = 'image/png';

      if (logoSvgContent && logoSvgContent.includes('<svg')) {
        const pngData = await this.svgToPngBase64(logoSvgContent);
        if (pngData) {
          logoImageBase64 = pngData.base64;
          logoMimeType = pngData.mimeType;
        }
      }
      if (!logoImageBase64 && logoUrl) {
        const downloaded = await this.downloadImageAsBase64(logoUrl);
        if (downloaded) {
          logoImageBase64 = downloaded.base64;
          logoMimeType = downloaded.mimeType;
        }
      }

      const request: MockupGenerationRequest = {
        logoImageBase64,
        logoMimeType,
        brandColors,
        industry,
        brandName,
        projectDescription,
        sceneDescription,
        mockupTitle,
      };

      return await this.generateMockup(request, userId, projectId, `mockup-${mockupIndex}`);
    } catch (error) {
      logger.error('Error generating single mockup:', error);
      return null;
    }
  }
}

export const geminiMockupService = new GeminiMockupService();
