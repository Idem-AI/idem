# Le moteur vidéo — Motion Canvas

> Toute vidéo motion design d'IDEM et d'iVision est composée et animée par **Motion Canvas 3.17.2** (MIT).
> Historique : le 14 octobre 2026, Motion Canvas remplace l'ancien moteur React (tag Git `video-engine-legacy`) ; le
> 16 octobre, l'IA cesse d'écrire du TSX et écrit un **programme d'animation** compilé par `packages/motion-compiler`
> (0.2.1). Depuis le 29 octobre 2026 (**compilateur 0.3**, plan « qualité avec petits modèles »), l'IA n'écrit plus de
> coordonnées : elle écrit une **intention de scène** ; le code calcule la géométrie et le temps, produit plusieurs
> variantes, les **mesure** et garde la meilleure. Produit, prix et crans : [MOTION_VIDEO.md](MOTION_VIDEO.md).

## 1. Les quatre principes

1. **Motion Canvas est le seul moteur de composition et d'animation.** Rien d'autre ne dessine une scène. Les outils
   externes ont des rôles distincts : capturer une interface, générer une image ou un clip, rendre une animation
   Lottie en clip, dire une voix, encoder (ffmpeg).
2. **L'IA décide du sens, le code décide des pixels.** Le modèle choisit le rôle de la scène, son énergie, un type de
   composition, la hiérarchie, quelques relations et des verbes de mouvement. Positions, tailles, instants, durées,
   courbes et couleurs dérivées sont **calculés** (solveurs Cassowary, système de design du film). Aucun catalogue de
   scènes toutes faites : des types de composition et des recettes de mouvement composables.
3. **Un contrôle esthétique mesurable, jamais le goût d'un modèle.** Chaque variante est jugée sur des mesures
   explicables (composition, mouvement, intention), combinées par des poids **étalonnés sur des préférences
   humaines** (`judge/fit.ts`). Un modèle de vision ne sert qu'à départager deux finalistes à égalité, au cran Ultra,
   et ne décide jamais seul.
4. **Le code garantit ce qui se mesure** : un texte tient dans sa boîte et dans la zone sûre de la plateforme, il reste
   à l'écran le temps d'être lu, les animations ne se battent pas, un même programme s'adapte à chaque format, rien
   ne se croise en chemin (§4).

Ce qui reste vérifié comme avant : la scène s'exécute-t-elle, s'affiche-t-elle sans texte coupé, chevauché ou
illisible **dans chaque format**, le MP4 est-il lisible ? Un défaut est attribué à sa scène, corrigé dans des bornes
strictes (§10), et ce qui résiste reste montré (« Corriger » relance la même boucle).

## 2. Le pipeline

```
demande ─► compréhension ─► directeur ─► planificateur ─► plan du film ─► médias (préparés) / musique (grille) / voix (mots)
                             (concept,     (storyboard,     (code : design,
                              direction)    rôles, énergie)  coutures, sons)
        ─► échantillonneur ×N par scène ─► solveurs + variantes ─► pré-juge ─► contrôle réel ─► juge ─► meilleure scène
           (intentions, sortie structurée)  (géométrie, temps)      (sans rendu)  (Chromium)               │
                                                                                                         ▼
                                                     finition à l'export : flou de mouvement, étalonnage, mixage
```

