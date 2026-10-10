/**
 * LIRE UNE CHARTE GRAPHIQUE DÉPOSÉE — un PDF de charte, une page de charte en image, ou un logo.
 *
 * Ce qui est ÉCRIT fait foi : les codes couleur (#hex, RGB, CMJN) et les noms de polices lus dans
 * le texte d'un PDF passent avant tout. Ce qui est VU complète : les couleurs dominantes de
 * l'image (pixels regroupés comme sur un site), et le modèle de vision dit si l'image est un logo,
 * une page de charte, ou une simple photo — et lit les noms qu'il voit (marque, polices).
 *
 * Les pages d'un PDF ne sont dessinées que si le module `canvas` est installé (dépendance
 * facultative de pdfjs-dist) ; sans lui, la lecture du texte suffit le plus souvent.
 */
import sharp from 'sharp';
import { BrandPalette, normalizeHex } from '../brand/brand-kit';
import { hexToOklch, oklchToHex } from '../design/color';
import logger from '../runtime/logger';
import { clusterColors, paletteFromClusters, paletteProposals, PaletteProposal, SeenColor } from './palette';
import { GOOGLE_FONTS, SeenFont, typographyProposals, TypographyProposal } from './typography';

export interface CharterRead {
  kind: 'logo' | 'guidelines' | 'photo';
  brandName?: string;
  palette: BrandPalette;
  palettes: PaletteProposal[];
  typographies: TypographyProposal[];
  /** Le logo, quand le fichier en est un (PNG transparent ou SVG gardé tel quel). */
  logo?: { buffer: Buffer; mimeType: 'image/png' | 'image/svg+xml' };
  /** Ce qui a été trouvé, pour le dire à l'utilisateur. */
  found: { colors: number; fonts: string[]; fromText: boolean };
  warnings: string[];
}

export type VisionPort = (base64: string, mimeType: string, instruction: string) => Promise<string>;

const ALL_FONTS = Object.values(GOOGLE_FONTS).flat();
/** Polices de bureau courantes, citées dans les chartes sans être sur Google Fonts. */
const DESKTOP_FONTS = ['Helvetica Neue', 'Helvetica', 'Arial', 'Futura', 'Avenir', 'Gotham', 'Proxima Nova', 'Gill Sans', 'Garamond', 'Times New Roman', 'Georgia', 'Calibri', 'Segoe UI', 'Myriad Pro', 'Frutiger', 'Univers', 'Didot', 'Bodoni', 'Century Gothic', 'Trebuchet MS', 'Verdana', 'Tahoma'];

const clampByte = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
const toHex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => clampByte(v).toString(16).padStart(2, '0')).join('')}`;

/** Les couleurs ÉCRITES dans un texte : #hex, rgb(…), « R 31 G 111 B 74 », CMJN en pourcentages. */
export function colorsInText(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) {
    const hex = normalizeHex(`#${m[1]}`);
    if (hex) out.push(hex);
  }
  for (const m of text.matchAll(/\brgb\s*\(?\s*(\d{1,3})\s*[,/ ]\s*(\d{1,3})\s*[,/ ]\s*(\d{1,3})/gi)) out.push(toHex(+m[1], +m[2], +m[3]));
  for (const m of text.matchAll(/\bR\s*:?\s*(\d{1,3})\s*[,;]?\s*G\s*:?\s*(\d{1,3})\s*[,;]?\s*B\s*:?\s*(\d{1,3})\b/g)) out.push(toHex(+m[1], +m[2], +m[3]));
  for (const m of text.matchAll(/\bC\s*:?\s*(\d{1,3})\s*%?\s*[,;]?\s*M\s*:?\s*(\d{1,3})\s*%?\s*[,;]?\s*[YJ]\s*:?\s*(\d{1,3})\s*%?\s*[,;]?\s*[KN]\s*:?\s*(\d{1,3})/g)) {
    const [c, mg, y, k] = [m[1], m[2], m[3], m[4]].map((v) => Math.min(100, +v) / 100);
    out.push(toHex(255 * (1 - c) * (1 - k), 255 * (1 - mg) * (1 - k), 255 * (1 - y) * (1 - k)));
  }
  return [...new Set(out)];
}

