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
  url?: string;
  primaryFont: string;
  secondaryFont: string;
  description?: string;
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
