# Référencement d'IDEM

IDEM est **un** produit — créer et lancer un business rentable — dont chaque
service tient une étape. Les services vivent sur des domaines différents et
peuvent servir seuls ; le référencement doit dire les deux à la fois.

| Étape | Service | Domaine | Page de présentation |
| --- | --- | --- | --- |
| 1. Construire le business | IDEM Business | console.idem.africa | idem.africa/{fr,en}/ |
| 2. Tester la rentabilité | IDEM Simulator | simulator.idem.africa | /simulator |
| 3. Bâtir l'application | iCode | appgen.idem.africa | /idev |
| 4. Mettre en ligne | iDeploy | ideploy.idem.africa | /ideploy |

`apps/chart` est hors périmètre.

## Une seule source : `@idem/shared-seo`

`packages/shared-seo/src/` porte tout ce qui est partagé :

- `ecosystem.ts` — l'organisation, la **promesse** (« Créer et lancer un
  business rentable » / « Build and launch a profitable business »), les
  services (nom, domaine, rôle, titre, description, fonctions) et leur ordre ;
- `schema.ts` — les graphes JSON-LD ;
- `og.ts` — les clés et l'adresse des images de partage ;
- `landing.ts` — les pages du landing (chemin, image, sujet, plan du site) ;
- `head.ts` — l'en-tête statique des applications.

### Comment les robots comprennent que ce sont des services d'IDEM

Chaque page, sur chaque domaine, publie le même graphe, relié par des `@id`
stables :

```
Organization  https://idem.africa/#organization
WebSite       https://idem.africa/#website
SoftwareApplication "IDEM"  https://idem.africa/#platform   hasPart → les 4 services
ItemList (le parcours)      https://idem.africa/#workflow   étapes 1 → 4
SoftwareApplication  https://<service>/#app      isPartOf → #platform, publisher → #organization
WebSite              https://<service>/#website  isPartOf → https://idem.africa/#website
WebPage              <url>#webpage               about → le service ou #platform
```

Les balises de partage suivent la même logique : `og:site_name` vaut `IDEM`
partout, et chaque titre porte le nom du service et d'IDEM.

## Le landing (idem.africa)

- Chaque route déclare sa page : `data: { seo: 'pricing' }` (`app.routes.ts`).
- `SeoService` (`shared/services/seo.service.ts`) écoute la navigation et pose
  titre, description, canonique, `hreflang` fr/en/x-default, balises Open
  Graph et X, et **un** `<script id="idem-jsonld">`. Il tourne au prérendu :
  tout est dans le HTML servi.
- Les textes sont dans `shared/seo/page-seo.ts`, traduits par `$localize`
  (clés `seo.*` de `src/locale/messages.fr.json`).
- **Aucune page n'écrit plus de balise ni de JSON-LD elle-même.**
- nginx sert la page prérendue (`<route>/index.html`) avant la coquille CSR.
- L'accueil vit à `/fr/` et `/en/` ; `/home` redirige.

Ajouter une page : une entrée dans `LANDING_PAGES` (`landing.ts`), un `case`
dans `page-seo.ts` avec ses traductions, `data.seo` sur la route, puis
`npm run seo:sync` (plans du site).

## Les applications (console, simulateur, iCode, iDeploy)

Elles sont rendues dans le navigateur ; les robots des réseaux sociaux ne
lisent que le HTML servi. Leur `<head>` contient donc un bloc **généré**,
entre `<!-- idem-seo:start … -->` et `<!-- idem-seo:end -->`, ainsi que
`public/robots.txt` (seule l'entrée publique est indexée) et
`public/sitemap.xml`.

```bash
npm run seo:sync    # réécrit en-têtes, robots.txt et plans du site
npm run seo:check   # échoue si quelque chose a dérivé (à mettre en CI)
```

Ne jamais éditer le bloc à la main : modifier `ecosystem.ts`, puis
`npm run seo:sync`. L'en-tête statique est en français (public d'abord
francophone, pas de préfixe de langue dans ces URL) ; `lang` suit le cookie
`idem_lang` pour les lecteurs d'écran.

## Les images de partage (Open Graph)

Servies par l'API, à la demande, dans la langue de la page :

```
https://api.idem.africa/og/<fr|en>/<clé>.png    l'image 1200 × 630
https://api.idem.africa/og/<fr|en>/<clé>.html   le même document, à retoucher
```

`idem.africa/fr/pricing` annonce `…/og/fr/pricing.png`,
`idem.africa/en/pricing` annonce `…/og/en/pricing.png`.

Tout se modifie dans `apps/api/public/og/` :

| Fichier | Ce qu'il contient |
| --- | --- |
| `template.html` | la mise en page, en HTML/CSS ordinaire |
| `i18n/fr.json`, `i18n/en.json` | les textes de chaque page (`eyebrow` vide = masqué, comme sur l'accueil où le logo suffit) |
| `illustrations/<clé>.svg` | le dessin de chaque page (règles : `AGENTS.md` § 4, choix : `docs/ILLUSTRATIONS.md`) |

Les images sont **toujours au thème clair**, garanti en code : jetons pris
uniquement dans le bloc `:root, .light` (jamais `.dark`), rendu forcé en
`prefers-color-scheme: light`, `color-scheme: light` dans le gabarit. Ne pas
ajouter de règle sombre au gabarit.

Mise en page : le logo, puis le nom du service, le titre (Vilevile Black,
`--color-secondary-500`) et une phrase ; l'illustration à droite, sans fond ;
le motif au même niveau que sur la home du landing (0,4 × force du motif).

Le gabarit reçoit les jetons du design system lus dans
`packages/shared-styles/styles.css` (thème clair), la police Vilevile, le
motif IDEM (`public/assets/images/motif.png`) et le logo : rien n'y est
recopié à la main.

Retoucher : lancer l'API (`npm run dev:api`), ouvrir
`http://localhost:3001/og/fr/home.html`, modifier, recharger (en
développement les sources sont relues à chaque requête). Pour tout voir d'un
coup : `npm run og:render --workspace=idem-api -- tmp/og`.

Ajouter une image : sa clé dans `OG_KEYS` (`og.ts`), ses textes dans chaque
`i18n/*.json`, son dessin dans `illustrations/`. `npm run seo:check` refuse
une clé à qui il manque l'un des trois.

Cache : les images sont gardées en mémoire, indexées par l'empreinte de leur
HTML (une modification des sources produit une nouvelle image) ; les
réponses portent `ETag` et `Cache-Control: public, max-age=86400`. Facebook
et LinkedIn gardent leur propre copie : après une retouche, forcer la
relecture avec leurs outils de débogage de partage.

L'API répond `robots.txt` : `Allow: /og/`, le reste interdit.
