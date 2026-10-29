# Vidéos de promotion en motion design

Module Communication (écran « Mes vidéos ») et iVision (atelier Vidéo). Code : moteur partagé
`apps/ivision/core/src/video/` (navigateur : `apps/ivision/core/motion/`) ; IDEM le branche par
`api/services/ivision/host.ts` et `Communication/video/idemVideoStore.ts`.

Chaque vidéo est **conçue par l'IA et animée par Motion Canvas**, scène par scène, sans mise en page imposée.
Depuis le 29 octobre 2026 (compilateur 0.3), l'IA écrit pour chaque scène une **intention** (rôle, énergie, type de
composition, hiérarchie, verbes de mouvement) ; le code calcule la géométrie et le temps de chaque format, écrit
plusieurs variantes, les **mesure** et garde la meilleure. Un texte n'est jamais coupé, reste le temps d'être lu, et la
même vidéo s'affiche bien dans chaque format, zones d'interface des plateformes comprises. Le fonctionnement du
moteur : [VIDEO_ENGINE.md](VIDEO_ENGINE.md).

## Ce que voit l'utilisateur

1. **Décrire** : il écrit ce qu'il veut (un message ou un scénario complet), joint ses photos et ses
   clips, peut « Améliorer ma demande ».
2. **Configurer** : formats, durée, qualité, musique, voix off, effets sonores, jauge de créativité.
   L'interprétation de la demande (objectif, matière, mouvement) est montrée et corrigeable ; une
   question est posée seulement si une décision qui change la vidéo manque.
