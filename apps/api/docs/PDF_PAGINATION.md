# Pagination des documents PDF (business plan)

## Le problème

Les agents produisent **un flux HTML continu par section** (Tailwind + Chart.js).
Jusqu'ici ce flux était confié à la pagination native de Chrome, avec deux
conséquences visibles sur le PDF :

- **des blocs coupés** en travers d'un saut de page (carte, tableau, graphe) ;
- **des pages à moitié vides** : un bloc qui ne rentre pas est repoussé entier à
  la page suivante et laisse un trou de 30 à 40 % en bas de la précédente.

Le CSS seul ne peut pas régler ça : `break-inside: avoid` évite la coupure mais
aggrave les trous, et rien en CSS ne sait « étirer » une page pour la remplir.

## La solution

Un paginateur mesure le flux réel dans la page Puppeteer, puis le **reconstruit
en pages A4 exactes** avant l'impression.

- Code : [`api/services/pdf/flow-pagination.runtime.ts`](../api/services/pdf/flow-pagination.runtime.ts)
  (script navigateur exposé en `window.__idemFlow`)
- Appel : [`api/services/pdf.service.ts`](../api/services/pdf.service.ts),
  uniquement quand `multiPage: true`
- Activé par : `BusinessPlanService.generateBusinessPlanPdf`

### Étapes

1. **`prepare()` — rendu déterministe avant toute mesure**
   - relance la génération des utilitaires Tailwind. `page.setContent()` réécrit
     le document et détache l'observateur du CDN Tailwind : les classes ne sont
     régénérées que si on réassigne `tailwind.config` (`tailwind.refresh()`
     n'existe pas dans ce build). Une sonde `h-[137px]` confirme que c'est fait ;
   - attend `document.fonts.ready`, les images, puis les instances Chart.js ;
   - **rasterise chaque `<canvas>` en `<img>` PNG** de même boîte : un graphe
     devient déplaçable, clonable et mesurable (le viewport est en
     `deviceScaleFactor: 2`, donc les PNG restent nets à l'impression).

2. **Mesure** — chaque section est découpée en « lignes de flux » (les enfants du
   conteneur racine, regroupés géométriquement pour gérer grilles et flex-wrap).
   On retient hauteur, espace inter-bloc réel et statut « titre ». Les enfants en
   `position: absolute` sont des décors : ils seront reproduits sur chaque page.

3. **Plan** — remplissage glouton avec fragmentation récursive :
   conteneur → lignes, tableau → `<tr>` (avec répétition du `<thead>`),
   paragraphe → coupure à la ligne (jamais moins de 2 lignes de part et d'autre).
   Un bloc atomique plus haut qu'une page est réduit à l'échelle, jamais rogné.
   Un titre n'est jamais seul en bas de page (`keep-with-next`, chapeau inclus).

4. **Équilibrage** — le plan glouton donne le nombre minimal de pages ; on le
   rejoue avec un budget égal par page (`reste / pages restantes`), en desserrant
   ce budget par paliers, et on garde le plan dont la page la plus vide est la
   plus pleine. `[100 %, 100 %, 20 %]` devient `[80 %, 79 %, 74 %]`.

5. **Construction** — chaque page est un **clone du conteneur racine de l'IA**
   (classes, fond, décors conservés) à hauteur A4 fixe et `overflow: hidden`.
   Les espaces mesurés sont réappliqués en marges explicites : aucune surprise de
   fusion de marges.

6. **Remplissage** — l'espace restant est distribué dans les interlignes :
   - jamais après un titre (on ne détache pas un titre de son texte) ;
   - en priorité avant un nouveau sous-titre ;
   - plafonné (12 mm par interligne, 26 mm si la page a peu de blocs) ;
   - s'il reste plus de 8 %, on desserre les espaces *internes* des blocs
     multi-lignes (grille de cartes, pile de paragraphes) : 10 mm max.

7. **Vérification** — chaque page construite est remesurée ; si le rendu réel
   déborde (dérive de mesure), les blocs de fin sont repoussés sur une page
   insérée. **Rien n'est jamais rogné.**

Le rapport renvoyé (pages, taux de remplissage, fragmentations, réparations) est
journalisé ; une section qui laisse une page sous 60 % déclenche un `warn` — c'est
un manque de contenu de l'agent, pas un défaut de mise en page.

## Ce que les prompts doivent garantir

Voir [`services/BusinessPlan/prompts/_shared.prompt.ts`](../api/services/BusinessPlan/prompts/_shared.prompt.ts) :
les agents ne gèrent plus aucun saut de page, mais doivent produire assez de
matière pour un nombre entier de pages (≈ 550-700 mots par page pleine, ou
350 mots + un graphe). Le seul défaut que le moteur ne peut pas corriger est le
manque de contenu.

Attributs reconnus dans le HTML généré :

| Attribut | Effet |
| --- | --- |
| `data-keep-together` | le bloc n'est jamais fragmenté (réduit à l'échelle si trop haut) |
| `data-keep-with-next` | le bloc reste collé au bloc suivant |

## Cas particuliers

- **Couverture** : passée dans `fixedPageSections`, elle est rendue telle quelle
  sur une page exacte (composition pleine page, jamais étirée ni redécoupée).
- **Plusieurs éléments racine** : si l'agent oublie le conteneur unique, ils sont
  enveloppés automatiquement (sinon tout sauf le premier serait perdu).
- **Pitch deck / charte graphique** (`multiPage: false`) : inchangé, une section
  = une page rognée. Ces documents profitent quand même de `prepare()`.

## Réglages

`PdfGenerationOptions.pagination` : `minFillRatio` (0.30), `maxGapAddMm` (12),
`balance` (true). Le runtime accepte en plus `maxGapAddHardMm` (26),
`maxInnerGapAddMm` (10) et `debug` (trace le plan et le remplissage page par page
dans `report.warnings`).
