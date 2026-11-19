/**
 * QUELLE TECHNOLOGIE FAIT CE SITE — et donc comment le lire.
 *
 * Le relevé d'un site (`site-crawler.ts`) et son scan de marque (`site-scanner.ts`) ouvrent la page dans Chromium :
 * le JavaScript s'exécute, une application React, Vue ou Angular s'affiche. Mais chaque famille de technologies casse
 * autre chose : les routes en `#/` d'Angular se confondent avec l'accueil, une application sans renvoi des adresses
 * profondes répond 404, les composants web cachent leur texte dans un Shadow DOM, Flutter dessine dans un <canvas>,
 * Wix sert ses images en vignettes, Cloudflare montre « Just a moment… ».
 *
 * Un seul processus, donc, mais réglé par la technologie détectée :
 *
 *   1. le CATALOGUE (`TECHNOLOGIES`) : ~230 technologies — CMS, constructeurs de sites, e-commerce, frameworks
 *      JavaScript, méta-frameworks, générateurs statiques, frameworks serveur, hébergeurs et protections, bandeaux de
 *      consentement, traducteurs — chacune avec ses signatures (balise generator, scripts, variables globales, DOM,
 *      en-têtes, cookies) et sa FAMILLE de rendu ;
 *   2. la DÉTECTION (`detectInPage` + `detectFromHeaders`) : ce que la page et sa réponse en disent, et des constats
 *      mesurés (routes en `#`, Shadow DOM, site dans un iframe, page dessinée dans un canvas, mur anti-robot,
 *      bandeau de cookies) ;
 *   3. le PROFIL (`profileOf`) : ce que le relevé doit faire pour CE site — chaque adaptation est décidée ici, en un
 *      seul endroit, et lisible dans les journaux.
 *
 * Rien n'est appelé sur un modèle : des règles et des mesures.
 */

/* eslint-disable no-var */
declare var document: any;
declare var window: any;
declare var getComputedStyle: any;
/* eslint-enable no-var */

export type TechCategory =
  | 'cms'
  | 'builder'
  | 'ecommerce'
  | 'js-framework'
  | 'meta-framework'
  | 'static-generator'
  | 'server-framework'
  | 'language'
  | 'hosting'
  | 'protection'
  | 'consent'
  | 'translation'
  | 'page-builder'
  | 'docs'
  | 'canvas';

/**
 * La famille de rendu, celle qui décide du relevé :
 *   server   HTML complet servi par le serveur (WordPress, Django, Rails, ASP.NET, Laravel…)
 *   static   HTML pré-construit (Hugo, Jekyll, Eleventy, Astro, Docusaurus…)
 *   hybrid   HTML servi PUIS repris par une application (Next.js, Nuxt, Remix, SvelteKit, Gatsby…)
 *   spa      page vide remplie dans le navigateur (React, Vue, Angular, Svelte, Ember, Blazor WebAssembly…)
 *   builder  constructeur hébergé, beaucoup de JavaScript (Wix, Squarespace, Webflow, Framer, Shopify…)
 *   canvas   dessin dans un <canvas>, sans texte dans le DOM (Flutter web, Unity, jeux)
 */
export type RenderFamily = 'server' | 'static' | 'hybrid' | 'spa' | 'builder' | 'canvas';

export interface TechRule {
  id: string;
  name: string;
  category: TechCategory;
  family?: RenderFamily;
  /** Contenu de `<meta name="generator">` (expression régulière, sans casse). */
  meta?: string;
  /** Adresse d'un script ou d'une feuille de style chargée (expression régulière). */
  src?: string;
  /** Variables globales (`window.X`, chemin pointé `a.b`). */
  globals?: string[];
  /** Sélecteur CSS présent dans la page. */
  dom?: string;
  /** Texte du HTML (premiers 300 ko). */
  html?: string;
  /** En-tête de la réponse : `nom: motif`. */
  headers?: Record<string, string>;
  /** Nom de cookie (expression régulière). */
  cookie?: string;
}

/* -------------------------------------------------------------------------- */
/*  Le catalogue                                                               */
/* -------------------------------------------------------------------------- */

