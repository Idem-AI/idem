# iCode : aperçu instantané et génération plus rapide (19/11/2026)

## Aperçu instantané des sites vitrines

**Avant :** l'aperçu passait par une WebContainer. Il fallait démarrer Node dans l'onglet, monter `node_modules` (17 Mo), lancer Vite et esbuild en WebAssembly. Il s'écoulait 14 à 35 s avant la première page, souvent plus que le budget de 20 s (journaux `chat.startup` du 11 au 13/11).

**Maintenant :** l'atelier envoie les fichiers du site au serveur iCode, qui sert directement la page.

| Pièce | Où | Rôle |
| --- | --- | --- |
| Dépendances | `src/preview/engine.ts` (`vendor`) | React, Motion, Radix, Lucide… sont regroupés **une fois** en modules ES par esbuild natif. Ils sont gardés sur disque par empreinte (`APPGEN_DEPS_CACHE_DIR/preview-vendor/`), servis comme immuables et trouvés par un import map. |
| Code | `PreviewSession.build` | Une entrée par page, construction incrémentale. Les imports `@/…` sont résolus dans les fichiers envoyés, et un paquet inconnu donne une erreur claire. |
| Style | `PreviewSession.buildCss` | Tailwind 3 avec la configuration et la feuille du projet, comme à la construction. |
| Page | `routes/preview.ts` | Un document par page, avec titre, langue et polices du design system. Le petit moteur intégré rend la page avec les mêmes réglages que l'entrée du template, puis reprend chaque version annoncée par le flux `events` **sans recharger**. Les liens internes restent dans l'aperçu. |
| Atelier | `we-dev-client/src/utils/fastPreview.ts`, `EditablePreview` | Les fichiers partent par différences, regroupées sur 120 ms. Les erreurs de construction s'affichent dans la bannière « Corriger ». |

Ce qui ne change pas :

- **Le mode Édition** garde la WebContainer : son instrumentation est un plugin Vite.
- **Les applications** (full-stack, mobile) ne passent pas par l'aperçu instantané.
- **La WebContainer** tourne toujours derrière, pour la publication et le terminal.

Si le serveur ne sait pas faire (paquets absents), l'atelier reprend la WebContainer sans rien demander. Pour couper l'aperçu instantané : `PREVIEW_FAST=off` côté serveur, `REACT_APP_FAST_PREVIEW=off` ou `localStorage['idem.fastPreview']='off'` côté atelier.

**Sécurité.** Le code du site ne s'exécute jamais sur le serveur, il y est seulement regroupé. La page est servie avec `Content-Security-Policy: sandbox`, ce qui lui donne une origine opaque : ni cookie, ni stockage du domaine. `frame-ancestors` limite son affichage aux origines de l'atelier. Les écritures exigent la session IDEM, et seul le propriétaire peut modifier sa session. Une session est fermée après 30 min sans activité, et un utilisateur en a 3 au plus.

### Corrigé le 19/11 après le premier essai réel

- **Plantage du serveur.** La route du site était une expression régulière. Le middleware de métriques l'a lue comme un texte (`path.replace is not a function`), et l'exception a fait tomber le processus après chaque page servie. Les dépendances de la page étaient alors refusées (`ERR_CONNECTION_REFUSED`), la génération en cours coupée (`ERR_INCOMPLETE_CHUNKED_ENCODING`), et chaque redémarrage rouvrait une session à froid (4 à 4,5 s). La route a maintenant un chemin écrit (`/s/:id{/*rest}`), le middleware ne peut plus faire tomber le serveur, et `check:preview` monte le vrai middleware de métriques.
- **Préchauffage au démarrage du serveur** (`warmUp`, ~1,1 s) : dépendances, Tailwind et configuration du template sont prêts avant la première session, qui s'ouvre en ~0,4 s.
- **Début de génération.** Tant qu'aucune version n'a été construite, la page affiche « Le site se prépare… ». Une erreur n'est montrée que si elle dure plus de 4 s (6 s pour la bannière « Corriger » de l'atelier). Les noms des fichiers de chaque page sont stables.

