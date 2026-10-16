# Vidéos de promotion en motion design

Module Communication (écran « Mes vidéos ») et iVision (atelier Vidéo). Code : moteur partagé
`apps/ivision/core/src/video/` (navigateur : `apps/ivision/core/motion/`) ; IDEM le branche par
`api/services/ivision/host.ts` et `Communication/video/idemVideoStore.ts`.

Chaque vidéo est **conçue par l'IA et animée par Motion Canvas**, scène par scène, sans mise en page imposée.
Depuis le 16 octobre 2026, l'IA écrit pour chaque scène un **programme d'animation** (langage de mouvement) que le
code compile : un texte n'est jamais coupé, ce qui entre a fini avant la coupe, et la même vidéo s'affiche bien en
vertical (mobile) comme en horizontal (ordinateur). Le fonctionnement du moteur : [VIDEO_ENGINE.md](VIDEO_ENGINE.md).

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

## Les médias

1. **Les imports de l'utilisateur** (photos, clips ; le moteur ne lit ni 3D, ni Lottie, ni Rive).
2. **Les images de la marque** (captures du site lu par iVision, photos), décrites une fois par la
   vision et proposées au storyboard (`m1`, `m2`…).
3. **Ce que le storyboard demande** (`new image: …`, `new clip: …`) : image **FLUX.2 klein 4B**
   contrôlée par la vision (aucun texte imprimé, le bon sujet) ; le clip **anime cette image** avec
   **Google Veo 3.1** par OpenRouter (Veo 3.1 aux crans High et Ultra, Veo 3.1 Fast sinon ; 16:9 ou 9:16, 4, 6 ou
   8 s — un autre format ou une autre durée était refusé et faisait retomber sur Pexels). Trois essais par média,
   puis **Pexels**, puis les
   photos des visuels de la marque. Plafonds : `VIDEO_GEN_MAX_IMAGES` (6), `VIDEO_GEN_MAX_CLIPS` (4).
   Un fournisseur sans crédit (402) coupe la génération pour toute la vidéo dès le premier refus.
4. **Chaque média attribué à une scène y apparaît** : un programme qui l'ignore reçoit le premier en fond plein cadre
   (la vidéo de préférence), et les textes posés dessus passent par le contrôle d'affichage (aplat, encre lisible).

## La jauge de créativité : la puissance des modèles

Depuis le 14 octobre 2026, **le cran choisit le modèle**, pas le travail : à tous les crans, le directeur
invente le film, le planificateur écrit le storyboard et l'auteur écrit chaque scène, avec le même
contexte. Plus le cran monte, plus les modèles qui le font sont puissants. Depuis le 16 octobre 2026, le moteur
vidéo est servi par **Google Gemini, via OpenRouter** (`ROLE_MODEL_OVERRIDES` de `config/ai-models.config.ts`) ;
Gemini 3.1 Pro raisonne toujours (son raisonnement ne peut pas être coupé : `canSuppressThinking`) :

| Cran | Conception (`video.concept`, `video.planner`, `video.reviser`) | Code des scènes (`video.author`) |
| --- | --- | --- |
| Low | `google/gemini-3.5-flash` | `google/gemini-3.5-flash` |
| Medium (défaut) | `google/gemini-3.8-flash` | `google/gemini-3.8-flash` |
| High | `google/gemini-3.1-pro-preview` | `google/gemini-3.1-pro-preview` |
| Ultra | `google/gemini-3.1-pro-preview` | `google/gemini-3.1-pro-preview` |

Un barreau se remplace sans code : `IDEM_LADDER_DESIGN_<CRAN>` / `IDEM_LADDER_CODE_<CRAN>` (modèle de la liste
blanche), ou pour un seul rôle `IDEM_ROLE_VIDEO_AUTHOR_MODEL_<CRAN>`. La qualité des clips générés suit aussi
le cran (mode « qualité » dès High). Il n'y a aucune critique esthétique à aucun cran.

## L'autocorrection des scènes

Avant que la vidéo soit montrée, chaque scène dont le programme est refusé, qui plante à l'exécution ou dont un
texte est coupé ou recouvert (dans un des formats) est **corrigée automatiquement**, dans des bornes strictes
(`src/video/author/repair.ts`) ; un défaut d'affichage reçoit deux approches de l'IA puis un dernier recours du code (encre lisible, aplat sous le texte) ; ce qui résiste encore est dit sans bloquer l'export :

