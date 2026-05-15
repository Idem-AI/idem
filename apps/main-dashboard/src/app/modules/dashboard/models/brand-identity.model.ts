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
  pdfBlob?: Blob; // Optional PDF blob for optimized loading
  importedLogoColors?: string[]; // Couleurs extraites du logo importé (workflow import)
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
