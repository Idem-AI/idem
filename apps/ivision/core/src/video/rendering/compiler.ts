/**
 * LA COMPILATION — le code TSX écrit par l'IA, tel quel, transformé en JavaScript pour le navigateur.
 *
 * Deux usages :
 *   compileScene     une scène seule : erreurs de syntaxe, imports interdits, `export default` absent.
 *                    C'est une vérification TECHNIQUE (le code s'exécute-t-il ?), jamais esthétique ;
 *   buildFilmBundle  le film : runtime (harnais, Motion Canvas, kit) + toutes les scènes, en un paquet.
 *                    Une scène qui ne compile pas n'y entre pas : le harnais montre son erreur à sa place.
 *
 * Le code n'est jamais réécrit : esbuild le transpile, rien de plus.
 */
import fs from 'fs';
import path from 'path';
import { build, type Plugin } from 'esbuild';

/**
 * Le dossier du runtime navigateur (`apps/ivision/core/motion`) : ses sources sont compilées À LA
 * DEMANDE avec chaque film. Dans une API compilée (`dist/`), les images Docker les copient à côté
 * du code (`dist/apps/ivision/core/motion`) ; `IDEM_MOTION_ROOT` peut l'imposer.
 */
function findMotionRoot(): string {
  const candidates = [
    process.env.IDEM_MOTION_ROOT,
    path.resolve(__dirname, '../../../motion'),
    // Lancé depuis `dist/` sans copie : les sources du dépôt.
    path.resolve(__dirname.replace(/[\\/]dist[\\/](?:apps[\\/]ivision[\\/]api[\\/]dist[\\/])?/, path.sep), '../../../motion'),
  ].filter((c): c is string => !!c);
  return candidates.find((c) => fs.existsSync(path.join(c, 'runtime', 'harness.tsx'))) || candidates[candidates.length - 1];
}

export const MOTION_ROOT = findMotionRoot();

/** Les seuls modules qu'une scène peut importer. */
const ALLOWED_IMPORT = /^(@motion-canvas\/(core|2d)(\/lib(\/[\w./-]+)?)?|@idem\/motion)$/;

export interface SceneCompileResult {
  ok: boolean;
  /** Message lisible (ligne:colonne — texte), quand la compilation échoue. */
  error?: string;
}

const tsconfigRaw = { compilerOptions: { experimentalDecorators: true, useDefineForClassFields: false } };

/** Les imports d'une scène seule : tous externes (rien n'est suivi), et seulement ceux qui sont autorisés. */
const sceneImportGuard: Plugin = {
  name: 'idem-scene-imports',
  setup(b) {
    b.onResolve({ filter: /.*/ }, (args) => {
      if (args.kind === 'entry-point') return undefined;
      if (!ALLOWED_IMPORT.test(args.path)) return { errors: [{ text: `import interdit : « ${args.path} » (seuls @motion-canvas/core, @motion-canvas/2d et @idem/motion sont disponibles)` }] };
      return { path: args.path, external: true };
    });
  },
};

/** Compile une scène seule (rien n'est écrit sur disque). */
export async function compileScene(code: string): Promise<SceneCompileResult> {
  if (!String(code || '').trim()) return { ok: false, error: 'code vide' };
  try {
    const result = await build({
      stdin: { contents: code, loader: 'tsx', resolveDir: MOTION_ROOT, sourcefile: 'scene.tsx' },
      bundle: true,
      write: false,
      outdir: 'out',
      format: 'esm',
      platform: 'browser',
      target: 'es2022',
      jsx: 'automatic',
      jsxImportSource: '@motion-canvas/2d/lib',
      metafile: true,
      logLevel: 'silent',
      tsconfigRaw,
      plugins: [sceneImportGuard],
    });
    const exported = Object.values(result.metafile?.outputs || {}).flatMap((o) => o.exports || []);
    if (!exported.includes('default')) return { ok: false, error: 'la scène doit avoir `export default function* (view, ctx) { … }`' };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: formatEsbuildError(error) };
  }
}

