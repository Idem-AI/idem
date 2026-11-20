# Moteur de logos — amélioration d'un logo, bonnes pratiques, originalité, vitesse, jetons

> Complète [LOGO_ENGINE.md](LOGO_ENGINE.md) (le moteur, le Logo IR, la validation) et
> [LOGO_GENERATORS.md](LOGO_GENERATORS.md) (le catalogue). Ce document décrit la logique ajoutée
> le 20 novembre 2026 : ce qu'elle fait, où elle vit, comment elle est vérifiée, et ce qui reste à faire.

Code : `apps/api/api/services/logo-engine/`. Contrôle : `npm run check:logo` (183 vérifications, hors ligne, modèle simulé).

---

## 0. Le constat de départ (mesuré)

| Problème | Mesure | Cause |
|---|---|---|
| Logos peu originaux, clichés | Sur 5 secteurs × 10 tirages du planificateur, **35 à 70 %** des symboles étaient la représentation littérale du métier : barres et pièce pour une banque (34/49), toque et livre pour une école (32/48), croix et gélule pour une clinique (19/47), grain et tasse pour un café (20/45), flamme et poisson pour un restaurant (17/48). | `chooseGenerator` donnait le plus de points au générateur dont les étiquettes reprenaient les mots du **secteur** (poids ×2). Le cliché était le choix par construction. |
| « Améliorer mon logo » ne redessinait pas le logo depuis l'éditeur d'identité | — | `identityJobs` analysait le logo puis aplatissait l'analyse en texte. Le moteur ne recevait la référence que si `branding.logo` était un logo **importé** : le logo actuel, ou un logo importé depuis l'éditeur, n'arrivait jamais au dessinateur. |
| Cran Medium au lieu d'Ultra dans l'éditeur | — | `generateLogoConceptsWithStreaming` était appelé sans cran : `normalizeCreativity(undefined)` = Medium (1 brouillon, pas de comparateur). Règle produit : le logo est toujours dessiné au cran Ultra. |
| Lenteur | Code seul (modèle instantané) : **≈ 33 ms** pour construire un logo, **1,8 s** pour toute la chaîne Ultra. | Ce n'est pas Paper.js. La chaîne Ultra enchaînait **≈ 13 latences de modèle** l'une après l'autre : directeur, puis pour chacune des 3 directions (auteurs puis jury), puis 3 logos × 2 tours de critique. |
| Description recopiée deux fois | — | La lecture de l'observateur arrivait au dessinateur (`readingSheet`) **et** dans le souhait du client (`customDescription` = brief + « Original logo reference … »). |

---

## 1. Vue d'ensemble

```
                 ┌──────────────── référence ? ────────────────┐
                 │ oui (« Améliorer mon logo »)                 │ non (création depuis le projet)
                 ▼                                              ▼
  OBSERVATEUR (vision) ─ lecture + boîtes 0–100       PLANIFICATEUR (0 token)
  code : palette mesurée, texte du SVG,                 le sens avant le secteur, clichés estimés bannis,
         CARTE D'ENCRE 20×20                            rareté IDEM, foule IDEM, bonnes pratiques mesurées
                 │                                              │
                 ▼                                              ▼
  DESSINATEUR (texte, ne voit pas l'image)            DIRECTEUR (1 appel) : « cliches: … » + 3 directions
  3 degrés (fidèle · affiné · évolué)                  (catégorie | générateur | source | idée)
  + bonnes pratiques du type                           code : refuse toute direction bâtie sur un cliché
                 │                                              │
                 ▼                                              ▼ (les 3 directions EN PARALLÈLE)
  CONTRÔLE (code) : qualité + pratiques               AUTEURS (2 brouillons, +1 si aucun ne passe)
  + ressemblance de silhouette + teinte                code : refuse un brouillon qui dessine un cliché
                 │                                              │
                 ▼                                              ▼
  COMPARATEUR (vision, en parallèle) :                 JURY (sauté si un brouillon domine de 12 points)
  original | brouillon → patch gardé s'il améliore              │
                 │                                              ▼
                 │                                     CRITIQUE (vision, 3 logos en parallèle) :
                 │                                     clichés rappelés, patch vers un cliché refusé
                 └──────────────────────┬───────────────────────┘
                                        ▼
                     PIPELINE QUALITÉ (code) : technique + visuel + BONNES PRATIQUES DU TYPE
                                        ▼
                     Mémoire IDEM : rareté des générateurs, empreintes récentes, clichés du projet
```

