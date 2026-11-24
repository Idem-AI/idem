# Moteur de logos — vers une synthèse mathématique, type par type

> Étude du 23/11/2026, lots 2 à 6 réalisés le 24/11/2026 : les recommandations reçues d'un autre
> agent, vérifiées contre le code et contre les publications citées, puis implémentées et mesurées.
> Code : `apps/api/api/services/logo-engine/` · Contrôles : `npm run check:logo` · Calibration : `npm run calibrate:logo`.

---

## 1. En une page

**Le constat qui compte le plus.** Avant ce lot, sur un lot de 24 candidats du planificateur,
**24 étaient « acceptés » avec un score de 100**. Le rapport qualité mesurait l'*exploitabilité*
(contraste, lisibilité à 16 px, marges), pas la qualité : il ne classait rien. La sélection des
trois propositions se faisait donc presque uniquement sur la distance entre empreintes.

**Ce qui a été fait (lot 1, zéro jeton, hors ligne) :**

| Brique | Ce qu'elle apporte | Mesure |
|---|---|---|
| Perception sur pixels (`raster/perception.ts`) | symétrie (miroirs, rotations Cn), topologie (β0 morceaux, β1 trous), régularité du trait, compacité, moments de Hu, rythme des lettres | — |
| Profil par type (`validate/perception.ts`) | chaque type de logo jugé sur ses propres critères + la composition jugée à part | la note s'étale de **57 à 100** dans un même lot (avant : tout à 100) |
| Trois dimensions dans le Logo IR | `concept.type` (archétype) · `composition.layout` · `concept.style` + `concept.symmetry` | IR rétrocompatible |
| Symétrie par construction | répétition `dihedral` (Dn), recette `abstract-group` (motif × groupe × centre) | symétrie promise tenue sur **10/10** symboles (0,93–0,996) |
| Affineur (`planner/optimize.ts`) | stratégie d'évolution (1+1), pas adaptatif, graine fixe | **18 candidats sur 50 améliorés, +7 points** de note perceptive en moyenne, 236 ms par candidat |
| Empreinte 2.0 | + Hu, Betti, groupe de symétrie, rondeur ; case de diversité (MAP-Elites) | un symbole tourné : distance **0,15** au lieu de 0,27 |

**Ce que les mathématiques ne résolvent pas — et que la planche d'essai montre :** pour une
joaillerie de luxe, le planificateur sans IA a proposé un chat et une maison ; pour un
organisateur de concerts, un livre. Ces logos sont géométriquement impeccables et notés 95+.
**Le sens n'est pas une propriété géométrique.** Il reste le travail d'un agent (voir § 5, lot 2).

---

## 2. Les recommandations reçues, vérifiées une par une

