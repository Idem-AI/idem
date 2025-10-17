import puppeteer, { Browser, Page } from "puppeteer";
import * as fs from "fs-extra";
import * as path from "path";
import * as os from "os";
import logger from "../config/logger";
import { writePsd, Layer, LayerAdditionalInfo, Psd } from "ag-psd";

// Polyfill pour ImageData dans Node.js
class ImageDataPolyfill {
  data: Uint8ClampedArray;
  width: number;
  height: number;

  constructor(data: Uint8ClampedArray, width: number, height: number) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
}

// Polyfill pour Canvas dans Node.js
class CanvasPolyfill {
  width: number;
  height: number;
  private imageData: ImageDataPolyfill;

  constructor(width: number, height: number, imageData: ImageDataPolyfill) {
    this.width = width;
    this.height = height;
    this.imageData = imageData;
  }

  getContext(type: string) {
    if (type === '2d') {
      return {
        getImageData: (x: number, y: number, width: number, height: number) => {
          return this.imageData;
        }
      };
    }
    return null;
  }
}

export interface SvgToPsdOptions {
  width?: number;
  height?: number;
  backgroundColor?: string;
  quality?: number;
}

export interface SvgLayer {
  name: string;
  element: string;
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export class SvgToPsdService {
  private static browserInstance: Browser | null = null;
  private static pagePool: Page[] = [];
  private static readonly MAX_CONCURRENT_PAGES = 12; // Pool de pages pour traitement parallèle

  /**
   * Initialise le browser Puppeteer optimisé pour les conversions parallèles
   */
  private static async getBrowser(): Promise<Browser> {
    if (!this.browserInstance || !this.browserInstance.isConnected()) {
      logger.info("Initializing optimized Puppeteer browser for parallel SVG to PSD conversion");
      this.browserInstance = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--no-first-run",
          "--disable-default-apps",
          "--disable-features=TranslateUI",
          "--disable-web-security",
          "--disable-features=VizDisplayCompositor",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-renderer-backgrounding",
          "--disable-features=ScriptStreaming",
          "--disable-ipc-flooding-protection",
          "--max_old_space_size=4096", // Augmenter la mémoire disponible
        ],
        timeout: 15000, // Timeout réduit pour démarrage plus rapide
        pipe: true, // Utiliser pipe au lieu de websocket pour de meilleures performances
      });
      
