# Environnement du moteur vidéo

Ce document décrit **ce qui est installé, configuré et prêt** pour produire les vidéos motion design
du module Communication, et comment l'IA s'en sert sans écrire de code.

- Pipeline produit (types, directions, musique, effets sonores, prix) : [MOTION_VIDEO.md](MOTION_VIDEO.md)
- Graphe de capacités, généré depuis le code : [VIDEO_CAPABILITIES.md](VIDEO_CAPABILITIES.md)

## 1. Principe

Le modèle de langage ne code jamais la vidéo. Tout ce qui peut être écrit à l'avance l'est : composants,
animations, bibliothèques, concepts narratifs, effets, règles de motion design, traduction de la charte. Le modèle
ne fait que des **choix**, dans des **menus courts** que le graphe a filtrés pour le projet ; le code valide chaque
choix et le remplace par celui du graphe s'il est absent, faux ou inventé. Pour chaque vidéo :

1. **La charte** (`video.artdirection.ts`) : la direction artistique devient des paramètres de motion — directions
   admises, casse des titres, rythme, stratégie de couleur, décor, bonus et interdits du graphe, rendu des images
   générées (`imagePromptModifier`). Voir §10.
2. **La direction de motion** est tirée parmi celles de la DA, différente des dernières vidéos du projet.
3. **La direction créative** (`video.storyline.ts`, un appel court) : le modèle choisit le **concept** (parmi les 5
   que le graphe juge pertinents, ceux des 3 dernières vidéos exclus), **l'enchaînement** des scènes (parmi celles
   que le projet peut montrer), **le grand moment**, jusqu'à 3 **entrées** de texte (parmi celles de la direction)
   et **l'animation du logo** (parmi les 3 ou 4 que le graphe recommande). Type imposé (calendrier) : aucun appel, le
   graphe choisit. Voir §11.
4. **La copie** (`video.copy.ts`, un appel) : les textes en cases `N.clé: texte`, avec les consignes du concept
   (« une question que le public se pose », « la preuve »…) et un mot d'icône par avantage.
5. **Le kit** (`resolveKit`, déterministe) : fond, annotation, icônes, logo pendant la vidéo, ressort, effets 3D,
   addons à charger.
6. **Le compositeur** assemble une page autonome : données + runtime React + **seulement** les addons retenus +
   moteur. Puppeteer la capture image par image, ffmpeg encode.

Coût IA d'une vidéo : ~950 tokens en entrée et ~250 en sortie (deux appels) ; ~600 avec un type imposé. Un modèle
très faible, ou aucun modèle, donne une vidéo complète : chaque ligne de réponse est lue seule et validée.

## 2. Paquets du moteur

`npm run build:video-engine` (appelé par `npm run build`) produit `public/video-engine/` :

