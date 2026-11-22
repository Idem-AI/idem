/**
 * Le relevé des sites (refonte iCode, import iVision) face aux technologies qui le cassaient — sans réseau ni modèle :
 * neuf sites d'essai servis en local, chacun imitant une famille (HTML classique avec bandeau de cookies, routes en
 * `#/`, application sans renvoi des adresses profondes et menu en boutons, Shadow DOM, site dans un iframe, Next.js
 * à routes déclarées, mur anti-robot, WordPress et son API, page dessinée dans un canvas).
 *
 * `--compare` relève aussi chaque site avec le robot de git (HEAD) : pages trouvées, sections, temps.
 *
 *   npm run check:site-crawl [-- --compare]
 */
process.env.RENDER_ALLOWED_HOSTS = '127.0.0.1';

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { execSync } from 'child_process';
import { existsSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { AddressInfo } from 'net';
import { crawlWebsite, SiteInventory } from '../src/site/site-crawler';
import { originalImageUrl } from '../src/site/site-tech';

const COMPARE = process.argv.includes('--compare');
let failures = 0;
const check = (label: string, ok: boolean, detail?: unknown) => {
  if (ok) console.log(`  ok   ${label}`);
  else {
    failures += 1;
    console.log(`  ÉCHEC ${label}${detail === undefined ? '' : `\n       ${JSON.stringify(detail).slice(0, 400)}`}`);
  }
};

/* -------------------------------------------------------------------------- */
/*  Les sites d'essai                                                          */
/* -------------------------------------------------------------------------- */

const para = (n: number) => `<p>${'Une phrase de contenu réel pour cette section, avec assez de texte pour être relevée. '.repeat(n)}</p>`;
const doc = (title: string, body: string, head = '') => `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${title}</title>${head}</head><body>${body}</body></html>`;

type Handler = (req: IncomingMessage, res: ServerResponse, port: number) => void;
const send = (res: ServerResponse, status: number, body: string, type = 'text/html; charset=utf-8', headers: Record<string, string> = {}) => {
  res.writeHead(status, { 'content-type': type, ...headers });
  res.end(body);
};

const STATIC_PAGES: Record<string, [string, string]> = {
  '/': ['Accueil | Atelier Baobab', '<h1>Atelier Baobab, menuiserie à Douala</h1>'],
  '/services/': ['Services | Atelier Baobab', '<h1>Nos services de menuiserie</h1>'],
  '/realisations/': ['Réalisations | Atelier Baobab', '<h1>Nos réalisations</h1>'],
  '/contact/': ['Contact | Atelier Baobab', '<h1>Nous contacter</h1>'],
  '/equipe/': ['Équipe | Atelier Baobab', '<h1>L’équipe de l’atelier</h1>'],
};

const SITES: Record<string, Handler> = {
  // 1. HTML classique, plan du site avec une page hors menu, bandeau de cookies (OneTrust).
  static: (req, res, port) => {
    const path = (req.url || '/').split('?')[0];
    if (path === '/robots.txt') return send(res, 200, `User-agent: *\nSitemap: http://127.0.0.1:${port}/sitemap_index.xml\n`, 'text/plain');
    if (path === '/sitemap_index.xml') return send(res, 200, `<sitemapindex><sitemap><loc>http://127.0.0.1:${port}/page-sitemap.xml</loc></sitemap></sitemapindex>`, 'application/xml');
    if (path === '/page-sitemap.xml') return send(res, 200, `<urlset>${Object.keys(STATIC_PAGES).map((p) => `<url><loc>http://127.0.0.1:${port}${p}</loc></url>`).join('')}</urlset>`, 'application/xml');
    const page = STATIC_PAGES[path];
    if (!page) return send(res, 404, doc('Introuvable', '<h1>Page introuvable</h1>'));
    send(
      res,
      200,
      doc(
        page[0],
        `<header><nav><a href="/">Accueil</a><a href="/services/">Services</a><a href="/realisations/">Réalisations</a><a href="/contact/">Contact</a></nav></header>
<main><section>${page[1]}${para(3)}</section><section><h2>Notre savoir-faire</h2>${para(2)}<img src="/wp-content/uploads/2024/01/atelier-300x200.jpg" width="300" height="200" alt="Atelier"></section></main>
<footer><p>Atelier Baobab, Douala</p></footer>
<div id="onetrust-consent-sdk"><div id="onetrust-banner-sdk"><h2>Nous utilisons des cookies</h2><p>Acceptez-vous les cookies ?</p><button>Accepter</button></div></div>`,
        '<meta name="generator" content="WordPress 6.5">'
      )
    );
  },
  // 2. Application à routes en `#/` : le serveur ne sert qu'un document.
  hash: (_req, res) =>
    send(
      res,
      200,
      doc(
        'Clinique Santé+',
        `<header><nav><a href="#/">Accueil</a><a href="#/consultations">Consultations</a><a href="#/equipe">Équipe</a><a href="#/contact">Contact</a></nav></header><main id="app"></main>
<script>
const routes = { '/': ['Clinique Santé+ à Yaoundé', 'Soins de proximité'], '/consultations': ['Nos consultations', 'Médecine générale et pédiatrie'], '/equipe': ['Notre équipe médicale', 'Six médecins'], '/contact': ['Prendre rendez-vous', 'Appelez-nous'] };
const render = () => { const r = routes[location.hash.replace(/^#/, '') || '/'] || routes['/']; document.getElementById('app').innerHTML = '<section><h1>' + r[0] + '</h1><p>' + r[1] + '. ' + 'Texte de la page, assez long pour être relevé comme un vrai contenu. '.repeat(3) + '</p></section><section><h2>' + r[0] + ' : en détail</h2><p>' + 'Encore du contenu propre à cette page. '.repeat(3) + '</p></section>'; document.title = r[0]; };
addEventListener('hashchange', render); setTimeout(render, 150);
</script>`
      )
    ),
  // 3. Application à `pushState`, menu en boutons, adresses profondes refusées (404) : hébergement statique sans renvoi.
  history: (req, res) => {
    const path = (req.url || '/').split('?')[0];
    if (path !== '/' && path !== '/index.html') return send(res, 404, doc('404', '<h1>404 Not Found</h1>'));
    send(
      res,
      200,
      doc(
        'Studio Kora',
        `<div id="root"></div>
<script>
const routes = { '/': ['Studio Kora, design graphique', 'Identités visuelles'], '/projets': ['Nos projets', 'Vingt marques accompagnées'], '/tarifs': ['Nos tarifs', 'Trois formules'], '/a-propos': ['À propos du studio', 'Fondé en 2019'] };
const go = (p) => { history.pushState({}, '', p); render(); };
const render = () => {
  const r = routes[location.pathname] || routes['/'];
  document.title = r[0];
  document.getElementById('root').innerHTML = '<header><nav>' + Object.keys(routes).map((p) => '<button style="cursor:pointer" data-to="' + p + '">' + (p === '/' ? 'Accueil' : p.slice(1)) + '</button>').join('') + '</nav></header><main><section><h1>' + r[0] + '</h1><p>' + r[1] + '. ' + 'Contenu propre à cette page du studio, assez long pour compter. '.repeat(3) + '</p></section><section><h2>' + r[0] + ', le détail</h2><p>' + 'Texte complémentaire de la page. '.repeat(3) + '</p></section></main>';
  document.querySelectorAll('[data-to]').forEach((b) => b.addEventListener('click', () => go(b.getAttribute('data-to'))));
};
addEventListener('popstate', render); setTimeout(render, 200);
</script>`
      )
    );
  },
  // 4. Composants web : tout le texte est dans des Shadow DOM.
  shadow: (_req, res) =>
    send(
      res,
      200,
      doc(
        'Lumen Énergie',
        `<header><nav><a href="/">Accueil</a></nav></header><main><x-hero></x-hero><x-feature></x-feature></main>
<script>
customElements.define('x-hero', class extends HTMLElement { connectedCallback() { this.attachShadow({ mode: 'open' }).innerHTML = '<style>h1{color:#222}</style><section><h1>Lumen Énergie, le solaire pour tous</h1><p>' + 'Des kits solaires installés en une journée dans toute la région. '.repeat(3) + '</p></section>'; } });
customElements.define('x-feature', class extends HTMLElement { connectedCallback() { this.attachShadow({ mode: 'open' }).innerHTML = '<section><h2>Nos kits solaires</h2><ul><li>Kit maison</li><li>Kit boutique</li></ul><p>' + 'Chaque kit est garanti et entretenu par nos techniciens. '.repeat(2) + '</p></section>'; } });
</script>`
      )
    ),
  // 6. Next.js : des pages déclarées par le framework, citées par aucun lien et aucun plan du site.
  next: (req, res) => {
    const path = (req.url || '/').split('?')[0].replace(/\/$/, '') || '/';
    const pages: Record<string, string> = { '/': 'Fintrack, la comptabilité simple', '/about': 'À propos de Fintrack', '/pricing': 'Les tarifs de Fintrack' };
    if (path === '/_next/static/chunks/main.js') return send(res, 200, '/* next */', 'application/javascript');
    if (!pages[path]) return send(res, 404, doc('404', '<h1>404</h1>'));
    send(
      res,
      200,
      doc(
        pages[path],
        `<div id="__next"><header><nav><a href="/">Accueil</a></nav></header><main><section><h1>${pages[path]}</h1>${para(3)}</section><section><h2>${pages[path]} : détails</h2>${para(2)}<img src="/_next/image?url=%2Fimages%2Fhero.jpg&w=640&q=75" width="640" height="400" alt="Hero"></section></main></div>
<script src="/_next/static/chunks/main.js"></script>
<script>self.__BUILD_MANIFEST = { sortedPages: ['/', '/_app', '/_error', '/about', '/blog/[slug]', '/pricing', '/api/hello'] };</script>`
      )
    );
  },
  // 7. Mur anti-robot : « Just a moment… », puis la vraie page une fois le cookie posé.
  wall: (req, res) => {
    if (!/cleared=1/.test(String(req.headers.cookie || ''))) {
      return send(res, 503, doc('Just a moment...', '<div id="challenge-stage"><p>Checking your browser before accessing the site.</p></div><script>setTimeout(() => { document.cookie = "cleared=1; path=/"; location.reload(); }, 1500);</script>'), 'text/html', { server: 'cloudflare', 'cf-ray': '8a1b2c3d4e5f-CDG' });
    }
    send(res, 200, doc('Hôtel Mboa', `<header><nav><a href="/">Accueil</a></nav></header><main><section><h1>Hôtel Mboa, au cœur de Kribi</h1>${para(3)}</section><section><h2>Nos chambres</h2>${para(2)}</section></main>`), 'text/html', { server: 'cloudflare', 'cf-ray': '8a1b2c3d4e5f-CDG' });
  },
  // 8. WordPress : des pages publiées que seule son API REST liste.
  wordpress: (req, res, port) => {
    const path = (req.url || '/').split('?')[0];
    const pages: Record<string, string> = { '/': 'Association Graines d’Avenir', '/nos-actions/': 'Nos actions', '/faire-un-don/': 'Faire un don', '/benevolat/': 'Devenir bénévole' };
    if (path === '/wp-json/wp/v2/pages') return send(res, 200, JSON.stringify(Object.entries(pages).map(([p, t]) => ({ link: `http://127.0.0.1:${port}${p}`, title: { rendered: t } }))), 'application/json');
    if (!pages[path]) return send(res, 404, doc('Introuvable', '<h1>Introuvable</h1>'));
    send(res, 200, doc(pages[path], `<header><nav><a href="/">Accueil</a><a href="/nos-actions/">Nos actions</a></nav></header><main><section><h1>${pages[path]}</h1>${para(3)}</section></main>`, '<meta name="generator" content="WordPress 6.6"><link rel="https://api.w.org/" href="/wp-json/">'));
  },
  // 10. Page « à plat » : titre et paragraphes directement sous <main>, sans enveloppe (docs, articles, mentions légales),
  //     et une balise generator Hugo (testée seule, sans espace de tête).
  flat: (req, res) => {
    const path = (req.url || '/').split('?')[0];
    const page = (title: string, h1: string) =>
      doc(title, `<header><nav><a href="/">Accueil</a><a href="/guide/">Guide</a></nav></header><main><h1>${h1}</h1>${para(2)}<h2>Premiers pas</h2>${para(2)}<ul><li>Installer l’outil</li><li>Créer un projet</li></ul><h2>Aller plus loin</h2>${para(2)}</main>`, '<meta name="generator" content="Hugo 0.121.0">');
    if (path === '/') return send(res, 200, page('Documentation Orme', 'Documentation du projet Orme'));
    if (path === '/guide/') return send(res, 200, page('Guide Orme', 'Le guide complet d’Orme'));
    send(res, 404, doc('404', '<h1>404</h1>'));
  },
  // 11. Mur « Client Challenge » (Anubis…) qui ne passe jamais : l'échec doit être dit, pas un relevé vide.
  challenge: (_req, res) => send(res, 200, doc('Client Challenge', '<noscript>Vérification du navigateur…</noscript><div id="c"></div>')),
  // 9. Dessiné dans un canvas : aucun texte dans le DOM.
  canvas: (_req, res) => send(res, 200, doc('Kivu Games', `<canvas id="unity-canvas" width="1440" height="900" style="width:100vw;height:100vh;display:block"></canvas><script>window.createUnityInstance = function(){};</script>`)),
};

/* -------------------------------------------------------------------------- */
/*  Déroulé                                                                    */
/* -------------------------------------------------------------------------- */

async function serve(handler: Handler): Promise<{ url: string; close: () => void }> {
  const server = createServer((req, res) => handler(req, res, (server.address() as AddressInfo).port));
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', () => done()));
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/`, close: () => server.close() };
}

/** Le robot d'avant (git HEAD), posé à côté du nouveau pour résoudre les mêmes imports. */
function oldCrawler(): typeof crawlWebsite | null {
  if (!COMPARE) return null;
  const file = join(__dirname, '..', 'src', 'site', 'old-site-crawler.check.ts');
  const repo = execSync('git rev-parse --show-toplevel', { cwd: __dirname }).toString().trim();
  writeFileSync(file, execSync(`git show HEAD:apps/ivision/core/src/site/site-crawler.ts`, { cwd: repo, maxBuffer: 10 * 1024 * 1024 }).toString());
  process.on('exit', () => existsSync(file) && rmSync(file));
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require(file).crawlWebsite;
}

const summary = (inv: SiteInventory | null) =>
  inv ? { pages: inv.pages.map((p) => p.path), sections: inv.pages.reduce((n, p) => n + p.sections.length, 0) } : null;

async function run(name: string, crawl: typeof crawlWebsite, url: string, extra: Partial<Parameters<typeof crawlWebsite>[0]> = {}) {
  const started = Date.now();
  try {
    const inventory = await crawl({ url, maxPages: 8, timeoutMs: 15_000, ...extra });
    return { inventory, ms: Date.now() - started, error: null as string | null };
  } catch (error) {
    return { inventory: null, ms: Date.now() - started, error: (error as Error).message };
  }
}

(async () => {
  const old = oldCrawler();
  const servers: Record<string, { url: string; close: () => void }> = {};
  for (const [name, handler] of Object.entries(SITES)) servers[name] = await serve(handler);
  // 5. Le site dans un iframe : la page qui l'entoure n'a presque rien.
  servers.iframe = await serve((_req, res) => send(res, 200, doc('Mon site', `<iframe src="${servers.static.url}" style="position:fixed;inset:0;width:100%;height:100%;border:0"></iframe>`)));

  const fakeVision = async () => JSON.stringify({ sections: [{ headings: ['Kivu Games'], texts: ['Des jeux éducatifs pour les enfants de Goma.'], items: [], buttons: ['Jouer'] }] });
  const report: Record<string, unknown> = {};
  const texts = (inv: SiteInventory) => inv.pages.flatMap((p) => p.sections.flatMap((s) => [...s.headings, ...s.texts]));

  const cases: Array<[string, (inv: SiteInventory) => void]> = [
    ['static', (inv) => {
      check('HTML classique : les 5 pages (dont celle du plan du site, via robots.txt → sitemap_index)', inv.pages.length === 5, summary(inv));
      check('HTML classique : bandeau de cookies absent des sections', !texts(inv).some((t) => /cookies/i.test(t)), texts(inv).filter((t) => /cookie/i.test(t)));
      check('HTML classique : WordPress détecté', !!inv.technology?.names.includes('WordPress'), inv.technology);
      check('HTML classique : vignette WordPress → image d’origine', inv.assets.images.some((i) => /atelier\.jpg$/.test(i.url)), inv.assets.images.map((i) => i.url));
    }],
    ['hash', (inv) => {
      check('routes en #/ : les 4 pages relevées (et non l’accueil quatre fois)', inv.pages.length === 4, summary(inv));
      check('routes en #/ : chemins du nouveau site sans # (/consultations/)', inv.pages.some((p) => p.path === '/consultations/'), summary(inv));
    }],
    ['history', (inv) => {
      check('menu en boutons + 404 profond : les 4 pages relevées', inv.pages.length === 4, summary(inv));
      check('… trouvées en cliquant le menu, et lues au moment du clic (pas de 404)', !!inv.technology?.adaptations.some((a) => /cliquant/.test(a)), inv.technology);
    }],
    ['shadow', (inv) => {
      check('Shadow DOM : titres et textes relevés', texts(inv).some((t) => /solaire pour tous/.test(t)) && texts(inv).some((t) => /kits solaires/i.test(t)), texts(inv));
    }],
    ['iframe', (inv) => {
      check('site dans un iframe : le site intérieur relevé (5 pages)', inv.pages.length === 5, summary(inv));
    }],
    ['next', (inv) => {
      check('Next.js : /about et /pricing trouvées par le manifeste (aucun lien, aucun plan)', ['/about/', '/pricing/'].every((p) => inv.pages.some((x) => x.path === p)), summary(inv));
      check('Next.js : /_next/image → image d’origine', inv.assets.images.some((i) => /\/images\/hero\.jpg$/.test(i.url)), inv.assets.images.map((i) => i.url));
      check('Next.js détecté (famille hybride)', inv.technology?.family === 'hybrid' && inv.technology.names.includes('Next.js'), inv.technology);
    }],
    ['wall', (inv) => {
      check('mur anti-robot : la vraie page relevée après l’attente', texts(inv).some((t) => /Hôtel Mboa/.test(t)) && !texts(inv).some((t) => /Checking your browser/.test(t)), texts(inv));
      check('Cloudflare détecté (en-têtes)', !!inv.technology?.names.includes('Cloudflare'), inv.technology);
    }],
    ['flat', (inv) => {
      check('page à plat : sections relevées (titres et paragraphes sous <main>)', inv.pages.length === 2 && inv.pages.every((p) => p.sections.length >= 3), summary(inv));
      check('page à plat : découpée à chaque titre (h1, puis chaque h2)', inv.pages[0]?.sections.some((x) => x.headings.includes('Premiers pas')) && inv.pages[0]?.sections.some((x) => x.headings.includes('Aller plus loin')), inv.pages[0]?.sections.map((x) => x.headings));
      check('page à plat : la liste est relevée', texts(inv).concat(inv.pages.flatMap((p) => p.sections.flatMap((x) => x.items))).includes('Installer l’outil'));
      check('balise generator « Hugo » reconnue (famille statique)', !!inv.technology?.names.includes('Hugo') && inv.technology?.family === 'static', inv.technology);
    }],
    ['wordpress', (inv) => {
      check('WordPress : les 4 pages, dont celles que seule l’API REST liste', inv.pages.length === 4, summary(inv));
    }],
  ];

  console.log('Nouveau robot');
  for (const [name, verify] of cases) {
    const result = await run(name, crawlWebsite, servers[name].url);
    report[name] = { ms: result.ms, error: result.error, ...summary(result.inventory), technology: result.inventory?.technology };
    if (!result.inventory) check(`${name} : relevé`, false, result.error);
    else verify(result.inventory);
  }
  const challenge = await run('challenge', crawlWebsite, servers.challenge.url);
  check('mur « Client Challenge » persistant : erreur claire (bot_protection), pas un relevé vide', challenge.error === 'bot_protection', challenge.error ?? summary(challenge.inventory));
  const dead = await serve((_req, res) => res.destroy());
  const gone = await run('unreachable', crawlWebsite, dead.url, { timeoutMs: 4000 });
  check('hôte qui ne répond pas : erreur « unreachable », pas un relevé vide', !gone.inventory && /unreachable|ECONNRESET|ERR_/.test(gone.error ?? ''), gone.error);
  dead.close();
  // Hébergement mutualisé lent (WordPress sur Hostinger) : le serveur répond, mais un script bloquant de l'en-tête
  // retarde la lecture du document au-delà du délai. Avant : « ne répond pas ». Le site doit être relevé.
  const slow = await serve((req, res) => {
    if (req.url === '/slow.js') return void setTimeout(() => send(res, 200, 'window.slowLoaded = true;', 'application/javascript'), 7000);
    send(res, 200, `<!doctype html><html lang="fr"><head><title>Lent</title><script src="/slow.js"></script></head><body><header><nav><a href="/">Accueil</a></nav></header><main><section><h1>Association Lente</h1><p>Un site sur un hébergement mutualisé qui met longtemps à charger ses scripts.</p></section></main></body></html>`);
  });
  const slowRun = await run('slow', crawlWebsite, slow.url, { timeoutMs: 4000, maxPages: 1 });
  check('site lent qui a répondu (script bloquant > délai) : relevé, jamais « ne répond pas »', !!slowRun.inventory && texts(slowRun.inventory).includes('Association Lente'), slowRun.error ?? summary(slowRun.inventory));
  slow.close();
  // Un serveur qui accepte la connexion mais ne répond jamais : injoignable, dans le délai (pas au bout du délai long).
  const mute = await serve(() => undefined);
  const muteRun = await run('mute', crawlWebsite, mute.url, { timeoutMs: 4000 });
  check('serveur muet : « unreachable » dans le délai court', !muteRun.inventory && /unreachable/.test(muteRun.error ?? '') && muteRun.ms < 15_000, { error: muteRun.error, ms: muteRun.ms });
  mute.close();
  const canvasRun = await run('canvas', crawlWebsite, servers.canvas.url, { vision: fakeVision });
  report.canvas = { ms: canvasRun.ms, error: canvasRun.error, ...summary(canvasRun.inventory), technology: canvasRun.inventory?.technology };
  check('canvas (Unity) : page lue par le modèle de vision', !!canvasRun.inventory && texts(canvasRun.inventory).includes('Kivu Games'), canvasRun.error ?? summary(canvasRun.inventory));

  console.log('Images en pleine taille');
  check('Wix', originalImageUrl('https://static.wixstatic.com/media/abc_123~mv2.jpg/v1/fill/w_300,h_200,al_c/abc.jpg') === 'https://static.wixstatic.com/media/abc_123~mv2.jpg');
  check('Shopify', originalImageUrl('https://cdn.shopify.com/s/files/1/0001/products/sac_300x300.jpg?v=12&width=300') === 'https://cdn.shopify.com/s/files/1/0001/products/sac.jpg?v=12');
  check('Squarespace', /format=2500w/.test(originalImageUrl('https://images.squarespace-cdn.com/content/v1/x/photo.jpg?format=300w')));
  check('Webflow', originalImageUrl('https://cdn.prod.website-files.com/abc/photo-p-500.jpg') === 'https://cdn.prod.website-files.com/abc/photo.jpg');
  check('Ghost', originalImageUrl('https://blog.example.com/content/images/size/w600/2024/01/a.jpg') === 'https://blog.example.com/content/images/2024/01/a.jpg');
  check('Cloudinary', originalImageUrl('https://res.cloudinary.com/demo/image/upload/w_300,h_200,c_fill/v1/sample.jpg') === 'https://res.cloudinary.com/demo/image/upload/v1/sample.jpg');
  check('adresse inconnue inchangée', originalImageUrl('https://example.com/a.jpg?x=1') === 'https://example.com/a.jpg?x=1');

  if (old) {
    console.log('\nComparaison avec le robot de git (HEAD)');
    const rows: string[] = [];
    for (const name of [...cases.map(([n]) => n), 'canvas']) {
      const before = await run(name, old, servers[name].url);
      const after = report[name] as { ms: number; pages?: string[]; sections?: number; error: string | null };
      rows.push(`${name.padEnd(10)} avant : ${before.error ? `ÉCHEC (${before.error.slice(0, 30)})` : `${before.inventory!.pages.length} page(s), ${summary(before.inventory)!.sections} sections`} en ${(before.ms / 1000).toFixed(1)} s   |   après : ${after.error ? `ÉCHEC (${after.error})` : `${after.pages?.length} page(s), ${after.sections} sections`} en ${(after.ms / 1000).toFixed(1)} s`);
      report[`${name}-avant`] = { ms: before.ms, error: before.error, ...summary(before.inventory) };
    }
    console.log(rows.join('\n'));
  }
  writeFileSync(join(require('os').tmpdir(), 'idem-site-crawl-report.json'), JSON.stringify(report, null, 2));
  Object.values(servers).forEach((s) => s.close());
  console.log(failures ? `\n${failures} échec(s).` : '\nTout est vert.');
  process.exit(failures ? 1 : 0);
})();