3. **Suivre la fabrication**, en direct : la demande comprise, le concept, le storyboard, les médias,
   la musique, la voix, puis **chaque scène écrite** (la frise s'allume scène par scène), puis le
   contrôle.
4. **Retoucher** (gratuit) : les textes de chaque scène (vus pendant la frappe), une photo, la musique,
   les effets, la voix et ses sous-titres ; **« Changer cette scène »** (une consigne en clair : l'IA
   réécrit seulement cette scène), **« Nouvelle version »**, et **« Retoucher en écrivant »** pour tout
   le film (« la scène 2 plus lente », « sans musique »).
5. **Exporter** le MP4 (le premier export est inclus).

Chaque format choisi (story, carré, portrait, paysage) est vérifié : un texte coupé par le cadre, recouvert par un autre texte,
caché par une forme ou une image, trop peu contrasté avec son fond, ou dont les lettres se superposent est corrigé automatiquement avant que la vidéo soit montrée. Une scène dont le code ne s'exécute pas est
**signalée** (message de l'erreur, sur la scène et dans la
frise) et **Corriger** la fait réécrire par l'IA ; l'export attend qu'elle s'exécute. Rien n'est
remplacé en silence par une composition toute faite.

## La demande suivie à la lettre

La demande est lue **en entier** (`request/request.ts`, 20 000 signes) et gardée avec la vidéo
(`brief.request`, `brief.spec`) :

| Ce qui est lu | Effet |
| --- | --- |
| **Langue** (consigne explicite › langue du texte › interface › marque) | textes, titre, voix et retouches dans la langue de la DEMANDE |
| **Scénario** (titres de scène, lignes minutées) | le film garde ces scènes, cet ordre et ce minutage (ramené à la durée achetée) |
| **Textes à l'écran** | repris **mot pour mot** dans les textes des scènes (le planificateur ne les écrit pas) |
| **Textes dans l'image** (dossier, saisie…) | gardés comme textes d'interface de la scène (`prop1`…) |
| **Voix écrite** | dite telle quelle |
| **Périmètre** (durée, format, 4K, i/s) | ce qui ne peut être tenu est **dit** dans la vidéo |
| **Consignes** (interdits, couleurs, musique, personnage, lumière) | données au directeur et au planificateur ; interdits traduits pour les générateurs d'images |

Garde-fou de fond : un prix, une date, un numéro ou une adresse **absents de la demande** ne
s'affichent pas — et la vidéo le dit (`film.fidelity.notes`).

## Le directeur de création : une demande courte devient un brief de production

Depuis le 29 octobre 2026, chaque création (IDEM et iVision) et le bouton « Améliorer ma demande » passent par un agent
**directeur de création** (`request/enhance.ts`, étage « rédaction ») : à partir de la demande, de la marque (activité,
promesse, ton, direction artistique), de ce que montrent les médias disponibles, de la durée et du choix de voix off,
il écrit un brief complet — objectif, public, message clé, l'histoire, **un seul ton de narration**, le rythme et la
continuité (« un film, pas une suite de diapositives »), **ce qu'on montre** concrètement, le **déroulé** temps par temps
(ce qu'on voit, ce que dit le texte à l'écran, ce que dit la voix, le lien avec la suite), la fin et la musique.

Le modèle répond en JSON, le **code** met le brief en forme : jamais de « Scène 1 », de minutage ni de guillemets
inventés, donc jamais lu comme un scénario à suivre mot pour mot ; un chiffre absent de la demande et de la marque est
retiré avec sa phrase ; un texte que le client a mis entre guillemets reste en tête, intact. Le choix de voix off de
l'utilisateur fait autorité. Le brief structuré est gardé avec la vidéo (`brief.creative`) : sa musique sert quand
l'utilisateur a laissé « auto », son personnage de voix sert à la narration. Contrôle : `npm run check:brief`
(apps/ivision/core).

Le storyboard suit ce brief : au moins deux scènes sur trois montrent un sujet concret (média disponible, ou nouvelle
image ou nouveau clip), chaque scène prolonge la précédente, et les textes à l'écran disent quelque chose (un titre
jusqu'à 8 mots, une ligne d'appui jusqu'à 14 mots). Le plafond d'images nouvelles suit la durée : une pour ~8 s, 6 au
moins, 14 au plus (`VIDEO_GEN_MAX_IMAGES` l'impose) ; les clips gardent leur plafond de 4.

## Les vidéos du calendrier éditorial

Chaque vidéo proposée par le calendrier (module Communication) porte son **plan** (`ContentIdea.videoPlan`) : voix off
oui ou non, le ton unique et le personnage de la voix, la musique, le rythme, ce qu'on montre et le déroulé en 4 à 7
temps. Le détail d'une publication l'affiche (et la voix off se change d'un geste) ; la carte du calendrier montre la
durée et la voix off. À la génération, le plan devient la demande entière (`video.calendar.ts#videoRequestOf`), que le
directeur de création complète ; durée, voix, personnage et musique du plan sont repris sauf choix contraire de
l'utilisateur.

## Les médias

1. **Les imports de l'utilisateur** : photos, clips, et **animations Lottie** (`.json`, `.lottie`), rendues en clips
   à fond transparent à l'import (le moteur ne lit ni 3D ni Rive).
2. **Les images de la marque** (captures du site lu par iVision, photos), décrites une fois par la
   vision et proposées au storyboard (`m1`, `m2`…).
3. **Ce que le storyboard demande** (`new image: …`, `new clip: …`) : image **FLUX.2 klein 4B**
   contrôlée par la vision (aucun texte imprimé, le bon sujet) ; le clip **anime cette image** avec
   **Google Veo 3.1** par OpenRouter (Veo 3.1 aux crans High et Ultra, Veo 3.1 Fast sinon ; 16:9 ou 9:16, 4, 6 ou
   8 s — un autre format ou une autre durée était refusé et faisait retomber sur Pexels). Trois essais par média,
   puis **Pexels**, puis les
   photos des visuels de la marque. Plafonds : `VIDEO_GEN_MAX_IMAGES` (6), `VIDEO_GEN_MAX_CLIPS` (4).
   Un fournisseur sans crédit (402) coupe la génération pour toute la vidéo dès le premier refus.
4. **Une petite sélection d'animations** (coche, éclat, flèche, soulignement), dessinée pour IDEM et recolorée à la
   couleur de la marque, proposée au storyboard comme n'importe quel média (`VIDEO_LOTTIE_LIBRARY=off` la retire).
5. **Une démo produit** quand la création en demande une (`demo: { url, goal, device }`) : un agent parcourt
   l'interface publique, chaque écran est capturé avec l'endroit cliqué, et la scène zoome vers ce clic.
6. **Chaque média attribué à une scène y apparaît** : un programme qui l'ignore reçoit le premier en fond plein cadre
   (la vidéo de préférence), et les textes posés dessus passent par le contrôle d'affichage (aplat, encre lisible).

Avant l'écriture des scènes, chaque média est **préparé** : sujet et zone calme trouvés par format, extrait de clip
sans coupe ni image figée, et un **étalonnage commun** au film (jamais sur une capture d'interface).

## La jauge de créativité : un budget d'essais et la puissance des modèles

Depuis le 29 octobre 2026, **le cran choisit un budget** : combien d'essais par scène, qui réécrit une scène encore
faible, et si un modèle de vision départage deux finalistes. Le contexte et les étapes sont les mêmes partout. Tous les
modèles sont open-weight, servis par OpenRouter (`config/ai-models.config.ts`) :

| Cran | Essais par scène (selon sa difficulté) | Conception (concept, storyboard, retouche écrite) | Réécriture d'une scène faible | Départage visuel |
| --- | --- | --- | --- | --- |
| Low | 3 à 6 (`qwen/qwen3.6-35b-a3b`) | `qwen/qwen3.8-27b` | — | — |
| Medium (défaut) | 3 à 8 | `qwen/qwen3.8-27b` | 1 (`qwen/qwen3.8-27b`) | — |
| High | 3 à 10 | `z-ai/glm-5.3-flash` | 2 | — |
| Ultra | 3 à 10 | `z-ai/glm-5.3-flash` | 2 | `qwen/qwen3.8-27b` (vision) |

On s'arrête dès qu'une variante atteint le seuil de qualité mesuré : une scène simple coûte peu. Un barreau se
remplace sans code (`IDEM_LADDER_VIDEO_SAMPLE_<CRAN>`, `IDEM_LADDER_VIDEO_DESIGN_<CRAN>`…, ou
`IDEM_ROLE_VIDEO_SAMPLER_MODEL_<CRAN>` pour un rôle) ; le plafond d'essais par `VIDEO_SAMPLES_<CRAN>`. La qualité des
clips générés suit aussi le cran (Veo 3.1 dès High). Le juge est fait de mesures (composition, mouvement, intention),
jamais du goût d'un modèle.

## L'autocorrection des scènes

Avant que la vidéo soit montrée, chaque scène qui plante, dont un texte est coupé, recouvert ou illisible (dans un des
formats) est **corrigée automatiquement**, dans des bornes strictes (`src/video/author/repair.ts`) :

1. **sans modèle** d'abord : la seconde variante gardée par le juge, puis les variantes que le rapport mesuré propose
   (un cran d'échelle, une autre zone pour le texte) ;
2. **depuis le rapport** : le modèle de qualité réécrit l'intention en sachant exactement quel élément, dans quel
   format, est en défaut et pourquoi ;
3. le **dernier recours du code** : encre lisible d'après le fond réel, ou aplat sous le texte.

Une scène qui marchait n'est jamais remplacée par une version moins bonne ; après chaque tour, Motion Canvas réexécute
le film. Budget du film : `VIDEO_REPAIR_TOKEN_BUDGET` (400 000 jetons), `VIDEO_REPAIR_MAX_MS` (10 min),
`VIDEO_REPAIR_ATTEMPTS` (3), `VIDEO_REPAIR_CONCURRENCY` (3). Ce qui résiste reste signalé sur sa scène (« Corriger »
relance la même boucle) ; le journal est dans `film.repair` et `scene.author.repairs`.

## Prix (crédits iBusiness)

Inchangés. Référence : 15 s, un format, HD = **2 × la charte graphique**
(`BUSINESS_CREDIT_COSTS.motion_video`), modulée par le périmètre (`pricing.ts`) :

- durée : 6 s ×0,5 · 15 s ×1 · 30 s ×1,75 · 60 s ×3 ;
- chaque format en plus : +35 % ;
- qualité : légère (720p) ×0,8 · HD ×1 · très fluide (1080p 60 i/s) ×1,3 ;
- cran : Low et Medium ×1 · High ×1,25 · Ultra ×2 (le cran Max n'existe plus ; une vidéo gardée en « max » est lue comme High).

Premier export inclus ; ensuite 10 % du périmètre, plus la différence si le périmètre grandit. Un export
ou une création en échec restitue ses crédits (`model_unavailable` compris). Les retouches sont gratuites,
y compris les réécritures de scène par l'IA.

## Voix off

Choisie par l'utilisateur (désactivée par défaut), dans la langue de la vidéo. Les lignes sont écrites
par le planificateur (une par scène, gardée même sans voix : l'activer plus tard ne coûte pas d'agent)
ou par l'utilisateur dans son scénario.

- **Voix** : **ElevenLabs Eleven v4 par OpenRouter** (`elevenlabs/eleven-v4`, 0,04 $ les 1 000 caractères ;
  `IDEM_OPENROUTER_TTS_MODEL=elevenlabs/eleven-v3` pour la v3). Une voix par personnage : warm → sarah, bright →
  jessica, smooth → alice, confident → george, friendly → chris, deep → brian, energetic → liam
  (`IDEM_OPENROUTER_TTS_VOICE_<PERSONNAGE>` pour en changer, parmi les voix ElevenLabs d'OpenRouter). Si ElevenLabs
  échoue, Kokoro 82M redit la ligne ; le serveur Qwen3-TTS / Chatterbox de l'exploitant (`IDEM_TTS_URL`…) prime s'il
  est configuré. Une langue sans voix : la vidéo est créée sans voix, et le dit.
- **Intonation** : le planificateur écrit chaque ligne comme un script de comédien, avec les balises de jeu
  d'ElevenLabs (`[warmly]`, `[confident]`, `[excited]`, `[short pause]`…, deux au plus par ligne), les points de
  suspension et la ponctuation. Les balises sont DITES (ElevenLabs les joue), jamais lues : sous-titres, calage et
  vérification des faits utilisent le texte nu (`plainSpoken`) ; une voix qui ne les comprend pas les reçoit retirées.
- **Calage** : chaque scène dure au moins entrée + ligne + souffle ; la durée achetée ne change pas ; une
  ligne qui ne tient pas est retirée (jamais coupée) et c'est dit. La voix est dite **avant** l'écriture
  des scènes : chaque auteur connaît sa durée finale et l'instant de sa ligne.
- **Sous-titres** de la voix, posés au-dessus des scènes (activables dans le détail).
- **Traitement** : compresseur et de-esser sur la voix ; sous-titres **mot par mot** quand les mots sont datés
  (service d'alignement `IDEM_ALIGN_URL`, sinon estimation sur les silences).
- **Un seul ton** (`audio/voice.ts#steadyNarration`, garanti par le code) : une seule balise de jeu dans tout le film,
  en tête, prise parmi les tons posés (`[warmly]`, `[confident]`, `[calmly]`…) ; les balises qui font monter la voix
  (`[excited]`, `[shouting]`…) disparaissent ; au plus un point d'exclamation ; les respirations (`[short pause]`)
  restent. Une ligne redite seule reçoit la même direction de jeu. Une voix ajoutée après coup prend le personnage du
  brief, sinon une voix chaleureuse (plus jamais tirée parmi les voix « énergiques »).
- **Mixage** : voix au premier plan, musique à −10 dB et compressée sous chaque ligne.

## Effets sonores

Les sons de **transition** sont planifiés pour le film (environ une transition sur deux, variés, le pic sur la
coupe ; montée puis impact une seule fois, sur le moment fort) ; une scène peut poser un geste sonore à l'instant exact
(`ctx.sfx('pop')`), de préférence sur un temps de la musique. Sortes : whoosh, softwhoosh, pop, click, tick, impact,
shimmer, riser — plusieurs **prises** par sorte, tournées pour ne jamais répéter le même son. Sonothèque CC0 (Openverse/Freesound,
SFXMint sans clé — `VIDEO_SFX_SFXMINT=off` pour la désactiver —, catalogue `VIDEO_SFX_CATALOG`,
synthèse ffmpeg en dernier repli, `VIDEO_SFX_OFFLINE=1` pour la forcer en contrôle/CI), nettoyée, mixée
par type (`SFX_GAIN_DB`), la musique s'efface sous chaque effet, −14 LUFS au final.

Si aucune source en ligne ne renvoie de candidat pour un moment sonore (réseau coupé, clés absentes),
ce moment retombe sur la synthèse ffmpeg — volontairement plus discrète (−8 dBFS au lieu de −3) qu'un
son réel pour ne jamais sonner fort ou artificiel. La sonothèque garde si elle est **dégradée** (au moins
un moment sonore resté sur la synthèse, `video.sfx.kind_fallback_synth` dans les logs) et retente une
construction en ligne au bout d'une heure plutôt que de garder ce repli pour toujours — en mémoire
process (`sfxLibrary()`) comme sur disque (`VIDEO_SFX_DIR`/`library.json`).

## Musique libre de droits

Licences acceptées : CC0, domaine public, CC BY (crédit fourni par l'interface). Refusées : NC, ND, SA.

| Source | Variable | Remarque |
| --- | --- | --- |
| Catalogue IDEM | `VIDEO_MUSIC_CATALOG` | prioritaire |
| Openverse | `OPENVERSE_TOKEN` (facultatif) · `VIDEO_MUSIC_OPENVERSE=off` | sans clé |
| ccMixter | `VIDEO_MUSIC_CCMIXTER=off` | sans clé, tempo annoncé |
| Jamendo | `JAMENDO_CLIENT_ID` | si la clé existe |
| Freesound | `FREESOUND_API_KEY` | si la clé existe |

La **grille des temps** de la piste (temps, temps forts, phrases — BeatRoot, `music-tempo`) est donnée aux scènes
(`ctx.beats`, `at: "beat:3"`) ; les coupes sont rapprochées des temps (`VIDEO_SNAP_CUTS=off`) et l'extrait de musique
finit sur une fin de phrase.

## Rendu

- `ffmpeg` installé (images Docker de l'API) ; `FFMPEG_PATH` / `FFPROBE_PATH` pour un autre chemin.
- Chromium de Puppeteer, `--disable-accelerated-2d-canvas` (indispensable à la vitesse).
- `VIDEO_RENDER_CONCURRENCY` : onglets par rendu (défaut : ¾ des cœurs, 6 au plus) ;
  `VIDEO_RENDER_JOBS` : rendus simultanés par instance (défaut 1) ; `VIDEO_AUTHOR_CONCURRENCY` : scènes
  écrites en parallèle (défaut 4).
- **Flou de mouvement** à l'export (sous-images fondues, obturateur 180°) : `VIDEO_MOTION_BLUR=off`,
  `VIDEO_MOTION_BLUR_SAMPLES` (6 ; 4 en premium), `VIDEO_MOTION_BLUR_SHUTTER` (180). Il multiplie le temps de rendu
  par le nombre de sous-images.
- Volume final par `loudnorm` en deux passes (−14 LUFS, crête −1,5 dBTP).
- Mesuré en développement (avant le flou de mouvement) : MP4 de 15 s en 720p ≈ 7 s ; contrôle de 7 scènes ≈ 3 s.
- Le code des scènes ne parle à aucun réseau (origine locale, interception ; CSP dans l'aperçu).
- Un rendu interrompu (redémarrage) apparaît en échec et peut être relancé gratuitement.

## Anciennes vidéos

Les vidéos créées avant le 14 octobre 2026 (sans `film`) restent **téléchargeables** ; elles ne se
prévisualisent ni ne se retouchent plus (le détail le dit et propose de créer une nouvelle vidéo).

## Contrôle

`npm run check:video` (apps/api), `npm run check:request`, `check:intent`, `check:lottie`, `check:demo`
(apps/ivision/core) — voir
[VIDEO_ENGINE.md §14](VIDEO_ENGINE.md#14-contrôles-gratuits-sauf-mention).
