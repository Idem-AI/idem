import { randomUUID } from 'crypto';
import logger from '../config/logger';
import { BrandFontFileModel } from '../models/brand-identity.model';
import { CustomFontModel } from '../models/custom-font.model';
import { CustomFont } from '../schemas/customFont.schema';
import { storageService } from './storage.service';

/**
 * Import des polices de l'utilisateur.
 *
 * Le principe : une marque a souvent déjà SA typographie, sous licence ou
 * dessinée pour elle, et elle n'est dans aucun catalogue en ligne. Jusqu'ici la
 * seule issue était de choisir « la plus proche » chez Google — c'est-à-dire de
 * renoncer à la marque au moment précis où on la définit.
 *
 * On téléverse donc les fichiers dans notre bucket, on FABRIQUE la feuille
 * `@font-face` qui les déclare, et c'est l'URL de cette feuille qui part en
 * base à la place du lien Google. Tout le reste de la chaîne (aperçu du front,
 * PDF des livrables, carte de visite, visuels) charge une feuille de style par
 * `<link>` : elle ne voit aucune différence entre la nôtre et celle de Google.
 */

/** Au-delà, ce n'est plus une police mais un jeu de caractères complet. */
const MAX_FILE_BYTES = 8 * 1024 * 1024;
/** Une famille complète tient largement dedans (9 graisses × 2 styles). */
export const MAX_FILES_PER_FONT = 18;

export type FontFileFormat = 'woff2' | 'woff' | 'ttf' | 'otf';

/** Ordre de préférence dans `src:` — le navigateur prend le premier qu'il sait lire. */
const FORMAT_PRIORITY: FontFileFormat[] = ['woff2', 'woff', 'ttf', 'otf'];

const CONTENT_TYPES: Record<FontFileFormat, string> = {
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
  otf: 'font/otf',
};

/** Les noms de graisse tels qu'ils apparaissent dans les noms de fichiers. */
const WEIGHT_TOKENS: ReadonlyArray<[RegExp, number]> = [
  [/extra[-_ ]?black|ultra[-_ ]?black/i, 950],
  [/thin|hairline/i, 100],
  [/extra[-_ ]?light|ultra[-_ ]?light/i, 200],
  [/light/i, 300],
  [/regular|normal|book|roman/i, 400],
  [/medium/i, 500],
  [/semi[-_ ]?bold|demi[-_ ]?bold/i, 600],
  [/extra[-_ ]?bold|ultra[-_ ]?bold/i, 800],
  [/black|heavy/i, 900],
  [/bold/i, 700],
];

export class InvalidFontFileError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message);
    this.name = 'InvalidFontFileError';
  }
}

export interface UploadedFontFile {
  originalname: string;
  buffer: Buffer;
  size?: number;
}

