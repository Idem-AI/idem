import { randomUUID } from 'crypto';
import sharp from 'sharp';
import minioConnection from '../../config/minio.config';
import { storageService } from '../storage.service';
import { BuildersError } from './builder-errors';
import { BUILDERS_PROGRAM } from '../../../../../packages/shared-models/src/builders/program';

/**
 * La couverture qu'un candidat choisit pour sa fiche Idem Builders.
 *
 * Le fichier envoyé n'est jamais publié tel quel : il est réorienté, vérifié
 * (paysage 16:9, 1600 × 900 au moins), ramené à 1600 × 900, réencodé en WebP
 * et dépouillé de ses métadonnées (dont la position GPS qu'une photo de
 * téléphone emporte souvent). Il est
 * rangé sous le compte de son auteur : la candidature n'accepte qu'une
 * couverture rangée là, jamais l'adresse d'une image prise ailleurs.
 */

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

function folderFor(userId: string): string {
  return `builders/covers/${userId}`;
}

export async function storeBuilderCover(
  userId: string,
  file: { buffer: Buffer; mimetype: string; size: number } | undefined
): Promise<{ url: string; width: number; height: number }> {
  if (!file) throw new BuildersError(400, 'COVER_REQUIRED', 'Choisissez une image.');
  if (!ACCEPTED.includes(file.mimetype)) {
    throw new BuildersError(400, 'COVER_FORMAT', 'La couverture doit être une image JPG, PNG ou WebP.');
  }
  if (file.size > BUILDERS_PROGRAM.coverMaxBytes) {
    throw new BuildersError(400, 'COVER_TOO_HEAVY', 'La couverture dépasse 8 Mo.');
  }

  let image: ReturnType<typeof sharp>;
  let width = 0;
  let height = 0;
  try {
    image = sharp(file.buffer, { limitInputPixels: 50_000_000 }).rotate();
    const meta = await image.metadata();
    // Après rotation EXIF, largeur et hauteur s'échangent pour une photo en portrait.
    const turned = (meta.orientation ?? 1) >= 5;
    width = (turned ? meta.height : meta.width) ?? 0;
    height = (turned ? meta.width : meta.height) ?? 0;
  } catch {
    throw new BuildersError(400, 'COVER_UNREADABLE', "L'image n'a pas pu être lue.");
  }

  const { coverWidth, coverHeight } = BUILDERS_PROGRAM;
  const ratio = width / Math.max(height, 1);
  if (Math.abs(ratio - coverWidth / coverHeight) > 0.02) {
    throw new BuildersError(400, 'COVER_RATIO', 'La couverture doit être au format paysage 16:9.');
  }
  if (width < coverWidth || height < coverHeight) {
    throw new BuildersError(400, 'COVER_TOO_SMALL', `La couverture doit mesurer au moins ${coverWidth} × ${coverHeight} px.`);
  }

  // Toutes les couvertures publiées ont la même taille : la vitrine les montre
  // entières, sans recadrage.
  const output = await image
    .resize({ width: coverWidth, height: coverHeight, fit: 'cover' })
    .webp({ quality: 84 })
    .toBuffer({ resolveWithObject: true });

  const stored = await storageService.uploadFile(output.data, `${randomUUID()}.webp`, folderFor(userId), 'image/webp');
  return { url: stored.downloadURL, width: output.info.width, height: output.info.height };
}

/** La couverture appartient-elle bien à ce compte ? */
export function isOwnCover(userId: string, url: string): boolean {
  const prefix = minioConnection.getPublicUrl(`${folderFor(userId)}/`);
  return url.startsWith(prefix) && /^[a-f0-9-]{36}\.webp$/.test(url.slice(prefix.length));
}
