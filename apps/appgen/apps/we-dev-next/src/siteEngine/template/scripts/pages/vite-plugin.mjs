/**
 * Les pages du site — posé par IDEM, NE PAS MODIFIER.
 *
 * Chaque page a son propre document HTML (son titre, sa description, sa langue : ce que lisent les moteurs de
 * recherche), mais aucun de ces documents n'est un fichier du projet. Ils sont fabriqués ici, à partir de
 * `index.html` (l'en-tête commun : icônes, couleur, polices) et de la liste des pages, `src/site/pages.json` :
 *
 *   aperçu       une adresse de page (`/a-propos/`, `/en/a-propos/`) reçoit son document, préparé par Vite
 *   construction chaque document devient une entrée et sort dans `dist/` (`dist/a-propos/index.html`)
 *
 * Ajouter une page, c'est ajouter une ligne à `src/site/pages.json` (et son module dans `src/pages/`). Un dossier
 * qui contient un vrai `index.html` reste prioritaire.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

export const PAGES_FILE = 'src/site/pages.json';

/** La liste des pages : `{ languages, pages: [{ path, lang, module, entry, html, title, description }] }`. */
export function readPages(root) {
  try {
    const parsed = JSON.parse(readFileSync(join(root, PAGES_FILE), 'utf8'));
    return { languages: parsed.languages ?? [], pages: Array.isArray(parsed.pages) ? parsed.pages : [] };
  } catch {
    return { languages: [], pages: [] };
  }
}

/** Les pages qui n'ont pas de vrai fichier : celles que ce module fabrique. */
export function virtualPages(root) {
  return readPages(root).pages.filter((page) => page.html && page.html !== 'index.html' && !existsSync(join(root, page.html)));
}

const escape = (text) =>
  String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const RTL = /^(ar|fa|he|ur)$/;

/**
 * Les balises `hreflang` d'une page : la même page dans chaque langue (même module), la principale en défaut.
 * Posées APRÈS le traitement du HTML par Vite (`transformIndexHtml`, ordre `post`) : écrites dans le document,
 * Vite prenait `href="/"` pour un fichier à intégrer, tombait sur un dossier, et la construction échouait (EISDIR) —
 * aucun site en plusieurs langues ne pouvait être mis en ligne.
 */
export function alternatesOf(page, pages) {
  const siblings = pages.filter((other) => other.module === page.module);
  if (siblings.length < 2) return '';
  return [...siblings, { ...siblings[0], lang: 'x-default' }]
    .map((other) => `    <link rel="alternate" hreflang="${escape(other.lang)}" href="${escape(other.path)}" />\n`)
    .join('');
}

/** Le document d'une page : celui de l'accueil, avec la langue, les textes et l'entrée de la page. */
export function pageDocument(base, page) {
  const title = escape(page.title);
  const description = escape(page.description);
  const meta = (attribute, name, content) => (html) =>
    html.replace(new RegExp(`(<meta ${attribute}="${name}" content=")[^"]*(")`), `$1${content}$2`);

  let html = base
    .replace(/<html lang="[^"]*"(?: dir="rtl")?>/, `<html lang="${escape(page.lang)}"${RTL.test(page.lang) ? ' dir="rtl"' : ''}>`)
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
    .replace(/[ \t]*<link rel="alternate" hreflang="[^"]*" href="[^"]*" \/>\n/g, '')
    .replace(/<script type="module" src="[^"]*"><\/script>/, `<script type="module" src="${escape(page.entry)}"></script>`);
  html = meta('name', 'description', description)(html);
  html = meta('property', 'og:title', title)(html);
  html = meta('property', 'og:description', description)(html);
  html = meta('property', 'og:locale', escape(page.lang))(html);
  return html;
}

/** L'adresse demandée, ramenée à celle d'une page (`/a-propos` et `/a-propos/index.html` → `/a-propos/`). */
const normalize = (url) => {
  const path = decodeURIComponent(url.split(/[?#]/)[0] || '/').replace(/index\.html$/, '');
  return path.endsWith('/') ? path : `${path}/`;
};

export default function idemPages() {
  let root = process.cwd();
  const render = (page) => pageDocument(readFileSync(join(root, 'index.html'), 'utf8'), page);
  const byId = (id) => virtualPages(root).find((page) => resolve(root, page.html) === id);

  return {
    name: 'idem-pages',
    enforce: 'pre',
    configResolved(config) {
      root = config.root;
    },
    // Construction : chaque document est une entrée (voir `vite.config.ts`) qu'aucun fichier ne porte.
    resolveId(id) {
      const absolute = resolve(root, id.replace(/^\//, ''));
      return byId(id) ? id : byId(absolute) ? absolute : null;
    },
    load(id) {
      const page = byId(id);
      return page ? render(page) : null;
    },
    // Les liens entre langues de chaque document, accueil compris (voir `alternatesOf`).
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const { pages } = readPages(root);
        // Le fichier du document (`a-propos/index.html`) ; dans l'aperçu, l'adresse (`a-propos/`) en tient lieu.
        let file = relative(root, ctx.filename).split('\\').join('/');
        if (!file.endsWith('.html')) file = `${file ? `${file.replace(/\/$/, '')}/` : ''}index.html`;
        const page = pages.find((candidate) => candidate.html === file);
        const alternates = page ? alternatesOf(page, pages) : '';
        return alternates ? html.replace(/\s*<\/head>/, `\n${alternates}  </head>`) : html;
      },
    },
    // Aperçu : l'adresse d'une page reçoit son document, préparé comme le serait un fichier (`transformIndexHtml`).
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();
        const path = normalize(req.url || '/');
        const page = virtualPages(root).find((candidate) => candidate.path === path);
        if (!page) return next();
        try {
          const html = await server.transformIndexHtml(req.url || path, render(page), req.originalUrl);
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(html);
        } catch (error) {
          next(error);
        }
      });
    },
  };
}
