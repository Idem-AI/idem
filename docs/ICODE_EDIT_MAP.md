# iCode : cartographie et aiguillage des retouches

Une retouche (« tu as dupliqué le menu », « le bouton de connexion ne marche pas ») ne doit ni relire tout le projet, ni demander à la personne de nommer la partie à changer. Elle ne connaît pas l'organisation de son site ou de son application : c'est aux agents de la trouver.

## Sites (`apps/appgen/apps/we-dev-next/src/siteEngine`)

### La carte (`siteMap.ts`)

Le code la calcule depuis les fichiers du site, sans modèle. Chaque partie modifiable porte un identifiant stable :

| Identifiant | Partie |
| --- | --- |
| `home/Hero`, `services/Workshops`… | une section d'une page, dans l'ordre d'affichage. La carte donne son rôle prévu par l'architecte (`.idem/manifest.json`), ses premiers textes, ses images et les données qu'elle lit (`site.navigation`, `media["…"]`) |
| `SiteHeader`, `SiteFooter` | l'en-tête et le pied de toutes les pages |
| `data.navigation`, `data.primaryAction`, `data.contact`, `data.name`, `data.description` | les données partagées de `src/site/data.ts`. Le menu est une donnée : l'en-tête ne fait que l'afficher |
| `theme` | l'apparence de tout le site (design system) |

Pour un site d'une soixantaine de sections, la carte fait environ 15 000 caractères.

### L'aiguillage (`edit.ts`, `planEdit`)

Un agent lit la carte, la demande et les derniers échanges (`recent`, envoyés par `builderHandler`). Il répond :

```json
{"targets":[{"id":"data.navigation","change":"retirer les entrées en double"}],"theme":"…","newSection":{"page":"home","after":"Hero","change":"…"}}
```

- Il ne renvoie jamais la question : sans réponse valable, il est relancé avec la consigne de choisir la partie la plus probable.
- Les identifiants inconnus sont refusés.
- Le code n'aiguille seul qu'un cas : un texte cité entre guillemets qui n'existe que dans une section (`routeEdit`, une recherche exacte). Aucune liste de mots-clés.

### L'exécution

Les parties visées sont traitées en parallèle :

- **Section, en-tête, pied :** blocs SEARCH/REPLACE sur le seul fichier visé, avec garde-fous et montage de contrôle.
- **Données :** le modèle propose la nouvelle valeur du champ, et le code la vérifie (`checkDataValue`) :
  - un menu ne contient jamais deux fois la même page, au plus 9 entrées, avec des libellés de 40 caractères au plus ;
  - un numéro ou un e-mail absent de la demande et du site est refusé ;
  - le code écrit ensuite la valeur dans `data.ts` (`writeSiteData`).
- **Apparence :** un réglage du design system.
- **Nouvelle section :** l'auteur habituel, posée après la section choisie.

Dans un site en plusieurs langues, les textes changés sont ensuite traduits (`syncCatalogs`).

## Applications (`src/utils/codeMap.ts`)

Une ligne par fichier : ce qu'il déclare, les écrans qu'il route, les routes d'API qu'il sert ou appelle, les textes qu'il affiche, les fichiers du projet qu'il importe.

- **Tri des fichiers :** `selectRelevantFiles` lit cette carte au lieu d'une simple liste de chemins.
- **Retouche d'un projet de plus de 24 000 jetons (`FOLLOWUP_CONTEXT_TOKENS`) :** seuls les fichiers choisis partent au modèle, avec la carte pour qu'il sache ce qui existe ailleurs. La première génération garde le seuil de 128 000 jetons.

## Contrôles

`npm run check:site-edit` (37) couvre :

- l'aiguillage par texte cité, et l'absence de mots-clés ;
- la carte : menu et doublons, en-tête qui lit le menu, ordre des sections, identifiants ;
- les données : relecture et réécriture, dédoublonnage, libellés trop longs, coordonnées inventées ;
- la carte d'une application.
