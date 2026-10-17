import { DOCUMENT } from '@angular/common';
import { Injectable, LOCALE_ID, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import {
  IDEM,
  LANDING_PAGES,
  OG_IMAGE_SIZE,
  OG_LOCALE,
  SEO_LOCALES,
  brandedTitle,
  buildPageGraph,
  jsonLdString,
  landingUrl,
  ogImageUrl,
  type LandingPageId,
  type SeoLocale,
} from '@idem/shared-seo';
import { environment } from '../../../environments/environment';
import { pageSeoText } from '../seo/page-seo';
import type { BlogPost } from '../models/blog.model';

/**
 * Le référencement du landing, piloté par le routeur.
 *
 * Chaque route déclare sa page (`data: { seo: 'pricing' }`) ; à chaque
 * navigation — y compris pendant le prérendu, ce qui écrit tout dans le HTML
 * servi aux robots — ce service pose le titre, la description, l'URL
 * canonique, les alternatives de langue, les balises de partage (image dans la
 * langue de la page) et UN graphe JSON-LD qui rattache la page à IDEM et à ses
 * services (`@idem/shared-seo`). Les pages n'ont plus rien à écrire.
 */
@Injectable({
  providedIn: 'root',
})
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly localeId = inject(LOCALE_ID);
  private readonly router = inject(Router);
  /** Le document du serveur pendant le prérendu, celui du navigateur ensuite. */
  private readonly doc = inject(DOCUMENT);
  public readonly domain = environment.services.domain;

  /** La langue de la page : celle du build (`/fr/…` ou `/en/…`). */
  locale(): SeoLocale {
    return (this.localeId || '').toLowerCase().startsWith('fr') ? 'fr' : 'en';
  }

  /** À appeler une fois au démarrage (`provideAppInitializer`). */
  init(): void {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.apply(this.currentPage()));
  }

  private currentPage(): LandingPageId {
    let route: ActivatedRouteSnapshot = this.router.routerState.snapshot.root;
    while (route.firstChild) route = route.firstChild;
    return (route.data['seo'] as LandingPageId | undefined) ?? 'not-found';
  }

  apply(id: LandingPageId): void {
    const locale = this.locale();
    const page = LANDING_PAGES[id];
    const text = pageSeoText(id, locale);
    const url = landingUrl(page.path, locale);
    const title = brandedTitle(text.title);
    const image = ogImageUrl(page.og, locale);
    const other = SEO_LOCALES.find((l) => l !== locale) ?? 'en';

    this.title.setTitle(title);
    this.name('description', text.description);
    this.name(
      'robots',
      text.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1',
    );

    this.property('og:type', 'website');
    this.property('og:site_name', IDEM.name);
    this.property('og:url', url);
    this.property('og:title', title);
    this.property('og:description', text.description);
    this.property('og:image', image);
    this.property('og:image:secure_url', image);
    this.property('og:image:type', 'image/png');
    this.property('og:image:width', String(OG_IMAGE_SIZE.width));
    this.property('og:image:height', String(OG_IMAGE_SIZE.height));
    this.property('og:image:alt', text.imageAlt);
    this.property('og:locale', OG_LOCALE[locale]);
    this.property('og:locale:alternate', OG_LOCALE[other]);

    this.name('twitter:card', 'summary_large_image');
    this.name('twitter:site', IDEM.twitter);
    this.name('twitter:title', title);
    this.name('twitter:description', text.description);
    this.name('twitter:image', image);
    this.name('twitter:image:alt', text.imageAlt);

    this.links(text.noindex ? null : page.path, url);

    const breadcrumbs =
      id === 'home'
        ? undefined
        : [
            { name: IDEM.name, url: landingUrl('', locale) },
            { name: text.crumb, url },
          ];
    this.jsonLd(
      jsonLdString(
        buildPageGraph({
          locale,
          url,
          title,
          description: text.description,
          image,
          imageAlt: text.imageAlt,
          about: page.about,
          site: 'idem',
          pageType: page.pageType,
          breadcrumbs,
          faq: text.faq,
        }),
      ),
    );
  }

  /**
   * Le référencement d'un billet de blog, connu seulement une fois le billet
   * lu : il remplace ce que `apply('blog')` avait posé à la navigation.
   *
   * Un billet n'existe que dans sa langue : pas d'alternative `hreflang` vers
   * une traduction qui n'existe peut-être pas, et l'image de partage est sa
   * couverture, à défaut celle du blog.
   */
  applyPost(post: BlogPost): void {
    const locale = this.locale();
    const path = `/blog/${post.slug}`;
    const url = landingUrl(path, locale);
    const title = brandedTitle(post.title);
    const fallback = ogImageUrl(LANDING_PAGES['blog'].og, locale);
    const image = post.coverUrl?.startsWith('http') ? post.coverUrl : fallback;
    const imageAlt = post.coverAlt || post.title;

    this.title.setTitle(title);
    this.name('description', post.excerpt);
    this.name('robots', 'index, follow, max-image-preview:large, max-snippet:-1');

    this.property('og:type', 'article');
    this.property('og:site_name', IDEM.name);
    this.property('og:url', url);
    this.property('og:title', title);
    this.property('og:description', post.excerpt);
    this.property('og:image', image);
    this.property('og:image:secure_url', image);
    this.property('og:image:alt', imageAlt);
    this.property('og:locale', OG_LOCALE[locale]);
    this.property('article:published_time', post.publishedAt);
    this.property('article:modified_time', post.updatedAt);

    this.name('twitter:card', 'summary_large_image');
    this.name('twitter:title', title);
    this.name('twitter:description', post.excerpt);
    this.name('twitter:image', image);
    this.name('twitter:image:alt', imageAlt);

    this.links(path, url, [locale]);

    this.jsonLd(
      jsonLdString(
        buildPageGraph({
          locale,
          url,
          title,
          description: post.excerpt,
          image,
          imageAlt,
          about: 'platform',
          site: 'idem',
          pageType: 'WebPage',
          breadcrumbs: [
            { name: IDEM.name, url: landingUrl('', locale) },
            { name: pageSeoText('blog', locale).crumb, url: landingUrl('/blog', locale) },
            { name: post.title, url },
          ],
          article: {
            headline: post.title,
            datePublished: post.publishedAt,
            dateModified: post.updatedAt,
            authorName: post.authorName,
            tags: post.tags,
          },
        }),
      ),
    );
  }

  private name(name: string, content: string): void {
    this.meta.updateTag({ name, content });
  }

  private property(property: string, content: string): void {
    this.meta.updateTag({ property, content });
  }

  /** L'URL canonique et les versions de la page dans chaque langue. */
  private links(path: string | null, url: string, locales: readonly SeoLocale[] = SEO_LOCALES): void {
    const head = this.doc.head;
    head.querySelectorAll('link[rel="canonical"], link[rel="alternate"][hreflang]').forEach((l) => l.remove());
    if (path === null) return;

    const add = (attrs: Record<string, string>) => {
      const link = this.doc.createElement('link');
      Object.entries(attrs).forEach(([k, v]) => link.setAttribute(k, v));
      head.appendChild(link);
    };
    add({ rel: 'canonical', href: url });
    locales.forEach((l) => add({ rel: 'alternate', hreflang: l, href: landingUrl(path, l) }));
    // Une seule langue : elle est aussi la valeur par défaut.
    add({ rel: 'alternate', hreflang: 'x-default', href: landingUrl(path, locales.includes('en') ? 'en' : locales[0]) });
  }

  /** Un seul graphe par page, remplacé à chaque navigation. */
  private jsonLd(json: string): void {
    let script = this.doc.getElementById('idem-jsonld');
    if (!script) {
      script = this.doc.createElement('script');
      script.setAttribute('type', 'application/ld+json');
      script.id = 'idem-jsonld';
      this.doc.head.appendChild(script);
    }
    script.textContent = json;
  }
}
