/**
 * Pièces communes du starter préconfiguré.
 *
 * Tout ce qui est identique d'un projet à l'autre — configuration Vite,
 * PostCSS, Tailwind, feuille de style de base, utilitaires, trousse de
 * composants — est écrit ICI, par du code, et monté dans l'espace de travail
 * avant que le modèle ne parle. Le modèle n'écrit plus que le produit.
 *
 * Deux conséquences :
 *
 * 1. Les jetons. Un site généré de bout en bout réécrivait à chaque fois
 *    ~250 lignes de configuration qui ne varient jamais : c'est autant de
 *    jetons de sortie (les plus chers) dépensés pour un fichier dont nous
 *    connaissons déjà le contenu exact.
 * 2. Le rendu. `tailwind.config.js` porte la charte du projet. Un modèle qui le
 *    recopie « verbatim » en oublie une nuance une fois sur trois, et la page
 *    part en `bg-gray-100`. Posé par le code, il ne peut plus dériver.
 */

import { DesignSystem } from '../design/tokenForge.js';
import { resolveHeaderLogo } from '../design/charter.js';
import { ProjectModel } from '../types/project.js';

/** Dépendances posées dans tous les starters : le modèle n'a pas à les demander. */
export const BASE_DEPENDENCIES: Record<string, string> = {
  clsx: '^2.1.1',
  'lucide-react': '^0.441.0',
  react: '^18.2.0',
  'react-dom': '^18.2.0',
  'tailwind-merge': '^2.5.2',
};

export const BASE_DEV_DEPENDENCIES: Record<string, string> = {
  '@vitejs/plugin-react': '^4.2.0',
  autoprefixer: '^10.4.0',
  postcss: '^8.4.0',
  tailwindcss: '^3.4.0',
  vite: '^5.0.0',
};

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

/** Nom de paquet npm valable, tiré du nom du projet. */
export const packageName = (projectData?: ProjectModel): string => {
  const slug = (projectData?.name ?? 'project')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'project';
};

export const projectTitle = (projectData?: ProjectModel): string =>
  (projectData?.name ?? 'Projet').trim() || 'Projet';

export function buildPackageJson(options: {
  projectData?: ProjectModel;
  scripts: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}): string {
  const { projectData, scripts, dependencies, devDependencies } = options;

  return json({
    name: packageName(projectData),
    private: true,
    version: '0.0.0',
    type: 'module',
    scripts,
    dependencies: sortKeys({ ...BASE_DEPENDENCIES, ...dependencies }),
    devDependencies: sortKeys({ ...BASE_DEV_DEPENDENCIES, ...devDependencies }),
  });
}

const sortKeys = (record: Record<string, string>): Record<string, string> =>
  Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));

export const VITE_CONFIG = `import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // '@' pointe sur src/ : c'est la convention que shadcn/ui, Magic UI et
  // Aceternity écrivent dans leurs composants. Sans cet alias, un composant
  // installé par le CLI ne résout pas ses propres imports.
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Les fichiers .js de src/ sont lus comme du JSX.
  //
  // Un modèle met tôt ou tard une balise dans un fichier de données — un logo
  // stylé dans src/content/footer.js, par exemple. Sans cette ligne, Vite
  // s'arrête sur « content contains invalid JS syntax » et toute la page
  // disparaît derrière un écran d'erreur, pour un détail de présentation.
  // Le JSX valide reste du JS valide : rien d'autre ne change.
  esbuild: {
    loader: 'jsx',
    include: new RegExp('src/.*[.][jt]sx?$'),
    // Vite exclut les .js de cette transformation par défaut : sans ce
    // tableau vide, l'option ci-dessus ne s'applique à rien.
    exclude: [],
  },
  optimizeDeps: { esbuildOptions: { loader: { '.js': 'jsx' } } },
  server: { host: true, port: 5173 },
});
`;

/** Même alias pour les outils qui lisent la configuration du projet (CLI shadcn). */
export const JSCONFIG = `{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  }
}
`;

/**
 * `components.json` : ce qui rend le projet installable par le CLI shadcn, et
 * par les registres qui s'appuient dessus (Magic UI, Aceternity).
 *
 * \`cssVariables: false\` avec \`baseColor: neutral\` est délibéré. Les composants
 * arrivent alors habillés d'utilitaires \`neutral-*\` — or notre rampe neutre est
 * déjà teintée par la couleur de marque du projet. Un composant installé est
 * donc à la charte sans qu'aucune variable n'ait à être redéfinie, et sans
 * collision avec nos propres jetons.
 */
