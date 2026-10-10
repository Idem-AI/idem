# Environnement du moteur vidéo

Ce document décrit **ce qui est installé, configuré et prêt** pour produire les vidéos motion design
du module Communication, et comment l'IA s'en sert : par des choix dans des menus (crans Low à Max), ou en
écrivant elle-même chaque plan avec le kit du moteur (cran Ultra).

- Pipeline produit (crans, types, directions, musique, effets sonores, prix) : [MOTION_VIDEO.md](MOTION_VIDEO.md)
- Jauge de créativité, film d'auteur et code écrit par l'IA : [CREATIVITY.md](CREATIVITY.md)
- Graphe de capacités, généré depuis le code : [VIDEO_CAPABILITIES.md](VIDEO_CAPABILITIES.md)

## 1. Principe

Tout ce qui peut être écrit à l'avance l'est : composants, animations, bibliothèques, concepts narratifs, effets,
règles de motion design, traduction de la charte. La part laissée au modèle dépend du **cran de créativité** :

- **de Low à Max**, le modèle ne code pas la vidéo. Il fait des **choix**, dans des **menus courts** que le graphe a
  filtrés pour le projet ; le code valide chaque choix et le remplace par celui du graphe s'il est absent, faux ou
  inventé. Plus le cran monte, plus il y a de choix confiés au modèle (§14) ;
- **au cran Ultra**, le modèle invente le film et écrit le composant React de chaque plan avec le kit (§16). Le
  code ne choisit plus : il valide, rend, mesure, fait critiquer, et ne reprend un plan qu'après trois échecs.

Dans le pipeline des menus, pour chaque vidéo :

1. **La charte** (`video.artdirection.ts`) : la direction artistique devient des paramètres de motion — directions
   admises, casse des titres, rythme, stratégie de couleur, décor, bonus et interdits du graphe, rendu des images
   générées (`imagePromptModifier`). Voir §10.
2. **La direction de motion** est tirée parmi celles de la DA, différente des dernières vidéos du projet.
3. **La direction créative** (`video.storyline.ts`, un appel court, dès Medium) : le modèle choisit le **concept**
   (parmi les 5 que le graphe juge pertinents, ceux des 3 dernières vidéos exclus), **l'enchaînement** des scènes
   (parmi celles que le projet peut montrer), **le grand moment**, jusqu'à 3 **entrées** de texte (parmi celles de la
   direction) et **l'animation du logo** (parmi les 3 ou 4 que le graphe recommande). Type imposé (choix explicite,
   calendrier) : l'appel a lieu quand même et le modèle choisit **dans** ce type. Au cran Low, le graphe choisit.
   Voir §11.
4. **La copie** (`video.copy.ts`, un appel, à tous les crans) : les textes en cases `N.clé: texte`, avec les
   consignes du concept (« une question que le public se pose », « la preuve »…) et un mot d'icône par avantage.

   Puis **le moteur créatif** (`video.planner.ts`, zéro token, §17) : un motif par scène (intention → motif →
   mise en page, entrée du titre), l'ADN de mouvement, l'accent créatif et les menus des agents ; après les
   agents, le contrôle créatif et l'empreinte de la vidéo.
5. **Le kit** (`resolveKit`, déterministe) : fond, annotation, icônes, logo pendant la vidéo, ressort, effets 3D,
   addons à charger.
6. **Le compositeur** assemble une page autonome : données + runtime React + **seulement** les addons retenus +
   moteur. Puppeteer la capture image par image, ffmpeg encode.

Coût IA d'une vidéo : au cran Low, un appel (la copie) ; au cran Medium, ~950 tokens en entrée et ~250 en sortie
pour le stratège et la copie, plus le sound designer ; dès High, les agents du §14 ; au cran Ultra, le film d'auteur
(§16). Un modèle très faible, ou aucun modèle, donne une vidéo complète : chaque ligne de réponse est lue seule et
validée.

## 2. Paquets du moteur

`npm run build:video-engine` (appelé par `npm run build`) produit `public/video-engine/` :

| Paquet | Taille | Contenu | Chargé |
|---|---|---|---|
| `runtime.js` | ~190 ko | React 19 + ReactDOM, la seule copie de la page (`window.__IDEM_RT__`) | toujours |
| `engine.js` | ~185 ko | scènes, techniques de texte, transitions, mises en page, kit Tailwind, CSS compilée | toujours |
| `addon-three.js` | ~1,2 Mo | three.js + React Three Fiber v9 + drei + postprocessing | scène 3D |
| `addon-gsap.js` | ~110 ko | GSAP + DrawSVG, MorphSVG, MotionPath, CustomEase | logo « plume » |
| `addon-anime.js` | ~40 ko | anime.js v4 (timelines, stagger en grille, svg) | fond « vague » |
| `addon-flubber.js` | ~50 ko | flubber (morphose de formes) | logo « point → logo » |
| `addon-lottie.js` | ~170 ko | lottie-web light (sans moteur d'expressions) | scène Lottie |
| `addon-rive.js` | ~2,8 Mo | runtime Rive + WebAssembly embarqué | fichier .riv importé |
| `addon-chart.js` | ~280 ko | Chart.js 4 + datalabels, annotation, treemap, sankey, matrix | mise en page `chartRing` / `barCompare`, plan codé qui l'importe |
| `addon-viz.js` | ~350 ko | visx (composants de data-visualisation) + d3 (interpolate, delaunay, geo) + carte du monde | `dataArc`, fond `voronoi`, carte de l'Afrique, plan codé |
| `addon-draw.js` | ~35 ko | rough.js + perfect-freehand + simplex-noise | fonds `flow-field` / `sketch-shapes`, annotations `sketch-circle` / `brush`, plan codé |
| `addon-zdog.js` | ~30 ko | Zdog (pseudo-3D plate en SVG) | fond `flat3d`, plan codé |

Ordre dans la page : runtime → addons → moteur. Les addons importent `react` : au paquet, ces imports sont
redirigés vers le runtime (plugin `shared-react` de `video.engine.ts`), une seule instance de React existe.
En développement, les paquets se reconstruisent seuls quand une source change ; `manifest.json` donne les tailles.

## 3. Bibliothèques installées

Choisies parmi les plus utilisées de l'écosystème (Motion ~35 M de téléchargements par semaine, GSAP, anime.js,
react-spring ; sources en fin de document), **puis filtrées sur un critère** : pouvoir calculer l'image à un instant t
donné, dans n'importe quel ordre (rendu en onglets parallèles). Une bibliothèque qui anime « en temps réel » est
écartée ou réduite à ses fonctions pures.

