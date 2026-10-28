/**
 * LE RELEVÉ COMPLET D'UN SITE — pour le refaire sans rien perdre.
 *
 * Le scan (`site-scanner.ts`) lit la marque : couleurs, polices, logo, ton. Le relevé, lui, lit le CONTENU, page
 * par page et section par section, comme on ferait l'inventaire d'une maison avant de la rénover :
 *
 *   pages        l'accueil, les pages du menu, du pied de page, du plan du site (sitemap.xml), puis les liens
 *                trouvés en chemin — dans cet ordre, jusqu'à la limite ;
 *   sections     chaque bloc de la page : ses titres, ses paragraphes, ses listes, ses boutons (texte et
 *                destination), ses formulaires (champs), ses vidéos, et ses IMAGES (balises et images de fond) ;
 *   navigation   le menu et le pied de page ;
 *   contact      téléphones, e-mails, WhatsApp, adresses, réseaux sociaux ;
 *   fichiers     toutes les images vues (avec leur texte alternatif et l'endroit où elles sont), le favicon,
 *                l'icône Apple, l'image de partage.
 *
 * Rien n'est réécrit ni interprété ici : c'est un relevé. Le moteur de sites s'engage ensuite à placer chaque
 * section quelque part dans le nouveau site.
 */
import puppeteer, { Browser, Page } from 'puppeteer';
import logger from '../runtime/logger';
import { installRenderNetworkGuard, isRenderUrlAllowed, RENDER_BROWSER_ARGS } from '../render/network-guard';
import { safeFetch } from '../render/safe-fetch';
import { evaluateSettled } from './settled';

export interface InventoryImage {
  url: string;
  alt: string;
  width: number;
  height: number;
  /** `img` : une image du contenu ; `background` : une image de fond (héros, bandeaux). */
  kind: 'img' | 'background';
}

export interface InventoryCta {
  label: string;
  href: string;
  kind: 'internal' | 'external' | 'phone' | 'email' | 'whatsapp' | 'anchor';
}

export interface InventorySection {
  /** `p2.s3` : la 3e section de la 3e page (l'accueil est `p0`). */
  id: string;
  headings: string[];
  texts: string[];
  items: string[];
  ctas: InventoryCta[];
  images: InventoryImage[];
  /** Les champs d'un formulaire (libellés ou textes d'aide). */
  form?: string[];
  videos?: string[];
}

export interface InventoryPage {
  url: string;
  /** Le chemin (`/`, `/a-propos/`) : la nouvelle page garde la même adresse quand c'est possible. */
  path: string;
  title: string;
  description?: string;
  sections: InventorySection[];
}

/** Une langue dans laquelle le site existe, et l'adresse de son accueil quand le sélecteur la donne. */
export interface SiteLanguage {
  code: string;
  url?: string;
  /**
   * Comment elle a été détectée : `hreflang`, sélecteur de langue (WPML, Polylang, TranslatePress…), chemin `/en/`,
   * ou `widget` — un traducteur automatique (GTranslate, Weglot) qui propose dix langues sans qu'aucune page n'ait
   * été traduite : ces langues-là sont proposées, jamais imposées.
   */
  via: 'html' | 'hreflang' | 'switcher' | 'path' | 'widget';
}

export interface SiteInventory {
  origin: string;
  language: string;
  /** Toutes les langues du site, la principale en tête. Une seule : le site n'est pas traduit. */
  languages: SiteLanguage[];
  pages: InventoryPage[];
  /** Les pages vues dans les liens mais pas relevées (au-delà de la limite) : leurs titres, pour mémoire. */
  skipped: { url: string; label: string }[];
  navigation: { label: string; href: string }[];
  footer: { texts: string[]; links: { label: string; href: string }[] };
  contact: { phones: string[]; emails: string[]; whatsapp: string[]; addresses: string[]; socials: { network: string; url: string }[] };
  assets: { favicon?: string; appleIcon?: string; ogImage?: string; images: (InventoryImage & { page: string; section: string })[] };
}

export interface CrawlOptions {
  url: string;
  maxPages?: number;
  timeoutMs?: number;
  onProgress?: (done: number, total: number, url: string) => void;
}

/** Ce que la page dit d'elle-même, relevé dans le navigateur. */
interface PageRead {
  /** Un article de blog (daté) plutôt qu'une page du site. */
  post: boolean;
  /** Une liste générée (auteur, catégorie, étiquette, recherche) : pas une page du site. */
  archive: boolean;
  title: string;
  description: string;
  language: string;
  /** Les versions de la page dans d'autres langues (hreflang, sélecteur de langue). */
  alternates: { lang: string; href: string; via: 'hreflang' | 'switcher' | 'widget' }[];
  blocks: Omit<InventorySection, 'id'>[];
  navigation: { label: string; href: string }[];
  footerTexts: string[];
  footerLinks: { label: string; href: string }[];
  links: { label: string; href: string }[];
  favicon: string;
  appleIcon: string;
  ogImage: string;
  addresses: string[];
}

