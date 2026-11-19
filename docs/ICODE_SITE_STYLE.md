# Sites iCode : des formes, des survols et des bordures propres à chaque projet (template 1.5, 19/11/2026)

## Le constat

Les boutons étaient toujours des rectangles qui s'assombrissent au survol, les cartes un cadre à 1 px de la même teinte grise, et il n'existait que six « personnalités » qui ne réglaient que le rayon, la densité et la variante de bouton. Les causes :

- le survol d'un bouton était écrit en dur dans le composant (`hover:bg-primary/90`), identique partout ;
- la couleur des bordures était **toujours** `mix(fond, texte, 13 %)`, l'épaisseur 1 px, le trait plein : aucun réglage ne permettait de les faire varier ;
- les 164 gabarits du catalogue qui utilisent un bouton passent par `<Button>`, mais leurs **cartes sont écrites à la main** (`rounded-card border border-border bg-card p-6`) et le composant `Card` n'apparaît que dans 2 fichiers : aucun geste de carte ne les atteignait ;
- deux projets sur six avaient strictement le même réglage.

## Ce qui a changé

### Le vocabulaire (`design-system.json`, compilateur 1.1.0)

| Où | Réglage | Valeurs |
| --- | --- | --- |
| Bouton | `shape` | `uniform`, `square`, `pill`, `leaf`, `leaf-reverse`, `tab` |
| | `hover` | `darken`, `lift`, `invert`, `slide`, `glow`, `grow`, `shift` (ombre dure qui s'écrase), `underline`, `arrow`, `ring`, `tilt` |
| | `press` | `none`, `sink`, `shrink` |
| Carte | `shape` | `uniform`, `square`, `leaf`, `leaf-reverse`, `tab`, `arch`, `blob` |
| | `hover` | `none`, `lift`, `border`, `tint`, `zoom`, `shadow`, `shift`, `bar`, `glow`, `rise`, `tilt` |
| | `accent` | `none`, `top`, `left`, `bottom` (un trait de la couleur de marque sur un bord) |
| Badge | `shape` | `uniform`, `square`, `pill` |
| Lien | `hover` | `none`, `underline`, `bar` (navigation et pied de page) |
| Bordures | `tone` | `hairline`, `soft`, `normal`, `strong`, `ink`, `brand` |
| | `style` | `solid`, `dashed`, `dotted`, `double` (impose 3 px) |
| | `width` | `1px` à `3px` |
| Champs | `style` | `outline`, `filled`, `underline` |
| Titres | `weight`, `letterSpacing` | selon le langage de style |

### Comment ça se propage

- **Les formes** passent par des variables (`--radius-button-shape`, `--radius-card-shape`, `--radius-badge-shape`) que lisent `rounded-button`, `rounded-card` et `rounded-badge`. Elles suivent donc dans **chaque** section, sans qu'aucun gabarit ne les connaisse.
- **Les gestes** sont du CSS émis par le compilateur dans `theme.generated.css`. Il n'embarque que le geste choisi par le projet (6 Ko par site en tout, 1,7 Ko en gzip). Les déplacements ne jouent que si l'utilisateur ne les refuse pas (`prefers-reduced-motion`), et le survol seulement sur les appareils qui en ont un (`hover: hover`).
- **Les bordures** : le trait suit `* { border-style: var(--border-style) }`, et leur teinte est dérivée du ton choisi.
- **Les cartes à la main** : `markSurface` (dans `sectionCatalog/assemble.ts`) marque `ds-card` une boîte qui a les coins d'une carte, du rembourrage et une bordure ou un fond. Elle marque `ds-tile` une tuile d'image rognée. Elle ne marque jamais un cadre de média (`aspect-*`), un calque posé sur une image, un bandeau plein (`bg-primary`) ni une mosaïque. Le marquage s'applique à l'assemblage du catalogue **et** au code écrit par le modèle (`publish` dans l'orchestrateur), sans republier le catalogue.
- **Spécificité** : un geste `.ds-button:hover` l'emporte sur l'état de repos d'une classe utilitaire, mais cède, à égalité, à un `hover:…` écrit par l'appelant : une section qui veut son propre survol l'obtient.

### Qui choisit

`designConfig.ts` : **14 langages de style** cohérents (éditorial net, néo-brutaliste, pilules douces, feuilles organiques, précision technique, minimalisme de luxe, rebond ludique, cadre classique à double filet, aéré, onglets industriels, galerie à arches, trait d'encre, rond chaleureux, dense professionnel). Chacun donne, par axe, une **liste** de choix compatibles :

1. le projet choisit son langage parmi ceux qui vont à la famille de sa direction artistique ;
2. chaque axe est tiré indépendamment (un hachage par axe) : deux projets du même langage se distinguent encore ;
3. le modèle reçoit ce choix et peut l'ajuster, mais un **garde-fou** (`keepGestures`) rétablit le geste du projet quand il le ramène au banal (`uniform`, `darken`, `none`, `normal`, `solid`).

Les sites créés avant ce changement gardent exactement leur apparence : sans les nouveaux champs, le compilateur retombe sur l'ancien survol, les anciens coins et l'ancienne bordure.

## Mesuré (`npm run check:site-style`, sans modèle ni réseau)

| | Avant | Maintenant |
| --- | --- | --- |
| Réglages de style possibles | 6 « personnalités » | **14 langages, 1,78 million de combinaisons** cohérentes (hors titres et champs) |
| Styles complets distincts sur 400 projets | 6 | **327** |
| Survols de bouton | 1 | **11** |
| Survols de carte | 0 | **10** |
| Formes de bouton / de carte | 1 / 1 | **6 / 7** |
| Teintes de bordure | 1 | **6** |
| Sites « banals » (coins uniformes, survol qui assombrit, aucun geste, bordure grise) | tous | **0 sur 400** |

Le contrôle vérifie aussi 658 compilations (chaque valeur de chaque axe, plus 600 combinaisons tirées au hasard, aucune erreur, aucune retouche de contraste), la cohérence de chaque langage (pas d'ombre dure sur une pilule, pas de trait double sous 3 px, pas de forme courbe sans rayon), la rétrocompatibilité et 11 cas de marquage de carte.

## Voir le résultat

```
PREVIEW_RUNTIME_DIR=<node_modules avec tailwind 3> npm run gallery:site-style -- --out <dossier> [--count 12]
```

Rend la même planche (boutons, badge, champ, cartes à la main, carte du système, tuile, bordures, liens) pour douze projets, avec le survol d'un bouton et d'une carte, dans Chrome, par l'aperçu instantané.

## Limites

- Le catalogue de sections reste inchangé : la variété vient des jetons et des gestes, pas de nouveaux gabarits. Une section dont la disposition est la même d'un projet à l'autre garde cette disposition (la variété des dispositions est le travail du catalogue et de son choix par gamme).
- Une carte écrite par le modèle sans les classes `rounded-card` ne reçoit pas le geste : le guide du modèle lui demande de garder ces classes et de ne jamais écrire ses propres survols sur `Button` ou `Card`.
- Le style de la **refonte** d'un site existant n'imite pas encore la forme de ses boutons : elle reprend couleurs, polices et logo. Lire la forme et le survol des boutons de l'ancien site dans le scan de marque serait la suite logique.