export class CustomFontService {
  /**
   * Téléverse une famille et renvoie la police prête à être choisie.
   *
   * Ré-importer une famille déjà présente la REMPLACE : deux `@font-face`
   * portant le même nom se recouvrent au rendu, et l'utilisateur qui
   * ré-importe corrige presque toujours son premier envoi.
   */
  async importFont(
    userId: string,
    family: string,
    files: UploadedFontFile[],
    category = 'sans-serif'
  ): Promise<CustomFontModel> {
    const cleanFamily = sanitizeFamily(family);
    if (!cleanFamily) {
      throw new InvalidFontFileError('A font family name is required', 'FAMILY_REQUIRED');
    }
    if (!files?.length) {
      throw new InvalidFontFileError('No font file received', 'NO_FILE');
    }
    if (files.length > MAX_FILES_PER_FONT) {
      throw new InvalidFontFileError(
        `At most ${MAX_FILES_PER_FONT} files per family`,
        'TOO_MANY_FILES'
      );
    }

    const existing = await CustomFont.findOne({ userId, family: cleanFamily });
    const fontId = existing ? String(existing._id) : randomUUID();
    const folderPath = `users/${userId}/fonts/${fontId}`;

    const descriptors = files.map((file) => describeFile(file, cleanFamily));

    const uploaded: BrandFontFileModel[] = [];
    for (const descriptor of descriptors) {
      const result = await storageService.uploadFile(
        descriptor.buffer,
        descriptor.fileName,
        folderPath,
        CONTENT_TYPES[descriptor.format]
      );
      uploaded.push({
        url: result.downloadURL,
        filePath: result.filePath,
        weight: descriptor.weight,
        style: descriptor.style,
        format: descriptor.format,
      });
    }

    // Deux fichiers peuvent décrire la même graisse (« Satoshi-Bold.woff2 » et
    // « Satoshi-700.woff2 ») : ils écrivent alors le MÊME objet dans le bucket,
    // et la feuille listerait deux fois la même URL. On ne garde que le dernier.
    const unique = [...new Map(uploaded.map((file) => [file.filePath, file])).values()];

    const css = buildFontFaceCss(cleanFamily, unique);
    const cssUpload = await storageService.uploadFile(css, 'fontface.css', folderPath, 'text/css');

    const weights = [...new Set(unique.map((file) => file.weight))].sort((a, b) => a - b);
    const payload = {
      userId,
      family: cleanFamily,
      category: category || 'sans-serif',
      weights,
      cssUrl: cssUpload.downloadURL,
      cssPath: cssUpload.filePath,
      folderPath,
      files: unique,
    };

    // Les anciens fichiers de la famille sont retirés APRÈS l'écriture de la
    // nouvelle feuille : si le téléversement échoue à mi-chemin, la police
    // précédente est toujours servie.
    const staleFiles = (existing?.files ?? [])
      .map((file) => file.filePath)
      .filter((path): path is string => Boolean(path) && !unique.some((f) => f.filePath === path));

    const saved = existing
      ? ((await CustomFont.findByIdAndUpdate(existing._id, payload, { new: true })) ?? existing)
      : await new CustomFont({ _id: fontId, ...payload }).save();

    if (staleFiles.length) {
      await storageService.deleteFiles(staleFiles).catch((error) => {
        logger.warn('Could not remove replaced font files', { error: error.message });
      });
    }

    logger.info('Custom font imported', { userId, family: cleanFamily, files: unique.length });
    return toModel(saved);
  }

  /** Les polices de l'utilisateur, la plus récente en tête. */
  async listFonts(userId: string): Promise<CustomFontModel[]> {
    const documents = await CustomFont.find({ userId }).sort({ createdAt: -1 }).lean();
    return documents.map((doc: any) => toModel(doc));
  }

  async getFont(userId: string, fontId: string): Promise<CustomFontModel | null> {
    const document = await CustomFont.findOne({ _id: fontId, userId }).lean();
    return document ? toModel(document) : null;
  }

  /**
   * Supprime la police et ses fichiers.
   *
   * Un projet qui l'avait retenue garde sa feuille en base : elle ne répondra
   * plus, et le rendu retombera sur la pile de repli. C'est assumé — l'alternative
   * serait de refuser la suppression tant qu'un projet l'utilise, ce qui
   * enfermerait l'utilisateur dans un fichier envoyé par erreur.
   */
  async deleteFont(userId: string, fontId: string): Promise<boolean> {
    const document = await CustomFont.findOne({ _id: fontId, userId });
    if (!document) return false;

    const paths = [
      ...document.files.map((file) => file.filePath).filter((p): p is string => Boolean(p)),
      document.cssPath,
    ].filter(Boolean);

    await CustomFont.deleteOne({ _id: fontId, userId });

    if (paths.length) {
      await storageService.deleteFiles(paths).catch((error) => {
        logger.warn('Could not remove font files from bucket', { error: error.message });
      });
    }

    logger.info('Custom font deleted', { userId, fontId });
    return true;
  }
}

/**
 * La feuille servie depuis le bucket.
 *
 * Les fichiers d'une même graisse sont regroupés dans UNE règle : deux
 * `@font-face` identiques en famille/graisse/style se remplacent l'un l'autre,
 * et seul le dernier serait chargé. `font-display: swap` évite le texte
 * invisible le temps du téléchargement.
 */
