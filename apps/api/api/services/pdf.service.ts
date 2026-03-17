import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import logger from '../config/logger';
import { SectionModel } from '../models/section.model';
import { TypographyModel } from '../models/brand-identity.model';
import { cacheService } from './cache.service';
import axios from 'axios';

export interface PdfGenerationOptions {
  title?: string;
  projectName: string;
  projectDescription?: string;
  sections: SectionModel[];
  sectionDisplayOrder?: string[];
  footerText?: string;
  format?: 'A4' | 'Letter';
  margins?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  typography?: TypographyModel;
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
      projectDescription = '',
      sections,
      sectionDisplayOrder = options.sectionDisplayOrder,
      footerText = 'Generated by Idem',
      format = 'A4',
      margins = {
        top: '0mm',
        right: '0mm',
        bottom: '0mm',
        left: '0mm',
      },
    } = options;

    // Nettoyer les sections en supprimant le préfixe "html" du contenu data
    let cleanedSections = sections.map((section) => {
      if (
        section.data &&
        typeof section.data === 'string' &&
        section.data.toLowerCase().startsWith('html')
      ) {
        return {
          ...section,
          data: section.data.substring(4), // Supprimer les 4 premiers caractères "html"
        };
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
          projectDescription,
          sections: sortedSections,
          footerText,
          typography: options.typography,
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

      // Configuration rapide des scripts
      await page.evaluate(() => {
        if (typeof (window as any).tailwind !== 'undefined') {
          const tailwindInstance = (window as any).tailwind;
          if (tailwindInstance.refresh) tailwindInstance.refresh();
        }
      });

      // Attente minimale pour le rendu (réduite drastiquement)
      await new Promise((resolve) => setTimeout(resolve, 500)); // Réduit de 3.5s à 0.5s

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
    projectDescription: string;
    sections: SectionModel[];
    footerText: string;
    typography?: TypographyModel;
  }): string {
    const { title, projectName, projectDescription, sections, footerText, typography } = options;

    let htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title} - ${projectName}</title>
        ${typography?.url ? `<link href="${typography.url}" rel="stylesheet">` : ''}
        <script>
          // Configuration optimisée des scripts avec typographie du projet
          function setupScripts() {
            const primaryFont = ${
              typography?.primaryFont ? `'${typography.primaryFont}'` : "'Inter'"
            };
            const secondaryFont = ${
              typography?.secondaryFont ? `'${typography.secondaryFont}'` : "'Inter'"
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
              typography?.primaryFont ? `'${typography.primaryFont}'` : "'Inter'"
            }, system-ui, sans-serif;
          }

          h1, h2, h3, h4, h5, h6 {
            font-family: ${
              typography?.primaryFont ? `'${typography.primaryFont}'` : "'Inter'"
            }, system-ui, sans-serif;
          }

          p, div, span, li, td, th {
            font-family: ${
              typography?.secondaryFont ? `'${typography.secondaryFont}'` : "'Inter'"
            }, system-ui, sans-serif;
          }

          /* A4 page sizing */
          @page {
            size: 210mm 297mm;
            margin: 0;
          }

          /* Each section = one full page, force page break before each (except first) */
          .section {
            display: block;
            width: 210mm;
            min-height: 297mm;
            max-height: 297mm;
            overflow: hidden;
            position: relative;
          }

          .section:not(:first-child) {
            page-break-before: always;
            break-before: page;
          }

          /* Override overflow-hidden that AI may generate inside sections */
          .data-content {
            width: 100%;
            height: 100%;
          }

          /* Within a section, avoid breaking cards/blocks across the page boundary */
          .data-content article,
          .data-content .card,
          .data-content [class*="rounded"] {
            page-break-inside: avoid;
            break-inside: avoid;
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
            .section {
              width: 210mm !important;
              min-height: 297mm !important;
              max-height: 297mm !important;
              overflow: hidden !important;
            }

            .section:not(:first-child) {
              page-break-before: always !important;
              break-before: page !important;
            }
          }
        </style>
      </head>
      <body class="bg-white">
    `;

    // Ajouter chaque section — each section is a full A4 page
    sections.forEach((section, index) => {
      let sectionData =
        typeof section.data === 'string' ? section.data : JSON.stringify(section.data, null, 2);

      // Strip overflow-hidden from the AI-generated outermost container
      // to prevent content clipping at the PDF level (the .section wrapper handles overflow)
      sectionData = sectionData.replace(/overflow-hidden/g, 'overflow-visible');

      htmlContent += `
        <div class="section">
            <div class="data-content">${sectionData}</div>
        </div>
      `;
    });

    // Footer page - Full A4 page with minimalist professional design
    htmlContent += `
          <div class="section">
            <div class="flex flex-col items-center justify-between h-full px-16 py-20">

              <!-- Top section: Project info -->
              <div class="w-full max-w-3xl">
                <div class="space-y-2">
                  <h1 class="text-4xl font-bold text-gray-900 tracking-tight">${projectName}</h1>
                  ${projectDescription ? `<p class="text-lg text-gray-600 leading-relaxed">${projectDescription}</p>` : ''}
                </div>
              </div>

              <!-- Center section: Idem logo -->
              <div class="flex flex-col items-center space-y-6">
                <img
                  src="https://idem.africa/assets/icons/logo_white.webp"
                  alt="Idem Logo"
                  class="h-16 w-auto"
                />
                <div class="text-center space-y-1">
                  <p class="text-sm font-medium text-gray-700">Powered by Idem</p>
                  <a href="https://idem.africa" class="text-sm text-gray-500 hover:text-gray-700">
                    idem.africa
                  </a>
                </div>
              </div>

              <!-- Bottom section: Generation date -->
              <div class="w-full max-w-3xl border-t border-gray-200 pt-6">
                <div class="flex items-center justify-between text-sm text-gray-500">
                  <span>${footerText}</span>
                  <span>Generated on ${new Date().toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}</span>
                </div>
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
