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

/** Version de Motion Canvas installée (doit être celle de `package.json` ; le contrôle le vérifie). */
export const MOTION_CANVAS_VERSION = '3.17.2';

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

/**
 * L'IA confond parfois les modules d'import : un symbole `@idem/motion` atterrit dans
 * `@motion-canvas/core`, ou l'inverse (`fadeTransition` dans `@idem/motion`).
 * Plutôt que de planter au build, on déplace silencieusement chaque symbole dans son vrai module.
 *
 * La source de vérité est `IDEM_MOTION_EXPORTS` : tout ce qui est dedans vient de `@idem/motion`,
 * tout ce qui n'y est pas et se trouve dans un import `@idem/motion` est renvoyé vers `@motion-canvas/core`.
 */
const IDEM_MOTION_EXPORTS = new Set([
  // types
  'SceneContext', 'SceneMedia', 'BrandTokens', 'BrandColors', 'SfxKind', 'FilmFormat',
  // helpers (voir kit/helpers.ts)
  'safeArea', 'grid', 'circlePoints', 'fitMedia', 'measureText', 'fitFontSize',
  'words', 'readableOn', 'contrast', 'mix', 'alpha', 'beatTime', 'sceneTime',
  'waitUntilTime', 'random', 'lerp', 'clamp',
  // système de design, lignes équilibrées, coutures (compilateur 0.3)
  'balanceLines', 'beatAt', 'cubicBezier', 'designDur', 'designEase', 'designSize', 'designStagger', 'designWeight',
  'readTime', 'springEase', 'seamIn', 'seamOut', 'seamOutDuration', 'PLATFORM_SAFE',
  'SceneDesignData', 'TypeLevel', 'DurToken', 'EaseName', 'StaggerToken', 'SeamData', 'SeamKind', 'SeamDir',
  // types géométrie
  'Box',
]);

function fixMisplacedImports(code: string): string {
  const toIdem: string[] = [];   // symboles à envoyer vers @idem/motion
  const toCore: string[] = [];   // symboles à envoyer vers @motion-canvas/core

  // 1. Dans les imports `@motion-canvas/core`, trouver ceux qui appartiennent à @idem/motion.
  code = code.replace(
    /import\s*\{([^}]+)\}\s*from\s*['"]@motion-canvas\/core['"]/g,
    (_match, names: string) => {
      const items = names.split(',').map((s) => s.trim()).filter(Boolean);
      const keep = items.filter((n) => !IDEM_MOTION_EXPORTS.has(n));
      const move = items.filter((n) => IDEM_MOTION_EXPORTS.has(n));
      toIdem.push(...move);
      if (move.length === 0) return _match;
      if (keep.length === 0) return '';
      return `import { ${keep.join(', ')} } from '@motion-canvas/core'`;
    },
  );

  // 2. Dans les imports `@idem/motion`, trouver ceux qui n'y existent pas (→ @motion-canvas/core).
  code = code.replace(
    /import\s*\{([^}]+)\}\s*from\s*['"]@idem\/motion['"]/g,
    (_match, names: string) => {
      const items = names.split(',').map((s) => s.trim()).filter(Boolean);
      const keep = items.filter((n) => IDEM_MOTION_EXPORTS.has(n));
      const move = items.filter((n) => !IDEM_MOTION_EXPORTS.has(n));
      toCore.push(...move);
      // Ajouter aussi les symboles collectés à l'étape 1.
      for (const s of toIdem) if (!keep.includes(s)) keep.push(s);
      toIdem.length = 0; // consommés
      if (move.length === 0 && toIdem.length === 0) return _match;
      if (keep.length === 0) return '';
      return `import { ${keep.join(', ')} } from '@idem/motion'`;
    },
  );

  // 3. S'il reste des symboles pour @idem/motion sans import existant, en créer un.
  if (toIdem.length > 0) {
    code = `import { ${toIdem.join(', ')} } from '@idem/motion';\n${code}`;
  }

  // 4. Injecter les symboles renvoyés vers @motion-canvas/core.
  if (toCore.length > 0) {
    const coreRe = /import\s*\{([^}]+)\}\s*from\s*['"]@motion-canvas\/core['"]/;
    if (coreRe.test(code)) {
      code = code.replace(coreRe, (_m, names: string) => {
        const items = names.split(',').map((s) => s.trim()).filter(Boolean);
        for (const s of toCore) if (!items.includes(s)) items.push(s);
        return `import { ${items.join(', ')} } from '@motion-canvas/core'`;
      });
    } else {
      code = `import { ${toCore.join(', ')} } from '@motion-canvas/core';\n${code}`;
    }
  }

  return code;
}

export interface BundleScene {
  key: string;
  /** Absent : la scène n'a pas compilé (son erreur est dans les données du film). */
  code?: string;
}

/** Le paquet d'un film : `mode` choisit le pilote (rendu serveur ou lecteur d'aperçu). */
export async function buildFilmBundle(scenes: BundleScene[], mode: 'render' | 'preview'): Promise<string> {
  // Une scène qui casse l'assemblage (un nom importé qui n'existe pas : `easeOut`, `Group`…) ne fait plus tomber
  // le film entier : elle est retirée du paquet et le harnais montre son erreur à sa place ; les autres jouent.
  const excluded = new Set<string>();
  for (let attempt = 0; attempt <= scenes.length; attempt++) {
    try {
      return await bundleOnce(scenes.filter((s) => !excluded.has(s.key)), mode);
    } catch (error) {
      const faulty = [...String((error as Error)?.message || '').matchAll(/scene:([\w-]+):/g)].map((m) => m[1]).filter((k) => !excluded.has(k));
      if (!faulty.length) throw error;
      faulty.forEach((k) => excluded.add(k));
    }
  }
  throw new Error('film_bundle_failed');
}

async function bundleOnce(scenes: BundleScene[], mode: 'render' | 'preview'): Promise<string> {
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
      b.onLoad({ filter: /.*/, namespace: 'scene' }, (args) => ({ contents: fixMisplacedImports(sources.get(args.path) || ''), loader: 'tsx', resolveDir: MOTION_ROOT }));
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
  // La vidéo de Motion Canvas en lecture temps réel (aperçu) : tant qu'un clip n'est pas prêt, sa valeur calculée
  // vaut `undefined` et sa durée NaN. Motion Canvas passait alors `undefined` à drawImage (exception qui arrêtait le
  // dessin de TOUTE l'image : aucun média visible) et réglait `currentTime` à NaN (« non-finite »). Le clip qui
  // n'est pas prêt n'est simplement pas dessiné ce tour-ci ; l'export (qui attend les médias) n'est pas concerné.
  const videoGuard: Plugin = {
    name: 'idem-video-guard',
    setup(b) {
      b.onLoad({ filter: /@motion-canvas[\\/]2d[\\/]lib[\\/]components[\\/]Video\.js$/ }, async (args) => ({
        contents: (await fs.promises.readFile(args.path, 'utf8'))
          .replace('drawImage(context, video, box);', 'if (video && video.readyState >= 2) drawImage(context, video, box);')
          .replace('if (video.readyState < 2)\n            return;', 'if (video.readyState < 2 || !Number.isFinite(value))\n            return;')
          .replace('else if (!playing) {\n            video.currentTime = time;', 'else if (!playing && Number.isFinite(time)) {\n            video.currentTime = time;'),
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
    plugins: [scenePlugin, opaqueOrigin, videoGuard],
  });
  return result.outputFiles[0].text;
}
