# @idem/motion-compiler — iVision Motion Compiler

Le moteur vidéo d'IDEM et d'iVision ne fait plus écrire de code Motion Canvas à l'IA : elle écrit un
**programme d'animation compact** (JSON : nœuds, pistes, courbes, expressions en `u`), qu'un **compilateur
déterministe** traduit en scène Motion Canvas. Ce package est pur (aucune dépendance au moteur) ; l'auteur qui fait
écrire les programmes vit dans `apps/ivision/core/src/video/author/program.author.ts`. Doc complète :
[apps/api/docs/VIDEO_ENGINE.md](../../apps/api/docs/VIDEO_ENGINE.md).

| Dossier | Contenu |
| --- | --- |
| `src/dsl` | le langage (`types.ts`), les expressions sûres — `%`, `pick(vertical, horizontal)` (`expr.ts`), la validation technique, tolérante (`validate.ts`) |
| `src/compiler` | programme → TSX : arbre JSX explicite, moteur de piste embarqué, garanties (texte qui tient, piste ajustée à la scène, animations désenchevêtrées, responsive) ; programme gardé en tête du code |
| `src/author` | la référence du langage donnée au modèle, les exemples (techniques, responsives), le format d'affichage d'un programme |
| `scripts/check.ts` | `npm run check` : langage, validation, exemples, garanties exécutées dans Motion Canvas en story et en paysage |
| `bench/` | le banc d'essai avec les vrais modèles (`npm run bench`, `npm run bench:report`) |

## Banc d'essai

`npm run bench -- --levels high,ultra` : 4 demandes (typographique, données, démo avec captures réelles, récit en 5
scènes), vrais modèles OpenRouter (échelles de production), chaque vidéo rendue dans son format et l'orientation
opposée. Direction et storyboard mis en cache : toutes les passes partent du même storyboard. `baseline.json` garde
les mesures d'avant la migration (auteur TSX, compilateur 0.1). Sorties dans `bench/out/` (ignoré par Git) :
`results.json`, `videos/*.mp4`, `scenes/*`, `report.html` (mesures, rendus côte à côte, évaluation à l'aveugle).

Clé : `OPENROUTER_API_KEY` (environnement, sinon `apps/api/.env.secret`). Le banc appelle OpenRouter en direct : il
envoie `reasoning: { enabled: false }` comme le fait la production (`translateReasoning`).
