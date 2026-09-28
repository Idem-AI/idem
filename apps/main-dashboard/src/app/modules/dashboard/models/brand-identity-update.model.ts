import { BrandFont, ColorModel, TypographyModel } from './brand-identity.model';
import { LogoModel } from './logo.model';

/**
 * Contrat de `PUT /project/brandings/:projectId/identity` : changer le logo,
 * les couleurs ou les polices et propager le changement à tous les supports,
 * sans IA. Miroir de `apps/api/api/services/brand/brandSync.service.ts`.
 */

export type PaletteRole = 'primary' | 'secondary' | 'accent' | 'background' | 'text';

export const PALETTE_ROLES: readonly PaletteRole[] = ['primary', 'secondary', 'accent', 'background', 'text'];

export type BrandPalette = Record<PaletteRole, string>;

export interface IdentityLogoInput {
  generatedLogoId?: string;
  svg?: string;
  iconSvg?: string;
  variations?: LogoModel['variations'];
  name?: string;
  colors?: string[];
}

export interface IdentityUpdateRequest {
  logo?: IdentityLogoInput;
  colors?: Partial<BrandPalette>;
  keepColors?: PaletteRole[];
  colorsFromLogo?: boolean;
  typography?: { primary?: BrandFont; secondary?: BrandFont };
  /** Adapter le logo actuel aux nouvelles couleurs / à la nouvelle police, sans IA. */
  adaptLogo?: boolean;
  dryRun?: boolean;
}

export interface PaletteAdjustment {
  role: PaletteRole;
  from?: string;
  to: string;
  reason: string;
}

export interface HarmonizeResult {
  palette: BrandPalette;
  adjustments: PaletteAdjustment[];
  warnings: string[];
  contrast: {
    textOnBackground: number;
    primaryOnBackground: number;
    secondaryOnBackground: number;
    accentOnBackground: number;
  };
}

export interface SupportReport {
  key: string;
  label: string;
  items: number;
  updated: number;
}

export interface IdentityUpdateReport {
  dryRun: boolean;
  changed: { logo: boolean; colors: boolean; typography: boolean };
  palette?: HarmonizeResult;
  branding: { logo: LogoModel; colors: ColorModel; typography: TypographyModel };
  supports: SupportReport[];
  site?: { hasSite: boolean; filesChanged: number; forged: boolean; error?: string };
  stats: { colors: number; fonts: number; logos: number; contrastFixes: number };
  logoAdaptation?: { recolored: boolean; retypeset: boolean; previewSvg?: string };
}
