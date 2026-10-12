# Banc d'essai — ancien moteur (A) contre @idem/graphic-engine (C)

Généré par `npm run bench` le 2026-10-12. Corpus : pitch deck (6 p.), charte graphique (6 p.), business plan (4 p.), carte de visite (2 p.), flyer (1 p.) — 19 pages par cran.

## Méthode

- **A — ancien moteur** : moyennes PAR APPEL relevées dans les journaux de production avant la migration
  (`scratch/graphic-baseline/`), toutes jauges confondues. Le compositeur de page y écrivait le HTML lui-même.
- **C — nouveau moteur** : le corpus de référence composé, rendu et MESURÉ dans Chromium à chaque cran.
  Les agents sont simulés (réponses types, instantanées) : les jetons d'**entrée** sont ceux des vrais prompts ;
  la **sortie** est celle des réponses simulées, avec le **plafond** de chaque tâche en regard ; le **temps** est
  celui du moteur (composition, rendu, mesure, réparations), sans la latence d'un modèle.

## A — l'ancien moteur (par appel, journaux)

| Agent | Appels relevés | Entrée moy. | Sortie moy. | Durée moy. |
|---|---:|---:|---:|---:|
| pageComposer | 340 | 2 377 | 1 634 | 56 s |
| posterAuthor | 95 | 2 556 | 906 | 18,5 s |
| pageDirector | 183 | 518 | 34 | 3,1 s |
| posterCopywriter | 88 | 393 | 49 | 11,4 s |
| posterArtDirector | 39 | 560 | 12 | 12,3 s |
| documentFamily | 22 | 821 | 2 | 4,3 s |
| posterCreativeDirector | 14 | 805 | 1 023 | 15,9 s |
| documentCritic | 17 | 1 042 | 8 | 22,6 s |
| posterLayoutDesigner | 14 | 1 170 | 270 | 4,9 s |
| flyerConcept | 5 | 562 | 96 | 26 s |
| flyerArtDirector | 2 | 259 | 8 | 2,2 s |
| flyerCopywriter | 2 | 222 | 22 | 17,2 s |
| flyerStructure | 1 | 157 | 1 | 60,3 s |

Une page composée par l'ancien moteur coûtait au moins **4 563 jetons** (direction de page + compositeur, hors critique) et **56 s** de modèle.

## C — le nouveau moteur, par cran

| Cran | Pages | Appels de modèle | Appels / page | Entrée / page | Sortie / page (simulée) | Plafond de sortie / page | Moteur / page | Constats bloquants | Réparations par le code |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| low | 19 | 0 | 0.00 | 0 | 0 | 0 | 1 816 ms | 0 | 14 |
| medium | 19 | 0 | 0.00 | 0 | 0 | 0 | 1 730 ms | 0 | 7 |
| high | 19 | 34 | 1.79 | 407 | 40 | 2 305 | 1 972 ms | 0 | 13 |
| max | 19 | 34 | 1.79 | 487 | 53 | 2 705 | 1 664 ms | 0 | 13 |
| ultra | 19 | 53 | 2.79 | 1 116 | 120 | 9 705 | 1 957 ms | 0 | 14 |

## C — détail par livrable

| Cran | Livrable | Appels | Entrée | Motifs distincts | Silhouettes mesurées distinctes | Distance moyenne | Bloquants | Moteur / page |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| low | Pitch deck | 0 | 0 | 5 | 5/5 | 0.692 | 0 | 1 901 ms |
| low | Charte graphique | 0 | 0 | 5 | 5/5 | 0.686 | 0 | 1 552 ms |
| low | Business plan | 0 | 0 | 3 | 3/3 | 0.539 | 0 | 1 612 ms |
| low | Carte de visite | 0 | 0 | 1 | 1/1 | — | 0 | 1 488 ms |
| low | Flyer | 0 | 0 | — | — | — | 0 | 4 369 ms |
| medium | Pitch deck | 0 | 0 | 4 | 5/5 | 0.605 | 0 | 1 869 ms |
| medium | Charte graphique | 0 | 0 | 5 | 5/5 | 0.708 | 0 | 1 709 ms |
| medium | Business plan | 0 | 0 | 3 | 3/3 | 0.532 | 0 | 1 607 ms |
| medium | Carte de visite | 0 | 0 | 1 | 1/1 | — | 0 | 1 613 ms |
| medium | Flyer | 0 | 0 | — | — | — | 0 | 1 743 ms |
| high | Pitch deck | 12 | 2 661 | 4 | 5/5 | 0.712 | 0 | 1 708 ms |
| high | Charte graphique | 12 | 2 659 | 4 | 5/5 | 0.605 | 0 | 1 819 ms |
| high | Business plan | 4 | 1 270 | 3 | 3/3 | 0.575 | 0 | 1 733 ms |
| high | Carte de visite | 4 | 745 | 1 | 1/1 | — | 0 | 2 604 ms |
| high | Flyer | 2 | 392 | — | — | — | 0 | 4 170 ms |
| max | Pitch deck | 12 | 3 153 | 4 | 5/5 | 0.635 | 0 | 1 592 ms |
| max | Charte graphique | 12 | 3 198 | 5 | 5/5 | 0.506 | 0 | 1 672 ms |
| max | Business plan | 4 | 1 567 | 3 | 3/3 | 0.439 | 0 | 1 491 ms |
| max | Carte de visite | 4 | 874 | 1 | 1/1 | — | 0 | 1 405 ms |
| max | Flyer | 2 | 456 | — | — | — | 0 | 3 253 ms |
| ultra | Pitch deck | 18 | 7 047 | 0 | 5/5 | 1 | 0 | 1 545 ms |
| ultra | Charte graphique | 18 | 6 957 | 0 | 2/5 | 1 | 0 | 1 583 ms |
| ultra | Business plan | 8 | 4 202 | 0 | 3/3 | 1 | 0 | 1 485 ms |
| ultra | Carte de visite | 6 | 1 965 | 0 | 1/1 | — | 0 | 2 021 ms |
| ultra | Flyer | 3 | 1 034 | — | — | — | 0 | 8 438 ms |

## Lecture

- **Low et Medium** : zéro appel de modèle — le code compose, rend et mesure chaque page.
- **High** choisit dans un menu, **Max** choisit et règle en un appel, **Ultra** compose l'arbre de la page :
  le coût par page reste une fraction de celui de l'ancien compositeur, qui ÉCRIVAIT le HTML (sortie
  moyenne 1 634 jetons par page).
- La critique visuelle (High+) ne s'exécute que sur une page déjà juste ; elle départage des rendus valides.
- Les pages Ultra sont des arbres d'auteur (motif « authored ») : leur diversité se lit dans les silhouettes
  MESURÉES, pas dans les noms de motifs. Les mesures excluent la couverture. Ici, le compositeur SIMULÉ rend
  le même arbre pour chaque page : la diversité d'Ultra n'est pas mesurée par ce banc (elle dépend du modèle
  réel) ; ce qui l'est, c'est que chaque arbre est validé, rendu et mesuré sans constat bloquant.
- Les constats bloquants sont ceux qui restent APRÈS les réparations du code (textes ajustés, contraste
  ramené à l'encre de la charte, décor retiré, mise à l'échelle bornée, composition suivante) : c'est ce qui
  partirait chez le client.
