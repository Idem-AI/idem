import { Injectable, inject, LOCALE_ID } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';

export interface HreflangLink {
  hreflang: string;
  href: string;
}

@Injectable({
  providedIn: 'root',
})
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly localeId = inject(LOCALE_ID);
  public readonly domain = environment.services.domain;

  /**
   * Supported locales for the application
   */
  private readonly supportedLocales = ['en', 'fr'];

  /**
   * Get the current locale from Angular's LOCALE_ID
   */
  getCurrentLocale(): string {
    return this.localeId || 'en';
  }

  /**
   * Update page title
   */
  updateTitle(title: string): void {
    this.title.setTitle(title);
  }

  /**
   * Update meta tags
   */
  updateMetaTags(metaTags: { name: string; content: string }[]): void {
    metaTags.forEach((tag) => this.meta.updateTag(tag));
  }

  /**
   * Update Open Graph tags
   */
  updateOgTags(ogTags: { property: string; content: string }[]): void {
    ogTags.forEach((tag) => this.meta.updateTag(tag));
  }

  /**
   * Set canonical URL for the current page
   */
  setCanonicalUrl(path = ''): void {
    const currentLocale = this.getCurrentLocale();
    const linkElement: HTMLLinkElement | null = document.querySelector('link[rel="canonical"]');
    const canonicalUrl = `${this.domain}/${currentLocale}${path}`;

    if (linkElement) {
      linkElement.href = canonicalUrl;
    } else {
      const newLinkElement = document.createElement('link');
      newLinkElement.setAttribute('rel', 'canonical');
      newLinkElement.setAttribute('href', canonicalUrl);
      document.head.appendChild(newLinkElement);
    }
  }

  /**
   * Set hreflang links for multilingual SEO
   * @param path - The current page path (e.g., '/home', '/about')
   */
  setHreflangLinks(path = ''): void {
    // Remove existing hreflang links
    const existingLinks = document.querySelectorAll('link[rel="alternate"][hreflang]');
    existingLinks.forEach((link) => link.remove());

    // Add hreflang links for each supported locale
    this.supportedLocales.forEach((locale) => {
      const link = document.createElement('link');
      link.setAttribute('rel', 'alternate');
      link.setAttribute('hreflang', locale);
      link.setAttribute('href', `${this.domain}/${locale}${path}`);
      document.head.appendChild(link);
    });

    // Add x-default hreflang (points to English as default)
    const defaultLink = document.createElement('link');
    defaultLink.setAttribute('rel', 'alternate');
    defaultLink.setAttribute('hreflang', 'x-default');
    defaultLink.setAttribute('href', `${this.domain}/en${path}`);
    document.head.appendChild(defaultLink);
  }

  /**
   * Update Open Graph locale tags
   */
  updateOgLocale(): void {
    const currentLocale = this.getCurrentLocale();
    const ogLocale = currentLocale === 'fr' ? 'fr_FR' : 'en_US';
    const alternateLocale = currentLocale === 'fr' ? 'en_US' : 'fr_FR';

    this.meta.updateTag({ property: 'og:locale', content: ogLocale });
    this.meta.updateTag({ property: 'og:locale:alternate', content: alternateLocale });
  }

  /**
   * Complete SEO setup for a page
   * @param config - SEO configuration object
   */
  setupPageSeo(config: {
    title: string;
    description: string;
    path?: string;
    keywords?: string;
    ogImage?: string;
    ogType?: string;
  }): void {
    const path = config.path || '';

    // Update title
    this.updateTitle(config.title);

    // Update meta tags
    const metaTags = [
      { name: 'description', content: config.description },
      ...(config.keywords ? [{ name: 'keywords', content: config.keywords }] : []),
    ];
    this.updateMetaTags(metaTags);

    // Update Open Graph tags
    const ogTags = [
      { property: 'og:title', content: config.title },
      { property: 'og:description', content: config.description },
      { property: 'og:url', content: `${this.domain}/${this.getCurrentLocale()}${path}` },
      { property: 'og:type', content: config.ogType || 'website' },
      ...(config.ogImage
        ? [
            { property: 'og:image', content: config.ogImage },
            { property: 'og:image:alt', content: config.title },
          ]
        : []),
    ];
    this.updateOgTags(ogTags);

    // Update Twitter tags
    this.meta.updateTag({ name: 'twitter:title', content: config.title });
    this.meta.updateTag({ name: 'twitter:description', content: config.description });
    if (config.ogImage) {
      this.meta.updateTag({ name: 'twitter:image', content: config.ogImage });
    }

    // Set canonical URL
    this.setCanonicalUrl(path);

    // Set hreflang links
    this.setHreflangLinks(path);

    // Update OG locale
    this.updateOgLocale();
  }
}
