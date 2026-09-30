import {
  IDEM,
  OG_LOCALE,
  PROMISE,
  SERVICES,
  brandedTitle,
  type SeoLocale,
  type ServiceId,
} from './ecosystem';
import { OG_IMAGE_SIZE, ogImageUrl } from './og';
import { buildPageGraph, jsonLdString } from './schema';

/**
 * L'en-tête d'une application servie sur son propre domaine (console,
 * simulateur, iCode, iDeploy).
 *
 * Ces applications sont rendues dans le navigateur : les robots des réseaux
 * sociaux (Facebook, LinkedIn, WhatsApp, X) ne lisent que le HTML servi, sans
 * exécuter le JavaScript. Tout ce qui doit être compris d'eux est donc écrit
 * en dur dans `index.html`, entre deux marqueurs, par `scripts/sync.mjs`.
 */

export const HEAD_START = '<!-- idem-seo:start — généré par packages/shared-seo (npm run seo:sync), ne pas éditer à la main -->';
export const HEAD_END = '<!-- idem-seo:end -->';

const escapeAttr = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const escapeText = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function ogImageAlt(serviceId: ServiceId, locale: SeoLocale): string {
  const s = SERVICES[serviceId];
  return `${s.name} — ${s.role[locale]}. IDEM : ${PROMISE[locale].toLowerCase()}.`;
}

/** Le bloc à placer dans le `<head>` de l'application d'un service. */
export function renderServiceHead(serviceId: ServiceId, locale: SeoLocale, indent = '    '): string {
  const s = SERVICES[serviceId];
  const url = `${s.url}/`;
  const title = brandedTitle(s.title[locale]);
  const description = s.description[locale];
  const image = ogImageUrl(serviceId, locale);
  const alt = ogImageAlt(serviceId, locale);
  const other: SeoLocale = locale === 'fr' ? 'en' : 'fr';

  const graph = buildPageGraph({
    locale,
    url,
    title,
    description,
    image,
    imageAlt: alt,
    about: serviceId,
    site: serviceId,
  });

  const meta = (attr: 'name' | 'property', key: string, content: string) =>
    `<meta ${attr}="${key}" content="${escapeAttr(content)}" />`;

  const lines = [
    HEAD_START,
    `<title>${escapeText(title)}</title>`,
    meta('name', 'description', description),
    meta('name', 'robots', 'index, follow, max-image-preview:large, max-snippet:-1'),
    meta('name', 'application-name', s.name),
    meta('name', 'apple-mobile-web-app-title', s.name),
    meta('name', 'theme-color', IDEM.themeColor),
    `<link rel="canonical" href="${url}" />`,
    meta('property', 'og:type', 'website'),
    meta('property', 'og:site_name', IDEM.name),
    meta('property', 'og:url', url),
    meta('property', 'og:title', title),
    meta('property', 'og:description', description),
    meta('property', 'og:image', image),
    meta('property', 'og:image:secure_url', image),
    meta('property', 'og:image:type', 'image/png'),
    meta('property', 'og:image:width', String(OG_IMAGE_SIZE.width)),
    meta('property', 'og:image:height', String(OG_IMAGE_SIZE.height)),
    meta('property', 'og:image:alt', alt),
    meta('property', 'og:locale', OG_LOCALE[locale]),
    meta('property', 'og:locale:alternate', OG_LOCALE[other]),
    meta('name', 'twitter:card', 'summary_large_image'),
    meta('name', 'twitter:site', IDEM.twitter),
    meta('name', 'twitter:title', title),
    meta('name', 'twitter:description', description),
    meta('name', 'twitter:image', image),
    meta('name', 'twitter:image:alt', alt),
    `<script type="application/ld+json">${jsonLdString(graph)}</script>`,
    // L'en-tête est écrit dans une langue ; l'interface suit le cookie partagé
    // `idem_lang`. `lang` suit l'interface, pour les lecteurs d'écran.
    `<script>(function(){try{var m=document.cookie.match(/(?:^|;\\s*)idem_lang=(fr|en)/);var l=m?m[1]:(navigator.language||'').toLowerCase().indexOf('fr')===0?'fr':'en';document.documentElement.lang=l;}catch(e){}})();</script>`,
    HEAD_END,
  ];
  return lines.map((l) => indent + l).join('\n');
}

/** Le `robots.txt` d'une application : l'entrée publique indexée, le reste privé. */
export function renderServiceRobots(serviceId: ServiceId, publicPaths: readonly string[]): string {
  const s = SERVICES[serviceId];
  return [
    `# ${s.name} — ${s.url}`,
    '# Généré par packages/shared-seo (npm run seo:sync), ne pas éditer à la main.',
    '# Seule l’entrée publique est indexée : le reste est l’espace privé des utilisateurs.',
    '',
    'User-agent: *',
    'Allow: /$',
    ...publicPaths.map((p) => `Allow: ${p}$`),
    'Allow: /assets/',
    'Allow: /*.css$',
    'Allow: /*.js$',
    'Allow: /favicon.ico$',
    'Disallow: /',
    '',
    `Sitemap: ${s.url}/sitemap.xml`,
    '',
  ].join('\n');
}

/** Le plan du site d'une application : son entrée, et sa page sur le landing. */
export function renderServiceSitemap(serviceId: ServiceId): string {
  const s = SERVICES[serviceId];
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!-- Généré par packages/shared-seo (npm run seo:sync), ne pas éditer à la main. -->',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '  <url>',
    `    <loc>${s.url}/</loc>`,
    '    <changefreq>monthly</changefreq>',
    '    <priority>1.0</priority>',
    '  </url>',
    '</urlset>',
    '',
  ].join('\n');
}
