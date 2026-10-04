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
| Direction de motion (8 systèmes) + plan par scène + contrôle anti-réflexe | code | `video.direction.ts` |
| Scènes, techniques de texte, transitions : composants React pilotés par le temps | code écrit à la main | `apps/api/video-engine/src/*.tsx` |
| Rendu : Puppeteer image par image → ffmpeg (H.264 + AAC) | nos serveurs | `video.renderer.ts` |

Budget mesuré : 300 à 700 tokens d'entrée et 70 à 420 de sortie selon la durée.
Si le modèle est indisponible, une copie heuristique tirée du brief prend le
relais : la vidéo sort toujours.

L'aperçu du dashboard est le **même moteur** que le rendu, joué en temps réel
dans une iframe isolée (`sandbox="allow-scripts"`) : ce qu'on voit est ce qui
sera livré.

## Moteur React et directions de motion

Le rendu est un petit moteur React (`apps/api/video-engine`, empaqueté par
esbuild dans `public/video-engine/engine.js`, ~250 ko avec React) : chaque
scène est un composant, chaque style est une **fonction du temps** (`seek(t)`
rend l'image t de façon déterministe, `flushSync`). `npm run build` construit le
paquet ; en développement il est reconstruit dès qu'une source change.

Huit **directions** (éditoriale, grille suisse, bloc brut, cinétique, cinéma,
collage, précision, monochrome) fixent chacune : typographie (casse, chasse,
graisse), grille d'ancrage, vocabulaire de 4 entrées de texte, transitions,
rythme (durées, décalages), stratégie de couleur (retenue, engagée, trempée,
palette, studio), décor (filets, grille, grain, bandes cinéma, papier, cadre),
mouvement fluide ou image par image. La direction suit le type, la direction
artistique de la marque, et évite les dernières vidéos du projet.

**12 techniques de texte** : masque montant, cascade de lettres, resserrement
de chasse, échelle + flou, machine à écrire, volet par mot, mots flous,
lettres basculées, brouillage, révélation par bloc, empilement, glissements
alternés ; compteur « odomètre » pour les chiffres. **10 transitions** : coupe,
coupe + éclair, fondu, volet, poussée, zoom traversant, panoramique filé,
iris (raccord graphique sur le point focal précédent), bandes, glissé dessus.

### Règles appliquées en code (sources)

- Une seule chose bouge quand l'attention compte ; le texte en mouvement ne se
  lit pas : l'entrée livre, le temps fixe dit — [PromoHyper, « movement is cheap,
  timing is the craft »](https://promohyper.com/blog/motion-graphics-video-maker).
- Entrées très amorties (décélération), sorties en accélération, sortie ≈ 2/3
  de l'entrée ; décalage 70 ms = ordre de lecture, 300 ms = événements
  distincts — même source ; [Material Design, easing et durées](https://m3.material.io/styles/motion/easing-and-duration/tokens-specs).
- Pas de mouvement linéaire, rebond réservé aux tons ludiques ; décalage et
  chevauchement — [SVGator, bases du motion design](https://www.svgator.com/blog/motion-design-basics-guide/).
- Coupe, fondu, coupe sur l'action, raccord, zoom infini, morph — [School of
  Motion, six transitions essentielles](https://schoolofmotion.com/blog/six-essential-motion-design-transitions-tutorial).
- Grille et ferrage à gauche (style suisse) — [Envato, Swiss Style](https://elements.envato.com/learn/swiss-style-graphic-design).
- Temps de lecture : 1,5–2 s par message court, tenir après l'accroche —
  [Opus, lisibilité des sous-titres](https://www.opus.pro/blog/video-captions-for-maximum-readability).

### Anti-slop (repris des skills d'iCode, `apps/appgen/.../skills/catalog/anti-slop.md`)

Interdits, appliqués par le moteur et `lintMotion` : petit libellé en capitales
espacées sur chaque scène (au plus un, sur l'accroche), numérotation 01/02/03
décorative, filets latéraux colorés, même entrée partout ou alternance A·B·A·B,
tout centré, même transition partout, décor par défaut, mots de remplissage
(« révolutionnaire », « élever »…) et tirets cadratins dans la copie.
`npm run check:video:directions` rend le même brief dans les 8 directions et
MESURE leur écart (empreinte d'images) : deux directions trop proches font échouer.

## Types de motion (choisis par l'utilisateur)

| Type | Scènes caractéristiques | Médias |
|---|---|---|
| Typographie animée (`kinetic`) | mots animés, mots qui défilent | aucun |
| Mise en avant produit (`product`) | produit, galerie | photos importées → visuels → Pexels |
| Offre flash (`promo`) | offre (prix barré, pastille) | prix du brief |
| Vidéo + texte (`footage`) | clips plein écran, bandeau titre | clips importés → Pexels vidéo → Gemini Veo (1 clip) |
| Vitrine 3D (`showcase3d`) | modèle GLB en rotation, photos en cartes 3D, formes 3D, logo extrudé | modèle importé (facultatif) |
| Animations illustrées (`illustrated`) | Lottie intégrées (confettis, coche, étincelles, onde, éclat, cœur) ou importées | Lottie importées (facultatif) |
| Diaporama dynamique (`slideshow`) | galeries, produit | photos |
| Révélation de logo (`logo`) | mots animés + logo (3D si le SVG est disponible) | logo de la charte |

Recettes : `video.types.ts`. Les médias importés passent par `POST …/videos/media`
(photo 12 Mo, clip 80 Mo réencodé en WebM VP9 720p 15 s, GLB 20 Mo, Lottie JSON 3 Mo).

## Effets sonores

Les moments sonores sont posés par le moteur d'animation, à l'image près :
whoosh (transitions), pop (prix, pastilles, éléments qui apparaissent), clic
(titres), tic (compteurs), impact (tampon, flash), scintillement (logo,
confettis), montée (avant la signature). `video.sfx.ts` :

- sonothèque construite à partir de **Freesound (CC0) via Openverse** (sans clé),
  de Freesound directement (`FREESOUND_API_KEY`, tri par note) et d'un catalogue
  maison (`VIDEO_SFX_CATALOG`) ; synthèse ffmpeg en repli (`VIDEO_SFX_OFFLINE=1`) ;
- chaque son est nettoyé : silences retirés, durée utile, fondus, crête −3 dBFS ;
- mixage : niveaux par type, densité selon le style (un style élégant ne
  cliquette pas), musique compressée sous les effets, limiteur, −14 LUFS ;
- cache disque `VIDEO_SFX_DIR` ; `npm run check:video:types` le construit.

Autres banques professionnelles examinées : Mixkit, Pixabay Sound Effects,
Zapsplat, Sonniss (lots GDC) — sans API publique ou avec crédit obligatoire,
utilisables via le catalogue maison ; BBC Sound Effects écartée (usage non
commercial).

## Rendu 3D, clips et Lottie

- three.js (r180) empaqueté à la volée par esbuild et embarqué seulement si la
  vidéo contient une scène 3D ; WebGL logiciel (SwiftShader) : pas de GPU requis,
  mais le rendu d'une scène 3D est plus lent (~90 ms par image en 720p).
- lottie-web embarqué seulement si la vidéo contient une animation Lottie.
- Le moteur React est indépendant de GSAP (retiré) : techniques et transitions sont écrites en fonctions du temps.
- Les clips sont positionnés image par image (`currentTime` + `seeked`). Les
  onglets de rendu ont l'émulation de focus activée : sinon Chromium suspend le
  décodage vidéo des onglets « en arrière-plan ».
- Gemini Veo : `VIDEO_VEO_MODEL` (défaut `veo-3.1-fast-generate-preview`), un
  seul clip par vidéo, seulement si aucun clip importé ni Pexels ne convient.

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
npm run check:video:directions # même brief, 8 directions, diversité mesurée (~6 min)
npm run check:video:types      # 8 exemples, un par type, vraies musiques, vrais effets, Pexels (~15 min)
npm run check:video:types -- --veo  # + un clip généré par Gemini Veo (payant)
```

Aucun crédit de modèle n'est nécessaire : les réponses sont simulées
(`api/scripts/fixtures/motion-video/cases.ts` : propre, désordre, JSON, prix
inventé, vide, fournisseur en panne). Photos et musiques de test sont fabriquées
sur place. Sorties (MP4, affiches, planches-contact) : `tmp/motion-video-check/`.