export const componentsJson = (cssPath: string): string => `{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": false,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "${cssPath}",
    "baseColor": "neutral",
    "cssVariables": false,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "ui": "@/components/ui",
    "utils": "@/lib/utils",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "registries": {
    "@magicui": "https://magicui.design/r/{name}.json",
    "@aceternity": "https://ui.aceternity.com/registry/{name}.json"
  }
}
`;

export const POSTCSS_CONFIG = `export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
`;

const ramp = (record: Record<string, string>, indent: string): string =>
  Object.entries(record)
    .map(([stop, value]) => `${indent}  ${/^\d/.test(stop) ? `'${stop}'` : stop}: '${value}',`)
    .join('\n');

/**
 * Signature du socle, écrite en tête de `tailwind.config.js`.
 *
 * C'est à elle que l'atelier reconnaît un projet généré sur un socle, y compris
 * rouvert depuis une autre machine où aucun marqueur local n'existe. La même
 * chaîne est attendue côté client (`utils/scaffoldLock.ts`) : la changer ici
 * sans la changer là-bas rendrait le verrou muet.
 */
export const SCAFFOLD_SIGNATURE = 'posée par IDEM';

/**
 * `tailwind.config.js` complet, jetons compris.
 *
 * C'est le fichier qui faisait le plus de dégâts quand le modèle l'écrivait :
 * la palette vérifiée en contraste y arrivait amputée d'un cran sur deux.
 */
export function buildTailwindConfig(system: DesignSystem, contentGlobs: string[]): string {
  const { colors, fonts, typeScale, direction } = system;

  const serifStack = direction.id === 'editorial-serif' ? "'Georgia', 'serif'" : "'system-ui', 'sans-serif'";

  const sizes = Object.entries(typeScale)
    .map(([name, size]) => `        '${name}': '${size}',`)
    .join('\n');

  return `/**
 * Charte du projet, ${SCAFFOLD_SIGNATURE} — NE PAS MODIFIER.
 * La palette est déjà vérifiée en contraste (AA) et les familles sont celles de
 * la marque. Utilisez ces noms de jetons dans les classes, jamais un hexadécimal.
 */
export default {
  content: [${contentGlobs.map((glob) => `'${glob}'`).join(', ')}],
  theme: {
    extend: {
      colors: {
        brand: {
${ramp(colors.brand, '        ')}
        },
        neutral: {
${ramp(colors.neutral, '        ')}
        },
        accent: '${colors.accent}',
        secondary: '${colors.secondary}',
        surface: '${colors.surface}',
        'surface-raised': '${colors.surfaceRaised}',
        ink: '${colors.ink}',
        'ink-muted': '${colors.inkMuted}',
        // Le texte posé sur la marque et sur l'accent : blanc ou encre, celui
        // qui se lit. Une primaire claire rendait le blanc illisible.
        'on-brand': '${colors.onBrand}',
        'on-accent': '${colors.onAccent}',
      },
      fontFamily: {
        display: ['${fonts.display}', ${serifStack}],
        sans: ['${fonts.body}', 'system-ui', 'sans-serif'],
        mono: ['${fonts.mono}', 'monospace'],
      },
      fontSize: {
${sizes}
      },
      borderRadius: {
        none: '0',
        sm: '${Math.max(0, Math.round(direction.radius / 2))}px',
        DEFAULT: '${direction.radius}px',
        md: '${direction.radius}px',
        lg: '${direction.radius * 2}px',
        xl: '${direction.radius * 3}px',
        full: '9999px',
      },
      spacing: {
        section: '${direction.spacingBase * 8}px',
        block: '${direction.spacingBase * 3}px',
        tight: '${direction.spacingBase}px',
      },
      maxWidth: { measure: '68ch' },
      zIndex: {
        dropdown: '1000',
        sticky: '1100',
        backdrop: '1200',
        modal: '1300',
        toast: '1400',
        tooltip: '1500',
      },
    },
  },
  plugins: [],
};
`;
}

/**
 * Feuille de base : les couches Tailwind, les familles de la charte posées sur
 * `body` et les titres, et le strict nécessaire d'accessibilité (anneau de
 * focus visible, titres équilibrés). Rien de décoratif : la direction
 * artistique appartient aux écrans.
 */
