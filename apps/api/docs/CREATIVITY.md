# La jauge de créativité

Avant chaque génération, l'utilisateur règle la part de décisions confiée à l'IA. Le réglage vaut pour six livrables : vidéo motion, visuels et flyers, carte de visite, pitch deck, business plan et identité visuelle.

Les cinq crans reprennent ceux de l'effort d'un modèle : **Low · Medium · High · Max · Ultra**.

## Le principe : une échelle de délégation

Chaque livrable se découpe en cinq couches de décision. Le cran fixe à partir de quelle couche l'IA décide. En dessous, c'est le code qui décide : graphe de capacités, gabarits, graine déterministe. Il le fait toujours à partir de la charte et de sa direction artistique (DA).

| Couche | Low | Medium | High | Max | Ultra |
|---|---|---|---|---|---|
| Contenu (textes) | IA | IA | IA | IA | IA |
| Structure (sections, scènes, slides) | code | **IA, menu** | IA, menu | IA, menu | IA |
| Choix de composition (par unité) | code | code | **IA, menu filtré DA** | IA, menu | IA |
| Paramètres de composition | code | code | code | **IA, bornes** | IA |
| Écriture de la composition | code | code | code | code | **IA + contrôles, repli Max** |

Les bonnes pratiques valent à **tous** les crans, parce qu'elles sont dans le code, pas dans le prompt :

- **vidéo** : lisibilité, tenues, contraste, zones de sécurité, rythme ;
- **documents** : gabarits non remplis, troncature, devise ;
- **visuels et cartes** : texte rogné, fond perdu, contraste ;
- **logo** : validité du SVG.

Ce que la DA exclut n'est jamais proposé à un agent : les menus sont filtrés par le code.

## Prix

Une source unique, partagée par l'API et le tableau de bord : `packages/shared-models/src/creativity/creativity.ts`.

| Cran | Multiplicateur | Business plan (70) | Vidéo 15 s (120) |
|---|---|---|---|
| Low | ×1 | 70 | 120 |
| Medium (par défaut) | ×1 | 70 | 120 |
| High | ×1,25 | 88 | 150 |
| Max | ×1,5 | 105 | 180 |
| Ultra | ×2 | 140 | 240 |

`withCreativity()` (`api/middleware/billing.middleware.ts`) enveloppe le barème habituel de chaque route de génération : prix fixe, `firstThenRevision` ou périmètre de la vidéo. Il lit `creativity` dans le corps de la requête, ou dans l'URL pour les flux en GET, et inscrit le cran au relevé (`note: creativity:<cran>`).

Les révisions ne sont pas concernées. L'export d'une vidéo à un périmètre plus large applique le cran choisi à la création.

## L'orchestrateur (`api/services/creativity/orchestrator.ts`)

Un livrable déclare des **tâches étroites**. Chacune porte :

- `minLevel` : le cran à partir duquel l'IA décide ;
- un prompt court ;
- `parse`, qui lit **et** valide la réponse ;
- `fallback`, la décision du code ;
- éventuellement `samples` et `score`, pour tirer plusieurs réponses en parallèle et départager les candidats par le code, jamais par un juge IA. Seule exception, le logo (voir plus bas) : l'esthétique d'un symbole ne se mesure pas, un jury départage donc les brouillons qui ont passé `svgGate`.

L'orchestrateur garantit :

- qu'aucune tâche au-dessus du cran ne part chez le modèle ;
- qu'un agent en panne, lent, muet ou inventif cède la place au repli, sans jamais d'erreur ;
- qu'une réponse illisible fait monter le modèle d'un étage, une seule fois, via `agents/agent-runtime.ts#runAgent` ;
- le respect du budget du livrable, la trace de chaque agent (`agents[]`) et les événements de progression.

Trois profils de modèle sont définis dans `AI_CONFIG.creative` :

- `agents` : un choix dans un menu ;
- `critic` : une relecture qui propose au plus cinq corrections ;
- `coder` : l'écriture de la composition, au cran Ultra.

Les lecteurs de réponse sont communs (`creativity/agent-io.ts`) :

- lignes `clé: valeur` ;
- choix par lettre ou par identifiant ;
- JSON, gras, puces ;
- nombres bornés.

S'y ajoute la **fiche de marque** (`brandSheet`) : couleurs, polices, DA, à faire et à éviter.

## Vidéo motion

