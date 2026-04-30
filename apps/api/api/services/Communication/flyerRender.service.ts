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
import puppeteer, { Browser } from 'puppeteer';
import logger from '../../config/logger';
import { StorageService } from '../storage.service';
import { FlyerFormat } from '../../models/communication.model';

interface FlyerSize {
  width: number;
  height: number;
  /** Device scale factor — bumps PNG resolution without changing layout. */
  deviceScaleFactor: number;
}

const FORMAT_DIMENSIONS: Record<FlyerFormat, FlyerSize> = {
  square: { width: 1080, height: 1080, deviceScaleFactor: 1 },
  story: { width: 1080, height: 1920, deviceScaleFactor: 1 },
  banner: { width: 1200, height: 630, deviceScaleFactor: 1 },
  post: { width: 1200, height: 1500, deviceScaleFactor: 1 },
  // A4 @ 150dpi ≈ 1240 × 1754
  a4: { width: 1240, height: 1754, deviceScaleFactor: 1 },
};

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
   * @param meta       userId / projectId / flyerId for storage path.
   */
  async renderFlyerToPng(
    innerHtml: string,
    format: FlyerFormat,
    typography?: { url?: string; primaryFont?: string; secondaryFont?: string }
  ): Promise<Buffer> {
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
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

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

      const buffer = (await page.screenshot({
        type: 'png',
        clip: { x: 0, y: 0, width: dims.width, height: dims.height },
      })) as Buffer;

      logger.info('FlyerRenderService: PNG rendered (not saved)', {
        format,
        sizeKB: Math.round(buffer.length / 1024),
      });

      return buffer;
    } finally {
      await page.close().catch(() => undefined);
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
