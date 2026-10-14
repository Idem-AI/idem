# Le moteur vidéo — Motion Canvas

> Depuis le 14 octobre 2026, toute vidéo motion design d'IDEM et d'iVision est composée et animée par
> **Motion Canvas 3.17.2** (MIT). L'ancien moteur React (layouts, motifs, graphe de capacités, critique
> visuelle, film d'auteur) est supprimé ; son dernier état est conservé par le tag Git
> `video-engine-legacy`. Produit, prix et crans : [MOTION_VIDEO.md](MOTION_VIDEO.md).

## 1. Les quatre principes

1. **Motion Canvas est le seul moteur de composition et d'animation.** Rien d'autre ne dessine une
   scène. Les outils externes ont des rôles distincts : capturer une interface, générer une image ou un
   clip, dire une voix, encoder (ffmpeg).
2. **L'IA est libre.** Aucun catalogue de mises en page, de motifs, de concepts ou de transitions. Le
   directeur invente le film ; l'auteur écrit le code de chaque scène comme il l'entend.
3. **Pas de contrôle esthétique.** Le code rendu par le modèle n'est jamais critiqué, réécrit,
   « réparé » ni remplacé par une composition de secours. Il est montré tel quel.
4. **La qualité vient de l'amont** : un problème précis par appel, un contexte compact, la référence
   d'API exacte de la version installée, des exemples techniques, des fonctions réutilisables.

Ce qui reste vérifié est **technique** : le code compile-t-il, s'exécute-t-il, le MP4 est-il lisible ?
Une erreur technique est attribuée à sa scène et montrée telle quelle ; l'utilisateur demande une
correction s'il le souhaite (nouvel appel, volontaire).

## 2. Le pipeline

```
demande ─► compréhension ─► directeur ─► planificateur ─► médias / musique / voix ─► auteur (×N) ─► contrôle
            (code + lecteur)   (concept)    (storyboard)                                (code TSX)     (Chromium)
```

