# Sites vitrines iCode : vitesse d'affichage et contrôle (template 1.4)

Ce que le template 1.4 change dans les sites générés par iCode, pourquoi, et ce que ça donne mesuré contre le 1.3.

## Ce qui a changé

| Levier | Où | Effet |
| --- | --- | --- |
| **Polices servies par le site** | `template/scripts/postbuild.mjs` | À la construction, les feuilles Google Fonts sont téléchargées. Leurs fichiers sont servis depuis `dist/assets/fonts/font-<empreinte>.woff2`, avec les `@font-face` écrits dans la page et seulement les alphabets des langues du site. La police du titre et celle du texte sont préchargées. Si le téléchargement échoue, la page garde son lien d'origine. |
| **CSS dans la page** | même script | Une feuille de moins de 40 Ko est écrite dans un `<style>` : une requête bloquante de moins. |
| **Motion allégé** | `template/scripts/motion/vite-plugin.mjs`, `renderEntry` | L'entrée enveloppe la page dans `<LazyMotion features={domMax}>`. À la construction, `motion` devient `m` dans le code du site, et `domMax` devient `domAnimation` si aucune section n'utilise `drag` ou `layout`. Le code écrit ne change pas. Le plugin ne fait rien si une entrée n'a pas `LazyMotion` (site d'avant). |
| **Hydratation différée** | `section-boundary.tsx` (`defer`), `renderPage` | Les sections après la première, et le pied de page, gardent leur HTML pré-rendu. Elles ne s'hydratent qu'à l'approche de l'écran (400 px avant), au repos du navigateur après le chargement, ou au premier contact. Une section déjà visible s'hydrate tout de suite. |
| **Images** | `components/ui/media.tsx` | `srcset` sur Pexels et Unsplash (640 à 1 920 px, au lieu de ~1 880 px pour tous). `fetchpriority="high"` sur l'image `priority`. Ratio 4/3 par défaut si le cadre n'a pas de taille (contre les sauts de mise en page). |
| **Serveur iDeploy** | `ideploy-api/api/docker/build-packs.ts` (`STATIC_NGINX_CONF`) | Compression gzip. Cache d'un an pour les seuls fichiers à empreinte (`assets/x-<hash>.js|css`, polices). HTML toujours revalidé. Pas de brotli : l'image `nginx:alpine` n'a pas le module. |
| **Échecs visibles** | `prerender.mjs` → `postbuild.mjs` → `DeployModal` | Une page non pré-rendue n'est plus un simple `console.warn`. Le HTML final est relu (titre, description, `h1`, texte sans JS, `alt`, canonique, plan du site). Le bilan va dans `.idem/build-report.json` (jamais publié) et s'affiche après publication avec un bouton « Corriger ». `IDEM_BUILD_STRICT=1` fait échouer la construction sur une erreur. |

Le template `nginx.conf` et son `Dockerfile` suivent : même compression et même cache, `npm ci` si un fichier de verrouillage existe, cache npm.

Les dépendances ne changent pas : les empreintes des instantanés restent les mêmes, et il n'y a rien à recuire.

## Mesuré (18/11/2026)

`npm run bench:site` : le même site (deux pages, sept sections, quatre photos Pexels, polices Google), assemblé par le moteur de HEAD et par celui de l'arbre de travail. Chrome est en profil mobile 4G lent de Lighthouse (150 ms, 1,6 Mbit/s, processeur ×4, 412 px). Médiane de 7 visites à cache vide.

| | A : 1.3, ancien serveur | B : 1.4, ancien serveur | C : 1.4, nouveau serveur |
| --- | --- | --- | --- |
| LCP | 5 572 ms | 3 280 ms | **3 164 ms** (−43 %) |
| FCP | 1 492 ms | 916 ms | **816 ms** (−45 %) |
| TBT | 162 ms | 148 ms | **139 ms** (−14 %) |
| CLS | 0 | 0 | 0 |
| Transféré | 1 131 Ko | 1 003 Ko | **636 Ko** (−44 %) |
| dont JS | 445 Ko | 405 Ko | 134 Ko |
| dont images | 492 Ko | 375 Ko | 375 Ko |
| Requêtes | 15 | 13 | 13 |
| 2ᵉ page, cache chaud : LCP | 1 608 ms | 1 176 ms | **1 004 ms** |
| 2ᵉ page : transféré | 253 Ko | 170 Ko | **136 Ko** |
| Erreurs, animations, accordéon différé | 0 / ok / ok | 0 / ok / ok | 0 / ok / ok |

Autres mesures :

- **JS de l'accueil :** 147 210 → 136 180 octets en gzip (−7,5 %).
- **Construction :** +0,45 s en local (le script d'après-construction), plus le téléchargement des polices sur un vrai réseau, non mesuré.
- **Aperçu de l'atelier** (Vite de développement jusqu'au `h1`, 8 essais alternés) : 3,52 s contre 3,59 s. Pas d'écart mesurable : la variation de la machine allait de 2,1 à 5,0 s.

Limites de la mesure :

- **Les tiers sont imités en local.** Google Fonts et Pexels répondent sur les mêmes adresses, et chaque nouveau domaine paie trois allers-retours de connexion.
- **La photo et les polices sont synthétiques.** Les polices sont des octets non décodables pour les deux versions, avec la taille réelle des fichiers Inter.
- **Un seul site d'essai,** dont les cadres d'images ont déjà une taille. Le garde-fou contre les sauts de mise en page (CLS) n'y est donc pas mis à l'épreuve.
- **Pas mesuré dans une WebContainer.** La configuration nginx n'a pas été validée par `nginx -t`, faute d'nginx sur le poste. Le test `build-packs.test.ts` vérifie la règle de cache et la regex entre guillemets.

## Commandes

| | |
| --- | --- |
| `npm run check:site-build` (we-dev-next) | 47 vérifications sans modèle ni réseau : réécriture Motion, polices (dont le repli sans réseau), CSS dans la page, contrôle du HTML, `defer` à l'assemblage, à l'insertion et à la remise en place |
| `npm run bench:site -- --modules <node_modules> [--fonts <dossier inter-*.woff2>] [--runs 7] [--old HEAD]` | le comparatif ci-dessus ; rapport JSON dans `--work` |
