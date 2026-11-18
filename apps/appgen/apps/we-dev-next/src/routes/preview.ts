/**
 * L'aperçu instantané des sites vitrines (voir `src/preview/engine.ts`).
 *
 *   GET    /api/preview/status                 disponible ici ? (et prépare les dépendances)
 *   POST   /api/preview/sessions               { files } → { id, url, state }          (utilisateur IDEM)
 *   PATCH  /api/preview/sessions/:id           { files?, removed? } → { state }         (son propriétaire)
 *   DELETE /api/preview/sessions/:id
 *   GET    /api/preview/vendor/:fp/:file       les dépendances, immuables
 *   GET    /api/preview/s/:id/…                le site : documents, code, style, `public/`, flux `events`
 *
 * Le site est servi sous un identifiant secret (144 bits), sans cookie : l'iframe de l'atelier est en origine opaque
 * (`Content-Security-Policy: sandbox`), il ne peut rien lire du domaine. Les écritures, elles, exigent la session IDEM
 * de l'utilisateur, et une session n'est modifiable que par son propriétaire.
 */
import { Router, type Request, type Response } from 'express';
import { availability, PreviewSession, vendor, type PreviewPage } from '../preview/engine.js';
import { requireIdemUser } from '../middleware/auth.js';
import { ChatLogger } from '../utils/logger.js';

const router: Router = Router();

const BASE = '/api/preview';
/** Une session sans nouvelle depuis ce délai est fermée. */
const IDLE_MS = 30 * 60_000;
/** Sessions ouvertes au plus par utilisateur (onglets, projets) : la plus ancienne cède sa place. */
const PER_USER = 3;
/** Au-delà, un projet n'est pas un site vitrine : l'aperçu ordinaire s'en charge. */
const MAX_BYTES = 25 * 1024 * 1024;

const sessions = new Map<string, PreviewSession>();

setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastUsed > IDLE_MS) {
      sessions.delete(id);
      void session.dispose();
    }
  }
}, 5 * 60_000).unref();

const prefixOf = (id: string) => `${BASE}/s/${id}`;

/** Les origines qui peuvent afficher l'aperçu dans un cadre : l'atelier (et localhost hors production). */
function frameAncestors(): string {
  const origins = (process.env.CORS_ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);
  if (process.env.NODE_ENV !== 'production') origins.push('http://localhost:*', 'http://127.0.0.1:*');
  return origins.length ? origins.join(' ') : "'self'";
}

/** Lisible par l'iframe en origine opaque (`Origin: null`), sans cookie. */
function openToPreview(res: Response) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.removeHeader('Access-Control-Allow-Credentials');
}

/* -------------------------------------------------------------------------- */
/*  Disponibilité et dépendances                                               */
/* -------------------------------------------------------------------------- */

router.get('/status', (_req, res) => {
  const state = availability();
  // Les dépendances se préparent dès la première question : la première page n'aura pas à les attendre.
  if (state.available) void vendor().catch((error) => ChatLogger.warn('PREVIEW', 'Dépendances de l’aperçu non regroupées', { message: (error as Error).message }));
  res.json(state);
});

router.get('/vendor/:fingerprint/:file', async (req, res) => {
  openToPreview(res);
  try {
    const info = await vendor();
    const file = info.files.get(String(req.params.file));
    if (req.params.fingerprint !== info.fingerprint || !file) return res.status(404).end();
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.end(Buffer.from(file));
  } catch (error) {
    res.status(503).type('text/plain').send((error as Error).message);
  }
});

/* -------------------------------------------------------------------------- */
/*  Sessions                                                                   */
/* -------------------------------------------------------------------------- */

