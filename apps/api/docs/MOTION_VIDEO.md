# Vidéos de promotion en motion design

Module Communication, écran « Mes vidéos ». Code : `api/services/Communication/video/`.

## Qui décide : la jauge de créativité

Avant la génération, l'utilisateur choisit un cran de créativité : **Low · Medium · High · Max · Ultra**
(Medium par défaut, sélecteur posé à côté du bouton de génération). Le cran fixe la part du film
confiée à l'IA, l'étage du modèle et le prix. Détail de l'échelle et des prix :
[CREATIVITY.md](CREATIVITY.md).

| Cran | Ce que l'IA décide | Pipeline | Exploration |
|---|---|---|---|
| Low | les textes | des menus | 5 % |
| Medium | + concept, scènes, grand moment, rythme (stratège, même quand le type est imposé) ; musique (sound designer) | des menus | 15 % |
| High | + motif (donc mise en page) de chaque scène, transitions, entrées, caméra, logo, relecture | des menus | 25 % |
| Max | + direction créative parmi trois ; réglages bornés par scène (taille, alignement, surface, tempo, décor) | des menus | 40 % |
| Ultra | **tout le film**, plan par plan, code compris, dans l'univers créatif | le film d'auteur | 70 % |

À tous les crans, le **moteur créatif** ([VIDEO_ENGINE.md §17](VIDEO_ENGINE.md#17-le-moteur-créatif)) cherche dans
l'espace des motifs une combinaison pertinente, fidèle à la charte et nouvelle pour la marque : un motif par scène, un
ADN de mouvement, un accent créatif (une seule scène qui casse l'ADN exprès). Il ne coûte aucun token : ce que les
agents reçoivent, ce sont ses 3 à 5 meilleures options. Chaque vidéo a une **empreinte créative** ; le contrôle créatif
garantit qu'aucune n'est rendue à moins de 0,30 de la vidéo la plus proche de la marque, et le détail de la vidéo
affiche cet écart et la touche inattendue.

### Low à Max : le pipeline des menus

Le code construit le film. Les agents IA choisissent dans des menus courts que le graphe de
capacités et la direction artistique (DA) de la charte ont filtrés. Le code valide chaque choix
et le remplace par le sien s'il est absent, faux ou inventé.

| Étape | Qui | Fichier |
|---|---|---|
| Recette : objectif + durée + faits du brief → suite de scènes | code (Low) ; **stratège** dès Medium | `video.recipes.ts`, `video.storyline.ts` |
| Copie : cases numérotées, une ligne par case | **rédacteur**, à tous les crans | `video.copy.ts` |
| Garde-fous : coupe au mot, anti-invention (prix, dates, numéros), copie de repli | code | `video.copy.ts` |
| Mises en page, transitions, entrées, caméra, logo, relecture | graphe ; **agents** dès High | `video.agents.ts` |
| Réglages par scène (taille, alignement, surface, tempo, décor) | graphe ; **agents** au cran Max, dans des bornes | `video.agents.ts` |
| Musique : plusieurs banques libres, tempo, extrait le plus énergique | code + ffmpeg ; **sound designer** dès Medium | `video.music.ts`, `video.beats.ts` |
| Storyboard : minutage au temps de lecture, coupes sur le temps, variantes / surfaces / transitions par graine | code | `video.storyboard.ts` |
| Bonnes pratiques : lecture, tenues, accroche, appel à l'action, signature | code, après les agents | `video.rules.ts` |
| Charte : palette par surface (contraste AA), polices, logo, surface claire | code | `video.theme.ts` |
| Direction de motion (8 systèmes) + plan par scène + contrôle anti-réflexe | code | `video.direction.ts` |
| Scènes, techniques de texte, transitions : composants React pilotés par le temps | code écrit à la main | `apps/api/video-engine/src/*.tsx` |
| Rendu : Puppeteer image par image → ffmpeg (H.264 + AAC) | nos serveurs | `video.renderer.ts` |

L'étage du modèle monte avec le cran (`motionVideo.service.ts#tierFor`) : modèle mécanique au
cran Low, modèle de rédaction dès Medium, modèle de raisonnement pour le stratège au cran Max.
Chaque appel est retenté une fois sur panne passagère ou réponse vide
(`communication.service.ts#runVideoTieredPrompt`). Si le modèle reste indisponible, une copie
heuristique tirée du brief prend le relais et le graphe fait les choix : la vidéo sort toujours.

Budget de la copie seule (cran Low) : 300 à 700 tokens d'entrée et 70 à 420 de sortie selon la
durée. Budget de chaque agent : [VIDEO_ENGINE.md §14](VIDEO_ENGINE.md#14-léquipe-dagents-videoagentsts).

### Ultra : le film d'auteur

Plus aucun menu : l'IA invente le film et écrit le code de chaque plan
(`video.author.ts`, branché par `motionVideo.service.ts#createAuthoredVideo`).

| Étape | Qui | Fichier |
|---|---|---|
| Photos (4 au plus) : importées, visuels du projet, banque, générées | code | `motionVideo.service.ts#acquireMedia` |
| Le film : concept, « bible » (signature de mouvement, couleurs, typographie) et chaque plan (durée, textes, ce qu'on voit, comment ça bouge, photo, passage au plan suivant, motif ou exploration), à partir de l'univers créatif | **directeur**, modèle de raisonnement, deux tentatives | `video.author.ts#buildDirectorPrompt`, `video.planner.ts#creativeUniverse` |
| Validation : chaque plan assez long pour être lu (`video.rules.ts#requiredHold`) et 8 s au plus, somme exacte, longueurs, aucun chiffre absent du brief, contact copié du brief, signature à la fin | code | `video.author.ts#parseFilm` |
| Musique et effets sonores, pendant l'écriture des plans | **sound designer** + code | `video.music.ts`, `video.sfx.ts` |
| Chaque plan : un composant React écrit avec les briques du kit de son motif (manifeste restreint) | **codeur**, un par plan, trois en parallèle | `video.author.ts#authorShots`, `video.coder.ts#scopedKitManifest` |
| Contrôle de chaque plan : lint, compilation, rendu mesuré, **critique visuelle** | code + modèle de vision | `video.coder.ts#inspectRenderedScene` |
| Rendu | nos serveurs | `video.renderer.ts` |

La boucle de qualité d'un plan fait **trois tours au plus**. Les défauts mesurés et la critique
visuelle repartent au codeur avec son code précédent. La critique est un conseil : le dernier code
qui a passé les contrôles mesurés est gardé. Un plan qui n'en passe aucun en trois tours reprend
la composition éprouvée de sa scène (`statement`, `cta` ou `logo`), et la vidéo l'affiche :
« Film d'auteur · 7 plans sur 8 créés par l'IA ». Si le directeur échoue deux fois, la vidéo
passe par le pipeline des menus, au même cran.

Un film trop dense pour sa durée perd d'abord ses plans de texte du milieu ; l'ouverture et la
signature restent toujours, l'appel à l'action ne part qu'en dernier recours. Entre deux plans, le moteur coupe franc : chaque plan fait lui-même l'entrée et
la sortie imaginées par le directeur.

Coût d'une vidéo Ultra : un appel du directeur (deux au plus, univers créatif ≈ 260 tokens compris),
puis par plan jusqu'à trois appels du codeur (quatre pour un plan qui explore) et deux critiques
visuelles ; chaque appel du codeur ne porte que les briques de son motif (≈ 540 tokens de moins
qu'avec tout le kit pour un plan typographique). Les rendus de contrôle passent un plan à la fois : la
création est nettement plus longue qu'aux autres crans.

**Limites actuelles du film d'auteur :**

- le type de vidéo choisi (produit, offre flash, révélation de logo…) n'est pas transmis au
  directeur : il invente le film à partir du brief ;
- le directeur ne compose qu'avec des photos : clips, modèles 3D et animations Lottie importés
  restent attachés à la vidéo mais n'y sont pas montrés ;
- une retouche garde le minutage du directeur : un texte rallongé n'allonge pas son plan (les plans
  codés ajustent la taille du texte au cadre).

### L'aperçu

L'aperçu du dashboard est le **même moteur** que le rendu, joué en temps réel
dans une iframe isolée (`sandbox="allow-scripts"`) : ce qu'on voit est ce qui
sera livré. Pendant la création, le flux SSE montre les étapes du cran : plan,
copie, médias, mise en page, musique, effets sonores, mouvement, relecture ; en
Ultra : médias, direction du film, musique, puis chaque plan (écrit, revu,
corrigé, retenu).

## Moteur React et directions de motion

Le rendu est un moteur React + Tailwind (`apps/api/video-engine`, empaqueté par
esbuild dans `public/video-engine/` : runtime React partagé, moteur, et un addon
par bibliothèque lourde) : chaque scène est un composant, chaque style est une
**fonction du temps** (`seek(t)` rend l'image t de façon déterministe,
`flushSync`). `npm run build` construit les paquets ; en développement ils sont
reconstruits dès qu'une source change.

**Environnement complet (bibliothèques installées, kit, graphe de capacités qui
dit à l'IA ce qu'elle peut utiliser selon le projet, direction créative bornée,
charte et DA traduites en mouvement, calendrier) : [VIDEO_ENGINE.md](VIDEO_ENGINE.md)
et [VIDEO_CAPABILITIES.md](VIDEO_CAPABILITIES.md).**

Huit **directions** (éditoriale, grille suisse, bloc brut, cinétique, cinéma,
collage, précision, monochrome) fixent chacune : typographie (casse, chasse,
graisse), grille d'ancrage, vocabulaire de 6 à 8 entrées de texte, transitions,
rythme (durées, décalages), stratégie de couleur (retenue, engagée, trempée,
palette, studio), décor (filets, grille, grain, bandes cinéma, papier, cadre),
mouvement fluide ou image par image. La direction suit le type, la direction
artistique de la marque, et évite les dernières vidéos du projet.

**20 techniques de texte** : masque montant, cascade de lettres, resserrement
de chasse, échelle + flou, machine à écrire, volet par mot, mots flous,
lettres basculées, brouillage, révélation par bloc, empilement, glissements
alternés, ressort montant, vague, étirement, bascule 3D, zoom par mot,
inclinaison, dispersion, contour qui se remplit ; compteur « odomètre » pour
les chiffres. **17 transitions** : coupe, coupe éclair, glitch, fondu, zoom
flou, traversée, filé, cube 3D, poussée, glissé, iris (raccord graphique sur le
point focal précédent), volet, bandes, disque de marque, lames obliques,
panneaux, vague.

**18 mises en page** pour les scènes de texte : la composition de la direction
et 17 archétypes (pile de mots, mot géant défilant, chiffre géant, bandeau
diagonal, cercle de la marque, deux blocs, cartes superposées, grille de cartes,
liste cochée, grande citation, prix en étoile, bandeaux défilants, mot sous le
projecteur, cadre décalé, et trois mises en page de données : anneau Chart.js
qui se remplit jusqu'au pourcentage, ancien et nouveau prix en barres Chart.js,
jauge visx). Détail : [VIDEO_ENGINE.md §15](VIDEO_ENGINE.md#15-mises-en-page-et-transitions).

**Graphiques et dessin** : le moteur embarque Chart.js (et ses extensions
treemap, sankey, matrice, étiquettes, repères), visx et d3 (jauges, aires,
mosaïques, carte de l'Afrique dont les pays nommés dans le texte s'allument),
rough.js et perfect-freehand (croquis, pinceau), simplex-noise (champs de flux)
et Zdog (3D plate). Chaque bibliothèque est un addon chargé seulement si la
vidéo s'en sert. Un graphique ne montre que des chiffres écrits dans les textes
de sa scène : c'est contrôlé au rendu. Détail : [VIDEO_ENGINE.md §3 et §5](VIDEO_ENGINE.md#3-bibliothèques-installées).

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

Au cran Ultra, le type ne guide pas encore le film : le directeur invente à
partir du brief et ne compose qu'avec des photos ; la vidéo garde le type
demandé (`mix` sinon). Voir « Limites actuelles du film d'auteur ».

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

- 3D : addon three.js + React Three Fiber + drei + postprocessing, embarqué
  seulement si la vidéo contient une scène 3D ; WebGL logiciel (SwiftShader) :
  pas de GPU requis, mais une scène 3D est plus lente (~90 ms par image en 720p).
- Lottie (addon lottie-web light, sans expressions) seulement si la vidéo en
  contient une ; `.lottie` est décompressé côté serveur. Rive (`.riv`) importable.
- GSAP, anime.js, flubber, Chart.js, visx, outils de dessin, Zdog : addons
  chargés seulement si le kit, une mise en page ou un plan écrit par l'IA les
  exige (`addonsOfSceneCode` lit les imports du plan) ; techniques et
  transitions restent écrites en fonctions du temps dans le moteur.
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
- qualité : légère (720p) ×0,8 · HD ×1 · très fluide (1080p 60 i/s) ×1,3 ;
- cran de créativité : Low et Medium ×1 · High ×1,25 · Max ×1,5 · Ultra ×2
  (`withCreativity`, `communication.routes.ts`). Le cran est inscrit au relevé.

Le premier export MP4 est inclus. Ensuite : 10 % du périmètre, plus la
différence si le périmètre grandit ; un export à un périmètre plus large
applique le cran choisi à la création. Un export en échec restitue ses crédits.
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
- Au cran Ultra, chaque plan écrit par l'IA est rendu pour contrôle **pendant la
  création**, sur la page réelle, avec le garde réseau strict. Ces rendus de
  contrôle passent un à la fois ; seuls les appels au modèle sont parallèles.

## Contrôle

```bash
npm run check:video            # tout, aux cinq crans, avec 4 rendus MP4 (~2 min)
npm run check:video -- --fast  # sans rendu
npm run check:video -- --all   # rend tous les cas
npm run check:video -- --online  # + Openverse et ccMixter réels
npm run check:video:creative   # agents et direction créative, réponses de modèles faibles
npm run check:video:engine     # moteur, kit, bibliothèques, 17 mises en page (-- --online : vrai fichier Rive)
npm run check:video:layouts    # chaque mise en page, textes au plus long, 4 formats
npm run check:video:variety    # 12 vidéos d'une même marque, écarts mesurés
npm run check:video:novelty    # moteur créatif : motifs, empreinte, exploration, 10 vidéos par cran, mémoire
npm run check:video:directions # même brief, 8 directions, diversité mesurée (~6 min)
npm run check:video:types      # 8 exemples, un par type, vraies musiques, vrais effets, Pexels (~15 min)
npm run check:video:types -- --veo  # + un clip généré par Gemini Veo (payant)
```

`check:video` §9 bis rend **la même vidéo aux cinq crans** et vérifie que l'IA
décide davantage à chaque cran : textes (Low), structure (Medium), mises en
page, transitions et relecture (High), réglages (Max), puis directeur et tous
les plans écrits par l'IA, critique visuelle comprise (Ultra). Les plans Ultra
y sont réellement lintés, compilés, rendus et contrôlés.

Aucun crédit de modèle n'est nécessaire : les réponses sont simulées
(`api/scripts/fixtures/motion-video/cases.ts` : propre, désordre, JSON, prix
inventé, vide, fournisseur en panne ; stratège et directeur du film). Les
codeurs de plans et la critique visuelle (qui demande une correction, puis
valide) sont simulés dans `checkMotionVideo.ts`.
Photos et musiques de test sont fabriquées sur place. Sorties (MP4, affiches,
planches-contact) : `tmp/motion-video-check/`.