1. **corriger** — le modèle du cran reçoit le code et l'erreur ;
2. **réécrire autrement** — le modèle du **cran au-dessus** réécrit la scène depuis sa fiche, plus simplement,
   en connaissant les erreurs précédentes ;
3. **version minimale** — ce même modèle écrit la version la plus simple qui marche (formes, textes, médias).

Chaque tentative change d'approche (jamais deux fois la même), **une seule tentative à la fois par scène**, trois
au plus ; après chaque tour, Motion Canvas réexécute le film (c'est lui, pas le modèle, qui dit si c'est corrigé).
Le film entier a un budget : `VIDEO_REPAIR_TOKEN_BUDGET` (80 000 jetons), `VIDEO_REPAIR_MAX_MS` (4 min) ; réglages
`VIDEO_REPAIR_ATTEMPTS` (3, 0 pour couper) et `VIDEO_REPAIR_CONCURRENCY` (3 scènes à la fois). Ce qui résiste reste
signalé sur sa scène (« Corriger » relance la même boucle bornée) ; le journal est dans `film.repair` et
`scene.author.repairs`. La même correction suit toute réécriture demandée (consigne, nouvelle version) ; une
retouche visuelle qui ne s'exécute toujours pas rend l'ancien code, qui marchait.

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
- **Mixage** : voix au premier plan, musique à −10 dB et compressée sous chaque ligne.

## Effets sonores

Posés par le **code de chaque scène** (`ctx.sfx('whoosh')`, au plus deux par scène, à l'instant exact) :
whoosh, softwhoosh, pop, click, tick, impact, shimmer, riser. Sonothèque CC0 (Openverse/Freesound,
catalogue `VIDEO_SFX_CATALOG`, synthèse ffmpeg en repli `VIDEO_SFX_OFFLINE=1`), nettoyée, mixée par type
(`SFX_GAIN_DB`), la musique s'efface sous chaque effet, −14 LUFS au final.

## Musique libre de droits

Licences acceptées : CC0, domaine public, CC BY (crédit fourni par l'interface). Refusées : NC, ND, SA.

| Source | Variable | Remarque |
| --- | --- | --- |
| Catalogue IDEM | `VIDEO_MUSIC_CATALOG` | prioritaire |
| Openverse | `OPENVERSE_TOKEN` (facultatif) · `VIDEO_MUSIC_OPENVERSE=off` | sans clé |
| ccMixter | `VIDEO_MUSIC_CCMIXTER=off` | sans clé, tempo annoncé |
| Jamendo | `JAMENDO_CLIENT_ID` | si la clé existe |
| Freesound | `FREESOUND_API_KEY` | si la clé existe |

Le tempo détecté est donné aux scènes (`ctx.beat`) : le code peut caler ses gestes sur les temps.

## Rendu

- `ffmpeg` installé (images Docker de l'API) ; `FFMPEG_PATH` / `FFPROBE_PATH` pour un autre chemin.
- Chromium de Puppeteer, `--disable-accelerated-2d-canvas` (indispensable à la vitesse).
- `VIDEO_RENDER_CONCURRENCY` : onglets par rendu (défaut : ¾ des cœurs, 6 au plus) ;
  `VIDEO_RENDER_JOBS` : rendus simultanés par instance (défaut 1) ; `VIDEO_AUTHOR_CONCURRENCY` : scènes
  écrites en parallèle (défaut 4).
- Mesuré en développement : MP4 de 15 s en 720p ≈ 7 s ; contrôle d'un film de 7 scènes ≈ 3 s.
- Le code des scènes ne parle à aucun réseau (origine locale, interception ; CSP dans l'aperçu).
- Un rendu interrompu (redémarrage) apparaît en échec et peut être relancé gratuitement.

## Anciennes vidéos

Les vidéos créées avant le 14 octobre 2026 (sans `film`) restent **téléchargeables** ; elles ne se
prévisualisent ni ne se retouchent plus (le détail le dit et propose de créer une nouvelle vidéo).

## Contrôle

`npm run check:video` (apps/api) et `npm run check:request` (apps/ivision/core) — voir
[VIDEO_ENGINE.md §11](VIDEO_ENGINE.md#11-contrôles).
