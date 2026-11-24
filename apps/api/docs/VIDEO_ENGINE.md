# Le moteur vidéo — HyperFrames et le catalogue

> Toute vidéo motion design d'IDEM et d'iVision est rendue par **HyperFrames** (Apache 2.0, `@hyperframes/producer`) :
> chaque scène est une page HTML Tailwind animée par GSAP, assemblée par le code. Motion Canvas (le moteur précédent,
> un programme d'animation écrit par l'IA et compilé en TSX) a été retiré le 20 novembre 2026 : HyperFrames en est
> depuis le seul et unique moteur, plus de repli, plus d'auteur de programmes.

## Le catalogue vidéo (depuis le 11 novembre 2026)

Comme les pages du moteur graphique, les scènes HTML des films sont **assemblées par le code** depuis un catalogue en
ligne : le dépôt `idem-templates`, dossier `catalog/videos/` (référence : `idem-templates/docs/VIDEOS.md`), publié sur
MinIO avec son propre manifeste signé (`videos/manifest.json`).

```
storyboard → emplacements de chaque scène (code) → SÉQUENCES posées par le code (scènes enchaînées)
  → graphe : liste courte par scène, thèmes classés, le premier retenu (code, 0 jeton — depuis le 22/11/2026)
  → DÉVELOPPEMENTS des scènes qui ont du temps libre (code)
  → assemblage par le code (`apps/ivision/core/src/video/catalog/`) : HTML + chorégraphie + traversées + transitions
  → composition HyperFrames (runtime `__ge` : découpe des textes, mise à la taille mesurée, tweens GSAP, FLIP)
```

### Depuis le 22 novembre 2026 : un film, pas des diapositives — et un seul appel

Leçons tirées de l'étude d'OpenMotion (`nexu-io/openmotion`, qui repose lui aussi sur HyperFrames) : sa qualité vient
d'un modèle de pointe qui écrit chaque film et le regarde ; ce qui se transfère à un moteur à petit modèle, ce sont ses
**règles de métier**, traduites ici en code et en contrôles.

| Levier | Où | Ce qui change |
| --- | --- | --- |
| **Séquences** | nœuds `sequence`, `catalog/compose.ts#planSequences` | 2-3 scènes enchaînées ; le média, le chiffre ou le logo **traverse la coupe** (FLIP mesuré dans la page, `runtime.ts#carryIn`) au lieu de sortir puis rentrer |
| **Développements** | nœuds `develop`, `compose.ts#autoDevelops`, `assemble.ts` | une scène qui a du temps libre ÉVOLUE (caméra sur l'image, liste qui s'accomplit, problème barré, mot souligné, chiffre qui s'impose) ; deux au plus, variés sur le film |
| **Temps mort mesuré** | `SceneQuality` (`free`, `idle`) | chaque scène dit ce qui reste sans mouvement utile après lecture ; −30 % au moins exigé par `check:video-catalog` |
| **Répétition resserrée** | runtime (`stagger` sur une courbe) | les éléments d'une liste arrivent de plus en plus vite |
| **Variété des titres** | `compose.ts#varyTitles` | jamais la même entrée de titre trois scènes de suite |
| **Son sur la perception** | `accents` des scènes, `composition.ts#plannedCues` | un léger son quand le chiffre ou le titre d'une scène énergique se pose, quand un trait se dessine |
| **Choix par le code** | `choose.ts` | plus d'appel `video.template` à la création (`VIDEO_CATALOG_CHOOSER=model` le rétablit) |
| **Un seul appel de film** | `storyboard.agent.ts` | le storyboard écrit aussi l'idée, la direction, la musique, le narrateur ; plus de prose de mise en page ni de mouvement (le code ne la lisait pas) ; `video.brief` et `video.concept` ne partent plus (`IDEM_VIDEO_AUTO_BRIEF=1`, `IDEM_VIDEO_CONCEPT=1` les rétablissent) |
| **Médias** | `assets/sourcing.ts` | un clip seulement pour un mouvement physique continu ; image → vidéo depuis l'image de référence à chaque essai ; 2 clips par film au plus (`VIDEO_GEN_MAX_CLIPS`) |
| **Vidéo modèle** | `reference/reference.analyzer.ts` | caméra mesurée par le code ; vision lue par paquets de 4 plans (12 plans : 3 appels au lieu de 12) |

Banc gratuit : `npm run bench:video` (apps/ivision/core) — jetons de l'ancien et du nouvel enchaînement (agents
simulés : 5 appels → 1 ou 2, −54 à −74 % de jetons envoyés), films figés avant / après (planches dans
`tmp/bench-video/`), caméra et vision par paquets.

