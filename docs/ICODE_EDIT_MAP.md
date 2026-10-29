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
- **Aucune liste de mots-clés, nulle part.** Ce que la demande autorise est dit par l'agent, qui l'a comprise : `allows: {fonts, colors, removal, dark}`. « Donne plus de peps au site » autorise donc les couleurs, alors que « corrige la faute du titre » n'autorise rien de tout cela. Les garde-fous (`guardEdit`, `guardTheme`) appliquent cette décision. L'agent nomme aussi la nouvelle section (`newSection.name`), et le réglage de l'apparence est choisi par le modèle.
- Un texte cité entre guillemets n'est qu'un indice : la carte dit à l'agent dans quelle section il se trouve mot pour mot (`quotedOwners`).

La carte sert à économiser les jetons d'entrée : l'agent lit quelques milliers de caractères au lieu du site entier, puis seule la partie visée est envoyée au modèle qui la modifie.

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

## Outil Dessin : ce qui est désigné dans l'aperçu

Quand la personne encadre, entoure ou pointe un élément, puis écrit sa demande et clique sur Envoyer, la demande part **directement** dans la conversation (`chat:run`) : rien à renvoyer depuis le chat.

1. **Résolution dans l'aperçu.** Les tracés sont ramenés au repère de l'iframe, en tenant compte du zoom et du format téléphone. L'agent injecté répond à `HIT_TEST` (`instrumentation.ts`) :
   - la pointe d'une flèche désigne l'élément sous elle ;
   - un cadre, un cercle ou un tracé libre désigne le plus petit élément presque entier dans le tracé qui en remplit l'essentiel (sinon, celui du centre).

   Chaque élément remonte avec ses ancêtres instrumentés (`data-idem-id`) : son fichier, sa position, et la partie qui le porte (la section, l'en-tête ou le pied d'un site ; le composant d'une application).
2. **Envoi.** La conversation montre la demande et ce qui a été désigné, en mots. La désignation exacte part à côté, dans `pointed` (`siteEngine/pointed.ts`, `readPointed`, qui rejette les chemins hors du projet).
3. **Retouche de site verrouillée (`pointedScope`).**
   - Seules les parties désignées peuvent changer, avec les données qu'elles affichent : désigner le menu autorise `SiteHeader` et `data.navigation`.
   - L'apparence générale ne peut pas changer, ni aucune autre section.
   - Le modèle reçoit le code exact de l'élément (`locateElement`, à sa position ou, si le fichier a bougé, par son texte).
   - Une retouche qui ne touche pas cet élément est refusée (`touchesElement`).
4. **Application.** La demande reçoit la désignation avec le fichier, la ligne et le code de chaque élément (`describePointedForModel`).

## Applications (`src/utils/codeMap.ts`)

Une ligne par fichier : ce qu'il déclare, les écrans qu'il route, les routes d'API qu'il sert ou appelle, les textes qu'il affiche, les fichiers du projet qu'il importe.

- **Tri des fichiers :** `selectRelevantFiles` lit cette carte au lieu d'une simple liste de chemins.
- **Retouche d'un projet de plus de 24 000 jetons (`FOLLOWUP_CONTEXT_TOKENS`) :** seuls les fichiers choisis partent au modèle, avec la carte pour qu'il sache ce qui existe ailleurs. La première génération garde le seuil de 128 000 jetons.

## Contrôles

`npm run check:site-edit` (42) couvre :

- l'indice du texte cité, et l'absence de mots-clés (autorisations décidées par l'agent) ;
- la désignation : portée (en-tête et menu, rien d'autre), chemins refusés, élément retrouvé (position, texte), retouche hors de l'élément refusée ;
- la carte : menu et doublons, en-tête qui lit le menu, ordre des sections, identifiants ;
- les données : relecture et réécriture, dédoublonnage, libellés trop longs, coordonnées inventées ;
- la carte d'une application.
