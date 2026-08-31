/**
 * BusinessCardRenderService — rasterise une face de carte de visite déjà
 * interpolée (le HTML ne contient plus de `{{marqueur}}`) en PNG ou PDF prêts à
 * imprimer.
 *
 * Pourquoi un rendu serveur : la carte doit sortir à 300 dpi avec les polices
 * de marque réellement chargées et les logos hébergés résolus — ce qu'un
 * `html2canvas` côté navigateur ne garantit pas. On réutilise le même schéma
 * que `FlyerRenderService` (Chromium partagé, Tailwind CDN interne à la page
 * hors-écran, aucun contact avec le CSS du dashboard).
 *
 * L'aperçu temps réel du formulaire, lui, reste 100 % côté client (iframe) :
 * ce service n'est appelé qu'au téléchargement.
 */
import puppeteer, { Browser } from 'puppeteer';
import logger from '../../config/logger';
import {
  BusinessCardExport,
  BusinessCardOrientation,
  BUSINESS_CARD_SIZE_MM,
} from '../../models/businessCard.model';
import { EMPTY_FIELD_CLEANUP } from '../../utils/business-card-template';
import { brandFontLinks } from '../../utils/google-fonts.util';

/** Résolution d'impression cible. */
const PRINT_DPI = 300;
const MM_PER_INCH = 25.4;

/** Convertit des millimètres en pixels à la résolution d'impression. */
function mmToPx(mm: number): number {
  return Math.round((mm / MM_PER_INCH) * PRINT_DPI);
}

export interface BusinessCardRenderOptions {
  orientation: BusinessCardOrientation;
  format: BusinessCardExport;
  typography?: { url?: string; primaryFont?: string; secondaryFont?: string };
}

export class BusinessCardRenderService {
  private static browser: Browser | null = null;

  private async getBrowser(): Promise<Browser> {
    if (BusinessCardRenderService.browser && BusinessCardRenderService.browser.isConnected()) {
      return BusinessCardRenderService.browser;
    }
    logger.info('BusinessCardRenderService: launching dedicated puppeteer instance');
    BusinessCardRenderService.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
      ],
      timeout: 30000,
    });
    return BusinessCardRenderService.browser;
  }

  /**
   * Rend une face en PNG (300 dpi) ou en PDF (dimensions physiques exactes,
   * sans marge, fonds imprimés).
   *
   * @param interpolatedHtml HTML d'UNE face, marqueurs déjà remplacés.
   */
  async render(interpolatedHtml: string, options: BusinessCardRenderOptions): Promise<Buffer> {
    const start = Date.now();
    const size = BUSINESS_CARD_SIZE_MM[options.orientation];
    const html = this.buildDocument(interpolatedHtml, size, options.typography);

    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      // Le viewport est calé sur la carte en pixels CSS (96 dpi) ; le passage à
      // 300 dpi se fait via deviceScaleFactor pour le PNG, et via le format
      // millimétrique pour le PDF (vectoriel, indépendant du viewport).
      const cssWidth = Math.round((size.width / MM_PER_INCH) * 96);
      const cssHeight = Math.round((size.height / MM_PER_INCH) * 96);
      await page.setViewport({
        width: cssWidth,
        height: cssHeight,
        deviceScaleFactor: PRINT_DPI / 96,
      });

      await page.setContent(html, { waitUntil: 'load', timeout: 30000 });
      await page.evaluate(() => document.fonts?.ready);
      await page.evaluate(() => {
        const images = Array.from(document.images);
        return Promise.all(
          images.map((img) =>
            img.complete && img.naturalWidth > 0
              ? Promise.resolve()
              : new Promise<void>((resolve) => {
                  img.addEventListener('load', () => resolve());
                  img.addEventListener('error', () => resolve());
                })
          )
        );
      });

      // Puppeteer renvoie un Uint8Array : on repasse par Buffer, seul type que
      // `res.send()` sérialise en binaire (un Uint8Array partirait en JSON).
      const raw =
        options.format === 'pdf'
          ? await page.pdf({
              width: `${size.width}mm`,
              height: `${size.height}mm`,
              printBackground: true,
              margin: { top: '0', right: '0', bottom: '0', left: '0' },
              pageRanges: '1',
            })
          : await page.screenshot({
              type: 'png',
              clip: { x: 0, y: 0, width: cssWidth, height: cssHeight },
            });
      const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);

      logger.info('[BusinessCardRender] rendered', {
        format: options.format,
        orientation: options.orientation,
        pxWidth: mmToPx(size.width),
        sizeKB: Math.round(buffer.length / 1024),
        durationMs: Date.now() - start,
      });
      return buffer;
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  /** Document hors-écran isolé (Tailwind + polices de marque + nettoyage). */
  private buildDocument(
    innerHtml: string,
    size: { width: number; height: number },
    typography?: { url?: string; primaryFont?: string; secondaryFont?: string }
  ): string {
    const fontLinks = brandFontLinks(typography);
    const primary = typography?.primaryFont || 'Archivo';
    const secondary = typography?.secondaryFont || primary;

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
${fontLinks}
<script src="https://cdn.tailwindcss.com"></script>
<script>
  tailwind.config = {
    theme: { extend: { fontFamily: {
      primary: ['${primary}', 'sans-serif'],
      secondary: ['${secondary}', 'sans-serif'],
      sans: ['${secondary}', 'system-ui', 'sans-serif']
    } } }
  };
</script>
<style>
  @page { size: ${size.width}mm ${size.height}mm; margin: 0; }
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #ffffff; font-family: '${secondary}', system-ui, sans-serif; }
  /* La face occupe exactement la carte, quelles que soient les classes de l'IA. */
  body > *:first-child {
    width: ${size.width}mm !important;
    height: ${size.height}mm !important;
    overflow: hidden !important;
  }
  img { max-width: 100%; }
</style>
</head>
<body>
${innerHtml}
<script>${EMPTY_FIELD_CLEANUP}</script>
</body>
</html>`;
  }
}

export const businessCardRenderService = new BusinessCardRenderService();
