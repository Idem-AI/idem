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
import {
  analyzeImage,
  generateImage,
  isGlmConfigured,
  mediaProvider,
} from './glm-media.service';
import { getGoogleGenAIClient } from '../config/google-genai.client';

/**
 * Modèle image de Gemini pour les mises en situation.
 *
 * `flash-image` plutôt que `flash-lite-image` ici : la composition d'un logo
 * réel sur un support en perspective demande plus de soin qu'une photo de
 * produit nue, et c'est le seul endroit du produit où l'écart se voit.
 */
const GEMINI_MOCKUP_MODEL = process.env.IDEM_GEMINI_MOCKUP_MODEL || 'gemini-3.1-flash-image';
import { ArtDirectionModel } from '../models/art-direction.model';
import {
  buildImageNegativePrompt,
  buildImageStyleModifier,
} from '../utils/art-direction.util';
import { parseLlmJson } from '../utils/llm-json.util';

/**
 * Fraction de la ZONE DE MARQUAGE réellement couverte par le logo. Un logo qui
 * remplit sa zone jusqu'aux bords trahit le montage : un vrai marquage garde
 * une marge autour de lui.
 */
const LOGO_ZONE_COVERAGE = 0.72;

/**
 * Opacité de l'encre. En dessous de 1, la matière du support — grain du papier,
 * fibres du tissu, reflet du plastique — transparaît à travers le logo. C'est
 * ce détail qui sépare une impression d'un autocollant collé après coup.
 */
const LOGO_OPACITY = 0.9;

/**
 * Adoucissement optique du logo, en sigma de flou pour 2000 px de largeur de
 * PHOTO. La netteté d'une image tient à l'optique qui l'a prise, pas à la
 * taille du marquage : c'est donc la scène, et non le logo, qui donne l'échelle.
 * Sans ce micro-flou, un logo vectoriel parfaitement net flotte au-dessus d'une
 * photo qui, elle, ne l'est jamais tout à fait.
 */
const LOGO_SOFTEN_PER_2000PX = 0.8;

/**
 * Seuil de luminance (0–255) au-dessus duquel l'encre est tenue pour CLAIRE.
 * Il décide du mode de fusion, donc de la lisibilité du logo sur le support.
 */
const INK_LIGHT_THRESHOLD = 140;

/** En deçà, la zone rendue par la vision est trop petite pour être crédible. */
const MIN_ZONE_RATIO = 0.06;

/** En deçà, on ne fait pas confiance à la lecture de la vision. */
const MIN_ZONE_CONFIDENCE = 0.35;

/**
 * Zone de repli, utilisée quand la vision ne rend rien d'exploitable.
 *
 * Le prompt de scène demande une zone de marquage large et proche du centre :
 * ce repli parie sur cette consigne. Il reste moins bon qu'une lecture réelle,
 * d'où sa journalisation — mais il compose une encre, pas une vignette collée.
 */
const DEFAULT_ZONE: BrandingZone = {
  x: 0.32,
  y: 0.34,
  width: 0.36,
  height: 0.26,
  surface: 'light',
  rotation: 0,
  confidence: 0,
};

/** URLs des déclinaisons du logo, par fond de destination. */
export interface MockupLogoVariants {
  /** Logo destiné à un fond CLAIR (encre foncée). */
  light?: string;
  /** Logo destiné à un fond SOMBRE (encre claire). */
  dark?: string;
  /** Déclinaison monochrome, dernier repli. */
  monochrome?: string;
}

/** Les deux encres, déjà téléchargées et prêtes à composer. */
interface LoadedLogoSet {
  /** À poser sur une surface claire. */
  light: Buffer;
  /** À poser sur une surface sombre. */
  dark: Buffer;
}

/**
 * Zone de marquage repérée sur la scène, en coordonnées normalisées (0–1).
 * C'est le contrat de sortie de la passe de vision.
 */
interface BrandingZone {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Ton de la surface : décide de l'encre et du mode de fusion. */
  surface: 'light' | 'dark';
  /** Inclinaison apparente de la surface, en degrés, sens horaire. */
  rotation: number;
  confidence: number;
}

