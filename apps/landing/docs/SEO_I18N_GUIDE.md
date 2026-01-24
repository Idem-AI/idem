# Guide SEO Multilingue avec Angular Localize

## 📋 Vue d'ensemble

Ce guide explique comment le SEO multilingue est configuré pour la landing page IDEM avec Angular Localize. Le système génère automatiquement des versions anglaise et française du site avec un référencement optimal.

## 🌍 Architecture SEO Multilingue

### Structure des URLs

```
https://idem.africa/
├── en/                    # Version anglaise (défaut)
│   ├── home
│   ├── about
│   ├── pricing
│   └── ...
└── fr/                    # Version française
    ├── home
    ├── about
    ├── pricing
    └── ...
```

### Fichiers de configuration

#### 1. **robots.txt** (`src/robots.txt`)

```txt
User-agent: *
Allow: /
Disallow: /api/
Disallow: /assets/private/

# Allow localized content
Allow: /en/
Allow: /fr/

# Sitemap locations (multilingual)
Sitemap: https://idem.africa/sitemap.xml
Sitemap: https://idem.africa/sitemap-en.xml
Sitemap: https://idem.africa/sitemap-fr.xml
```

#### 2. **Sitemaps**

**Sitemap principal** (`public/assets/sitemap.xml`) :

```xml
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://idem.africa/sitemap-en.xml</loc>
    <lastmod>2025-01-11</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://idem.africa/sitemap-fr.xml</loc>
    <lastmod>2025-01-11</lastmod>
  </sitemap>
</sitemapindex>
```

**Sitemap par langue** (`public/assets/sitemap-en.xml`, `sitemap-fr.xml`) :

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

#### 3. **index.html** - Balises hreflang

```html
<!-- Canonical and Alternate Language Links -->
<link rel="canonical" href="https://idem.africa/en/" />
<link rel="alternate" hreflang="en" href="https://idem.africa/en/" />
<link rel="alternate" hreflang="fr" href="https://idem.africa/fr/" />
<link rel="alternate" hreflang="x-default" href="https://idem.africa/en/" />

<!-- Open Graph Locale -->
<meta property="og:locale" content="en_US" />
<meta property="og:locale:alternate" content="fr_FR" />
```

## 🛠️ Utilisation du SeoService

### Service amélioré

Le `SeoService` a été amélioré pour gérer automatiquement l'internationalisation :

```typescript
import { SeoService } from '@app/shared/services/seo.service';

export class MyPageComponent implements OnInit {
  private readonly seo = inject(SeoService);

  ngOnInit(): void {
    // Méthode complète recommandée
    this.seo.setupPageSeo({
      title: 'IDEM - About Us',
      description: "Learn about IDEM, Africa's first sovereign AI platform",
      path: '/about',
      keywords: 'African AI, open source, sovereign technology',
      ogImage: 'https://idem.africa/assets/seo/about-og.jpg',
      ogType: 'website',
    });
  }
}
```

### Méthodes disponibles

#### `setupPageSeo(config)` - **Recommandé**

Configure automatiquement tout le SEO d'une page :

- Title et meta description
- Open Graph tags (og:title, og:description, og:url, og:image, og:locale)
- Twitter Card tags
- Canonical URL avec locale
- Balises hreflang pour toutes les langues
- Keywords (optionnel)

```typescript
this.seo.setupPageSeo({
  title: 'Page Title',
  description: 'Page description',
  path: '/current-page', // Optionnel
  keywords: 'keyword1, keyword2', // Optionnel
  ogImage: 'https://...', // Optionnel
  ogType: 'website', // Optionnel (défaut: 'website')
});
```

#### `getCurrentLocale()` - Obtenir la locale actuelle

```typescript
const locale = this.seo.getCurrentLocale(); // 'en' ou 'fr'
```

#### `setCanonicalUrl(path)` - URL canonique

```typescript
// Génère automatiquement: https://idem.africa/{locale}/about
this.seo.setCanonicalUrl('/about');
```

#### `setHreflangLinks(path)` - Balises hreflang

```typescript
// Génère les liens hreflang pour toutes les langues
this.seo.setHreflangLinks('/about');
// Résultat:
// <link rel="alternate" hreflang="en" href="https://idem.africa/en/about" />
// <link rel="alternate" hreflang="fr" href="https://idem.africa/fr/about" />
// <link rel="alternate" hreflang="x-default" href="https://idem.africa/en/about" />
```

#### `updateOgLocale()` - Locale Open Graph

```typescript
// Met à jour og:locale selon la langue actuelle
this.seo.updateOgLocale();
// EN: og:locale="en_US", og:locale:alternate="fr_FR"
// FR: og:locale="fr_FR", og:locale:alternate="en_US"
```

## 📝 Exemple complet

