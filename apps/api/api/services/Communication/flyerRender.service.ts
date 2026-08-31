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
import sharp from 'sharp';
import logger from '../../config/logger';
import { StorageService } from '../storage.service';
import { brandFontLinks } from '../../utils/google-fonts.util';
import { FlyerFormat } from '../../models/communication.model';

/** Déclinaisons de logo disponibles pour la marque, par famille et polarité. */
export interface LogoDeclensionSet {
  /** URL réellement placée par le modèle dans le HTML (si connue). */
  used?: string;
  primary?: string;
  icon?: string;
  withText?: { lightBackground?: string; darkBackground?: string; monochrome?: string };
  iconOnly?: { lightBackground?: string; darkBackground?: string; monochrome?: string };
}

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

/**
 * Contraste minimal d'un pixel d'encre contre ce qui est rendu derrière lui.
 * 3:1 est le seuil WCAG des éléments graphiques non textuels.
 */
const LOGO_PIXEL_CONTRAST = 3;

/**
 * Part des pixels d'encre devant atteindre ce contraste pour que la signature
 * « tienne ». On raisonne en fraction, pas en moyenne : sur un fond contrasté
 * (photo, damier, dégradé), une moyenne flatteuse peut cacher une moitié de
 * logo effacée.
 */
const LOGO_MIN_VISIBLE_FRACTION = 0.85;

/** Au-delà, inutile d'essayer d'autres déclinaisons. */
const LOGO_GOOD_VISIBLE_FRACTION = 0.97;

/** Écart par canal en deçà duquel deux clichés sont tenus pour identiques. */
const INK_DELTA = 10;

/** En dessous, aucune encre détectable : image cassée ou transparente. */
const MIN_INK_RATIO = 0.015;

/**
 * Au-dessus, le logo couvre sa boîte de bord en bord : c'est un PNG avec son
 * propre fond, il porte son contraste avec lui.
 */
const OPAQUE_TILE_RATIO = 0.92;

/** Luminance relative WCAG d'un pixel sRGB. */
function luminance(r: number, g: number, b: number): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(a: number, b: number): number {
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}

/** Les URLs signées portent une query volatile : on compare les chemins. */
function stripQuery(value: string): string {
  return (value || '').split('?')[0];
}