| Bibliothèque | Version | Usage | Rendu image par image |
|---|---|---|---|
| React / ReactDOM | 19 | tout le moteur | `flushSync(render(<Video t/>))` |
| Tailwind CSS | 4 | utilitaires du kit | compilé au paquet |
| clsx + tailwind-merge | 2 / 3 | `cn()` du kit | — |
| motion (ex-Framer Motion) | 13 | ressort physique, images clés | fonctions pures (`spring`, `interpolate`) |
| GSAP + plugins | 3.15 | tracé (DrawSVG), morphose 1→1, courbes « main » | timeline en pause, `seek(t)`, horloge endormie |
| anime.js | 4 | stagger en grille, svg | `autoplay:false`, `seek(ms)`, boucle coupée |
| flubber | 0.4 | morphose 1→N, cercle → tracé | fonction pure |
| three.js + R3F + drei + postprocessing | 0.180 / 9 / 10 / 3 | 3D : modèle, cartes, logo extrudé, formes | `frameloop:'never'` + `advance(t)`, horloge posée sur t |
| lottie-web (light) | 5 | Lottie intégrées et importées (.json, .lottie) | `goToAndStop(trame)` |
| @rive-app/canvas | 2 | animations Rive importées | `scrub(animation, t)` |
| lucide-static, @tabler/icons, @phosphor-icons/core, heroicons | — | pictogrammes | SVG lus côté serveur |
| Chart.js + plugins | 4.5 | graphiques : barres, lignes, anneaux, radar, aires polaires, bulles, treemap, sankey, matrice ; étiquettes, repères | `animation:false`, `responsive:false` ; valeurs de l'instant posées puis `update('none')` |
| visx | 4 | **librairie de composants** de data-visualisation (formes, échelles, dégradés, motifs, courbes, hiérarchies, projections, axes) | rendu React en SVG, sans animation propre |
| d3-interpolate, d3-delaunay, d3-geo, topojson-client, world-atlas | 3 / 6 / 3 / 3 / 2 | interpolations, mosaïques de Voronoï, carte de l'Afrique (pays nommés dans le texte) | fonctions pures |
| rough.js | 4.6 | formes dessinées à la main | générateur à graine fixe, tracé révélé par `stroke-dashoffset` |
| perfect-freehand | 1.2 | traits de pinceau à pression | fonction pure |
| simplex-noise | 4 | bruit continu (champs de flux, mouvements organiques) | graine du moteur (`hash`), jamais `Math.random` |
| Zdog | 1.1 | objets 3D plats et ronds en SVG | rotation posée puis `updateRenderGraph()` |

Écartées, avec la raison : voir la table « Bibliothèques écartées » de [VIDEO_CAPABILITIES.md](VIDEO_CAPABILITIES.md)
(react-spring, animate() de motion, auto-animate, Remotion, Theatre.js, dotlottie-web, Vivus, Rough Notation, mo.js,
lucide-react…). Les collections à copier-coller (Magic UI, React Bits, Aceternity, Motion Primitives) ne sont pas
des paquets : leurs meilleures idées (marquee, grille de points, halo, formes, surligneur) sont **réécrites dans le
kit** en fonctions du temps, aux couleurs de la charte.

## 4. Tailwind : la charte dans les classes

`apps/ivision/core/engine/src/tailwind.css`, compilé par `buildEngineCss` à partir des classes réellement écrites dans les sources.

- **Palette par défaut retirée** (`--color-*: initial`) : `bg-blue-500` n'existe pas. Seules existent
  - les couleurs de la surface courante, qui changent à chaque scène : `bg`, `ink`, `muted`, `hl`, `hl-ink`,
    `hl-text`, `hl-soft`, `soft` ;
  - la charte, fixe : `primary`, `secondary`, `accent`, `paper`, `text`.
- **Unités relatives à l'image** : 1 pas = 1 % du petit côté (`p-4`, `size-8`, `gap-3`). Un composant est juste en
  story, carré, portrait et paysage.
- Typo : `font-display`, `font-body` (polices de la charte) ; tailles `text-caption` → `text-giant`.
- Rayons : `rounded-brand` (celui de la direction : 0 en suisse ou brutaliste, arrondi en cinétique), `rounded-pill`.
- Pas de preflight ; couches dans l'ordre `theme, engine, utilities`.
- **Garde-fou** : si une classe d'`engine.css` porte le nom d'un utilitaire Tailwind, le paquet refuse de se
  construire (cas vécu : `.list-item`, que Tailwind redéfinit en `display: list-item`).
- Classes écrites en entier dans le code (pas de `bg-${x}`), sinon Tailwind ne les voit pas.

## 5. Le kit (`apps/ivision/core/engine/src/kit/`)

