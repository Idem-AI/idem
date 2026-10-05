# Graphe de capacités du moteur vidéo

> Fichier généré par `npm run docs:video-graph` depuis `api/services/Communication/video/video.capabilities.ts`.
> Ne pas éditer à la main. Guide de l'environnement : [VIDEO_ENGINE.md](VIDEO_ENGINE.md).

Le graphe dit ce que la vidéo **peut** utiliser et **quand**. Le routeur (`resolveKit`) le parcourt avec le contexte du projet
(type, objectif, direction de motion, direction artistique, logo vectoriel analysé, médias, format, qualité, secteur, vidéos
précédentes) et rend un kit validé, les addons à charger et le vocabulaire court laissé au modèle.

Score d'un nœud possible = 1 + 1,5 × affinité de direction + type + objectif + DA + secteurs − 0,4 × coût (si coût ≥ 2)
− 1,5 s'il a servi dans les deux dernières vidéos du projet. Tirage déterministe (graine de la vidéo) parmi les nœuds à moins
de 0,75 du meilleur.

## Arêtes « exige »

```mermaid
graph LR
  addon_three["addon:three"]
  lib_three["lib:three"]
  addon_three --> lib_three
  addon_gsap["addon:gsap"]
  lib_gsap["lib:gsap"]
  addon_gsap --> lib_gsap
  addon_anime["addon:anime"]
  lib_anime["lib:anime"]
  addon_anime --> lib_anime
  addon_flubber["addon:flubber"]
  lib_flubber["lib:flubber"]
  addon_flubber --> lib_flubber
  addon_lottie["addon:lottie"]
  lib_lottie["lib:lottie"]
  addon_lottie --> lib_lottie
  addon_rive["addon:rive"]
  lib_rive["lib:rive"]
  addon_rive --> lib_rive
  logo_trace["logo:trace"]
  logo_trace --> addon_gsap
  logo_morph["logo:morph"]
  logo_morph --> addon_flubber
  logo_extrude["logo:extrude"]
  logo_extrude --> addon_three
  bg_stagger_grid["bg:stagger-grid"]
  bg_stagger_grid --> addon_anime
  icons_lucide["icons:lucide"]
  lib_lucide["lib:lucide"]
  icons_lucide --> lib_lucide
  icons_tabler["icons:tabler"]
  lib_tabler["lib:tabler"]
  icons_tabler --> lib_tabler
  icons_phosphor_thin["icons:phosphor-thin"]
  lib_phosphor["lib:phosphor"]
  icons_phosphor_thin --> lib_phosphor
  icons_phosphor_light["icons:phosphor-light"]
  icons_phosphor_light --> lib_phosphor
  icons_phosphor_bold["icons:phosphor-bold"]
  icons_phosphor_bold --> lib_phosphor
  icons_phosphor_fill["icons:phosphor-fill"]
  icons_phosphor_fill --> lib_phosphor
  icons_phosphor_duotone["icons:phosphor-duotone"]
  icons_phosphor_duotone --> lib_phosphor
  icons_heroicons_solid["icons:heroicons-solid"]
  lib_heroicons["lib:heroicons"]
  icons_heroicons_solid --> lib_heroicons
  easing_spring["easing:spring"]
  lib_motion["lib:motion"]
  easing_spring --> lib_motion
  postfx_bloom["postfx:bloom"]
  postfx_bloom --> addon_three
  postfx_smaa["postfx:smaa"]
  postfx_smaa --> addon_three
  media_lottie["media:lottie"]
  media_lottie --> addon_lottie
  media_rive["media:rive"]
  media_rive --> addon_rive
  media_model3d["media:model3d"]
  media_model3d --> addon_three
  media_cards3d["media:cards3d"]
  media_cards3d --> addon_three
```

## Bibliothèques installées

