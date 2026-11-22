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
import { reachSite, unreachableMessage } from './site-reach';
import { safeFetch } from '../render/safe-fetch';
import { evaluateSettled } from './settled';
import type { ImageQuality } from '../../../../../packages/design-tools/src/image-quality';
import { detectFromHeaders, detectInPage, FLATTEN_SHADOW_SCRIPT, originalImageUrl, profileOf, REMOVE_CONSENT_SCRIPT, TECHNOLOGIES, type RenderFamily, type TechProfile } from './site-tech';

export interface InventoryImage {
  url: string;
  alt: string;
  width: number;
  height: number;
  /** `img` : une image du contenu ; `background` : une image de fond (héros, bandeaux). */
  kind: 'img' | 'background';
  /** L'adresse vraiment chargée par la page, quand `url` vise une plus grande variante (secours de la recopie). */
  fallback?: string;
  /** Mesurée à la recopie par le code (`packages/design-tools/src/image-quality.ts`) ; absente des relevés antérieurs au 21/11/2026. */
  quality?: ImageQuality;
}

export type { ImageQuality };

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
  /** Les entrées PRINCIPALES du menu de l'en-tête, dans l'ordre (sans les sous-menus ni le logo). */
  navigation: { label: string; href: string }[];
  /** Les boutons d'action de l'en-tête, hors du menu (« Rejoignez-nous », « Prendre rendez-vous »). */
  headerActions?: { label: string; href: string }[];
  footer: { texts: string[]; links: { label: string; href: string }[] };
  contact: { phones: string[]; emails: string[]; whatsapp: string[]; addresses: string[]; socials: { network: string; url: string }[] };
  assets: { favicon?: string; appleIcon?: string; ogImage?: string; images: (InventoryImage & { page: string; section: string })[] };
  /** La technologie du site et ce que le relevé a fait pour elle (`site-tech.ts`). */
  technology?: { family: RenderFamily; names: string[]; adaptations: string[] };
}

export interface CrawlOptions {
  url: string;
  maxPages?: number;
  timeoutMs?: number;
  onProgress?: (done: number, total: number, url: string) => void;
  /** Modèle de vision de l'hôte : lit une page dessinée dans un canvas (Flutter web, Unity). Facultatif. */
  vision?: (base64: string, mimeType: string, instruction: string) => Promise<string>;
  /** Interne : site contenu dans un iframe, déjà suivi une fois. */
  followedFrom?: string;
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
  headerActions?: { label: string; href: string }[];
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
  // On descend une enveloppe à un seul enfant… sauf quand ses enfants SONT le contenu (titres, paragraphes, listes,
  // images) : une page d'une seule section était découpée en un <h1> et un <p> lus de l'intérieur — sans rien dedans.
  var contentLeaf = function (el: any) {
    return Array.prototype.some.call(el.children, function (c: any) {
      return /^(H[1-6]|P|UL|OL|IMG|PICTURE|FIGURE|BLOCKQUOTE|TABLE|FORM|ADDRESS)$/.test(c.tagName);
    });
  };
  while (blocks.length === 1 && blocks[0].children.length > 0 && !contentLeaf(blocks[0]) && guard++ < 8) blocks = Array.prototype.slice.call(blocks[0].children);
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

