import { LogoModel, LogoPreferencesModel } from './logo.model';
import { SectionModel } from './section.model';

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
  logoPreferences?: LogoPreferencesModel;
  /**
   * Parti pris visuel de la marque, décidé une fois côté API puis imposé à
   * toutes les générations (charte, visuels, business plan, deck, site).
   */
  artDirection?: ArtDirectionModel;
  pdfFormat?: string; // Format PDF choisi lors de la génération de la charte (ex: SLIDE_16_9)
  pdfBlob?: Blob; // Optional PDF blob for optimized loading
  importedLogoColors?: string[]; // Couleurs extraites du logo importé (workflow import)
}

/** Bannière de réseau social ou photo de profil, en fichier (cf. API `socialAssets`). */
export interface SocialAssetFile {
  id: string;
  label: string;
  width: number;
  height: number;
  url: string;
}

/** Direction artistique : cf. api/models/art-direction.model.ts. */
export interface ArtDirectionModel {
  styleId: string;
  styleName: string;
  tagline: string;
  rationale: string;
  keywords: string[];
  layout?: { grid: string; density: string; whitespace: string; signatureMove: string };
  color?: { distribution: string; application: string; contrast: string };
  typography?: { scaleContrast: string; caseAndTracking: string; treatment: string };
  imagery?: {
    medium: string;
    subjects: string;
    treatment: string;
    lighting: string;
    framing: string;
  };
  graphicDevices?: string[];
  dos?: string[];
  donts?: string[];
  imagePromptModifier?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TypographyModel {
  id: string;
  name: string;
  /**
   * Feuille de style qui charge RÉELLEMENT les deux familles : lien du
   * catalogue retenu (Google, Fontshare, Fontsource) ou, pour une police
   * importée par l'utilisateur, le `@font-face` servi depuis notre bucket.
   */
  url?: string;
  primaryFont: string;
  secondaryFont: string;
  description?: string;
  /** Une phrase de l'agent : ce que cet appariement dit de la marque. */
  rationale?: string;
  /** D'où viennent les deux familles, et comment les charger. */
  primary?: BrandFont;
  secondary?: BrandFont;
}

/** Cf. api/models/brand-identity.model.ts. */
export type FontSourceId = 'google' | 'fontshare' | 'fontsource' | 'custom';

export interface BrandFontFile {
  url: string;
  filePath?: string;
  weight: number;
  style: 'normal' | 'italic';
  format: 'woff2' | 'woff' | 'ttf' | 'otf';
}

/**
 * Une famille retenue pour la marque, avec de quoi la charger n'importe où.
 *
 * `cssUrl` suffit à l'afficher : quelle que soit la source, il pointe sur une
 * feuille qui déclare la famille sous le nom porté par `family`.
 */
export interface BrandFont {
  family: string;
  source: FontSourceId;
  cssUrl?: string;
  category?: string;
  weights?: number[];
  customFontId?: string;
  files?: BrandFontFile[];
}

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