| Nœud | Nom | Rôle | Exige | Condition | Convient à | Coût | Rendu | Implémentation |
|---|---|---|---|---|---|---|---|---|
| `lib:react` | React 19 + ReactDOM | Le moteur entier : une image = un rendu synchrone (flushSync) de <Video t={t}/>. | — | — | — | 0 | pure | `video-engine/src/runtime.ts` |
| `lib:tailwind` | Tailwind CSS v4 | Utilitaires compilés au paquet ; palette par défaut retirée, seules les couleurs de la charte existent. | — | — | — | 0 | static | `video-engine/src/tailwind.css` |
| `lib:motion` | Motion (ex-Framer Motion) | Ressorts physiques et interpolation par images clés, fonctions pures du temps (pas animate()). | — | — | — | 0 | pure | `video-engine/src/time.ts` |
| `lib:gsap` | GSAP 3 + DrawSVG, MorphSVG, MotionPath, CustomEase | Timelines en pause posées par seek(t) ; horloge endormie. | — | — | — | 1 | seek | `video-engine/src/addons/gsap.ts` |
| `lib:anime` | anime.js v4 | Timelines autoplay:false posées par seek(ms) ; stagger en grille. | — | — | — | 1 | seek | `video-engine/src/addons/anime.ts` |
| `lib:flubber` | flubber | Morphose de formes SVG (1→1, 1→N, cercle→tracé), fonction pure. | — | — | — | 1 | pure | `video-engine/src/addons/flubber.ts` |
| `lib:three` | three.js + React Three Fiber v9 + drei + postprocessing | Racine R3F frameloop "never", advance(t) par image, horloge posée sur t, lumière Lightformer sans fichier. | — | — | — | 3 | clock-pinned | `video-engine/src/addons/three.tsx` |
| `lib:lottie` | lottie-web (light) | Rendu SVG sans moteur d’expressions (aucun code d’un fichier importé ne s’exécute) ; goToAndStop(trame). | — | — | — | 1 | seek | `video-engine/src/addons/lottie.ts` |
| `lib:rive` | Rive (canvas) | Fichiers .riv importés ; WebAssembly embarqué ; scrub(animation, t). | — | — | — | 2 | seek | `video-engine/src/addons/rive.ts` |
| `lib:lucide` | Lucide | ~2 100 icônes au trait ; SVG lus côté serveur, jamais embarqués en bloc. | — | — | — | 0 | static | `api/services/Communication/video/video.icons.ts` |
| `lib:tabler` | Tabler Icons | ~5 100 icônes au trait géométrique. | — | — | — | 0 | static | `api/services/Communication/video/video.icons.ts` |
| `lib:phosphor` | Phosphor Icons | ~1 500 icônes × 6 graisses (thin, light, regular, bold, fill, duotone). | — | — | — | 0 | static | `api/services/Communication/video/video.icons.ts` |
| `lib:heroicons` | Heroicons | ~320 icônes pleines et denses. | — | — | — | 0 | static | `api/services/Communication/video/video.icons.ts` |

## Addons du moteur (paquets chargés à la demande)

| Nœud | Nom | Rôle | Exige | Condition | Convient à | Coût | Rendu | Implémentation |
|---|---|---|---|---|---|---|---|---|
| `addon:three` | addon-three.js | Paquet du moteur chargé seulement si un nœud retenu l'exige. | `lib:three` | — | — | 3 | clock-pinned | `public/video-engine/addon-three.js` |
| `addon:gsap` | addon-gsap.js | Paquet du moteur chargé seulement si un nœud retenu l'exige. | `lib:gsap` | — | — | 1 | seek | `public/video-engine/addon-gsap.js` |
| `addon:anime` | addon-anime.js | Paquet du moteur chargé seulement si un nœud retenu l'exige. | `lib:anime` | — | — | 1 | seek | `public/video-engine/addon-anime.js` |
| `addon:flubber` | addon-flubber.js | Paquet du moteur chargé seulement si un nœud retenu l'exige. | `lib:flubber` | — | — | 1 | pure | `public/video-engine/addon-flubber.js` |
| `addon:lottie` | addon-lottie.js | Paquet du moteur chargé seulement si un nœud retenu l'exige. | `lib:lottie` | — | — | 1 | seek | `public/video-engine/addon-lottie.js` |
| `addon:rive` | addon-rive.js | Paquet du moteur chargé seulement si un nœud retenu l'exige. | `lib:rive` | — | — | 2 | seek | `public/video-engine/addon-rive.js` |

## Concepts narratifs (le modèle en choisit un, parmi les 5 que le graphe propose)

