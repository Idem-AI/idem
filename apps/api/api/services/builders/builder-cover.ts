import { randomUUID } from 'crypto';
import sharp from 'sharp';
import minioConnection from '../../config/minio.config';
import { storageService } from '../storage.service';
import { BuildersError } from './builder-errors';
import { BUILDERS_PROGRAM } from '../../../../../packages/shared-models/src/builders/program';

/**
 * La couverture qu'un candidat choisit pour sa fiche Idem Builders.
 *
 * Le fichier envoyé n'est jamais publié tel quel : il est réorienté, ramené à
 * 2 000 px de large au plus, réencodé en WebP et dépouillé de ses métadonnées
 * (dont la position GPS qu'une photo de téléphone emporte souvent). Il est
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
    throw new BuildersError(400, 'COVER_TOO_HEAVY', 'La couverture dépasse 6 Mo.');
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

  if (width < BUILDERS_PROGRAM.coverMinWidth || height < BUILDERS_PROGRAM.coverMinHeight) {
    throw new BuildersError(
      400,
      'COVER_TOO_SMALL',
      `La couverture doit mesurer au moins ${BUILDERS_PROGRAM.coverMinWidth} × ${BUILDERS_PROGRAM.coverMinHeight} px.`
    );
  }

  const output = await image
    .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });

  const stored = await storageService.uploadFile(output.data, `${randomUUID()}.webp`, folderFor(userId), 'image/webp');
  return { url: stored.downloadURL, width: output.info.width, height: output.info.height };
}

/** La couverture appartient-elle bien à ce compte ? */
export function isOwnCover(userId: string, url: string): boolean {
  const prefix = minioConnection.getPublicUrl(`${folderFor(userId)}/`);
  return url.startsWith(prefix) && /^[a-f0-9-]{36}\.webp$/.test(url.slice(prefix.length));
}
