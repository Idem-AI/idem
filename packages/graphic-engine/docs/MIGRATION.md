# Migrations du moteur graphique

## 2.6 — le catalogue de gabarits en ligne, à tous les crans (10 novembre 2026)

- **Plus d'écriture libre par défaut, à aucun cran.** Chaque page est assemblée depuis le catalogue (dépôt
  `idem-templates` : 36 squelettes, 8 habillages, 67 composants, 36 gabarits — au moins 5 par élément). Le code
  parcourt le graphe ; le modèle `graphic.template` choisit et met à jour une configuration JSON ; le code assemble,
  rend, mesure et fait tenir. Code : `src/catalog/` ; crans : `CATALOG_EFFORT` (`src/foundation/effort.ts`).
- **Mise à jour sans rebuild** : registre `src/catalog/registry.ts` (dépôt local › MinIO avec ETag › cache disque ›
  `catalog/snapshot.json` › minimum intégré), manifeste signé ed25519, HTML vérifié par son empreinte, nœuds dangereux ou
  porteurs de mots écartés. Publication : CI du dépôt sur push `main`, `npm run publish:local` en local.
- **Modèles** : échelle `catalog` à poids ouverts ; les échelles design/code/vidéo sont revenues à celles du 5 novembre
  (les modèles fermés essayés le 10/11 sont retirés).
