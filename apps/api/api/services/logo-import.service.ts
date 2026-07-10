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

  // Extract colors from the optimized SVG. A logo made only of black/white/gray
  // has every color filtered as non-brand — fall back to a rich near-black so
  // the workflow always has at least one usable primary color.
  const extractedColors = extractColorsFromSvg(optimizedSvg);
  if (extractedColors.length === 0) {
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
    // Resize to small size for faster color analysis
    const smallBuffer = await sharp(buffer)
      .resize(100, 100, { fit: 'inside', withoutEnlargement: true })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { data, info } = smallBuffer;
    const colorCounts = new Map<string, number>();

    // Sample pixels and count color occurrences
    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Quantize to reduce noise (round to nearest 16)
      const qr = Math.round(r / 16) * 16;
      const qg = Math.round(g / 16) * 16;
      const qb = Math.round(b / 16) * 16;

      const hex = `#${qr.toString(16).padStart(2, '0')}${qg.toString(16).padStart(2, '0')}${qb.toString(16).padStart(2, '0')}`;
      colorCounts.set(hex, (colorCounts.get(hex) || 0) + 1);
    }

    // Filter out near-black and near-white, sort by frequency
    const NON_BRAND = new Set(['#000000', '#101010', '#f0f0f0', '#ffffff']);
    const sorted = Array.from(colorCounts.entries())
      .filter(([color]) => {
        if (NON_BRAND.has(color)) return false;
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        return lum > 30 && lum < 230; // skip near-black and near-white
      })
      .sort((a, b) => b[1] - a[1])
      .map(([color]) => color);

    return sorted.slice(0, 10);
  } catch (error) {
    logger.error('Error extracting colors from raster image:', error);
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
 * Vectorizes a raster logo preserving its colors:
 * quantize palette → binary mask per color → potrace per layer → stacked SVG.
 * Returns null when the image is effectively single-colored (caller falls back
 * to the classic single-color trace).
 */
async function vectorizeMulticolor(buffer: Buffer): Promise<LogoImportResult | null> {
  const { data, info } = await sharp(buffer)
    .resize(MAX_TRACE_DIMENSION, MAX_TRACE_DIMENSION, { fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const { clusters, background } = quantizeImagePalette(data, width, height, channels);

  if (clusters.length < 2) {
    logger.info(
      `Multicolor vectorization skipped: ${clusters.length} color cluster(s) detected, using single-color trace`
    );
    return null;
  }

  logger.info(
    `Multicolor vectorization: ${clusters.length} layers - ${clusters.map((c) => c.hex).join(', ')}`
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
    logger.warn('Multicolor vectorization produced no paths, falling back to single-color trace');
    return null;
  }

  const rawSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${combinedPaths}</svg>`;
  const optimized = optimize(rawSvg, SVGO_CONFIG);
  const optimizedSvg = optimized.data;

  // Filter near-black/near-white for the brand color suggestions, like the raster extractor
  const extractedColors = clusters
    .map((c) => c.hex)
    .filter((hex) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      return lum > 30 && lum < 230;
    });

  return {
    success: true,
    svg: optimizedSvg,
    width,
    height,
    extractedColors: extractedColors.length > 0 ? extractedColors : clusters.map((c) => c.hex),
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
  try {
    const multicolor = await vectorizeMulticolor(buffer);
    if (multicolor) {
      return multicolor;
    }
  } catch (error) {
    logger.warn(
      `Multicolor vectorization failed, falling back to single-color trace: ${(error as Error).message}`
    );
  }
  return processSingleColorRaster(buffer);
}

/**
 * Legacy single-color raster vectorization (grayscale + potrace, dominant color).
 */
async function processSingleColorRaster(buffer: Buffer): Promise<LogoImportResult> {
  // Step 1: Extract colors from the ORIGINAL image (before grayscale)
  const extractedColors = await extractColorsFromRasterImage(buffer);
  const dominantColor = extractedColors.length > 0 ? extractedColors[0] : '#000000';

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
  while ((match = hexAttrRegex.exec(svgContent)) !== null) {
    hexColors.add(normalizeHex(match[1]));
  }

  // Match hex colors in inline styles: fill:#abc123; stroke:#abc; color:#aabbcc
  const hexStyleRegex = /(?:fill|stroke|stop-color|color)\s*:\s*#([0-9a-fA-F]{3,8})/gi;
  while ((match = hexStyleRegex.exec(svgContent)) !== null) {
    hexColors.add(normalizeHex(match[1]));
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

  // Filter out non-brand colors (pure black, pure white, near-black, near-white)
  const NON_BRAND_COLORS = new Set([
    '#000000',
    '#ffffff',
    '#000',
    '#fff',
    '#010101',
    '#020202',
    '#fefefe',
    '#fdfdfd',
    '#111111',
    '#222222',
    '#333333',
    '#eeeeee',
    '#dddddd',
    '#cccccc',
  ]);

  const filtered = Array.from(hexColors).filter((color) => {
    const lower = color.toLowerCase();
    return !NON_BRAND_COLORS.has(lower);
  });

  // Sort by frequency of appearance (most used first)
  const colorCounts = new Map<string, number>();
  for (const color of filtered) {
    const regex = new RegExp(color.replace('#', ''), 'gi');
    const occurrences = (svgContent.match(regex) || []).length;
    colorCounts.set(color, occurrences);
  }

  return filtered.sort((a, b) => (colorCounts.get(b) || 0) - (colorCounts.get(a) || 0));
}

/**
 * Normalizes a hex color string to 6-digit lowercase format with # prefix.
 */
function normalizeHex(hex: string): string {
  let h = hex.toLowerCase();
  // Expand 3-digit hex to 6-digit
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  // Strip alpha channel if 8-digit
  if (h.length === 8) {
    h = h.substring(0, 6);
  }
  return `#${h}`;
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
