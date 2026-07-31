import axios from 'axios';
import * as opentype from 'opentype.js';
import logger from '../../../config/logger';
import { cacheService } from '../../cache.service';

/**
 * Charge le VRAI fichier de police choisi par l'utilisateur (Google Fonts) et
 * l'expose parsé, avec ses métriques réelles.
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
  async load(family: string, weight = 700): Promise<LoadedFont | null> {
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

    const task = this.resolve(normalizedFamily, normalizedWeight, key).finally(() => {
      this.inFlight.delete(key);
    });
    this.inFlight.set(key, task);
    return task;
  }

  private async resolve(
    family: string,
    weight: number,
    key: string
  ): Promise<LoadedFont | null> {
    try {
      const buffer = await this.fetchFontBinary(family, weight);
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

  /** Redis d'abord (partagé entre instances), Google ensuite. */
  private async fetchFontBinary(family: string, weight: number): Promise<Buffer | null> {
    const cacheKey = `${family.toLowerCase().replace(/\s+/g, '-')}-${weight}`;

    const cached = await cacheService
      .get<string>(cacheKey, { prefix: FONT_CACHE_PREFIX })
      .catch(() => null);
    if (cached) {
      return Buffer.from(cached, 'base64');
    }

    const fileUrl = await this.resolveFontFileUrl(family, weight);
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
   * Interroge l'API CSS de Google et extrait l'URL du .ttf. La graisse demandée
   * peut ne pas exister dans la famille : on retombe sur les graisses voisines,
   * puis sur la famille sans contrainte de graisse.
   */
  private async resolveFontFileUrl(family: string, weight: number): Promise<string | null> {
    const encodedFamily = encodeURIComponent(family).replace(/%20/g, '+');
    const candidates = [
      ...new Set([weight, ...WEIGHT_FALLBACKS]),
    ].map((candidate) => `${GOOGLE_FONTS_CSS_API}?family=${encodedFamily}:wght@${candidate}`);
    candidates.push(`${GOOGLE_FONTS_CSS_API}?family=${encodedFamily}`);

    for (const url of candidates) {
      try {
        const response = await axios.get<string>(url, {
          timeout: REQUEST_TIMEOUT_MS,
          responseType: 'text',
          headers: { 'User-Agent': NEUTRAL_UA },
        });
        const fileUrl = extractTtfUrl(String(response.data));
        if (fileUrl) return fileUrl;
      } catch {
        // 400/404 = cette graisse n'existe pas dans la famille : on continue.
      }
    }

    logger.warn(`No downloadable TTF found on Google Fonts for "${family}"`);
    return null;
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

/** `src: url(https://…ttf) format('truetype')` → l'URL. */
function extractTtfUrl(css: string): string | null {
  const match = css.match(/url\((https:\/\/[^)]+\.ttf)\)/i);
  return match ? match[1] : null;
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