Principe inchangé : **le modèle décide, le code construit et mesure**. Aucune nouvelle règle ne juge la beauté ; chacune est un fait vérifiable. Aucune règle n'interprète la demande du client par mots-clés : la compréhension du métier (les clichés) est faite par un agent.

---

## 2. « Améliorer mon logo » : un agent décrit, un autre dessine

Fichiers : `improve/reading.ts` (observateur), `improve/improve.ts` (dessinateur, contrôle, comparateur).

### 2.1 L'observateur (vision)

Il **décrit seulement**, il ne propose rien. Pour chaque élément (symbole, conteneur, nom, accroche, accent) : ce que c'est, sa géométrie exacte (côtés, angles, courbure, plein ou trait, épaisseur), sa position, sa taille relative, sa couleur estimée et, nouveauté, **sa boîte `[x, y, w, h]` dans un carré 0–100** qui encadre le logo. Il décrit aussi la construction (symétrie, alignements, angles répétés), la typographie, le symbolisme, puis fait un audit : `weaknesses`, `keep` (ce qui fait la reconnaissance), `fix` (une consigne par défaut).

Ce que le code garantit sans faire confiance au modèle :
- la **palette est mesurée** sur les pixels (`measurePalette`) : le modèle estime mal les hex ;
- le **texte** du logo est lu dans le SVG quand il contient des `<text>` ;
- la réponse est **validée** (éléments présents, géométrie pour la plupart, résumé, `keep` non vide) et redemandée **une fois** avec le motif du refus ;
- les boîtes sont **bornées** au carré 0–100 (`parseBox`) ; une boîte illisible est ignorée, pas refusée ;
- la lecture est **mise en cache 24 h** par empreinte du SVG (`logoreading:<sha1>`) : relancer, ou analyser puis générer, ne repaie pas la vision.

### 2.2 La carte d'encre (code)

Le dessinateur ne voit jamais l'image. Avant, il ne recevait que des mots. Il reçoit maintenant aussi la **silhouette réelle**, mesurée par le code : le symbole recadré sur un carré 20 × 20 (`inkMap`), une case = 5 unités de la boîte 0–100.

```
INK MAP of the original symbol (measured, 20×20, one cell = 5 units of the 0–100 box; # ink, + partial, . empty):
.......++####++.....
.....+##########+...
....####......####..
```

Coût : ≈ 110 jetons, pour une information qu'aucune description ne transmet aussi bien (où est l'encre, où est le vide).

### 2.3 Le dessinateur (texte)

Il écrit le Logo IR d'une version améliorée, à trois degrés, un par proposition :

| Degré | Consigne |
|---|---|
| Fidèle | Même silhouette, mêmes proportions, mêmes couleurs, même disposition ; seulement nettoyé (géométrie exacte, traits égaux, alignements, détails qui meurent à 24 px retirés). |
| Affiné | Même idée, même famille de formes et de teintes ; reproportionné, simplifié, palette harmonisée. |
| Évolué | Même idée de symbole, mêmes initiales ou nom, même famille de teintes ; réinterprété dans un langage géométrique moderne. |

Non négociable : reproduire chaque `keep`, corriger chaque `fix`, garder la disposition (les boîtes servent de coordonnées), suivre la carte d'encre, garder la famille de teintes. Il reçoit aussi **les bonnes pratiques du type** lu par l'observateur (§3). Le dessin libre (`path`) est autorisé pour reproduire une silhouette qu'aucun générateur ne sait faire.

### 2.4 Le contrôle (code) et le comparateur (vision)