| Nœud | Nom | Rôle | Exige | Condition | Convient à | Coût | Rendu | Implémentation |
|---|---|---|---|---|---|---|---|---|
| `concept:question` | question | ask the audience's own question, then answer it | — | — | dir. editorial 1, swiss 1, precision 1 · types kinetic 1.5, product 1, illustrated 1, mix 1 · obj. announce 1.5, product 1, recruitment 1, testimonial 0.5 | 0 | static | `api/services/Communication/video/video.concepts.ts` |
| `concept:problem-solution` | problem-solution | name an everyday problem, then show it solved | — | — | dir. kinetic 1, brutal 1, swiss 0.5 · types product 1.5, showcase3d 1, kinetic 1, footage 1, mix 1.5 · obj. product 1.5, promotion 1, announce 0.5 | 0 | static | `api/services/Communication/video/video.concepts.ts` |
| `concept:product-hero` | product-hero | reveal the product like a hero, then its strengths | — | — | dir. precision 1, cinematic 1, drenched 1 · types product 2, showcase3d 2.5, promo 1, slideshow 1, mix 1 · obj. product 2.5, promotion 1 | 0 | static | `api/services/Communication/video/video.concepts.ts` |
| `concept:manifesto` | manifesto | short brand beliefs, one after another | — | — | dir. brutal 2, swiss 1, kinetic 1, editorial 0.5 · types kinetic 2.5, mix 1 · obj. announce 1.5, recruitment 1, opening 0.5 · DA maximalism 1, graffiti 1.5, swiss 1 | 0 | static | `api/services/Communication/video/video.concepts.ts` |
| `concept:offer-blast` | offer-blast | hit with the offer, create urgency, then act | — | — | dir. kinetic 1.5, brutal 1.5, drenched 1 · types promo 3, product 0.5, mix 1 · obj. promotion 3 | 0 | static | `api/services/Communication/video/video.concepts.ts` |
| `concept:proof` | proof | lead with proof: a number, a customer's words | — | — | dir. precision 1.5, editorial 1, swiss 1 · types kinetic 1, footage 0.5, mix 1 · obj. testimonial 3, recruitment 1, product 0.5 | 0 | static | `api/services/Communication/video/video.concepts.ts` |
| `concept:journey` | journey | real scenes from the field, with captions | — | — | dir. cinematic 2, editorial 1 · types footage 3, slideshow 1, mix 1 · obj. announce 1, opening 1, recruitment 1 | 0 | static | `api/services/Communication/video/video.concepts.ts` |
| `concept:teaser` | teaser | intrigue first, reveal at the end | — | — | dir. cinematic 1.5, kinetic 1, drenched 1 · types showcase3d 1.5, kinetic 1, product 1, footage 0.5, mix 1.5 · obj. event 1.5, opening 1.5, product 1, announce 1 · DA surreal 1, aurora 1, futuristic 1 | 0 | static | `api/services/Communication/video/video.concepts.ts` |
| `concept:invitation` | invitation | invite: the occasion, the date, the place | — | — | dir. collage 1, editorial 1, kinetic 0.5 · types illustrated 2, kinetic 1, slideshow 0.5, mix 1 · obj. event 3, opening 2.5 | 0 | static | `api/services/Communication/video/video.concepts.ts` |
| `concept:showcase` | showcase | a gallery of the work, then one strong line | — | — | dir. editorial 1.5, collage 1, cinematic 1 · types slideshow 3, product 1, mix 1 · obj. product 1, announce 1, opening 0.5 | 0 | static | `api/services/Communication/video/video.concepts.ts` |
| `concept:reasons` | reasons | why choose us: the reasons, one by one | — | — | dir. swiss 1, precision 1, collage 0.5 · types kinetic 1, product 1, illustrated 1, promo 0.5, mix 1 · obj. recruitment 1.5, product 1, announce 1, promotion 0.5 | 0 | static | `api/services/Communication/video/video.concepts.ts` |
| `concept:celebration` | celebration | celebrate a moment with the community | — | — | dir. collage 2, kinetic 1, drenched 0.5 · types illustrated 2.5, mix 1 · obj. event 1, announce 1, opening 1 · DA pop-art 1, clay 1, y2k 1 | 0 | static | `api/services/Communication/video/video.concepts.ts` |
| `concept:logo-sting` | logo-sting | a short signature: one word, then the logo | — | — | types logo 5 | 0 | static | `api/services/Communication/video/video.concepts.ts` |

## Grand moment (la scène est choisie par le modèle, l’effet par la direction)

| Nœud | Nom | Rôle | Exige | Condition | Convient à | Coût | Rendu | Implémentation |
|---|---|---|---|---|---|---|---|---|
| `accent:punch` | Coup de poing | Zoom bref et éclair de couleur à l’entrée de la scène, son d’impact. | — | — | dir. brutal 2.5, kinetic 2, collage 1.5 | 0 | pure | `video-engine/src/App.tsx#AccentFlash` |
| `accent:giant` | Titre géant | Le titre de la scène occupe tout le cadre. | — | — | dir. swiss 2, brutal 1.5, drenched 1.5, precision 1, kinetic 1 | 0 | pure | `video-engine/src/scenes.tsx#Headline` |
| `accent:hold` | Temps suspendu | La scène dure plus longtemps et ses entrées ralentissent : on laisse respirer. | — | — | dir. cinematic 2.5, editorial 2, precision 1 | 0 | pure | `video-engine/src/text.tsx#Kinetic` |
| `accent:flip` | Bascule de couleur | La scène prend la couleur qui tranche avec ses voisines. | — | — | dir. drenched 2, swiss 1.5, precision 1, editorial 0.5 | 0 | static | `api/services/Communication/video/video.storyboard.ts` |

## Animations du logo