export const TECHNOLOGIES: TechRule[] = [
  // ── CMS ─────────────────────────────────────────────────────────────────────
  { id: 'wordpress', name: 'WordPress', category: 'cms', family: 'server', meta: '^WordPress', src: '/wp-(content|includes)/', html: 'wp-json|wp-emoji', dom: 'link[rel="https://api.w.org/"]' },
  { id: 'drupal', name: 'Drupal', category: 'cms', family: 'server', meta: '^Drupal', globals: ['Drupal'], src: '/sites/(default|all)/(files|modules|themes)/|/core/misc/drupal', headers: { 'x-generator': 'Drupal', 'x-drupal-cache': '.' } },
  { id: 'joomla', name: 'Joomla', category: 'cms', family: 'server', meta: '^Joomla', src: '/media/(jui|system)/|/components/com_', globals: ['Joomla'] },
  { id: 'typo3', name: 'TYPO3', category: 'cms', family: 'server', meta: 'TYPO3', src: '/typo3(conf|temp)/|/_assets/' },
  { id: 'ghost', name: 'Ghost', category: 'cms', family: 'server', meta: '^Ghost', src: '/ghost/|/public/ghost|cdn\\.jsdelivr\\.net/ghost/' },
  { id: 'craft', name: 'Craft CMS', category: 'cms', family: 'server', headers: { 'x-powered-by': 'Craft CMS' }, cookie: '^CraftSessionId' },
  { id: 'concrete', name: 'Concrete CMS', category: 'cms', family: 'server', meta: 'concrete5|Concrete CMS', src: '/concrete/' },
  { id: 'umbraco', name: 'Umbraco', category: 'cms', family: 'server', src: '/umbraco/', html: 'umbraco' },
  { id: 'sitecore', name: 'Sitecore', category: 'cms', family: 'server', src: '/-/media/|/sitecore/', cookie: '^(SC_ANALYTICS_GLOBAL_COOKIE|sc_ext)' },
  { id: 'aem', name: 'Adobe Experience Manager', category: 'cms', family: 'server', src: '/etc\\.clientlibs/|/content/dam/', html: 'cq-|data-cmp-' },
  { id: 'kentico', name: 'Kentico', category: 'cms', family: 'server', meta: 'Kentico', src: '/CMSPages/|/kentico' },
  { id: 'dnn', name: 'DNN (DotNetNuke)', category: 'cms', family: 'server', globals: ['dnn'], src: '/DesktopModules/|/Portals/' },
  { id: 'sitefinity', name: 'Sitefinity', category: 'cms', family: 'server', meta: 'Sitefinity', src: 'Telerik\\.Sitefinity' },
  { id: 'expressionengine', name: 'ExpressionEngine', category: 'cms', family: 'server', cookie: '^exp_' },
  { id: 'processwire', name: 'ProcessWire', category: 'cms', family: 'server', headers: { 'x-powered-by': 'ProcessWire' }, src: '/site/(templates|assets)/' },
  { id: 'grav', name: 'Grav', category: 'cms', family: 'server', meta: '^GravCMS' },
  { id: 'kirby', name: 'Kirby', category: 'cms', family: 'server', src: '/media/pages/|/assets/kirby' },
  { id: 'octobercms', name: 'October CMS', category: 'cms', family: 'server', meta: 'OctoberCMS', src: '/modules/system/assets/' },
  { id: 'statamic', name: 'Statamic', category: 'cms', family: 'server', headers: { 'x-powered-by': 'Statamic' } },
  { id: 'silverstripe', name: 'Silverstripe', category: 'cms', family: 'server', meta: 'SilverStripe', src: '/_resources/' },
  { id: 'magnolia', name: 'Magnolia', category: 'cms', family: 'server', src: '/\\.resources/|/dam/jcr' },
  { id: 'liferay', name: 'Liferay', category: 'cms', family: 'server', globals: ['Liferay'] },
  { id: 'contao', name: 'Contao', category: 'cms', family: 'server', meta: 'Contao', src: '/assets/contao/' },
  { id: 'plone', name: 'Plone', category: 'cms', family: 'server', meta: 'Plone' },
  { id: 'pimcore', name: 'Pimcore', category: 'cms', family: 'server', headers: { 'x-powered-by': 'pimcore' } },
  { id: 'spip', name: 'SPIP', category: 'cms', family: 'server', meta: '^SPIP', src: 'spip\\.php|/squelettes' },
  { id: 'hubspot-cms', name: 'HubSpot CMS', category: 'cms', family: 'server', src: 'hubspotusercontent|hs-sites\\.com', headers: { 'x-hs-hub-id': '.' } },
  { id: 'blogger', name: 'Blogger', category: 'cms', family: 'server', meta: '^blogger', src: 'blogger\\.com|blogspot\\.com' },
  { id: 'medium', name: 'Medium', category: 'cms', family: 'hybrid', src: 'cdn-client\\.medium\\.com' },
  { id: 'substack', name: 'Substack', category: 'cms', family: 'hybrid', src: 'substackcdn\\.com' },
  { id: 'tumblr', name: 'Tumblr', category: 'cms', family: 'server', src: 'assets\\.tumblr\\.com' },
  { id: 'strapi', name: 'Strapi (headless)', category: 'cms', html: '/uploads/[\\w-]+_[a-f0-9]{10}\\.' },
  { id: 'contentful', name: 'Contentful (headless)', category: 'cms', src: 'ctfassets\\.net' },
  { id: 'sanity', name: 'Sanity (headless)', category: 'cms', src: 'cdn\\.sanity\\.io' },
  { id: 'prismic', name: 'Prismic (headless)', category: 'cms', src: 'images\\.prismic\\.io|prismic\\.io' },
  { id: 'storyblok', name: 'Storyblok (headless)', category: 'cms', src: 'a\\.storyblok\\.com' },
  { id: 'datocms', name: 'DatoCMS (headless)', category: 'cms', src: 'datocms-assets\\.com' },
  { id: 'directus', name: 'Directus (headless)', category: 'cms', html: '/assets/[0-9a-f-]{36}' },
  { id: 'hygraph', name: 'Hygraph (headless)', category: 'cms', src: 'media\\.graphassets\\.com|graphcms' },
  { id: 'payload', name: 'Payload (headless)', category: 'cms', html: '/api/media/file/' },
  { id: 'builderio', name: 'Builder.io', category: 'cms', src: 'cdn\\.builder\\.io', html: 'builder-block' },

  // ── Constructeurs de pages (dans un CMS) ────────────────────────────────────
  { id: 'elementor', name: 'Elementor', category: 'page-builder', dom: '.elementor, [data-elementor-type]', src: '/elementor/' },
  { id: 'divi', name: 'Divi', category: 'page-builder', dom: '#et-main-area, .et_pb_section', src: '/Divi/|et-core' },
  { id: 'beaver', name: 'Beaver Builder', category: 'page-builder', dom: '.fl-builder-content', src: 'bb-plugin' },
  { id: 'wpbakery', name: 'WPBakery', category: 'page-builder', dom: '.vc_row, .wpb_row', src: 'js_composer' },
  { id: 'oxygen', name: 'Oxygen', category: 'page-builder', dom: '.ct-section, [id^="section-"][class*="ct-"]', src: '/oxygen/' },
  { id: 'bricks', name: 'Bricks', category: 'page-builder', dom: '.brxe-section, [class*="brxe-"]', src: '/bricks/' },
  { id: 'avada', name: 'Avada', category: 'page-builder', dom: '.fusion-builder-row, .fusion-fullwidth', src: '/Avada/' },
  { id: 'gutenberg', name: 'Gutenberg (blocs)', category: 'page-builder', dom: '.wp-block-group, .wp-block-cover, .wp-block-columns' },
  { id: 'kadence', name: 'Kadence', category: 'page-builder', dom: '.kb-row-layout-wrap, .kadence-column', src: 'kadence' },
  { id: 'brizy', name: 'Brizy', category: 'page-builder', dom: '.brz-section, [class*="brz-"]', src: 'brizy' },
  { id: 'thrive', name: 'Thrive Architect', category: 'page-builder', dom: '.thrv_wrapper, #tve_editor', src: 'thrive' },
  { id: 'siteorigin', name: 'SiteOrigin', category: 'page-builder', dom: '.panel-grid, .so-panel', src: 'siteorigin' },

  // ── Constructeurs de sites hébergés ─────────────────────────────────────────
  { id: 'wix', name: 'Wix', category: 'builder', family: 'builder', meta: 'Wix\\.com', src: 'static\\.parastorage\\.com|static\\.wixstatic\\.com', globals: ['wixBiSession'], dom: '#SITE_CONTAINER', headers: { 'x-wix-request-id': '.' } },
  { id: 'squarespace', name: 'Squarespace', category: 'builder', family: 'builder', src: 'static1\\.squarespace\\.com|assets\\.squarespace\\.com', globals: ['Static.SQUARESPACE_CONTEXT'], dom: '.sqs-block, [data-squarespace-cacheversion]' },
  { id: 'webflow', name: 'Webflow', category: 'builder', family: 'static', meta: '^Webflow', html: 'data-wf-(page|site)', src: 'assets\\.website-files\\.com|cdn\\.prod\\.website-files\\.com' },
  { id: 'framer', name: 'Framer', category: 'builder', family: 'hybrid', meta: '^Framer', src: 'framerusercontent\\.com|framer\\.com/m/', dom: '[data-framer-name], #__framer-badge-container' },
  { id: 'duda', name: 'Duda', category: 'builder', family: 'builder', src: 'irp\\.cdn-website\\.com|cdn-website\\.com|dudamobile', globals: ['dmAPI'] },
  { id: 'weebly', name: 'Weebly', category: 'builder', family: 'builder', src: 'editmysite\\.com|weebly\\.com', globals: ['_W'] },
  { id: 'godaddy', name: 'GoDaddy Website Builder', category: 'builder', family: 'builder', src: 'img1\\.wsimg\\.com|websites\\.godaddy\\.com', meta: 'Starfield|Go Daddy' },
  { id: 'jimdo', name: 'Jimdo', category: 'builder', family: 'builder', src: 'jimcdn\\.com|jimdo', globals: ['jimdoData'] },
  { id: 'tilda', name: 'Tilda', category: 'builder', family: 'static', src: 'static\\.tildacdn\\.com|tilda\\.ws', dom: '.t-records, [data-tilda-page-id]' },
  { id: 'carrd', name: 'Carrd', category: 'builder', family: 'static', meta: 'carrd', html: 'carrd\\.co' },
  { id: 'google-sites', name: 'Google Sites', category: 'builder', family: 'builder', src: 'sites\\.google\\.com|gstatic\\.com/atari' },
  { id: 'strikingly', name: 'Strikingly', category: 'builder', family: 'builder', src: 'strikingly|static-assets\\.strikinglycdn\\.com' },
  { id: 'site123', name: 'SITE123', category: 'builder', family: 'builder', src: 'site123\\.me|cdn-cms\\.f-static\\.com' },
  { id: 'webnode', name: 'Webnode', category: 'builder', family: 'builder', src: 'webnode\\.(com|page)|wnd\\.' },
  { id: 'zyro', name: 'Hostinger Website Builder (Zyro)', category: 'builder', family: 'hybrid', src: 'zyrosite\\.com|assets\\.zyrosite\\.com|hostinger' },
  { id: 'yola', name: 'Yola', category: 'builder', family: 'builder', src: 'yola' },
  { id: 'ucraft', name: 'Ucraft', category: 'builder', family: 'builder', src: 'ucraft' },
  { id: 'mobirise', name: 'Mobirise', category: 'builder', family: 'static', meta: 'Mobirise', src: 'mobirise' },
  { id: 'notion', name: 'Notion (site publié)', category: 'builder', family: 'spa', src: 'notion\\.so|notion\\.site|super\\.so|potion\\.so', dom: '.notion-page-content, .notion-app' },
  { id: 'bubble', name: 'Bubble', category: 'builder', family: 'spa', src: 'bubble\\.io|cdn\\.bubble\\.io', globals: ['bubble_version'] },
  { id: 'softr', name: 'Softr', category: 'builder', family: 'spa', src: 'softr' },
  { id: 'glide', name: 'Glide', category: 'builder', family: 'spa', src: 'glideapps' },
  { id: 'typedream', name: 'Typedream', category: 'builder', family: 'hybrid', src: 'typedream' },
  { id: 'unicorn', name: 'Unicorn Platform', category: 'builder', family: 'static', src: 'unicornplatform' },
  { id: 'leadpages', name: 'Leadpages', category: 'builder', family: 'builder', src: 'leadpages' },
  { id: 'unbounce', name: 'Unbounce', category: 'builder', family: 'builder', src: 'unbounce|ubembed' },
  { id: 'instapage', name: 'Instapage', category: 'builder', family: 'builder', src: 'instapage' },
  { id: 'clickfunnels', name: 'ClickFunnels', category: 'builder', family: 'builder', src: 'clickfunnels|cf-assets' },
  { id: 'systemeio', name: 'Systeme.io', category: 'builder', family: 'spa', src: 'systeme\\.io' },
  { id: 'kajabi', name: 'Kajabi', category: 'builder', family: 'server', src: 'kajabi' },
  { id: 'teachable', name: 'Teachable', category: 'builder', family: 'server', src: 'teachable|teachablecdn' },
  { id: 'thinkific', name: 'Thinkific', category: 'builder', family: 'server', src: 'thinkific' },
  { id: 'podia', name: 'Podia', category: 'builder', family: 'server', src: 'podia' },
  { id: 'linktree', name: 'Linktree', category: 'builder', family: 'hybrid', src: 'linktr\\.ee|linktree' },
  { id: 'beacons', name: 'Beacons', category: 'builder', family: 'spa', src: 'beacons\\.ai' },
  { id: 'canva-sites', name: 'Canva (site)', category: 'builder', family: 'spa', src: 'canva\\.(com|site)|static\\.canva\\.com' },
  { id: 'adobe-portfolio', name: 'Adobe Portfolio', category: 'builder', family: 'server', src: 'myportfolio\\.com|cdn\\.myportfolio\\.com' },
  { id: 'format', name: 'Format', category: 'builder', family: 'server', src: 'format\\.com' },
  { id: 'pixpa', name: 'Pixpa', category: 'builder', family: 'server', src: 'pixpa' },
  { id: 'zoho-sites', name: 'Zoho Sites', category: 'builder', family: 'builder', src: 'zohositescontent|zohosites' },
  { id: 'site-builder-ionos', name: 'IONOS MyWebsite', category: 'builder', family: 'builder', src: 'jimcdn|ionos|1and1' },
  { id: 'wordpress-com', name: 'WordPress.com', category: 'builder', family: 'server', src: 's0\\.wp\\.com|wordpress\\.com' },
  { id: 'gamma', name: 'Gamma', category: 'builder', family: 'spa', src: 'gamma\\.app|cdn\\.gamma\\.app' },
  { id: 'durable', name: 'Durable', category: 'builder', family: 'hybrid', src: 'durable\\.co' },
  { id: '10web', name: '10Web', category: 'builder', family: 'server', src: '10web' },

  // ── E-commerce ──────────────────────────────────────────────────────────────
  { id: 'shopify', name: 'Shopify', category: 'ecommerce', family: 'server', globals: ['Shopify'], src: 'cdn\\.shopify\\.com|myshopify\\.com', headers: { 'x-shopid': '.', 'x-shopify-stage': '.' } },
  { id: 'shopify-hydrogen', name: 'Shopify Hydrogen', category: 'ecommerce', family: 'hybrid', globals: ['__remixContext', '__hydrogen'], src: 'cdn\\.shopify\\.com/oxygen' },
  { id: 'woocommerce', name: 'WooCommerce', category: 'ecommerce', family: 'server', src: '/woocommerce/', dom: '.woocommerce, body.woocommerce-page', globals: ['wc_add_to_cart_params'] },
  { id: 'magento', name: 'Magento / Adobe Commerce', category: 'ecommerce', family: 'server', src: '/static/(version\\d+/)?frontend/|/mage/(cookies|requirejs)', globals: ['Mage'], cookie: '^(mage-|form_key)' },
  { id: 'prestashop', name: 'PrestaShop', category: 'ecommerce', family: 'server', meta: 'PrestaShop', globals: ['prestashop'], src: '/modules/ps_[a-z]+/|prestashop\\.(min\\.)?js' },
  { id: 'bigcommerce', name: 'BigCommerce', category: 'ecommerce', family: 'server', src: 'bigcommerce\\.com|cdn\\d+\\.bigcommerce', globals: ['BCData'] },
  { id: 'opencart', name: 'OpenCart', category: 'ecommerce', family: 'server', src: 'catalog/view/(theme|javascript)', cookie: '^OCSESSID' },
  { id: 'sfcc', name: 'Salesforce Commerce Cloud', category: 'ecommerce', family: 'server', src: 'demandware\\.(net|static)|/on/demandware' },
  { id: 'shopware', name: 'Shopware', category: 'ecommerce', family: 'server', meta: 'Shopware', src: '/bundles/storefront/|/theme/[0-9a-f]{32}/' },
  { id: 'ecwid', name: 'Ecwid', category: 'ecommerce', src: 'app\\.ecwid\\.com|ecwid', globals: ['Ecwid'] },
  { id: 'volusion', name: 'Volusion', category: 'ecommerce', family: 'server', src: 'volusion' },
  { id: 'shift4shop', name: 'Shift4Shop (3dcart)', category: 'ecommerce', family: 'server', src: '3dcart|shift4shop' },
  { id: 'nopcommerce', name: 'nopCommerce', category: 'ecommerce', family: 'server', meta: 'nopCommerce', cookie: '^Nop\\.' },
  { id: 'saleor', name: 'Saleor', category: 'ecommerce', src: 'saleor' },
  { id: 'medusa', name: 'Medusa', category: 'ecommerce', src: 'medusa' },
  { id: 'sylius', name: 'Sylius', category: 'ecommerce', family: 'server', src: '/bundles/syliusshop/' },
  { id: 'gumroad', name: 'Gumroad', category: 'ecommerce', src: 'gumroad\\.com' },
  { id: 'selz', name: 'Selz', category: 'ecommerce', src: 'selz' },
  { id: 'jumpseller', name: 'Jumpseller', category: 'ecommerce', family: 'server', src: 'jumpseller' },
  { id: 'vtex', name: 'VTEX', category: 'ecommerce', family: 'hybrid', src: 'vteximg|vtexassets|vtex\\.com' },
  { id: 'lightspeed', name: 'Lightspeed eCom', category: 'ecommerce', family: 'server', src: 'webshopapp\\.com|lightspeed' },

  // ── Frameworks JavaScript (rendu dans le navigateur) ────────────────────────
  { id: 'react', name: 'React', category: 'js-framework', family: 'spa', globals: ['React', '__REACT_DEVTOOLS_GLOBAL_HOOK__.renderers.size'], dom: '[data-reactroot], #root, #react-root', html: '__REACT|data-reactroot' },
  { id: 'vue', name: 'Vue.js', category: 'js-framework', family: 'spa', globals: ['Vue', '__VUE__'], dom: '[data-v-app], [data-server-rendered], #app' },
  { id: 'angular', name: 'Angular', category: 'js-framework', family: 'spa', globals: ['ng', 'getAllAngularRootElements'], dom: '[ng-version], app-root' },
  { id: 'angularjs', name: 'AngularJS (1.x)', category: 'js-framework', family: 'spa', globals: ['angular.version'], dom: '[ng-app], [data-ng-app], [ng-controller]' },
  { id: 'svelte', name: 'Svelte', category: 'js-framework', family: 'spa', html: 'svelte-[a-z0-9]{6}' },
  { id: 'preact', name: 'Preact', category: 'js-framework', family: 'spa', globals: ['preact', '__PREACT_DEVTOOLS__'] },
  { id: 'solid', name: 'SolidJS', category: 'js-framework', family: 'spa', globals: ['_$HY', 'Solid$$'] },
  { id: 'ember', name: 'Ember.js', category: 'js-framework', family: 'spa', globals: ['Ember', 'EmberENV'], dom: '.ember-view, .ember-application' },
  { id: 'backbone', name: 'Backbone.js', category: 'js-framework', family: 'spa', globals: ['Backbone'] },
  { id: 'alpine', name: 'Alpine.js', category: 'js-framework', globals: ['Alpine'], dom: '[x-data]' },
  { id: 'lit', name: 'Lit', category: 'js-framework', family: 'spa', globals: ['litElementVersions', 'litHtmlVersions'] },
  { id: 'stencil', name: 'Stencil', category: 'js-framework', family: 'spa', dom: '[s-id], .hydrated', html: 'stencil' },
  { id: 'polymer', name: 'Polymer', category: 'js-framework', family: 'spa', globals: ['Polymer'] },
  { id: 'ionic', name: 'Ionic', category: 'js-framework', family: 'spa', dom: 'ion-app, ion-content' },
  { id: 'mithril', name: 'Mithril', category: 'js-framework', family: 'spa', globals: ['m.version'] },
  { id: 'inferno', name: 'Inferno', category: 'js-framework', family: 'spa', globals: ['Inferno'] },
  { id: 'qwik', name: 'Qwik', category: 'js-framework', family: 'hybrid', dom: '[q\\:container], [q\\:base]', html: 'q:container' },
  { id: 'htmx', name: 'htmx', category: 'js-framework', globals: ['htmx'], dom: '[hx-get], [hx-post], [data-hx-get]' },
  { id: 'hotwire', name: 'Hotwire / Turbo', category: 'js-framework', globals: ['Turbo', 'Stimulus'], dom: 'turbo-frame, [data-turbo], [data-controller]' },
  { id: 'knockout', name: 'Knockout', category: 'js-framework', family: 'spa', globals: ['ko.version'], dom: '[data-bind]' },
  { id: 'aurelia', name: 'Aurelia', category: 'js-framework', family: 'spa', dom: '[aurelia-app]' },
  { id: 'elm', name: 'Elm', category: 'js-framework', family: 'spa', globals: ['Elm'] },
  { id: 'jquery', name: 'jQuery', category: 'js-framework', globals: ['jQuery.fn.jquery'] },
  { id: 'blazor-wasm', name: 'Blazor WebAssembly', category: 'js-framework', family: 'spa', src: '_framework/blazor\\.webassembly\\.js', globals: ['Blazor'] },
  { id: 'blazor-server', name: 'Blazor Server', category: 'server-framework', family: 'hybrid', src: '_framework/blazor\\.(server|web)\\.js' },
  { id: 'react-native-web', name: 'React Native Web / Expo', category: 'js-framework', family: 'spa', dom: '[data-testid][class^="css-"], #root div[class^="css-view"]', html: 'css-view-' },

  // ── Méta-frameworks (rendu serveur + reprise) ───────────────────────────────
  { id: 'nextjs', name: 'Next.js', category: 'meta-framework', family: 'hybrid', globals: ['__NEXT_DATA__', 'next', '__BUILD_MANIFEST'], src: '/_next/static/', dom: '#__next', headers: { 'x-powered-by': 'Next\\.js', 'x-nextjs-cache': '.' } },
  { id: 'nuxt', name: 'Nuxt', category: 'meta-framework', family: 'hybrid', globals: ['__NUXT__', '$nuxt'], src: '/_nuxt/', dom: '#__nuxt, #__layout' },
  { id: 'remix', name: 'Remix / React Router', category: 'meta-framework', family: 'hybrid', globals: ['__remixContext', '__reactRouterContext'] },
  { id: 'sveltekit', name: 'SvelteKit', category: 'meta-framework', family: 'hybrid', html: '__sveltekit_|data-sveltekit', src: '/_app/immutable/' },
  { id: 'gatsby', name: 'Gatsby', category: 'meta-framework', family: 'hybrid', meta: '^Gatsby', globals: ['___gatsby', '___loader'], dom: '#___gatsby' },
  { id: 'astro', name: 'Astro', category: 'static-generator', family: 'static', meta: '^Astro', dom: 'astro-island, [data-astro-cid], [data-astro-source-file]', src: '/_astro/' },
  { id: 'angular-ssr', name: 'Angular SSR (Universal)', category: 'meta-framework', family: 'hybrid', dom: 'script#ng-state, [ng-server-context]' },
  { id: 'solidstart', name: 'SolidStart', category: 'meta-framework', family: 'hybrid', html: '_\\$HY|solid-start' },
  { id: 'qwik-city', name: 'Qwik City', category: 'meta-framework', family: 'hybrid', html: 'qwikcity' },
  { id: 'analog', name: 'Analog', category: 'meta-framework', family: 'hybrid', html: 'analogjs' },
  { id: 'redwood', name: 'RedwoodJS', category: 'meta-framework', family: 'spa', globals: ['__REDWOOD__API_URL'] },
  { id: 'blitz', name: 'Blitz.js', category: 'meta-framework', family: 'hybrid', html: 'blitz' },
  { id: 'fresh', name: 'Fresh (Deno)', category: 'meta-framework', family: 'hybrid', src: '/_frsh/' },
  { id: 'quasar', name: 'Quasar', category: 'meta-framework', family: 'spa', dom: '.q-layout, .q-page' },
  { id: 'meteor', name: 'Meteor', category: 'meta-framework', family: 'spa', globals: ['Meteor', '__meteor_runtime_config__'] },
  { id: 'inertia', name: 'Inertia.js', category: 'meta-framework', family: 'spa', dom: '#app[data-page]' },
  { id: 'livewire', name: 'Laravel Livewire', category: 'meta-framework', family: 'server', globals: ['Livewire'], dom: '[wire\\:id]' },
  { id: 'vaadin', name: 'Vaadin', category: 'meta-framework', family: 'spa', globals: ['Vaadin'], dom: 'vaadin-app-layout' },

  // ── Générateurs statiques et sites de documentation ─────────────────────────
  { id: 'hugo', name: 'Hugo', category: 'static-generator', family: 'static', meta: '^Hugo' },
  { id: 'jekyll', name: 'Jekyll', category: 'static-generator', family: 'static', meta: '^Jekyll' },
  { id: 'eleventy', name: 'Eleventy', category: 'static-generator', family: 'static', meta: '^Eleventy' },
  { id: 'hexo', name: 'Hexo', category: 'static-generator', family: 'static', meta: '^Hexo' },
  { id: 'pelican', name: 'Pelican', category: 'static-generator', family: 'static', meta: 'Pelican' },
  { id: 'middleman', name: 'Middleman', category: 'static-generator', family: 'static', meta: 'Middleman' },
  { id: 'gridsome', name: 'Gridsome', category: 'static-generator', family: 'hybrid', meta: '^Gridsome' },
  { id: 'vuepress', name: 'VuePress', category: 'docs', family: 'hybrid', meta: '^VuePress' },
  { id: 'vitepress', name: 'VitePress', category: 'docs', family: 'hybrid', meta: '^VitePress', dom: '#VPContent, .VPDoc' },
  { id: 'docusaurus', name: 'Docusaurus', category: 'docs', family: 'hybrid', meta: '^Docusaurus', globals: ['__DOCUSAURUS_INSERT_BASEURL_BANNER'] },
  { id: 'nextra', name: 'Nextra', category: 'docs', family: 'hybrid', dom: '.nextra-content, .nextra-nav-container' },
  { id: 'mkdocs', name: 'MkDocs', category: 'docs', family: 'static', meta: '^mkdocs' },
  { id: 'sphinx', name: 'Sphinx', category: 'docs', family: 'static', meta: '^Sphinx', src: '_static/(documentation_options|basic|pygments)' },
  { id: 'gitbook', name: 'GitBook', category: 'docs', family: 'hybrid', src: 'gitbook' },
  { id: 'mintlify', name: 'Mintlify', category: 'docs', family: 'hybrid', src: 'mintlify' },
  { id: 'readme', name: 'ReadMe', category: 'docs', family: 'hybrid', src: 'readme\\.(io|com)' },
  { id: 'starlight', name: 'Starlight (Astro)', category: 'docs', family: 'static', dom: '.sl-markdown-content, starlight-menu-button' },

  // ── Frameworks serveur et langages (HTML servi : relevé direct) ─────────────
  { id: 'php', name: 'PHP', category: 'language', family: 'server', headers: { 'x-powered-by': 'PHP' }, cookie: '^PHPSESSID$' },
  { id: 'laravel', name: 'Laravel', category: 'server-framework', family: 'server', cookie: '^laravel_session$' },
  { id: 'symfony', name: 'Symfony', category: 'server-framework', family: 'server', headers: { 'x-debug-token': '.' }, cookie: '^sf_redirect' },
  { id: 'codeigniter', name: 'CodeIgniter', category: 'server-framework', family: 'server', cookie: '^ci_session' },
  { id: 'cakephp', name: 'CakePHP', category: 'server-framework', family: 'server', cookie: '^CAKEPHP' },
  { id: 'yii', name: 'Yii', category: 'server-framework', family: 'server', cookie: '^_csrf|YII_CSRF_TOKEN', src: '/assets/[0-9a-f]{8}/yii' },
  { id: 'django', name: 'Django', category: 'server-framework', family: 'server', cookie: '^(csrftoken|django_language|sessionid)$', html: 'csrfmiddlewaretoken|__admin_media_prefix__' },
  { id: 'flask', name: 'Flask', category: 'server-framework', family: 'server', headers: { server: 'Werkzeug' } },
  { id: 'fastapi', name: 'FastAPI / Starlette', category: 'server-framework', family: 'server', headers: { server: 'uvicorn' } },
  { id: 'wagtail', name: 'Wagtail (Django)', category: 'cms', family: 'server', html: 'wagtail' },
  { id: 'django-cms', name: 'django CMS', category: 'cms', family: 'server', html: 'cms-toolbar|djangocms' },
  { id: 'rails', name: 'Ruby on Rails', category: 'server-framework', family: 'server', dom: 'meta[name="csrf-param"][content="authenticity_token"]', headers: { 'x-runtime': '^[0-9.]+$' }, cookie: '^_[a-z0-9_]+_session$' },
  { id: 'sinatra', name: 'Sinatra', category: 'server-framework', family: 'server', headers: { 'x-powered-by': 'Sinatra' } },
  { id: 'express', name: 'Express (Node.js)', category: 'server-framework', family: 'server', headers: { 'x-powered-by': '^Express' } },
  { id: 'nestjs', name: 'NestJS', category: 'server-framework', family: 'server', headers: { 'x-powered-by': 'NestJS' } },
  { id: 'koa', name: 'Koa', category: 'server-framework', family: 'server', cookie: '^koa' },
  { id: 'aspnet', name: 'ASP.NET (Web Forms / MVC)', category: 'server-framework', family: 'server', headers: { 'x-aspnet-version': '.', 'x-powered-by': 'ASP\\.NET' }, dom: 'input[name="__VIEWSTATE"], input[name="__RequestVerificationToken"]', cookie: '^(ASP\\.NET_SessionId|\\.AspNetCore\\.)' },
  { id: 'aspnet-core', name: 'ASP.NET Core / Razor Pages', category: 'server-framework', family: 'server', headers: { server: 'Kestrel' }, cookie: '^\\.AspNetCore\\.' },
  { id: 'spring', name: 'Spring Boot / Java', category: 'server-framework', family: 'server', cookie: '^JSESSIONID$', headers: { 'x-application-context': '.' } },
  { id: 'jsp', name: 'JSP / Java EE', category: 'server-framework', family: 'server', html: '\\.(jsp|jsf|xhtml|do|action)(\\?|"|\')' },
  { id: 'struts', name: 'Apache Struts', category: 'server-framework', family: 'server', html: '\\.action(\\?|")' },
  { id: 'phoenix', name: 'Phoenix (Elixir)', category: 'server-framework', family: 'server', dom: '[data-phx-main], [phx-click]', cookie: '^_[a-z_]+_key$' },
  { id: 'go', name: 'Go (Gin, Echo, Fiber…)', category: 'server-framework', family: 'server', headers: { server: '^(Caddy|fasthttp|gws)' } },
  { id: 'rust', name: 'Rust (Actix, Rocket, Axum)', category: 'server-framework', family: 'server', headers: { server: 'actix|Rocket' } },
  { id: 'coldfusion', name: 'ColdFusion', category: 'server-framework', family: 'server', html: '\\.cfm(\\?|")', cookie: '^(CFID|CFTOKEN)$' },
  { id: 'perl', name: 'Perl (Mojolicious, Dancer, CGI)', category: 'server-framework', family: 'server', headers: { server: 'Mojolicious|Dancer' }, html: '\\.(pl|cgi)(\\?|")' },
  { id: 'play', name: 'Play Framework', category: 'server-framework', family: 'server', cookie: '^PLAY_SESSION$' },
  { id: 'grails', name: 'Grails', category: 'server-framework', family: 'server', html: 'grails' },
  { id: 'adonis', name: 'AdonisJS', category: 'server-framework', family: 'server', cookie: '^adonis-session' },
  { id: 'nodejs', name: 'Node.js', category: 'language', family: 'server', headers: { 'x-powered-by': 'Node' } },
  { id: 'python', name: 'Python', category: 'language', family: 'server', headers: { server: 'Python|gunicorn|uWSGI' } },
  { id: 'ruby', name: 'Ruby', category: 'language', family: 'server', headers: { server: 'Puma|Passenger|Unicorn|WEBrick' } },

  // ── Dessin dans un canvas ───────────────────────────────────────────────────
  { id: 'flutter', name: 'Flutter web', category: 'canvas', family: 'canvas', globals: ['_flutter', 'flutterCanvasKit'], dom: 'flutter-view, flt-glass-pane, flt-scene-host', src: 'flutter(_bootstrap)?\\.js|canvaskit' },
  { id: 'unity', name: 'Unity WebGL', category: 'canvas', family: 'canvas', globals: ['createUnityInstance', 'UnityLoader'], dom: '#unity-canvas' },
  { id: 'godot', name: 'Godot (web)', category: 'canvas', family: 'canvas', globals: ['Engine'], src: 'godot' },
  { id: 'construct', name: 'Construct', category: 'canvas', family: 'canvas', src: 'c3runtime|c2runtime' },
  { id: 'pixi', name: 'PixiJS', category: 'canvas', globals: ['PIXI'] },
  { id: 'threejs', name: 'Three.js', category: 'canvas', globals: ['THREE', '__THREE__'] },
  { id: 'webflow-3d', name: 'Spline', category: 'canvas', src: 'spline\\.design|splinetool' },

  // ── Hébergeurs, CDN, protections ────────────────────────────────────────────
  { id: 'cloudflare', name: 'Cloudflare', category: 'protection', headers: { server: 'cloudflare', 'cf-ray': '.' } },
  { id: 'akamai', name: 'Akamai', category: 'protection', headers: { 'x-akamai-transformed': '.', server: 'AkamaiGHost' } },
  { id: 'fastly', name: 'Fastly', category: 'hosting', headers: { 'x-served-by': 'cache-', via: 'varnish' } },
  { id: 'sucuri', name: 'Sucuri', category: 'protection', headers: { 'x-sucuri-id': '.', server: 'Sucuri' } },
  { id: 'imperva', name: 'Imperva / Incapsula', category: 'protection', headers: { 'x-iinfo': '.', 'x-cdn': 'Incapsula' }, cookie: '^(incap_ses|visid_incap)' },
  { id: 'ddos-guard', name: 'DDoS-Guard', category: 'protection', headers: { server: 'ddos-guard' } },
  { id: 'datadome', name: 'DataDome', category: 'protection', cookie: '^datadome$', headers: { 'x-datadome': '.' } },
  { id: 'perimeterx', name: 'HUMAN / PerimeterX', category: 'protection', cookie: '^_px' },
  { id: 'cloudfront', name: 'Amazon CloudFront', category: 'hosting', headers: { via: 'CloudFront', 'x-amz-cf-id': '.' } },
  { id: 'vercel', name: 'Vercel', category: 'hosting', headers: { server: 'Vercel', 'x-vercel-id': '.' } },
  { id: 'netlify', name: 'Netlify', category: 'hosting', headers: { server: 'Netlify', 'x-nf-request-id': '.' } },
  { id: 'github-pages', name: 'GitHub Pages', category: 'hosting', headers: { server: 'GitHub\\.com' } },
  { id: 'firebase', name: 'Firebase Hosting', category: 'hosting', headers: { 'x-firebase-hosting': '.' }, src: '/__/firebase/' },
  { id: 'render', name: 'Render', category: 'hosting', headers: { 'x-render-origin-server': '.', server: '^Render' } },
  { id: 'heroku', name: 'Heroku', category: 'hosting', headers: { via: 'vegur' } },
  { id: 'azure', name: 'Microsoft Azure', category: 'hosting', headers: { 'x-azure-ref': '.', 'x-ms-request-id': '.' } },
  { id: 'gcp', name: 'Google Cloud', category: 'hosting', headers: { server: '^(Google Frontend|gws)' } },
  { id: 'nginx', name: 'nginx', category: 'hosting', headers: { server: '^nginx' } },
  { id: 'apache', name: 'Apache', category: 'hosting', headers: { server: '^Apache' } },
  { id: 'iis', name: 'Microsoft IIS', category: 'hosting', headers: { server: 'Microsoft-IIS' } },
  { id: 'litespeed', name: 'LiteSpeed', category: 'hosting', headers: { server: 'LiteSpeed' } },
  { id: 'openresty', name: 'OpenResty', category: 'hosting', headers: { server: 'openresty' } },

  // ── Bandeaux de consentement ────────────────────────────────────────────────
  { id: 'onetrust', name: 'OneTrust', category: 'consent', dom: '#onetrust-consent-sdk, #onetrust-banner-sdk', src: 'cdn\\.cookielaw\\.org|onetrust' },
  { id: 'cookiebot', name: 'Cookiebot', category: 'consent', dom: '#CybotCookiebotDialog', src: 'consent\\.cookiebot\\.com' },
  { id: 'didomi', name: 'Didomi', category: 'consent', dom: '#didomi-host, .didomi-popup', src: 'sdk\\.privacy-center\\.org' },
  { id: 'axeptio', name: 'Axeptio', category: 'consent', dom: '#axeptio_overlay, .axeptio_widget', src: 'axept\\.io' },
  { id: 'tarteaucitron', name: 'tarteaucitron', category: 'consent', dom: '#tarteaucitronRoot', globals: ['tarteaucitron'] },
  { id: 'quantcast', name: 'Quantcast Choice', category: 'consent', dom: '.qc-cmp2-container, #qc-cmp2-ui', src: 'quantcast' },
  { id: 'usercentrics', name: 'Usercentrics', category: 'consent', dom: '#usercentrics-root, #uc-banner', src: 'usercentrics' },
  { id: 'cookieyes', name: 'CookieYes', category: 'consent', dom: '.cky-consent-container, #cookie-law-info-bar', src: 'cookieyes|cookie-law-info' },
  { id: 'complianz', name: 'Complianz', category: 'consent', dom: '#cmplz-cookiebanner-container, .cmplz-cookiebanner' },
  { id: 'iubenda', name: 'iubenda', category: 'consent', dom: '#iubenda-cs-banner', src: 'iubenda' },
  { id: 'trustarc', name: 'TrustArc', category: 'consent', dom: '#truste-consent-track, #teconsent', src: 'trustarc|truste' },
  { id: 'termly', name: 'Termly', category: 'consent', dom: '#termly-code-snippet-support, [class*="termly-styles"]', src: 'termly' },
  { id: 'osano', name: 'Osano', category: 'consent', dom: '.osano-cm-window', src: 'osano' },
  { id: 'klaro', name: 'Klaro', category: 'consent', dom: '.klaro, #klaro' },
  { id: 'borlabs', name: 'Borlabs Cookie', category: 'consent', dom: '#BorlabsCookieBox' },
  { id: 'cookie-notice', name: 'Cookie Notice', category: 'consent', dom: '#cookie-notice' },
  { id: 'gdpr-cookie', name: 'GDPR Cookie Consent', category: 'consent', dom: '#moove_gdpr_cookie_info_bar, #gdpr-cookie-consent-bar' },
  { id: 'wix-consent', name: 'Wix consent', category: 'consent', dom: '[data-hook="consent-banner-root"]' },
  { id: 'shopify-consent', name: 'Shopify consent', category: 'consent', dom: '#shopify-pc__banner' },

  // ── Traducteurs et extensions de langues ────────────────────────────────────
  { id: 'wpml', name: 'WPML', category: 'translation', dom: '.wpml-ls', src: 'sitepress-multilingual' },
  { id: 'polylang', name: 'Polylang', category: 'translation', dom: '.lang-item, .pll-parent-menu-item' },
  { id: 'translatepress', name: 'TranslatePress', category: 'translation', dom: '.trp-language-switcher' },
  { id: 'gtranslate', name: 'GTranslate', category: 'translation', globals: ['gtranslateSettings'], src: 'gtranslate' },
  { id: 'weglot', name: 'Weglot', category: 'translation', globals: ['Weglot'], src: 'cdn\\.weglot\\.com' },
  { id: 'google-translate', name: 'Google Translate (widget)', category: 'translation', dom: '#google_translate_element, .goog-te-gadget' },
  { id: 'lokalise', name: 'Localize.js', category: 'translation', globals: ['Localize'] },
  { id: 'conveythis', name: 'ConveyThis', category: 'translation', src: 'conveythis' },
];

