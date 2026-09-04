import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import logger from '../config/logger';
import { brandFontLinks } from '../utils/google-fonts.util';
import { SectionModel } from '../models/section.model';
import { TypographyModel } from '../models/brand-identity.model';
import { cacheService } from './cache.service';
import { sanitizeSectionHtml } from '../utils/sanitize-section-html';
import { FLOW_PAGINATION_RUNTIME, FlowPaginationReport } from './pdf/flow-pagination.runtime';
import axios from 'axios';

export interface PageFormat {
  width: string; // e.g., '210mm', '297mm'
  height: string; // e.g., '297mm', '167mm'
  orientation: 'portrait' | 'landscape';
}

export const PAGE_FORMATS = {
  A4_PORTRAIT: { width: '210mm', height: '297mm', orientation: 'portrait' as const },
  A4_LANDSCAPE: { width: '297mm', height: '210mm', orientation: 'landscape' as const },
  SLIDE_16_9: { width: '297mm', height: '167mm', orientation: 'landscape' as const },
  LETTER_PORTRAIT: { width: '8.5in', height: '11in', orientation: 'portrait' as const },
  LETTER_LANDSCAPE: { width: '11in', height: '8.5in', orientation: 'landscape' as const },
};

export interface PdfGenerationOptions {
  title?: string;
  projectName: string;
  projectDescription?: string;
  sections: SectionModel[];
  sectionDisplayOrder?: string[];
  footerText?: string;
  pageFormat?: PageFormat; // Format personnalisé (par défaut: A4_PORTRAIT)
  /**
   * true  → une section peut s'étendre sur PLUSIEURS pages (contenu flexible, ex:
   *         business plan) ; les blocs ne sont jamais coupés entre deux pages.
   * false → chaque section = EXACTEMENT une page (pitch deck, charte graphique) :
   *         le contenu est calé et rogné à la page (défaut). Le prompt garantit
   *         que le contenu tient dans la page.
   */
  multiPage?: boolean;
  /**
   * Sections dessinées comme UNE page pleine (couverture) : elles sont rendues
   * telles quelles, sans passer par le paginateur. Comparaison insensible à la
   * casse, sur le nom de section.
   */
  fixedPageSections?: string[];
  /** Réglages du paginateur de flux (multiPage uniquement). */
  pagination?: {
    /** Ne pas étirer une page remplie sous ce ratio (défaut 0.30). */
    minFillRatio?: number;
    /** Espace max (mm) ajouté à un interligne de blocs pour combler (défaut 12). */
    maxGapAddMm?: number;
    /**
     * Plafond absolu (mm) d'un interligne (défaut 26). À abaisser pour un
     * document très structuré, où un grand écart entre le chapeau et le
     * tableau se lit comme un trou et non comme de la respiration.
     */
    maxGapAddHardMm?: number;
    /** Répartir le contenu équitablement entre les pages d'une section (défaut true). */
    balance?: boolean;
  };
  format?: 'A4' | 'Letter'; // Deprecated: pour compatibilité
  margins?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  typography?: TypographyModel;
}

/** Échappe une valeur destinée à un attribut HTML entre guillemets doubles. */
function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

interface CacheEntry {
  data: string;
  timestamp: number;
  ttl: number;
}

interface PdfCacheEntry {
  filePath: string;
  timestamp: number;
  ttl: number;
}

export class PdfService {
  private static browserInstance: Browser | null = null;
  private static resourcesCache: Map<string, string> = new Map();
  private static htmlCache: Map<string, CacheEntry> = new Map();
  private static pdfCache: Map<string, PdfCacheEntry> = new Map();
  private static isInitialized = false;

  // Configuration du cache
  private static readonly HTML_CACHE_TTL = 30 * 60 * 1000; // 30 minutes
  private static readonly PDF_CACHE_TTL = 60 * 60 * 1000; // 1 heure
  private static readonly CACHE_CLEANUP_INTERVAL = 15 * 60 * 1000; // 15 minutes