/** Les polices NOMMÉES dans un texte (Google Fonts, puis polices de bureau courantes). */
export function fontsInText(text: string): string[] {
  const found: { name: string; at: number }[] = [];
  for (const name of [...ALL_FONTS, ...DESKTOP_FONTS]) {
    const re = new RegExp(`(^|[^\\p{L}])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'iu');
    const m = re.exec(text);
    if (m) found.push({ name, at: m.index });
  }
  // L'ordre d'apparition : une charte présente d'abord la police des titres.
  return [...new Set(found.sort((a, b) => a.at - b.at).map((f) => f.name))].slice(0, 4);
}

/** Les couleurs dominantes d'une image (fond transparent ignoré), pesées par leur surface. */
async function seenColors(image: Buffer): Promise<SeenColor[]> {
  const { data, info } = await sharp(image).ensureAlpha().resize(96, 96, { fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
  const counts = new Map<string, number>();
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i + 3] < 128) continue;
    // Quantifiées par pas de 8 : les nuances d'anticrénelage rejoignent leur couleur.
    const hex = toHex(Math.round(data[i] / 8) * 8, Math.round(data[i + 1] / 8) * 8, Math.round(data[i + 2] / 8) * 8);
    counts.set(hex, (counts.get(hex) || 0) + 1);
  }
  return [...counts.entries()].filter(([, n]) => n >= 4).map(([hex, n]) => ({ hex, weight: n, role: 'surface' as const }));
}

/** Vrai si l'image a de la transparence (un logo détouré, le plus souvent). */
async function hasTransparency(image: Buffer): Promise<boolean> {
  const meta = await sharp(image).metadata();
  if (!meta.hasAlpha) return false;
  const { data, info } = await sharp(image).ensureAlpha().resize(64, 64, { fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
  let clear = 0;
  for (let i = 3; i < data.length; i += info.channels) if (data[i] < 40) clear++;
  return clear / (data.length / info.channels) > 0.08;
}

const VISION_INSTRUCTION = [
  'Look at this image sent as a brand asset. Answer with ONE JSON object only:',
  '{"kind":"logo|guidelines|photo","brandName":"…","fonts":["…"],"colors":["#rrggbb"]}',
  '- kind: "logo" if it is a logo or brand mark; "guidelines" if it is a page of a brand book / style guide (swatches, typography specimens); "photo" otherwise.',
  '- brandName: the brand name you can READ in the image, or "" if none.',
  '- fonts: typeface names WRITTEN in the image (e.g. on a typography page), never guessed.',
  '- colors: the brand colours shown as swatches or used in the logo (max 5).',
].join('\n');

function parseVision(raw: string): { kind?: string; brandName?: string; fonts?: string[]; colors?: string[] } {
  try {
    const s = raw.replace(/```(?:json)?/g, '');
    return JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1));
  } catch {
    return {};
  }
}

// ─── PDF ────────────────────────────────────────────────────────────────────

/** Un import dynamique natif (le code compilé en CommonJS ne sait pas charger un module .mjs autrement). */
const nativeImport = new Function('s', 'return import(s)') as (s: string) => Promise<any>;

async function readPdf(buffer: Buffer, maxPages = 12): Promise<{ text: string; pages: Buffer[] }> {
  const pdfjs = await nativeImport('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true, isEvalSupported: false, verbosity: 0 }).promise;
  let canvasModule: any = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    canvasModule = require('canvas');
  } catch {
    canvasModule = null;
  }
  const texts: string[] = [];
  const pages: Buffer[] = [];
  try {
    for (let n = 1; n <= Math.min(doc.numPages, maxPages); n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      texts.push(content.items.map((item: any) => ('str' in item ? item.str : '')).join(' '));
      // Les trois premières pages dessinées, quand c'est possible (couleurs vues, logo, noms lus).
      if (canvasModule && pages.length < 3) {
        try {
          const viewport = page.getViewport({ scale: 1.2 });
          const canvas = canvasModule.createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
          pages.push(canvas.toBuffer('image/png'));
        } catch (error: any) {
          logger.warn('charter.pdf_render_failed', { page: n, error: error?.message });
        }
      }
      page.cleanup();
    }
  } finally {
    await doc.destroy().catch(() => undefined);
  }
  return { text: texts.join('\n'), pages };
}

// ─── La lecture ─────────────────────────────────────────────────────────────

