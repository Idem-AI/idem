/**
 * L'APERÇU INSTANTANÉ des sites vitrines.
 *
 * L'aperçu de l'atelier tournait dans une WebContainer : Node dans un onglet, `node_modules` monté (17 Mo), Vite
 * démarré, esbuild en WebAssembly — 14 à 35 s avant la première page (journaux `chat.startup`, 11-13/11/2026). Ici,
 * rien de tout cela dans le navigateur :
 *
 *   dépendances  React, Motion, Radix, Lucide… regroupées UNE fois par le serveur en modules ES (`vendor`), servies
 *                avec une empreinte de version et gardées en cache par le navigateur ; la page les trouve par un
 *                import map
 *   code         le code du site (envoyé par l'atelier, fichier par fichier) regroupé par esbuild natif, une entrée
 *                par page, en mode incrémental : une section modifiée, quelques dizaines de millisecondes
 *   style        Tailwind 3 côté serveur, avec la configuration et la feuille du projet, comme à la construction
 *   page         un document par page du site (titre, langue, polices du design system), qui reprend chaque
 *                changement sans recharger (le flux `events` dit quoi relire)
 *
 * Le code du site ne s'exécute jamais sur le serveur : il y est seulement regroupé. Il s'exécute dans l'iframe de
 * l'atelier, servi avec `Content-Security-Policy: sandbox` (origine opaque : ni cookie ni stockage du domaine).
 *
 * Les paquets viennent de `PREVIEW_RUNTIME_DIR` (par défaut `site-runtime/node_modules`, les mêmes versions que le
 * template). Il faut en plus tailwindcss 3, postcss, autoprefixer et tailwindcss-animate : absents, l'aperçu se dit
 * indisponible et l'atelier garde la WebContainer.
 */
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';
import { compiler } from '../siteEngine/template.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(HERE, '..', '..');

/** Les modules que le code d'un site peut importer (ceux du template, sous-chemins compris). */
export const VENDOR_SPECIFIERS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  'motion/react',
  'lucide-react',
  'clsx',
  'tailwind-merge',
  'class-variance-authority',
  '@radix-ui/react-accordion',
  '@radix-ui/react-avatar',
  '@radix-ui/react-checkbox',
  '@radix-ui/react-dialog',
  '@radix-ui/react-dropdown-menu',
  '@radix-ui/react-label',
  '@radix-ui/react-popover',
  '@radix-ui/react-radio-group',
  '@radix-ui/react-select',
  '@radix-ui/react-separator',
  '@radix-ui/react-slot',
  '@radix-ui/react-switch',
  '@radix-ui/react-tabs',
  '@radix-ui/react-tooltip',
  'date-fns',
  'date-fns/locale',
  'embla-carousel-react',
  'react-hook-form',
  'zod',
];

const CSS_PACKAGES = ['tailwindcss', 'postcss', 'autoprefixer', 'tailwindcss-animate'];

/* -------------------------------------------------------------------------- */
/*  Les paquets                                                                */
/* -------------------------------------------------------------------------- */

export function runtimeDir(): string {
  return process.env.PREVIEW_RUNTIME_DIR || join(APP_ROOT, 'site-runtime', 'node_modules');
}

const requireFrom = (dir: string) => createRequire(join(dir, 'noop.js'));

const versionOf = (dir: string, name: string): string | null => {
  try {
    return JSON.parse(readFileSync(join(dir, name, 'package.json'), 'utf8')).version ?? null;
  } catch {
    return null;
  }
};