### 24 novembre 2026 : le noyau mathématique (5 chantiers)

Étude d'une proposition de « moteur vidéo mathématique », croisée avec la recherche (Leake et al. 2017, EditIQ 2025,
Davis & Agrawala 2018, MVAA 2025, Cachelin 2022, Flash & Hogan 1985). Le moteur était déjà « intention par un modèle,
construction par le code » ; ce qui manquait est ajouté là où il vit, sans nouveau moteur parallèle. Aucun appel de
modèle de plus. Contrôle : `npm run check:motion-math` (apps/ivision/core, gratuit, rendu Chrome compris).

| # | Chantier | Où | Ce qui change |
| --- | --- | --- | --- |
| 1 | **Sujet hors des textes** | `catalog/framing.ts`, `runtime.ts#frameMedia`, `graph.ts#calmFit` | le point d'intérêt et la zone calme de `assets/prepare.ts` étaient calculés puis ignorés par le catalogue. La page mesure les textes posés sur l'image et place l'image (`object-position`) pour sortir le sujet de dessous, sans jamais le pousser hors de la bande des tiers (30-70 % du cadre) ni plus hors cadre qu'au centrage ; gain exigé (8 points et 40 %). Sans texte : le sujet est centré (avant : image centrée, sujet parfois hors champ). Une image portée garde son cadrage d'une scène à l'autre. Une mise en page plein cadre recule devant une image sans zone calme. `VIDEO_FRAMING=off` |
| 2 | **Chemin du film** | `catalog/film-path.ts`, `compose.ts` | les scènes sont choisies ENSEMBLE : programmation dynamique sur la chaîne (coût de scène + coût d'enchaînement : même mise en page, même gabarit, même entrée de titre, deux textes seuls ou deux pleins cadres de suite + usure dans le film), chemin TIRÉ (filtrage avant, échantillonnage arrière, graine du film) pour garder la variété. Avant : scène par scène, seule la précédente comptait. `VIDEO_FILM_PATH=greedy` rétablit l'ancien choix |
| 3 | **Calage musical hiérarchique** | `catalog/rhythm.ts`, `assemble.ts`, `motionVideo.service.ts#catalogInput` | c'est la POSE du rôle principal (l'instant où son mouvement s'arrête) qui tombe sur la musique, plus le départ de son tween ; début de phrase pour une révélation, temps fort de mesure pour un titre, simple temps seulement pour une scène vive ; un trait (soulignement, rature) part sur un temps fort proche. La voix passe avant : une scène dite reste calée sur ses mots |
| 4 | **Courbes cinématiques** | `catalog/kinematics.ts` (même code dans la page) | `geJerk` (jerk minimal) pour la caméra et les traversées ; `geSettle` / `geKin` (dépassement ≤ 4,5 %, anticipation ≤ 3 %) pour le rôle principal des seules DA joueuses (memphis, pop-art, clay…), l'opacité séparée du mouvement. Le catalogue n'accepte que `geJerk` en plus. `VIDEO_KINEMATIC=off` |
| 5 | **Mesures** | `catalog/metrics.ts` | `beatAlign` (alignement des temps forts visuels sur la musique, σ = 80 ms), `repeats` (enchaînements qui répètent), `kinematic` ; journal `video.catalog_film`. Mesurées, pas encore des seuils : à étalonner sur de vrais films |

Écarté de la proposition : un optimiseur de positions (les mises en page sont fixes et mesurées), le paramétrage par
longueur d'arc (aucune trajectoire courbe au catalogue), CMA-ES / NSGA-II (la programmation dynamique est exacte ici).

### 22-23 novembre 2026 : ce que les alternatives open source apportent (12 chantiers)

Revue des moteurs vidéo ouverts (HyperFrames, explainroo, Earshot, motlab, OpenMontage, Kinetograph, text-to-lottie…) :
seul le code sous Apache-2.0 ou MIT est repris ; d'OpenMontage (AGPL), Hypit (usage multi-clients interdit) et onetake
(non commercial), seules les idées.

| # | Chantier | Où | Ce qui change |
| --- | --- | --- | --- |
| 1 | HyperFrames 0.9.70 | `@hyperframes/*`, `render.ts#ensureBrowserPath` | la 0.9.70 n'accepte qu'un navigateur « vérifié » : la production pose `PUPPETEER_EXECUTABLE_PATH` (Chromium de l'image), le poste de développement retombe sur le Chrome de Puppeteer |
| 2 | Entrées calées sur la voix | `assemble.ts` (`cueOf`, `wordKey`), `runtime.ts#steps` | chaque texte (titre, chiffre, libellé, élément de liste) entre au mot où la voix le prononce (horodatage Whisper/Kokoro), 0,12 s avant, borné par la lecture |
| 3 | Écrit ≠ dit | `audio/spoken.ts`, `storyboard.agent.ts` | `{kora.sn|kora point S N}` : l'écran montre l'écrit, la voix dit le parlé ; nombres, prix en F CFA, %, heures, téléphones, adresses écrits en toutes lettres par le code (fr/en) — `check:spoken` |
| 4 | Mesures du film | `catalog/metrics.ts`, `runtime.ts#guardContrast` | continuité, cadence (coefficient de variation), part du sujet, entrées simultanées, temps mort ; une cadence trop régulière est remodelée par rôle (`shapeCadence`) ; contraste ≥ 3:1 des textes sur fond uni garanti dans la page (texte assombri ou éclairci) ; tailles < 9 px refusées |
| 5 | Caméra | `runtime.ts#camera` (idée d'explainroo, MIT) | le cadre s'ouvre serré sur le premier groupe et s'élargit à mesure que les éléments arrivent (mesure des glyphes, 0,7 s, power2.inOut), finit large ; jamais sur un média plein cadre (`VIDEO_CAMERA=off` la coupe) |
| 6 | Primitives HyperFrames | nœuds `primitive`, `runtime.ts#mountPrimitive` | 7 composants du registre HeyGen (Apache-2.0) : JavaScript ACCEPTÉ du seul dépôt `heygen-com/hyperframes`, au commit figé, empreinte SHA-256 vérifiée au chargement, relu dans l'interface de revue, exécuté dans la page déjà sans réseau |
| 7 | Signature dessinée | `rendering/logo-svg.ts`, `runtime.ts#drawLogo` | un logo SVG (assaini : ni script, ni gestionnaire, ni référence externe) est posé dans la page de fin et se trace trait par trait, puis se remplit (`VIDEO_LOGO_DRAW=off`) |
| 8 | Banque de sons Earshot | `audio/sfx.ts#bankSounds`, `scripts/build-sfx-bank.sh` | sons rendus par le code (MIT), servis avant la synthèse ; à défaut, trois prises de synthèse par son (hauteurs ×1 / ×0,89 / ×1,12) — `check:sfx-bank` |
| 9 | Règles par DA | `motionVideo.service.ts` (ancre), `compose.ts` (énergie) | toutes les images d'un film partagent lumière, optique et ambiance de la DA (assainies : jamais de filtre de couleur) et la même personne ; l'énergie de la DA tire le choix du thème, une DA posée (≤ 2) n'a qu'un développement par scène |
| 10 | Retouche pointée | `shared-video-editor` (bouton cible), `composition.ts#pick`, `choose.ts#pointLine` | l'utilisateur trace une zone sur l'aperçu : l'aperçu relève la scène, l'instant et les éléments dessous ; la consigne part avec `points` et le modèle sait sur quoi elle porte (idée de motlab, MIT) |
| 11 | Banc des moteurs de rendu | `npm run bench:renderers` | le même film rendu par HyperFrames et, s'il est installé, Kinetograph (Apache-2.0, GPU sans navigateur) : temps, images, SSIM, planche ; aucun téléchargement, aucune bascule automatique |
| 12 | Sons générés (facultatif) | `audio/generated.ts` | musique ACE-Step (`VIDEO_MUSIC_GEN_URL`) et bruitage MMAudio des clips muets (`VIDEO_FOLEY_GEN_URL`) sur un serveur GPU d'IDEM ; ÉTEINTS sans adresse ; un échec rend la main aux banques — `check:generated-audio` |

Les primitives : `idem-templates/scripts/hf-allowlist.json` (dépôt, commit, composants, mise en page IDEM, liaison des
variables) → `node scripts/import-hyperframes.mjs <clone du dépôt>` écrit `catalog/videos/shared/primitives/hf.*` ;
`types.ts#primitiveErrors` refuse au chargement un composant dont l'empreinte a changé, venu d'un autre dépôt, ou qui
appelle le réseau, `eval`, le stockage, `postMessage`, la navigation… Le compteur ne pose `count-up` que pour un entier
< 1 000 et l'anneau que pour un pourcentage (`graph.ts#primitiveFits`).

- **Bibliothèque** : mises en page de scène, thèmes, animations (dont les fonds animés, rôle `bg`), transitions,
  gabarits ; animations et transitions DÉCLARATIVES (tweens JSON sur liste blanche, aucun JavaScript publié ; ni
  rebond ni élastique).
- **Ce que le code garantit** : aucun texte perdu ni réécrit, chaque texte tient dans la zone sûre de son format
  (story, portrait, carré, paysage), temps de lecture (≈ 15 signes/s), titre calé sur le temps fort, mouvement continu,
  jamais deux fois la même mise en page de suite, au plus deux transitions par film, fond sombre sur demande seulement.
- **Correction sans modèle** : une scène qui plante ou dont un texte ne tient pas prend le candidat suivant de sa liste.
  **Retouche écrite** : un petit appel repart de la configuration actuelle de la scène (`CURRENT CONFIG`). **Nouvelle
  version** : le candidat suivant, ou une autre animation du rôle principal.
- **Gardé** : `FilmScene.catalog` (la configuration), `VideoFilm.catalog` (version, thème) — le film se réassemble sans
  modèle (`reassembleFilm`). Les textes restent des clés (`{{text.<clé>}}`) : une retouche de mot ne réassemble rien.
- **Registre** (`catalog/registry.ts`) : `IDEM_TEMPLATES_DIR` › `IDEM_TEMPLATES_URL` (+ `/videos/manifest.json`, ETag) ›
  cache disque › instantané `apps/ivision/core/catalog/video-snapshot.json` (`npm run catalog:video-snapshot`) › minimum
  intégré. `POST /catalog/refresh` relit les deux catalogues, sur l'API IDEM ET sur l'API iVision (même jeton).
- **Clips sans durée** : un WebM écrit vers un tube (anciens clips Lottie) est remis en conteneur au rendu
  (`seekableClip`, sans réencodage) — HyperFrames refusait ces clips (« invalid_media »).
- **Contrôles** : `npm run check:video-catalog` (cœur iVision : gabarits × thèmes × formats rendus et mesurés dans
  Chrome, planches dans `tmp/check-video-catalog/`) ; `npm run check:hyperframes` (le service de bout en bout,
  exploration à l'Ultra, correction sans modèle, passage d'un ancien film au catalogue, export MP4).

## Le pipeline, en amont du catalogue

| Étape | Fichier | Rôle de modèle | Ce qu'elle produit |
| --- | --- | --- | --- |
| Directeur de création | `request/enhance.ts` | étage « rédaction » (`video.brief`) | **seulement** sur « Améliorer ma demande » ou `IDEM_VIDEO_AUTO_BRIEF=1` (22/11/2026) : la demande devient un **brief de production** ; à la création, le storyboard en tient lieu |
| Compréhension | `request/request.ts`, `request/intent.ts` | `video.reader`, `video.intent-classifier` | `RequestSpec` : langue, scénario **mot pour mot**, voix écrite, durée, format, interdits |
| Direction | `director/concept.agent.ts` | `video.concept` | **seulement** avec `IDEM_VIDEO_CONCEPT=1` (22/11/2026) ; sinon le storyboard l'écrit |
| Storyboard (appel unique) | `director/storyboard.agent.ts` | `video.planner` | titre, concept, **direction nommée** (jamais celle de la vidéo précédente), musique, narrateur ; par scène : durée, **rôle**, **énergie 1–5**, sujet montré, textes exacts, médias, voix |
| Plan du film | `composition.ts#planFilm`, `motion-compiler/src/design/` | — | système de design du film (direction, couleur, typographie, énergie), coutures entre scènes, sons de transition planifiés, coupes calées sur la musique |
| Médias | `assets/sourcing.ts`, `assets/prepare.ts`, `assets/lottie.ts`, `assets/demo.ts` | (FLUX.2 → Veo 3.1, puis banques libres ; `video.planner` pour une démo) | imports, captures de la marque, animations, écrans de démo ; puis **préparation** |
| Musique, sons | `audio/music.ts`, `audio/beats.ts`, `audio/sfx.ts` | — | piste libre, **grille des temps** (BeatRoot), extrait calé sur les phrases ; prises d'effets variées |
| Voix | `audio/voice.ts`, `audio/align.ts` | — (voix de l'hôte) | narration traitée (compresseur, de-esser), **mots datés** pour les sous-titres |
| Catalogue | `catalog/compose.ts`, `catalog/assemble.ts` | — (`video.template` seulement pour une retouche écrite) | séquences, choix, développements, scènes HTML + chorégraphie assemblées par le code (voir plus haut) |
| Autocorrection | `motionVideo.service.ts#repairHtmlScenes` | — | une scène qui plante prend le candidat suivant (sans modèle), pour tout le film |
| Finition | `rendering/hyperframes/render.ts`, `rendering/ffmpeg.ts` | — | flou de mouvement, mixage à deux passes |

L'orchestrateur est `motionVideo.service.ts` ; les appels passent tous par `agents.ts#callFilmModel` (rôle logique +
cran → modèle sur l'**échelle** du rôle, `apps/api/api/config/ai-models.config.ts`).

### Ce que le code garantit sans toucher à la création

- les durées font la durée achetée ; un **scénario écrit par l'utilisateur** garde ses scènes, ses textes et sa voix
  mot pour mot ; un nombre, une date ou une adresse absents de la demande ne s'affichent pas (`request/facts.ts`) ;
- les médias cités existent, les médias à produire tiennent dans les plafonds ;
- chaque écart est **dit** (`film.fidelity.notes`, dans la langue de la vidéo).

## Le système de design du film (`packages/motion-compiler/src/design/`)

Calculé une fois par film (`buildFilmDesign`), résolu par scène et par format (`resolveSceneDesign`) ; c'est tout ce
qui reste de l'ancien `@idem/motion-compiler` après le retrait de Motion Canvas (le langage de mouvement et son
compilateur) :

| Couche | Fichier | Contenu |
| --- | --- | --- |
| Directions | `directions.ts` | 6 directions nommées (`editorial`, `tech`, `minimal`, `organic`, `playful`, `bold`), toutes sur **surface claire** |
| Couleurs | `color.ts` | rôles dérivés de la marque par **Material Color Utilities** (HCT) et **Leonardo** (contraste visé) |
| Typographie | `typography.ts` | échelle modulaire par format, métriques **Capsize**, coupure des lignes **Knuth-Plass** |
| Mouvement | `motion.ts` | jetons de durée et de courbe, décalages, vitesse par énergie, **temps de lecture** |
| Film | `film.ts` | squelette produit en 8 temps, arc d'énergie à un seul pic, coutures, sons de transition planifiés |
| Zones sûres | `safezones.ts` | marges des plateformes (interface d'Instagram, TikTok…) par format |
| Étalonnage | `grade.ts` | LUT commune du film par direction (portée de HyperFrames `cube-build.mjs`, Apache-2.0), grain, vignette |

## Les médias préparés (`assets/prepare.ts`, `assets/lottie.ts`, `assets/demo.ts`)

Avant l'assemblage des scènes, chaque image ou clip est préparé par le code :

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
**point** de l'action, puis l'écran d'arrivée. Garde réseau des rendus (aucune adresse privée).

## Le rendu (`rendering/`)

| Fichier | Rôle |
| --- | --- |
| `rendering/hyperframes/composition.ts` | une page HTML pour le film entier (toutes les scènes, timeline GSAP maîtresse) |
| `rendering/hyperframes/render.ts` | `@hyperframes/producer` (Chrome sans interface + FFmpeg) → MP4 muet + affiche |
| `rendering/hyperframes/probe.ts` | contrôle réel (chaque scène exécutée, défauts d'affichage, vignettes) |
| `rendering/runner.ts` | Chromium partagé (`filmBrowser`, aussi prêté au rendu Lottie et aux démos) ; médias distants téléchargés une fois, mis en cache |
| `rendering/ffmpeg.ts` | mixage audio (musique, voix, effets), affiche, `probe` |
| `rendering/formats.ts` | composition fixe : story 1080×1920, carré 1080×1080, portrait 1080×1350, paysage 1920×1080 |

## La finition à l'export

| Étape | Réglage |
| --- | --- |
| **Coupes sur la musique** | les coupes sont rapprochées du temps le plus proche (`VIDEO_SNAP_CUTS=off`), l'extrait de musique finit sur une fin de phrase musicale (fondu court) |
| **Voix** | compresseur et de-esser ; la musique s'efface sous la voix (`sidechaincompress` 8:1), les effets un peu (2,5:1) |
| **Effets** | moins nombreux, sur les temps ; plusieurs **prises** par sorte, tournées pour ne jamais répéter le même son |
| **Volume** | `loudnorm` en **deux passes** (mesure puis application linéaire, sans pompage) : −14 LUFS, crête −1,5 dBTP |

## Retouches et export

`MotionVideoService.updateVideo(patch)` (`sanitizeVideoPatch` valide le corps HTTP, IDEM et iVision) — tout passe par
le catalogue :

| Champ | Effet |
| --- | --- |
| `texts`, `images` | données des scènes (clés), jamais besoin de réassembler |
| `visual` | `{ s2: "plus lent" }` ou `{ all: … }` : un petit appel modifie la configuration de la scène dans le catalogue |
| `fix` | correction volontaire d'une scène en erreur (candidat suivant, sans modèle) |
| `regenerate` | nouvelle version d'une scène : le candidat suivant de sa liste, ou une autre animation |
| `voice`, `voiceLines`, `captions` | voix off, lignes, sous-titres |
| `musicMood`, `musicTrackId`, `sfx`, `scope` | musique, effets, périmètre |

`reviseFromText` lit une retouche écrite. L'export est refusé tant qu'une scène est en erreur (`scene_errors`).

## Contrôles (gratuits sauf mention)

| Commande | Ce qu'elle prouve |
| --- | --- |
| `npm run check:hyperframes` (apps/ivision/core) | création complète par le catalogue, modèles simulés : plan du film, médias préparés, grille musicale, assemblage, correction sans modèle, export MP4 |
| `npm run check:video-catalog` (apps/ivision/core) | gabarits × thèmes × formats rendus et mesurés dans Chrome (contraste, tailles) ; séquences sur 4 formats (traversée à 3 % près) ; listes resserrées ; temps mort −30 % ; entrées calées sur la voix ; caméra ; 7 primitives × formats ; signature dessinée ; retouche pointée ; aucun appel par défaut |
| `npm run bench:video` (apps/ivision/core) | jetons avant / après (agents simulés), films figés avant / après (planches), caméra mesurée, vision par paquets |
| `npm run check:request` (apps/ivision/core) | la demande lue en entier, la langue de la demande, le storyboard tenu au scénario, les médias, une vidéo créée de bout en bout |
| `npm run check:lottie` (apps/ivision/core) | Lottie → WebM transparent, recoloration, import refusé si ce n'est pas une animation |
| `npm run check:demo` (apps/ivision/core) | carte de page, agent simulé, parcours réel |
| `npm run check:brief` (apps/ivision/core) | directeur de création (agent simulé) : brief lu comme un brief, faits gardés, voix de l'utilisateur ; narration à ton constant |
| `npm run check:comm` (apps/api) | périodes du calendrier, et le plan des vidéos : nettoyage, mise en forme de la demande |
| `npm run check:roles` (apps/api) | les échelles de modèles et les nouveaux rôles |
| `npm run check:spoken` (apps/ivision/core) | l'écrit et le dit : nombres, prix, %, heures, téléphones, adresses en toutes lettres (fr/en), `{écrit|dit}` |
| `npm run check:sfx-bank` (apps/ivision/core) | la banque Earshot lue si elle existe, trois prises de synthèse sinon |
| `npm run check:generated-audio` (apps/ivision/core) | adaptateurs ACE-Step / MMAudio contre un faux serveur local : éteints par défaut, cache, refus d'une réponse qui n'est pas un son, bruitage mixé à son instant |
| `npm run bench:renderers` (apps/ivision/core) | HyperFrames contre Kinetograph (si installé) sur le même film : temps, SSIM, planche dans `tmp/bench-renderers/` |
| `npm run typecheck` (apps/ivision/core) | Node et navigateur |

## Catalogue détaillé

### Animations (30 nœuds)

Les animations sont **déclaratives** (tweens JSON sur liste blanche GSAP, aucun JavaScript publié par le catalogue).
Les effets spéciaux (`fx`) passent par le plugin `geFx` du runtime : `sweep`, `glitch`, `scramble`, `extrude`.
Chaque nœud déclare ses `targets` (`text`, `block`, `media`, `logo`, `figure`, `cta`, `items`), un intervalle `energy`
[min, max], un `tier` (gamme), et des `steps.in` / `steps.out` en variables (`$dIn`, `$easeOut`, `$dist`, `$stagger`).

| ID | Titre | Gamme | Cible principale |
| --- | --- | --- | --- |
| `anim.blur-in` | Mise au point | low | text |
| `anim.count-up` | Compteur | low | figure |
| `anim.focus-pull` | Mise au point (caméra) | low | media |
| `anim.ken-burns` | Zoom lent | low | media |
| `anim.mask-rise` | Lignes qui montent du masque | low | text |
| `anim.pop-settle` | Pose nette | low | block, cta |
| `anim.scale-in` | Agrandissement net | low | block, media, logo, figure |
| `anim.typewriter` | Machine à écrire | low | text |
| `anim.word-stagger` | Mots en cascade | low | text |
| `anim.letter-flip` | Lettres qui basculent | medium | text |
| `anim.letter-settle` | Lettres qui se posent | medium | text |
| `anim.line-draw` | Filet qui se trace | medium | text |
| `anim.marker` | Surligneur | medium | text |
| `anim.outline-fill` | Contour qui se remplit | medium | text |
| `anim.tracking-expand` | Approche qui s'ouvre | medium | text |
| `anim.clip-wipe` | Balayage | high | text, block |
| `anim.rise-fade` | Monter et apparaître | high | block, items, figure |
| `anim.rotate-word` | Mot-clé qui bascule | high | text |
| `anim.squiggle-underline` | Soulignement à la main | high | text |
| `anim.strike` | Rature | high | text |
| `anim.wave` | Vague | high | text |
| `anim.zoom-punch` | Impact | high | block, media |
| `anim.bg-aurora-drift` | Aurore en dérive (fond) | high | bg |
| `anim.drift-scale` | Dérive lente | ultra | media |
| `anim.extrude` | Relief | ultra | text |
| `anim.glitch` | Glitch | ultra | text, media |
| `anim.light-sweep` | Balayage de lumière | ultra | text |
| `anim.rows-cascade` | Rangées en cascade | ultra | items |
| `anim.scramble` | Décodage | ultra | text |
| `anim.split-halves` | Deux moitiés qui se rejoignent | ultra | block |

### Gabarits de scène (20 nœuds ; 4 propres à des familles de DA depuis le 22/11/2026 : `vg.editorial-split`, `vg.poster-word`, `vg.media-band`, `vg.media-round`)

Un gabarit (`kind: "gabarit"`) pré-relie un layout, des animations nommées par slot et une transition. Le code
l'utilise comme configuration par défaut pour un rôle donné, sans demander au modèle de choisir chaque nœud.

| ID | Titre | Gamme | Rôles |
| --- | --- | --- | --- |
| `vg.cta-side` | Action de côté | low | cta |
| `vg.data-rows` | Données en rangées | low | data |
| `vg.hook-kinetic` | Accroche cinétique | low | hook |
| `vg.problem-points` | Points du problème | low | problem |
| `vg.signature-mark` | Signature posée | medium | signature |
| `vg.signature-sting` | Signature (sting) | medium | signature |
| `vg.stat-close` | Chiffre qui clôt | medium | data, cta |
| `vg.stat-on-photo` | Chiffre sur photo | medium | data, proof |
| `vg.feature-split` | Fonctionnalité en deux parts | high | feature |
| `vg.photo-story` | Photo racontée | high | benefits, proof |
| `vg.product-frame` | Produit encadré | high | reveal, feature |
| `vg.steps-cascade` | Étapes en cascade | high | feature, benefits |
| `vg.cta-close` | Appel final | ultra | cta |
| `vg.stat-reveal` | Chiffre révélé | ultra | data |
| `vg.statement-editorial` | Affirmation éditoriale | ultra | statement |
| `vg.testimonial` | Témoignage | ultra | proof, statement |

### Transitions (12 nœuds)

| ID | Titre | Usage recommandé |
| --- | --- | --- |
| `trans.cut` | Coupe franche | Moment fort, rythme rapide |
| `trans.soft-dissolve` | Fondu doux | Transitions douces, chute d'énergie |
| `trans.dip-ground` | Fondu par le fond | Rôles `proof`, `statement` |
| `trans.push` | Poussée latérale | Enchaînements directionnels |
| `trans.whip` | Fouetté | Énergie haute, `feature`, `cta` |
| `trans.zoom-through` | Traversée | Moment fort, pic d'énergie |
| `trans.brand-wipe` | Volet de marque | Transition de marque |
| `trans.wipe-up-band` | Bande qui monte | CTA, conclusion |
| `trans.diagonal-band` | Bande diagonale | Style éditorial |
| `trans.rise-stack` | Carte qui monte | Listes, étapes |
| `trans.split-doors` | Portes | Révélation, `reveal` |
| `trans.iris` | Iris | Intro, signature |

### Thèmes (10 nœuds)

| ID | Titre | Gamme | Directions compatibles (extrait) |
| --- | --- | --- | --- |
| `theme.bold-kinetic` | Cinétique audacieux | low | neo-brutalism, wax-print, maximalism |
| `theme.cinema-deep` | Cinéma profond | low | art-deco, editorial, quiet-luxury |
| `theme.color-field` | Champ de couleur | medium | minimalism, bauhaus, swiss |
| `theme.documentary` | Documentaire | medium | editorial, afro-modernism, bohemian |
| `theme.editorial-calm` | Éditorial calme | medium | editorial, minimalism, swiss |
| `theme.minimal-type` | Type minimaliste | low | minimalism, swiss, bauhaus |
| `theme.retail-promo` | Promo retail | medium | pop-art, memphis, y2k |
| `theme.soft-rounded` | Douceur arrondie | high | clay, bohemian, aurora |
| `theme.swiss-precise` | Précision suisse | high | swiss, bauhaus, tech |
| `theme.tech-grid` | Grille tech | ultra | cyberpunk, futuristic, glassmorphism |

### Séquences (7 nœuds) et développements (7 nœuds) — 22/11/2026

Séquences : `vseq.photo-to-split`, `vseq.frame-to-full`, `vseq.split-to-framed`, `vseq.photo-then-figure`,
`vseq.figure-on-photo`, `vseq.action-to-sting`, `vseq.statement-to-sting`. Développements : `dev.media-push`,
`dev.media-pan`, `dev.items-walk`, `dev.title-underline`, `dev.title-strike`, `dev.figure-settle`, `dev.logo-approach`.
Référence : `idem-templates/docs/VIDEOS.md`.

### Mises en page de scène (layouts, 20 nœuds)

Les layouts sont répartis en quatre familles :

| Famille | Exemples | Rôles couverts |
| --- | --- | --- |
| `type` | Titre centré, titre gauche, liste, citation | hook, statement, feature |
| `media` | Photo pleine, split, photo racontée | reveal, feature, proof |
| `data` | Chiffre, rangées de données, comparaison | data, benefits |
| `close` | CTA, CTA split, signature | cta, signature |

## La voix off

| Composant | Choix | Détail |
| --- | --- | --- |
| Moteur TTS | **Kokoro** (défaut) ou **serveur Qwen3-TTS** | sélectionné dans les réglages ou par `input.voice` |
| Traitement | Compresseur + de-esser | Dynamics appliqués côté `audio/voice.ts` |
| Calage | `audio/align.ts` → mots datés | timestamps exacts des mots pour les sous-titres et le snapping des coupes |
| Mixage | Sidechain 8:1 sous la voix, 2.5:1 sous les effets | la musique s'efface, les effets reculent |
| Sous-titres | `captions` : calés sur les timestamps des mots | activés à l'export, style personnalisable |

La piste de voix traite la narration telle qu'elle a été écrite dans le storyboard ; le ton est **unique dans toute la
vidéo** (un seul timbre, pas de changement de voix par scène).

## Les médias générés

| Support | Modèle primaire | Repli 1 | Repli 2 |
| --- | --- | --- | --- |
| Image fixe | FLUX.2 | — | Pexels (libre) après 3 essais échoués |
| Clip vidéo | Seedance | — | Pexels clip libre après 3 essais |
| Animation Lottie | Bibliothèque interne recolorée | — | — |

Le code tente **3 fois** la génération avant de basculer sur Pexels ; les médias Pexels sont automatiquement filtrés
(licence, pertinence, résolution). Un storyboard initialement vide reçoit des images par défaut issues de Pexels si
aucune génération n'aboutit.

## Les directions artistiques (30 dans idem-templates)

Chaque nœud du catalogue vidéo déclare la liste des directions avec lesquelles il est compatible. L'agent choisit
**une direction dans le catalogue** parmi celles de la gamme ; il n'invente aucune direction.

Les 30 directions disponibles (dossier `idem-templates/catalog/videos/shared/`) couvrent :

> african-geometry · afro-modernism · art-deco · aurora · bauhaus · bohemian · clay · collage-art · cyberpunk ·
> editorial · futuristic · glassmorphism · graffiti · handwritten · maximalism · memphis · minimalism · neo-brutalism ·
> pixel-art · pop-art · quiet-luxury · retro · risograph · sign-painting · surreal · swiss · vector-art · victorian ·
> wax-print · y2k

La direction du film est choisie par l'agent `video.concept`, qui interdit la direction de la vidéo précédente pour
forcer la variété.

## Les vidéos de l'ancien moteur

Une vidéo sans `film` (créée avant le 14 octobre 2026) est marquée `legacy` : ses MP4 se téléchargent, elle ne se
prévisualise ni ne se retouche plus (`legacy_video`).
