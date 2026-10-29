# La logique du moteur graphique — document de référence

> Description détaillée du moteur qui génère les **livrables graphiques** d'IDEM AFRICA et d'iVision : business plans,
> chartes graphiques, pitch decks, cartes de visite, flyers et publications réseaux, couvertures, graphiques. Écrite à
> partir du code (`packages/graphic-engine`, version 2.2, octobre 2026). Elle décrit l'**idée directrice**, le
> **parcours** d'une génération (ce qui se passe, dans l'ordre) et la **logique du code** (fichiers, fonctions,
> décisions).
>
> Le moteur est un **paquet du monorepo** (`@idem/graphic-engine`), importé par les applications — jamais un service
> appelé par HTTP. Hôtes actuels : l'API IDEM (`apps/api`, port branché par `api/services/graphic/engine.host.ts`),
> le cœur iVision (`apps/ivision/core/src/runtime/host.ts`) et l'API iVision.
> Référence d'équipe plus courte : [`packages/graphic-engine/README.md`](packages/graphic-engine/README.md).

---

## 1. Idée directrice

Le renversement central : **on sépare ce qu'un livrable DIT de la façon de le MONTRER.** Un rédacteur (un modèle ou le
code de l'hôte) écrit un **contenu structuré** — des sections de blocs typés, sans un mot sur l'apparence. Le moteur en
fait une page.

Depuis la version 2.0 (14 octobre 2026), la même philosophie que le moteur vidéo : **l'IA conçoit et écrit chaque page
librement, le code garantit l'exactitude et l'affichage, la jauge de créativité choisit le modèle.**

- **l'IA écrit la page** en HTML Tailwind, à tous les crans — aucun gabarit, aucun catalogue de mises en page ;
- **le code garantit** : les textes et les chiffres sont exacts (jamais recopiés par un modèle), les graphiques et les
  tableaux sont dessinés par le code, la page tient dans son support ;
- **aucune note esthétique, aucune critique, aucune réécriture automatique** : le rendu est celui que l'auteur a écrit.
  La seule correction est **technique** — une page qui ne s'affiche pas.
- **la jauge** (`low`, `medium`, `high`, `ultra` ; un ancien « max » vaut « high ») choisit seulement le **modèle** de
  chaque rôle ; les étapes et le contexte sont les mêmes partout.

La règle de rendu, donnée à l'auteur comme une **consigne d'écriture** (jamais vérifiée) : le niveau d'un studio, la
hiérarchie fait le travail (taille, graisse, espace, alignement), la décoration n'est permise que lorsqu'elle porte la
marque ; **montrer l'essentiel** — le contenu et rien d'autre.

---

## 2. Les livrables et les supports (`design-system/formats.ts`)

Chaque support a des cotes fixes (px et mm) et une **nature** qui change les contraintes et le contrôle :