| Composant | Rôle | Nœuds du graphe |
|---|---|---|
| `LogoMotion` | anime le logo vectoriel posé en ligne : `draw`, `trace`, `morph`, `assemble`, `wipe` | `logo:*` |
| `Backdrop` | fond de deux scènes au plus : `dot-grid`, `halftone`, `shape-field`, `stagger-grid`, `marquee`, `spotlight`, `ticks`, `flow-field`, `sketch-shapes`, `voronoi`, `flat3d` | `bg:*` |
| `Em` / `EmDecor` | annotation du mot mis en valeur, une scène par vidéo : `marker`, `underline`, `circle`, `sketch-circle`, `brush` | `annotate:*` |
| `Icon` | pictogramme SVG choisi par le serveur, couleur héritée | `icons:*` |
| `ChartJs` | graphique Chart.js piloté par le temps (`grow` : rise, sweep, reveal), couleurs `var(--…)` résolues, valeurs exposées dans `data-chart-values` | `layout:chartRing`, `layout:barCompare` |
| `useViz`, `DataArc`, `GrowArea`, `AfricaMap`, `VoronoiField` | visx + d3 pour l'agent codeur ; jauge, aire qui se dessine, carte de l'Afrique (seuls les pays **nommés** dans le texte s'allument), mosaïque | `layout:dataArc`, `bg:voronoi` |
| `Sketch`, `Brush`, `useNoise`, `FlowField` | croquis rough.js, pinceau, bruit simplex, lignes de flux | `bg:flow-field`, `bg:sketch-shapes`, `annotate:sketch-circle`, `annotate:brush` |
| `Flat3D` | objets Zdog (boîte, cylindre, cône, anneau, sphère…) | `bg:flat3d` |
| `numbersIn`, `percentIn`, `countriesIn` | les chiffres et les pays des TEXTES de la scène : un graphique n'en montre pas d'autres (contrôlé au rendu des plans codés) | — |
| `cn` | classes conditionnelles sans doublon | — |

Animations du logo (`LogoMotion`, sur le SVG de la charte) :

- `draw` : contours tracés (longueur réelle de chaque forme), puis remplissage ;
- `trace` : une plume suit le contour en cours (GSAP DrawSVG + CustomEase), forme après forme ;
- `morph` : un point grossit puis prend la forme exacte de chaque partie du logo (flubber `fromCircle`) ;
- `assemble` : chaque forme arrive d'une direction différente et s'emboîte (ressort si la direction rebondit) ;
- `wipe` : balayage oblique, accepte tout SVG.

En plus, côté scène : `split` (le symbole se pose, le nom glisse de derrière lui), `extrude` (logo extrudé en 3D,
type « logo »), `classic` (la signature propre à la direction).

Le SVG passe par SVGO avec une règle de sécurité (`video.logo.ts`) : scripts, `foreignObject`, animations SMIL,
attributs `on*`, liens externes retirés ; identifiants préfixés ; styles repliés en attributs. Un logo qui contient
du `<text>` (police peut-être absente) laisse la place à son symbole, et le nom est écrit par le moteur dans la
police de la charte.

Icônes (`video.icons.ts`) : 62 **concepts** (livraison, prix, paiement, qualité, sécurité…) traduits vers les quatre
bibliothèques. La bibliothèque suit la direction : Lucide (précision), Tabler (suisse), Phosphor thin / light / bold /
fill / duotone (cinématique, éditorial, brutaliste, cinétique, collage), Heroicons pleins (trempé). Le modèle propose un
concept par avantage ; un concept inconnu ou déjà pris est remplacé par le repli par mots-clés (le mot-clé le plus tôt
dans le texte l'emporte : « Qualité garantie » donne `quality`, pas `secure`).

## 6. Règles pour écrire dans le moteur

1. **Tout est fonction du temps.** Un style se calcule depuis `t` (ou `useLocalTime()`), jamais en accumulant d'une
   image à l'autre. Pas de `setTimeout`, de `requestAnimationFrame`, de CSS `transition` ni d'`animation`.
2. **Bibliothèques à timeline** (GSAP, anime.js) : timeline créée une fois dans un `useLayoutEffect`, en pause, puis
   `seek(lt)` dans un `useLayoutEffect` sans dépendances (il s'exécute dans le `flushSync` de l'image). Borner le
   `seek` à la durée de la timeline.
3. **3D** : props `t` uniquement, pas de `useFrame` avec delta, pas de Suspense (ressources chargées avant la
   première image par `loadAssets`), pas de fichier distant (lumière par `Lightformer`).
4. **`dangerouslySetInnerHTML`** : objet mémorisé (`useMemo`). React 19 réécrit `innerHTML` dès que l'objet change ;
   sans mémo, un SVG animé est remplacé à chaque image par un neuf (défaut vécu, détecté par `check:video:engine`).
5. **Anti-slop** (règles iCode, appliquées en code) : pas de capitales espacées, pas de 01/02/03, pas de filet
   latéral coloré, pas de glassmorphism, pas de décor par défaut (le fond du kit ne va que sur deux scènes de texte),
   une seule annotation par vidéo, jamais la même entrée partout.
6. **Surface claire** : aucun fond sombre par défaut ; les couleurs viennent des jetons de surface.
7. Addon absent = repli : `addon('gsap')` peut être `undefined` ; la scène se replie (ex. `trace` → `wipe`,
   `stagger-grid` calculé sans anime.js).

## 7. Ajouter une capacité

1. Installer le paquet dans `apps/api`, vérifier qu'il se pilote à un instant t (sinon : fonctions pures seulement,
   ou l'écarter et l'ajouter à `EXCLUDED_LIBRARIES`).
2. Lourd ? Créer `apps/ivision/core/engine/src/addons/<id>.ts` qui appelle `registerAddon`, ajouter `<id>` à `ADDON_IDS`
   (`video.engine.ts`) et son type à `shared.ts`.
3. Écrire le composant dans `apps/ivision/core/engine/src/kit/` (Tailwind, jetons de surface, fonction du temps).
4. Déclarer le nœud dans `video.capabilities.ts` : `requires`, `when`, `suits`, `cost`, `determinism`, `impl`.
5. Pour que les codeurs du cran Ultra s'en servent : l'exporter dans `kit-api.ts`, ajouter son nom à `KIT_NAMES` et,
   s'il dépend d'un addon, à `KIT_ADDONS` (`video.coder.ts`), puis le décrire dans `KIT_MANIFEST`.
6. `npm run check:video:engine` (ajouter le cas au rendu du kit), puis `npm run docs:video-graph`.

## 8. Contrôles

| Commande | Ce qu'elle vérifie |
|---|---|
| `npm run check:video:engine` | paquets et addons, Tailwind (charte, collisions), icônes, nettoyage du logo, graphe (arêtes, implémentations, paquets installés, routeur déterministe, choix possibles, variété, qualité, retouches), rendu de chaque animation de logo, fond, annotation et bibliothèque d'icônes, des 17 mises en page × 3 formats, de plans codés qui utilisent Chart.js, visx, la carte, les croquis et Zdog (valeurs des graphiques issues des textes) : aucune erreur, même image à l'aller et au retour, animation qui progresse. Planche : `tmp/video-engine-kit/index.html`. `--online` : un vrai fichier Rive. |
| `npm run check:video:creative` | concepts dépliés (13 × 4 durées × 6 profils de médias), modèles faibles (JSON, bavard, inventé, vide, en panne), médias de l'utilisateur garantis, variété sur 12 vidéos, budget de tokens, traduction de la charte, « Améliorer ma demande », part de vidéos du calendrier |
| `npm run check:video:variety` | 12 vidéos rendues d'une même marque (dont 6 dans la même direction) : distances d'image et de structure, bonnes pratiques |
| `npm run check:video:novelty` | le moteur créatif (§17) : motifs résolus en briques existantes, empreinte (déterminisme, symétrie, vidéos anciennes), exploration par cran, accent unique hors ADN, 10 vidéos par cran et 8 en direction imposée par le vrai pipeline (aucune à moins de 0,30 d'une précédente), contrôle créatif, mémoire d'expérience, univers et manifeste restreint d'Ultra, budgets |
| `npm run docs:video-graph` | régénère `docs/VIDEO_CAPABILITIES.md` |
| `npm run check:video` | pipeline complet (copie, médias, musique, rendu MP4) à chaque cran ; §9 bis : la même vidéo aux cinq crans, l'IA décide davantage à chaque cran ; film d'auteur simulé (directeur, codeurs, critique visuelle), plans réellement lintés, compilés et rendus |
| `npm run check:video:layouts` | chaque mise en page × chaque scène acceptée × 4 formats, textes au plus long : rien hors cadre, rien de trop large |
| `npm run check:video:types` | les 8 types de vidéo avec vrais médias et vraie musique |
| `npm run check:video:directions` | diversité des 8 directions |

## 9. API

- `GET /project/communication/:projectId/videos/options` → `kit` : les valeurs de chaque genre (logo, fond,
  annotation, icônes).
- `PATCH /project/communication/:projectId/videos/:videoId` avec `kit: { logo?, background?, annotate?, iconSet? }` :
  une valeur n'est retenue que si le graphe la permet dans le contexte de la vidéo (sinon ignorée, avec sa raison
  dans `applyKitOverrides`). Changer de direction recalcule le kit.
- Chaque vidéo garde son kit et sa trace (`storyboard.kit.trace` : nœud retenu, score, raisons, nœuds écartés).
- `capabilityCard(ctx)` : la carte compacte (~250 tokens) de ce qui est possible pour un projet, destinée à un
  modèle plus capable qui composerait une scène sur mesure.

## 10. La charte et sa direction artistique

`video.artdirection.ts` traduit la DA de la charte, sans modèle :

| Dans la charte | Dans la vidéo |
|---|---|
| style du catalogue (`styleId`) | directions **préférées** (poids) et **exclues** (`ART_EXCLUDES`) : la DA écarte ce qui trahit son esprit sans enfermer la marque dans 2-3 directions (`pickDirection`) |
| style du catalogue, « à éviter » | transitions et mises en page **exclues** (`ART_TRANSITION_EXCLUDES`, `ART_LAYOUT_EXCLUDES`, regex sur les « à éviter » : glitch, flash, « criard », 3D, promo) — jamais proposées aux agents |
| mots-clés, éléments graphiques | bonus de transitions et de mises en page (cercle → disque de marque et cercle ; rayures → lames obliques et bandeau diagonal ; grille → grille de cartes ; typo géante → pile de mots) |
| casse et interlettrage | casse des titres |
| densité, espace négatif | rythme des entrées (aéré : ×1,15 ; dense : ×0,9) |
| contraste, application des couleurs | stratégie de couleur des scènes (retenue, engagée) |
| traitement d'image (grain, papier) | décor de la direction |
| éléments graphiques, geste signature | bonus des nœuds du graphe (grille → trame de points, trame → demi-teinte, surligné → surligneur…) |
| « à éviter » | malus (pas de décor si la charte refuse l'ornement, pas de ressort si elle refuse le rebond) |
| médium d'image | découpage privilégié (3D, illustration, photo, combiné) |
| `imagePromptModifier` | rendu des images et clips générés (GLM-Image, CogVideoX-3), repris par le directeur photo |

Le logo pendant la vidéo n'est plus une pastille blanche en haut à droite : c'est un nœud du graphe
(`brandmark:none` ou `brandmark:corner`). En coin, il est monochrome (couleur du texte de la scène visible), sans
conteneur, dans le coin que les compositions occupent le moins (jamais en bas en story), masqué sur les plans plein
cadre et sur la signature.

## 11. Direction créative bornée

**Statique (code et graphe)** : 13 concepts narratifs (`video.concepts.ts` : question → réponse, problème →
solution, le produit en héros, manifeste, offre choc, la preuve d'abord, sur le terrain, teaser, invitation,
vitrine, les raisons, célébration, signature), leur dépliage en scènes selon les médias et la durée, 4 effets de
grand moment (coup de poing, titre géant, temps suspendu, bascule de couleur), les menus, la validation.

**Choisi par le modèle, dans des menus** : concept, enchaînement, grand moment, objectif si l'utilisateur ne l'a pas
dit (le stratège) ; mises en page, transitions, entrées de texte, caméra, animation du logo, musique (les autres
agents, §14).

**Garanties, quel que soit le modèle** (pipeline des menus ; le film d'auteur a les siennes, §16) :

- une ligne absente, fausse, inventée ou hors menu est remplacée par le choix du graphe (réponses en JSON, bavardes,
  en gras, avec synonymes comme « 3D » ou « video » : comprises) ;
- les médias fournis par l'utilisateur sont toujours montrés (3D, clips, photos, animation, dans la limite de la
  durée), même si le modèle les oublie ;
- les scènes du modèle ne valent que si son concept est retenu, et jamais si elles recopient une vidéo récente ;
- le contrôle anti-réflexe (`lintMotion`) repasse après les choix du modèle : pas de répétition, pas de tout-centré ;
- l'effet du grand moment vient de la direction, donc de la charte (cinéma : temps suspendu ; brutal : coup de poing).

**Variété** : concepts des 3 dernières vidéos exclus du menu, directions et kits des dernières vidéos évités, logos
récents retirés du menu du modèle, enchaînements récents refusés. Mesuré par `check:video:creative` : 12 vidéos du
même brief donnent au moins 4 concepts et 10 combinaisons distinctes, même avec un modèle qui répond toujours pareil.
La variété évite la répétition ; la **nouveauté** (moteur créatif, §17) cherche ce qui reste à explorer, et
l'empreinte mesure si deux vidéos sont réellement différentes, pas seulement si leurs identifiants diffèrent.

## 12. Créer une vidéo, calendrier éditorial

- **Créer** : deux étapes. *Décrire* : un espace de discussion (demande libre + fichiers joints), un bouton
  **Améliorer ma demande** (`POST …/videos/enhance`, gratuit : un appel court, faits gardés, chiffres inventés
  retirés par le code, gabarit sans modèle), le type choisi par IDEM (imposable, replié). *Configurer* : où publier,
  durée, qualité, ambiance sonore ; le reste replié ; récapitulatif et prix toujours visibles. À côté du bouton
  de création, le **sélecteur de créativité** (« ✦ Créativité · Medium ▾ ») ; le bouton affiche le prix du cran
  retenu. Le détail d'une vidéo dit ce que l'IA a décidé (« décidé par l'IA : textes, structure, mises en page… »,
  ou « Film d'auteur · 7 plans sur 8 créés par l'IA »).
- **Calendrier** : au moins un contenu sur trois est une vidéo sur les réseaux qui les mettent en avant
  (`video.calendar.ts`), chacune avec son **type** (proposé par le planificateur, validé, sinon déduit du contenu).
  La carte affiche le type ; « Générer la vidéo » crée **ce** type, avec le brief du contenu (accroche, angle, appel
  à l'action), au format du réseau, et rattache la vidéo au contenu (`contentId`). Le détail du contenu porte
  aussi le sélecteur de créativité.

## 13. Variété réelle et bonnes pratiques toujours appliquées

**Pourquoi les vidéos se ressemblaient** : dans une direction, toutes les vidéos avaient le même tempo, les mêmes
3-4 entrées de texte, les mêmes entrées d'éléments, la même caméra et, pour les clips, la même mise en scène
(« fond + dégradé + boîte »). La DA de la charte limitant une marque à 2-3 directions, ses vidéos se ressemblaient.

**Ce qui varie désormais, vidéo par vidéo** (graphe + mémoire du projet, sans token sauf les choix du modèle) :

| Axe | Valeurs | Choisi par |
|---|---|---|
| concept | 13 récits | modèle (menu de 5) / graphe |
| rythme | steady, crescendo, staccato, breathe, drop — courbe des durées, tempo des entrées, grille des coupes (`video.rhythm.ts`) | modèle (menu de 3) / graphe |
| entrées de texte | 6 à 8 par direction (dont springUp, wave, stretch — ressorts motion —, rotateX 3D, zoomWords, skewIn, scatter, outlineFill) ; celles de la vidéo précédente évitées | plan de mouvement (LRU) + modèle (3 au plus) |
| entrées des éléments | rise, spring, flip, unfold, skew, iris, drop, pop, slideLeft (puces, boutons, prix, rangées) | graphe |
| caméra | still, push, pull, drift, rise, tilt (3D) | graphe |
| mises en scène des plans | split, window, blinds, magazine, knockout, inline, duotone, broadcast, cinema (`treatments.tsx`) | graphe, une par plan |
| mises en page des scènes de texte | 17 archétypes + la composition de la direction (§15) | agent directeur artistique, une scène à la fois |
| transitions | catalogue de 17, filtré par la direction et la DA (§15) | agent animateur, coupe par coupe |
| musique, intensité des effets | piste parmi les 6 meilleures, discrète / normale / appuyée | agent sound designer |
| grand moment, fond, annotation, logo, icônes | voir §5, §11 | graphe / modèle |

Mesuré par `npm run check:video:variety` : même marque, même brief, 6 vidéos à la suite (parcours normal), puis
6 vidéos dans la **même direction** : distances d'image (vignettes du MP4) et de structure (enchaînement, durées,
entrées, caméra, rythme, mises en scène, fond, logo), planche `tmp/motion-variety/index.html`.

**Bonnes pratiques** (`video.rules.ts`), vérifiées et réparées sur CHAQUE vidéo, à la création et après chaque
retouche ; le rapport est gardé dans `storyboard.qa` et `check:video` exige zéro écart :

| Règle | Seuil | Réparation |
|---|---|---|
| hook-first-seconds | accroche lisible tout de suite, 1,6 à 4 s | durées |
| reading-time | ≤ 3 mots/s, entrée comprise (un nombre et son unité = un mot) | durées, puis texte secondaire retiré, puis scène la moins utile retirée, puis titre raccourci au mot |
| min-hold | texte 1,6 à 7 s, média jusqu'à 9 s | durées, scènes de texte ajoutées au plan si la vidéo est longue |
| logo-hold | ≥ 1,5 s (2,2 s dès 15 s) | durées |
| entrance-duration | 0,3 à 1,2 s | tempo de la scène |
| exit-shorter, no-linear | sortie ≈ 2/3 de l'entrée, courbes amorties | garanti par le moteur et les directions |
| one-accent | un grand moment | les autres retirés |
| call-to-action | objectif vente, événement, ouverture, produit, recrutement (≥ 15 s) | scène d'appel ajoutée au plan |
| sound-off | chaque scène porte son texte | signalé |
| cuts-on-beat | coupes sur le temps | recalées si la lecture le permet ; sinon avertissement (la lecture prime) |
| ends-on-brand | fin sur la signature | signalé |

Règles du moteur apprises en route (chacune a causé un défaut réel, détecté par les contrôles) :

- jamais de transformation 3D sur un texte posé, jamais de `will-change` sur un texte ou une scène : le calque
  serait rastérisé à une échelle qui dépend de l'historique (images différentes selon l'ordre de rendu, texte flou) ;
- un clip n'est jamais découpé (`clip-path`) ni redimensionné : une fenêtre, un partage ou une révélation se font
  par un cache de la couleur de la surface posé au-dessus (sinon image de retard au compositeur) ;
- un enfant ne déclare jamais `visibility: visible` (il passerait au-dessus des autres scènes) : `inherit` ;
- la taille d'un titre se mesure sans les transformations d'entrée ;
- un clip est posé au milieu d'une image (30 i/s), puis on attend deux images d'affichage après `seeked` ;
- les entrées lettre à lettre sont plafonnées (brouillage ≤ 0,9 s, machine à écrire ≤ 1,2 s) pour que le texte soit
  lisible avant la fin de la scène ;
- un flou n'est jamais négatif (`blur(${Math.max(0, …)})`) : avec une courbe à rebond, `1 - p` passe sous zéro, la
  valeur CSS est invalide et l'élément garde le flou de l'image précédente (rendu qui dépend de l'ordre) ;
- un conteneur flex n'étire jamais un odomètre au point de tasser ses colonnes de chiffres (`.kt-odo>*{flex:none}`) :
  l'ajustement ne voyait pas le débordement et le chiffre sortait du cadre ;
- dans un odomètre, une espace est insécable (en `inline-flex`, une espace seule disparaît : « 15 000 F » s'affichait
  « 15000F ») et chaque colonne prend la largeur de SON chiffre (le « 1 » étroit ne laisse plus de trou) ;
- une scène qui déborde de sa zone sûre réduit d'abord ses textes, puis tout son bloc (`useShrinkOverflow`, App.tsx) :
  la mesure porte sur les boîtes de TOUS les textes de chaque `.safe`, pas sur le seul premier bloc. Elle voit donc
  une colonne cercle + texte, ou des cartes dont la hauteur vient des icônes et des marges. Mesurée une fois, sans
  les transformations d'animation, elle donne la même image quel que soit l'instant ;
- en colonne, le cercle de `circleStage` occupe au plus 42 % de la hauteur du cadre (64 unités débordaient en carré) ;
- en rendu, les polices de la charte sont embarquées dans la page (`video.fonts.ts` : feuilles lues côté serveur,
  en cache, sous-ensembles latins, « vietnamese » seulement si le texte a des voyelles pointées) : une feuille Google
  Fonts qui tardait bloquait l'événement `load` et faisait échouer l'export après 60 s ;
- la bande de chiffres d'un odomètre se déplace par `top`, pas par une transformation, et chaque colonne prend sa
  largeur d'un chiffre invisible (`.kt-odo-size`) ;
- une animation ne démarre jamais pile sur un instant sondé par les contrôles : l'odomètre de la jauge `dataArc`
  partait à 0,2 s, l'instant de l'image sondée, et l'image différait selon l'ordre de rendu (écart 0,29 %). Il part
  désormais à 0,1 s ;
- un tracé SVG qui apparaît en cours de scène reste monté et passe d'une opacité nulle à pleine (`DataArc`) : retiré
  puis remis, il laissait une trace qui dépendait de l'ordre de rendu ;
- Chart.js dessine sur une toile et Zdog écrit ses couleurs en attributs : ni l'un ni l'autre ne lit le CSS. Les
  couleurs `var(--…)` sont donc résolues sur la scène avant de leur être passées (`Chart.tsx#resolveColors`,
  `Zdog.tsx#resolve`) ;
- le `<svg>` de Zdog porte `width` et `height` (100 × 100) : Zdog en tire son cadre (−50 → 50), et le CSS étire le
  dessin à la boîte.

Sources des seuils : [University of Melbourne — Video captioning style guide](https://www.unimelb.edu.au/accessibility/video-captioning/style-guide) ·
[Subtitle reading speed (CPS)](https://dev.to/ray_mac/subtitle-reading-speed-cps-the-limits-and-why-ai-subtitles-break-them-892) ·
[Material Design 3 — Easing and duration](https://m3.material.io/styles/motion/easing-and-duration/applying-easing-and-duration) ·
[LottieFiles — motion design skill](https://github.com/LottieFiles/motion-design-skill/blob/main/skills/motion-design/SKILL.md) ·
[Short-form video strategy 2026](https://www.teleprompter.com/blog/short-form-video-strategy) ·
[Hooks des 3 premières secondes](https://www.capcut.com/create/short-form-video-hooks-first-3-second-patterns).

## 14. L'équipe d'agents (`video.agents.ts`)

> Les agents s'activent selon la **jauge de créativité** choisie avant la génération (Low → Ultra) :
> le rédacteur, le directeur photo et le narrateur (voix off demandée) à tous les crans, le stratège et le sound designer dès Medium, la composition
> (directeurs artistiques, animateur, critique) dès High, les réglages bornés au cran Max. Au cran
> Ultra, ces agents cèdent la place au film d'auteur : un directeur et un codeur par plan (§16).
> Voir [CREATIVITY.md](CREATIVITY.md).

Une seule grosse tâche (« fais la vidéo ») est mal faite par un petit modèle ; une tâche étroite (« choisis la mise
en page de CETTE scène parmi ces trois ») est bien faite. La vidéo est donc partagée entre agents spécialisés,
chacun avec un prompt court, une responsabilité, et des menus que le graphe a filtrés par la direction ET la DA :

| Agent | Décide | Appels | Entrée ≈ |
|---|---|---|---|
| Stratège (`video.storyline.ts`) | objectif, concept, enchaînement, grand moment, rythme ; au cran Max, la direction créative parmi trois (§17) | 1 | 550 tokens (+ 40 en Max) |
| Rédacteur (`video.copy.ts`) | textes à l'écran, mots-clés des médias | 1 | 700 tokens |
| Directeur artistique | le **motif** de sa scène, parmi 3 à 5 que le moteur créatif a classés (§17), + mot mis en valeur ; le code résout le motif en mise en page et entrée de titre | 1 par scène de contenu, en parallèle (4 à la fois), pendant la recherche des médias | 230 tokens |
| Sound designer | la piste parmi les 6 meilleures candidates, l'intensité des effets (−4 / 0 / +3 dB) | 1, dans la recherche de musique | 220 tokens |
| Directeur photo (`video.sourcing.ts`) | un plan par média que l'utilisateur n'a pas fourni (au texte de sa scène), le look commun, le mouvement de caméra d'un clip (menu de 8), la requête de banque — à tous les crans | 1, pendant la musique | 350 tokens |
| Narrateur (`video.voice.ts`) | si la voix off est demandée : une ligne parlée par scène (mots bornés au temps de la scène), le personnage de voix (menu de 3), le jeu — à tous les crans | 1, pendant les médias | 380 tokens |
| Animateur | transition de chaque coupe, ≤ 3 entrées de titre, caméra, famille d'entrée, animation du logo | 1 | 400 tokens |
| Critique | relit le film résumé (mises en page, coupes, entrées, avertissements des règles) : ≤ 5 corrections `N.layout=` / `N.cut=` / `N.title=` | 1 | 440 tokens |

Tous reçoivent la même **fiche de marque** (`brandSheet`) : couleurs de la charte, polices, DA (style, intention,
mots-clés), « à faire », « à éviter ».

**L'étage du modèle monte avec le cran** (`motionVideo.service.ts#tierFor`, configurations dans
`AI_CONFIG.communication`). Sans cela, les agents des crans hauts tournaient sur le modèle le moins cher, et les crans
finissaient par se ressembler :

| Appel | Low | Medium | High | Max | Ultra |
|---|---|---|---|---|---|
| Rédacteur | mécanique (`video`) | rédaction (`videoWriting`) | rédaction | rédaction | — (le directeur écrit les textes) |
| Stratège | — | rédaction | rédaction | raisonnement (`videoReasoning`) | — |
| Directeur photo, narrateur | mécanique (`video`) | rédaction (`videoWriting`) | rédaction | rédaction | rédaction |
| Sound designer | — | mécanique (`videoAgents`) | rédaction | rédaction | rédaction |
| Directeurs artistiques, animateur, critique | — | — | rédaction | rédaction | — |
| Directeur du film, codeurs de plans, critique visuelle | — | — | — | — | §16 |

Les étages mécaniques sont sans raisonnement, 300 à 900 tokens de sortie ; rédaction : 1 600 (1 200 pour un agent) ;
raisonnement : 4 000, sans réflexion (elle viderait le budget). Si le directeur du film échoue au cran Ultra, la
vidéo passe par le pipeline des menus avec les étages du cran Ultra (comme Max). Garanties :

- chaque réponse est lue ligne à ligne (lettres, identifiants, JSON, gras, majuscules) et chaque choix est validé
  contre le menu de sa scène ; inventé, hors menu, répété ou hors bornes = remplacé par le choix du graphe ;
- chaque appel est retenté une fois, 1,5 s plus tard, sur panne passagère ou réponse vide
  (`communication.service.ts#runVideoTieredPrompt`) ;
- un agent toujours en panne (quota, délai de 25 s, réponse vide) ne bloque jamais : la vidéo est faite par le graphe ;
- après les agents, le code repasse : contrôle anti-réflexe (`lintMotion`), bonnes pratiques (`applyRules`), puis
  revalidation des mises en page (un texte retiré par les règles fait repasser la scène en composition classique) ;
- `storyboard.agents` garde, par agent, la source (modèle ou graphe), les tokens et le nombre de décisions retenues ;
  le flux SSE montre trois étapes de plus (mise en page, mouvement, relecture).

## 15. Mises en page et transitions

**Mises en page** (`apps/ivision/core/engine/src/layouts.tsx`, catalogue `video.layouts.ts`) : pile de mots (affiche
typographique, lignes pleines et en contour), mot géant défilant derrière le titre, chiffre géant qui remplit le
cadre (jamais rogné), bandeau diagonal, cercle de la marque (photo, chiffre ou symbole, anneau qui tourne), deux blocs de couleur,
cartes superposées qui flottent, grille de cartes (le regard passe de case en case), liste cochée (coches tracées,
fil qui les relie), grande citation, prix en étoile qui tourne, bandeaux défilants, mot sous le projecteur, bloc et
cadre décalés. Trois mises en page de **données** chargent leur addon (`LayoutDef.addon`) et ne sont proposées que si
la scène porte le chiffre qu'il faut : anneau Chart.js qui se remplit jusqu'au pourcentage, compteur au centre
(`chartRing`, scène chiffre) ; ancien et nouveau prix en deux barres Chart.js, l'économie rendue visible
(`barCompare`, scène offre, seulement si l'ancien prix dépasse le nouveau) ; jauge visx de 270° et compteur
(`dataArc`, scène chiffre). Chacune : tous formats, deux plans au moins qui dérivent en sens contraire (profondeur), du
mouvement pendant la tenue, une pulsation sur le temps de la musique (`data.beat`), ses propres sons.
Règles de film : jamais deux fois de suite la même mise en page, chaque archétype au plus une fois (deux au-delà
de neuf scènes), la composition de la direction au plus sur un tiers des scènes, celles des dernières vidéos du
projet reculent dans les menus. Clips, galeries, 3D, animations et signature gardent leurs propres compositions.

**Transitions** : un catalogue de 17 (coupe, coupe éclair, glitch, fondu, zoom flou, traversée, filé, cube 3D,
poussée, glissé, iris, volet, bandes, disque de marque, lames obliques, panneaux, vague) avec, pour chacune, son
caractère et les directions qui la portent. `transitionMenu` en tire 6 pour la vidéo : signature de la direction
(bonus), exclusions et bonus de la DA, celles des 3 dernières vidéos en recul. Dans un film, une transition sert au
plus sur un tiers des coupes, jamais deux fois de suite ; la signature s'ouvre sur une transition douce ou graphique.
Chaque transition a son son (tic, souffle, whoosh, impact). Les transitions « couvrantes » (disque, lames,
panneaux, vague) couvrent tout le cadre à l'instant exact de la coupe.

Contrôles : `check:video:engine` rend les 17 mises en page × 3 formats (déterminisme, aucun texte hors cadre,
mouvement réel) et les 7 transitions du catalogue élargi ; `check:video:layouts` rend chaque mise en page, pour chaque scène
qu'elle accepte, avec des textes à la longueur MAXIMALE de leurs cases et les icônes de production, dans les quatre
formats (le pipeline tirant sa graine au hasard, `check:video` n'essaie qu'une combinaison par passage) ; `check:video:creative` §8 éprouve les agents (réponses parfaites,
lettres seules, JSON, inventions, vides, pannes ; budgets ; menus fidèles à la DA pour toutes les directions × DA).

## 16. Les plans écrits par l'IA (cran Ultra)

Au cran Ultra, un directeur IA invente le film et un codeur IA écrit chaque plan (`video.author.ts`). Le
déroulé, les validations du directeur et la boucle de qualité sont décrits dans [CREATIVITY.md](CREATIVITY.md)
(« Le film d'auteur ») et [MOTION_VIDEO.md](MOTION_VIDEO.md). Cette section dit ce que le moteur fait d'un plan
écrit par l'IA.

**Où vit le code.** Chaque plan reste une scène du storyboard (`statement`, `cta` ou `logo`), avec ses cases de
texte, sa durée, sa surface et sa photo décidées par le directeur. Son composant est remplacé par le code du codeur,
rangé dans `scene.code.tsx` (`agent: 'shotCoder'`). Montage, aperçu, retouches et export s'en servent tels quels. Le
plan lit ses cases au rendu : une retouche de texte s'y affiche.

**Ce que le codeur reçoit.** Plus la documentation entière du moteur : le directeur a nommé un **motif** par plan
dans l'univers créatif (§17), ou une **exploration** (« explore Flat3D+FlowField ») ; le codeur ne reçoit que le
cœur du manifeste (contrat, données de la scène, couleurs, texte, mouvement, règles) et les sections des briques de
ce motif (`scopedKitManifest`) : ≈ 1 170 tokens pour un plan typographique au lieu de 1 710, à chaque tour. Sans
motif reconnu, le manifeste complet. Le lint, lui, accepte toujours tout le kit.

**Ce que le codeur peut importer** : `react` et `@idem/kit` (`apps/ivision/core/engine/src/kit-api.ts`, décrit au codeur par
`KIT_MANIFEST`) :

| Famille | Exports |
|---|---|
| temps et scène | `useScene`, `useLocalTime`, `useEngine`, `useSceneProgress`, `useExitAt`, `useExitFactor`, `useBeatPulse`, `useCamera`, `contentOf` |
| entrées et composition | `useEnter`, `useFamilyKind`, `Composition`, `ANCHOR_STYLE` |
| typographie ajustée au cadre | `Kinetic`, `Odometer`, `Headline`, `Support`, `ActionButton`, `LabelBlock`, `stackLines`, `useHeadlineSound` |
| signes et son | `Icon`, `LogoMotion`, `cue` |
| fonctions pures du temps | `clamp`, `mix`, `progress`, `hash`, `keyframes`, `springEase`, `ease`, `easeIn`, `back` |
| chiffres et pays des textes | `numbersIn`, `slotNumbers`, `percentIn`, `countriesIn` |
| graphiques et data-viz | `ChartJs`, `useViz`, `DataArc`, `GrowArea`, `AfricaMap`, `VoronoiField` |
| dessin et 3D plate | `Sketch`, `Brush`, `useNoise`, `FlowField`, `Flat3D` |

Le lint refuse un nom que le kit n'exporte pas et le nomme au codeur. Cas vécu : `ease` et `back`, que les codeurs
importaient spontanément, manquaient au kit et faisaient refuser des plans ; ils y sont désormais.

**Addons à la demande.** `addonsOfSceneCode` lit les imports du plan et charge les addons correspondants
(`KIT_ADDONS` : `ChartJs` → chart ; `useViz`, `DataArc`, `GrowArea`, `AfricaMap`, `VoronoiField` → viz ; `Sketch`,
`Brush`, `useNoise`, `FlowField` → draw ; `Flat3D` → zdog). Une vidéo sans graphique ne charge pas Chart.js.

**Exécution.** Le code est linté (acorn), compilé par esbuild de TSX vers CommonJS, puis évalué dans la page avec un
`require` limité au kit et à React. Un plan qui lève une erreur au rendu retombe sur la composition de sa scène
(`SceneBoundary`). Sécurité (CSP, garde réseau, iframe isolée) : [CREATIVITY.md](CREATIVITY.md).

**Le contrôle mesuré** (`video.coder.ts#inspectRenderedScene`). Le plan contrôlé passe seul en code, les autres
gardent leur composition. La page réelle est rendue avec le garde réseau strict, à trois instants : début (+0,12 s),
45 % de la durée, fin (−0,55 s). Sont refusés :

- une erreur d'exécution, ou un composant qui ne s'affiche pas ;
- un texte des cases invisible à la fin du plan, ou hors du cadre ;
- un graphique qui montre un nombre absent des textes (valeurs de `data-chart-values`, le reste d'un pourcentage
  `100 − k` étant admis) ;
- un plan immobile (première et dernière images identiques) ;
- une image qui dépend de l'ordre de rendu (plus de 0,2 % de pixels d'écart quand on revient en arrière).

Un plan qui passe ces contrôles est jugé sur ses trois images, assemblées en planche (`contactSheet`, 360 px de
haut), par le modèle de vision, sauf au dernier tour. Chaque refus et chaque critique reviennent au codeur, avec son
code, pour le tour suivant ; la critique reste un conseil, le dernier code qui a passé les contrôles est gardé.

**Ce que le moteur ne fait plus en Ultra.** Le kit ne pose ni fond ni annotation et n'attribue pas d'icônes :
l'IA dessine les siens. Il garde l'animation du logo pour le repli de la signature. Les plans s'enchaînent par une
coupe franche : chaque plan fait lui-même l'entrée et la sortie imaginées par le directeur. Le minutage du directeur
n'est ni recalé sur la musique ni réparé par les règles de §13.

## 17. Le moteur créatif

La variété évitait la répétition ; elle ne produisait pas de **nouveauté**. Deux vidéos aux choix tous « différents »
(Editorial · question · pile de mots · masque montant · fondu, puis Swiss · preuve · deux blocs · resserrement ·
poussée) donnaient encore le même film : gros texte → entrée → élément central → transition → gros texte → appel.
Le moteur créatif transforme l'espace des capacités en espace de **possibilités**, que chaque cran explore avec le
niveau de modèle qui lui revient. Rien de ce qui suit n'appelle un modèle.

**La couche des motifs** (`video.patterns.ts`, 67 motifs, table générée dans [VIDEO_CAPABILITIES.md](VIDEO_CAPABILITIES.md)) :
intention (croissance, preuve, question, urgence, lieu…) → capacité (compteur, graphique, carte, croquis, 3D plate…)
→ motif (« le compteur qui accélère », « l'anneau qui se remplit », « la carte qui s'allume ») → outil (nœuds du graphe)
→ primitive (briques du kit). Un motif a une famille (typographie, données, graphique, dessiné, spatial, photo,
marque), un rôle (scène, surcouche, lu sur le kit, Ultra seulement) et un statut : **éprouvé**, ou **expérimental**
(marqué tel, ou porté par une direction qui l'emploie peu : affinité < 1,5). La mémoire globale « diplôme » une
combinaison expérimentale qui a réussi 15 fois dans une direction.

**Trois mémoires** : projet (empreintes des 10 dernières vidéos), globale (`video.experience.ts`, MongoDB
`video_experience`, compteurs `$inc` : retenu, réparé, replié, critique, exporté), session (ce que le film a déjà
utilisé).

**Le score créatif** d'un motif sur une scène : 0,35 × pertinence (son intention) + 0,25 × qualité (a priori +
expérience, ±0,25) + 0,20 × nouveauté (sous-exploré dans le projet) + 0,10 × fidélité (direction, DA) + 0,10 ×
faisabilité (coût de rendu), plus le bonus d'exploration, moins les répétitions dans le film. Tirage déterministe
parmi les motifs à moins de 0,05 du meilleur. Le routeur du kit (§9) reçoit les mêmes signaux : nouveauté (+0,6 au
plus), expérience (±0,4, taux d'export), exploration du cran.

**L'exploration, par le graphe et non par des tokens** : part des scènes qui portent une combinaison peu courante,
Low 5 % · Medium 15 % · High 25 % · Max 40 % · Ultra 70 %. Le planificateur choisit les scènes où l'exploration coûte
le moins (jamais plus de 0,2 de score perdu) ; mesuré : 3 % · 21 % · 23 % · 36 % · 43 % dans les menus (plafonné par les
combinaisons compatibles disponibles), le directeur d'Ultra explorant lui-même avec ce budget.

**L'ADN et l'accent.** Le planificateur propose trois directions créatives (signature, contraste, exploration) : une
ou deux familles que le film garde partout (l'ADN, avec la direction et le rythme) et la famille de l'**accent** — une
seule scène, ni l'ouverture ni la signature, 25 % du film au plus, qui casse l'ADN exprès : Swiss, grille et coupes
nettes… et, scène 4, une annotation au crayon. L'accent est un motif de scène d'une autre famille, ou une surcouche
(fond, annotation sur la composition de la direction, traversée) ; en Low et Medium il reste éprouvé. Au cran Max, le
stratège choisit la direction créative (une ligne de plus, ≈ 40 tokens) ; en dessous, le planificateur.

**Les menus des agents** : au cran High, le directeur artistique d'une scène choisit parmi 3 à 5 **motifs** (le choix
du graphe d'abord, une option sobre comprise) au lieu de 4 mises en page ; un motif déjà servi dans le film n'est pas
repris même si l'agent le choisit. En dessous de High, le motif du planificateur décide : **Low = créativité
algorithmique**, pas vidéo basique.

**L'empreinte** (`video.fingerprint.ts`) : récit, concept, motifs, mises en page, entrées, coupes, composition,
direction, outils, caméra, entrées des éléments, tempo, densité, contraste, kit, surfaces ; distance pondérée de 0 à 1
(< 0,30 trop proche, > 0,55 réellement différente). Elle se calcule sur toute vidéo, y compris celles créées avant elle.

**Le contrôle créatif** (`video.creativeLint.ts`), après l'anti-réflexe et les bonnes pratiques : récit identique à
une vidéo récente, même composition sur trois scènes, une entrée sur plus de la moitié des scènes, une coupe sur plus
d'un tiers des coupes, motifs répétés, un seul vocabulaire d'outils, tempo uniforme, courbe d'attention (accroche
molle, plateau, coupe douce avant le grand moment), accent ; et l'empreinte trop proche (< 0,30) de la vidéo la plus
proche : coupes, entrées, caméra, mises en page sont changées dans les menus de la direction et de la DA, **jusqu'au
seuil, pas au-delà** (la créativité n'est pas la distance maximale). En Ultra, il signale sans réparer.

**Cran Ultra** : le directeur reçoit l'**univers créatif** (≈ 260 tokens : motifs par famille, ceux de la marque
récemment, les sous-explorés, des combinaisons compatibles à explorer, l'ADN, l'accent, le budget d'exploration) au
lieu de la liste des outils, et nomme un motif par plan (`PATTERN:`), ou une exploration (`PATTERN: explore A+B`,
chaque brique validée contre le kit) ; sinon le motif est lu dans sa consigne visuelle. Un plan qui explore passe une
validation renforcée : un tour de plus (4 au plus) et la critique visuelle relit aussi le dernier tour. Chaque plan,
son motif, ses tours, son repli et sa critique alimentent la mémoire globale.

**Le rapport** (`storyboard.creative`) : exploration (budget, scènes expérimentales), ADN, direction créative et qui
l'a choisie, accent, intention (récit, stratégie visuelle et de mouvement, surprise), empreinte, nouveauté (écart à la
vidéo la plus proche, verdict), contrôle (écarts, réparations). Le détail d'une vidéo dans le tableau de bord affiche
l'écart et la touche inattendue. Une retouche recalcule l'empreinte ; le premier export inscrit le signal de
l'utilisateur dans la mémoire globale.

Mesuré par `npm run check:video:novelty` (vrai pipeline, agents simulés, même marque, même brief) : écart minimal à la
vidéo la plus proche ≥ 0,30 à chaque cran, écart moyen ≈ 0,6 entre deux vidéos ; ≈ 0,43 dans le cas le plus dur
(8 vidéos dans la direction imposée « swiss »).

## Sources

- [Chart.js](https://www.chartjs.org/docs/latest/) · [visx](https://airbnb.io/visx/) · [d3-geo](https://d3js.org/d3-geo) · [rough.js](https://roughjs.com/) · [perfect-freehand](https://github.com/steveruizok/perfect-freehand) · [simplex-noise](https://github.com/jwagner/simplex-noise.js) · [Zdog](https://zzz.dog/)
- [LogRocket — Comparing the best React animation libraries for 2026](https://blog.logrocket.com/best-react-animation-libraries/)
- [PkgPulse — Best React Animation Libraries in 2026](https://www.pkgpulse.com/guides/best-react-animation-libraries-2026)
- [GSAP 3.13 — tous les plugins gratuits](https://gsap.com/blog/3-13/) · [Webflow : GSAP 100 % gratuit](https://webflow.com/blog/gsap-becomes-free)
- [anime.js v4 — SVG (createDrawable, morphTo, createMotionPath)](https://animejs.com/documentation/svg) · [Release v4.0.0](https://github.com/juliangarnier/anime/releases/tag/v4.0.0)
- [React Three Fiber — Canvas (`frameloop`)](https://r3f.docs.pmnd.rs/api/canvas) · [Hooks](https://r3f.docs.pmnd.rs/api/hooks) · [Prendre la main sur la boucle de rendu](https://github.com/pmndrs/react-three-fiber/discussions/1339)
- [PkgPulse — Lucide vs Heroicons vs Phosphor 2026](https://www.pkgpulse.com/guides/lucide-vs-heroicons-vs-phosphor-react-icon-libraries-2026) · [OpenReplay — SVG icon libraries](https://blog.openreplay.com/svg-icon-libraries-web-apps/)
- [PkgPulse — react-bits vs Aceternity vs Magic UI 2026](https://www.pkgpulse.com/guides/react-bits-vs-aceternity-magic-ui-2026) · [Magic UI alternatives](https://designrevision.com/alternatives/magic-ui)