/* eslint-disable no-var */
declare var document: any;
declare var window: any;
declare var getComputedStyle: any;
/* eslint-enable no-var */

/**
 * Exécuté dans la page : aucune dépendance, aucun réseau, et aucune syntaxe que TypeScript traduirait par une
 * aide (`async`, étalement d'objet) — la page ne la connaît pas.
 */
function readStructure(): PageRead {
  // Une page encore vide (redirection en cours, écran d'attente) : le relevé est repris un peu plus tard.
  if (!document.body || !document.body.children.length) throw new Error('navigation pending');
  var abs = function (u: any) {
    try {
      return u ? new URL(String(u), document.baseURI).href : '';
    } catch (e) {
      return '';
    }
  };
  var clean = function (t: any) {
    return String(t || '').replace(/\s+/g, ' ').trim();
  };
  var shown = function (el: any) {
    var r = el.getBoundingClientRect();
    var s = getComputedStyle(el);
    return r.width > 2 && r.height > 2 && s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0.05;
  };
  var bg = function (el: any) {
    var m = String(getComputedStyle(el).backgroundImage || '').match(/url\(["']?([^"')]+)["']?\)/);
    return m && m[1].indexOf('data:') !== 0 ? abs(m[1]) : '';
  };
  var uniq = function (list: string[], max: number) {
    var out: string[] = [];
    for (var i = 0; i < list.length && out.length < max; i++) if (list[i] && out.indexOf(list[i]) < 0) out.push(list[i]);
    return out;
  };
  var ctaKind = function (href: string) {
    if (/^tel:/i.test(href)) return 'phone';
    if (/^mailto:/i.test(href)) return 'email';
    if (/wa\.me|whatsapp\.com/i.test(href)) return 'whatsapp';
    if (/^#|#[\w-]+$/.test(href) && href.indexOf(window.location.origin + window.location.pathname) === 0) return 'anchor';
    try {
      return new URL(href, document.baseURI).origin === window.location.origin ? 'internal' : 'external';
    } catch (e) {
      return 'external';
    }
  };
  var header = document.querySelector('header') || document.querySelector('[class*="header"]') || document.querySelector('nav');
  var footer = document.querySelector('footer') || document.querySelector('[class*="footer"]');

  // Les blocs de contenu : les enfants de <main> (ou du corps), en descendant les enveloppes à un seul enfant.
  var root = document.querySelector('main') || document.querySelector('[role="main"]') || document.body;
  var blocks: any[] = Array.prototype.slice.call(root.children);
  var guard = 0;
  while (blocks.length === 1 && blocks[0].children.length > 0 && guard++ < 8) blocks = Array.prototype.slice.call(blocks[0].children);
  blocks = blocks.filter(function (el: any) {
    var tag = el.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'noscript' || tag === 'template') return false;
    if (header && (el === header || el.contains(header) && clean(el.textContent).length < clean(header.textContent).length + 40)) return false;
    if (footer && (el === footer || el.contains(footer) && clean(el.textContent).length < clean(footer.textContent).length + 40)) return false;
    return shown(el);
  });
  // Les constructeurs de pages (Elementor, Divi…) enveloppent toute la page dans un ou deux blocs : un bloc qui
  // porte plusieurs grands titres (h1, h2) dans des enfants différents, ou haut de plusieurs écrans, est découpé
  // en ses enfants — sans jamais casser une rangée (image | texte) ni une grille de cartes.
  var vh = Math.max(window.innerHeight, 1);
  var split = function (el: any, depth: number): any[] {
    if (depth > 8) return [el];
    var kids = Array.prototype.slice.call(el.children).filter(function (k: any) {
      return shown(k) && k.getBoundingClientRect().height >= 40;
    });
    if (kids.length === 1) return el.getBoundingClientRect().height > vh * 1.2 || el.querySelectorAll('h1, h2').length > 1 ? split(kids[0], depth + 1) : [el];
    if (kids.length < 2) return [el];
    var titled = kids.filter(function (k: any) {
      return k.querySelector('h1, h2') || /^h[12]$/i.test(k.tagName);
    }).length;
    var tall = kids.filter(function (k: any) {
      return k.getBoundingClientRect().height >= vh * 0.35;
    }).length;
    if (titled >= 2 || (el.getBoundingClientRect().height > vh * 2 && tall >= 2)) {
      var out: any[] = [];
      kids.forEach(function (k: any) {
        out = out.concat(split(k, depth + 1));
      });
      return out;
    }
    return [el];
  };
  var expanded: any[] = [];
  blocks.forEach(function (b: any) {
    expanded = expanded.concat(split(b, 0));
  });
  // Ce qui n'est pas du contenu du site : commentaires, articles liés, partage.
  var noise = /comment|respond|related|share|sharing|post-navigation|nav-links/i;
  blocks = expanded.filter(function (el: any) {
    var marker = String(el.id || '') + ' ' + String(typeof el.className === 'string' ? el.className : '');
    var first = clean((el.querySelector('h1, h2, h3') || {}).textContent);
    return !noise.test(marker) && !/^(laisser un commentaire|leave a reply|related posts|articles similaires|vous aimerez aussi)/i.test(first);
  });

  var readBlock = function (el: any) {
    var headings = uniq(
      Array.prototype.slice.call(el.querySelectorAll('h1, h2, h3, h4')).filter(shown).map(function (h: any) {
        return clean(h.textContent);
      }),
      30
    );
    // Le texte courant : les paragraphes, et les blocs « feuilles » des constructeurs de pages (du texte dans une
    // <div> ou un <span> sans paragraphe) — jamais deux fois le même, jamais un titre, un bouton ou un élément de liste.
    var textual = 'p, blockquote, figcaption, dd, address, td';
    var texts = uniq(
      Array.prototype.slice.call(el.querySelectorAll(textual + ', div, span')).filter(function (n: any) {
        if (!shown(n) || n.closest('h1, h2, h3, h4, h5, h6, a, button, li, label, option, nav, script, style')) return false;
        var tag = n.tagName.toLowerCase();
        if (tag === 'div' || tag === 'span') {
          if (n.querySelector('p, div, section, ul, ol, h1, h2, h3, h4, h5, h6, table, blockquote, img')) return false;
          if (n.parentElement && n.parentElement.closest(textual)) return false;
          if (tag === 'span' && n.parentElement && n.parentElement.tagName.toLowerCase() === 'span') return false;
        } else if (n.parentElement && n.parentElement.closest(textual)) return false;
        return true;
      }).map(function (n: any) {
        return clean(n.textContent).slice(0, 900);
      }).filter(function (t: string) {
        return t.length >= 3 && headings.indexOf(t) < 0;
      }),
      60
    );
    var items = uniq(
      Array.prototype.slice.call(el.querySelectorAll('li')).filter(function (li: any) {
        return shown(li) && !li.closest('nav') && li.querySelectorAll('li').length === 0;
      }).map(function (li: any) {
        return clean(li.textContent).slice(0, 300);
      }).filter(function (t: string) {
        return t.length >= 2;
      }),
      60
    );
    var ctas: any[] = [];
    Array.prototype.slice.call(el.querySelectorAll('a[href], button')).filter(shown).forEach(function (a: any) {
      var label = clean(a.textContent || a.getAttribute('aria-label') || a.getAttribute('title'));
      var href = a.tagName.toLowerCase() === 'a' ? abs(a.getAttribute('href')) : '';
      if (!label || label.length > 80 || ctas.length >= 30) return;
      if (ctas.some(function (c: any) { return c.label === label && c.href === href; })) return;
      ctas.push({ label: label, href: href, kind: href ? ctaKind(href) : 'anchor' });
    });
    var images: any[] = [];
    var own = bg(el);
    if (own) images.push({ url: own, alt: '', width: Math.round(el.getBoundingClientRect().width), height: Math.round(el.getBoundingClientRect().height), kind: 'background' });
    Array.prototype.slice.call(el.querySelectorAll('img, picture source, *')).slice(0, 1500).forEach(function (node: any) {
      if (images.length >= 40) return;
      var tag = node.tagName.toLowerCase();
      if (tag === 'img') {
        // La vraie source d'une image chargée en différé (`src` n'y porte qu'une image d'attente data:…).
        var set = node.getAttribute('data-srcset') || node.getAttribute('data-lazy-srcset') || node.getAttribute('srcset') || '';
        var fromSet = set ? set.split(',').map(function (part: string) { return part.trim().split(/\s+/)[0]; }).filter(Boolean).pop() : '';
        var lazy = node.getAttribute('data-src') || node.getAttribute('data-lazy-src') || node.getAttribute('data-original') || node.getAttribute('data-lazy') || '';
        var raw = node.currentSrc || node.getAttribute('src') || '';
        var placeholder = !raw || raw.indexOf('data:') === 0;
        var src = abs(placeholder ? lazy || fromSet : raw);
        var box = node.getBoundingClientRect();
        var w = (!placeholder && node.naturalWidth) || Number(node.getAttribute('width')) || Math.round(box.width) || 0;
        var h = (!placeholder && node.naturalHeight) || Number(node.getAttribute('height')) || Math.round(box.height) || 0;
        if (!src || src.indexOf('data:') === 0 || (w && w < 48 && h < 48)) return;
        if (images.some(function (i: any) { return i.url === src; })) return;
        images.push({ url: src, alt: clean(node.getAttribute('alt')), width: w, height: h, kind: 'img' });
        return;
      }
      if (tag === 'source' || tag === 'picture') return;
      var b = bg(node);
      if (!b || images.some(function (i: any) { return i.url === b; })) return;
      var r = node.getBoundingClientRect();
      if (r.width < 120 || r.height < 80) return;
      images.push({ url: b, alt: '', width: Math.round(r.width), height: Math.round(r.height), kind: 'background' });
    });
    var form = uniq(
      Array.prototype.slice.call(el.querySelectorAll('input, textarea, select')).filter(function (f: any) {
        return f.type !== 'hidden' && f.type !== 'submit';
      }).map(function (f: any) {
        var label = f.id ? document.querySelector('label[for="' + f.id + '"]') : null;
        return clean((label && label.textContent) || f.getAttribute('placeholder') || f.getAttribute('aria-label') || f.getAttribute('name'));
      }),
      20
    );
    var videos = uniq(
      Array.prototype.slice.call(el.querySelectorAll('iframe[src], video')).map(function (v: any) {
        return abs(v.getAttribute('src') || (v.querySelector('source') && v.querySelector('source').getAttribute('src')));
      }).filter(function (s: string) {
        return /youtube|vimeo|\.mp4|\.webm/i.test(s);
      }),
      6
    );
    var block: any = { headings: headings, texts: texts, items: items, ctas: ctas, images: images };
    if (form.length) block.form = form;
    if (videos.length) block.videos = videos;
    return block;
  };

  var read = blocks.map(readBlock).filter(function (b: any) {
    return b.headings.length || b.texts.length || b.items.length || b.images.length || (b.form && b.form.length) || (b.videos && b.videos.length);
  });

  var linksOf = function (el: any) {
    return el
      ? Array.prototype.slice.call(el.querySelectorAll('a[href]')).map(function (a: any) {
          return { label: clean(a.textContent || a.getAttribute('aria-label')).slice(0, 60), href: abs(a.getAttribute('href')) };
        }).filter(function (l: any) {
          return l.href;
        })
      : [];
  };
  var icon = Array.prototype.slice.call(document.querySelectorAll('link[rel~="icon"]')).sort(function (a: any, b: any) {
    return parseInt(b.getAttribute('sizes') || '0', 10) - parseInt(a.getAttribute('sizes') || '0', 10);
  })[0];
  var apple = document.querySelector('link[rel="apple-touch-icon"]');
  var og = document.querySelector('meta[property="og:image"]');
  var description = document.querySelector('meta[name="description"]') || document.querySelector('meta[property="og:description"]');
  var bodyClass = String(document.body.className || '');
  // Les autres langues de la page : les balises hreflang, puis les sélecteurs de langue connus (WPML, Polylang,
  // TranslatePress, GTranslate, Weglot) ou un lien dont le texte est un nom ou un code de langue.
  var LANG_NAMES: any = { francais: 'fr', 'français': 'fr', french: 'fr', english: 'en', anglais: 'en', espanol: 'es', 'español': 'es', spanish: 'es', 'português': 'pt', portugues: 'pt', portuguese: 'pt', deutsch: 'de', german: 'de', italiano: 'it', italian: 'it', 'العربية': 'ar', arabic: 'ar', arabe: 'ar', kiswahili: 'sw', swahili: 'sw', 'nederlands': 'nl', '中文': 'zh', chinese: 'zh', wolof: 'wo', lingala: 'ln' };
  var langCode = function (raw: any) {
    var t = clean(raw).toLowerCase();
    if (!t) return '';
    if (LANG_NAMES[t]) return LANG_NAMES[t];
    var m = t.match(/^([a-z]{2})(?:[-_][a-z]{2})?$/);
    return m ? m[1] : '';
  };
  var alternates: any[] = [];
  var addAlt = function (lang: string, href: string, via: string) {
    if (!lang || (!href && via !== 'widget')) return;
    for (var i = 0; i < alternates.length; i++) if (alternates[i].lang === lang) return;
    alternates.push({ lang: lang, href: href, via: via });
  };
  Array.prototype.slice.call(document.querySelectorAll('link[rel="alternate"][hreflang]')).forEach(function (l: any) {
    var h = String(l.getAttribute('hreflang') || '').toLowerCase();
    if (h !== 'x-default') addAlt(h.slice(0, 2), abs(l.getAttribute('href')), 'hreflang');
  });
  Array.prototype.slice
    .call(document.querySelectorAll('a[hreflang], .wpml-ls a, .wpml-ls-item a, .lang-item a, .pll-parent-menu-item a, .trp-language-switcher a, .trp-ls-shortcode-language a, a.glink, a[data-gt-lang], .weglot-lang a, [class*="lang-switch"] a, [class*="language-switch"] a, [class*="language-selector"] a, [class*="lang-select"] a'))
    .forEach(function (a: any) {
      var code = langCode(a.getAttribute('hreflang')) || langCode(a.getAttribute('data-gt-lang')) || langCode(a.getAttribute('lang')) || langCode(a.textContent) || langCode(a.getAttribute('title'));
      var href = abs(a.getAttribute('href'));
      var widget = /\bglink\b/.test(String(a.className || '')) || a.hasAttribute('data-gt-lang') || !!(a.closest && a.closest('.weglot-lang, .gtranslate_wrapper, #gtranslate_wrapper')) || /#(googtrans|$)/.test(href) || href === abs('#');
      if (!code && href) {
        var p = href.match(/^https?:\/\/[^/]+\/([a-z]{2})(?:[-_][a-z]{2})?\/?/i) || href.match(/[?&]lang=([a-z]{2})/i);
        code = p ? p[1].toLowerCase() : '';
      }
      addAlt(code, widget ? '' : href, widget ? 'widget' : 'switcher');
    });
  // Un traducteur automatique déclare ses langues dans un script de la page (GTranslate : `gtranslateSettings`,
  // parfois différé par un optimiseur, d'où la lecture du texte des scripts plutôt que de la variable).
  Array.prototype.slice.call(document.querySelectorAll('script')).some(function (el: any) {
    var text = String(el.textContent || '');
    if (text.indexOf('gtranslateSettings') < 0) return false;
    var m = text.match(/"languages"\s*:\s*\[([^\]]*)\]/);
    if (!m) return false;
    m[1].split(',').forEach(function (raw: string) {
      addAlt(langCode(raw.replace(/["'\s]/g, '')), '', 'widget');
    });
    return true;
  });
  return {
    // Un article : les classes d'un billet (WordPress `single-post`, `postid-…`), ou un <article> daté seul dans la page.
    post:
      bodyClass.split(/\s+/).some(function (c: string) {
        return c === 'single-post' || /^postid-\d+$/.test(c);
      }) ||
      (document.querySelectorAll('article').length === 1 && !!document.querySelector('article time[datetime]')),
    // Des classes entières (WordPress met `category-…` sur chaque article : ce n'en fait pas une archive).
    archive: bodyClass.split(/\s+/).some(function (c: string) {
      return c === 'archive' || c === 'search' || c === 'search-results' || c === 'author' || c === 'date';
    }),
    title: clean(document.title),
    description: description ? clean(description.getAttribute('content')) : '',
    language: String(document.documentElement.getAttribute('lang') || '').slice(0, 2).toLowerCase(),
    alternates: alternates.slice(0, 12),
    blocks: read,
    navigation: header ? linksOf(header).filter(function (l: any) { return l.label; }).slice(0, 40) : [],
    footerTexts: footer ? uniq(Array.prototype.slice.call(footer.querySelectorAll('p, address, li, span')).map(function (n: any) { return clean(n.textContent).slice(0, 300); }).filter(function (t: string) { return t.length > 3; }), 30) : [],
    footerLinks: linksOf(footer).slice(0, 60),
    links: linksOf(document.body).slice(0, 400),
    favicon: icon ? abs(icon.getAttribute('href')) : abs('/favicon.ico'),
    appleIcon: apple ? abs(apple.getAttribute('href')) : '',
    ogImage: og ? abs(og.getAttribute('content')) : '',
    addresses: uniq(Array.prototype.slice.call(document.querySelectorAll('address, [itemprop="address"]')).map(function (a: any) { return clean(a.textContent).slice(0, 200); }), 6),
  };
}

/** Un relevé qui survit à un rechargement de la page par elle-même (`evaluateSettled`). */
const readSafely = (page: Page): Promise<PageRead> => evaluateSettled(page, readStructure);

/** Ouvre une page et la fait défiler jusqu'en bas : les images chargées au défilement apparaissent. */
export const MACHINE_TRANSLATION = /\/\/(?:translate\.google(?:apis)?\.com|translate-pa\.googleapis\.com|cdn\.gtranslate\.net|(?:www\.)?gtranslate\.(?:net|io)\/|cdn\.weglot\.com)/i;

async function openForCrawl(browser: Browser, url: string, timeoutMs: number, language = 'fr'): Promise<Page> {
  const page = await browser.newPage();
  // Les sites qui traduisent selon le navigateur : toujours la langue du site (celle de l'accueil).
  await page.setExtraHTTPHeaders({ 'Accept-Language': language === 'en' ? 'en-US,en;q=0.9' : `${language}-${language.toUpperCase()},${language};q=0.9` });
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36 IDEM/1.0');
  // Les traducteurs automatiques sont coupés : ils traduisent la page selon la langue du navigateur, et le relevé
  // lirait une traduction machine au lieu du texte du site.
  await installRenderNetworkGuard(page, (req) => !['media', 'websocket', 'eventsource'].includes(req.resourceType()) && !MACHINE_TRANSLATION.test(req.url()));
  await page.goto(url, { waitUntil: 'networkidle2', timeout: timeoutMs }).catch((error: Error) => {
    if (!/timeout/i.test(error.message)) throw error;
  });
  // Code passé en texte : une fonction transpilée emporterait des aides absentes de la page.
  await page
    .evaluate(
      `new Promise((done) => { let y = 0; const step = () => { if (y++ >= 24 || window.scrollY + window.innerHeight >= document.body.scrollHeight - 4) { window.scrollTo(0, 0); return done(true); } window.scrollBy(0, window.innerHeight); setTimeout(step, 200); }; step(); })`
    )
    .catch(() => undefined);
  await new Promise((r) => setTimeout(r, 400));
  return page;
}

const SKIP_PATH = /\/(author|writer|category|categorie|tag|etiquette|search|recherche)\/|\.(pdf|jpe?g|png|gif|webp|svg|zip|docx?|xlsx?|pptx?|mp4|mp3)$|\/(wp-admin|wp-login|login|signin|connexion|register|inscription|cart|panier|checkout|commande|account|compte|mon-compte|feed|wp-json|xmlrpc)(\/|$)|\/(tag|author|page)\/\d*|[?&](replytocom|share|print)=/i;

/** Une adresse de la même origine, sans ancre ni paramètres de suivi, que l'on peut relever. */
function pageUrl(raw: string, origin: string): string | null {
  try {
    const u = new URL(raw);
    if (u.origin.replace('://www.', '://') !== origin.replace('://www.', '://')) return null;
    if (SKIP_PATH.test(u.pathname + u.search)) return null;
    u.hash = '';
    for (const key of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid|ref$)/i.test(key)) u.searchParams.delete(key);
    if (u.pathname !== '/' && !u.pathname.endsWith('/') && !/\.[a-z0-9]{2,5}$/i.test(u.pathname)) u.pathname += '/';
    return u.toString();
  } catch {
    return null;
  }
}

/** Le plan du site, s'il existe (et ses sous-plans, une fois). */
async function sitemapUrls(origin: string): Promise<string[]> {
  const read = async (url: string) => {
    try {
      const file = await safeFetch(url, { maxBytes: 3 * 1024 * 1024, timeoutMs: 10_000 });
      return file.buffer.toString('utf8');
    } catch {
      return '';
    }
  };
  const locs = (xml: string) => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1].replace(/&amp;/g, '&'));
  const root = await read(`${origin}/sitemap.xml`);
  if (!root) return [];
  if (/<sitemapindex/i.test(root)) {
    const children = locs(root).filter((u) => !/(tag|author|category|attachment)/i.test(u)).slice(0, 4);
    const nested = await Promise.all(children.map(read));
    return nested.flatMap(locs);
  }
  return locs(root);
}