| Famille | Nature | Exemples de formats | Pour |
| --- | --- | --- | --- |
| `slide` | toile **fixe** (rien ne défile) | `slide-16x9`, `page-a4`, `page-a4-landscape` | pitch deck, pages de charte (A4 fixe) |
| `document` | **flux** A4 qui s'allonge vers le bas (le PDF pagine entre les blocs de premier niveau) | `a4-portrait` | business plan, rapport |
| `card` | toile fixe, 85 × 55 mm, zone de sécurité d'impression | `card-landscape`, `card-portrait` | cartes de visite (2 faces) |
| `visual` | toile fixe pleine résolution (jusqu'à 1080–2560 px) | `flyer-square`, `flyer-story`, `flyer-banner`, `flyer-post`, `flyer-a4` | flyers, publications |
| `cover` | toile fixe, zone de sécurité (la plateforme couvre les bords) | `cover-facebook`, `cover-linkedin`, `cover-x`, `cover-youtube`, `avatar-square` | couvertures et avatars réseaux |
| `chart` | toile fixe | `chart-free` | un graphique seul |

Chaque `FormatDef` porte : cotes px et mm, `kind` (`fixed` / `flow`), `orientation`, corps de base (`base`), taille
minimale (`minSize`), zone de sécurité (`safe`). Ce sont des **contraintes d'impression**, pas des choix de design :
l'auteur les reçoit telles quelles.

---

## 3. Le parcours d'une génération (`engine.ts`)

```
contenu (ContentModel : sections de blocs typés)
  → validation + normalisation (un rédacteur se trompe : on répare la FORME, jamais le fond)
  → médias de la page (si elle a une intention) : plan → sources dans l'ordre → pose → repli DIT
  → coquille du nom de la marque corrigée (inversion de deux lettres)
  → matière à plat : chaque texte reçoit une clé ({{title}}, {{b2.items.0.value}}) ; graphiques/tableaux = primitives
  → LANGAGE VISUEL de la marque (directeur, une fois par charte, gardé par l'hôte)
  → PLAN du document (directeur, documents de plusieurs pages : une idée, une ligne par page)
  → page écrite en HTML Tailwind (auteur, une page par appel) OU dessinée par le code (page d'actif)
  → assainie (scripts/CSS natif/adresses étrangères retirés) → remplie par le code (textes exacts, primitives,
    racine .ge-page aux cotes du support)
  → Tailwind compilé côté serveur avec le thème de la marque
  → « s'affiche-t-elle ? » (Chromium) → sinon correction bornée
  → RenderResult (html + <style>) + SectionSpec gardé + trace de génération
```

Point d'entrée : `createDocument(options)` → `GraphicDocument`, puis `doc.composeSection(content, { index, total })`
par page (les pages peuvent se composer en parallèle). Une toile d'une seule section : `renderSingle({ …, content })`.

Deux agents, deux rôles logiques (l'hôte résout le modèle sur l'échelle du rôle) :

| Rôle | Échelle | Quand | Ce qu'il écrit |
| --- | --- | --- | --- |
| `graphic.director` | `design` | une fois par marque, et une fois par document de plusieurs pages | le langage visuel de la marque, puis le plan du document |
| `graphic.author` | `code` | une fois par page (+ révisions, corrections) | le HTML Tailwind de la page |

Sans port `agentCall` branché, aucune page ne s'écrit (`GraphicRenderError`) : il n'y a plus de composition par le code
(hors pages d'actif).

---

## 4. Le contenu en entrée (`contracts/content-model.ts`)

Un `ContentModel` est une suite de **sections** (une page, une diapositive, une face de carte, un visuel), chacune avec
un titre, un chapô facultatif, et des **blocs typés**. Chaque bloc a un identifiant stable (`b1`, `b2`…) : le code de
l'auteur le désigne par cet identifiant et **ne recopie jamais un texte**.

**`origin`** distingue deux mondes :

- `origin: 'model'` — ce qu'un rédacteur peut produire : `prose`, `cards`, `table`, `metrics`, `chart`, `quote`,
  `timeline`, `assumption`, `comparison`, `steps`, `swot`, `funnel`, `persona`, `riskMatrix`, `businessModel`,
  `points` ;
- `origin: 'system'` — ce que le **code de l'hôte** a posé à partir de données réelles (tableaux financiers, nuancier,
  URL de logo, références sourcées) : le moteur le restitue à l'identique, il ne se retouche jamais par clé.

Les **blocs spécimens** (chartes), toujours posés par le code, jamais par un modèle : `swatches`, `typeSpecimen`,
`logoDisplay`, `typeScale`, `patternGrid`, `socialPosts`, `socialBanners`, `mockupShowcase`, `logoStory`,
`artDirectionStance`, `compositionPrinciples`, `imageryShowcase`, `artDirectionRules`, `sources`. Les blocs de visuel
et de carte : `copy`, `cover`, `contact`.

Chaque bloc porte ses données exactes et bornées (Zod) : un `chart` a ses `labels`, ses `series` (autant de valeurs que
d'étiquettes, vérifié), son `chartType` (ce que la donnée **est**, pas ce qui est joli) et sa `readingKey` (ce que le
lecteur doit **conclure**) ; un `points` porte, par point, un libellé, un détail, un chiffre, et ce que son image doit
représenter (`visual`, `icon`, ou `media` — posés par le code, jamais par le modèle).

**Validation et normalisation** (`contracts/validate.ts`, `normalize.ts`) : un rédacteur se trompe, on répare la forme
(identifiants manquants, bornes, un bloc système sans id reçoit un id qui ne croise jamais ceux du modèle) sans toucher
au fond. Une page HTML rendue par erreur se récupère (`salvage.ts`).

---

## 5. Les trois écrivains (`author/prompts.ts`)

Du plus durable au plus local, pour n'écrire chaque chose qu'une fois :

### 5.1 Le langage visuel de la marque (`languagePrompt`, directeur)

Écrit **une fois par charte**, gardé par l'hôte (port `brandMemory` : Redis chez IDEM, Mongo `brand_memory` chez
iVision) et **relu par tous les livrables de la marque** — decks, plans, flyers, cartes, pages de charte. 5 à 8 lignes
courtes : rôles de couleur, typographie, grille et marges, le ou les deux signes graphiques qui sont la signature de la
marque, l'imagerie, la place du logo. Un style expressif (collage, maximalisme) y est **traduit en règles sobres** —
une signature employée avec parcimonie, jamais de décoration gratuite. La clé change avec la charte (`languageKey` :
portée + empreinte des couleurs, polices, style, grammaire) : une nouvelle charte, un nouveau langage. Sans mémoire,
une page seule s'en passe (la direction brute suffit).