/* -------------------------------------------------------------------------- */
/*  La détection                                                               */
/* -------------------------------------------------------------------------- */

/** Les constats mesurés dans la page, au-delà des signatures. */
export interface PageSignals {
  /** Ids du catalogue trouvés dans la page. */
  matched: string[];
  /** Parmi eux, ceux dont la signature est FORTE (balise generator, variable globale, cookie, ou deux types de signature). */
  strong: string[];
  /** Routes en `#/` (ou `#!/`) : l'adresse sans `#` est la même page pour le serveur. */
  hashRouting: boolean;
  /** Éléments à Shadow DOM ouvert qui portent du texte. */
  shadowHosts: number;
  /** Un iframe couvre la page et la page elle-même n'a presque pas de texte. */
  iframeSrc: string;
  /** Un grand canvas, presque pas de texte : la page est dessinée. */
  canvasOnly: boolean;
  /** « Just a moment… », « Checking your browser », captcha : un mur anti-robot est affiché. */
  botWall: boolean;
  /** Texte visible de la page (longueur). */
  textLength: number;
  /** Éléments de navigation cliquables sans adresse (boutons, `role=link`, `routerLink` sans `href`). */
  clickOnlyNav: number;
  /** Routes déclarées par le framework (Next.js `__BUILD_MANIFEST`, Vue/Nuxt router). */
  routes: string[];
}