| Étape | Fichier | Rôle de modèle | Ce qu'elle produit |
| --- | --- | --- | --- |
| Directeur de création | `request/enhance.ts` | étage « rédaction » (`video.brief`) | la demande devient un **brief de production** : déroulé, ce qu'on montre, un ton de narration, rythme d'un film, musique (mis en forme par le code, jamais lu comme un scénario imposé) ; gardé dans `brief.creative` |
| Compréhension | `request/request.ts`, `request/intent.ts` | `video.reader`, `video.intent-classifier` | `RequestSpec` : langue, scénario **mot pour mot**, voix écrite, durée, format, interdits ; l'intention |
| Direction | `director/concept.agent.ts` | `video.concept` | titre, concept, bible visuelle, une idée par scène, **une direction nommée** (jamais celle de la vidéo précédente) et la **courbe d'énergie** |
| Storyboard | `director/storyboard.agent.ts` | `video.planner` | par scène : durée, **rôle** (squelette en 8 temps : accroche → signature), **énergie 1–5**, intention, textes exacts, médias, voix |
| Plan du film | `composition.ts#planFilm`, `motion-compiler/src/design/` | — | système de design du film, coutures entre scènes, sons de transition planifiés, coupes calées sur la musique |
| Médias | `assets/sourcing.ts`, `assets/prepare.ts`, `assets/lottie.ts`, `assets/demo.ts` | (FLUX.2 → Veo 3.1, puis Pexels ; `video.planner` pour une démo) | imports, captures de la marque, animations, écrans de démo ; puis **préparation** (§6) |
| Musique, sons | `audio/music.ts`, `audio/beats.ts`, `audio/sfx.ts` | — | piste libre, **grille des temps** (BeatRoot), extrait calé sur les phrases ; prises d'effets variées |
| Voix | `audio/voice.ts`, `audio/align.ts` | — (voix de l'hôte) | narration traitée (compresseur, de-esser), **mots datés** pour les sous-titres |
| Échantillonnage | `author/sampler.ts`, `author/intent.author.ts` | `video.sampler` (+ `video.author` dès Medium) | N intentions par scène, sortie structurée, raisonnement coupé (§5) |
| Solveurs + compilation | `motion-compiler/src/intent/lower.ts`, `solver/`, `compiler/compile.ts` | — | 4 à 12 variantes résolues par intention → programme → TSX Motion Canvas |
| Juge | `motion-compiler/src/judge/`, `rendering/runner.ts#probeFilm` | `video.judge-vlm` (Ultra, départage) | élimination, score, rapport mesuré (§5) |
| Autocorrection | `author/repair.ts`, `motionVideo.service.ts#repairScenes` | `video.author` | les défauts qui restent, corrigés depuis le rapport ou par la variante suivante (§10) |
| Finition | `rendering/runner.ts#renderFilm`, `rendering/ffmpeg.ts` | — | flou de mouvement, contrôle d'images clés, mixage à deux passes (§9) |

L'orchestrateur est `motionVideo.service.ts` ; les appels passent tous par `agents.ts#callFilmModel` (rôle logique +
cran → modèle sur l'**échelle** du rôle, `apps/api/api/config/ai-models.config.ts`). **Le cran choisit un budget**
(nombre d'essais, réécriture par un modèle plus fort, départage visuel) et la puissance des modèles ; le contexte et
les étapes sont les mêmes partout.

`VIDEO_AUTHOR_MODE=program` rétablit l'auteur 0.2.1 (un programme écrit par scène, sans échantillonnage) : c'est le
chemin de repli, et celui des scènes d'avant le 29 octobre.

### Ce que le code garantit sans toucher à la création

- les durées font la durée achetée ; un **scénario écrit par l'utilisateur** garde ses scènes, ses textes et sa voix
  mot pour mot ; un nombre, une date ou une adresse absents de la demande ne s'affichent pas (`request/facts.ts`) ;
- les médias cités existent, les médias à produire tiennent dans les plafonds ;
- chaque écart est **dit** (`film.fidelity.notes`, dans la langue de la vidéo).

## 3. Le système de design du film (`packages/motion-compiler/src/design/`)

Calculé une fois par film (`buildFilmDesign`), résolu par scène et par format (`resolveSceneDesign`) :

| Couche | Fichier | Contenu |
| --- | --- | --- |
| Directions | `directions.ts` | 6 directions nommées (`editorial`, `tech`, `minimal`, `organic`, `playful`, `bold`), toutes sur **surface claire** ; elles règlent l'échelle typographique, les courbes, la densité, l'étalonnage |
| Couleurs | `color.ts` | rôles dérivés de la marque par **Material Color Utilities** (HCT) et **Leonardo** (contraste visé) : `ground`, `surface`, `ink`, `muted`, `primary`, `on-primary`, `accent`… ; l'encre de la marque est gardée si elle tient 7:1 |
| Typographie | `typography.ts` | échelle modulaire par format (corps : story 5,2 u, portrait 4,8, carré 4,4, paysage 3,6), métriques **Capsize** (hauteur de capitale réelle), coupure des lignes **Knuth-Plass** (`tex-linebreak`), ponctuation française collée |
| Mouvement | `motion.ts` | jetons de durée (`instant` 0,1 s → `xlong` 1 s) et de courbe (`enter`, `exit`, `standard`, `move`, `arrive`, `cut-in`, `cut-out`, ressort), décalages, vitesse par énergie, **temps de lecture** (17 signes/s, minimum 5/6 s) |
| Film | `film.ts` | squelette produit en 8 temps, arc d'énergie à **un seul pic**, coutures selon la loi vectorielle (HyperFrames), sons de transition (≈ une transition sur deux, montée + impact une fois, sur le pic) |
| Zones sûres | `safezones.ts` | marges des plateformes : story x 90 / y 260 (interface d'Instagram et TikTok), portrait 72/96, carré 72/72, paysage 108/72 |
| Étalonnage | `grade.ts` | LUT commune du film par direction (portée de HyperFrames `cube-build.mjs`, Apache-2.0), grain, vignette |

Les **valeurs nommées** passent dans le langage (`size: "title"`, `dur: "medium"`, `ease: "enter"`, `at: "beat:3"`) :
le compilateur les résout avec le design de la scène (`designSize`, `designDur`, `designEase`, `beatAt` du kit).

Les **coutures** (`r_seam` autour de chaque scène) : coupe au vol, zoom traversant, zoom inverse, flou croisé, aplat de
couleur, filé, coupe par le noir, coupe franche. Les sons qui les accompagnent sont planifiés par le film
(`data.cues`, `ctx.planned`) ; une scène ne pose plus son propre son de transition.

## 4. Le contrat d'une scène : l'intention, puis le programme

### 4.1 L'intention (`intent/types.ts`, schéma strict `intent/schema.ts`)

```json
{ "role": "feature", "layout": "media-split", "energy": 3,
  "elements": [
    { "id": "shot", "kind": "image", "media": 0, "rank": 2, "crop": "subject" },
    { "id": "title", "kind": "text", "text": "$headline", "rank": 1, "emphasis": 2 }
  ],
  "relations": [["title", "beside", "shot"]],
  "beats": [
    { "verb": "wipe", "target": "shot", "from": "top" },
    { "verb": "reveal", "target": "title", "style": "words", "after": "shot" },
    { "verb": "highlight", "target": "title", "sync": "downbeat" }
  ] }
```

- **Compositions** : `hero`, `hero-left`, `media-split`, `full-bleed`, `stacked`, `figure`, `list`, `quote`, `device`,
  `end-card`, `grid`.
- **Éléments** : `text`, `image`, `video`, `logo`, `icon` (Lucide, par nom), `device` (téléphone, portable, navigateur
  dessinés en code), `shape`, `list`, `chip`, `button`. Rang 1 = l'élément principal (un seul).
- **Verbes** (`intent/recipes.ts`) : `reveal`, `rise`, `slide-in`, `pop`, `push`, `stack`, `cascade`, `draw`, `count`,
  `type`, `wipe`, `highlight`, `zoom`, `focus`, `blur-in`, `grow`, `nudge`, `exit`. Chaque verbe devient des pas aux
  valeurs nommées. `focus` sur un média zoome **vers son point d'intérêt** (le clic d'une démo, sinon le sujet) ;
  sur un appareil, vers son écran.
- La lecture est **tolérante** (`intent/validate.ts`) : texte manquant ajouté, rang 1 unique imposé, temps par défaut.

### 4.2 Les solveurs (`solver/`)

| Solveur | Ce qu'il calcule |
| --- | --- |
| `geometry.ts` | par format : grille (story 4 colonnes, portrait et carré 6, paysage 12), boîtes de chaque élément par **contraintes Cassowary** (`@lume/kiwi`), piles, aplat sous un texte en plein cadre (marge ≥ 3,6 u), zone calme du média ; **4 à 12 variantes** par intention (côté, proportion, cran d'échelle, alignement) ; notes de faisabilité |
| `time.ts` | instants et durées des pas par contraintes : ordre des temps, chevauchement 30–50 %, temps de lecture, fin avant la couture ; repli par compression |
| `trajectory.ts` | aucun texte n'en croise un autre en chemin : la trajectoire fautive est raccourcie ou changée de côté |

`lower.ts` traduit l'intention résolue en **programme** du langage 0.2.1 (expressions `fmt(story, portrait, square,
landscape)` pour les valeurs par format, `timing: "solved"`), puis le compilateur le traduit en TSX.

### 4.3 Le programme et le compilateur (`dsl/`, `compiler/compile.ts`, version 0.3.0)

Le programme reste le langage d'assemblage, lisible et retouchable : nœuds (`text`, `rect`, `circle`, `line`, `path`,
`polygon`, `image`, `video`, `logo`, `icon`, `device`, `group`, `stack`, `repeat`), piste de pas datés (`at`, `target`,
`dur`, `ease`, `from` / `to`, `stagger`, `repeat`, `effect` : `count`, `type`, `point`). Textes, médias et marque ne sont
jamais écrits dans le programme (`"$clé"`, `media: 0`, rôles de couleur). Le programme est gardé en tête du code
(`/* @idem-motion-program … */`) : retouches et corrections repartent de lui.

| Garantie | Comment |
| --- | --- |
| Un texte n'est jamais coupé | `FIT` : la taille est un plafond ; lignes **équilibrées** (Knuth-Plass, jamais un mot seul en dernière ligne) ; réduit seulement s'il serait coupé ; ramené dans la zone sûre |
| Un texte reste lisible assez longtemps | sixième colonne de la table de piste : le temps de lecture de ses textes ; une sortie n'arrive jamais avant |
| Ce qui entre a fini avant la coupe | piste résolue par le solveur (`SOLVED`) ou mise à l'échelle (`TS`) ; ambiance et sorties finales gardent leur calage |
| Deux animations ne se battent pas | même cible, même propriété : la seconde attend la première (`untangle`) |
| Un média garde son sujet | `fitMedia` recadre sur le point d'intérêt du format (préparé côté serveur) ; un clip démarre à son extrait propre (`seek`) ; un clip transparent est posé entier |
| Les médias de la scène apparaissent | un programme qui n'en montre aucun reçoit le premier en fond |
| La couture est celle du plan | `seamIn` / `seamOut` enveloppent la scène ; aucun son de transition en double |

## 5. L'échantillonnage et le juge

### 5.1 L'échantillonneur (`author/sampler.ts`)

- **Budget** selon la difficulté de la scène (simple 3, moyenne 6, difficile 10 : données, interface, texte long,
  nombreux éléments), plafonné par le cran (Low 6, Medium 8, High 10, Ultra 10 — `VIDEO_SAMPLES_<CRAN>`).
- **Par vagues de 3** : chaque essai change de température (0,4 → 1,0) et de **scène de référence** (les 3 plus proches
  de la bibliothèque, BM25 sur rôle, but et idée visuelle — `references/library.ts`). Le modèle **édite** la référence
  au lieu de tout inventer.
- Chaque intention → ses variantes résolues et **pré-jugées sans rendu** ; les deux meilleures entrent au lot. Après
  chaque vague, les 3 meilleures non contrôlées passent le **contrôle réel** (Motion Canvas, chaque format). Arrêt
  dès qu'une variante dépasse `GOOD_ENOUGH` (0,8).
- Sous le seuil, dès Medium : **réécriture par l'auteur de qualité** (`video.author`) depuis le **rapport mesuré** de la
  meilleure (1 en Medium, 2 en High et Ultra).
- **Ultra** : deux finalistes à moins de 0,03 sont départagés sur image (`author/tiebreak.ts` : deux vignettes côte à
  côte, questions fermées, ordre inversé pour annuler le biais de position ; `VIDEO_VLM_TIEBREAK=off` le coupe).
- La deuxième meilleure (autre intention de préférence) est gardée (`scene.runnerUp`) : la correction peut basculer
  dessus.

### 5.2 Le juge (`judge/`)

| Étage | Mesures |
| --- | --- |
| 1. Élimination | erreur d'exécution, texte coupé / chevauché / caché / illisible dans un format, média absent, texte retiré avant son temps de lecture |
| 2. Composition (`composition.ts`) | alignement, grille, équilibre et centre des masses (Ngo et al.), densité (22–55 %), hiérarchie (≥ 1,5), élément principal pas timide, respiration, au plus 4 tailles ; sur l'image rendue : encombrement (contours), nombre de teintes, contraste le plus faible |
| 3. Mouvement (`motion.ts`) | courbes, simultanéité selon l'énergie, chevauchement, trajectoires, aucun tremblement ni boucle d'attente sur un texte, titre posé immobile, variété des entrées, départs sur les temps (± 120 ms), courbes du système |
| 4. Intention (`motion.ts#intentAssertions`) | prédicats à la manière de MoVer : « a avant b », « le titre apparaît tôt », « la photo entre par la droite », « chaque texte reste lisible » |

Score = moyenne pondérée (`DEFAULT_WEIGHTS` de `score.ts`, remplacés par `judge-weights.json` ou
`VIDEO_JUDGE_WEIGHTS` une fois étalonnés). Le **rapport** donne, pour chaque mesure sous son seuil, l'élément, le
format, la valeur, le seuil et le correctif proposé (un cran d'échelle, une autre variante, une zone calme).

**Étalonnage** (`bench/quality/`) : 40 briefs (`briefs.ts`), banc payant par cran (`run.ts`), planche de paires à
l'aveugle (`rate.ts`, 5 évaluateurs, ~200 paires), régression logistique sur les préférences (`fit.ts --write`), seuil
d'accord ≥ 65 % avant de faire confiance au juge.

## 6. Les médias préparés (`assets/prepare.ts`, `assets/lottie.ts`, `assets/demo.ts`)

Avant l'écriture des scènes, chaque image ou clip est préparé par le code :

- **point d'intérêt par format** (smartcrop) et **zone calme** où poser un texte (densité de contours, loin du sujet) ;
- **teintes dominantes** (k-moyennes) ;
- un clip : extrait **sans coupe ni image figée ni noir** (ffmpeg `freezedetect`, `blackdetect`, `scdet`) ;
- **étalonnage commun** du film (LUT de la direction, grain, vignette ; copie étalonnée, original gardé) — jamais pour
  une capture d'interface ni un clip transparent.

**Lottie.** Un import `.json` / `.lottie` est rendu **image par image** par dotLottie-web (`setFrame`, dans le
Chromium du moteur, réseau fermé) en **WebM VP9 transparent** : il devient un clip comme les autres, posé entier
(`transparent`, jamais rogné). Une petite sélection interne, dessinée en code (`motion/lottie-library/`, générée par
`npm run lottie:library` : coche, éclat, flèche, soulignement), est recolorée à la couleur de la marque et proposée au
storyboard comme média (`VIDEO_LOTTIE_LIBRARY=off` la retire).

**Démo produit scriptée.** `input.demo = { url, goal?, device? }` : la **carte** des éléments actionnables visibles de
la page est relevée (jamais un champ mot de passe), un agent (`video.planner`, sortie structurée) écrit au plus
6 étapes (montrer, cliquer, écrire, défiler), le code les joue et capture l'écran **avant** chaque action avec le
**point** de l'action, puis l'écran d'arrivée. Chaque capture devient un média « écran » dont le point sert de cadrage
et de cible au verbe `focus` (effet `point`). Garde réseau des rendus (aucune adresse privée).

## 7. Le harnais (`motion/runtime/harness.tsx`) et le kit (`motion/kit`)

Chaque scène est une scène Motion Canvas (`makeScene2D`) qui enveloppe le code compilé sans le modifier :

- **durée exacte** (ce qui dépasse est coupé, ce qui manque tenu sur la dernière image ; une image de plus entre deux
  scènes) ; **erreurs** attribuées à leur scène, montrées à sa place ;
- **contexte** : textes et médias vivants (une retouche se voit sans recompiler), grille des temps (`ctx.beats`),
  design de la scène, coutures, zone sûre de la plateforme, horloge du film ;
- **sous-titres** de la voix **mot par mot** quand les mots sont datés (alignement `IDEM_ALIGN_URL`, sinon estimation
  sur les silences) ;
- **sons** : `ctx.sfx(kind)` note l'instant ; les sons du plan du film sont ajoutés au mixage.

Le kit `@idem/motion` ne contient que des **outils** : `safeArea`, `fitMedia`, `measureText`, `fitFontSize`,
`balanceLines`, `readableOn`, `contrast`, `designSize/Dur/Ease/Stagger/Weight`, `beatAt`, `readTime`, `seamIn/Out`.

## 8. Le rendu (`rendering/`)

| Fichier | Rôle |
| --- | --- |
| `compiler.ts` | `compileScene`, `buildFilmBundle` (runtime + scènes, IIFE) |
| `runner.ts` | Chromium partagé (`filmBrowser` le prête aussi au rendu Lottie et aux démos) ; origine fictive `https://film.idem.local`, **tout autre réseau refusé** ; `probeFilm` (contrôle, vignettes, contraste mesuré, pixels pour le juge), `renderFilm` |
| `ffmpeg.ts` | encodage H.264, mixage, `probe` |
| `preview.ts` | page d'aperçu autonome, CSP stricte (`connect-src 'none'`) |
| `formats.ts` | composition fixe : story 1080×1920, carré 1080×1080, portrait 1080×1350, paysage 1920×1080 ; la qualité ne change que l'échelle de sortie et la cadence |

`--disable-accelerated-2d-canvas` reste essentiel (encodage JPEG d'une image 1080p ≈ 40 ms au lieu de ~200 ms).

### Sécurité du code exécuté

Le code compilé ne s'exécute **que dans un navigateur** : origine fictive, interception de toutes les requêtes, médias
téléchargés par le serveur (`safeFetch`, anti-SSRF) ; aperçu en iframe `sandbox="allow-scripts"` et CSP fermée ;
imports limités à `@motion-canvas/core`, `@motion-canvas/2d`, `@idem/motion`. Le rendu Lottie et la démo produit
utilisent le même navigateur et la même garde réseau.

## 9. La finition à l'export

| Étape | Réglage |
| --- | --- |
| **Flou de mouvement** | sous-images rendues puis fondues (`tmix` + `select`) : 6 sous-images (4 en premium à 60 i/s), obturateur 180° — `VIDEO_MOTION_BLUR=off`, `VIDEO_MOTION_BLUR_SAMPLES`, `VIDEO_MOTION_BLUR_SHUTTER` |
| **Images clés** | avant l'encodage, les 4 scènes les plus énergiques sont contrôlées à 60 % de leur durée : une erreur arrête le format, un défaut est journalisé (`video.render.keyframe_issue`) |
| **Coupes sur la musique** | les coupes sont rapprochées du temps le plus proche (`VIDEO_SNAP_CUTS=off`), l'extrait de musique finit sur une fin de phrase musicale (fondu court) |
| **Voix** | compresseur et de-esser ; la musique s'efface sous la voix (`sidechaincompress` 8:1), les effets un peu (2,5:1) |
| **Effets** | moins nombreux, sur les temps ; plusieurs **prises** par sorte, tournées pour ne jamais répéter le même son |
| **Volume** | `loudnorm` en **deux passes** (mesure puis application linéaire, sans pompage) : −14 LUFS, crête −1,5 dBTP |

## 10. L'autocorrection bornée

`author/repair.ts` et `motionVideo.service.ts#repairScenes`. Pour une scène écrite par intention :

1. **sauvetage sans modèle** (`rescueIntentScenes`, `composition.ts#rescueOptions`) : la seconde variante gardée par le
   juge (`runnerUp`), puis jusqu'à 3 variantes proposées par le rapport mesuré (un cran d'échelle, une autre zone pour
   le texte…) — chacune recompilée et recontrôlée ;
2. **correction depuis le rapport** : l'auteur de qualité réécrit l'intention depuis le rapport mesuré (l'élément, le
   format, la valeur, le correctif) ;
3. le **dernier recours du code** (`inkFallback`) : encre lisible d'après la couleur réelle du fond, ou aplat sous un
   texte posé sur une photo — recompilé, recontrôlé, gardé seulement s'il s'affiche mieux.

Une scène qui s'exécutait n'est **jamais** remplacée par une version qui plante ou s'affiche moins bien. Une tentative
à la fois par scène, 3 scènes en parallèle au plus ; budget du film : `VIDEO_REPAIR_TOKEN_BUDGET` (400 000 jetons),
`VIDEO_REPAIR_MAX_MS` (600 s), `VIDEO_REPAIR_ATTEMPTS` (3). Journal : `film.repair` (dont `firstPassLayout` : les
défauts au premier jet, et `inkFallbacks`), `scene.author.repairs`. Les scènes en programme (avant le 29 octobre ou
`VIDEO_AUTHOR_MODE=program`) gardent les trois approches `fix` → `rewrite` → `minimal`.

## 11. Retouches et export

`MotionVideoService.updateVideo(patch)` (`sanitizeVideoPatch` valide le corps HTTP, IDEM et iVision) :

| Champ | Effet |
| --- | --- |
| `texts`, `images` | données des scènes ; pour une scène par intention, la **géométrie est recalculée** par les solveurs, sans modèle |
| `visual` | `{ s2: "plus lent" }` ou `{ all: … }` : l'intention de la scène est réécrite, puis résolue et jugée |
| `fix` | correction volontaire d'une scène en erreur |
| `regenerate` | nouvelle version d'une scène : un nouvel échantillonnage |
| `voice`, `voiceLines`, `captions` | voix off, lignes, sous-titres |
| `musicMood`, `musicTrackId`, `sfx`, `scope` | musique, effets, périmètre |

`reviseFromText` lit une retouche écrite. L'export est refusé tant qu'une scène est en erreur (`scene_errors`).

## 12. L'aperçu et l'éditeur

`motion/runtime/player.ts` joue le film en temps réel. Protocole avec `packages/shared-video-editor` :
`ivision:ready`, `ivision:loading`, `ivision:playable`, `ivision:time`, `ivision:errors` vers l'éditeur ;
`ivision:play`, `ivision:pause`, `ivision:seek`, `ivision:focus`, `ivision:edit` vers l'aperçu. Les données de chaque
scène sont rafraîchies (géométrie recalculée) avant contrôle, aperçu et export.

## 13. Modèles (OpenRouter, open-weight)

| Rôle | Échelle | Low | Medium | High | Ultra |
| --- | --- | --- | --- | --- | --- |
| `video.concept`, `video.planner`, `video.reviser` | `video-design` | qwen3.8-27b | qwen3.8-27b | glm-5.3-flash | glm-5.3-flash |
| `video.author` (qualité, réécriture) | `video-code` | qwen3.6-35b-a3b | qwen3.8-27b | qwen3.8-27b | qwen3.8-27b |
| `video.sampler` (essais) | `video-sample` | qwen3.6-35b-a3b | idem | idem | idem |
| `video.judge-vlm` (départage) | `video-vision` | qwen3.8-27b (utilisé en Ultra) | | | |
| `video.teacher` (hors ligne) | `video-teacher` | qwen3.8-2.4t-a95b ; replis deepseek-v4.1-flash, glm-5.3 | | | |

Réglages d'appel (`apps/api/api/services/creativity/orchestrator.ts#openRouterCallOptions`) : sortie structurée
`json_schema` stricte avec `provider.require_parameters`, greffon `response-healing`
(`IDEM_OPENROUTER_RESPONSE_HEALING=off`), précisions `bf16,fp8` (`IDEM_OPENROUTER_QUANTIZATIONS`), fournisseur servi
journalisé (`ai.served`), raisonnement coupé pour l'échantillonnage, graine et température par essai. Pour le banc :
fournisseurs épinglés (`--providers`). Un barreau se remplace sans code (`IDEM_LADDER_VIDEO_SAMPLE_<CRAN>`…, voir
`ai-models.config.ts`).

## 14. Contrôles (gratuits sauf mention)

| Commande | Ce qu'elle prouve |
| --- | --- |
| `npm run check --prefix packages/motion-compiler` | langage, validation, exemples, garanties exécutées dans Motion Canvas (story et paysage) |
| `npm run check:intent --prefix packages/motion-compiler` | design, couleurs, typographie, solveurs, variantes, juge, coutures, rendu réel |
| `npm run bench:quality:offline --prefix packages/motion-compiler` | chaque scène de référence dans les 4 formats : défauts d'affichage, recours, score |
| `npm run check:intent` (apps/ivision/core) | création complète par intention, modèles simulés : plan du film, médias préparés, grille musicale, échantillonnage, juge, retouches, export avec flou |
| `npm run check:motion` (apps/ivision/core) | le chemin programme (0.2.1) de bout en bout |
| `npm run check:lottie` (apps/ivision/core) | Lottie → WebM transparent, recoloration, import refusé si ce n'est pas une animation |
| `npm run check:demo` (apps/ivision/core) | carte de page, agent simulé, parcours réel, zoom vers le clic mesuré sur l'image |
| `npm run check:brief` (apps/ivision/core) | directeur de création (agent simulé) : brief lu comme un brief, faits gardés, voix de l'utilisateur ; narration à ton constant |
| `npm run check:comm` (apps/api) | périodes du calendrier, et le plan des vidéos : nettoyage, mise en forme de la demande |
| `npm run check:roles` (apps/api) | les échelles de modèles et les nouveaux rôles |
| `npm run typecheck` (apps/ivision/core) | Node et navigateur |
| **payant** `npm run bench:quality --prefix packages/motion-compiler` | le banc réel par cran ; puis `bench:quality:rate`, `bench:quality:fit` |
| **payant** `npm run references:teach` puis `references:promote` | la bibliothèque de scènes de référence, écrite par le professeur et triée par l'équipe |

## 15. Faire évoluer le moteur

- **Un nouveau verbe** : `intent/types.ts` (VERBS), une recette (`intent/recipes.ts`), une assertion si utile, un cas
  dans `scripts/check-intent.ts`. Jamais une scène toute faite.
- **Une nouvelle composition** : `LAYOUT_KINDS`, son cas dans `solver/geometry.ts`, ses variantes dans `variantChoices`,
  une scène de référence dans `references/library.ts`.
- **Un nouveau poids du juge** : une mesure 0 → 1 dans `judge/`, un poids de départ dans `DEFAULT_WEIGHTS`, puis
  l'étalonnage sur le banc.
- **Une montée de Motion Canvas** : version exacte (`apps/api/package.json`, `apps/ivision/core/package.json`,
  `MOTION_CANVAS_VERSION`), `npm run typecheck`, `check:motion`, `check:intent`, et `check` dans le package.

## 16. Les vidéos de l'ancien moteur

Une vidéo sans `film` (créée avant le 14 octobre 2026) est marquée `legacy` : ses MP4 se téléchargent, elle ne se
prévisualise ni ne se retouche plus (`legacy_video`).