Chaque brouillon passe le pipeline qualité, **bonnes pratiques comprises**, puis est comparé à l'original : ressemblance de silhouette (grilles d'encre normalisées) et écart de teinte. Un brouillon méconnaissable (ressemblance < 0,3 ou teinte à plus de 45°) est écarté ; un brouillon identique (> 0,97) est pénalisé. À partir de High, le **comparateur** voit original | brouillon côte à côte et répond par un patch ciblé, gardé seulement s'il améliore la note composite. Les comparaisons tournent désormais **en parallèle**.

Si rien n'atteint le nombre demandé, le moteur standard complète avec la même charte et les mêmes garde-fous.

### 2.5 Les branchements (corrigés)

| Écran | Avant | Maintenant |
|---|---|---|
| Création de projet → « Améliorer mon logo avec l'IA » (`logo-choice`) | Analyse, puis le logo importé du projet sert de référence, mais seulement si le motif « Original logo reference » survivait dans le souhait. Or la requête SSE (`prefType`/`prefDesc`) coupe le souhait à 800 caractères et ne transporte pas `improveImported` : une analyse longue faisait tomber la référence. | `generateLogoConceptsWithStreaming` reprend `improveImported` dans les préférences enregistrées du projet. Le souhait transmis au dessinateur est débarrassé de l'analyse recopiée (`wishWithoutAnalysis`) : elle lui arrive déjà entière par la lecture. |
| Éditeur d'identité → « Améliorer » (logo actuel ou importé) | Analyse aplatie en texte ; référence perdue sauf cas particulier ; cran **Medium**. | `identityJobs` résout le SVG et le passe **explicitement** (`reference: { svg, wish }`) à `generateLogoConceptsWithStreaming` → `engineLogos` → `engineLogoConcepts`, au cran **Ultra**. La lecture est faite une fois (le second passage la relit en cache). |
| Éditeur d'identité → « Nouveaux logos » | Cran Medium. | Cran Ultra (règle produit). |

---

## 3. Les bonnes pratiques par type de logo

Fichier : `validate/practices.ts`. Un **référentiel unique** sert deux fois :
1. **dans la consigne** (`practiceBrief(type)`, une ligne anglaise par type + les règles universelles), donnée à l'auteur et au dessinateur : il sait ce qu'on attend **avant** d'écrire ;
2. **dans la mesure** (`checkPractices`), appelée par `assessLogo` : un manquement devient un défaut `warn` (−7 points), donc pèse sur l'acceptation (seuil 78), le choix entre brouillons, le jury et la sélection.

