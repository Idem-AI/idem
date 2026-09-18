import { BrandFontFileModel } from './brand-identity.model';

/**
 * Une police importée par l'utilisateur, hébergée dans NOTRE bucket.
 *
 * @openapi
 * components:
 *   schemas:
 *     CustomFontModel:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         family:
 *           type: string
 *           description: Nom de famille CSS sous lequel la police est déclarée
 *         category:
 *           type: string
 *           enum: [sans-serif, serif, display, handwriting, monospace]
 *         weights:
 *           type: array
 *           items:
 *             type: number
 *         cssUrl:
 *           type: string
 *           format: url
 *           description: >
 *             Feuille @font-face générée à l'import. C'est CETTE URL qui est
 *             stockée dans la typographie du projet, à la place du lien Google.
 *         files:
 *           type: array
 *           items:
 *             type: object
 *         createdAt:
 *           type: string
 *           format: date-time
 */
export interface CustomFontModel {
  id: string;
  userId: string;
  family: string;
  category: string;
  weights: number[];
  /** Feuille `@font-face` servie depuis le bucket : ce qui est stocké en base. */
  cssUrl: string;
  /** Chemin de la feuille dans le bucket, pour la remplacer ou la supprimer. */
  cssPath: string;
  /** Dossier du bucket qui contient la police et sa feuille. */
  folderPath: string;
  files: BrandFontFileModel[];
  createdAt?: Date;
  updatedAt?: Date;
}