### 5.2 Le plan du document (`planPrompt`, directeur)

Pour un document de **plusieurs pages** : une **idée** (une phrase) et **une ligne par page** — ce qui domine chaque
page (un graphique, un chiffre-clé, une photo, du texte pur, un tableau, un diagramme) et comment elle est organisée. Le
directeur reçoit ce que chaque page doit faire (`sections[].purpose`) et les idées des documents déjà faits pour la
marque (pour ne pas se répéter). Chaque page ne recevra que **sa ligne et celles de ses voisines**.

### 5.3 L'auteur de page (`authorSystem` + `authorUser`, auteur)

Un appel **par page**. La **consigne système** est la même pour toutes les pages d'un même support (le fournisseur peut
la garder en cache) : le livrable et son support (cotes, nature, zone de sécurité, corps minimal), le standard
professionnel (un seul élément focal, au plus un signe graphique, rien qui recouvre un texte, peu de tailles, les
polices de la marque, décoration seulement si elle porte la marque, montrer l'essentiel), la feuille Tailwind autorisée,
le contrat de sortie, un **seul exemple de syntaxe** (« invente ta propre composition »).

Le **message** porte le reste, compact : la fiche de la marque (couleurs sous leurs noms Tailwind, polices, logos,
motif), le langage visuel ou la direction, le plan de la page et de ses voisines, l'intention de la page, la
**référence** à reproduire si le client en a donné une, les **outils** dont cette page a besoin (et eux seuls), et la
**matière** (chaque clé et son texte).

Le contrat de sortie : un bloc ```html, le fragment seul. Toile fixe : l'élément de tête remplit la toile. Page A4 :
une suite de blocs de premier niveau (le PDF coupe entre eux ; `data-keep-together` pour un bloc insécable). **Tous les
mots viennent des clés** ; l'auteur n'ajoute que du non-verbal.

---

## 6. La matière à plat (`runtime/content-map.ts`)

`buildContentMap` parcourt la section et donne à **chaque texte une clé** d'adresse : `title`, `lede`,
`b2.items.0.value`, `b1.paragraphs.0`. L'auteur écrit `{{clé}}` dans son HTML, le code remplace par le texte exact
(échappé). Conséquences :

- les chiffres, noms et sources restent **exacts** (aucun modèle ne les retape) ;
- une retouche de texte est un **nouveau rendu du même code**, sans appel au modèle (`applyTextEdits`) ;
- les données **techniques** d'un bloc (fond voulu, motif, taille de tuile, degré de l'échelle, graisse, emphase) sont
  des **indications** pour l'auteur, jamais des clés — elles ne peuvent donc pas s'imprimer par erreur (« light »,
  « neutral », « yes ») ;
- les graphiques et les tableaux **ne passent pas par les clés** : ce sont des primitives dessinées par le code ;
- une carte de visite range l'essentiel par face (le recto montre la marque, le verso la personne) ; en mode
  `markers`, chaque champ reste `{{champ}}` dans un élément `data-field` (gabarit partagé entre porteurs).

Le code corrige aussi une **coquille du nom de la marque** par inversion de deux lettres voisines (« LIGTH » → le nom),
et rien d'autre (`fixBrandNameTypos`) ; la correction est dite dans la trace.

---

## 7. Les médias d'une page (`asset-planner/index.ts`)

Avant de composer, savoir ce que la page doit **montrer**, ce qui existe déjà, ce qu'il faut chercher ou créer :

1. **Plan** (`planAssets`, sans réseau) : de l'intention de la page (sa stratégie visuelle parmi `illustration`,
   `full-bleed`, `product-capture`, `diagram`, `data-visualization`, `collage`, `editorial`, `free-composition`) et de
   son contenu (les `points` sans image) → des besoins (`AssetRequirement`).
2. **Résolution** (`resolveAssets`) : chaque besoin essaie ses sources dans l'**ordre fixe** —
   `user` (fournis par l'utilisateur) › `project` (ressources du projet) › `capture` (captures réelles) ›
   `generated` (génération) › `stock` (banque d'images) › `native` (composition par le code) — chez les **fournisseurs
   que l'hôte a branchés**. Le moteur ne connaît aucune API : un fournisseur se remplace sans toucher au reste. Une
   **capture de produit** n'est jamais générée ni prise en banque (on ne fabrique pas une interface). La **génération**
   est réservée aux crans qui la paient (High et au-delà) et **plafonnée par document** (`GENERATION_CAP[level]`).
3. **Pose** (`applyAssets`) : la figure ajoutée à la section, l'icône ou le média posé sur son point. **Faute de
   média, le repli est DIT** : la stratégie de la page change (une page « pleine image » sans image redevient
   éditoriale), jamais une fausse image, jamais un cadre vide. Un média mal formé ne coûte jamais la page : on la
   compose sans lui.

---

## 8. L'essentiel garanti par le code

### 8.1 Le régime des diapositives (`content/slide-diet.ts`)

Une slide doit se lire du fond de la salle (règle 10/20/30 de Kawasaki). Quand une slide dépasse son budget de texte
(après la réécriture par le rédacteur), le code **déplace ce qui déborde vers les notes de l'orateur** — il ne supprime
rien (« le détail va dans votre voix »). Dans l'ordre : le chapô, puis les phrases au-delà de la première, puis les
détails des points et des cartes, puis les légendes. Les chiffres, libellés, tableaux et blocs système ne bougent
jamais. L'API appelle `slideEssentials` avant chaque slide (`content/slide-diet.ts`) : pas de chapô, deux blocs au plus
(la donnée d'abord, l'explication en dernier), trois ou quatre points au plus.

### 8.2 Les pages d'actif (`runtime/asset-page.ts`)

Une page fixe (slide ou A4) dont l'**unique bloc est un actif de la marque** (`logoStory`, `logoDisplay`,
`patternGrid`, `mockupShowcase`, `swatches`, `typeScale`) ne passe **pas par l'auteur**, à aucun cran : le code pose le
titre, puis l'actif en très grand sur toute la place qui reste — rien d'autre. Décision de l'utilisateur (15/10/2026)
après des chartes où l'auteur ajoutait des tuiles inventées, des cadres, des logos minuscules. Les textes restent des
clés : ces pages se rejouent et se retouchent comme les autres.

### 8.3 La carte de visite

L'essentiel par face, dans la matière même : le recto ne reçoit que la signature (le logo en grand), le verso la
personne et ses coordonnées en une colonne alignée ; ni icône, ni forme, ni QR code.

---

## 9. Du code de l'auteur à la page (`runtime/expand.ts`)

Trois opérations déterministes, sans aucun jugement :

1. **Extraire** (`extractHtml`) : la réponse du modèle → le fragment (le plus long bloc de code, document complet
   toléré, `<head>` retiré).
2. **Assainir** (`sanitizeHtml`) : rien qui s'exécute ni ne sorte de la page. Scripts, gestionnaires `on*`, cadres
   (`iframe`, `object`…), balises de formulaire, adresses étrangères (`src`/`href` non `data:`/`{{clé}}`/`#`) retirés.
   Le **CSS natif** (`<style>`, `style=""`) retiré et **compté** (`native_css_removed`) : la page est en Tailwind.
3. **Remplir** (`expandPage`) : les primitives `<idem-…>` → le dessin du code ; les `{{clé}}` → le texte exact échappé
   (une adresse ne s'imprime que dans un attribut ; une image sans adresse est retirée, jamais laissée cassée) ; la
   racine `.ge-page` reçoit les classes aux **cotes du support** (`rootClasses`).

Le **gabarit assaini** (clés et primitives encore en place) est ce qui est gardé dans le `SectionSpec` : le rejouer
avec un contenu retouché refait la page **sans modèle**. Le remplissage signale, sans rien bloquer, ce que l'auteur n'a
pas placé (`content_not_shown`), les clés inconnues (`unknown_keys`), les primitives sans bloc (`unknown_blocks`).

---

## 10. Tailwind côté serveur (`runtime/tailwind.ts`)

Le **cœur JavaScript** de `tailwindcss` 4 (aucun binaire natif) compile les classes lues dans les attributs `class`
avec un `@theme` tiré des **jetons de la marque**. La feuille obtenue :

- porte les variables du thème sur `.ge-page` (deux marques cohabitent sur un même écran) ;
- n'a que des `px` (la taille de police racine de l'application hôte ne change pas la page) ;
- remplace le preflight par une remise à zéro sans poids limitée à `.ge-page` (rien ne fuit dans l'hôte).

Les couleurs sont nommées pour l'auteur : `bg-brand-primary`, `text-ink`, `text-muted`, `bg-brand-soft`, `border-rule`,
`text-on-brand`, et les rampes `brand-50…950` / `accent-50…950`. `restyleFragment(html, tokens)` recompile la feuille
d'une page modifiée ailleurs (classes ajoutées comprises) ; `withoutCompiledStyle(html)` la retire avant de donner le
HTML à lire à un modèle.

---

## 11. Les primitives dessinées par le code (`runtime/primitives.ts`)

Des **outils**, jamais des mises en page : la place, la taille et le style restent ceux de l'auteur (ses classes
passent sur l'élément produit).

| Balise écrite par l'auteur | Ce que le code dessine |
| --- | --- |
| `<idem-chart data-block="b3" class="…">` | le graphique **Chart.js** des vraies données (9 types), à la palette de la marque. L'élément est un `<canvas data-idem-chart="…config JSON…">` : le code pose la **configuration** (données, couleurs, police — sans aucune fonction), le ratio et la palette (`data-ge-palette`) ; **Chart.js est injecté par l'hôte** au moment du rendu PDF et de l'aperçu (`apps/*/public/scripts/chart.js`). L'auteur choisit la représentation (`data-type`, **refusée si elle trahit les données** : camembert à plusieurs séries, radar à moins de 3 axes…) et met une catégorie en avant (`data-highlight`) |
| `<idem-table data-block="b4" class="[&_th]:bg-brand-primary">` | le tableau, cellule pour cellule, colonnes chiffrées à droite ; l'auteur le stylise depuis la balise (`[&_th]:…`, `[&_td]:…`) |
| `<idem-gallery data-block="b5">` | les mockups finis d'un bloc, côte à côte, **entiers**, avec leur nom (jamais rognés, pivotés, encadrés ou couverts) |
| `<idem-logo variant="primary\|onLight\|onDark\|mono\|icon">` | le logo (ou le nom en wordmark si la marque n'en a pas) |
| `<idem-icon name="truck">` | une icône vectorielle **locale** (Tabler, Lucide ; `capability-registry/local/icons.ts`) |
| `<idem-pattern index="0">` / `<idem-pattern-tile data-block data-index>` | une tuile de motif de la marque (bande, panneau, coin — jamais le fond entier) |

Le choix du type de graphique passe par `representable` : une représentation qui trahirait les données est ignorée et
le type d'origine est gardé. La palette des graphiques vient de `design-system/charts/palette.ts` (couleurs de la
marque), les motifs de `design-system/kit/motifs.ts`.

---

## 12. La seule vérification : l'affichage (`runtime/check.ts`)

Chromium (le **même moteur que l'impression PDF** : ce qui est mesuré ici est ce que le lecteur verra) ouvre la page et
une sonde vérifie, et **rien d'autre** — ni contraste, ni équilibre, ni goût :

1. la **racine** `.ge-page` existe et a une **taille** non nulle ;
2. **quelque chose de visible** dans la toile (texte, image, dessin) ;
3. aucun **texte coupé par le bord** — les quatre bords sur une toile fixe ; à droite et à gauche sur une page de flux
   (dont seule la hauteur grandit : un tableau plus large que le papier sort du PDF) ;
4. aucun **texte recouvert** par une forme, une image ou un aplat peint par-dessus (trois points de sonde par ligne,
   recouvert si au moins deux sont masqués par un élément qui peint).

Les messages d'erreur sont écrits **pour l'auteur qui corrigera** (« le texte "…" dépasse de 24 px : moins de
décoration ou des éléments plus petits, ne jamais retirer une clé de contenu »). Un **texte coupé ou recouvert** rend
la page « presque affichée » : elle est gardée comme **repli** (`cut`) si la correction échoue, et livrée avec le
constat bloquant `text_cut` (jamais effacée). Un navigateur absent n'est **pas** une faute de la page (`infra`) : le
rendu passe sans contrôle. `validate: false` saute Chromium (contrôles rapides).

---

## 13. La correction bornée (`engine.ts#author`)

Ce qui ne s'affiche pas — réponse sans HTML, rien de visible, rendu impossible, texte coupé ou recouvert — passe par
une correction **technique** et bornée, une tentative à la fois, une approche différente à chaque fois :

1. **corriger** (`fix`) : le modèle **du cran** reçoit son code et l'erreur exacte ;
2. **réécrire autrement** (`rewrite`) : le modèle **du cran au-dessus**, plus simplement, en connaissant les échecs ;
3. **version minimale** (`minimal`) : le même, la page la plus simple qui s'affiche (fond, titre, chaque clé en colonne,
   outils pleine largeur).

Jamais deux fois la même approche, **trois au plus**, et un **budget par document** : `GRAPHIC_REPAIR_ATTEMPTS` (3),
`GRAPHIC_REPAIR_TOKEN_BUDGET` (60 000 jetons), `GRAPHIC_REPAIR_MAX_MS` (240 s). Si une page presque affichée (texte
coupé) existe, elle est **livrée** avec son constat plutôt que perdue. Ce qui résiste entièrement lève
`GraphicRenderError` : le service traite la section comme en échec, **et le dit** — rien n'est remplacé en silence.

Les constats **non bloquants** restent dans `result.issues` comme conseils : `native_css_removed`, `content_not_shown`,
`unknown_keys`, `unknown_blocks`, `asset_fallback`.

---

## 14. Les jetons de la marque (`design-system/tokens/`)

`buildTokens` dérive de la charte un thème **lisible** : à partir de la palette (primaire, secondaire, accent, fond,
texte), il construit des rampes neutres et de marque (`50…950`) et des rôles dont le **contraste est garanti**
(`readableInk` : encre à 7:1 sur le fond, texte secondaire 4,5:1, discret 3:1 ; `onBrand` / `onAccent` lisibles sur les
aplats de marque). Surface **claire par défaut** (le fond sombre n'est permis que sur demande explicite, `allowDark`).
Deux marques peuvent cohabiter sur un écran (les variables sont portées par `.ge-page`). Le `hash` des jetons entre
dans la provenance d'une page : un changement de charte invalide les caches qui en dépendent.

Les **adaptateurs** (`adapters/idem.ts`) lisent la charte telle que les applications la stockent — de façon
**structurelle** (le paquet n'importe jamais les modèles d'une application) : une couleur absente reste absente (le
moteur la dérive), un logo absent n'est pas remplacé par un faux.

---

## 15. Retoucher, remettre en page, exporter — sans réécrire

L'hôte garde, avec chaque page, son **contenu final** (textes, chiffres, médias déjà posés) et son **code**
(`doc.page(id)` ; chez IDEM, `SectionModel.composition`). De là, sans réécrire :

- **retouche de mots** : `applyTextEdits(content, { "<clé>": "nouveau texte" })` puis `composeSection(content,
  { replay })` — **aucun auteur** ; les blocs posés par le code restent intouchables ;
- **retouche de forme** : `composeSection(content, { revise: { spec, instruction } })` — l'auteur reçoit son code et la
  consigne (« titre plus grand, logo en bas ») ;
- **nouvelle mise en page** : `composeSection(content)` dans un nouveau document, avec `layoutNote` (« plus aérée ») —
  aucun texte réécrit, aucun média recherché ;
- **page modifiée ailleurs** (éditeur) : `restyleFragment` / `withoutCompiledStyle` ;
- **export PowerPoint** (`export/pptx.ts`, PptxGenJS) : le HTML reste la source. `fidelity` (défaut) : une image haute
  résolution par slide, rendu identique ; `editable` : les visuels forment l'image de fond rendue sans textes, chaque
  bloc de texte devient une zone PowerPoint native (police, corps, graisse, couleur, alignement, mots en gras
  conservés) ; un texte pivoté ou dans un graphique reste dans l'image. Les notes de l'orateur suivent. L'export ne
  modifie jamais le HTML et ne redemande rien à l'IA.

Une page de l'**ancien moteur** (arbre v1, `isAuthoredSpec(spec) === false`) ne se rejoue pas : elle est réécrite.

---

## 16. Les modèles et les crans

Le cran (`low`, `medium`, `high`, `ultra`) est transmis à l'hôte avec chaque appel ; l'hôte résout le modèle du rôle
sur son **échelle** (`apps/api/api/config/creative-roles.ts`, `MODEL_LADDERS`) :

- `graphic.director` → échelle **design** ;
- `graphic.author` → échelle **code**.

Mêmes étapes, même contexte à tous les crans. Le cran change seulement : le **modèle**, le **plafond de génération**
d'images (High et au-delà), et le **cran au-dessus** employé à la réécriture de correction. Détail dans
[`apps/api/docs/CREATIVITY.md`](apps/api/docs/CREATIVITY.md).

> Journaux : le cran de créativité ne va **jamais** sous la clé `level` d'un journal winston (c'est le niveau du
> journal) — il s'écrit `creativity`.

---

## 17. Économie de jetons et sécurité

**Jetons** (sans brider l'IA) : ce qui dure est écrit une fois (le langage de la marque, relu par tous ses livrables) ;
le plan tient en une ligne par page ; la consigne système est identique pour toutes les pages d'un support (cache du
fournisseur) ; la documentation des outils est donnée à la demande ; les données ne passent **jamais** par le modèle ;
une retouche de texte rejoue la page sans appel. Mesure : `npm run prompt-size`.

**Sécurité** : le HTML écrit par l'IA est **assaini** (ni script, ni gestionnaire d'événement, ni cadre, ni CSS natif,
ni adresse étrangère). Le navigateur de rendu n'ouvre que ce que la **liste blanche** admet (polices, actifs déclarés
par l'hôte, data-URI) et consulte le filtre réseau de l'hôte (anti-SSRF) pour toute autre adresse : un document
n'appelle jamais une adresse arbitraire pendant son rendu.

---

## 18. Mémoire et observabilité

- **`brandMemory`** (port de l'hôte) : le langage visuel de la marque, écrit une fois, relu par tous ses livrables.
- **`recentFingerprints` / `rememberFingerprints`** : les idées déjà employées pour la marque (le prochain document
  fait autrement) ; `doc.remember()` confie l'idée du document à la mémoire.
- **Traces** (`observability/`) : une `GenerationTrace` par page (tâches, appels, jetons, réparations) remontée par le
  port `onTrace` ; un `GenerationRecord` enregistre une génération.

---

## 19. Cartographie des fichiers

| Dossier / fichier | Rôle |
| --- | --- |
| `engine.ts` | l'orchestrateur : `GraphicDocument`, `composeSection`, `author`, `render`, `prepareAssets`, correction bornée |
| `contracts/content-model.ts` | les blocs typés (Zod), `origin` system/model, les familles de blocs |
| `contracts/validate.ts`, `normalize.ts`, `salvage.ts` | validation, normalisation, récupération d'une page rendue par erreur |
| `contracts/design-spec.ts`, `render-result.ts`, `slide-intent.ts` | le `SectionSpec` v2 (code de l'auteur), le `RenderResult`, l'intention de page et les médias |
| `author/prompts.ts` | les trois écrivains : langage de marque, plan, auteur ; retouche et correction |
| `author/model.ts` | l'appel de modèle tracé (`callModel`, `levelUp`) |
| `runtime/content-map.ts` | la matière à plat (clés), retouche de mots, coquille du nom de marque |
| `runtime/expand.ts` | extraire, assainir, remplir ; la racine `.ge-page` |
| `runtime/primitives.ts` | graphiques (Chart.js), tableaux, logo, icônes, motifs |
| `runtime/asset-page.ts` | les pages d'actif dessinées par le code |
| `runtime/tailwind.ts` | la compilation Tailwind côté serveur avec le thème de la marque |
| `runtime/check.ts`, `browser.ts` | le contrôle d'affichage, le Chromium partagé |
| `asset-planner/index.ts` | les médias d'une page : plan, sources dans l'ordre, pose, repli |
| `content/analyze.ts`, `slide-diet.ts` | le volume de texte, le régime des diapositives |
| `design-system/formats.ts`, `tokens/`, `charts/palette.ts`, `kit/motifs.ts` | formats, jetons de marque, palettes de graphiques, motifs |
| `export/pptx.ts` | l'export PowerPoint (fidèle / modifiable) |
| `adapters/idem.ts`, `sections.ts` | charte IDEM → entrée du moteur ; fragment autonome |
| `foundation/` | couleur (contraste lisible), polices, typographie, hash, crans |
| `observability/` | traces et enregistrement d'une génération |

---

## 20. Les livrables branchés sur le moteur

| Livrable | Hôte / service |
| --- | --- |
| Business plan (pages A4 flux) | API IDEM — `BandIdentity/charterComposedPages.ts`, service business plan, `relayout` |
| Charte graphique (pages + couverture) | API IDEM — `charterComposedPages.ts`, pages d'actif |
| Pitch deck | API IDEM — service pitch deck, export PPTX, `relayout` |
| Cartes de visite (2 faces, gabarit `{{champ}}`) | API IDEM |
| Flyers, publications, stories, bannières, avatars | iVision — `visual/visual.composer.ts`, `visual.edit.ts` ; `main-dashboard` éditeur de flyer |
| Graphiques seuls | les deux |

Le port est branché par `apps/api/api/services/graphic/engine.host.ts` (IDEM) et
`apps/ivision/core/src/runtime/host.ts` (cœur iVision).

---

## 21. Contrôles

| Commande | Ce qu'elle prouve |
| --- | --- |
| `npm run check --prefix packages/graphic-engine` | auteur simulé, Chromium : contrat, exactitude, affichage |
| `npm run check:fast --prefix packages/graphic-engine` | les mêmes, sans Chromium |
| `npm run schemas --prefix packages/graphic-engine` | régénère `contracts/*.schema.json` |
| `npm run typecheck --prefix packages/graphic-engine` | les types |
| API : `check:creativity`, `check:roles`, `check:brand`, `check:bpquality`, `check:mockups` | les échelles de modèles, la cohérence de marque, la qualité du business plan, les mockups réseaux (auteur simulé `apps/api/api/scripts/fakeGraphicAuthor.ts`) |

Aucun contrôle ne juge l'esthétique : ils vérifient l'**exactitude**, le **contrat** et l'**affichage**. C'est l'auteur
qui décide de la page.
