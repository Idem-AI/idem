# Direction artistique et lutte contre le rendu générique

Comment IDEM obtient des livrables visuels qui appartiennent à la même marque et
qui ne ressemblent pas à une sortie de machine. À lire avant d'ajouter une
génération visuelle ou de toucher un prompt de composition.

## Le problème

Un modèle à qui l'on donne un brief vague renvoie la **moyenne de son corpus**.
C'est la définition d'un générateur probabiliste, pas un défaut de talent :
demandez « une page moderne et épurée » et vous obtenez la page moderne et épurée
consensuelle — dégradé violet vers bleu, Inter, héros centré, trois cartes
arrondies à ombre douce, « Elevate your business ».

Le module avait deux symptômes distincts, et une seule cause :

1. **Les rendus « sentaient l'IA ».** Chaque prompt demandait de la qualité en
   adjectifs (« premium », « world-class »), ce qui ne contraint rien.
2. **Deux livrables du même projet n'avaient aucune parenté.** La charte, les
   visuels sociaux, le business plan, le deck et le site étaient composés par
   cinq prompts qui improvisaient chacun leur parti pris.

La cause commune : **aucun arbitrage visuel n'était pris au niveau de la marque**.
Il n'existait que des atomes (logo, palette, typographie), jamais la grammaire
qui les assemble.

## Le dispositif

Trois pièces, dans cet ordre. Aucune ne suffit seule.

```
                    ┌─────────────────────────────┐
                    │  1. DIRECTION ARTISTIQUE    │  décidée UNE fois par marque
                    │  (contrainte positive)      │  models/art-direction.model.ts
                    └──────────────┬──────────────┘
                                   │ styleId borne l'espace
                    ┌──────────────▼──────────────┐
                    │  2. GRAINE DE COMPOSITION   │  tirée par livrable
                    │  (variété bornée)           │  services/design/designSeed.ts
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │  3. INTERDITS ANTI-SLOP     │  contraintes négatives
                    │  + LINTER DÉTERMINISTE      │  services/design/antiSlop.prompt.ts
                    └─────────────────────────────┘  services/design/slopLint.service.ts
```

### 1. La direction artistique — la contrainte positive

`services/design/artDirection.catalog.ts` porte **20 styles nommés** (minimalisme,
maximalisme, futuriste, vector art, collage, rétro, cyberpunk, pop art,
glassmorphism, clay, pixel art, éditorial, Y2K, design suisse, surréalisme,
bohème, victorien, graffiti, aurora, manuscrit).

Chaque fiche est écrite **pour être exécutée par un modèle**, pas pour être lue :
grille, comportement de la couleur, traitement typographique, rayon de bordure,
filets, ombres, direction de l'imagerie, modificateur de prompt d'image (anglais),
prompt négatif, interdits propres au style.

Un agent (`prompts/singleGenerations/art-direction.prompt.ts`) **choisit** un
style du catalogue — il n'en invente pas — puis l'adapte à la marque. La sortie
est validée contre le catalogue : un `styleId` inconnu retombe sur `editorial`
plutôt que de casser la chaîne en silence.

Pourquoi contraindre le choix : laissé libre, un modèle répond « moderne, épuré,
professionnel ». Trois mots qui ne contraignent rien et reconduisent la moyenne.

La direction est persistée sur `branding.artDirection` et relue par **tous** les
modules.

### 2. La graine de composition — la variété bornée

`services/design/designSeed.ts` tire un archétype de mise en page, une stratégie
de couleur, une humeur typographique, une tension spatiale, un accent graphique
et une densité — **dans l'espace autorisé par le style** (`seedSpace`). Une charte
« Design Suisse » ne peut donc pas sortir en néon sur fond noir.

Deux modes :

| Mode | Usage | Effet |
|---|---|---|
| Déterministe (`entropyKey`) | Charte, business plan, deck | Les pages d'un même document se ressemblent ; deux projets diffèrent ; une régénération garde sa mise en page |
| Aléatoire (sans clé) | Visuels sociaux | Deux posts de la même marque ne se ressemblent pas |

La graine est **développée en consignes** avant d'atteindre le modèle
(`describeSeed`). Transmettre `{"archetype":"D"}` revenait à ne rien transmettre :
le modèle ignore ce que « D » recouvre.

### 3. Les interdits et le linter — la contrainte négative, puis la mesure

`antiSlop.prompt.ts` nomme explicitement les défauts que le modèle comblerait
tout seul, en trois niveaux de gravité. Nommer un défaut est ce qui le retire ;
demander « quelque chose d'original » n'a aucun ancrage.

`slopLint.service.ts` **vérifie** ensuite sur le HTML produit, sans dépenser un
token (des expressions régulières sur une chaîne) :

