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
 *       required:
 *         - id
 *         - name
 *         - url
 *         - primaryFont
 *         - secondaryFont
 */
export interface TypographyModel {
  id: string;
  name: string;
  url: string;
  primaryFont: string;
  secondaryFont: string;
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