/** Ce que l'aperçu instantané peut faire ici, et sinon pourquoi. */
export function availability(): { available: boolean; reason?: string } {
  if ((process.env.PREVIEW_FAST ?? 'on').toLowerCase() === 'off') return { available: false, reason: 'désactivé (PREVIEW_FAST=off)' };
  const dir = runtimeDir();
  const missing = [...new Set(VENDOR_SPECIFIERS.map((spec) => (spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]))), ...CSS_PACKAGES].filter(
    (name) => !existsSync(join(dir, name, 'package.json'))
  );
  if (missing.length) return { available: false, reason: `paquets absents de ${dir} : ${missing.join(', ')}` };
  const tailwind = versionOf(dir, 'tailwindcss');
  if (!tailwind?.startsWith('3.')) return { available: false, reason: `tailwindcss ${tailwind} : la version 3 est attendue (celle du template)` };
  return { available: true };
}

/* -------------------------------------------------------------------------- */
/*  Les dépendances, regroupées une fois                                       */
/* -------------------------------------------------------------------------- */

export interface Vendor {
  fingerprint: string;
  /** Le fichier servi pour chaque module importable. */
  imports: Record<string, string>;
  files: Map<string, Uint8Array>;
}

let vendorPromise: Promise<Vendor> | null = null;

const safeName = (spec: string) => spec.replace(/^@/, '').replace(/[^a-zA-Z0-9]+/g, '-');
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** Les noms exportés d'un module, lus en le chargeant dans Node (un module CommonJS n'en déclare aucun). */
async function exportNames(dir: string, spec: string): Promise<string[]> {
  const req = requireFrom(dir);
  let mod: Record<string, unknown>;
  try {
    mod = req(spec) as Record<string, unknown>;
  } catch {
    mod = (await import(pathToFileURL(req.resolve(spec)).href)) as Record<string, unknown>;
  }
  return Object.keys(mod).filter((name) => name !== 'default' && name !== '__esModule' && IDENTIFIER.test(name));
}

/**
 * Les dépendances en modules ES, une entrée par module importable et des morceaux partagés (une seule copie de
 * React). Gardées sur disque par empreinte (versions des paquets et d'esbuild) : un redémarrage du serveur ne les
 * refait pas.
 */
export function vendor(): Promise<Vendor> {
  vendorPromise ??= buildVendor().catch((error) => {
    vendorPromise = null;
    throw error;
  });
  return vendorPromise;
}

async function buildVendor(): Promise<Vendor> {
  const dir = runtimeDir();
  const versions = VENDOR_SPECIFIERS.map((spec) => {
    const name = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
    return `${spec}@${versionOf(dir, name)}`;
  });
  const fingerprint = createHash('sha256').update(`${esbuild.version}|${versions.join(',')}|2`).digest('hex').slice(0, 16);
  const cacheDir = join(process.env.APPGEN_DEPS_CACHE_DIR || join(APP_ROOT, 'deps-cache'), 'preview-vendor', fingerprint);
  const manifestPath = join(cacheDir, 'manifest.json');

  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { imports: Record<string, string>; files: string[] };
    const files = new Map(manifest.files.map((name) => [name, new Uint8Array(readFileSync(join(cacheDir, name)))]));
    return { fingerprint, imports: manifest.imports, files };
  }

  const entries: Record<string, string> = {};
  for (const spec of VENDOR_SPECIFIERS) {
    const names = await exportNames(dir, spec);
    // Chaque nom repris un à un, par alias : un module CommonJS (React) n'en déclare aucun, et certains sont des mots
    // réservés (`enum`, `function` chez zod) qu'aucune déclaration ne peut porter.
    entries[safeName(spec)] = [
      `import * as __m from ${JSON.stringify(spec)};`,
      `export default (__m.default !== undefined ? __m.default : __m);`,
      ...names.map((name, i) => `const __e${i} = __m[${JSON.stringify(name)}];\nexport { __e${i} as ${name} };`),
    ].join('\n');
  }

  const result = await esbuild.build({
    entryPoints: Object.keys(entries).map((name) => ({ in: `vendor-entry:${name}`, out: name })),
    bundle: true,
    splitting: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2020',
    minify: true,
    write: false,
    outdir: '/vendor',
    chunkNames: 'chunk-[hash]',
    nodePaths: [dir],
    define: { 'process.env.NODE_ENV': '"development"' },
    logLevel: 'silent',
    plugins: [
      {
        name: 'vendor-entries',
        setup(build) {
          build.onResolve({ filter: /^vendor-entry:/ }, (args) => ({ path: args.path.slice('vendor-entry:'.length), namespace: 'vendor-entry' }));
          build.onLoad({ filter: /.*/, namespace: 'vendor-entry' }, (args) => ({ contents: entries[args.path], resolveDir: dir, loader: 'js' }));
        },
      },
    ],
  });

  const files = new Map<string, Uint8Array>();
  for (const file of result.outputFiles) files.set(posix.basename(file.path), file.contents);
  const imports = Object.fromEntries(VENDOR_SPECIFIERS.map((spec) => [spec, `${safeName(spec)}.js`]));

  try {
    mkdirSync(cacheDir, { recursive: true });
    for (const [name, contents] of files) writeFileSync(join(cacheDir, name), contents);
    writeFileSync(manifestPath, JSON.stringify({ imports, files: [...files.keys()] }));
  } catch {
    /* disque en lecture seule : on garde la version en mémoire */
  }
  return { fingerprint, imports, files };
}