- `lintHtml` diagnostique et produit une consigne de correction réinjectable ;
- `repairHtml` corrige ce qui a une réponse unique — couleur hors charte ramenée
  à la couleur de charte la plus proche, police écrite en dur ramenée aux classes
  de la charte, titre en dégradé aplati, image sans `alt`.

Ce qui relève du goût n'est jamais réparé en aveugle, seulement journalisé : un
linter qui recompose est un linter qu'on désactive.

Les styles qui **revendiquent** un marqueur en sont exemptés : le glassmorphisme
n'est un défaut que pour les dix-neuf autres styles.

## Le logo

Le logo n'apparaissait ni dans les visuels, ni dans le business plan, ni sur le
site généré. La donnée était pourtant transmise — mais **sans verbe**. Un modèle
à qui l'on donne une URL sans consigne la traite comme une information de
contexte, pas comme un élément à poser sur la page.

`utils/brand-context.util.ts` produit un bloc `<logo>` unique, partagé par le
business plan, le deck, la carte de visite et le site, qui porte :

- les URLs de **toutes** les déclinaisons, une déclinaison manquante retombant
  sur le logo primaire (un trou dans la table conduit le modèle à inventer une
  URL, donc à afficher une image cassée) ;
- l'**obligation** de le placer, avec la destination exacte dans ce livrable ;
- la règle de choix encre/fond, mesurée sur la zone réelle et non sur l'ambiance
  générale de la page ;
- une consigne d'absence explicite quand la marque n'a pas de logo — sans elle,
  le modèle en dessine un ou invente une URL.

Trois filets de sécurité en aval :

| Livrable | Garantie |
|---|---|
| Visuel social | `ensureLogoPresence` remplace une URL inventée, ou pose une signature si le logo manque ; puis `flyerRender` mesure la taille et le contraste sur les pixels rendus et corrige la déclinaison |
| Pitch deck | Les URLs réelles sont protégées du remplacement par photo de stock ; `logo-missing` est journalisé |
| Site généré | Le linter de `we-dev-next` échoue si aucune déclinaison n'est référencée |

## Les polices de la marque

Elles ne se chargeaient **nulle part**. `TypographyModel.url` ne contient pas une
feuille de style mais un slug (`typography/systeme-premium`) — c'est ce que
l'agent produit et ce que le front utilise comme identifiant. Or les quatre
moteurs de rendu serveur l'injectaient tel quel dans un `<link rel="stylesheet">` :
le lien ne chargeait rien, le `font-family` retombait sur la police système, et
**tous** les livrables sortaient dans une typographie qui n'était pas celle de la
charte, sans la moindre erreur.

`utils/google-fonts.util.ts` construit désormais l'URL au moment du rendu, à
partir des familles. Deux `<link>` par famille, délibérément : l'un sans
spécification de graisse (toujours valide, garantit le chargement), l'autre avec
la plage complète 100→900 (permet le contraste de graisse). Une requête unique
combinant les deux familles ferait échouer les DEUX dès qu'une graisse manque à
l'une d'elles.

Le catalogue de polices proposé par l'agent a été refait dans la foulée : le
premier jeu était **codé en dur** sur « Exo 2 / Roboto », donc identique pour tous
les projets, et Roboto figure dans la liste anti-générique. Les repli de dernier
recours sont passés de `Inter` / `Montserrat` à `Archivo` / `IBM Plex Sans`.

## La retenue éditoriale

`services/design/editorialRestraint.prompt.ts` traite une pathologie
**différente** de l'anti-slop, et les deux peuvent coexister : une page peut être
parfaitement hors des clichés et rester illisible parce qu'elle est saturée
d'ornements et de phrases creuses.

La cause est identifiable : un modèle à qui l'on demande de « remplir une page »
remplit — une carte, une icône, une pastille, une phrase de transition, parce que
produire du volume est plus facile que produire de la matière. Le remède n'est pas
de demander « moins » (un adjectif de plus) mais d'imposer un **critère** : le
test de soustraction. Retirer l'élément ; si le lecteur ne perd ni information, ni
hiérarchie, ni chemin de lecture, il ne doit pas exister.

Deux conséquences concrètes :

- le quota de pages du business plan (« remplir à 85 %, une page à moitié vide est
  un défaut ») **produisait** le remplissage qu'on reprochait au rendu. Il est
  devenu une cible indicative : moins de pages vaut mieux que du bourrage ;
- le linter mesure maintenant l'accumulation — `icon-overload`,
  `decorative-shape`, `empty-badge` — parce que la demander dans le prompt ne
  suffit pas à l'échelle d'un document de douze pages.