| Nœud | Nom | Rôle | Exige | Condition | Convient à | Coût | Rendu | Implémentation |
|---|---|---|---|---|---|---|---|---|
| `logo:classic` | Signature de la direction | Fin propre à la direction (mot-symbole géant, filet suisse, carte de papier, éclat…), logo en image. | — | — | dir. brutal 1.5, collage 1.5, kinetic 1, drenched 1 | 0 | pure | `video-engine/src/scenes.tsx#Logo` |
| `logo:draw` | Tracé puis remplissage | Les contours du logo vectoriel se tracent, le remplissage monte ensuite. | — | logo SVG, ≥ 1 forme(s), ≤ 40 formes, sans image matricielle | dir. precision 2, editorial 1.5, swiss 1, cinematic 1 · types logo 1.5 · DA minimalism 1, swiss 1, handwritten 1.5 | 0 | pure | `video-engine/src/kit/LogoMotion.tsx#drawPlan` |
| `logo:trace` | Plume | Une plume parcourt les contours (GSAP DrawSVG + CustomEase « main »), forme après forme. | `addon:gsap` | logo SVG, ≥ 1 forme(s), ≤ 12 formes, sans image matricielle | dir. editorial 2, collage 1.5, precision 1 · DA handwritten 2, bohemian 1.5, retro 1 | 1 | seek | `video-engine/src/kit/LogoMotion.tsx#tracePlan` |
| `logo:morph` | Point → logo | Un point grossit puis se divise et prend la forme exacte de chaque partie du logo (flubber). | `addon:flubber` | logo SVG, ≥ 1 forme(s), ≤ 16 formes, sans image matricielle, sans dégradé | dir. kinetic 2, drenched 1.5, precision 1, cinematic 0.5 · types logo 1.5, illustrated 1 · DA futuristic 1.5, pop-art 1, clay 1 | 1 | pure | `video-engine/src/kit/LogoMotion.tsx#morphPlan` |
| `logo:assemble` | Assemblage | Les formes arrivent de directions différentes et s’emboîtent (ressort si la direction rebondit). | — | logo SVG, ≥ 2 forme(s), ≤ 48 formes | dir. collage 2, kinetic 1.5, brutal 1 · DA maximalism 1, collage-art 2, y2k 1 | 0 | pure | `video-engine/src/kit/LogoMotion.tsx#assemblePlan` |
| `logo:wipe` | Balayage oblique | Une diagonale révèle le logo entier ; accepte tout SVG (texte, image, dégradé). | — | logo SVG | dir. swiss 2, brutal 1.5, cinematic 1, drenched 1 | 0 | pure | `video-engine/src/kit/LogoMotion.tsx#wipePlan` |
| `logo:split` | Symbole puis nom | Le symbole se pose, le nom de la marque glisse de derrière lui. | — | symbole en image | dir. precision 1, swiss 1, editorial 1, cinematic 1 · obj. opening 1, announce 0.5 | 0 | pure | `video-engine/src/scenes.tsx#Logo` |
| `logo:extrude` | Logo extrudé en 3D | Le symbole SVG extrudé, lumière de studio et reflet qui balaie la tranche (R3F). | `addon:three` | logo SVG, sans image matricielle, type logo | dir. precision 1, cinematic 1 · types logo 3 | 3 | clock-pinned | `video-engine/src/addons/three.tsx#LogoRig` |

## Fonds

| Nœud | Nom | Rôle | Exige | Condition | Convient à | Coût | Rendu | Implémentation |
|---|---|---|---|---|---|---|---|---|
| `bg:none` | Aucun fond | La surface seule : le choix par défaut des directions sobres (pas de décor par défaut). | — | — | dir. precision 2, cinematic 2, editorial 1.5, swiss 1, drenched 1, brutal 1, kinetic 0.5, collage 0.5 | 0 | static | — |
| `bg:dot-grid` | Trame de points | Points réguliers révélés depuis le coin libre. | — | — | dir. swiss 2, precision 1.5 · DA minimalism 1, swiss 1.5, futuristic 1 · secteurs code 1, business 1, chart 1 | 0 | pure | `video-engine/src/kit/Backdrop.tsx#DotGrid` |
| `bg:halftone` | Demi-teinte | Trame d’imprimerie qui fleurit dans un coin, dérive lente. | — | — | dir. editorial 1.5, collage 2 · DA retro 2, pop-art 2, collage-art 1 · secteurs fashion 1, music 1, book 1 | 0 | pure | `video-engine/src/kit/Backdrop.tsx#Halftone` |
| `bg:shape-field` | Formes de la marque | Cercles, carrés, anneaux aux couleurs de la charte, groupés du côté libre. | — | — | dir. kinetic 2, collage 1.5 · obj. promotion 1, event 1, opening 1 · DA maximalism 1.5, y2k 1.5, clay 1, pop-art 1 · secteurs family 1, food 0.5, smile 1 | 0 | pure | `video-engine/src/kit/Backdrop.tsx#ShapeField` |
| `bg:stagger-grid` | Vague en grille | Grille de points qui s’allume en vague depuis le centre (anime.js stagger grid). | `addon:anime` | — | dir. kinetic 1.5, drenched 1.5, precision 0.5 · DA futuristic 2, cyberpunk 1.5 · secteurs code 1.5, internet 1, rocket 1 | 1 | seek | `video-engine/src/kit/Backdrop.tsx#StaggerGrid` |
| `bg:marquee` | Bandeau du nom | Le nom de la marque en très grand, au trait, qui défile en fond. | — | — | dir. brutal 2, kinetic 1 · obj. promotion 1, event 1 · DA graffiti 1.5, maximalism 1, cyberpunk 1 | 0 | pure | `video-engine/src/kit/Backdrop.tsx#Marquee` |
| `bg:spotlight` | Halo | Un halo de la couleur d’accent qui glisse lentement. | — | — | dir. cinematic 1, drenched 2 · DA aurora 2, glassmorphism 1 · secteurs beauty 1.5, drink 0.5 | 0 | pure | `video-engine/src/kit/Backdrop.tsx#Spotlight` |
| `bg:ticks` | Graduations | Graduations de règle sur deux bords : mesure, exactitude. | — | — | dir. precision 2, swiss 1 · DA minimalism 1, futuristic 1 · secteurs tools 1.5, chart 1, health 0.5, business 0.5 | 0 | pure | `video-engine/src/kit/Backdrop.tsx#Ticks` |