### Corrigé le 19/11, second essai réel

- **Liens du menu ramenant à l'accueil.** `/a-propos/` devenait `/a-propos//` en recomposant le chemin découpé par Express 5. Le chemin est maintenant lu tel quel, et `check:preview` vérifie qu'un lien mène à la bonne page, pas seulement à une page.
- **Sites demandés depuis la page d'accueil d'iCode.** Sans produit dans l'adresse, la cible par défaut était `web-app` (interface, serveur et base de données), même pour « un site pour mon restaurant ». Désormais :
  - un agent rapide (`POST /api/commands/kind`, 4 s au plus, seuil 0,65) lit la demande et pose `?product=site|app` avant que l'atelier monte son socle ;
  - sans projet IDEM, un projet minimal est tiré de la demande (`draftSiteProject`), pour que le moteur des sites, et donc l'aperçu instantané section par section, prenne la main. `ICODE_KIND_AGENT=off` coupe l'agent.
- **Ateliers qui ne démarraient jamais (`npm install` de 3 à 7 min).** Un seul échec de lecture du plan des dépendances, pendant un redémarrage du serveur, envoyait l'atelier sur `npm install`, et cet échec était retenu pour toute la session. La lecture du plan réessaie maintenant 5 fois sur ~15 s, et un échec n'est plus retenu.

### À faire avant la mise en production

Le moteur a besoin de Tailwind 3 dans `site-runtime`. Je n'ai pas pu l'installer sans réseau. Il faut lancer, puis commiter `package.json` et `package-lock.json` :

```
cd apps/appgen/apps/we-dev-next/site-runtime
npm install tailwindcss@3.4.17 postcss@8.4.49 autoprefixer@10.4.20 tailwindcss-animate@1.0.7
```

Tant que ce n'est pas fait, `GET /api/preview/status` répond `available: false` et iCode garde la WebContainer.

### Mesuré (`npm run check:preview`, Chrome, même site que `bench:site`)

| | Avant (WebContainer, journaux réels) | Maintenant |
| --- | --- | --- |
| Première page affichée | 14 à 35 s | **~0,4 s** (+0,6 à 0,8 s de construction côté serveur) |
| Dépendances, première fois par serveur | 7 s (instantané) à 3 min (npm) | 1,3 s, puis 11 ms (disque) |
| Une section modifiée, visible | rechargement à chaud de Vite dans la WebContainer | **~0,2 s**, sans rechargement, défilement conservé |
| Rendu | Vite | **identique, au pixel près** (412 × 3 683 px, 0 pixel différent) |

## Génération plus rapide

| Levier | Où | Effet |
| --- | --- | --- |
| **Relance des appels lents** | `ModelCaller.attempt` | Au-delà d'un délai, le même appel repart une seconde fois et la première réponse gagne. Le délai vaut 3 × la médiane mesurée pendant la génération pour un appel de cette taille, entre 12 et 60 s. Il ne coûte rien quand tout va bien. Un appel de 73 s avait été vu le 12/11, quand les pages voisines prenaient 5 s. `SITE_HEDGE=off` le coupe. |
| **Sections livrées au fil du flux** | `startPageCopy` + `completedSections` | Une section dont l'objet JSON est fermé dans la réponse en cours part tout de suite vers l'assemblage, si elle est juste. La première section d'une page s'affiche sans attendre la dernière. |

Ces deux leviers sont vérifiés sans appel payant (modèles simulés du SDK). Le gain réel en génération n'est pas mesuré : il faut une vraie génération.

## Contrôles

| Commande (we-dev-next) | Ce qu'elle prouve |
| --- | --- |
| `npm run check:site-speed` | 18 vérifications : relance (gagnante, jamais quand tout va bien, échec qui attend la relance, flux déjà commencé non relancé), lecture des sections complètes, livraison au fil du flux |
| `PREVIEW_RUNTIME_DIR=… npm run check:preview -- --site <dossier> [--cold]` | 13 vérifications de bout en bout dans Chrome : affichage, origine opaque, mise à jour à chaud sans rechargement, erreur signalée puis effacée, navigation, aucune erreur |