/** Luminance moyenne d'un buffer RGB brut. */
function meanLuminance(data: Buffer | Uint8Array): number {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 3) {
    sum += luminance(data[i], data[i + 1], data[i + 2]);
    n++;
  }
  return n ? sum / n : 0;
}

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
     * Déclinaisons du logo de la marque. Fournies, elles permettent de MESURER
     * le logo une fois la page rendue, de le remonter au seuil de lisibilité
     * s'il est trop petit (`enforceLogoVisibility`) et de corriger la
     * déclinaison si elle ne contraste pas avec le fond (`enforceLogoContrast`).
     * Un tableau d'URLs reste accepté (appelant historique) : dans ce cas seule
     * la mise à l'échelle s'applique, faute de savoir quoi substituer.
     */
    logos: LogoDeclensionSet | string[] = []
  ): Promise<Buffer> {
    const declensions: LogoDeclensionSet = Array.isArray(logos) ? { used: logos[0] } : logos;
    const logoUrls = Array.isArray(logos) ? logos : this.allLogoUrls(logos);
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
      await this.enforceLogoContrast(page, declensions, logoUrls);

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

  /** Toutes les URLs connues de déclinaisons, dédoublonnées. */
  private allLogoUrls(logos: LogoDeclensionSet): string[] {
    const raw = [
      logos.used,
      logos.primary,
      logos.icon,
      logos.withText?.lightBackground,
      logos.withText?.darkBackground,
      logos.withText?.monochrome,
      logos.iconOnly?.lightBackground,
      logos.iconOnly?.darkBackground,
      logos.iconOnly?.monochrome,
    ].filter((u): u is string => typeof u === 'string' && u.trim().length > 0);
    const seen = new Set<string>();
    return raw.filter((u) => {
      const key = stripQuery(u);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Corrige la déclinaison du logo APRÈS rendu, sur mesure du contraste réel.
   *
   * Le modèle choisit la déclinaison « à l'œil » d'après l'idée qu'il se fait de
   * sa composition ; il se trompe régulièrement d'un cran — typiquement la
   * version claire (conçue pour fond sombre) posée sur une photo claire, où le
   * logo disparaît. Aucune consigne de prompt ne rend ce jugement fiable : la
   * luminance qui compte est celle des pixels effectivement rendus SOUS le logo
   * (photo, dégradé, aplat), pas celle que le modèle imagine.
   *
   * On mesure donc, et on substitue :
   *   1. silhouette exacte de l'encre (le logo photographié sur fond blanc puis
   *      sur fond noir : les pixels identiques sont opaques) ;
   *   2. part de cette encre dont le contraste LOCAL contre le fond réellement
   *      rendu atteint 3:1 ;
   *   3. sous 85 % de lisibilité, on essaie les autres déclinaisons (polarité
   *      opposée d'abord, d'après la luminance mesurée) et on garde la
   *      meilleure ;
   *   4. si aucune ne passe (fond chargé), halo doux dans la polarité inverse
   *      de l'encre — un artifice de graphiste, pas une pastille pleine.
   */
  private async enforceLogoContrast(
    page: Page,
    logos: LogoDeclensionSet,
    logoUrls: string[]
  ): Promise<void> {
    const known = logoUrls.filter((u) => typeof u === 'string' && u.trim().length > 0);
    if (!known.length) return;

    try {
      // 1. Repérer le logo et le marquer pour les manipulations suivantes.
      const found = await page.evaluate((srcs: string[]) => {
        const strip = (v: string) => (v || '').split('?')[0];
        const wanted = new Set(srcs.map(strip));
        for (const img of Array.from(document.images)) {
          const raw = strip(img.getAttribute('src') || '');
          const resolved = strip(img.currentSrc || img.src || '');
          if (!wanted.has(raw) && !wanted.has(resolved)) continue;
          const rect = img.getBoundingClientRect();
          if (rect.width < 8 || rect.height < 8) continue;
          img.setAttribute('data-idem-logo', '1');
          return { src: img.getAttribute('src') || resolved };
        }
        return null;
      }, known);
      if (!found) return;

      const initial = await this.measureLogoContrast(page);
      if (!initial) return;
      if (initial.visible >= LOGO_MIN_VISIBLE_FRACTION) return;

      const candidates = this.orderedDeclensions(logos, found.src, initial.background);
      let best = { url: found.src, ...initial };

      let current = found.src;
      for (const url of candidates) {
        if (!(await this.swapLogoSrc(page, url))) continue;
        current = url;
        const measured = await this.measureLogoContrast(page);
        if (!measured) continue;
        if (
          measured.visible > best.visible + 0.01 ||
          (Math.abs(measured.visible - best.visible) <= 0.01 && measured.contrast > best.contrast)
        ) {
          best = { url, ...measured };
        }
        if (best.visible >= LOGO_GOOD_VISIBLE_FRACTION) break;
      }

      // Toujours reposer la meilleure déclinaison : la boucle a pu laisser en
      // place un candidat essayé qui était pire que l'original.
      if (stripQuery(current) !== stripQuery(best.url)) {
        await this.swapLogoSrc(page, best.url);
      }
      if (stripQuery(best.url) !== stripQuery(found.src)) {
        logger.info(
          `[FlyerRender] Déclinaison de logo corrigée par mesure du rendu : ` +
            `${Math.round(initial.visible * 100)}% -> ${Math.round(best.visible * 100)}% ` +
            `de l'encre lisible (contraste moyen ${best.contrast.toFixed(1)}:1, ` +
            `luminance du fond ${initial.background.toFixed(2)})`
        );
      }

      if (best.visible < LOGO_MIN_VISIBLE_FRACTION) {
        // Dernier recours : fond trop chargé pour qu'une déclinaison suffise.
        // Le halo doit contraster avec l'ENCRE (pas avec le fond, dont elle est
        // justement trop proche) : encre claire -> halo sombre, et l'inverse.
        const darkHalo = best.ink >= 0.45;
        await page.evaluate((dark: boolean) => {
          const el = document.querySelector('[data-idem-logo]') as HTMLElement | null;
          if (!el) return;
          el.style.filter = dark
            ? 'drop-shadow(0 0 10px rgba(0,0,0,0.55)) drop-shadow(0 0 3px rgba(0,0,0,0.45))'
            : 'drop-shadow(0 0 10px rgba(255,255,255,0.75)) drop-shadow(0 0 3px rgba(255,255,255,0.6))';
        }, darkHalo);
        logger.warn(
          `[FlyerRender] Logo encore partiellement effacé après substitution ` +
            `(${Math.round(best.visible * 100)}% de l'encre lisible) — halo ` +
            `${darkHalo ? 'sombre' : 'clair'} appliqué`
        );
      }
    } catch (err: any) {
      // Un logo mal contrasté reste un visuel exploitable : on ne perd pas le
      // rendu pour une mesure ratée.
      logger.warn('[FlyerRender] Logo contrast enforcement failed', { error: err?.message });
    }
  }

  /** Remplace la source du logo marqué et attend son chargement. */
  private async swapLogoSrc(page: Page, url: string): Promise<boolean> {
    try {
      // Fonction NON async : compilée en ES2016, une fonction async injectée
      // dans la page référencerait les helpers __awaiter/__generator, absents
      // du contexte navigateur (l'évaluation échouerait silencieusement).
      return await page.evaluate((src: string) => {
        const el = document.querySelector('[data-idem-logo]') as HTMLImageElement | null;
        if (!el) return Promise.resolve(false);
        el.src = src;
        if (el.complete && el.naturalWidth > 0) return Promise.resolve(true);
        return new Promise<boolean>((resolve) => {
          el.addEventListener('load', () => resolve(true), { once: true });
          el.addEventListener('error', () => resolve(false), { once: true });
          setTimeout(() => resolve(el.naturalWidth > 0), 5000);
        });
      }, url);
    } catch {
      return false;
    }
  }

  /**
   * Lisibilité du logo sur ce qui est rendu derrière lui.
   *
   * `visible` = part des pixels d'encre dont le contraste LOCAL atteint le
   * seuil : c'est le critère de décision. `contrast` (moyenne) et les
   * luminances servent aux logs, à l'ordre d'essai des déclinaisons et à la
   * polarité du halo de secours.
   */
  private async measureLogoContrast(
    page: Page
  ): Promise<{ visible: number; contrast: number; ink: number; background: number } | null> {
    const rect = await page.evaluate(() => {
      const el = document.querySelector('[data-idem-logo]') as HTMLElement | null;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const x = Math.max(0, Math.floor(r.left));
      const y = Math.max(0, Math.floor(r.top));
      const width = Math.min(Math.ceil(r.width), document.documentElement.clientWidth - x);
      const height = Math.min(Math.ceil(r.height), document.documentElement.clientHeight - y);
      return width > 4 && height > 4 ? { x, y, width, height } : null;
    });
    if (!rect) return null;

    // Silhouette exacte du logo : on le photographie sur fond blanc puis sur
    // fond noir (via son propre background). Les pixels IDENTIQUES entre les
    // deux clichés sont opaques — c'est l'encre. Comparer simplement « avec »
    // et « sans » logo raterait l'encre qui se confond déjà avec le fond, donc
    // exactement les pixels illisibles qu'on cherche à compter.
    const setBackdrop = (color: string | null) =>
      page.evaluate((c: string | null) => {
        const el = document.querySelector('[data-idem-logo]') as HTMLElement | null;
        if (!el) return;
        if (c === null) {
          el.style.visibility = 'hidden';
          el.style.backgroundColor = '';
        } else {
          el.style.visibility = 'visible';
          el.style.backgroundColor = c;
        }
      }, color);

    await setBackdrop('#ffffff');
    const onWhite = (await page.screenshot({ type: 'png', clip: rect })) as Buffer;
    await setBackdrop('#000000');
    const onBlack = (await page.screenshot({ type: 'png', clip: rect })) as Buffer;
    await setBackdrop(null);
    const backdrop = (await page.screenshot({ type: 'png', clip: rect })) as Buffer;
    await page.evaluate(() => {
      const el = document.querySelector('[data-idem-logo]') as HTMLElement | null;
      if (el) {
        el.style.visibility = 'visible';
        el.style.backgroundColor = '';
      }
    });

    const [white, black, back] = await Promise.all([
      sharp(onWhite).removeAlpha().raw().toBuffer({ resolveWithObject: true }),
      sharp(onBlack).removeAlpha().raw().toBuffer({ resolveWithObject: true }),
      sharp(backdrop).removeAlpha().raw().toBuffer({ resolveWithObject: true }),
    ]);
    if (white.data.length !== black.data.length || white.data.length !== back.data.length) {
      return null;
    }

    let inkPixels = 0;
    let readablePixels = 0;
    let inkLum = 0;
    let bgLum = 0;
    const total = white.data.length / 3;
    for (let i = 0; i < white.data.length; i += 3) {
      const dr = Math.abs(white.data[i] - black.data[i]);
      const dg = Math.abs(white.data[i + 1] - black.data[i + 1]);
      const db = Math.abs(white.data[i + 2] - black.data[i + 2]);
      // Pixel transparent (ou semi-transparent) : il a suivi le fond imposé.
      if (dr > INK_DELTA || dg > INK_DELTA || db > INK_DELTA) continue;
      const ink = luminance(white.data[i], white.data[i + 1], white.data[i + 2]);
      const behind = luminance(back.data[i], back.data[i + 1], back.data[i + 2]);
      inkPixels++;
      inkLum += ink;
      bgLum += behind;
      if (contrastRatio(ink, behind) >= LOGO_PIXEL_CONTRAST) readablePixels++;
    }

    const flat = meanLuminance(back.data);
    // Aucune encre détectable : image cassée ou entièrement transparente.
    if (!total || inkPixels / total < MIN_INK_RATIO) {
      return { visible: 0, contrast: 1, ink: flat, background: flat };
    }
    // Logo opaque de bord à bord (PNG avec son propre fond) : il porte son
    // propre contraste, la question de la déclinaison ne se pose pas.
    if (inkPixels / total > OPAQUE_TILE_RATIO) {
      return { visible: 1, contrast: 21, ink: inkLum / inkPixels, background: flat };
    }

    const ink = inkLum / inkPixels;
    const background = bgLum / inkPixels;
    return {
      visible: readablePixels / inkPixels,
      contrast: contrastRatio(ink, background),
      ink,
      background,
    };
  }

  /**
   * Déclinaisons à essayer, dans l'ordre : même famille (signature avec texte
   * ou icône seule) en commençant par la polarité qu'appelle le fond mesuré,
   * puis le monochrome, puis l'autre famille, puis le logo principal.
   */
  private orderedDeclensions(
    logos: LogoDeclensionSet,
    currentUrl: string,
    backgroundLuminance: number
  ): string[] {
    const current = stripQuery(currentUrl);
    const inFamily = (set?: LogoDeclensionSet['withText']) =>
      !!set &&
      [set.lightBackground, set.darkBackground, set.monochrome].some(
        (u) => u && stripQuery(u) === current
      );

    const isIconFamily = inFamily(logos.iconOnly) || stripQuery(logos.icon || '') === current;
    const family = isIconFamily ? logos.iconOnly : logos.withText;
    const other = isIconFamily ? logos.withText : logos.iconOnly;

    // Fond clair → déclinaison "pour fond clair" (encre foncée), et l'inverse.
    const bgIsLight = backgroundLuminance >= 0.4;
    const byPolarity = (set?: LogoDeclensionSet['withText']) =>
      set
        ? bgIsLight
          ? [set.lightBackground, set.monochrome, set.darkBackground]
          : [set.darkBackground, set.monochrome, set.lightBackground]
        : [];

    const ordered = [...byPolarity(family), ...byPolarity(other), logos.primary, logos.icon];
    const seen = new Set<string>([current]);
    return ordered.filter((u): u is string => {
      if (!u || !u.trim()) return false;
      const key = stripQuery(u);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
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
    // `typography.url` est un slug, pas une feuille de style : la construire à
    // partir des familles, sinon le visuel sort dans la police système.
    const fontLinks = brandFontLinks(typography);
    const fontPrimary = typography?.primaryFont || 'Archivo';
    const fontSecondary = typography?.secondaryFont || 'IBM Plex Sans';

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=${dims.width},initial-scale=1">
${fontLinks}
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