## Annotations du mot mis en valeur

| Nœud | Nom | Rôle | Exige | Condition | Convient à | Coût | Rendu | Implémentation |
|---|---|---|---|---|---|---|---|---|
| `annotate:none` | Aucune annotation | Le mot mis en valeur change seulement de couleur. | — | — | dir. precision 2, cinematic 2, swiss 1.5, brutal 1, drenched 1, editorial 0.5 | 0 | static | — |
| `annotate:marker` | Surligneur | Un trait de surligneur glisse derrière le mot. | — | — | dir. kinetic 1.5, collage 1, editorial 1 · obj. promotion 1 · DA pop-art 1, y2k 1 | 0 | pure | `video-engine/src/kit/Em.tsx` |
| `annotate:underline` | Soulignement à la main | Un trait de feutre souligne le mot. | — | — | dir. editorial 2, collage 1 · DA handwritten 2, bohemian 1 | 0 | pure | `video-engine/src/kit/Em.tsx` |
| `annotate:circle` | Cercle à la main | Le mot est entouré d’un trait de feutre. | — | — | dir. collage 2, kinetic 1 · obj. promotion 1, event 0.5 · DA handwritten 1.5, collage-art 1.5, retro 1 | 0 | pure | `video-engine/src/kit/Em.tsx` |

## Bibliothèques d'icônes

| Nœud | Nom | Rôle | Exige | Condition | Convient à | Coût | Rendu | Implémentation |
|---|---|---|---|---|---|---|---|---|
| `icons:lucide` | Lucide (trait 1,6) | Trait régulier et net. | `lib:lucide` | — | dir. precision 3, editorial 0.5 · DA minimalism 1 | 0 | static | — |
| `icons:tabler` | Tabler (trait 1,75) | Trait géométrique. | `lib:tabler` | — | dir. swiss 3, precision 1 · DA swiss 1.5 | 0 | static | — |
| `icons:phosphor-thin` | Phosphor Thin | Trait très fin, élégant. | `lib:phosphor` | — | dir. cinematic 3 · DA victorian 1, editorial 1 | 0 | static | — |
| `icons:phosphor-light` | Phosphor Light | Trait léger, éditorial. | `lib:phosphor` | — | dir. editorial 3, cinematic 0.5 | 0 | static | — |
| `icons:phosphor-bold` | Phosphor Bold | Trait épais, affirmé. | `lib:phosphor` | — | dir. brutal 3 · DA graffiti 1 | 0 | static | — |
| `icons:phosphor-fill` | Phosphor Fill | Pictogrammes pleins. | `lib:phosphor` | — | dir. kinetic 3, drenched 1 · DA pop-art 1 | 0 | static | — |
| `icons:phosphor-duotone` | Phosphor Duotone | Deux tons, façon découpage. | `lib:phosphor` | — | dir. collage 3 · DA collage-art 1, clay 1 | 0 | static | — |
| `icons:heroicons-solid` | Heroicons Solid | Plein et dense, lisible sur aplat. | `lib:heroicons` | — | dir. drenched 3 | 0 | static | — |

## Logo pendant la vidéo

