# @idem/motion-compiler — iVision Motion Compiler (0.3)

Le moteur vidéo d'IDEM et d'iVision ne fait plus écrire de coordonnées à l'IA. Depuis la version 0.3, le modèle écrit
une **intention de scène** (rôle, énergie, type de composition, hiérarchie, verbes de mouvement) ; ce package la
**résout** (solveurs de géométrie et de temps, système de design du film), en tire plusieurs **variantes**, les
**juge** sur des mesures, et traduit la retenue en **programme** du langage de mouvement, compilé de façon
déterministe en scène Motion Canvas. Package pur (aucune dépendance au moteur) ; l'échantillonneur qui l'utilise vit
dans `apps/ivision/core/src/video/author/sampler.ts`. Doc complète :
[apps/api/docs/VIDEO_ENGINE.md](../../apps/api/docs/VIDEO_ENGINE.md).

| Dossier | Contenu |
| --- | --- |
| `src/design` | le système de design du film : directions nommées, rôles de couleur (MCU, Leonardo), échelle typographique (Capsize, Knuth-Plass), jetons de mouvement, courbe d'énergie, coutures, sons de transition, zones sûres des plateformes, étalonnage (LUT) |
| `src/intent` | l'intention (`types.ts`), son schéma de sortie structurée (`schema.ts`), sa lecture tolérante (`validate.ts`), les recettes des verbes (`recipes.ts`), la traduction en programme (`lower.ts`) |
| `src/solver` | géométrie par format (Cassowary, `@lume/kiwi`) et variantes, temps (contraintes), trajectoires sans croisement |
| `src/judge` | élimination, composition, mouvement, assertions d'intention, score pondéré et rapport mesuré ; ajustement des poids sur des préférences (`fit.ts`) |
| `src/references` | la bibliothèque de scènes de référence (amorce écrite à la main + scènes du professeur acceptées, `references.json`) et leur recherche |
| `src/dsl` | le langage d'assemblage : types, expressions (`fmt`, `pick`, `%`), macros (icônes, appareils), validation |
| `src/compiler` | programme → TSX (0.3.0) : valeurs nommées, temps de lecture, lignes équilibrées, coutures, effet `point` |
| `src/author` | la référence du langage et les exemples (chemin `VIDEO_AUTHOR_MODE=program`) |

## Contrôles et bancs

| Commande | Coût | Ce qu'elle fait |
| --- | --- | --- |
| `npm run check` | gratuit | langage, validation, exemples, garanties exécutées dans Motion Canvas |
| `npm run check:intent` | gratuit | design, solveurs, variantes, juge, coutures, rendu réel |
| `npm run bench:quality:offline` | gratuit | chaque scène de référence dans les 4 formats : défauts, recours, score (`bench/out/quality/offline.html`) |
| `npm run bench:quality -- --engine intent --label <nom>` | **payant** | 40 briefs par cran avec les vrais modèles (OpenRouter en direct, réglages de production) |
| `npm run bench:quality:rate` | gratuit | planche de paires à l'aveugle pour les évaluateurs |
| `npm run bench:quality:fit -- --write` | gratuit | poids du juge ajustés sur les préférences (`judge-weights.json`), portes des phases |
| `npm run references:teach` | **payant** | le professeur hors ligne écrit des scènes de référence, évaluées par le code (`bench/out/references/review.html`) |
| `npm run references:promote` | gratuit | les scènes cochées entrent dans `references.json` |

Clé : `OPENROUTER_API_KEY` (environnement, sinon `apps/api/.env.secret`). Les bancs payants ne se lancent que sur
décision. `bench/` (banc 0.2) reste disponible : `npm run bench`, `npm run bench:report`.