export function buildBaseCss(system: DesignSystem, extra = ''): string {
  const { fonts, direction } = system;
  const serifStack = direction.id === 'editorial-serif' ? 'Georgia, serif' : 'system-ui, sans-serif';

  return `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    font-family: '${fonts.body}', system-ui, sans-serif;
    background-color: theme('colors.surface');
    color: theme('colors.ink');
    -webkit-font-smoothing: antialiased;
  }

  h1,
  h2,
  h3 {
    font-family: '${fonts.display}', ${serifStack};
    text-wrap: balance;
  }

  :focus-visible {
    outline: 2px solid theme('colors.accent');
    outline-offset: 2px;
  }
}
${extra}`;
}

/** Les liens Google Fonts de la charte, un par famille (voir tokenForge). */
export const fontLinks = (system: DesignSystem): string =>
  [
    '    <link rel="preconnect" href="https://fonts.googleapis.com" />',
    '    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
    ...system.fontsHrefs.map((href) => `    <link rel="stylesheet" href="${href}" />`),
  ].join('\n');

/**
 * Les composants installés par le CLI importent \`cn\` depuis \`@/lib/utils\`.
 * Le socle écrit donc le même utilitaire aux deux emplacements : le nôtre
 * (\`lib/cn.js\`, explicite) et celui qu'attend l'écosystème.
 */
export const CN_UTILS = `export { cn } from './cn.js';
`;

export const CN_HELPER = `import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Compose des classes Tailwind ; la dernière gagne en cas de conflit. */
export const cn = (...classes) => twMerge(clsx(classes));
`;

/**
 * Trousse de composants.
 *
 * Posée par le code et branchée sur les jetons de la charte. Le modèle les
 * assemble au lieu de réécrire un bouton par projet : moins de jetons, et un
 * bouton qui a la bonne couleur, la bonne hauteur de cible tactile et un état
 * de focus visible à tous les coups.
 */
export function buildUiKit(): Record<string, string> {
  return {
    'src/ui/Button.jsx': `import { cn } from '../lib/cn.js';

const VARIANTS = {
  primary: 'bg-brand-600 text-on-brand hover:bg-brand-700',
  secondary: 'bg-surface-raised text-ink border border-neutral-200 hover:border-neutral-400',
  accent: 'bg-accent text-on-accent hover:opacity-90',
  ghost: 'text-ink hover:bg-surface-raised',
};

const SIZES = {
  sm: 'min-h-[40px] px-3 text-sm',
  md: 'min-h-[44px] px-5 text-base',
  lg: 'min-h-[52px] px-7 text-lg',
};

/** Bouton ou lien : passez \`as="a"\` et \`href\` pour un lien. */
export default function Button({
  as: Tag = 'button',
  variant = 'primary',
  size = 'md',
  className,
  ...props
}) {
  return (
    <Tag
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded font-medium transition-colors disabled:opacity-50',
        VARIANTS[variant] ?? VARIANTS.primary,
        SIZES[size] ?? SIZES.md,
        className,
      )}
      {...props}
    />
  );
}
`,
    'src/ui/Card.jsx': `import { cn } from '../lib/cn.js';

export default function Card({ as: Tag = 'div', className, ...props }) {
  return (
    <Tag
      className={cn('rounded-lg border border-neutral-200 bg-surface-raised p-block', className)}
      {...props}
    />
  );
}
`,
    'src/ui/Badge.jsx': `import { cn } from '../lib/cn.js';

export default function Badge({ className, ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-sm text-brand-700',
        className,
      )}
      {...props}
    />
  );
}
`,
    'src/ui/Field.jsx': `import { useId } from 'react';
import { cn } from '../lib/cn.js';

/** Libellé, champ, aide et erreur reliés par les bons attributs ARIA. */
export default function Field({ label, hint, error, children, className }) {
  const id = useId();
  const hintId = hint ? \`\${id}-hint\` : undefined;
  const errorId = error ? \`\${id}-error\` : undefined;

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children({ id, 'aria-describedby': [hintId, errorId].filter(Boolean).join(' ') || undefined, 'aria-invalid': error ? true : undefined })}
      {hint && !error && (
        <p id={hintId} className="text-sm text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-brand-700">
          {error}
        </p>
      )}
    </div>
  );
}
`,
    'src/ui/Input.jsx': `import { cn } from '../lib/cn.js';

export default function Input({ as: Tag = 'input', className, ...props }) {
  return (
    <Tag
      className={cn(
        'min-h-[44px] w-full rounded border border-neutral-200 bg-surface px-3 text-ink placeholder:text-ink-muted',
        className,
      )}
      {...props}
    />
  );
}
`,
    'src/ui/Section.jsx': `import { cn } from '../lib/cn.js';

/** Section de page : rythme vertical et largeur de lecture de la charte. */
export default function Section({ as: Tag = 'section', className, children, ...props }) {
  return (
    <Tag className={cn('px-6 py-section', className)} {...props}>
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </Tag>
  );
}
`,
    'src/ui/EmptyState.jsx': `export default function EmptyState({ title, description, action }) {
  return (
    <div className="flex flex-col items-center gap-2 py-section text-center">
      <p className="text-lg font-medium text-ink">{title}</p>
      {description && <p className="max-w-measure text-ink-muted">{description}</p>}
      {action}
    </div>
  );
}
`,
    'src/ui/Spinner.jsx': `export default function Spinner({ label = 'Chargement…' }) {
  return (
    <span role="status" aria-live="polite" className="inline-flex items-center gap-2 text-ink-muted">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-200 border-t-brand-600" />
      <span className="text-sm">{label}</span>
    </span>
  );
}
`,
    'src/ui/index.js': `export { default as Badge } from './Badge.jsx';
export { default as Button } from './Button.jsx';
export { default as Card } from './Card.jsx';
export { default as EmptyState } from './EmptyState.jsx';
export { default as Field } from './Field.jsx';
export { default as Input } from './Input.jsx';
export { default as Section } from './Section.jsx';
export { default as Spinner } from './Spinner.jsx';
`,
  };
}