| Nœud | Nom | Rôle | Exige | Condition | Convient à | Coût | Rendu | Implémentation |
|---|---|---|---|---|---|---|---|---|
| `brandmark:none` | Pas de logo pendant la vidéo | Le logo n’apparaît qu’à la signature finale. | — | — | dir. brutal 2, cinematic 2, kinetic 1.5, collage 1.5, drenched 1 · types logo 3, kinetic 1 | 0 | static | — |
| `brandmark:corner` | Logo discret en coin | Le logo en monochrome (couleur du texte de la scène), sans conteneur, dans le coin que la composition laisse libre ; masqué sur les plans plein cadre. | — | logo SVG | dir. swiss 2, precision 2, editorial 1.5 · types footage 1.5, slideshow 1, product 1, mix 1 · DA minimalism 1, swiss 1.5, editorial 1 | 0 | pure | `video-engine/src/App.tsx#Brandmark` |

## Courbes

| Nœud | Nom | Rôle | Exige | Condition | Convient à | Coût | Rendu | Implémentation |
|---|---|---|---|---|---|---|---|---|
| `easing:spring` | Ressort physique | Rebond réel (motion spring) au lieu d’une courbe : réservé aux directions qui rebondissent. | `lib:motion` | — | dir. kinetic 3, collage 3 | 0 | pure | — |

## Effets 3D

| Nœud | Nom | Rôle | Exige | Condition | Convient à | Coût | Rendu | Implémentation |
|---|---|---|---|---|---|---|---|---|
| `postfx:bloom` | Bloom 3D | Halo léger sur les reflets de la scène 3D (premium seulement, coût SwiftShader). | `addon:three` | qualité ≥ premium, scène 3D | dir. cinematic 2, precision 1.5, drenched 1 | 2 | clock-pinned | `video-engine/src/addons/three.tsx#Stage` |
| `postfx:smaa` | Anticrénelage SMAA | Bords nets de la 3D (posé avec tout effet 3D). | `addon:three` | qualité ≥ hd, scène 3D | — | 1 | clock-pinned | `video-engine/src/addons/three.tsx#Stage` |

## Médias pilotés

| Nœud | Nom | Rôle | Exige | Condition | Convient à | Coût | Rendu | Implémentation |
|---|---|---|---|---|---|---|---|---|
| `media:lottie` | Animation Lottie | Lottie intégrée (aux couleurs de la marque) ou importée (.json, .lottie). | `addon:lottie` | scène lottie | — | 1 | seek | `video-engine/src/media.tsx#LottieBox` |
| `media:rive` | Animation Rive | Fichier .riv importé, joué image par image. | `addon:rive` | média rive | — | 2 | seek | `video-engine/src/media.tsx#RiveBox` |
| `media:model3d` | Modèle 3D importé | GLB tourné en studio, ombre de contact (R3F + drei). | `addon:three` | média model3d | — | 3 | clock-pinned | `video-engine/src/addons/three.tsx#ModelRig` |
| `media:cards3d` | Photos en cartes 3D | Photos posées en arc, caméra qui tourne (R3F + drei RoundedBox). | `addon:three` | scène 3D, média images | — | 3 | clock-pinned | `video-engine/src/addons/three.tsx#CardsRig` |

## Techniques de texte (générées depuis les directions)

| Nœud | Directions |
|---|---|
| `technique:lineWipe` | editorial, cinematic, precision, drenched |
| `technique:maskUp` | editorial, swiss, brutal, precision, drenched |
| `technique:blurWords` | editorial, swiss, kinetic, cinematic, precision |
| `technique:trackIn` | editorial, swiss, cinematic, precision |
| `technique:slideAlternate` | swiss, brutal, collage, drenched |
| `technique:stackPush` | swiss, brutal, drenched |
| `technique:boxReveal` | brutal, collage, drenched |
| `technique:charCascade` | kinetic, collage |
| `technique:scaleBlur` | kinetic, cinematic |
| `technique:flipChars` | kinetic |
| `technique:scramble` | kinetic |
| `technique:typewriter` | collage |

## Transitions (générées depuis les directions)

| Nœud | Directions |
|---|---|
| `transition:dissolve` | editorial, cinematic, precision |
| `transition:cut` | editorial, swiss, brutal, cinematic, collage, precision, drenched |
| `transition:wipe` | editorial, swiss, drenched |
| `transition:slideOver` | editorial, collage, precision |
| `transition:push` | swiss, brutal, kinetic, collage |
| `transition:blockStack` | swiss, brutal, collage |
| `transition:flashCut` | brutal, kinetic |
| `transition:zoomThrough` | kinetic, cinematic, drenched |
| `transition:whip` | kinetic |
| `transition:iris` | kinetic, precision, drenched |

## Bibliothèques écartées

