# La logique du moteur de génération de vidéos — document de référence

> Synthèse détaillée du fonctionnement réel du moteur vidéo d'IDEM / iVision, écrite à partir du code, **mise à jour
> le 29 octobre 2026** après l'application du plan « qualité avec petits modèles » (compilateur 0.3, branche
> `feat/video-quality-small-models`). Elle décrit **le parcours** (ce qui se passe, dans l'ordre), **la logique du
> code** (fichiers, fonctions, décisions), ce qui **reste à faire** pour fermer le plan, et l'état des fichiers de
> documentation.
>
> Code source : `apps/ivision/core/src/video/` (serveur) + `apps/ivision/core/motion/` (navigateur) +
> `packages/motion-compiler/` (design du film, intention, solveurs, juge, langage, compilateur).
> Orchestrateur : [`motionVideo.service.ts`](apps/ivision/core/src/video/motionVideo.service.ts).
> Référence d'équipe, plus courte : [`apps/api/docs/VIDEO_ENGINE.md`](apps/api/docs/VIDEO_ENGINE.md).

---

## 1. Idée directrice

Une vidéo est **conçue par l'IA** et **animée par Motion Canvas**, scène par scène. Jusqu'au 0.2.1, le modèle écrivait
pour chaque scène un **programme** complet (positions, tailles, instants) ; un petit modèle y faisait des scènes
justes mais plates, et un défaut d'affichage se corrigeait en redemandant au modèle. Le compilateur 0.3 renverse la
répartition du travail :

- le modèle n'écrit plus que le **sens** de la scène : son rôle dans le récit, son énergie, un type de composition, la
  hiérarchie des éléments, quelques relations et des verbes de mouvement — c'est l'**intention** ;
- le **code** calcule la géométrie (par format) et le temps, à partir d'un **système de design du film** ;
- le modèle écrit **plusieurs** intentions par scène, le code en tire **plusieurs variantes** chacune, les **mesure**
  et garde la meilleure. Un petit modèle rattrape un grand quand on multiplie les essais et qu'un vérificateur
  choisit (« Large Language Monkeys », Snell et al.).

Quatre principes :

1. **Motion Canvas est le seul moteur de composition et d'animation.** Les outils externes ont des rôles bornés :
   capturer une interface, générer une image ou un clip, rendre une animation Lottie en clip, dire une voix, encoder.
2. **L'IA décide du sens, le code décide des pixels.** Aucun catalogue de scènes : des types de composition et des
   recettes de mouvement composables.
3. **Un contrôle esthétique mesurable, jamais le goût d'un modèle** (principe modifié par le plan). Le juge est fait de
   mesures explicables ; leurs poids s'étalonnent sur des préférences humaines ; un modèle de vision ne fait que
   départager deux finalistes à égalité, en Ultra.
4. **Le code garantit ce qui se mesure** : texte entier dans la zone sûre de la plateforme, lisible et resté assez
   longtemps, animations qui ne se battent pas, trajectoires qui ne se croisent pas, même programme pour chaque format.

---

## 2. Le parcours de création

```
demande ─► 1.compréhension ─► 2.direction ─► 3.storyboard ─► 4.plan du film (code)
                                                                   │
         ┌─────────────────────────────────────────────────────────┘
         ▼
5.médias (préparés) / musique (grille des temps) / sons (prises) / voix (mots datés)
         │
         ▼
6.échantillonnage par scène ─► solveurs ─► variantes ─► pré-juge ─► contrôle réel ─► juge ─► scène retenue
         │
         ▼
7.sauvetage et correction bornés ─► vidéo montrée ─► 8.export (flou, images clés, mixage deux passes)
```

Point d'entrée : `MotionVideoService.createVideo(userId, projectId, input, paidCredits, onProgress)`. Progression
réelle en SSE (`plan → concept → storyboard → media → music → sfx → voice → code → check → repair`).

### 2.1 Compréhension (`request/`) — inchangée

- **Brief normalisé** (`normalizeBrief`) : message, demande complète `request` (≤ 20 000 signes), objectif, humeur
  musicale, médias, voix.
- **Reformulation transparente** (`enhanceVideoRequest`), jamais pour un scénario mot pour mot.
- **Lecture** (`readRequest`) → `RequestSpec` : langue, scénario scène par scène, textes **mot pour mot**, voix, durée,
  format, interdits, `unsupported`.
- **Intention de la demande** (`readIntent`) : objectif, matière, mouvement, sous-titres, voix, musique ; corrigeable,
  ou une question de clarification quand une décision manque. `interpretVideo` l'expose avant création.

### 2.2 Direction (`director/concept.agent.ts`, rôle `video.concept`)

Titre, concept, bible visuelle, une idée par scène, et deux décisions nouvelles :

- une **direction nommée** parmi six (`editorial`, `tech`, `minimal`, `organic`, `playful`, `bold`), choisie dans un
  menu (`directionMenu`) ; le brief donne les directions des vidéos précédentes de la marque
  (`FilmBrief.previousDirections`) pour ne pas refaire la même ;
- la **courbe d'énergie** (1 → 5 par scène). Sans réponse lisible, le code la tire des rôles (`energyArc`).

### 2.3 Storyboard (`director/storyboard.agent.ts`, rôle `video.planner`)

Par scène : durée, **rôle** (`hook`, `problem`, `reveal`, `feature`, `benefits`, `proof`, `cta`, `signature`, ou
`statement`, `data`, `chapter`), **énergie**, intention, idée visuelle, textes exacts, médias, voix. Le planificateur
reçoit le **squelette produit en 8 temps** (accroche, problème, présentation, fonction clé, bénéfices, preuve sociale,
appel à l'action, signature — `PRODUCT_SKELETON`) comme guide, et la règle de l'accroche (la première scène doit
arrêter le pouce). La fidélité (`film.fidelity.notes`) reste dite.

### 2.4 Plan du film (`composition.ts#planFilm`, `packages/motion-compiler/src/design/`) — sans modèle

1. **Système de design** (`buildFilmDesign`) : direction + couleurs de la marque + énergie →
   - **rôles de couleur** (`color.ts`) : `ground`, `surface`, `ink`, `muted`, `primary`, `on-primary`, `accent`,
     `on-accent`… dérivés en HCT par Material Color Utilities, contrastes visés par Leonardo ; l'encre de la marque est
     gardée si elle tient 7:1 ; **toujours une surface claire** ;
   - **typographie** (`typography.ts`) : échelle modulaire par format (rapport selon la direction), corps de base
     (story 5,2 u, portrait 4,8, carré 4,4, paysage 3,6), titres entre 4 et 9 % de la hauteur, métriques réelles des
     polices (Capsize), largeur estimée pour la coupure ;
   - **mouvement** (`motion.ts`) : durées nommées (`instant` 0,1 s, `quick`, `short`, `medium`, `long`, `xlong` 1 s)
     modulées par l'énergie, courbes nommées (`enter` = [.05, .7, .1, 1], `exit` = [.3, 0, .8, .15], `standard`,
     `move`, `arrive`, `cut-in`, `cut-out`, ressort), décalages, chevauchement 30–50 %, pause avant le pic ;
   - **étalonnage** (`grade.ts`) : paramètres de LUT par direction (contraste, saturation, teinte vers la marque,
     grain, vignette).
2. **Coutures** (`planSeams`) selon la loi vectorielle : une direction dominante pour les coutures ordinaires, des
   vecteurs réservés au sens (vers le haut pour une conclusion, zoom inverse pour l'arrivée du moment fort), jamais
   deux coutures consécutives opposées, 3 à 5 sortes par film, au plus un tiers de coupes franches. Sortes : coupe au
   vol (`cut-the-curve`), zoom traversant, zoom inverse, flou croisé, aplat de couleur, filé, coupe par le noir, coupe.
3. **Sons de transition** (`planTransitionCues`) : environ une transition sur deux, sortes variées, pic sur la coupe ;
   montée puis impact une seule fois, sur le pic d'énergie.
4. **Coupes sur la musique** (`snapCutsToBeats`, après la grille des temps) : chaque coupe rapprochée du temps le plus
   proche, sans changer la durée achetée (`VIDEO_SNAP_CUTS=off`).

### 2.5 Médias, musique, sons, voix

**Médias** (`assets/sourcing.ts`, `assets/media.ts`, `assets/brandmedia.ts`) — ordre de priorité :

1. imports de l'utilisateur : photos, clips, **animations Lottie** (rendues en clips transparents, §2.5.2) ;
2. images de la marque (captures du site, photos), décrites une fois par la vision ;
3. **la sélection d'animations internes**, recolorée à la marque (§2.5.2) ;
4. **les écrans d'une démo produit** quand `input.demo` est donné (§2.5.3) ;
5. ce que le storyboard demande : image **FLUX.2** contrôlée par la vision, puis clip **Google Veo 3.1** par
   OpenRouter (image → vidéo ; Veo 3.1 dès High en mode qualité, Veo 3.1 Fast sinon), trois essais par média, puis
   **Pexels**, puis les photos des visuels de la marque. Plafonds `VIDEO_GEN_MAX_IMAGES` (6), `VIDEO_GEN_MAX_CLIPS` (4).

#### 2.5.1 La préparation (`assets/prepare.ts#prepareMedia`)

Chaque image et chaque clip (sauf transparent) passe, avant l'écriture des scènes :

- **point d'intérêt par format** (`bestCrop`, smartcrop-sharp au rapport du format) → `prep.focus[format]` ; pour une
  capture de démo, le point de l'action prime ;
- **zone calme** par format (`calmZone` : densité de contours la plus faible, avec une pénalité près du sujet) → où
  poser un texte sans aplat ; claire ou sombre (pour l'encre) ;
- **teintes dominantes** (`palette`, k-moyennes) ;
- un clip : **extrait propre** (`cleanClipStart` : `freezedetect`, `blackdetect`, `scdet` → le plus long passage sans
  coupe ni image figée ni noir) → `prep.startAt`, que le compilateur utilise (`seek`) ;
- **étalonnage commun** : la LUT du film (`buildCube`, portée de HyperFrames), grain et vignette, appliqués à une copie
  (`prep.graded`, `prep.originalUrl` garde l'original) — jamais sur une capture d'interface (`prep.screen`).

#### 2.5.2 Lottie (`assets/lottie.ts`)

Le moteur n'embarque aucun lecteur Lottie dans les pages : à l'import, l'animation est rendue **image par image** par
dotLottie-web (moteur ThorVG, `setFrame`) dans le Chromium du moteur (page servie depuis une origine fictive, réseau
fermé, code de page passé en texte), puis encodée en **WebM VP9 avec alpha** (`yuva420p`, `-auto-alt-ref 0`). Le
résultat est un clip ordinaire marqué `transparent` : posé entier (`fitMedia` passe en « contain »), jamais recadré ni
étalonné. Un fichier qui n'est pas une animation valide est refusé (`invalid_lottie`).

La **sélection interne** (`motion/lottie-library/`, générée en code par `scripts/build-lottie-library.ts`, aucune
licence tierce) : coche qui se trace dans un cercle, éclat de rayons, flèche courbe, soulignement à main levée. Elle est
recolorée à la couleur principale de la marque (`recolorLottie`), rendue une fois par couleur, et proposée au
storyboard avec sa description (« animation (transparent background): a check mark drawing itself… »).

#### 2.5.3 Démo produit scriptée (`assets/demo.ts`)

`input.demo = { url, goal?, device? }` (IDEM : corps `demo` de la création ; iVision : paramètre `demo` du service) :

1. la page publique est ouverte (garde réseau des rendus, aucune adresse privée) et sa **carte** relevée : les éléments
   actionnables visibles (liens, boutons, champs, listes) avec leur libellé et leur place — jamais un champ mot de passe
   ou fichier ;
2. un **agent** (`video.planner`, sortie structurée, raisonnement coupé) lit l'objectif et la carte et écrit au plus
   6 étapes (`show`, `click`, `type`, `scroll`) en citant le numéro et le libellé de l'élément ; il ne se connecte, ne
   paie et n'envoie jamais rien ;
3. le code joue les étapes : avant chaque action, une capture et le **point** de l'action (centre de l'élément) ; après
   la dernière, l'écran d'arrivée. La carte est relevée de nouveau à chaque étape ; un élément est retrouvé par son
   numéro, ou par son libellé exact si la page a changé ;
4. chaque capture devient un média « écran » (`prep.screen`, `prep.point`) : le point sert de cadrage, et le verbe
   `focus` sur ce média (ou sur l'appareil qui le montre) **zoome vers le clic** (effet `point` du compilateur).

**Musique** (`audio/music.ts`, `audio/beats.ts`) : humeur, banques libres (CC0 / CC BY), puis la **grille des temps**
(`beatGrid` : BeatRoot de `music-tempo` → temps, temps forts, phrases) et un **extrait calé sur les phrases**
(`phraseExcerpt`) qui finit sur une fin de phrase musicale. La grille est donnée aux scènes (`ctx.beats`) et au solveur
temporel (`sync: "downbeat"`).

**Sons** (`audio/sfx.ts`) : sonothèque CC0 ; plusieurs **prises** par sorte (`pickTakes`), tournées pour ne jamais
répéter le même son ; les sons de transition viennent du plan du film.

**Voix** (`audio/voice.ts`, `audio/align.ts`) : une prise continue (ElevenLabs v4 par OpenRouter ; replis Kokoro,
serveur Qwen3-TTS), découpée aux pauses, calée sans changer la durée achetée ; traitée (compresseur, de-esser) ; les
**mots datés** (`alignWords` : service d'alignement forcé `IDEM_ALIGN_URL`, sinon estimation sur les silences) donnent
des sous-titres mot par mot.

### 2.6 L'échantillonnage (`author/sampler.ts`, `author/intent.author.ts`)

Pour chaque scène (`sampleScenes`, en parallèle borné) :

1. **Fiche de l'auteur** (`composition.ts#authorCard`) : rôle, énergie, but, idée visuelle, textes par clé, médias
   (genre, dimensions, description, capture d'écran ou non, transparent ou non), logo, durée, voix, direction, menu
   des icônes.
2. **Budget** : difficulté de la scène (`difficultyOf` : simple 3, moyenne 6, difficile 10 — données, interface, texte
   long, 4 textes ou plus, 3 médias ou plus) plafonnée par le cran (Low 6, Medium 8, High 10, Ultra 10 ;
   `VIDEO_SAMPLES_<CRAN>`).
3. **Vagues de 3 essais** : rôle `video.sampler`, **sortie structurée stricte** (le schéma de l'intention calculé pour
   cette scène : ses clés de texte, son nombre de médias — `intentJsonSchema`), raisonnement coupé, température de 0,4
   à 1,0 selon l'essai, graine par essai, et une **scène de référence** différente à chaque essai (les 3 plus proches,
   `retrieveReferences`) : le modèle **édite** la référence.
4. Chaque intention lue (`parseIntent`, `validateIntent` tolérant) → **4 à 12 variantes** (`variantChoices`), chacune
   résolue (`lowerIntent`), validée (`validateProgram`), compilée, **pré-jugée sans rendu** (`prejudge`) ; les deux
   meilleures entrent au lot.
5. Après chaque vague, les 3 meilleures non contrôlées passent le **contrôle réel** (`probeCandidates` : Motion Canvas,
   chaque format) ; le score final ajoute les mesures sur pixels (encombrement, teintes, contraste). Arrêt dès qu'une
   variante dépasse **0,8** (`GOOD_ENOUGH`).
6. Sous le seuil, dès Medium : l'**auteur de qualité** (`video.author`) réécrit la meilleure depuis le **rapport mesuré**
   (1 réécriture en Medium, 2 en High et Ultra).
7. **Ultra** : deux finalistes à moins de 0,03 → départage visuel (`tiebreak.ts` : vignettes côte à côte, questions
   fermées, deux ordres ; un avis contradictoire = pas d'avis).
8. La retenue est gardée avec son intention, sa variante et son jugement (`scene.intent`, `scene.variant`,
   `scene.judge`), et la deuxième meilleure (`scene.runnerUp`).

Repli : une scène dont aucune intention ne passe retombe sur l'auteur de programmes 0.2.1 ; `VIDEO_AUTHOR_MODE=program`
garde ce chemin pour toutes.

---

## 3. L'intention de scène (`packages/motion-compiler/src/intent/`)

```json
{ "role": "feature", "layout": "device", "energy": 3, "background": "ground",
  "elements": [
    { "id": "app", "kind": "device", "device": "laptop", "media": 0, "rank": 2 },
    { "id": "title", "kind": "text", "text": "$headline", "rank": 1, "emphasis": 1 },
    { "id": "go", "kind": "button", "text": "$cta", "rank": 3 }
  ],
  "relations": [["title", "above", "go"]],
  "beats": [
    { "verb": "reveal", "target": "title", "style": "words" },
    { "verb": "rise", "target": "app", "after": "title" },
    { "verb": "focus", "target": "app", "after": "app" },
    { "verb": "pop", "target": "go", "sync": "downbeat" }
  ] }
```

| Champ | Valeurs |
| --- | --- |
| `layout` | `hero`, `hero-left`, `media-split`, `full-bleed`, `stacked`, `figure`, `list`, `quote`, `device`, `end-card`, `grid` |
| `elements[].kind` | `text`, `image`, `video`, `logo`, `icon`, `device`, `shape` (`bar`, `underline`, `circle`, `ring`, `block`, `pill`, `dots`, `arc`), `list`, `chip`, `button` |
| `rank` | 1 = l'élément principal (un seul, imposé), 2 secondaire, 3 détail |
| `relations` | `above`, `below`, `beside`, `left-of`, `right-of`, `over`, `behind`, `aligned` |
| `beats[].verb` | `reveal`, `rise`, `slide-in`, `pop`, `push`, `stack`, `cascade`, `draw`, `count`, `type`, `wipe`, `highlight`, `zoom`, `focus`, `blur-in`, `grow`, `nudge`, `exit` |
| `beats[]` | `style` (mots, lettres, ligne, puces), `from`, `intensity`, `sync` (temps fort, temps, voix), `after` / `with` |
| `camera` | `push`, `pull`, `pan` |

**Les recettes** (`recipes.ts`) traduisent chaque verbe en pas aux valeurs nommées, portées des mesures des films
HyperFrames : `reveal` titre mot par mot (flou → net, ≈ 0,13 s par mot), `slide-in` par un déplacement partiel
(≈ 12 %), `pop` (l'échelle rebondit, jamais l'opacité), `stack` / `cascade` (« waterfall entry »), `draw`, `wipe` puis
lent travelling, `highlight` (un mot porteur de sens prend l'accent), `nudge` (lent–rapide–lent), `exit` 40–50 % plus
court que l'entrée, `focus` (caméra qui s'approche ; sur un média : vers son point d'intérêt ; sur un appareil : vers
son écran `<id>_screen`). Interdits : les boucles d'attente sur un titre ou une interface, un titre qui bouge encore.

---

## 4. Les solveurs (`packages/motion-compiler/src/solver/`)

### 4.1 Géométrie (`geometry.ts#solveGeometry`)

Par format, dans la zone sûre de la plateforme (`safezones.ts` : story x 90 / y 260, portrait 72/96, carré 72/72,
paysage 108/72) et sur une grille (story 4 colonnes, portrait et carré 6, paysage 12, gouttière 2,4 u) :

- tailles des textes par niveau et par rang (cran d'échelle de la variante), boîtes de texte par **coupure équilibrée**
  (`balanceLines`) ;
- empilement vertical par **contraintes Cassowary** (`@lume/kiwi`) : marges, espacements, alignement haut / centre /
  bas selon la variante ;
- chaque composition a son cas : média sur des colonnes entières en paysage, média au-dessus en vertical ; plein cadre
  avec texte dans la **zone calme** du média, sinon en bas sur un **aplat** (marge ≥ 3,6 u) ; appareil dessiné ;
  grille d'images ; liste ; citation ; carte de fin ;
- formes de décor placées par rapport à l'élément qu'elles servent ;
- **faisabilité** notée (un texte qui ne tient qu'en réduisant trop, une scène trop courte pour être lue).

**Variantes** (`variantChoices`) : 4 à 12 choix discrets selon la composition — côté et proportion du média, cran
d'échelle typographique, alignement vertical, zone du texte sur un plein cadre, échelle d'une carte de fin.

### 4.2 Temps (`time.ts#solveTiming`)

Contraintes Cassowary sur les départs et durées : ordre `after` / `with`, chevauchement 30–50 % entre gestes
successifs, nombre de gestes principaux simultanés selon l'énergie, pause avant le moment fort, **temps de lecture**
(17 signes par seconde, au moins 5/6 s) avant toute sortie, fin avant la fenêtre de la couture, départs calés sur la
grille quand `sync` le demande (tolérance 120 ms). Repli par compression proportionnelle si le système est
infaisable.

### 4.3 Trajectoires (`trajectory.ts`)

Un texte qui en croiserait un autre en chemin : la trajectoire est raccourcie, ou l'entrée change de côté.

### 4.4 La traduction (`intent/lower.ts#lowerIntent`)

L'intention résolue devient un **programme** du langage : nœuds aux valeurs par format (`fmt(story, portrait, square,
landscape)`), couleur du texte choisie d'après son fond réel (contraste), aplat si nécessaire, formes, icônes et
appareils (macros), pas des recettes posés par le solveur (`timing: "solved"`), courbes nommées, règle du « Z » pour la
couture de sortie. Elle rend aussi les **boîtes** de chaque élément par format, utilisées par le juge.

---

## 5. Le langage et le compilateur (`dsl/`, `compiler/compile.ts`, 0.3.0)

Le programme reste le langage d'assemblage (lisible, retouchable, gardé en tête du code). Nouveautés 0.3 :

- **valeurs nommées** : `size: "title"` (niveau typographique), `dur: "medium"`, `ease: "enter"`, `stagger: "words"`,
  `at: "beat:3"` / `"bar:2"` ; couleurs par rôle (`ground`, `ink`, `on-primary`…) ;
- `fmt(story, portrait, square, landscape)` à côté de `pick(vertical, horizontal)` ;
- nœuds `icon` (Lucide, développé en tracés) et `device` (téléphone, portable, navigateur dessinés en code ; l'écran
  porte l'identifiant `<id>_screen`) ;
- texte posé en **lignes équilibrées** (même algorithme Knuth-Plass côté navigateur, `kit/lines.ts`), ponctuation
  française collée ;
- table de piste à six colonnes : la sixième est le **temps de lecture** des textes visés ; une sortie n'arrive jamais
  avant ;
- `timing: "solved"` : la piste est celle du solveur, pas de remise à l'échelle ;
- **coutures** : la scène est enveloppée dans `r_seam` (`seamIn` / `seamOut` du kit) ;
- médias : recadrage sur le point d'intérêt du format, extrait propre d'un clip, clip transparent posé entier ;
- effet **`point`** : un média zoome (1,1 à 2,6 ; 1,7 par défaut) vers `media.point` (sinon `media.focus`), le point
  venant au centre du cadre sans jamais découvrir un bord.

Les garanties de 0.2.1 restent : `FIT` (texte jamais coupé), `KEEP` (pile jamais coupée), `untangle` (deux animations
de la même propriété s'enchaînent), médias de la scène toujours montrés.

---

## 6. Le juge (`packages/motion-compiler/src/judge/`)

| Étage | Fichier | Mesures (0 → 1, 1 = bon) |
| --- | --- | --- |
| 1. Élimination | `score.ts` | erreur d'exécution ; texte coupé, chevauché, caché, illisible dans un format ; média absent ; texte retiré avant son temps de lecture |
| 2. Composition | `composition.ts` | alignement (bords et axes partagés), grille, équilibre gauche/droite et haut/bas sur l'axe de la composition, centre des masses, densité (22–55 % de la zone sûre, plancher selon le nombre d'éléments), hiérarchie (≥ 1,5), élément principal pas timide (titre ≥ 6 % de la hauteur visé), respiration, au plus 4 tailles ; sur pixels : encombrement, teintes notables (≤ 5), contraste le plus faible |
| 3. Mouvement | `motion.ts` | courbes, simultanéité selon l'énergie (le décor ne compte pas), chevauchement, trajectoires, aucun tremblement, titre posé immobile, variété des entrées, départs sur les temps, courbes du système de design |
| 4. Intention | `motion.ts#intentAssertions` | prédicats tirés de l'intention : ordre des éléments, titre tôt, direction d'entrée, puces l'une après l'autre, chaque texte lisible |

**Score** = moyenne pondérée (`DEFAULT_WEIGHTS` : contraste 1,4, intention 1,5, échelle du principal 1,2,
trajectoires 1,2, hiérarchie 1,1…). Les poids étalonnés remplacent ceux de départ (`judge-weights.json`,
`VIDEO_JUDGE_WEIGHTS`). **Rapport** (`reportText`) : pour chaque mesure sous son seuil, l'élément, le format, la valeur,
le seuil et le correctif (`FIX` : un cran d'échelle, une autre variante, une zone calme, moins de gestes simultanés).

**Étalonnage** (`fit.ts`) : régression logistique sur des paires préférées par des humains (différence des vecteurs de
mesures → probabilité de préférence) ; `agreement` mesure l'accord du juge avec les évaluateurs.

---

## 7. Sauvetage et correction bornés (`motionVideo.service.ts`, `author/repair.ts`)

Après l'échantillonnage, le film entier passe le contrôle (`checkFilm` → `probeFilm`, chaque scène, chaque format).
Pour une scène écrite par intention qui reste en défaut :

1. **sauvetage sans modèle** (`rescueIntentScenes`, `composition.ts#rescueOptions`) : la seconde variante gardée
   (`runnerUp`), puis jusqu'à 3 variantes tirées du rapport mesuré — chacune recompilée, recontrôlée, gardée seulement
   si elle s'affiche mieux ;
2. **correction depuis le rapport** (`intentRepair`) : l'auteur de qualité réécrit l'intention en connaissant le
   défaut exact ;
3. **dernier recours du code** (`inkFallback`) : encre lisible d'après le fond réel (`ink`), passage devant (`front`),
   aplat sous le texte (`plate`).

Bornes : une tentative à la fois par scène, 3 scènes en parallèle ; `VIDEO_REPAIR_TOKEN_BUDGET` (400 000 jetons),
`VIDEO_REPAIR_MAX_MS` (600 s), `VIDEO_REPAIR_ATTEMPTS` (3). Une scène qui marchait n'est jamais remplacée par une
moins bonne. Journal : `film.repair` (dont `firstPassLayout`, les défauts au premier jet — la mesure du plan — et
`inkFallbacks`, le nombre de recours au code), `scene.author.repairs`. Les scènes en programme gardent `fix` →
`rewrite` → `minimal`.

---

## 8. Le navigateur (`apps/ivision/core/motion/`)

- **Harnais** (`runtime/harness.tsx`) : durée exacte, erreurs attribuées, données vivantes ; nouveau contexte de scène :
  `ctx.index`, `ctx.clock` (instant dans le film), `ctx.beats`, `ctx.design`, `ctx.seamIn` / `seamOut`,
  `ctx.planned` (sons de transition déjà planifiés), `ctx.safe` (zone sûre de la plateforme) ; sous-titres **mot par
  mot** quand les mots sont datés.
- **Données** (`runtime/film-data.ts`) : design et coutures par scène, grille des temps, zone sûre, sons planifiés
  (`cues` avec leur prise), médias avec `focus`, `calm`, `startAt`, `point`, `transparent`.
- **Kit** (`kit/`) : `design.ts` (courbes de Bézier et ressort, `designSize/Dur/Ease/Stagger/Weight`, `beatAt`,
  `readTime`), `lines.ts` (Knuth-Plass), `seams.ts`, `safe.ts`, `helpers.ts` (`fitMedia` au point d'intérêt,
  `safeArea` de la plateforme).

---

## 9. Export (`runExport`, `rendering/runner.ts#renderFilm`, `rendering/ffmpeg.ts`)

- refusé tant qu'une scène est en erreur ; file de rendu, rendus d'avance, signatures de fraîcheur, remboursements
  inchangés ;
- **flou de mouvement** : chaque image est la moyenne de sous-images (6 ; 4 en premium à 60 i/s) sur un obturateur de
  180° (`tmix` puis `select`) — `VIDEO_MOTION_BLUR`, `VIDEO_MOTION_BLUR_SAMPLES`, `VIDEO_MOTION_BLUR_SHUTTER` ;
- **contrôle d'images clés** : les 4 scènes les plus énergiques vérifiées à 60 % de leur durée avant l'encodage ;
- **mixage** : musique sur un extrait qui finit sur une phrase (fondu court), voix compressée et de-essée devant, la
  musique s'efface sous la voix et sous les effets, sons de transition planifiés avec leur prise ;
- **volume** : `loudnorm` en deux passes (mesure JSON, puis application linéaire) à −14 LUFS, crête −1,5 dBTP.

---

## 10. Retouches (gratuites)

| Champ | Effet sur une scène par intention |
| --- | --- |
| `texts`, `images` | données changées, **géométrie recalculée** par les solveurs (`relower`), sans modèle |
| `visual` | l'intention est réécrite par l'auteur de qualité, puis résolue et jugée |
| `regenerate` | un nouvel échantillonnage de la scène |
| `fix` | la boucle bornée |
| `voice`, `voiceLines`, `captions`, `musicMood`, `musicTrackId`, `sfx`, `scope` | inchangés |

Avant contrôle, aperçu et export, les scènes par intention sont rafraîchies (`refreshIntentScenes`) : une scène
compilée par une version plus ancienne est recalculée depuis son intention.

---

## 11. Modèles, réglages d'appel et crans

| Rôle | Échelle | Low | Medium | High | Ultra |
| --- | --- | --- | --- | --- | --- |
| `video.concept`, `video.planner`, `video.reviser` | `video-design` | `qwen/qwen3.8-27b` | `qwen/qwen3.8-27b` | `z-ai/glm-5.3-flash` | `z-ai/glm-5.3-flash` |
| `video.author` (qualité) | `video-code` | `qwen/qwen3.6-35b-a3b` | `qwen/qwen3.8-27b` | `qwen/qwen3.8-27b` | `qwen/qwen3.8-27b` |
| `video.sampler` | `video-sample` | `qwen/qwen3.6-35b-a3b` (tous les crans) | | | |
| `video.judge-vlm` | `video-vision` | `qwen/qwen3.8-27b` (utilisé en Ultra) | | | |
| `video.teacher` (hors ligne) | `video-teacher` | `qwen/qwen3.8-2.4t-a95b`, replis `deepseek/deepseek-v4.1-flash`, `z-ai/glm-5.3` | | | |

Replis par échelle (`LADDER_FALLBACKS`) : design ↔ glm-5.3-flash / qwen3.8-27b, code → qwen3-coder-next / qwen3.6-27b,
vision → qwen3-vl-8b-instruct.

Réglages OpenRouter (`apps/api/api/services/creativity/orchestrator.ts#openRouterCallOptions`) : `response_format`
`json_schema` strict + `provider.require_parameters`, greffon `response-healing`, précisions `bf16,fp8`, ordre ou
liste de fournisseurs par l'environnement, graine, température, raisonnement coupé (`reasoning: { enabled: false }`)
pour l'échantillonnage ; le fournisseur servi est journalisé (`ai.served`). Le préfixe des messages est stable (cache
d'invite). La passerelle iVision (`/ai/agent`) transmet ces options.

**Le cran** = un budget : essais par scène (6 / 8 / 10 / 10), réécritures par l'auteur de qualité (0 / 1 / 2 / 2),
modèle de conception (GLM-5.3-Flash dès High), départage visuel (Ultra). Prix inchangés (voir `MOTION_VIDEO.md`).

---

## 12. Mesurer (`packages/motion-compiler/bench/quality/`)

| Outil | Coût | Rôle |
| --- | --- | --- |
| `briefs.ts` | — | 40 briefs (8 temps du squelette × formats × langues × médias) |
| `run.ts` (`bench:quality`) | payant | création par cran, avec les réglages de production ; `--engine intent|program`, `--label`, fournisseurs épinglés |
| `rate.ts` (`bench:quality:rate`) | gratuit | planche de paires à l'aveugle (5 évaluateurs, ~200 paires) |
| `fit.ts` (`bench:quality:fit`) | gratuit | poids du juge par régression logistique, accord, **portes des phases** |
| `offline.ts` (`bench:quality:offline`) | gratuit | chaque scène de référence dans les 4 formats : défauts, recours, score |
| `bench/references/teach.ts`, `promote.ts` | payant / gratuit | le professeur écrit des scènes de référence, le code les évalue, l'équipe trie, `references.json` |

Portes du plan : accord du juge ≥ 65 % avec les évaluateurs (phase 0) ; puis chaque phase doit battre la précédente
sur les paires à l'aveugle et sur les défauts au premier jet.

---

## 13. Cartographie des fichiers (nouveaux et modifiés)

| Fichier | Rôle |
| --- | --- |
| `packages/motion-compiler/src/design/*` | système de design du film (directions, couleurs, typographie, mouvement, film, zones sûres, étalonnage) |
| `packages/motion-compiler/src/intent/*` | intention, schéma, lecture, recettes, traduction |
| `packages/motion-compiler/src/solver/*` | géométrie, temps, trajectoires |
| `packages/motion-compiler/src/judge/*` | juge et étalonnage |
| `packages/motion-compiler/src/references/library.ts` | 24 scènes d'amorce + `references.json` |
| `packages/motion-compiler/src/dsl/macros.ts` | icônes et appareils |
| `apps/ivision/core/src/video/composition.ts` | plan du film, fiche de l'auteur, données des médias, contrôle de variantes, sauvetage |
| `apps/ivision/core/src/video/author/intent.author.ts`, `sampler.ts`, `tiebreak.ts` | auteur d'intentions, échantillonneur, départage visuel |
| `apps/ivision/core/src/video/assets/prepare.ts`, `icons.ts`, `lottie.ts`, `demo.ts` | préparation des médias, icônes Lucide, Lottie, démo produit |
| `apps/ivision/core/src/video/audio/beats.ts`, `align.ts`, `voice.ts`, `sfx.ts` | grille des temps, mots datés, traitement de la voix, prises |
| `apps/ivision/core/src/video/rendering/runner.ts`, `ffmpeg.ts` | flou de mouvement, images clés, contraste mesuré, navigateur partagé ; mixage deux passes |
| `apps/ivision/core/motion/kit/design.ts`, `lines.ts`, `seams.ts`, `safe.ts` | le design, les lignes, les coutures et les zones sûres côté navigateur |
| `apps/ivision/core/motion/lottie-library/` | la sélection d'animations internes |
| `apps/api/api/config/ai-models.config.ts`, `creative-roles.ts`, `openrouter.config.ts` | échelles, rôles, liste blanche |
| `apps/api/api/services/creativity/orchestrator.ts` | réglages d'appel OpenRouter |

---

## 14. Contrôles (gratuits) — état au 29 octobre 2026

| Commande | Résultat |
| --- | --- |
| `npm run check` (motion-compiler) | 69 / 69 |
| `npm run check:intent` (motion-compiler) | 48 / 48 |
| `npm run bench:quality:offline` (motion-compiler) | 24 scènes × 4 formats = 96 rendus, 0 défaut, 0 recours |
| `npm run check:intent` (core) | 16 / 16, export MP4 avec flou et images clés |
| `npm run check:motion` (core) | tout vert (chemin programme) |
| `npm run check:lottie` (core) | 9 / 9 |
| `npm run check:demo` (core) | 11 / 11, le bouton cliqué passe de 0,14 % à 0,49 % de l'image |
| `npm run check:roles` (apps/api) | 17 / 17 |
| typecheck | compiler (bancs compris), core (Node + navigateur), apps/api, apps/ivision/api |

---

## 15. Ce qui reste à faire pour fermer le plan

Le code de toutes les phases est en place ; les étapes suivantes demandent des personnes, de l'argent ou une décision :

1. **Phase 0 — mesurer** : lancer le banc payant par cran (`bench:quality`, `--label baseline` sur
   `VIDEO_AUTHOR_MODE=program`, puis `--engine intent`), faire noter les paires (`bench:quality:rate`, 5 évaluateurs),
   ajuster les poids (`bench:quality:fit --write`). Tant que la porte des 65 % n'est pas passée, le juge tourne sur ses
   poids de départ. La clé OpenRouter de développement a atteint sa limite mensuelle (50 $, remise à zéro le
   1ᵉʳ novembre 2026) : les réglages `json_schema` strict / `response-healing` n'ont pas été vérifiés sur un appel réel.
2. **Phase 5 — références** : lancer le professeur (`references:teach`, payant), trier la planche, promouvoir
   (150 à 300 scènes visées ; 24 d'amorce aujourd'hui).
3. **Alignement forcé** : déployer un service d'alignement (aeneas ou équivalent) et renseigner `IDEM_ALIGN_URL` ;
   sans lui, les mots sont estimés.
4. **Démo produit dans l'interface** : le moteur et les deux API acceptent `demo` ; aucun écran ne le propose encore.
5. **Production** : basculer les échelles vidéo en production (`ai:models`), régénérer `AI_MODELS.md`, vérifier le
   temps de rendu avec le flou de mouvement (il multiplie le rendu par le nombre de sous-images), et l'image Docker
   (Node ≥ 20.19 pour `require(esm)` des paquets ESM ajoutés).

---

## 16. État des fichiers de documentation

| Document | État |
| --- | --- |
| [`apps/api/docs/VIDEO_ENGINE.md`](apps/api/docs/VIDEO_ENGINE.md) | **Réécrit** pour le compilateur 0.3 |
| [`apps/api/docs/MOTION_VIDEO.md`](apps/api/docs/MOTION_VIDEO.md) | **Mis à jour** : intention, médias (Lottie, animations, démo, préparation), jauge = budget avec les vrais modèles, correction, sons, musique, rendu |
| [`packages/motion-compiler/README.md`](packages/motion-compiler/README.md) | **Réécrit** (dossiers 0.3, contrôles et bancs) |
| [`NOTICE`](NOTICE) | **Complété** : Motion Canvas, HyperFrames (Apache-2.0, portions portées), Lucide, kiwi, MCU, Leonardo, Capsize, tex-linebreak, smartcrop-sharp, music-tempo, dotLottie |

Correction d'une erreur de la version précédente de ce document : les clips générés viennent bien de **Google
Veo 3.1** (`assets/sourcing.ts`), pas de Seedance ; `MOTION_VIDEO.md` était juste sur ce point.