/* -------------------------------------------------------------------------- */
/*  Tailwind                                                                   */
/* -------------------------------------------------------------------------- */

type Processor = (css: string, config: unknown) => Promise<string>;
let processorPromise: Promise<Processor> | null = null;

function cssProcessor(): Promise<Processor> {
  processorPromise ??= (async () => {
    const req = requireFrom(runtimeDir());
    const postcss = req('postcss') as typeof import('postcss').default;
    const tailwind = req('tailwindcss') as (config: unknown) => import('postcss').AcceptedPlugin;
    const autoprefixer = req('autoprefixer') as import('postcss').AcceptedPlugin;
    return async (css: string, config: unknown) => (await postcss([tailwind(config), autoprefixer]).process(css, { from: undefined })).css;
  })();
  return processorPromise;
}

/** La configuration Tailwind du projet, évaluée avec ses imports (`tailwindcss-animate`) pris dans les paquets. */
const configCache = new Map<string, Promise<Record<string, unknown>>>();
function tailwindConfig(source: string): Promise<Record<string, unknown>> {
  const key = createHash('sha1').update(source).digest('hex');
  if (!configCache.has(key)) {
    configCache.set(
      key,
      (async () => {
        const out = await esbuild.build({
          stdin: { contents: source, loader: 'js', resolveDir: runtimeDir(), sourcefile: 'tailwind.config.js' },
          bundle: true,
          format: 'esm',
          platform: 'node',
          write: false,
          nodePaths: [runtimeDir()],
          logLevel: 'silent',
        });
        const url = `data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`;
        return ((await import(url)) as { default: Record<string, unknown> }).default;
      })()
    );
  }
  return configCache.get(key)!;
}

/**
 * Prépare tout ce qui ne dépend pas d'un site : dépendances regroupées (ou relues du disque), Tailwind chargé et sa
 * première compilation faite, configuration du template évaluée. Lancé au démarrage du serveur : la première session
 * ne paie plus ces secondes-là (4 à 4,5 s mesurées le 19/11 à froid, contre 0,6 à 0,8 s à chaud).
 */
export async function warmUp(templateConfigSource?: string): Promise<{ ms: number }> {
  const started = Date.now();
  if (!availability().available) return { ms: 0 };
  const [, processor, config] = await Promise.all([vendor(), cssProcessor(), tailwindConfig(templateConfigSource ?? 'export default {}')]);
  await processor('@tailwind base;\n@tailwind utilities;\n', { ...config, content: [{ raw: '<div class="flex p-4"></div>', extension: 'html' }] });
  return { ms: Date.now() - started };
}

/* -------------------------------------------------------------------------- */
/*  Les sessions                                                               */
/* -------------------------------------------------------------------------- */