| Bibliothèque | Raison |
|---|---|
| react-spring / @react-spring/three | animation physique en temps réel (horloge interne) : une image ne se recalcule pas à un instant t donné. |
| motion animate() / <motion.div> | lecture en temps réel ; seules les fonctions pures de motion (spring, interpolate) sont utilisées. |
| @formkit/auto-animate | anime les changements du DOM au fil du temps : sans objet pour un rendu image par image. |
| Remotion | licence commerciale pour une entreprise ; le moteur maison couvre le besoin avec Puppeteer + ffmpeg. |
| Theatre.js | éditeur de timelines pour un humain ; trop lourd pour un rendu piloté par données. |
| @lottiefiles/dotlottie-web | les .lottie sont décompressés côté serveur (jszip) et joués par lottie-web, sans second moteur WebAssembly. |
| Vivus, Rough Notation, mo.js | tracé, annotations et éclats couverts par le kit (LogoMotion, Em, Backdrop) en fonctions du temps ; mo.js n’est plus maintenu. |
| Magic UI, React Bits, Aceternity, Motion Primitives | collections à copier-coller pensées pour l’interaction (hover, scroll) ; leurs meilleures idées sont réécrites dans le kit en fonctions du temps, aux couleurs de la charte. |
| drei <Float>, <Sparkles>, <Text>, <Environment preset> | Float et Sparkles lisent l’horloge (déterministes ici, mais remplacés par la prop t) ; Text et les presets d’Environment téléchargent des fichiers pendant le rendu. |
| lucide-react, @phosphor-icons/react | tout le jeu d’icônes serait embarqué : le serveur n’injecte que les quelques SVG utilisés. |

## Exemples de décisions (marques de test)

### Wax & Co — promo, cinétique, DA maximaliste

Kit : logo `assemble`, fond `shape-field` sur stat-3, hook-1, annotation `marker`, icônes `phosphor-fill`, addons aucun.

  - **logo** → `logo:assemble` (score 4.25 : direction kinetic +2.25, DA maximalism +1)
    - écartés : `logo:extrude` (type promo), `logo:morph` (score 4.00, proche du meilleur : non tiré), `logo:classic` (score 2.50 < 3.50), `logo:draw` (score 1.00 < 3.50), `logo:split` (score 1.00 < 3.50), `logo:trace` (score 1.00 < 3.50)
  - **background** → `bg:shape-field` (score 6.50 : direction kinetic +3, objectif promotion +1, DA maximalism +1.5)
    - écartés : `bg:marquee` (score 4.50 < 5.75), `bg:stagger-grid` (score 3.25 < 5.75), `bg:halftone` (score 3.00 < 5.75), `bg:none` (score 1.75 < 5.75), `bg:dot-grid` (score 1.00 < 5.75), `bg:spotlight` (score 1.00 < 5.75)
  - **annotate** → `annotate:marker` (score 4.25 : direction kinetic +2.25, objectif promotion +1)
    - écartés : `annotate:circle` (score 3.50, proche du meilleur : non tiré), `annotate:none` (score 1.00 < 3.50), `annotate:underline` (score 1.00 < 3.50)
  - **icons** → `icons:phosphor-fill` (score 5.50 : direction kinetic +4.5)
    - écartés : `icons:heroicons-solid` (score 1.00 < 4.75), `icons:lucide` (score 1.00 < 4.75), `icons:phosphor-bold` (score 1.00 < 4.75), `icons:phosphor-duotone` (score 1.00 < 4.75), `icons:phosphor-light` (score 1.00 < 4.75), `icons:phosphor-thin` (score 1.00 < 4.75)
  - **brandmark** → `brandmark:none` (score 3.25 : direction kinetic +2.25)
    - écartés : `brandmark:corner` (score 1.00 < 2.50)
  - **easing** → `easing:spring` (score 1.00 : direction kinetic à rebond)

### Bissap Délices — produit, éditorial

Kit : logo `trace`, fond `halftone` sur stat-3, hook-1, annotation `underline`, icônes `phosphor-light`, addons `gsap`.

  - **logo** → `logo:trace` (score 4.00 : direction editorial +3)
    - écartés : `logo:extrude` (type product), `logo:draw` (score 3.25, proche du meilleur : non tiré), `logo:split` (score 2.50 < 3.25), `logo:assemble` (score 1.00 < 3.25), `logo:classic` (score 1.00 < 3.25), `logo:morph` (score 1.00 < 3.25)
  - **background** → `bg:halftone` (score 3.25 : direction editorial +2.25)
    - écartés : `bg:none` (score 3.25, proche du meilleur : non tiré), `bg:spotlight` (score 1.50 < 2.50), `bg:dot-grid` (score 1.00 < 2.50), `bg:marquee` (score 1.00 < 2.50), `bg:shape-field` (score 1.00 < 2.50), `bg:stagger-grid` (score 1.00 < 2.50)
  - **annotate** → `annotate:underline` (score 4.00 : direction editorial +3)
    - écartés : `annotate:marker` (score 2.50 < 3.25), `annotate:none` (score 1.75 < 3.25), `annotate:circle` (score 1.00 < 3.25)
  - **icons** → `icons:phosphor-light` (score 5.50 : direction editorial +4.5)
    - écartés : `icons:lucide` (score 1.75 < 4.75), `icons:heroicons-solid` (score 1.00 < 4.75), `icons:phosphor-bold` (score 1.00 < 4.75), `icons:phosphor-duotone` (score 1.00 < 4.75), `icons:phosphor-fill` (score 1.00 < 4.75), `icons:phosphor-thin` (score 1.00 < 4.75)
  - **brandmark** → `brandmark:corner` (score 4.25 : direction editorial +2.25, type product +1)
    - écartés : `brandmark:none` (score 1.00 < 3.50)

