# Le moteur vidéo — Motion Canvas

> Depuis le 14 octobre 2026, toute vidéo motion design d'IDEM et d'iVision est composée et animée par
> **Motion Canvas 3.17.2** (MIT). Depuis le 16 octobre 2026, l'IA n'écrit plus le code Motion Canvas : elle écrit
> un **programme d'animation** compact (le langage de mouvement, JSON) qu'un **compilateur déterministe**
> traduit en scène Motion Canvas — `packages/motion-compiler`. L'auteur TSX libre est supprimé (banc d'essai :
> 8 vidéos livrées sur 8 contre 3 sur 8, 37 % de jetons générés en moins ; `packages/motion-compiler/bench`).
> L'ancien moteur React est conservé par le tag Git `video-engine-legacy`. Produit, prix et crans :
> [MOTION_VIDEO.md](MOTION_VIDEO.md).

## 1. Les quatre principes

1. **Motion Canvas est le seul moteur de composition et d'animation.** Rien d'autre ne dessine une
   scène. Les outils externes ont des rôles distincts : capturer une interface, générer une image ou un
   clip, dire une voix, encoder (ffmpeg).
2. **L'IA est libre, le langage est composable.** Aucun catalogue de mises en page, de motifs ou de
   transitions : le langage n'a que des primitives (texte, formes, tracés, médias, piles, répétitions, caméra)
   et une piste de pas datés. Le directeur invente le film ; l'auteur compose chaque scène comme il l'entend.
3. **Pas de contrôle esthétique.** Le programme n'est jamais critiqué ni remplacé par une composition de
   secours. Seules les erreurs TECHNIQUES et les défauts d'AFFICHAGE (texte coupé par le cadre, textes qui se
   chevauchent) déclenchent une correction, bornée (§9 bis).
4. **Le code garantit ce qui se mesure** : un texte tient toujours dans sa boîte et dans la zone sûre, la
   chorégraphie finit avant la coupe en laissant le temps de lire, deux animations de la même propriété
   s'enchaînent au lieu de se battre, un même programme s'adapte à chaque format de la vidéo (§3 bis).

Ce qui reste vérifié : le programme est-il valide, la scène s'exécute-t-elle, s'affiche-t-elle sans texte coupé
ni chevauché **dans chaque format**, le MP4 est-il lisible ? Un défaut est attribué à sa scène, corrigé
automatiquement dans des bornes strictes, et ce qui résiste reste montré (« Corriger » relance la même boucle).

## 2. Le pipeline

```
demande ─► compréhension ─► directeur ─► planificateur ─► médias / musique / voix ─► auteur (×N) ─► compilateur ─► contrôle
            (code + lecteur)   (concept)    (storyboard)                                (programme)    (TSX)          (Chromium, chaque format)
```

