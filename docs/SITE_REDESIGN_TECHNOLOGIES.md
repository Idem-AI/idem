# Refonte d'un site existant : toutes les technologies (19/11/2026)

Le `/redesign` d'iCode et l'import de site d'iVision utilisent le même moteur (`apps/ivision/core/src/site`), appelé par l'API IDEM (`services/SiteImport`). La différence d'efficacité ressentie entre les deux venait des sites eux-mêmes, pas des deux applications : le relevé était pensé pour un site qui sert du HTML.

## Un seul processus, réglé par la technologie

`site-tech.ts` reconnaît ~230 technologies :

- CMS et CMS headless ;
- constructeurs de pages et de sites ;
- e-commerce ;
- frameworks JavaScript et méta-frameworks ;
- générateurs statiques et sites de documentation ;
- frameworks serveur ;
- moteurs qui dessinent dans un canvas ;
- hébergeurs et protections anti-robot ;
- bandeaux de consentement ;
- traducteurs.

Les signatures portent sur la balise generator, les scripts, les variables globales, le DOM, les en-têtes HTTP et les cookies. Chaque technologie est rattachée à une **famille de rendu** (`server`, `static`, `hybrid`, `spa`, `builder`, `canvas`), et `profileOf` décide en un seul endroit des adaptations ci-dessous.

| Adaptation | Quand | Ce qui cassait |
| --- | --- | --- |
| Routes `#/…` gardées | routes en `#` (Angular `useHash`, anciens Vue et React) | chaque page était l'accueil |
| Pages découvertes en cliquant le menu, lues au clic | application dont le menu est fait de boutons | pages jamais trouvées |
| Pages ouvertes par la navigation de l'application (routeur Next, Vue, Nuxt, `#`, `pushState` + `popstate`) | adresse profonde qui répond 404, page vide, ou accueil servi à la place | hébergement statique sans renvoi : page écartée |
| Shadow DOM recopié | composants web, Lit, Stencil, Ionic | textes invisibles |
| Site suivi dans son iframe | page couverte par un iframe, presque sans texte | relevé vide |
| Arbre d'accessibilité de Flutter, sinon captures lues par le modèle de vision | Flutter web, Unity, page dessinée dans un canvas | rien à lire |
| Attente du mur anti-robot, message clair s'il reste | Cloudflare, DDoS-Guard, Sucuri… | l'écran d'attente relevé comme une page |
| Bandeaux de consentement retirés (relevé ET capture du scan) | OneTrust, Cookiebot, Didomi, Axeptio, tarteaucitron et 15 autres | section « Nous utilisons des cookies », capture de direction artistique couverte |
| Routes déclarées par le framework | Next.js `__BUILD_MANIFEST`, routeurs Vue et Nuxt | pages hors menu manquées |
| API REST de WordPress | WordPress, WooCommerce | pages publiées sans lien manquées |
| Plans du site partout | `robots.txt`, `sitemap_index.xml`, `wp-sitemap.xml`, `sitemap-index.xml`, `sitemap-0.xml`, Gatsby | seul `/sitemap.xml` était lu |
| Images en pleine taille | Wix, Squarespace, Shopify, WordPress, Webflow, Framer, Duda, Ghost, `/_next/image`, Nuxt Image, Contentful, Sanity, Prismic, Storyblok, imgix, Cloudinary | site refait avec des vignettes floues |

Deux autres défauts, qui touchaient **tous** les sites, sont corrigés :

- **Page d'une seule section.** Le robot la découpait en un `<h1>` et un `<p>`, lus « de l'intérieur ». La page ressortait sans contenu, puis était écartée.
- **Pages 404.** Elles étaient relevées comme des pages du site.

Le relevé porte maintenant un champ `technology` (`family`, `names`, `adaptations`), visible aussi dans le journal `site.crawl_technology`.

## Plus rapide

- **Rien d'inutile chargé :** ni polices, ni médias, ni mesure d'audience, ni publicité, ni discussion en direct (`NOISE`, partagé avec le scan). Les images restent : une section faite d'une seule image n'aurait plus de hauteur.
- **Attente plus juste :** on attend que le DOM soit calme (400 ms pour un site serveur, 800 ms pour une application) au lieu d'attendre que le réseau soit au repos. Le défilement est plus rapide.
- **6 onglets** en parallèle au lieu de 4.

## Mesuré (`npm run check:site-crawl -- --compare`, apps/ivision/core)

Neuf sites d'essai servis en local, chacun imitant une famille de technologies :

| Site d'essai | Robot d'avant (git HEAD) | Nouveau |
| --- | --- | --- |
| HTML classique + plan dans `robots.txt` + bandeau de cookies | 4 pages, 6,4 s | **5 pages, 4,8 s**, sans le bandeau |
| Routes en `#/` | 1 page | **4 pages** |
| Menu en boutons, 404 sur les adresses profondes | 1 page | **4 pages** (10,8 s) |
| Shadow DOM | 0 section | **2 sections** |
| Site dans un iframe | 0 section | **5 pages** |
| Next.js à routes non liées | 1 page | **3 pages**, images en pleine taille |
| Mur Cloudflare | l'écran d'attente | **la vraie page** |
| WordPress à pages listées par l'API | 2 pages, 0 section | **4 pages** |
| Unity (canvas) | 0 section | **lu par vision** |

Le contrôle compte 25 vérifications, toutes au vert. Il n'appelle ni le réseau ni un modèle : la vision est simulée.

## Ce qui n'est pas couvert

- **Sites derrière une connexion** (espace client) : le relevé reste anonyme.
- **Mur anti-robot qui exige une action humaine** (captcha) : la refonte s'arrête avec un message qui l'explique.
- **Contenu chargé seulement après une recherche ou un filtre** : seul ce qui s'affiche est relevé.

## Joindre le site, quel que soit le résolveur (21/11/2026)

Le symptôme : « Ce site n'est pas joignable depuis iVision (adresse privée ou inconnue) » pour eknumerik.org, qui était pourtant en ligne. La cause : le résolveur du système (`dns.lookup`, celui de Chrome et de curl, ici la box `192.168.1.1`) répondait `ENOTFOUND`, alors qu'une requête DNS directe donnait `159.69.185.176`. Un nom inconnu du système était traité comme une adresse privée.

Ce qui a changé :

- **`resolveHost`** (`render/network-guard.ts`) interroge dans l'ordre le système, puis une requête DNS directe, puis les résolveurs publics (Cloudflare, Google, Quad9). La garde ne change pas : une adresse privée reste refusée, quelle que soit la voie qui l'a donnée.
  - Utilisée par `isRenderUrlAllowed`, la garde de chaque requête du navigateur.
  - Utilisée par `safeFetch` (logo, photos, polices).
- **`reachSite`** (`site/site-reach.ts`) :
  - résout aussi la variante avec ou sans `www` ;
  - épingle dans Chrome (`--host-resolver-rules`) les noms que le système ne connaît pas ;
  - part de la variante qui existe si l'adresse donnée n'existe pas.
  - Utilisée par `scanWebsite` et `crawlWebsite`.
- **Message.** Un nom qu'aucun serveur DNS ne connaît donne « le nom de domaine … n'existe pas (avec ou sans « www ») : vérifiez son orthographe ». Une adresse privée est dite comme telle.

Contrôle : `npm run check:site-reach -- [url…]` (réseau réel, aucun modèle). Il ouvre la page dans Chrome derrière la garde et recopie une image.