export async function readCharterFile(input: { buffer: Buffer; mimeType: string; name?: string; vision?: VisionPort }): Promise<CharterRead> {
  const warnings: string[] = [];
  const isPdf = input.mimeType === 'application/pdf' || /\.pdf$/i.test(input.name || '');
  const isSvg = input.mimeType === 'image/svg+xml' || /\.svg$/i.test(input.name || '');
  let text = '';
  let images: Buffer[] = [];
  if (isPdf) {
    const pdf = await readPdf(input.buffer);
    text = pdf.text;
    images = pdf.pages;
    if (!images.length) warnings.push('Pages du PDF non dessinées (module canvas absent) : seul le texte a été lu.');
  } else {
    // Une image (le SVG est rastérisé pour être regardé, et gardé tel quel comme logo).
    images = [await sharp(input.buffer, { density: isSvg ? 144 : undefined }).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).png().toBuffer()];
  }

  // Ce que le modèle de vision lit (une page au plus : la première, la plus parlante).
  let seenByVision: ReturnType<typeof parseVision> = {};
  if (input.vision && images[0]) {
    try {
      const small = await sharp(images[0]).resize({ width: 1024, height: 1024, fit: 'inside' }).png().toBuffer();
      seenByVision = parseVision(await input.vision(small.toString('base64'), 'image/png', VISION_INSTRUCTION));
    } catch (error: any) {
      logger.warn('charter.vision_failed', { error: error?.message });
    }
  }
  const transparent = !isPdf && images[0] ? await hasTransparency(images[0]) : false;
  const kind: CharterRead['kind'] = isPdf ? 'guidelines' : isSvg || transparent || seenByVision.kind === 'logo' ? 'logo' : seenByVision.kind === 'guidelines' ? 'guidelines' : 'photo';

  // Les couleurs : écrites d'abord (poids fort), vues ensuite.
  const written = colorsInText(text);
  const fromVision = (seenByVision.colors || []).map((c) => normalizeHex(c)).filter((c): c is string => !!c);
  const seen: SeenColor[] = [
    ...written.map((hex, i) => ({ hex, weight: 400 - i * 10, role: 'theme' as const })),
    ...fromVision.map((hex, i) => ({ hex, weight: 120 - i * 10, role: 'variable' as const })),
  ];
  for (const img of images.slice(0, 3)) seen.push(...(await seenColors(img)));
  const { palette, warnings: pw } = paletteFromClusters(clusterColors(seen));
  warnings.push(...pw);
  // Ce qui est ÉCRIT fait foi, dans l'ordre de la charte : la première couleur citée est la
  // principale ; la suivante l'accent (ou la secondaire quand il y en a trois).
  const chromaticWritten = written.filter((hex) => {
    const [r, g, b] = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
    return Math.max(r, g, b) - Math.min(r, g, b) > 24;
  });
  if (chromaticWritten.length) {
    palette.primary = chromaticWritten[0];
    if (chromaticWritten.length === 2) palette.accent = chromaticWritten[1];
    if (chromaticWritten.length >= 3) {
      palette.secondary = chromaticWritten[1];
      palette.accent = chromaticWritten[2];
    }
    // Une secondaire qui redit la primaire : sa nuance sombre (en-têtes, pieds, fonds forts).
    if (palette.secondary === palette.primary || palette.secondary === palette.accent) {
      const o = hexToOklch(palette.primary);
      if (o) palette.secondary = oklchToHex({ l: Math.max(0.22, o.l - 0.28), c: o.c * 0.7, h: o.h });
    }
  }

  // Les polices : écrites dans le texte, sinon lues par le modèle sur l'image.
  const fonts = fontsInText(text);
  for (const f of seenByVision.fonts || []) if (typeof f === 'string' && f.trim() && !fonts.includes(f.trim())) fonts.push(f.trim());
  const seenFonts: SeenFont[] = fonts.slice(0, 2).map((family, i) => ({ family, usage: i === 0 ? 'heading' : 'body', weight: 700, area: 1000 - i * 100 }));
  const typo = typographyProposals(seenFonts.length ? seenFonts : [{ family: 'Inter', usage: 'body', weight: 400, area: 1 }]);

  const brandName = typeof seenByVision.brandName === 'string' ? seenByVision.brandName.trim().slice(0, 60) : '';
  const logo: CharterRead['logo'] =
    kind === 'logo' ? (isSvg ? { buffer: input.buffer, mimeType: 'image/svg+xml' } : { buffer: await sharp(images[0]).trim().png().toBuffer().catch(() => images[0]), mimeType: 'image/png' }) : undefined;
  return {
    kind,
    ...(brandName ? { brandName } : {}),
    palette,
    palettes: paletteProposals(palette),
    typographies: typo.proposals,
    ...(logo ? { logo } : {}),
    found: { colors: written.length + fromVision.length, fonts: fonts.slice(0, 2), fromText: written.length > 0 || fontsInText(text).length > 0 },
    warnings,
  };
}
