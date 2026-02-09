export interface LogoModel {
  id: string;
  name: string;
  svg: string; // Main SVG logo (default full version)
  concept: string; // Branding story or meaning behind the logo
  colors: string[]; // Array of HEX color codes used in the logo
  fonts: string[]; // Fonts used in the logo (if any)
  type?: LogoType; // Type of logo (icon, name, initial)
  customDescription?: string; // User-provided custom description

  variations?: LogoVariations;
}

export type LogoType = 'icon' | 'name' | 'initial';

export interface LogoPreferencesModel {
  type: LogoType;
  useAIGeneration: boolean;
  customDescription?: string;
}
export interface LogoVariationSet {
  lightBackground?: string; // SVG optimized for light backgrounds
  darkBackground?: string; // SVG optimized for dark backgrounds
  monochrome?: string; // Monochrome version (black or white)
}

export interface LogoVariations {
  withText?: LogoVariationSet; // Logo variations including text elements
  iconOnly?: LogoVariationSet; // Icon-only variations without text elements
}