## Le vocabulaire de composants

Chaque style porte un `tailwindRecipe` : les six primitives d'un document (page,
titre de section, texte courant, filet, bloc de données, légende) en classes
Tailwind exactes, plus les appariements typographiques qui le servent.

C'est la réponse à un défaut précis : sans primitives données, le modèle invente à
chaque bloc une carte, un badge, un liseré — et c'est ce bricolage accumulé qui
produit la décoration inutile. Une bibliothèque de composants tierce ferait
l'inverse de ce qu'on cherche (elle impose SON look à toutes les marques) ; des
recettes par style donnent le même bénéfice — assembler au lieu d'inventer — sans
uniformiser.

## Les familles de mise en page

Constaté le 13 septembre 2026 : quel que soit le projet, charte et business plan
sortaient « un seul et même style, avec exactement les mêmes dispositions ». La
graine faisait varier des **réglages** — quelle couleur va où, l'humeur du titre,
l'ornement de l'en-tête — posés sur **un seul dessin**. Les blocs (chiffres-clés,
tableaux, cartes, frises, citations), le pied de page et la colonne de texte
étaient identiques pour tous les projets ; en portrait, les dispositions
latérales se ramenaient même toutes à « titre en haut ». Les contrôles passaient
au vert parce qu'ils comptaient des tirages, pas des pages.

`services/design/layoutFamilies.ts` porte désormais **60 familles nommées**
(Revue, Rapport annuel, Affiche, Grille modulaire, Carnet de terrain, Atlas,
Tableau de bord, Gazette, Manifeste, Monographie, Journal de bord, Planisphère,
Magazine de mode, Annuaire, Livre blanc, Dossier de presse, Salle de contrôle,
Portfolio, Guide de voyage…). Chacune est une grammaire complète sur
**23 dimensions visibles** :

| Dimension | Dessins |
|---|---|
| Ouverture de section (portrait) | 13 — numéro en marge, aplat saignant, cadre, sur-titre tourné, ouverture de chapitre, titre et chapô en regard, hiérarchie inversée (le chapô en grand), doubles filets, onglet… |
| Pied de page | 8 — dont titre courant en tête de chaque page, numéro d'angle |
| Colonne de texte (portrait paginé) | 5 — pleine, décalée, indexée, étroite, appariée |
| Chiffres-clés | 11 — rangée sous filet, registre, chiffre héros, tuiles, colonnes filetées, bande, libellé d'abord, lignes, phrase, cartouches, escalier |
| Tableaux | 11 — dont colonnes teintées, transposé, encadré |
| Cartes | 12 — dont bandes alternées, colonnes décalées, initiales, numéro d'angle |
| Frises | 9 — dont épine centrale, étapes numérotées, chevrons |
| Citations | 9 — dont auteur en regard, équerres, surligné |
| Hypothèses | 7 — dont onglet, note de bas de bloc |
| Prose | 8 — dont lettrine, attaque en gras, deux colonnes, alinéas, corps d'essai, premier paragraphe agrandi, paragraphes filetés |
| Graphiques : cadre et clé de lecture | 6 — dont note en marge, légende numérotée |
| Graphiques : encre | 4 — charte, monochrome, série mise en avant, au trait |
| Chapô | 5 · Police des chiffres | 4 |
| Rythme entre blocs | 3 · Bord de page | 4 — aucun, barre haute, barre latérale, cadre |
| Étiquettes · numérotation · filets · encre des chiffres · angles · échelle du titre · nuancier | 5 · 6 · 5 · 2 · 2 · 3 · 3 |

Les cinq dernières dimensions ajoutées (chapô, police des chiffres, encre des
graphiques, rythme, bord de page) répondent à une remarque précise : même avec
36 familles, « il y a toujours un peu de ressemblance entre les éléments ». Les
chiffres sortaient tous en titrage gras, le chapô toujours gris sous le titre,
les graphiques identiques, et la page toujours nue.

Chaque valeur est une **fonction de rendu distincte**, jamais un curseur sur un
dessin commun : `familyChrome.ts` pour l'enveloppe (ouverture, pied de page,
colonne), `familyBlocks.ts` pour les blocs, les dessins historiques restant dans
`sectionRenderer.ts` comme l'option d'une famille parmi d'autres. Les primitives
qu'ils partagent — échappement, ajusteur de titre, contexte de page, ton de la
famille — vivent dans `renderKit.ts`.

La famille est un **invariant du document** : tirée par livrable
(`buildDocumentSeed`), déterministe, dans les familles compatibles avec le style
de la direction artistique (`fits`, neuf au moins par style ; tout le catalogue
sans direction). L'archétype, la stratégie de couleur et l'humeur typographique
continuent de varier par-dessus.

