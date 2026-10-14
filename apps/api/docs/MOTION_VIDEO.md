# Vidéos de promotion en motion design

Module Communication (écran « Mes vidéos ») et iVision (atelier Vidéo). Code : moteur partagé
`apps/ivision/core/src/video/` (navigateur : `apps/ivision/core/motion/`) ; IDEM le branche par
`api/services/ivision/host.ts` et `Communication/video/idemVideoStore.ts`.

Depuis le 14 octobre 2026, chaque vidéo est **conçue par l'IA et écrite en code Motion Canvas**, scène
par scène, sans mise en page imposée. Le fonctionnement du moteur : [VIDEO_ENGINE.md](VIDEO_ENGINE.md).

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

Une scène dont le code ne s'exécute pas est **signalée** (message de l'erreur, sur la scène et dans la
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
   contrôlée par la vision (aucun texte imprimé, le bon sujet) ; le clip **anime cette image**
   (Seedance 2.0, dérogation produit `allowClosed`). Trois essais par média, puis **Pexels**, puis les
   photos des visuels de la marque. Plafonds : `VIDEO_GEN_MAX_IMAGES` (6), `VIDEO_GEN_MAX_CLIPS` (4).
   Un fournisseur sans crédit (402) coupe la génération pour toute la vidéo dès le premier refus.

## Qui décide : la jauge de créativité

Les cinq crans donnent des **moyens**, jamais des contraintes ni des gabarits :

| Cran | Concept | Storyboard | Auteur des scènes |
| --- | --- | --- | --- |
| Low | — (le planificateur l'invente dans son appel) | un appel | un appel par scène, 1 exemple |
| Medium (défaut) | directeur | un appel | 2 exemples |
| High | directeur | un appel | 2 exemples + fonctions réutilisables de la marque |
| Max | directeur | un appel | 3 exemples + fonctions réutilisables |
| Ultra | directeur, trois idées comparées | un appel | 3 exemples + fonctions réutilisables |

Les plafonds de sortie de chaque rôle par cran sont dans `apps/api/api/config/creative-roles.ts`
(`video.concept`, `video.planner`, `video.author`, `video.reviser`). Il n'y a **aucune critique
esthétique** à aucun cran.

## Prix (crédits iBusiness)

Inchangés. Référence : 15 s, un format, HD = **2 × la charte graphique**
(`BUSINESS_CREDIT_COSTS.motion_video`), modulée par le périmètre (`pricing.ts`) :

- durée : 6 s ×0,5 · 15 s ×1 · 30 s ×1,75 · 60 s ×3 ;
- chaque format en plus : +35 % ;
- qualité : légère (720p) ×0,8 · HD ×1 · très fluide (1080p 60 i/s) ×1,3 ;
- cran : Low et Medium ×1 · High ×1,25 · Max ×1,5 · Ultra ×2.

Premier export inclus ; ensuite 10 % du périmètre, plus la différence si le périmètre grandit. Un export
ou une création en échec restitue ses crédits (`model_unavailable` compris). Les retouches sont gratuites,
y compris les réécritures de scène par l'IA.

## Voix off

Choisie par l'utilisateur (désactivée par défaut), dans la langue de la vidéo. Les lignes sont écrites
par le planificateur (une par scène, gardée même sans voix : l'activer plus tard ne coûte pas d'agent)
ou par l'utilisateur dans son scénario.

- **Voix** : Kokoro 82M par OpenRouter (`ff_siwis` en français) ou le serveur Qwen3-TTS / Chatterbox
  de l'exploitant (`IDEM_TTS_URL`, `IDEM_TTS_MODEL`, `IDEM_TTS_VOICE_FR`, `IDEM_TTS_API_KEY`). Une langue
  sans voix : la vidéo est créée sans voix, et le dit.
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
