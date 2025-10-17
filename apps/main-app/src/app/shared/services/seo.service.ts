import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  public readonly domain = environment.services.domain;

  updateTitle(title: string): void {
    this.title.setTitle(title);
  }

  updateMetaTags(metaTags: { name: string; content: string }[]): void {
    metaTags.forEach((tag) => this.meta.updateTag(tag));
  }

  updateOgTags(ogTags: { property: string; content: string }[]): void {
    ogTags.forEach((tag) => this.meta.updateTag(tag));
  }

  setCanonicalUrl(path = ''): void {
    const linkElement: HTMLLinkElement | null = document.querySelector(
      'link[rel="canonical"]'
    );
    const canonicalUrl = `${this.domain}${path}`;

    if (linkElement) {
      linkElement.href = canonicalUrl;
    } else {
      const newLinkElement = document.createElement('link');
      newLinkElement.setAttribute('rel', 'canonical');
      newLinkElement.setAttribute('href', canonicalUrl);
      document.head.appendChild(newLinkElement);
    }
  }
}
