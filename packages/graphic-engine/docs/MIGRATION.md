# Migration vers @idem/graphic-engine (octobre 2026)

L'ancienne génération graphique d'IDEM — un modèle qui écrivait le HTML des pages, des posters et des
cartes, puis des linters et des réparateurs qui tentaient de rattraper ce qu'il avait produit — est
**entièrement retirée**. Business plan, charte graphique, pitch deck, cartes de visite et visuels passent
désormais par un seul moteur, ce paquet. Repère de retour : le tag git `pre-graphic-engine-migration`.

## Ce qui a changé, livrable par livrable

| Livrable | Avant | Maintenant |
|---|---|---|
| Business plan | rédacteur → gabarits `sectionRenderer` (60 familles), et au-dessus de Medium un compositeur qui écrivait la page en HTML (`pageComposer`, `pageInspect`) | rédacteur → blocs (`contentContract`) → page composée par le moteur (A4 portrait, paginée), au cran demandé |
| Pitch deck | idem en 16:9, plus des passes de « polissage » et d'images par slide | idem (`slide-16x9`) ; aucune passe qui réécrit la page |
| Charte graphique | pages libres en HTML écrites par le modèle (logo, palette, typographie…) + gabarits | pages rédigées : spécimens posés par le code + texte d'usage ; pages de direction artistique et réseaux entièrement posées par le code ; couverture par le moteur |
| Cartes de visite | six rectos / cinq versos du code (`businessCardLayouts`) et cartes d'auteur en HTML | six rectos / quatre versos du moteur, gabarit à marqueurs, plancher d'impression 8,5 px, champs ajustés à l'export et dans l'aperçu |
| Visuels (Communication, iVision) | moteur de posters (`visual/poster/*` : gabarits, mise en page IA, HTML d'auteur, boucle de conception) | mots et photo dans le cœur iVision, page par le moteur (`renderSingle`, toiles `flyer-*`) ; retouche écrite = mots seulement |
| Bannières et avatars de la charte | `bannerCompose`, `bannerTemplates` | motifs `banner.*` / `avatar.*` du moteur |
| Rapport financier | thème recalculé localement | thème lu dans les jetons du moteur (`Finance/finance-theme.ts`) : mêmes couleurs et polices que le business plan |

## Ce qui a été supprimé

- API : `services/design/*` (graine, familles, rendu par gabarit, couverture, linter anti-générique, retenue
  éditoriale, contrat de contenu, plan de section, récupération HTML), `services/creativity/{documentDesign,
  pageComposer, pageInspect}.ts`, les prompts HTML du business plan, du deck et de la charte, les
  mises en page et agents des cartes, les gabarits de bannières, les rendus de flyers.
- Cœur iVision : `visual/poster/*` et son kit, `visual/flyer.*`, `design/{compositionGrid, visualAudit,
  slopLint, layoutFamilies, layoutPresets, pageDecor, uiKit, designSeed, antiSlop.prompt, diagramRender,
  diagramTheme}`, le contrôle `check:poster`.
- Données mortes du catalogue des directions artistiques (`seedSpace`, `tailwindRecipe`, `typePairings`,
  `antiPatterns`, `borders`, `shadows`) et les blocs de prompts qui ne servaient qu'à l'ancien HTML
  (`buildArtDirectionBlock`, `buildLogoBlock`, `buildStyleSheet`).
- Les contrôles de l'ancien moteur (`check:render`, `check:fit`, `check:flyer`) ; les autres ont été
  réécrits sur le moteur (`check:design`, `check:uniqueness`, `check:prompts`, `check:salvage`,
  `check:brand`, `check:covers`, `check:mockups`, `check:bpquality`, `check:creativity`), et
  `check:graphic` lance les contrôles du moteur.

Les règles d'écriture qui portaient sur le TEXTE ont été gardées et rassemblées dans `WRITING_RULES`
(vocabulaire banni, remplissage, références et chiffres inventés, grandiloquence).

## Les documents déjà produits

- Ils restent lisibles, éditables et imprimables. Le service PDF et l'éditeur de documents chargent
  toujours Tailwind pour l'ancien HTML ; une page du moteur porte ses styles en ligne et ses polices dans
  son en-tête, et son rendu est identique avec ou sans Tailwind (mesuré). Le rendu des cartes et celui
  des visuels reconnaissent une page du moteur (`class="ge-page"`) et n'injectent Tailwind que pour les
  anciennes.
- Un changement d'identité les traduit comme avant (`services/brand/brandRewrite.ts`). Pour les pages du
  moteur, la traduction refait aussi les couleurs DÉRIVÉES (un mélange exact de deux jetons, une
  variante de clarté d'un jeton) et RECALCULE la palette des graphiques pour la nouvelle marque.
- Une régénération recompose avec le moteur.

## Ce que le moteur a corrigé au passage

- Le paginateur du PDF coupe désormais à travers une enveloppe à enfant unique (marges, grilles, mesure
  de lecture) : un long texte n'est plus déplacé entier puis réduit sur la page suivante.
- Le pied de section d'une page du moteur est une rangée marquée : seul sur une page, il est retiré.
- Un texte trop pâle sur son fond réel est ramené vers l'encre de la charte (`fix_contrast`), au lieu
  d'être livré illisible.
- Deux pages voisines ne reçoivent jamais la même composition.

## Déploiement

- Paquet du workspace racine (`packages/graphic-engine`), présent dans `package-lock.json`.
- Les applications compilent ses sources (`paths` vers `src/index.ts`) ; les images de production
  (`Dockerfile/prod/Dockerfile.api`, `Dockerfile.ivision-api`) copient la version compilée dans
  `node_modules/@idem/graphic-engine`.
- L'API branche le moteur dans `services/graphic/engine.host.ts` : le Chromium partagé du service PDF, la
  garde réseau des rendus, Redis pour la mémoire de diversité (30 jours), les traces `graphic.trace`.

## Vérifier

```bash
npm run check:graphic-engine            # le moteur (Chromium compris)
cd apps/api && npm run check:all        # l'API, dont les livrables graphiques
cd apps/ivision/core && npm run check   # le cœur iVision, dont un visuel composé par le moteur
```

Le banc d'essai (`npm run bench`, `docs/BENCHMARK.md`) compare l'ancien moteur et celui-ci, par cran :
appels de modèle, jetons, temps de rendu, constats et réparations.