function formatEsbuildError(error: unknown): string {
  const errors = (error as { errors?: { text: string; location?: { line: number; column: number; lineText?: string } | null }[] }).errors;
  if (!errors?.length) return String((error as Error)?.message || error).slice(0, 400);
  return errors
    .slice(0, 3)
    .map((e) => (e.location ? `ligne ${e.location.line}:${e.location.column} — ${e.text}` : e.text))
    .join(' · ')
    .slice(0, 600);
}

export interface BundleScene {
  key: string;
  /** Absent : la scène n'a pas compilé (son erreur est dans les données du film). */
  code?: string;
}

/** Le paquet d'un film : `mode` choisit le pilote (rendu serveur ou lecteur d'aperçu). */
export async function buildFilmBundle(scenes: BundleScene[], mode: 'render' | 'preview'): Promise<string> {
  const usable = scenes.filter((s) => s.code);
  const entry = [
    mode === 'render' ? `import { startRender as start } from './runtime/render';` : `import { startPlayer as start } from './runtime/player';`,
    ...usable.map((s, i) => `import scene${i} from 'scene:${s.key}';`),
    `const modules = { ${usable.map((s, i) => `${JSON.stringify(s.key)}: scene${i}`).join(', ')} };`,
    mode === 'render'
      ? `start(modules, window.__IDEM_FILM__);`
      : `start(modules, window.__IDEM_FILM__, window.__IDEM_AUDIO__, document.getElementById('stage'));`,
  ].join('\n');
  const sources = new Map(usable.map((s) => [s.key, s.code!]));
  const scenePlugin: Plugin = {
    name: 'idem-film-scenes',
    setup(b) {
      b.onResolve({ filter: /^scene:/ }, (args) => ({ path: args.path.slice('scene:'.length), namespace: 'scene' }));
      b.onLoad({ filter: /.*/, namespace: 'scene' }, (args) => ({ contents: sources.get(args.path) || '', loader: 'tsx', resolveDir: MOTION_ROOT }));
      b.onResolve({ filter: /^@idem\/motion$/ }, () => ({ path: path.join(MOTION_ROOT, 'kit/index.ts') }));
      b.onResolve({ filter: /.*/ }, (args) => {
        if (args.namespace !== 'scene' || ALLOWED_IMPORT.test(args.path)) return undefined;
        return { errors: [{ text: `import interdit : « ${args.path} »` }] };
      });
    },
  };
  // Dans l'aperçu (iframe isolée), l'origine de la page vaut « null », comme celle d'une image `data:` :
  // `Img` de Motion Canvas la croit alors locale et lui ajoute `?asset-hash=…`, ce qui corrompt l'URI.
  // Une origine fictive, seulement quand la page est opaque, rend à l'image sa vraie adresse.
  const opaqueOrigin: Plugin = {
    name: 'idem-opaque-origin',
    setup(b) {
      b.onLoad({ filter: /@motion-canvas[\\/]2d[\\/]lib[\\/]components[\\/]Img\.js$/ }, async (args) => ({
        contents: (await fs.promises.readFile(args.path, 'utf8')).replace(/window\.location\.origin/g, "(window.location.origin === 'null' ? 'https://preview.idem.local' : window.location.origin)"),
        loader: 'js',
      }));
    },
  };
  const result = await build({
    stdin: { contents: entry, loader: 'ts', resolveDir: MOTION_ROOT, sourcefile: 'film.ts' },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    jsx: 'automatic',
    jsxImportSource: '@motion-canvas/2d/lib',
    minify: mode === 'preview',
    keepNames: true,
    legalComments: 'none',
    logLevel: 'silent',
    tsconfigRaw,
    plugins: [scenePlugin, opaqueOrigin],
  });
  return result.outputFiles[0].text;
}
