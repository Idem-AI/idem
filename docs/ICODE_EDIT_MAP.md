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

## Retouche robuste (22/11/2026)

Constat : dans la pratique, aucune retouche demandée dans le chat ne modifiait le site. Trois causes, toutes corrigées :

1. **La retouche n'arrivait pas au moteur.** Un site créé depuis l'accueil (projet tiré de la demande, jamais enregistré) ou par refonte n'a pas de `projectData` aux tours suivants. Une session rouverte sans `?product=site` se croyait aussi une application. Désormais, ce sont les fichiers (`isEditableSite`) qui décident. Le projet manquant est relu dans `src/site/data.ts` (`projectFromSite`).
2. **Toute retouche de section était refusée.** Le code pose `t()` / `localePath()` (import `@/i18n`) dans chaque section après la génération, mais `importPolicy` n'autorisait pas `@/i18n`. Les trois essais échouaient, et la réponse disait « je l'ai laissé tel quel ». `@/i18n` est maintenant permis, et `src/i18n/` est fourni au montage de contrôle.
3. **Les garde-fous bloquaient la demande elle-même.** « Le bouton en vert » était refusé si l'aiguillage n'avait pas coché `colors`. Quand il était admis, le vert était ramené à la couleur du thème la plus proche. Désormais, un garde-fou qui se déclenche passe par un **juge** (`createAllowJudge`, un appel court par sorte de changement) qui relit la demande. Une couleur demandée reste telle quelle (`keepColors` dans `ReviewContext`, `autocorrect`, `checkComponent`).

Ce que l'aiguillage (`planEdit`) sait maintenant faire :

| Clé | Quoi | Par qui |
|---|---|---|
| `targets` | texte, taille, couleur, élément ajouté ou retiré DANS une section | modèle : blocs RECHERCHER / REMPLACER, sinon **fichier réécrit en entier** (mêmes vérifications) |
| `restyle` | une autre mise en page pour une section | **catalogue idem-templates** (`editRestyle.ts`) : variante choisie et textes repris dans son schéma ; si aucune ne passe, le code de la section est modifié directement |
| `remove` / `order` | retirer ou réordonner des sections | code seul (`removeSectionFromPage`, `reorderSections`) |
| `code` | tout autre fichier du site (pages, `src/site/*`, traductions) | modèle, vérification de syntaxe |
| `theme`, `data.*`, `newSection` | inchangés | |

Une réponse qui ne change rien n'est jamais acceptée. Quand rien n'a pu être fait, la personne le lit, et l'invitation à reformuler décrit ce qu'elle veut voir à l'écran.

`npm run check:site-edit` enchaîne `check-site-edit.ts` (46 contrôles) et `check-site-edit-flow.ts` (18). Le second rejoue une retouche de bout en bout avec un modèle scripté : blocs faux puis réécriture, juge des couleurs, réponse sans effet, retrait, ordre, catalogue, repli hors catalogue, fichier hors carte, aiguillage sans projet.

## Retouche fidèle et économe (26/11/2026)

**Le problème.** La première génération se passe bien, mais les retouches suivantes peinent à faire ce que la personne demande, et ajoutent parfois des éléments sans rapport.

**Ce que montrent les journaux du 22/11 :**
- une même section a été à la fois retouchée et remise en forme depuis le catalogue ;
- une retouche du héros a échoué, alors que la réponse disait « c'est fait » ;
- un changement de police est parti dans du code ;
- des blocs posés à moitié passaient sans que personne le dise.

**Ce que dit la recherche.** Les travaux convergent vers trois étapes :

1. **Localiser** d'abord, en descendant : fichier, puis élément, puis lignes (Agentless, carte du dépôt d'Aider).
2. **Modifier peu**, par blocs RECHERCHER / REMPLACER. C'est le format le plus fiable pour un changement localisé (Diff-XYZ). La réécriture complète d'un fichier est plus robuste mais coûteuse, et sujette à l'« over-editing » (CanItEdit, « When Models Edit Too Much »).
3. **Relire** le changement par rapport à la demande. Dans FronTalk, l'étape de critique du code (AceCoder) ramène le taux d'oubli près de zéro.