export interface PreviewPage {
  path: string;
  lang: string;
  module: string;
  title: string;
  key: string;
}

export interface BuildState {
  version: number;
  ok: boolean;
  error?: string;
  ms?: number;
}

const SOURCE_EXT = ['', '.tsx', '.ts', '.jsx', '.js', '.mjs', '.json', '/index.tsx', '/index.ts', '/index.jsx', '/index.js'];
const LOADERS: Record<string, esbuild.Loader> = { '.tsx': 'tsx', '.ts': 'ts', '.jsx': 'jsx', '.js': 'jsx', '.mjs': 'js', '.json': 'json', '.svg': 'text', '.txt': 'text' };

/** Un fichier du projet, sans le `/` de tête ni `./`. */
const norm = (path: string) => posix.normalize(path.replace(/^\/+/, '').replace(/^\.\//, ''));

export class PreviewSession {
  readonly id = randomBytes(18).toString('base64url');
  readonly files = new Map<string, string>();
  lastUsed = Date.now();
  state: BuildState = { version: 0, ok: false };
  /** La dernière version construite sans erreur (0 : aucune encore). Ses fichiers restent servis tant qu'une version cassée la suit. */
  goodVersion = 0;
  outputs = new Map<string, Uint8Array>();
  css = '';
  cssVersion = 0;
  private context: esbuild.BuildContext | null = null;
  private entriesKey = '';
  private running: Promise<BuildState> | null = null;
  private again = false;
  private readonly listeners = new Set<(event: object) => void>();

  /**
   * @param owner l'utilisateur IDEM de la session
   * @param publicBase l'adresse sous laquelle l'aperçu sert `public/` (un `/brand/pattern.svg` du code y est réécrit)
   */
  constructor(
    readonly owner: string,
    readonly publicBase: string
  ) {}

  /** Les changements de l'atelier (fichiers écrits, fichiers retirés). */
  apply(changed: Record<string, string> = {}, removed: string[] = []) {
    this.lastUsed = Date.now();
    for (const [path, content] of Object.entries(changed)) if (typeof content === 'string') this.files.set(norm(path), content);
    for (const path of removed) this.files.delete(norm(path));
  }

  subscribe(listener: (event: object) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: object) {
    for (const listener of this.listeners) listener(event);
  }

  /** Les pages du site : `src/site/pages.json`, sinon l'accueil seul (socle encore en attente). */
  pages(): PreviewPage[] {
    const raw = this.files.get('src/site/pages.json') ?? this.files.get('idem.pages.json');
    const homeLang = this.files.get('index.html')?.match(/<html[^>]*\slang="([^"]+)"/)?.[1] ?? 'fr';
    const homeTitle = this.files.get('index.html')?.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
    let list: Array<{ path?: string; lang?: string; module?: string; title?: string }> = [];
    try {
      list = raw ? (JSON.parse(raw).pages ?? []) : [];
    } catch {
      list = [];
    }
    const pages = list
      .filter((page) => page.path && page.module && this.files.has(norm(page.module)))
      .map((page) => ({ path: page.path!, lang: page.lang || homeLang, module: norm(page.module!), title: page.title || homeTitle, key: '' }));
    if (!pages.length && this.files.has('src/pages/home.tsx')) pages.push({ path: '/', lang: homeLang, module: 'src/pages/home.tsx', title: homeTitle, key: '' });
    // Une entrée par MODULE (les langues partagent le même code), nommée d'après son chemin : stable quand des pages
    // s'ajoutent ou changent d'ordre en cours de génération (un nom tiré de l'ordre changeait sous la page affichée,
    // qui demandait alors un fichier disparu).
    for (const page of pages) page.key = `page-${page.module.replace(/^src\/pages\//, '').replace(/\.[jt]sx?$/, '').replace(/[^a-zA-Z0-9]+/g, '-')}`;
    return pages;
  }

  /** Reconstruit (une à la fois ; un changement pendant la construction en relance une seule à la suite). */
  build(): Promise<BuildState> {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = (async () => {
      let state: BuildState;
      do {
        this.again = false;
        state = await this.buildOnce();
      } while (this.again);
      this.running = null;
      return state;
    })();
    return this.running;
  }

  private async buildOnce(): Promise<BuildState> {
    const started = Date.now();
    const pages = this.pages();
    const version = this.state.version + 1;
    if (!pages.length) {
      this.state = { version, ok: false, error: 'aucune page à afficher pour l’instant' };
      return this.state;
    }
    try {
      const vendorInfo = await vendor();
      const entries = Object.fromEntries([...new Map(pages.map((page) => [page.key, page.module]))]);
      const key = JSON.stringify(entries);
      if (!this.context || key !== this.entriesKey) {
        await this.context?.dispose();
        this.entriesKey = key;
        this.context = await esbuild.context(this.options(entries, vendorInfo));
      }
      const [result, css] = await Promise.all([this.context.rebuild(), this.buildCss()]);
      const outputs = new Map<string, Uint8Array>();
      for (const file of result.outputFiles ?? []) outputs.set(posix.basename(file.path), file.contents);
      this.outputs = outputs;
      const cssChanged = css !== this.css;
      if (cssChanged) {
        this.css = css;
        this.cssVersion = version;
      }
      this.state = { version, ok: true, ms: Date.now() - started };
      this.goodVersion = version;
      this.emit({ type: 'update', version, cssVersion: this.cssVersion, cssChanged });
    } catch (error) {
      const message = formatError(error);
      this.state = { version, ok: false, error: message, ms: Date.now() - started };
      this.emit({ type: 'error', version, message });
    }
    return this.state;
  }

  private options(entries: Record<string, string>, vendorInfo: Vendor): esbuild.BuildOptions {
    const session = this;
    const publicPaths = () => [...this.files.keys()].filter((path) => path.startsWith('public/')).map((path) => path.slice('public'.length));
    return {
      entryPoints: Object.entries(entries).map(([out, module]) => ({ in: `vfs-entry:${module}`, out })),
      bundle: true,
      splitting: true,
      format: 'esm',
      platform: 'browser',
      target: 'es2020',
      write: false,
      outdir: '/app',
      chunkNames: 'chunk-[hash]',
      jsx: 'automatic',
      jsxImportSource: 'react',
      sourcemap: 'inline',
      logLevel: 'silent',
      define: {
        'process.env.NODE_ENV': '"development"',
        'import.meta.env.DEV': 'true',
        'import.meta.env.PROD': 'false',
        'import.meta.env.MODE': '"development"',
        'import.meta.env.SSR': 'false',
        'import.meta.env.BASE_URL': '"/"',
      },
      plugins: [
        {
          name: 'idem-virtual-fs',
          setup(build) {
            const resolveFile = (path: string): string | null => {
              for (const ext of SOURCE_EXT) if (session.files.has(path + ext)) return path + ext;
              return null;
            };
            // L'entrée d'une page : le module de la page, et les réglages de mouvement du projet s'il en a.
            build.onResolve({ filter: /^vfs-entry:/ }, (args) => ({ path: args.path.slice('vfs-entry:'.length), namespace: 'vfs-entry' }));
            build.onLoad({ filter: /.*/, namespace: 'vfs-entry' }, (args) => ({
              contents: `export { default } from ${JSON.stringify(`/${args.path}`)};\n${session.files.has('src/design-system/index.ts') ? "export { motionTokens } from '@/design-system';\n" : 'export const motionTokens = { respectReducedMotion: true };\n'}`,
              loader: 'js',
              resolveDir: '/',
            }));
            build.onResolve({ filter: /.*/ }, (args) => {
              const spec = args.path.split('?')[0];
              let base: string | null = null;
              if (spec.startsWith('@/')) base = `src/${spec.slice(2)}`;
              else if (spec.startsWith('/')) base = spec.slice(1);
              else if (spec.startsWith('.')) base = posix.join(posix.dirname(args.importer.replace(/^\//, '')), spec);
              if (base === null) {
                // Un paquet : servi par l'import map ; inconnu, c'est une erreur claire (comme Vite).
                if (vendorInfo.imports[spec]) return { path: spec, external: true };
                return { errors: [{ text: `« ${spec} » n'est pas une dépendance du site (importable : ${Object.keys(vendorInfo.imports).slice(0, 8).join(', ')}…)` }] };
              }
              const file = resolveFile(norm(base));
              if (!file) return { errors: [{ text: `fichier introuvable : ${spec} (depuis ${args.importer || 'l’entrée'})` }] };
              return { path: `/${file}`, namespace: 'vfs' };
            });
            build.onLoad({ filter: /.*/, namespace: 'vfs' }, (args) => {
              const path = args.path.slice(1);
              const ext = posix.extname(path);
              // Les feuilles de style passent par Tailwind, à part : rien à regrouper ici.
              if (ext === '.css') return { contents: '', loader: 'js' };
              let contents = session.files.get(path) ?? '';
              // Les fichiers de `public/` cités par leur adresse (`/brand/pattern.svg`) : servis sous l'aperçu.
              const paths = publicPaths();
              if (paths.length && /\.(tsx?|jsx?|mjs)$/.test(ext)) {
                const escaped = paths.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
                contents = contents.replace(new RegExp(`(['"\`(])(${escaped})(?=['"\`)?#])`, 'g'), (_m, quote: string, path: string) => `${quote}${session.publicBase}${path}`);
              }
              return { contents, loader: LOADERS[ext] ?? 'text', resolveDir: posix.dirname(args.path) };
            });
          },
        },
      ],
    };
  }

  /** La feuille du projet (directives Tailwind, design system compilé) passée par Tailwind 3 et sa configuration. */
  private async buildCss(): Promise<string> {
    const entry = this.files.get('src/styles/index.css') ?? '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n';
    const inline = (css: string, from: string, depth = 0): string =>
      css.replace(/@import\s+(?:url\()?['"]([^'"]+)['"]\)?\s*;/g, (statement, target: string) => {
        if (/^(https?:)?\/\//.test(target) || depth > 4) return statement;
        const path = norm(posix.join(posix.dirname(from), target));
        const content = this.files.get(path);
        return content === undefined ? '' : inline(content, path, depth + 1);
      });
    const css = inline(entry, 'src/styles/index.css');
    const config = { ...(await tailwindConfig(this.files.get('tailwind.config.js') ?? 'export default {}')) };
    const sources = [...this.files.entries()]
      .filter(([path]) => /\.(tsx?|jsx?|html)$/.test(path) && !path.startsWith('scripts/') && !path.startsWith('node_modules/'))
      .map(([, content]) => content)
      .join('\n');
    config.content = [{ raw: sources, extension: 'tsx' }];
    return (await cssProcessor())(css, config);
  }

  /** Les polices du design system (liens Google Fonts), comme les pose le plugin du template. */
  fontLinks(): string {
    const source = this.files.get('src/design-system/design-system.json');
    if (!source) return '';
    try {
      return compiler.fontLinksHtml(compiler.compileDesignSystem(JSON.parse(source)).fonts);
    } catch {
      return '';
    }
  }

  async dispose() {
    this.listeners.clear();
    await this.context?.dispose().catch(() => undefined);
    this.context = null;
  }
}

function formatError(error: unknown): string {
  const failure = error as { errors?: esbuild.Message[]; message?: string };
  if (failure.errors?.length) {
    return failure.errors
      .slice(0, 5)
      .map((e) => `${e.location ? `${e.location.file.replace(/^\//, '')}:${e.location.line}:${e.location.column} ` : ''}${e.text}`)
      .join('\n');
  }
  return failure.message ?? String(error);
}