  // L'élément LUI-MÊME et ses descendants : un bloc qui est un <h1>, un <p> ou une <ul> posé directement sous <main>
  // (pages simples, articles, mentions légales) n'avait rien à lire « à l'intérieur » et ressortait vide.
  var within = function (el: any, selector: string): any[] {
    var out: any[] = el.matches && el.matches(selector) ? [el] : [];
    return out.concat(Array.prototype.slice.call(el.querySelectorAll(selector)));
  };
  var readBlock = function (el: any) {
    var headings = uniq(
      within(el, 'h1, h2, h3, h4').filter(shown).map(function (h: any) {
        return clean(h.textContent);
      }),
      30
    );
    // Le texte courant : les paragraphes, et les blocs « feuilles » des constructeurs de pages (du texte dans une
    // <div> ou un <span> sans paragraphe) — jamais deux fois le même, jamais un titre, un bouton ou un élément de liste.
    var textual = 'p, blockquote, figcaption, dd, address, td';
    var texts = uniq(
      within(el, textual + ', div, span').filter(function (n: any) {
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
      within(el, 'li').filter(function (li: any) {
        return shown(li) && !li.closest('nav') && li.querySelectorAll('li').length === 0;
      }).map(function (li: any) {
        return clean(li.textContent).slice(0, 300);
      }).filter(function (t: string) {
        return t.length >= 2;
      }),
      60
    );
    var ctas: any[] = [];
    within(el, 'a[href], button').filter(shown).forEach(function (a: any) {
      var label = clean(a.textContent || a.getAttribute('aria-label') || a.getAttribute('title'));
      var href = a.tagName.toLowerCase() === 'a' ? abs(a.getAttribute('href')) : '';
      if (!label || label.length > 80 || ctas.length >= 30) return;
      if (ctas.some(function (c: any) { return c.label === label && c.href === href; })) return;
      ctas.push({ label: label, href: href, kind: href ? ctaKind(href) : 'anchor' });
    });
    var images: any[] = [];
    var own = bg(el);
    if (own) images.push({ url: own, alt: '', width: Math.round(el.getBoundingClientRect().width), height: Math.round(el.getBoundingClientRect().height), kind: 'background' });
    within(el, 'img, picture source, *').slice(0, 1500).forEach(function (node: any) {
      if (images.length >= 40) return;
      var tag = node.tagName.toLowerCase();
      if (tag === 'img') {
        // La vraie source d'une image chargée en différé (`src` n'y porte qu'une image d'attente data:…).
        // La plus grande variante annoncée (descripteur `w` ou `x`), pas la dernière écrite : le navigateur du robot
        // charge celle de SON écran, souvent une vignette. Les `<source>` d'un `<picture>` comptent aussi.
        var sets = [node.getAttribute('data-srcset'), node.getAttribute('data-lazy-srcset'), node.getAttribute('srcset')];
        var picture = node.parentElement && node.parentElement.tagName.toLowerCase() === 'picture' ? node.parentElement : null;
        if (picture) picture.querySelectorAll('source').forEach(function (s: any) {
          var type = (s.getAttribute('type') || '').toLowerCase();
          if (!type || /image\/(jpe?g|png|webp|avif)/.test(type)) sets.push(s.getAttribute('data-srcset') || s.getAttribute('srcset'));
        });
        var best = '', bestSize = -1;
        sets.forEach(function (set: any) {
          if (!set) return;
          // Une virgule sépare deux entrées après un descripteur ou devant une espace ; celles d'une adresse
          // Cloudinary (`w_300,h_200`) restent dans l'adresse.
          String(set).split(/(?<=\s\d+(?:\.\d+)?[wx])\s*,|,\s+/).forEach(function (part: string) {
            var bits = part.trim().split(/\s+/);
            if (!bits[0] || bits[0].indexOf('data:') === 0) return;
            var d = bits[1] || '1x';
            var size = /w$/.test(d) ? parseFloat(d) : parseFloat(d) * 1000;
            if (size > bestSize) { best = bits[0]; bestSize = size; }
          });
        });
        var lazy = node.getAttribute('data-src') || node.getAttribute('data-lazy-src') || node.getAttribute('data-original') || node.getAttribute('data-lazy') || '';
        var raw = node.currentSrc || node.getAttribute('src') || '';
        var placeholder = !raw || raw.indexOf('data:') === 0;
        var shownSrc = abs(placeholder ? lazy || best : raw);
        var src = best ? abs(best) : shownSrc;
        var box = node.getBoundingClientRect();
        var w = (!placeholder && node.naturalWidth) || Number(node.getAttribute('width')) || Math.round(box.width) || 0;
        var h = (!placeholder && node.naturalHeight) || Number(node.getAttribute('height')) || Math.round(box.height) || 0;
        if (!src || src.indexOf('data:') === 0 || (w && w < 48 && h < 48)) return;
        if (images.some(function (i: any) { return i.url === src; })) return;
        var entry: any = { url: src, alt: clean(node.getAttribute('alt')), width: w, height: h, kind: 'img' };
        // L'image vraiment affichée : le secours si la grande variante ne se télécharge pas.
        if (shownSrc && shownSrc !== src && shownSrc.indexOf('data:') !== 0) entry.fallback = shownSrc;
        images.push(entry);
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
      within(el, 'input, textarea, select').filter(function (f: any) {
        return f.type !== 'hidden' && f.type !== 'submit';
      }).map(function (f: any) {
        var label = f.id ? document.querySelector('label[for="' + f.id + '"]') : null;
        return clean((label && label.textContent) || f.getAttribute('placeholder') || f.getAttribute('aria-label') || f.getAttribute('name'));
      }),
      20
    );
    var videos = uniq(
      within(el, 'iframe[src], video').map(function (v: any) {
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

  // Les éléments « feuilles » consécutifs (titre, paragraphes, listes, images posés à plat sous <main>) forment UNE
  // section, découpée à chaque nouveau h1 ou h2 : une page de texte simple ressort en sections, pas en cent lignes.
  var LEAF = /^(H[1-6]|P|UL|OL|DL|IMG|PICTURE|FIGURE|BLOCKQUOTE|TABLE|PRE|HR|ADDRESS)$/;
  var leafBlocks = blocks.filter(function (b: any) { return LEAF.test(b.tagName); });
  var flat = blocks.length >= 3 && leafBlocks.length >= blocks.length * 0.6;
  var emptyBlock = function (): any { return { headings: [], texts: [], items: [], ctas: [], images: [] }; };
  var mergeInto = function (target: any, part: any) {
    ['headings', 'texts', 'items', 'ctas', 'images'].forEach(function (key) {
      part[key].forEach(function (value: any) {
        var dupe = target[key].some(function (x: any) { return JSON.stringify(x) === JSON.stringify(value); });
        if (!dupe) target[key].push(value);
      });
    });
    if (part.form) target.form = (target.form || []).concat(part.form);
    if (part.videos) target.videos = (target.videos || []).concat(part.videos);
  };
  var read: any[];
  if (flat) {
    read = [];
    var current: any = null;
    blocks.forEach(function (b: any) {
      var part = readBlock(b);
      var startsSection = /^H[12]$/.test(b.tagName) || (!LEAF.test(b.tagName));
      if (!current || (startsSection && (current.headings.length || current.texts.length || current.items.length))) {
        if (current) read.push(current);
        current = emptyBlock();
      }
      mergeInto(current, part);
      if (!LEAF.test(b.tagName)) { read.push(current); current = null; }
    });
    if (current) read.push(current);
  } else {
    read = blocks.map(readBlock);
  }
  read = read.filter(function (b: any) {
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
  // LE MENU DE L'EN-TÊTE tel qu'il s'affiche : ses entrées principales seulement. Avant, chaque lien de l'en-tête
  // (sous-menus dépliants, logo, bouton d'action, réseaux, menu mobile en double) devenait une entrée du menu, et la
  // refonte saturait sa barre de navigation. Les liens hors du menu qui ont un libellé sont les boutons d'action.
  var headerMenu = (function () {
    var empty = { items: [] as any[], actions: [] as any[] };
    if (!header) return empty;
    var SUB = /sub-?menu|dropdown|children|mega|submenu/i;
    var isSub = function (a: any) {
      // Un lien rangé dans une liste elle-même dans un élément de liste : un sous-menu.
      for (var n = a.parentElement; n && n !== header; n = n.parentElement) {
        if (n.tagName === 'UL' || n.tagName === 'OL') {
          var li = n.parentElement && n.parentElement.closest ? n.parentElement.closest('li') : null;
          if (li && header.contains(li)) return true;
        }
        if (SUB.test(String(n.className || '')) && n.tagName !== 'NAV') return true;
      }
      return false;
    };
    var lists = Array.prototype.slice.call(header.querySelectorAll('nav ul, nav ol, ul, ol')).filter(function (l: any) {
      var li = l.parentElement && l.parentElement.closest ? l.parentElement.closest('li') : null;
      return !(li && header.contains(li));
    });
    // La liste qui porte le plus d'entrées est le menu (une autre, plus courte, est souvent celle des réseaux).
    var main: any = null;
    var best = 0;
    lists.forEach(function (l: any) {
      var count = Array.prototype.slice.call(l.children).filter(function (c: any) { return c.tagName === 'LI' && c.querySelector('a[href]'); }).length;
      if (count > best) {
        best = count;
        main = l;
      }
    });
    var seen: any = {};
    var items: any[] = [];
    var push = function (list: any[], a: any) {
      var label = clean(a.textContent || a.getAttribute('aria-label')).slice(0, 60);
      var href = abs(a.getAttribute('href'));
      if (!label || !href || seen[label + '|' + href]) return;
      seen[label + '|' + href] = true;
      list.push({ label: label, href: href });
    };
    if (main && best >= 2) {
      Array.prototype.slice.call(main.children).forEach(function (li: any) {
        if (li.tagName !== 'LI') return;
        var a = li.querySelector('a[href]');
        if (a) push(items, a);
      });
    } else {
      Array.prototype.slice.call(header.querySelectorAll('a[href]')).forEach(function (a: any) {
        if (!isSub(a)) push(items, a);
      });
    }
    var menuHrefs: any = {};
    items.forEach(function (i: any) { menuHrefs[i.label + '|' + i.href] = true; });
    var actions: any[] = [];
    if (main && best >= 2) {
      Array.prototype.slice.call(header.querySelectorAll('a[href]')).forEach(function (a: any) {
        if (main.contains(a) || isSub(a)) return;
        // Un lien d'image seule (le logo) ou d'icône (réseaux) n'a pas de libellé : il n'est pas un bouton d'action.
        var label = clean(a.textContent).slice(0, 60);
        if (!label || label.length < 3) return;
        // Le même menu, recopié pour les téléphones : déjà relevé.
        if (menuHrefs[label + '|' + abs(a.getAttribute('href'))]) return;
        push(actions, a);
      });
    }
    return { items: items.slice(0, 12), actions: actions.slice(0, 2) };
  })();
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
    navigation: headerMenu.items,
    headerActions: headerMenu.actions,
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

/**
 * Ce qui ralentit le relevé sans rien lui apprendre : mesure d'audience, publicité, discussions en direct (leurs
 * fenêtres étaient en plus relevées comme des sections du site).
 */
export const NOISE = /google-analytics\.com|googletagmanager\.com|gtag\/js|doubleclick\.net|googlesyndication|connect\.facebook\.net|facebook\.com\/tr|hotjar\.com|clarity\.ms|segment\.(io|com)|mixpanel\.com|amplitude\.com|intercom(cdn)?\.(io|com)|crisp\.chat|tawk\.to|zopim\.com|zdassets\.com|livechatinc\.com|drift\.com|tidio|smartsupp|js\.hs-analytics\.net|js\.hs-banner\.com|snap\.licdn\.com|analytics\.tiktok\.com|criteo\.(com|net)|taboola\.com|outbrain\.com|adservice\.google|matomo\.js|piwik\.js|plausible\.io|cdn\.mouseflow|fullstory\.com|newrelic\.com|nr-data\.net|sentry-cdn|browser\.sentry/i;

/** Une page ouverte, avec ce que sa réponse a dit (statut, en-têtes : la technologie se lit aussi là). */
interface Opened {
  page: Page;
  status: number;
  headers: Record<string, string>;
  /** Longueur du texte du HTML REÇU (avant exécution du JavaScript) : mesure si la page est remplie dans le navigateur. */
  initialText: number | null;
}

/**
 * Attend que la page ne bouge plus : aucune modification du DOM pendant `quietMs` (au plus 6 × `quietMs` + 2 s).
 * Plus juste que « réseau au repos » : une application qui a fini de s'afficher mais garde une connexion ouverte (suivi,
 * discussion) n'est pas attendue pour rien, et une application qui affiche encore est attendue.
 */
export async function settle(page: Page, quietMs: number): Promise<void> {
  const max = quietMs * 6 + 2000;
  await page
    .evaluate(
      `new Promise((done) => { let timer = null; const finish = () => { clearTimeout(cap); observer.disconnect(); done(true); }; const cap = setTimeout(finish, ${max}); const observer = new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(finish, ${quietMs}); }); observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true }); timer = setTimeout(finish, ${quietMs}); })`
    )
    .catch(() => undefined);
}

/** Un mur anti-robot (Cloudflare, DDoS-Guard, Sucuri…) : on attend qu'il passe de lui-même, 15 s au plus. */
const WALL_TITLE = /just a moment|attention required|checking your browser|un instant|ddos-guard|pardon our interruption|verify you are human|vérification de sécurité|client challenge|making sure you.?re not a bot|anubis/i;

/** Une page de défi : titre connu, ou une page presque sans texte dont le titre parle de défi, de vérification ou de robot. */
export async function isWallPage(page: Page): Promise<boolean> {
  const title = await page.title().catch(() => '');
  if (WALL_TITLE.test(title)) return true;
  const text = Number(await page.evaluate(`(document.body && document.body.innerText || '').trim().length`).catch(() => 999));
  return text < 80 && /challenge|captcha|verif|robot|human|blocked|denied|security/i.test(title);
}

export async function waitBotWall(page: Page): Promise<boolean> {
  for (let i = 0; i < 30; i++) {
    if (!(await isWallPage(page))) return i > 0;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function openForCrawl(browser: Browser, url: string, timeoutMs: number, language = 'fr', settleMs = 600): Promise<Opened> {
  const clock = Date.now();
  const marks: Record<string, number> = {};
  const mark = (name: string) => {
    marks[name] = Date.now() - clock;
  };
  const page = await browser.newPage();
  // Les sites qui traduisent selon le navigateur : toujours la langue du site (celle de l'accueil).
  await page.setExtraHTTPHeaders({ 'Accept-Language': language === 'en' ? 'en-US,en;q=0.9' : `${language}-${language.toUpperCase()},${language};q=0.9` });
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36 IDEM/1.0');
  // Les traducteurs automatiques sont coupés (le relevé lirait une traduction machine), comme les polices, les médias
  // et le bruit (`NOISE`) : rien de cela ne change le contenu relevé. Les images restent : une section faite d'une
  // seule image sans dimensions déclarées n'aurait plus de hauteur, et disparaîtrait du relevé.
  await installRenderNetworkGuard(
    page,
    (req) => !['media', 'font', 'websocket', 'eventsource'].includes(req.resourceType()) && !MACHINE_TRANSLATION.test(req.url()) && !NOISE.test(req.url())
  );
  let response: Awaited<ReturnType<Page['goto']>> = null;
  try {
    // Le document chargé, sans attendre le réseau au repos : `settle` attend que la page ait fini de s'afficher.
    response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
  } catch (error) {
    if (!/timeout/i.test((error as Error).message)) throw error;
    // Un délai dépassé SANS document (hôte qui ne répond pas) n'est pas une page lente : le dire, au lieu de relever une
    // page blanche comme si c'était le site.
    const hasDocument = await page.evaluate(`!!document.body && document.body.children.length > 0`).catch(() => false);
    if (!hasDocument) {
      await page.close().catch(() => undefined);
      throw new Error(`unreachable: ${url} ne répond pas`);
    }
  }
  mark('goto');
  // Le texte du HTML reçu : mesure (et non supposition) du rendu dans le navigateur.
  let initialText: number | null = null;
  try {
    const raw = response ? await response.text() : '';
    initialText = raw ? raw.replace(/<(script|style|noscript|template)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length : null;
  } catch {
    initialText = null;
  }
  if (await waitBotWall(page)) await page.waitForNetworkIdle({ idleTime: 300, timeout: 8000 }).catch(() => undefined);
  mark('wall');
  await settle(page, settleMs);
  mark('settle');
  await page.evaluate(REMOVE_CONSENT_SCRIPT).catch(() => 0);
  // Code passé en texte : une fonction transpilée emporterait des aides absentes de la page.
  await page
    .evaluate(
      `new Promise((done) => { let y = 0; const step = () => { if (y++ >= 16 || window.scrollY + window.innerHeight >= document.body.scrollHeight - 4) { window.scrollTo(0, 0); return done(true); } window.scrollBy(0, window.innerHeight); setTimeout(step, 120); }; step(); })`
    )
    .catch(() => undefined);
  mark('scroll');
  await settle(page, 250);
  mark('settle2');
  // Les durées par étape : de quoi dire, dans les journaux, où part le temps d'une page lente.
  if (process.env.SITE_CRAWL_TIMING === '1' || marks.settle2 > 12_000) logger.info('site.crawl_page', { event: 'site.crawl_page', url, ms: marks });
  return { page, status: response?.status() ?? 0, headers: response?.headers() ?? {}, initialText };
}

/**
 * Ouvre une page PAR L'APPLICATION : l'accueil d'abord, puis le routeur du framework (Next.js, Vue, Nuxt), un `#/`,
 * ou `pushState` + `popstate` (React Router, Angular, Svelte, Ember les écoutent). Pour une application sans renvoi
 * de ses adresses profondes (hébergement statique) : `/services` répond 404, mais la page existe dans l'application.
 */
async function openInApp(browser: Browser, homeUrl: string, target: string, timeoutMs: number, language: string, settleMs: number): Promise<Opened> {
  const opened = await openForCrawl(browser, homeUrl, timeoutMs, language, settleMs);
  const u = new URL(target);
  const path = `${u.pathname}${u.search}${u.hash}`;
  await opened.page
    .evaluate(
      `(() => {
  const path = ${JSON.stringify(path)};
  try { if (window.next && window.next.router && window.next.router.push) { window.next.router.push(path); return 'next'; } } catch (e) {}
  try {
    const host = document.querySelector('#__nuxt') || document.querySelector('[data-v-app]') || document.querySelector('#app');
    const app = host && host.__vue_app__;
    const router = app && app.config && app.config.globalProperties && app.config.globalProperties.$router;
    if (router) { router.push(path); return 'vue'; }
    const vue2 = host && host.__vue__;
    if (vue2 && vue2.$router) { vue2.$router.push(path); return 'vue2'; }
  } catch (e) {}
  const hash = path.indexOf('#');
  if (hash >= 0 && /^#!?\\//.test(path.slice(hash))) { location.hash = path.slice(hash); return 'hash'; }
  history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
  return 'history';
})()`
    )
    .catch(() => undefined);
  await settle(opened.page, settleMs);
  await opened.page.evaluate(REMOVE_CONSENT_SCRIPT).catch(() => 0);
  return { ...opened, status: 200 };
}

/**
 * Les pages qu'un menu ouvre par CLIC (boutons, `routerLink` sans adresse, éléments `role=link`) : chacun est cliqué
 * dans l'accueil, l'adresse obtenue est notée, puis on revient. Douze au plus.
 */
const NAV_CANDIDATES = `(() => {
  const nav = document.querySelector('header') || document.querySelector('nav') || document.querySelector('[role="navigation"]');
  if (!nav) return 0;
  const list = Array.from(nav.querySelectorAll('button, [role="link"], [role="menuitem"], [routerlink], li, span, div')).filter((el) => {
    if (el.closest('a[href]') || el.querySelector('a[href]')) return false;
    const label = (el.textContent || '').replace(/\\s+/g, ' ').trim();
    if (label.length < 2 || label.length > 40) return false;
    // Le plus petit élément porteur du libellé (pas son enveloppe).
    if (Array.from(el.children).some((child) => (child.textContent || '').trim() === label)) return false;
    return getComputedStyle(el).cursor === 'pointer' || el.tagName === 'BUTTON' || el.getAttribute('role') === 'link' || el.hasAttribute('routerlink');
  });
  window.__idemNav = list.slice(0, 12);
  return window.__idemNav.length;
})()`;

/**
 * Chaque page ouverte par un clic est LUE sur le moment (`read`) : elle est déjà affichée, la rouvrir ensuite (accueil +
 * navigation de l'application) coûtait deux à trois secondes par page.
 */
export async function discoverByClick(browser: Browser, homeUrl: string, timeoutMs: number, language: string, settleMs: number, flattenShadow = false): Promise<{ href: string; label: string; read?: PageRead }[]> {
  const found: { href: string; label: string; read?: PageRead }[] = [];
  const { page } = await openForCrawl(browser, homeUrl, timeoutMs, language, settleMs);
  try {
    const count = Number(await page.evaluate(NAV_CANDIDATES).catch(() => 0));
    for (let i = 0; i < count; i++) {
      // La liste relue avant chaque clic : un clic (même sur « Accueil ») peut faire redessiner le menu, et les
      // éléments gardés ne seraient plus dans la page.
      await page.evaluate(NAV_CANDIDATES).catch(() => 0);
      const before = page.url();
      const label = (await page
        .evaluate(`(() => { const el = (window.__idemNav || [])[${i}]; if (!el || !el.isConnected) return null; const label = (el.textContent || '').replace(/\\s+/g, ' ').trim(); el.click(); return label; })()`)
        .catch(() => null)) as string | null;
      await new Promise((r) => setTimeout(r, 150));
      await settle(page, 300);
      const after = page.url();
      if (after !== before) {
        if (label && !found.some((f) => f.href === after)) {
          await settle(page, Math.min(settleMs, 800));
          await page.evaluate(REMOVE_CONSENT_SCRIPT).catch(() => 0);
          if (flattenShadow) await page.evaluate(FLATTEN_SHADOW_SCRIPT).catch(() => 0);
          const read = await readSafely(page).catch(() => undefined);
          found.push({ href: after, label, ...(read ? { read } : {}) });
        }
        // Retour à l'accueil par l'historique (l'application le gère sans recharger), sinon en rouvrant l'accueil.
        await page.goBack({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => undefined);
        await settle(page, 300);
        if (page.url() !== before) {
          await page.goto(homeUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs }).catch(() => undefined);
          await settle(page, settleMs);
        }
      }
    }
  } finally {
    await page.close().catch(() => undefined);
  }
  return found;
}

const SKIP_PATH = /\/(author|writer|category|categorie|tag|etiquette|search|recherche)\/|\.(pdf|jpe?g|png|gif|webp|svg|zip|docx?|xlsx?|pptx?|mp4|mp3)$|\/(wp-admin|wp-login|login|signin|connexion|register|inscription|cart|panier|checkout|commande|account|compte|mon-compte|feed|wp-json|xmlrpc)(\/|$)|\/(tag|author|page)\/\d*|[?&](replytocom|share|print)=/i;

/**
 * Une adresse de la même origine, sans ancre ni paramètres de suivi, que l'on peut relever. `keepHashRoutes` : une
 * application à routes en `#/` (Angular `useHash`, anciens Vue et React) garde son `#/route` — sans lui, chaque page
 * était l'accueil.
 */
function pageUrl(raw: string, origin: string, keepHashRoutes = false): string | null {
  try {
    const u = new URL(raw);
    if (u.origin.replace('://www.', '://') !== origin.replace('://www.', '://')) return null;
    if (SKIP_PATH.test(u.pathname + u.search)) return null;
    if (keepHashRoutes && /^#!?\/[^/]/.test(u.hash)) {
      if (SKIP_PATH.test(u.hash.replace(/^#!?/, ''))) return null;
      return u.toString();
    }
    u.hash = '';
    for (const key of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid|ref$)/i.test(key)) u.searchParams.delete(key);
    if (u.pathname !== '/' && !u.pathname.endsWith('/') && !/\.[a-z0-9]{2,5}$/i.test(u.pathname)) u.pathname += '/';
    return u.toString();
  } catch {
    return null;
  }
}

const readText = async (url: string, maxBytes = 3 * 1024 * 1024): Promise<string> => {
  try {
    const file = await safeFetch(url, { maxBytes, timeoutMs: 6_000 });
    return file.buffer.toString('utf8');
  } catch {
    return '';
  }
};

/**
 * Le plan du site, où qu'il soit : ceux que `robots.txt` déclare, puis les adresses usuelles — `sitemap.xml`,
 * `sitemap_index.xml` (Yoast, Rank Math), `wp-sitemap.xml` (WordPress), `sitemap-index.xml` et `sitemap-0.xml`
 * (Astro, Next.js `next-sitemap`), `sitemap/sitemap-index.xml` (Gatsby), `page-sitemap.xml`. Les sous-plans d'un
 * index sont lus une fois (les pages d'abord ; étiquettes, auteurs, catégories écartés).
 */
async function sitemapUrls(origin: string): Promise<string[]> {
  const locs = (xml: string) => [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\s\]]+)\s*(?:\]\]>)?\s*<\/loc>/gi)].map((m) => m[1].replace(/&amp;/g, '&'));
  const usual = ['/sitemap.xml', '/sitemap_index.xml', '/wp-sitemap.xml', '/sitemap-index.xml', '/sitemap-0.xml', '/sitemap/sitemap-index.xml', '/page-sitemap.xml'].map((p) => `${origin}${p}`);
  // Le fichier robots.txt ET les adresses usuelles, EN MÊME TEMPS (sept requêtes sans réponse attendues l'une après
  // l'autre coûtaient jusqu'à une minute sur un site lent) ; celles que robots.txt déclare sont lues ensuite.
  const [robots, ...found] = await Promise.all([readText(`${origin}/robots.txt`, 200_000), ...usual.map((url) => readText(url))]);
  const declared = [...robots.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1]).filter((url) => !usual.includes(url)).slice(0, 4);
  const extra = await Promise.all(declared.map((url) => readText(url)));
  const documents = [...extra, ...found].filter((xml) => /<(urlset|sitemapindex)/i.test(xml));
  const out: string[] = [];
  for (const root of documents) {
    if (/<sitemapindex/i.test(root)) {
      const children = locs(root)
        .filter((u) => !/(tag|author|category|attachment|post_tag|product_tag|format)/i.test(u))
        .sort((a, b) => Number(/page/i.test(b)) - Number(/page/i.test(a)))
        .slice(0, 5);
      const nested = await Promise.all(children.map((child) => readText(child)));
      out.push(...nested.flatMap(locs));
    } else {
      out.push(...locs(root));
    }
    // Un plan trouvé suffit : les autres adresses ne sont que des emplacements possibles du même plan.
    if (out.length) break;
  }
  return [...new Set(out)].slice(0, 400);
}

/** WordPress : la liste des pages publiées par son API REST (même celles qu'aucun menu ne cite). */
async function wordpressPages(origin: string): Promise<{ href: string; label: string }[]> {
  const raw = await readText(`${origin}/wp-json/wp/v2/pages?per_page=100&_fields=link,title,menu_order`, 2 * 1024 * 1024);
  try {
    const pages = JSON.parse(raw) as { link?: string; title?: { rendered?: string } }[];
    return Array.isArray(pages) ? pages.filter((p) => typeof p.link === 'string').map((p) => ({ href: p.link!, label: String(p.title?.rendered ?? '').replace(/<[^>]+>/g, '').trim() })) : [];
  } catch {
    return [];
  }
}

/**
 * Une page dessinée dans un canvas (Flutter web, Unity) : rien à lire dans le DOM. Flutter sait exposer son arbre
 * d'accessibilité (un clic sur son bouton « Enable accessibility ») : on l'essaie d'abord ; sinon, des captures
 * successives lues par le modèle de vision de l'hôte, en sections.
 */
async function readCanvasPage(page: Page, vision?: CrawlOptions['vision']): Promise<{ read: PageRead; via: 'accessibility' | 'vision' } | null> {
  const semantic = await page
    .evaluate(`(() => { const el = document.querySelector('flt-semantics-placeholder, [aria-label="Enable accessibility"]'); if (!el) return false; el.click(); return true; })()`)
    .catch(() => false);
  if (semantic) {
    await settle(page, 600);
    const read = await readSafely(page).catch(() => null);
    if (read && read.blocks.some((b) => b.headings.length || b.texts.length)) return { read, via: 'accessibility' };
  }
  if (!vision) return null;
  const shots: string[] = [];
  for (let i = 0; i < 4; i++) {
    shots.push(Buffer.from(await page.screenshot({ type: 'jpeg', quality: 70 })).toString('base64'));
    await page.keyboard.press('PageDown').catch(() => undefined);
    await page.mouse.wheel({ deltaY: 900 }).catch(() => undefined);
    await new Promise((r) => setTimeout(r, 500));
  }
  const blocks: PageRead['blocks'] = [];
  for (const shot of shots) {
    const answer = await vision(
      shot,
      'image/jpeg',
      'This is a screenshot of a website drawn in a canvas. Transcribe its content EXACTLY as written, section by section. Answer ONLY JSON: {"sections":[{"headings":[],"texts":[],"items":[],"buttons":[]}]}. No invention, no summary.'
    ).catch(() => '');
    try {
      const json = JSON.parse(answer.replace(/```[a-z]*\n?/gi, '').match(/\{[\s\S]*\}/)?.[0] ?? '{}') as { sections?: { headings?: string[]; texts?: string[]; items?: string[]; buttons?: string[] }[] };
      for (const s of json.sections ?? []) {
        const block = {
          headings: (s.headings ?? []).map(String).slice(0, 10),
          texts: (s.texts ?? []).map(String).slice(0, 30),
          items: (s.items ?? []).map(String).slice(0, 30),
          ctas: (s.buttons ?? []).map((label) => ({ label: String(label).slice(0, 80), href: '', kind: 'anchor' as const })),
          images: [],
        };
        const key = [...block.headings, ...block.texts].join('|');
        if (key && !blocks.some((b) => [...b.headings, ...b.texts].join('|') === key)) blocks.push(block);
      }
    } catch {
      /* capture illisible */
    }
  }
  if (!blocks.length) return null;
  const title = await page.title().catch(() => '');
  return { via: 'vision', read: { post: false, archive: false, title, description: '', language: '', alternates: [], blocks, navigation: [], headerActions: [], footerTexts: [], footerLinks: [], links: [], favicon: '', appleIcon: '', ogImage: '', addresses: [] } };
}

const SOCIAL = /(facebook|instagram|linkedin|tiktok|twitter|x\.com|youtube|pinterest)\./i;

/** Le relevé complet. */
export async function crawlWebsite(options: CrawlOptions): Promise<SiteInventory> {
  // Le site est joint même quand le résolveur du système ne le connaît pas (`site-reach.ts`) : nom épinglé dans Chrome,
  // variante avec ou sans « www » si l'autre manque.
  const reach = await reachSite(options.url);
  if (!reach.ok) throw new Error(reach.reason === 'private' ? 'blocked_url' : `unreachable: ${unreachableMessage(reach)}`);
  const start = new URL(reach.url);
  start.hash = '';
  const maxPages = Math.max(1, Math.min(40, options.maxPages ?? Number(process.env.SITE_CRAWL_MAX_PAGES ?? 20)));
  // Les durées par phase, écrites à la fin du relevé : où part le temps, site par site.
  const phases: Record<string, number> = {};
  let phaseAt = Date.now();
  const phase = (name: string) => {
    phases[name] = (phases[name] ?? 0) + Date.now() - phaseAt;
    phaseAt = Date.now();
  };
  const timeout = options.timeoutMs ?? 25_000;
  const browser = await puppeteer.launch({ headless: true, args: [...RENDER_BROWSER_ARGS, '--disable-features=HttpsUpgrades,HttpsFirstBalancedModeAutoEnable', ...reach.chromeArgs] });

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

  // Le plan du site cherché PENDANT que l'accueil s'ouvre (l'origine de départ ; relu si une redirection la change).
  const earlySitemap = sitemapUrls(start.origin).catch(() => [] as string[]);
  try {
    // L'accueil d'abord : son menu et son pied de page disent quelles pages comptent, et la page dit sa technologie.
    const opened = await openForCrawl(browser, start.toString(), timeout);
    const homePage = opened.page;
    phase('ouverture');
    const signals = await homePage.evaluate(detectInPage, TECHNOLOGIES).catch(() => null);
    phase('détection');
    const profile: TechProfile = profileOf(
      signals ?? { matched: [], strong: [], hashRouting: false, shadowHosts: 0, iframeSrc: '', canvasOnly: false, botWall: false, textLength: 0, clickOnlyNav: 0, routes: [] },
      detectFromHeaders(opened.headers),
      opened.initialText
    );
    const { strategy } = profile;
    const adaptations: string[] = [];
    logger.info('site.crawl_technology', { event: 'site.crawl_technology', url: start.toString(), family: profile.family, technologies: profile.technologies.map((t) => t.name).slice(0, 8), strategy });

    // Un mur anti-robot resté en place : le dire, plutôt que de relever l'écran d'attente comme une page du site.
    if ((signals?.botWall || (await isWallPage(homePage))) && (await isWallPage(homePage))) {
      await homePage.close();
      throw new Error('bot_protection');
    }

    // Le site est dans un iframe (constructeurs, cadres hérités) : c'est lui qu'on relève, une fois.
    if (strategy.followIframe && !options.followedFrom && (await isRenderUrlAllowed(strategy.followIframe))) {
      await homePage.close();
      await browser.close().catch(() => undefined);
      const inner = await crawlWebsite({ ...options, url: strategy.followIframe, followedFrom: start.toString() });
      inner.technology = { ...(inner.technology ?? { family: profile.family, names: [], adaptations: [] }), adaptations: [...(inner.technology?.adaptations ?? []), 'site lu dans son iframe'] };
      return inner;
    }

    if (strategy.flattenShadowDom) {
      await homePage.evaluate(FLATTEN_SHADOW_SCRIPT).catch(() => 0);
      adaptations.push('Shadow DOM recopié');
    }
    const origin = new URL(homePage.url()).origin;
    inventory.origin = origin;
    const keepHash = strategy.keepHashRoutes;
    if (keepHash) adaptations.push('routes en #/');
    let home: PageRead = await readSafely(homePage);
    phase('lecture accueil');
    // Dessinée dans un canvas : arbre d'accessibilité de Flutter, sinon captures lues par le modèle de vision.
    if (strategy.visionFallback) {
      const drawn = await readCanvasPage(homePage, options.vision);
      if (drawn) {
        home = drawn.read;
        adaptations.push(drawn.via === 'accessibility' ? 'arbre d’accessibilité de Flutter lu' : 'page lue par vision (canvas)');
      }
    }
    const homeUrl = pageUrl(homePage.url(), origin, keepHash) ?? start.toString();
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
    const otherLanguageUrls = new Set(home.alternates.filter((a) => a.href && others.has(a.lang)).map((a) => pageUrl(a.href, origin, keepHash)).filter(Boolean) as string[]);
    const inOtherLanguage = (u: string) => {
      if (otherLanguageUrls.has(u)) return true;
      const url = new URL(u);
      const prefix = url.pathname.split('/')[1]?.toLowerCase().replace(/[-_][a-z]{2}$/, '') ?? '';
      const query = url.searchParams.get('lang')?.slice(0, 2).toLowerCase() ?? '';
      return (prefix.length === 2 && others.has(prefix)) || (!!query && others.has(query));
    };

    const ordered: string[] = [homeUrl];
    phase('langues');
    // L'adresse telle que le site l'écrit (`/projets`, sans la barre finale ajoutée ici) : c'est elle que le routeur
    // d'une application reconnaît.
    const rawOf = new Map<string, string>();
    const add = (raw: string, label = '') => {
      const u = pageUrl(raw, origin, keepHash);
      if (!u || inOtherLanguage(u)) return;
      if (!rawOf.has(u)) rawOf.set(u, raw);
      if (label && !labels.has(u)) labels.set(u, label);
      if (!ordered.includes(u)) ordered.push(u);
    };
    home.navigation.forEach((l) => add(l.href, l.label));
    home.footerLinks.forEach((l) => add(l.href, l.label));
    // Les sources de pages qui ne dépendent pas des liens, en parallèle : plan du site, API de WordPress, menu par clic.
    const [sitemap, wpPages, clicked] = await Promise.all([
      origin === start.origin ? earlySitemap : sitemapUrls(origin),
      strategy.wordpressApi ? wordpressPages(origin) : Promise.resolve([]),
      strategy.clickDiscovery ? discoverByClick(browser, homeUrl, Math.min(timeout, 20_000), home.language || 'fr', strategy.settleMs, strategy.flattenShadowDom).catch(() => []) : Promise.resolve([]),
    ]);
    phase('découverte (plan, API, clics)');
    // Le menu ouvert par clic passe en tête, comme un menu ordinaire ; ses pages sont déjà lues.
    const preRead = new Map<string, PageRead>();
    clicked.forEach((l) => {
      add(l.href, l.label);
      const u = pageUrl(l.href, origin, keepHash);
      if (u && l.read) preRead.set(u, l.read);
    });
    if (clicked.length) adaptations.push(`${clicked.length} page(s) trouvée(s) en cliquant le menu`);
    wpPages.forEach((l) => add(l.href, l.label));
    if (wpPages.length) adaptations.push('pages listées par l’API de WordPress');
    sitemap.forEach((u) => add(u));
    // Les routes déclarées par le framework (Next.js, Vue, Nuxt) : des pages qu'aucun lien ne montre forcément.
    strategy.declaredRoutes.forEach((path) => add(new URL(path, origin).href));
    if (strategy.declaredRoutes.length) adaptations.push('routes déclarées par le framework');
    home.links.forEach((l) => add(l.href, l.label));
    const homeSignature = `${home.title}|${home.blocks.map((b) => b.headings[0] ?? '').join('|')}`;

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
          const pageTimeout = Math.min(timeout, 20_000);
          const signatureOf = (r: PageRead) => `${r.title}|${r.blocks.map((b) => b.headings[0] ?? '').join('|')}`;
          // Presque rien à lire : moins de 60 signes ET aucune image (une galerie n'a parfois que des images).
          const thin = (r: PageRead) => r.blocks.reduce((n, b) => n + [...b.headings, ...b.texts, ...b.items].join(' ').length, 0) < 60 && !r.blocks.some((b) => b.images.length);
          // Adresse profonde refusée (404 d'un hébergement statique), page vide, ou l'accueil servi à la place : dans
          // une application, la page existe par sa navigation. Sinon, ce n'est pas une page du site.
          // Déjà lue pendant la découverte par clic : rien à rouvrir.
          let read: PageRead;
          let status = 200;
          const known = preRead.get(url);
          if (known && !thin(known) && signatureOf(known) !== homeSignature) {
            read = known;
          } else {
            const first = await openForCrawl(browser, url, pageTimeout, home.language || 'fr', strategy.settleMs);
            if (strategy.flattenShadowDom) await first.page.evaluate(FLATTEN_SHADOW_SCRIPT).catch(() => 0);
            read = await readSafely(first.page);
            status = first.status;
            await first.page.close();
          }
          if (status >= 400 || thin(read) || signatureOf(read) === homeSignature) {
            if (!strategy.inAppNavigation) {
              reads.delete(url);
              done += 1;
              continue;
            }
            const opened = await openInApp(browser, homeUrl, rawOf.get(url) ?? url, pageTimeout, home.language || 'fr', strategy.settleMs);
            if (strategy.flattenShadowDom) await opened.page.evaluate(FLATTEN_SHADOW_SCRIPT).catch(() => 0);
            read = await readSafely(opened.page);
            await opened.page.close();
            if (thin(read) || signatureOf(read) === homeSignature) {
              reads.delete(url);
              done += 1;
              continue;
            }
            if (!adaptations.includes('pages ouvertes par la navigation de l’application')) adaptations.push('pages ouvertes par la navigation de l’application');
          }
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
    // Six onglets à la fois (polices, médias et suivi coupés : une page s'ouvre vite, le relevé tient la charge).
    await Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]);

    phase('autres pages');
    inventory.language = mainLanguage;
    inventory.languages = [
      { code: mainLanguage, url: homeUrl, via: home.language ? 'html' : 'path' },
      ...[...others].map((code) => {
        const alt = home.alternates.find((a) => a.lang === code);
        return alt ? { code, ...(alt.href ? { url: alt.href } : {}), via: alt.via } : { code, via: 'path' as const };
      }),
    ];
    inventory.navigation = home.navigation.filter((l, i, all) => all.findIndex((x) => x.href === l.href) === i);
    inventory.headerActions = (home.headerActions ?? []).filter((l) => !inventory.navigation.some((n) => n.label === l.label && n.href === l.href));
    inventory.footer = { texts: home.footerTexts, links: home.footerLinks.filter((l) => l.label).slice(0, 40) };
    inventory.assets.favicon = home.favicon || undefined;
    inventory.assets.appleIcon = home.appleIcon || undefined;
    inventory.assets.ogImage = home.ogImage || undefined;
    inventory.contact.addresses = home.addresses;

    // L'ordre des pages : celui du menu (l'accueil en tête), puis le reste. Une page technique presque vide
    // (reçu, lien expiré, confirmation) que ni le menu ni le pied de page ne citent n'est pas une page du site.
    const linked = new Set([...home.navigation, ...home.footerLinks, ...clicked].map((l) => pageUrl(l.href, origin, keepHash)).filter(Boolean));
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
      // Une route en `#/services` : son chemin est `/services/` dans le nouveau site.
      const routePath = keepHash && /^#!?\//.test(u.hash) ? `${u.hash.replace(/^#!?/, '').split('?')[0].replace(/\/?$/, '/')}` : u.pathname;
      // Les images en pleine taille (vignettes de Wix, Squarespace, Shopify, WordPress, `/_next/image`…).
      // L'adresse devinée peut ne pas exister (miniature WordPress sans original) : l'adresse lue reste en secours.
      for (const block of read.blocks)
        for (const image of block.images) {
          const original = originalImageUrl(image.url);
          if (original !== image.url && !image.fallback) image.fallback = image.url;
          image.url = original;
        }
      const page: InventoryPage = {
        url,
        path: pageIndex === 0 ? '/' : routePath,
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
    if (inventory.assets.ogImage) inventory.assets.ogImage = originalImageUrl(inventory.assets.ogImage);
    inventory.technology = { family: profile.family, names: profile.technologies.map((t) => t.name).slice(0, 12), adaptations };
    phase('assemblage');
    logger.info('site.crawl_done', { event: 'site.crawl_done', url: start.toString(), pages: inventory.pages.length, family: profile.family, adaptations, phases });
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
