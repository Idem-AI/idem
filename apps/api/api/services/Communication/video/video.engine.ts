/**
 * Le moteur React des vidéos, empaqueté pour la page de rendu.
 *
 * Sources : `apps/api/video-engine/src` (TSX + Tailwind v4). Paquets produits par
 * `npm run build:video-engine` (appelé par `npm run build`) dans `public/video-engine/` :
 *
 *   runtime.js        React 19 + ReactDOM, partagés (window.__IDEM_RT__)
 *   engine.js         le moteur : scènes, techniques, transitions, kit, styles
 *   addon-<id>.js     une bibliothèque lourde chacun (three/R3F, GSAP, anime.js,
 *                     flubber, Lottie, Rive, Chart.js, visx + d3, rough + pinceau +
 *                     bruit, Zdog) : la page ne charge que ceux que le graphe de
 *                     capacités retient pour la vidéo
 *
 * Ordre dans la page : runtime → addons → engine (les addons s'inscrivent dans
 * window.__IDEM_ADDONS__ avant le premier rendu). Les addons importent React par
 * le runtime partagé : une seule instance de React dans la page.
 *
 * Tailwind est compilé au moment du paquet, à partir des classes réellement
 * écrites dans les sources ; sa palette par défaut est retirée (`--color-*:
 * initial`) : seules les couleurs de la charte existent dans les classes.
 *
 * En développement, les paquets sont reconstruits à la demande si une source est
 * plus récente ; en production (image Docker), seuls les paquets sont présents.
 */
import fs from 'fs';
import path from 'path';
import logger from '../../../config/logger';

/** Les addons du moteur, un paquet chacun. */
export const ADDON_IDS = ['three', 'gsap', 'anime', 'flubber', 'lottie', 'rive', 'chart', 'viz', 'draw', 'zdog'] as const;
export type AddonId = (typeof ADDON_IDS)[number];

const BUNDLES: Record<string, string> = {
  runtime: 'runtime.ts',
  engine: 'index.tsx',
  ...Object.fromEntries(ADDON_IDS.map((id) => [`addon-${id}`, `addons/${id}.ts${id === 'three' ? 'x' : ''}`])),
};

const SOURCE_DIR = (): string | null => {
  const candidates = [path.resolve(process.cwd(), 'video-engine/src'), path.resolve(__dirname, '../../../../video-engine/src')];
  return candidates.find((dir) => fs.existsSync(path.join(dir, 'index.tsx'))) || null;
};

const OUT_DIR = (): string => {
  const candidates = [path.resolve(process.cwd(), 'public/video-engine'), path.resolve(__dirname, '../../../../public/video-engine')];
  return candidates.find((d) => fs.existsSync(path.join(d, 'engine.js'))) || candidates[0];
};

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}

function newestSource(dir: string): number {
  return Math.max(...walk(dir).map((f) => fs.statSync(f).mtimeMs));
}

/** React vient du runtime partagé, jamais d'une copie embarquée dans un addon. */
const SHARED: Record<string, string> = {
  react: 'React',
  'react-dom': 'ReactDOM',
  'react-dom/client': 'ReactDOMClient',
  'react/jsx-runtime': 'JSX',
  'react/jsx-dev-runtime': 'JSX',
};

function sharedReactPlugin() {
  return {
    name: 'shared-react',
    setup(build: any) {
      build.onResolve({ filter: /^react(-dom)?(\/client|\/jsx-runtime|\/jsx-dev-runtime)?$/ }, (args: any) => ({ path: args.path, namespace: 'shared-react' }));
      build.onLoad({ filter: /.*/, namespace: 'shared-react' }, (args: any) => ({
        contents: `module.exports = window.__IDEM_RT__.${SHARED[args.path]};`,
        loader: 'js',
      }));
    },
  };
}

