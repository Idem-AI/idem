import axios from 'axios';
import * as opentype from 'opentype.js';
import logger from '../../../config/logger';
import { cacheService } from '../../cache.service';
import { fontCatalogService } from '../../font-catalog.service';

/**
 * Charge le VRAI fichier de police choisi par l'utilisateur et l'expose parsé,
 * avec ses métriques réelles.
 *
 * Pourquoi : un `font-family="Poppins"` dans un SVG ne garantit rien. Le rendu
 * final passe par librsvg (sharp → PNG), par `<img src="…svg">` ou par un PDF —
 * aucun de ces contextes ne va chercher la police sur Google. Le texte tombait
 * donc systématiquement sur une fallback système (DejaVu/Arial) : mauvaise
 * typographie ET mauvaises métriques, donc mauvais alignement.
 *
 * En chargeant le .ttf ici, on peut mesurer exactement le mot (largeur d'encre,
 * hauteur de capitale, jambages) puis le vectoriser : le logo devient
 * autoportant, identique partout, sans dépendance de police.
 *
 * La police n'est plus forcément chez Google : depuis l'ouverture aux autres
 * fonderies et à l'import, l'appelant passe la FEUILLE de la famille, dans
 * laquelle on cherche le fichier vectorisable. Google reste le repli quand on
 * ne connaît qu'un nom — c'est le seul catalogue adressable ainsi.
 *
 * Toutes les fonderies ne servent pas du TrueType : Fontsource ne publie que du
 * WOFF/WOFF2, qu'`opentype.js` ne sait pas décompresser, et un utilisateur peut
 * n'avoir importé que du WOFF2. Le lockup retombe alors sur son rendu `<text>`
 * dégradé, exactement comme lorsqu'une famille Google est indisponible.
 */

const GOOGLE_FONTS_CSS_API = 'https://fonts.googleapis.com/css2';

/**
 * Google choisit le format du fichier d'après le User-Agent : un navigateur
 * moderne reçoit du woff2 (que opentype.js ne sait pas décompresser), un vieil
 * IE reçoit de l'EOT. Un UA neutre, non reconnu, obtient le .ttf brut — c'est
 * exactement ce qu'il nous faut.
 */
const NEUTRAL_UA = 'idem-brand-pipeline/1.0';

/** Le binaire d'une police ne change jamais pour une URL donnée : cache long. */
const FONT_CACHE_TTL_SECONDS = 30 * 24 * 60 * 60;
const FONT_CACHE_PREFIX = 'font-file';

/** Une famille indisponible le reste : on évite de retenter à chaque logo. */
const NEGATIVE_CACHE_MS = 10 * 60 * 1000;

/** Graisses tentées quand la graisse demandée n'existe pas dans la famille. */
const WEIGHT_FALLBACKS = [700, 600, 500, 400];

const REQUEST_TIMEOUT_MS = 12_000;
const MAX_FONT_BYTES = 6 * 1024 * 1024;

export interface LoadedFont {
  family: string;
  weight: number;
  font: opentype.Font;
  unitsPerEm: number;
  /** Hauteur de capitale en unités de police (mesurée, jamais devinée). */
  capHeightUnits: number;
}

export class FontLoaderService {
  private readonly memoryCache = new Map<string, LoadedFont>();
  private readonly failures = new Map<string, number>();
  private readonly inFlight = new Map<string, Promise<LoadedFont | null>>();

  /**
   * Renvoie la police parsée, ou `null` si elle est introuvable / le réseau est
   * indisponible. L'appelant doit alors basculer sur un rendu `<text>` dégradé.
   */
  async load(family: string, weight = 700, cssUrl?: string): Promise<LoadedFont | null> {
    const normalizedFamily = normalizeFamily(family);
    if (!normalizedFamily) return null;

    const normalizedWeight = normalizeWeight(weight);
    const key = `${normalizedFamily.toLowerCase()}|${normalizedWeight}`;

    const cached = this.memoryCache.get(key);
    if (cached) return cached;

    const failedAt = this.failures.get(key);
    if (failedAt && Date.now() - failedAt < NEGATIVE_CACHE_MS) return null;

    const pending = this.inFlight.get(key);
    if (pending) return pending;

    const task = this.resolve(normalizedFamily, normalizedWeight, key, cssUrl).finally(() => {
      this.inFlight.delete(key);
    });
    this.inFlight.set(key, task);
    return task;
  }

  private async resolve(
    family: string,
    weight: number,
    key: string,
    cssUrl?: string
  ): Promise<LoadedFont | null> {
    try {
      const buffer = await this.fetchFontBinary(family, weight, cssUrl);
      if (!buffer) {
        this.failures.set(key, Date.now());
        return null;
      }

      const parsed = opentype.parse(toArrayBuffer(buffer));
      const loaded: LoadedFont = {
        family,
        weight,
        font: parsed,
        unitsPerEm: parsed.unitsPerEm || 1000,
        capHeightUnits: measureCapHeight(parsed),
      };

      this.memoryCache.set(key, loaded);
      this.failures.delete(key);
      logger.info(`Font loaded for logo composition: ${family} ${weight}`);
      return loaded;
    } catch (error) {
      logger.warn(`Font load failed for "${family}" ${weight}: ${(error as Error).message}`);
      this.failures.set(key, Date.now());
      return null;
    }
  }