| Recommandation | Verdict | Pourquoi |
|---|---|---|
| Garder Logo IR, Paper.js, OpenType.js, Node | **D'accord** | Paper.js n'est pas le goulot (33 ms par logo mesurés le 20/11) |
| Grammaire de formes (Li et al., *Leonardo*) | **D'accord, déjà commencé** | l'IR est déjà un arbre typé (booléens, répétitions, groupes) ; il manquait des **règles** — la recette `abstract-group` en est la première |
| Groupes de symétrie Cn / Dn | **D'accord, fait** | `radial` existait (Cn) ; `dihedral` ajouté ; la symétrie est désormais **promise dans le document et mesurée** |
| Évaluation esthétique (Zhang et al., ACM TAP 2017) | **D'accord, fait en partie** | publication vérifiée : 60 logos N&B, 60 juges, corrélation > 0,87 sur équilibre/contraste/harmonie. Nos critères en sont inspirés, **leurs formules exactes ne sont pas reprises** (texte intégral non consulté) |
| Nombre d'or (Img2Logo, CGF 2023) | **Option, pas une loi** | Img2Logo part d'une *image* pour l'abstraire en arcs — ce n'est pas notre cas. Pittard et al. (2007) concluent à une préférence universelle ; une étude de 2025 sur 4 835 personnes dans 10 pays la conteste. À proposer comme *système de proportions* parmi d'autres (1, √2, φ, 2) |
| Courbes G2, log-esthétiques | **Plus tard** | nos symboles sont faits de cercles, d'arcs et d'ellipses, déjà réguliers. Utile seulement pour le dessin libre (`path`) de l'auteur Ultra |
| Fermeture gestaltiste (Tseng & Chuang 2024) | **D'accord** | à exploiter dans la grammaire : anneaux ouverts, formes interrompues. Mais **attention** : la planche montre que des motifs trop séparés deviennent des « icônes de chargement » — la topologie le pénalise maintenant |
| CMA-ES, NSGA-II, Differential Evolution | **Trop lourd ici** | 2 à 10 paramètres, 236 ms par évaluation : une (1+1)-ES suffit et améliore déjà 36 % des candidats. NSGA-II n'a pas de sens pour 3 propositions ; la case de diversité (MAP-Elites) fait le travail de diversité |
| Empreinte Hu + Fourier + Zernike + Betti + graphe | **Hu et Betti seulement** | le rendu « symbole seul » **recadre déjà** l'encre : position et échelle étaient couvertes. Le vrai trou était la **rotation**, couverte par Hu. Fourier/Zernike n'apporteraient presque rien de plus |
| DOGS (arXiv 2610.10760, oct. 2026) | **L'idée, pas la méthode** | publication vérifiée (prépublication). Retenu : un vocabulaire fermé et typé, des relations explicites, une récompense reconnaissance × esthétique × originalité. Pas besoin de GFlowNet : notre planificateur + affineur + note perceptive jouent ce rôle sans entraînement |
| Visual Moment Equilibrium (*Symmetry* 2026) | **Déjà équivalent** | publication vérifiée ; elle porte sur des interfaces. Notre critère d'équilibre (centre de masse ↔ centre de la boîte d'encre) suit le même principe |
| « Supprimer le mode Ultra obligatoire » | **Pas tel quel — à décider** | le chiffre (≈ 14 500 jetons) vient bien de notre doc. Mais Ultra est ce qui **choisit le sens** ; sans lui, on obtient le chat de la joaillerie. Proposition au § 5 : réduire Ultra à un appel « sens » court, la forme au code |
| Trois dimensions : archétype / composition / style | **D'accord, fait** | `concept.style` et `concept.symmetry` ajoutés, sans casser les IR déjà en base |
| Un moteur mathématique par type | **D'accord** pour l'évaluation (fait : 11 profils) ; **en partie** pour la construction (lot 3) | un socle géométrique commun, des solveurs spécialisés là où le type l'exige (nom, monogramme, sceau) |

---

## 3. Les trois dimensions d'un logo

Un logo n'est plus décrit par une seule étiquette. Exemple réel produit par le moteur :
un **abstrait** (archétype), en composition **horizontale**, de style **géométrique**,
de symétrie **D6** — chaque dimension est lue par une partie différente du moteur.

| Dimension | Champ du Logo IR | Qui la lit |
|---|---|---|
| Archétype — *de quoi est fait le logo* | `concept.type` (11 types) | profil de perception, recettes, bonnes pratiques |
| Composition — *comment les éléments s'organisent* | `composition.layout` | note de composition (masse, centre optique, respiration) |
| Construction — *comment les formes sont dessinées* | `concept.style`, `concept.symmetry` | grammaire, mesure de la symétrie promise, affineur (qui ne change jamais l'ordre d'un groupe déclaré) |

La symétrie stricte ne s'applique **qu'au symbole** : un nom en miroir ne se lit plus. Pour le
nom, le moteur garantit l'axe, la ligne de base et le centre optique (§ 4.2).

---

## 4. Ce qui est implémenté (lot 1)