```typescript
import { Component, OnInit, inject } from '@angular/core';
import { SeoService } from '@app/shared/services/seo.service';

@Component({
  selector: 'app-pricing',
  standalone: true,
  templateUrl: './pricing-page.html',
})
export class PricingPage implements OnInit {
  private readonly seo = inject(SeoService);

  ngOnInit(): void {
    // Configuration SEO complète en une seule ligne
    this.seo.setupPageSeo({
      title: 'IDEM - Pricing Plans | Freemium AI Platform',
      description:
        "Discover IDEM's transparent pricing. Start free with 100 credits, upgrade to Premium for unlimited access. No hidden fees, cancel anytime.",
      path: '/pricing',
      keywords: 'IDEM pricing, AI platform cost, freemium SaaS, African startup tools',
      ogImage: 'https://idem.africa/assets/seo/pricing-og.jpg',
      ogType: 'website',
    });
  }
}
```

## 🔍 Vérification SEO

### Outils de test

1. **Google Search Console** : Soumettre les sitemaps
   - https://idem.africa/sitemap.xml
   - https://idem.africa/sitemap-en.xml
   - https://idem.africa/sitemap-fr.xml

2. **Test hreflang** : https://technicalseo.com/tools/hreflang/

3. **Rich Results Test** : https://search.google.com/test/rich-results

4. **Structured Data Testing Tool** : https://validator.schema.org/

### Checklist SEO par page

- [ ] Title unique et descriptif (50-60 caractères)
- [ ] Meta description (150-160 caractères)
- [ ] URL canonique avec locale (`/en/page` ou `/fr/page`)
- [ ] Balises hreflang pour EN et FR
- [ ] Open Graph tags (title, description, url, image, locale)
- [ ] Twitter Card tags
- [ ] Structured Data (JSON-LD) si applicable
- [ ] Keywords pertinents (optionnel)

## 🌐 Bonnes pratiques

### 1. Contenu traduit

Assurez-vous que tout le contenu est traduit avec `@angular/localize` :

```html
<!-- ❌ Mauvais -->
<h1>Welcome to IDEM</h1>

<!-- ✅ Bon -->
<h1 i18n="@@home.hero.title">Welcome to IDEM</h1>
```

### 2. Images et assets

Utilisez des URLs absolues pour les images OG :

```typescript
ogImage: 'https://idem.africa/assets/seo/og-image.jpg'; // ✅ Bon
ogImage: '/assets/seo/og-image.jpg'; // ❌ Mauvais
```

### 3. Structured Data

Ajoutez des données structurées pour améliorer le référencement :

```typescript
const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'IDEM Pricing',
  description: 'Transparent pricing for IDEM AI platform',
  url: `${this.seo.domain}/${this.seo.getCurrentLocale()}/pricing`,
  inLanguage: this.seo.getCurrentLocale(),
};

const script = document.createElement('script');
script.type = 'application/ld+json';
script.text = JSON.stringify(structuredData);
document.head.appendChild(script);
```

### 4. Mise à jour des sitemaps

Lors de l'ajout d'une nouvelle page :

1. Ajouter la route dans `app.routes.ts`
2. Mettre à jour `sitemap-en.xml` et `sitemap-fr.xml`
3. Mettre à jour la date `<lastmod>` dans les sitemaps
4. Tester avec `npm run build:all-locales`

## 🚀 Déploiement

### Build production

```bash
# Build toutes les locales
npm run build:all-locales

# Résultat :
dist/landing/browser/
├── en/           # Version anglaise
│   ├── index.html
│   └── ...
└── fr/           # Version française
    ├── index.html
    └── ...
```

### Configuration serveur

Le serveur doit servir les deux versions :

```nginx
# Nginx example
server {
  server_name idem.africa;
  root /var/www/idem/dist/landing/browser;

  # Redirection racine vers /en/
  location = / {
    return 302 /en/;
  }

  # Servir les versions localisées
  location /en/ {
    try_files $uri $uri/ /en/index.html;
  }

  location /fr/ {
    try_files $uri $uri/ /fr/index.html;
  }

  # Assets statiques
  location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
}
```

## 📊 Monitoring

### Métriques à suivre

1. **Google Search Console**
   - Impressions par langue
   - CTR par locale
   - Erreurs hreflang

2. **Google Analytics**
   - Trafic par langue (`/en/*` vs `/fr/*`)
   - Taux de rebond par locale
   - Conversions par langue

3. **Core Web Vitals**
   - LCP, FID, CLS par locale
   - Performance SSR

## 🆘 Dépannage

### Problème : Balises hreflang en double

**Solution** : Le service supprime automatiquement les balises existantes avant d'en créer de nouvelles.

### Problème : Canonical URL incorrecte

**Solution** : Vérifier que `environment.services.domain` est correct :

```typescript
// environment.ts
export const environment = {
  services: {
    domain: 'https://idem.africa', // Sans trailing slash
  },
};
```

### Problème : Sitemap non trouvé

**Solution** : Vérifier que les sitemaps sont dans `public/assets/` et non `src/assets/`.

## 📚 Ressources

- [Google Multilingual SEO Guide](https://developers.google.com/search/docs/specialty/international)
- [Hreflang Best Practices](https://developers.google.com/search/docs/specialty/international/localized-versions)
- [Angular Localize Documentation](https://angular.dev/guide/i18n)
- [Schema.org Documentation](https://schema.org/)

---

**Dernière mise à jour** : 11 janvier 2025  
**Auteur** : Équipe IDEM
