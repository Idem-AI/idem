# Les recommandations du consultant, confrontées au code

Lecture du 12/11/2026. Le consultant a travaillé à partir des documents publics (`README.md`, `ICODE.md`,
`VIDEOS.md`, `DIRECTIONS.md`, `REVIEW.md`). Le code en fait déjà beaucoup plus que ces documents ne le disent.
Chaque ligne ci-dessous est vérifiée dans les sources, avec le fichier qui la porte.

| # | Recommandation | État | Où |
|---|---|---|---|
| 1A | Content-Aware Selection (éliminer ce qui ne peut pas tenir le contenu) | **déjà fait** | `catalog/assemble.ts` `assignUnits` : nombre de blocs, types admis, types évités, nombre total d'éléments, placement réel dans les zones. iCode : `sectionCatalog/compose.ts` `fitContent`. Vidéo : une mise en page n'est proposée qu'à une scène qu'elle montre **entière** |
| 1B | Score de compatibilité, critères éliminatoires séparés du classement | **déjà fait**, complété | Le filtre dur et le score sont déjà deux étages (`catalog/graph.ts`). Le score portait l'accord artistique, l'enchaînement, l'usure, la mémoire, les poids et le hasard de la graine. **Ajouté le 12/11 : le profil du contenu** |
| 1C | Mémoire des compositions, pas deux fois la même | **déjà fait** | `CatalogState` (`byIndex`, `use`, `seen`, `brandSkins`), `comboFingerprint`, `rememberFingerprints` (Redis, portée marque/compte/global selon le cran), et le filtre « jamais le même squelette que la page voisine » |
| 2 | Design DNA calculé une fois, partagé | **déjà fait** | `engine.host.ts` → `brandMemory` : « le langage visuel de la marque, écrit une fois par charte et relu par tous ses livrables », 180 jours. Plus `design-system/tokens` (couleurs, échelle typographique, rayons) et la fiche de direction artistique |
| 3 | Pipeline : code → liste courte → un appel → assemblage | **déjà fait** | `engine.ts` + `catalog/choose.ts`. Un appel par page au cran Medium+, un seul appel pour tout un film, un seul appel JSON pour toute une page iCode |
| 3A | Ne pas multiplier les agents | **déjà fait** | `foundation/effort.ts` : la seule table qui dit ce qui est délégué |
| 3B | Décision structurée, pas de justification | **déjà fait** | Le modèle renvoie une configuration (`PageConfig` / `config.json`), validée par schéma |
| 4A | Index en mémoire du catalogue | **non nécessaire aujourd'hui** | Le catalogue tient en `Map` et compte 290 nœuds images. Le parcours est O(n) par page, négligeable devant un rendu Chrome. À reconsidérer au-delà de ~2 000 nœuds |
| 4B | Caches multi-niveaux | **déjà fait** | Catalogue relu toutes les 15 s (ETag), langage de marque 180 j, empreintes en Redis, Chart.js en mémoire, `.review/cache` pour les aperçus |
| 4C | Prompt caching | **déjà fait** | Passe d'économie de jetons du 16/10 (préfixes stables, couverture sans raisonnement) |
| 4D | Régénération incrémentale | **déjà fait** | iCode : retouche ciblée d'une section (carte du site), `idem.plan.json` + « continue ». Documents : régénération `reuseOnly` sans appel au web. Vidéo : une scène se recalcule de sa configuration, sans modèle |
| 4E | Pool de navigateurs, compilations réutilisées | **déjà fait** | `runtime/browser.ts` : un Chromium partagé, gardé chaud |
| 4F | Rendu adaptatif (n'escalader qu'en cas de défaut) | **partiellement, et c'est voulu** | Un candidat qui échoue est déjà remplacé par le suivant ; les zones qui débordent sont remesurées jusqu'à trois passes. Les 2 ou 3 rendus de High/Ultra ne sont pas un gaspillage : ce sont les variantes que le juge compare. Les réduire ferait baisser la qualité, pas le coût utile |
| 4G | Chercher large avec le code, montrer peu au modèle | **déjà fait** | La liste courte vaut 4, 8 ou 12 candidats selon le cran ; le modèle ne voit jamais le catalogue |
| 5A | Contrôle technique déterministe | **déjà fait** | `runtime/check.ts` : texte coupé, superposé, colonne écrasée, cadre vide, contraste, logo rogné, page sombre |
| 5B | Juge visuel conditionnel | **déjà fait** | `host.judgeImage`, activé aux crans High et Ultra (`EFFORT.judge`) |
| 5C | Trois statuts de validation | **à faire — petit** | Le moteur sépare déjà `blocking` et `advisory` ; la revue du dépôt ne connaît que « validé / à corriger ». Voir plus bas |
| 6 | Asset Intelligence | **déjà fait en partie** | `asset-planner`, point focal (`[[focal .]]`), registre des ressources du projet, repli Pexels. Manque : les embeddings visuels pour retrouver une image proche |
| 8 | Learning Engine | **manquait — fait le 12/11** | Voir plus bas |
| 9 | Generation Analytics | **déjà fait**, complété | `observability/record.ts` : décisions, rôle, modèle, jetons, durée, issue, réparations, replis, constats. **Ajouté : la tenue de chaque nœud** |

## Ce qui a été ajouté le 12/11/2026

### 1. Le profil du contenu entre dans le classement

