# Vidéos de promotion en motion design

Module Communication, écran « Mes vidéos ». Code : `api/services/Communication/video/`.

## Le principe : le modèle ne code jamais

| Étape | Qui | Fichier |
|---|---|---|
| Recette : objectif + durée + faits du brief → suite de scènes | code | `video.recipes.ts` |
| Copie : cases numérotées, une ligne par case | **LLM** (un appel, rôle `mechanical`, sans raisonnement) | `video.copy.ts` |
| Garde-fous : coupe au mot, anti-invention (prix, dates, numéros), copie de repli | code | `video.copy.ts` |
| Musique : plusieurs banques libres, tempo, extrait le plus énergique | code + ffmpeg | `video.music.ts`, `video.beats.ts` |
| Storyboard : minutage au temps de lecture, coupes sur le temps, variantes / surfaces / transitions par graine | code | `video.storyboard.ts` |
| Charte : palette par surface (contraste AA), polices, logo, surface claire | code | `video.theme.ts` |
| Scènes : HTML + Tailwind (compilé côté serveur) | code écrit à la main | `video.scenes.ts` |
| Animation : GSAP + SplitText, positionnable à l'instant t | code écrit à la main | `video.runtime.ts` |
| Rendu : Puppeteer image par image → ffmpeg (H.264 + AAC) | nos serveurs | `video.renderer.ts` |

Budget mesuré : 300 à 700 tokens d'entrée et 70 à 420 de sortie selon la durée.
Si le modèle est indisponible, une copie heuristique tirée du brief prend le
relais : la vidéo sort toujours.

L'aperçu du dashboard est le **même moteur** que le rendu, joué en temps réel
dans une iframe isolée (`sandbox="allow-scripts"`) : ce qu'on voit est ce qui
sera livré.

## Prix (crédits iBusiness)

Référence : 15 s, un format, HD = **2 × la charte graphique** (`BUSINESS_CREDIT_COSTS.motion_video`).
Le périmètre choisi module ce prix (`video.pricing.ts`) :

- durée : 6 s ×0,5 · 15 s ×1 · 30 s ×1,75 · 60 s ×3 ;
- chaque format en plus : +35 % ;
- qualité : légère (720p) ×0,8 · HD ×1 · très fluide (1080p 60 i/s) ×1,3.

Le premier export MP4 est inclus. Ensuite : 10 % du périmètre, plus la
différence si le périmètre grandit. Un export en échec restitue ses crédits.
Les retouches (textes, musique, style) sont gratuites.

## Musique libre de droits

Licences acceptées : CC0, domaine public, CC BY (crédit à reprendre dans la
légende, fourni par l'interface). Refusées : NC, ND, SA.

| Source | Variable | Remarque |
|---|---|---|
| Catalogue IDEM | `VIDEO_MUSIC_CATALOG` (chemin ou URL d'un JSON de `MusicTrack`) | prioritaire |
| Openverse (agrège Jamendo, Freesound, Wikimedia, ccMixter…) | `OPENVERSE_TOKEN` (facultatif, relève le quota) · `VIDEO_MUSIC_OPENVERSE=off` pour couper | sans clé |
| ccMixter | `VIDEO_MUSIC_CCMIXTER=off` pour couper | sans clé, tempo annoncé |
| Jamendo | `JAMENDO_CLIENT_ID` | activé si la clé existe |
| Freesound | `FREESOUND_API_KEY` | activé si la clé existe |

Les recherches sont gardées 24 h ; les pistes téléchargées sont en cache disque
(`$TMPDIR/idem-video-music`).

## Rendu

- `ffmpeg` doit être installé (ajouté aux images Docker de l'API) ; `FFMPEG_PATH` / `FFPROBE_PATH` pour un autre chemin.
- `VIDEO_RENDER_CONCURRENCY` : onglets Chromium par rendu (défaut : cœurs − 1, max 3).
- `VIDEO_RENDER_JOBS` : rendus simultanés par instance (défaut 1).
- Mesuré en développement : 15 s en 1080×1920 ≈ 30 s de rendu ; 6 s en 720p ≈ 10 s.
- Les images sont embarquées en data-URI avant la capture ; les URL fournies par
  l'utilisateur passent par la garde réseau (pas de requête vers le réseau interne).
- Un rendu interrompu (redémarrage) apparaît en échec et peut être relancé
  gratuitement (le compteur d'exports n'avance qu'en cas de succès).

## Contrôle

```bash
npm run check:video            # tout, avec 4 rendus MP4 (~2 min)
npm run check:video -- --fast  # sans rendu
npm run check:video -- --all   # rend tous les cas
npm run check:video -- --online  # + Openverse et ccMixter réels
```

Aucun crédit de modèle n'est nécessaire : les réponses sont simulées
(`api/scripts/fixtures/motion-video/cases.ts` : propre, désordre, JSON, prix
inventé, vide, fournisseur en panne). Photos et musiques de test sont fabriquées
sur place. Sorties (MP4, affiches, planches-contact) : `tmp/motion-video-check/`.
