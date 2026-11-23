# Moteur de logos IDEM — logique détaillée

> **Sans OmniSVG.** Ce document décrit le pipeline complet hors modèle vectoriel.
> Source : `apps/api/api/services/logo-engine/`

---

## Principe fondateur

Le modèle IA ne dessine jamais de SVG. Il **décrit** son intention dans une
structure de données (le Logo IR), et le code la construit de façon
déterministe. Une même description donne toujours le même SVG ; elle tient en
100–400 tokens là où un SVG dessiné en demandait 28 000–77 000.

```
Brief marque
    │
    ▼
Agent créatif ──(décrit)──► Logo IR (JSON Zod)
                                │
                                ▼
                         Noyau géométrique (Paper.js)
                         + Typographie (OpenType.js)
                                │
                                ▼
                            SVG brut
                                │
                                ▼
                     Mesures qualité (déterministes)
                                │
                        ┌───────┴───────┐
                      accepté        défauts
                        │               │
                        ▼               ▼
                    Variantes      Patch ciblé (≤ 2 tours)
                        │
                        ▼
                   Rendu final + empreinte
```

---

## 1. Le Logo IR (`ir/logo.schema.ts`)

Le Logo IR est le **contrat** entre l'agent et le moteur. Il est validé et
normalisé par Zod avant tout traitement.

### Robustesse par conception

- Les **nombres hors bornes** sont ramenés dans leurs bornes (jamais rejetés) :
  `int(3, 12)` demandé à 14 donne 12.
- Les **clés inconnues** sont ignorées, les valeurs absentes reçoivent leur
  défaut.
- Seuls les identifiants en double ou les types de couche inconnus déclenchent
  une erreur.

### Structure d'un document

```
LogoDocument
├── version          "1.0"
├── brief            { brandName, tagline?, industry, audience, personality[] }
├── concept          { type, rationale, motifs[], recipe? }
├── canvas           { width: 64–4000, height: 32–4000 | "auto" }
├── palette          { ink, ink2?, accent? }   — couleurs #rrggbb
├── composition      { layout, gap, symbolScale?, align, padding, taglineScale }
├── layers[]         ≤ 48 couches au total (récursif)
└── variants[]       ≤ 12 variantes
```

### Les 11 types de concept

`wordmark` · `lettermark` · `letterform` · `pictorial` · `abstract` ·
`mascot` · `combination` · `emblem` · `dynamic` · `minimal` · `negative-space`

### Les 4 rôles de couleur

| Rôle     | Signification                                        |
|----------|------------------------------------------------------|
| `ink`    | Couleur principale (trait, forme, texte)             |
| `ink2`   | Couleur secondaire                                   |
| `accent` | Couleur d'accentuation                               |
| `paper`  | Le fond — une couche `paper` est une **découpe**     |

### Types de couches

| `kind`      | Description                                               |
|-------------|-----------------------------------------------------------|
| `shape`     | Forme géométrique (rect, circle, ellipse, polygon, star, ring, arc, superellipse, line, poly, path) |
| `text`      | Texte vectorisé (wordmark, tagline, texte dans le symbole) |
| `generator` | Motif délégué à un générateur du catalogue (58 générateurs) |
| `boolean`   | Opération booléenne (union, subtract, intersect, exclude) sur ≥ 2 couches |
| `repeat`    | Répétition d'une couche (radial, mirror-x/y/xy, linear, grid) |
| `group`     | Regroupement de couches                                   |

### Boîte de dessin

Les couches `symbol` et `frame` vivent dans une boîte **0–100** (origine haut
gauche). Le moteur mesure l'encre réelle et recadre automatiquement : l'auteur
n'a pas à centrer.

### Effets typographiques (10 effets, ≤ 3 par texte)

`dot` · `underline` · `bar` · `slice` · `ligature` · `dotReplace` ·
`cutCorner` · `accentChar` · `italic` · `swapRound`

---

## 2. Le noyau géométrique (`kernel/`, `render/`)

### Paper.js sans DOM (`kernel/paper.kernel.ts`)

Paper.js est chargé avec un objet `self` factice pour éviter le démarrage de
jsdom + node-canvas (conflit avec libvips/sharp). Le noyau tourne entièrement
en mémoire.

Bugs corrigés :
- `fontLoader.extractFontFileUrl` servait la première graisse d'une feuille
  multi-graisses (Poppins sortait en graisse 100) → corrigé, cache Redis passé
  en `font-file-v2`.