| Paquet | Taille | Contenu | Chargé |
|---|---|---|---|
| `runtime.js` | ~190 ko | React 19 + ReactDOM, la seule copie de la page (`window.__IDEM_RT__`) | toujours |
| `engine.js` | ~110 ko | scènes, techniques de texte, transitions, kit Tailwind, CSS compilée | toujours |
| `addon-three.js` | ~1 Mo | three.js + React Three Fiber v9 + drei + postprocessing | scène 3D |
| `addon-gsap.js` | ~110 ko | GSAP + DrawSVG, MorphSVG, MotionPath, CustomEase | logo « plume » |
| `addon-anime.js` | ~40 ko | anime.js v4 (timelines, stagger en grille, svg) | fond « vague » |
| `addon-flubber.js` | ~50 ko | flubber (morphose de formes) | logo « point → logo » |
| `addon-lottie.js` | ~170 ko | lottie-web light (sans moteur d'expressions) | scène Lottie |
| `addon-rive.js` | ~2,8 Mo | runtime Rive + WebAssembly embarqué | fichier .riv importé |

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

Écartées, avec la raison : voir la table « Bibliothèques écartées » de [VIDEO_CAPABILITIES.md](VIDEO_CAPABILITIES.md)
(react-spring, animate() de motion, auto-animate, Remotion, Theatre.js, dotlottie-web, Vivus, Rough Notation, mo.js,
lucide-react…). Les collections à copier-coller (Magic UI, React Bits, Aceternity, Motion Primitives) ne sont pas
des paquets : leurs meilleures idées (marquee, grille de points, halo, formes, surligneur) sont **réécrites dans le
kit** en fonctions du temps, aux couleurs de la charte.

## 4. Tailwind : la charte dans les classes

`video-engine/src/tailwind.css`, compilé par `buildEngineCss` à partir des classes réellement écrites dans les sources.

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

## 5. Le kit (`video-engine/src/kit/`)

| Composant | Rôle | Nœuds du graphe |
|---|---|---|
| `LogoMotion` | anime le logo vectoriel posé en ligne : `draw`, `trace`, `morph`, `assemble`, `wipe` | `logo:*` |
| `Backdrop` | fond de deux scènes au plus : `dot-grid`, `halftone`, `shape-field`, `stagger-grid`, `marquee`, `spotlight`, `ticks` | `bg:*` |
| `Em` / `EmDecor` | annotation du mot mis en valeur, une scène par vidéo : `marker`, `underline`, `circle` | `annotate:*` |
| `Icon` | pictogramme SVG choisi par le serveur, couleur héritée | `icons:*` |
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
2. Lourd ? Créer `video-engine/src/addons/<id>.ts` qui appelle `registerAddon`, ajouter `<id>` à `ADDON_IDS`
   (`video.engine.ts`) et son type à `shared.ts`.
3. Écrire le composant dans `video-engine/src/kit/` (Tailwind, jetons de surface, fonction du temps).
4. Déclarer le nœud dans `video.capabilities.ts` : `requires`, `when`, `suits`, `cost`, `determinism`, `impl`.
5. `npm run check:video:engine` (ajouter le cas au rendu du kit), puis `npm run docs:video-graph`.

## 8. Contrôles

| Commande | Ce qu'elle vérifie |
|---|---|
| `npm run check:video:engine` | paquets et addons, Tailwind (charte, collisions), icônes, nettoyage du logo, graphe (arêtes, implémentations, paquets installés, routeur déterministe, choix possibles, variété, qualité, retouches), rendu de chaque animation de logo, fond, annotation et bibliothèque d'icônes : aucune erreur, même image à l'aller et au retour, animation qui progresse. Planche : `tmp/video-engine-kit/index.html`. `--online` : un vrai fichier Rive. |
| `npm run check:video:creative` | concepts dépliés (13 × 4 durées × 6 profils de médias), modèles faibles (JSON, bavard, inventé, vide, en panne), médias de l'utilisateur garantis, variété sur 12 vidéos, budget de tokens, traduction de la charte, « Améliorer ma demande », part de vidéos du calendrier |
| `npm run docs:video-graph` | régénère `docs/VIDEO_CAPABILITIES.md` |
| `npm run check:video` | pipeline complet (copie, médias, musique, rendu MP4) |
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
| style du catalogue (`styleId`) | directions de motion admises — la DA l'emporte sur le type (`pickDirection`) |
| casse et interlettrage | casse des titres |
| densité, espace négatif | rythme des entrées (aéré : ×1,15 ; dense : ×0,9) |
| contraste, application des couleurs | stratégie de couleur des scènes (retenue, engagée) |
| traitement d'image (grain, papier) | décor de la direction |
| éléments graphiques, geste signature | bonus des nœuds du graphe (grille → trame de points, trame → demi-teinte, surligné → surligneur…) |
| « à éviter » | malus (pas de décor si la charte refuse l'ornement, pas de ressort si elle refuse le rebond) |
| médium d'image | découpage privilégié (3D, illustration, photo, combiné) |
| `imagePromptModifier` | rendu des images et clips générés (Gemini, Veo) |

Le logo pendant la vidéo n'est plus une pastille blanche en haut à droite : c'est un nœud du graphe
(`brandmark:none` ou `brandmark:corner`). En coin, il est monochrome (couleur du texte de la scène visible), sans
conteneur, dans le coin que les compositions occupent le moins (jamais en bas en story), masqué sur les plans plein
cadre et sur la signature.

## 11. Direction créative bornée

**Statique (code et graphe)** : 13 concepts narratifs (`video.concepts.ts` : question → réponse, problème →
solution, le produit en héros, manifeste, offre choc, la preuve d'abord, sur le terrain, teaser, invitation,
vitrine, les raisons, célébration, signature), leur dépliage en scènes selon les médias et la durée, 4 effets de
grand moment (coup de poing, titre géant, temps suspendu, bascule de couleur), les menus, la validation.

**Choisi par le modèle, dans des menus** : concept, enchaînement, grand moment, entrées de texte, animation du logo,
objectif si l'utilisateur ne l'a pas dit.

**Garanties, quel que soit le modèle** :

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

## 12. Créer une vidéo, calendrier éditorial

- **Créer** : deux étapes. *Décrire* : un espace de discussion (demande libre + fichiers joints), un bouton
  **Améliorer ma demande** (`POST …/videos/enhance`, gratuit : un appel court, faits gardés, chiffres inventés
  retirés par le code, gabarit sans modèle), le type choisi par IDEM (imposable, replié). *Configurer* : où publier,
  durée, qualité, ambiance sonore ; le reste replié ; récapitulatif et prix toujours visibles.
- **Calendrier** : au moins un contenu sur trois est une vidéo sur les réseaux qui les mettent en avant
  (`video.calendar.ts`), chacune avec son **type** (proposé par le planificateur, validé, sinon déduit du contenu).
  La carte affiche le type ; « Générer la vidéo » crée **ce** type, avec le brief du contenu (accroche, angle, appel
  à l'action), au format du réseau, et rattache la vidéo au contenu (`contentId`).

## Sources

- [LogRocket — Comparing the best React animation libraries for 2026](https://blog.logrocket.com/best-react-animation-libraries/)
- [PkgPulse — Best React Animation Libraries in 2026](https://www.pkgpulse.com/guides/best-react-animation-libraries-2026)
- [GSAP 3.13 — tous les plugins gratuits](https://gsap.com/blog/3-13/) · [Webflow : GSAP 100 % gratuit](https://webflow.com/blog/gsap-becomes-free)
- [anime.js v4 — SVG (createDrawable, morphTo, createMotionPath)](https://animejs.com/documentation/svg) · [Release v4.0.0](https://github.com/juliangarnier/anime/releases/tag/v4.0.0)
- [React Three Fiber — Canvas (`frameloop`)](https://r3f.docs.pmnd.rs/api/canvas) · [Hooks](https://r3f.docs.pmnd.rs/api/hooks) · [Prendre la main sur la boucle de rendu](https://github.com/pmndrs/react-three-fiber/discussions/1339)
- [PkgPulse — Lucide vs Heroicons vs Phosphor 2026](https://www.pkgpulse.com/guides/lucide-vs-heroicons-vs-phosphor-react-icon-libraries-2026) · [OpenReplay — SVG icon libraries](https://blog.openreplay.com/svg-icon-libraries-web-apps/)
- [PkgPulse — react-bits vs Aceternity vs Magic UI 2026](https://www.pkgpulse.com/guides/react-bits-vs-aceternity-magic-ui-2026) · [Magic UI alternatives](https://designrevision.com/alternatives/magic-ui)