/** Les classes candidates : tout mot des sources (Tailwind écarte ce qui n'en est pas). */
function candidates(src: string): string[] {
  const set = new Set<string>();
  for (const file of walk(src)) {
    if (!/\.(tsx?|css)$/.test(file)) continue;
    for (const token of fs.readFileSync(file, 'utf8').split(/[\s"'`{}]+/)) if (token && token.length < 120) set.add(token);
  }
  return [...set];
}

/** Tailwind v4 (thème de la vidéo + utilitaires) puis la feuille du moteur, dans l'ordre des couches. */
export async function buildEngineCss(src: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { compile } = require('tailwindcss');
  const twDir = path.dirname(require.resolve('tailwindcss/package.json'));
  const compiler = await compile(fs.readFileSync(path.join(src, 'tailwind.css'), 'utf8'), {
    base: src,
    loadStylesheet: async (id: string, base: string) => {
      const file = id === 'tailwindcss' ? path.join(twDir, 'index.css') : id.startsWith('tailwindcss/') ? path.join(twDir, id.slice('tailwindcss/'.length)) : path.resolve(base, id);
      return { path: file, base: path.dirname(file), content: fs.readFileSync(file, 'utf8') };
    },
  });
  const tw = compiler.build(candidates(src)) as string;
  const engine = fs.readFileSync(path.join(src, 'engine.css'), 'utf8');
  // Garde-fou : une classe du moteur qui porte le nom d'un utilitaire Tailwind serait
  // écrasée en silence (la couche utilitaires gagne). Ex. vécu : `.list-item` (display:
  // list-item) cassait les listes. Le paquet refuse de se construire.
  const engineClasses = new Set([...engine.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]));
  const clash = [...tw.matchAll(/^\s*\.([a-zA-Z][\w-]*)\s*\{/gm)].map((m) => m[1]).filter((c) => engineClasses.has(c));
  if (clash.length) throw new Error(`engine.css : classe(s) en collision avec Tailwind, à renommer : ${[...new Set(clash)].join(', ')}`);
  return `${tw}\n@layer engine{\n${engine}\n}`;
}

export interface EngineBundles {
  runtime: string;
  engine: string;
  addons: Record<AddonId, string>;
}

/** Construit tous les paquets avec esbuild. */
export async function buildVideoEngine(outDir = OUT_DIR()): Promise<EngineBundles> {
  const src = SOURCE_DIR();
  if (!src) throw new Error('video-engine sources not found');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const esbuild = require('esbuild');
  const css = await buildEngineCss(src);
  const cssPlugin = {
    name: 'engine-css',
    setup(build: any) {
      build.onResolve({ filter: /^virtual:engine-css$/ }, () => ({ path: 'engine-css', namespace: 'engine-css' }));
      build.onLoad({ filter: /.*/, namespace: 'engine-css' }, () => ({ contents: `export default ${JSON.stringify(css)};`, loader: 'js' }));
    },
  };
  const out: Record<string, string> = {};
  for (const [name, entry] of Object.entries(BUNDLES)) {
    const result = await esbuild.build({
      entryPoints: [path.join(src, entry)],
      bundle: true,
      format: 'iife',
      minify: true,
      write: false,
      target: 'es2020',
      jsx: 'automatic',
      // Le runtime embarque React ; tous les autres paquets le partagent.
      plugins: name === 'runtime' ? [] : [sharedReactPlugin(), cssPlugin],
      loader: { '.wasm': 'binary' },
      define: { 'process.env.NODE_ENV': '"production"' },
      legalComments: 'none',
      logLevel: 'error',
    });
    out[name] = result.outputFiles[0].text as string;
  }
  fs.mkdirSync(outDir, { recursive: true });
  for (const [name, js] of Object.entries(out)) fs.writeFileSync(path.join(outDir, `${name}.js`), js);
  fs.writeFileSync(
    path.join(outDir, 'manifest.json'),
    JSON.stringify({ builtAt: new Date().toISOString(), sizes: Object.fromEntries(Object.entries(out).map(([k, v]) => [k, Math.round(v.length / 1024)])) }, null, 2)
  );
  return {
    runtime: out.runtime,
    engine: out.engine,
    addons: Object.fromEntries(ADDON_IDS.map((id) => [id, out[`addon-${id}`]])) as Record<AddonId, string>,
  };
}

let cached: { bundles: EngineBundles; at: number } | null = null;
let building: Promise<EngineBundles> | null = null;

function readBundles(dir: string): EngineBundles {
  const read = (n: string) => fs.readFileSync(path.join(dir, `${n}.js`), 'utf8');
  return { runtime: read('runtime'), engine: read('engine'), addons: Object.fromEntries(ADDON_IDS.map((id) => [id, read(`addon-${id}`)])) as Record<AddonId, string> };
}

/** Les paquets du moteur : reconstruits si les sources ont changé (développement). */
export async function engineBundles(): Promise<EngineBundles> {
  const dir = OUT_DIR();
  const src = SOURCE_DIR();
  const stamp = path.join(dir, 'manifest.json');
  const complete = Object.keys(BUNDLES).every((n) => fs.existsSync(path.join(dir, `${n}.js`)));
  const builtAt = complete && fs.existsSync(stamp) ? fs.statSync(stamp).mtimeMs : 0;
  if (src && newestSource(src) > builtAt) {
    building ??= (async () => {
      logger.info('video.engine.rebuild');
      try {
        const bundles = await buildVideoEngine(dir);
        cached = { bundles, at: Date.now() };
        return bundles;
      } finally {
        building = null;
      }
    })();
    return building;
  }
  if (cached && cached.at >= builtAt) return cached.bundles;
  if (!builtAt) throw new Error('video engine bundles missing: run npm run build:video-engine');
  cached = { bundles: readBundles(dir), at: builtAt };
  return cached.bundles;
}

/** Le moteur seul (compatibilité). */
export async function engineBundle(): Promise<string> {
  return (await engineBundles()).engine;
}