| Mécanisme | Où | Effet |
| --- | --- | --- |
| Citation obligatoire | `planEdit` + `editVerify.grounded` | Chaque partie visée donne les mots de la personne qu'elle sert (`quote`), vérifiés mot pour mot par le code (casse, accents et ponctuation ignorés). Dès qu'une partie cite la demande, celles qui ne citent rien sont écartées. Sans aucune citation exacte, l'aiguillage est gardé tel quel. |
| Une partie, une sorte de changement | `planEdit` | La même section ne peut plus être à la fois dans `targets`, `restyle` et `remove`. « Plus professionnel » pour une section relève de `targets`, pas d'une remise en forme. |
| Ce qu'on doit voir | `expect` | L'aiguillage décrit ce qui sera visible une fois la retouche faite. Le juge relit avec. |
| Blocs entiers ou rien | `editFile` | Un bloc introuvable parmi d'autres déclenche un nouvel essai au lieu d'une retouche faite à moitié. |
| Pose tolérante, jamais devinée | `editPlan.locate` | Les blocs sont retrouvés aux espaces près, y compris à l'intérieur d'une ligne. Un passage de 4 lignes ou plus peut avoir une ligne mal recopiée, à condition qu'elle reste proche à 70 % et que le passage soit unique. Au-delà, le bloc reste « introuvable ». |
| Réécriture complète réservée | `editFile` | Le fichier entier n'est réécrit que si les blocs n'ont pas pu être posés (format). Un refus de contenu (police, couleurs, fait inventé, mauvais élément) ne déclenche plus une réécriture qui heurterait la même règle. |
| Relecture du diff | `editVerify.reviewEdit` (`edit:verify`) | Le juge reçoit la demande et seulement les lignes changées, en diff compact de quelques centaines de jetons, jamais le fichier. Il répond fait ou pas fait, ce qui manque et ce qui est sans rapport. Si besoin, une seule seconde passe, par blocs, part de la version déjà retouchée. Sans réponse du juge, la retouche passe. |
| Échec partiel dit | `createSiteEditStream` | Si une partie est faite et une autre non, la réponse dit les deux. |
| Préfixe en cache | `planEdit` | Le rôle, les règles, la forme de la réponse et le catalogue (environ 2 350 jetons) passent dans l'invite système, en tête. La carte et la demande suivent. DeepSeek facture un préfixe relu environ dix fois moins cher, à condition que l'hébergeur reste le même (non mesuré). |
| Sélectionner, puis « Demander à l'IA » | client (`chat:target`) | La sélection part comme désignation exacte (`pointed`), avec la section qui la porte, à la place d'un texte « fichier@position ». Une pastille « Modification limitée à : … » s'affiche au-dessus de la saisie, et le message suivant ne touche que cet élément. |

## Contrôles

`npm run check:site-edit` (46 + 40 dans le parcours scripté) couvre :

- l'indice du texte cité, et l'absence de mots-clés (autorisations décidées par l'agent) ;
- la désignation : portée (en-tête et menu, rien d'autre), chemins refusés, élément retrouvé (position, texte), retouche hors de l'élément refusée ;
- la carte : menu et doublons, en-tête qui lit le menu, ordre des sections, identifiants ;
- les données : relecture et réécriture, dédoublonnage, libellés trop longs, coordonnées inventées ;
- la carte d'une application ;
- (26/11) la citation qui écarte une partie sans rapport, une partie pour une seule sorte de changement, les blocs posés à moitié refusés, la relecture qui fait la partie manquante, le juge qui ne reçoit que le diff, l'échec partiel dit, la pose tolérante des blocs et le diff compact.