### 4.1 Mesures perceptives — `raster/perception.ts`

Toutes sur un masque binaire (alpha ≥ 128), poussières écartées.

| Mesure | Définition | Sert à |
|---|---|---|
| Symétrie | IoU de l'encre avec son miroir gauche/droite, haut/bas, sa rotation de 180° et de 90°, autour de la boîte d'encre ; pour un groupe déclaré Cn, rotation de 360°/n **autour du centroïde** | reconnaître `mirror`, `C2`, `C4`, `D2`, `D4` ; vérifier une promesse `C3`…`D8` |
| Topologie | β0 = morceaux d'encre (8-connexité), β1 = trous (fond enfermé, 4-connexité), χ = β0 − β1 | simplicité structurelle, empreinte |
| Régularité du trait | transformée de distance chanfrein 3-4, crêtes (axe médian) ; 1 − coefficient de variation de la demi-épaisseur | monoligne, graisses qui se contredisent |
| Compacité | 4πA/P² (périmètre corrigé du crénelage) | rond ↔ découpé ; case de diversité |
| Moments de Hu | 7 invariants (position, échelle, rotation), échelle logarithmique | empreinte de silhouette |
| Rythme des lettres | glyphes = composantes (points et accents regroupés) ; pour chaque paire, distance horizontale moyenne de l'encre de gauche à celle de droite, ligne par ligne ; 1 − CV | espacement optique d'un nom |
| Contre-formes | trous à 32 px ÷ trous à 160 px | une lettre qui « se bouche » en petit |

### 4.2 Profils par type — `validate/perception.ts`

| Type | Critères pondérés | Formes attendues |
|---|---|---|
| wordmark | rythme 0,5 · contre-formes 0,25 · trait 0,25 | — |
| lettermark | contre-formes 0,3 · équilibre 0,3 · trait 0,25 · symétrie 0,15 | ≤ 4 morceaux |
| letterform | équilibre 0,35 · contre-formes 0,3 · trait 0,25 · topologie 0,1 | ≤ 3 morceaux |
| pictorial | compacité 0,25 · équilibre 0,25 · topologie 0,2 · trait 0,15 · symétrie 0,15 | compacité 0,12–0,8, ≤ 3 morceaux |
| abstract | symétrie 0,25 · topologie 0,25 · équilibre 0,25 · trait 0,15 · compacité 0,1 | ≤ 3 morceaux |
| mascot | équilibre 0,3 · topologie 0,25 · compacité 0,25 · symétrie 0,2 | silhouette d'un tenant (≤ 2) |
| combination | équilibre 0,3 · symétrie 0,2 · topologie 0,2 · trait 0,15 · compacité 0,15 | + composition à **45 %** |
| emblem | symétrie 0,35 · équilibre 0,35 · contre-formes 0,15 · compacité 0,15 | — |
| dynamic | comme abstract, plus tolérant (≤ 5 morceaux) | — |
| minimal | topologie 0,3 · compacité 0,3 · équilibre 0,2 · symétrie 0,2 | ≤ 2 morceaux, ≤ 1 trou |
| negative-space | vide enfermé 0,35 · équilibre 0,25 · topologie 0,2 · symétrie 0,2 | vide 10–65 % de l'encre |

**Composition**, jugée dès qu'un symbole et un nom coexistent, **quel que soit le type**
(30 % de la note, 45 % pour un combination) :

| Mise en page | Masse (aire symbole ÷ aire nom) | Centre optique | Respiration |
|---|---|---|---|
| horizontale | 0,45–2,2 | centre de masse du symbole ↔ milieu des lettres, écart ≤ 4 % | 0,18–0,42 × hauteur du symbole |
| empilée | 0,3–2,6 | axe vertical partagé, écart ≤ 3 % | 0,12–0,4 × hauteur du symbole |