  // Initialiser le browser et les ressources au démarrage de l'application
  static async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    logger.info('Initializing Puppeteer browser instance at startup');
    this.browserInstance = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--disable-default-apps',
        '--disable-features=TranslateUI',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
      ],
      timeout: 30000,
    });

    // Précharger les ressources statiques
    await this.preloadResources();

    // Démarrer le nettoyage périodique du cache
    this.startCacheCleanup();

    this.isInitialized = true;

    logger.info('Browser and resources initialized successfully at startup');
  }

  // Obtenir l'instance du browser (déjà initialisée)
  private static getBrowser(): Browser {
    if (!this.browserInstance || !this.browserInstance.isConnected()) {
      throw new Error('Browser not initialized. Call PdfService.initialize() first.');
    }
    return this.browserInstance;
  }

  // Précharger toutes les ressources statiques en cache
  private static async preloadResources(): Promise<void> {
    const resources = [
      {
        key: 'primeicons',
        path: path.join(process.cwd(), 'public', 'css', 'primeicons.css'),
      },
      {
        key: 'tailwind',
        path: path.join(process.cwd(), 'public', 'scripts', 'tailwind.js'),
      },
      {
        key: 'chartjs',
        path: path.join(process.cwd(), 'public', 'scripts', 'chart.js'),
      },
    ];

    for (const resource of resources) {
      try {
        if (await fs.pathExists(resource.path)) {
          const content = await fs.readFile(resource.path, 'utf8');
          this.resourcesCache.set(resource.key, content);
          logger.info(`Cached resource: ${resource.key}`);
        } else {
          logger.warn(`Resource not found: ${resource.path}`);
        }
      } catch (error) {
        logger.error(`Failed to cache resource ${resource.key}:`, error);
      }
    }
  }

  // Créer une page optimisée avec les ressources pré-chargées
  private static async createOptimizedPage(): Promise<Page> {
    const browser = this.getBrowser();
    const page = await browser.newPage();

    // deviceScaleFactor 2 : les <canvas> Chart.js sont dessinés en 2x, donc les
    // PNG rasterisés restent nets à l'impression (le layout reste en px CSS).
    await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 2 });

    // Injecter les ressources depuis le cache
    const primeiconsContent = this.resourcesCache.get('primeicons');
    if (primeiconsContent) {
      await page.addStyleTag({ content: primeiconsContent });
    }

    const tailwindContent = this.resourcesCache.get('tailwind');
    if (tailwindContent) {
      await page.addScriptTag({ content: tailwindContent });
    }

    const chartjsContent = this.resourcesCache.get('chartjs');
    if (chartjsContent) {
      await page.addScriptTag({ content: chartjsContent });
    }

    return page;
  }

  // Nettoyage périodique du cache
  private static startCacheCleanup(): void {
    setInterval(() => {
      this.cleanupExpiredCache();
    }, this.CACHE_CLEANUP_INTERVAL);
  }

  private static cleanupExpiredCache(): void {
    const now = Date.now();
    let htmlCleaned = 0;
    let pdfCleaned = 0;

    // Nettoyer le cache HTML
    for (const [key, entry] of this.htmlCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.htmlCache.delete(key);
        htmlCleaned++;
      }
    }

    // Nettoyer le cache PDF et supprimer les fichiers
    for (const [key, entry] of this.pdfCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        // Supprimer le fichier PDF
        fs.unlink(entry.filePath).catch((err) =>
          logger.warn(`Failed to delete cached PDF file: ${entry.filePath}`, err)
        );
        this.pdfCache.delete(key);
        pdfCleaned++;
      }
    }

    if (htmlCleaned > 0 || pdfCleaned > 0) {
      logger.info(`Cache cleanup: ${htmlCleaned} HTML entries, ${pdfCleaned} PDF entries removed`);
    }
  }

  // Générer un hash pour le cache basé sur le contenu
  private static generateCacheKey(options: PdfGenerationOptions): string {
    const cacheData = {
      title: options.title,
      projectName: options.projectName,
      projectDescription: options.projectDescription,
      sections: options.sections.map((s) => ({ name: s.name, data: s.data })),
      sectionDisplayOrder: options.sectionDisplayOrder,
      footerText: options.footerText,
      format: options.format,
      margins: options.margins,
      typography: options.typography,
      multiPage: options.multiPage,
      pageFormat: options.pageFormat,
      fixedPageSections: options.fixedPageSections,
      pagination: options.pagination,
    };

    return crypto.createHash('sha256').update(JSON.stringify(cacheData)).digest('hex');
  }

  // Récupérer HTML depuis le cache
  private static getCachedHtml(cacheKey: string): string | null {
    const entry = this.htmlCache.get(cacheKey);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.htmlCache.delete(cacheKey);
      return null;
    }

    logger.info(`🔄 HTML cache hit for key: ${cacheKey.substring(0, 8)}...`);
    return entry.data;
  }

  // Stocker HTML dans le cache
  private static setCachedHtml(cacheKey: string, html: string): void {
    this.htmlCache.set(cacheKey, {
      data: html,
      timestamp: Date.now(),
      ttl: this.HTML_CACHE_TTL,
    });
    logger.info(`HTML cached for key: ${cacheKey.substring(0, 8)}...`);
  }

  // Récupérer PDF depuis le cache
  private static getCachedPdf(cacheKey: string): string | null {
    const entry = this.pdfCache.get(cacheKey);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      // Supprimer le fichier expiré
      fs.unlink(entry.filePath).catch((err) =>
        logger.warn(`Failed to delete expired PDF: ${entry.filePath}`, err)
      );
      this.pdfCache.delete(cacheKey);
      return null;
    }

    // Vérifier que le fichier existe toujours
    if (!fs.existsSync(entry.filePath)) {
      this.pdfCache.delete(cacheKey);
      return null;
    }

    logger.info(`🚀 PDF cache hit for key: ${cacheKey.substring(0, 8)}...`);
    return entry.filePath;
  }

  // Stocker PDF dans le cache
  private static setCachedPdf(cacheKey: string, filePath: string): void {
    this.pdfCache.set(cacheKey, {
      filePath,
      timestamp: Date.now(),
      ttl: this.PDF_CACHE_TTL,
    });
    logger.info(`PDF cached for key: ${cacheKey.substring(0, 8)}...`);
  }

  // Méthodes utilitaires pour la gestion du cache
  static async getCacheStats(): Promise<{
    htmlEntries: number;
    pdfEntries: number;
    totalSize: number;
    diskUsage: number;
    oldestEntry: Date | null;
    newestEntry: Date | null;
  }> {
    let totalSize = 0;
    let diskUsage = 0;
    let oldestTimestamp: number | null = null;
    let newestTimestamp: number | null = null;

    // Calculer la taille approximative du cache HTML
    for (const [, entry] of this.htmlCache.entries()) {
      totalSize += Buffer.byteLength(entry.data, 'utf8');

      if (oldestTimestamp === null || entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
      }
      if (newestTimestamp === null || entry.timestamp > newestTimestamp) {
        newestTimestamp = entry.timestamp;
      }
    }

    // Calculer l'usage disque des fichiers PDF
    for (const [, entry] of this.pdfCache.entries()) {
      try {
        if (await fs.pathExists(entry.filePath)) {
          const stats = await fs.stat(entry.filePath);
          diskUsage += stats.size;
        }
      } catch (error) {
        logger.warn(`Failed to get stats for PDF file: ${entry.filePath}`, error);
      }

      if (oldestTimestamp === null || entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
      }
      if (newestTimestamp === null || entry.timestamp > newestTimestamp) {
        newestTimestamp = entry.timestamp;
      }
    }

    return {
      htmlEntries: this.htmlCache.size,
      pdfEntries: this.pdfCache.size,
      totalSize,
      diskUsage,
      oldestEntry: oldestTimestamp ? new Date(oldestTimestamp) : null,
      newestEntry: newestTimestamp ? new Date(newestTimestamp) : null,
    };
  }

  static async clearCache(): Promise<void> {
    // Nettoyer les fichiers PDF locaux
    for (const [, entry] of this.pdfCache.entries()) {
      fs.unlink(entry.filePath).catch((err) =>
        logger.warn(`Failed to delete PDF file during cache clear: ${entry.filePath}`, err)
      );
    }

    // Vider les caches locaux
    this.htmlCache.clear();
    this.pdfCache.clear();

    // Vider aussi les cachedPdfPath dans Redis (préfixe "pdf")
    try {
      const deletedRedisKeys = await cacheService.deletePattern('pdf:*');
      logger.info(`Cleared ${deletedRedisKeys} PDF entries from Redis cache`);
    } catch (error) {
      logger.warn('Failed to clear PDF entries from Redis cache:', error);
    }

    logger.info('All caches (local + Redis) cleared manually');
  }

  static invalidateCacheByProject(projectName: string): number {
    let invalidated = 0;

    // Invalider les entrées HTML contenant le nom du projet
    for (const [key, entry] of this.htmlCache.entries()) {
      if (entry.data.includes(projectName)) {
        this.htmlCache.delete(key);
        invalidated++;
      }
    }

    // Invalider les entrées PDF (plus complexe car on n'a que le hash)
    // On pourrait améliorer en stockant des métadonnées

    if (invalidated > 0) {
      logger.info(`Invalidated ${invalidated} cache entries for project: ${projectName}`);
    }

    return invalidated;
  }

  /**
   * Invalide le cache PDF par ID de projet
   */
  static async invalidateCacheByProjectId(projectId: string): Promise<number> {
    let invalidated = 0;

    // Invalider les entrées HTML - on ne peut pas directement lier au projectId
    // donc on nettoie tout le cache HTML par sécurité
    const htmlEntries = this.htmlCache.size;
    this.htmlCache.clear();

    // Invalider les entrées PDF locales
    const pdfEntries = this.pdfCache.size;
    for (const [key, entry] of this.pdfCache.entries()) {
      try {
        await fs.unlink(entry.filePath);
      } catch (error) {
        logger.warn(`Failed to delete PDF file: ${entry.filePath}`, error);
      }
    }
    this.pdfCache.clear();

    // Invalider aussi les entrées Redis pour ce projet
    try {
      const deletedRedisKeys = await cacheService.invalidateProjectCache(projectId);
      logger.info(`Invalidated ${deletedRedisKeys} Redis cache entries for project: ${projectId}`);
      invalidated += deletedRedisKeys;
    } catch (error) {
      logger.warn(`Failed to invalidate Redis cache for project ${projectId}:`, error);
    }

    invalidated += htmlEntries + pdfEntries;

    if (invalidated > 0) {
      logger.info(
        `Invalidated ${invalidated} total cache entries (local + Redis) for project: ${projectId}`
      );
    }

    return invalidated;
  }

  /**
   * Invalide le cache PDF par utilisateur (nécessite de vider tout le cache)
   */
  static async invalidateCacheByUserId(userId: string): Promise<number> {
    let invalidated = 0;

    // Comme on ne stocke pas l'userId dans les clés de cache local,
    // on doit vider tout le cache PDF pour être sûr
    const htmlEntries = this.htmlCache.size;
    const pdfEntries = this.pdfCache.size;

    // Nettoyer les fichiers PDF locaux
    for (const [key, entry] of this.pdfCache.entries()) {
      try {
        await fs.unlink(entry.filePath);
      } catch (error) {
        logger.warn(`Failed to delete PDF file: ${entry.filePath}`, error);
      }
    }

    this.htmlCache.clear();
    this.pdfCache.clear();

    // Invalider aussi les entrées Redis pour cet utilisateur
    try {
      const deletedRedisKeys = await cacheService.invalidateUserCache(userId);
      logger.info(`Invalidated ${deletedRedisKeys} Redis cache entries for user: ${userId}`);
      invalidated += deletedRedisKeys;
    } catch (error) {
      logger.warn(`Failed to invalidate Redis cache for user ${userId}:`, error);
    }

    invalidated += htmlEntries + pdfEntries;

    if (invalidated > 0) {
      logger.info(
        `Invalidated ${invalidated} total cache entries (local + Redis) for user: ${userId}`
      );
    }

    return invalidated;
  }

  /**
   * Vide sélectivement le cache PDF (HTML seulement, PDF seulement, ou tout)
   */
  static async clearCacheSelective(type: 'html' | 'pdf' | 'all' = 'all'): Promise<{
    htmlCleared: number;
    pdfCleared: number;
  }> {
    let htmlCleared = 0;
    let pdfCleared = 0;

    if (type === 'html' || type === 'all') {
      htmlCleared = this.htmlCache.size;
      this.htmlCache.clear();
    }

    if (type === 'pdf' || type === 'all') {
      pdfCleared = this.pdfCache.size;

      // Supprimer les fichiers PDF locaux
      for (const [key, entry] of this.pdfCache.entries()) {
        try {
          await fs.unlink(entry.filePath);
        } catch (error) {
          logger.warn(`Failed to delete PDF file during selective clear: ${entry.filePath}`, error);
        }
      }
      this.pdfCache.clear();
    }

    // Nettoyer aussi le cache Redis si on nettoie tout
    if (type === 'all') {
      try {
        const deletedRedisKeys = await cacheService.deletePattern('pdf:*');
        logger.info(`Cleared ${deletedRedisKeys} Redis PDF cache entries during selective clear`);
      } catch (error) {
        logger.warn('Failed to clear Redis PDF cache during selective clear:', error);
      }
    }

    logger.info(
      `Selective cache clear completed: ${htmlCleared} HTML, ${pdfCleared} PDF entries cleared`
    );

    return { htmlCleared, pdfCleared };
  }

  /**
   * Nettoie le cache par âge (plus vieux que X minutes)
   */
  static async clearCacheByAge(maxAgeMinutes: number): Promise<{
    htmlCleared: number;
    pdfCleared: number;
  }> {
    const now = Date.now();
    const maxAge = maxAgeMinutes * 60 * 1000;
    let htmlCleared = 0;
    let pdfCleared = 0;

    // Nettoyer le cache HTML par âge
    for (const [key, entry] of this.htmlCache.entries()) {
      if (now - entry.timestamp > maxAge) {
        this.htmlCache.delete(key);
        htmlCleared++;
      }
    }

    // Nettoyer le cache PDF par âge
    for (const [key, entry] of this.pdfCache.entries()) {
      if (now - entry.timestamp > maxAge) {
        try {
          await fs.unlink(entry.filePath);
        } catch (error) {
          logger.warn(`Failed to delete aged PDF file: ${entry.filePath}`, error);
        }
        this.pdfCache.delete(key);
        pdfCleared++;
      }
    }

    if (htmlCleared > 0 || pdfCleared > 0) {
      logger.info(
        `Age-based cache clear: ${htmlCleared} HTML, ${pdfCleared} PDF entries older than ${maxAgeMinutes} minutes cleared`
      );
    }

    return { htmlCleared, pdfCleared };
  }

  // Fermer le browser (à appeler lors de l'arrêt de l'application)
  static async closeBrowser(): Promise<void> {
    if (this.browserInstance) {
      await this.browserInstance.close();
      this.browserInstance = null;
      this.isInitialized = false;
      logger.info('Browser instance closed');
    }

    // Nettoyer tous les fichiers PDF en cache
    for (const [key, entry] of this.pdfCache.entries()) {
      try {
        await fs.unlink(entry.filePath);
      } catch (err) {
        logger.warn(`Failed to cleanup cached PDF: ${entry.filePath}`, err);
      }
    }
    this.pdfCache.clear();
    this.htmlCache.clear();
  }

  async generatePdf(options: PdfGenerationOptions): Promise<string> {
    const {
      title = 'Document',
      projectName,
      sections,
      sectionDisplayOrder = options.sectionDisplayOrder,
      footerText = 'Generated by Idem',
      pageFormat,
      multiPage = false,
      fixedPageSections,
      pagination,
      format = 'A4',
      margins = {
        top: '0mm',
        right: '0mm',
        bottom: '0mm',
        left: '0mm',
      },
    } = options;

    // Déterminer le format de page à utiliser
    // Priorité: pageFormat > format (pour compatibilité)
    let finalPageFormat: PageFormat;
    if (pageFormat) {
      finalPageFormat = pageFormat;
    } else {
      // Compatibilité avec l'ancien paramètre format
      finalPageFormat =
        format === 'Letter' ? PAGE_FORMATS.LETTER_PORTRAIT : PAGE_FORMATS.A4_PORTRAIT;
    }

    // Nettoyer les sections : préfixes de langage ("html"/"markdown"), clôtures
    // de code et bloc de sources markdown résiduel (voir sanitizeSectionHtml).
    let cleanedSections = sections.map((section) => {
      if (section.data && typeof section.data === 'string') {
        return { ...section, data: sanitizeSectionHtml(section.data) };
      }
      return section;
    });

    // Convertir les URLs d'images en data URIs pour que Puppeteer puisse les charger
    cleanedSections = await this.convertImageUrlsToDataUris(cleanedSections);

    logger.info(`sections length: ${cleanedSections.length}`);
    // Générer la clé de cache basée sur le contenu nettoyé
    const cacheKey = PdfService.generateCacheKey({
      ...options,
      sections: cleanedSections,
    });

    logger.info(
      `Generating PDF for project: ${projectName} with ${
        cleanedSections.length
      } sections (cache key: ${cacheKey.substring(0, 8)}...)`
    );

    // Vérifier le cache PDF d'abord
    const cachedPdfPath = PdfService.getCachedPdf(cacheKey);
    if (cachedPdfPath) {
      logger.info(`🚀 CACHE HIT - Returning cached PDF for project: ${projectName} (saved ~5-8s)`);
      return cachedPdfPath;
    }

    logger.info(`❌ CACHE MISS - Generating new PDF for project: ${projectName}`);

    try {
      // Trier les sections selon l'ordre spécifié
      const sortedSections = this.sortSectionsByOrder(cleanedSections, sectionDisplayOrder);

      // Vérifier le cache HTML
      let htmlContent = PdfService.getCachedHtml(cacheKey);

      if (!htmlContent) {
        logger.info(`⚡ Generating new HTML content for project: ${projectName}`);
        // Créer le contenu HTML à partir des sections (optimisé)
        htmlContent = this.generateOptimizedHtmlFromSections({
          title,
          projectName,
          sections: sortedSections,
          footerText,
          typography: options.typography,
          pageFormat: finalPageFormat,
          multiPage,
          fixedPageSections,
        });

        // Mettre en cache le HTML généré
        PdfService.setCachedHtml(cacheKey, htmlContent);
      } else {
        logger.info(
          `🔄 HTML CACHE HIT - Using cached HTML for project: ${projectName} (saved ~2-3s)`
        );
      }

      // Utiliser une page optimisée avec ressources pré-chargées
      const page = await PdfService.createOptimizedPage();

      // Définir le contenu HTML (ressources déjà injectées)
      await page.setContent(htmlContent, {
        waitUntil: 'domcontentloaded', // Plus rapide que networkidle0
        timeout: 15000, // Réduit de 60s à 15s
      });

      // Attente optimisée pour les scripts (réduite drastiquement)
      await page.waitForFunction(
        'typeof window.tailwind !== "undefined" || document.readyState === "complete"',
        { timeout: 3000 } // Réduit de 15s à 3s
      );

      // setContent réécrit le document : le runtime doit être (ré)injecté ici.
      // (C'est lui qui relance la génération des utilitaires Tailwind — voir
      // waitTailwind : `tailwind.refresh()` n'existe pas dans le build CDN.)
      await page.addScriptTag({ content: FLOW_PAGINATION_RUNTIME });

      // Attente déterministe : utilitaires Tailwind générés, polices chargées,
      // images décodées, graphiques Chart.js dessinés puis rasterisés en PNG
      // (une image se déplace/duplique entre les pages, pas un <canvas>).
      const ready = await page.evaluate(
        (cfg) => (window as any).__idemFlow.prepare(cfg),
        { tailwindTimeout: 6000, imageTimeout: 8000, chartTimeout: 6000 }
      );
      logger.info(
        `Render ready for ${projectName}: tailwind=${ready?.tailwind}, charts=${ready?.charts}, rasterized=${ready?.rasterized}`
      );

      // Document flexible : on reconstruit le flux continu en pages A4 exactes.
      if (multiPage) {
        const report = (await page.evaluate(
          (cfg) => (window as any).__idemFlow.paginate(cfg),
          {
            pageWidthMm: parseFloat(finalPageFormat.width),
            pageHeightMm: parseFloat(finalPageFormat.height),
            minFillRatio: pagination?.minFillRatio,
            maxGapAddMm: pagination?.maxGapAddMm,
            maxGapAddHardMm: pagination?.maxGapAddHardMm,
            balance: pagination?.balance,
          }
        )) as FlowPaginationReport;

        const fills = report.sections.flatMap((s) => s.fills);
        const worst = fills.length ? Math.min(...fills) : 1;
        const average = fills.length ? fills.reduce((a, b) => a + b, 0) / fills.length : 1;
        logger.info(
          `Flow pagination for ${projectName}: ${report.totalPages} pages, ` +
            `fill avg=${(average * 100).toFixed(0)}% worst=${(worst * 100).toFixed(0)}%, ` +
            `splits=${report.sections.reduce((n, s) => n + s.splits, 0)}, ` +
            `repaired=${report.sections.reduce((n, s) => n + s.repaired, 0)}`
        );
        report.sections
          .filter((s) => !s.fixed && s.fills.some((f) => f < 0.6))
          .forEach((s) =>
            logger.warn(
              `Section "${s.name}" leaves an under-filled page (${s.fills
                .map((f) => `${Math.round(f * 100)}%`)
                .join(', ')}) — the agent produced too little content for ${s.pages} page(s)`
            )
          );
        report.warnings.forEach((w) => logger.warn(`Flow pagination warning: ${w}`));
      }

      // Créer un fichier temporaire pour le PDF
      const tempDir = os.tmpdir();
      const pdfFileName = `pdf-${Date.now()}-${Math.random().toString(36).substring(7)}.pdf`;
      const pdfPath = path.join(tempDir, pdfFileName);

      // Générer le PDF avec timeout optimisé
      await page.pdf({
        path: pdfPath,
        format,
        printBackground: true,
        margin: margins,
        preferCSSPageSize: true,
        displayHeaderFooter: false,
        omitBackground: false,
        timeout: 30000, // Réduit de 120s à 30s
      });

      await page.close(); // Fermer seulement la page, pas le browser

      // Mettre en cache le PDF généré
      PdfService.setCachedPdf(cacheKey, pdfPath);

      logger.info(`Successfully generated PDF for project ${projectName} at ${pdfPath}`);
      return pdfPath;
    } catch (error) {
      logger.error(`Error generating PDF for project ${projectName}:`, error);
      throw error;
    }
  }

  private sortSectionsByOrder(
    sections: SectionModel[],
    sectionDisplayOrder?: string[]
  ): SectionModel[] {
    if (!sectionDisplayOrder || sectionDisplayOrder.length === 0) {
      return sections; // Return sections in their original order if no specific order is specified
    }

    return sections.sort((a, b) => {
      const indexA = sectionDisplayOrder.indexOf(a.name);
      const indexB = sectionDisplayOrder.indexOf(b.name);

      // If both sections are in the specified order, sort them according to that order
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }

      // If only section A is in the specified order, it comes first
      if (indexA !== -1 && indexB === -1) {
        return -1;
      }

      // If only section B is in the specified order, it comes first
      if (indexA === -1 && indexB !== -1) {
        return 1;
      }

      // If neither section is in the specified order, keep their original order
      return 0;
    });
  }

  private generateOptimizedHtmlFromSections(options: {
    title: string;
    projectName: string;
    sections: SectionModel[];
    footerText: string;
    typography?: TypographyModel;
    pageFormat?: PageFormat;
    multiPage?: boolean;
    fixedPageSections?: string[];
  }): string {
    const {
      title,
      projectName,
      sections,
      footerText,
      typography,
      pageFormat,
      multiPage = false,
      fixedPageSections,
    } = options;

    // Utiliser A4 portrait par défaut si aucun format n'est spécifié
    const format = pageFormat || PAGE_FORMATS.A4_PORTRAIT;

    let htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title} - ${projectName}</title>
        ${brandFontLinks(typography)}
        <script>
          // Configuration optimisée des scripts avec typographie du projet
          function setupScripts() {
            const primaryFont = ${
              typography?.primaryFont ? `'${typography.primaryFont}'` : "'Archivo'"
            };
            const secondaryFont = ${
              typography?.secondaryFont ? `'${typography.secondaryFont}'` : "'IBM Plex Sans'"
            };

            if (typeof window.tailwind !== 'undefined') {
              window.tailwind.config = {
                theme: {
                  extend: {
                    fontFamily: {
                      'primary': [primaryFont, 'sans-serif'],
                      'secondary': [secondaryFont, 'sans-serif'],
                      'sans': [secondaryFont, 'system-ui', 'sans-serif']
                    }
                  }
                },
                corePlugins: { preflight: false }
              };
            }
            if (typeof window.Chart !== 'undefined') {
              window.Chart.defaults.font = {
                family: secondaryFont + ', sans-serif',
                size: 12
              };
              window.Chart.defaults.responsive = true;
              window.Chart.defaults.maintainAspectRatio = false;
              // Rendu synchrone : sans animation le graphe est peint dès la
              // construction, donc mesurable et rasterisable immédiatement.
              window.Chart.defaults.animation = false;
              window.Chart.defaults.animations = false;
            }
          }
          document.addEventListener('DOMContentLoaded', setupScripts);
          setupScripts(); // Exécution immédiate
        </script>

        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: ${
              typography?.primaryFont ? `'${typography.primaryFont}'` : "'Archivo'"
            }, system-ui, sans-serif;
          }

          h1, h2, h3, h4, h5, h6 {
            font-family: ${
              typography?.primaryFont ? `'${typography.primaryFont}'` : "'Archivo'"
            }, system-ui, sans-serif;
          }

          p, div, span, li, td, th {
            font-family: ${
              typography?.secondaryFont ? `'${typography.secondaryFont}'` : "'IBM Plex Sans'"
            }, system-ui, sans-serif;
          }

          /* Page format (configurable) */
          @page {
            size: ${format.width} ${format.height};
            margin: 0;
          }

          ${
            multiPage
              ? `/* Flexible document (business plan). The AI emits ONE continuous
             flow per section; the flow paginator (injected at print time)
             measures it and rebuilds it as exact ${format.height} pages, so a
             block is never cut and the page is filled. .idem-flow only exists
             before pagination — it is also the fallback if pagination fails. */
          .idem-flow {
            display: block;
            width: ${format.width};
            position: relative;
            page-break-after: always;
            break-after: page;
          }
          /* Only truly atomic media: a table or a card MUST stay fragmentable,
             break-inside:avoid on them would forbid the paginator to cut them
             and would leave a hole at the bottom of the page. */
          .idem-flow img, .idem-flow canvas, .idem-flow figure {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .idem-page {
            display: block;
            width: ${format.width};
            height: ${format.height};
            overflow: hidden;
            position: relative;
            page-break-after: always;
            break-after: page;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          /* last-of-type (et non last-child) : un <script> injecté en fin de
             body ne doit pas empêcher la règle → sinon page blanche finale. */
          .idem-page:last-of-type {
            page-break-after: auto;
            break-after: auto;
          }
          .idem-page > * { box-sizing: border-box; }`
              : `/* Fixed one-page section (pitch deck, brand identity):
             exactly one page, content clipped to the page (the prompt
             guarantees the content fits). */
          .section {
            display: block;
            width: ${format.width};
            min-height: ${format.height};
            max-height: ${format.height};
            overflow: hidden;
            position: relative;
          }
          .data-content { width: 100%; height: 100%; }`
          }

          .section:not(:first-child) {
            page-break-before: always;
            break-before: page;
          }

          /* Avoid page break right after headings */
          h1, h2, h3, h4, h5, h6 {
            page-break-after: avoid;
            break-after: avoid;
          }

          /* Orphans / widows for text blocks */
          p, li, td {
            orphans: 3;
            widows: 3;
          }

          /* Print-specific overrides */
          @media print {
            ${
              multiPage
                ? `.idem-page {
              width: ${format.width} !important;
              height: ${format.height} !important;
              overflow: hidden !important;
            }`
                : `.section {
              width: ${format.width} !important;
              min-height: ${format.height} !important;
              max-height: ${format.height} !important;
              overflow: hidden !important;
            }

            .section:not(:first-child) {
              page-break-before: always !important;
              break-before: page !important;
            }`
            }
          }
        </style>
      </head>
      <body class="bg-white">
    `;

    // Ajouter chaque section — each section is a full page (${format.width} × ${format.height})
    const fixedPageNames = (fixedPageSections || []).map((n) => n.toLowerCase().trim());
    sections.forEach((section) => {
      let sectionData =
        typeof section.data === 'string' ? section.data : JSON.stringify(section.data, null, 2);

      if (!multiPage) {
        htmlContent += `
        <div class="section">
            <div class="data-content">${sectionData}</div>
        </div>
      `;
        return;
      }

      // Multi-page : le conteneur racine généré par l'IA est ramené au flux
      // (hauteur fixe → min-h, pas de clipping) ; le paginateur mesure ce flux
      // puis le redécoupe en pages exactes. Le style interne n'est pas touché.
      sectionData = sectionData.replace(
        /(<[a-zA-Z][^>]*\bclass=")([^"]*)(")/,
        (_m, pre: string, cls: string, post: string) => {
          const fixed = cls
            .replace(/\bh-\[(\d+(?:\.\d+)?)(mm|cm|in)\]/g, 'min-h-[$1$2]')
            .replace(/\boverflow-hidden\b/g, 'overflow-visible');
          return pre + fixed + post;
        }
      );

      const isFixed = fixedPageNames.includes((section.name || '').toLowerCase().trim());
      htmlContent += `
        <div class="idem-flow" data-section-name="${escapeAttr(section.name || '')}" data-fixed-page="${
          isFixed ? '1' : '0'
        }">${sectionData}</div>
      `;
    });

    // Dernière page — signature minimaliste : logo centré, filet fin, et une
    // ligne de pied discrète (projet · domaine · date). Pas de description.
    // (page fixe : déjà calée sur la hauteur exacte, pas de pagination)
    htmlContent += `
          <div class="${multiPage ? 'idem-page' : 'section'}">
            <div style="position:relative;width:100%;height:100%;background:#ffffff;display:flex;flex-direction:column;align-items:center;justify-content:center;">

              <!-- Signature centrale -->
              <img
                src="https://idem.africa/assets/icons/logo.png"
                alt="Idem"
                style="height:30px;width:auto;display:block;"
              />
              <div style="width:24px;height:1px;background:#e5e7eb;margin:20px 0 18px;"></div>
              <div style="font-size:9px;line-height:1;letter-spacing:0.24em;text-transform:uppercase;color:#9ca3af;">${footerText}</div>

              <!-- Pied de page -->
              <div style="position:absolute;left:24mm;right:24mm;bottom:20mm;display:flex;align-items:center;justify-content:space-between;font-size:8px;line-height:1;letter-spacing:0.12em;text-transform:uppercase;color:#c9ced6;">
                <span>${projectName}</span>
                <span>idem.africa</span>
                <span>${new Date().toLocaleDateString('fr-FR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}</span>
              </div>

            </div>
          </div>
      </body>
      </html>
    `;

    return htmlContent;
  }

  async cleanupTempFile(pdfPath: string): Promise<void> {
    try {
      await fs.unlink(pdfPath);
      logger.info(`Cleaned up temporary PDF file: ${pdfPath}`);
    } catch (error) {
      logger.warn(`Failed to cleanup temporary PDF file: ${pdfPath}`, error);
    }
  }

  /**
   * Convertit les URLs d'images dans les sections en data URIs
   * pour que Puppeteer puisse les charger sans problème de CORS/authentification
   */
  private async convertImageUrlsToDataUris(sections: SectionModel[]): Promise<SectionModel[]> {
    logger.info('Converting image URLs to data URIs for PDF generation');

    const convertedSections = await Promise.all(
      sections.map(async (section) => {
        if (!section.data || typeof section.data !== 'string') {
          return section;
        }

        let htmlContent = section.data;

        // Regex pour trouver toutes les balises img avec src
        const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
        const matches = [...htmlContent.matchAll(imgRegex)];

        if (matches.length === 0) {
          return section;
        }

        logger.info(`Found ${matches.length} images in section: ${section.name}`);

        // Convertir chaque URL en data URI
        for (const match of matches) {
          const fullImgTag = match[0];
          const imageUrl = match[1];

          try {
            // Vérifier si c'est déjà un data URI
            if (imageUrl.startsWith('data:')) {
              continue;
            }

            // Télécharger l'image
            const dataUri = await this.downloadImageAsDataUri(imageUrl);

            if (dataUri) {
              // Remplacer l'URL par le data URI dans la balise img
              const newImgTag = fullImgTag.replace(imageUrl, dataUri);
              htmlContent = htmlContent.replace(fullImgTag, newImgTag);
              logger.info(`Converted image URL to data URI in section: ${section.name}`);
            }
          } catch (error) {
            logger.warn(`Failed to convert image URL to data URI: ${imageUrl}`, error);
            // Continue avec les autres images même si une échoue
          }
        }

        return {
          ...section,
          data: htmlContent,
        };
      })
    );

    logger.info('Finished converting image URLs to data URIs');
    return convertedSections;
  }

  /**
   * Télécharge une image depuis une URL et la convertit en data URI
   */
  private async downloadImageAsDataUri(imageUrl: string): Promise<string | null> {
    try {
      logger.info(`Downloading image from URL: ${imageUrl.substring(0, 50)}...`);

      // Télécharger l'image
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 10000, // 10 secondes timeout
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PdfService/1.0)',
        },
      });

      // Déterminer le type MIME depuis les headers ou l'URL
      let mimeType = response.headers['content-type'] || 'image/svg+xml';

      // Si c'est un SVG, s'assurer que le MIME type est correct
      if (imageUrl.toLowerCase().endsWith('.svg')) {
        mimeType = 'image/svg+xml';
      } else if (imageUrl.toLowerCase().endsWith('.png')) {
        mimeType = 'image/png';
      } else if (
        imageUrl.toLowerCase().endsWith('.jpg') ||
        imageUrl.toLowerCase().endsWith('.jpeg')
      ) {
        mimeType = 'image/jpeg';
      }

      // Convertir en base64
      const base64 = Buffer.from(response.data).toString('base64');
      const dataUri = `data:${mimeType};base64,${base64}`;

      logger.info(
        `Successfully converted image to data URI (${mimeType}, ${Math.round(
          base64.length / 1024
        )}KB)`
      );

      return dataUri;
    } catch (error) {
      logger.error(`Error downloading image from ${imageUrl}:`, error);
      return null;
    }
  }
}