En paysage (charte, deck), les **structures** d'archétype restent : elles sont
calibrées au millimètre contre le débordement des pages rognées. La famille y
pose son pied de page, ses étiquettes, ses angles, son nuancier et le dessin de
chaque bloc.

### Ce qui est vérifié

- `check:uniqueness` — au moins 55 familles ; deux familles diffèrent toujours
  sur au moins neuf des vingt-trois dimensions (moyenne mesurée : 18) ; chaque
  style ouvre au moins treize familles ; chaque dessin est porté par au moins
  deux familles ; quarante projets du même style se répartissent sur la plupart
  de ses familles.
- `check:render` — 60 familles, 60 pages distinctes (portrait et paysage) ;
  charte respectée, contenu échappé, blocs enfants directs de la racine,
  colonnes portées par le padding de la racine.
- `check:fit` — chaque famille mesurée dans Chrome (A4 paginé complet et deux
  diapositives de charte) : ni débordement, ni chevauchement, remplissage. Puis
  les **silhouettes** : la première page en noir et blanc, sur une grille d'un
  centimètre ; deux familles doivent différer d'au moins 10 % des cellules
  encrées. Mesuré à 60 familles : 11 % pour la paire la plus proche, 33 % en
  médiane.

### Ajouter une famille

1. Ajouter l'entrée à `LAYOUT_FAMILIES`, avec ses styles (`fits`).
2. `npm run check:uniqueness` dit si elle est trop proche d'une autre sur le
   papier ; `npm run check:fit`, si elle l'est à l'écran.
3. Ouvrir `logs/render-preview.html` (groupe « Familles de mise en page ») avant
   de l'annoncer : un contrôle dit qu'elle diffère, pas qu'elle est belle.

Un nouveau DESSIN (une onzième ouverture, un neuvième tableau) multiplie la
variété de toutes les familles qui l'adoptent : l'ajouter au type dans
`layoutFamilies.ts`, l'implémenter dans `familyChrome.ts` ou `familyBlocks.ts`,
puis au vocabulaire de `checkUniqueness.ts`.

## Ce que touche la direction artistique

| Module | Ce qu'il reçoit |
|---|---|
| Charte graphique | Bloc `<art_direction>`, graine déterministe, interdits, auto-relecture — sur **chaque** page. Plus une page « Direction Artistique » qui doit être composée DANS le style qu'elle décrit |
| Visuels sociaux | Bloc `<art_direction>`, graine tirée dans l'espace du style, traitement d'image imposé, interdits, prompt négatif du style pour la génération d'image |
| Business plan | Bloc `<art_direction>`, graine déterministe, bloc `<logo>`, `BP_BRAND_RULES` sur chaque section |
| Pitch deck | Idem, en registre diapositive |
| Mockups | Modificateur de rendu (lumière, matière, étalonnage) + prompt négatif : le style pilote la photo, pas le sujet |
| Carte de visite | Bloc `<art_direction>` — le support où l'écart se voit le plus |
| Site généré | Bloc art direction + bloc logo + interdits, dans `multiChatPromptService` |

## Vérifier

```bash
cd apps/api && npm run check:design
```

Pur, sans réseau ni modèle. Il couvre les invariants dont une régression serait
**silencieuse** : une graine qui sortirait de l'espace de son style, un bloc de
direction vide, un linter qui se mettrait à signaler du HTML conforme (le faux
positif est le pire défaut d'un linter : il apprend à ignorer ses alertes).

## Ajouter un style

1. Ajouter l'identifiant à `ArtDirectionStyleId` (`models/art-direction.model.ts`).
2. Ajouter la fiche à `ART_DIRECTION_STYLES`, **avec** son `seedSpace` : sans lui,
   le style tire dans le catalogue complet et perd sa cohérence.
3. `npm run check:design` valide la complétude et la cohérence graine/style.

Aucun prompt n'est à modifier : ils lisent tous le catalogue.

## Ajouter une génération visuelle

Trois lignes suffisent, et elles doivent y être toutes les trois :

```ts
const ad = project.analysisResultModel?.branding?.artDirection;
const seed = buildDesignSeed(ad?.styleId, `mon-livrable:${projectId}`); // clé = déterministe
const directives = [
  buildArtDirectionBlock(ad, { medium: 'document' }),
  `<composition_seed>\n${describeSeed(seed)}\n</composition_seed>`,
  ANTI_SLOP_BLOCK,
].join('\n\n');
```

Puis, sur la sortie :

```ts
const clean = repairHtml(html, { palette, fonts, expectedLogoUrls, styleId: ad?.styleId, label });
lintHtml(clean.html, { ...ligneMême });
```