**Règles d'usage :**
- La note perceptive **ne refuse rien** (cohérent avec la règle « aucun contrôle esthétique
  couperet » de la jauge). Elle **classe** : `rankScore = 0,4 × exploitabilité + 0,6 × perception`,
  utilisé par la sélection, le tri des brouillons et la dominance du jury.
- Seule exception : une **symétrie déclarée non tenue** (< 0,90) produit le défaut
  `symmetry_broken`, parce que c'est une promesse de construction.
- Les seuils sont des **valeurs de départ**. Ils doivent être recalés sur des jugements humains (lot 6).

### 4.3 Symétrie par construction

- `repeat.mode = 'dihedral'` : n rotations du motif **et de son miroir**. Un seul motif dessiné,
  la symétrie est exacte par construction.
- Recette `abstract-group` : motif (pétale, feuille, crochet, coin, barre, point, chevron) ×
  groupe (C3–C8, D3–D8) × rayon × centre (vide, œil creusé, point d'accent). Le motif est
  dimensionné pour toucher ses voisins (corde 2r·sin(π/n)) : la rosace se lit d'un seul tenant.
- Le choix rotation ↔ miroir suit la personnalité : marques calmes, luxe, classiques → miroirs
  (stabilité perçue, Wu 2025) ; jeunes, ludiques, tech → rotation (mouvement).

### 4.4 Affineur — `planner/optimize.ts`

(1+1)-ES, règle du 1/5, graine du document. Il modifie un ou deux réglages numériques
(paramètres des générateurs, rayon et ordre des répétitions, `gap` et `symbolScale`),
reconstruit, mesure, garde ce qui améliore la note. **Il ne touche jamais** au type, aux motifs,
aux couleurs, au texte, ni à l'ordre d'une symétrie déclarée. Le résultat repasse le pipeline
complet ; s'il est moins bien classé ou moins exploitable, l'original est gardé.
Appliqué aux 6 meilleurs candidats du lot, 8 essais chacun (`REFINE`).

### 4.5 Empreinte 2.0 et diversité

L'empreinte enregistre aussi `hu`, `topo`, `sym`, `round`. La distance de forme devient
`0,25 × grille + 0,12 × min(grille, silhouette) + 0,08 × structure`. Les empreintes anciennes
(sans ces champs) restent comparables à l'ancienne formule.
La **case de diversité** (structure × symétrie × rondeur) pénalise deux propositions qui tombent
dans la même case : trois propositions, trois silhouettes différentes.

### 4.6 Coûts mesurés (machine locale, police Liberation Sans)

| Étape | Avant | Après |
|---|---|---|
| Un logo construit + mesuré + corrigé | 45 ms | ≈ 80 ms (1,4 s ÷ 17 candidats) |
| Lot du planificateur (17 candidats) | ≈ 0,8 s | 1,3–1,5 s sans affinage · 2,8–3,4 s avec |
| Jetons | 0 | 0 |

---

## 5. Lots 2 à 6 — réalisés le 24/11/2026

### Lot 2 — Le sens par l'IA, la forme cherchée par le code

- **Le cran des logos passe d'Ultra à High** (`LOGO_LEVEL` dans `controllers/branding.controller.ts`,
  une constante : remettre `'ultra'` suffit à revenir en arrière). High = **un seul appel** : le
  directeur lit la fiche marque, nomme les clichés du métier et choisit trois directions (type,
  motif ou variante, source de l'idée). Tout le reste est fait par le code. Conséquence : OmniSVG,
  réservé à Ultra, n'intervient plus dans la session de logos.
- **Recherche dans chaque direction** (`searchDirection`) : 6 constructions de la direction choisie,
  mesurées par le profil du type, les 2 meilleures affinées. Aucun jeton (le jury n'existe qu'en Ultra).
- **Fidélité aux directions** : un générateur choisi par le directeur est toujours dessiné. Trois
  défauts corrigés en route — la recette de symétrie du lot 1 pouvait remplacer le motif choisi ;
  la variante « répétition » de l'abstrait et les variantes « lettre » et « croissant » de l'espace
  négatif ignoraient aussi le générateur imposé ; le filtre de tons écartait un motif à deux tons.
  La variante d'un *letterform* choisie par le directeur était également ignorée.
- **Vocabulaire du directeur** : `abstract | sym-<motif>` (grammaire des symétries),
  `lettermark | monogram`, `letterform | counter`, et le générateur `lusona`.
- Tirage des recettes **pondéré** (le poids ne servait qu'à exclure).

### Lot 3 — Un solveur par type

| Type | Solveur | Où | Mesure |
|---|---|---|---|
| wordmark | **espacement optique** : profils gauche/droit ligne par ligne, profondeur bornée à 25 % de la capitale, espaces égalisés (±20 % par paire) — `spacing: 'optical'` | `render/typeSolvers.ts` | rythme « Tawalo » 0,74 → 0,91 ; « AVATAR » 0,88 → 0,99 |
| lettermark | **fût partagé** : décalage où le dernier trait de l'une coïncide avec le premier de l'autre sur ≥ 45 % de la hauteur ; sinon, contact + fusion — effet `shareStem`, conteneur `monogram` | idem | « HE » : un seul morceau |
| letterform | **plus grand cercle inscrit** dans le creux de la lettre (grille + affinage, distance au contour) — effet `counterMark`, variante `counter` | idem | forme centrée, creux préservé |
| emblem | **solveur radial** : hauteur de capitale qui couvre l'angle `sweep`, rayon qui centre le texte dans l'anneau `band` (marges égales cadre/symbole), relation linéaire résolue d'un coup | `render/text.ts` (`fitCurve`) | jamais de débordement |
| combination | **centrage optique** : le centre de masse du symbole (et non sa boîte) sur l'axe du nom, correction bornée à 12 % — `composition.optical` | `render/compose.ts` | écart optique réduit |
| abstract | grammaire étendue : motif `segment` (anneau interrompu : **fermeture gestaltiste**), centre `orbit` (lunes décalées d'un demi-pas), rayons en **proportion √2, φ ou 2** | `planner/recipes.ts` | symétrie tenue |
| negative-space | l'affineur règle la taille du motif creusé (échelle 0,35–0,85) | `planner/optimize.ts` | — |

Le noyau géométrique gagne quatre mesures **facultatives** (`rowIntervals`, `contains`,
`distanceToEdge`, `centroid`) : un noyau qui ne les fournit pas reste valide, les solveurs se taisent.

### Lot 4 — Géométrie africaine et calculée

- **`lusona`** (`render/generators/african.ts`) : les dessins sur sable tchokwe sont des
  **courbes-miroirs** (Gerdes). Grille de points, trajet diagonal réfléchi par le cadre et par des
  miroirs placés **par orbites d'un groupe de symétrie** (D2, ou C4 sur grille carrée) ; recherche
  d'une configuration **monolinéaire** (une seule ligne) ; lissage par Bézier quadratiques
  (contrôles aux nœuds, passages aux milieux : continuité G1). Rendu en **tracé** (premier
  générateur à trait : `GenPart.stroke`), jamais creusé ni contenu. Recette `abstract-lusona`,
  symétrie et style `monoline` déclarés.
- **`phi-arcs`** (`render/generators/computational.ts`) : cercles tangents intérieurement, rayons en
  progression φ / √2 / 2, alternativement retirés et ajoutés — l'idée d'Img2Logo sans la photo.
- **`tessellation`** : Delaunay (Bowyer–Watson) ou Voronoï (son dual) d'un semis **symétrique**
  d'ordre k, facettes rétrécies vers leur centre. Style `modular`.
- Le **style de construction** corrige le profil du type (`profileFor`) : un tracé monoligne a des
  boucles par nature, une mosaïque des facettes — elles ne sont plus comptées comme du désordre.

### Lot 5 — Continuité des courbes

`validate/curves.ts` lit les tracés libres (M L H V C S Q T Z), repère les raccords
**presque lisses** (cassure de 2° à 20° : la main qui tremble, pas un angle voulu) → défaut
`curve_kink`, et l'autocorrection les rend **G1** (poignées alignées sur la bissectrice, longueurs
conservées). Les angles francs ne sont jamais touchés.

### Lot 6 — Calibration humaine

`npm run calibrate:logo -- pairs` construit des logos des 11 types et écrit une page locale de
comparaisons par paires (← / → / =, export `judgments.json`). `npm run calibrate:logo -- fit
judgments.json` ajuste les poids de chaque profil (Bradley–Terry, poids positifs, rappel vers les
poids raisonnés), affiche l'accord avant/après et réécrit `validate/calibration.ts`, compilé avec
le moteur. Un type à moins de 20 jugements garde ses poids raisonnés. **Reste à faire : faire
remplir la page par des designers** — tant que ce n'est pas fait, les poids restent raisonnés.

### Recommandations restantes, appliquées

- **Front de Pareto** (exploitabilité × perception × originalité) : bonus à la sélection pour les
  compromis qu'aucun autre candidat ne domine.
- **Voronoï / Delaunay** : faits (générateur `tessellation`), en famille facultative.

## 6. Limites connues

- Les poids des profils restent **raisonnés** tant que la calibration humaine n'a pas été faite.
- **Le passage à High n'a pas été comparé à Ultra avec un vrai modèle** (règle « pas d'essais
  payants ») : la qualité du sens dépend désormais d'un seul appel au directeur.
- Le sens d'un pictogramme (un chat pour une joaillerie) reste hors de portée des mesures ; au
  cran High, c'est le directeur qui choisit les motifs.
- La note de rythme compte l'espace entre deux mots comme un écart entre lettres (« Wavy Lift »).
- Le crénage optique ne s'applique qu'aux nouveaux logos (`spacing: 'optical'` posé par les
  recettes) : un logo déjà enregistré se reconstruit à l'identique.
- Non vérifié dans le navigateur ; pas testé avec un vrai modèle.

## 7. Références vérifiées

- Zhang J., Yu J., Zhang K., Zheng X. S., Zhang J. *Computational Aesthetic Evaluation of Logos.* ACM Transactions on Applied Perception 14(3), 2017. doi:10.1145/3058982
- Henderson P. W., Cote J. A. *Guidelines for Selecting or Modifying Logos.* Journal of Marketing 62(2), 1998. doi:10.1177/002224299806200202
- Hsiao et al. *Img2Logo: Generating Golden Ratio Logos from Images.* Computer Graphics Forum 42(2), 2023. doi:10.1111/cgf.14742
- Wu X. *Beauty of symmetry — The impact of logo symmetry on perceived product quality.* PLOS ONE, 2025. doi:10.1371/journal.pone.0317229
- Zhang X., Xue C. *Visual Moment Equilibrium.* Symmetry 18(1):41, 2026. doi:10.3390/sym18010041
- Zou G., Dai C. et al. *DOGS: Design-Space Sampling for Prompt-Driven Logo Generation.* arXiv:2610.10760, 2026 (prépublication)
- Pittard N., Ewing M., Jevons C. *Aesthetic theory and logo design: examining consumer response to proportion across cultures.* International Marketing Review, 2007
- *Rule-Based Automatic Generation of Logo Designs.* Leonardo (Project MUSE 653604) — auteurs et année à confirmer sur la notice
- Ngo D. C. L., Teo L. S., Byrne J. G. *Modelling interface aesthetics.* Information Sciences, 2003
- Gerdes P. *Geometry from Africa.* MAA, 1999 · Eglash R. *African Fractals.* Rutgers University Press, 1999