      // Pré-créer un pool de pages pour éviter la création/destruction répétée
      await this.initializePagePool();
    }
    return this.browserInstance;
  }

  /**
   * Initialise un pool de pages pour les conversions parallèles
   */
  private static async initializePagePool(): Promise<void> {
    if (!this.browserInstance) return;
    
    logger.info(`Initializing page pool with ${this.MAX_CONCURRENT_PAGES} pages`);
    
    const pagePromises = Array(this.MAX_CONCURRENT_PAGES).fill(null).map(async () => {
      const page = await this.browserInstance!.newPage();
      
      // Optimisations de performance par page
      await page.setDefaultTimeout(5000); // Timeout réduit
      await page.setDefaultNavigationTimeout(5000);
      
      // Désactiver les ressources inutiles
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (['stylesheet', 'font', 'image', 'media'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });
      
      return page;
    });
    
    this.pagePool = await Promise.all(pagePromises);
    logger.info(`Page pool initialized with ${this.pagePool.length} pages`);
  }

  /**
   * Obtient une page du pool ou en crée une nouvelle si nécessaire
   */
  private static async getPageFromPool(): Promise<Page> {
    if (this.pagePool.length > 0) {
      const page = this.pagePool.pop()!;
      return page;
    }
    
    // Si le pool est vide, créer une nouvelle page temporaire
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    
    // Appliquer les mêmes optimisations
    await page.setDefaultTimeout(5000);
    await page.setDefaultNavigationTimeout(5000);
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['stylesheet', 'font', 'image', 'media'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });
    
    return page;
  }

  /**
   * Remet une page dans le pool après utilisation
   */
  private static async returnPageToPool(page: Page): Promise<void> {
    try {
      // Nettoyer la page avant de la remettre dans le pool
      await page.goto('about:blank');
      
      if (this.pagePool.length < this.MAX_CONCURRENT_PAGES) {
        this.pagePool.push(page);
      } else {
        // Si le pool est plein, fermer la page
        await page.close();
      }
    } catch (error) {
      // En cas d'erreur, fermer la page
      try {
        await page.close();
      } catch (closeError) {
        // Ignorer les erreurs de fermeture
      }
    }
  }

  /**
   * Ferme le browser et nettoie le pool de pages
   */
  static async closeBrowser(): Promise<void> {
    // Fermer toutes les pages du pool
    if (this.pagePool.length > 0) {
      logger.info(`Closing ${this.pagePool.length} pages from pool`);
      await Promise.all(
        this.pagePool.map(page => page.close().catch(() => {}))
      );
      this.pagePool = [];
    }

    // Fermer le browser
    if (this.browserInstance) {
      await this.browserInstance.close();
      this.browserInstance = null;
      logger.info("SVG to PSD browser instance closed");
    }
  }

  /**
   * Parse un SVG et extrait tous les éléments individuels
   */
  private static parseSvgElements(svgContent: string): SvgLayer[] {
    logger.info("Parsing SVG elements for layer separation");
    
    const layers: SvgLayer[] = [];
    
    // Extraire les dimensions du SVG principal
    const svgMatch = svgContent.match(/<svg[^>]*>/);
    const svgTag = svgMatch ? svgMatch[0] : '';
    
    // Extraire viewBox ou width/height
    const viewBoxMatch = svgTag.match(/viewBox=["']([^"']+)["']/);
    const widthMatch = svgTag.match(/width=["']([^"']+)["']/);
    const heightMatch = svgTag.match(/height=["']([^"']+)["']/);
    
    let svgWidth = 300, svgHeight = 300; // valeurs par défaut
    
    if (viewBoxMatch) {
      const viewBox = viewBoxMatch[1].split(/\s+/);
      svgWidth = parseFloat(viewBox[2]) || 300;
      svgHeight = parseFloat(viewBox[3]) || 300;
    } else {
      if (widthMatch) svgWidth = parseFloat(widthMatch[1]) || 300;
      if (heightMatch) svgHeight = parseFloat(heightMatch[1]) || 300;
    }

    // D'abord, essayer d'extraire les éléments individuels à l'intérieur des groupes
    let elementsFound = false;
    
    // Chercher les groupes et extraire leurs contenus
    const groupMatches = svgContent.match(/<g[^>]*>[\s\S]*?<\/g>/gi);
    if (groupMatches) {
      groupMatches.forEach((group, groupIndex) => {
        // Extraire les éléments individuels du groupe
        const pathMatches = group.match(/<path[^>]*\/?>(?:<\/path>)?/gi);
        if (pathMatches) {
          pathMatches.forEach((path, pathIndex) => {
            layers.push({
              name: `path_${groupIndex}_${pathIndex}`,
              element: path,
            });
            elementsFound = true;
          });
        }
        
        // Autres éléments dans le groupe
        const otherElements = [
          { pattern: /<rect[^>]*\/?>(?:<\/rect>)?/gi, type: 'rect' },
          { pattern: /<circle[^>]*\/?>(?:<\/circle>)?/gi, type: 'circle' },
          { pattern: /<ellipse[^>]*\/?>(?:<\/ellipse>)?/gi, type: 'ellipse' },
          { pattern: /<line[^>]*\/?>(?:<\/line>)?/gi, type: 'line' },
          { pattern: /<polyline[^>]*\/?>(?:<\/polyline>)?/gi, type: 'polyline' },
          { pattern: /<polygon[^>]*\/?>(?:<\/polygon>)?/gi, type: 'polygon' },
          { pattern: /<text[^>]*>[\s\S]*?<\/text>/gi, type: 'text' },
        ];
        
        otherElements.forEach(({ pattern, type }) => {
          const matches = group.match(pattern);
          if (matches) {
            matches.forEach((element, elementIndex) => {
              layers.push({
                name: `${type}_${groupIndex}_${elementIndex}`,
                element: element,
              });
              elementsFound = true;
            });
          }
        });
      });
    }

    // Si aucun élément trouvé dans les groupes, utiliser l'approche classique
    if (!elementsFound) {
      // Regex pour capturer différents types d'éléments SVG
      const elementPatterns = [
        // Groupes avec id ou class
        /<g[^>]*(?:id=["']([^"']+)["']|class=["']([^"']+)["'])[^>]*>[\s\S]*?<\/g>/gi,
        // Paths avec id ou class
        /<path[^>]*(?:id=["']([^"']+)["']|class=["']([^"']+)["'])[^>]*\/?>(?:<\/path>)?/gi,
        // Rectangles
        /<rect[^>]*(?:id=["']([^"']+)["']|class=["']([^"']+)["'])[^>]*\/?>(?:<\/rect>)?/gi,
        // Cercles
        /<circle[^>]*(?:id=["']([^"']+)["']|class=["']([^"']+)["'])[^>]*\/?>(?:<\/circle>)?/gi,
        // Ellipses
        /<ellipse[^>]*(?:id=["']([^"']+)["']|class=["']([^"']+)["'])[^>]*\/?>(?:<\/ellipse>)?/gi,
        // Lignes
        /<line[^>]*(?:id=["']([^"']+)["']|class=["']([^"']+)["'])[^>]*\/?>(?:<\/line>)?/gi,
        // Polylines
        /<polyline[^>]*(?:id=["']([^"']+)["']|class=["']([^"']+)["'])[^>]*\/?>(?:<\/polyline>)?/gi,
        // Polygones
        /<polygon[^>]*(?:id=["']([^"']+)["']|class=["']([^"']+)["'])[^>]*\/?>(?:<\/polygon>)?/gi,
        // Texte
        /<text[^>]*(?:id=["']([^"']+)["']|class=["']([^"']+)["'])[^>]*>[\s\S]*?<\/text>/gi,
      ];

      let layerIndex = 0;

      // Extraire les éléments avec identifiants
      elementPatterns.forEach((pattern, patternIndex) => {
        let match;
        while ((match = pattern.exec(svgContent)) !== null) {
          const element = match[0];
          const id = match[1] || match[2];
          const name = id || `Layer_${patternIndex}_${layerIndex++}`;
          
          layers.push({
            name: name,
            element: element,
          });
        }
      });

      // Si aucun élément identifié n'est trouvé, essayer de séparer par éléments de base
      if (layers.length === 0) {
        logger.info("No identified elements found, attempting basic element separation");
        
        const basicPatterns = [
          /<path[^>]*\/?>(?:<\/path>)?/gi,
          /<rect[^>]*\/?>(?:<\/rect>)?/gi,
          /<circle[^>]*\/?>(?:<\/circle>)?/gi,
          /<ellipse[^>]*\/?>(?:<\/ellipse>)?/gi,
          /<line[^>]*\/?>(?:<\/line>)?/gi,
          /<polyline[^>]*\/?>(?:<\/polyline>)?/gi,
          /<polygon[^>]*\/?>(?:<\/polygon>)?/gi,
          /<text[^>]*>[\s\S]*?<\/text>/gi,
        ];

        basicPatterns.forEach((pattern, patternIndex) => {
          let match;
          let elementIndex = 0;
          while ((match = pattern.exec(svgContent)) !== null) {
            const element = match[0];
            const elementType = element.match(/<(\w+)/)?.[1] || 'element';
            
            layers.push({
              name: `${elementType}_${elementIndex++}`,
              element: element,
            });
          }
        });
      }
    } // Fermeture de if (!elementsFound)

    // Si toujours aucun élément, créer un calque unique avec tout le contenu
    if (layers.length === 0) {
      logger.warn("No individual elements found, creating single layer with full SVG");
      layers.push({
        name: "full_svg",
        element: svgContent,
      });
    }

    logger.info(`Extracted ${layers.length} layers from SVG`);
    return layers;
  }

  /**
   * Convertit un élément SVG individuel en image via Puppeteer (optimisé pour parallélisme)
   */
  private static async renderSvgElementToCanvas(
    svgLayer: SvgLayer,
    originalSvg: string,
    options: SvgToPsdOptions
  ): Promise<Buffer> {
    // Obtenir une page du pool
    const page = await this.getPageFromPool();

    try {
      const width = options.width || 800;
      const height = options.height || 600;

      // Extraire les dimensions et styles du SVG original
      const svgMatch = originalSvg.match(/<svg[^>]*>/);
      const svgTag = svgMatch ? svgMatch[0] : '<svg>';
      
      // Créer un SVG temporaire avec seulement cet élément
      const isolatedSvg = `
        ${svgTag.replace(/width=["'][^"']*["']/, `width="${width}"`).replace(/height=["'][^"']*["']/, `height="${height}"`)}
          <defs>
            ${this.extractDefs(originalSvg)}
          </defs>
          ${svgLayer.element}
        </svg>
      `;

      // Créer une page HTML optimisée avec le SVG isolé
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              background: ${options.backgroundColor || 'transparent'};
              display: flex;
              justify-content: center;
              align-items: center;
              width: ${width}px;
              height: ${height}px;
              overflow: hidden;
            }
            svg { max-width: 100%; max-height: 100%; }
          </style>
        </head>
        <body>${isolatedSvg}</body>
        </html>
      `;

      // Optimisations de performance
      await page.setViewport({ width, height, deviceScaleFactor: 1 });
      await page.setContent(html, { 
        waitUntil: 'domcontentloaded', // Plus rapide que networkidle0
        timeout: 3000 
      });

      // Attendre que le SVG soit rendu (timeout réduit)
      await page.waitForSelector('svg', { timeout: 2000 });

      // Prendre une capture d'écran optimisée
      const screenshot = await page.screenshot({
        type: 'png',
        omitBackground: options.backgroundColor === 'transparent',
        clip: { x: 0, y: 0, width, height },
        optimizeForSpeed: true, // Privilégier la vitesse
      });

      logger.info(`Rendered layer "${svgLayer.name}" to canvas`);
      return screenshot as Buffer;

    } catch (error) {
      logger.error(`Error rendering SVG layer "${svgLayer.name}":`, error);
      throw error;
    } finally {
      // Remettre la page dans le pool au lieu de la fermer
      await this.returnPageToPool(page);
    }
  }

  /**
   * Extrait les définitions (defs) du SVG original pour les réutiliser
   */
  private static extractDefs(svgContent: string): string {
    const defsMatch = svgContent.match(/<defs[^>]*>([\s\S]*?)<\/defs>/i);
    return defsMatch ? defsMatch[1] : '';
  }

  /**
   * Pré-initialise le browser et le pool de pages pour les conversions parallèles
   */
  static async initializeForParallelConversion(): Promise<void> {
    logger.info("Pre-initializing browser for parallel conversions");
    await this.getBrowser(); // Cela va initialiser le browser et le pool de pages
    logger.info("Browser and page pool ready for parallel conversions");
  }

  /**
   * Convertit un SVG en fichier PSD avec des calques séparés
   */
  static async convertSvgToPsd(
    svgContent: string,
    options: SvgToPsdOptions = {}
  ): Promise<string> {
    logger.info("Starting SVG to PSD conversion");

    try {
      const width = options.width || 800;
      const height = options.height || 600;

      // Parser les éléments SVG
      const svgLayers = this.parseSvgElements(svgContent);
      
      if (svgLayers.length === 0) {
        throw new Error("No SVG elements found to convert");
      }

      // Créer les calques PSD
      const psdLayers: Layer[] = [];

      // Traiter les calques SVG en parallèle avec limitation de concurrence
      const BATCH_SIZE = 6; // Traiter 6 calques en parallèle maximum
      logger.info(`Processing ${svgLayers.length} layers in batches of ${BATCH_SIZE}`);

      for (let i = 0; i < svgLayers.length; i += BATCH_SIZE) {
        const batch = svgLayers.slice(i, i + BATCH_SIZE);
        logger.info(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(svgLayers.length / BATCH_SIZE)} (${batch.length} layers)`);

        const batchPromises = batch.map(async (svgLayer, batchIndex) => {
          const layerIndex = i + batchIndex + 1;
          logger.info(`Processing layer ${layerIndex}/${svgLayers.length}: ${svgLayer.name}`);

          try {
            // Rendre l'élément SVG en image
            const imageBuffer = await this.renderSvgElementToCanvas(
              svgLayer,
              svgContent,
              options
            );

            // Créer le calque PSD
            const canvas = await this.bufferToCanvas(imageBuffer, width, height);
            const layer: Layer = {
              name: svgLayer.name,
              canvas: canvas as any, // Canvas polyfill compatible avec ag-psd
              opacity: 255,
              blendMode: 'normal',
            };

            return layer;

          } catch (error) {
            logger.warn(`Failed to process layer "${svgLayer.name}":`, error);
            return null; // Retourner null pour les calques échoués
          }
        });

        // Attendre que le batch se termine
        const batchResults = await Promise.all(batchPromises);
        
        // Ajouter les calques réussis
        batchResults.forEach(layer => {
          if (layer) {
            psdLayers.push(layer);
          }
        });

        logger.info(`Completed batch ${Math.floor(i / BATCH_SIZE) + 1}, ${psdLayers.length} layers processed so far`);
      }

      if (psdLayers.length === 0) {
        throw new Error("No layers could be processed successfully");
      }

      // Créer le document PSD
      const psd = {
        width,
        height,
        channels: 4, // RGBA
        bitsPerChannel: 8,
        colorMode: 3, // RGB
        children: psdLayers.reverse(), // Inverser pour avoir le bon ordre des calques
      };

      // Générer le fichier PSD
      const psdArrayBuffer = writePsd(psd);
      
      // Convertir ArrayBuffer en Buffer pour fs.writeFile
      const psdBuffer = Buffer.from(psdArrayBuffer);

      // Sauvegarder dans un fichier temporaire
      const tempDir = os.tmpdir();
      const psdFileName = `svg-to-psd-${Date.now()}-${Math.random()
        .toString(36)
        .substring(7)}.psd`;
      const psdPath = path.join(tempDir, psdFileName);

      await fs.writeFile(psdPath, psdBuffer);

      logger.info(
        `Successfully converted SVG to PSD with ${psdLayers.length} layers: ${psdPath}`
      );

      return psdPath;

    } catch (error) {
      logger.error("Error converting SVG to PSD:", error);
      throw error;
    }
  }

  /**
   * Convertit un buffer d'image en canvas polyfill pour ag-psd
   */
  private static async bufferToCanvas(
    buffer: Buffer,
    width: number,
    height: number
  ): Promise<CanvasPolyfill> {
    // Utiliser sharp pour convertir le buffer PNG en données RGBA
    const sharp = require('sharp');
    
    const { data } = await sharp(buffer)
      .resize(width, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Créer ImageData polyfill
    const imageData = new ImageDataPolyfill(new Uint8ClampedArray(data), width, height);
    
    // Créer Canvas polyfill
    const canvas = new CanvasPolyfill(width, height, imageData);
    
    return canvas;
  }

  /**
   * Nettoie un fichier temporaire PSD
   */
  static async cleanupTempFile(psdPath: string): Promise<void> {
    try {
      await fs.unlink(psdPath);
      logger.info(`Cleaned up temporary PSD file: ${psdPath}`);
    } catch (error) {
      logger.warn(`Failed to cleanup temporary PSD file: ${psdPath}`, error);
    }
  }

  /**
   * Convertit une URL SVG en PSD
   */
  static async convertSvgUrlToPsd(
    svgUrl: string,
    options: SvgToPsdOptions = {}
  ): Promise<string> {
    logger.info(`Converting SVG from URL to PSD: ${svgUrl}`);

    try {
      // Télécharger le contenu SVG
      const response = await fetch(svgUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch SVG from URL: ${response.statusText}`);
      }

      const svgContent = await response.text();
      
      if (!svgContent.includes('<svg')) {
        throw new Error('URL does not contain valid SVG content');
      }

      // Convertir le SVG en PSD
      return await this.convertSvgToPsd(svgContent, options);

    } catch (error) {
      logger.error(`Error converting SVG URL to PSD: ${svgUrl}`, error);
      throw error;
    }
  }
}