| Étape | Fichier | Rôle de modèle | Ce qu'elle produit |
| --- | --- | --- | --- |
| Compréhension | `request/request.ts`, `request/intent.ts` | `video.reader`, `video.intent-classifier` (dès Medium) | `RequestSpec` : langue, scénario scène par scène, textes **mot pour mot**, voix écrite, durée, format, interdits ; l'intention (objectif, matière, mouvement) |
| Direction | `director/concept.agent.ts` | `video.concept` | titre, concept, **bible visuelle**, une idée par scène |
| Storyboard | `director/storyboard.agent.ts` | `video.planner` | par scène : durée, intention, idée visuelle, idée de mouvement, entrée, textes exacts (par clé), médias, médias à produire, ligne de voix. Sans concept (directeur en panne), il invente aussi le film |
| Médias | `assets/sourcing.ts`, `assets/media.ts`, `assets/brandmedia.ts` | — (génération FLUX → Seedance, puis Pexels) | imports d'abord, captures de la marque, puis les médias demandés par le storyboard |
| Musique, sons | `audio/music.ts`, `audio/beats.ts`, `audio/sfx.ts` | — | piste libre et son tempo ; sonothèque CC0 |
| Voix | `audio/voice.ts` | — (voix de l'hôte) | lignes dites, scènes calées sur elles sans changer la durée achetée |
| Auteur | `author/program.author.ts` | `video.author` | le **programme** de chaque scène (langage de mouvement), validé ; refusé, redemandé une fois avec les erreurs exactes |
| Compilateur | `packages/motion-compiler/src/compiler/compile.ts` | — | le TSX Motion Canvas de la scène, déterministe, programme gardé en tête du code |
| Contrôle | `rendering/runner.ts#probeFilm` | — | chaque scène exécutée **dans chaque format** : erreurs d'exécution, défauts d'affichage (`layout`), vignettes, effets sonores posés |
| Autocorrection | `author/repair.ts`, `motionVideo.service.ts#repairScenes` | `video.author` (cran, puis cran au-dessus) | les scènes en erreur ou mal affichées corrigées avant livraison, dans des bornes strictes (§9 bis) |

L'orchestrateur est `motionVideo.service.ts` ; les appels de modèles passent tous par
`agents.ts#callFilmModel` (rôle logique + cran → l'hôte choisit le modèle sur l'**échelle** du rôle,
`apps/api/api/config/creative-roles.ts#MODEL_LADDERS`). **Les étapes et le contexte sont les mêmes à tous les
crans : la jauge de créativité choisit la puissance des modèles** (voir [MOTION_VIDEO.md](MOTION_VIDEO.md)).

### Ce que le code garantit sans toucher à la création

- les durées font la durée achetée (mise à l'échelle) ;
- un **scénario écrit par l'utilisateur** garde ses scènes, ses textes et sa voix mot pour mot ; le
  planificateur n'y décide que du visuel et du mouvement (scènes retrouvées par leur numéro) ;
- un nombre, une date ou une adresse absents de la demande ne s'affichent pas (`request/facts.ts#isGrounded`) ;
- les médias cités existent, les médias à produire tiennent dans les plafonds ;
- chaque écart est **dit** (`film.fidelity.notes`, dans la langue de la vidéo) : texte retiré, média
  introuvable, 4K demandé, voix non dite.

Une réponse **illisible** (format) du planificateur est redemandée une fois avec le rappel du format ;
une réponse **sans code** de l'auteur (panne, délai, réponse vide) est redemandée une fois. Un code qui
ne compile pas ou plante à l'exécution passe par l'**autocorrection bornée** (§9 bis) — jamais par une
critique esthétique.

## 3. Le contrat d'une scène : un programme

Le modèle écrit un programme JSON (référence complète donnée au modèle : `packages/motion-compiler/src/author/reference.ts`) :

```json
{ "bg": "background", "enter": { "type": "fade", "dur": 0.5 },
  "nodes": [
    { "id": "title", "type": "text", "text": "$headline", "split": "words", "y": "pick(-SH*0.1, 0)", "width": "SW", "size": 12, "weight": 800 },
    { "id": "photo", "type": "image", "media": 0, "w": "pick(SW, SW*0.5)", "h": "pick(SH*0.5, SH)", "zoom": 1.15 }
  ],
  "timeline": [
    { "at": 0.2, "target": "title.*", "dur": 0.5, "stagger": 0.07, "ease": "outBack", "from": { "opacity": 0, "y": "+=6" }, "to": {} },
    { "at": 0, "target": "photo", "dur": "D", "ease": "linear", "to": { "zoom": 1 } },
    { "at": 0.9, "sfx": "softwhoosh" }
  ] }
```

- **Nœuds** : `text` (découpe `split` en mots ou lettres), `rect` (masque `clip`), `circle`, `line`, `path`, `polygon`,
  `image`, `video`, `logo`, `group`, `stack` (flexbox ; `dir: "auto"` = colonne en vertical, ligne sinon), `repeat`
  (grille, ligne, colonne, cercle ; données `data`).
- **Unités** : `u` = 1 % du petit côté, origine au centre. Expressions : `W H L R T B SW SH`, `30%` (de l'axe),
  `pick(vertical, horizontal)`, `min`, `max`… ; instants `D`, `V` (voix), `VE`.
- **Piste** : `at`, `target` (`id`, `id.*`, `id.2`, `world` = caméra), `dur`, `ease`, `from` / `to` (valeurs relatives
  `+=6`), `stagger`, `repeat` (`loop`, `yoyo`), `effect` (`count`, `type`), `sfx`.
- **Les textes, les médias et la marque ne sont jamais écrits dans le programme** : `"$clé"`, `media: 0`, jetons de
  couleur (`primary`, `ink`, `on-accent`, `primary/40`). Retoucher un texte ou une photo ne touche pas au programme.
- **Validation technique** (`dsl/validate.ts`) : refusé = forme, type inconnu, cible absente, texte littéral, média
  absent, expression illisible ; simple avertissement (la chose est ignorée ou convertie, le programme gardé) = propriété inconnue
  ou sans effet, effet sonore inconnu ou en trop, courbe inconnue (alias reconnus : `easeOutCubic`, `swoosh`…), calcul
  constant (« 0.4*2 » → 0.8), texte de la scène écrit en clair (remplacé par sa clé), texte inventé ou affiché deux
  fois (nœud retiré, avec les pas qui ne visaient que lui : rien d'inventé, la scène vit).
- Le compilateur produit le fichier attendu par le harnais (`export default function* (view, ctx)`, trois modules :
  `@motion-canvas/core`, `@motion-canvas/2d`, `@idem/motion`). Le programme est gardé en tête du code
  (`/* @idem-motion-program … */`) : retouches et corrections repartent de lui. Les scènes écrites avant le
  16 octobre (TSX) jouent toujours ; « Changer cette scène » les réécrit en programme.

### 3 bis. Les garanties du compilateur (déterministes, jamais esthétiques)

| Garantie | Comment |
| --- | --- |
| Un texte n'est jamais caché en partie | l'ordre de dessin est celui du programme (un volet qui recouvre entièrement les textes reste une transition voulue) ; un texte caché EN PARTIE est relevé par le contrôle et remis devant (dernier recours) |
| Un texte s'arrête dans le cadre | la position d'arrivée d'un texte posé dans la scène est ramenée dans la zone sûre (il peut entrer depuis l'extérieur) |
| Un nœud déclaré caché apparaît | une propriété de `from` sans `to` revient à sa valeur déclarée, sauf opacité ou échelle déclarée nulle : elle va à 1 |
| Une pile n'est jamais coupée | `KEEP` : mesurée après sa mise en page, réduite si elle dépasse la zone sûre, ramenée dedans |
| Un texte n'est jamais coupé | `FIT` : la taille demandée est un plafond ; le texte passe à la ligne dans sa largeur (ou la place restante dans la zone sûre), n'est réduit que s'il serait coupé, et (posé dans la scène) est ramené dans la zone sûre |
| Ce qui entre a fini avant la coupe | la piste entière est mise à l'échelle (`TS`) pour finir à `D − E − min(1,6 s ; 30 % de D)` ; un pas d'ambiance (travelling `dur: "D"`, boucle) garde sa durée ; une sortie finale (fondu de fin, rien n'entre après) reste calée sur la fin |
| Deux animations ne se battent pas | même cible, même propriété, en même temps : la seconde commence quand la première finit (`untangle`) |
| Un programme pour tous les formats | l'auteur reçoit le cadre de CHAQUE format de la vidéo ; `pick()`, `%` et `dir: "auto"` adaptent la composition ; le contrôle vérifie chaque format |

### La taille de composition

Chaque format a une taille fixe : story 1080×1920, carré 1080×1080, portrait 1080×1350, paysage
1920×1080 (`rendering/formats.ts#COMPOSITION`). La qualité ne change que l'**échelle de sortie**
(`resolutionScale` de Motion Canvas : 2/3 en standard, 1/2 en aperçu) et la cadence (60 i/s en
premium). Le code d'une scène ne dépend donc jamais de la qualité exportée.

## 4. Le harnais (`motion/runtime/harness.tsx`)

Chaque scène du film est une scène Motion Canvas créée par `makeScene2D`, qui enveloppe le code de
l'IA **sans le modifier** :

- **durée exacte** : le code tourne en tâche fille (`yield`), le harnais attend la durée prévue puis la
  scène se termine — ce qui dépasse est coupé, ce qui manque est tenu sur la dernière image. Une image
  de plus est attendue pour toute scène suivie d'une autre (Motion Canvas remplace la dernière image
  d'une scène par la première de la suivante) : le film garde sa durée à l'image près ;
- **erreurs** : une exception est attribuée à SA scène et montrée à sa place (carte d'erreur explicite,
  jamais une autre composition) ; les autres scènes continuent ;
- **sons** : `ctx.sfx(kind)` note l'instant ; le serveur mixe ces effets au rendu (`refineCues` n'y
  applique que l'hygiène du mixage : espacement, saturation) ;
- **sous-titres** de la voix off, posés au-dessus des scènes quand ils sont demandés ;
- **données vivantes** : les textes et médias sont relus à chaque passage — l'aperçu montre une retouche
  sans recompiler.

`motion/runtime/engine.ts` pilote Motion Canvas **sans son éditeur** (ni Vite, ni fichiers `.meta`) :
il instancie les scènes comme le `Renderer` de Motion Canvas, puis les avance image par image (rendu)
ou en temps réel (aperçu).

## 5. Le kit `@idem/motion` (`motion/kit`)

Des **outils**, jamais des compositions (`safeArea`, `fitMedia`, `measureText`, `fitFontSize`, `readableOn`, `alpha`,
`contrast`…), importés par le code que produit le compilateur. Le moteur de piste (relier une propriété du langage au
signal du nœud, valeurs relatives, boucles) est embarqué dans chaque scène compilée.

Les **exemples** (`packages/motion-compiler/src/author/examples.ts` : titre cinétique, données, photo, interface,
signature) sont des programmes responsives qui montrent des techniques ; le constructeur de contexte en joint deux
selon la scène. Ce ne sont pas des gabarits : le prompt le dit.

## 6. Le contexte de l'auteur (`author/program.author.ts#buildProgramPrompt`)

Un appel par scène, avec seulement :

1. la **référence du langage** (primitives, unités, piste, responsive, grammaire du mouvement, règles) ;
2. deux **exemples** de programmes choisis par les mots de la scène et ses médias ;
3. la **fiche** : film (titre, concept, bible), **cadres de tous les formats** de la vidéo (W, H, zone sûre en u),
   rang, durée, marque, scènes voisines, intention, idées visuelle et de mouvement, entrée, textes exacts (`$clé`),
   médias (rang, dimensions, description), voix et son instant, tempo ;
4. pour une retouche : le programme actuel et la demande ; pour une correction : le programme actuel, le problème
   exact (erreur ou défaut d'affichage) et les problèmes déjà rencontrés.

## 7. Le rendu (`rendering/`)

| Fichier | Rôle |
| --- | --- |
| `compiler.ts` | `compileScene` (une scène : syntaxe, imports, `export default`) ; `buildFilmBundle` (runtime + scènes, IIFE, minifié pour l'aperçu). Une scène qui ne compile pas n'entre pas dans le paquet : le harnais montre son erreur |
| `runner.ts` | Chromium partagé ; page servie depuis l'origine fictive `https://film.idem.local` (page, paquet, médias répondus depuis la mémoire, plages HTTP pour les clips) ; **tout autre accès réseau est refusé** ; `probeFilm` (contrôle + vignettes), `renderFilm` (tronçons rendus en parallèle, JPEG → ffmpeg, recollés, son mixé, affiche) |
| `ffmpeg.ts` | encodage H.264, mixage (musique, effets posés par les scènes, voix ; compresseurs ; −14 LUFS), `probe` |
| `preview.ts` | la page d'aperçu autonome : même paquet, lecteur temps réel, CSP stricte (`connect-src 'none'`), images embarquées (data URI : `Img` charge en CORS) |
| `formats.ts` | taille de composition et sortie de chaque format |

Mesures (poste de développement) : contrôle de 7 scènes ≈ 3 s ; MP4 de 15 s en 720p ≈ 7 s. Le drapeau
Chromium `--disable-accelerated-2d-canvas` est essentiel : sans lui, la relecture GPU logicielle porte
l'encodage JPEG d'une image 1080p à ~200 ms (≈ 40 ms avec).

### Sécurité du code exécuté

Le code écrit par l'IA ne s'exécute **que dans un navigateur** : jamais dans Node.

- Rendu serveur : origine fictive, interception de toutes les requêtes, réseau coupé hors de la page et
  de ses médias (déjà téléchargés par le serveur avec `safeFetch`, anti-SSRF).
- Aperçu : iframe `sandbox="allow-scripts"` (origine opaque) et CSP qui interdit toute connexion.
- Imports limités aux trois modules ; aucun accès aux secrets, au système de fichiers ou au réseau.

## 8. L'aperçu et l'éditeur

`motion/runtime/player.ts` joue le film en temps réel (musique, voix et effets calés sur la lecture,
préchargés avant de proposer la lecture). Protocole avec l'éditeur parent
(`packages/shared-video-editor`) :

- vers l'éditeur : `ivision:ready` (durée, scènes, erreurs), `ivision:loading`, `ivision:playable`,
  `ivision:time`, `ivision:errors` ;
- vers l'aperçu : `ivision:play`, `ivision:pause`, `ivision:seek`, `ivision:focus`, `ivision:edit`
  (textes ou média d'une scène : la donnée change, le code non).

L'éditeur montre, par scène : son état (une scène en erreur affiche son message et **Corriger**), ses
textes, sa photo, et « Changer cette scène » (consigne en clair → l'auteur réécrit SEULEMENT cette
scène ; **Nouvelle version** → réécriture depuis la fiche). Une réécriture qui ne compile pas ne
remplace jamais un code qui marchait : l'échec est rendu dans le rapport.

## 9. Retouches et export

`MotionVideoService.updateVideo(patch)` (`sanitizeVideoPatch` valide le corps HTTP, IDEM et iVision) :

| Champ | Effet |
| --- | --- |
| `texts`, `images` | données des scènes (le code ne change pas) |
| `visual` | `{ s2: "plus lent" }` ou `{ all: … }` : l'auteur réécrit le code de la scène |
| `fix` | correction volontaire d'une scène en erreur (code + erreur donnés à l'auteur) |
| `regenerate` | nouvelle version d'une scène, depuis sa fiche |
| `voice`, `voiceLines`, `captions` | voix off (dite, recalée), lignes, sous-titres |
| `musicMood`, `musicTrackId`, `sfx`, `scope` | musique, effets, périmètre |

`reviseFromText` lit une retouche écrite (`revise.ts`) : textes, voix, demande visuelle par scène,
réglages, ou « c'est une nouvelle vidéo ». Route IDEM `POST …/videos/:id/revise`, conversation iVision.

L'export est **refusé tant qu'une scène est en erreur** (`scene_errors`). Une scène qui échoue pendant
le rendu (cas rare : erreur apparue après le contrôle) fait échouer ce format (`scene_error`) et
marque la scène ; le fichier n'est pas livré. La file de rendu, les rendus d'avance, les signatures de
fraîcheur et les remboursements sont inchangés.

## 9 bis. L'autocorrection bornée

`author/repair.ts` (stratégies, budget, journal) et `motionVideo.service.ts#repairScenes` (la boucle) :

- ce qui se corrige : une scène en erreur (programme refusé, exécution) **et** une scène mal affichée (texte coupé par
  le cadre, textes qui se chevauchent, texte caché par une forme ou une image dessinée par-dessus, texte barré par un trait, lettres d'un mot superposées, texte qui ne se lit pas sur son fond (contraste mesuré sur les pixels rendus autour de lui), texte posé sur une photo sans aplat, texte traversé par un trait ou à cheval sur un contour, scène qui n'affiche aucun de ses textes — relevés dans l'ordre de dessin réel par `probeFilm` à 78 % et 95 % de la scène — quand tout est installé —, dans chaque format) ;
- trois approches, dans l'ordre, une par tentative : `fix` (modèle du cran, programme + problème exact), `rewrite`
  (modèle du cran au-dessus, depuis la fiche, plus simple, problèmes passés connus), `minimal` (même modèle,
  version la plus simple : une pile de textes, quelques formes et médias) ;
- un défaut d'affichage reçoit deux approches du modèle (corriger, réécrire), puis le **dernier recours du code**
  (`inkFallback`) : un texte illisible sur son fond reçoit l'encre lisible (clair ou foncé) choisie d'après la couleur
  réelle du fond ; un texte posé sur une photo, traversé par un trait ou à cheval sur un contour est placé sur un aplat
  (couleur du fond de la marque, encre lisible ; ses mouvements passent à l'aplat). La scène est recompilée,
  recontrôlée, gardée seulement si elle s'affiche mieux ;
- une scène qui s'exécutait n'est **jamais** remplacée par une version qui plante ou s'affiche moins bien ; un défaut
  d'affichage qui reste est noté (`scene.layout`, `film.repair.layoutLeft`) sans bloquer l'export ;
- **une tentative à la fois par scène** (les scènes différentes avancent en parallèle, 3 au plus), jamais deux fois
  la même approche ; après chaque tour, `probeFilm` réexécute le film et donne le verdict ;
- budget du film : jetons (`VIDEO_REPAIR_TOKEN_BUDGET`, 80 000) et temps (`VIDEO_REPAIR_MAX_MS`, 240 s) ; budget
  épuisé = arrêt net, noté `film.repair.stopped` ;
- sortie : `film.repair` (tentatives, scènes corrigées, scènes restées en erreur, jetons) et `scene.author.repairs`.

Elle tourne à la création, après toute réécriture demandée (consigne, nouvelle version) et sur « Corriger ».
Une retouche visuelle qui ne s'exécute toujours pas après correction rend l'ancien code.

## 10. Les vidéos de l'ancien moteur

Une vidéo sans `film` (créée avant la migration) est marquée `legacy` : ses MP4 se téléchargent, elle
ne se prévisualise ni ne se retouche plus (`legacy_video`). Les deux interfaces le disent.

## 11. Contrôles

| Commande | Ce qu'elle prouve |
| --- | --- |
| `npm run check --prefix packages/motion-compiler` | expressions (%, `pick`), validation, exemples compilés ; garanties exécutées dans Motion Canvas en story ET en paysage : aucun texte coupé ni chevauché, texte géant ramené dans le cadre, piste trop longue qui finit avant la coupe, chevauchement détecté ; MP4 par format |
| `npm run check:video` (apps/api) = `npm run check:motion` (apps/ivision/core) | film de programmes contrôlé (seule la scène fautive en erreur, effets relevés, vignettes, affichage) ; import inexistant d'une ancienne scène isolé ; MP4 à la durée exacte ; création complète avec modèles simulés (textes, chiffre inventé retiré et signalé, programme refusé redemandé, autocorrection, défaut d'affichage corrigé, vidéo story + paysage, scène récalcitrante arrêtée après trois approches avec montée de modèle, budget de jetons, « Corriger », retouches, scène d'avant réécrite en programme, aperçu, export, ancienne vidéo en lecture seule) |
| `npm run bench --prefix packages/motion-compiler` | banc d'essai avec les vrais modèles (coût, jetons, fiabilité, rendus) ; `npm run bench:report` |
| `npm run check:roles` (apps/api) | les échelles de modèles : barreaux autorisés, un modèle par cran, surcharges par l'environnement |
| `npm run check:request` (apps/ivision/core) | la demande suivie à la lettre : lecture, langue, storyboard tenu par le scénario, disjoncteur des médias, création de bout en bout sur le vrai script d'un utilisateur |
| `npm run check` (apps/ivision/core) | scan de site, vidéo modèle et reproduction, visuels |
| `npm run typecheck` (apps/ivision/core) | Node **et** navigateur (`motion/tsconfig.json` : kit, harnais, lecteur, exemples typés contre Motion Canvas) |

## 12. Faire évoluer le moteur

- **Une nouvelle primitive ou propriété** : le type (`dsl/types.ts`), la validation (`dsl/validate.ts`), la traduction
  (`compiler/compile.ts`), une ligne de la référence (`author/reference.ts`) et un cas dans `scripts/check.ts`. Jamais
  une scène toute faite.
- **Une nouvelle technique** : un programme d'exemple court (`author/examples.ts`, avec `tags` et `shows`), validé,
  compilé et exécuté par le contrôle du package.
- **Une montée de Motion Canvas** : changer la version exacte (`apps/api/package.json`,
  `apps/ivision/core/package.json`, `MOTION_CANVAS_VERSION` de `rendering/compiler.ts`), lancer `npm run typecheck`
  et `npm run check:motion` dans le core, et `npm run check` dans le package (le code compilé importe des noms fixes).
- **Un autre modèle à un cran** : `IDEM_LADDER_CODE_<CRAN>`, `IDEM_LADDER_DESIGN_<CRAN>` (barreau de l'échelle),
  `IDEM_ROLE_VIDEO_AUTHOR_MODEL_<CRAN>` (un rôle, un cran), `IDEM_ROLE_VIDEO_AUTHOR_MODEL` (un rôle, tous les
  crans — l'échelle ne joue plus), ou `…_ENDPOINT=selfhosted`. Modèles de la liste blanche OpenRouter.
