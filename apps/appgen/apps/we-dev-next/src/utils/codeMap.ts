/**
 * LA CARTE D'UNE APPLICATION — une ligne par fichier, calculée par le code (zéro jeton) : ce que le fichier
 * déclare (composants, fonctions), les écrans qu'il route, les textes qu'il affiche, les routes d'API qu'il sert
 * ou appelle, les fichiers du projet qu'il importe.
 *
 * Le tri des fichiers d'une retouche la lit au lieu d'une simple liste de chemins : « le bouton de connexion ne
 * marche pas » mène à l'écran qui affiche « Se connecter » et à la route `/api/auth/login` qu'il appelle, sans
 * relire tout le projet.
 */

const CODE = /\.(jsx?|tsx?|mjs|cjs|vue|svelte)$/;
const SKIPPED = /(^|\/)(node_modules|dist|build|\.vite|\.idem)\//;

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
const unique = (items: string[], max: number) => [...new Set(items.map((item) => item.trim()).filter(Boolean))].slice(0, max);

function describeFile(path: string, code: string): string {
  const declares = unique(
    Array.from(code.matchAll(/\bexport\s+(?:default\s+)?(?:async\s+)?(?:function|const|class)\s+([A-Za-z_$][\w$]*)/g)).map((m) => m[1]),
    6
  );
  const routes = unique(Array.from(code.matchAll(/<Route\b[^>]*\bpath=["'`]([^"'`]+)["'`]/g)).map((m) => m[1]), 8);
  const serves = unique(
    Array.from(code.matchAll(/\b(?:app|router|server|api)\.(get|post|put|patch|delete)\(\s*["'`]([^"'`]+)["'`]/g)).map((m) => `${m[1].toUpperCase()} ${m[2]}`),
    8
  );
  const calls = unique(Array.from(code.matchAll(/\b(?:fetch|axios\.\w+|api\.\w+)\(\s*[`"']([^`"']*\/api\/[^`"'$]*)/g)).map((m) => m[1]), 6);
  const texts = unique(
    [
      ...Array.from(code.matchAll(/\bt\(\s*["']([^"']{3,80})["']/g)).map((m) => m[1]),
      // Le texte entre balises, pas le code après une flèche (`=> …`) ni une expression.
      ...Array.from(code.matchAll(/(?<![=-])>\s*([^<>{}\n();=]*[A-Za-zÀ-ÿ][^<>{}\n();=]{3,})\s*</g)).map((m) => m[1]),
    ].map((text) => clip(text.replace(/\s+/g, ' '), 50)),
    4
  );
  const imports = unique(
    Array.from(code.matchAll(/\bfrom\s+["']((?:\.{1,2}|@)\/[^"']+)["']/g)).map((m) => m[1].replace(/^@\//, 'src/')),
    6
  );
  const parts = [
    declares.length ? `déclare ${declares.join(', ')}` : '',
    routes.length ? `écrans ${routes.join(', ')}` : '',
    serves.length ? `sert ${serves.join(', ')}` : '',
    calls.length ? `appelle ${calls.join(', ')}` : '',
    texts.length ? `affiche ${texts.map((text) => `« ${text} »`).join(' ')}` : '',
    imports.length ? `importe ${imports.join(', ')}` : '',
  ].filter(Boolean);
  return `${path}${parts.length ? ` — ${parts.join(' ; ')}` : ''}`;
}

/** La carte du projet, une ligne par fichier (les fichiers sans code n'ont que leur chemin). */
export function buildCodeMap(files: Record<string, string>): string {
  return Object.keys(files)
    .filter((path) => !SKIPPED.test(path))
    .sort()
    .map((path) => (CODE.test(path) && typeof files[path] === 'string' ? describeFile(path, files[path]) : path))
    .join('\n');
}
