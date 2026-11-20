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
storyboard → emplacements de chaque scène (code) → graphe : liste courte par scène, thèmes classés (code, 0 jeton)
  → UN appel `video.template` pour tout le film (Medium et au-delà ; Low : le code seul)
  → assemblage par le code (`apps/ivision/core/src/video/catalog/`) : HTML + chorégraphie + transitions
  → composition HyperFrames (runtime `__ge` : découpe des textes, mise à la taille mesurée, tweens GSAP)
```

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
| Directeur de création | `request/enhance.ts` | étage « rédaction » (`video.brief`) | la demande devient un **brief de production** : déroulé, ce qu'on montre, un ton de narration, rythme d'un film, musique ; gardé dans `brief.creative` |
| Compréhension | `request/request.ts`, `request/intent.ts` | `video.reader`, `video.intent-classifier` | `RequestSpec` : langue, scénario **mot pour mot**, voix écrite, durée, format, interdits |
| Direction | `director/concept.agent.ts` | `video.concept` | titre, concept, bible visuelle, une idée par scène, **une direction nommée** (jamais celle de la vidéo précédente) et la **courbe d'énergie** |
| Storyboard | `director/storyboard.agent.ts` | `video.planner` | par scène : durée, **rôle** (squelette en 8 temps : accroche → signature), **énergie 1–5**, textes exacts, médias, voix |
| Plan du film | `composition.ts#planFilm`, `motion-compiler/src/design/` | — | système de design du film (direction, couleur, typographie, énergie), coutures entre scènes, sons de transition planifiés, coupes calées sur la musique |
| Médias | `assets/sourcing.ts`, `assets/prepare.ts`, `assets/lottie.ts`, `assets/demo.ts` | (FLUX.2 → Veo 3.1, puis banques libres ; `video.planner` pour une démo) | imports, captures de la marque, animations, écrans de démo ; puis **préparation** |
| Musique, sons | `audio/music.ts`, `audio/beats.ts`, `audio/sfx.ts` | — | piste libre, **grille des temps** (BeatRoot), extrait calé sur les phrases ; prises d'effets variées |
| Voix | `audio/voice.ts`, `audio/align.ts` | — (voix de l'hôte) | narration traitée (compresseur, de-esser), **mots datés** pour les sous-titres |
| Catalogue | `catalog/compose.ts`, `catalog/assemble.ts` | `video.template` | les scènes HTML + chorégraphie assemblées par le code (voir plus haut) |
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
| `npm run check:video-catalog` (apps/ivision/core) | gabarits × thèmes × formats rendus et mesurés dans Chrome |
| `npm run check:request` (apps/ivision/core) | la demande lue en entier, la langue de la demande, le storyboard tenu au scénario, les médias, une vidéo créée de bout en bout |
| `npm run check:lottie` (apps/ivision/core) | Lottie → WebM transparent, recoloration, import refusé si ce n'est pas une animation |
| `npm run check:demo` (apps/ivision/core) | carte de page, agent simulé, parcours réel |
| `npm run check:brief` (apps/ivision/core) | directeur de création (agent simulé) : brief lu comme un brief, faits gardés, voix de l'utilisateur ; narration à ton constant |
| `npm run check:comm` (apps/api) | périodes du calendrier, et le plan des vidéos : nettoyage, mise en forme de la demande |
| `npm run check:roles` (apps/api) | les échelles de modèles et les nouveaux rôles |
| `npm run typecheck` (apps/ivision/core) | Node et navigateur |

## Les vidéos de l'ancien moteur

Une vidéo sans `film` (créée avant le 14 octobre 2026) est marquée `legacy` : ses MP4 se téléchargent, elle ne se
prévisualise ni ne se retouche plus (`legacy_video`).