export interface MockupGenerationRequest {
  logos: LoadedLogoSet;
  brandColors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  brandName: string;
  projectDescription: string;
  selectedSupport: SelectedMockupSupport;
  pdfFormat?: string;
  /**
   * Direction artistique de la marque. Elle pilote la LUMIÈRE, la matière et
   * l'étalonnage de la photo — pas le sujet, imposé par le support. Sans elle,
   * les mises en situation sortaient dans le rendu « photo de stock » par
   * défaut du modèle, sans lien avec le reste de la charte.
   */
  artDirection?: ArtDirectionModel | null;
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
    pdfFormat?: string,
    artDirection?: ArtDirectionModel | null,
    logoVariants?: MockupLogoVariants
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

      // Étape 2: Charger les DEUX encres (fond clair / fond sombre). Le choix
      // se fait ensuite scène par scène, selon le ton de la surface repérée :
      // une encre foncée sur un support sombre serait illisible.
      const logos = await this.loadLogoSet(logoUrl, logoVariants);

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
            logos,
            brandColors,
            brandName,
            projectDescription,
            selectedSupport,
            pdfFormat,
            artDirection,
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
   * Génère un mockup individuel : une scène nue, puis le vrai logo imprimé
   * dessus.
   *
   * Toute erreur remonte. Un mockup dégradé — scène sans logo, logo posé au
   * jugé — n'a pas sa place dans une charte : mieux vaut une page en moins
   * qu'une page qui décrédibilise le document.
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
        mockupIndex: request.selectedSupport.mockupIndex,
        priority: request.selectedSupport.priority,
        projectId,
        userId,
      });

      if (!isGlmConfigured()) {
        logger.error(`[MOCKUP][${mockupName}] GLM_API_KEY absente - cannot generate mockup images`, {
          mockupName,
          projectId,
        });
        throw new Error('GLM_API_KEY is not configured. Cannot generate mockup images.');
      }

      // ── DEUX CHEMINS, selon ce que le fournisseur d'image sait faire ──────
      //
      // GEMINI accepte une IMAGE EN ENTRÉE. On lui donne donc le logo réel avec
      // la consigne, et il compose la mise en situation en une seule passe. Ce
      // chemin est celui qui existait avant la migration vers Z.ai ; il est
      // rétabli ici parce qu'il est à la fois meilleur et plus rapide :
      // UN appel au lieu de trois (scène, vision, incrustation), et un logo posé
      // par le modèle qui voit la scène qu'il vient de produire.
      //
      // Z.ai ne prend pas d'image en entrée. Lui décrire le logo l'aurait fait
      // en dessiner un approchant — inacceptable sur un livrable de marque. D'où
      // la scène vide, la lecture de la surface imprimable, puis l'incrustation
      // du vrai logo au pixel près.
      if (mediaProvider() === 'gemini') {
        return this.generateWithGemini(request, mockupName, projectId, userId);
      }

      const scenePrompt = this.buildScenePrompt(request);

      logger.info(
        `[MOCKUP][${mockupName}] Generating blank scene with ${AI_CONFIG.branding.brandMockup.imageModel}`,
        { mockupName, mockupIndex: request.selectedSupport.mockupIndex, projectId }
      );

      const scene = await generateImage(scenePrompt, {
        model: AI_CONFIG.branding.brandMockup.imageModel,
        fallbackModel: AI_CONFIG.fallback.imageModel,
        tag: mockupName,
      });

      // Où poser le logo ? La question ne se tranche pas depuis le prompt : la
      // scène est produite librement, et seule sa lecture dit où se trouve la
      // surface imprimable. Sans cette passe, l'incrustation retombait au
      // centre géométrique de l'image, souvent à côté du support.
      const zone = await this.locateBrandingZone(scene.buffer, mockupName);

      const imageBuffer = await this.printLogo(scene.buffer, request.logos, zone, mockupName);

      console.log(
        `[MOCKUP] ✅ Mockup composed for ${request.selectedSupport.mockupIndex} (${Math.round(imageBuffer.length / 1024)}KB) — now uploading to Firebase Storage bucket...`
      );

      // `printLogo` rend toujours du PNG : la transparence du logo doit survivre
      // à la composition, et le JPEG l'aurait aplatie.
      const imageMimeType = 'image/png';
      const fileName = `${mockupName}-${Date.now()}.png`;
      const folderPath = `projects/${projectId}/Mockups`;

      logger.info(`[MOCKUP][${mockupName}] Uploading mockup image to Firebase Storage...`, {
        mockupName,
        fileName,
        folderPath,
        imageSizeKB: `${Math.round(imageBuffer.length / 1024)}KB`,
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

      // Ne PAS retourner de placeholder - propager l'erreur pour que le service
      // appelant sache que la génération a échoué et n'affiche aucune page.
      console.error(
        `[MOCKUP] ❌ Mockup ${request.selectedSupport.mockupIndex} generation FAILED: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Décrit la scène du mockup : le support NU, avec sa zone de marquage libre.
   *
   * On reprend le prompt dynamique — il connaît le support, la marque et les
   * couleurs. C'est lui qui porte désormais la règle du support vierge : la
   * consigne était auparavant ajoutée ici, en contradiction avec le bloc
   * « écris le nom de la marque » que le prompt envoyait juste au-dessus.
   */
  /**
   * Mise en situation par GEMINI — génération multimodale, en une passe.
   *
   * Le logo réel part EN ENTRÉE, à côté de la consigne. Le modèle compose donc
   * la scène en sachant ce qu'il doit y imprimer, au lieu de produire une scène
   * vide qu'il faut ensuite lire puis retoucher.
   *
   * C'est la logique qui existait avant la migration vers Z.ai, rétablie parce
   * qu'elle est meilleure ET plus rapide : UN appel au lieu de trois (scène,
   * lecture de la zone, incrustation), soit environ quatre secondes contre une
   * quinzaine — et un logo posé par celui qui voit la scène.
   *
   * ⚠️ `responseModalities` doit contenir `IMAGE`. Sans cette ligne le modèle
   * répond en TEXTE : il DÉCRIT la mise en situation au lieu de la produire, et
   * l'appel réussit en ne rendant rien d'utilisable.
   */
  private async generateWithGemini(
    request: MockupGenerationRequest,
    mockupName: string,
    projectId: string,
    userId: string
  ): Promise<MockupGenerationResult> {
    const startedAt = Date.now();

    // Sur une mise en situation, le support est le plus souvent clair : c'est la
    // déclinaison sombre du logo qui contraste. Le modèle recevant la scène ET
    // le logo, il adapte le placement ; la déclinaison, elle, reste notre choix.
    const logo = request.logos.dark ?? request.logos.light;

    const prompt = this.buildScenePrompt(request);

    logger.info(`[MOCKUP][${mockupName}] Génération multimodale Gemini`, {
      mockupName,
      model: GEMINI_MOCKUP_MODEL,
      logoBytes: logo?.length ?? 0,
      projectId,
    });

    const response: any = await getGoogleGenAIClient().models.generateContent({
      model: GEMINI_MOCKUP_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            // L'image d'abord : le modèle la lit comme la référence à respecter.
            ...(logo
              ? [{ inlineData: { mimeType: 'image/png', data: logo.toString('base64') } }]
              : []),
            {
              text:
                `${prompt}\n\n` +
                (logo
                  ? 'THE ATTACHED IMAGE IS THE BRAND LOGO. Reproduce it EXACTLY as supplied — ' +
                    'same shapes, same colours, same proportions. Do not redraw it, do not ' +
                    'restyle it, do not add or remove any element of it. Place it on the ' +
                    'printable surface of the support, at a realistic size, following the ' +
                    'perspective and the lighting of the scene.'
                  : 'No logo is supplied: produce the support BARE, with no mark on it.'),
            },
          ],
        },
      ],
      config: { responseModalities: ['TEXT', 'IMAGE'], candidateCount: 1 },
    });

    const parts = response?.candidates?.[0]?.content?.parts ?? [];
    const inline = parts.find((part: any) => part?.inlineData?.data)?.inlineData;

    if (!inline?.data) {
      throw new Error(
        `${GEMINI_MOCKUP_MODEL} n'a renvoyé aucune image pour ${mockupName} ` +
          `(${parts.length} partie(s), texte seul)`
      );
    }

    const imageBuffer = Buffer.from(inline.data, 'base64');
    const mimeType = inline.mimeType ?? 'image/png';
    const extension = mimeType.includes('jpeg') ? 'jpg' : 'png';

    logger.info(
      `[MOCKUP][${mockupName}] Image composée en ${Date.now() - startedAt} ms ` +
        `(${Math.round(imageBuffer.length / 1024)} ko)`
    );

    const uploadResult = await this.storageService.uploadFile(
      imageBuffer,
      `${mockupName}-${Date.now()}.${extension}`,
      `projects/${projectId}/Mockups`,
      mimeType
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
  }

  private buildScenePrompt(request: MockupGenerationRequest): string {
    const { brandName, brandColors, projectDescription, selectedSupport } = request;

    return MOCKUP_GENERATION_PROMPT.buildDynamicPrompt({
      brandName,
      brandColors,
      projectDescription,
      selectedSupport,
      pdfFormat: request.pdfFormat,
      artDirectionModifier: buildImageStyleModifier(request.artDirection),
      artDirectionNegative: buildImageNegativePrompt(request.artDirection),
      artDirectionName: request.artDirection?.styleName,
    });
  }

  /**
   * Lit la scène et rend la zone où le logo doit être imprimé.
   *
   * Une seule requête de vision par mockup, sur le petit modèle : c'est le prix
   * à payer pour ne plus poser le logo à l'aveugle. Toute réponse douteuse
   * (zone hors cadre, minuscule, peu sûre) est refusée au profit du repli — un
   * mauvais emplacement se voit immédiatement sur le livrable.
   */
  private async locateBrandingZone(scene: Buffer, mockupName: string): Promise<BrandingZone> {
    const config = AI_CONFIG.branding.brandMockup;

    try {
      const raw = await analyzeImage(
        scene.toString('base64'),
        'image/png',
        MOCKUP_GENERATION_PROMPT.brandingZoneVision,
        {
          model: config.visionModel,
          fallbackModel: config.visionFallbackModel,
          maxOutputTokens: config.visionMaxOutputTokens,
          temperature: 0,
        }
      );

      const zone = this.parseBrandingZone(raw);
      if (zone) {
        logger.info(`[MOCKUP][${mockupName}] Branding zone located`, {
          mockupName,
          zone,
        });
        return zone;
      }

      logger.warn(
        `[MOCKUP][${mockupName}] Vision returned no usable branding zone — falling back to the centre area`,
        { preview: raw.slice(0, 200) }
      );
    } catch (error: any) {
      logger.warn(
        `[MOCKUP][${mockupName}] Branding zone detection failed (${error?.message}) — falling back to the centre area`
      );
    }

    return DEFAULT_ZONE;
  }

  /** Valide le JSON de la vision. Rend `null` dès qu'une valeur est inexploitable. */
  private parseBrandingZone(raw: string): BrandingZone | null {
    const parsed = parseLlmJson<Record<string, unknown>>(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    const num = (value: unknown): number | null =>
      typeof value === 'number' && Number.isFinite(value) ? value : null;

    const x = num(parsed.x);
    const y = num(parsed.y);
    const width = num(parsed.width);
    const height = num(parsed.height);
    const confidence = num(parsed.confidence) ?? 0;

    if (x === null || y === null || width === null || height === null) return null;
    if (confidence < MIN_ZONE_CONFIDENCE) return null;
    if (width < MIN_ZONE_RATIO || height < MIN_ZONE_RATIO) return null;
    if (x < 0 || y < 0 || x >= 1 || y >= 1) return null;

    // Une zone qui déborde du cadre est le symptôme d'une lecture approximative,
    // mais un débordement de quelques pour cent reste récupérable : on la borne.
    const clampedWidth = Math.min(width, 1 - x);
    const clampedHeight = Math.min(height, 1 - y);
    if (clampedWidth < MIN_ZONE_RATIO || clampedHeight < MIN_ZONE_RATIO) return null;

    const rotation = num(parsed.rotation) ?? 0;

    return {
      x,
      y,
      width: clampedWidth,
      height: clampedHeight,
      surface: parsed.surface === 'dark' ? 'dark' : 'light',
      // Au-delà, la surface est trop inclinée pour qu'une simple rotation la
      // suive : on préfère un logo droit à un logo penché dans le mauvais sens.
      rotation: Math.max(-45, Math.min(45, rotation)),
      confidence,
    };
  }

  /**
   * Imprime le logo dans la zone repérée.
   *
   * Quatre gestes, qui font toute la différence entre une impression et une
   * vignette collée :
   *  1. l'encre est choisie selon le ton de la surface (foncée sur clair, claire
   *     sur sombre) — sinon le logo disparaît ou bave ;
   *  2. le logo est détouré de ses marges transparentes puis mis à l'échelle de
   *     la ZONE, pas de l'image : il tient sur le support, pas au milieu du cadre ;
   *  3. il suit l'inclinaison apparente de la surface ;
   *  4. il est fusionné en `multiply` (encre sombre) ou `screen` (encre claire),
   *     de sorte que les plis, la trame et les ombres du support MODULENT le
   *     logo. C'est cette modulation que l'œil lit comme « imprimé ».
   */
  private async printLogo(
    scene: Buffer,
    logos: LoadedLogoSet,
    zone: BrandingZone,
    mockupName: string
  ): Promise<Buffer> {
    const { width, height } = await sharp(scene).metadata();
    if (!width || !height) {
      throw new Error('Generated scene has no readable dimensions');
    }

    const source = zone.surface === 'dark' ? logos.dark : logos.light;

    // 1. Détourage : un PNG de logo porte souvent une large marge transparente.
    // Sans ce détourage, la mise à l'échelle dimensionne le VIDE, et la marque
    // sort deux fois trop petite dans sa zone.
    let mark = await this.trimTransparentMargins(source);

    // 2. Mise à l'échelle dans la zone.
    const boxWidth = Math.max(1, Math.round(width * zone.width * LOGO_ZONE_COVERAGE));
    const boxHeight = Math.max(1, Math.round(height * zone.height * LOGO_ZONE_COVERAGE));
    mark = await sharp(mark)
      .resize({
        width: boxWidth,
        height: boxHeight,
        fit: 'inside',
        kernel: 'lanczos3',
        withoutEnlargement: false,
      })
      .png()
      .toBuffer();

    // 3. Inclinaison de la surface.
    if (Math.abs(zone.rotation) >= 1) {
      mark = await sharp(mark)
        .rotate(zone.rotation, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
    }

    // Clarté de l'encre, mesurée AVANT que l'opacité ne la délave : c'est elle,
    // croisée avec le ton de la surface, qui décide du mode de fusion.
    const inkLuminance = await this.measureInkLuminance(mark);

    mark = await this.applyOpacity(mark, LOGO_OPACITY);

    // Micro-flou, à l'échelle de la PHOTO : c'est son optique qui décide de la
    // netteté du marquage. En deçà de 0.3, sharp refuse le flou — et à cette
    // taille il ne se verrait de toute façon pas.
    const sigma = (width / 2000) * LOGO_SOFTEN_PER_2000PX;
    if (sigma >= 0.3) {
      mark = await sharp(mark).blur(sigma).png().toBuffer();
    }

    const markMeta = await sharp(mark).metadata();
    const markWidth = markMeta.width ?? boxWidth;
    const markHeight = markMeta.height ?? boxHeight;

    const centerX = (zone.x + zone.width / 2) * width;
    const centerY = (zone.y + zone.height / 2) * height;
    const left = Math.max(0, Math.min(width - markWidth, Math.round(centerX - markWidth / 2)));
    const top = Math.max(0, Math.min(height - markHeight, Math.round(centerY - markHeight / 2)));

    // 4. Fusion. `multiply` fait mordre une encre SOMBRE dans une surface
    // CLAIRE, `screen` une encre CLAIRE dans une surface SOMBRE : dans les deux
    // cas les plis, la trame et les ombres du support modulent le logo, et
    // c'est cette modulation que l'œil lit comme « imprimé ».
    //
    // Hors de ces deux accords, la fusion détruirait la marque — une encre
    // sombre passée en `screen` sur un support sombre disparaît. La marque n'a
    // alors pas la déclinaison qu'il aurait fallu : on la pose simplement, ce
    // qui reste lisible, et on le signale.
    const inkIsLight = inkLuminance !== null && inkLuminance > INK_LIGHT_THRESHOLD;
    const inkMatchesSurface = zone.surface === 'dark' ? inkIsLight : !inkIsLight;
    const blend: 'multiply' | 'screen' | 'over' =
      !markMeta.hasAlpha || !inkMatchesSurface
        ? 'over'
        : zone.surface === 'dark'
          ? 'screen'
          : 'multiply';

    if (!inkMatchesSurface) {
      logger.warn(
        `[MOCKUP][${mockupName}] No logo variation contrasts with a ${zone.surface} surface — the mark is laid flat instead of printed`,
        { inkLuminance }
      );
    }

    logger.info(`[MOCKUP][${mockupName}] Printing logo on the located zone`, {
      mockupName,
      scene: `${width}x${height}`,
      mark: `${markWidth}x${markHeight}`,
      position: { left, top },
      surface: zone.surface,
      rotation: zone.rotation,
      inkLuminance,
      blend,
    });

    return await sharp(scene)
      .composite([{ input: mark, left, top, blend }])
      .png()
      .toBuffer();
  }

  /**
   * Luminance moyenne de l'encre, sur les seuls pixels OPAQUES.
   *
   * Une moyenne prise sur toute l'image compterait les pixels transparents,
   * noirs dans le tampon brut : n'importe quel logo passerait alors pour sombre,
   * et un logo blanc serait fusionné comme une encre noire.
   */
  private async measureInkLuminance(mark: Buffer): Promise<number | null> {
    try {
      const { data, info } = await sharp(mark)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      let sum = 0;
      let weight = 0;
      for (let i = 0; i + 3 < data.length; i += info.channels) {
        const alpha = data[i + 3] / 255;
        if (alpha < 0.5) continue;
        sum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) * alpha;
        weight += alpha;
      }

      return weight > 0 ? sum / weight : null;
    } catch (error: any) {
      logger.warn(`[MOCKUP] Ink luminance unreadable: ${error?.message}`);
      return null;
    }
  }

  /** Retire les marges transparentes autour du logo. */
  private async trimTransparentMargins(logo: Buffer): Promise<Buffer> {
    try {
      return await sharp(logo)
        .ensureAlpha()
        .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 0 })
        .png()
        .toBuffer();
    } catch (error: any) {
      // `trim` échoue sur une image uniforme (logo sans marge, ou entièrement
      // transparent) : l'original fait alors parfaitement l'affaire.
      logger.debug(`[MOCKUP] Logo trim skipped: ${error?.message}`);
      return logo;
    }
  }

  /**
   * Applique une opacité uniforme au logo.
   *
   * `composite` de sharp n'expose pas d'opacité : on multiplie la couche alpha
   * par un pixel gris répété en `dest-in`, qui est la façon canonique de le
   * faire avec libvips.
   */
  private async applyOpacity(image: Buffer, opacity: number): Promise<Buffer> {
    if (opacity >= 1) return image;

    return await sharp(image)
      .ensureAlpha()
      .composite([
        {
          input: Buffer.from([255, 255, 255, Math.round(255 * opacity)]),
          raw: { width: 1, height: 1, channels: 4 },
          tile: true,
          blend: 'dest-in',
        },
      ])
      .png()
      .toBuffer();
  }

  /**
   * Charge les deux encres du logo.
   *
   * Le logo principal sert de repli aux deux : une marque sans déclinaison
   * reste imprimable, elle est simplement moins bien contrastée sur les fonds
   * qui ne lui vont pas. En revanche, un logo principal illisible est une
   * erreur fatale — sans encre, il n'y a pas de mockup.
   */
  private async loadLogoSet(
    primaryUrl: string,
    variants?: MockupLogoVariants
  ): Promise<LoadedLogoSet> {
    const primary = await this.urlToBuffer(primaryUrl);

    const optional = async (url?: string): Promise<Buffer> => {
      if (!url || url === primaryUrl) return primary;
      try {
        return await this.urlToBuffer(url);
      } catch (error: any) {
        logger.warn(`[MOCKUP] Logo variation unavailable (${error?.message}) — using the primary`);
        return primary;
      }
    };

    return {
      light: await optional(variants?.light),
      dark: await optional(variants?.dark ?? variants?.monochrome),
    };
  }

  /** Rend les octets PNG d'un logo, quelle que soit la forme de sa source. */
  private async urlToBuffer(url: string): Promise<Buffer> {
    const { base64 } = await this.urlToBase64(url);
    return Buffer.from(base64, 'base64');
  }

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