/**
 * Exécuté dans la page (style ES5, aucune aide de TypeScript). `rules` : le catalogue, sérialisé. Rend les ids trouvés
 * et les constats. Les signatures d'en-têtes et de cookies HTTP sont lues à part (`detectFromHeaders`).
 */
export function detectInPage(rules: TechRule[]): PageSignals {
  var html = '';
  try {
    html = document.documentElement.outerHTML.slice(0, 300000);
  } catch (e) {
    html = '';
  }
  // Chaque balise generator testée SEULE : concaténées, une espace de tête faisait échouer les motifs en `^Hugo`.
  var generators: string[] = [];
  var gens = document.querySelectorAll('meta[name="generator" i], meta[name="Generator"]');
  for (var g = 0; g < gens.length; g++) generators.push(String(gens[g].getAttribute('content') || '').trim());
  var srcs: string[] = [];
  var nodes = document.querySelectorAll('script[src], link[href]');
  for (var s = 0; s < nodes.length; s++) srcs.push(nodes[s].getAttribute('src') || nodes[s].getAttribute('href') || '');
  try {
    var entries = (performance as any).getEntriesByType('resource');
    for (var r = 0; r < entries.length && r < 400; r++) srcs.push(entries[r].name);
  } catch (e) {
    /* rien */
  }
  var srcText = srcs.join('\n');
  var cookies = String(document.cookie || '')
    .split(';')
    .map(function (c: string) {
      return c.split('=')[0].trim();
    });
  var hasGlobal = function (path: string) {
    try {
      var parts = path.split('.');
      var cur: any = window;
      for (var i = 0; i < parts.length; i++) {
        if (cur == null) return false;
        cur = cur[parts[i]];
      }
      return cur !== undefined && cur !== null && cur !== 0 && cur !== false;
    } catch (e) {
      return false;
    }
  };
  var matched: string[] = [];
  var strong: string[] = [];
  for (var k = 0; k < rules.length; k++) {
    var rule = rules[k];
    // Chaque type de signature évalué SEUL : un mot dans le HTML ou une adresse de script ne suffit pas à nommer une
    // technologie (un site WordPress qui parle de « Sphinx » n'est pas un site Sphinx).
    var kinds = { meta: false, globals: false, cookie: false, src: false, dom: false, html: false };
    try {
      if (rule.meta) {
        var metaRe = new RegExp(rule.meta, 'i');
        for (var mi = 0; mi < generators.length && !kinds.meta; mi++) if (metaRe.test(generators[mi])) kinds.meta = true;
      }
      if (rule.src && new RegExp(rule.src, 'i').test(srcText)) kinds.src = true;
      if (rule.globals) for (var gi = 0; gi < rule.globals.length && !kinds.globals; gi++) if (hasGlobal(rule.globals[gi])) kinds.globals = true;
      if (rule.dom && document.querySelector(rule.dom)) kinds.dom = true;
      if (rule.html && new RegExp(rule.html, 'i').test(html)) kinds.html = true;
      if (rule.cookie) {
        var re = new RegExp(rule.cookie, 'i');
        for (var ci = 0; ci < cookies.length && !kinds.cookie; ci++) if (re.test(cookies[ci])) kinds.cookie = true;
      }
    } catch (e) {
      /* motif invalide : la règle est ignorée */
    }
    var count = (kinds.meta ? 1 : 0) + (kinds.globals ? 1 : 0) + (kinds.cookie ? 1 : 0) + (kinds.src ? 1 : 0) + (kinds.dom ? 1 : 0) + (kinds.html ? 1 : 0);
    if (count > 0) matched.push(rule.id);
    if (kinds.meta || kinds.globals || kinds.cookie || count >= 2) strong.push(rule.id);
  }

  var text = String((document.body && document.body.innerText) || '').replace(/\s+/g, ' ').trim();
  var vw = Math.max(window.innerWidth, 1);
  var vh = Math.max(window.innerHeight, 1);

  // Shadow DOM : les hôtes ouverts qui portent du texte.
  var shadowHosts = 0;
  var all = document.querySelectorAll('*');
  for (var a = 0; a < all.length && a < 6000; a++) {
    var sr = all[a].shadowRoot;
    if (sr && String(sr.textContent || '').replace(/\s+/g, '').length > 20) shadowHosts++;
  }

  // Un iframe qui couvre la page.
  var iframeSrc = '';
  var frames = document.querySelectorAll('iframe[src]');
  for (var f = 0; f < frames.length; f++) {
    var box = frames[f].getBoundingClientRect();
    if (box.width >= vw * 0.8 && box.height >= vh * 0.6 && text.length < 400) {
      iframeSrc = new URL(frames[f].getAttribute('src'), document.baseURI).href;
      break;
    }
  }

  // Un grand canvas sans texte.
  var canvasOnly = false;
  var canvases = document.querySelectorAll('canvas');
  for (var c = 0; c < canvases.length; c++) {
    var cb = canvases[c].getBoundingClientRect();
    if (cb.width >= vw * 0.7 && cb.height >= vh * 0.6 && text.length < 300) canvasOnly = true;
  }
  if (matched.indexOf('flutter') >= 0 && text.length < 300) canvasOnly = true;

  // Mur anti-robot.
  var title = String(document.title || '');
  var botWall =
    /just a moment|attention required|checking your browser|vérification|un instant|ddos-guard|access denied|pardon our interruption|are you a robot|verify you are human|client challenge|making sure you.?re not a bot|anubis/i.test(title) ||
    !!document.querySelector('#challenge-form, #cf-challenge-running, .cf-turnstile, #challenge-stage, iframe[src*="challenges.cloudflare.com"], #px-captcha, .g-recaptcha[data-sitekey][data-size="invisible"] ~ form#challenge');

  // Routes en `#/`.
  var hashLinks = document.querySelectorAll('a[href^="#/"], a[href^="#!/"], a[href*="/#/"], a[href*="/#!/"]').length;
  var hashRouting = /^#!?\//.test(String(window.location.hash || '')) || hashLinks >= 2;

  // Navigation par clic seulement : dans l'en-tête ou le menu, des éléments cliquables sans adresse.
  var navRoot = document.querySelector('header') || document.querySelector('nav') || document.querySelector('[role="navigation"]');
  var clickOnlyNav = 0;
  if (navRoot) {
    var cands = navRoot.querySelectorAll('button, [role="link"], [role="menuitem"], [routerlink], [ng-reflect-router-link], li, span, div');
    for (var n = 0; n < cands.length && n < 200; n++) {
      var el = cands[n];
      if (el.closest('a[href]') || el.querySelector('a[href]')) continue;
      var label = String(el.textContent || '').replace(/\s+/g, ' ').trim();
      if (label.length < 2 || label.length > 40) continue;
      var cursor = getComputedStyle(el).cursor;
      if (cursor === 'pointer' || el.tagName === 'BUTTON' || el.getAttribute('role') === 'link' || el.hasAttribute('routerlink')) clickOnlyNav++;
    }
  }

  // Routes déclarées par le framework.
  var routes: string[] = [];
  var addRoute = function (p: any) {
    var path = String(p || '');
    if (!path || path.charAt(0) !== '/' || /[\[\]:*]|^\/(_|api\/)|404|500/.test(path)) return;
    if (routes.indexOf(path) < 0) routes.push(path);
  };
  try {
    var manifest = (window as any).__BUILD_MANIFEST;
    if (manifest && manifest.sortedPages) manifest.sortedPages.forEach(addRoute);
  } catch (e) {
    /* rien */
  }
  try {
    var vueHost = document.querySelector('#__nuxt') || document.querySelector('[data-v-app]') || document.querySelector('#app');
    var vueApp = vueHost && (vueHost as any).__vue_app__;
    var router3 = vueApp && vueApp.config && vueApp.config.globalProperties && vueApp.config.globalProperties.$router;
    if (router3 && router3.getRoutes) router3.getRoutes().forEach(function (route: any) { addRoute(route.path); });
    var vue2 = vueHost && (vueHost as any).__vue__;
    var router2 = (vue2 && vue2.$router) || ((window as any).$nuxt && (window as any).$nuxt.$router);
    if (router2 && router2.options && router2.options.routes) router2.options.routes.forEach(function (route: any) { addRoute(route.path); });
  } catch (e) {
    /* rien */
  }

  return { matched: matched, strong: strong, hashRouting: hashRouting, shadowHosts: shadowHosts, iframeSrc: iframeSrc, canvasOnly: canvasOnly, botWall: botWall, textLength: text.length, clickOnlyNav: clickOnlyNav, routes: routes.slice(0, 80) };
}

