# Ancienne génération graphique contre @idem/graphic-engine

Comparaison en trois volets — **performance**, **coût en jetons**, **qualité** — rédigée le 2026-10-13.
Chaque chiffre dit d'où il vient : **mesuré** (relevé sur des exécutions réelles), **estimé** (calculé à partir
de mesures, avec l'hypothèse écrite) ou **non mesuré**. La section « Ce que cette comparaison ne dit pas »
est à lire avant de conclure.

## Sources

| Source | Contenu |
|---|---|
| `scratch/graphic-baseline/old-graphic-agents.txt`, `token-usage-real-logs.txt` | Journaux de **production** de l'ancien moteur : 4 884 événements, moyennes par appel et par agent, dépense par fonctionnalité |
| `scratch/graphic-baseline/logs/*`, `images/*` | Contrôles et rendus de l'ancien moteur, exécutés avant la migration (tag `pre-graphic-engine-migration`) |
| `docs/BENCHMARK.md` (`npm run bench`) | Nouveau moteur : 19 pages par cran (deck 6, charte 6, business plan 4, carte 2, flyer 1), rendues et mesurées dans Chromium. **Agents simulés** : les jetons d'entrée sont ceux des vrais prompts, la sortie est celle des réponses simulées |
| `npm run check:*` | 75 contrôles du moteur, 17 contrôles de l'API, 30 du cœur iVision |

## 1. Coût en jetons

### Ce que coûtait la composition graphique

Moyennes **mesurées** par appel (production, tous crans confondus) :