- L'aire signée de Paper annulait deux croissants (exclusion jetée comme
  « vide ») → aire calculée par contenance.
- Un générateur peint en `paper` perdait sa partie principale (découpes
  internes séparées par ton `knockout`).

### Primitives géométriques (`kernel/primitives.ts`)

Construction de tous les types de `GeometrySchema` :
rect, circle, ellipse, polygon, star, ring, arc, superellipse, line, poly,
path.

### Typographie (`kernel/typography.ts`, `render/text.ts`)

OpenType.js charge les glyphes vecteur police par police. Chaque effet
typographique est appliqué sur les paths résultants (pas sur du SVG `text`).
Les polices sont servies par `kernel/fontProviders.ts` (Fontshare + cache Redis
`font-file-v2`).

### Générateurs (`render/generators/`)

58 générateurs répartis en trois fichiers :

| Fichier           | Nb  | Domaine                          |
|-------------------|-----|----------------------------------|
| `abstract.ts`     | 16  | Formes géométriques abstraites   |
| `pictorial.ts`    | 34  | Symboles figuratifs              |
| `mascot.ts`       | 8   | Mascottes (1re génération)       |

Chaque générateur :
1. déclare un identifiant, un label, et ses paramètres avec leurs bornes,
2. reçoit un `PaperKernel` + ses paramètres normalisés + une graine,
3. retourne un `paper.Item`.

Enregistrement : `register(...)` dans `render/generators/registry.ts`.
Génération d'un nouveau générateur : ajouter un `register(...)` puis
`npm run docs:logo` pour regénérer `LOGO_GENERATORS.md`.

### Construction finale (`render/build.ts`, `render/compose.ts`, `render/svg.ts`)

1. Valider le Logo IR (Zod).
2. Construire chaque couche dans Paper.
3. Appliquer les transformations (miroir → échelle → inclinaison → rotation →
   translation).
4. Composer (layout : horizontal / stacked / symbol-only / wordmark-only /
   auto).
5. Produire le SVG (SVGO, optimisation).
6. Produire les variantes (monochromes, inversées, symbole seul, wordmark seul).

### Rastérisation (`raster/rasterizer.ts`, `raster/measure.ts`)

