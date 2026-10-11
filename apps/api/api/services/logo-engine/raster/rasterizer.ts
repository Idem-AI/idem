/**
 * Prévisualisation PNG et mesures de pixels.
 *
 * `resvg-js` (rendu SVG en Rust, fidèle et rapide, sans navigateur) est le rasteriseur de
 * référence. Si son binaire natif n'est pas disponible sur la machine, le moteur retombe sur
 * `sharp` (déjà utilisé ailleurs dans l'API) : même interface, rendus quasi identiques pour des
 * tracés sans texte ni filtre — ce que sont les logos du moteur.
 */
import sharp from 'sharp';

export interface RasterImage {
  width: number;
  height: number;
  /** Pixels RGBA 8 bits, ligne après ligne. */
  rgba: Uint8Array;
}

export interface Rasterizer {
  readonly name: string;
  /** Rend le SVG à `widthPx` de large ; `background` (hex) remplit le fond, sinon il reste transparent. */
  render(svg: string, widthPx: number, background?: string | null): Promise<RasterImage>;
}

class ResvgRasterizer implements Rasterizer {
  readonly name = 'resvg-js';
  constructor(private readonly Resvg: new (svg: string, options?: Record<string, unknown>) => { render(): { width: number; height: number; pixels: Buffer } }) {}

  async render(svg: string, widthPx: number, background?: string | null): Promise<RasterImage> {
    const resvg = new this.Resvg(svg, {
      fitTo: { mode: 'width', value: Math.max(1, Math.round(widthPx)) },
      ...(background ? { background } : {}),
      font: { loadSystemFonts: false },
    });
    const image = resvg.render();
    return { width: image.width, height: image.height, rgba: new Uint8Array(image.pixels) };
  }
}

class SharpRasterizer implements Rasterizer {
  readonly name = 'sharp';

  async render(svg: string, widthPx: number, background?: string | null): Promise<RasterImage> {
    const pipeline = sharp(Buffer.from(svg), { density: 144 }).resize({ width: Math.max(1, Math.round(widthPx)) });
    if (background) pipeline.flatten({ background });
    const { data, info } = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return { width: info.width, height: info.height, rgba: new Uint8Array(data) };
  }
}

let shared: Rasterizer | null = null;

/** Le rasteriseur du processus : resvg-js si disponible, sharp sinon. */
export function defaultRasterizer(): Rasterizer {
  if (shared) return shared;
  try {
    // Import paresseux : un binaire natif absent ne doit pas empêcher le moteur de démarrer.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Resvg } = require('@resvg/resvg-js');
    shared = new ResvgRasterizer(Resvg);
  } catch {
    shared = new SharpRasterizer();
  }
  return shared;
}

export function setRasterizer(rasterizer: Rasterizer | null): void {
  shared = rasterizer;
}

/** Encode une image RGBA en PNG. */
export async function toPng(image: RasterImage): Promise<Buffer> {
  return sharp(Buffer.from(image.rgba), { raw: { width: image.width, height: image.height, channels: 4 } }).png().toBuffer();
}

/** Rend directement un PNG (aperçu). */
export async function renderPng(svg: string, widthPx: number, background?: string | null, rasterizer: Rasterizer = defaultRasterizer()): Promise<Buffer> {
  return toPng(await rasterizer.render(svg, widthPx, background));
}