const filesOf = (body: unknown): Record<string, string> => {
  const files = (body as { files?: unknown })?.files;
  if (!files || typeof files !== 'object') return {};
  return Object.fromEntries(Object.entries(files as Record<string, unknown>).filter(([path, value]) => typeof value === 'string' && !/(^|\/)node_modules\//.test(path))) as Record<string, string>;
};

const sizeOf = (files: Record<string, string>) => Object.values(files).reduce((sum, content) => sum + content.length, 0);

/** Ouvre une session pour `owner` avec les fichiers du site, et la construit. */
export async function openPreviewSession(owner: string, files: Record<string, string>) {
  // Une place par utilisateur au-delà de la limite : la plus ancienne session ferme.
  const mine = [...sessions.values()].filter((s) => s.owner === owner).sort((a, b) => a.lastUsed - b.lastUsed);
  for (const old of mine.slice(0, Math.max(0, mine.length - PER_USER + 1))) {
    sessions.delete(old.id);
    void old.dispose();
  }
  const session = new PreviewSession(owner, '');
  // L'adresse publique dépend de l'identifiant, tiré à la création.
  Object.assign(session, { publicBase: `${prefixOf(session.id)}/public` });
  sessions.set(session.id, session);
  session.apply(files);
  const started = Date.now();
  const state = await session.build();
  ChatLogger.info('PREVIEW', 'Aperçu instantané ouvert', { files: Object.keys(files).length, ok: state.ok, ms: Date.now() - started, buildError: state.error?.slice(0, 200) });
  return { session, id: session.id, url: `${prefixOf(session.id)}/`, state };
}

router.post('/sessions', requireIdemUser, async (req: Request, res: Response) => {
  const state = availability();
  if (!state.available) return res.status(503).json({ error: 'unavailable', reason: state.reason });
  const files = filesOf(req.body);
  if (sizeOf(files) > MAX_BYTES) return res.status(413).json({ error: 'too_large' });
  const opened = await openPreviewSession(req.idemUser!.uid, files);
  res.json({ id: opened.id, url: opened.url, state: opened.state });
});

function ownSession(req: Request, res: Response): PreviewSession | null {
  const session = sessions.get(String(req.params.id));
  if (!session || session.owner !== req.idemUser?.uid) {
    res.status(404).json({ error: 'not_found' });
    return null;
  }
  return session;
}

router.patch('/sessions/:id', requireIdemUser, async (req: Request, res: Response) => {
  const session = ownSession(req, res);
  if (!session) return;
  const files = filesOf(req.body);
  const removed = Array.isArray((req.body as { removed?: unknown })?.removed) ? ((req.body as { removed: unknown[] }).removed.filter((p) => typeof p === 'string') as string[]) : [];
  session.apply(files, removed);
  if (sizeOf(Object.fromEntries(session.files)) > MAX_BYTES) return res.status(413).json({ error: 'too_large' });
  res.json({ state: await session.build() });
});

const closeSession = async (req: Request, res: Response) => {
  const session = ownSession(req, res);
  if (!session) return;
  sessions.delete(session.id);
  await session.dispose();
  res.status(204).end();
};
router.delete('/sessions/:id', requireIdemUser, closeSession);
// `navigator.sendBeacon` à la fermeture de l'onglet (il ne sait envoyer qu'un POST).
router.post('/sessions/:id/close', requireIdemUser, closeSession);

/* -------------------------------------------------------------------------- */
/*  Le site                                                                    */
/* -------------------------------------------------------------------------- */

const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Du JSON qu'on peut poser dans un `<script>` sans le refermer. */
const scriptJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');

/** La page demandée : par son adresse (`/a-propos/`, `/en/`), sinon l'accueil. */
function pageFor(pages: PreviewPage[], path: string): PreviewPage {
  const wanted = (path.split(/[?#]/)[0] || '/').replace(/index\.html$/, '').replace(/\/?$/, '/');
  return pages.find((page) => page.path === wanted) ?? pages.find((page) => page.path === '/') ?? pages[0];
}

/**
 * Le moteur de la page, dans l'iframe : rend la page avec les mêmes réglages que l'entrée du template (StrictMode,
 * LazyMotion, MotionConfig), puis reprend chaque version annoncée par le flux `events` — style remplacé, module de la
 * page relu, rendu par-dessus (le défilement reste). Les liens internes (`/a-propos/`) mènent à la page de l'aperçu.
 * L'atelier est prévenu (`postMessage`) du chargement, des mises à jour et des erreurs.
 */
function runtimeScript(prefix: string, page: PreviewPage, version: number, cssVersion: number, ready: boolean): string {
  return `
import { createElement as h, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LazyMotion, MotionConfig, domMax } from 'motion/react';

const BASE = ${scriptJson(prefix)};
const PAGE = ${scriptJson({ key: page.key, path: page.path })};
let version = ${version};
let cssVersion = ${cssVersion};
let shown = false;
const tell = (type, detail = {}) => { try { parent.postMessage({ source: 'idem-preview', type, path: PAGE.path, ...detail }, '*'); } catch {} };

/*
 * Pendant une génération, le code passe par des états incomplets : une page arrive avant ses sections, une section
 * avant le fichier qu'elle importe. Ces erreurs-là disparaissent seules en une ou deux secondes. Une erreur n'est donc
 * montrée que si elle DURE (4 s sans version saine) ; avant la toute première version saine, la page attend en silence.
 */
const PATIENCE_MS = 4000;
let overlay = null;
let pendingError = null;
const paint = (message) => {
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.setAttribute('style', 'position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483647;max-height:45vh;overflow:auto;background:#1f1f23;color:#fecaca;font:12px/1.5 ui-monospace,Menlo,monospace;padding:12px 14px;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.35);white-space:pre-wrap');
    document.body.appendChild(overlay);
  }
  overlay.textContent = message;
  tell('error', { message });
};
const showError = (message, now = false) => {
  clearTimeout(pendingError);
  if (now) return paint(message);
  pendingError = setTimeout(() => paint(message), PATIENCE_MS);
};
const clearError = () => { clearTimeout(pendingError); overlay?.remove(); overlay = null; };
addEventListener('error', (event) => showError(String(event.error?.stack || event.message), true));
addEventListener('unhandledrejection', (event) => showError(String(event.reason?.stack || event.reason), true));

// L'attente avant la première version : une ligne discrète, remplacée par la page dès qu'elle est prête.
const waiting = () => {
  if (shown) return;
  document.getElementById('root').innerHTML = '<div style="min-height:100vh;display:grid;place-items:center;font:14px system-ui,sans-serif;color:#8a8a8a">Le site se prépare…</div>';
};

const root = createRoot(document.getElementById('root'));
async function show(v) {
  let mod;
  try {
    mod = await import(BASE + '/app/' + PAGE.key + '.js?v=' + v);
  } catch (error) {
    // Le module n'existe pas encore (page pas encore construite) : on attend la version suivante.
    if (!shown) waiting();
    return;
  }
  try {
    if (!shown) document.getElementById('root').innerHTML = '';
    const reduced = mod.motionTokens && mod.motionTokens.respectReducedMotion === false ? 'never' : 'user';
    root.render(h(StrictMode, null, h(LazyMotion, { features: domMax }, h(MotionConfig, { reducedMotion: reduced }, h(mod.default)))));
    clearError();
    tell(shown ? 'update' : 'ready', { version: v });
    shown = true;
  } catch (error) {
    showError(String(error && (error.stack || error.message) || error));
  }
}
if (${ready ? 'true' : 'false'}) show(version);
else waiting();

const events = new EventSource(BASE + '/events');
events.onmessage = async (message) => {
  const event = JSON.parse(message.data);
  if (event.type === 'error') return showError(event.message);
  if (event.type !== 'update' || (shown && event.version <= version)) return;
  version = event.version;
  if (event.cssVersion !== cssVersion) {
    cssVersion = event.cssVersion;
    const css = await fetch(BASE + '/style.css?v=' + cssVersion).then((r) => r.text()).catch(() => null);
    if (css !== null) document.getElementById('idem-css').textContent = css;
  }
  show(version);
};

// Les liens internes restent dans l'aperçu ; une ancre de la même page défile.
document.addEventListener('click', (event) => {
  const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || link.target === '_blank') return;
  const href = link.getAttribute('href');
  if (!href || !href.startsWith('/') || href.startsWith('//')) return;
  event.preventDefault();
  const [path, hash] = href.split('#');
  if ((path || PAGE.path) === PAGE.path && hash) return document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' });
  location.href = BASE + href;
});
`;
}

function documentFor(session: PreviewSession, page: PreviewPage, importMap: Record<string, string>): string {
  const prefix = prefixOf(session.id);
  return `<!doctype html>
<html lang="${escapeHtml(page.lang)}"${/^(ar|fa|he|ur)$/.test(page.lang) ? ' dir="rtl"' : ''}>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(page.title)}</title>
    ${session.fontLinks()}
    <style id="idem-css">${session.css.replace(/<\/style/gi, '<\\/style')}</style>
    <script type="importmap">${scriptJson({ imports: importMap })}</script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module">${runtimeScript(prefix, page, session.goodVersion, session.cssVersion, session.goodVersion > 0 && session.outputs.has(`${page.key}.js`))}</script>
  </body>
</html>
`;
}

const TYPES: Record<string, string> = {
  svg: 'image/svg+xml',
  json: 'application/json',
  txt: 'text/plain; charset=utf-8',
  css: 'text/css; charset=utf-8',
  xml: 'application/xml',
  webmanifest: 'application/manifest+json',
  ico: 'image/x-icon',
};

// Chemin écrit (pas une expression régulière) : la route est lue telle quelle par les métriques et les journaux.
router.get('/s/:id{/*rest}', async (req: Request, res: Response) => {
  const params = req.params as unknown as { id: string; rest?: string[] | string };
  const session = sessions.get(params.id);
  openToPreview(res);
  if (!session) return res.status(404).type('text/plain').send('Aperçu fermé : rouvrez le projet.');
  session.lastUsed = Date.now();
  // Express 5 rend le reste du chemin découpé ; la barre finale (`/a-propos/`) compte pour reconnaître la page.
  const tail = Array.isArray(params.rest) ? params.rest.join('/') : params.rest ?? '';
  const rest = `/${tail}${tail && req.path.endsWith('/') ? '/' : ''}`;

  if (rest === '/events') {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    const send = (event: object) => res.write(`data: ${JSON.stringify(event)}\n\n`);
    const unsubscribe = session.subscribe(send);
    // Battement : un mandataire ne coupe pas un flux silencieux.
    const beat = setInterval(() => res.write(': battement\n\n'), 15_000);
    req.on('close', () => {
      clearInterval(beat);
      unsubscribe();
    });
    return;
  }

  if (rest.startsWith('/app/')) {
    const file = session.outputs.get(rest.slice('/app/'.length));
    if (!file) return res.status(404).end();
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    // Les morceaux portent l'empreinte de leur contenu ; l'entrée d'une page change de version à chaque construction.
    res.setHeader('Cache-Control', rest.includes('/chunk-') ? 'public, max-age=31536000, immutable' : 'no-store');
    return res.end(Buffer.from(file));
  }

  if (rest === '/style.css') {
    res.setHeader('Content-Type', 'text/css; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.end(session.css);
  }

  if (rest.startsWith('/public/')) {
    const path = decodeURIComponent(rest.slice(1));
    const content = session.files.get(path);
    if (content === undefined) return res.status(404).end();
    res.setHeader('Content-Type', TYPES[path.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-cache');
    return res.end(content);
  }

  // Un document de page.
  if (!session.state.ok && session.state.version === 0) await session.build();
  const pages = session.pages();
  if (!pages.length) return res.status(404).type('text/plain').send('Le site n’a pas encore de page.');
  const info = await vendor();
  const importMap = Object.fromEntries(Object.entries(info.imports).map(([spec, file]) => [spec, `${BASE}/vendor/${info.fingerprint}/${file}`]));
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  // Origine opaque (ni cookie ni stockage du domaine), affichable seulement dans l'atelier ; compatible avec la page
  // de l'atelier, isolée (COEP) pour la WebContainer.
  res.setHeader(
    'Content-Security-Policy',
    `sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals; frame-ancestors ${frameAncestors()}`
  );
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.removeHeader('X-Frame-Options');
  res.end(documentFor(session, pageFor(pages, rest), importMap));
});

export default router;
