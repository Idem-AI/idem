import { LogoModel } from "./logo.model";
import { SectionModel } from "./section.model";

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
 *       required:
 *         - logo
 *         - generatedLogos
 *         - colors
 *         - generatedColors
 *         - typography
 *         - generatedTypography
 *         - sections
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
