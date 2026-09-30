# @idem/shared-seo

La source unique du référencement d'IDEM : l'organisation, la promesse
(« Créer et lancer un business rentable »), les services et leur place dans
le parcours, les graphes JSON-LD qui les relient d'un domaine à l'autre, et
l'adresse des images de partage.

Le fonctionnement complet est dans [`docs/SEO.md`](../../docs/SEO.md).

```ts
import { buildPageGraph, ogImageUrl, SERVICES } from '@idem/shared-seo';
```

- Landing : importé au runtime (`SeoService`).
- Console, simulateur, iCode, iDeploy : leur `<head>`, `robots.txt` et
  `sitemap.xml` sont générés par `npm run seo:sync` (racine du dépôt) ;
  `npm run seo:check` échoue s'ils ont dérivé.
