/**
 * Pré-rendu des pages — posé par IDEM, NE PAS MODIFIER.
 *
 * Après `vite build`, chaque page est rendue en HTML dans son document : le
 * texte est lisible par les moteurs de recherche sans exécuter de JavaScript,
 * et le navigateur le reprend par hydratation. Un site en plusieurs langues est
 * rendu langue par langue (les modules relus à chaque fois : un texte écrit hors
 * d'un composant se traduit aussi). Le plan du site, le fichier
 * robots et la fiche d'établissement (données structurées) sont écrits ici.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

const DIST = 'dist';
const read = (path, fallback) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
};

const manifest = read('idem.pages.json', { pages: [] });
const pages = manifest.pages?.length ? manifest.pages : [{ path: '/', module: 'src/pages/home.tsx', html: 'index.html' }];
const seo = read('src/site/seo.json', {});

function structuredData() {
  const business = seo.business ?? {};
  const local = business.type || business.city || business.phone;
  const data = {
    '@context': 'https://schema.org',
    '@type': local ? business.type || 'LocalBusiness' : 'Organization',
    name: seo.name,
    description: seo.description,
    url: seo.url || undefined,
    telephone: business.phone || undefined,
    email: business.email || undefined,
    address: business.city
      ? { '@type': 'PostalAddress', addressLocality: business.city, addressCountry: business.country || undefined }
      : undefined,
  };
  return '<script type="application/ld+json">' + JSON.stringify(data).replace(/</g, '\\u003c') + '</scr' + 'ipt>';
}

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const base = (seo.url || '').replace(/\/$/, '');
const jsonLd = structuredData();

const absolute = (html) => (base ? html.replace(/(<link rel="alternate" hreflang="[^"]+" href=")\//g, '$1' + base + '/') : html);

try {
  let language = null;
  for (const page of [...pages].sort((a, b) => String(a.lang || '').localeCompare(String(b.lang || '')))) {
    const file = join(DIST, page.html);
    if (!existsSync(file) || !existsSync(page.module)) continue;

    if ((page.lang || null) !== language) {
      language = page.lang || null;
      globalThis.__IDEM_LANG__ = language || undefined;
      vite.moduleGraph.invalidateAll();
    }

    let markup = '';
    try {
      const mod = await vite.ssrLoadModule('/' + page.module);
      if (typeof mod.default === 'function') markup = renderToString(createElement(mod.default));
    } catch (error) {
      // Une page qui ne se rend pas hors navigateur s'affichera côté client.
      console.warn('[prerender] ' + page.path + ' non pré-rendue : ' + error.message);
    }

    let html = absolute(readFileSync(file, 'utf8'));
    if (markup) html = html.replace('<div id="root"></div>', '<div id="root">' + markup + '</div>');
    const canonical = base ? '<link rel="canonical" href="' + base + page.path + '" />' : '';
    html = html.replace('</head>', '  ' + canonical + jsonLd + '\n  </head>');
    writeFileSync(file, html);
  }
} finally {
  await vite.close();
}

const urls = pages.map((page) => '  <url><loc>' + base + page.path + '</loc></url>').join('\n');
writeFileSync(
  join(DIST, 'sitemap.xml'),
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + '\n</urlset>\n'
);
writeFileSync(join(DIST, 'robots.txt'), 'User-agent: *\nAllow: /\n' + (base ? 'Sitemap: ' + base + '/sitemap.xml\n' : ''));

console.log('Référencement : ' + pages.length + ' page(s) pré-rendue(s), plan du site et robots écrits.');