Les règles **universelles** (lisible à 16–24 px, 3:1 de contraste sur blanc, une famille de police et deux graisses au plus, budget de nœuds et de couleurs par type, pas de dégradé ni d'ombre) étaient déjà mesurées par `visual.ts` et `technical.ts`. Elles sont maintenant aussi **dites** à l'agent.

| Type | Règle | Code du défaut | Comment le code la mesure |
|---|---|---|---|
| Logotype (`wordmark`) | Le nom seul fait le logo : aucun symbole séparé. | `practice_wordmark_symbol` | Le groupe symbole de la scène est vide. |
| | Un seul geste typographique au plus. | `practice_wordmark_effects` | Nombre d'effets sur les calques `wordmark`. |
| | Interlettrage large (> 0,3 em) seulement en capitales. | `practice_wordmark_tracking` | `tracking` et `case` des calques du nom. |
| Monogramme (`lettermark`) | 1 à 3 lettres, toutes prises dans le nom. | `practice_lettermark_letters` | Lettres des calques texte `symbol`/`frame` comparées aux lettres du nom (sans accents). |
| Lettre signature (`letterform`) | Une seule lettre, prise dans le nom. | `practice_letterform_single` | Idem, exactement une lettre. |
| Pictogramme, abstrait, minimal | Aucune lettre dans le symbole. | `practice_symbol_text` | Calques texte placés dans le symbole. |
| Pictogramme, abstrait, mascotte, combiné, dynamique | Le symbole tient dans un carré (avatar, icône d'appli) : proportions entre 1:2 et 2:1. | `practice_symbol_aspect` | Boîte du symbole dans la scène composée. |
| Mascotte | Le visage se lit à 32 px. | `practice_mascot_small` | Symbole seul rendu à 32 px : part d'encre solide ≥ 70 %. |
| Combiné (`combination`) | Symbole ET nom, chacun utilisable seul. | `practice_combination_name` | Groupes symbole et nom tous deux présents. |
| | Le symbole domine : le nom fait 20 à 95 % de sa hauteur. | `practice_combination_hierarchy` | Rapport des hauteurs (mise en page horizontale). |
| Emblème | Le texte vit dans le cadre, pas à côté. | `practice_emblem_enclosed` | Pas de nom en mise en page horizontale. |
| | Texte du sceau ≤ 24 caractères. | `practice_emblem_text_length` | Longueur des textes courbés ou de cadre. |
| Dynamique | Au moins deux variantes liées au symbole. | `practice_dynamic_variants` | Variantes `kind: 'dynamic'` du document. |
| Minimal | Quatre couches au plus. | `practice_minimal_layers` | Couches visibles du document. |
| Espace négatif | La seconde lecture est **dans** le vide : une contre-forme enfermée ≥ 5 % de l'encre. | `practice_negative_space` | Symbole seul rendu à 128 px, remplissage par diffusion depuis le bord ; les pixels vides non atteints sont le vide **enfermé** (`enclosedVoidRatio`). Un vide qui touche le bord ne compte pas. |

Calibrage, sur 260 logos du planificateur (4 marques × 11 types × 6) : tous restent acceptés. Les règles relèvent de vrais défauts de recettes : 8 logos « minimal » à plus de 4 couches, 5 logos « espace négatif » sans vide enfermé, 1 symbole dynamique trop allongé. Ils sont maintenant classés derrière les autres. La règle « lettre signature = initiale » a été assouplie en « une lettre du nom » : le « o » de Kora est un choix de dessin légitime.

**Pourquoi `warn` et jamais `blocker`** : un manquement fait baisser la note et peut faire refuser un logo sous le seuil, mais ne casse jamais une génération. Le moteur reste livrable même si toutes les propositions d'un type ont un défaut.

---

## 4. Anti-cliché et originalité

Fichier : `planner/originality.ts`. Un logo cliché montre ce que la marque **vend** (deux cuillères pour un restaurant). Un logo original montre ce qu'elle **porte** : son nom, une valeur, son histoire, son lieu, sa culture, son public. Le moteur applique cette règle à trois niveaux.

### 4.1 Le sens avant le secteur (code, 0 jeton)

Les mots du brief sont séparés en deux :
- `literal` : les mots du **secteur** (`brief.industry`) ;
- `meaning` : le nom (×1,5), la personnalité et les valeurs (×1,3), l'accroche (×1), la description et le public (×0,8), **sans les mots du secteur**.

Score d'un générateur (`generatorScore`) :

```
score = 2,2 × affinité(sens) − 1,6 × affinité(secteur) − pénalité de rareté   (−∞ si cliché banni)
```

puis le tirage habituel (bruit de Gumbel proportionnel à l'exploration du cran, −3 si déjà pris dans la série).

Sans modèle, le code **estime** les clichés (`literalGenerators`) : les générateurs dont les étiquettes reprennent le plus de mots du secteur (deux au moins, ou le plus littéral s'il n'y en a qu'un), au plus 4. Exemples : restaurant → tasse, poisson, flamme ; clinique → croix, gélule ; école → livre, toque, hibou. L'estimation est **volontairement prudente** (« banque mobile fintech » → cadenas seulement) : bannir trop large retirerait des mascottes utiles. Le directeur nomme le reste.

### 4.2 Les clichés nommés par le directeur (agent, 0 appel en plus)

L'appel des directions (High et Ultra) commence maintenant par une ligne obligatoire :

```
cliches: the 3–6 images any designer would draw first for this business (generator ids and/or short words)
1: category | generator-or-variant | source (name|value|story|place|culture|audience) | idea
```

- Le **menu** montre le catalogue **entier** de chaque famille, une seule fois (plus de doublons entre types), **trié du plus original au plus littéral** pour cette marque, sans les clichés estimés par le code.
- Le code lit la ligne `cliches:` (`parseCliches`) : les **identifiants du catalogue** sont bannis ; les **mots libres** (« a fork and spoon ») deviennent des consignes.
- Une direction bâtie sur un cliché (nommé par le directeur **ou** estimé par le code) est **refusée**. S'il en reste moins que demandé, la réponse est refusée : nouvel essai, puis repli sur le planificateur (qui bannit lui aussi).
- Chaque idée déclare sa **source** (nom, valeur, histoire, lieu, culture, public), jamais le produit.

Le cliché est ensuite tenu à **tous les étages** :

| Étage | Garde-fou |
|---|---|
| Brouillon du planificateur pour une direction | `docForDirection` reçoit les clichés bannis. |
| Auteurs (Ultra) | Consigne fixe `ORIGINALITY_RULE` + `AVOID (clichés of this business): …` ; un brouillon qui utilise un générateur banni est **refusé avant construction** (`usesCliche`). |
| Critique visuelle | Les clichés sont rappelés (« si le symbole se lit comme l'un d'eux, distinctiveness = 1 ») ; un patch qui remplace le symbole par un générateur banni est **écarté**. |
| Remplaçants (direction vide) | Pris dans le lot du planificateur, **hors clichés**. |
| Relances du même projet | Les clichés retenus sont gardés 30 jours (`logooriginality:cliches:<projectId>`) : ils restent bannis même si le modèle est muet. |

La compréhension du métier est faite par l'agent, pas par une liste de mots. Le code n'applique que des faits : des identifiants bannis, des fréquences, des distances d'empreintes.

### 4.3 La rareté et la foule, à l'échelle d'IDEM (mémoire de l'hôte)

`idem.service.ts` tient une clé Redis `logooriginality:global-v1` (30 jours) :
- `usage` : combien de fois chaque générateur a été proposé récemment dans **tout** IDEM. Ce compteur décroît de 3 % à chaque génération. Un générateur plus fréquent que la moyenne perd `min(3, 1,2 × log2(fréquence / moyenne))` points (`rarityPenalty`) ;
- `crowd` : les empreintes des 40 derniers logos proposés, tous projets confondus. En sélection, un candidat à moins de `LOGO_SIMILARITY.tooClose` (0,22) d'un logo proposé à **un autre projet** perd 30 points (`selectDistinct(…, crowd)`) : un logo n'est pas original s'il est déjà celui d'un autre.

L'écriture se fait au mieux, en tâche de fond : une course entre deux générations perd au pire un incrément. Une panne de Redis ne bloque rien (les lectures rendent une mémoire vide).

La mémoire **du projet** (empreintes des logos déjà montrés, `avoid`) est inchangée.

### 4.4 Résultat mesuré (planificateur, sans modèle)

| Secteur | Avant : symboles littéraux | Après |
|---|---|---|
| Restaurant | 17/48 (flamme ×12, poisson, tasse) | 0/49 |
| Banque, finance | 34/49 (barres ×18, pièce ×13, cadenas) | 0/47 |
| Santé, clinique | 19/47 (croix ×12, gélule ×7) | 0/47 |
| Éducation, école | 32/48 (toque ×14, livre ×13, hibou) | 0/49 |
| Café | 20/45 (grain ×12, tasse ×8) | 0/46 |

« Littéral » = générateur estimé cliché par le code pour ce secteur. Les clichés que seul le directeur saurait nommer (le bouclier pour une banque, par exemple) ne sont pas comptés ici : ils dépendent du vrai modèle, non mesuré (§9).

---

## 5. Vitesse

Le noyau géométrique n'est **pas** le goulot (§8) : 33 ms par logo, 1,8 s pour toute la chaîne Ultra sans modèle. Le temps réel est celui des appels au modèle enchaînés. La chaîne Ultra a été réorganisée :

| Étape | Avant | Maintenant |
|---|---|---|
| Directeur | 1 appel | 1 appel (clichés compris) |
| Auteurs | direction 1, puis 2, puis 3 (3 × latence) | les 3 directions **en parallèle**, 6 appels simultanés au plus (`AUTHOR_CONCURRENCY`) |
| Jury | après chaque direction (3 × latence) | en parallèle, **sauté** si un brouillon domine de 12 points (`JURY_DOMINANCE`) |
| Critique visuelle | logo 1, puis 2, puis 3, × 2 tours (jusqu'à 6 × latence) | les 3 logos **en parallèle** (2 tours au plus chacun) |
| Comparateur (amélioration) | brouillon après brouillon | en parallèle |
| **Latences successives** | **≈ 13** | **≈ 5** (directeur, auteurs vague 1, éventuelle vague 2, jury, critique × 2) |

Mesure par le contrôle (modèle simulé à 60 ms) : 6 appels d'auteur simultanés au plus fort de la génération.

---

## 6. Économie de jetons, sans perte de qualité

| Mécanisme | Où | Effet |
|---|---|---|
| Brouillons par **vagues** : 2 par direction, un 3e seulement si aucun des deux ne passe les mesures (qualité, pratiques, pas de cliché) | `DRAFT_WAVES` (`agent.ts`) | 9 → 6 appels d'auteur dans le cas courant : **−1/3 des jetons de sortie des auteurs** (un Logo IR réel fait 400 à 700 jetons). La qualité retenue est la même, puisqu'on ne garde de toute façon que le meilleur brouillon accepté. |
| Jury **sauté** quand un brouillon domine | `JURY_DOMINANCE` | Un appel de moins par direction quand les mesures ont déjà tranché. |
| Clichés dans l'appel **existant** du directeur | `directionsTask` | Aucun appel supplémentaire pour l'anti-cliché. |
| **Partie fixe en tête du prompt** (rôle, mémento du Logo IR, règle d'originalité) ; direction, marque et règles du type dans le message utilisateur | `authorTask`, `redrawTask` | Le préfixe (≈ 450 jetons) est identique d'un appel à l'autre, et le cache de prompt du fournisseur le relit à tarif réduit. Vérifié : un seul texte système pour les 6 auteurs et pour les 3 degrés du dessinateur. |
| Description **non recopiée** dans le souhait du client | `identityJobs`, `wishWithoutAnalysis` | La lecture (plusieurs centaines de jetons) n'est plus envoyée deux fois au dessinateur. |
| Lecture du logo **en cache** 24 h | `observeLogo` | Analyser puis générer, ou relancer : une seule vision payée. |
| Clichés du projet **en cache** 30 jours | `idem.service.ts` | Une relance bannit les mêmes clichés même sans directeur. |
| Menu du directeur **sans doublons** | `directionMenu` | Chaque famille listée une fois, au lieu d'une fois par type. |

Estimation par le contrôle (§13, modèle simulé, sorties courtes) : Ultra passe de ≈ 14 455 à ≈ 13 602 jetons (−6 %). Ce chiffre **sous-estime** le gain : le simulateur répond en quelques dizaines de jetons, alors qu'un auteur réel en écrit 400 à 700, et c'est la sortie que les vagues économisent. En contrepartie, chaque prompt d'auteur grandit de ≈ 150 jetons (bonnes pratiques + clichés à éviter) ; la partie fixe est relue par le cache.

---

## 7. Fichiers et API

| Fichier | Rôle |
|---|---|
| `validate/practices.ts` | **Nouveau.** `PRACTICES` (référentiel), `practiceBrief(type)`, `UNIVERSAL_PROMPT`, `checkPractices(session, rendered, raster)`, `enclosedVoidRatio(image)`. |
| `validate/assess.ts` | Appelle `checkPractices` ; métriques `practiceIssues`, `enclosedVoid`, `symbolAspect`, `mascotSolid32`, `monogramLetters`, `dynamicVariants`. |
| `planner/originality.ts` | **Nouveau.** `originalityOf(brief, { cliches, usage })`, `generatorScore`, `rarityPenalty`, `literalGenerators`, `originalCatalog`, `catalogIdsIn`, `generatorsOf`, constantes `LITERAL_PENALTY` (1,6) et `RARITY_CAP` (3). |
| `planner/recipes.ts` | `RecipeCtx.originality` ; `chooseGenerator` bannit les clichés et score par le sens. |
| `planner/planner.ts` | `PlanInput.cliches`, `.usage`, `.crowd` ; `originalityFor(input)` ; `selectDistinct(pool, n, avoid, crowd)`. |
| `agent/tasks.ts` | `directionMenu(kind, weights, originality)` (catalogue trié), `directionsTask(…, banned)` → `DirectionsVerdict { directions, cliches }`, `parseCliches`, `IDEA_SOURCES`, `Direction.source`, `ORIGINALITY_RULE`, `AuthorContext.avoid`, prompt d'auteur réordonné. |
| `agent/agent.ts` | Directions en parallèle, `DRAFT_WAVES`, `JURY_DOMINANCE`, `AUTHOR_CONCURRENCY`, critiques en parallèle, `AgentResult.originality { cliches, avoid }`. |
| `improve/reading.ts` | `ReadingElement.box`, `parseBox`, `inkMap(grid, n)`, `wishWithoutAnalysis`. |
| `improve/improve.ts` | Carte d'encre (`INK_MAP_SIZE` = 20), pratiques du type, prompt réordonné, comparateur en parallèle. |
| `idem.service.ts` | `reference.wish` ; mémoire IDEM (`readGlobalMemory`, `recordGlobalMemory`, clichés du projet) ; journal « clichés écartés ». |
| `BandIdentity/branding.service.ts` | `generateLogoConceptsWithStreaming(…, creativity, reference)` ; `engineLogos(…, explicitReference, onStage)`. |
| `brand/identityJobs.service.ts` | Référence explicite + cran Ultra pour toutes les générations de logos de l'éditeur. |

Clés Redis (préfixe `logooriginality`) : `global-v1` (rareté + foule) et `cliches:<projectId>`. Préfixe `logoreading` : lecture du logo.

Le moteur reste **sans dépendance à IDEM** hors `idem.service.ts` : la rareté, la foule et les clichés du projet arrivent par `PlanInput`.

---

## 8. Outils évalués (recherche du 20/11/2026)

La demande était de chercher une alternative plus rapide et plus performante à l'outil qui dessine les SVG (Paper.js + OpenType.js + SVGO + resvg-js). Conclusion : **on garde la pile actuelle**. La mesure montre que le dessin prend 33 ms par logo ; la lenteur vient des appels au modèle (§5), et le manque d'originalité vient du choix des symboles (§4), pas du noyau.

| Outil | Ce que c'est | Décision |
|---|---|---|
| [Skia PathKit](https://docs.skia.org/docs/user/modules/pathkit) (WASM) | Les chemins de Skia en WebAssembly : booléens (`op`), contour, simplification. Robuste et rapide. | Pas adopté : aucun banc public contre Paper.js n'a été trouvé, et nos booléens ne coûtent que quelques millisecondes. Candidat si un jour les booléens deviennent le goulot : le noyau est derrière l'interface `GeometryKernel`, donc remplaçable. |
| [Clipper2 WASM](https://www.jsdelivr.com/package/npm/clipper2-wasm) / [clipper2-ts](https://www.jsdelivr.com/package/npm/clipper2-ts) | Découpe et décalage de polygones (référence du domaine). | Pas adopté : travaille sur des polygones, pas sur des courbes de Bézier. Il faudrait aplatir les courbes, ce qui alourdit les SVG et dégrade leur qualité. |
| [HarfBuzz](https://github.com/harfbuzz/harfbuzz) (harfbuzzjs), [text-shaper](https://cdn.jsdelivr.net/npm/text-shaper@0.1.22/README.md) | Mise en forme typographique complète (ligatures, crénage GPOS). | À surveiller : opentype.js fait un crénage basique. HarfBuzz améliorerait le crénage des logotypes, mais aucun banc indépendant n'existe, et les chiffres de text-shaper viennent de son auteur. Pas de gain de vitesse attendu. |
| [OmniSVG](https://huggingface.co/OmniSVG/OmniSVG) (Qwen2.5-VL, 3B/4B), [StarVector](https://arxiv.org/pdf/2312.11556v4) (8B) | Modèles open-weight texte ou image → SVG. | Pas adopté : il faut les héberger sur GPU (ils ne sont pas sur OpenRouter), ils ne sont pas évalués sur des logos, et ils retomberaient dans le défaut que le moteur a corrigé (un SVG écrit par un modèle, fragile et différent à chaque appel). |
| [@neplex/vectorizer](https://github.com/neplextech/vectorizer) (VTracer, Rust/napi) | Image matricielle → SVG. | Piste pour plus tard : vectoriser un logo envoyé en PNG avant de l'observer. Hors périmètre aujourd'hui : l'amélioration lit déjà les pixels. |

Sur l'originalité des générateurs de logos par IA, la seule grille trouvée ([design.com](https://www.design.com/blog/best-ai-logo-maker-for-original-designs)) juge sur la variété créative, **l'usage de clichés prévisibles du secteur**, le lien avec la marque et l'impression d'un logo réellement conçu. C'est la grille appliquée ici. Les bancs SVG académiques ([SVGenius](https://arxiv.org/html/2506.03139v1), [revue LLM × SVG](https://arxiv.org/html/2503.04983v2)) ne mesurent pas l'originalité.

---

## 9. Contrôle et limites

**`npm run check:logo`**, section 16 (amélioration) et section 17 (nouvelle), modèle et vision simulés, sans réseau :
- le dessinateur reçoit la carte d'encre 20 × 20 ; même texte système aux 3 degrés ; les boîtes sont bornées ; l'analyse recopiée est retirée du souhait ;
- un symbole ajouté à un logotype, des lettres étrangères dans un monogramme, un « espace négatif » sans vide enfermé sont signalés ; le vide relié au bord ne compte pas ;
- 5 secteurs, 98 symboles du planificateur : 0 cliché littéral ;
- une direction qui reprend un cliché est refusée ; les clichés nommés arrivent aux auteurs (`AVOID`) ; le menu ne montre pas les clichés estimés ; un brouillon d'auteur qui dessine un cliché est refusé ; un patch du critique vers un cliché est écarté ;
- la rareté pénalise le générateur le plus montré ; la foule écarte un logo déjà proposé à un autre projet ;
- directions dessinées en parallèle (≥ 3 auteurs simultanés) ; partie fixe du prompt identique pour tous les auteurs ; bonnes pratiques données à chaque auteur ; une 1re vague réussie coûte 6 appels d'auteur, pas 9.

Aussi verts : `check:roles`, `check:creativity`, `tsc --noEmit` de l'API.

**Pas vérifié / à faire :**
- **Rien n'a été essayé avec le vrai modèle** (`deepseek-v4.1-flash-1017`) ni la vraie vision. On ne sait pas encore si le modèle nomme bien les clichés et propose des idées « source » convaincantes. Un échantillon court (2 ou 3 marques au cran Ultra) suffirait pour le voir.
- Le gain de vitesse réel dépend des limites de débit d'OpenRouter : 6 appels simultanés par génération.
- L'interface ne montre pas encore les « clichés écartés ». L'information existe (`AgentResult.originality`, journal `[LogoEngine]`, `decisions` stockées dans `LogoModel.engine.decisions`), et une ligne sous les propositions suffirait.
- Les recettes « minimal » à plus de 4 couches et « espace négatif » sans vide enfermé sont maintenant pénalisées, pas encore corrigées à la source (`planner/recipes.ts`).
- L'estimation des clichés par le code reste lexicale sur le secteur, faute de mieux sans modèle. Elle n'est qu'un repli : la décision qui compte est celle du directeur.