  /** Redis d'abord (partagé entre instances), la fonderie ensuite. */
  private async fetchFontBinary(
    family: string,
    weight: number,
    cssUrl?: string
  ): Promise<Buffer | null> {
    const cacheKey = `${family.toLowerCase().replace(/\s+/g, '-')}-${weight}`;

    const cached = await cacheService
      .get<string>(cacheKey, { prefix: FONT_CACHE_PREFIX })
      .catch(() => null);
    if (cached) {
      return Buffer.from(cached, 'base64');
    }

    const fileUrl = await this.resolveFontFileUrl(family, weight, cssUrl);
    if (!fileUrl) return null;

    const response = await axios.get<ArrayBuffer>(fileUrl, {
      responseType: 'arraybuffer',
      timeout: REQUEST_TIMEOUT_MS,
      maxContentLength: MAX_FONT_BYTES,
      headers: { 'User-Agent': NEUTRAL_UA },
    });

    const buffer = Buffer.from(response.data);
    await cacheService
      .set(cacheKey, buffer.toString('base64'), {
        prefix: FONT_CACHE_PREFIX,
        ttl: FONT_CACHE_TTL_SECONDS,
      })
      .catch(() => undefined);

    return buffer;
  }

  /**
   * L'URL du fichier vectorisable de la famille.
   *
   * La feuille fournie par l'appelant est consultée d'abord : c'est la seule
   * qui connaisse une police importée ou venue d'une autre fonderie. À défaut,
   * on interroge le catalogue par le nom — ce qui rattrape les projets d'avant
   * l'ouverture aux autres sources, dont la typographie ne porte pas encore sa
   * feuille. Google reste le dernier recours.
   */
  private async resolveFontFileUrl(
    family: string,
    weight: number,
    cssUrl?: string
  ): Promise<string | null> {
    const stylesheet = cssUrl ?? (await this.lookupStylesheet(family));
    if (stylesheet) {
      const fileUrl = await this.fileUrlFromStylesheet(stylesheet);
      if (fileUrl) return fileUrl;
      logger.warn(
        `No vectorisable font file (TTF/OTF) in the stylesheet for "${family}" — ` +
          'the wordmark will fall back to <text>.'
      );
    }

    const encodedFamily = encodeURIComponent(family).replace(/%20/g, '+');
    const candidates = [
      ...new Set([weight, ...WEIGHT_FALLBACKS]),
    ].map((candidate) => `${GOOGLE_FONTS_CSS_API}?family=${encodedFamily}:wght@${candidate}`);
    candidates.push(`${GOOGLE_FONTS_CSS_API}?family=${encodedFamily}`);

    for (const url of candidates) {
      const fileUrl = await this.fileUrlFromStylesheet(url);
      if (fileUrl) return fileUrl;
    }

    logger.warn(`No downloadable TTF found for "${family}"`);
    return null;
  }

  /** La feuille d'une famille connue seulement par son nom, via le catalogue. */
  private async lookupStylesheet(family: string): Promise<string | null> {
    try {
      const found = await fontCatalogService.resolve(family);
      // Une famille Google n'a rien à gagner à passer par sa feuille : le
      // chemin historique gère déjà le repli de graisse.
      return found && found.source !== 'google' ? found.cssUrl : null;
    } catch {
      return null;
    }
  }

  /**
   * Télécharge une feuille et en extrait le premier fichier vectorisable.
   *
   * L'UA neutre est essentiel : servie à un navigateur moderne, la même URL
   * renvoie du WOFF2, qu'`opentype.js` ne sait pas lire.
   */
  private async fileUrlFromStylesheet(url: string): Promise<string | null> {
    try {
      const response = await axios.get<string>(url, {
        timeout: REQUEST_TIMEOUT_MS,
        responseType: 'text',
        headers: { 'User-Agent': NEUTRAL_UA },
      });
      return extractFontFileUrl(String(response.data));
    } catch {
      // 400/404 = cette graisse n'existe pas dans la famille : on continue.
      return null;
    }
  }
}

/** Une valeur de typographie peut être une stack CSS : on garde la 1re famille. */
function normalizeFamily(family: string): string {
  if (!family || typeof family !== 'string') return '';
  return family
    .split(',')[0]
    .replace(/["']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeWeight(weight: number): number {
  if (!Number.isFinite(weight)) return 700;
  return Math.min(900, Math.max(100, Math.round(weight / 100) * 100));
}

/**
 * `src: url(https://…ttf)` → l'URL.
 *
 * Seuls TrueType et OpenType sont retenus : ce sont les deux formats
 * qu'`opentype.js` parse. Les guillemets sont optionnels (Google n'en met pas,
 * Fontshare et notre propre feuille en mettent), et une URL protocole-relative
 * (`//cdn…`, la forme de Fontshare) est ramenée en HTTPS.
 */
function extractFontFileUrl(css: string): string | null {
  const match = css.match(/url\(\s*['"]?((?:https:)?\/\/[^)'"]+\.(?:ttf|otf))['"]?\s*\)/i);
  if (!match) return null;
  return match[1].startsWith('//') ? `https:${match[1]}` : match[1];
}

/**
 * Hauteur de capitale réelle : la table OS/2 quand elle la déclare, sinon la
 * boîte englobante du « H ». C'est cette valeur qui pilote l'alignement optique
 * du wordmark — une approximation en em produit un texte visiblement décalé.
 */
function measureCapHeight(font: opentype.Font): number {
  const declared = font.tables?.os2?.sCapHeight;
  if (typeof declared === 'number' && declared > 0) return declared;

  try {
    const box = font.getPath('H', 0, 0, font.unitsPerEm).getBoundingBox();
    const height = Math.abs(box.y1);
    if (height > 0) return height;
  } catch {
    // Police sans glyphe « H » : on retombe sur le ratio classique.
  }

  return font.unitsPerEm * 0.7;
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

export const fontLoader = new FontLoaderService();