| Étape | Fichier | Rôle de modèle | Ce qu'elle produit |
| --- | --- | --- | --- |
| Compréhension | `request/request.ts`, `request/intent.ts` | `video.reader`, `video.intent-classifier` (dès Medium) | `RequestSpec` : langue, scénario scène par scène, textes **mot pour mot**, voix écrite, durée, format, interdits ; l'intention (objectif, matière, mouvement) |
| Direction | `director/concept.agent.ts` | `video.concept` (dès Medium) | titre, concept, **bible visuelle**, une idée par scène ; au cran Ultra, trois idées comparées dans le même appel |
| Storyboard | `director/storyboard.agent.ts` | `video.planner` | par scène : durée, intention, idée visuelle, idée de mouvement, entrée, textes exacts (par clé), médias, médias à produire, ligne de voix. Au cran Low, il invente aussi le concept |
| Médias | `assets/sourcing.ts`, `assets/media.ts`, `assets/brandmedia.ts` | — (génération FLUX → Seedance, puis Pexels) | imports d'abord, captures de la marque, puis les médias demandés par le storyboard |
| Musique, sons | `audio/music.ts`, `audio/beats.ts`, `audio/sfx.ts` | — | piste libre et son tempo ; sonothèque CC0 |
| Voix | `audio/voice.ts` | — (voix de l'hôte) | lignes dites, scènes calées sur elles sans changer la durée achetée |
| Auteur | `author/motion-canvas.author.ts` | `video.author` | le **code TSX** de chaque scène, compilé |
| Contrôle | `rendering/runner.ts#probeFilm` | — | chaque scène exécutée : erreurs d'exécution, vignettes, effets sonores posés |

L'orchestrateur est `motionVideo.service.ts` ; les appels de modèles passent tous par
`agents.ts#callFilmModel` (rôle logique → modèle choisi par l'hôte, plafond de sortie par cran,
`apps/api/api/config/creative-roles.ts`).

### Ce que le code garantit sans toucher à la création

- les durées font la durée achetée (mise à l'échelle) ;
- un **scénario écrit par l'utilisateur** garde ses scènes, ses textes et sa voix mot pour mot ; le
  planificateur n'y décide que du visuel et du mouvement (scènes retrouvées par leur numéro) ;
- un nombre, une date ou une adresse absents de la demande ne s'affichent pas (`request/facts.ts#isGrounded`) ;
- les médias cités existent, les médias à produire tiennent dans les plafonds ;
- chaque écart est **dit** (`film.fidelity.notes`, dans la langue de la vidéo) : texte retiré, média
  introuvable, 4K demandé, voix non dite.

Une réponse **illisible** (format) du planificateur est redemandée une fois avec le rappel du format ;
une réponse **sans code** de l'auteur (panne, délai, réponse vide) est redemandée une fois. Ce sont des
erreurs de forme, pas des jugements : un code qui ne compile pas n'est jamais redemandé d'office.

## 3. Le contrat d'une scène

Le modèle écrit exactement ceci :

```tsx
import { Rect, Txt, View2D } from '@motion-canvas/2d';
import { all, createRef, easeOutCubic, waitFor } from '@motion-canvas/core';
import { SceneContext, safeArea, readableOn } from '@idem/motion';

export default function* (view: View2D, ctx: SceneContext) {
  // …
  yield* waitFor(ctx.duration);
}
```

- Trois modules seulement : `@motion-canvas/core`, `@motion-canvas/2d`, `@idem/motion`. Tout autre
  import est refusé à la compilation (`rendering/compiler.ts`).
- **Les textes, les médias et la marque ne sont jamais écrits dans le code** : ils sont lus dans
  `ctx.texts`, `ctx.media`, `ctx.brand`. C'est ce qui permet de retoucher un texte ou une photo sans
  toucher au code.
- `ctx` (`motion/kit/context.ts`) : clé, rang, format, taille de composition (`width`, `height`,
  origine au centre), `unit` (1 % du petit côté), durée, cadence, textes, médias (URL, dimensions,
  description), marque (couleurs, polices, logo clair/sombre/SVG), voix (`text`, `at`, `duration`),
  tempo (`bpm`, premier temps), `sfx(kind)`.

### La taille de composition

Chaque format a une taille fixe : story 1080×1920, carré 1080×1080, portrait 1080×1350, paysage
1920×1080 (`rendering/formats.ts#COMPOSITION`). La qualité ne change que l'**échelle de sortie**
(`resolutionScale` de Motion Canvas : 2/3 en standard, 1/2 en aperçu) et la cadence (60 i/s en
premium). Le code d'une scène ne dépend donc jamais de la qualité exportée.

## 4. Le harnais (`motion/runtime/harness.tsx`)

Chaque scène du film est une scène Motion Canvas créée par `makeScene2D`, qui enveloppe le code de
l'IA **sans le modifier** :

- **durée exacte** : le code tourne en tâche fille (`yield`), le harnais attend la durée prévue puis la
  scène se termine — ce qui dépasse est coupé, ce qui manque est tenu sur la dernière image. Une image
  de plus est attendue pour toute scène suivie d'une autre (Motion Canvas remplace la dernière image
  d'une scène par la première de la suivante) : le film garde sa durée à l'image près ;
- **erreurs** : une exception est attribuée à SA scène et montrée à sa place (carte d'erreur explicite,
  jamais une autre composition) ; les autres scènes continuent ;
- **sons** : `ctx.sfx(kind)` note l'instant ; le serveur mixe ces effets au rendu (`refineCues` n'y
  applique que l'hygiène du mixage : espacement, saturation) ;
- **sous-titres** de la voix off, posés au-dessus des scènes quand ils sont demandés ;
- **données vivantes** : les textes et médias sont relus à chaque passage — l'aperçu montre une retouche
  sans recompiler.

`motion/runtime/engine.ts` pilote Motion Canvas **sans son éditeur** (ni Vite, ni fichiers `.meta`) :
il instancie les scènes comme le `Renderer` de Motion Canvas, puis les avance image par image (rendu)
ou en temps réel (aperçu).

## 5. Le kit `@idem/motion` (`motion/kit`)

Des **outils**, jamais des compositions : `safeArea`, `grid`, `circlePoints`, `fitMedia`
(cover/contain), `measureText`, `fitFontSize`, `words`, `readableOn`, `contrast`, `mix`, `alpha`,
`beatTime`, `sceneTime`, `waitUntilTime`, `random` (déterministe), `lerp`, `clamp`. Le code d'une
scène s'en sert s'il veut, les combine, ou les ignore.

Les **exemples** (`motion/examples/*.tsx` : typographie, photo, infographie, interface, logo et
transition, clip) montrent des techniques correctes. Chacun déclare `@tags` et `@shows` ; le
constructeur de contexte en joint 1 à 3 selon la scène. Ce ne sont pas des gabarits : le prompt le dit.

## 6. Le contexte de l'auteur (`author/context-builder.ts`)

Un appel par scène, avec seulement :

1. la **référence d'API** (`author/api-reference.ts`) : forme du fichier, coordonnées, contexte, nœuds
   et leurs propriétés, refs, règles du temps, transitions, kit, interdits ;
2. 1 à 3 **exemples** choisis par les mots de la scène et ses médias ;
3. la **fiche** : film (titre, concept, bible), cadre (format, taille, rang, durée), marque, scènes
   voisines, intention, idées visuelle et de mouvement, entrée, textes exacts par clé, médias (index
   `ctx.media[i]`, dimensions, description), voix et son instant, tempo ;
4. dès High, les **fonctions réutilisables** des vidéos précédentes de la marque
   (`author/snippets.ts` : fonctions de premier niveau du code des scènes déjà prêtes, choisies par
   leur nom et leur commentaire) ;
5. pour une retouche : le code actuel et la demande ; pour une correction : le code et l'erreur.

`MC_SYMBOLS` liste chaque nom cité par la référence ; `npm run check:video` compile une scène qui les
importe **tous** depuis les paquets installés. Une montée de version qui retire un nom fait échouer le
contrôle, pas une vidéo. Mettre à jour `MOTION_CANVAS_VERSION` avec `package.json`.

## 7. Le rendu (`rendering/`)

| Fichier | Rôle |
| --- | --- |
| `compiler.ts` | `compileScene` (une scène : syntaxe, imports, `export default`) ; `buildFilmBundle` (runtime + scènes, IIFE, minifié pour l'aperçu). Une scène qui ne compile pas n'entre pas dans le paquet : le harnais montre son erreur |
| `runner.ts` | Chromium partagé ; page servie depuis l'origine fictive `https://film.idem.local` (page, paquet, médias répondus depuis la mémoire, plages HTTP pour les clips) ; **tout autre accès réseau est refusé** ; `probeFilm` (contrôle + vignettes), `renderFilm` (tronçons rendus en parallèle, JPEG → ffmpeg, recollés, son mixé, affiche) |
| `ffmpeg.ts` | encodage H.264, mixage (musique, effets posés par les scènes, voix ; compresseurs ; −14 LUFS), `probe` |
| `preview.ts` | la page d'aperçu autonome : même paquet, lecteur temps réel, CSP stricte (`connect-src 'none'`), images embarquées (data URI : `Img` charge en CORS) |
| `formats.ts` | taille de composition et sortie de chaque format |

Mesures (poste de développement) : contrôle de 7 scènes ≈ 3 s ; MP4 de 15 s en 720p ≈ 7 s. Le drapeau
Chromium `--disable-accelerated-2d-canvas` est essentiel : sans lui, la relecture GPU logicielle porte
l'encodage JPEG d'une image 1080p à ~200 ms (≈ 40 ms avec).

### Sécurité du code exécuté

Le code écrit par l'IA ne s'exécute **que dans un navigateur** : jamais dans Node.

- Rendu serveur : origine fictive, interception de toutes les requêtes, réseau coupé hors de la page et
  de ses médias (déjà téléchargés par le serveur avec `safeFetch`, anti-SSRF).
- Aperçu : iframe `sandbox="allow-scripts"` (origine opaque) et CSP qui interdit toute connexion.
- Imports limités aux trois modules ; aucun accès aux secrets, au système de fichiers ou au réseau.

## 8. L'aperçu et l'éditeur

`motion/runtime/player.ts` joue le film en temps réel (musique, voix et effets calés sur la lecture,
préchargés avant de proposer la lecture). Protocole avec l'éditeur parent
(`packages/shared-video-editor`) :

- vers l'éditeur : `ivision:ready` (durée, scènes, erreurs), `ivision:loading`, `ivision:playable`,
  `ivision:time`, `ivision:errors` ;
- vers l'aperçu : `ivision:play`, `ivision:pause`, `ivision:seek`, `ivision:focus`, `ivision:edit`
  (textes ou média d'une scène : la donnée change, le code non).

L'éditeur montre, par scène : son état (une scène en erreur affiche son message et **Corriger**), ses
textes, sa photo, et « Changer cette scène » (consigne en clair → l'auteur réécrit SEULEMENT cette
scène ; **Nouvelle version** → réécriture depuis la fiche). Une réécriture qui ne compile pas ne
remplace jamais un code qui marchait : l'échec est rendu dans le rapport.

## 9. Retouches et export

`MotionVideoService.updateVideo(patch)` (`sanitizeVideoPatch` valide le corps HTTP, IDEM et iVision) :

| Champ | Effet |
| --- | --- |
| `texts`, `images` | données des scènes (le code ne change pas) |
| `visual` | `{ s2: "plus lent" }` ou `{ all: … }` : l'auteur réécrit le code de la scène |
| `fix` | correction volontaire d'une scène en erreur (code + erreur donnés à l'auteur) |
| `regenerate` | nouvelle version d'une scène, depuis sa fiche |
| `voice`, `voiceLines`, `captions` | voix off (dite, recalée), lignes, sous-titres |
| `musicMood`, `musicTrackId`, `sfx`, `scope` | musique, effets, périmètre |

`reviseFromText` lit une retouche écrite (`revise.ts`) : textes, voix, demande visuelle par scène,
réglages, ou « c'est une nouvelle vidéo ». Route IDEM `POST …/videos/:id/revise`, conversation iVision.

L'export est **refusé tant qu'une scène est en erreur** (`scene_errors`). Une scène qui échoue pendant
le rendu (cas rare : erreur apparue après le contrôle) fait échouer ce format (`scene_error`) et
marque la scène ; le fichier n'est pas livré. La file de rendu, les rendus d'avance, les signatures de
fraîcheur et les remboursements sont inchangés.

## 10. Les vidéos de l'ancien moteur

Une vidéo sans `film` (créée avant la migration) est marquée `legacy` : ses MP4 se téléchargent, elle
ne se prévisualise ni ne se retouche plus (`legacy_video`). Les deux interfaces le disent.

## 11. Contrôles

| Commande | Ce qu'elle prouve |
| --- | --- |
| `npm run check:video` (apps/api) = `npm run check:motion` (apps/ivision/core) | exemples compilés ; imports interdits refusés ; erreur de syntaxe localisée ; film contrôlé (seule la scène fautive en erreur, effets relevés, vignettes) ; MP4 à la durée exacte ; référence d'API présente dans la version installée ; création complète avec modèles simulés (textes, chiffre inventé retiré et signalé, code fautif gardé tel quel, correction, retouches, aperçu, export, ancienne vidéo en lecture seule) |
| `npm run check:request` (apps/ivision/core) | la demande suivie à la lettre : lecture, langue, storyboard tenu par le scénario, disjoncteur des médias, création de bout en bout sur le vrai script d'un utilisateur |
| `npm run check` (apps/ivision/core) | scan de site, vidéo modèle et reproduction, visuels |
| `npm run typecheck` (apps/ivision/core) | Node **et** navigateur (`motion/tsconfig.json` : kit, harnais, lecteur, exemples typés contre Motion Canvas) |

## 12. Faire évoluer le moteur

- **Une nouvelle technique** : un exemple court dans `motion/examples` (avec `@tags`, `@shows`), compilé
  et rendu par `check:motion`. Jamais un gabarit à choisir.
- **Un nouvel outil** : une fonction du kit (`motion/kit/helpers.ts`), exportée par `motion/kit/index.ts`,
  ajoutée à la référence d'API et à `MC_SYMBOLS`.
- **Une montée de Motion Canvas** : changer la version exacte (`apps/api/package.json`,
  `apps/ivision/core/package.json`, `MOTION_CANVAS_VERSION`), lancer `npm run typecheck` et
  `npm run check:motion` dans le core.
- **Un autre modèle pour un rôle** : `IDEM_ROLE_VIDEO_AUTHOR_MODEL`, `IDEM_ROLE_VIDEO_PLANNER_MODEL`,
  `IDEM_ROLE_VIDEO_CONCEPT_MODEL` (liste blanche OpenRouter), ou `…_ENDPOINT=selfhosted`.
