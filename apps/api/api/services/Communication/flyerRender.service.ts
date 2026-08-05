/**
 * FlyerRenderService — converts AI-generated flyer HTML into a PNG.
 *
 * Why PNG:
 *   The Communication UI lives inside the dark-only design system. Inlining
 *   raw Tailwind/HTML from the AI inevitably leaks classes (e.g. text-white,
 *   bg-gray-100) that fight the host page's CSS. Rendering to a flat PNG
 *   guarantees pixel-perfect isolation — the dashboard only displays an
 *   <img>, no style cascade collisions.
 *
 * Pipeline:
 *   AI HTML  →  full HTML doc with Tailwind CDN + Jura font + image embedded
 *            →  Puppeteer page sized to flyer format
 *            →  page.screenshot({ type: 'png' })
 *            →  upload to MinIO
 *            →  return public URL
 *
 * The browser instance is reused via PdfService's launched Chromium when
 * possible to avoid the cold-start cost on every flyer generation.
 */
import puppeteer, { Browser, Page } from 'puppeteer';
import logger from '../../config/logger';
import { StorageService } from '../storage.service';
import { FlyerFormat } from '../../models/communication.model';

interface FlyerSize {
  width: number;
  height: number;
  /** Device scale factor — bumps PNG resolution without changing layout. */
  deviceScaleFactor: number;
}

export const FORMAT_DIMENSIONS: Record<FlyerFormat, FlyerSize> = {
  square: { width: 1080, height: 1080, deviceScaleFactor: 1 },
  story: { width: 1080, height: 1920, deviceScaleFactor: 1 },
  banner: { width: 1200, height: 630, deviceScaleFactor: 1 },
  post: { width: 1200, height: 1500, deviceScaleFactor: 1 },
  // A4 @ 150dpi ≈ 1240 × 1754
  a4: { width: 1240, height: 1754, deviceScaleFactor: 1 },
};

/**
 * Largeur minimale du logo, en fraction de la largeur du visuel.
 *
 * Livré à lui-même, le modèle place systématiquement une vignette de 40 à 80px
 * dans un coin : à l'échelle d'un post vu sur un téléphone, la marque est
 * illisible et le visuel ne lui appartient plus. 13% de la largeur (≈140px sur
 * un carré 1080) est le seuil en dessous duquel une signature cesse d'être
 * lisible d'un coup d'œil.
 */
export const LOGO_MIN_WIDTH_RATIO = 0.13;

/**
 * Garde-fou haut : un logo agrandi ne doit pas devenir le sujet du visuel.
 * Sert aux logos très étroits, où atteindre la largeur minimale ferait exploser
 * la hauteur.
 */
const LOGO_MAX_HEIGHT_RATIO = 0.22;

/** Largeur minimale attendue du logo, en pixels, pour un format donné. */
export function minLogoWidthFor(format: FlyerFormat): number {
  const dims = FORMAT_DIMENSIONS[format] || FORMAT_DIMENSIONS.square;
  return Math.round(dims.width * LOGO_MIN_WIDTH_RATIO);
}

export class FlyerRenderService {
  private static browser: Browser | null = null;
  private readonly storage = new StorageService();

