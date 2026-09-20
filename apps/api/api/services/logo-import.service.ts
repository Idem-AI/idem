import sharp from 'sharp';
import { optimize, Config as SvgoConfig } from 'svgo';
// potrace loaded lazily — API starts even if the package is absent
import logger from '../config/logger';

// file-type v16+ is ESM-only and incompatible with ts-node CJS.
// Using inline magic bytes detection instead.
function detectMimeFromMagicBytes(buffer: Buffer): string | null {
  if (buffer.length < 4) return null;
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47)
    return 'image/png';
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)
    return 'image/jpeg';
  // WebP: RIFF????WEBP
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) return 'image/webp';
  // GIF: GIF87a or GIF89a
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38)
    return 'image/gif';
  return null;
}

/**
 * Supported MIME types for logo import
 */
const SUPPORTED_MIME_TYPES = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp'];

/**
 * Maximum file size in bytes (10MB)
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Maximum dimension for raster images before vectorization
 */
const MAX_RASTER_DIMENSION = 2000;

/**
 * SVGO optimization configuration
 */
const SVGO_CONFIG: SvgoConfig = {
  multipass: true,
  plugins: [
    'removeMetadata',
    'removeDimensions',
    // Les exports Illustrator/Inkscape — le format le plus courant pour un
    // logo — portent leurs couleurs dans un bloc <style> et une `class` sur
    // chaque forme. `removeAttrs` ci-dessous retire les classes : sans ces
    // trois passes qui replient le CSS dans les attributs, les fills partent
    // avec elles et le logo ressort ENTIÈREMENT NOIR.
    'inlineStyles',
    'minifyStyles',
    'convertStyleToAttrs',
    'mergePaths',
    'convertPathData',
    'cleanupIds',
    'removeComments',
    'removeEditorsNSData',
    'removeEmptyContainers',
    'removeEmptyText',
    'removeHiddenElems',
    'removeUselessDefs',
    {
      name: 'removeAttrs',
      params: {
        attrs: ['data-.*', 'class'],
      },
    },
  ],
};

/**
 * Result of logo import processing
 */
export interface LogoImportResult {
  success: boolean;
  svg: string;
  width: number;
  height: number;
  extractedColors: string[];
}

/**
 * Detects the real MIME type of a file buffer using magic bytes.
 * Falls back to checking for SVG XML content if file-type returns undefined.
 */
async function detectMimeType(buffer: Buffer): Promise<string | null> {
  const mime = detectMimeFromMagicBytes(buffer);
  if (mime) return mime;

  // SVG is text-based — no magic bytes, check content instead
  const head = buffer.slice(0, 512).toString('utf-8').trim();
  if (head.startsWith('<svg') || head.startsWith('<?xml') || head.includes('<svg')) {
    return 'image/svg+xml';
  }

  return null;
}

/**
 * Strips potentially dangerous elements from SVG content (scripts, event handlers, etc.)
 */
function sanitizeSvg(svgContent: string): string {
  // Remove <script> tags
  let sanitized = svgContent.replace(/<script[\s\S]*?<\/script>/gi, '');

  // Remove on* event handler attributes
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');

  // Remove javascript: URIs
  sanitized = sanitized.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, '');
  sanitized = sanitized.replace(/xlink:href\s*=\s*["']javascript:[^"']*["']/gi, '');

  // Remove <foreignObject> tags (can embed HTML/JS)
  sanitized = sanitized.replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '');

  // Remove <use> with external references (potential SSRF)
  sanitized = sanitized.replace(/<use[^>]*href\s*=\s*["']https?:\/\/[^"']*["'][^>]*\/?>/gi, '');

  return sanitized;
}

/**
 * Extracts width and height from SVG content via viewBox or width/height attributes.
 */
