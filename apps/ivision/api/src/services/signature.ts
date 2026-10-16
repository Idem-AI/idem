/**
 * La signature des créations gratuites : un bandeau discret « Créé avec iVision » en bas à droite.
 *
 * C'est la contrepartie de la gratuité — chaque publication d'un visuel gratuit fait connaître
 * iVision — et ce que l'export HD (payé, ou inclus avec Créateur) retire.
 */
import sharp from 'sharp';

const LABEL = 'Créé avec iVision';

export async function signImage(input: Buffer): Promise<Buffer> {
  const image = sharp(input);
  const { width = 1080, height = 1080 } = await image.metadata();
  const fontSize = Math.max(14, Math.round(Math.min(width, height) * 0.026));
  const padX = Math.round(fontSize * 0.8);
  const padY = Math.round(fontSize * 0.45);
  // Largeur estimée du texte (Inter/Helvetica : ~0,55 em par caractère).
  const textWidth = Math.ceil(LABEL.length * fontSize * 0.55);
  const badgeWidth = textWidth + padX * 2;
  const badgeHeight = fontSize + padY * 2;
  const margin = Math.round(fontSize * 0.9);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${badgeWidth}" height="${badgeHeight}">
  <rect width="100%" height="100%" rx="${Math.round(badgeHeight / 2)}" fill="#ffffff" fill-opacity="0.9"/>
  <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="${fontSize}" font-weight="600" fill="#111827">${LABEL}</text>
</svg>`;

  return image
    .composite([{ input: Buffer.from(svg), left: Math.max(0, width - badgeWidth - margin), top: Math.max(0, height - badgeHeight - margin) }])
    .png()
    .toBuffer();
}