Le filtre dur savait déjà si une composition **peut** tenir le contenu. Il ne disait pas si elle lui **convient** :
une grille serrée choisie pour deux blocs légers reste vide, un squelette aéré pour huit blocs chargés étouffe.

`catalog/graph.ts` calcule désormais, sans un jeton, un profil : nombre de blocs, nombre d'éléments, signes de
texte, présence de média, et une **charge** rapportée à la surface de la toile (une page A4 tient
confortablement ~1 800 signes et 6 blocs). Il en tire une densité (`airy`, `balanced`, `dense`), confrontée à
celle que le nœud annonce, et un écart au remplissage visé par le squelette.

Le poids est volontairement modéré (±0,2 à ±0,3 contre ±0,45 pour l'accord artistique) : **le contenu départage,
il ne commande pas**.

### 2. Le classement apprend de l'usage réel

Le crochet existait depuis longtemps — `catalogOverrides.weights`, relu toutes les 15 s — mais **rien ne
l'alimentait** : les poids ne pouvaient être posés qu'à la main dans la console.

La chaîne complète est maintenant branchée :

1. **Le moteur mesure.** Chaque trace de page porte les nœuds qui l'ont composée
   (`GenerationTrace.nodes`) ; `recordFromTraces` en tire `GenerationRecord.templates` : pour chaque nœud, le
   nombre de pages servies, réparées, bloquées. Le moteur vidéo fait la même mesure sur ses scènes
   (mise en page, animations, transition, thème).
2. **L'API accumule.** `catalog-performance.service.ts` ajoute ces compteurs dans `catalog_performance`.
3. **Le graphe en tient compte.** `performanceWeights()` tire un poids de la part de pages livrées sans
   réparation ni constat, et `catalogOverrides` le fournit au moteur.

Trois garde-fous, parce qu'un classement qui apprend peut s'enfermer :

- **un nœud neuf garde le poids 1** tant qu'il n'a pas servi 12 fois : il n'est jamais puni d'être neuf ;
- **le poids reste borné** à [0,7 ; 1,3] : il départage, il ne décide pas à la place du graphe ;
- **la main de l'équipe multiplie la mesure** : un poids posé dans la console reste prioritaire.

Une page réparée compte contre **tous** les nœuds qui l'ont composée — le code ne sait pas lequel a fauté, et
c'est l'accumulation sur beaucoup de générations qui désigne le fragile.

## Ce que je n'ai pas fait, et pourquoi

| Recommandation | Raison |
|---|---|
| Index de recherche en mémoire | 290 nœuds : le parcours coûte moins qu'une milliseconde devant un rendu Chrome de plusieurs secondes. Optimiser ici serait du travail sans effet mesurable |
| Réduire les rendus de High/Ultra | Ces rendus **sont** la qualité : le juge compare des variantes mesurées. Moins rendre, c'est juger moins bien |
| Embeddings visuels pour les images | Vrai manque, mais c'est un chantier à part (indexation de toute la banque) |
| Trois statuts de validation | Le moteur distingue déjà `blocking` / `advisory`. Étendre la revue du dépôt à `production_ready` demande d'y faire entrer la licence des médias : à faire quand la banque d'images sera indexée |

### 3. Le coût par résultat accepté

C'était le point le plus juste du consultant : nous mesurions le coût d'un APPEL, jamais celui d'un **résultat
qu'on peut livrer**. `services/graphic/generation-analytics.service.ts` agrège les enregistrements déjà écrits :

| Mesure | Ce qu'elle dit |
|---|---|
| `acceptanceRate` | part des générations livrées sans constat bloquant |
| `firstPassRate` | part livrée du premier jet : ni réparation ni constat |
| `agentCallsPerGeneration` | appels de modèle par création |
| `costPerAcceptedUsd` | **le prix réel d'un résultat livrable**, au tarif de chaque modèle employé |
| `msMedian` / `msP95` | la durée médiane et le 95e centile — jamais la moyenne, qu'une génération ratée écrase |

```bash
npm run analytics:generation            # les 30 derniers jours, par livrable
npm run analytics:generation -- --by level --json
npm run check:analytics                 # le contrôle déterministe des deux services (aucun appel)
```

Le rapport liste aussi **les dix nœuds les plus fragiles** (au moins 12 usages, classés par part de pages
propres) : la même matière que les poids, mais lisible par un humain.

#### Ce que la mesure a déjà appris

Le contrôle cherche le seuil de bascule entre un petit et un gros modèle de la liste blanche
(`qwen3.5-9b` à 0,10 $/M contre `qwen3.5-397b-a17b` à 0,50 $/M en entrée). Résultat :

> **Il faut 9 échecs pour une réussite** avant que le gros modèle revienne moins cher.

Autrement dit, l'intuition « un petit modèle qui rate coûte plus cher » est **fausse dans nos ordres de
grandeur** : l'écart de prix est trop large. C'est exactement pourquoi il fallait mesurer au lieu de supposer.

## Ce qui reste

- **Embeddings visuels pour la banque d'images** : vrai manque, chantier à part.
- **Le statut `production_ready`** : attend l'indexation des licences de médias.
- **Un lot de référence** (10 sites, 10 flyers, 5 cartes, 5 BP, 5 decks, 5 vidéos) à passer avant/après chaque
  changement de moteur. `compare(before, after)` est prêt à le lire ; il manque le lot lui-même, et le passer
  coûtera des appels réels — c'est une décision de budget, pas de code.