| Agent de l'ancien moteur | Appels | Entrée | Sortie | Durée |
|---|---:|---:|---:|---:|
| pageComposer (écrit le HTML d'une page) | 340 | 2 377 | 1 634 | 56 s |
| posterAuthor (écrit le HTML d'un visuel) | 95 | 2 556 | 906 | 18,5 s |
| pageDirector (choisit la mise en page) | 183 | 518 | 34 | 3,1 s |
| posterCreativeDirector, posterLayoutDesigner, critique, art directeurs… | 100 | 160 à 1 170 | 1 à 1 023 | 2 à 60 s |

Part dans la dépense **mesurée** : les agents graphiques représentent environ **1,94 M de jetons sur 5,75 M**
journalisés, soit **34 %** (≈ 3,3 $ sur 10,3 $, à 1,7 $ le million de jetons en moyenne, 1,3 à 1,9 selon la
fonctionnalité). Le seul `pageComposer` pèse 1,36 M (24 %).

### Coût par page, par cran

Hypothèses : l'ancien moteur appelait le directeur de page à High, le compositeur 2 fois à Max et 4 fois à Ultra
(3 essais + 1 tour de finition, d'après l'ancienne documentation de la jauge) ; le nouveau moteur est mesuré
sur son corpus. Document de 20 pages, 1,7 $ le million.

| Cran | Ancien (**estimé**) par page | Nouveau (**mesuré**) par page | Ancien, 20 pages | Nouveau, 20 pages |
|---|---:|---:|---:|---:|
| Low | 0 | 0 | 0 | 0 |
| Medium | ≈ 40 (famille, une fois par document) | 0 | ≈ 1 k · 0,001 $ | 0 |
| High | 552 | 441 (407 entrée + 34 sortie simulée) | 11 k · 0,02 $ | 9 k · 0,015 $ |
| Max | 8 574 | 540 | 171 k · 0,29 $ | 11 k · 0,018 $ |
| Ultra | 16 596 | 1 236 simulé ; **≈ 2 000 réaliste** | 332 k · 0,56 $ | 25 k simulé, **≈ 40 k réaliste** · 0,04 à 0,07 $ |

Lecture : à Max, le nouveau moteur coûte **≈ 16 fois moins**; à Ultra, **≈ 8 à 13 fois moins**; à Low et Medium,
**rien**, dans les deux cas pour les pages (Medium ajoutait un appel par document). À High, c'est équivalent.

Le « réaliste » d'Ultra tient compte du fait que la sortie du compositeur simulé est minuscule. Un arbre de page
généré par le code pèse **192 à 258 jetons** (médiane 252, **mesuré** sur six pages) ; on suppose qu'un modèle écrit
300 à 800 jetons d'arbre. Le plafond de sortie du moteur est de 7 000 jetons par arbre.

### Visuels (flyers, publications)

Les mots du visuel (rédacteur, ≈ 440 jetons) restent identiques dans les deux moteurs. Ensuite :

| Cran | Ancien (**mesuré par appel**, nombre de tours **estimé**) | Nouveau (**mesuré**, sortie simulée) |
|---|---|---|
| Low, Medium | 0 | 0 |
| High | directeur artistique 572 + critique visuelle | 392 par visuel + critique |
| Max | + concepteur de mise en page 1 440, boucle de 3 tours | 456 par visuel |
| Ultra | directeur de création 1 828 + 2 auteurs HTML de 3 462 chacun, boucle de 4 tours : **≥ 8 750 par concept, plutôt 20 à 30 k** | **1 034 + 136** par visuel |

### Les prompts d'écriture

Le rédacteur de contenu existe dans les deux cas (c'est l'essentiel du coût de la charte : 709 appels, 2,0 M de
jetons). Son prompt a changé :

| Prompt | Avant (**mesuré**) | Maintenant |
|---|---:|---|
| Page de charte (rédacteur de section) | ≈ 6 650 jetons | brief 785 + contrat de sortie 390 + règles d'écriture 342 + volume 81 = **1 598** (**mesuré**), plus le préfixe projet (**non mesuré**, estimé 0,8 à 1,5 k) : **≈ 2,4 à 3,1 k** |
| Contrat de sortie, business plan / deck / charte | — | 792 / 718 / 390 |
| Plan de section (2 temps) | — | 236 |

L'ancien prompt portait aussi les règles de balisage (Tailwind, mise en page) : le modèle n'écrit plus de HTML.

### Estimation globale

Si les décisions graphiques du même trafic passaient par le nouveau moteur au rapport de coût ci-dessus
(≈ 10 fois moins), les ≈ 1,94 M de jetons graphiques tomberaient à ≈ 0,2 M : **environ 30 % de jetons en moins sur
l'ensemble du trafic journalisé**. C'est une **estimation** : elle suppose le même mélange de crans qu'en production
et ne compte pas les appels de vision de la critique (High et au-dessus), présents dans les deux moteurs.

## 2. Performance

| Mesure | Ancien | Nouveau |
|---|---|---|
| Latence de modèle par page, Max/Ultra | `pageComposer` **56 s** par essai (**mesuré**), donc 56 s à 4 min par page | appels courts : choix et réglage ≈ 3 à 12 s (durées **mesurées** d'agents de même taille de l'ancien moteur), arbre d'auteur ≈ 18 s (idem `posterAuthor`) — **estimé** 5 à 25 s |
| Temps de moteur par page (composition, rendu, mesure, réparations) | **non mesuré** | **1,5 à 2,0 s** par page de document, 1,5 à 4,4 s par visuel de Low à Max, 8,4 s à Ultra (**mesuré**, banc d'essai) |
| Low et Medium | rendu par gabarits (secondes pour tout le document) | **aucun appel de modèle** : 1,7 à 1,8 s par page, déterministe |
| Reprises coûteuses | un essai refusé = un nouvel appel de 56 s | une réparation par le code coûte une remesure dans Chromium (durée **non mesurée** séparément, comprise dans les 1,5 à 2,0 s par page) ; l'appel de modèle n'intervient qu'en dernier recours (réparation ciblée, High et au-dessus) |
| Chromium | un navigateur par service de rendu | un navigateur **partagé** avec le service PDF (hôte IDEM) |

Un point à ne pas oublier : à Low et Medium, le nouveau moteur ouvre Chromium pour chaque page (ajustement,
contraste, décor), là où un gabarit pur n'avait pas besoin de navigateur ; le surcoût exact n'a pas été mesuré
contre l'ancien rendu.

## 3. Qualité

### Mesures

| Critère | Ancien | Nouveau |
|---|---|---|
| Pages avec un constat **bloquant** après réparations | Ultra : **26 pages refusées sur 29** (journaux du 2026-10-12) — le cran Ultra rendait en fait des pages de gabarit. Corpus du banc d'essai : **non mesuré** | **0 sur 95** (19 pages × 5 crans), **mesuré** |
| Contrôle d'impression du business plan (même protocole, mêmes volumes) | **2 échecs sur 11** : 1 phrase perdue, une bande blanche de 41 % en page 4 | **0 échec sur 11** |
| Phrases perdues à l'impression | 1 | 0 |
| Pages vides, fins de section creuses | corrigées par le paginateur, avec la phrase perdue ci-dessus | idem, et le paginateur coupe maintenant à travers une enveloppe à enfant unique (un long texte n'est plus déplacé entier puis réduit) |
| Contraste | corrigé par `pageInspect`, seulement à Ultra, ou refusé | **mesuré sur chaque texte** à chaque rendu, **réparé** vers l'encre de la charte (`fix_contrast`) |
| Déterminisme | Low et Medium oui ; High et au-dessus : le modèle écrivait le HTML, donc non | Low et Medium oui ; High : le modèle choisit dans un menu ; Ultra : un arbre **validé** (primitives autorisées, aucun texte libre) |
| Chiffre inventé ou texte ajouté dans une page | possible (le modèle écrivait la page), filtré après coup par un contrôle de chaîne | **impossible par construction** dans la couche page : l'arbre ne désigne que des blocs du contenu ; les tableaux et chiffres exacts sont posés par le code |
| Couleur ou police hors charte | ramenée après coup (`enforceDesignRules`, retiré au-dessus de Medium) | impossible : le compilateur écrit chaque style depuis les jetons |
| Variété entre projets | 60 familles ; deux familles les plus proches : 11 % de cellules différentes, médiane 33 % (**mesuré**) | 65 motifs ; **30 documents distincts sur 30 projets** de même style et de même palette ; 9 à 13 compositions sur 20 projets, dans chaque style ; jamais la même composition sur deux pages voisines ; au pire 7 motifs sur 9 pages (**mesuré**) |
| Changement d'identité | traduction par table de jetons | idem, plus les teintes dérivées et la palette des graphiques **recalculées** (aucune couleur de l'ancienne marque ne survit sur 4 palettes difficiles × 12 pages, **mesuré**) |

Les deux métriques de variété ne sont pas comparables entre elles (cellules de silhouette contre empreintes de
composition) ; elles disent chacune que le moteur ne produit pas deux fois la même page.

### Rendus côte à côte (même marque de test, trois pages, jugement visuel d'une seule personne)

- **Page de règles de la direction artistique** : les deux sont propres. L'ancienne centre le titre dans un cadre ;
  la nouvelle l'aligne à gauche avec un filet, et ses coches ont désormais le contraste d'un texte. Qualité
  **comparable** : ces pages sont composées par le code dans les deux moteurs.
- **Page des bannières réseaux** : la nouvelle compose de vraies bannières (logo, signature, séparateur). L'ancienne
  montrait pour Facebook un grand aplat moutarde avec un point blanc au milieu. **Net progrès**.
- **Couverture** : équivalentes en finition ; la nouvelle varie d'un projet à l'autre (2 à 3 compositions différentes
  sur 4 projets, sur chaque toile, **mesuré** par `check:covers`).

Conclusion de ce volet : à **Low et Medium**, la qualité visuelle est **proche** de l'ancienne — le gain est
d'abord en fiabilité (rien de bloquant, rien de perdu) ; l'écart se joue à **High et au-dessus**, où l'ancien
moteur confiait la page à un modèle qui se faisait refuser neuf fois sur dix.

## Ce que cette comparaison ne dit pas

1. **Aucun essai avec de vrais modèles sur le nouveau moteur.** Les agents sont simulés : la qualité de High, Max
   et Ultra avec un vrai modèle (choix pertinents, arbres d'auteur variés) n'est **pas mesurée**. C'est le principal
   risque restant.
2. **Le plafond créatif est volontairement plus bas.** Un arbre d'auteur est limité aux primitives du moteur ; un
   modèle ne peut plus inventer une mise en page libre en HTML. On échange de la liberté contre de la garantie :
   si la variété d'Ultra avec un vrai modèle se révèle insuffisante, il faudra enrichir les primitives et les motifs.
3. **Le banc d'essai Ultra ne mesure pas la diversité** : le compositeur simulé rend le même arbre partout (charte
   Ultra : silhouettes 2/5).
4. **L'ancienne qualité par page est connue par les journaux, pas par un corpus identique.** Les chiffres de
   l'ancien moteur viennent de la production et de ses propres contrôles ; seuls les rendus de trois pages ont pu
   être confrontés à l'œil.
5. **Les coûts sont estimés au prix moyen de la période** (1,3 à 1,9 $ le million) ; le prix réel dépend du
   modèle routé. Les appels de vision de la critique ne sont comptés dans aucun des deux.
6. **La latence réelle de bout en bout** (parallélisme des sections, files d'attente) n'a pas été mesurée.

## Pour trancher avec de vraies données

1. Générer sur **20 projets réels** un business plan, une charte et un deck à Medium, High et Ultra, avec le moteur
   branché sur les vrais modèles ; lire `graphic.trace` (jetons, durées, réparations, `refused`/`failed`).
2. Faire noter **à l'aveugle** 10 pages par cran (ancien tag contre nouveau) sur lisibilité, hiérarchie, fidélité à la
   marque, originalité.
3. Suivre pendant deux semaines la part de constats bloquants (`graphic.page_blocking`) et le taux de retour au code
   après refus d'un modèle (`creative.*` avec issue `refused` ou `failed`).
4. Relancer `npm run bench` après chaque changement du moteur : le tableau « par cran » de `BENCHMARK.md` est la
   référence de coût et de temps de moteur.