/** Les signatures d'en-têtes et de cookies HTTP de la réponse du document. */
export function detectFromHeaders(headers: Record<string, string>, rules: TechRule[] = TECHNOLOGIES): string[] {
  const lower: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) lower[key.toLowerCase()] = String(value);
  const cookieNames = (lower['set-cookie'] ?? '')
    .split(/\n|,(?=\s*[^;,=\s]+=)/)
    .map((c) => c.split('=')[0].trim())
    .filter(Boolean);
  const matched: string[] = [];
  for (const rule of rules) {
    let hit = false;
    if (rule.headers) {
      for (const [name, pattern] of Object.entries(rule.headers)) {
        const value = lower[name.toLowerCase()];
        if (value !== undefined && new RegExp(pattern, 'i').test(value)) hit = true;
      }
    }
    if (!hit && rule.cookie) {
      const re = new RegExp(rule.cookie, 'i');
      if (cookieNames.some((name) => re.test(name))) hit = true;
    }
    if (hit) matched.push(rule.id);
  }
  return matched;
}

/* -------------------------------------------------------------------------- */
/*  Le profil : ce que le relevé fait pour CE site                             */
/* -------------------------------------------------------------------------- */

export interface TechProfile {
  /** Les technologies détectées, les plus parlantes d'abord. */
  technologies: { id: string; name: string; category: TechCategory }[];
  family: RenderFamily;
  /** Les adaptations retenues, lisibles dans les journaux et le relevé. */
  strategy: {
    /** Garder `#/route` dans les adresses (sinon toutes les pages se confondent avec l'accueil). */
    keepHashRoutes: boolean;
    /** Ouvrir une page par la navigation de l'application (pushState) quand son adresse directe répond 404 ou vide. */
    inAppNavigation: boolean;
    /** Cliquer les éléments du menu sans adresse pour découvrir les pages. */
    clickDiscovery: boolean;
    /** Recopier le Shadow DOM dans la page avant de la lire. */
    flattenShadowDom: boolean;
    /** Lire le site contenu dans un iframe. */
    followIframe: string;
    /** Lire la page par capture + modèle de vision (rien à lire dans le DOM). */
    visionFallback: boolean;
    /** Attendre qu'un mur anti-robot passe. */
    waitBotWall: boolean;
    /** Retirer les bandeaux de consentement avant de lire (et avant la capture du scan). */
    removeConsent: boolean;
    /** Pages déclarées par le framework ou le CMS, à relever en plus du menu. */
    declaredRoutes: string[];
    /** Liste des pages par l'API REST de WordPress. */
    wordpressApi: boolean;
    /** Temps d'attente du rendu, selon la famille (une application met plus de temps à s'afficher). */
    settleMs: number;
  };
}