export function buildFontFaceCss(family: string, files: BrandFontFileModel[]): string {
  const groups = new Map<string, BrandFontFileModel[]>();
  for (const file of files) {
    const key = `${file.weight}|${file.style}`;
    groups.set(key, [...(groups.get(key) ?? []), file]);
  }

  const rules = [...groups.entries()].map(([key, group]) => {
    const [weight, style] = key.split('|');
    const src = [...group]
      .sort((a, b) => FORMAT_PRIORITY.indexOf(a.format) - FORMAT_PRIORITY.indexOf(b.format))
      .map((file) => `url('${file.url}') format('${file.format}')`)
      .join(',\n       ');

    return [
      '@font-face {',
      `  font-family: '${family}';`,
      `  font-style: ${style};`,
      `  font-weight: ${weight};`,
      '  font-display: swap;',
      `  src: ${src};`,
      '}',
    ].join('\n');
  });

  return [`/* ${family} — imported by the brand owner, served by IDEM */`, ...rules].join('\n\n') + '\n';
}

/**
 * Le format réel du fichier, lu dans ses premiers octets.
 *
 * L'extension ment (un `.ttf` renommé en `.woff2` casserait le rendu sans
 * message), et le type MIME envoyé par le navigateur est souvent
 * `application/octet-stream`. La signature, elle, est dans le fichier.
 */
export function detectFormat(buffer: Buffer): FontFileFormat | null {
  if (buffer.length < 4) return null;
  const tag = buffer.subarray(0, 4).toString('latin1');

  if (tag === 'wOF2') return 'woff2';
  if (tag === 'wOFF') return 'woff';
  if (tag === 'OTTO') return 'otf';
  if (tag === 'true' || tag === 'ttcf') return 'ttf';
  if (buffer.readUInt32BE(0) === 0x00010000) return 'ttf';
  return null;
}

/** La graisse portée par le nom du fichier, 400 à défaut. */
export function inferWeight(fileName: string): number {
  const numeric = fileName.match(/(?:^|[^0-9])([1-9]00)(?:[^0-9]|$)/);
  if (numeric) return Number(numeric[1]);

  for (const [pattern, weight] of WEIGHT_TOKENS) {
    if (pattern.test(fileName)) return weight === 950 ? 900 : weight;
  }
  return 400;
}

export function inferStyle(fileName: string): 'normal' | 'italic' {
  return /italic|oblique/i.test(fileName) ? 'italic' : 'normal';
}

/**
 * Le nom de famille tel qu'il pourra être écrit dans un `font-family`.
 *
 * On retire ce qui casserait la déclaration CSS (guillemets, points-virgules,
 * accolades) plutôt que de refuser le nom : l'utilisateur tape ce qu'il a sous
 * les yeux, pas un identifiant.
 */
export function sanitizeFamily(raw?: string | null): string {
  return String(raw ?? '')
    .replace(/["'`;{}<>\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 64);
}

function describeFile(
  file: UploadedFontFile,
  family: string
): { buffer: Buffer; fileName: string; format: FontFileFormat; weight: number; style: 'normal' | 'italic' } {
  const buffer = file.buffer;
  if (!buffer?.length) {
    throw new InvalidFontFileError(`${file.originalname} is empty`, 'EMPTY_FILE');
  }
  if (buffer.length > MAX_FILE_BYTES) {
    throw new InvalidFontFileError(
      `${file.originalname} exceeds ${MAX_FILE_BYTES / (1024 * 1024)} MB`,
      'FILE_TOO_LARGE'
    );
  }

  const format = detectFormat(buffer);
  if (!format) {
    throw new InvalidFontFileError(
      `${file.originalname} is not a WOFF2, WOFF, TTF or OTF font file`,
      'UNSUPPORTED_FORMAT'
    );
  }

  const weight = inferWeight(file.originalname);
  const style = inferStyle(file.originalname);
  const slug = family.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'font';

  return {
    buffer,
    // Un nom reconstruit : celui d'origine peut contenir n'importe quoi, et il
    // finit dans une URL publique.
    fileName: `${slug}-${weight}-${style}.${format}`,
    format,
    weight,
    style,
  };
}

function toModel(document: any): CustomFontModel {
  return {
    id: String(document._id ?? document.id),
    userId: document.userId,
    family: document.family,
    category: document.category,
    weights: document.weights ?? [],
    cssUrl: document.cssUrl,
    cssPath: document.cssPath,
    folderPath: document.folderPath,
    files: (document.files ?? []).map((file: any) => ({
      url: file.url,
      filePath: file.filePath,
      weight: file.weight,
      style: file.style,
      format: file.format,
    })),
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

export const customFontService = new CustomFontService();