/** Les chemins de la trousse, verrouillés comme le reste de la configuration. */
export const UI_KIT_PATHS = Object.keys(buildUiKit());

/**
 * Le logo tel qu'il sera servi par le site.
 *
 * `path` : fichier déposé dans le projet (`public/brand/logo.svg`), servi à la
 * racine du site. `dataUri` : image matricielle embarquée. `remote` : l'adresse
 * d'origine, quand rien n'a pu être récupéré.
 */
export interface BrandLogoSource {
  path?: string;
  dataUri?: string;
  remote?: string;
  inlineSvg?: string;
}

/**
 * La marque, posée par le code.
 *
 * Le logo est une donnée du projet : le serveur l'a sous la main, et le faire
 * transiter par le modèle est le plus sûr moyen de le perdre. Il est lu avec
 * les mêmes emplacements et les mêmes replis que la charte (cf. `charter.ts`),
 * puis rendu depuis le fichier déposé dans le projet quand c'est possible.
 */
export function buildBrandMark(projectData: ProjectModel | undefined, source?: BrandLogoSource): string {
  const name = projectTitle(projectData).replace(/`/g, '');
  const logo = projectData?.analysisResultModel?.branding?.logo as unknown;
  const declared = resolveHeaderLogo(logo);

  const src = source ?? (declared ? (declared.startsWith('<') ? { inlineSvg: declared } : { remote: declared }) : {});
  const wordmark = `<span className="font-display text-xl tracking-tight">${name}</span>`;

  let constant = '';
  let mark = '';

  if (src.path || src.dataUri || src.remote) {
    constant = `const LOGO_SRC = ${JSON.stringify(src.path ?? src.dataUri ?? src.remote)};\n\n`;
    mark = `<img src={LOGO_SRC} alt=${JSON.stringify(name)} className="h-9 w-auto" />`;
  } else if (src.inlineSvg && src.inlineSvg.length <= 20000) {
    constant = `const LOGO_SVG = ${JSON.stringify(src.inlineSvg)};\n\n`;
    mark = `<span className="inline-block h-9 [&>svg]:h-full [&>svg]:w-auto" role="img" aria-label=${JSON.stringify(name)} dangerouslySetInnerHTML={{ __html: LOGO_SVG }} />`;
  }

  return `/**
 * Marque du projet — posée par IDEM depuis la charte.
 *
 * Utilisée par la navigation et le pied de page. Le texte passé en \`fallback\`
 * ne sert que si ce projet n'a pas de logo.
 */
${constant}export const BRAND_NAME = ${JSON.stringify(name)};

export default function BrandMark({ fallback }) {
  ${mark ? `return ${mark};` : `return fallback ? <span className="font-display text-xl tracking-tight">{fallback}</span> : ${wordmark};`}
}
`;
}
