/// <reference path="./vendor.d.ts" />
/**
 * LE TRAITEMENT D'UNE PHOTO aux couleurs de la marque — pour qu'une photo de banque ou générée cesse d'être
 * générique : duotone (les ombres dans une couleur de la marque, les lumières dans une autre) ou teinte légère
 * (la photo garde ses couleurs, réchauffées vers la couleur de la marque). Le code applique ; l'idée du visuel décide.
 */
import sharp from 'sharp';

export type PhotoTreatment = 'natural' | 'duotone' | 'tint' | 'mono';

function rgbOf(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) || 0) as [number, number, number];
}

/** Le traitement demandé ; `natural` rend l'image telle quelle (réencodée en JPEG). */
export async function treatPhoto(image: Buffer, treatment: PhotoTreatment, colors: { dark: string; light: string; tint?: string }, amount = 0.35): Promise<Buffer> {
  if (treatment === 'natural') return sharp(image).rotate().jpeg({ quality: 88 }).toBuffer();
  if (treatment === 'mono') return sharp(image).rotate().greyscale().normalise().jpeg({ quality: 88 }).toBuffer();
  if (treatment === 'tint') {
    const { width = 1024, height = 1024 } = await sharp(image).metadata();
    const [r, g, b] = rgbOf(colors.tint ?? colors.dark);
    const overlay = await sharp({ create: { width, height, channels: 4, background: { r, g, b, alpha: Math.min(0.8, Math.max(0.05, amount)) } } }).png().toBuffer();
    return sharp(image).rotate().composite([{ input: overlay, blend: 'soft-light' }]).jpeg({ quality: 88 }).toBuffer();
  }
  // Duotone : la luminance de chaque pixel choisit un point entre la couleur sombre et la couleur claire.
  const { data, info } = await sharp(image).rotate().greyscale().normalise().raw().toBuffer({ resolveWithObject: true });
  const dark = rgbOf(colors.dark);
  const light = rgbOf(colors.light);
  const out = Buffer.alloc(info.width * info.height * 3);
  for (let i = 0; i < info.width * info.height; i++) {
    const t = data[i * info.channels] / 255;
    for (let c = 0; c < 3; c++) out[i * 3 + c] = Math.round(dark[c] + (light[c] - dark[c]) * t);
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 3 } }).jpeg({ quality: 88 }).toBuffer();
}
