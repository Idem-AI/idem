/**
 * Le template central des sites vitrines.
 *
 * `template/` contient un vrai projet — React, TypeScript, Tailwind, shadcn/ui,
 * Motion — dont les composants de base portent déjà leurs variantes, leurs
 * états et leur accessibilité. Il est copié tel quel dans chaque site : le
 * modèle n'écrit jamais un bouton, une carte ou un champ.
 *
 * Ce qui change d'un site à l'autre n'est pas dans ces fichiers mais dans
 * `src/design-system/design-system.json`, que le compilateur
 * (`template/scripts/design-system/compile.mjs`) traduit en variables CSS et
 * en réglages des composants.
 *
 * Le même compilateur sert ici, sur le serveur, et dans le projet, par son
 * plugin Vite : une seule implémentation.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Version du template. Elle est écrite dans chaque site
 * (`design-system-version.json`) : un site garde la version avec laquelle il a
 * été généré, et une nouvelle version ne l'écrase jamais d'elle-même.
 */
export const TEMPLATE_VERSION = '1.0.0';

/** Marque des sites générés par ce moteur ; l'atelier s'en sert pour les reconnaître. */
export const SITE_ENGINE_ID = 'idem-site-engine';

/** Les quatre fichiers du design system d'un projet. */
export const DESIGN_SYSTEM_PATHS = {
  source: 'src/design-system/design-system.json',
  css: 'src/design-system/theme.generated.css',
  components: 'src/design-system/component-config.generated.json',
  version: 'src/design-system/design-system-version.json',
} as const;

/** Les dépendances du socle. Versions figées : le template a été construit avec elles. */
export const SITE_DEPENDENCIES: Record<string, string> = {
  '@radix-ui/react-accordion': '^1.2.2',
  '@radix-ui/react-avatar': '^1.1.2',
  '@radix-ui/react-checkbox': '^1.1.3',
  '@radix-ui/react-dialog': '^1.1.4',
  '@radix-ui/react-dropdown-menu': '^2.1.4',
  '@radix-ui/react-label': '^2.1.1',
  '@radix-ui/react-popover': '^1.1.4',
  '@radix-ui/react-radio-group': '^1.2.2',
  '@radix-ui/react-select': '^2.1.4',
  '@radix-ui/react-separator': '^1.1.1',
  '@radix-ui/react-slot': '^1.1.1',
  '@radix-ui/react-switch': '^1.1.2',
  '@radix-ui/react-tabs': '^1.1.2',
  '@radix-ui/react-tooltip': '^1.1.6',
  'class-variance-authority': '^0.7.1',
  clsx: '^2.1.1',
  // Version exacte : le serveur vérifie les noms d'icônes contre cette version.
  'lucide-react': '0.441.0',
  motion: '^11.18.2',
  react: '^18.3.1',
  'react-dom': '^18.3.1',
  'tailwind-merge': '^2.6.0',
};

export const SITE_DEV_DEPENDENCIES: Record<string, string> = {
  '@vitejs/plugin-react': '^4.3.4',
  autoprefixer: '^10.4.20',
  postcss: '^8.4.49',
  tailwindcss: '^3.4.17',
  'tailwindcss-animate': '^1.0.7',
  vite: '^5.4.11',
};

/**
 * Dépendances fonctionnelles qu'un site peut demander en plus du socle. Aucune
 * bibliothèque de composants ni d'animation : shadcn/ui et Motion suffisent.
 */
export const FUNCTIONAL_DEPENDENCIES: Record<string, string> = {
  'date-fns': '^4.1.0',
  'embla-carousel-react': '^8.5.1',
  'react-hook-form': '^7.54.2',
  zod: '^3.24.1',
};

const TEMPLATE_DIR = fileURLToPath(new URL('./template/', import.meta.url));

let cache: Record<string, string> | null = null;

/** Tous les fichiers du template, chemin relatif → contenu. */
export function templateFiles(): Record<string, string> {
  if (cache) return cache;
  const files: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else files[relative(TEMPLATE_DIR, path).split('\\').join('/')] = readFileSync(path, 'utf8');
    }
  };
  walk(TEMPLATE_DIR);
  cache = files;
  return files;
}

/* -------------------------------------------------------------------------- */
/*  Compilateur                                                                */
/* -------------------------------------------------------------------------- */

export interface CompileReport {
  errors: string[];
  derived: string[];
  adjusted: string[];
  files: string[];
}

export interface CompiledDesignSystem {
  /** La configuration complète et bien formée : c'est elle qu'on écrit dans `design-system.json`. */
  config: DesignSystemConfig;
  css: string;
  componentConfig: Record<string, unknown>;
  fonts: string[];
  report: CompileReport;
}

/** La forme de `design-system.json` (le compilateur en est la définition exacte). */
export interface DesignSystemConfig {
  schemaVersion: number;
  appearance: { colorMode: 'light' | 'dark'; density: 'compact' | 'comfortable' | 'spacious' };
  tokens: {
    colors: Record<string, string>;
    typography: Record<string, string | number>;
    radius: Record<string, string>;
    borders: Record<string, string>;
    elevation: Record<string, string>;
    spacing: Record<string, string>;
  };
  components: Record<string, Record<string, string | number>>;
  motion: Record<string, unknown>;
}

interface CompilerModule {
  compileDesignSystem(input: unknown, options?: { defaults?: unknown }): CompiledDesignSystem;
  fontLinksHtml(fonts: string[]): string;
  parseColor(value: unknown): { r: number; g: number; b: number } | null;
  DEFAULT_CONFIG: DesignSystemConfig;
  COMPILER_VERSION: string;
  SCHEMA_VERSION: number;
}

/** Le compilateur du template, chargé une fois au démarrage du serveur. */
export const compiler = (await import(
  pathToFileURL(join(TEMPLATE_DIR, 'scripts/design-system/compile.mjs')).href
)) as CompilerModule;

/**
 * Les fichiers du design system d'un projet, à partir de sa configuration.
 * `defaults` : les valeurs de repli champ par champ (la charte).
 */
export function designSystemFiles(
  input: unknown,
  defaults?: unknown
): { files: Record<string, string>; compiled: CompiledDesignSystem } {
  const { compileDesignSystem, COMPILER_VERSION } = compiler;
  const compiled = compileDesignSystem(input, { defaults });
  return {
    compiled,
    files: {
      [DESIGN_SYSTEM_PATHS.source]: `${JSON.stringify(compiled.config, null, 2)}\n`,
      [DESIGN_SYSTEM_PATHS.css]: compiled.css,
      [DESIGN_SYSTEM_PATHS.components]: `${JSON.stringify(compiled.componentConfig, null, 2)}\n`,
      [DESIGN_SYSTEM_PATHS.version]: `${JSON.stringify(
        { generator: SITE_ENGINE_ID, template: TEMPLATE_VERSION, compiler: COMPILER_VERSION },
        null,
        2
      )}\n`,
    },
  };
}