### Kofi Tech — logo, précision, premium

Kit : logo `draw`, fond `none` sur —, annotation `none`, icônes `lucide`, addons aucun.

  - **logo** → `logo:draw` (score 5.50 : direction precision +3, type logo +1.5)
    - écartés : `logo:extrude` (score 4.30 < 4.75), `logo:morph` (score 4.00 < 4.75), `logo:split` (score 3.00 < 4.75), `logo:trace` (score 2.50 < 4.75), `logo:assemble` (score 1.00 < 4.75), `logo:classic` (score 1.00 < 4.75)
  - **background** → `bg:none` (score 4.00 : direction precision +3)
    - écartés : `bg:dot-grid` (score 4.25, proche du meilleur : non tiré), `bg:ticks` (score 4.00, proche du meilleur : non tiré), `bg:stagger-grid` (score 3.25 < 3.50), `bg:halftone` (score 1.00 < 3.50), `bg:marquee` (score 1.00 < 3.50), `bg:shape-field` (score 1.00 < 3.50)
  - **annotate** → `annotate:none` (score 4.00 : direction precision +3)
    - écartés : `annotate:circle` (score 1.00 < 3.25), `annotate:marker` (score 1.00 < 3.25), `annotate:underline` (score 1.00 < 3.25)
  - **icons** → `icons:lucide` (score 5.50 : direction precision +4.5)
    - écartés : `icons:tabler` (score 2.50 < 4.75), `icons:heroicons-solid` (score 1.00 < 4.75), `icons:phosphor-bold` (score 1.00 < 4.75), `icons:phosphor-duotone` (score 1.00 < 4.75), `icons:phosphor-fill` (score 1.00 < 4.75), `icons:phosphor-light` (score 1.00 < 4.75)
  - **brandmark** → `brandmark:none` (score 4.00 : type logo +3)
    - écartés : `brandmark:corner` (score 4.00, proche du meilleur : non tiré)

### Mama Kitchen (sans logo) — événement, collage

Kit : logo `classic`, fond `shape-field` sur stat-3, hook-1, annotation `circle`, icônes `phosphor-duotone`, addons aucun.

  - **logo** → `logo:classic` (score 3.25 : direction collage +2.25)
    - écartés : `logo:draw` (pas de logo vectoriel), `logo:trace` (pas de logo vectoriel), `logo:morph` (pas de logo vectoriel), `logo:assemble` (pas de logo vectoriel), `logo:wipe` (pas de logo vectoriel), `logo:split` (pas de symbole en image)
  - **background** → `bg:shape-field` (score 4.75 : direction collage +2.25, objectif event +1, secteur food +0.5)
    - écartés : `bg:halftone` (score 4.00, proche du meilleur : non tiré), `bg:marquee` (score 2.00 < 4.00), `bg:none` (score 1.75 < 4.00), `bg:dot-grid` (score 1.00 < 4.00), `bg:spotlight` (score 1.00 < 4.00), `bg:stagger-grid` (score 1.00 < 4.00)
  - **annotate** → `annotate:circle` (score 4.50 : direction collage +3, objectif event +0.5)
    - écartés : `annotate:marker` (score 2.50 < 3.75), `annotate:underline` (score 2.50 < 3.75), `annotate:none` (score 1.00 < 3.75)
  - **icons** → `icons:phosphor-duotone` (score 5.50 : direction collage +4.5)
    - écartés : `icons:heroicons-solid` (score 1.00 < 4.75), `icons:lucide` (score 1.00 < 4.75), `icons:phosphor-bold` (score 1.00 < 4.75), `icons:phosphor-fill` (score 1.00 < 4.75), `icons:phosphor-light` (score 1.00 < 4.75), `icons:phosphor-thin` (score 1.00 < 4.75)
  - **brandmark** → `brandmark:none` (score 3.25 : direction collage +2.25)
    - écartés : `brandmark:corner` (pas de logo vectoriel)
  - **easing** → `easing:spring` (score 1.00 : direction collage à rebond)