const SOCIAL = /(facebook|instagram|linkedin|tiktok|twitter|x\.com|youtube|pinterest)\./i;

/** Le relevé complet. */
export async function crawlWebsite(options: CrawlOptions): Promise<SiteInventory> {
  const start = new URL(options.url);
  start.hash = '';
  if (!(await isRenderUrlAllowed(start.toString()))) throw new Error('blocked_url');
  const maxPages = Math.max(1, Math.min(40, options.maxPages ?? Number(process.env.SITE_CRAWL_MAX_PAGES ?? 20)));
  const timeout = options.timeoutMs ?? 25_000;
  const browser = await puppeteer.launch({ headless: true, args: [...RENDER_BROWSER_ARGS, '--disable-features=HttpsUpgrades,HttpsFirstBalancedModeAutoEnable'] });

  const inventory: SiteInventory = {
    origin: start.origin,
    language: '',
    languages: [],
    pages: [],
    skipped: [],
    navigation: [],
    footer: { texts: [], links: [] },
    contact: { phones: [], emails: [], whatsapp: [], addresses: [], socials: [] },
    assets: { images: [] },
  };
  const labels = new Map<string, string>();
  const push = (list: string[], value: string) => value && !list.includes(value) && list.push(value);

  try {
    // L'accueil d'abord : son menu et son pied de page disent quelles pages comptent.
    const homePage = await openForCrawl(browser, start.toString(), timeout);
    const origin = new URL(homePage.url()).origin;
    inventory.origin = origin;
    const home: PageRead = await readSafely(homePage);
    const homeUrl = pageUrl(homePage.url(), origin) ?? start.toString();
    await homePage.close();

    // Les autres langues : relevées comme langues, jamais comme pages (la version anglaise d'« À propos » n'est
    // pas une page de plus). Le nouveau site est traduit dans chacune.
    const mainLanguage = home.language || 'fr';
    const others = new Set(home.alternates.map((a) => a.lang).filter((lang) => lang !== mainLanguage));
    // Sans sélecteur reconnu : des liens internes sous `/en/`, `/es/`… (au moins deux) disent la même chose.
    const LANGUAGE_PREFIX = /^(en|fr|es|pt|de|it|ar|sw|nl|zh|ru|tr|ja|ko|wo|ln|ha|yo|am)$/;
    const prefixed = new Map<string, number>();
    for (const link of [...home.navigation, ...home.links]) {
      try {
        const u = new URL(link.href);
        if (u.origin.replace('://www.', '://') !== origin.replace('://www.', '://')) continue;
        const prefix = u.pathname.split('/')[1]?.toLowerCase().replace(/[-_][a-z]{2}$/, '') ?? '';
        if (LANGUAGE_PREFIX.test(prefix) && prefix !== mainLanguage) prefixed.set(prefix, (prefixed.get(prefix) ?? 0) + 1);
      } catch {
        /* lien illisible */
      }
    }
    prefixed.forEach((count, prefix) => count >= 2 && others.add(prefix));
    const otherLanguageUrls = new Set(home.alternates.filter((a) => a.href && others.has(a.lang)).map((a) => pageUrl(a.href, origin)).filter(Boolean) as string[]);
    const inOtherLanguage = (u: string) => {
      if (otherLanguageUrls.has(u)) return true;
      const url = new URL(u);
      const prefix = url.pathname.split('/')[1]?.toLowerCase().replace(/[-_][a-z]{2}$/, '') ?? '';
      const query = url.searchParams.get('lang')?.slice(0, 2).toLowerCase() ?? '';
      return (prefix.length === 2 && others.has(prefix)) || (!!query && others.has(query));
    };

    const ordered: string[] = [homeUrl];
    const add = (raw: string, label = '') => {
      const u = pageUrl(raw, origin);
      if (!u || inOtherLanguage(u)) return;
      if (label && !labels.has(u)) labels.set(u, label);
      if (!ordered.includes(u)) ordered.push(u);
    };
    home.navigation.forEach((l) => add(l.href, l.label));
    home.footerLinks.forEach((l) => add(l.href, l.label));
    (await sitemapUrls(origin)).forEach((u) => add(u));
    home.links.forEach((l) => add(l.href, l.label));

    const reads = new Map<string, PageRead>([[homeUrl, home]]);
    // Les pages du site avant les articles : un blog de cent billets ne doit pas manger la limite. Au-delà de
    // `maxPosts` articles, les suivants ne sont que cités (la page du blog les listera).
    const maxPosts = Math.max(0, Number(process.env.SITE_CRAWL_MAX_POSTS ?? 6));
    let posts = 0;
    const looksLikePost = (u: string) => /\/20\d\d\/|\/(blog|news|actualites?|articles?)\/[^/]+\/?$/i.test(u) || (new URL(u).pathname.split('/').filter(Boolean).pop() ?? '').split('-').length >= 6;
    const rank = (u: string) => (labels.has(u) && !looksLikePost(u) ? 0 : looksLikePost(u) ? 2 : 1);
    const queue = ordered.slice(1).sort((a, b) => rank(a) - rank(b));
    let done = 1;
    options.onProgress?.(done, Math.min(maxPages, ordered.length), homeUrl);

    // Quatre onglets à la fois ; les liens trouvés en chemin rejoignent la file.
    const worker = async () => {
      while (queue.length && reads.size < maxPages) {
        queue.sort((a, b) => rank(a) - rank(b));
        const url = queue.shift()!;
        if (reads.has(url)) continue;
        if (looksLikePost(url) && posts >= maxPosts) continue;
        reads.set(url, null as unknown as PageRead);
        try {
          const page = await openForCrawl(browser, url, Math.min(timeout, 20_000), home.language || 'fr');
          const read: PageRead = await readSafely(page);
          await page.close();
          // Une archive générée, ou une page déjà vue sous une autre adresse : pas une page du site.
          const signature = `${read.title}|${read.blocks.map((b) => b.headings[0] ?? '').join('|')}`;
          const duplicate = [...reads.values()].some((other) => other && `${other.title}|${other.blocks.map((b) => b.headings[0] ?? '').join('|')}` === signature);
          if ((read.archive && !labels.has(url)) || duplicate || (read.post && posts >= maxPosts)) {
            reads.delete(url);
            continue;
          }
          if (read.post) posts += 1;
          // Une page déclarée dans une autre langue (lang de la page) : sa langue est notée, la page écartée.
          if (read.language && read.language !== mainLanguage && others.has(read.language)) {
            reads.delete(url);
            continue;
          }
          read.alternates.forEach((a) => {
            if (a.lang !== mainLanguage && !others.has(a.lang)) others.add(a.lang);
            const alt = a.href ? pageUrl(a.href, origin) : null;
            if (alt && a.lang !== mainLanguage) otherLanguageUrls.add(alt);
          });
          reads.set(url, read);
          read.links.forEach((l) => add(l.href, l.label));
          for (const u of ordered) if (!reads.has(u) && !queue.includes(u)) queue.push(u);
        } catch (error) {
          reads.delete(url);
          logger.warn('site.crawl_page_failed', { event: 'site.crawl_page_failed', url, error: (error as Error).message });
        }
        done += 1;
        options.onProgress?.(done, Math.min(maxPages, ordered.length), url);
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);

    inventory.language = mainLanguage;
    inventory.languages = [
      { code: mainLanguage, url: homeUrl, via: home.language ? 'html' : 'path' },
      ...[...others].map((code) => {
        const alt = home.alternates.find((a) => a.lang === code);
        return alt ? { code, ...(alt.href ? { url: alt.href } : {}), via: alt.via } : { code, via: 'path' as const };
      }),
    ];
    inventory.navigation = home.navigation.filter((l, i, all) => all.findIndex((x) => x.href === l.href) === i);
    inventory.footer = { texts: home.footerTexts, links: home.footerLinks.filter((l) => l.label).slice(0, 40) };
    inventory.assets.favicon = home.favicon || undefined;
    inventory.assets.appleIcon = home.appleIcon || undefined;
    inventory.assets.ogImage = home.ogImage || undefined;
    inventory.contact.addresses = home.addresses;

    // L'ordre des pages : celui du menu (l'accueil en tête), puis le reste. Une page technique presque vide
    // (reçu, lien expiré, confirmation) que ni le menu ni le pied de page ne citent n'est pas une page du site.
    const linked = new Set([...home.navigation, ...home.footerLinks].map((l) => pageUrl(l.href, origin)).filter(Boolean));
    const weight = (read: PageRead) => read.blocks.reduce((n, b) => n + [...b.headings, ...b.texts, ...b.items].join(' ').length + b.images.length * 80, 0);
    const relevant = ordered.filter((u) => {
      const read = reads.get(u);
      if (!read) return false;
      if (u !== homeUrl && !linked.has(u) && weight(read) < 160) {
        reads.delete(u);
        return false;
      }
      return true;
    });
    relevant.forEach((url, pageIndex) => {
      const read = reads.get(url)!;
      const u = new URL(url);
      const page: InventoryPage = {
        url,
        path: pageIndex === 0 ? '/' : u.pathname,
        title: read.title,
        ...(read.description ? { description: read.description } : {}),
        sections: read.blocks.map((block, sectionIndex) => ({ id: `p${pageIndex}.s${sectionIndex}`, ...block })),
      };
      inventory.pages.push(page);
      for (const section of page.sections) {
        for (const image of section.images) {
          if (!inventory.assets.images.some((i) => i.url === image.url)) inventory.assets.images.push({ ...image, page: page.path, section: section.id });
        }
        for (const cta of section.ctas) {
          if (cta.kind === 'phone') push(inventory.contact.phones, cta.href.replace(/^tel:/i, ''));
          if (cta.kind === 'email') push(inventory.contact.emails, cta.href.replace(/^mailto:/i, '').split('?')[0]);
          if (cta.kind === 'whatsapp') push(inventory.contact.whatsapp, cta.href);
        }
      }
      for (const link of [...read.footerLinks, ...read.links]) {
        if (/^tel:/i.test(link.href)) push(inventory.contact.phones, link.href.replace(/^tel:/i, ''));
        if (/^mailto:/i.test(link.href)) push(inventory.contact.emails, link.href.replace(/^mailto:/i, '').split('?')[0]);
        if (/wa\.me|whatsapp\.com/i.test(link.href)) push(inventory.contact.whatsapp, link.href);
        if (SOCIAL.test(link.href) && !inventory.contact.socials.some((s) => s.url === link.href)) inventory.contact.socials.push({ network: link.href.match(SOCIAL)![1].replace('x', 'twitter'), url: link.href });
      }
    });
    // Les coordonnées écrites en clair (pas en liens) : téléphones internationaux ou à 8 chiffres et plus, e-mails.
    const corpus = inventoryText(inventory);
    for (const m of corpus.matchAll(/[\w.+-]+@[\w-]+\.[\w.-]+\w/g)) push(inventory.contact.emails, m[0].toLowerCase());
    for (const m of corpus.matchAll(/(?:\+|00)\d{1,3}(?:[ .-]?\(?\d{1,4}\)?){2,6}|\b\d{2,3}(?:[ .-]\d{2,3}){3,4}\b/g)) {
      const digits = m[0].replace(/\D/g, '');
      if (digits.length >= 8 && digits.length <= 15 && !/^(19|20)\d{2}$/.test(digits)) push(inventory.contact.phones, m[0].trim());
    }
    inventory.skipped = ordered.filter((u) => !reads.get(u)).slice(0, 60).map((u) => ({ url: u, label: labels.get(u) || new URL(u).pathname }));
    return inventory;
  } finally {
    await browser.close().catch(() => undefined);
  }
}

/** Le relevé en texte : la référence du garde-fou des faits (rien de ce qui est écrit là n'est une invention). */
export function inventoryText(inventory: SiteInventory): string {
  const lines: string[] = [];
  for (const page of inventory.pages) {
    lines.push(`${page.title} ${page.description ?? ''}`);
    for (const s of page.sections) lines.push([...s.headings, ...s.texts, ...s.items, ...s.ctas.map((c) => c.label), ...(s.form ?? [])].join('\n'));
  }
  const c = inventory.contact;
  lines.push([...c.phones, ...c.emails, ...c.addresses, ...inventory.footer.texts].join('\n'));
  return lines.join('\n');
}
