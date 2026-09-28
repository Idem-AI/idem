# Multilingual SEO

How search engine optimisation works for the English and French versions of the landing site. Translations themselves are covered in [I18N.md](I18N.md).

## URL structure

```
https://idem.africa/
├── en/          English
│   ├── home
│   ├── about
│   ├── pricing
│   └── …
└── fr/          French (also served at the root)
    ├── home
    └── …
```

## Files

### Sitemaps (`public/`)

- `sitemap.xml`: sitemap index pointing to the two locale sitemaps.
- `sitemap-en.xml`, `sitemap-fr.xml`: one `<url>` per page, each with its `hreflang` alternates:

```xml
<url>
  <loc>https://idem.africa/en/home</loc>
  <xhtml:link rel="alternate" hreflang="en" href="https://idem.africa/en/home" />
  <xhtml:link rel="alternate" hreflang="fr" href="https://idem.africa/fr/home" />
  <xhtml:link rel="alternate" hreflang="x-default" href="https://idem.africa/en/home" />
  <lastmod>2025-01-11</lastmod>
  <changefreq>weekly</changefreq>
  <priority>1.0</priority>
</url>
```

Files in `public/` are served at the site root (`/sitemap.xml`).

### robots.txt

`src/robots.txt` allows everything except `/api/`, `/assets/private/`, JSON files and URLs with a query string, and lists the three sitemaps. It is **not served today** because it is not in `public/`; move it there to publish it.

### `index.html`

Carries the default canonical, `hreflang` and `og:locale` tags. `SeoService` replaces them per page at runtime and during prerendering.

## `SeoService`

`src/app/shared/services/seo.service.ts`. In a page:

```ts
import { Component, OnInit, inject } from '@angular/core';
import { SeoService } from '../../shared/services/seo.service';

@Component({ selector: 'app-pricing', templateUrl: './pricing-page.html' })
export class PricingPage implements OnInit {
  private readonly seo = inject(SeoService);

  ngOnInit(): void {
    this.seo.setupPageSeo({
      title: $localize`:@@pricing.seo.title:IDEM - Pricing`,
      description: $localize`:@@pricing.seo.description:…`,
      path: '/pricing',
      keywords: 'IDEM pricing, AI platform',
      ogImage: 'https://idem.africa/assets/seo/pricing-og.jpg',
      ogType: 'website',
    });
  }
}
```

| Method | Role |
|---|---|
| `setupPageSeo(config)` | **Recommended.** Title, description, Open Graph, Twitter card, canonical, `hreflang`, keywords in one call |
| `getCurrentLocale()` | `'en'` or `'fr'` |
| `setCanonicalUrl(path)` | `https://idem.africa/{locale}{path}` |
| `setHreflangLinks(path)` | `en`, `fr` and `x-default` alternates (existing links are replaced, never duplicated) |
| `updateOgLocale()` | `og:locale` / `og:locale:alternate` for the current locale |
| `updateTitle`, `updateMetaTags`, `updateOgTags` | Lower-level helpers |

The domain comes from `environment.services.domain` (`SERVICES_DOMAIN`, no trailing slash).

## Rules

- Translate SEO titles and descriptions like any other text (`$localize` with an id).
- Use **absolute** URLs for Open Graph images.
- Title 50–60 characters, description 150–160 characters, unique per page.
- Add JSON-LD structured data where it helps (product, organisation, FAQ).

## Adding a page

1. Add the route in `src/app/app.routes.ts` (it is prerendered automatically: `app.routes.server.ts` prerenders `**`).
2. Call `setupPageSeo` in the page.
3. Add the page to `public/sitemap-en.xml` and `public/sitemap-fr.xml`, and update `<lastmod>`.
4. Check with `npm run build:all-locales`.

## Serving

The production image serves `/en/` and `/fr/` from their own prerendered folders, and the French build at `/` (`apps/landing/nginx.conf`). Each locale folder falls back to its own `index.html`.

## Checking

- Google Search Console: submit `sitemap.xml`; watch `hreflang` errors and impressions per locale.
- `hreflang` checker: https://technicalseo.com/tools/hreflang/
- Rich results: https://search.google.com/test/rich-results
- References: [Google multilingual sites](https://developers.google.com/search/docs/specialty/international), [Angular i18n](https://angular.dev/guide/i18n).