function extractSvgDimensions(svgContent: string): { width: number; height: number } {
  // Try viewBox first
  const viewBoxMatch = svgContent.match(/viewBox\s*=\s*["']([^"']+)["']/);
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1].trim().split(/[\s,]+/);
    if (parts.length === 4) {
      return {
        width: Math.round(parseFloat(parts[2])),
        height: Math.round(parseFloat(parts[3])),
      };
    }
  }

  // Fallback to width/height attributes
  const widthMatch = svgContent.match(/\bwidth\s*=\s*["'](\d+(?:\.\d+)?)/);
  const heightMatch = svgContent.match(/\bheight\s*=\s*["'](\d+(?:\.\d+)?)/);

  return {
    width: widthMatch ? Math.round(parseFloat(widthMatch[1])) : 300,
    height: heightMatch ? Math.round(parseFloat(heightMatch[1])) : 300,
  };
}

/**
 * Processes an SVG buffer: sanitize + optimize with SVGO.
 */
async function processSvg(buffer: Buffer): Promise<LogoImportResult> {
  let svgContent = buffer.toString('utf-8');

  // Sanitize SVG (remove scripts, event handlers, etc.)
  svgContent = sanitizeSvg(svgContent);

  // Optimize with SVGO
  const optimized = optimize(svgContent, SVGO_CONFIG);
  const optimizedSvg = optimized.data;

  const dimensions = extractSvgDimensions(optimizedSvg);

  // Extract colors from the optimized SVG. Quand l'analyse textuelle ne voit
  // rien (dégradé, motif, `currentColor`), on MESURE la palette sur le rendu
  // avant de se rabattre sur un quasi-noir : c'est la différence entre un logo
  // dont on a lu les couleurs et un logo déclaré noir faute de les avoir lues.
  let extractedColors = extractColorsFromSvg(optimizedSvg);
  if (extractedColors.length === 0) {
    extractedColors = await extractColorsFromRenderedSvg(optimizedSvg);
  }
  if (extractedColors.length === 0) {
    // Logo réellement monochrome : un quasi-noir riche, jamais #000000.
    extractedColors.push('#1a1a2e');
  }

  return {
    success: true,
    svg: optimizedSvg,
    width: dimensions.width,
    height: dimensions.height,
    extractedColors,
  };
}

/**
 * Extracts dominant colors from a raster image buffer using sharp's stats.
 * Returns an array of hex color strings sorted by dominance.
 */
async function extractColorsFromRasterImage(buffer: Buffer): Promise<string[]> {
  try {
    // Resize to small size for faster color analysis.
    // `ensureAlpha` (et NON `removeAlpha`) : sur un PNG détouré, retirer le
    // canal alpha laisse les pixels transparents à leur RVB stocké, qui vaut
    // presque toujours (0,0,0). Ils étaient donc comptés comme du noir, et un
    // logo sur fond transparent ressortait noir.
    const smallBuffer = await sharp(buffer)
      .resize(100, 100, { fit: 'inside', withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { data, info } = smallBuffer;
    const colorCounts = new Map<string, number>();

    // Sample pixels and count color occurrences
    for (let i = 0; i < data.length; i += info.channels) {
      if (info.channels === 4 && data[i + 3] < 128) continue;

      // Quantize to reduce noise (round to nearest 16).
      // Le hex passe par `rgbToHex`, qui BORNE à 255 : écrit à la main,
      // `Math.round(255 / 16) * 16` vaut 256, s'écrivait "100" et donnait un
      // hex de 7 chiffres (#100a000 pour un orange #ff9900). Relu par tranches
      // de deux, il devenait #100a00 — un quasi-noir, aussitôt écarté par le
      // filtre. Toute couleur ayant un canal ≥ 248 disparaissait ainsi, et le
      // repli `#000000` devenait la couleur « extraite » du logo.
      const hex = rgbToHex(
        Math.round(data[i] / 16) * 16,
        Math.round(data[i + 1] / 16) * 16,
        Math.round(data[i + 2] / 16) * 16
      );
      colorCounts.set(hex, (colorCounts.get(hex) || 0) + 1);
    }

    return Array.from(colorCounts.entries())
      .filter(([color]) => isBrandColor(color))
      .sort((a, b) => b[1] - a[1])
      .map(([color]) => color)
      .slice(0, 10);
  } catch (error) {
    logger.error('Error extracting colors from raster image:', error);
    return [];
  }
}

/**
 * Une couleur de marque, par opposition à un neutre.
 *
 * L'ancien test était une bande de luminance (30 < lum < 230) : il jetait le
 * bleu nuit d'une marque institutionnelle comme le jaune pâle d'une autre, et
 * laissait passer n'importe quel gris moyen. On teste la SATURATION : un noir,
 * un blanc et un gris en sont dépourvus quelle que soit leur clarté ; une
 * couleur de marque en a.
 */
function isBrandColor(hex: string): boolean {
  const rgb = hexToRgbTriplet(hex);
  if (!rgb) return false;

  const max = Math.max(rgb.r, rgb.g, rgb.b);
  const min = Math.min(rgb.r, rgb.g, rgb.b);
  const saturation = max === 0 ? 0 : (max - min) / max;

  if (saturation < 0.12) return false; // neutre
  return max >= 24 && min <= 248; // ni noyé dans le noir, ni délavé dans le blanc
}

/**
 * Parse un hexadécimal à 6 chiffres. Retourne null sur toute autre forme —
 * volontairement strict : c'est ce qui fait remonter un hex malformé au lieu
 * de le laisser se faire relire comme une couleur plausible.
 */
function hexToRgbTriplet(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!match) return null;
  const value = parseInt(match[1], 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

/**
 * Palette d'un SVG mesurée sur son RENDU plutôt que sur son texte.
 *
 * Repli de `extractColorsFromSvg` : il rattrape les couleurs qu'aucune analyse
 * textuelle ne voit — dégradés, motifs, `currentColor`, CSS exotique.
 */
async function extractColorsFromRenderedSvg(svgContent: string): Promise<string[]> {
  try {
    const rendered = await sharp(Buffer.from(svgContent, 'utf-8'), { density: 150 })
      .resize(200, 200, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
    return await extractColorsFromRasterImage(rendered);
  } catch (error) {
    logger.warn(`Could not rasterize SVG for color extraction: ${(error as Error).message}`);
    return [];
  }
}

/**
 * Maximum dimension used for color-layer tracing (kept lower than
 * MAX_RASTER_DIMENSION: one trace per color layer)
 */
const MAX_TRACE_DIMENSION = 1000;

/**
 * Maximum number of color layers traced for a multicolor logo
 */
const MAX_COLOR_LAYERS = 6;

/**
 * Minimum share of opaque foreground pixels a color must cover to get its own layer
 */
const MIN_LAYER_SHARE = 0.02;

interface ColorCluster {
  r: number;
  g: number;
  b: number;
  hex: string;
  count: number;
}

function clusterDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

/**
 * Detects the background color by sampling the four corners of the image.
 * Returns null when corners are transparent or inconsistent (no flat background).
 */
function detectBackgroundColor(
  data: Buffer,
  width: number,
  height: number,
  channels: number
): { r: number; g: number; b: number } | null {
  const cornerIdx = [
    0,
    (width - 1) * channels,
    (height - 1) * width * channels,
    ((height - 1) * width + width - 1) * channels,
  ];

  const corners: { r: number; g: number; b: number }[] = [];
  for (const idx of cornerIdx) {
    const alpha = channels === 4 ? data[idx + 3] : 255;
    if (alpha < 128) return null; // transparent background — nothing to strip
    corners.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
  }

  const avg = {
    r: Math.round(corners.reduce((s, c) => s + c.r, 0) / 4),
    g: Math.round(corners.reduce((s, c) => s + c.g, 0) / 4),
    b: Math.round(corners.reduce((s, c) => s + c.b, 0) / 4),
  };

  // Corners must agree with each other to be considered a flat background
  const consistent = corners.every((c) => clusterDistance(c.r, c.g, c.b, avg.r, avg.g, avg.b) < 30);
  return consistent ? avg : null;
}

/**
 * Quantizes the opaque, non-background pixels of an image into a small palette.
 * Clusters are merged when perceptually close, sorted by coverage (largest first).
 */
function quantizeImagePalette(
  data: Buffer,
  width: number,
  height: number,
  channels: number
): { clusters: ColorCluster[]; background: { r: number; g: number; b: number } | null } {
  const background = detectBackgroundColor(data, width, height, channels);
  const counts = new Map<string, ColorCluster>();
  let foregroundPixels = 0;

  for (let i = 0; i < data.length; i += channels) {
    const alpha = channels === 4 ? data[i + 3] : 255;
    if (alpha < 128) continue;

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    if (background && clusterDistance(r, g, b, background.r, background.g, background.b) < 40) {
      continue;
    }
    foregroundPixels++;

    // Quantize to /32 buckets to absorb anti-aliasing noise
    const qr = Math.min(255, Math.round(r / 32) * 32);
    const qg = Math.min(255, Math.round(g / 32) * 32);
    const qb = Math.min(255, Math.round(b / 32) * 32);
    const key = `${qr},${qg},${qb}`;

    const existing = counts.get(key);
    if (existing) {
      existing.count++;
    } else {
      counts.set(key, { r: qr, g: qg, b: qb, hex: rgbToHex(qr, qg, qb), count: 1 });
    }
  }

  if (foregroundPixels === 0) {
    return { clusters: [], background };
  }

  // Merge clusters that are perceptually close (weighted average)
  const sorted = Array.from(counts.values()).sort((a, b) => b.count - a.count);
  const merged: ColorCluster[] = [];
  for (const cluster of sorted) {
    const target = merged.find(
      (m) => clusterDistance(m.r, m.g, m.b, cluster.r, cluster.g, cluster.b) < 48
    );
    if (target) {
      const total = target.count + cluster.count;
      target.r = Math.round((target.r * target.count + cluster.r * cluster.count) / total);
      target.g = Math.round((target.g * target.count + cluster.g * cluster.count) / total);
      target.b = Math.round((target.b * target.count + cluster.b * cluster.count) / total);
      target.hex = rgbToHex(target.r, target.g, target.b);
      target.count = total;
    } else {
      merged.push({ ...cluster });
    }
  }

  const clusters = merged
    .filter((c) => c.count / foregroundPixels >= MIN_LAYER_SHARE)
    .slice(0, MAX_COLOR_LAYERS);

  // Refinement pass: replace quantized bucket colors with the true average of
  // the pixels assigned to each cluster (recovers exact brand colors)
  if (clusters.length > 0) {
    const sums = clusters.map(() => ({ r: 0, g: 0, b: 0, n: 0 }));
    for (let i = 0; i < data.length; i += channels) {
      const alpha = channels === 4 ? data[i + 3] : 255;
      if (alpha < 128) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (background && clusterDistance(r, g, b, background.r, background.g, background.b) < 40) {
        continue;
      }
      let nearest = 0;
      let nearestDist = Infinity;
      for (let c = 0; c < clusters.length; c++) {
        const d = clusterDistance(r, g, b, clusters[c].r, clusters[c].g, clusters[c].b);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = c;
        }
      }
      sums[nearest].r += r;
      sums[nearest].g += g;
      sums[nearest].b += b;
      sums[nearest].n++;
    }
    for (let c = 0; c < clusters.length; c++) {
      if (sums[c].n > 0) {
        clusters[c].r = Math.round(sums[c].r / sums[c].n);
        clusters[c].g = Math.round(sums[c].g / sums[c].n);
        clusters[c].b = Math.round(sums[c].b / sums[c].n);
        clusters[c].hex = rgbToHex(clusters[c].r, clusters[c].g, clusters[c].b);
      }
    }
  }

  return { clusters, background };
}

/**
 * Builds a black-on-white binary mask PNG for one color cluster:
 * a pixel is black when its nearest cluster is the target one.
 */
async function buildClusterMask(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
  clusters: ColorCluster[],
  targetIndex: number,
  background: { r: number; g: number; b: number } | null
): Promise<Buffer> {
  const mask = Buffer.alloc(width * height, 255);

  for (let p = 0, i = 0; i < data.length; i += channels, p++) {
    const alpha = channels === 4 ? data[i + 3] : 255;
    if (alpha < 128) continue;

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    if (background && clusterDistance(r, g, b, background.r, background.g, background.b) < 40) {
      continue;
    }

    let nearest = 0;
    let nearestDist = Infinity;
    for (let c = 0; c < clusters.length; c++) {
      const d = clusterDistance(r, g, b, clusters[c].r, clusters[c].g, clusters[c].b);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = c;
      }
    }

    if (nearest === targetIndex) {
      mask[p] = 0;
    }
  }

  return sharp(mask, { raw: { width, height, channels: 1 } }).png().toBuffer();
}

/**
 * Traces a binary mask with potrace and returns the <path> elements
 * recolored with the given hex color.
 */
async function traceMaskToPaths(maskPng: Buffer, colorHex: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const potrace = require('potrace');

  const svg = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Potrace vectorization timed out after 30 seconds'));
    }, 30000);

    potrace.trace(
      maskPng,
      {
        turdSize: 2,
        optTolerance: 0.2,
        color: colorHex,
        background: 'transparent',
      },
      (err: Error | null, out: string) => {
        clearTimeout(timeout);
        if (err) reject(err);
        else resolve(out);
      }
    );
  });

  const paths = svg.match(/<path[^>]*\/?>(<\/path>)?/g);
  return paths ? paths.join('') : '';
}

/**
 * Résultat d'une vectorisation par couches de couleur.
 *
 * `clusters` est rendu MÊME quand `result` est null : la palette mesurée sur
 * l'image d'origine est le travail le plus fiable de tout ce fichier, et
 * l'ancienne version la jetait en sortant, obligeant le repli à la redécouvrir
 * par un chemin plus fragile.
 */
interface RasterVectorization {
  result: LogoImportResult | null;
  clusters: ColorCluster[];
}

/**
 * Vectorizes a raster logo preserving its colors:
 * quantize palette → binary mask per color → potrace per layer → stacked SVG.
 * Returns result=null only when no color layer could be measured or traced
 * (caller falls back to the classic grayscale single-color trace).
 */
async function vectorizeMulticolor(buffer: Buffer): Promise<RasterVectorization> {
  const { data, info } = await sharp(buffer)
    .resize(MAX_TRACE_DIMENSION, MAX_TRACE_DIMENSION, { fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const { clusters, background } = quantizeImagePalette(data, width, height, channels);

  if (clusters.length === 0) {
    logger.info('Layered vectorization skipped: no color cluster detected, using grayscale trace');
    return { result: null, clusters };
  }

  // Un seul cluster passe ici aussi, désormais. Le repli en niveaux de gris
  // reconstruisait la forme à partir de la LUMINANCE, ce qui traite un fond
  // transparent comme du noir et perd la couleur exacte ; le masque par
  // cluster, lui, s'appuie sur l'alpha et repeint avec la couleur mesurée.
  logger.info(
    `Layered vectorization: ${clusters.length} layer(s) - ${clusters.map((c) => c.hex).join(', ')}`
  );

  // Trace every color layer in parallel; layers are stacked largest-coverage first
  const layerPaths = await Promise.all(
    clusters.map(async (cluster, index) => {
      const mask = await buildClusterMask(data, width, height, channels, clusters, index, background);
      return traceMaskToPaths(mask, cluster.hex);
    })
  );

  const combinedPaths = layerPaths.filter((p) => p.length > 0).join('');
  if (!combinedPaths) {
    logger.warn('Layered vectorization produced no paths, falling back to grayscale trace');
    return { result: null, clusters };
  }

  const rawSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${combinedPaths}</svg>`;
  const optimized = optimize(rawSvg, SVGO_CONFIG);
  const optimizedSvg = optimized.data;

  // Les neutres sont écartés des SUGGESTIONS de marque, jamais du tracé : un
  // logo garde son encre noire, il ne la propose simplement pas comme couleur
  // de marque. S'il n'a que des neutres, on rend quand même sa palette réelle.
  const brandColors = clusters.map((c) => c.hex).filter(isBrandColor);

  return {
    result: {
      success: true,
      svg: optimizedSvg,
      width,
      height,
      extractedColors: brandColors.length > 0 ? brandColors : clusters.map((c) => c.hex),
    },
    clusters,
  };
}

/**
 * Processes a raster image (PNG/JPG/WebP):
 * 1. Try color-preserving multicolor vectorization (one potrace layer per color)
 * 2. Fallback — single-color trace:
 *    a. Extract colors from the original image BEFORE grayscale conversion
 *    b. Resize + grayscale + normalize for vectorization
 *    c. Vectorize with potrace, recolored with the dominant extracted color
 * 3. Optimize resulting SVG with SVGO
 */
async function processRasterImage(buffer: Buffer): Promise<LogoImportResult> {
  let measuredColors: string[] = [];

  try {
    const { result, clusters } = await vectorizeMulticolor(buffer);
    if (result) {
      return result;
    }
    measuredColors = clusters.map((c) => c.hex);
  } catch (error) {
    logger.warn(
      `Layered vectorization failed, falling back to grayscale trace: ${(error as Error).message}`
    );
  }

  return processSingleColorRaster(buffer, measuredColors);
}

/**
 * Legacy single-color raster vectorization (grayscale + potrace, dominant color).
 *
 * @param measuredColors Palette déjà mesurée par la vectorisation en couches,
 *   quand elle a eu lieu. La recalculer sur un autre chemin donnerait une autre
 *   réponse pour la même image.
 */
async function processSingleColorRaster(
  buffer: Buffer,
  measuredColors: string[] = []
): Promise<LogoImportResult> {
  // Step 1: Extract colors from the ORIGINAL image (before grayscale)
  const extractedColors =
    measuredColors.length > 0 ? measuredColors : await extractColorsFromRasterImage(buffer);

  // Le repli n'est plus #000000. Il posait du noir sur un logo dont on n'avait
  // pas su lire les couleurs — le tracé ET la couleur de marque proposée
  // devenaient noirs alors que le logo ne contenait pas de noir.
  const dominantColor =
    extractedColors.find(isBrandColor) ?? extractedColors[0] ?? '#1a1a2e';

  logger.info(
    `Raster logo import: extracted ${extractedColors.length} colors, dominant: ${dominantColor}`
  );

  // Step 2: Pre-process with sharp for vectorization
  const preprocessed = await sharp(buffer)
    .resize(MAX_RASTER_DIMENSION, MAX_RASTER_DIMENSION, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .grayscale()
    .normalize()
    .png()
    .toBuffer();

  // Get dimensions after resize
  const metadata = await sharp(preprocessed).metadata();
  const width = metadata.width || 300;
  const height = metadata.height || 300;

  // Step 3: Vectorize with potrace — load lazily to avoid crash if not installed
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  let potrace: typeof import('potrace');
  try {
    potrace = require('potrace');
  } catch {
    throw new Error('potrace is not installed. Run `npm install potrace` in the api package and rebuild the Docker image.');
  }
  const svgContent = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Potrace vectorization timed out after 30 seconds'));
    }, 30000);

    potrace.trace(
      preprocessed,
      {
        turdSize: 2,
        optTolerance: 0.2,
        color: dominantColor,
        background: 'transparent',
      },
      (err: Error | null, svg: string) => {
        clearTimeout(timeout);
        if (err) {
          reject(err);
        } else {
          resolve(svg);
        }
      }
    );
  });

  if (!svgContent || svgContent.trim().length === 0) {
    throw new Error('Vectorization produced empty SVG output');
  }

  // Step 4: Optimize the resulting SVG with SVGO
  const optimized = optimize(svgContent, SVGO_CONFIG);
  const optimizedSvg = optimized.data;

  const dimensions = extractSvgDimensions(optimizedSvg);

  return {
    success: true,
    svg: optimizedSvg,
    width: dimensions.width || width,
    height: dimensions.height || height,
    // Logo entièrement noir/blanc : garantir au moins une couleur exploitable
    extractedColors: extractedColors.length > 0 ? extractedColors : [dominantColor],
  };
}

/**
 * Main entry point: processes an uploaded logo file buffer.
 * Detects type, validates, and routes to the appropriate processor.
 */
export async function processLogoImport(
  buffer: Buffer,
  originalName: string
): Promise<LogoImportResult> {
  // Validate buffer is not empty
  if (!buffer || buffer.length === 0) {
    throw new Error('Uploaded file is empty');
  }

  // Validate file size
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
  }

  // Detect real MIME type
  const mimeType = await detectMimeType(buffer);
  logger.info(`Logo import: detected MIME type "${mimeType}" for file "${originalName}"`);

  if (!mimeType || !SUPPORTED_MIME_TYPES.includes(mimeType)) {
    throw new Error(
      `Unsupported file format "${mimeType || 'unknown'}". Supported formats: SVG, PNG, JPG, WebP`
    );
  }

  // Route to the appropriate processor
  if (mimeType === 'image/svg+xml') {
    return processSvg(buffer);
  }

  return processRasterImage(buffer);
}

/**
 * Extracts unique hex color codes from SVG content.
 * Parses fill, stroke, stop-color attributes and inline style colors.
 * Filters out common non-brand colors (black, white, none, transparent).
 */
export function extractColorsFromSvg(svgContent: string): string[] {
  if (!svgContent || svgContent.trim().length === 0) {
    return [];
  }

  const hexColors = new Set<string>();

  // Match hex colors in attributes: fill="#abc123", stroke="#abc", stop-color="#aabbcc"
  const hexAttrRegex = /(?:fill|stroke|stop-color|color)\s*=\s*["']#([0-9a-fA-F]{3,8})["']/gi;
  let match: RegExpExecArray | null;
  const addHex = (raw: string) => {
    const normalized = normalizeHex(raw);
    if (normalized) hexColors.add(normalized);
  };
  while ((match = hexAttrRegex.exec(svgContent)) !== null) {
    addHex(match[1]);
  }

  // Match hex colors in inline styles: fill:#abc123; stroke:#abc; color:#aabbcc
  const hexStyleRegex = /(?:fill|stroke|stop-color|color)\s*:\s*#([0-9a-fA-F]{3,8})/gi;
  while ((match = hexStyleRegex.exec(svgContent)) !== null) {
    addHex(match[1]);
  }

  // Match rgb() colors in attributes and styles
  const rgbRegex =
    /(?:fill|stroke|stop-color|color)\s*[:=]\s*["']?\s*rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/gi;
  while ((match = rgbRegex.exec(svgContent)) !== null) {
    const r = parseInt(match[1], 10);
    const g = parseInt(match[2], 10);
    const b = parseInt(match[3], 10);
    hexColors.add(rgbToHex(r, g, b));
  }

  // Filter out non-brand colors. `isBrandColor` remplace la liste noire de
  // quinze valeurs qui laissait passer tout gris absent de la liste et jetait
  // #111 comme #ccc sans distinguer un charbon de marque d'un gris d'interface.
  const filtered = Array.from(hexColors).filter(isBrandColor);

  // Sort by frequency of appearance (most used first).
  // On compte les DEUX notations : SVGO réécrit #ff9900 en #f90, et ne
  // chercher que la forme longue rendait la couleur dominante introuvable —
  // elle tombait à zéro occurrence et passait DERRIÈRE une couleur
  // d'appoint. Or c'est `extractedColors[0]` qui devient la couleur primaire
  // de la charte en aval.
  const colorCounts = new Map<string, number>();
  for (const color of filtered) {
    const long = color.slice(1);
    const short =
      long[0] === long[1] && long[2] === long[3] && long[4] === long[5]
        ? long[0] + long[2] + long[4]
        : null;
    const pattern = short ? `${long}|${short}\\b` : long;
    const occurrences = (svgContent.match(new RegExp(pattern, 'gi')) || []).length;
    colorCounts.set(color, occurrences);
  }

  return filtered.sort((a, b) => (colorCounts.get(b) || 0) - (colorCounts.get(a) || 0));
}

/**
 * Normalizes a hex color string to 6-digit lowercase format with # prefix.
 */
function normalizeHex(hex: string): string {
  let h = hex.toLowerCase();
  // Expand 3- and 4-digit hex (#rgb / #rgba) to 6-digit
  if (h.length === 3 || h.length === 4) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  // Strip alpha channel if 8-digit
  if (h.length === 8) {
    h = h.substring(0, 6);
  }
  // Toute autre longueur (5, 7) est un hex malformé : le laisser passer, c'est
  // le voir relu par tranches de deux et devenir une couleur qui n'existe pas.
  return h.length === 6 ? `#${h}` : '';
}

/**
 * Converts RGB values to hex string.
 */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Logo variation generation now lives in logoVariationEngine.service.ts
// (hybrid engine: OKLCH transforms + rendered QA + optional AI recolor fallback)

/**
 * Resolves SVG content from either inline markup or a stored URL (e.g. MinIO).
 * The frontend stores the MinIO URL in logo.svg when the upload succeeded, so
 * any server-side consumer of that field must handle both forms.
 */
export async function resolveSvgContent(svgOrUrl: string): Promise<string> {
  const value = (svgOrUrl || '').trim();

  if (/^https?:\/\//i.test(value)) {
    logger.info(`Resolving SVG content from URL`);
    const axios = (await import('axios')).default;
    const response = await axios.get(value, {
      responseType: 'text',
      timeout: 15000,
      maxContentLength: 5 * 1024 * 1024,
    });
    const fetched = String(response.data);
    if (!fetched.includes('<svg')) {
      throw new Error('Fetched content is not a valid SVG');
    }
    return fetched;
  }

  if (!value.includes('<svg')) {
    throw new Error('The provided content is not a valid SVG');
  }
  return value;
}

/**
 * Converts an SVG string to a PNG buffer using sharp.
 */
export async function convertSvgToPng(
  svgContent: string,
  width?: number,
  height?: number
): Promise<Buffer> {
  if (!svgContent || svgContent.trim().length === 0) {
    throw new Error('SVG content is empty');
  }

  const svgBuffer = Buffer.from(svgContent, 'utf-8');

  let pipeline = sharp(svgBuffer);

  if (width || height) {
    pipeline = pipeline.resize(width, height, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
  }

  return pipeline.png().toBuffer();
}
