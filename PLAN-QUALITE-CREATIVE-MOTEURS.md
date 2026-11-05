# Plan d'action — rendus plus originaux et plus beaux avec les modèles actuels

> Moteurs concernés : graphique (`packages/graphic-engine`, 2.2) et vidéo (`apps/ivision/core/src/video` +
> `packages/motion-compiler`). Version 4 du 05/11/2026 — **implémentée** sur la branche `feat/creative-quality-tools`
> (état détaillé au §0 bis). Version 3 du 04/11/2026 : décisions de l'utilisateur, licences vérifiées **à la
> source** (fichiers LICENSE via l'API GitHub, fiches Hugging Face, registres npm et PyPI), et **seulement des outils
> qui tournent sur la machine actuelle** (§1, relevé détaillé).
> Les durées sont des **estimations** de travail, pas des mesures.

## Décisions déjà prises (04/11/2026)

| Sujet | Décision |
| --- | --- |
| Hébergement des outils locaux | **sur la machine actuelle** pour tous les tests ; le choix pour la production se fera après |
| Contrainte matérielle | **aucun outil qui demande un GPU** : tout tourne sur le processeur, ou part vers un service distant déjà utilisé (OpenRouter) |
| HyperFrames | **à utiliser** (Apache 2.0, vérifié) — tourne sur la machine (Node 25, FFmpeg 8.1 avec encodeur matériel VideoToolbox) |
| OmniSVG | **retiré** (26 Go de mémoire GPU) ; remplacé par une chaîne légère : image générée par OpenRouter → vectorisation locale (§2.1) |
| Juge visuel | **OpenRouter seul** (05/11/2026) : le juge local (llama.cpp) est abandonné |
| Modèle fort sur l'idée | **accepté** (05/11/2026) : son coût est absorbé, aucun prix ne change |
| HyperFrames en production | **moteur vidéo par défaut**, Motion Canvas en repli ; la **production passe en Node 22** (Dockerfiles de l'API et d'iVision) |
| Animation des scènes | **GSAP par défaut**, Anime.js au choix (`IDEM_VIDEO_ANIMATION=anime`), les deux intégrés (05/11/2026) |
| Relecture culturelle (annexe B) | choisie par Claude, faute de préférence : **relecture documentaire** (sources publiques par entrée, faite) **puis relecture humaine** par une personne de chaque pays — de préférence un utilisateur IDEM du pays (programme d'ambassadeurs), sinon un membre de l'équipe qui en est originaire. Le statut est tenu dans `packages/design-tools/src/seed/axes.ts` ; dès que les 13 pays ont au moins une entrée relue, `IDEM_AXES_REVIEWED_ONLY=1` restreint le tirage aux entrées relues. D'ici là, les entrées documentées servent : elles n'orientent qu'un principe visuel (matière, géométrie, rythme), jamais un nom ni un sens affiché |
| Échantillons | créés par Claude : **5 au maximum pour la vidéo**, **3 au maximum par livrable graphique** (business plan, charte, pitch deck, carte de visite), soit 17 au total (annexe A) |
| Axes de départ | couvrent les **13 pays provisionnés** : BEN, CIV, CMR, COD, COG, GAB, KEN, MOZ, RWA, SEN, SLE, UGA, ZMB (annexe B) |

## 0 bis. État de l'implémentation (05/11/2026)

Rien n'est commité. Tout est vérifié par le typage et par des contrôles à modèles SIMULÉS ; aucune génération payante
n'a été lancée (les bancs réels attendent votre accord, §10).

| Phase | Fait | Où | Vérifié par |
| --- | --- | --- | --- |
| 0 | les 17 échantillons (marques fictives, 13 pays, FR/EN/PT) ; le banc `sample:quality` (rendus + rapport de nouveauté CLIP) | `apps/api/api/scripts/quality/samples.ts`, `sampleQuality.ts` | typage ; **non lancé** (payant) |
| 1 | exploration en 4 pistes (graphique et vidéo), choix de la plus nouvelle par le code ; idée au modèle le plus fort avec raisonnement (`pinLevel`, `thinking`, `temperature` par rôle) ; mémoire de 10 idées sur 3 portées (marque, utilisateur, secteur+pays) ; axe de départ des 13 pays, jamais recyclé | `creative-roles.ts`, `ai-models.config.ts`, `graphic-engine/src/{engine,author/prompts}.ts`, `ivision/core/src/video/director/concept.agent.ts` | `check:roles` (22), `check:graphic` §10, `check:hyperframes` |
| 2 | `@idem/design-tools` : couleur OKLCH et contraste WCAG 2, paires de polices, motifs (semis, flux, grain, tracés à la main), saliency « frequency-tuned », vectorisation (vtracer), embeddings CLIP en WebAssembly, juge à questions fermées, score transparent, axes ; `check:licenses` | `packages/design-tools/`, `scripts/check-licenses.mjs` | `check:design-tools` (37), `check:licenses` |
| 3 | variantes mesurées (2 à 3 pour une toile seule, 2 pour une couverture), choisies par le score (défauts, hiérarchie, couverture, saliency, juge OpenRouter, nouveauté) ; une retouche guidée par les défauts mesurés ; juge branché chez IDEM et iVision (`graphic.judge`) | `graphic-engine/src/engine.ts`, `runtime/check.ts` (mesure DOM), `api/services/graphic/engine.host.ts`, `ivision/core/src/runtime/host.ts` | `check:graphic` (141), `check:creativity` |
| 4 | HyperFrames, moteur vidéo par défaut : auteur HTML des scènes (GSAP ou Anime.js), contrôle du code, contrôle dans Chrome avec vignettes, correction bornée, aperçu, retouches, export MP4 avec mixage du son ; repli Motion Canvas si une scène ne s'écrit pas ; Node 22 en production | `ivision/core/src/video/rendering/hyperframes/`, `author/html.author.ts`, `motionVideo.service.ts`, `Dockerfile/prod/Dockerfile.{api,ivision-api}` | `check:hyperframes` (28, dont un export MP4 de 15 s rendu en 38 s), `check`, `check:motion`, `check:request` |
| 5 | bibliothèque d'exemples : choix de 2 exemples proches et différents, consigne « principe, pas composition », garde anti-copie ; assembleur (`build-examples.ts`, gratuit). **Construite le 05/11/2026 sans aucun appel payant** : 160 pages écrites à la main par Claude (20 par support, plus 20 chartes en paysage ajoutées le 05/11 : business plan, pitch deck, charte, carte de visite, visuels réseaux, couvertures de documents, couvertures de profil), rendues par le vrai moteur (`corpus/`, `scripts/render-corpus.ts`), 160/160 affichées sans constat bloquant. Deux fichiers : `library/examples.json` (99, tri du plan : ≤ 2 foyers) et `library/examples.all.json` (160, `--keep-all`). Le professeur payant (`teachExamples.ts`) reste disponible mais n'est plus nécessaire pour démarrer | `graphic-engine/src/examples/library.ts`, `scripts/build-examples.ts`, `scripts/render-corpus.ts`, `corpus/`, `library/` | rendu des 160 pages ; récupération testée (`pickExamples`) ; `tsc --noEmit` ; **effet sur la hiérarchie et la nouveauté non mesuré** (critère de sortie, §Phase 5) |
| 6 | **non fait** (optionnelle) : GEPA demande Python ≥ 3.10 et des appels payants ; le score est prêt à lui servir de métrique | — | — |
| 7 | décision, non engagée | — | — |

**Visuels (05/11/2026, les 7 points + le détourage)** — `apps/ivision/core/src/visual/visual.concept.ts`,
`visual.composer.ts`, `packages/design-tools/src/{cutout,treat}.ts`, contrôle `check:visual-quality` (11) :
1. **Une idée avant les mots** : 4 pistes (`graphic.explore`), chacune avec son rôle d'image, son traitement et son
   registre typographique ; la plus nouvelle retenue par le code ; les mots, l'image et la page la suivent.
2. **Pays et mémoire** : le pays du projet (IDEM, et les marques iVision importées d'un projet IDEM) et les portées
   utilisateur et secteur+pays.
3. **Images façonnées** : illustration vectorielle aux couleurs de la marque (vtracer), **sujet détouré** (ISNet,
   Apache 2.0, 5,3 s par image sur la machine ; U²-Net-p en option rapide, 1,3 s), duotone, teinte, monochrome.
4. **Motifs procéduraux** : `<idem-pattern kind="flow|scatter|grain|hand-lines|hand-circles">`, dessinés par le code.
5. **Les variantes proposées au client** : IDEM (fenêtre du visuel, « Autres propositions ») et iVision (résultat du
   chat) ; le choix est journalisé (`visual.variant_chosen`) pour régler un jour les poids du score.
6. **Déclinaison cohérente** : la déclinaison IDEM existante et la nouvelle déclinaison iVision (`POST /visuals/:id/decline`)
   reprennent les mots, l'image et l'idée ; seule la composition s'adapte.
7. **Police d'accroche** pour le titre seul, quand l'idée est « expressive ».

**Même logique dans IDEM et iVision (vérifié le 05/11/2026)** : les vidéos des deux passent par le même
`MotionVideoService` (HyperFrames par défaut, exploration, axes), les visuels par le même `composeVisual` ; aucune
variable d'environnement ne les désactive dans les `.env` ni l'infra. Écart trouvé et corrigé : la passerelle interne
d'IDEM écartait l'usage `design-judge` — le juge d'iVision tournait sur le modèle de vision par défaut. Les bannières et
l'avatar de la charte imposent une seule variante (`variants: 1` : des fichiers que personne ne choisit).

**Écarts assumés par rapport au plan** :
- La requête sur `ai-trace` (taux de troncature) n'est pas écrite : les plafonds étaient déjà larges et le rôle
  `graphic.director` est passé de 2 500 à 9 000 jetons pour permettre le raisonnement.
- Le registre des ~450 blocs HyperFrames n'est pas branché (il s'installe par le réseau, `npx hyperframes add`) ;
  l'auteur compose ses scènes librement en HTML Tailwind.
- Les outils côté Motion Canvas (bibliothèque du professeur, `easing`, `rhythm`) ne sont pas faits : HyperFrames est
  devenu le moteur par défaut, Motion Canvas ne sert plus qu'en repli.
- Les images Docker ne sont **pas construites** ici : Node 22, la copie de `design-tools` et HyperFrames dans Alpine
  (Chromium du système via `PUPPETEER_EXECUTABLE_PATH`) sont à vérifier au premier déploiement de préproduction.
- Sur la machine de test, `~/.cache` appartient à `root` : le modèle CLIP se range dans `~/Library/Caches/idem-design-tools`,
  et Puppeteer ne peut pas télécharger de nouveau Chrome (le cœur iVision est donc fixé à `puppeteer@24.30.0`, la
  version de la racine, dont le Chrome est présent).

**Interrupteurs** (tous actifs par défaut, `0` coupe) : `IDEM_QUALITY_EXPLORE`, `IDEM_QUALITY_SELECT`,
`IDEM_QUALITY_REFINE`, `IDEM_QUALITY_EXAMPLES` ; `IDEM_QUALITY_VARIANTS` impose un nombre ; `IDEM_QUALITY_WEIGHTS` règle
les poids du score ; `IDEM_VIDEO_RENDERER=motion-canvas` et `IDEM_VIDEO_ANIMATION=anime` changent de moteur ou de
bibliothèque ; `IDEM_EXAMPLES_FILE` branche la bibliothèque d'exemples.

## 0. Constat de départ

| Constat (vérifié dans le code) | Source |
| --- | --- |
| Les plafonds de tokens sont déjà larges (page 12 000, couverture 24 000, concept vidéo 8 000, auteur vidéo 16 000) : les relever ne change rien | `apps/api/api/config/creative-roles.ts` |
| Une seule idée par film (« ONE original film ») et une seule idée par document | `director/concept.agent.ts:33`, `author/prompts.ts` (`planPrompt`) |
| L'anti-cliché est une phrase d'interdiction ; la mémoire d'idées relit 3 idées, par marque seulement | `concept.agent.ts:35`, `author/prompts.ts:241`, `engine.ts:193` |
| Les idées viennent de petits modèles sans réflexion (`thinking: false`) | `ai.config.ts:710-712`, `ai-models.config.ts` |
| Le moteur vidéo a déjà un échantillonneur (6 à 10 variantes) et un juge ; le graphique écrit **une page, une fois** | `author/sampler.ts`, `engine.ts` |
| `AgentCall` est un appel unique `system + user → texte` : **les agents n'ont aucun outil** | `packages/graphic-engine/src/host.ts:14` |
| Les petits modèles écrivent mal le TSX Motion Canvas (banc : TSX 3/8 MP4 valides, DSL 8/8) | mémoire « Motion Compiler » |

**Thèse du plan** : avec des modèles de cette taille, la qualité vient de ce qu'on met autour d'eux. Cinq leviers,
dans cet ordre : (1) diverger avant d'écrire, (2) donner aux agents des outils de mesure et de génération,
(3) choisir entre plusieurs candidats par la mesure, (4) leur faire écrire dans le langage qu'ils maîtrisent
le mieux — le HTML, d'où HyperFrames pour la vidéo, (5) leur montrer de bons exemples.

## 1. La machine de test (vérifiée le 04/11/2026)

Relevé par `sysctl`, `system_profiler`, `sw_vers`, et les registres npm et PyPI.

| Élément | Valeur relevée | Conséquence |
| --- | --- | --- |
| Modèle | MacBook Pro 16 pouces 2019 (`MacBookPro16,1`), sur secteur, batterie à 100 % | les longs calculs chauffent : on borne les lots et on mesure le temps |
| Système | macOS 26.2, architecture **x86_64** (Intel) | beaucoup de paquets d'IA ne publient plus de binaires pour Mac Intel |
| Processeur | Intel Core i9-9980HK, 8 cœurs / 16 fils, 2,4 GHz | jeux d'instructions **AVX2, FMA, F16C ; pas d'AVX-512** : les calculs vectoriels sur processeur sont corrects, sans plus |
| Mémoire | 32 Go (environ 68 % libres au relevé) | un petit modèle de vision quantifié : oui ; un modèle de 8 milliards de paramètres en pleine précision : non |
| Cartes graphiques | AMD Radeon Pro 5500M **8 Go** + Intel UHD 630 (1,5 Go partagés), Metal 3, **pas de CUDA** | PyTorch, onnxruntime (Python) et open_clip n'ont **aucune** version récente pour Mac Intel (PyTorch s'arrête à 2.2.2 ; onnxruntime Python et torch récents : 0 fichier `macosx_x86_64` sur PyPI) |
| Disque | 146 Go libres | suffisant pour quelques modèles de moins de 1 Go et les rendus |
| Node / npm | Node 25.3, npm 11.7 | HyperFrames demande Node 22+ : OK. **`onnxruntime-node` (1.30 et 1.31) ne contient que `darwin/arm64`** : aucun binaire pour Mac Intel, et `@huggingface/transformers` plante dès l'import. **`onnxruntime-web` (WebAssembly) fonctionne** dans Node, 8 fils |
| Python | 3.9.6 (système) seulement | GEPA, DSPy, Crawl4AI demandent Python ≥ 3.10 : installer Python 3.12 par Homebrew (présent) si la phase 6 est lancée |
| FFmpeg | 8.1.2 avec `libx264`, `libx265`, **`h264_videotoolbox` et `hevc_videotoolbox`** | l'encodage vidéo peut utiliser le matériel du Mac : rendu HyperFrames possible en local |
| Autres | Docker et Homebrew installés ; pas d'Ollama, pas de llama.cpp, pas de Rust | Docker sur Mac Intel = machine virtuelle Linux **sans GPU** : bon pour des services processeur seulement |

**Essais faits sur la machine le 04/11/2026** (scripts dans le dossier temporaire de la session, aucun appel payant) :

| Essai | Résultat mesuré |
| --- | --- |
| `@huggingface/transformers` 4.3 dans Node | **échec à l'import** : binaire `onnxruntime-node` absent pour `darwin/x64` |
| CLIP ViT-B/32 quantifié (`vision_model_quantized.onnx`, 89 Mo) par `onnxruntime-web` en WebAssembly, prétraitement par `sharp` | chargement 0,6 s ; **43 à 130 ms par image** une fois chaud (312 ms la première) ; ~600 Mo de mémoire ; cosinus 0,977 entre deux visuels presque identiques, 0,660 entre deux visuels différents : la mesure de nouveauté distingue bien |
| `@neplex/vectorizer` (binaire `darwin-x64`) sur une image de 1 024 px | **157 ms**, 118 chemins avant nettoyage (à réduire par les réglages et SVGO) |
| `sharp` 0.35 | fonctionne (binaire `darwin-x64`) |

**Conséquence pour le plan** : tout ce qui demande PyTorch ou un GPU est retiré. Les outils d'apprentissage
automatique passent par **Node et `onnxruntime-web` en WebAssembly** (processeur seul, aucun binaire natif) ; le
prétraitement des images est écrit par nous avec `sharp`, sans Transformers.js. Le reste est du TypeScript pur. Ce qui demande vraiment un gros modèle (juge visuel, génération d'image) reste sur **OpenRouter**,
déjà utilisé et déjà payé à l'usage.

**Retirés pour raison matérielle** (en plus des retraits de licence du §2.2) :

| Outil retiré | Pourquoi | Remplacement léger |
| --- | --- | --- |
| OmniSVG 1.1 8B | 26 Go de mémoire GPU d'après son README | image générée (FLUX.2, déjà branché) puis **vectorisation locale** par `@neplex/vectorizer` (MIT, moteur vtracer, binaire `darwin-x64` publié) ou `imagetracerjs` (Unlicense, JavaScript pur) ; puis SVGO et Paper.js, déjà dans le moteur de logos |
| StarVector 1B / 8B | PyTorch + GPU | même chaîne de vectorisation ; SVG écrit par le modèle (pattern-designer actuel) |
| SigLIP 2 so400m (PyTorch) | PyTorch absent pour Mac Intel, modèle lourd | **CLIP ViT-B/32 quantifié** (`Xenova/clip-vit-base-patch32`, MIT) par `onnxruntime-web` — **essayé, fonctionne** ; SigLIP 2 base en ONNX (`onnx-community/siglip2-base-patch16-224-ONNX`, issu de Google, Apache 2.0) par la même voie si CLIP ne suffit pas |
| Transformers.js (`@huggingface/transformers`) | plante à l'import sur Mac Intel (binaire natif absent) | `onnxruntime-web` appelé directement, prétraitement maison avec `sharp` |
| Prédicteurs esthétiques LAION | PyTorch + CLIP L/14, et réserve de licence sur AVA | **retirés** : le score repose sur les mesures du code et le juge à questions fermées |
| Service Python `design-lab` | Python 3.9 et pas de PyTorch récent | **supprimé** : tout passe dans `@idem/design-tools` (Node) |
| Saliency par réseau de neurones | DeepGaze déjà écarté (licence) ; les autres demandent PyTorch | **saliency par résidu spectral** (méthode classique de Hou & Zhang, 2007) codée en TypeScript avec `fft.js` (MIT) et `sharp` (Apache 2.0, binaire `darwin-x64`), complétée par la mesure DOM |

**Abandonné le 05/11/2026 (décision : juge OpenRouter seul)** — l'option étudiée était un petit modèle de vision local
(Qwen3-VL-4B-Instruct, Apache 2.0, en GGUF quantifié d'environ 3 Go) avec llama.cpp compilé en **Vulkan** (MoltenVK) sur la 5500M. D'après des retours
d'utilisateurs, Metal est très lent sur les Mac Intel et Vulkan nettement meilleur, mais un bogue Vulkan sur les
puces graphiques Intel a été signalé : forcer la carte AMD. Aucun chiffre fiable pour la 5500M : à mesurer avec
`llama-bench`. Si c'est trop lent, le juge reste sur OpenRouter.

## 2. Registre des licences (vérifié à la source le 04/11/2026)

Le dépôt idem est sous **Apache 2.0 avec Commons Clause**. Une dépendance compatible doit être permissive
(MIT, Apache 2.0, ISC, BSD) ou tourner comme **service séparé non modifié**.

### 2.1 Retenus

| Outil | Licence vérifiée | Usage dans le plan | Remarque |
| --- | --- | --- | --- |
| HyperFrames (`hyperframes` 0.9.13, `@hyperframes/*`) | Apache 2.0 (dépôt) | rendu vidéo HTML | les paquets `@hyperframes/*` n'indiquent pas de licence dans npm : la licence du dépôt s'applique, garder le fichier LICENSE/NOTICE dans le paquet installé ; sa dépendance `@chenglou/pretext` est MIT |
| `onnxruntime-web` 1.31 (WebAssembly) | MIT | moteur d'inférence dans Node, processeur seul | **essayé sur la machine : fonctionne** ; `onnxruntime-node` et Transformers.js ne fonctionnent pas sur Mac Intel (§1) |
| Poids `Xenova/clip-vit-base-patch32` | MIT | embeddings (nouveauté, recherche d'exemples) | ~150 Mo en version quantifiée |
| Poids `onnx-community/siglip2-base-patch16-224-ONNX` | Apache 2.0 (modèle Google d'origine) | embeddings, si CLIP ne suffit pas | — |
| `@neplex/vectorizer` 0.1 | MIT (moteur vtracer, MIT) | image → SVG | binaire `darwin-x64` publié ; projet jeune (0.1) |
| `imagetracerjs` 1.2.6 | Unlicense | image → SVG, repli | JavaScript pur, aucune dépendance |
| `sharp` 0.35 | Apache 2.0 | lecture et redimensionnement des captures | binaire `darwin-x64` publié |
| `fft.js` 4.0 | MIT | saliency par résidu spectral | JavaScript pur |
| Qwen3-VL-4B-Instruct (GGUF) | Apache 2.0 | juge visuel local, **optionnel** | via llama.cpp (MIT) en Vulkan |
| Anime.js 4.5 | MIT | animations dans HyperFrames, au choix | seconde bibliothèque, GSAP restant le défaut (voir 2.2) |
| lottie-web 5.13, dotlottie-web | MIT | animations Lottie dans HyperFrames | — |
| three.js | MIT | 3D dans HyperFrames | — |
| Motion Canvas | MIT | moteur vidéo actuel | — |
| culori 4.0.2 (dépôt `danburzo/culori`) | MIT | couleur | — |
| colorjs.io 0.7.1 | MIT | couleur, contraste WCAG 2 | ne pas utiliser sa fonction APCA (voir 2.2) |
| pro-color-harmonies 0.11 | MIT | palettes OKLCH | — |
| @evilmartians/harmony 1.4 | MIT | palettes d'interface | — |
| simplex-noise 4.0.3 | MIT | motifs procéduraux | — |
| poisson-disk-sampling 2.3.1 | MIT | semis de points | — |
| d3-delaunay | ISC | triangulations, Voronoï | — |
| roughjs 4.6.6 | MIT | rendu « dessiné à la main » | — |
| GEPA 0.1.4 | MIT | optimisation des prompts | Python pur, ≥ 3.10 : demande Python 3.12 par Homebrew ; calcule sur le processeur, les modèles restent distants |
| DSPy 3.4 | MIT | idem | idem |
| llama.cpp (grammaires GBNF) | MIT | décodage contraint, seulement avec le juge local optionnel | remplace XGrammar/llguidance/Outlines, qui visent des serveurs vLLM/SGLang avec GPU |
| Crawl4AI | Apache 2.0 | recherche d'inspiration (phase 6) | Python ≥ 3.10 + Playwright, processeur seul |
| Open Design | Apache 2.0 | lecture des skills et de la grille d'autocritique | chaque skill embarqué a sa propre licence : vérifier avant de recopier |
| awesome-design-md | MIT | lecture comme corpus de principes | les fichiers décrivent des **marques réelles** : principes seulement, jamais de reprise de marque |
| LayoutGeneration (LayoutPrompter) | MIT, dépôt **archivé** | méthode à réécrire en TypeScript | — |
| fontjoy | MIT, inactif depuis 2017 | données de paires de polices | — |
| Fonttrio | MIT | paires de polices | — |

### 2.2 Écartés ou à contourner (corrections par rapport à la version 1 du plan)

| Outil | Ce que dit la licence | Décision |
| --- | --- | --- |
| **OmniSVG-3B et OmniSVG 1.1 4B** | étiquetés Apache 2.0, **mais dérivés de Qwen2.5-VL-3B-Instruct, sous « Qwen RESEARCH LICENSE » : usage non commercial seulement** (« FOR NON-COMMERCIAL PURPOSES ONLY ») | écartés (licence) ; le 8B est écarté pour raison matérielle (§1) |
| Prédicteurs esthétiques LAION | code MIT / Apache 2.0, poids entraînés sur le jeu AVA aux conditions floues | écartés (licence douteuse + PyTorch) |
| XGrammar, llguidance, Outlines | licences permissives | non retenus : utiles seulement avec un serveur vLLM ou SGLang, donc un GPU |
| StarVector, SigLIP 2 so400m, open_clip | licences permissives | non retenus : PyTorch, absent pour Mac Intel (§1) |
| Potrace | GPL | écarté (incompatible avec la Commons Clause) ; vtracer et imagetracerjs le remplacent |
| Jeu de données MMSVG (OmniSVG) | CC BY-NC-SA 4.0 | ne pas l'utiliser pour entraîner ou affiner quoi que ce soit |
| **GSAP** — **réintégré le 05/11/2026, par défaut** | licence « Standard no charge » : gratuite, usage commercial compris, sans clé ni limite de postes. Elle garde une clause d'« usages interdits » (outils qui font créer des animations sans code en concurrence avec l'éditeur d'animations de Webflow), et Webflow peut la résilier à sa discrétion | **retenu par décision de l'utilisateur** : GSAP par défaut, Anime.js (MIT) au choix ; `check:licenses` le déclare en exception motivée. Risque résiduel : la clause ci-contre — en cas de doute juridique, `IDEM_VIDEO_ANIMATION=anime` bascule tout sans changer de code |
| **APCA** (`apca-w3`) | « Limited W3 License » : réservé aux contenus web WCAG, implémentations non conformes considérées comme contrefaçon, brevet en attente | **écarté** : contraste mesuré en WCAG 2 (culori, colorjs.io) |
| **DeepGaze** | **aucune licence** dans le dépôt : tous droits réservés | **écarté**. Le point focal se mesure par le code (taille, contraste, position dans le DOM) et par le juge visuel à questions fermées |
| PosterLLaVA | CC BY-NC 4.0 | écarté ; lecture de l'article seulement |
| UI2Code_N, Chat2SVG | aucune licence | écartés |
| Remotion | licence propre : gratuite jusqu'à 3 employés, payante au-delà | écarté |
| Firecrawl | AGPL-3.0 | écarté (Crawl4AI suffit) |
| SearXNG | AGPL-3.0 | autorisé seulement comme **service séparé, non modifié**, en phase 6 si nécessaire |
| Penpot | MPL-2.0 | non utilisé dans ce plan |

## 3. Règles qui encadrent tout le plan

- **L'IA crée, le code encadre.** Les outils sont des *capacités* que l'agent choisit d'appeler. Aucun gabarit, aucune
  mise en page fixée, aucun dictionnaire de mots pour comprendre une demande. Les blocs du registre HyperFrames sont
  des briques que l'agent *peut* utiliser, jamais une scène imposée.
- **Générations réelles plafonnées** : on ne lance que les 17 échantillons de l'annexe A, **une fois par phase au
  maximum**, et seulement sur demande de l'utilisateur. Tout le reste passe par `typecheck`, des agents simulés et les
  contrôles `check:*`.
- **Jamais de relecteur payant** : sélection par mesures du code, ou par un petit juge à questions fermées.
- **Surface claire** pour tout rendu ; **textes d'interface en français** ; **langue de la demande** pour les vidéos
  (règle existante) — les échantillons anglophones et lusophones (annexe A) le vérifient.
- **Les jetons de marque** (logo, couleurs, polices) restent la source de vérité.
- Chaque nouvelle capacité a un **repli** : outil absent ou en panne → le moteur génère comme aujourd'hui.
- **Toute nouvelle dépendance** passe par le registre du §2 avant d'être ajoutée (contrôle `check:licenses`, phase 2).

## 4. Mesures de réussite

| Mesure | Comment | Cible |
| --- | --- | --- |
| Taux de troncature | part des appels avec `finish_reason=length` dans `ai-trace` | confirmer < 2 % (sinon corriger ce rôle d'abord) |
| Nouveauté | distance cosinus (embedding CLIP B/32 local) entre l'idée ou le rendu et les 30 derniers de la portée | médiane ↑ de 30 % |
| Diversité entre pays | distance moyenne entre les échantillons de pays différents | ↑ de 30 % |
| Hiérarchie d'une page | un point focal dominant (mesure DOM + juge visuel) | ≥ 85 % des pages |
| Défauts mesurés | débordement, contraste < WCAG AA, chevauchements | −50 % |
| Rendu valide au 1er coup | pages et scènes affichées sans correction technique | ne doit pas baisser |
| MP4 valides (vidéo) | sur les 5 échantillons | 5/5 pour HyperFrames comme pour Motion Canvas |
| Coût par document | jetons + temps machine | ≤ +25 % |

---

## Phase 0 — Mesurer l'existant (≈ 2 j)

1. Requête sur `ai-trace` : troncatures par rôle, jetons de raisonnement, temps par étape. Un rôle qui tronque plus de
   2 % voit son plafond relevé, **ce rôle seul** (probablement `graphic.director`, 2 500).
2. Transformer les **17 échantillons de l'annexe A** en fichiers d'entrée :
   - graphique : `packages/graphic-engine/bench/samples/<livrable>-<n>.json` (contenu + marque + pays + langue) ;
   - vidéo : `packages/motion-compiler/bench/samples/video-<n>.json`.
   Chaque fichier porte une marque fictive complète (nom, couleurs, polices, logo SVG simple) pour ne dépendre d'aucun
   projet réel.
3. Script `scripts/novelty-baseline.ts` : embeddings des idées et des rendus, matrice de distances, rapport.
4. **Une seule** génération des 17 échantillons avec le moteur actuel (sur accord de l'utilisateur) : c'est la ligne de
   base. Rendus gardés hors dépôt (`~/idem-quality-runs/baseline/`).

**Livrables** : `docs/qualite-creative-baseline.md`, les 17 fichiers d'échantillons, les chiffres du §4.

---

## Phase 1 — Diverger avant d'écrire (≈ 5 j)

### 1.1 Concept en deux temps

- **Vidéo** (`director/concept.agent.ts`) : un appel produit **4 pistes courtes** (titre, métaphore, rythme, parti pris
  visuel ; 3 lignes chacune), qui doivent différer sur des axes donnés. Un second appel court en retient une, qui est
  développée comme aujourd'hui. Nouveau rôle `video.concept-explore` dans `creative-roles.ts`.
- **Graphique** (`author/prompts.ts`, `planPrompt`) : même principe pour l'idée du document. Rôle `graphic.explore`.
- Les pistes écartées restent dans la trace et nourrissent la mémoire (1.3).

### 1.2 Réflexion et modèle fort sur l'idée seulement

- `video.concept`, `video.concept-explore`, `graphic.director`, `graphic.explore` : modèle le plus haut de l'échelle
  `design`, quel que soit le cran, avec `thinking: true` et un budget de raisonnement borné. L'exécution reste sur les
  petits modèles. Réglage par `ROLE_MODEL_OVERRIDES` (`ai-models.config.ts`).
- Impact sur le prix à chiffrer **avant** de déployer (§10).

### 1.3 Mémoire d'idées élargie

- `engine.ts:193` : de 3 à 10 idées relues, et deux portées de plus : **utilisateur** et **secteur**. Ajouter
  l'empreinte `concept:` pour la vidéo (`director/brief.ts`).

### 1.4 Point de départ tiré par le code (13 pays)

- Nouveau module partagé (dans `@idem/design-tools`, phase 2) : `seed.ts`. Il tire, de façon **déterministe à partir de
  la demande et d'un sel**, un *axe de départ* : un élément culturel du pays de la marque (annexe B) **ou** une
  contrainte de composition ou de mouvement. Il décale l'idée, il n'impose aucune mise en page.
- Pays de la marque inconnu → tirage dans tout le répertoire. Un élément déjà servi à la marque n'est **jamais
  recyclé** (règle existante des illustrations africaines) : l'historique est gardé dans les empreintes.
- La consigne « avoid clichés » est remplacée par la liste concrète des idées récentes à éviter.

### 1.5 Températures par rôle

- Exploration 1.0, développement 0.4, code 0.4 à 0.7. Champ `temperature` ajouté à `CreativeRole`
  (`creative-roles.ts`), lu par `roleConfig`.

**Tests sans modèle** : agents simulés à 4 pistes ; parsing, choix, repli à une piste ; `check:roles`,
`check:video:intent`, `check:graphic`.
**Critère de sortie** : nouveauté médiane ↑ sur les 17 échantillons.

---

## Phase 2 — La boîte à outils `@idem/design-tools` (≈ 7 j)

Un seul paquet `packages/design-tools`, **entièrement en Node/TypeScript**, processeur seul. Pas de service Python,
pas de GPU (§1).

### 2.1 Outils déterministes (TypeScript)

| Outil | Bibliothèque | Ce que l'agent peut demander |
| --- | --- | --- |
| `palette` | pro-color-harmonies + culori | harmonies OKLCH dérivées des couleurs de marque (les couleurs de marque restent imposées) |
| `contrast` | culori / colorjs.io, **WCAG 2** | contraste d'un couple texte/fond et la correction minimale |
| `typePairs` | données fontjoy + Fonttrio + `foundation/fonts.ts` | paires compatibles avec les polices de marque |
| `pattern` | simplex-noise, poisson-disk-sampling, d3-delaunay, roughjs | motifs, grains, semis, tracés à la main en SVG |
| `iconSearch` | `capability-registry/local/icons.ts` (existant) | icônes par sens |
| `measureDom` | Chromium existant (`runtime/check.ts`) | hiérarchie des tailles, respiration, débordements, chevauchements, **point focal** (taille × contraste × position) |
| `seed` | — | l'axe de départ (1.4) |
| `saliency` | `sharp` + `fft.js` (résidu spectral, codé en TypeScript, environ 80 lignes) | carte d'attention de la capture : part de l'attention sur le titre, le logo, le visuel principal ; « un seul point focal ? » |
| `vectorize` | `@neplex/vectorizer` (vtracer), repli `imagetracerjs` ; puis SVGO et Paper.js (existants) | transformer une image générée en SVG propre (illustration, motif, pictogramme) |

### 2.2 Outils d'apprentissage automatique légers (Node, processeur seul)

- **Embeddings d'images et de textes** : `Xenova/clip-vit-base-patch32` quantifié (vision 89 Mo, plus le modèle de
  texte pour les idées) exécuté par `onnxruntime-web` en WebAssembly ; prétraitement (224 px, normalisation CLIP) par
  `sharp` ; tokenisation du texte par `@huggingface/tokenizers` (JavaScript pur, à vérifier) ou un tokeniseur BPE
  maison. Mesure de nouveauté et recherche d'exemples (phase 5). Le modèle est chargé une fois par processus (0,6 s),
  puis 43 à 130 ms par image (§1). SigLIP 2 base n'est essayé que si CLIP distingue mal les rendus.
  Pour les **idées** (textes), une solution plus simple est possible : un embedding de texte via l'API OpenRouter, si
  le catalogue autorisé en propose un ; à défaut, CLIP texte local.
- **Juge visuel à questions fermées** : le modèle `video-vision` existant (OpenRouter) sur la capture, 5 questions
  oui/non (texte coupé ? deux points focaux ? zone vide ? contraste faible ? logo illisible ?), ordre inversé en cas
  d'égalité comme `tiebreak.ts`. Coût : quelques centaines de jetons par capture.
- ~~**Juge visuel local (optionnel)**~~ — abandonné (décision du 05/11/2026 : juge OpenRouter seul). Était : Qwen3-VL-4B en GGUF avec llama.cpp Vulkan sur la 5500M (§1). Branché derrière la
  même interface que le juge OpenRouter ; activé seulement si `llama-bench` montre un temps acceptable (cible : moins de
  15 s par capture).
- **Illustration SVG** : l'outil `svgIllustration` demande une image à FLUX.2 (déjà branché, crans qui la paient), la
  vectorise (`vectorize`), réduit les couleurs à la palette de marque, nettoie par SVGO. Sans génération d'image (crans
  bas), le pattern-designer actuel écrit le SVG.
- Tout est appelé **dans le processus Node** de l'API ou d'iVision : pas de service à part, pas de port HTTP à protéger.
  Les modèles sont téléchargés dans un cache local (`~/.cache/idem-design-tools`).

### 2.3 Contrat commun et contrôle des licences

```ts
interface DesignTool<I, O> {
  name: string;          // 'palette', 'contrast', 'measure', 'novelty', 'svgIllustration'…
  description: string;   // lu par l'agent
  schema: ZodType<I>;    // entrée validée
  run(input: I, ctx: ToolContext): Promise<O>;
  fallback?: O;          // réponse neutre si l'outil est indisponible
}
```

- `check:licenses` : lit les licences des dépendances installées et refuse toute licence absente du §2.1, ainsi que
  `apca-w3` ; GSAP y figure en exception motivée (décision du 05/11/2026).
- `check:design-tools` : chaque outil sur des entrées fixes, sans réseau (modèle CLIP en cache, juge simulé).

**Critère de sortie** : chaque outil appelable depuis un script, entrées et sorties validées, et ces **budgets de
temps tenus sur la machine actuelle** : outils déterministes < 200 ms, `saliency` < 1 s, `vectorize` < 3 s pour une image
de 1 024 px, embedding CLIP < 1 s par image. Un outil hors budget passe en option.

---

## Phase 3 — Les outils dans l'agent et le choix par la mesure (≈ 8 j)

### 3.1 Un appel d'agent qui sait utiliser des outils

- `AgentCall` (`host.ts:14`) gagne `tools?: DesignTool[]` et `maxToolRounds?: number`. Sans eux, rien ne change.
- **À vérifier avant de coder** : le runtime d'agents (API IDEM et iVision) relaie-t-il les appels d'outils
  d'OpenRouter, et les petits modèles retenus les exécutent-ils de façon fiable ? Non vérifié à ce jour.
- **Mode par défaut : boucle orchestrée par le code.** Le code mesure après chaque essai et renvoie un retour court
  (« débordement du bloc b3 de 40 px », « deux points focaux : titre et visuel »). L'appel d'outils natif ne vient
  qu'ensuite, pour les modèles qui le gèrent bien.
- Bornes : 2 tours d'outils par page, 6 par document ; chaque appel journalisé (`observability/traces.ts`).

### 3.2 Choix par la mesure dans le moteur graphique

- L'auteur écrit **N variantes** par page (2 à Low et Medium, 3 à High et Ultra ; le cran ne change pas le prix).
  Chaque variante est rendue, mesurée (`measureDom`, contraste, nouveauté, juge visuel), et le code garde la meilleure
  avec un score transparent dont les poids sont dans un fichier lisible.
- Le moteur vidéo garde son échantillonneur ; on lui ajoute la nouveauté de la scène.

### 3.3 Correction guidée par la mesure

- Défauts mesurés → une ligne par défaut → une correction bornée à un tour. Le code ne réécrit rien lui-même.

**Critère de sortie** : défauts mesurés −50 %, coût ≤ +25 %.

---

## Phase 4 — HyperFrames comme second moteur de rendu vidéo (≈ 10 j)

**Pourquoi** : les petits modèles écrivent mal le TSX Motion Canvas, mais bien le HTML. Le moteur graphique fait déjà
écrire des pages HTML Tailwind aux couleurs de la marque. HyperFrames transforme ce même savoir-faire en vidéo, avec
un rendu déterministe (Chrome sans interface + FFmpeg) qui tourne sur la machine actuelle.

1. **Installation et essai** (1 j) : `hyperframes` 0.9.13 en dépendance d'`apps/ivision/core`, rendu d'une composition
   d'exemple en local. Vérifier que les fichiers LICENSE et NOTICE sont bien présents dans les paquets installés.
   Mesurer sur la machine : temps de rendu d'un film de 30 s en 1080p, avec `libx264` puis `h264_videotoolbox`
   (encodeur matériel du Mac). Si le rendu dépasse 5 minutes, rendre les essais en 720p et garder le 1080p pour
   l'export final.
2. **Cible de rendu** (3 j) : `apps/ivision/core/src/video/rendering/hyperframes/` à côté de `compiler.ts`, choisie par
   `IDEM_VIDEO_RENDERER=motion-canvas|hyperframes` (par défaut `motion-canvas` tant que la phase n'est pas validée).
   Le storyboard, la voix off, les médias et le calage des scènes sur la voix restent communs.
3. **Auteur de scène HTML** (3 j) : un rôle `video.html-author` écrit chaque scène en HTML et Tailwind, avec des
   attributs de temps et l'animation en **GSAP (défaut) ou Anime.js** (décision du 05/11/2026). Il réutilise la fiche de
   marque et le langage visuel du moteur graphique. `@hyperframes/lint` vérifie la composition avant le rendu ; un
   contrôle maison (`rendering/hyperframes/lint.ts`) refuse réseau, minuteurs, hasard, horloge et texte en dur.
4. **Le registre de blocs** (2 j) : les ~450 blocs HyperFrames (transitions, légendes, graphiques, cartes) sont proposés
   à l'auteur comme briques optionnelles. Les blocs GSAP sont utilisables (GSAP réintégré) ;
   un script en fait l'inventaire. Le format `frame.md` d'HyperFrames sert à traduire `design-tokens.json` pour la vidéo.
5. **Comparaison** (1 j) : les 5 échantillons vidéo rendus avec les deux moteurs (sur accord de l'utilisateur), comparés
   sur MP4 valides, défauts mesurés, nouveauté et temps de rendu. **Décision** : HyperFrames par défaut, Motion Canvas par
   défaut, ou les deux selon le type de film.

En parallèle, côté Motion Canvas : enrichir `packages/motion-compiler/src/references/library.ts` avec le rôle
`video.teacher` hors ligne, et exposer `easing`, `rhythm` (calé sur la voix), `paletteForScene` et `novelty` à
l'auteur de scène.

**Risque** : un rendu HTML image par image est plus lent que Motion Canvas sur processeur seul. À mesurer aux points 1
et 5. On évite three.js et les effets WebGL lourds pendant les tests : la puce graphique est faible et Chrome sans
interface peut basculer en rendu logiciel.

---

## Phase 5 — Bibliothèque d'exemples pour le moteur graphique (≈ 10 j)

1. **Fabrication hors ligne**, une seule fois et sur accord de l'utilisateur : un gros modèle produit des pages de
   qualité pour les natures `slide`, `visual`, `cover`, `card`. On commence par **60 pages** (pas 300 à 500) pour rester
   dans l'esprit des générations plafonnées, puis on élargit si le gain est prouvé.
2. **Tri par la mesure** (phase 2) : seules les pages qui passent hiérarchie, contraste et point focal entrent.
   Format : HTML Tailwind + intention + empreinte CLIP + métadonnées (nature, rôle de la page, énergie, pays de
   l'axe de départ).
3. **Récupération** (méthode LayoutPrompter réécrite en TypeScript) : 2 exemples proches par l'intention mais
   éloignés entre eux, avec la consigne « inspire-toi du principe, ne reproduis pas la composition ».
4. **Garde anti-copie** : distance entre la page et ses exemples ; trop proche, la variante est écartée (phase 3).
5. **Corpus de principes** : skills et grille d'autocritique d'Open Design, `DESIGN.md` d'awesome-design-md — pour en
   tirer des principes, jamais des pages ni des marques réelles.
6. Les exemples sont génériques : couleurs et polices remplacées par celles de la marque (`design-tokens.json`).

**Critère de sortie** : hiérarchie ≥ 85 % sans baisse de nouveauté. Si la nouveauté baisse, 1 seul exemple ou
exemples réservés aux crans élevés.

---

## Phase 6 — Optimisation des prompts et décodage contraint (≈ 6 j, optionnelle)

1. **GEPA** (MIT) sur `graphic.director`, `graphic.author`, `video.concept`, `video.html-author`, avec le score de la
   phase 3 comme métrique. Budget borné (`max_metric_calls`), hors production, sur les 17 échantillons, lancé par
   l'utilisateur. Les prompts gagnants sont relus avant d'entrer dans le code. Prérequis machine : Python 3.12 par
   Homebrew (`brew install python@3.12`) dans un environnement virtuel ; GEPA et DSPy sont du Python pur, les modèles
   restent sur OpenRouter. La métrique appelle le score Node par un petit script en ligne de commande.
2. **Décodage contraint** : seulement avec le juge local optionnel, par les grammaires GBNF de llama.cpp.
   XGrammar, llguidance et Outlines ne sont pas retenus (serveurs GPU).
3. **Recherche d'inspiration** (Crawl4AI, même Python 3.12 ; SearXNG en conteneur Docker séparé, non modifié) :
   seulement si les phases 1 à 5 ne suffisent pas.

## Phase 7 — Décision : représentation intermédiaire pour le graphique

Comme le moteur de logos (Logo IR compilé par le code). À n'engager que si, après les phases 1 à 5, la hiérarchie ou le
taux de rendus valides restent sous la cible.

---

## 5. Ordre et calendrier

| Ordre | Phase | Dépend de | Durée |
| --- | --- | --- | --- |
| 1 | 0 Mesurer l'existant (17 échantillons) | — | 2 j |
| 2 | 1 Diverger avant d'écrire + axes des 13 pays | 0 | 5 j |
| 3 | 2 `design-tools` (Node seul) + `check:licenses` | 0 (en partie parallèle à 1) | 7 j |
| 4 | 4 HyperFrames (peut démarrer dès la phase 0) | 0, puis 2 pour les mesures | 10 j |
| 5 | 3 Outils dans l'agent + choix par la mesure | 2 | 8 j |
| 6 | 5 Bibliothèque d'exemples graphique | 2, 3 | 10 j |
| 7 | 6 GEPA, décodage contraint | 3 | 6 j (optionnelle) |
| 8 | 7 IR graphique | 5 | décision |

Chaque phase est réversible par un interrupteur : `IDEM_QUALITY_EXPLORE`, `IDEM_QUALITY_TOOLS`,
`IDEM_QUALITY_SELECT`, `IDEM_QUALITY_EXAMPLES`, `IDEM_VIDEO_RENDERER`. Les satellites (iVision) sont déployés avant
l'API quand un contrat change (règle existante).

## 6. Fichiers touchés

| Zone | Fichiers |
| --- | --- |
| Rôles et modèles | `apps/api/api/config/creative-roles.ts`, `ai-models.config.ts`, `ai.config.ts` |
| Graphique | `packages/graphic-engine/src/{host.ts, engine.ts, author/prompts.ts, runtime/check.ts, foundation/*}` |
| Vidéo | `apps/ivision/core/src/video/{director/*, author/sampler.ts, author/tiebreak.ts, rendering/*}`, `packages/motion-compiler/src/{judge,references,solver}` |
| Nouveaux | `packages/design-tools/`, `apps/ivision/core/src/video/rendering/hyperframes/`, `packages/*/bench/samples/`, `docs/qualite-creative-baseline.md` |
| Contrôles | `check:design-tools`, `check:licenses`, `check:hyperframes`, ajouts à `check:all` |

## 7. Risques

| Risque | Parade |
| --- | --- |
| On optimise le score, pas le rendu | poids lisibles, regard humain sur les 17 échantillons à chaque phase |
| Licence mal lue (comme OmniSVG 3B/4B) | registre du §2 + `check:licenses` ; toujours vérifier la licence **du modèle de base** d'un modèle affiné |
| Clause d'usages interdits de la licence GSAP | décision assumée ; bascule immédiate vers Anime.js par `IDEM_VIDEO_ANIMATION=anime` |
| Machine sans GPU | aucun outil ne dépend d'un GPU ; budgets de temps vérifiés en phase 2 ; juge local optionnel seulement |
| Un binaire Mac Intel disparaît d'une prochaine version (déjà le cas pour onnxruntime-node ; risque pour vectorizer, sharp) | versions épinglées dans `package.json` ; repli JavaScript pur (`imagetracerjs`, juge OpenRouter) |
| Chauffe et lenteur de l'ordinateur portable | lots bornés (17 échantillons), rendus vidéo d'essai en 720p, pas de traitement en tâche de fond |
| Lenteur (variantes, rendus, vision) | parallélisme, plafonds, repli à une variante |
| Représentation maladroite d'une culture (annexe B) | relecture par une personne du pays avant la production ; on décrit des savoir-faire, jamais des objets sacrés ou rituels |
| Les modèles gèrent mal l'appel d'outils | boucle orchestrée par le code (mode par défaut) |

## 8. Hors du plan

- Relever les plafonds de tokens (sauf un rôle prouvé tronqué).
- APCA, DeepGaze, Remotion, PosterLLaVA, UI2Code_N, Chat2SVG, OmniSVG 3B/4B, prédicteurs LAION (licences, §2.2).
- OmniSVG 8B, StarVector, SigLIP 2 so400m, open_clip, tout service PyTorch, XGrammar/llguidance/Outlines (matériel, §1).
  À réexaminer quand une machine avec GPU sera choisie pour la production.
- UIGEN (licences variables, gain incertain).
- Un relecteur payant.

## 9. Ce qui reste à vérifier

- Le runtime d'agents relaie-t-il les appels d'outils d'OpenRouter ? (phase 3)
- La présence des fichiers LICENSE/NOTICE dans les paquets `@hyperframes/*` installés.
- Le temps réel de rendu HyperFrames et du juge local (llama.cpp Vulkan) sur cette machine.
- La qualité de vectorisation de `@neplex/vectorizer` (version 0.1) sur de vraies images FLUX.2 (la vitesse est
  vérifiée : 157 ms pour 1 024 px).
- La tokenisation du texte pour CLIP sans Transformers.js (`@huggingface/tokenizers` en JavaScript pur ?).

## 10. Décisions encore ouvertes (05/11/2026)

1. **Lancer la ligne de base** : `npm run sample:quality -- <dossier>` (17 échantillons, payant) — avant de comparer les
   phases. Avec `--no-export` pour économiser le rendu des MP4.
2. **Construire la bibliothèque d'exemples** : `npm run teach:examples -- <dossier> 60` (payant, cran Ultra), puis
   `build-examples.ts` (gratuit) et `IDEM_EXAMPLES_FILE`.
3. **Relecteurs par pays** (annexe B) : désigner une personne par pays.
4. **Préproduction** : construire les images Node 22 et vérifier HyperFrames dans Alpine avant la production.

### Décisions de la version 3 (tranchées le 05/11/2026)

1. **Prix** : le modèle fort sur l'idée (phase 1.2) coûte quelques milliers de tokens par document. Absorbé dans la
   marge ou facturé ?
2. **Relecture culturelle** : qui relit l'annexe B pour chaque pays ?
3. **Juge local** : l'essayer (installation de llama.cpp en Vulkan, ~3 Go de modèle) ou rester sur le juge OpenRouter ?

---

## Annexe A — Les 17 échantillons

Marques fictives. Langue = langue de la demande. Chaque pays apparaît au moins une fois.

### Vidéo (5)

| # | Pays | Langue | Demande |
| --- | --- | --- | --- |
| V1 | SEN | FR | « Une vidéo de 30 s pour lancer Thiéboudienne Express, livraison de plats maison à Dakar, commande par WhatsApp. » |
| V2 | KEN | EN | « A 20-second promo for SokoPay, a mobile-money checkout for market traders in Nairobi. Calm, trustworthy, modern. » |
| V3 | CMR | FR | « Présentez en 45 s la coopérative Café des Grassfields : café arabica de l'Ouest, du champ à la tasse, pour des acheteurs en Europe. » |
| V4 | MOZ | PT | « Um vídeo de 30 segundos para a Capulana Viva, loja online de moda em capulana em Maputo. Alegre e colorido. » |
| V5 | COD | FR | « Une vidéo explicative de 60 s pour Kinshasa Solar, kits solaires payables par mobile money : le problème, la solution, comment s'abonner. » |

### Business plan (3)

| # | Pays | Langue | Sujet |
| --- | --- | --- | --- |
| BP1 | CIV | FR | Atelier de transformation de cajou à Korhogo (financement bancaire, SYSCOHADA) |
| BP2 | RWA | EN | Agri-tech startup selling soil sensors to cooperatives in Musanze |
| BP3 | GAB | FR | Écolodge à Lopé, tourisme durable |

### Charte graphique (3)

| # | Pays | Langue | Marque |
| --- | --- | --- | --- |
| CH1 | BEN | FR | Cotonou Saveurs — épicerie fine de produits béninois |
| CH2 | UGA | EN | Kampala Bark & Co. — accessoires de mode durables |
| CH3 | COG | FR | Brazza Mode — atelier de couture sur mesure |

### Pitch deck (3)

| # | Pays | Langue | Sujet |
| --- | --- | --- | --- |
| PD1 | ZMB | EN | Lusaka logistics startup: last-mile delivery by motorbike for pharmacies |
| PD2 | SLE | EN | Freetown fintech: savings groups (osusu) digitised on USSD |
| PD3 | SEN | FR | Plateforme de formation au code pour les jeunes de Thiès |

### Carte de visite (3)

| # | Pays | Langue | Porteur |
| --- | --- | --- | --- |
| CV1 | CMR | FR | Architecte d'intérieur à Douala |
| CV2 | KEN | EN | Wildlife photographer in Nanyuki |
| CV3 | MOZ | PT | Advogada em Beira |

## Annexe B — Répertoire de départ des axes culturels (13 pays)

Point de départ à enrichir et à faire relire par une personne de chaque pays. On retient des **savoir-faire, matières,
architectures et arts du quotidien** ; pas d'objets sacrés, de rituels ni de masques de cérémonie. Chaque entrée sert
une fois par marque, puis passe à la suivante.

| Pays | Éléments de départ |
| --- | --- |
| BEN | tentures appliquées d'Abomey (aplats découpés, figures sur fond uni) ; architecture tata somba (tours de terre) |
| CIV | toiles peintes de Korhogo (trait noir sur coton écru) ; pagne baoulé tissé en bandes |
| CMR | ndop des Grassfields (indigo, motifs en réserve) ; perlage des Grassfields |
| COD | velours de raphia kuba (géométrie brisée, labyrinthes) ; peinture populaire de Kinshasa |
| COG | école de peinture de Poto-Poto (silhouettes allongées, aplats) ; la Sape (élégance, couleurs franches) |
| GAB | sculpture en pierre de Mbigou (volumes polis) ; vannerie et nattes tressées |
| KEN | kanga (bordure, motif central, proverbe écrit) ; perlage maasaï (couleurs pures, rangs concentriques) |
| MOZ | capulana (impression wax, grands motifs) ; sculpture makonde (formes enlacées) |
| RWA | imigongo (géométrie en relief, noir, blanc, ocre) ; paniers agaseke (spirales, couvercle pointu) |
| SEN | peinture sous verre (contour noir, couleurs vives) ; cars rapides peints (lettrage, ornements) |
| SLE | country cloth (bandes tissées) ; teinture gara (indigo, motifs à la cire ou noués) |
| UGA | tissu d'écorce (barkcloth, matière, teinte terre cuite) ; vannerie à motifs |
| ZMB | chitenge (impressions en bandes) ; vannerie tonga (paniers aux motifs rayonnants) |

Axes non culturels mêlés au tirage (exemples) : composition par un seul grand chiffre ; texte en bloc serré à
l'échelle de la page ; image coupée au bord ; rythme lent puis rupture ; mouvement d'un seul objet qui traverse
toutes les scènes ; palette réduite à deux couleurs de marque.

## Sources

- HyperFrames : <https://github.com/heygen-com/hyperframes> ; paquet npm `hyperframes` (Apache-2.0)
- OmniSVG : <https://github.com/OmniSVG/OmniSVG> ; poids : <https://huggingface.co/OmniSVG/OmniSVG1.1_8B>, <https://huggingface.co/OmniSVG/OmniSVG1.1_4B>
- Licence Qwen2.5-VL-3B (« Qwen RESEARCH LICENSE ») : <https://huggingface.co/Qwen/Qwen2.5-VL-3B-Instruct/blob/main/LICENSE> ; Qwen2.5-VL-7B (Apache 2.0) : <https://huggingface.co/Qwen/Qwen2.5-VL-7B-Instruct>
- MMSVG (CC BY-NC-SA 4.0) : <https://huggingface.co/datasets/OmniSVG/MMSVG-Icon>
- StarVector : <https://github.com/joanrod/star-vector>
- Licence GSAP : <https://gsap.com/community/standard-license/> ; copie ScanCode : <https://scancode-licensedb.aboutcode.org/gsap-standard-no-charge-2025.html>
- APCA (licence limitée) : <https://github.com/Myndex/apca-w3>
- DeepGaze (sans licence) : <https://github.com/matthias-k/DeepGaze>
- Remotion (licence propre) : <https://github.com/remotion-dev/remotion>
- PosterLLaVA (CC BY-NC 4.0) : <https://github.com/posterllava/PosterLLaVA>
- Open Design : <https://github.com/nexu-io/open-design> ; awesome-design-md : <https://github.com/VoltAgent/awesome-design-md>
- LayoutGeneration : <https://github.com/microsoft/LayoutGeneration>
- culori : <https://github.com/danburzo/culori> ; color.js : <https://github.com/color-js/color.js> ; harmony : <https://github.com/evilmartians/harmony>
- simplex-noise : <https://github.com/jwagner/simplex-noise.js> ; poisson-disk-sampling : <https://github.com/kchapelier/poisson-disk-sampling> ; d3-delaunay : <https://github.com/d3/d3-delaunay> ; rough : <https://github.com/rough-stuff/rough>
- CLIP : <https://github.com/openai/CLIP> ; open_clip : <https://github.com/mlfoundations/open_clip> ; SigLIP 2 : <https://huggingface.co/google/siglip2-so400m-patch14-384>
- Prédicteurs esthétiques : <https://github.com/LAION-AI/aesthetic-predictor>, <https://github.com/christophschuhmann/improved-aesthetic-predictor>
- GEPA : <https://github.com/gepa-ai/gepa> ; DSPy : <https://github.com/stanfordnlp/dspy>
- llguidance : <https://github.com/guidance-ai/llguidance> ; XGrammar : <https://github.com/mlc-ai/xgrammar> ; Outlines : <https://github.com/dottxt-ai/outlines>
- Crawl4AI : <https://github.com/unclecode/crawl4ai> ; SearXNG (AGPL) : <https://github.com/searxng/searxng> ; Firecrawl (AGPL) : <https://github.com/firecrawl/firecrawl>
- fontjoy : <https://github.com/Jack000/fontjoy> ; Fonttrio : <https://github.com/kapishdima/fonttrio>
- Anime.js, lottie-web, three.js : registre npm (MIT)