const CATEGORY_WEIGHT: Record<TechCategory, number> = {
  builder: 0,
  cms: 1,
  ecommerce: 2,
  'meta-framework': 3,
  'static-generator': 4,
  docs: 5,
  canvas: 6,
  'js-framework': 7,
  'page-builder': 8,
  'server-framework': 9,
  language: 10,
  translation: 11,
  consent: 12,
  protection: 13,
  hosting: 14,
};

/** La famille qui l'emporte : la technologie la plus « parlante » qui en déclare une, sinon une mesure. */
export function profileOf(signals: PageSignals, headerMatches: string[] = [], initialTextLength: number | null = null): TechProfile {
  const ids = [...new Set([...signals.matched, ...headerMatches])];
  // Les détections qui décident de la FAMILLE : fortes (celles des en-têtes le sont). Sans aucune forte, toutes.
  const strongIds = new Set([...(signals.strong ?? signals.matched), ...headerMatches]);
  const byId = new Map(TECHNOLOGIES.map((rule) => [rule.id, rule]));
  const technologies = ids
    .map((id) => byId.get(id))
    .filter((rule): rule is TechRule => !!rule)
    .sort((a, b) => CATEGORY_WEIGHT[a.category] - CATEGORY_WEIGHT[b.category]);

  // La famille : la technologie la plus parlante parmi celles qui en déclarent une (constructeur, méta-framework,
  // générateur statique d'abord ; un framework de navigateur en dernier, il est partout).
  const FAMILY_ORDER: TechCategory[] = ['builder', 'meta-framework', 'static-generator', 'docs', 'canvas', 'cms', 'ecommerce', 'server-framework', 'page-builder', 'js-framework', 'language'];
  const deciding = technologies.some((rule) => rule.family && strongIds.has(rule.id)) ? technologies.filter((rule) => strongIds.has(rule.id)) : technologies;
  const declared = deciding
    .filter((rule) => rule.family)
    .sort((a, b) => FAMILY_ORDER.indexOf(a.category) - FAMILY_ORDER.indexOf(b.category))[0]?.family;
  let family: RenderFamily = signals.canvasOnly ? 'canvas' : declared ?? (signals.textLength < 200 ? 'spa' : 'server');
  // MESURÉ : une page dont le HTML initial est presque vide et qui se remplit dans le navigateur est une application
  // (SPA), quelle que soit l'étiquette ; une page dont le HTML initial est déjà plein n'en est pas une.
  if (initialTextLength !== null && family !== 'canvas' && family !== 'builder') {
    const filledInBrowser = initialTextLength < 300 && signals.textLength > 600;
    if (filledInBrowser) family = 'spa';
    else if (family === 'spa' && initialTextLength >= 300) family = technologies.some((rule) => rule.category === 'meta-framework') ? 'hybrid' : 'server';
  }

  const has = (id: string) => ids.includes(id);
  const app = family === 'spa' || family === 'hybrid' || family === 'builder';
  return {
    technologies: technologies.map(({ id, name, category }) => ({ id, name, category })),
    family,
    strategy: {
      keepHashRoutes: signals.hashRouting,
      inAppNavigation: app,
      clickDiscovery: app && signals.clickOnlyNav >= 2,
      flattenShadowDom: signals.shadowHosts > 0,
      followIframe: signals.iframeSrc,
      visionFallback: family === 'canvas',
      waitBotWall: signals.botWall,
      removeConsent: technologies.some((rule) => rule.category === 'consent'),
      declaredRoutes: signals.routes,
      wordpressApi: has('wordpress') || has('woocommerce'),
      // Le calme attendu (aucune modification du DOM pendant ce temps) : une application finit de s'afficher plus tard.
      settleMs: family === 'spa' || family === 'canvas' ? 800 : family === 'builder' || family === 'hybrid' ? 600 : 400,
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  Les images en pleine taille, selon la plateforme                           */
/* -------------------------------------------------------------------------- */

/**
 * L'adresse de l'image d'origine derrière une vignette de plateforme : un site refait en vignettes de 300 px
 * paraît flou. Rend l'adresse inchangée quand rien n'est reconnu.
 */
export function originalImageUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }
  const host = url.hostname;
  // Next.js : /_next/image?url=<origine>&w=640
  if (url.pathname.endsWith('/_next/image') && url.searchParams.get('url')) {
    try {
      return new URL(url.searchParams.get('url')!, url.origin).href;
    } catch {
      return raw;
    }
  }
  // Nuxt Image / IPX : /_ipx/w_640/<chemin>
  const ipx = url.pathname.match(/^\/_ipx\/[^/]+(\/.+)$/);
  if (ipx) return new URL(ipx[1], url.origin).href;
  // Gatsby, Astro : images déjà dimensionnées à la construction, rien à défaire.
  // Wix : static.wixstatic.com/media/<fichier>/v1/fill/w_300,h_200,…/<nom>
  if (host.endsWith('wixstatic.com')) {
    const m = url.pathname.match(/^(\/media\/[^/]+)\/v1\//);
    if (m) return `${url.origin}${m[1]}`;
  }
  // Squarespace : ?format=300w
  if (/squarespace(-cdn)?\.com$/.test(host) || host.endsWith('sqspcdn.com')) {
    url.searchParams.set('format', '2500w');
    return url.href;
  }
  // Shopify : fichier_300x200.jpg ou ?width=300
  if (host === 'cdn.shopify.com' || host.endsWith('.myshopify.com')) {
    url.pathname = url.pathname.replace(/_(\d+x\d*|\d*x\d+|pico|icon|thumb|small|compact|medium|large|grande)(@\dx)?(?=\.[a-z]+$)/i, '');
    url.searchParams.delete('width');
    url.searchParams.delete('height');
    url.searchParams.delete('crop');
    return url.href;
  }
  // WordPress : fichier-300x200.jpg (miniature générée) → fichier.jpg
  if (/\/wp-content\/uploads\//.test(url.pathname)) {
    url.pathname = url.pathname.replace(/-\d{2,4}x\d{2,4}(?=\.[a-z]+$)/i, '').replace(/-scaled(?=\.[a-z]+$)/i, '');
    return url.href;
  }
  // Webflow : fichier-p-500.jpg → fichier.jpg
  if (/website-files\.com$/.test(host)) {
    url.pathname = url.pathname.replace(/-p-\d{3,4}(?=\.[a-z]+$)/i, '');
    return url.href;
  }
  // Framer : ?scale-down-to=512
  if (host.endsWith('framerusercontent.com')) {
    url.searchParams.delete('scale-down-to');
    return url.href;
  }
  // Duda : …/dms3rep/multi/opt/<fichier>-640w.jpg
  if (host.endsWith('cdn-website.com')) {
    url.pathname = url.pathname.replace(/\/opt\//, '/').replace(/-\d{3,4}w(?=\.[a-z]+$)/i, '');
    return url.href;
  }
  // Ghost : /content/images/size/w600/… → /content/images/…
  url.pathname = url.pathname.replace(/\/content\/images\/size\/w\d+(h\d+)?\//, '/content/images/');
  // Contentful, Sanity, Prismic, Storyblok, imgix, Cloudinary : paramètres de taille retirés.
  if (/ctfassets\.net$|cdn\.sanity\.io$|images\.prismic\.io$|imgix\.net$|storyblok\.com$/.test(host)) {
    for (const key of ['w', 'h', 'width', 'height', 'fit', 'rect', 'crop']) url.searchParams.delete(key);
    return url.href;
  }
  if (host.endsWith('res.cloudinary.com')) {
    url.pathname = url.pathname.replace(/\/image\/upload\/(?:[a-z]{1,3}_[^/]+\/)+/, '/image/upload/');
    return url.href;
  }
  return url.href;
}

/* -------------------------------------------------------------------------- */
/*  Préparations dans la page                                                  */
/* -------------------------------------------------------------------------- */

/** Les conteneurs des bandeaux de consentement connus (et les génériques). */
export const CONSENT_SELECTORS = [
  '#onetrust-consent-sdk', '#onetrust-banner-sdk', '#CybotCookiebotDialog', '#didomi-host', '.didomi-popup', '#axeptio_overlay', '.axeptio_widget',
  '#tarteaucitronRoot', '.qc-cmp2-container', '#qc-cmp2-ui', '#usercentrics-root', '#uc-banner', '.cky-consent-container', '#cookie-law-info-bar',
  '#cmplz-cookiebanner-container', '.cmplz-cookiebanner', '#iubenda-cs-banner', '#truste-consent-track', '#teconsent', '#termly-code-snippet-support',
  '.osano-cm-window', '.klaro', '#klaro', '#BorlabsCookieBox', '#cookie-notice', '#moove_gdpr_cookie_info_bar', '#gdpr-cookie-consent-bar',
  '[data-hook="consent-banner-root"]', '#shopify-pc__banner', '[id*="cookie-banner" i]', '[class*="cookie-banner" i]', '[id*="cookie-consent" i]',
  '[class*="cookie-consent" i]', '[aria-label*="cookie" i][role="dialog"]', '[id*="gdpr" i][class*="banner" i]',
];

/** Retire les bandeaux de consentement (et rend le défilement, que certains bloquent). Exécuté dans la page. */
export const REMOVE_CONSENT_SCRIPT = `(() => {
  const selectors = ${JSON.stringify(CONSENT_SELECTORS)};
  let removed = 0;
  for (const selector of selectors) {
    let nodes = [];
    try { nodes = document.querySelectorAll(selector); } catch (e) { continue; }
    nodes.forEach((node) => {
      const text = (node.textContent || '').toLowerCase();
      // Jamais un grand bloc de contenu qui parlerait de cookies (une recette !) : seulement un bandeau court.
      if (text.length < 4000) { node.remove(); removed++; }
    });
  }
  for (const el of [document.documentElement, document.body]) {
    if (!el) continue;
    el.style.removeProperty('overflow');
    el.classList.remove('didomi-popup-open', 'ot-overflow-hidden', 'cmplz-blocked', 'noscroll', 'no-scroll', 'modal-open');
  }
  return removed;
})()`;

/**
 * Recopie le contenu des Shadow DOM ouverts dans la page (composants web, Lit, Stencil, Ionic) : le relevé les lit
 * comme le reste. Le contenu recopié garde ses balises et ses textes ; l'hôte ne garde que la copie. Exécuté dans la page.
 */
export const FLATTEN_SHADOW_SCRIPT = `(() => {
  let flattened = 0;
  const visit = (root, depth) => {
    if (depth > 6) return;
    root.querySelectorAll('*').forEach((el) => {
      if (!el.shadowRoot) return;
      visit(el.shadowRoot, depth + 1);
      const html = el.shadowRoot.innerHTML;
      if (!html || html.replace(/<style[\\s\\S]*?<\\/style>/g, '').replace(/<[^>]+>/g, '').trim().length < 2) return;
      const holder = document.createElement('div');
      holder.setAttribute('data-idem-shadow', el.tagName.toLowerCase());
      holder.innerHTML = html.replace(/<slot[^>]*>[\\s\\S]*?<\\/slot>|<slot[^>]*\\/?>/g, el.innerHTML);
      el.replaceWith(holder);
      flattened++;
    });
  };
  visit(document, 0);
  return flattened;
})()`;