| Cran | Ce que l'IA décide | Étage du modèle |
|---|---|---|
| Low | les textes (rédacteur). Concept, scènes, motifs (donc mises en page), transitions et musique viennent du graphe et du moteur créatif : créativité algorithmique, 5 % d'exploration. | flashx |
| Medium | + le stratège (concept, scènes, grand moment, rythme), **même quand le type de vidéo est imposé** (choix explicite, calendrier : il choisit DANS ce type), et le sound designer (piste, intensité des effets). | rédaction |
| High | + un directeur artistique par scène (il choisit le **motif** parmi 3 à 5 classés par le moteur créatif, résolu en mise en page parmi 17 et en entrée de titre), l'animateur (transitions coupe par coupe parmi 17, entrées, caméra, logo) et le critique. 25 % d'exploration. | rédaction |
| Max | + la **direction créative** parmi trois (signature, contraste, exploration : ADN et famille de l'accent), choisie par le stratège ; des paramètres bornés par scène : taille des titres de 0,85 à 1,25, alignement, surface parmi celles de la stratégie de couleur de la DA, tempo, décor. Accroche et grand moment sont tirés trois fois et départagés par le score créatif ; le critique corrige aussi taille et tempo. 40 % d'exploration. | stratège au raisonnement |
| Ultra | **le film d'auteur** : l'IA invente et crée tout le film (ci-dessous). | raisonnement |

**Un seul moteur créatif pour les cinq crans** ([VIDEO_ENGINE.md §17](VIDEO_ENGINE.md#17-le-moteur-créatif)). Medium, High, Max et Ultra ne sont pas quatre architectures : ce sont quatre niveaux de délégation sur la même recherche dans l'espace des motifs (intention → capacité → motif → outil → primitive). Le planificateur, sans aucun token, choisit un motif par scène au score créatif (pertinence, qualité apprise, nouveauté pour la marque, fidélité, faisabilité), garde un ADN de mouvement et pose un accent sur une scène. Le cran fixe la part d'exploration (Low 5 % → Ultra 70 %) et qui décide : le planificateur en Low et Medium ; l'agent parmi ses 3 à 5 meilleurs motifs dès High ; la direction créative parmi trois au cran Max ; le directeur, dans l'univers créatif, au cran Ultra. Chaque vidéo a son empreinte : aucune n'est rendue à moins de 0,30 de la vidéo la plus proche de la marque (le contrôle créatif la répare).

Les appels vidéo sont retentés une fois sur panne passagère ou réponse vide (`communication.service.ts#runVideoTieredPrompt`) : un agent en repli ramenait la vidéo aux choix du code, et les crans finissaient par se ressembler. Le résultat dit ce que l'IA a décidé : le détail d'une vidéo affiche « décidé par l'IA : textes, structure, mises en page… », ou, en Ultra, « Film d'auteur · 7 plans sur 7 créés par l'IA ».

### Le film d'auteur (`video.author.ts`)

Plus aucun menu. Les médias, la musique et les effets viennent des étapes existantes du service.

1. **Le directeur** (étage raisonnement) invente le film : un concept, une « bible » (signature de mouvement, usage des couleurs, typographie) et chaque plan. Pour chaque plan, il écrit la durée, les textes, ce qu'on voit et comment ça bouge, les outils, le média, le passage au plan suivant et son **motif** (`PATTERN:`), ou une exploration (`PATTERN: explore A+B`). Il connaît les outils du moteur, et reçoit l'**univers créatif** (≈ 260 tokens) : motifs par famille, ceux que la marque vient d'utiliser, les sous-explorés, des combinaisons compatibles, l'ADN, l'accent et le budget d'exploration (70 %). Le code ne fait que **valider** :
   - durées au temps de lecture du moteur (`video.rules.ts#requiredHold`) et somme exacte ;
   - longueurs ;
   - aucun chiffre absent du brief (`isGrounded`), contact copié du brief ;
   - une signature à la fin.

   Un film trop dense perd d'abord ses plans de texte du milieu ; l'ouverture et la signature restent toujours, l'appel à l'action ne part qu'en dernier recours. Deux échecs du directeur : la création reprend le pipeline des menus.
2. **Un codeur par plan** (trois en parallèle) écrit le composant React du plan. Il ne reçoit que le cœur du manifeste du kit et les briques du motif de son plan (`scopedKitManifest` : ≈ 1 170 tokens au lieu de 1 710 pour un plan typographique, à chaque tour), avec la consigne du motif ; sans motif reconnu, tout le kit (`KIT_MANIFEST`). Son entrée et sa sortie font la transition imaginée par le directeur ; le moteur coupe franc entre les plans. Un plan qui explore passe une validation renforcée : un tour de plus et la critique visuelle relit aussi le dernier tour.
3. **La boucle de qualité**, trois tours au plus :
   - lint (dont les noms importés du kit) ;
   - compilation ;
   - rendu réel mesuré (`inspectRenderedScene` : erreurs, textes visibles et dans le cadre, mouvement, déterminisme, **chiffres des graphiques issus des textes**) ;
   - **critique visuelle** : une planche de trois images du plan envoyée au modèle de vision (`glm-media.service.ts#analyzeImage`), qui juge lisibilité, composition, fidélité à la charte et effet « modèle tout fait ».

   Défauts et critique repartent au codeur. Un plan qui échoue trois fois aux contrôles reprend la composition éprouvée de sa scène (`statement`, `cta` ou `logo`), et le résultat le dit.
4. **Retouches** : un film d'auteur garde le minutage de son directeur (ni `retime`, ni règles du graphe) ; les plans codés lisent leurs cases, une retouche de texte s'y affiche.

L'ancien codeur de scènes (`video.coder.ts#codeScenes`) reste le repli du film d'auteur quand le directeur échoue.

### Le code écrit par l'IA (`video.coder.ts`)

1. **Prompt** : la fiche de marque et le **manifeste du kit** (`KIT_MANIFEST`), c'est-à-dire tout ce que l'agent peut importer de `@idem/kit` :
   - les hooks de temps et de scène ;
   - la typographie ajustée (`Kinetic`, `Odometer`) ;
   - les entrées (`useEnter`), les sons (`cue`), les icônes, le logo animé ;
   - les graphiques et le dessin : `ChartJs`, `useViz` (visx + d3), `DataArc`, `GrowArea`, `AfricaMap`, `Sketch`, `Brush`, `useNoise`, `FlowField`, `Flat3D` ; les chiffres par `numbersIn` ;
   - les variables de la charte et les règles du moteur.

   Le kit est exposé par `video-engine/src/kit-api.ts` ; les addons qu'un plan importe sont chargés au montage (`addonsOfSceneCode`).
2. **Lint** sur l'arbre syntaxique (acorn). Sont refusés :
   - les imports autres que `@idem/kit` et `react`, et les noms que le kit n'exporte pas ;
   - les globaux libres (`window`, `document`, `fetch`, `Date`…) ;
   - `Math.random`, `constructor`, `__proto__` et les accès calculés par chaîne ;
   - l'état et les effets React ;
   - les boucles `while` et les `for` non bornés ;
   - la CSS animée et la 3D CSS ;
   - les URL, les textes écrits en dur, les cases jamais affichées.
3. **Compilation** esbuild, de TSX vers CommonJS. Le moteur l'évalue avec `require` limité au kit et à React.
4. **Rendu de contrôle** sur la page réelle, avec le garde réseau strict.

**Sécurité.** Le lint garantit un code pur. La frontière de sécurité, elle, n'en dépend pas :

- la page de rendu ne donne accès à aucune API Node ;
- le garde réseau strict ne laisse passer que les données embarquées et le stockage ;
- une **CSP** limite le réseau aux origines déjà présentes dans les données de la page ;
- l'aperçu du tableau de bord tourne dans une iframe `sandbox="allow-scripts"`, d'origine opaque.

Une scène qui lève une erreur au rendu retombe sur sa composition (`SceneBoundary`).

## Visuels et flyers (`Communication/flyerLayouts.ts`, `flyerCreative.ts`)

Douze compositions dessinées par le code (photo pleine page, bandeau, cadre, diagonale, citation…), rendues aux couleurs et aux polices de la charte. La DA retire du menu ce qu'elle exclut.

| Cran | Ce que l'IA décide |
|---|---|
| Low | les mots (rédacteur, sans chiffre inventé). Le code choisit la composition par la graine. |
| Medium | + la structure (quels éléments le visuel porte). |
| High | + la composition dans le menu, le mot mis en valeur, le brief de l'image. |
| Max | + l'écriture du HTML dans la grille de composition calculée (pipeline historique). |
| Ultra | + un concept, deux compositions écrites en parallèle ; la meilleure est gardée d'après le contrôle mesuré (`design/visualAudit.ts`). |

Tous les crans passent par `applyDesignLint`, `ensureLogoPresence` et `auditAndRepairVisual`.

## Carte de visite (`BandIdentity/businessCardLayouts.ts`, `businessCardCreative.ts`)

Six rectos et cinq versos composés par le code, à partir des déclinaisons du logo, des jetons de la charte et des champs `{{…}}`.

| Cran | Ce que l'IA décide |
|---|---|
| Low | rien : le code choisit structure et faces. |
| Medium | la structure (ce que porte chaque face). |
| High | + le recto et le verso dans les menus de la structure. |
| Max | + couleur de la face de marque, alignement, filet, taille du nom (bornés). |
| Ultra | + un concept, puis les deux faces écrites en HTML ; repli sur la composition du code si le contrôle d'impression échoue. |

Le contrôle d'impression (`businessCardRender.service.ts#inspect`) mesure la face rendue avec des valeurs longues : marge de sécurité de 4 mm, corps ≥ 7 pt, contraste ≥ 4,5:1.

## Documents : business plan, pitch deck, charte graphique

Le moteur commun (`common/generic.service.ts`) rend chaque page par gabarit : le modèle écrit le contenu, le code la page. La jauge confie la direction artistique des pages aux agents (`creativity/documentDesign.ts`), toujours dans l'espace du style de la DA.

| Cran | Ce que l'IA décide |
|---|---|
| Low | le contenu. La graine décide de la mise en page (comportement historique). |
| Medium | + la famille de mise en page du document (ouvertures, pieds, dessin des blocs) ; elle s'applique aussi au design system. |
| High | + l'archétype de chaque page, jamais celui de sa voisine. |
| Max | + densité, tension et place de l'image de chaque page ; un critique relit le rythme du document (trois échanges au plus). |
| Ultra | + le **compositeur** écrit la page en HTML à partir du contenu validé. |

### Le compositeur (`creativity/pageComposer.ts`)

Deux agents distincts : le rédacteur écrit et fait valider le contenu (spécimens de la charte compris : nuancier, polices, logos), le compositeur n'écrit que la mise en page. Il passe par le crochet `SectionTemplate.compose`. Une page composée n'est retenue que si :

1. **la forme** passe la grille qualité (`agents/quality-gate.ts`) ;
2. **la fidélité** est tenue : les textes du contenu sont là, aucun chiffre n'est inventé, chaque couleur et chaque image du contenu est posée, aucune autre image n'est appelée ;
3. **le rendu mesuré** au format réel (`creativity/pageInspect.ts`, Chromium) ne trouve rien : diapositive ou page de charte plus haute que sa page, texte hors page ou coupé, corps sous 7 pt, contraste insuffisant ;
4. **les règles de design** sont réparées sur place (`enforceDesignRules`).

Ces contrôles ne sont pas des couperets : **chaque défaut repart au compositeur**, formulé pour être corrigé (« écris ces textes tels quels », « retire ces nombres : 07, 2026 », « pose ces couleurs »), avec sa page précédente, **trois tours au plus**. Ce n'est qu'ensuite que la page est rendue par le gabarit, avec les choix des agents des crans inférieurs. (Avant : la première faute de fidélité jetait la page ; 21 pages de charte Ultra sur 22 retombaient ainsi sur le gabarit.) Couverture et tableaux financiers restent posés par le code à tous les crans.

Deux détails :

- les images du contenu (logos, parfois en `data:` de plusieurs Ko) partent au modèle sous forme de repères `{{IMG_n}}`, que le code remplace par les URL ;
- la mesure charge le Tailwind du rendu PDF (`public/scripts/tailwind.js`) : la page est mesurée avec le moteur qui l'imprimera, sans attendre le CDN.

### Reprise et régénération ciblée

La direction décidée par les agents (cran, famille, réglages des pages) est enregistrée avec le document : `design` sur le business plan et le pitch deck, `branding.charterDesign` pour la charte. Quand des pages sont gardées (reprise après interruption, régénération d'une page), les pages refaites reprennent cette direction sans rappeler les agents. Elles ressemblent ainsi à leurs voisines. Un document antérieur à la jauge reste sur sa graine. Le compositeur, lui, suit le cran de la demande.

## Identité visuelle

### Le logo (`BandIdentity/logoTemplates.ts`, `logoCreative.ts`)

**Le logo est toujours généré au cran Ultra, au prix habituel de la session** (60 crédits, 10 par relance) : pas de jauge sur ses écrans, le contrôleur impose `ultra` quel que soit le point d'entrée (tableau de bord, chat), et ses routes facturent sans multiplicateur (`branding.routes.ts#chargeLogoSession`). L'échelle ci-dessous reste celle du service.

| Cran | Ce que l'IA décide |
|---|---|
| Low | rien : trois logos **composés par le code**. Treize marques (monogrammes, orbite, barres, éclosion, tissage, feuilles…) et cinq wordmarks, aux couleurs de la charte, dans sa police de titre vectorisée, avec le rayon d'angle et les affinités de forme de la DA. |
| Medium | le dessin de chaque proposition en SVG, puis critique et révision (pipeline historique). |
| High | + le **directeur de création** : trois directions distinctes, une par proposition. |
| Max | + deux brouillons par proposition ; ceux qui passent `svgGate` sont départagés par le **jury**. |
| Ultra | + trois brouillons par proposition. |

Le Medium garde le dessin par l'IA : le logo est le cœur de l'identité, et le cran par défaut ne devait pas régresser.

Toutes les propositions passent par le même lockup : le nom est posé sur les vraies métriques de la police (`lockup/logoLockup.service.ts`).

`lockup/wordmark.util.ts#safePathData` écarte les coordonnées non finies qu'opentype.js produit sur certaines polices variables (le « a » de Fraunces). Elles arrêtaient le rendu du chemin et coupaient le nom (« Verd ι »), y compris pour les logos dessinés par l'IA.

### La charte

Elle suit l'échelle des documents. Les pages rédigées (logo, déclinaisons, palette, typographie, motifs, règles d'usage) sont dirigées par les agents, puis composées en Ultra. Les pages de démonstration composées par le code (DA, réseaux sociaux) reçoivent la famille choisie. Les mises en situation restent des photographies.

Palettes et paires typographiques restent des propositions de l'IA parmi lesquelles l'utilisateur choisit. Leur étape n'est pas facturée à la session et ne porte pas de jauge.

## L'interface : le sélecteur de créativité

`shared/components/creativity-picker` : un bouton compact « ✦ Créativité · Medium ▾ » posé **à côté du bouton de génération**, comme le choix d'effort d'un modèle. Son menu liste les cinq crans, une ligne chacun sur ce que l'IA décide, et leur prix pour ce projet ; le bouton de génération affiche le prix du cran retenu (`creativityCost` pipe). Accessible : `aria-haspopup="menu"`, cases `menuitemradio`, flèches, Échap.

Où il se trouve :

- vidéo (pied du créateur, détail d'un contenu) ;
- visuel (détail d'un contenu) ;
- carte de visite (génération et régénération) ;
- business plan (rangée de boutons du formulaire, état vide) ;
- pitch deck (création, deck vide) ;
- charte (au-dessus du choix du format, qui lance la génération).

Pas de sélecteur pour le logo (toujours Ultra).

## Contrôles

- `npm run check:video` §9 bis rend **la même vidéo aux cinq crans** et vérifie que l'IA décide davantage à chaque cran (Low : textes ; Medium : + structure ; High : + mises en page, transitions, relecture ; Max : réglages appliqués ; Ultra : directeur + tous les plans écrits par l'IA, critique visuelle comprise).
- `npm run check:video:layouts` : chaque mise en page × chaque scène acceptée × quatre formats, textes au plus long.
- `npm run check:video:novelty` : le moteur créatif (motifs, empreinte, exploration par cran, accent, menus des agents, direction créative au cran Max, contrôle créatif, mémoire d'expérience, univers et manifeste restreint d'Ultra) ; 10 vidéos par cran par le vrai pipeline, aucune à moins de 0,30 d'une précédente.
- `npm run check:creativity` couvre :
  - les prix et la normalisation, l'orchestrateur et le lint du code Ultra ;
  - le rendu en Chromium d'une scène écrite comme par l'agent, et de scènes qui échouent, sortent du cadre ou ne bougent pas ; la CSP ;
  - les agents des visuels, et les douze compositions rendues et contrôlées ;
  - les agents de la carte et ses faces, au contrôle d'impression ;
  - la direction artistique des documents par cran, la fidélité du compositeur, son rendu mesuré, sa réparation et son repli ;
  - les logos du code (deux polices, trois types, `svgGate`, aucun `NaN`), le directeur de création et le jury.
- `npm run check:video` déroule le pipeline complet à chaque cran, avec agents et codeur simulés. Les scènes Ultra y sont réellement lintées, compilées, rendues et retenues.
