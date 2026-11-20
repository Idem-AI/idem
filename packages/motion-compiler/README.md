# @idem/motion-compiler — le système de design du film

Le système de design partagé par le moteur vidéo d'IDEM et d'iVision (HyperFrames, catalogue `idem-templates`) :
direction artistique, rôles de couleur et contraste, dégradé des médias, typographie, zones sûres par plateforme,
énergie et coutures des scènes. Calculé une fois par film (`buildFilmDesign`), résolu par scène et par format
(`resolveSceneDesign`). Package pur (aucune dépendance au moteur de rendu). Doc complète :
[apps/api/docs/VIDEO_ENGINE.md](../../apps/api/docs/VIDEO_ENGINE.md).

> Avant le 20 novembre 2026, ce package portait aussi le langage de mouvement et son compilateur (un programme
> d'animation écrit par l'IA, traduit en scène Motion Canvas). Ce moteur a été retiré ; HyperFrames (scènes HTML
> Tailwind animées par GSAP, assemblées depuis le catalogue) est depuis le seul moteur vidéo.

| Dossier | Contenu |
| --- | --- |
| `src/design` | directions nommées, rôles de couleur (MCU, Leonardo), échelle typographique (Capsize, Knuth-Plass), jetons de mouvement, courbe d'énergie, coutures, sons de transition, zones sûres des plateformes, étalonnage (LUT) |

## Contrôle

`npm run typecheck` — gratuit.
