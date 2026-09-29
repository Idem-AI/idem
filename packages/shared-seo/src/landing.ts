import { IDEM, SEO_LOCALES, type SeoLocale, type ServiceId } from './ecosystem';
import type { OgKey } from './og';

/**
 * Les pages du landing (idem.africa/<langue>/…). Les titres et descriptions,
 * eux, sont traduits dans le landing (`$localize`) ; ici vivent ce que toutes
 * les langues partagent : le chemin, l'image, le sujet, la place dans le plan
 * du site. Les plans du site sont générés depuis cette liste.
 */
export type LandingPageId =
  | 'home'
  | 'pricing'
  | 'simulator'
  | 'icode'
  | 'ideploy'
  | 'about'
  | 'open-source'
  | 'african-market'
  | 'contact'
  | 'premium-beta'
  | 'privacy-policy'
  | 'terms-of-service'
  | 'beta-policy'
  | 'simulation-terms'
  | 'not-found';

export interface LandingPage {
  id: LandingPageId;
  /** Chemin sans langue ; `''` = accueil. */
  path: string;
  og: OgKey;
  /** Le sujet de la page : un service, ou IDEM tout entier. */
  about: ServiceId | 'platform';
  pageType: 'WebPage' | 'AboutPage' | 'ContactPage' | 'CollectionPage';
  /** `null` : page non indexée (et absente du plan du site). */
  sitemap: { priority: number; changefreq: 'weekly' | 'monthly' | 'yearly' } | null;
}

export const LANDING_PAGES: Record<LandingPageId, LandingPage> = {
  home: { id: 'home', path: '', og: 'home', about: 'platform', pageType: 'WebPage', sitemap: { priority: 1, changefreq: 'weekly' } },
  pricing: { id: 'pricing', path: '/pricing', og: 'pricing', about: 'platform', pageType: 'WebPage', sitemap: { priority: 0.9, changefreq: 'weekly' } },
  simulator: { id: 'simulator', path: '/simulator', og: 'simulator', about: 'simulator', pageType: 'WebPage', sitemap: { priority: 0.9, changefreq: 'monthly' } },
  icode: { id: 'icode', path: '/idev', og: 'icode', about: 'icode', pageType: 'WebPage', sitemap: { priority: 0.9, changefreq: 'monthly' } },
  ideploy: { id: 'ideploy', path: '/ideploy', og: 'ideploy', about: 'ideploy', pageType: 'WebPage', sitemap: { priority: 0.9, changefreq: 'monthly' } },
  about: { id: 'about', path: '/about', og: 'about', about: 'platform', pageType: 'AboutPage', sitemap: { priority: 0.7, changefreq: 'monthly' } },
  'open-source': { id: 'open-source', path: '/open-source', og: 'open-source', about: 'platform', pageType: 'WebPage', sitemap: { priority: 0.7, changefreq: 'monthly' } },
  'african-market': { id: 'african-market', path: '/african-market', og: 'african-market', about: 'platform', pageType: 'WebPage', sitemap: { priority: 0.7, changefreq: 'monthly' } },
  contact: { id: 'contact', path: '/contact', og: 'contact', about: 'platform', pageType: 'ContactPage', sitemap: { priority: 0.6, changefreq: 'yearly' } },
  'premium-beta': { id: 'premium-beta', path: '/premium-beta', og: 'beta', about: 'platform', pageType: 'WebPage', sitemap: { priority: 0.5, changefreq: 'monthly' } },
  'privacy-policy': { id: 'privacy-policy', path: '/privacy-policy', og: 'legal', about: 'platform', pageType: 'WebPage', sitemap: { priority: 0.3, changefreq: 'yearly' } },
  'terms-of-service': { id: 'terms-of-service', path: '/terms-of-service', og: 'legal', about: 'platform', pageType: 'WebPage', sitemap: { priority: 0.3, changefreq: 'yearly' } },
  'beta-policy': { id: 'beta-policy', path: '/beta-policy', og: 'legal', about: 'platform', pageType: 'WebPage', sitemap: { priority: 0.3, changefreq: 'yearly' } },
  'simulation-terms': { id: 'simulation-terms', path: '/simulation-terms', og: 'legal', about: 'simulator', pageType: 'WebPage', sitemap: { priority: 0.3, changefreq: 'yearly' } },
  'not-found': { id: 'not-found', path: '/not-found', og: 'not-found', about: 'platform', pageType: 'WebPage', sitemap: null },
};

/**
 * L'URL canonique d'une page dans une langue. L'accueil finit par `/` :
 * c'est l'adresse que le serveur sert sans redirection.
 */
export function landingUrl(path: string, locale: SeoLocale): string {
  return `${IDEM.url}/${locale}${path || '/'}`;
}

/** Le plan du site d'une langue, avec les équivalents dans l'autre langue. */
export function renderLandingSitemap(locale: SeoLocale): string {
  const urls = Object.values(LANDING_PAGES)
    .filter((p) => p.sitemap)
    .map((p) => {
      const alternates = [
        ...SEO_LOCALES.map(
          (l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${landingUrl(p.path, l)}" />`,
        ),
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${landingUrl(p.path, 'en')}" />`,
      ];
      return [
        '  <url>',
        `    <loc>${landingUrl(p.path, locale)}</loc>`,
        ...alternates,
        `    <changefreq>${p.sitemap!.changefreq}</changefreq>`,
        `    <priority>${p.sitemap!.priority.toFixed(1)}</priority>`,
        '  </url>',
      ].join('\n');
    });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!-- Généré par packages/shared-seo (npm run seo:sync), ne pas éditer à la main. -->',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}

/** L'index des plans du site du landing. */
export function renderLandingSitemapIndex(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!-- Généré par packages/shared-seo (npm run seo:sync), ne pas éditer à la main. -->',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...SEO_LOCALES.map((l) => `  <sitemap>\n    <loc>${IDEM.url}/sitemap-${l}.xml</loc>\n  </sitemap>`),
    '</sitemapindex>',
    '',
  ].join('\n');
}

/** Le `robots.txt` du landing. */
export function renderLandingRobots(): string {
  return [
    `# ${IDEM.name} — ${IDEM.url}`,
    '# Généré par packages/shared-seo (npm run seo:sync), ne pas éditer à la main.',
    '',
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${IDEM.url}/sitemap.xml`,
    '',
  ].join('\n');
}
