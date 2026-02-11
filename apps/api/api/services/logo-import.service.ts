import sharp from 'sharp';
import { optimize, Config as SvgoConfig } from 'svgo';
import * as potrace from 'potrace';
import { fromBuffer } from 'file-type';
import logger from '../config/logger';

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
  const result = await fromBuffer(buffer);
  if (result) {
    return result.mime;
  }

  // file-type cannot detect SVG (it's text-based), so check manually
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

  // Extract colors from the optimized SVG
  const extractedColors = extractColorsFromSvg(optimizedSvg);

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
 * Processes a raster image (PNG/JPG/WebP):
 * 1. Extract colors from the original image BEFORE grayscale conversion
 * 2. Resize + grayscale + normalize for vectorization
 * 3. Vectorize with potrace
 * 4. Recolor the vectorized SVG with the dominant extracted color
 * 5. Optimize resulting SVG with SVGO
 */
async function processRasterImage(buffer: Buffer): Promise<LogoImportResult> {
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

  // Step 3: Vectorize with potrace — use dominant color instead of black
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
    extractedColors,
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

/**
 * Generates logo variations (light background, dark background, monochrome) from an SVG.
 * For imported logos, we create programmatic color variations instead of using AI.
 */
export function generateLogoVariationsFromSvg(svgContent: string): {
  withText: {
    lightBackground: string;
    darkBackground: string;
    monochrome: string;
  };
  iconOnly: {
    lightBackground: string;
    darkBackground: string;
    monochrome: string;
  };
} {
  // Light background: keep original colors (logo is typically designed for light bg)
  const lightVariation = svgContent;

  // Dark background: invert dark fills to light, keep brand colors
  const darkVariation = createDarkBackgroundVariation(svgContent);

  // Monochrome: convert all colors to grayscale
  const monochromeVariation = createMonochromeVariation(svgContent);

  return {
    withText: {
      lightBackground: lightVariation,
      darkBackground: darkVariation,
      monochrome: monochromeVariation,
    },
    iconOnly: {
      lightBackground: lightVariation,
      darkBackground: darkVariation,
      monochrome: monochromeVariation,
    },
  };
}

/**
 * Creates a dark background variation by adjusting dark colors to light
 */
function createDarkBackgroundVariation(svg: string): string {
  let result = svg;

  // Replace very dark fills/strokes with white equivalents
  // Match hex colors in attributes
  result = result.replace(
    /((?:fill|stroke|stop-color|color)\s*=\s*["'])#([0-9a-fA-F]{3,6})(["'])/gi,
    (match, prefix, hex, suffix) => {
      const normalized = normalizeHexRaw(hex);
      const inverted = invertForDarkBg(normalized);
      return `${prefix}#${inverted}${suffix}`;
    }
  );

  // Match hex colors in inline styles
  result = result.replace(
    /((?:fill|stroke|stop-color|color)\s*:\s*)#([0-9a-fA-F]{3,6})/gi,
    (match, prefix, hex) => {
      const normalized = normalizeHexRaw(hex);
      const inverted = invertForDarkBg(normalized);
      return `${prefix}#${inverted}`;
    }
  );

  return result;
}

/**
 * Creates a monochrome variation by converting all colors to grayscale
 */
function createMonochromeVariation(svg: string): string {
  let result = svg;

  // Convert hex colors in attributes to grayscale
  result = result.replace(
    /((?:fill|stroke|stop-color|color)\s*=\s*["'])#([0-9a-fA-F]{3,6})(["'])/gi,
    (match, prefix, hex, suffix) => {
      const normalized = normalizeHexRaw(hex);
      const gray = toGrayscale(normalized);
      return `${prefix}#${gray}${suffix}`;
    }
  );

  // Convert hex colors in inline styles to grayscale
  result = result.replace(
    /((?:fill|stroke|stop-color|color)\s*:\s*)#([0-9a-fA-F]{3,6})/gi,
    (match, prefix, hex) => {
      const normalized = normalizeHexRaw(hex);
      const gray = toGrayscale(normalized);
      return `${prefix}#${gray}`;
    }
  );

  return result;
}

/**
 * Normalizes hex without # prefix
 */
function normalizeHexRaw(hex: string): string {
  let h = hex.toLowerCase();
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  if (h.length === 8) {
    h = h.substring(0, 6);
  }
  return h;
}

/**
 * Inverts dark colors for dark background usage.
 * Very dark colors become white, very light colors stay, mid-range colors lighten.
 */
function invertForDarkBg(hex6: string): string {
  const r = parseInt(hex6.slice(0, 2), 16);
  const g = parseInt(hex6.slice(2, 4), 16);
  const b = parseInt(hex6.slice(4, 6), 16);
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

  // Very dark colors (text, outlines) → make white
  if (luminance < 50) {
    return 'ffffff';
  }
  // Very light colors → make dark
  if (luminance > 220) {
    return '1a1a2e';
  }
  // Mid-range brand colors → lighten slightly for dark bg visibility
  const lighten = (v: number) => Math.min(255, Math.round(v + (255 - v) * 0.2));
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `${toHex(lighten(r))}${toHex(lighten(g))}${toHex(lighten(b))}`;
}

/**
 * Converts a hex color to grayscale
 */
function toGrayscale(hex6: string): string {
  const r = parseInt(hex6.slice(0, 2), 16);
  const g = parseInt(hex6.slice(2, 4), 16);
  const b = parseInt(hex6.slice(4, 6), 16);
  // Standard luminance formula
  const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  const h = gray.toString(16).padStart(2, '0');
  return `${h}${h}${h}`;
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