  private async getBrowser(): Promise<Browser> {
    if (FlyerRenderService.browser && FlyerRenderService.browser.isConnected()) {
      return FlyerRenderService.browser;
    }
    logger.info('FlyerRenderService: launching dedicated puppeteer instance');
    FlyerRenderService.browser = await puppeteer.launch({
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
    return FlyerRenderService.browser;
  }

  /**
   * Render an AI-generated flyer HTML body into a PNG and upload it.
   *
   * @param innerHtml  Single-line Tailwind HTML produced by the flyer agent.
   *                   The outer container size MUST match `format`.
   * @param format     Flyer format (drives canvas size).
   * @param typography Optional font configuration.
   */
  async renderFlyerToPng(
    innerHtml: string,
    format: FlyerFormat,
    typography?: { url?: string; primaryFont?: string; secondaryFont?: string },
    /**
     * URLs des déclinaisons du logo de la marque. Fournies, elles permettent de
     * MESURER le logo une fois la page rendue et de le remonter au seuil de
     * lisibilité s'il est trop petit (cf. `enforceLogoVisibility`).
     */
    logoUrls: string[] = []
  ): Promise<Buffer> {
    const start = Date.now();
    logger.info(`[FlyerRender] Starting PNG render`, { format });
    const dims = FORMAT_DIMENSIONS[format] || FORMAT_DIMENSIONS.square;
    const html = this.buildFullHtml(innerHtml, dims, typography);

    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.setViewport({
        width: dims.width,
        height: dims.height,
        deviceScaleFactor: dims.deviceScaleFactor,
      });

      // Fix TS2322: 'networkidle0' a été retiré des types Puppeteer récents.
      // On utilise 'load' puis on attend manuellement les images ci-dessous.
      await page.setContent(html, { waitUntil: 'load', timeout: 30000 });

      // Wait for any <img> to finish loading so the screenshot is complete.
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

      await this.enforceLogoVisibility(page, dims, logoUrls);

      const buffer = (await page.screenshot({
        type: 'png',
        clip: { x: 0, y: 0, width: dims.width, height: dims.height },
      })) as Buffer;

      logger.info(`[FlyerRender] PNG rendered successfully`, {
        format,
        sizeKB: Math.round(buffer.length / 1024),
        durationMs: Date.now() - start,
      });

      return buffer;
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  /**
   * Remonte le logo au seuil de lisibilité, APRÈS rendu.
   *
   * Le prompt donne déjà une taille minimale, mais le modèle y déroge presque
   * systématiquement : la marque finit en vignette de 40px dans un coin. Une
   * correction sur la chaîne HTML ne suffirait pas — la contrainte vient
   * souvent du conteneur (`<div class="w-[80px]">`), pas de l'image, et la
   * règle `img { max-width: 100% }` de ce document plafonnerait l'agrandissement.
   * Ici on travaille sur la page rendue : on MESURE, donc on ne corrige que ce
   * qui est réellement trop petit, et on desserre les ancêtres qui bloquent.
   *
   * Le facteur d'échelle est piloté par la largeur, et borné en hauteur : sur un
   * logo très étroit, atteindre la largeur minimale en ferait le sujet du visuel.
   */
  private async enforceLogoVisibility(
    page: Page,
    dims: FlyerSize,
    logoUrls: string[]
  ): Promise<void> {
    const urls = logoUrls.filter((u) => typeof u === 'string' && u.trim().length > 0);
    if (!urls.length) return;

    const minWidth = Math.round(dims.width * LOGO_MIN_WIDTH_RATIO);
    const maxHeight = Math.round(dims.height * LOGO_MAX_HEIGHT_RATIO);

    try {
      const rescaled = await page.evaluate(
        (srcs: string[], minW: number, maxH: number) => {
          // Les URLs signées portent une query volatile : on compare les chemins.
          const stripQuery = (value: string) => value.split('?')[0];
          const wanted = new Set(srcs.map(stripQuery));
          const report: { before: number; after: number }[] = [];

          for (const img of Array.from(document.images)) {
            const raw = stripQuery(img.getAttribute('src') || '');
            const resolved = stripQuery(img.currentSrc || img.src || '');
            if (!wanted.has(raw) && !wanted.has(resolved)) continue;

            const rect = img.getBoundingClientRect();
            if (rect.width <= 0 || rect.width >= minW) continue;

            let factor = minW / rect.width;
            if (rect.height > 0 && rect.height * factor > maxH) {
              factor = maxH / rect.height;
            }
            if (factor <= 1) continue;

            // Desserrer les conteneurs qui plafonnent l'image. Bornée à trois
            // niveaux et aux seuls ancêtres plus étroits que la cible : au-delà
            // on toucherait à la composition, pas à l'emballage du logo.
            let parent = img.parentElement;
            let depth = 0;
            while (parent && depth < 3) {
              if (parent.getBoundingClientRect().width < minW) {
                parent.style.maxWidth = 'none';
                parent.style.width = 'auto';
                parent.style.minWidth = `${Math.ceil(minW)}px`;
              }
              parent = parent.parentElement;
              depth += 1;
            }

            img.style.maxWidth = 'none';
            img.style.maxHeight = 'none';
            img.style.width = `${Math.round(rect.width * factor)}px`;
            img.style.height = 'auto';
            // Un logo posé en filigrane n'est pas une signature.
            if (parseFloat(getComputedStyle(img).opacity || '1') < 1) {
              img.style.opacity = '1';
            }
            report.push({ before: Math.round(rect.width), after: Math.round(rect.width * factor) });
          }
          return report;
        },
        urls,
        minWidth,
        maxHeight
      );

      if (rescaled.length) {
        logger.info('[FlyerRender] Logo remonté au seuil de lisibilité', {
          minWidth,
          rescaled,
        });
      }
    } catch (err: any) {
      // Un logo trop petit reste un visuel exploitable : on ne perd pas le
      // rendu pour autant.
      logger.warn('[FlyerRender] Logo visibility enforcement failed', { error: err?.message });
    }
  }

  /**
   * Wrap the AI's inner HTML in a sandboxed full document. We intentionally
   * use the Tailwind Play CDN inside the offscreen browser only — it never
   * touches the host dashboard.
   */
  private buildFullHtml(
    innerHtml: string,
    dims: FlyerSize,
    typography?: { url?: string; primaryFont?: string; secondaryFont?: string }
  ): string {
    const fontUrl = typography?.url || 'https://fonts.googleapis.com/css2?family=Jura:wght@300;400;500;600;700&display=swap';
    // Clean up Google Font URL if necessary (ensure it has &display=swap)
    const finalFontUrl = fontUrl.includes('display=swap') ? fontUrl : `${fontUrl}&display=swap`;
    const fontPrimary = typography?.primaryFont || 'Jura';
    const fontSecondary = typography?.secondaryFont || 'Jura';

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=${dims.width},initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${finalFontUrl}" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/primeicons@7.0.0/primeicons.css">
<script src="https://cdn.tailwindcss.com"></script>
<script>
  tailwind.config = {
    theme: {
      extend: {
        fontFamily: {
          primary: ['var(--font-primary)'],
          secondary: ['var(--font-secondary)'],
          sans: ['var(--font-secondary)']
        }
      }
    }
  }
</script>
<style>
  :root {
    --font-primary: '${fontPrimary}', system-ui, sans-serif;
    --font-secondary: '${fontSecondary}', system-ui, sans-serif;
  }
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #ffffff; font-family: var(--font-secondary); }
  /* Force the AI's outer flyer container to fill the canvas regardless of
     the arbitrary w-[..]/h-[..] classes it chose, so the PNG is never cropped. */
  body > *:first-child {
    width: ${dims.width}px !important;
    height: ${dims.height}px !important;
    overflow: hidden !important;
  }
  img { max-width: 100%; max-height: 100%; }
</style>
</head>
<body>
${innerHtml}
</body>
</html>`;
  }
}

export const flyerRenderService = new FlyerRenderService();