- **Retour arrière** : `GRAPHIC_ENGINE_MODE=author` (l'écriture libre 2.5) ; `GRAPHIC_CATALOG_FALLBACK=author` la garde
  comme dernier recours. Les contrôles historiques (`check`, `check:creativity`, `check:relayout`, `check:bpquality`)
  tournent en mode `author` ; le catalogue a le sien, `check:catalog` (rendu Chromium de chaque gabarit).
- **Page gardée** : `SectionSpec.catalog = { version, config }` ; une retouche écrite modifie la configuration.

### 2.6.1 — le business plan imprimé (10 novembre 2026, sur un PDF AgriLink réel)

- **Pages de flux en suite de blocs** (`flowBlocks`, `src/catalog/assemble.ts`) : une unité = un bloc de premier niveau ;
  le squelette garde son caractère par la mesure et le retrait de ses zones larges, une zone étroite passe en pleine
  largeur. Avant : des rangées de zones côte à côte que le paginateur ne coupe jamais (page 2 vide, page 13 réduite à une
  colonne illisible).
- `data-keep-together` sur les blocs compacts, `data-keep-with-next` avant une citation ou hypothèse finale ; espacement
  par marges d'enfants (`*:not-first:mt-[…]`, jamais de `>` dans une classe — refusé par le registre et le dépôt) ;
  images de flux à hauteur explicite ; citation de persona plafonnée comme un texte courant.
- Paginateur (`apps/api/api/services/pdf/flow-pagination.runtime.ts`) : marge de plan de 1,2 %, marge de 3 % à la reprise
  d'une section ; page Chromium fermée même en cas d'échec (`pdf.service.ts`).
- Contrôle : `npm run check:bpcatalog` (apps/api).

### 2.6.2 — le business plan composé en pages A4 par le moteur (11 novembre 2026)

Retour sur un deuxième PDF AgriLink : colonnes étroites, vides inutiles, rangées désordonnées, aperçu différent du PDF.

- **Le moteur compose les pages** (`renderPaged`, `src/catalog/paginate.ts`) : blocs en pleine largeur, mesurés dans
  Chromium, posés sur des pages de 297 mm ; listes coupées entre éléments, tableaux entre rangées (en-tête répété),
  blocs compacts jamais coupés, titre jamais seul en bas, jamais un élément isolé d'un côté d'une coupe.
- **Fin de section gardée** : dernière page < 25 % → la section est repassée jusqu'à 14 % plus serrée ; une page trop
  pleine est resserrée par un `zoom` calculé (pleine largeur gardée).
- **Chiffres trop longs** ramenés à leur case par le code, tous les chiffres d'un bloc à la même échelle (`fitFigures`).
- **Aperçu = PDF** : la section est une suite de `data-ge-page` ; le PDF les imprime telles quelles (`data-paged`),
  l'aperçu les montre en feuilles A4, sans CDN Tailwind. `GRAPHIC_BP_PAGED=0` revient au flux.
- Contrôle : `npm run check:bpcatalog` vérifie aussi l'aperçu (mêmes pages que le PDF, aucune feuille qui déborde).
- Limite : chaque section commence sur une nouvelle page.

### Ce que la 2.6 change, comparé à la 2.5 (estimations du 10/11/2026)

Mesuré sans appel payant : tailles de prompt (`estimateTokens`) sur un deck de test, temps de rendu côté code (modèle
simulé), rendu réel des 36 gabarits. **Non mesuré** : jetons et latence réels des modèles, qualité jugée par des
humains — à confirmer sur de vraies générations.

| | 2.5 (auteur libre) | 2.6 (catalogue) |
|---|---|---|
| Entrée par page | ≈ 1 600 jetons (auteur) + directeur de page, plan de grille, zones aux crans High/Ultra | ≈ 300 (Medium), 560 (High), 870 (Ultra) ; 0 au cran Low |
| Sortie par page | ≈ 3 000 à 6 000 jetons de HTML (+ raisonnement en High/Ultra), plus les réparations | ≈ 60 à 250 jetons de JSON |
| Appels par page | 1 (Low/Medium) à 4–6 (High/Ultra : directeur, grille, zones, retouche, juge) | 0 (Low), 1 (Medium à Ultra) + 1 habillage par document (High/Ultra) |
| Temps par page | dominé par la génération : ≈ 30 à 90 s par page (sortie longue) | rendu code ≈ 2 s (Low/Medium), 4 s (High), 8 s (Ultra) + un appel court (≈ 1 à 4 s) |
| Échecs de rendu | corrections bornées, puis page en erreur ou livrée signalée | candidat suivant, squelette intégré, puis réduction forcée : jamais perdue faute de place |
| Reproductibilité | une même graine ne refait pas la même page | Low : identique pour une même graine ; retouche = configuration |
| Variété | élevée en théorie, mais « mêmes layouts » constatés le 29/10 | combinatoire mesurée : 18 combinaisons différentes sur 24 marques pour une même page ; plafonnée par la taille du catalogue |
| Plafond créatif | celui du meilleur modèle | celui du catalogue : il monte avec chaque contribution |

## 2.5 — le travail divisé en petites tâches, sans relecteur (3 novembre 2026)

- **Le relecteur visuel est retiré** (rôle `graphic.reviewer`, port `reviewImage`) : aucun modèle ne relit une
  page — pas de jetons de relecture. La qualité vient de la façon de produire et de la mesure du code.
- **Les pages de document (charte, deck, business plan) se font en petites tâches** (`src/author/zones.ts`) :
  1. l'agent de mise en page (`graphic.layout`, échelle « design ») invente la grille et les zones de la page en
     suivant la grammaire de la direction artistique — un plan JSON, aucun gabarit ;
  2. le code vérifie le plan : zones dans la grille, aucune zone sur une autre (cellule en cause renvoyée à
     l'agent, un second essai), chaque contenu placé une fois ;
  3. un agent par zone (`graphic.zone`, échelle « code »), en parallèle, écrit SA zone : sa taille exacte, ses
     seules clés, l'échelle typographique de la page (la même pour toutes les zones) ;
  4. le code assemble les zones sur la grille (chevauchement impossible) et réduit une zone qui déborde
     (`zone_fit`) ; un défaut restant part à la correction bornée à partir de la page assemblée.
  Un plan ou une zone qui n'aboutit pas : l'auteur unique prend la page. La couverture (Ultra, liberté entière),
  la retouche écrite, le modèle du client, les visuels et les cartes restent à l'auteur unique.

## 2.4.1 — la direction artistique d'abord (30 octobre 2026)

- **Charte** : la direction artistique, sa grammaire de composition, son traitement de l'image, ses principes et les
  motifs sont composés AVANT toutes les autres pages (`charterGenerationOrder`, `CHARTER_FOUNDATION_PAGES`) ; les
  autres pages les attendent sans relire leur HTML. L'ordre d'affichage ne change pas.
- **Respect de la direction** : l'auteur, le plan et le directeur de page reçoivent le langage de la marque ET la
  grammaire complète de la direction (le résumé seul en perdait le geste signature, les recettes et les interdits),
  plus son traitement de l'image.
- **Motifs** : dessinés à partir des éléments graphiques, du geste signature et du traitement de la direction ;
  renouvelés quand elle change (empreinte de la direction dans la clé).

## 2.4 — la chaîne de qualité : relecteur visuel, ajustement par le code, mesures vérifiées sur de vrais rendus (30 octobre 2026)

Les versions 2.3.x n'étaient vérifiées qu'avec un auteur SIMULÉ : plusieurs mesures étaient muettes sans le dire
(expressions régulières dont les « \\d » avaient perdu leur barre, racine de page prise pour un motif), et les vrais
modèles débordaient de la toile sans savoir corriger. Cette version a été validée sur de vrais rendus
(`npm run sample:graphic`, trois échantillons de quatre pages). Chaque page passe par :

1. le **directeur de page** (`graphic.page-director`) : point focal, zones, groupes — sauf la couverture ;
2. l'**auteur** (`graphic.author`) ; la **couverture** au rôle `graphic.cover`, TOUJOURS au cran Ultra, budget de
   24 000 jetons, consigne de liberté entière ;
3. la **mesure du code** (`runtime/check.ts`) : en plus de 2.3 — un texte simple composé comme un titre (rôle de
   chaque clé, `data-ge-k`), un nuancier écrit mais pas peint, un logo « fond sombre » sur fond clair, une page
   sombre, une image coupée par le bord, une déclinaison absente, un titre absent, un texte à cheval sur un aplat,
   des chiffres de tableau coupés sur deux lignes ; débris de code et icônes non demandées retirés ;
4. l'**ajustement par le code** : un contenu qui déborde d'une toile fixe est réduit à l'échelle exacte
   (`[zoom:…]`, plancher 0,6) sans appel de modèle ;
5. ~~le relecteur visuel~~ — retiré en 2.5 (coût de relecture refusé) ; les graphiques restent dessinés dans les
   aperçus (Chart.js, port `chartScript`).

Images : générées à tous les crans quand une page en appelle une (`GENERATION_CAP` 2/3/5/8), stockées dans le
dossier du projet, posées par leur adresse. Aucun appel payant sous un script `check*` (`GRAPHIC_OFFLINE`).

## 2.3.2 — le PDF du business plan comme l'aperçu (30 octobre 2026)

- **Couleurs perdues et décalage à droite** : le découpage en pages du PDF (`flow-pagination.runtime.ts`) remplace
  chaque flux de section par ses pages ; la feuille compilée de la page (`<style data-ge-tailwind>`) et ses polices
  partaient avec lui. Le PDF sortait au Tailwind générique (v3, sans le thème de la marque), mesuré avec une feuille
  et imprimé avec une autre. Les feuilles sont désormais remontées dans `<head>` avant le découpage, et le Tailwind
  générique n'est plus chargé quand toutes les pages viennent du moteur. Contrôle : `check:bpquality`.
- **Couverture** : composée sur la page A4 FIXE (`page-a4`) dans un document en flux — elle occupe toute la page.
- Une section en échec (« régénérer ») n'est plus imprimée dans le PDF livré ; les caches des PDF changent de clé
  (`*-pdf-r2`) pour ne plus resservir l'ancien rendu ; légende d'un camembert sous le graphique quand ses libellés
  sont longs.

## 2.3.1 — couvertures, mots du contenu seul, lisibilité, images de la charte (30 octobre 2026)

Sur un second jeu AgriLink (business plan et charte) :

- **Les mots viennent du contenu** (`stripInventedText`) : tout texte écrit en dur par l'auteur (« SYS-1 »,
  « SIGNATURE AGRILINK », « Exemple de citation », initiales d'avatars) est retiré par le code ; une boucle
  `{{#each}}` renvoie la page à l'auteur.
- **Lisibilité mesurée** : un paragraphe long composé à la taille d'un titre, ou serré dans une colonne étroite
  (il s'étirait sur cinq pages du PDF), un texte posé sur un mockup, un graphique ou un logo — renvoyés à l'auteur.
  Une carte vide avec une seule pastille d'icône compte comme un cadre vide ; un grand aplat de couleur de la marque,
  non.
- **Graphiques sans information** (toutes les valeurs égales, « TAM = SAM = SOM ») : non montrés.
- **Couvertures** : une image du monde de la marque (`coverContent({ image })`, crans High et Ultra ou image du
  projet) et une consigne de création propre à la couverture — jamais un petit texte centré sur une page vide.
- **Images au traitement de la charte** (`DirectionInput.imagery`, `imageryMedium`) : le générateur reçoit le
  médium et la consigne d'image de la direction artistique ; une marque non photographique ne reçoit jamais de
  photo de banque.
- **Charte** : plus de texte coupé par « … » (une proposition entière ou rien), plus de chapô sur les pages de
  principes et d'image, trois points courts au plus à côté du logo, règles d'usage écrites avec les vraies polices
  et couleurs.
- **Finance** : un TRI sans flux positif est « non calculable » (il affichait 93 796 583 380 %) ; un point mort
  au-delà de l'exercice est dit « non atteint ».

## 2.3 — travail divisé, ordre mesuré, l'essentiel et les graphiques garantis (30 octobre 2026)

Sur des livrables réels (AgriLink, cran Ultra) : textes superposés, logos rognés, cadres et pastilles vides, faux
schémas, slide « Financials » vide, et un business plan sans aucun graphique. Sans revenir aux gabarits :

- **Directeur de page** (`graphic.page-director`, échelle « design ») : avant l'auteur, une petite tâche par page
  (point focal, zones, groupes, erreur à éviter) ; l'auteur construit la hiérarchie décidée.
- **Ordre mesuré** (`runtime/check.ts`, `QUALITY`) : texte sur texte, actif rogné, absent ou minuscule, cadres
  vides, semis décoratif, graphique ou tableau oublié — renvoyés à l'auteur, livrés signalés en dernier recours.
- **L'essentiel rétabli sur le contenu** (deck et charte) : `slideEssentials`, budgets resserrés, briefs de slides à
  deux blocs, pages de spécimens sans texte rédigé, règles d'usage en quatre points ; consigne de l'auteur sobre.
  Les gabarits de pages d'actif restent retirés.
- **Chiffres** : `figuresOnly` (un chiffre-clé sans chiffre n'est pas montré) ; `withDataChart` (une section de
  business plan sans graphique reçoit celui de son tableau de chiffres, mêmes valeurs, Chart.js).
- **Business plan** : le chemin de recherche pose enfin les blocs du module Finance (graphique, compte
  d'exploitation…) ; trois sections au plus appellent une image du projet ou faite pour lui (crans High et Ultra),
  jamais une banque d'images. **Deck** : la slide « Financials » reçoit le graphique et trois chiffres du module
  Finance.

## 2.2.1 — retour à la composition libre (30 octobre 2026)

Retour à la logique du 15/10/2026 à 0 h 42 (`1231240c5`) : l'IA compose chaque page, le cran choisit le modèle
(`graphic.director` sur l'échelle « design », `graphic.author` sur l'échelle « code »), aucun gabarit. Retirés :

- le gabarit des pages d'actif (`runtime/asset-page.ts`) : logo, déclinaisons, motifs, palette, typographie et
  mockups repassent par l'auteur, avec leurs outils exacts ;
- la consigne « sobre et essentielle » (un seul signe graphique par page, aucun sur une page d'actif) et le
  langage de marque qui ramenait tout style expressif à des règles sobres ;
- côté API : les pages de spécimen sans texte de la charte, les textes de direction artistique coupés à
  60 signes, les règles d'usage réduites à 4 cartes, le régime des slides (`slideEssentials`, 2 blocs, sans
  chapô) et les budgets de texte resserrés ; les consignes de disposition de la carte de visite.

Gardé : les corrections faites depuis (Chart.js, adresses jamais imprimées, indications techniques sans clé,
tuiles de motif réelles, galerie de mockups, texte recouvert détecté, taille du logo selon la toile, modèle du
client, recherche gardée du business plan). La version 3 (grammaire d'archétypes) reste sur sa branche
`feat/graphic-engine-v3`, non fusionnée.

## 2.2 — retouche et remise en page sans réécriture, export PowerPoint (15 octobre 2026)

- Le document garde le contenu et le code de chaque page (`page(id)`) ; IDEM les enregistre dans
  `SectionModel.composition` (business plan, pitch deck).
- La retouche par instruction d'une page (`POST …/sections/:id/ai-edit`) passe par le moteur : mots par clé et page
  rejouée, forme par l'auteur ; l'ancienne réécriture du HTML ne sert plus qu'aux pages sans contenu gardé — sans
  la feuille compilée envoyée au modèle, et feuille recompilée au retour (les classes ajoutées s'affichaient mal).
- Nouvelle mise en page : `POST /businessPlans/:projectId/relayout`, `POST /pitchDecks/:projectId/relayout`
  (`{ creativity, note }`) — 25 et 12 crédits × le cran.
- Export PowerPoint du deck : `GET /pitchDecks/pptx/:projectId?mode=fidelity|editable` (PptxGenJS 4.0.1).

## 2.1 — langage de marque, plan de document, rendu professionnel (14 octobre 2026)

- Le directeur écrit le **langage visuel de la marque** une fois par charte (port `brandMemory` : Redis chez IDEM,
  Mongo `brand_memory` chez iVision) ; tous les livrables le relisent, flyers et cartes compris.
- Pour un document de plusieurs pages, il écrit un **plan** (une idée, une ligne par page, à partir de ce que chaque
  page doit faire : `sections[].purpose`) au lieu d'une bible ; chaque page reçoit sa ligne et celles de ses voisines.
- Consigne **professionnelle** (aucune décoration gratuite), consigne système stable, outils documentés à la demande,
  HTML compact ; graphiques : `data-type` et `data-highlight`.
- Entrée par page ≈ −18 % (`npm run prompt-size`), plus le cache de la consigne système et un appel de directeur
  par marque au lieu d'un par document pour les pages seules.

## 2.0 — l'IA écrit les pages en Tailwind (14 octobre 2026)

Même philosophie que le moteur vidéo Motion Canvas : **l'IA conçoit librement, le code garantit
l'exactitude et l'affichage, la jauge choisit le modèle**.

| | 1.x | 2.0 |
|---|---|---|
| Qui compose | le code (motifs classés, menus) ; l'IA choisit, règle ou écrit un ARBRE de primitives selon le cran | l'IA, à tous les crans : un directeur écrit la bible du document, un auteur écrit chaque page en HTML Tailwind |
| Le cran | décide qui compose et combien de révisions | choisit le MODÈLE (`graphic.director` sur l'échelle « design », `graphic.author` sur l'échelle « code ») |
| Le style | compilé par le moteur, en ligne, depuis des jetons | classes Tailwind de l'auteur, compilées côté serveur avec le thème de la marque ; CSS natif interdit (retiré et signalé) |
| Contrôles | mesure, ajustement au pixel, contraste, décors, repli sur la composition suivante, réparation ciblée, critique visuelle, révisions | **un seul** : la page s'affiche-t-elle ? Sinon correction bornée (corriger › réécrire au cran au-dessus › minimale), puis `GraphicRenderError` |
| Textes et chiffres | désignés par référence dans l'arbre | placés par l'auteur par leurs clés `{{…}}`, remplis par le code |
| Graphiques, tableaux | composants du compilateur | primitives `<idem-chart>`, `<idem-table>` dessinées par le code ; `<idem-logo>`, `<idem-icon>`, `<idem-pattern>` |
| Page gardée (`SectionSpec`) | v1 : l'arbre | v2 : le code de l'auteur (rejoué sans modèle pour une retouche de texte ; donné à l'auteur pour une retouche de forme) |
| Crans | Low, Medium, High, Max, Ultra | Low, Medium, High, Ultra (« max » gardé = High) |

Supprimé : `composition-engine/` (sauf l'analyse de texte, déplacée dans `content/`), `design-system/components`,
`design-system/patterns`, `design-system/look.ts`, `design-system/kit/shapes.ts`, `html-css-compiler/`,
`quality-engine/` (mesure et réparation ; le navigateur est passé dans `runtime/browser.ts`), `orchestrator/`,
`capability-registry/` (sauf les icônes locales) et son client MCP, les agents `creative-planner`, `critic`,
`targeted-repair`, `spec-edit`, `logo-guard`, `content-planner` ; les rôles `graphic.artDirector`,
`visual.critic`, `generation.repair` ; le port `analyzeImage` ; les scripts `benchmark`, `preview`,
`mcp-sync` et les contrôles API `checkCovers`, `previewCharterPages`. Côté services : la réécriture
automatique des slides trop textuelles (`slide-condense`) et le déplacement vers les notes, la grille
`verifySection` sur les pages du moteur, la retouche des visuels par opérations sur l'arbre
(`applySpecOps`).

Une page gardée en v1 ne se rejoue plus : elle est réécrite à la retouche suivante.

## 1.0 — Migration vers @idem/graphic-engine (octobre 2026)

L'ancienne génération graphique d'IDEM — un modèle qui écrivait le HTML des pages, des posters et des
cartes, puis des linters et des réparateurs qui tentaient de rattraper ce qu'il avait produit — est
**entièrement retirée**. Business plan, charte graphique, pitch deck, cartes de visite et visuels passent
désormais par un seul moteur, ce paquet. Repère de retour : le tag git `pre-graphic-engine-migration`.

## Ce qui a changé, livrable par livrable

| Livrable | Avant | Maintenant |
|---|---|---|
| Business plan | rédacteur → gabarits `sectionRenderer` (60 familles), et au-dessus de Medium un compositeur qui écrivait la page en HTML (`pageComposer`, `pageInspect`) | rédacteur → blocs (`contentContract`) → page composée par le moteur (A4 portrait, paginée), au cran demandé |
| Pitch deck | idem en 16:9, plus des passes de « polissage » et d'images par slide | idem (`slide-16x9`) ; aucune passe qui réécrit la page |
| Charte graphique | pages libres en HTML écrites par le modèle (logo, palette, typographie…) + gabarits | pages rédigées : spécimens posés par le code + texte d'usage ; pages de direction artistique et réseaux entièrement posées par le code ; couverture par le moteur |
| Cartes de visite | six rectos / cinq versos du code (`businessCardLayouts`) et cartes d'auteur en HTML | six rectos / quatre versos du moteur, gabarit à marqueurs, plancher d'impression 8,5 px, champs ajustés à l'export et dans l'aperçu |
| Visuels (Communication, iVision) | moteur de posters (`visual/poster/*` : gabarits, mise en page IA, HTML d'auteur, boucle de conception) | mots et photo dans le cœur iVision, page par le moteur (`renderSingle`, toiles `flyer-*`) ; retouche écrite = mots seulement |
| Bannières et avatars de la charte | `bannerCompose`, `bannerTemplates` | motifs `banner.*` / `avatar.*` du moteur |
| Rapport financier | thème recalculé localement | thème lu dans les jetons du moteur (`Finance/finance-theme.ts`) : mêmes couleurs et polices que le business plan |

## Ce qui a été supprimé

- API : `services/design/*` (graine, familles, rendu par gabarit, couverture, linter anti-générique, retenue
  éditoriale, contrat de contenu, plan de section, récupération HTML), `services/creativity/{documentDesign,
  pageComposer, pageInspect}.ts`, les prompts HTML du business plan, du deck et de la charte, les
  mises en page et agents des cartes, les gabarits de bannières, les rendus de flyers.
- Cœur iVision : `visual/poster/*` et son kit, `visual/flyer.*`, `design/{compositionGrid, visualAudit,
  slopLint, layoutFamilies, layoutPresets, pageDecor, uiKit, designSeed, antiSlop.prompt, diagramRender,
  diagramTheme}`, le contrôle `check:poster`.
- Données mortes du catalogue des directions artistiques (`seedSpace`, `tailwindRecipe`, `typePairings`,
  `antiPatterns`, `borders`, `shadows`) et les blocs de prompts qui ne servaient qu'à l'ancien HTML
  (`buildArtDirectionBlock`, `buildLogoBlock`, `buildStyleSheet`).
- Les contrôles de l'ancien moteur (`check:render`, `check:fit`, `check:flyer`) ; les autres ont été
  réécrits sur le moteur (`check:design`, `check:uniqueness`, `check:prompts`, `check:salvage`,
  `check:brand`, `check:covers`, `check:mockups`, `check:bpquality`, `check:creativity`), et
  `check:graphic` lance les contrôles du moteur.

Les règles d'écriture qui portaient sur le TEXTE ont été gardées et rassemblées dans `WRITING_RULES`
(vocabulaire banni, remplissage, références et chiffres inventés, grandiloquence).

## Les documents déjà produits

- Ils restent lisibles, éditables et imprimables. Le service PDF et l'éditeur de documents chargent
  toujours Tailwind pour l'ancien HTML ; une page du moteur porte ses styles en ligne et ses polices dans
  son en-tête, et son rendu est identique avec ou sans Tailwind (mesuré). Le rendu des cartes et celui
  des visuels reconnaissent une page du moteur (`class="ge-page"`) et n'injectent Tailwind que pour les
  anciennes.
- Un changement d'identité les traduit comme avant (`services/brand/brandRewrite.ts`). Pour les pages du
  moteur, la traduction refait aussi les couleurs DÉRIVÉES (un mélange exact de deux jetons, une
  variante de clarté d'un jeton) et RECALCULE la palette des graphiques pour la nouvelle marque.
- Une régénération recompose avec le moteur.

## Ce que le moteur a corrigé au passage

- Le paginateur du PDF coupe désormais à travers une enveloppe à enfant unique (marges, grilles, mesure
  de lecture) : un long texte n'est plus déplacé entier puis réduit sur la page suivante.
- Le pied de section d'une page du moteur est une rangée marquée : seul sur une page, il est retiré.
- Un texte trop pâle sur son fond réel est ramené vers l'encre de la charte (`fix_contrast`), au lieu
  d'être livré illisible.
- Deux pages voisines ne reçoivent jamais la même composition.

## Déploiement

- Paquet du workspace racine (`packages/graphic-engine`), présent dans `package-lock.json`.
- Les applications compilent ses sources (`paths` vers `src/index.ts`) ; les images de production
  (`Dockerfile/prod/Dockerfile.api`, `Dockerfile.ivision-api`) copient la version compilée dans
  `node_modules/@idem/graphic-engine`.
- L'API branche le moteur dans `services/graphic/engine.host.ts` : le Chromium partagé du service PDF, la
  garde réseau des rendus, Redis pour la mémoire de diversité (30 jours), les traces `graphic.trace`.

## Vérifier

```bash
npm run check:graphic-engine            # le moteur (Chromium compris)
cd apps/api && npm run check:all        # l'API, dont les livrables graphiques
cd apps/ivision/core && npm run check   # le cœur iVision, dont un visuel composé par le moteur
```

Le banc d'essai (`npm run bench`, `docs/BENCHMARK.md`) compare l'ancien moteur et celui-ci, par cran :
appels de modèle, jetons, temps de rendu, constats et réparations.