`resvg-js` convertit le SVG en PNG (sans Chromium, déterministe).
`measure.ts` lit le PNG pixel par pixel pour des métriques de qualité visuelles
(aire d'encre, carte 20×20, marges).

---

## 3. Le pipeline qualité (`pipeline.ts`)

```
produceLogo(input, options)
    │
    ├─ 1. buildLogo → doc + session + rendered
    │
    ├─ 2. assessLogo → QualityReport (score, defects, accepted)
    │
    └─ 3. pour round in [0, 1] si !accepted :
              fixOnce(doc, defects) → patch minimal
              buildLogo(patched)
              assessLogo
              si nextScore < prevScore → on garde l'avant
```

**Règle d'or** : un patch ne doit jamais aggraver. Si le score baisse, on
conserve l'état d'avant la correction.

### Validation technique (`validate/technical.ts`)

Vérifications déterministes sur le SVG/PNG produit :
- Absence de ViewBox vide ou nulle.
- Présence d'encre visible (aire > seuil).
- Pas de débordement hors zone de sécurité.
- Lisibilité du texte (hauteur de capitale minimale).

### Validation visuelle (`validate/visual.ts`)

Métriques mesurées sur le PNG :
- Carte d'encre 20×20 (densité par zone).
- Équilibre gauche/droite, haut/bas.
- Contraste palette (encre vs fond).
- Lisibilité à petite taille (48×48 px).

### Bonnes pratiques (`validate/practices.ts`)

Règles déclaratives par type de concept (pictorial, abstract, letterform…),
mesurées ET communiquées aux agents (warnings inclus dans `assessLogo`).

### Empreinte (`validate/fingerprint.ts`)

Vecteur numérique extrait du PNG rastérisé (histogramme de forme + carte
d'encre). Permet de comparer deux logos sans modèle :

- `fingerprintDistance(a, b)` → 0 identiques, 1 rien de commun.
- `LOGO_SIMILARITY.tooClose` : seuil en deçà duquel deux logos sont
  considérés identiques.
- `LOGO_SIMILARITY.distinct` : seuil au-delà duquel deux logos sont
  suffisamment différents.

Stockage dans Redis : `LogoModel.ir` + `.engine` (empreinte du logo déjà
montré au projet).

### Autocorrection (`validate/autofix.ts`)

`fixOnce(doc, defects)` applique un patch minimal sur les défauts corrigibles
(proportions, marges, contraste palette). Retourne `null` si aucune correction
n'est possible.

---

## 4. L'agent créatif (`agent/agent.ts`)

L'agent reçoit un brief et un cran de créativité, et retourne des logos.

### Les 4 crans

| Cran     | Tokens IA | Ce que fait l'IA                                        |
|----------|-----------|---------------------------------------------------------|
| `low`    | 0         | Planificateur seul                                      |
| `medium` | ~100      | Le sélecteur choisit parmi 9 candidats construits       |
| `high`   | ~500      | Le directeur donne 3 directions (type + générateur + idée) |
| `ultra`  | ~14 500   | L'auteur écrit le Logo IR de chaque direction (2+1 brouillons), jury, critique visuelle |

> **Le logo est toujours généré au cran Ultra** (décision IDEM, `idem.service.ts`).

### Étape 1 — Le planificateur (tous les crans, 0 token)

`planner/planner.ts` :
1. Génère des **candidats** : `catégorie × recette × générateur × paramètres × graine`.
2. Construit chacun via le pipeline qualité.
3. Retient les propositions les plus **distinctes** entre elles et de ce qui a
   déjà été montré (mémoire d'empreintes Redis).

Paramètres de tirage :

| Cran     | `explore` | Tentatives |
|----------|-----------|-----------|
| `low`    | 0.15      | 18        |
| `medium` | 0.35      | 18        |
| `high`   | 0.50      | 12        |
| `ultra`  | 0.80      | 12        |

Sélection finale (`selectDistinct`) : prend la meilleure par score, puis les
plus éloignées en empreinte, avec pénalité si même type, si trop proche d'un
logo existant, ou si trop proche d'un logo d'un autre projet IDEM (pool
`crowd`).

### Étape 2 — Le sélecteur (medium)

L'IA reçoit 9 candidats déjà construits et mesurés (descriptions textuelles +
recettes) et choisit les 3 meilleures. Si l'IA échoue → les choix du
planificateur.

### Étape 3 — Le directeur (high+)

L'IA reçoit un menu de directions (`directionMenu` : catégories pondérées par
le brief) et propose 3 directions (type + générateur ou variante + idée en
prose). Le directeur **nomme les clichés** du métier ; le code les bannit à
tous les étages suivants.

Originalité (`planner/originality.ts`) :
- Le sens (nom, valeurs) **rapporte** des points.
- Le secteur **coûte** (tire vers les clichés).
- Les clichés identifiés sont mis en liste noire dans Redis :
  - `logooriginality:global-v1` : fréquence récente dans tout IDEM.
  - `logooriginality:cliches:<id>` : clichés propres au projet.

### Étape 4 — L'auteur (ultra)

Pour chaque direction, en parallèle (concurrence ≤ 6) :

```
Direction i
    │
    ├─ Vague 1 : 2 appels auteur simultanés
    │       └─ si ≥ 1 brouillon accepté → stop
    │
    └─ Vague 2 : 1 appel auteur supplémentaire
                (seulement si vague 1 = 0 brouillon accepté)
```

L'auteur reçoit : fiche marque, brief, direction, palette, boîtes 0–100 et
carte d'encre 20×20. Il écrit un Logo IR complet. Les brouillons qui
contiennent un cliché banni sont écartés avant d'entrer dans le pipeline.

Chaque brouillon repasse par le pipeline qualité. Si un brouillon domine
(écart de score ≥ 12), le jury n'est pas consulté.

#### Jury

Le jury reçoit les brouillons acceptés (descriptions + scores) et vote pour le
meilleur. Si l'IA échoue → le brouillon avec le meilleur score mesuré.

### Étape 5 — Le critique (ultra, vision)

Pour chaque logo retenu, en parallèle :

1. Rastériser en PNG 560 px + miniature 48 px (côte à côte via `sharp`).
2. Envoyer l'image au modèle de vision avec `CRITIC_INSTRUCTION`.
3. Analyser la réponse (`parseCritique`) : scores (5 axes), verdict, patch.
4. Appliquer le patch via `applyPatch` (jamais un nouveau dessin).
5. Repasser le pipeline qualité — si le score baisse : on garde l'avant.
6. Au plus **2 tours** de critique.

Le patch ne peut jamais remplacer un symbole par un cliché banni.

### Étape 6 — Finalisation

Recalcul des variantes complètes, empreintes finales, calcul de la nouveauté
(`novelty` : distance au plus proche des logos déjà montrés).

---

## 5. L'originalité (`planner/originality.ts`)

| Mécanisme           | Description                                              |
|---------------------|----------------------------------------------------------|
| `literalGenerators` | Générateurs évidents pour le secteur (clichés par défaut) |
| `originalityOf`     | Contexte d'originalité : pénalités + rareté             |
| `generatorsOf`      | Liste les générateurs utilisés dans une structure de couches |

Le planificateur pénalise les générateurs sur-représentés dans IDEM et ceux
liés au secteur. L'auteur reçoit explicitement la liste des clichés interdits.

---

## 6. Les variantes (`render/variants.ts`)

4 variantes générées automatiquement depuis le Logo IR (sans IA) :

| `kind`        | Description                                   |
|---------------|-----------------------------------------------|
| `primary`     | Couleurs de la palette                        |
| `monochrome`  | Une seule couleur (noir sur fond clair)       |
| `inverted`    | Blanc sur fond sombre                         |
| `symbol`      | Symbole seul (sans nom)                       |

Les overrides de variantes (`LayerOverride`) permettent de masquer une couche,
changer sa couleur ou ses paramètres pour un fond donné.

---

## 7. L'export et les déclinaisons (`export/package.ts`, `idem.service.ts`)

- **Déclinaisons** : générées sans IA depuis le Logo IR (couleurs exactes +
  nouvelle police) via `brand/logoAdapt`.
- **Export** : `exportLogoPackage` / `zipExport` (préparés mais pas encore
  exposés dans l'interface).
- **Empreinte persistée** : `LogoModel.ir` + `.engine` → mémoire des logos
  déjà montrés au projet (evite les répétitions futures).

---

## 8. Replis et modes dégradés

| Situation                        | Comportement                                          |
|----------------------------------|-------------------------------------------------------|
| Modèle IA absent ou lent         | Le planificateur décide seul (toujours exploitable)   |
| Brouillon IA échoue Zod          | Brouillon du planificateur pour cette direction       |
| Patch dégrade le score           | On conserve l'état d'avant la correction              |
| Critique échoue (vision)         | Le logo est gardé tel quel                            |
| Moteur en erreur                 | `LOGO_ENGINE=legacy` → ancien pipeline SVG du modèle  |
| Propositions insuffisantes       | `templateLogos` complète si manque de propositions    |

---

## 9. Contrôles et commandes

```bash
npm run check:logo      # 150 vérifications (hors ligne, modèle simulé)
npm run docs:logo       # Regénère LOGO_GENERATORS.md
npm run check:all       # Inclut check:logo
```

---

## 10. Dépendances ajoutées à `apps/api`

| Paquet            | Usage                                                 |
|-------------------|-------------------------------------------------------|
| `paper`           | Noyau géométrique (chargé avec `self` factice)        |
| `@resvg/resvg-js` | Rastérisation SVG → PNG (sans Chromium)               |
| `opentype.js`     | Vectorisation des glyphes typographiques              |
| `zod`             | Validation et normalisation du Logo IR                |
| `sharp`           | Composition côte-à-côte pour le critique (vision)     |
| `svgo`            | Optimisation du SVG produit                           |

---

## 11. Coût token estimé par cran

| Cran     | Input + output estimés | Comparaison ancien pipeline |
|----------|------------------------|-----------------------------|
| `low`    | 0 token                | —                           |
| `medium` | ~400 tokens            | ~28 700 tokens              |
| `ultra`  | ~14 500 tokens         | ~77 300 tokens              |

---

## 12. Ajouter un générateur

1. Créer la fonction dans `render/generators/abstract.ts`,
   `pictorial.ts` ou `mascot.ts`.
2. `register({ id, label, params, draw })` dans `registry.ts`.
3. `npm run docs:logo` pour regénérer `LOGO_GENERATORS.md`.
4. `npm run check:logo` pour vérifier que les 150 contrôles passent.
5. Pas de modification hors `logo-engine/` : le moteur est isolé du reste
   d'IDEM via `idem.service.ts`.
