import { ArtDirectionModel } from './art-direction.model';
import { LogoModel, LogoPreferences } from './logo.model';
import { SectionModel } from './section.model';

/**
 * @openapi
 * components:
 *   schemas:
 *     BrandIdentityModel:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         logo:
 *           $ref: '#/components/schemas/LogoModel'
 *         generatedLogos:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/LogoModel'
 *         colors:
 *           $ref: '#/components/schemas/ColorModel'
 *         generatedColors:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ColorModel'
 *         typography:
 *           $ref: '#/components/schemas/TypographyModel'
 *         generatedTypography:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/TypographyModel'
 *         sections:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/SectionModel'
 *         logoPreferences:
 *           type: object
 *           nullable: true
 *         artDirection:
 *           $ref: '#/components/schemas/ArtDirectionModel'
 *           nullable: true
 *       required:
 *         - logo
 *         - generatedLogos
 *         - colors
 *         - generatedColors
 *         - generatedTypography
 *         - sections
 *         - logoPreferences
 */
export interface BrandIdentityModel {
  id?: string;
  createdAt?: Date;
  updatedAt?: Date;
  logo: LogoModel;
  generatedLogos: LogoModel[];
  colors: ColorModel;
  generatedColors: ColorModel[];
  typography: TypographyModel;
  generatedTypography: TypographyModel[];
  sections: SectionModel[];
  logoPreferences?: LogoPreferences;
  /**
   * Parti pris visuel de la marque, décidé une fois puis imposé à TOUTES les
   * générations (charte, visuels, business plan, deck, mockups, site). Sans
   * lui, chaque module réinventait sa propre grammaire et deux livrables du
   * même projet ne se ressemblaient pas. Cf. models/art-direction.model.ts.
   */
  artDirection?: ArtDirectionModel;
  pdfFormat?: string; // Format PDF choisi (A4_PORTRAIT ou SLIDE_16_9)
  /**
   * Bannières de réseaux sociaux et photo de profil, rendues en fichiers pour
   * être téléchargées. `key` résume ce qui les compose (logos, palette,
   * polices, style, textes du projet) : tant qu'elle ne change pas, les
   * fichiers déposés restent valables.
   */
  socialAssets?: {
    key: string;
    generatedAt: Date;
    items: SocialAssetFileModel[];
  };
}

/** Un fichier de bannière ou de photo de profil, déposé dans le stockage. */
export interface SocialAssetFileModel {
  id: string;
  label: string;
  width: number;
  height: number;
  url: string;
}

/**
 * @openapi
 * components:
 *   schemas:
 *     TypographyModel:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         url:
 *           type: string
 *           format: url
 *         primaryFont:
 *           type: string
 *         secondaryFont:
 *           type: string
 *         description:
 *           type: string
 *         primary:
 *           $ref: '#/components/schemas/BrandFontModel'
 *         secondary:
 *           $ref: '#/components/schemas/BrandFontModel'
 *       required:
 *         - id
 *         - name
 *         - url
 *         - primaryFont
 *         - secondaryFont
 *     BrandFontModel:
 *       type: object
 *       properties:
 *         family:
 *           type: string
 *         source:
 *           type: string
 *           enum: [google, fontshare, fontsource, custom]
 *         cssUrl:
 *           type: string
 *           format: url
 *         category:
 *           type: string
 *         weights:
 *           type: array
 *           items:
 *             type: number
 *         customFontId:
 *           type: string
 *         files:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *               weight:
 *                 type: number
 *               style:
 *                 type: string
 *                 enum: [normal, italic]
 *               format:
 *                 type: string
 *                 enum: [woff2, woff, ttf, otf]
 *       required:
 *         - family
 *         - source
 */
export interface TypographyModel {
  id: string;
  name: string;
  /**
   * Feuille de style qui charge RÉELLEMENT les deux familles.
   *
   * Historiquement l'agent y écrivait un slug (« typography/systeme-premium »),
   * que `google-fonts.util` sait encore rattraper. Depuis l'ouverture aux
   * sources non-Google et à l'import de l'utilisateur, ce champ porte l'URL
   * servie par la source retenue : Google, Fontshare, Fontsource, ou — pour une
   * police importée — le `@font-face` généré dans NOTRE bucket.
   */
  url: string;
  primaryFont: string;
  secondaryFont: string;
  description?: string;
  /** Une phrase de l'agent : ce que cet appariement dit de la marque. */
  rationale?: string;
  /** D'où viennent les deux familles, et comment les charger. */
  primary?: BrandFontModel;
  secondary?: BrandFontModel;
}

/**
 * Les catalogues dans lesquels une famille peut être choisie.
 *
 * `custom` n'est pas un catalogue : c'est une police que l'utilisateur a
 * importée et que nous servons depuis notre propre bucket.
 */
export type FontSourceId = 'google' | 'fontshare' | 'fontsource' | 'custom';

/**
 * Un fichier de police importé, tel qu'il vit dans le bucket.
 */
export interface BrandFontFileModel {
  /** URL publique du fichier dans le bucket. */
  url: string;
  /** Chemin dans le bucket, gardé pour pouvoir supprimer la police. */
  filePath?: string;
  weight: number;
  style: 'normal' | 'italic';
  format: 'woff2' | 'woff' | 'ttf' | 'otf';
}

/**
 * Une famille retenue pour la marque, avec de quoi la charger n'importe où.
 *
 * `cssUrl` est le seul champ dont un moteur de rendu a besoin : quelle que soit
 * la source, il pointe sur une feuille qui déclare la famille sous le nom porté
 * par `family`. `files` n'est rempli que pour une police importée, et sert à la
 * supprimer du bucket ou à la ré-embarquer en base64.
 */
export interface BrandFontModel {
  family: string;
  source: FontSourceId;
  /** Feuille de style chargeant cette famille (vide pour une pile système). */
  cssUrl?: string;
  category?: string;
  weights?: number[];
  /** Identifiant de la police importée, pour la retrouver côté utilisateur. */
  customFontId?: string;
  files?: BrandFontFileModel[];
}

/**
 * @openapi
 * components:
 *   schemas:
 *     ColorPalette:
 *       type: object
 *       properties:
 *         primary:
 *           type: string
 *           format: hex-color
 *         secondary:
 *           type: string
 *           format: hex-color
 *         accent:
 *           type: string
 *           format: hex-color
 *         background:
 *           type: string
 *           format: hex-color
 *         text:
 *           type: string
 *           format: hex-color
 *       required:
 *         - primary
 *         - secondary
 *         - accent
 *         - background
 *         - text
 *     ColorModel:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         url:
 *           type: string
 *           format: url
 *         colors:
 *           $ref: '#/components/schemas/ColorPalette'
 *       required:
 *         - id
 *         - name
 *         - url
 *         - colors
 */
export interface ColorModel {
  id: string;
  name: string;
  url: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
}
